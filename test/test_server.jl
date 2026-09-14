# Integration tests: start the real server, real WebSocket client, real sandbox. Slow (one test
# takes RUN_BUDGET seconds for the timeout case) — gated behind JULIATIME_INTEGRATION=1.

# `_stop_mode` is pure (no real stdin touched, no `eof` probe) so it always runs, unlike the rest
# of this file.
@testset "_stop_mode" begin
    io = IOBuffer("\n")

    # stdin itself: Enter-to-stop only for an interactive terminal. A background launcher (CI,
    # /dev/null stdin, a shell pipe like `tail -f /dev/null | julia run.jl`) gets :wait because it
    # is not a terminal — readline would otherwise return immediately at EOF (a closed pipe) and
    # shut the server down before the first request (T1), or block forever on a pipe that never
    # closes. Note there is deliberately no `eof`-based branch: probing `eof` on a non-terminal
    # stream that never closes would itself block forever, which is the bug this signature exists
    # to make impossible to reintroduce.
    @test JuliaTime._stop_mode(stdin, true) === :enter
    @test JuliaTime._stop_mode(stdin, false) === :wait

    # An explicit non-stdin IO (what the programmatic tests below pass) always keeps the existing
    # Enter-to-stop behaviour, regardless of tty state.
    @test JuliaTime._stop_mode(io, true) === :enter
    @test JuliaTime._stop_mode(io, false) === :enter
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    using HTTP, JSON
    # Sockets is only in the Manifest transitively (via HTTP.jl), not a declared JuliaTime
    # dependency (Project.toml is off limits for this slice) — so a free port is found by retrying
    # `start_server` over a range rather than via `Sockets.listenany`.

    # A cold or never-pinged worker now narrates its own "restarting"/"running" status (S1, B1/B2)
    # before the substantive reply a plain `run` or `case_run` request is waiting for. Tests that
    # only care about that substantive reply skip any interleaved `status` frames with this.
    _receive_reply(ws) = begin
        msg = JSON.parse(String(HTTP.WebSockets.receive(ws)))
        while msg["type"] == "status"
            msg = JSON.parse(String(HTTP.WebSockets.receive(ws)))
        end
        msg
    end

    @testset "server" begin
        @testset "default browser destination" begin
            @test JuliaTime._browser_url("127.0.0.1", 8000) == "http://127.0.0.1:8000/course/index.html"
        end

        @testset "JULIATIME_NO_BROWSER=1 skips the opener even when open_browser=true" begin
            opened = Ref{Union{Nothing,String}}(nothing)
            _record_opener(url) = (opened[] = url; nothing)

            no_browser_port = 0
            no_browser_server = nothing
            withenv("JULIATIME_NO_BROWSER" => "1") do
                for candidate in 9200:9299
                    try
                        no_browser_server = JuliaTime.start_server(; host="127.0.0.1", port=candidate,
                                                                     open_browser=true, browser_opener=_record_opener)
                        no_browser_port = candidate
                        break
                    catch
                    end
                end
            end
            no_browser_port == 0 && error("no free port found in 9200:9299")
            try
                @test opened[] === nothing
            finally
                JuliaTime.stop_server(no_browser_server; force=true)
            end

            # Without the env var, open_browser=true does invoke the (injected) opener — this is
            # the control that proves the assertion above is meaningful, not a vacuous "opener was
            # never wired up at all".
            with_browser_port = 0
            with_browser_server = nothing
            for candidate in 9300:9399
                try
                    with_browser_server = JuliaTime.start_server(; host="127.0.0.1", port=candidate,
                                                                   open_browser=true, browser_opener=_record_opener)
                    with_browser_port = candidate
                    break
                catch
                end
            end
            with_browser_port == 0 && error("no free port found in 9300:9399")
            try
                @test opened[] == JuliaTime._browser_url("127.0.0.1", with_browser_port)
            finally
                JuliaTime.stop_server(with_browser_server; force=true)
            end
        end

        port = 0
        server = nothing
        for candidate in 8100:8999
            try
                server = JuliaTime.start_server(; host="127.0.0.1", port=candidate, open_browser=false)
                port = candidate
                break
            catch
            end
        end
        port == 0 && error("no free port found in 8100:8999")

        try
            @testset "static serving" begin
                @info "server test: GET index"
                r = HTTP.get("http://127.0.0.1:$port/")
                @test r.status == 200
                @test occursin("<html", lowercase(String(r.body)))

                @info "server test: GET missing path"
                r404 = HTTP.get("http://127.0.0.1:$port/nope"; status_exception=false)
                @test r404.status == 404

                @info "server test: GET traversal path"
                r_escape = HTTP.get("http://127.0.0.1:$port/../Project.toml"; status_exception=false)
                @test r_escape.status == 404
            end

            @testset "websocket" begin
                @info "server test: opening WebSocket"
                HTTP.WebSockets.open("ws://127.0.0.1:$port/ws") do ws
                    @info "server test: ping"
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "ping")))
                    pong = _receive_reply(ws)
                    @test pong["type"] == "pong"

                    @info "server test: arithmetic"
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "run", "code" => "1+1")))
                    r1 = _receive_reply(ws)
                    @test r1["type"] == "result"
                    @test r1["status"] == "ok"
                    @test r1["value_repr"] == "2"

                    @info "server test: stdout"
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "run", "code" => "println(\"hi\")")))
                    r2 = _receive_reply(ws)
                    @test r2["status"] == "ok"
                    @test r2["stdout"] == "hi\n"

                    @info "server test: malformed JSON"
                    HTTP.WebSockets.send(ws, "not json")
                    err = _receive_reply(ws)
                    @test err["type"] == "error"

                    # connection survived the bad message
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "ping")))
                    pong2 = _receive_reply(ws)
                    @test pong2["type"] == "pong"

                    @info "server test: timeout"
                    timeout_started = time()
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "run", "code" => "while true end")))
                    r3 = _receive_reply(ws)
                    @test r3["status"] == "timeout"
                    @test time() - timeout_started < 10.0

                    @info "server test: runtime error"
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "run", "code" => "undefined_name")))
                    r4 = _receive_reply(ws)
                    @test r4["status"] == "error"
                    @test occursin("doesn't exist", r4["message"])
                end
            end

            @testset "case_run sends a truthful restart status, then running, then the result (B1/B2)" begin
                # Reproduces the exact end-to-end path the review found dead: a chapter's real
                # `case_run` message, over a real WebSocket, against a pool forced empty so the
                # worker must be respawned — the failure the client-side fix (RUN_DEADLINE_MS)
                # must survive. See docs/dev-log/reviews/2026-09-12-v02-candidate-panel-adversary.md.
                JuliaTime.shutdown!()
                HTTP.WebSockets.open("ws://127.0.0.1:$port/ws") do ws
                    withenv("JULIATIME_TEST_SLOW_WORKER_START" => "8") do
                        @info "server test: case_run status sequence"
                        started = time()
                        HTTP.WebSockets.send(ws, JSON.json(Dict(
                            "type" => "case_run", "chapter" => "C1", "request_id" => "status-seq-1",
                            "code" => "jars[jars.batch_id .== case_batch, :]")))
                        statuses = String[]
                        result = nothing
                        while result === nothing
                            msg = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                            if msg["type"] == "status"
                                @test msg["request_id"] == "status-seq-1"
                                push!(statuses, msg["status"])
                            elseif msg["type"] == "case_result"
                                result = msg
                            else
                                error("unexpected message type $(msg["type"]) while waiting for case_result")
                            end
                        end
                        elapsed = time() - started
                        @test statuses == ["restarting", "running"]
                        @test result["request_id"] == "status-seq-1"
                        @test result["status"] == "ok"
                        @test result["pass"] == true
                        # The 8s worker-start delay is real server time (past the client's old
                        # 7000ms RUN_DEADLINE_MS) yet the sandbox layer never reports a timeout —
                        # a learner-visible timeout is a client-side concern, fixed in web/*.js.
                        @test elapsed > 7.0
                        @test result["status"] != "timeout"
                    end
                end
                JuliaTime.warmup!()
            end
        finally
            @info "server test: stopping HTTP server"
            JuliaTime.stop_server(server)
            @info "server test: HTTP server stopped"
        end

        @testset "server stopped" begin
            @test_throws Exception HTTP.get("http://127.0.0.1:$port/"; connect_timeout=2, request_timeout=3, retry=false)
        end

        @testset "forced stop closes an idle WebSocket" begin
            forced_port = 0
            forced_server = nothing
            for candidate in 9100:9199
                try
                    forced_server = JuliaTime.start_server(; host="127.0.0.1", port=candidate, open_browser=false)
                    forced_port = candidate
                    break
                catch
                end
            end
            forced_port == 0 && error("no free port found in 9100:9199")

            stop_task = nothing
            try
                HTTP.WebSockets.open("ws://127.0.0.1:$forced_port/ws") do ws
                    # This is the run_server Ctrl-C cleanup contract: an open browser socket
                    # must not turn application exit into an unbounded graceful wait.
                    stop_task = @async JuliaTime.stop_server(forced_server; force=true)
                    stopped = timedwait(() -> istaskdone(stop_task), 2.0; pollint=0.05)
                    @test stopped == :ok
                    if stopped == :ok
                        @test fetch(stop_task) === nothing
                    else
                        # Do not let a future forced-shutdown regression leave the client block
                        # waiting for its own close handshake before this test's fallback runs.
                        HTTP.forceclose(forced_server)
                    end
                end
            finally
                # Keep the red run bounded if the new forced-stop API is absent or regresses.
                forced_server !== nothing && HTTP.forceclose(forced_server)
                if stop_task !== nothing
                    try
                        wait(stop_task)
                    catch
                    end
                end
            end
            @test !isopen(forced_server)
        end

        owned_processes = lock(JuliaTime._POOL_LOCK) do
            collect(values(JuliaTime._OWNED_PROCESSES))
        end
        shutdown!()
        @test JuliaTime._REFILL[] === nothing
        @test isempty(JuliaTime._POOL)
        @test isempty(JuliaTime._OWNED_PROCESSES)

        @testset "explicit stop input cleans up launcher" begin
            @test JuliaTime.run_server(port=0, open_browser=false, stop_input=IOBuffer("\n")) === nothing
            @test isempty(JuliaTime._OWNED_PROCESSES)
            @test JuliaTime.nprocs() == 1
        end
        @test JuliaTime.nprocs() == 1
        @test all(p -> !process_running(p), owned_processes)

        # Shutdown does not permanently disable the ordinary server-start warmup path.
        JuliaTime.warmup!(n=1)
        @test !isempty(JuliaTime._POOL)
        shutdown!()
        @test isempty(JuliaTime._OWNED_PROCESSES)
    end

    @testset "serve-first: the Case Board answers before the sandbox has warmed up" begin
        # Reproduces the CI/cold-laptop failure directly: `start_server` must not block the HTTP
        # listener on `warmup!()` (package JIT, two worker processes) any more. `warmup_fn` is the
        # test-only hook `start_server` runs in the background instead of the real `warmup!()`, so
        # this test proves the *ordering* (serve, then warm) without depending on how fast a real
        # warmup happens to be on this machine.
        JuliaTime.shutdown!()
        warmup_started = Ref(false)
        warmup_finished = Ref(false)
        slow_warmup = () -> begin
            warmup_started[] = true
            sleep(3.0)
            warmup_finished[] = true
        end

        port = 0
        server = nothing
        for candidate in 8500:8599
            try
                server = JuliaTime.start_server(; host="127.0.0.1", port=candidate, open_browser=false,
                                                 warmup_fn=slow_warmup)
                port = candidate
                break
            catch
            end
        end
        port == 0 && error("no free port found in 8500:8599")

        try
            started = time()
            r = HTTP.get("http://127.0.0.1:$port/course/index.html")
            elapsed = time() - started
            @info "serve-first test: GET /course/index.html took $(round(elapsed; digits=3))s"
            @test r.status == 200
            @test occursin("<html", lowercase(String(r.body)))
            @test elapsed < 1.0
            # The page came back well before the 3s background hook could finish — proves the
            # ordering (serve first), not merely that warm-up eventually happens.
            @test !warmup_finished[]
        finally
            JuliaTime.stop_server(server; force=true)
        end

        # The background hook did start (it is not simply skipped) and, given time, completes.
        @test timedwait(() -> warmup_started[] && warmup_finished[], 5.0; pollint=0.05) == :ok
    end

    @testset "a case_run submitted while the sandbox is still warming up completes correctly" begin
        # Races a real learner `case_run` against the real `warmup!()` running in the background
        # (default `warmup_fn`) — the scenario item 2 of the ticket asks for: `_take_worker!` /
        # `_POOL_LOCK` must cooperate with a concurrent `warmup!()` with no deadlock and no
        # double-spawn beyond `MAX_WORKERS`, and the learner's move must still get the right
        # answer (a status message first, then the real result — never a false timeout).
        JuliaTime.shutdown!()   # pool starts empty; the race is genuine, not against an idle warm pool

        port = 0
        server = nothing
        for candidate in 8600:8699
            try
                server = JuliaTime.start_server(; host="127.0.0.1", port=candidate, open_browser=false)
                port = candidate
                break
            catch
            end
        end
        port == 0 && error("no free port found in 8600:8699")

        try
            HTTP.WebSockets.open("ws://127.0.0.1:$port/ws") do ws
                # No delay before sending: the background `warmup!()` this `start_server` call just
                # kicked off is very likely still spawning/prewarming its own workers right now.
                HTTP.WebSockets.send(ws, JSON.json(Dict(
                    "type" => "case_run", "chapter" => "C1", "request_id" => "warm-race-1",
                    "code" => "jars[jars.batch_id .== case_batch, :]")))
                statuses = String[]
                result = nothing
                deadline = time() + 30.0
                while result === nothing
                    time() > deadline && error("timed out waiting for case_result")
                    msg = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    if msg["type"] == "status"
                        @test msg["request_id"] == "warm-race-1"
                        push!(statuses, msg["status"])
                    elseif msg["type"] == "case_result"
                        result = msg
                    else
                        error("unexpected message type $(msg["type"]) while waiting for case_result")
                    end
                end
                @test !isempty(statuses)          # a truthful status came before the result
                @test result["request_id"] == "warm-race-1"
                @test result["status"] == "ok"    # never a false timeout from racing the warm-up
                @test result["pass"] == true
            end
            # No double-spawn: the concurrent background warm-up and the learner's own worker
            # acquisition never push the pool past the hard cap.
            n_owned = lock(JuliaTime._POOL_LOCK) do
                length(JuliaTime._OWNED_PROCESSES)
            end
            @test n_owned <= JuliaTime.MAX_WORKERS
        finally
            JuliaTime.stop_server(server; force=true)
            JuliaTime.shutdown!()
        end
    end
end

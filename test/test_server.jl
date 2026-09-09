# Integration tests: start the real server, real WebSocket client, real sandbox. Slow (one test
# takes RUN_BUDGET seconds for the timeout case) — gated behind JULIATIME_INTEGRATION=1.

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    using HTTP, JSON
    # Sockets is only in the Manifest transitively (via HTTP.jl), not a declared JuliaTime
    # dependency (Project.toml is off limits for this slice) — so a free port is found by retrying
    # `start_server` over a range rather than via `Sockets.listenany`.

    @testset "server" begin
        @testset "default browser destination" begin
            @test JuliaTime._browser_url("127.0.0.1", 8000) == "http://127.0.0.1:8000/course/index.html"
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
                    pong = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test pong["type"] == "pong"

                    @info "server test: arithmetic"
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "run", "code" => "1+1")))
                    r1 = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test r1["type"] == "result"
                    @test r1["status"] == "ok"
                    @test r1["value_repr"] == "2"

                    @info "server test: stdout"
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "run", "code" => "println(\"hi\")")))
                    r2 = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test r2["status"] == "ok"
                    @test r2["stdout"] == "hi\n"

                    @info "server test: malformed JSON"
                    HTTP.WebSockets.send(ws, "not json")
                    err = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test err["type"] == "error"

                    # connection survived the bad message
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "ping")))
                    pong2 = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test pong2["type"] == "pong"

                    @info "server test: timeout"
                    timeout_started = time()
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "run", "code" => "while true end")))
                    r3 = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test r3["status"] == "timeout"
                    @test time() - timeout_started < 10.0

                    @info "server test: runtime error"
                    HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "run", "code" => "undefined_name")))
                    r4 = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test r4["status"] == "error"
                    @test occursin("doesn't exist", r4["message"])
                end
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
end

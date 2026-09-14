# Integration: a headless client (a real WebSocket connection) plays every level end to end,
# against the real server, real sandbox, real levels. Slow — L6 draws 10^8 three times and the
# timeout case burns a full RUN_BUDGET — so gated behind JULIATIME_INTEGRATION=1, same convention
# as test_server.jl.

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    using HTTP, JSON

    @testset "integration: headless client plays the levels" begin
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

        # Send one message, parse and return the substantive reply. A cold or never-pinged worker
        # now narrates its own "restarting"/"running" status (S1, B1/B2) before the real reply, so
        # skip any interleaved `status` frames rather than treating one as the answer.
        function ask(ws, dict)
            HTTP.WebSockets.send(ws, JSON.json(dict))
            reply = JSON.parse(String(HTTP.WebSockets.receive(ws)))
            while reply["type"] == "status"
                reply = JSON.parse(String(HTTP.WebSockets.receive(ws)))
            end
            return reply
        end

        try
            HTTP.WebSockets.open("ws://127.0.0.1:$port/ws") do ws

                @testset "levels list" begin
                    reply = ask(ws, Dict("type" => "levels"))
                    @test reply["type"] == "levels"
                    ids = [l["id"] for l in reply["levels"]]
                    @test ids == ["L0", "L0.5", "L1", "L2", "L3", "L4", "L5", "L6"]
                    l05 = only(filter(l -> l["id"] == "L0.5", reply["levels"]))
                    @test l05["ungraded"] == true
                end

                @testset "level_info for every level" begin
                    for id in ("L0", "L0.5", "L1", "L2", "L3", "L4", "L5", "L6")
                        reply = ask(ws, Dict("type" => "level_info", "level" => id))
                        @test reply["type"] == "level"
                        @test reply["visual"] isa AbstractString
                        @test reply["bridge"]["julia"] != ""
                        @test reply["bridge"]["r"] != ""
                        @test reply["bridge"]["python"] != ""
                        if id == "L1"
                            @test length(reply["tasks"]) == 4
                        end
                    end
                end

                @testset "unknown level_info" begin
                    reply = ask(ws, Dict("type" => "level_info", "level" => "L99"))
                    @test reply["type"] == "error"
                end

                # Contract keys per visual, checked below after each level's run.
                payload_keys = Dict(
                    "bar" => ["draws"],
                    "rows" => ["label", "rows", "summary", "door"],
                    "deck" => ["hands", "estimate", "truth"],
                    "gallery" => ["shots", "target", "overlap"],
                    "race" => ["julia_ms", "r_ms", "python_ms", "note"],
                )

                @testset "every level, every task: solution passes" begin
                    for id in ("L0", "L1", "L2", "L3", "L4", "L5", "L6")
                        info = ask(ws, Dict("type" => "level_info", "level" => id))
                        level = JuliaTime.level_by_id(id)
                        n = length(level.solution)
                        for k in 1:n
                            t0 = time()
                            reply = ask(ws, Dict("type" => "run", "level" => id, "task" => k, "code" => level.solution[k]))
                            dt = time() - t0
                            println("  $id task $k: $(round(dt; digits=2))s (elapsed_ms=$(reply["elapsed_ms"]))")

                            @test reply["type"] == "result"
                            @test reply["status"] == "ok"
                            @test reply["pass"] == true
                            @test !isempty(reply["feedback"])
                            @test reply["elapsed_ms"] isa Real

                            pl = reply["payload"]
                            @test pl isa AbstractDict
                            visual = info["visual"]
                            for key in payload_keys[visual]
                                @test haskey(pl, key)
                            end
                            if visual == "race"
                                @test pl["julia_ms"] isa Real
                                @test pl["r_ms"] === nothing
                                @test pl["python_ms"] === nothing
                            end
                            if visual == "rows"
                                @test length(pl["rows"]) == 48
                            end
                        end
                    end
                end

                @testset "one wrong answer per level" begin
                    for id in ("L0", "L1", "L2", "L3", "L4", "L5", "L6")
                        reply = ask(ws, Dict("type" => "run", "level" => id, "task" => 1, "code" => "nothing"))
                        @test reply["type"] == "result"
                        @test reply["status"] == "ok"
                        @test reply["pass"] == false
                        @test !isempty(reply["feedback"])
                    end
                end

                @testset "L0.5 run is an error" begin
                    reply = ask(ws, Dict("type" => "run", "level" => "L0.5", "task" => 1, "code" => "1"))
                    @test reply["type"] == "error"
                end

                @testset "out-of-range task is an error" begin
                    reply = ask(ws, Dict("type" => "run", "level" => "L0", "task" => 99, "code" => "1"))
                    @test reply["type"] == "error"
                end

                @testset "timeout on L0" begin
                    reply = ask(ws, Dict("type" => "run", "level" => "L0", "task" => 1, "code" => "while true end"))
                    @test reply["type"] == "result"
                    @test reply["status"] == "timeout"
                    @test reply["pass"] == false
                end

                @testset "server still up: ping" begin
                    reply = ask(ws, Dict("type" => "ping"))
                    @test reply["type"] == "pong"
                end
            end
        finally
            JuliaTime.stop_server(server)
            shutdown!()
        end
    end
end

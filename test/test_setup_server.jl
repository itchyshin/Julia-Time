# Fresh story readiness must also survive the real local WebSocket boundary.
if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    using HTTP, JSON

    @testset "setup status server" begin
        port = 0
        server = nothing
        for candidate in 9400:9499
            try
                server = JuliaTime.start_server(; host="127.0.0.1", port=candidate, open_browser=false)
                port = candidate
                break
            catch
            end
        end
        port == 0 && error("no free port found in 9400:9499")

        try
            HTTP.WebSockets.open("ws://127.0.0.1:$port/ws") do ws
                HTTP.WebSockets.send(ws, JSON.json(Dict(
                    "type" => "setup_status",
                    "request_id" => "wire-story-1",
                    "scope" => "story",
                )))
                reply = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                @test reply["type"] == "setup_status"
                @test reply["request_id"] == "wire-story-1"
                @test reply["contract_version"] == "setup-v1"
                @test reply["host"] == "127.0.0.1"
                @test reply["story"]["component"] == "julia"
                @test reply["story"]["state"] == "ready"
                @test reply["story"]["reason"] == "JULIA_READY"
                @test reply["laboratory"] == Dict("state" => "not_checked")

                # The initial slice never accepts page-supplied execution data
                # and does not pretend the optional laboratory is implemented.
                for request in (
                        Dict("type" => "setup_status", "request_id" => "wire-host", "scope" => "story", "host" => "0.0.0.0"),
                        Dict("type" => "setup_status", "request_id" => "wire-code", "scope" => "story", "code" => "20 + 22"),
                        Dict("type" => "setup_status", "request_id" => "wire-lab", "scope" => "laboratory"),
                    )
                    HTTP.WebSockets.send(ws, JSON.json(request))
                    error_reply = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test error_reply["type"] == "error"
                end

                HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "ping")))
                @test JSON.parse(String(HTTP.WebSockets.receive(ws)))["type"] == "pong"
            end
        finally
            server === nothing || JuliaTime.stop_server(server; force=true)
            JuliaTime.shutdown!()
        end
    end
end

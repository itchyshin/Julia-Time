using Dates

@testset "fresh story setup status" begin
    # This test is deliberately an early RED seam for the browser-facing
    # readiness route. A running server is not itself a Julia-ready claim.
    @test isdefined(JuliaTime, :setup_status_reply)

    if isdefined(JuliaTime, :setup_status_reply)
        @test isdefined(JuliaTime, :JULIA_SANDBOX_FAILED_NEXT_ACTION)
        if isdefined(JuliaTime, :JULIA_SANDBOX_FAILED_NEXT_ACTION)
            recovery = JuliaTime.JULIA_SANDBOX_FAILED_NEXT_ACTION
            @test occursin("restart the supplied launcher", recovery)
            @test !occursin("check_setup.jl", recovery)
        end

        request = Dict(
            "type" => "setup_status",
            "request_id" => "setup-story-1",
            "scope" => "story",
        )
        reply = JuliaTime.handle_message(request)

        @test reply["type"] == "setup_status"
        @test reply["request_id"] == "setup-story-1"
        @test reply["contract_version"] == "setup-v1"
        @test reply["server_version"] == string(Base.pkgversion(JuliaTime))
        @test reply["host"] == "127.0.0.1"
        @test reply["laboratory"] == Dict("state" => "not_checked")

        story = reply["story"]
        @test story["contract_version"] == "setup-v1"
        @test story["component"] == "julia"
        @test story["state"] == "ready"
        @test story["reason"] == "JULIA_READY"
        @test story["version"] == string(VERSION)
        @test occursin(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", story["checked_at"])
        @test !isempty(story["next_action"])

        for bad_request in (
                Dict("type" => "setup_status", "scope" => "story"),
                Dict("type" => "setup_status", "request_id" => 1, "scope" => "story"),
                Dict("type" => "setup_status", "request_id" => "", "scope" => "story"),
                Dict("type" => "setup_status", "request_id" => "bad-scope", "scope" => "benchmark"),
                Dict("type" => "setup_status", "request_id" => "bad-host", "scope" => "story", "host" => "0.0.0.0"),
                Dict("type" => "setup_status", "request_id" => "bad-command", "scope" => "story", "command" => "anything"),
                Dict("type" => "setup_status", "request_id" => "bad-code", "scope" => "story", "code" => "20 + 22"),
                Dict("type" => "setup_status", "request_id" => "bad-path", "scope" => "story", "path" => "/tmp/not-a-probe"),
                Dict("type" => "setup_status", "request_id" => "bad-env", "scope" => "story", "env" => Dict("PATH" => "/tmp")),
            )
            error_reply = JuliaTime.handle_message(bad_request)
            @test error_reply["type"] == "error"
        end
    end
end

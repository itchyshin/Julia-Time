using Test, JuliaTime

@testset "Mystery chapter dispatch" begin
    @testset "optional speed-lab requests use the fixed server protocol" begin
        info = JuliaTime.handle_message(Dict(
            "type" => "benchmark_info", "contract_version" => 1,
            "benchmark_id" => "bootstrap-v1", "request_id" => "routing-speed-info",
        ))
        @test info["type"] == "benchmark_info"
        @test info["request_id"] == "routing-speed-info"
        @test haskey(info, "availability")

        # An allowlist violation proves this message is dispatched to the
        # speed-lab handler without launching its fixed benchmark children.
        run = JuliaTime.handle_message(Dict(
            "type" => "benchmark_run", "contract_version" => 1,
            "benchmark_id" => "bootstrap-v1", "request_id" => "routing-speed-run",
            "workload" => 1000,
        ))
        @test run["type"] == "error"
        @test occursin("accept only", run["message"])
    end

    @test JuliaTime.handle_message(Dict("type" => "case_info"))["chapter"] == "C1"
    c2 = JuliaTime.handle_message(Dict("type" => "case_info", "chapter" => "C2"))
    @test get(c2, "chapter", nothing) == "C2"
    blank = JuliaTime.handle_message(Dict("type" => "case_run", "chapter" => "C2",
        "step" => "group", "request_id" => "c2-blank", "code" => ""))
    @test get(blank, "chapter", nothing) == "C2"
    @test get(blank, "request_id", nothing) == "c2-blank"
    @test !get(blank, "pass", true)
    @test !haskey(blank, "evidence")
    c3_default = JuliaTime.handle_message(Dict(
        "type" => "case_info", "case_id" => "missing-fleas-v1", "chapter" => "C3",
        "request_id" => "routing-c3-default",
    ))
    @test get(c3_default, "chapter", nothing) == "C3"
    @test get(c3_default, "move_id", nothing) == "join-report-log"
    @test get(c3_default, "request_id", nothing) == "routing-c3-default"
    for (chapter, move) in (("C4", "plan-distinct-recheck"), ("C5", "event-mask"), ("C6", "compatible-models"))
        info = JuliaTime.handle_message(Dict(
            "type" => "case_info", "contract_version" => 1,
            "case_id" => "missing-fleas-v1", "chapter" => chapter,
            "move_id" => move, "mode" => "challenge", "activity_id" => nothing,
            "simulation_id" => nothing, "request_id" => "routing-$(lowercase(chapter))",
        ))
        @test get(info, "chapter", nothing) == chapter
        @test get(info, "move_id", nothing) == move
    end
    c5_card = JuliaTime.handle_message(Dict(
        "type" => "case_action", "contract_version" => 1,
        "case_id" => "missing-fleas-v1", "chapter" => "C5",
        "move_id" => "card-draw-demo", "mode" => "demonstration",
        "activity_id" => "card-round", "simulation_id" => nothing,
        "request_id" => "routing-c5-card", "action" => "draw-six",
    ))
    @test get(c5_card, "type", nothing) == "case_action_result"
    @test get(c5_card, "progress_eligible", true) == false
    JuliaTime.warmup!()
    try
        c3_practice = JuliaTime.handle_message(Dict(
            "type" => "case_run", "contract_version" => 1,
            "case_id" => "missing-fleas-v1", "chapter" => "C3",
            "move_id" => "join-report-log", "mode" => "demonstration",
            "activity_id" => "practice-join-v1", "simulation_id" => nothing,
            "request_id" => "routing-c3-practice",
            "code" => "leftjoin(practice_report, practice_log, on=:key)",
        ))
        @test c3_practice["mode"] == "demonstration"
        @test c3_practice["pass"] === nothing
        @test c3_practice["practice_pass"] == true
        @test c3_practice["progress_eligible"] == false
        @test !haskey(c3_practice, "evidence")
    finally
        JuliaTime.shutdown!()
    end
    for kind in ("case_info", "case_run")
        unknown = JuliaTime.handle_message(Dict("type" => kind, "chapter" => "C99", "code" => ""))
        @test unknown["type"] == "error"
    end
end

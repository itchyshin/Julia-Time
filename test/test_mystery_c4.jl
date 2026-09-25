using Test
using DataFrames

const C4_SOURCE = joinpath(@__DIR__, "..", "src", "mystery_c4.jl")
isfile(C4_SOURCE) && !isdefined(JuliaTime, :mystery_c4_case_info) &&
    Base.include(JuliaTime, C4_SOURCE)

const C4_CASE_ID = "missing-fleas-v1"
const C4_CHAPTER = "C4"
const C4_MOVE = "plan-distinct-recheck"

if !isdefined(JuliaTime, :mystery_c4_case_info)
    @testset "Missing Fleas C4 module" begin
        @test isdefined(JuliaTime, :mystery_c4_case_info)
    end
else

function c4_info_request(; move_id=C4_MOVE, request_id="c4-info", mode="challenge",
                         activity_id=nothing, simulation_id=nothing)
    return Dict{String, Any}(
        "type" => "case_info", "case_id" => C4_CASE_ID, "chapter" => C4_CHAPTER,
        "move_id" => move_id, "mode" => mode, "activity_id" => activity_id,
        "simulation_id" => simulation_id, "request_id" => request_id,
    )
end

function c4_run_request(code; request_id="c4-run", move_id=C4_MOVE, case_id=C4_CASE_ID,
                        chapter=C4_CHAPTER, contract_version=1, mode="challenge",
                        activity_id=nothing, simulation_id=nothing)
    return Dict{String, Any}(
        "type" => "case_run", "contract_version" => contract_version, "case_id" => case_id,
        "chapter" => chapter, "move_id" => move_id, "mode" => mode,
        "activity_id" => activity_id, "simulation_id" => simulation_id,
        "request_id" => request_id, "code" => code,
    )
end

@testset "Missing Fleas C4 one-move recheck protocol" begin
    @testset "metadata supplies exactly the already eligible recheck list" begin
        @test JuliaTime.MYSTERY_C4_MOVES == (C4_MOVE,)
        eligible = JuliaTime.mystery_c4_expected_eligible()
        @test names(eligible) == ["jar_id"]
        @test nrow(eligible) >= JuliaTime.MYSTERY_C4_PLAN_SIZE
        @test all(id -> id in JuliaTime.mystery_jars().jar_id, eligible.jar_id)
        eligible.jar_id .= "mutated"
        @test all(id -> id in JuliaTime.mystery_jars().jar_id,
                  JuliaTime.mystery_c4_expected_eligible().jar_id)

        info = JuliaTime.mystery_c4_case_info(c4_info_request(request_id="c4-info-one"))
        @test info["type"] == "case"
        @test info["contract_version"] == 1
        @test info["case_id"] == C4_CASE_ID
        @test info["chapter"] == C4_CHAPTER
        @test info["move_id"] == C4_MOVE
        @test info["mode"] == "challenge"
        @test info["activity_id"] === nothing
        @test info["simulation_id"] === nothing
        @test [input["id"] for input in info["inputs"]] == ["eligible"]
        @test info["inputs"][1]["columns"] == ["jar_id"]
        @test [move["id"] for move in info["moves"]] == [C4_MOVE]
        @test occursin("sample(eligible.jar_id, 3; replace=false)",
                        info["moves"][1]["hints"][3]["text"])
        @test occursin("no new observations", lowercase(info["goal"]))
    end

    @testset "checker accepts any three distinct supplied IDs and rejects invented plans" begin
        ids = JuliaTime.mystery_c4_expected_eligible().jar_id
        @test JuliaTime.check_mystery_c4(ids[[end, 2, 1]], C4_MOVE)[1]
        @test JuliaTime.check_mystery_c4(ids[[1, 3, 4]], C4_MOVE)[1]
        @test !JuliaTime.check_mystery_c4([ids[1], ids[1], ids[2]], C4_MOVE)[1]
        @test !JuliaTime.check_mystery_c4([ids[1], ids[2], "J-not-a-case-id"], C4_MOVE)[1]
        @test !JuliaTime.check_mystery_c4(String[], C4_MOVE)[1]
        @test !JuliaTime.check_mystery_c4(ids[[1, 2, 3]], "select-eligible")[1]
    end

    @testset "learner-facing text describes the checked result, not a promised draw or expression" begin
        # UI-07: live runs are unseeded, so the scene must not promise a reproducible plan.
        scene = JuliaTime.mystery_c4_case_info()["scene"]["line"]
        @test !occursin(r"reproduc"i, scene)
        @test occursin("fair, random three-jar plan", scene)
        # Playtest B1: the checker accepts any three distinct eligible IDs, so the accepted
        # explanation must not claim the learner ran a particular expression.
        accepted = JuliaTime._mystery_c4_explanation(true)["julia"]
        @test !occursin("sample", accepted)
        @test !occursin("replace=false", accepted)
        @test occursin("returned three different IDs", accepted)
        @test occursin("eligible.jar_id", accepted)
        # Retest R3: the pass feedback is the first line under "Accepted". Code without
        # replace=false can still draw three different IDs, so the line must describe the
        # checked result and never claim the plan was drawn without replacement.
        ids = JuliaTime.mystery_c4_expected_eligible().jar_id
        passed, feedback = JuliaTime.check_mystery_c4(ids[[1, 2, 3]], C4_MOVE)
        @test passed
        @test !occursin("without replacement", feedback)
        @test !occursin("replace=false", feedback)
        @test feedback == "These are three different eligible jar IDs, so no jar is planned twice."
    end

    @testset "the learner-owned sampling result is checked against fresh server truth" begin
        JuliaTime.warmup!()
        try
            reply = JuliaTime.mystery_c4_case_run(c4_run_request(
                "sample(eligible.jar_id, 3; replace=false)"; request_id="c4-sample"))
            @test reply["type"] == "case_result"
            @test reply["move_id"] == C4_MOVE
            @test reply["status"] == "ok"
            @test reply["pass"] == true
            @test reply["progress_eligible"] == true
            @test reply["columns"] == ["jar_id"]
            @test length(reply["rows"]) == 3
            @test length(unique([row["jar_id"] for row in reply["rows"]])) == 3
            @test reply["result_visual"]["type"] == "planned-recheck-rack"
            @test occursin("no new observations", lowercase(reply["explanation"]["case"]))
            @test !haskey(reply, "evidence")

            mutated = JuliaTime.mystery_c4_case_run(c4_run_request(
                "answer = eligible.jar_id[[1, 2, 3]]; eligible = copy(eligible); answer";
                request_id="c4-rebind"))
            @test mutated["status"] == "error"
            @test mutated["pass"] == false
            @test mutated["progress_eligible"] == false

            altered = JuliaTime.mystery_c4_case_run(c4_run_request(
                "eligible.jar_id[1] = \"J-invented\"; eligible.jar_id[[2, 3, 4]]";
                request_id="c4-altered-input"))
            @test altered["status"] == "error"
            @test altered["pass"] == false
            @test altered["progress_eligible"] == false

            wrong = JuliaTime.mystery_c4_case_run(c4_run_request(
                "eligible.jar_id[[1, 1, 2]]"; request_id="c4-duplicate"))
            @test wrong["status"] == "ok"
            @test wrong["pass"] == false
            @test wrong["progress_eligible"] == false

            # Retest R7: a parse error is reported against the learner's own lines, as
            # Julia reports it for that code alone, with no guard-wrapper text or line shift.
            for (code, location) in [
                ("sample(eligible.jar_id <> 3)", "none:1:"),
                ("sample(eligible.jar_id, 3; replace=false))", "none:1:"),
                ("ids = eligible.jar_id\nsample(ids, 3, replace = false", "none:2:"),
                ("for id in eligible.jar_id\n  println(id)\n", "none:2:"),
            ]
                bad = JuliaTime.mystery_c4_case_run(c4_run_request(code; request_id="c4-parse"))
                @test bad["status"] == "error"
                @test bad["pass"] == false
                @test bad["progress_eligible"] == false
                @test occursin("ParseError", bad["message"])
                @test occursin(location, bad["message"])
                @test !occursin("__juliatime_", bad["message"])
                @test !occursin("objectid", bad["message"])
                @test bad["message"] == JuliaTime.run_code(code;
                    env=(eligible=JuliaTime.mystery_c4_expected_eligible(),)).message
                @test bad["feedback"] ==
                    "Julia did not complete this move. Keep the supplied eligible table unchanged, then try again."
            end
        finally
            JuliaTime.shutdown!()
        end
    end

    # Repair 4 (review of repair 3): the pre-parse runs in the server process with no time limit.
    # When the parser itself throws (Meta.parseall threw StackOverflowError on deeply nested input),
    # or the code is longer than 20000 characters, the helper returns nothing, so the guarded
    # worker run, which is time-limited, handles the code. A stub parser stands in for the throw.
    @testset "the pre-parse falls back to the guarded run when the parser throws or the code is long" begin
        broken = "sample(eligible.jar_id <> 3)"
        @test JuliaTime._mystery_c4_parse_error(broken) isa Meta.ParseError
        @test JuliaTime._mystery_c4_parse_error(broken; parser=(code; kwargs...) -> throw(StackOverflowError())) === nothing
        @test JuliaTime._mystery_c4_parse_error(broken; parser=(code; kwargs...) -> error("parser failed")) === nothing
        called = Ref(false)
        spy = (code; kwargs...) -> (called[] = true; Meta.parseall(code; kwargs...))
        @test JuliaTime._mystery_c4_parse_error(broken * " "^20_000; parser=spy) === nothing
        # Overnight 2026-09-24: 20000 characters of deep nesting still took about 20 s to parse in the
        # server; learner code is a few hundred characters, so the cap is 4000.
        @test JuliaTime._mystery_c4_parse_error(broken * " "^4_000; parser=spy) === nothing
        @test !called[]
        @test JuliaTime._mystery_c4_parse_error(broken * " "^100; parser=spy) isa Meta.ParseError
        @test called[]
        # Deep nesting can make Julia fall back to its older parser, which reports a plain String
        # (measured on Julia 1.10.0: "\">\" is not a unary operator"); it still reaches the page as a ParseError.
        flisp = (code; kwargs...) -> Expr(:toplevel, Expr(:error, "\">\" is not a unary operator"))
        problem = JuliaTime._mystery_c4_parse_error(broken; parser=flisp)
        @test problem isa Meta.ParseError
        @test problem.msg == "\">\" is not a unary operator"
    end

    @testset "malformed envelopes cannot substitute a second C4 move" begin
        for request in [
            c4_info_request(move_id="select-eligible", request_id="c4-old-info"),
            c4_info_request(mode="demonstration", request_id="c4-demo-info"),
            c4_run_request("42"; move_id="select-eligible", request_id="c4-old-run"),
            c4_run_request("42"; case_id="other", request_id="c4-bad-case"),
            c4_run_request("42"; activity_id="practice", request_id="c4-bad-activity"),
        ]
            reply = request["type"] == "case_info" ?
                JuliaTime.mystery_c4_case_info(request) : JuliaTime.mystery_c4_case_run(request)
            @test reply["type"] == "error"
            @test !haskey(reply, "evidence")
        end
    end
end

end

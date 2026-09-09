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
        finally
            JuliaTime.shutdown!()
        end
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

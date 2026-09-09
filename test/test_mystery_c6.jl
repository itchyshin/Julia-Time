using Test
using DataFrames
using Distributions

# C6 is deliberately loadable directly while its parent integration is owned by another lane.
const C6_SOURCE = joinpath(@__DIR__, "..", "src", "mystery_c6.jl")
isfile(C6_SOURCE) && !isdefined(JuliaTime, :mystery_c6_case_info) &&
    Base.include(JuliaTime, C6_SOURCE)

const C6_CASE_ID = "missing-fleas-v1"
const C6_CHAPTER = "C6"

if !isdefined(JuliaTime, :mystery_c6_case_info)
    @testset "Missing Fleas C6 module" begin
        @test isdefined(JuliaTime, :mystery_c6_case_info)
    end
else

function c6_info_request(; move_id="compatible-models", request_id="c6-info",
                         case_id=C6_CASE_ID, chapter=C6_CHAPTER, mode="challenge",
                         activity_id=nothing, simulation_id=nothing, contract_version=1)
    Dict{String, Any}(
        "type" => "case_info", "contract_version" => contract_version,
        "case_id" => case_id, "chapter" => chapter, "move_id" => move_id,
        "mode" => mode, "activity_id" => activity_id, "simulation_id" => simulation_id,
        "request_id" => request_id,
    )
end

function c6_run_request(code; request_id="c6-run", case_id=C6_CASE_ID, chapter=C6_CHAPTER,
                        move_id="compatible-models", mode="challenge", activity_id=nothing,
                        simulation_id=nothing, contract_version=1)
    Dict{String, Any}(
        "type" => "case_run", "contract_version" => contract_version,
        "case_id" => case_id, "chapter" => chapter, "move_id" => move_id,
        "mode" => mode, "activity_id" => activity_id, "simulation_id" => simulation_id,
        "request_id" => request_id, "code" => code,
    )
end

@testset "Missing Fleas C6 predictive compatibility protocol" begin
    @testset "fresh server-derived candidate bounds" begin
        candidates = JuliaTime.mystery_c6_candidates()
        @test names(candidates) == ["model", "p", "lower", "upper"]
        @test candidates.p == [0.1, 0.5, 0.8]
        @test all(row -> row.lower == quantile(Binomial(6, row.p), 0.1) &&
                         row.upper == quantile(Binomial(6, row.p), 0.9), eachrow(candidates))
        candidates[1, "lower"] = -1
        @test JuliaTime.mystery_c6_candidates()[1, "lower"] == quantile(Binomial(6, 0.1), 0.1)
        @test JuliaTime.mystery_c6_observed_count() ==
              sum(filter(:batch_id => ==(JuliaTime.MYSTERY_CASE_BATCH), JuliaTime.mystery_jars()).detected)

        info = JuliaTime.mystery_c6_case_info(c6_info_request(request_id="c6-info-one"))
        @test info["type"] == "case"
        @test info["contract_version"] == 1
        @test info["case_id"] == C6_CASE_ID
        @test info["chapter"] == C6_CHAPTER
        @test info["move_id"] == "compatible-models"
        @test info["mode"] == "challenge"
        @test info["activity_id"] === nothing
        @test info["simulation_id"] === nothing
        @test info["request_id"] == "c6-info-one"
        @test info["n_trials"] == 6
        @test info["observed_count"] == JuliaTime.mystery_c6_observed_count()
        @test info["inputs"][1]["id"] == "candidate_models"
        @test info["inputs"][1]["columns"] == ["model", "p", "lower", "upper"]
        @test occursin("lower ≤ observed_count ≤ upper", info["rule"])
        @test occursin("nominal central predictive range", lowercase(info["key_note"]))
    end

    @testset "checker truth is independent from the presentation factory" begin
        expected = JuliaTime.mystery_c6_expected_compatible()
        try
            @eval JuliaTime function mystery_c6_candidates()
                DataFrame(model=["Changed presentation"], p=[0.25], lower=[0], upper=[6])
            end
            @test JuliaTime.mystery_c6_expected_compatible() == expected
        finally
            @eval JuliaTime function mystery_c6_candidates()
                probabilities = collect(MYSTERY_C6_PROBABILITIES)
                ranges = [Distributions.Binomial(MYSTERY_C6_N_TRIALS, p) for p in probabilities]
                return DataFrame(
                    model=["Candidate p = $(p)" for p in probabilities],
                    p=probabilities,
                    lower=[Distributions.quantile(range, 0.1) for range in ranges],
                    upper=[Distributions.quantile(range, 0.9) for range in ranges],
                )
            end
        end
    end

    @testset "fresh checker accepts only every compatible row, order independently" begin
        expected = JuliaTime.mystery_c6_expected_compatible()
        @test JuliaTime.check_mystery_c6(expected)[1]
        @test JuliaTime.check_mystery_c6(expected[reverse(1:nrow(expected)), reverse(names(expected))])[1]
        @test !JuliaTime.check_mystery_c6(expected[:, ["model", "p", "lower"]])[1]
        wrong_bound = copy(expected); wrong_bound[1, "upper"] += 1
        @test !JuliaTime.check_mystery_c6(wrong_bound)[1]
        wrong_value = copy(expected); wrong_value[1, "p"] = 0.2
        @test !JuliaTime.check_mystery_c6(wrong_value)[1]
        duplicated = vcat(expected, expected[1:1, :])
        @test !JuliaTime.check_mystery_c6(duplicated)[1]
        @test !JuliaTime.check_mystery_c6(expected[1:max(0, nrow(expected)-1), :])[1]
        invented = vcat(expected, DataFrame(model=["Invented"], p=[0.3], lower=[0], upper=[4]))
        @test !JuliaTime.check_mystery_c6(invented)[1]
        @test !JuliaTime.check_mystery_c6("compatible")[1]
    end

    @testset "challenge returns actual accepted evidence and protects all supplied inputs" begin
        JuliaTime.warmup!()
        try
            code = "candidate_models[(candidate_models.lower .<= observed_count) .& (observed_count .<= candidate_models.upper), :]"
            reply = JuliaTime.mystery_c6_case_run(c6_run_request(code; request_id="c6-good"))
            @test reply["status"] == "ok"
            @test reply["pass"] == true
            @test reply["progress_eligible"] == true
            @test reply["result_data"]["kind"] == "table"
            @test reply["result_data"]["rows"] == reply["rows"]
            @test reply["result_visual"]["data"]["rows"] == reply["rows"]
            @test occursin("compatible", lowercase(reply["explanation"]["case"]))
            @test occursin("does not rank", lowercase(reply["explanation"]["limit"]))

            for (label, bad_code) in [
                ("mutation", "answer = candidate_models[(candidate_models.lower .<= observed_count) .& (observed_count .<= candidate_models.upper), :]; candidate_models[1, :upper] = 0; answer"),
                ("rebind-table", "candidate_models = copy(candidate_models); candidate_models[(candidate_models.lower .<= observed_count) .& (observed_count .<= candidate_models.upper), :]"),
                ("rebind-observed", "answer = candidate_models[(candidate_models.lower .<= observed_count) .& (observed_count .<= candidate_models.upper), :]; observed_count = observed_count + 1; answer"),
                ("rebind-trials", "answer = candidate_models[(candidate_models.lower .<= observed_count) .& (observed_count .<= candidate_models.upper), :]; n_trials = 7; answer"),
                ("wrong-answer", "candidate_models"),
            ]
                bad_reply = JuliaTime.mystery_c6_case_run(c6_run_request(bad_code; request_id="c6-" * label))
                @test bad_reply["pass"] == false
                @test bad_reply["progress_eligible"] == false
            end

            for code_value in ("", "   ", 4, nothing)
                bad_reply = JuliaTime.mystery_c6_case_run(c6_run_request(code_value; request_id="c6-code-$(repr(code_value))"))
                @test bad_reply["type"] == "case_result"
                @test bad_reply["pass"] == false
            end
        finally
            JuliaTime.shutdown!()
        end
    end

    @testset "identity fences reject malformed metadata and requests" begin
        for request in [
            c6_info_request(case_id="other"), c6_info_request(chapter="C5"),
            c6_info_request(move_id="unknown"), c6_info_request(mode="demonstration"),
            c6_info_request(activity_id="extension"), c6_info_request(simulation_id="changed"),
            c6_info_request(contract_version=true), c6_info_request(request_id=" "),
        ]
            reply = JuliaTime.mystery_c6_case_info(request)
            @test reply["type"] == "error"
            @test !haskey(reply, "inputs")
        end
        for request in [
            c6_run_request("candidate_models"; case_id="other"),
            c6_run_request("candidate_models"; chapter="C5"),
            c6_run_request("candidate_models"; move_id="unknown"),
            c6_run_request("candidate_models"; mode="demonstration"),
            c6_run_request("candidate_models"; activity_id="extension"),
            c6_run_request("candidate_models"; simulation_id="changed"),
            c6_run_request("candidate_models"; contract_version=2),
            c6_run_request("candidate_models"; request_id=" "),
        ]
            reply = JuliaTime.mystery_c6_case_run(request)
            @test reply["type"] == "error"
            @test !haskey(reply, "evidence")
        end
    end

    @testset "case-run envelope requires its type before execution or progress" begin
        missing_type = c6_run_request("candidate_models"; request_id="c6-missing-type")
        delete!(missing_type, "type")
        wrong_type = c6_run_request("candidate_models"; request_id="c6-wrong-type")
        wrong_type["type"] = "case_info"

        for request in (missing_type, wrong_type)
            reply = JuliaTime.mystery_c6_case_run(request)
            @test reply["type"] == "error"
            @test !haskey(reply, "progress_eligible")
        end
    end
end

end # C6 module present

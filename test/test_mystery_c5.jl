using Test
using DataFrames

# C5 remains directly loadable until the integration owner adds it to JuliaTime.jl.
const C5_SOURCE = joinpath(@__DIR__, "..", "src", "mystery_c5.jl")
isfile(C5_SOURCE) && !isdefined(JuliaTime, :mystery_c5_case_info) &&
    Base.include(JuliaTime, C5_SOURCE)

const C5_CASE_ID = "missing-fleas-v1"
const C5_CHAPTER = "C5"

if !isdefined(JuliaTime, :mystery_c5_case_info)
    @testset "Missing Fleas C5 module" begin
        @test isdefined(JuliaTime, :mystery_c5_case_info)
    end
else

function c5_info_request(; move_id="event-mask", request_id="c5-info", case_id=C5_CASE_ID,
                         chapter=C5_CHAPTER, mode="challenge", activity_id=nothing,
                         simulation_id=nothing)
    return Dict{String, Any}(
        "type" => "case_info", "contract_version" => 1, "case_id" => case_id,
        "chapter" => chapter, "move_id" => move_id, "mode" => mode,
        "activity_id" => activity_id, "simulation_id" => simulation_id,
        "request_id" => request_id,
    )
end

function c5_run_request(move_id, code, simulation_id; request_id="c5-run", case_id=C5_CASE_ID,
                        chapter=C5_CHAPTER, mode="challenge", activity_id=nothing,
                        contract_version=1)
    return Dict{String, Any}(
        "type" => "case_run", "contract_version" => contract_version,
        "case_id" => case_id, "chapter" => chapter, "move_id" => move_id,
        "mode" => mode, "activity_id" => activity_id, "simulation_id" => simulation_id,
        "request_id" => request_id, "code" => code,
    )
end

function c5_action_request(action; request_id="c5-action", case_id=C5_CASE_ID,
                           chapter=C5_CHAPTER, move_id="card-draw-demo",
                           mode="demonstration", activity_id="card-round",
                           simulation_id=nothing)
    return Dict{String, Any}(
        "type" => "case_action", "contract_version" => 1, "case_id" => case_id,
        "chapter" => chapter, "move_id" => move_id, "mode" => mode,
        "activity_id" => activity_id, "simulation_id" => simulation_id,
        "action" => action, "request_id" => request_id,
    )
end

@testset "Missing Fleas C5 simulation protocol" begin
    @testset "fixed, fresh simulation metadata" begin
        counts = JuliaTime.mystery_c5_sim_counts()
        @test length(counts) == 1000
        @test all(count -> count isa Int && 0 <= count <= 6, counts)
        @test counts == JuliaTime.mystery_c5_sim_counts()
        counts[1] = -1
        @test 0 <= JuliaTime.mystery_c5_sim_counts()[1] <= 6
        @test JuliaTime.mystery_c5_observed_count() ==
              sum(filter(:batch_id => ==(JuliaTime.MYSTERY_CASE_BATCH), JuliaTime.mystery_jars()).detected)

        info = JuliaTime.mystery_c5_case_info(c5_info_request(request_id="c5-info-one"))
        @test info["type"] == "case"
        @test info["contract_version"] == 1
        @test info["case_id"] == C5_CASE_ID
        @test info["chapter"] == C5_CHAPTER
        @test info["move_id"] == "event-mask"
        @test info["mode"] == "challenge"
        @test info["activity_id"] === nothing
        @test info["request_id"] == "c5-info-one"
        @test info["simulation_id"] isa String && !isempty(info["simulation_id"])
        @test [input["id"] for input in info["inputs"]] == ["sim_counts"]
        @test info["inputs"][1]["values"] == JuliaTime.mystery_c5_sim_counts()
        @test info["n_jars"] == 6
        @test info["p_ref"] == 0.5
        @test info["observed_count"] == JuliaTime.mystery_c5_observed_count()
        @test info["n_trials"] == 1000
        @test !occursin("events", join(string.(keys(info["inputs"][1])), " "))
        @test occursin("events = sim_counts .>= observed_count", info["moves"][1]["code_shape"])
        @test occursin("(events=events, frequency=sum(events)/length(events))", info["moves"][2]["required_result"])
        @test haskey(info, "actions")
    end

    @testset "fresh checker requires exact event values and matching frequency" begin
        info = JuliaTime.mystery_c5_case_info(c5_info_request(request_id="c5-info-run"))
        simulation_id = info["simulation_id"]
        counts = JuliaTime.mystery_c5_sim_counts()
        observed = JuliaTime.mystery_c5_observed_count()
        events = counts .>= observed
        @test JuliaTime.check_mystery_c5(events, "event-mask")[1]
        @test JuliaTime.check_mystery_c5((events=events, frequency=sum(events) / length(events)),
                                         "event-frequency")[1]
        @test !JuliaTime.check_mystery_c5(counts .> observed, "event-mask")[1]
        @test !JuliaTime.check_mystery_c5(events[1:end-1], "event-mask")[1]
        @test !JuliaTime.check_mystery_c5((events=events, frequency=sum(events) / 999),
                                          "event-frequency")[1]
        @test !JuliaTime.check_mystery_c5((events=events, frequency=NaN), "event-frequency")[1]
        @test !JuliaTime.check_mystery_c5((frequency=sum(events) / length(events), events=events),
                                          "event-frequency")[1]

        JuliaTime.warmup!()
        try
            mask_reply = JuliaTime.mystery_c5_case_run(c5_run_request(
                "event-mask", "sim_counts .>= observed_count", simulation_id; request_id="c5-mask"))
            @test mask_reply["status"] == "ok"
            @test mask_reply["pass"] == true
            @test mask_reply["progress_eligible"] == true
            @test mask_reply["simulation_id"] == simulation_id
            @test mask_reply["result_data"]["kind"] == "boolean-vector"
            @test mask_reply["result_data"]["length"] == 1000
            @test mask_reply["result_data"]["true_count"] == sum(events)

            frequency_reply = JuliaTime.mystery_c5_case_run(c5_run_request(
                "event-frequency", "events = sim_counts .>= observed_count; (events=events, frequency=sum(events)/length(events))",
                simulation_id; request_id="c5-frequency"))
            @test frequency_reply["status"] == "ok"
            @test frequency_reply["pass"] == true
            @test frequency_reply["progress_eligible"] == true
            @test frequency_reply["result_data"]["frequency"] == sum(events) / 1000
            @test frequency_reply["result_data"]["trials"] == 1000

            for (label, move_id, code) in [
                ("mutation", "event-mask", "answer = sim_counts .>= observed_count; sim_counts[1] = 0; answer"),
                ("rebinding", "event-mask", "sim_counts = copy(sim_counts); sim_counts .>= observed_count"),
                ("wrong-event", "event-mask", "sim_counts .> observed_count"),
                ("wrong-frequency", "event-frequency", "events = sim_counts .>= observed_count; (events=events, frequency=sum(events)/999)"),
                ("wrong-shape", "event-frequency", "events = sim_counts .>= observed_count; sum(events)/length(events)"),
            ]
                reply = JuliaTime.mystery_c5_case_run(c5_run_request(move_id, code, simulation_id;
                    request_id="c5-" * label))
                @test reply["pass"] == false
                @test reply["progress_eligible"] == false
                @test !haskey(reply, "evidence")
            end

            # Every challenge input is protected, even when the answer was already computed.
            # Each attempt would return the right Boolean vector without the input-integrity guard.
            for (label, code) in [
                ("n-jars-rebinding", "answer = sim_counts .>= observed_count; n_jars = n_jars + 1; answer"),
                ("p-ref-rebinding", "answer = sim_counts .>= observed_count; p_ref = 0.25; answer"),
                ("observed-count-rebinding", "answer = sim_counts .>= observed_count; observed_count = observed_count + 1; answer"),
                ("n-trials-rebinding", "answer = sim_counts .>= observed_count; n_trials = n_trials - 1; answer"),
            ]
                reply = JuliaTime.mystery_c5_case_run(c5_run_request("event-mask", code, simulation_id;
                    request_id="c5-" * label))
                @test reply["status"] == "error"
                @test reply["pass"] == false
                @test reply["progress_eligible"] == false
                @test !haskey(reply, "evidence")
            end
        finally
            JuliaTime.shutdown!()
        end
    end

    @testset "identity fencing and fixed non-credit actions" begin
        info = JuliaTime.mystery_c5_case_info(c5_info_request(request_id="c5-info-identities"))
        simulation_id = info["simulation_id"]
        for request in [
            c5_info_request(case_id="other", request_id="c5-info-case"),
            c5_info_request(chapter="C4", request_id="c5-info-chapter"),
            c5_info_request(move_id="unknown", request_id="c5-info-move"),
            c5_info_request(mode="demonstration", request_id="c5-info-mode"),
            c5_info_request(activity_id="card-round", request_id="c5-info-activity"),
            c5_info_request(simulation_id="altered", request_id="c5-info-simulation"),
            merge(c5_info_request(request_id="c5-info-version"), Dict("contract_version" => true)),
            c5_info_request(request_id=" "),
        ]
            reply = JuliaTime.mystery_c5_case_info(request)
            @test reply["type"] == "error"
            @test !haskey(reply, "inputs")
        end
        for request in [
            c5_run_request("event-mask", "true", "altered"; request_id="c5-run-sim"),
            c5_run_request("event-mask", "true", simulation_id; case_id="other", request_id="c5-run-case"),
            c5_run_request("event-mask", "true", simulation_id; chapter="C4", request_id="c5-run-chapter"),
            c5_run_request("unknown", "true", simulation_id; request_id="c5-run-move"),
            c5_run_request("event-mask", "true", simulation_id; mode="demonstration", request_id="c5-run-mode"),
            c5_run_request("event-mask", "true", simulation_id; activity_id="card-round", request_id="c5-run-activity"),
            c5_run_request("event-mask", "true", simulation_id; contract_version=2, request_id="c5-run-version"),
        ]
            reply = JuliaTime.mystery_c5_case_run(request)
            @test reply["type"] == "error"
            @test !haskey(reply, "evidence")
        end

        draw = JuliaTime.mystery_c5_case_action(c5_action_request("draw-six"; request_id="c5-draw"))
        @test draw["type"] == "case_action_result"
        @test draw["status"] == "ok"
        @test draw["progress_eligible"] == false
        @test draw["case_id"] == C5_CASE_ID
        @test draw["chapter"] == C5_CHAPTER
        @test draw["mode"] == "demonstration"
        @test draw["activity_id"] == "card-round"
        @test length(draw["result_data"]["draws"]) == 6
        @test draw["generated_code"] isa String
        shown_draw_bools = Core.eval(JuliaTime, Meta.parse("let\n" * draw["generated_code"] * "\nend"))
        shown_draws = [is_teal ? "teal" : "orange" for is_teal in shown_draw_bools]
        @test draw["result_data"]["draws"] == shown_draws
        replay = JuliaTime.mystery_c5_case_action(c5_action_request("replay-1000"; request_id="c5-replay"))
        @test replay["status"] == "ok"
        @test replay["progress_eligible"] == false
        @test length(replay["result_data"]["counts"]) == 1000
        for request in [
            c5_action_request("run-arbitrary"; request_id="c5-action-name"),
            c5_action_request("draw-six"; case_id="other", request_id="c5-action-case"),
            c5_action_request("draw-six"; mode="challenge", request_id="c5-action-mode"),
            c5_action_request("draw-six"; simulation_id="altered", request_id="c5-action-simulation"),
            merge(c5_action_request("draw-six"; request_id="c5-action-version"), Dict("contract_version" => true)),
        ]
            reply = JuliaTime.mystery_c5_case_action(request)
            @test reply["type"] == "error"
            @test !haskey(reply, "evidence")
        end
    end
end

end # C5 module present

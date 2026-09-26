using Test
using DataFrames

@testset "Missing Fleas epilogue facts come from the fixture" begin
    facts = JuliaTime.mystery_epilogue_facts()
    b09 = filter(:batch_id => ==(JuliaTime.MYSTERY_CASE_BATCH), JuliaTime.mystery_jars())
    @test facts["batch_id"] == JuliaTime.MYSTERY_CASE_BATCH
    @test facts["n_jars"] == nrow(b09)
    @test facts["n_detected"] == sum(b09.detected)

    tray_counts = JuliaTime.mystery_c3_tray_counts()
    @test [t["tray_id"] for t in facts["trays"]] == tray_counts.tray_id
    @test [t["detected_n"] for t in facts["trays"]] == tray_counts.notebook_detected
    @test sum(t["detected_n"] for t in facts["trays"]) == facts["n_detected"]

    gap = JuliaTime.mystery_c3_expected_discrepancy()
    @test nrow(gap) == 1
    d = facts["disagreement"]
    @test d["tray_id"] == gap.tray_id[1]
    @test d["notebook_detected"] == gap.notebook_detected[1]
    @test d["sheet_detected"] == gap.sheet_detected[1]
    @test d["entry_status"] == gap.entry_status[1]
    # The ending's headline ("the fleas were never shown to be missing") rests on these facts.
    # If a fixture change breaks them, rewrite docs/design/03-ending.md and ending-script.js first.
    @test d["sheet_detected"] == 0
    @test d["entry_status"] == "left blank"
    @test d["notebook_detected"] > 0
    # The reveal says the only zero is tray T-C's tally-sheet box: exactly one blank-box zero, on
    # that tray, and no zero in the notebook's tray counts (review 2026-09-26).
    tally_sheet = JuliaTime.mystery_c3_tally_sheet()
    @test count(isequal(0), tally_sheet.sheet_detected) == 1
    @test tally_sheet.tray_id[findfirst(isequal(0), tally_sheet.sheet_detected)] == d["tray_id"]
    @test all(>(0), tray_counts.notebook_detected)

    @test facts["eligible_jars"] == JuliaTime.mystery_c4_expected_eligible().jar_id
    @test facts["recheck_size"] == JuliaTime.MYSTERY_C4_PLAN_SIZE

    events = JuliaTime.mystery_c5_expected_events()
    @test facts["observed_count"] == JuliaTime.mystery_c5_observed_count() == JuliaTime.mystery_c6_observed_count()
    @test facts["n_per_simulation"] == JuliaTime.MYSTERY_C5_N_JARS
    @test facts["n_simulations"] == length(events) == JuliaTime.MYSTERY_C5_N_TRIALS
    @test facts["matching_events"] == count(events)

    candidates = JuliaTime.mystery_c6_candidates()
    compatible = JuliaTime.mystery_c6_expected_compatible().model
    @test [m["model"] for m in facts["models"]] == candidates.model
    @test candidates.model == ["Vanishing", "Coin flip", "Thriving"]
    @test [m["p"] for m in facts["models"]] == candidates.p
    @test [m["lower"] for m in facts["models"]] == candidates.lower
    @test [m["upper"] for m in facts["models"]] == candidates.upper
    @test [m["compatible"] for m in facts["models"]] == [model in compatible for model in candidates.model]
end

@testset "Case Board's hard-coded numbers match the fixture (review 2026-09-26, item 9)" begin
    # course-client.js:180-197 types "5 of the 6", "T-A 2, T-B 2, T-C 1" and "1 time in 9" by hand.
    # This test pins those strings to mystery_epilogue_facts() so a fixture change cannot drift
    # silently from what the Case Board tells the player.
    facts = JuliaTime.mystery_epilogue_facts()
    js = read(joinpath(@__DIR__, "..", "web", "course", "course-client.js"), String)

    @test occursin("$(facts["n_detected"]) of the $(facts["n_jars"])", js)

    tray_line = join(("$(t["tray_id"]) $(t["detected_n"])" for t in facts["trays"]), ", ")
    @test occursin(tray_line, js)

    times = round(Int, facts["n_simulations"] / facts["matching_events"])
    @test occursin("1 time in $(times)", js)
end

@testset "case_epilogue request and reply" begin
    base = Dict{String, Any}("type" => "case_epilogue", "contract_version" => 1,
                             "case_id" => "missing-fleas-v1", "request_id" => "ending-1")
    ok = JuliaTime.handle_message(copy(base))
    @test ok["type"] == "case_epilogue"
    @test ok["contract_version"] == 1
    @test ok["case_id"] == "missing-fleas-v1"
    @test ok["request_id"] == "ending-1"
    @test ok["data_label"] == JuliaTime.MYSTERY_DATA_LABEL
    @test ok["facts"] == JuliaTime.mystery_epilogue_facts()
    for (key, value) in (("contract_version", 2), ("contract_version", true), ("case_id", "other"),
                         ("request_id", ""), ("request_id", "   "), ("request_id", 7))
        @test JuliaTime.handle_message(merge(base, Dict{String, Any}(key => value)))["type"] == "error"
    end
    missing_id = copy(base); delete!(missing_id, "request_id")
    @test JuliaTime.handle_message(missing_id)["type"] == "error"
    # The reply crosses the socket as JSON.
    decoded = JuliaTime.JSON.parse(JuliaTime.encode(ok))
    @test decoded["facts"]["disagreement"]["entry_status"] == "left blank"
    @test decoded["facts"]["models"][1]["compatible"] isa Bool
end

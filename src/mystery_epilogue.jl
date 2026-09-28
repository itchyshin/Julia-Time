# Missing Fleas epilogue: the facts the "Case closed" movie shows (docs/design/03-ending.md).
# Every value is rebuilt from the same fixture and checker functions the chapters use, so the
# ending cannot drift from the case.  Nothing here is typed in by hand.

const MYSTERY_EPILOGUE_TYPE = "case_epilogue"

"""
    mystery_epilogue_facts() -> Dict{String, Any}

Return the case facts for the ending: the B09 jars, detections by tray, the one recording
disagreement, the recheck pool, the Chapter 5 simulation tally and the Chapter 6 range check.
"""
function mystery_epilogue_facts()
    b09 = filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars())
    tray_counts = mystery_c3_tray_counts()
    gap = mystery_c3_expected_discrepancy()
    DataFrames.nrow(gap) == 1 || error("The ending expects exactly one disagreeing tray.")
    events = mystery_c5_expected_events()
    candidates = mystery_c6_candidates()
    compatible = Set(mystery_c6_expected_compatible().story)
    return Dict{String, Any}(
        "batch_id" => MYSTERY_CASE_BATCH,
        "n_jars" => DataFrames.nrow(b09),
        "n_detected" => sum(b09.detected),
        "trays" => [Dict{String, Any}("tray_id" => String(row.tray_id),
                                      "detected_n" => Int(row.notebook_detected))
                    for row in eachrow(tray_counts)],
        "disagreement" => Dict{String, Any}(
            "tray_id" => String(gap.tray_id[1]),
            "notebook_detected" => Int(gap.notebook_detected[1]),
            "sheet_detected" => Int(gap.sheet_detected[1]),
            "entry_status" => String(gap.entry_status[1]),
        ),
        "eligible_jars" => String.(mystery_c4_expected_eligible().jar_id),
        "recheck_size" => MYSTERY_C4_PLAN_SIZE,
        "observed_count" => mystery_c5_observed_count(),
        "n_per_simulation" => MYSTERY_C5_N_JARS,
        "n_simulations" => length(events),
        "matching_events" => count(events),
        "models" => [Dict{String, Any}("model" => String(row.story), "p" => Float64(row.p),
                                       "lower" => Int(row.lower), "upper" => Int(row.upper),
                                       "compatible" => row.story in compatible)
                     for row in eachrow(candidates)],
    )
end

_mystery_epilogue_error(message::String) = Dict{String, Any}("type" => "error", "message" => message)

"""
    mystery_epilogue_info(msg) -> Dict{String, Any}

Answer a `case_epilogue` request with the facts, or an error for a wrong version, case or request id.
"""
function mystery_epilogue_info(msg::AbstractDict)
    version = get(msg, "contract_version", nothing)
    version isa Integer && !(version isa Bool) && version == 1 ||
        return _mystery_epilogue_error("case_epilogue requires contract_version 1.")
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID ||
        return _mystery_epilogue_error("case_epilogue requires case_id missing-fleas-v1.")
    request_id = get(msg, "request_id", nothing)
    request_id isa AbstractString && !isempty(strip(request_id)) ||
        return _mystery_epilogue_error("case_epilogue requires a non-empty string request_id.")
    return Dict{String, Any}(
        "type" => MYSTERY_EPILOGUE_TYPE, "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "request_id" => String(request_id), "data_label" => MYSTERY_DATA_LABEL,
        "facts" => mystery_epilogue_facts(),
    )
end

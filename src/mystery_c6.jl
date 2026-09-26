# Missing Fleas, chapter 6: compare three simple stories about how often a jar shows fleas.
# Fitting means only that the fixed observation lies inside a story's usual range (a discrete
# 0.1/0.9 Binomial range). It is deliberately a table-filtering rule, not a verdict about which
# story generated the observation.

const MYSTERY_C6_CHAPTER = "C6"
const MYSTERY_C6_MOVE = "compatible-models"
const MYSTERY_C6_COLUMNS = ["model", "p", "lower", "upper"]
const MYSTERY_C6_N_TRIALS = 6
const MYSTERY_C6_PROBABILITIES = (0.1, 0.5, 0.8)
const MYSTERY_C6_MODEL_NAMES = ("Vanishing", "Coin flip", "Thriving")

"""Return fresh story rows with server-derived discrete 0.1/0.9 Binomial bounds."""
function mystery_c6_candidates()
    probabilities = collect(MYSTERY_C6_PROBABILITIES)
    ranges = [Distributions.Binomial(MYSTERY_C6_N_TRIALS, p) for p in probabilities]
    return DataFrame(
        model=collect(MYSTERY_C6_MODEL_NAMES),
        p=probabilities,
        lower=[Distributions.quantile(range, 0.1) for range in ranges],
        upper=[Distributions.quantile(range, 0.9) for range in ranges],
    )
end

"""Build the checker-only story rows without calling the presentation factory."""
function _mystery_c6_checker_candidates()
    probabilities = MYSTERY_C6_PROBABILITIES
    ranges = [Distributions.Binomial(MYSTERY_C6_N_TRIALS, p) for p in probabilities]
    return DataFrame(
        model=collect(MYSTERY_C6_MODEL_NAMES),
        p=Float64[p for p in probabilities],
        lower=[Distributions.quantile(range, 0.1) for range in ranges],
        upper=[Distributions.quantile(range, 0.9) for range in ranges],
    )
end

"""Return the B09 detection count from a fresh immutable teaching fixture."""
function mystery_c6_observed_count()
    b09 = filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars())
    return sum(b09.detected)
end

"""Build checker truth independently of the learner-visible story table."""
function mystery_c6_expected_compatible()
    candidates = _mystery_c6_checker_candidates()
    observed_count = mystery_c6_observed_count()
    return candidates[(candidates.lower .<= observed_count) .&
                      (observed_count .<= candidates.upper), :]
end

function _mystery_c6_rows(df::DataFrames.DataFrame)
    columns = _mystery_columns(df)
    return [Dict{String, Any}(column => _mystery_wire_value(df[row, column])
                              for column in columns)
            for row in 1:DataFrames.nrow(df)]
end

function _mystery_c6_exact_columns(value)
    value isa DataFrames.DataFrame || return false
    columns = _mystery_columns(value)
    return length(columns) == length(MYSTERY_C6_COLUMNS) &&
           all(column -> column in columns, MYSTERY_C6_COLUMNS)
end

function _mystery_c6_row_matches(actual::DataFrames.DataFrame, actual_row::Int,
                                  expected::DataFrames.DataFrame, expected_row::Int)
    actual[actual_row, "model"] isa AbstractString || return false
    actual[actual_row, "p"] isa Float64 || return false
    actual[actual_row, "lower"] isa Int || return false
    actual[actual_row, "upper"] isa Int || return false
    return String(actual[actual_row, "model"]) == expected[expected_row, "model"] &&
           actual[actual_row, "p"] == expected[expected_row, "p"] &&
           actual[actual_row, "lower"] == expected[expected_row, "lower"] &&
           actual[actual_row, "upper"] == expected[expected_row, "upper"]
end

"""
    check_mystery_c6(value) -> (pass, feedback)

Accept precisely the independently recomputed story rows that fit, once each. Both row and
column order are irrelevant; changed, duplicate, omitted, or invented values are rejected.
"""
function check_mystery_c6(value)
    _mystery_c6_exact_columns(value) ||
        return (false, "Return a DataFrame with exactly these columns: $(join(MYSTERY_C6_COLUMNS, ", ")).")
    expected = mystery_c6_expected_compatible()
    DataFrames.nrow(value) == DataFrames.nrow(expected) ||
        return (false, "Return every story whose usual range includes 5, once each.")
    matched = falses(DataFrames.nrow(expected))
    for actual_row in 1:DataFrames.nrow(value)
        expected_row = findfirst(1:DataFrames.nrow(expected)) do candidate
            !matched[candidate] && _mystery_c6_row_matches(value, actual_row, expected, candidate)
        end
        expected_row === nothing &&
            return (false, "Keep the story label, p, lower bound, and upper bound unchanged; do not add or duplicate a row.")
        matched[expected_row] = true
    end
    all(matched) || return (false, "At least one story that fits is missing.")
    return (true, "These are exactly the stories whose usual range includes the notebook's count.")
end

function _mystery_c6_moves()
    return [Dict{String, Any}(
        "id" => MYSTERY_C6_MOVE,
        "title" => "Keep the stories whose range includes 5",
        "required_result" => "Every story row, once each, for which lower ≤ observed_count ≤ upper.",
        "concept" => "A story fits when 5 is between its low end and its high end, both ends included. Check each end separately, then keep the rows that pass both.",
        "code_shape" => "stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]",
        "hints" => [
            Dict("stage" => "concept", "text" => "A story fits when 5 is between its low end and its high end, both ends included. Check each end separately, then keep the rows that pass both."),
            Dict("stage" => "shape", "text" => "fits_low = table.lower .<= target; fits_high = target .<= table.upper; table[fits_low .& fits_high, :]. table is stories and target is observed_count. .& keeps a row only when both are true."),
            Dict("stage" => "solution", "text" => "fits_low = stories.lower .<= observed_count; fits_high = observed_count .<= stories.upper; stories[fits_low .& fits_high, :]"),
        ],
        "result_visual" => "compatible-model-evidence-board",
    )]
end

function mystery_c6_case_info(; move_id::String=MYSTERY_C6_MOVE, request_id::String="")
    move_id == MYSTERY_C6_MOVE || throw(ArgumentError("Unknown C6 move."))
    candidates = mystery_c6_candidates()
    observed_count = mystery_c6_observed_count()
    return Dict{String, Any}(
        "type" => "case", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C6_CHAPTER, "move_id" => move_id, "mode" => "challenge",
        "activity_id" => nothing, "simulation_id" => nothing, "request_id" => request_id,
        "title" => "Are the fleas vanishing?",
        "question" => "The report says \"vanishing\". Which story could give the notebook's 5 of 6?",
        "goal" => "Keep every story whose usual range includes 5.",
        "rule" => "lower ≤ observed_count ≤ upper",
        "key_note" => "p is the story's chance that one jar shows fleas. The usual range is the counts out of six the story gives most of the time; both ends count.",
        "n_trials" => MYSTERY_C6_N_TRIALS, "observed_count" => observed_count,
        "inputs" => [Dict{String, Any}(
            "id" => "stories", "label" => "The story board: one row per story, columns: model (the story's name), p, lower, upper",
            "data_label" => MYSTERY_DATA_LABEL, "columns" => _mystery_columns(candidates),
            "rows" => _mystery_c6_rows(candidates),
        )],
        "moves" => _mystery_c6_moves(),
    )
end

_mystery_c6_error(message::String) = Dict{String, Any}("type" => "error", "message" => message)
_mystery_c6_valid_request_id(value) = value isa AbstractString && !isempty(strip(value))

function mystery_c6_case_info(msg::AbstractDict)
    version = get(msg, "contract_version", nothing)
    version isa Integer && !(version isa Bool) && version == 1 ||
        return _mystery_c6_error("C6 case_info requires contract_version 1.")
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID || return _mystery_c6_error("C6 case_info requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C6_CHAPTER || return _mystery_c6_error("C6 case_info requires chapter C6.")
    get(msg, "move_id", nothing) == MYSTERY_C6_MOVE || return _mystery_c6_error("C6 case_info requires move_id compatible-models.")
    get(msg, "mode", nothing) == "challenge" || return _mystery_c6_error("C6 could not start this step. Reload the page to try again.")
    get(msg, "activity_id", nothing) === nothing || return _mystery_c6_error("C6 challenge activity_id must be null.")
    get(msg, "simulation_id", nothing) === nothing || return _mystery_c6_error("C6 challenge simulation_id must be null.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c6_valid_request_id(request_id) || return _mystery_c6_error("C6 case_info requires a non-empty string request_id.")
    return mystery_c6_case_info(request_id=String(request_id))
end

function _mystery_c6_explanation(pass)
    if pass === true
        return Dict(
            "julia" => "Your result kept exactly the stories whose usual range includes the notebook's 5. The taught way builds fits_low = stories.lower .<= observed_count and fits_high = observed_count .<= stories.upper, then keeps the rows where both are true.",
            "case" => "Coin flip and Thriving can give 5 of 6. Vanishing almost never can: 5 is outside its usual range of 0 to 2. The notebook does not look like vanishing fleas.",
            "limit" => "Fitting is not proof: two stories still fit.",
        )
    end
    return Dict(
        "julia" => "Return the story rows for which lower ≤ observed_count ≤ upper, preserving every displayed value.",
        "case" => "Nothing found yet: the returned rows must match this step first.",
        "limit" => "A failed run means the returned rows do not yet match the rule.",
    )
end

function _mystery_c6_result_data(display)
    display isa DataFrames.DataFrame || return nothing
    return Dict{String, Any}(
        "kind" => "table", "columns" => _mystery_columns(display), "rows" => _mystery_c6_rows(display),
    )
end

function _mystery_c6_result(; request_id::String="", status::String="error", pass=false,
                            message::String="", stdout::String="", value_repr::String="",
                            rows=Any[], columns=String[], feedback::String="", result_data=nothing)
    result = Dict{String, Any}(
        "type" => "case_result", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C6_CHAPTER, "move_id" => MYSTERY_C6_MOVE, "mode" => "challenge",
        "activity_id" => nothing, "simulation_id" => nothing, "request_id" => request_id,
        "status" => status, "pass" => pass, "practice_pass" => nothing,
        "progress_eligible" => status == "ok" && pass === true, "message" => message,
        "stdout" => stdout, "value_repr" => value_repr, "columns" => columns, "rows" => rows,
        "result_data" => result_data, "feedback" => feedback,
        "explanation" => _mystery_c6_explanation(pass),
        "result_visual" => pass === true && result_data !== nothing ?
            Dict("type" => "compatible-model-evidence-board", "data" => Dict("rows" => rows)) : nothing,
    )
    if pass === true
        result["evidence"] = Dict(
            "id" => "c6-story-fit",
            "title" => "Which stories still fit",
            "text" => "Coin flip and Thriving can give 5 of 6. Vanishing almost never can.",
            "claim" => "Claim 2, \"the fleas are vanishing\": not supported.",
        )
    end
    return result
end

function _mystery_c6_guarded_code(code::String)
    return "__juliatime_c6_candidates_identity__ = objectid(stories)\n" *
           "__juliatime_c6_candidates_snapshot__ = deepcopy(stories)\n" *
           "__juliatime_c6_answer__ = begin\n" * code * "\nend\n" *
           "isequal(stories, __juliatime_c6_candidates_snapshot__) || error(\"The supplied stories values changed. Keep the inputs unchanged and create a separate result.\")\n" *
           "objectid(stories) == __juliatime_c6_candidates_identity__ || error(\"The supplied stories binding changed. Keep the inputs unchanged and create a separate result.\")\n" *
           "__juliatime_c6_answer__"
end

# R7 (2026-09-24 re-test): the guard above wraps the learner's code, so a ParseError raised on the
# wrapped text named wrapper lines and shifted line numbers. Parse the learner's code on its own
# first; Julia stores its own ParseError in the first :error or :incomplete node.
# Repair 4: this parse runs in the server process with no time limit. Code longer than 4000
# characters skips it, and a parser that throws (StackOverflowError on deeply nested input) returns
# nothing; either way the guarded worker run, which is time-limited, handles the code, as C3 does.
# Deep nesting can also make Julia fall back to its older parser, which reports a plain String;
# it is shown as a ParseError, as C4 does. `parser` lets a test stand in for the parser.
function _mystery_c6_parse_error(code::String; parser=Meta.parseall)
    length(code) > 4_000 && return nothing
    parsed = try
        parser(code; filename="none")
    catch
        return nothing
    end
    parsed isa Expr || return nothing
    for ex in parsed.args
        ex isa Expr && ex.head in (:error, :incomplete) || continue
        problem = ex.args[1]
        return problem isa String ? Meta.ParseError(problem) : problem
    end
    return nothing
end

function _mystery_c6_valid_run_envelope(msg::AbstractDict)
    get(msg, "type", nothing) == "case_run" || return (false, "C6 requires type case_run.")
    version = get(msg, "contract_version", nothing)
    version isa Integer && !(version isa Bool) && version == 1 || return (false, "C6 case_run requires contract_version 1.")
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID || return (false, "C6 case_run requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C6_CHAPTER || return (false, "C6 case_run requires chapter C6.")
    get(msg, "move_id", nothing) == MYSTERY_C6_MOVE || return (false, "C6 case_run requires move_id compatible-models.")
    get(msg, "mode", nothing) == "challenge" || return (false, "C6 could not start this step. Reload the page to try again.")
    get(msg, "activity_id", nothing) === nothing || return (false, "C6 challenge activity_id must be null.")
    get(msg, "simulation_id", nothing) === nothing || return (false, "C6 challenge simulation_id must be null.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c6_valid_request_id(request_id) || return (false, "C6 case_run requires a non-empty string request_id.")
    return (true, nothing)
end

"""Run C6 with fresh protected story data and return only the learner's actual result payload."""
function mystery_c6_case_run(msg::AbstractDict; on_status::Function=((_, __) -> nothing))
    valid, error_message = _mystery_c6_valid_run_envelope(msg)
    valid || return _mystery_c6_error(error_message)
    request_id = String(msg["request_id"])
    code = get(msg, "code", nothing)
    code isa AbstractString || return _mystery_c6_result(
        request_id=request_id, message="`code` must be a string.",
        feedback="Type Julia code in the editor before running this step.")
    isempty(strip(code)) && return _mystery_c6_result(
        request_id=request_id, message="Write some Julia before running the case.",
        feedback="The editor is empty, so no sandbox worker was started.")

    env = (stories=mystery_c6_candidates(), observed_count=mystery_c6_observed_count(),
           n_trials=MYSTERY_C6_N_TRIALS)
    parse_error = _mystery_c6_parse_error(String(code))
    sandbox_result = parse_error !== nothing ?
        SandboxResult(:error, nothing, "", _format_error(parse_error)) :
        lock(_RUN_LOCK) do
            run_code(_mystery_c6_guarded_code(String(code)); env=env, budget=RUN_BUDGET,
                     protected_bindings=(:stories, :observed_count, :n_trials), on_status=on_status)
        end
    display = sandbox_result.value
    columns, rows = display isa DataFrames.DataFrame ?
        (_mystery_columns(display), _mystery_c6_rows(display)) : (String[], Any[])
    value_repr = display === nothing ? "" : _mystery_safe_repr(display)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    checked, feedback = sandbox_result.status == :ok ? check_mystery_c6(display) :
        (false, "Julia stopped before the end. Check the names, then run again.")
    return _mystery_c6_result(
        request_id=request_id, status=String(sandbox_result.status), pass=checked,
        message=sandbox_result.message, stdout=sandbox_result.stdout, value_repr=value_repr,
        rows=rows, columns=columns, feedback=feedback, result_data=_mystery_c6_result_data(display),
    )
end

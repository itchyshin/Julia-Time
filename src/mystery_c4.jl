# Missing Fleas, chapter 4: turn an already supplied, eligible recheck list into a
# three-jar plan.  Planning does not create a recheck outcome or a biological claim.
# The browser sees fresh teaching inputs, while the checker rebuilds its own fixture.

const MYSTERY_C4_CHAPTER = "C4"
const MYSTERY_C4_MOVES = ("plan-distinct-recheck",)
const MYSTERY_C4_PLAN_SIZE = 3
const MYSTERY_C4_ELIGIBLE_COLUMNS = ["jar_id"]

"""
    mystery_c4_expected_eligible() -> DataFrame

Return a fresh, already screened list of B09 jar IDs available for the simulated recheck.
Eligibility is a stated planning rule.  It is not a flea observation or an explanation.
"""
function mystery_c4_expected_eligible()
    b09 = filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars())
    return DataFrame(jar_id=copy(b09.jar_id[[1, 2, 4, 6]]))
end

# Compatibility name for callers that previously asked for the C4 fixture.  The one-move
# chapter deliberately exposes only the eligible list, never a Boolean-mask pre-exercise.
mystery_c4_candidates() = mystery_c4_expected_eligible()

function _mystery_c4_rows(df::DataFrames.DataFrame)
    columns = _mystery_columns(df)
    return [Dict{String, Any}(column => _mystery_wire_value(df[row, column])
                              for column in columns)
            for row in 1:DataFrames.nrow(df)]
end

_mystery_c4_plan_rows(ids::AbstractVector) =
    [Dict{String, Any}("jar_id" => String(id)) for id in ids]

function _mystery_c4_check_plan(value)
    value isa AbstractVector ||
        return (false, "Return a vector of exactly three distinct eligible jar IDs.")
    length(value) == MYSTERY_C4_PLAN_SIZE ||
        return (false, "Plan exactly three jar IDs for the recheck.")
    all(id -> id isa AbstractString && !isempty(strip(id)), value) ||
        return (false, "Each planned jar ID must be non-empty recorded text.")
    ids = String.(value)
    length(unique(ids)) == MYSTERY_C4_PLAN_SIZE ||
        return (false, "A planned recheck cannot select the same jar twice.")
    eligible_ids = Set(String.(mystery_c4_expected_eligible().jar_id))
    all(id -> id in eligible_ids, ids) ||
        return (false, "Each planned jar must be one of the supplied eligible IDs.")
    return (true, "These are three distinct eligible jar IDs for a planned recheck without replacement.")
end

"""Check C4's one meaningful move against a fresh, server-owned eligible list."""
function check_mystery_c4(value, move_id)
    move_id == "plan-distinct-recheck" ||
        return (false, "C4's one move is plan-distinct-recheck.")
    return _mystery_c4_check_plan(value)
end

function _mystery_c4_moves()
    return [Dict{String, Any}(
        "id" => "plan-distinct-recheck",
        "title" => "Plan three distinct rechecks",
        "required_result" => "A vector containing exactly three different eligible jar IDs.",
        "concept" => "The supplied table has already been screened under the planning rule. Extract its jar-ID list, then choose three IDs without replacement so one jar cannot be planned twice.",
        "code_shape" => "sample(items, n; replace=false)",
        "syntax" => [
            Dict("token" => ".jar_id", "meaning" => "reads the jar-ID column as a one-dimensional list."),
            Dict("token" => ";", "meaning" => "starts keyword settings after the ordinary inputs."),
            Dict("token" => "replace=false", "meaning" => "means do not choose the same jar again."),
        ],
        "hints" => [
            Dict("stage" => "concept", "text" => "Choose three different IDs from the supplied eligible list."),
            Dict("stage" => "shape", "text" => "Use sample(items, n; replace=false) with the list of jar IDs and the number 3."),
            Dict("stage" => "solution", "text" => "sample(eligible.jar_id, 3; replace=false)"),
        ],
        "result_visual" => "planned-recheck-rack",
    )]
end

function _mystery_c4_input()
    df = mystery_c4_expected_eligible()
    return Dict{String, Any}(
        "id" => "eligible", "label" => "Eligible simulated recheck jars",
        "data_label" => MYSTERY_DATA_LABEL, "columns" => _mystery_columns(df),
        "rows" => _mystery_c4_rows(df),
    )
end

function mystery_c4_case_info(; move_id::String="plan-distinct-recheck", request_id::String="")
    move_id in MYSTERY_C4_MOVES || throw(ArgumentError("Unknown C4 move."))
    return Dict{String, Any}(
        "type" => "case", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C4_CHAPTER, "move_id" => move_id, "request_id" => request_id,
        "mode" => "challenge", "activity_id" => nothing, "simulation_id" => nothing,
        "title" => "Plan three distinct rechecks",
        "question" => "Which three supplied eligible jar IDs will the plan recheck without replacement?",
        "goal" => "Choose exactly three distinct eligible jar IDs for a simulated recheck plan. No new observations are shown or inferred.",
        "key_note" => "The list is already eligible under the stated planning rule. A plan names what to inspect next; it does not say what a recheck would find.",
        "scene" => Dict(
            "id" => "c4-recheck-plan", "speaker" => "Toto",
            "line" => "The question is not which jar looks suspicious. Our stated rule already made the eligible list; now make a reproducible three-jar plan.",
            "image" => "assets/lab-cast.png",
            "alt" => "Itchy, Toto, Momo, and Eddie together in the Missing Fleas teaching lab.",
        ),
        "inputs" => [_mystery_c4_input()], "moves" => _mystery_c4_moves(),
    )
end

_mystery_c4_error(message::String) = Dict{String, Any}("type" => "error", "message" => message)
_mystery_c4_valid_request_id(value) = value isa AbstractString && !isempty(strip(value))

function mystery_c4_case_info(msg::AbstractDict)
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID ||
        return _mystery_c4_error("C4 case_info requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C4_CHAPTER ||
        return _mystery_c4_error("C4 case_info requires chapter C4.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c4_valid_request_id(request_id) ||
        return _mystery_c4_error("C4 case_info requires a non-empty string request_id.")
    (!haskey(msg, "simulation_id") || msg["simulation_id"] === nothing) ||
        return _mystery_c4_error("C4 case_info simulation_id must be null or absent.")
    move_id = get(msg, "move_id", "plan-distinct-recheck")
    move_id == "plan-distinct-recheck" ||
        return _mystery_c4_error("C4's one move is plan-distinct-recheck.")
    get(msg, "mode", "challenge") == "challenge" ||
        return _mystery_c4_error("C4 supports challenge mode only.")
    get(msg, "activity_id", nothing) === nothing ||
        return _mystery_c4_error("C4 challenge case_info activity_id must be null or absent.")
    return mystery_c4_case_info(; move_id="plan-distinct-recheck", request_id=String(request_id))
end

function _mystery_c4_explanation(pass)
    if pass === true
        return Dict(
            "julia" => "eligible.jar_id extracted the supplied jar-ID list. sample(...; replace=false) returned three different IDs from that list.",
            "case" => "These three IDs form the simulated planned recheck rack. No new observations have been made or inferred.",
            "limit" => "The plan does not tell us what a recheck would find, establish a biological cause, or explain the recording difference.",
        )
    end
    return Dict(
        "julia" => "Return exactly three distinct IDs from the supplied eligible.jar_id list.",
        "case" => "No recheck plan is established until the returned result matches the stated move.",
        "limit" => "A failed run makes no new observation and establishes no biological cause.",
    )
end

function _mystery_c4_result_data(display)
    display isa AbstractVector && all(id -> id isa AbstractString, display) || return nothing
    return Dict{String, Any}("kind" => "recheck-rack", "columns" => ["jar_id"],
                             "rows" => _mystery_c4_plan_rows(display))
end

function _mystery_c4_result_visual(rows, pass)
    pass === true || return nothing
    return Dict{String, Any}(
        "type" => "planned-recheck-rack", "label" => "Planned recheck — no new observations.",
        "data" => Dict("rows" => rows),
    )
end

function _mystery_c4_result(; request_id::String="", status::String="error", pass=false,
                            message::String="", stdout::String="", rows=Any[], columns=String[],
                            feedback::String="", value_repr::String="", result_data=nothing)
    return Dict{String, Any}(
        "type" => "case_result", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C4_CHAPTER, "move_id" => "plan-distinct-recheck",
        "mode" => "challenge", "activity_id" => nothing, "simulation_id" => nothing,
        "request_id" => request_id, "status" => status, "pass" => pass,
        "practice_pass" => nothing, "progress_eligible" => status == "ok" && pass === true,
        "message" => message, "stdout" => stdout, "value_repr" => value_repr,
        "columns" => columns, "rows" => rows, "result_data" => result_data,
        "feedback" => feedback, "explanation" => _mystery_c4_explanation(pass),
        "result_visual" => _mystery_c4_result_visual(rows, pass),
    )
end

function _mystery_c4_guarded_code(code::String)
    identity = "__juliatime_c4_eligible_identity__"
    return "$(identity) = objectid(eligible)\n__juliatime_c4_answer__ = begin\n" * code *
           "\nend\nobjectid(eligible) == $(identity) || error(\"The supplied eligible binding changed. Keep the source table unchanged; create a separate plan, then try again.\")\n__juliatime_c4_answer__"
end

function _mystery_c4_valid_run_envelope(msg::AbstractDict)
    version = get(msg, "contract_version", nothing)
    version isa Integer && !(version isa Bool) && version == 1 ||
        return (false, "C4 case_run requires contract_version 1.")
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID ||
        return (false, "C4 case_run requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C4_CHAPTER ||
        return (false, "C4 case_run requires chapter C4.")
    get(msg, "move_id", nothing) == "plan-distinct-recheck" ||
        return (false, "C4's one move is plan-distinct-recheck.")
    get(msg, "mode", nothing) == "challenge" ||
        return (false, "C4 supports challenge mode only.")
    (!haskey(msg, "activity_id") || msg["activity_id"] === nothing) ||
        return (false, "C4 challenge activity_id must be null or absent.")
    (!haskey(msg, "simulation_id") || msg["simulation_id"] === nothing) ||
        return (false, "C4 simulation_id must be null or absent.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c4_valid_request_id(request_id) ||
        return (false, "C4 case_run requires a non-empty string request_id.")
    return (true, nothing)
end

"""Run C4's sole sampling move with fresh worker input and checker-owned truth."""
function mystery_c4_case_run(msg::AbstractDict; on_status::Function=((_, __) -> nothing))
    valid, error = _mystery_c4_valid_run_envelope(msg)
    valid || return _mystery_c4_error(error)
    request_id = String(msg["request_id"])
    code = get(msg, "code", nothing)
    code isa AbstractString || return _mystery_c4_result(
        request_id=request_id, message="`code` must be a string.",
        feedback="Type Julia code in the editor before running this move.")
    isempty(strip(code)) && return _mystery_c4_result(
        request_id=request_id, message="Write some Julia before running the case.",
        feedback="The editor is empty, so no sandbox worker was started.")

    sandbox_result = lock(_RUN_LOCK) do
        run_code(_mystery_c4_guarded_code(String(code));
                 env=(eligible=mystery_c4_expected_eligible(),), budget=RUN_BUDGET,
                 protected_bindings=(:eligible,), on_status=on_status)
    end
    display = sandbox_result.value
    columns, rows = if display isa AbstractVector && all(id -> id isa AbstractString, display)
        (["jar_id"], _mystery_c4_plan_rows(display))
    else
        (String[], Any[])
    end
    value_repr = display === nothing ? "" : _mystery_safe_repr(display)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    checked, feedback = sandbox_result.status == :ok ?
        _mystery_c4_check_plan(display) :
        (false, "Julia did not complete this move. Keep the supplied eligible table unchanged, then try again.")
    return _mystery_c4_result(
        request_id=request_id, status=String(sandbox_result.status), pass=checked,
        message=sandbox_result.message, stdout=sandbox_result.stdout, rows=rows, columns=columns,
        feedback=feedback, value_repr=value_repr, result_data=_mystery_c4_result_data(display),
    )
end

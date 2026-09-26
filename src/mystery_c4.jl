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
        return (false, "Return a list of three jar IDs.")
    length(value) == MYSTERY_C4_PLAN_SIZE ||
        return (false, "Pick exactly three jars.")
    all(id -> id isa AbstractString && !isempty(strip(id)), value) ||
        return (false, "Each planned jar ID must be non-empty recorded text.")
    ids = String.(value)
    length(unique(ids)) == MYSTERY_C4_PLAN_SIZE ||
        return (false, "The same jar was picked twice. Add replace=false so no jar is drawn twice.")
    eligible_ids = Set(String.(mystery_c4_expected_eligible().jar_id))
    all(id -> id in eligible_ids, ids) ||
        return (false, "Every jar must come from Eddie's list.")
    return (true, "Three different jars from the list.")
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
        "title" => "Your step · Pick three different jars by chance",
        "required_result" => "A list of three different jar IDs from Eddie's list.",
        "concept" => "Take the list of jar IDs and draw three at random, with no jar drawn twice.",
        "code_shape" => "sample(items, n; replace=false)",
        "syntax" => [
            Dict("token" => ".jar_id", "meaning" => "reads the jar-ID column as a one-dimensional list."),
            Dict("token" => ";", "meaning" => "splits what to use from how to do it: before it, the list and how many; after it, a named setting."),
            Dict("token" => "replace=false", "meaning" => "means no jar drawn twice."),
        ],
        "hints" => [
            Dict("stage" => "concept", "text" => "Take the list of jar IDs and draw three at random, with no jar drawn twice."),
            Dict("stage" => "shape", "text" => "sample(items, n; replace=false). items is the list, n is how many. The ; starts the named settings, and replace=false means no jar twice."),
            Dict("stage" => "solution", "text" => "sample(eligible.jar_id, 3; replace=false)"),
        ],
        "result_visual" => "planned-recheck-rack",
    )]
end

function _mystery_c4_input()
    df = mystery_c4_expected_eligible()
    return Dict{String, Any}(
        "id" => "eligible", "label" => "Eddie's recheck list: the four B09 jars that can still be rechecked, in one column, jar_id. sample is ready to use.",
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
        "title" => "Your step · Pick three different jars by chance",
        "question" => "How do we choose three jars to recheck without picking favourites?",
        "goal" => "Let Julia pick three IDs at random from eligible.jar_id, so every jar on the list has the same chance. Each run may pick a different three; any three different jars are right.",
        "key_note" => "eligible: the four B09 jars that can still be rechecked, in one column, jar_id. sample is ready to use.",
        "scene" => Dict(
            "id" => "c4-recheck-plan", "speaker" => "Toto",
            "line" => "The question is not which jar looks suspicious. Let chance pick three from the list.",
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
        return _mystery_c4_error("C4 could not start this step. Reload the page to try again.")
    get(msg, "activity_id", nothing) === nothing ||
        return _mystery_c4_error("C4 challenge case_info activity_id must be null or absent.")
    return mystery_c4_case_info(; move_id="plan-distinct-recheck", request_id=String(request_id))
end

function _mystery_c4_explanation(pass, ids=nothing)
    if pass === true
        plan = ids === nothing ? "" : join(String.(ids), ", ")
        return Dict(
            "julia" => "Your code picked three different IDs, all from Eddie's list.",
            "case" => isempty(plan) ? "The recheck is planned: three different jars from Eddie's list." :
                "The recheck is planned: $(plan), three different jars from Eddie's list.",
            "limit" => "A plan finds nothing yet; the jars still have to be looked at.",
            "reminder" => "Check that your line says replace=false. Without it, Julia can pick the same jar twice, and a run like this could pass by luck.",
        )
    end
    return Dict(
        "julia" => "Return a list of three jar IDs.",
        "case" => "Nothing found yet: the returned result must match this step first.",
        "limit" => "A failed run finds nothing new and shows nothing about the cause.",
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
        "type" => "planned-recheck-rack", "label" => "Recheck tray: planned, not looked at yet",
        "data" => Dict("rows" => rows),
    )
end

function _mystery_c4_result(; request_id::String="", status::String="error", pass=false,
                            message::String="", stdout::String="", rows=Any[], columns=String[],
                            feedback::String="", value_repr::String="", result_data=nothing,
                            ids=nothing)
    result = Dict{String, Any}(
        "type" => "case_result", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C4_CHAPTER, "move_id" => "plan-distinct-recheck",
        "mode" => "challenge", "activity_id" => nothing, "simulation_id" => nothing,
        "request_id" => request_id, "status" => status, "pass" => pass,
        "practice_pass" => nothing, "progress_eligible" => status == "ok" && pass === true,
        "message" => message, "stdout" => stdout, "value_repr" => value_repr,
        "columns" => columns, "rows" => rows, "result_data" => result_data,
        "feedback" => feedback, "explanation" => _mystery_c4_explanation(pass, ids),
        "result_visual" => _mystery_c4_result_visual(rows, pass),
    )
    if pass === true
        result["evidence"] = Dict(
            "id" => "c4-recheck-planned",
            "title" => "Recheck tray: planned, not looked at yet",
            "claim" => "Claim 1 is done: the 0 was a blank, and a fair recheck is planned.",
        )
    end
    return result
end

function _mystery_c4_guarded_code(code::String)
    identity = "__juliatime_c4_eligible_identity__"
    return "$(identity) = objectid(eligible)\n__juliatime_c4_answer__ = begin\n" * code *
           "\nend\nobjectid(eligible) == $(identity) || error(\"The supplied eligible binding changed. Keep the source table unchanged; create a separate plan, then try again.\")\n__juliatime_c4_answer__"
end

# Retest R7: parse the learner's code on its own first, so a syntax mistake is reported by
# Julia against the learner's own lines, not the guard wrapper's lines and names above.
# Repair 4: this parse runs in the server process with no time limit. Code longer than 4000
# characters skips it, and a parser that throws (StackOverflowError on deeply nested input) returns
# nothing; either way the guarded worker run, which is time-limited, handles the code, as C3 does.
# `parser` lets a test stand in for a parser that throws.
function _mystery_c4_parse_error(code::String; parser=Meta.parseall)
    length(code) > 4_000 && return nothing
    parsed = try
        parser(code; filename="none")
    catch
        return nothing
    end
    parsed isa Expr || return nothing
    for node in parsed.args
        node isa Expr && node.head in (:error, :incomplete) || continue
        problem = node.args[1]
        return problem isa String ? Meta.ParseError(problem) : problem
    end
    return nothing
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
        return (false, "C4 could not start this step. Reload the page to try again.")
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

    parse_error = _mystery_c4_parse_error(String(code))
    sandbox_result = parse_error !== nothing ?
        SandboxResult(:error, nothing, "", _format_error(parse_error)) :
        lock(_RUN_LOCK) do
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
        (false, "Julia stopped before the end. Check the names, then run again.")
    return _mystery_c4_result(
        request_id=request_id, status=String(sandbox_result.status), pass=checked,
        message=sandbox_result.message, stdout=sandbox_result.stdout, rows=rows, columns=columns,
        feedback=feedback, value_repr=value_repr, result_data=_mystery_c4_result_data(display),
        ids=checked ? display : nothing,
    )
end

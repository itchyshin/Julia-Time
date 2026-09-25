# Missing Fleas, chapter 5: a fixed simulation lets learners make an event mask, then calculate
# its frequency.  Counts are the only simulation helper output; the event and frequency remain
# the learner's work and checker truth is rebuilt independently after each sandbox run.

const MYSTERY_C5_CHAPTER = "C5"
const MYSTERY_C5_MOVES = ("event-mask", "event-frequency")
const MYSTERY_C5_N_JARS = 6
const MYSTERY_C5_P_REF = 0.5
const MYSTERY_C5_N_TRIALS = 1000
const MYSTERY_C5_SIMULATION_SEED = 5107
# This is intentionally an opaque protocol identity: clients must echo it, not derive or alter it.
const MYSTERY_C5_SIMULATION_ID = "c5-simulated-counts-v1"
const MYSTERY_C5_ACTION_ACTIVITY = "card-round"
const MYSTERY_C5_ACTION_MOVE = "card-draw-demo"
const MYSTERY_C5_ACTIONS = ("draw-six", "replay-100", "replay-1000")

"""Return fresh fixed seeded counts of detections in six independent binary trials."""
function mystery_c5_sim_counts(; n_trials::Int=MYSTERY_C5_N_TRIALS,
                               seed::Int=MYSTERY_C5_SIMULATION_SEED)
    rng = Random.MersenneTwister(seed)
    return [sum(rand(rng, Bool, MYSTERY_C5_N_JARS)) for _ in 1:n_trials]
end

"""Return the observed B09 detection count from a newly constructed immutable case fixture."""
function mystery_c5_observed_count()
    b09 = filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars())
    return sum(b09.detected)
end

"""Build the C5 expected Boolean event vector separately from learner-visible simulation data."""
function mystery_c5_expected_events()
    return mystery_c5_sim_counts() .>= mystery_c5_observed_count()
end

_mystery_c5_valid_request_id(value) = value isa AbstractString && !isempty(strip(value))
_mystery_c5_error(message::String) = Dict{String, Any}("type" => "error", "message" => message)

function _mystery_c5_exact_events(value)
    value isa AbstractVector || return nothing
    length(value) == MYSTERY_C5_N_TRIALS || return nothing
    all(event -> event isa Bool, value) || return nothing
    return Bool.(value)
end

function _mystery_c5_frequency(value)
    value isa Real && !(value isa Bool) && isfinite(value) || return nothing
    return try
        Float64(value)
    catch
        nothing
    end
end

"""
    check_mystery_c5(value, move_id) -> (pass, feedback)

Check the learner's actual result against fresh fixed simulation truth.  Move 1 needs the exact
event vector.  Move 2 needs the named tuple `(events=events, frequency=sum(events)/length(events))`:
both fields are checked, so an otherwise plausible scalar cannot conceal a wrong mask or denominator.
"""
function check_mystery_c5(value, move_id)
    move_id isa AbstractString && String(move_id) in MYSTERY_C5_MOVES ||
        return (false, "Choose the C5 move: event-mask or event-frequency.")
    expected_events = mystery_c5_expected_events()
    if String(move_id) == "event-mask"
        actual_events = _mystery_c5_exact_events(value)
        actual_events === nothing &&
            return (false, "Return one true-or-false event value for each of the 1,000 simulated counts.")
        actual_events == expected_events ||
            return (false, "Check the direction: an event is a simulated count at least the observed count.")
        return (true, "The event mask marks exactly the simulated counts at least the observed count.")
    end

    value isa NamedTuple && keys(value) == (:events, :frequency) ||
        return (false, "Return (events=events, frequency=sum(events)/length(events)) with both named fields.")
    actual_events = _mystery_c5_exact_events(value.events)
    actual_events === nothing &&
        return (false, "The events field needs one Boolean value for every simulated trial.")
    actual_events == expected_events ||
        return (false, "The events field must use sim_counts .>= observed_count exactly.")
    frequency = _mystery_c5_frequency(value.frequency)
    frequency === nothing &&
        return (false, "The frequency must be one finite numeric value.")
    expected_frequency = sum(expected_events) / length(expected_events)
    frequency == expected_frequency ||
        return (false, "Divide the matching event count by all 1,000 trials.")
    return (true, "The named event mask and matching-events / all-trials frequency agree.")
end

function _mystery_c5_moves()
    return [
        Dict{String, Any}(
            "id" => "event-mask",
            "title" => "Name the simulated event",
            "required_result" => "A Boolean vector with one value per simulated count: true exactly when the count is at least observed_count.",
            "concept" => "Compare every simulated count to the observed count, not just one count.",
            "code_shape" => "events = sim_counts .>= observed_count",
            "syntax" => [
                Dict("token" => ".>=", "meaning" => "compares every count and makes one true-or-false event value per simulation."),
                Dict("token" => "=", "meaning" => "stores the event vector under the name events for the next move."),
            ],
            "hints" => [
                Dict("stage" => "concept", "text" => "Mark a simulation true when its count is at least the observed count."),
                Dict("stage" => "shape", "text" => "Use a dotted comparison so every simulated count is compared."),
                Dict("stage" => "solution", "text" => "sim_counts .>= observed_count"),
            ],
            "result_visual" => "simulation-event-mask",
        ),
        Dict{String, Any}(
            "id" => "event-frequency",
            "title" => "Calculate the event frequency",
            "required_result" => "Return (events=events, frequency=sum(events)/length(events)) so both the event vector and matching-events / all-trials frequency can be checked.",
            "concept" => "The frequency is matching events divided by all simulations under this stated teaching model.",
            "code_shape" => "events = sim_counts .>= observed_count; (events=events, frequency=sum(events)/length(events))",
            "syntax" => [
                Dict("token" => "sum(events)", "meaning" => "counts true event values."),
                Dict("token" => "length(events)", "meaning" => "counts all simulated trials, including non-events."),
            ],
            "hints" => [
                Dict("stage" => "concept", "text" => "First make the same event mask, then divide its true count by all trials."),
                Dict("stage" => "shape", "text" => "Return both named fields so the event and frequency stay connected."),
                Dict("stage" => "solution", "text" => "events = sim_counts .>= observed_count; (events=events, frequency=sum(events)/length(events))"),
            ],
            "result_visual" => "simulation-tail-frequency",
        ),
    ]
end

function _mystery_c5_actions()
    return [
        Dict("id" => "draw-six", "label" => "Draw six cards", "activity_id" => MYSTERY_C5_ACTION_ACTIVITY,
             "note" => "A fixed non-credit demonstration: draw, record, replace, and shuffle after every card."),
        Dict("id" => "replay-100", "label" => "Replay 100 simulations", "activity_id" => MYSTERY_C5_ACTION_ACTIVITY,
             "note" => "A fixed non-credit replay; its result can vary from the 1,000-trial case simulation."),
        Dict("id" => "replay-1000", "label" => "Replay 1,000 simulations", "activity_id" => MYSTERY_C5_ACTION_ACTIVITY,
             "note" => "A fixed non-credit replay; it demonstrates Monte Carlo variation without changing case progress."),
    ]
end

function mystery_c5_case_info(; move_id::String="event-mask", request_id::String="")
    move_id in MYSTERY_C5_MOVES || throw(ArgumentError("Unknown C5 move."))
    counts = mystery_c5_sim_counts()
    observed_count = mystery_c5_observed_count()
    return Dict{String, Any}(
        "type" => "case", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C5_CHAPTER, "move_id" => move_id, "mode" => "challenge",
        "activity_id" => nothing, "simulation_id" => MYSTERY_C5_SIMULATION_ID,
        "request_id" => request_id,
        "title" => move_id == "event-mask" ? "Which simulations meet the event?" : "How often does that event occur?",
        "question" => "Under the stated six-trial, p = 0.5 teaching model, how often is the simulated count at least the observed count?",
        "goal" => "Use the supplied simulated counts to identify the event, then calculate its frequency. This is frequency under a stated model, not proof that the model is true.",
        "key_note" => "Six independent binary trials, replacement after every draw, and equal colour probability are teaching-model assumptions, not facts about fleas.",
        "n_jars" => MYSTERY_C5_N_JARS, "p_ref" => MYSTERY_C5_P_REF,
        "observed_count" => observed_count, "n_trials" => MYSTERY_C5_N_TRIALS,
        "inputs" => [Dict{String, Any}(
            "id" => "sim_counts", "label" => "Simulated six-trial detection counts",
            "data_label" => "Simulated teaching data — fixed seeded model, not a new flea observation.",
            "values" => counts,
            "columns" => ["simulation", "count"],
            "rows" => [Dict("simulation" => index, "count" => count) for (index, count) in enumerate(counts)],
        )],
        "moves" => _mystery_c5_moves(), "actions" => _mystery_c5_actions(),
        "scene" => Dict("id" => "c5-toto-card-table", "speaker" => "Toto",
                        "line" => "A card round is a small model: draw, record, replace, shuffle, then repeat.",
                        "image" => "assets/course/scene-c5-toto-card-table.png",
                        "alt" => "Toto presents a small two-colour card deck at a lab table."),
    )
end

function mystery_c5_case_info(msg::AbstractDict)
    version = get(msg, "contract_version", nothing)
    version isa Integer && !(version isa Bool) && version == 1 ||
        return _mystery_c5_error("C5 case_info requires contract_version 1.")
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID || return _mystery_c5_error("C5 case_info requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C5_CHAPTER || return _mystery_c5_error("C5 case_info requires chapter C5.")
    move_id = get(msg, "move_id", nothing)
    move_id isa AbstractString && String(move_id) in MYSTERY_C5_MOVES || return _mystery_c5_error("C5 move_id must be event-mask or event-frequency.")
    get(msg, "mode", nothing) == "challenge" || return _mystery_c5_error("C5 case_info supports challenge mode only.")
    get(msg, "activity_id", nothing) === nothing || return _mystery_c5_error("C5 challenge activity_id must be null.")
    get(msg, "simulation_id", nothing) === nothing || return _mystery_c5_error("C5 case_info simulation_id must be null.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c5_valid_request_id(request_id) || return _mystery_c5_error("C5 case_info requires a non-empty string request_id.")
    return mystery_c5_case_info(; move_id=String(move_id), request_id=String(request_id))
end

function _mystery_c5_explanation(move_id::String, pass)
    if pass === true && move_id == "event-mask"
        return Dict("julia" => "The dotted comparison .>= checked every simulated count against the observed count and returned one Boolean event value per trial.",
                    "case" => "The event mask describes this fixed simulation under the stated teaching model.",
                    "limit" => "It is not a probability that the model is true and is not a new flea observation.")
    elseif pass === true
        return Dict("julia" => "sum(events) / length(events) divides matching simulated events by all simulated trials.",
                    "case" => "This is a frequency under the stated teaching model.",
                    "limit" => "The frequency does not prove the model, explain the recording disagreement, or establish a biological cause.")
    end
    return Dict("julia" => move_id == "event-mask" ?
                    "Return the Boolean comparison sim_counts .>= observed_count." :
                    "Return both the exact event vector and its matching-events / all-trials frequency.",
                "case" => "No case finding from this chapter is established until the actual returned result matches the move.",
                "limit" => "A failed run says nothing about causes, people, or whether the teaching model is true.")
end

function _mystery_c5_result_data(value)
    events = _mystery_c5_exact_events(value)
    events !== nothing && return Dict{String, Any}(
        "kind" => "boolean-vector", "length" => length(events), "true_count" => sum(events),
        "preview" => events[1:min(end, 20)],
    )
    value isa NamedTuple && keys(value) == (:events, :frequency) || return nothing
    events = _mystery_c5_exact_events(value.events)
    frequency = _mystery_c5_frequency(value.frequency)
    (events === nothing || frequency === nothing) && return nothing
    return Dict{String, Any}(
        "kind" => "event-frequency", "length" => length(events), "matching" => sum(events),
        "trials" => length(events), "frequency" => frequency, "preview" => events[1:min(end, 20)],
    )
end

function _mystery_c5_result(; request_id::String="", move_id::String="event-mask",
                            status::String="error", pass=false, message::String="", stdout::String="",
                            value_repr::String="", result_data=nothing)
    return Dict{String, Any}(
        "type" => "case_result", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C5_CHAPTER, "move_id" => move_id, "mode" => "challenge",
        "activity_id" => nothing, "simulation_id" => MYSTERY_C5_SIMULATION_ID,
        "request_id" => request_id, "status" => status, "pass" => pass,
        "practice_pass" => nothing, "progress_eligible" => status == "ok" && pass === true,
        "message" => message, "stdout" => stdout, "value_repr" => value_repr,
        "columns" => String[], "rows" => Any[], "result_data" => result_data,
        "feedback" => pass === true ? "The returned C5 result matches the fresh simulation checker." :
                      "Keep the supplied simulation inputs unchanged, check the event and denominator, then run again.",
        "explanation" => _mystery_c5_explanation(move_id, pass),
        "result_visual" => pass === true && result_data !== nothing ?
            Dict("type" => move_id == "event-mask" ? "simulation-event-mask" : "simulation-tail-frequency",
                 "data" => result_data) : nothing,
    )
end

function _mystery_c5_guarded_code(code::String)
    # The generic sandbox guard catches changed final values; this identity guard additionally
    # rejects rebinding `sim_counts` to an equal copy, while still allowing a separate `events` result.
    return "__juliatime_c5_counts_identity__ = objectid(sim_counts)\n" *
           "__juliatime_c5_answer__ = begin\n" * code * "\nend\n" *
           "objectid(sim_counts) == __juliatime_c5_counts_identity__ || error(\"The supplied sim_counts binding changed. Keep the inputs unchanged and create a separate result.\")\n" *
           "__juliatime_c5_answer__"
end

# R7 (2026-09-24 re-test): the guard above wraps the learner's code, so a ParseError raised on the
# wrapped text named wrapper lines and shifted line numbers. Parse the learner's code on its own
# first; Julia stores its own ParseError in the first :error or :incomplete node.
# Repair 4: this parse runs in the server process with no time limit. Code longer than 4000
# characters skips it, and a parser that throws (StackOverflowError on deeply nested input) returns
# nothing; either way the guarded worker run, which is time-limited, handles the code, as C3 does.
# Deep nesting can also make Julia fall back to its older parser, which reports a plain String;
# it is shown as a ParseError, as C4 does. `parser` lets a test stand in for the parser.
function _mystery_c5_parse_error(code::String; parser=Meta.parseall)
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

function _mystery_c5_valid_run_envelope(msg::AbstractDict)
    version = get(msg, "contract_version", nothing)
    version isa Integer && !(version isa Bool) && version == 1 || return (false, "C5 case_run requires contract_version 1.")
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID || return (false, "C5 case_run requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C5_CHAPTER || return (false, "C5 case_run requires chapter C5.")
    move_id = get(msg, "move_id", nothing)
    move_id isa AbstractString && String(move_id) in MYSTERY_C5_MOVES || return (false, "C5 move_id must be event-mask or event-frequency.")
    get(msg, "mode", nothing) == "challenge" || return (false, "C5 supports challenge mode only.")
    get(msg, "activity_id", nothing) === nothing || return (false, "C5 challenge activity_id must be null.")
    get(msg, "simulation_id", nothing) == MYSTERY_C5_SIMULATION_ID || return (false, "C5 case_run requires the current simulation_id.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c5_valid_request_id(request_id) || return (false, "C5 case_run requires a non-empty string request_id.")
    return (true, String(move_id))
end

"""Run a C5 challenge against fresh protected counts; only an accepted actual result can be eligible."""
function mystery_c5_case_run(msg::AbstractDict; on_status::Function=((_, __) -> nothing))
    valid, move_or_error = _mystery_c5_valid_run_envelope(msg)
    valid || return _mystery_c5_error(move_or_error)
    move_id = move_or_error
    request_id = String(msg["request_id"])
    code = get(msg, "code", nothing)
    code isa AbstractString || return _mystery_c5_result(request_id=request_id, move_id=move_id,
        message="`code` must be a string.")
    isempty(strip(code)) && return _mystery_c5_result(request_id=request_id, move_id=move_id,
        message="Write some Julia before running the case.")
    env = (sim_counts=mystery_c5_sim_counts(), n_jars=MYSTERY_C5_N_JARS, p_ref=MYSTERY_C5_P_REF,
           observed_count=mystery_c5_observed_count(), n_trials=MYSTERY_C5_N_TRIALS)
    parse_error = _mystery_c5_parse_error(String(code))
    sandbox_result = parse_error !== nothing ?
        SandboxResult(:error, nothing, "", _format_error(parse_error)) :
        lock(_RUN_LOCK) do
            run_code(_mystery_c5_guarded_code(String(code)); env=env, budget=RUN_BUDGET,
                     protected_bindings=(:sim_counts, :n_jars, :p_ref, :observed_count, :n_trials),
                     on_status=on_status)
        end
    value_repr = sandbox_result.value === nothing ? "" : _mystery_safe_repr(sandbox_result.value)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    checked, feedback = sandbox_result.status == :ok ? check_mystery_c5(sandbox_result.value, move_id) :
        (false, "Julia did not complete this move. Keep the supplied inputs unchanged, then try again.")
    result = _mystery_c5_result(request_id=request_id, move_id=move_id, status=String(sandbox_result.status),
                                pass=checked, message=sandbox_result.message, stdout=sandbox_result.stdout,
                                value_repr=value_repr, result_data=_mystery_c5_result_data(sandbox_result.value))
    result["feedback"] = feedback
    return result
end

function _mystery_c5_action_result(; request_id::String="", action::String="", status::String="error",
                                   message::String="", generated_code::String="", result_data=nothing,
                                   simulation_id=nothing)
    return Dict{String, Any}(
        "type" => "case_action_result", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C5_CHAPTER, "move_id" => MYSTERY_C5_ACTION_MOVE, "mode" => "demonstration",
        "activity_id" => MYSTERY_C5_ACTION_ACTIVITY, "simulation_id" => simulation_id,
        "request_id" => request_id, "action" => action, "status" => status, "pass" => nothing,
        "progress_eligible" => false, "message" => message, "generated_code" => generated_code,
        "result_data" => result_data,
    )
end

"""Serve only fixed bounded card/replay actions; this function never evaluates page-supplied code."""
function mystery_c5_case_action(msg::AbstractDict)
    version = get(msg, "contract_version", nothing)
    version isa Integer && !(version isa Bool) && version == 1 ||
        return _mystery_c5_error("C5 case_action requires contract_version 1.")
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID || return _mystery_c5_error("C5 case_action requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C5_CHAPTER || return _mystery_c5_error("C5 case_action requires chapter C5.")
    get(msg, "move_id", nothing) == MYSTERY_C5_ACTION_MOVE || return _mystery_c5_error("C5 case_action requires move_id card-draw-demo.")
    get(msg, "mode", nothing) == "demonstration" || return _mystery_c5_error("C5 case_action requires demonstration mode.")
    get(msg, "activity_id", nothing) == MYSTERY_C5_ACTION_ACTIVITY || return _mystery_c5_error("C5 case_action requires activity_id card-round.")
    get(msg, "simulation_id", nothing) === nothing || return _mystery_c5_error("C5 case_action simulation_id must be null.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c5_valid_request_id(request_id) || return _mystery_c5_error("C5 case_action requires a non-empty string request_id.")
    action = get(msg, "action", nothing)
    action isa AbstractString && String(action) in MYSTERY_C5_ACTIONS || return _mystery_c5_error("C5 case_action allows draw-six, replay-100, or replay-1000 only.")
    action = String(action)
    if action == "draw-six"
        rng = Random.MersenneTwister(5105)
        draws = [is_teal ? "teal" : "orange" for is_teal in rand(rng, Bool, MYSTERY_C5_N_JARS)]
        return _mystery_c5_action_result(request_id=String(request_id), action=action, status="ok",
            message="Fixed six-card demonstration: every draw is recorded, replaced, and shuffled before the next.",
            generated_code="draws = rand(MersenneTwister(5105), Bool, 6)",
            result_data=Dict("kind" => "card-draws", "draws" => draws), simulation_id="c5-card-round-v1")
    end
    n_trials = action == "replay-100" ? 100 : 1000
    seed = action == "replay-100" ? 5106 : 5108
    counts = mystery_c5_sim_counts(; n_trials=n_trials, seed=seed)
    return _mystery_c5_action_result(request_id=String(request_id), action=action, status="ok",
        message="Fixed non-credit replay: a new bounded simulation can differ through Monte Carlo variation.",
        generated_code="rng = MersenneTwister($(seed)); counts = [sum(rand(rng, Bool, 6)) for _ in 1:$(n_trials)]",
        result_data=Dict("kind" => "simulation-counts", "counts" => counts, "n_trials" => n_trials,
                         "n_jars" => MYSTERY_C5_N_JARS, "p_ref" => MYSTERY_C5_P_REF),
        simulation_id="c5-$(action)-v1")
end

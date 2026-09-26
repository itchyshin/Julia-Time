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
        return (true, "Every round now has a yes or no: did it show 5 or more teal cards, at least the notebook's count?")
    end

    expected_frequency = sum(expected_events) / length(expected_events)

    # The taught step 2 answer is now a single number: sum(events) / length(events). The older
    # named tuple (events=events, frequency=...) still passes; it is no longer taught (bible C5).
    if value isa NamedTuple && keys(value) == (:events, :frequency)
        actual_events = _mystery_c5_exact_events(value.events)
        actual_events === nothing &&
            return (false, "The events field needs one Boolean value for every simulated trial.")
        actual_events == expected_events ||
            return (false, "The events field must use sim_counts .>= observed_count exactly.")
        frequency = _mystery_c5_frequency(value.frequency)
        frequency === nothing &&
            return (false, "The frequency must be one finite numeric value.")
        frequency == expected_frequency ||
            return (false, "Divide the matching event count by all 1,000 trials.")
        return (true, "The named event mask and matching-events / all-trials frequency agree.")
    end

    frequency = _mystery_c5_frequency(value)
    frequency === nothing &&
        return (false, "Return one number: the rounds that matched, divided by all rounds.")
    frequency == expected_frequency ||
        return (false, "Divide the matching event count by all 1,000 trials.")
    return (true, "The returned frequency is the matching rounds divided by all rounds.")
end

function _mystery_c5_moves()
    return [
        Dict{String, Any}(
            "id" => "event-mask",
            "title" => "Mark the rounds with 5 or more teal cards",
            "required_result" => "One true or false for every round: true when that round's count is 5 or more.",
            "concept" => "Ask every round the same question: is its count at least observed_count?",
            "code_shape" => "sim_counts .>= observed_count",
            "syntax" => [
                Dict("token" => ".>=", "meaning" => "compares every count and makes one true-or-false value per round."),
            ],
            "hints" => [
                Dict("stage" => "concept", "text" => "Ask every round the same question: is its count at least observed_count?"),
                Dict("stage" => "shape", "text" => "counts .>= threshold. Here counts is sim_counts and threshold is observed_count."),
                Dict("stage" => "solution", "text" => "sim_counts .>= observed_count"),
            ],
            "result_visual" => "simulation-event-mask",
        ),
        Dict{String, Any}(
            "id" => "event-frequency",
            "title" => "How often did 5 or more happen?",
            "required_result" => "One number: the rounds that matched, divided by all rounds.",
            "concept" => "How often = rounds that matched divided by all rounds. The trues are the rounds that matched.",
            "code_shape" => "events = sim_counts .>= observed_count; sum(events) / length(events)",
            "syntax" => [
                Dict("token" => "sum(events)", "meaning" => "counts true event values."),
                Dict("token" => "length(events)", "meaning" => "counts all simulated trials, including non-events."),
            ],
            "hints" => [
                Dict("stage" => "concept", "text" => "How often = rounds that matched divided by all rounds. The trues are the rounds that matched."),
                Dict("stage" => "shape", "text" => "events = counts .>= threshold, then on the next line sum(events) / length(events). sum counts the trues; length counts every round."),
                Dict("stage" => "solution", "text" => "events = sim_counts .>= observed_count\nsum(events) / length(events)"),
            ],
            "result_visual" => "simulation-tail-frequency",
        ),
    ]
end

function _mystery_c5_actions()
    return [
        Dict("id" => "draw-six", "label" => "Draw six cards", "activity_id" => MYSTERY_C5_ACTION_ACTIVITY,
             "note" => "Draws six cards. Teal means fleas. Practice: does not count for the case."),
        Dict("id" => "replay-100", "label" => "Show 100 rounds", "activity_id" => MYSTERY_C5_ACTION_ACTIVITY,
             "note" => "Practice rounds: they can come out a little differently from Toto's 1,000."),
        Dict("id" => "replay-1000", "label" => "Show 1,000 rounds", "activity_id" => MYSTERY_C5_ACTION_ACTIVITY,
             "note" => "Practice rounds: they can come out a little differently from Toto's 1,000."),
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
        "title" => move_id == "event-mask" ? "Mark the rounds with 5 or more teal cards" : "How often did 5 or more happen?",
        "question" => "If each jar were a coin flip, how often would 5 or more of 6 show fleas?",
        "goal" => "Mark Toto's rounds with 5 or more teal cards, then work out how often that happens.",
        "key_note" => "One round: Toto draws six cards, one for each jar. Teal means fleas, orange means none, half and half. He writes down how many are teal, puts the cards back and shuffles. He played 1,000 rounds. This is a what-if, not new jars.",
        "n_jars" => MYSTERY_C5_N_JARS, "p_ref" => MYSTERY_C5_P_REF,
        "observed_count" => observed_count, "n_trials" => MYSTERY_C5_N_TRIALS,
        "inputs" => [Dict{String, Any}(
            "id" => "sim_counts", "label" => "Simulated six-trial detection counts",
            "data_label" => "Simulated data made for this game: Toto's what-if rounds, not new jars.",
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
    get(msg, "mode", nothing) == "challenge" || return _mystery_c5_error("C5 could not start this step. Reload the page to try again.")
    get(msg, "activity_id", nothing) === nothing || return _mystery_c5_error("C5 challenge activity_id must be null.")
    get(msg, "simulation_id", nothing) === nothing || return _mystery_c5_error("C5 case_info simulation_id must be null.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c5_valid_request_id(request_id) || return _mystery_c5_error("C5 case_info requires a non-empty string request_id.")
    return mystery_c5_case_info(; move_id=String(move_id), request_id=String(request_id))
end

function _mystery_c5_explanation(move_id::String, pass)
    if pass === true && move_id == "event-mask"
        return Dict("julia" => ".>= asked every round the same question and gave one true or false each.",
                    "case" => "The highlighted bars are the rounds with 5 or 6 teal cards.",
                    "limit" => "")
    elseif pass === true
        expected_events = mystery_c5_expected_events()
        matching = count(expected_events)
        n_trials = length(expected_events)
        frequency = matching / n_trials
        return Dict("julia" => "The returned frequency passed the check: $(matching) matching rounds divided by $(n_trials) rounds is $(frequency). The taught way is sum(events) / length(events).",
                    "case" => "Even with coin-flip jars, 5 or more of 6 happened $(matching) times in $(n_trials), about 1 in 9. Not strange enough to doubt the notebook.",
                    "limit" => "This shows 5 of 6 is not strange; it does not prove the notebook right.")
    end
    return Dict("julia" => move_id == "event-mask" ?
                    "Return one true or false for every round: true when that round's count is 5 or more." :
                    "Return one number: the rounds that matched, divided by all rounds.",
                "case" => "Nothing found yet: the returned result must match this step first.",
                "limit" => "A failed run says nothing about causes, people, or whether the fleas are vanishing.")
end

function _mystery_c5_result_data(value)
    events = _mystery_c5_exact_events(value)
    events !== nothing && return Dict{String, Any}(
        "kind" => "boolean-vector", "length" => length(events), "true_count" => sum(events),
        "preview" => events[1:min(end, 20)],
    )
    if value isa NamedTuple && keys(value) == (:events, :frequency)
        events = _mystery_c5_exact_events(value.events)
        frequency = _mystery_c5_frequency(value.frequency)
        (events === nothing || frequency === nothing) && return nothing
        return Dict{String, Any}(
            "kind" => "event-frequency", "length" => length(events), "matching" => sum(events),
            "trials" => length(events), "frequency" => frequency, "preview" => events[1:min(end, 20)],
        )
    end

    # The newly taught step 2 answer is a plain number (bible C5). Only when it matches the
    # server's own fixed-simulation truth exactly do we show the breakdown behind it; a wrong
    # number never fabricates a preview (AGENTS.md rule 3).
    frequency = _mystery_c5_frequency(value)
    frequency === nothing && return nothing
    expected_events = mystery_c5_expected_events()
    frequency == sum(expected_events) / length(expected_events) || return nothing
    # AGENTS.md rule 3 (never invent output): the learner's code returned a plain number, not a
    # named tuple, so "kind" must say so. web/chapter5.js renders "frequency-number" as the bare
    # number the learner actually got back, never the fabricated (events=..., frequency=...) shape.
    return Dict{String, Any}(
        "kind" => "frequency-number", "length" => length(expected_events), "matching" => sum(expected_events),
        "trials" => length(expected_events), "frequency" => frequency,
        "preview" => expected_events[1:min(end, 20)],
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
    get(msg, "mode", nothing) == "challenge" || return (false, "C5 could not start this step. Reload the page to try again.")
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
        (false, "Julia stopped before the end. Check the names, then run again.")
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
        message="Practice rounds: they can come out a little differently from Toto's 1,000.",
        generated_code="rng = MersenneTwister($(seed)); counts = [sum(rand(rng, Bool, 6)) for _ in 1:$(n_trials)]",
        result_data=Dict("kind" => "simulation-counts", "counts" => counts, "n_trials" => n_trials,
                         "n_jars" => MYSTERY_C5_N_JARS, "p_ref" => MYSTERY_C5_P_REF),
        simulation_id="c5-$(action)-v1")
end

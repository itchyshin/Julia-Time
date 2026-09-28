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
# Round 3 (r3-struggling.md item 1): two step 2 mistakes run and return a number, so they used to
# get only the page's general line. sum(events) alone is the count of matching rounds; length(events)
# counts every round. Read from the returned value (and, for 1.0, the code), only after a failed run.
function _mystery_c5_coaching(value, code)
    frequency = _mystery_c5_frequency(value)
    frequency === nothing && return ""
    expected_events = mystery_c5_expected_events()
    matching = sum(expected_events)
    n_trials = length(expected_events)
    frequency == matching &&
        return "$(matching) is how many rounds matched. Divide that number by all rounds to get how often 5 or more happened."
    lead = "length counts every round; sum counts the matches."
    frequency == n_trials && return "That is every round, not only the ones that matched: " * lead
    if frequency == 1.0 && matching != n_trials
        # Round 4 (r4-bugs.md item 7): judge the returned expression, the last statement, not
        # the whole program; a sum(events) on an earlier line does not count the trues here.
        statements = code isa AbstractString ? _mystery_statements(code) : nothing
        (statements === nothing || isempty(statements)) && return ""
        returned = last(statements)
        returned isa Expr && returned.head == :(=) && (returned = returned.args[2])
        uses_length = _mystery_any_node(node -> _mystery_calls(node, (:length,)), returned)
        counts_trues = _mystery_any_node(node -> _mystery_calls(node, (:sum, :count, :mean)), returned)
        uses_length && !counts_trues &&
            return "Your line divides every round by every round, so it always gives 1.0: " * lead
        _mystery_calls(returned, (:/,)) && length(returned.args) == 3 && returned.args[2] == returned.args[3] &&
            return "Your line divides a number by itself, so it always gives 1.0: " * lead
    end
    return ""
end

# True when the code divides by all rounds: a / or // with length(...), nrow(...), size(...),
# 1000 (also written 1_000) or n_trials, or a mean(...), which divides by the length itself.
function _mystery_c5_divides_by_all(code)
    parsed = _mystery_parsed_quietly(code)
    parsed === nothing && return false
    all_rounds(node) = _mystery_any_node(n -> _mystery_calls(n, (:length, :nrow, :size)) ||
        n === MYSTERY_C5_N_TRIALS || n === :n_trials, node)
    return _mystery_any_node(parsed) do node
        _mystery_calls(node, (:mean,)) ||
            _mystery_calls(node, (:/, :.//, ://, :./)) && length(node.args) == 3 && all_rounds(node.args[3])
    end
end

# Round 7 (r7-r-struggling.md, runner-up): mean(...) in step 1 is step 2's answer, one step early.
# Round 8 (r8-audit.md item 10): step 1 returns the true/false rule itself, so positions are not the answer.
const MYSTERY_C5_WHICH_TAIL = "Here the step needs the true/false rule itself, not positions."
const MYSTERY_C5_STEP1_MEAN_LINE = "That is step 2's idea (how often). Step 1 only marks each round true or false."

# Round 4 (r4-python.md C5): praise only what the code did.
function _mystery_c5_uses_dotted_ge(code)
    parsed = _mystery_parsed_quietly(code)
    parsed === nothing && return false
    return _mystery_any_node(parsed) do node
        # Round 5 (r5-bugs.md item 8): .≥ is the same operator as .>=, typed as one character.
        _mystery_calls(node, (:.>=, :.≥)) ||
            node isa Expr && node.head == :comparison && (:.>= in node.args || :.≥ in node.args)
    end
end

function check_mystery_c5(value, move_id; code=nothing)
    move_id isa AbstractString && String(move_id) in MYSTERY_C5_MOVES ||
        return (false, "Choose the C5 move: event-mask or event-frequency.")
    expected_events = mystery_c5_expected_events()
    if String(move_id) == "event-mask"
        actual_events = _mystery_c5_exact_events(value)
        actual_events === nothing &&
            return (false, "Return one true-or-false event value for each of the 1,000 rounds.")
        actual_events == expected_events ||
            return (false, "Check the direction: a round counts when its count is at least the observed count.")
        return (true, "Every round now has a yes or no: did it show 5 or more teal cards, at least the notebook's count?")
    end

    expected_frequency = sum(expected_events) / length(expected_events)

    # The taught step 2 answer is now a single number: sum(events) / length(events). The older
    # named tuple (events=events, frequency=...) still passes; it is no longer taught (bible C5).
    if value isa NamedTuple && keys(value) == (:events, :frequency)
        actual_events = _mystery_c5_exact_events(value.events)
        actual_events === nothing &&
            return (false, "events needs one true-or-false value for every round.")
        actual_events == expected_events ||
            return (false, "events must use sim_counts .>= observed_count exactly.")
        frequency = _mystery_c5_frequency(value.frequency)
        frequency === nothing &&
            return (false, "The frequency must be one number.")
        frequency == expected_frequency ||
            return (false, "Divide the rounds that matched by all 1,000 rounds.")
        return (true, "The named events and the frequency (rounds that matched divided by all rounds) agree.")
    end

    frequency = _mystery_c5_frequency(value)
    frequency === nothing &&
        return (false, "Return one number: the rounds that matched, divided by all rounds.")
    if frequency != expected_frequency
        coaching = _mystery_c5_coaching(value, code)
        isempty(coaching) || return (false, coaching)
    end
    # Round 1 (2026-09-27): a whole number of rounds out of 1,000 means the division was right and
    # the rounds counted were not (for example .> instead of .>=).
    # Round 7 (r7-bugs.md item 1): a plain 1, 0 or 0.5 is also a whole number of rounds, so the claim
    # "you divided by all 1,000 rounds" needs a division by all rounds in the code itself.
    rounds = frequency * MYSTERY_C5_N_TRIALS
    if frequency != expected_frequency && isapprox(rounds, round(rounds); atol=1e-9) &&
       0 <= rounds <= MYSTERY_C5_N_TRIALS && _mystery_c5_divides_by_all(code)
        return (false, "You divided by all 1,000 rounds, but counted the wrong rounds. A round counts when its count is at least observed_count" *
            (_mystery_c5_uses_dotted_ge(code) ? "." : ": use .>= to mark them."))
    end
    frequency == expected_frequency ||
        return (false, "Divide the rounds that matched by all 1,000 rounds.")
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
                Dict("token" => "length(events)", "meaning" => "counts every round, including the ones that did not match."),
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
             "note" => "Draws six cards. Teal means springtails. Practice: does not count for the case."),
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
        "question" => "Before we use what we know about the jars, what would a plain 50:50 guess give? If each jar had an even chance of springtails, how often would 5 or more of 6 show them?",
        "goal" => "Mark Toto's rounds with 5 or more teal cards, then work out how often that happens.",
        "key_note" => "One round: Toto draws six cards, one for each jar. Teal means springtails and orange means none. Half the cards are teal. He writes down how many are teal, puts the cards back and shuffles. He played 1,000 rounds. This is a what-if, not new jars.",
        "n_jars" => MYSTERY_C5_N_JARS, "p_ref" => MYSTERY_C5_P_REF,
        "observed_count" => observed_count, "n_trials" => MYSTERY_C5_N_TRIALS,
        "inputs" => [Dict{String, Any}(
            "id" => "sim_counts", "label" => "Teal cards in each of Toto's 1,000 rounds",
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

# Every other screen writes 1,000 with a comma (r1-audit F9).
_mystery_c5_thousands(n::Integer) = replace(string(n), r"(?<=\d)(?=(\d{3})+$)" => ",")

const MYSTERY_C5_TAUGHT = "sum(events) / length(events)"

function _mystery_c5_explanation(move_id::String, pass; code=nothing, value=nothing)
    if pass === true && move_id == "event-mask"
        return Dict("julia" => _mystery_c5_uses_dotted_ge(code) ?
                        ".>= asked every round the same question and gave one true or false each." :
                        "Your marks are right: one true or false for every round.",
                    "case" => "The marked rounds are the ones where plain chance did as well as the notebook. Now count them: how often did that happen?",
                    "limit" => "")
    elseif pass === true
        expected_events = mystery_c5_expected_events()
        matching = count(expected_events)
        n_trials = length(expected_events)
        frequency = matching / n_trials
        n_text = _mystery_c5_thousands(n_trials)
        # Round 4 (r4-python.md C5; AGENTS.md rule 3): sum(events) // length(events) returns the
        # fraction 113//1000, not 0.113; say what Julia really returned when it is not that number.
        # Round 7 (r7-bugs.md item 4): for the older (events=..., frequency=...) pair, only the
        # frequency field is the same value; the whole pair is not.
        pair = value isa NamedTuple && keys(value) == (:events, :frequency)
        returned = value === nothing ? "" : _mystery_c5_show(pair ? value.frequency : value)
        returned_note = isempty(returned) || returned == string(frequency) ? "" : pair ?
            "Your frequency field is $(returned), the same value written another way. " :
            "Julia returned $(returned), the same value written another way. "
        return Dict("julia" => "Your frequency is right: $(matching) matching rounds divided by $(n_text) rounds is $(frequency). " *
                    returned_note *
                    (_mystery_used_taught(code, MYSTERY_C5_TAUGHT) ?
                        "You used the way this game teaches: sum counts the trues, and length counts every round." :
                        "The way this game teaches is sum(events) / length(events)."),
                    "case" => "$(matching) rounds in $(n_text), about 1 time in 9. Under a plain 50:50 guess, 5 or more of 6 comes up that often, so 5 of 6 is not unusual. Healthy jars would usually do better than 50:50, so this was only a starting guess. The recheck is still the real test of the notebook. Part 2 done for today. Next, test the report's own guess: dying out.",
                    "limit" => "This shows 5 of 6 is not unusual under a plain 50:50 guess; it does not prove the notebook right.")
    end
    return Dict("julia" => move_id == "event-mask" ?
                    "Return one true or false for every round: true when that round's count is 5 or more." :
                    "Return one number: the rounds that matched, divided by all rounds.",
                "case" => "Not yet: the returned result must match this step first.",
                "limit" => "A failed run says nothing about causes, people, or whether the springtails are dying out.")
end

# Round 7 (r7-bugs.md items 4 and 5): Julia's own one-line display of a returned value, as the
# REPL's show gives it with a limited width (Bool[0, 0, 1, 1, 0, 0, 0, 0, 0, 0  …  0, 1, 0],
# 113//1000), so the page can show exactly what Julia returned instead of building its own form.
_mystery_c5_show(value) = try
    sprint(show, value; context=:limit=>true)
catch
    "<unprintable $(typeof(value))>"
end

function _mystery_c5_result_data(value)
    events = _mystery_c5_exact_events(value)
    events !== nothing && return Dict{String, Any}(
        "kind" => "boolean-vector", "length" => length(events), "true_count" => sum(events),
        "preview" => events[1:min(end, 20)], "returned" => _mystery_c5_show(value),
    )
    if value isa NamedTuple && keys(value) == (:events, :frequency)
        events = _mystery_c5_exact_events(value.events)
        frequency = _mystery_c5_frequency(value.frequency)
        (events === nothing || frequency === nothing) && return nothing
        return Dict{String, Any}(
            "kind" => "event-frequency", "length" => length(events), "matching" => sum(events),
            "trials" => length(events), "frequency" => frequency, "preview" => events[1:min(end, 20)],
            "returned" => _mystery_c5_show(value), "frequency_returned" => _mystery_c5_show(value.frequency),
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
    # "returned" is Julia's own display of the value (113//1000 for a fraction), for the page to
    # show under "Julia returned" instead of the converted number.
    return Dict{String, Any}(
        "kind" => "frequency-number", "length" => length(expected_events), "matching" => sum(expected_events),
        "trials" => length(expected_events), "frequency" => frequency, "returned" => _mystery_safe_repr(value),
        "preview" => expected_events[1:min(end, 20)],
    )
end

function _mystery_c5_result(; request_id::String="", move_id::String="event-mask",
                            status::String="error", pass=false, message::String="", stdout::String="",
                            value_repr::String="", result_data=nothing, code=nothing, value=nothing)
    return Dict{String, Any}(
        "type" => "case_result", "contract_version" => 1, "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C5_CHAPTER, "move_id" => move_id, "mode" => "challenge",
        "activity_id" => nothing, "simulation_id" => MYSTERY_C5_SIMULATION_ID,
        "request_id" => request_id, "status" => status, "pass" => pass,
        "practice_pass" => nothing, "progress_eligible" => status == "ok" && pass === true,
        "message" => message, "stdout" => stdout, "value_repr" => value_repr,
        "columns" => String[], "rows" => Any[], "result_data" => result_data,
        "feedback" => pass === true ? "Your result matches the checker's own run of the same simulation." :
                      "Keep the supplied inputs unchanged, check which rounds you counted and what you divided by, then run again.",
        "explanation" => _mystery_c5_explanation(move_id, pass; code=code, value=value),
        "result_visual" => pass === true && result_data !== nothing ?
            Dict("type" => move_id == "event-mask" ? "simulation-event-mask" : "simulation-tail-frequency",
                 "data" => result_data) : nothing,
    )
end

function _mystery_c5_guarded_code(code::String)
    # The generic sandbox guard catches changed final values; this identity guard additionally
    # rejects rebinding `sim_counts` to an equal copy, while still allowing a separate `events` result.
    return _mystery_guarded_code(code, "__juliatime_c5_answer__";
        before=["__juliatime_c5_counts_identity__ = objectid(sim_counts)"],
        after=["objectid(sim_counts) == __juliatime_c5_counts_identity__ || error(\"The supplied sim_counts values were changed. Keep the inputs unchanged and create a separate result.\")"])
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
    checked, feedback = sandbox_result.status == :ok ? check_mystery_c5(sandbox_result.value, move_id; code=String(code)) :
        (false, _mystery_stopped_feedback(sandbox_result.status))
    result = _mystery_c5_result(request_id=request_id, move_id=move_id, status=String(sandbox_result.status),
                                pass=checked, message=sandbox_result.message, stdout=sandbox_result.stdout,
                                value_repr=value_repr, result_data=_mystery_c5_result_data(sandbox_result.value),
                                code=String(code), value=sandbox_result.value)
    # A line naming the mistake, sent on its own so the page can lead with it; "" when there is none.
    # R's <- and Python habits come first: they are named on any failed run, as in C2.
    coaching = checked ? "" : _mystery_coaching(String(code); message=sandbox_result.message,
        way=".>= marks every round at once, and sum counts the trues.",
        which_tail=move_id == "event-mask" ? MYSTERY_C5_WHICH_TAIL : "")
    if isempty(coaching) && !checked && sandbox_result.status == :ok && move_id == "event-frequency"
        coaching = _mystery_c5_coaching(sandbox_result.value, String(code))
    elseif isempty(coaching) && !checked && sandbox_result.status == :ok && move_id == "event-mask" &&
           _mystery_c5_frequency(sandbox_result.value) !== nothing && _mystery_c5_divides_by_all(String(code))
        coaching = MYSTERY_C5_STEP1_MEAN_LINE
    end
    isempty(coaching) || (feedback = coaching)
    result["feedback"] = feedback
    result["coaching"] = coaching
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

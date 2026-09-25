# Missing Fleas, chapter 3: compare two independently constructed tray records.  The learner's
# tables are deliberately fresh copies; the checker rebuilds separate expected tables so a
# browser-visible DataFrame, a sandbox mutation, or a prior run can never become checker truth.

const MYSTERY_C3_CHAPTER = "C3"
const MYSTERY_C3_MOVES = ("join-report-log", "filter-disagreement")
const MYSTERY_C3_PRACTICE_ACTIVITY = "practice-join-v1"
const MYSTERY_C3_JOIN_COLUMNS = [
    "tray_id", "reported_detected_n", "logged_detected_n", "log_status",
]
const MYSTERY_C3_REPORT_COLUMNS = ["tray_id", "reported_detected_n"]
const MYSTERY_C3_LOG_COLUMNS = ["tray_id", "logged_detected_n", "log_status"]
const MYSTERY_C3_PRACTICE_JOIN_COLUMNS = [
    "key", "reported_detected_n", "logged_detected_n", "log_status",
]

"""
    mystery_c3_report() -> DataFrame

Build a fresh tray summary from the seeded B09 teaching fixture.  It is intentionally separate
from both the handling log and the checker constructors below.
"""
function mystery_c3_report()
    b09 = filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars())
    report = combine(groupby(b09, :tray_id), :detected => sum => :reported_detected_n)
    return sort(report, :tray_id)
end

"""
    mystery_c3_handling_log() -> DataFrame

Return a fresh, separately simulated handling log.  Its fixed `not entered` zero represents a
recording disagreement in this teaching fixture; it does not assert a biological cause or blame
any person.
"""
function mystery_c3_handling_log()
    return DataFrame(
        tray_id = ["T-A", "T-B", "T-C"],
        logged_detected_n = [2, 2, 0],
        log_status = ["entered", "entered", "not entered"],
    )
end

"""Build a fresh learner-visible joined input for C3's second move."""
function mystery_c3_joined()
    return leftjoin(mystery_c3_report(), mystery_c3_handling_log(), on=:tray_id)
end

"""Build checker truth for the C3 join independently from learner-visible inputs."""
function mystery_c3_expected_join()
    expected_report = mystery_c3_report()
    expected_log = mystery_c3_handling_log()
    return leftjoin(expected_report, expected_log, on=:tray_id)
end

"""Build the checker-only expected C3 recording disagreement independently."""
function mystery_c3_expected_discrepancy()
    expected_join = mystery_c3_expected_join()
    return expected_join[
        expected_join.reported_detected_n .!= expected_join.logged_detected_n,
        :,
    ]
end

"""Fresh practice-only report for the C3 action-to-code demonstration."""
function mystery_c3_practice_report()
    return DataFrame(key=["K-A", "K-B"], reported_detected_n=[2, 1])
end

"""Fresh practice-only handling log; its keys never occur in the Missing Fleas case."""
function mystery_c3_practice_log()
    return DataFrame(
        key=["K-A", "K-B"],
        logged_detected_n=[2, 0],
        log_status=["entered", "not entered"],
    )
end

"""Checker truth for the practice join, built independently from practice inputs."""
function mystery_c3_practice_expected_join()
    expected_report = mystery_c3_practice_report()
    expected_log = mystery_c3_practice_log()
    return leftjoin(expected_report, expected_log, on=:key)
end

function _mystery_c3_wire_value(value)
    if value isa Real && !(value isa Bool) && isfinite(value)
        wire = try
            Float64(value)
        catch
            nothing
        end
        wire isa Float64 && isfinite(wire) && return wire
    end
    return _mystery_wire_value(value)
end

function _mystery_c3_rows(df::DataFrames.DataFrame)
    columns = _mystery_columns(df)
    return [Dict{String, Any}(column => _mystery_c3_wire_value(df[row, column])
                              for column in columns)
            for row in 1:DataFrames.nrow(df)]
end

function _mystery_c3_columns(value, required)
    value isa DataFrames.DataFrame || return false
    actual = _mystery_columns(value)
    return length(actual) == length(required) && all(column -> column in actual, required)
end

function _mystery_c3_count_equal(actual, expected)
    actual isa Real && !(actual isa Bool) || return false
    isfinite(actual) || return false
    return actual == expected
end

function _mystery_c3_row_matches(actual::DataFrames.DataFrame, actual_row::Int,
                                  expected::DataFrames.DataFrame, expected_row::Int)
    actual[actual_row, "tray_id"] isa AbstractString || return false
    actual[actual_row, "log_status"] isa AbstractString || return false
    return String(actual[actual_row, "tray_id"]) == expected[expected_row, "tray_id"] &&
           _mystery_c3_count_equal(actual[actual_row, "reported_detected_n"],
                                   expected[expected_row, "reported_detected_n"]) &&
           _mystery_c3_count_equal(actual[actual_row, "logged_detected_n"],
                                   expected[expected_row, "logged_detected_n"]) &&
           String(actual[actual_row, "log_status"]) == expected[expected_row, "log_status"]
end

function _mystery_c3_check_exact_rows(value, expected, move_id::String)
    _mystery_c3_columns(value, MYSTERY_C3_JOIN_COLUMNS) ||
        return (false, "Return exactly these columns: $(join(MYSTERY_C3_JOIN_COLUMNS, ", ")).")
    DataFrames.nrow(value) == DataFrames.nrow(expected) ||
        return (false, move_id == "join-report-log" ?
            "Return one row for every report tray exactly once." :
            "Return exactly the one row where the two recorded counts differ.")

    matched = falses(DataFrames.nrow(expected))
    for actual_row in 1:DataFrames.nrow(value)
        expected_row = findfirst(1:DataFrames.nrow(expected)) do candidate
            !matched[candidate] && _mystery_c3_row_matches(value, actual_row, expected, candidate)
        end
        expected_row === nothing && return (false, move_id == "join-report-log" ?
            "Check each tray_id: keep every report row once and keep its matched log values unchanged." :
            "Check the .!= row rule and return only the recorded row where the two counts differ.")
        matched[expected_row] = true
    end
    all(matched) || return (false, "At least one required tray row is missing.")
    return (true, move_id == "join-report-log" ?
        "Every report tray is matched to one handling-log row with unchanged recorded values." :
        "The returned row is exactly the one recording disagreement in this teaching fixture.")
end

"""
    check_mystery_c3(value, move_id) -> (pass, feedback)

Accept equivalent `DataFrame` results despite row or column order.  The join checker preserves
the one-to-one key relationship; the disagreement checker then requires the independently
constructed single differing row.
"""
function check_mystery_c3(value, move_id)
    move_id isa AbstractString && String(move_id) in MYSTERY_C3_MOVES ||
        return (false, "Choose the C3 move: join-report-log or filter-disagreement.")
    resolved_move = String(move_id)
    expected = resolved_move == "join-report-log" ?
        mystery_c3_expected_join() : mystery_c3_expected_discrepancy()
    return _mystery_c3_check_exact_rows(value, expected, resolved_move)
end

function _mystery_c3_practice_row_matches(actual::DataFrames.DataFrame, actual_row::Int,
                                           expected::DataFrames.DataFrame, expected_row::Int)
    actual[actual_row, "key"] isa AbstractString || return false
    actual[actual_row, "log_status"] isa AbstractString || return false
    return String(actual[actual_row, "key"]) == expected[expected_row, "key"] &&
           _mystery_c3_count_equal(actual[actual_row, "reported_detected_n"],
                                   expected[expected_row, "reported_detected_n"]) &&
           _mystery_c3_count_equal(actual[actual_row, "logged_detected_n"],
                                   expected[expected_row, "logged_detected_n"]) &&
           String(actual[actual_row, "log_status"]) == expected[expected_row, "log_status"]
end

"""Check the separate demonstration join without making it eligible for case progress."""
function check_mystery_c3_practice_join(value)
    _mystery_c3_columns(value, MYSTERY_C3_PRACTICE_JOIN_COLUMNS) ||
        return (false, "Return the practice key and its matched recorded columns.")
    expected = mystery_c3_practice_expected_join()
    DataFrames.nrow(value) == DataFrames.nrow(expected) ||
        return (false, "Return one matched row for each practice key.")
    matched = falses(DataFrames.nrow(expected))
    for actual_row in 1:DataFrames.nrow(value)
        expected_row = findfirst(1:DataFrames.nrow(expected)) do candidate
            !matched[candidate] && _mystery_c3_practice_row_matches(value, actual_row, expected, candidate)
        end
        expected_row === nothing &&
            return (false, "Check the practice key and keep the matched log values unchanged.")
        matched[expected_row] = true
    end
    return all(matched) ?
        (true, "Julia joined the separate K-A/K-B practice tables. This practice result adds no case evidence.") :
        (false, "At least one practice key is missing.")
end

function _mystery_c3_moves()
    return [
        Dict{String, Any}(
            "id" => "join-report-log",
            "title" => "Match the tray records",
            "required_result" => "One row per report tray with its matching handling-log fields.",
            "concept" => "Match records by a unique key.",
            "code_shape" => "leftjoin(left_table, right_table, on=:shared_column)",
            "syntax" => [
                Dict("token" => "on=", "meaning" => "means join using the named key."),
                Dict("token" => ":tray_id", "meaning" => "means the column named tray_id."),
            ],
            "hints" => [
                Dict("stage" => "concept", "text" => "Match each report row to the log row with the same tray_id."),
                Dict("stage" => "shape", "text" => "Use leftjoin(left_table, right_table, on=:shared_column)."),
                Dict("stage" => "solution", "text" => "leftjoin(report, handling_log, on=:tray_id)"),
            ],
            "demo_id" => "practice-join-v1",
            "result_visual" => "key-alignment",
        ),
        Dict{String, Any}(
            "id" => "filter-disagreement",
            "title" => "Inspect the recording disagreement",
            "required_result" => "Exactly the one joined row where the two recorded counts differ.",
            "concept" => "Use one true-or-false comparison per joined row to keep a discrepancy.",
            "code_shape" => "table[table.left_count .!= table.right_count, :]",
            "syntax" => [
                Dict("token" => ".!=", "meaning" => "compares the two columns row by row and makes true-or-false values."),
                Dict("token" => ":", "meaning" => "keeps all columns in this indexing position."),
            ],
            "hints" => [
                Dict("stage" => "concept", "text" => "Keep a row only where the report count is not equal to the log count."),
                Dict("stage" => "shape", "text" => "Use table[table.left_count .!= table.right_count, :] to keep rows where two columns differ. table, left_count and right_count are placeholders, not names in this case: here table is joined, left_count is reported_detected_n, and right_count is logged_detected_n."),
                Dict("stage" => "solution", "text" => "joined[joined.reported_detected_n .!= joined.logged_detected_n, :]"),
            ],
            "demo_id" => "practice-join-v1",
            "result_visual" => "recording-disagreement",
        ),
    ]
end

function _mystery_c3_input(id::String, label::String, df::DataFrames.DataFrame;
                           data_label::String=MYSTERY_DATA_LABEL)
    return Dict{String, Any}(
        "id" => id,
        "label" => label,
        "data_label" => data_label,
        "columns" => _mystery_columns(df),
        "rows" => _mystery_c3_rows(df),
    )
end

function mystery_c3_case_info(; move_id::String="join-report-log", request_id::String="",
                              mode::String="challenge", activity_id=nothing)
    move_id in MYSTERY_C3_MOVES || throw(ArgumentError("Unknown C3 move."))
    mode in ("challenge", "demonstration") || throw(ArgumentError("Unknown C3 mode."))
    mode == "demonstration" && move_id != "join-report-log" &&
        throw(ArgumentError("The C3 demonstration teaches join-report-log only."))
    mode == "demonstration" && activity_id != MYSTERY_C3_PRACTICE_ACTIVITY &&
        throw(ArgumentError("C3 demonstration activity_id must be practice-join-v1."))
    title, question, goal, key_note = if mode == "demonstration"
        (
            "Practice matching keys",
            "Can each practice key be matched to one practice-log row?",
            "Use the separate K-A/K-B practice tables to rehearse a key-safe join. This practice result adds no Missing Fleas case finding.",
            "key names the same practice row in both tables; every key occurs once in each table.",
        )
    elseif move_id == "join-report-log"
        (
            "Match the tray records",
            "Can each report tray be matched to one handling-log row?",
            "Match the two sheets safely by tray_id. A successful join prepares a comparison; it does not yet identify a disagreement or explain a biological pattern.",
            "tray_id names the same tray in both tables; every tray ID occurs once in each table.",
        )
    else
        (
            "Find the recording disagreement",
            "Which joined tray row has different recorded counts?",
            "Inspect the one recording disagreement without treating it as a biological explanation or a claim about any person.",
            "tray_id identifies the already matched tray in each joined row.",
        )
    end
    inputs = if mode == "demonstration"
        practice_label = "Simulated practice data — separate from the Missing Fleas case."
        [
            _mystery_c3_input("practice_report", "Separate practice tray summary",
                              mystery_c3_practice_report(); data_label=practice_label),
            _mystery_c3_input("practice_log", "Separate practice handling log",
                              mystery_c3_practice_log(); data_label=practice_label),
        ]
    elseif move_id == "join-report-log"
        [
            _mystery_c3_input("report", "Tray summary from Chapter 2", mystery_c3_report()),
            _mystery_c3_input("handling_log", "Simulated handling log", mystery_c3_handling_log()),
        ]
    else
        [_mystery_c3_input("joined", "Fresh joined tray records", mystery_c3_joined())]
    end
    response = Dict{String, Any}(
        "type" => "case",
        "contract_version" => 1,
        "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C3_CHAPTER,
        "move_id" => move_id,
        "request_id" => request_id,
        "title" => title,
        "scene" => Dict(
            "id" => "c3-handling-desk",
            "speaker" => "Eddie",
            "line" => "Before comparing two records, make sure the key really connects the same tray.",
            "image" => "assets/lab-cast.png",
            "alt" => "Itchy, Toto, Momo, and Eddie together in the Missing Fleas teaching lab.",
        ),
        "question" => question,
        "goal" => goal,
        "key_note" => key_note,
        "inputs" => inputs,
        "moves" => _mystery_c3_moves(),
        "mode" => mode,
        "activity_id" => mode == "demonstration" ? MYSTERY_C3_PRACTICE_ACTIVITY : nothing,
        "simulation_id" => nothing,
    )
    return response
end

function _mystery_c3_error(message::String)
    return Dict{String, Any}("type" => "error", "message" => message)
end

function _mystery_c3_valid_request_id(value)
    return value isa AbstractString && !isempty(strip(value))
end

function mystery_c3_case_info(msg::AbstractDict)
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID ||
        return _mystery_c3_error("C3 case_info requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C3_CHAPTER ||
        return _mystery_c3_error("C3 case_info requires chapter C3.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c3_valid_request_id(request_id) ||
        return _mystery_c3_error("C3 case_info requires a non-empty string request_id.")
    (!haskey(msg, "simulation_id") || msg["simulation_id"] === nothing) ||
        return _mystery_c3_error("C3 case_info simulation_id must be null or absent.")
    move_id = if !haskey(msg, "move_id")
        "join-report-log"
    else
        raw_move = msg["move_id"]
        raw_move isa AbstractString && String(raw_move) in MYSTERY_C3_MOVES ||
            return _mystery_c3_error("C3 move_id must be join-report-log or filter-disagreement.")
        String(raw_move)
    end
    mode = if !haskey(msg, "mode")
        "challenge"
    else
        raw_mode = msg["mode"]
        raw_mode isa AbstractString && String(raw_mode) in ("challenge", "demonstration") ||
            return _mystery_c3_error("C3 case_info mode must be challenge or demonstration.")
        String(raw_mode)
    end
    activity_id = get(msg, "activity_id", nothing)
    if mode == "challenge"
        activity_id === nothing ||
            return _mystery_c3_error("C3 challenge case_info activity_id must be null or absent.")
    else
        move_id == "join-report-log" ||
            return _mystery_c3_error("The C3 demonstration teaches join-report-log only.")
        activity_id == MYSTERY_C3_PRACTICE_ACTIVITY ||
            return _mystery_c3_error("C3 demonstration activity_id must be practice-join-v1.")
    end
    return mystery_c3_case_info(; move_id=move_id, request_id=String(request_id),
                                mode=mode, activity_id=activity_id)
end

function _mystery_c3_explanation(move_id::String, pass; mode::String="challenge")
    if mode == "demonstration"
        return Dict(
            "julia" => "The taught way in this practice is leftjoin(practice_report, practice_log, on=:key), which pairs rows from the two practice tables that share a key.",
            "case" => "This result used the separate K-A/K-B practice tables. It adds no Missing Fleas case finding.",
            "limit" => "Practice output does not establish a recording disagreement in the case.",
        )
    end
    if pass && move_id == "join-report-log"
        return Dict(
            "julia" => "The returned table passed the check. The taught way to build it is leftjoin(report, handling_log, on=:tray_id): on= names the join key, and :tray_id names that column.",
            "case" => "In the returned table, each report tray is matched to one handling-log row. This move does not identify a disagreement or explain any biological pattern.",
            "limit" => "A matching key tells us which records were compared; it does not tell us why recorded counts differ.",
        )
    elseif pass
        return Dict(
            "julia" => "The returned row passed the check. The taught way uses .!= to compare the two count columns row by row, then keeps the rows where the answer is true.",
            "case" => "The returned row is a recording disagreement between these simulated teaching records.",
            "limit" => "This does not tell us which record is biologically true, why the records differ, or who entered them.",
        )
    end
    return Dict(
        "julia" => move_id == "join-report-log" ?
            "Return a DataFrame that matches each report tray to its handling-log row by tray_id." :
            "Return the one joined row selected by the .!= comparison.",
        "case" => "No case finding from this chapter is established until the actual returned rows match the stated move.",
        "limit" => "A failed run does not establish a biological cause or a problem with any person.",
    )
end

function _mystery_c3_result_data(display)
    display === nothing && return nothing
    return Dict{String, Any}(
        "kind" => "table",
        "columns" => _mystery_columns(display),
        "rows" => _mystery_c3_rows(display),
    )
end

function _mystery_c3_result_visual(move_id::String, rows, pass)
    pass === true || return nothing
    return Dict{String, Any}(
        "type" => move_id == "join-report-log" ? "key-alignment" : "recording-disagreement",
        "data" => Dict("rows" => rows),
    )
end

function _mystery_c3_result(; request_id::String="", move_id::String="join-report-log",
                            mode::String="challenge", activity_id=nothing,
                            status::String="error", pass=false, message::String="",
                            stdout::String="", rows=Any[], columns=String[], feedback::String="",
                            value_repr::String="", result_data=nothing, practice_pass=nothing)
    return Dict{String, Any}(
        "type" => "case_result",
        "contract_version" => 1,
        "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C3_CHAPTER,
        "move_id" => move_id,
        "mode" => mode,
        "activity_id" => activity_id,
        "simulation_id" => nothing,
        "request_id" => request_id,
        "status" => status,
        "pass" => pass,
        "practice_pass" => mode == "demonstration" ? practice_pass === true : nothing,
        "progress_eligible" => mode == "challenge" && status == "ok" && pass === true,
        "message" => message,
        "stdout" => stdout,
        "value_repr" => value_repr,
        "columns" => columns,
        "rows" => rows,
        "result_data" => result_data,
        "feedback" => feedback,
        "explanation" => _mystery_c3_explanation(move_id, pass; mode=mode),
        "result_visual" => _mystery_c3_result_visual(move_id, rows, pass),
    )
end

function _mystery_c3_guarded_code(code::String, protected_bindings)
    # `run_code`'s generic protected-binding guard correctly catches final data changes, but a
    # rebind to an equal `copy(df)` compares equal to its snapshot.  C3 also remembers each
    # worker-local DataFrame identity around the learner's expression, so that ordinary rebinding
    # is rejected without changing the shared sandbox contract or claiming security against
    # deliberately adversarial code.
    setup = String[]
    checks = String[]
    for binding in protected_bindings
        name = String(binding)
        identity = "__juliatime_c3_$(name)_identity__"
        push!(setup, "$(identity) = objectid($(name))")
        push!(checks, "objectid($(name)) == $(identity) || error(\"The supplied $(name) binding changed. Keep the source table unchanged; create a separate result, then try again.\")")
    end
    return join(setup, "\n") *
           "\n__juliatime_c3_answer__ = begin\n" * code *
           "\nend\n" * join(checks, "\n") *
           "\n__juliatime_c3_answer__"
end

# R7 (simulated re-test, 2026-09-24): a parse error in the wrapped text pointed at wrapper lines
# ("@ none:3") and printed the wrapper itself. Parse the learner's code on its own first and return
# Julia's own ParseError for it, or `nothing` when it parses (or the parser itself fails, in which
# case the guarded run below reports what the worker sees, as before).
# Repair 4: this parse runs in the server process with no time limit, so code longer than 4000
# characters skips it and goes to the guarded worker run, which is time-limited. `parser` lets a
# test stand in for a parser that throws.
function _mystery_c3_parse_error(code::String; parser=Meta.parseall)
    length(code) > 4_000 && return nothing
    parsed = try
        parser(code; filename="none")
    catch
        return nothing
    end
    parsed isa Expr || return nothing
    for arg in parsed.args
        arg isa Expr && arg.head in (:error, :incomplete) && !isempty(arg.args) &&
            arg.args[1] isa Meta.ParseError && return arg.args[1]
    end
    return nothing
end

function _mystery_c3_valid_run_envelope(msg::AbstractDict)
    version = get(msg, "contract_version", nothing)
    version isa Integer && !(version isa Bool) && version == 1 ||
        return (false, "C3 case_run requires contract_version 1.")
    get(msg, "case_id", nothing) == MYSTERY_CASE_ID ||
        return (false, "C3 case_run requires case_id missing-fleas-v1.")
    get(msg, "chapter", nothing) == MYSTERY_C3_CHAPTER ||
        return (false, "C3 case_run requires chapter C3.")
    move_id = get(msg, "move_id", nothing)
    move_id isa AbstractString && String(move_id) in MYSTERY_C3_MOVES ||
        return (false, "C3 move_id must be join-report-log or filter-disagreement.")
    mode = get(msg, "mode", nothing)
    mode isa AbstractString || return (false, "C3 case_run requires a valid mode.")
    (!haskey(msg, "simulation_id") || msg["simulation_id"] === nothing) ||
        return (false, "C3 simulation_id must be null or absent.")
    request_id = get(msg, "request_id", nothing)
    _mystery_c3_valid_request_id(request_id) ||
        return (false, "C3 case_run requires a non-empty string request_id.")
    if mode == "challenge"
        (!haskey(msg, "activity_id") || msg["activity_id"] === nothing) ||
            return (false, "C3 challenge activity_id must be null or absent.")
        return (true, (move_id=String(move_id), mode="challenge", activity_id=nothing))
    elseif mode == "demonstration"
        String(move_id) == "join-report-log" ||
            return (false, "The C3 demonstration teaches join-report-log only.")
        get(msg, "activity_id", nothing) == MYSTERY_C3_PRACTICE_ACTIVITY ||
            return (false, "C3 demonstration activity_id must be practice-join-v1.")
        return (true, (move_id=String(move_id), mode="demonstration",
                       activity_id=MYSTERY_C3_PRACTICE_ACTIVITY))
    end
    return (false, "C3 supports challenge or its named practice demonstration mode.")
end

"""
    mystery_c3_case_run(msg) -> Dict

Run one C3 challenge in a fresh worker fixture.  Each active input is protected against final
mutation or rebinding, and checking regenerates a separate expected fixture after the worker has
returned the learner's actual value.
"""
function mystery_c3_case_run(msg::AbstractDict; on_status::Function=((_, __) -> nothing))
    valid, envelope = _mystery_c3_valid_run_envelope(msg)
    valid || return _mystery_c3_error(envelope)
    move_id = envelope.move_id
    mode = envelope.mode
    activity_id = envelope.activity_id
    request_id = String(msg["request_id"])
    code = get(msg, "code", nothing)
    code isa AbstractString || return _mystery_c3_result(
        request_id=request_id, move_id=move_id, mode=mode, activity_id=activity_id,
        pass=mode == "demonstration" ? nothing : false,
        practice_pass=mode == "demonstration" ? false : nothing,
        message="`code` must be a string.",
        feedback="Type Julia code in the editor before running this move.")
    isempty(strip(code)) && return _mystery_c3_result(
        request_id=request_id, move_id=move_id, mode=mode, activity_id=activity_id,
        pass=mode == "demonstration" ? nothing : false,
        practice_pass=mode == "demonstration" ? false : nothing,
        message="Write some Julia before running the case.",
        feedback="The editor is empty, so no sandbox worker was started.")

    env, protected_bindings = if mode == "demonstration"
        ((practice_report=mystery_c3_practice_report(), practice_log=mystery_c3_practice_log()),
         (:practice_report, :practice_log))
    elseif move_id == "join-report-log"
        ((report=mystery_c3_report(), handling_log=mystery_c3_handling_log()),
         (:report, :handling_log))
    else
        ((joined=mystery_c3_joined(),), (:joined,))
    end
    # A parse error runs none of the learner's code (as with the wrapper) and is formatted exactly as
    # run_code formats every error, so the page shows Julia's own text for the learner's lines.
    parse_error = _mystery_c3_parse_error(String(code))
    sandbox_result = if parse_error === nothing
        lock(_RUN_LOCK) do
            run_code(_mystery_c3_guarded_code(String(code), protected_bindings); env=env, budget=RUN_BUDGET,
                     protected_bindings=protected_bindings, on_status=on_status)
        end
    else
        SandboxResult(:error, nothing, "", _format_error(parse_error))
    end
    display = sandbox_result.value isa DataFrames.DataFrame ? sandbox_result.value : nothing
    columns = display === nothing ? String[] : _mystery_columns(display)
    rows = display === nothing ? Any[] : _mystery_c3_rows(display)
    value_repr = sandbox_result.value === nothing ? "" : _mystery_safe_repr(sandbox_result.value)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    checked, feedback = if sandbox_result.status == :ok && mode == "demonstration"
        check_mystery_c3_practice_join(sandbox_result.value)
    elseif sandbox_result.status == :ok
        check_mystery_c3(sandbox_result.value, move_id)
    else
        (false, "Julia did not complete this move. Keep the supplied input table unchanged, check the named key or comparison, then run again.")
    end
    pass = mode == "demonstration" ? nothing : checked
    practice_pass = mode == "demonstration" ? checked : nothing
    result = _mystery_c3_result(
        request_id=request_id,
        move_id=move_id,
        mode=mode,
        activity_id=activity_id,
        status=String(sandbox_result.status),
        pass=pass,
        message=sandbox_result.message,
        stdout=sandbox_result.stdout,
        rows=rows,
        columns=columns,
        feedback=feedback,
        value_repr=value_repr,
        result_data=_mystery_c3_result_data(display),
        practice_pass=practice_pass,
    )
    if pass === true && move_id == "filter-disagreement"
        result["evidence"] = Dict(
            "id" => "c3-recording-disagreement",
            "title" => "One recording disagreement identified",
            "text" => "The returned row shows one recording disagreement between the simulated tray summary and handling log. It does not tell us which record is biologically true, why the records differ, or who entered them.",
        )
    end
    return result
end

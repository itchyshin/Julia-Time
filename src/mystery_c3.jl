# Missing Fleas, chapter 3: compare two independently constructed tray records.  The learner's
# tables are deliberately fresh copies; the checker rebuilds separate expected tables so a
# browser-visible DataFrame, a sandbox mutation, or a prior run can never become checker truth.

const MYSTERY_C3_CHAPTER = "C3"
const MYSTERY_C3_MOVES = ("join-report-log", "filter-disagreement")
const MYSTERY_C3_PRACTICE_ACTIVITY = "practice-join-v1"
const MYSTERY_C3_JOIN_COLUMNS = [
    "tray_id", "notebook_detected", "sheet_detected", "entry_status",
]
const MYSTERY_C3_TRAY_COUNTS_COLUMNS = ["tray_id", "notebook_detected"]
const MYSTERY_C3_TALLY_SHEET_COLUMNS = ["tray_id", "sheet_detected", "entry_status"]
const MYSTERY_C3_PRACTICE_JOIN_COLUMNS = [
    "key", "notebook_detected", "sheet_detected", "entry_status",
]

"""
    mystery_c3_tray_counts() -> DataFrame

Build a fresh tray summary from the seeded B09 teaching fixture: the notebook's springtails-with-jars
count per tray. It is intentionally separate from both the tally sheet and the checker
constructors below.
"""
function mystery_c3_tray_counts()
    b09 = filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars())
    tray_counts = combine(groupby(b09, :tray_id), :detected => sum => :notebook_detected)
    return sort(tray_counts, :tray_id)
end

"""
    mystery_c3_tally_sheet() -> DataFrame

Return a fresh, separately simulated `tally_sheet`: Toto's typed copy of the tally sheet, the table
his report came from. `sheet_detected` is what Toto typed; `entry_status` says whether the paper box was
filled in. T-C's paper box was left blank and Toto typed a 0 for it; the data show only that, never a
claim about what happened in the jar.
"""
function mystery_c3_tally_sheet()
    return DataFrame(
        tray_id = ["T-A", "T-B", "T-C"],
        sheet_detected = [2, 2, 0],
        entry_status = ["filled in", "filled in", "left blank"],
    )
end

"""Build a fresh learner-visible joined input for C3's second move."""
function mystery_c3_joined()
    return leftjoin(mystery_c3_tray_counts(), mystery_c3_tally_sheet(), on=:tray_id)
end

"""Build checker truth for the C3 join independently from learner-visible inputs."""
function mystery_c3_expected_join()
    expected_tray_counts = mystery_c3_tray_counts()
    expected_tally_sheet = mystery_c3_tally_sheet()
    return leftjoin(expected_tray_counts, expected_tally_sheet, on=:tray_id)
end

"""Build the checker-only expected C3 disagreeing tray independently."""
function mystery_c3_expected_discrepancy()
    expected_join = mystery_c3_expected_join()
    return expected_join[
        expected_join.notebook_detected .!= expected_join.sheet_detected,
        :,
    ]
end

"""Fresh practice-only tray counts for the C3 action-to-code demonstration."""
function mystery_c3_practice_counts()
    return DataFrame(key=["K-A", "K-B"], notebook_detected=[2, 1])
end

"""Fresh practice-only tally sheet; its keys never occur in the Missing Fleas case."""
function mystery_c3_practice_sheet()
    return DataFrame(
        key=["K-A", "K-B"],
        sheet_detected=[2, 0],
        entry_status=["filled in", "left blank"],
    )
end

"""Checker truth for the practice join, built independently from practice inputs."""
function mystery_c3_practice_expected_join()
    expected_counts = mystery_c3_practice_counts()
    expected_sheet = mystery_c3_practice_sheet()
    return leftjoin(expected_counts, expected_sheet, on=:key)
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
    actual[actual_row, "entry_status"] isa AbstractString || return false
    return String(actual[actual_row, "tray_id"]) == expected[expected_row, "tray_id"] &&
           _mystery_c3_count_equal(actual[actual_row, "notebook_detected"],
                                   expected[expected_row, "notebook_detected"]) &&
           _mystery_c3_count_equal(actual[actual_row, "sheet_detected"],
                                   expected[expected_row, "sheet_detected"]) &&
           String(actual[actual_row, "entry_status"]) == expected[expected_row, "entry_status"]
end

function _mystery_c3_check_exact_rows(value, expected, move_id::String)
    _mystery_c3_columns(value, MYSTERY_C3_JOIN_COLUMNS) ||
        return (false, "Return exactly these columns: $(join(MYSTERY_C3_JOIN_COLUMNS, ", ")).")
    DataFrames.nrow(value) == DataFrames.nrow(expected) ||
        return (false, move_id == "join-report-log" ?
            "Return one row for every tray in tray_counts, exactly once." :
            "Return exactly the one row where notebook_detected and sheet_detected differ.")

    matched = falses(DataFrames.nrow(expected))
    for actual_row in 1:DataFrames.nrow(value)
        expected_row = findfirst(1:DataFrames.nrow(expected)) do candidate
            !matched[candidate] && _mystery_c3_row_matches(value, actual_row, expected, candidate)
        end
        expected_row === nothing && return (false, move_id == "join-report-log" ?
            "Check each tray_id: keep every tray_counts row once and keep its matched tally_sheet values unchanged." :
            "Check the .!= row rule and return only the row where notebook_detected and sheet_detected differ.")
        matched[expected_row] = true
    end
    all(matched) || return (false, "At least one tray is not in your result.")
    return (true, move_id == "join-report-log" ?
        "Every tray in tray_counts is matched to one tally_sheet row with unchanged values." :
        "The returned row is exactly the one tray where the notebook and Toto's typed copy disagree.")
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
    actual[actual_row, "entry_status"] isa AbstractString || return false
    return String(actual[actual_row, "key"]) == expected[expected_row, "key"] &&
           _mystery_c3_count_equal(actual[actual_row, "notebook_detected"],
                                   expected[expected_row, "notebook_detected"]) &&
           _mystery_c3_count_equal(actual[actual_row, "sheet_detected"],
                                   expected[expected_row, "sheet_detected"]) &&
           String(actual[actual_row, "entry_status"]) == expected[expected_row, "entry_status"]
end

"""Check the separate demonstration join without making it eligible for case progress."""
function check_mystery_c3_practice_join(value)
    _mystery_c3_columns(value, MYSTERY_C3_PRACTICE_JOIN_COLUMNS) ||
        return (false, "Return the practice key and the matched columns from the practice sheet.")
    expected = mystery_c3_practice_expected_join()
    DataFrames.nrow(value) == DataFrames.nrow(expected) ||
        return (false, "Return one matched row for each practice key.")
    matched = falses(DataFrames.nrow(expected))
    for actual_row in 1:DataFrames.nrow(value)
        expected_row = findfirst(1:DataFrames.nrow(expected)) do candidate
            !matched[candidate] && _mystery_c3_practice_row_matches(value, actual_row, expected, candidate)
        end
        expected_row === nothing &&
            return (false, "Check the practice key and keep the matched practice-sheet values unchanged.")
        matched[expected_row] = true
    end
    return all(matched) ?
        (true, "Julia lined up the K-A/K-B practice tables. Practice: does not count for the case.") :
        (false, "At least one practice key is not in your result.")
end

function _mystery_c3_moves()
    return [
        Dict{String, Any}(
            "id" => "join-report-log",
            "title" => "Put each tray's two records side by side",
            "required_result" => "One row per tray, with its notebook count and the columns from Toto's typed copy.",
            "concept" => "Match each tray in tray_counts with the row for the same tray in tally_sheet.",
            "code_shape" => "leftjoin(left_table, right_table, on=:shared_column)",
            "syntax" => [
                Dict("token" => "on=", "meaning" => "means match using the named label."),
                Dict("token" => ":tray_id", "meaning" => "means the column named tray_id."),
            ],
            "hints" => [
                Dict("stage" => "concept", "text" => "Match each tray in tray_counts with the row for the same tray in tally_sheet."),
                Dict("stage" => "shape", "text" => "Use leftjoin(left_table, right_table, on=:shared_column). The three words are placeholders: use the table names above and :tray_id."),
                Dict("stage" => "solution", "text" => "leftjoin(tray_counts, tally_sheet, on=:tray_id)"),
            ],
            "demo_id" => "practice-join-v1",
            "result_visual" => "key-alignment",
        ),
        Dict{String, Any}(
            "id" => "filter-disagreement",
            "title" => "Keep the tray where the notebook and Toto's typed copy disagree",
            "required_result" => "Only the row where notebook_detected and sheet_detected differ.",
            "concept" => "Keep a row only where the notebook count is not equal to Toto's typed count.",
            "code_shape" => "table[table.left_count .!= table.right_count, :]",
            "syntax" => [
                Dict("token" => ".!=", "meaning" => "compares the two columns row by row and makes true-or-false values."),
                Dict("token" => ":", "meaning" => "keeps all columns in this indexing position."),
            ],
            "hints" => [
                Dict("stage" => "concept", "text" => "Keep a row only where the notebook count is not equal to Toto's typed count."),
                Dict("stage" => "shape", "text" => "Use table[table.left_count .!= table.right_count, :] to keep rows where two columns differ. table, left_count and right_count are placeholders, not names in this case: here table is joined, left_count is notebook_detected, and right_count is sheet_detected."),
                Dict("stage" => "solution", "text" => "joined[joined.notebook_detected .!= joined.sheet_detected, :]"),
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
            "Practice first: line up two small tables (one minute)",
            "Can each practice key be matched to one practice-sheet row?",
            "Use the separate K-A/K-B practice tables to practise a join (lining up two tables by a shared label). Practice: does not count for the case.",
            "key names the same practice row in both tables; every key occurs once in each table.",
        )
    elseif move_id == "join-report-log"
        (
            "Put each tray's two records side by side",
            "How do we put each tray's notebook count next to its row in Toto's typed copy?",
            "Line up the two tables by tray_id (a join). A successful join prepares a comparison; it does not yet say why any counts differ.",
            "tray_id names the same tray in both tables; every tray ID occurs once in each table.",
        )
    else
        (
            "Keep the tray where the notebook and Toto's typed copy disagree",
            "On which tray do the two counts differ?",
            "Keep only the row where notebook_detected and sheet_detected differ. It does not yet tell us what really happened in the jar.",
            "tray_id identifies the already matched tray in each joined row.",
        )
    end
    inputs = if mode == "demonstration"
        practice_label = "Simulated data made for this game: practice tables, separate from the Missing Fleas case."
        [
            _mystery_c3_input("practice_counts", "Practice tray counts",
                              mystery_c3_practice_counts(); data_label=practice_label),
            _mystery_c3_input("practice_sheet", "Practice tally sheet",
                              mystery_c3_practice_sheet(); data_label=practice_label),
        ]
    elseif move_id == "join-report-log"
        [
            _mystery_c3_input("tray_counts", "Your counts from the notebook (Chapter 2)", mystery_c3_tray_counts()),
            _mystery_c3_input("tally_sheet", "Toto's typed copy of the tally sheet", mystery_c3_tally_sheet()),
        ]
    else
        [_mystery_c3_input("joined", "A fresh copy of the lined-up table, the same as your step 1 result", mystery_c3_joined())]
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
            "line" => "Line up the same tray on both, then look for the one that does not match.",
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

# Round 7 (r7-r-struggling.md item 8): joined[rule] without , : got "keep the comma", which reads
# as if the comma were there. Read from the parsed code: a C3 table with one position in brackets
# (`_mystery_one_position_line`, src/mystery.jl, shared with C6 in round 8).
const _MYSTERY_C3_TABLES = Dict(
    "join-report-log" => (:tray_counts => MYSTERY_C3_TRAY_COUNTS_COLUMNS, :tally_sheet => MYSTERY_C3_TALLY_SHEET_COLUMNS),
    "filter-disagreement" => (:joined => MYSTERY_C3_JOIN_COLUMNS,),
)

function _mystery_c3_coaching(code::String, move_id::String, mode::String; message::AbstractString="")
    tables = mode == "demonstration" ? () : get(_MYSTERY_C3_TABLES, move_id, ())
    shared = _mystery_coaching(code; message=message, way="leftjoin and .!= work on every tray at once.",
                               tables=tables,
                               which_tail=move_id == "filter-disagreement" ? MYSTERY_R_WHICH_RULE_TAIL : "")
    isempty(shared) || return shared
    return _mystery_one_position_line(code, tables)
end

# Round 7 (r7-r-struggling.md item 2): joined[joined.entry_status .== "left blank", :] returns the
# right row without comparing the two counts. It stays accepted, but the line must not say it compared.
const MYSTERY_C3_SHORTCUT_LINE = "Your row is right. This finds the right tray because its box is blank. The way this game teaches compares the two counts with .!=, which also finds a tray where both are filled in but differ."
const _MYSTERY_C3_COUNT_COMPARISONS = (:!=, :.!=, :≠, :.≠, :<, :>, :.<, :.>, :(==), :.==, :isequal)

function _mystery_c3_compares_counts(code)
    parsed = _mystery_parsed_quietly(code)
    parsed === nothing && return true   # unknown: keep the usual line
    # Both counts are read (joined.x, row.x, :x or "x") and some comparison is used (also as
    # ByRow(!=)); the shortcut reads entry_status only.
    reads(column) = _mystery_any_node(n -> n == QuoteNode(column) || n == String(column), parsed)
    compares = _mystery_any_node(n -> n in _MYSTERY_C3_COUNT_COMPARISONS ||
        n isa Expr && n.head == :comparison, parsed)
    return compares && reads(:notebook_detected) && reads(:sheet_detected)
end

const MYSTERY_C3_TAUGHT = Dict(
    "practice" => "leftjoin(practice_counts, practice_sheet, on=:key)",
    "join-report-log" => "leftjoin(tray_counts, tally_sheet, on=:tray_id)",
    "filter-disagreement" => "joined[joined.notebook_detected .!= joined.sheet_detected, :]",
)

function _mystery_c3_explanation(move_id::String, pass; mode::String="challenge", code=nothing,
                                 practice_pass=nothing)
    if mode == "demonstration"
        # Round 3 (r3-bugs.md item 1): the praise needs a passing practice run, not only the
        # taught line somewhere in the code.
        return Dict(
            "julia" => practice_pass === true && _mystery_used_taught(code, MYSTERY_C3_TAUGHT["practice"]) ?
                "You used the way this game teaches in this practice: leftjoin lines up rows from the two practice tables that share a label." :
                "The way this game teaches in this practice is leftjoin(practice_counts, practice_sheet, on=:key), which lines up rows from the two practice tables that share a label.",
            "case" => "This result used the separate K-A/K-B practice tables. Practice: does not count for the case.",
            "limit" => "Practice output does not show whether the notebook and Toto's typed copy disagree in the real case.",
        )
    end
    used = pass === true && _mystery_used_taught(code, MYSTERY_C3_TAUGHT[move_id])
    if pass && move_id == "join-report-log"
        return Dict(
            "julia" => used ?
                "Your table is right. You used the way this game teaches: on= names the shared label, and :tray_id names that column. leftjoin keeps every tray from tray_counts, even a tray that tally_sheet does not have." :
                "Your table is right. The way this game teaches to build it is leftjoin(tray_counts, tally_sheet, on=:tray_id): on= names the shared label, and :tray_id names that column. leftjoin keeps every tray from tray_counts, even a tray that tally_sheet does not have.",
            "case" => "Now each tray has its notebook count and Toto's typed count in one row.",
            "limit" => "",
        )
    elseif pass
        return Dict(
            "julia" => !used && code isa AbstractString && !_mystery_c3_compares_counts(code) ?
                MYSTERY_C3_SHORTCUT_LINE : used ?
                "Your row is right. You used the way this game teaches: .!= compares notebook_detected and sheet_detected row by row, and the rows where the answer is true are kept." :
                "Your row is right. The way this game teaches uses .!= to compare notebook_detected and sheet_detected row by row, then keeps the rows where the answer is true.",
            "case" => "Only T-C disagrees: the notebook has 1. On the tally sheet, T-C's box was left blank. Toto typed a 0 into his table for that blank, and his report used it. That 0 is not a count: nobody counted anything there. Toto jumped to two conclusions: a blank box became a 0, and one 0 became “dying out”. Part 1 done. But everything from here rests on the notebook.",
            "limit" => "We know the box was left blank, not why. Next: can we trust the notebook? Plan a fair recheck of its jars.",
        )
    end
    return Dict(
        "julia" => move_id == "join-report-log" ?
            "Return a DataFrame that matches each tray in tray_counts to its tally_sheet row by tray_id." :
            "Return the one joined row selected by the .!= comparison.",
        # Round 3 (r3-struggling.md): these two lines closed every failure, whatever went wrong,
        # and told the player nothing; the checker's own line names the mistake.
        "case" => "",
        "limit" => "",
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
                            value_repr::String="", result_data=nothing, practice_pass=nothing,
                            code=nothing)
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
        "explanation" => _mystery_c3_explanation(move_id, pass; mode=mode, code=code,
                                                   practice_pass=practice_pass),
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
        push!(checks, "objectid($(name)) == $(identity) || error(\"The supplied table $(name) was changed. Keep the source table unchanged; create a separate result, then try again.\")")
    end
    return _mystery_guarded_code(code, "__juliatime_c3_answer__"; before=setup, after=checks)
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
        feedback="Type Julia code in the editor before running this step.")
    isempty(strip(code)) && return _mystery_c3_result(
        request_id=request_id, move_id=move_id, mode=mode, activity_id=activity_id,
        pass=mode == "demonstration" ? nothing : false,
        practice_pass=mode == "demonstration" ? false : nothing,
        message="Write some Julia before running the case.",
        feedback="The editor is empty, so nothing was run.")

    env, protected_bindings = if mode == "demonstration"
        ((practice_counts=mystery_c3_practice_counts(), practice_sheet=mystery_c3_practice_sheet()),
         (:practice_counts, :practice_sheet))
    elseif move_id == "join-report-log"
        ((tray_counts=mystery_c3_tray_counts(), tally_sheet=mystery_c3_tally_sheet()),
         (:tray_counts, :tally_sheet))
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
        (false, _mystery_stopped_feedback(sandbox_result.status))
    end
    pass = mode == "demonstration" ? nothing : checked
    practice_pass = mode == "demonstration" ? checked : nothing
    # R's <- and Python habits named on a failed run, as in C2; sent on its own so the page can lead with it.
    coaching = checked ? "" : _mystery_c3_coaching(String(code), move_id, mode; message=sandbox_result.message)
    isempty(coaching) || (feedback = coaching)
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
        code=String(code),
    )
    result["coaching"] = coaching
    if pass === true && move_id == "filter-disagreement"
        result["evidence"] = Dict(
            "id" => "c3-recording-disagreement",
            "title" => "The 0 was a blank box",
            "text" => "The notebook says 1 for tray T-C. On the tally sheet its box was left blank, and Toto typed a 0 for it in his table. That 0 is not a count: nobody counted anything there.",
            "claim" => "Part 1 · Check the report: the 0 was a blank box, not an empty tray.",
        )
    end
    return result
end

# Missing Fleas, chapter 1: a self-contained case API alongside the legacy level registry.
# The fixture is deliberately small and entirely simulated.  Each call builds a new DataFrame so
# a player mutation can never alter either a later run or the server-side expected answer.

const MYSTERY_CASE_ID = "missing-fleas-v1"
const MYSTERY_CHAPTER = "C1"
const MYSTERY_CASE_BATCH = "B09"
const MYSTERY_COLUMNS = ["jar_id", "batch_id", "tray_id", "detected"]
const MYSTERY_FIXTURE_SEED = 20260907
const MYSTERY_DATA_LABEL = "Simulated data made for this game: no real jars, no real fleas."

"""
    mystery_jars() -> DataFrame

Return a fresh labelled fixture for the first Missing Fleas chapter.  B09 is the report batch;
B08 exists only to make filtering, rather than returning the visible whole table, necessary.
"""
function mystery_jars()
    rng = Random.MersenneTwister(MYSTERY_FIXTURE_SEED)
    return DataFrame(
        jar_id = ["J-081", "J-082", "J-083", "J-084", "J-085", "J-086",
                  "J-091", "J-092", "J-093", "J-094", "J-095", "J-096"],
        batch_id = ["B08", "B08", "B08", "B08", "B08", "B08",
                    "B09", "B09", "B09", "B09", "B09", "B09"],
        tray_id = ["T-A", "T-A", "T-B", "T-B", "T-C", "T-C",
                   "T-A", "T-A", "T-B", "T-B", "T-C", "T-C"],
        detected = rand(rng, Bool, 12),
    )
end

_mystery_columns(df::DataFrames.DataFrame) = String.(DataFrames.names(df))

_mystery_safe_repr(value) = try
    sprint(show, MIME("text/plain"), value; context=:limit=>true)
catch
    "<unprintable $(typeof(value))>"
end

function _mystery_wire_value(value)
    # Keep the wire contract deliberately narrower than Julia's `Real` hierarchy.  JSON has
    # portable scalar representations for these primitives only; Rational, BigInt and other
    # numeric values receive the labelled fallback below.
    if value isa Bool || value isa String ||
       (value isa Int && -9_007_199_254_740_991 <= value <= 9_007_199_254_740_991) ||
       (value isa Float64 && isfinite(value))
        return value
    end
    # JSON has no representation for `missing`, NaN, Symbols, functions, or arbitrary player
    # objects. Preserve a labelled display of those actual cells instead of allowing one unusual
    # returned table to break the WebSocket reply.
    return Dict("type" => string(typeof(value)), "display" => _mystery_safe_repr(value))
end

"""Turn a DataFrame into the row-object form used by the WebSocket protocol."""
function mystery_rows(df::DataFrames.DataFrame)
    columns = _mystery_columns(df)
    return [Dict{String, Any}(column => _mystery_wire_value(df[i, column]) for column in columns)
            for i in 1:DataFrames.nrow(df)]
end

function mystery_case_info(; request_id::String="")
    all_jars = mystery_jars()
    return Dict{String, Any}(
        "type" => "case",
        "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_CHAPTER,
        "request_id" => request_id,
        "title" => "The report says the fleas are vanishing. What does the notebook say?",
        "goal" => "Find the six B09 jars in the notebook. This finds which jars are in the notebook; it does not say why any jar was or was not recorded as having fleas.",
        "return_spec" => "Return the six B09 jars, with all four columns: jar_id, batch_id, tray_id, detected. Any row order is fine.",
        "data_label" => MYSTERY_DATA_LABEL,
        "case_batch" => MYSTERY_CASE_BATCH,
        "columns" => copy(MYSTERY_COLUMNS),
        "rows" => mystery_rows(all_jars),
        "hints" => [
            Dict("stage" => "concept", "text" => "Keep a row when its batch is B09. A Julia table is picked as jars[rows, columns]."),
            Dict("stage" => "shape", "text" => "table[table.column .== value, :]. Look first with jars[1:3, :]."),
            Dict("stage" => "solution", "text" => "jars[jars.batch_id .== case_batch, :]"),
        ],
        "worked_example" => Dict(
            "batch_id" => "B08",
            "code" => "jars[jars.batch_id .== \"B08\", :]",
            "note" => "Worked example on the other batch, B08, so it is not the answer. jars.batch_id takes the batch column; .== compares every jar with \"B08\"; those true/false values pick the rows; : keeps every column. The jars table itself does not change.",
        ),
        "glossary" => [
            Dict("term" => "row", "definition" => "One jar record."),
            Dict("term" => "column", "definition" => "One named property recorded for every jar."),
            Dict("term" => "detected", "definition" => "Whether fleas were detected in that jar's recorded observation."),
            Dict("term" => "jars[rows, columns]", "definition" => "DataFrame indexing: choose rows first, then columns."),
            Dict("term" => "jars[1:3, :]", "definition" => "The first three jar rows and every column; use it to inspect the table before selecting records."),
            Dict("term" => "jars.batch_id", "definition" => "The batch_id column as one value per jar."),
            Dict("term" => ".==", "definition" => "Elementwise equality: it compares every value in a column and returns one true-or-false value per row."),
            Dict("term" => ":", "definition" => "All rows or all columns in an indexing position."),
        ],
        "bridge" => Dict(
            # These generic bridges teach the operation without supplying the current case's
            # target.  The explicitly labelled B08 worked example above is the only concrete
            # non-case target shown before the final hint.
            "r" => "dplyr::filter(table, column == target)",
            "python" => "table.loc[table[\"column\"] == target]",
        ),
    )
end

function mystery_case_info(msg::AbstractDict)
    request_id = get(msg, "request_id", "")
    request_id isa AbstractString || return Dict("type" => "error", "message" => "C1 case_info requires a string request_id.")
    return mystery_case_info(request_id=String(request_id))
end

function _mystery_cell_equal(actual, expected)
    # Require the expected primitive type as well as the expected value.  In particular, this
    # refuses missing/NaN/numeric substitutes for Boolean `detected` values without throwing.
    typeof(actual) === typeof(expected) || return false
    actual isa AbstractFloat && !isfinite(actual) && return false
    return try
        actual == expected
    catch
        false
    end
end

"""
    check_mystery_c1(value) -> (pass, feedback)

Compare the returned table to an independently regenerated B09 expectation.  The comparison is
an unordered multiset comparison: all columns, cell values and duplicate rows must agree, while a
different row order remains a valid solution.
"""
function check_mystery_c1(value)
    value isa DataFrames.DataFrame ||
        return (false, "Return a table of jars (a DataFrame), not a single value or a list.")

    actual_columns = _mystery_columns(value)
    length(actual_columns) == length(MYSTERY_COLUMNS) &&
        all(column -> column in actual_columns, MYSTERY_COLUMNS) ||
        return (false, "Return exactly these columns: $(join(MYSTERY_COLUMNS, ", ")).")

    expected = filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars())
    DataFrames.nrow(value) == DataFrames.nrow(expected) ||
        return (false, "We need all $(DataFrames.nrow(expected)) B09 jars, each once; you returned $(DataFrames.nrow(value)) rows.")

    matched = falses(DataFrames.nrow(expected))
    for actual_row in 1:DataFrames.nrow(value)
        expected_row = findfirst(1:DataFrames.nrow(expected)) do candidate
            !matched[candidate] && all(column -> _mystery_cell_equal(
                value[actual_row, column], expected[candidate, column]), MYSTERY_COLUMNS)
        end
        expected_row === nothing &&
            return (false, "Pick the rows by their batch label, not by where they sit: keep each row whose batch_id matches case_batch.")
        matched[expected_row] = true
    end
    all(matched) || return (false, "At least one B09 jar is missing.")
    return (true, "All six B09 jars are present exactly once.")
end

function _mystery_explanation(pass::Bool)
    if pass
        return Dict(
            "julia" => "The returned table passed the check. The taught way to build it is jars[jars.batch_id .== case_batch, :]: jars.batch_id .== case_batch makes one true or false per jar, and jars[that, :] keeps the true rows and every column.",
            "case" => "This is what the notebook says; the notebook could still be wrong.",
        )
    end
    return Dict(
        "julia" => "Return a table of jars (a DataFrame), not a single value or a list.",
        "case" => "Nothing found yet: return the complete set of B09 jars first.",
    )
end

function _mystery_result(; request_id::String="", status::String="error", pass::Bool=false,
                         message::String="", stdout::String="", rows=Any[], columns=String[],
                         feedback::String="", value_repr::String="")
    return Dict{String, Any}(
        "type" => "case_result",
        "request_id" => request_id,
        "chapter" => MYSTERY_CHAPTER,
        "status" => status,
        "pass" => pass,
        "message" => message,
        "stdout" => stdout,
        "value_repr" => value_repr,
        "rows" => rows,
        "columns" => columns,
        "feedback" => feedback,
        "explanation" => _mystery_explanation(pass),
    )
end

"""
    mystery_case_run(msg) -> Dict

Evaluate a chapter submission in its own fresh fixture.  The checker independently regenerates
its expectation, so neither a player-side mutation nor a prior request can poison later checks.
"""
function mystery_case_run(msg::AbstractDict; on_status::Function=((_, __) -> nothing))
    request_id = get(msg, "request_id", "")
    request_id isa AbstractString || return _mystery_result(
        message="`request_id` must be a string.", feedback="Send a string request ID before running code.")
    code = get(msg, "code", nothing)
    code isa AbstractString || return _mystery_result(request_id=String(request_id),
        message="`code` must be a string.", feedback="Type Julia code in the editor before running it.")
    isempty(strip(code)) && return _mystery_result(request_id=String(request_id),
        message="Write some Julia before running the case.", feedback="The editor is empty, so no sandbox worker was started.")

    r = lock(_RUN_LOCK) do
        run_code(String(code); env=(jars=mystery_jars(), case_batch=MYSTERY_CASE_BATCH), budget=RUN_BUDGET,
                 on_status=on_status)
    end
    columns = r.value isa DataFrames.DataFrame ? _mystery_columns(r.value) : String[]
    rows = r.value isa DataFrames.DataFrame ? mystery_rows(r.value) : Any[]
    value_repr = r.value === nothing ? "" : _mystery_safe_repr(r.value)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    pass, feedback = r.status == :ok ? check_mystery_c1(r.value) :
        (false, "Julia stopped before the end. Check the names, then run again.")
    result = _mystery_result(request_id=String(request_id), status=String(r.status), pass=pass,
        message=r.message, stdout=r.stdout, rows=rows, columns=columns, feedback=feedback,
        value_repr=value_repr)
    if pass
        result["evidence"] = Dict(
            "id" => "c1-b09-records",
            "title" => "The B09 jars, found",
            "text" => "5 of the 6 B09 jars have fleas in the notebook. Next: which trays are they on?",
        )
    end
    return result
end

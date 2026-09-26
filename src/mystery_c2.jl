# Missing Fleas, chapter 2: grouped B09 summaries.  This intentionally has its own input and
# expected-value constructors: a player receives one fresh B09 table, while checking regenerates
# another fixture and never trusts a returned table as the expected answer.

const MYSTERY_C2_CHAPTER = "C2"
const MYSTERY_C2_STEPS = ("group", "counts", "rates")
const MYSTERY_C2_SOURCE_COLUMNS = ["jar_id", "batch_id", "tray_id", "detected"]
const MYSTERY_C2_COUNT_COLUMNS = ["tray_id", "n", "detected_n"]
const MYSTERY_C2_RATE_COLUMNS = ["tray_id", "n", "detected_n", "rate"]

_mystery_c2_input() = filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars())

function _mystery_c2_expected()
    # This must stay separate from the table supplied to `run_code`: a player-side mutation can
    # only affect their returned value, never the fixture used for comparison here.
    expected_jars = _mystery_c2_input()
    grouped = groupby(expected_jars, :tray_id)
    return combine(grouped, nrow => :n, :detected => sum => :detected_n,
                   :detected => mean => :rate)
end

function _mystery_c2_group_frame(value::DataFrames.GroupedDataFrame)
    groups = [DataFrames.DataFrame(group) for group in value]
    isempty(groups) && return DataFrames.DataFrame()
    return reduce(vcat, groups)
end

function _mystery_c2_output_frame(value)
    value isa DataFrames.DataFrame && return value
    value isa DataFrames.GroupedDataFrame && return _mystery_c2_group_frame(value)
    return nothing
end

function _mystery_c2_wire_value(value)
    # The C2 checker intentionally accepts equivalent finite `Real` values (for example,
    # Float32 counts or Rational rates).  JSON can carry those small summary values as regular
    # numbers, while `value_repr` below retains Julia's original representation for inspection.
    if value isa Real && !(value isa Bool) && isfinite(value)
        wire_value = try
            Float64(value)
        catch
            nothing
        end
        wire_value isa Float64 && isfinite(wire_value) && return wire_value
    end
    return _mystery_wire_value(value)
end

function _mystery_c2_rows(df::DataFrames.DataFrame)
    columns = _mystery_columns(df)
    return [Dict{String, Any}(column => _mystery_c2_wire_value(df[i, column]) for column in columns)
            for i in 1:DataFrames.nrow(df)]
end

# B14 (2026-09-24 playtest): JSON turns Julia's Float64 1.0 into the browser number 1, so the
# page drew it as "1". Send Julia's own printed text for each numeric cell next to the numbers.
function _mystery_c2_row_text(df::DataFrames.DataFrame)
    columns = _mystery_columns(df)
    return [Dict{String, String}(column => sprint(print, df[i, column]) for column in columns
                                 if df[i, column] isa Real && !(df[i, column] isa Bool))
            for i in 1:DataFrames.nrow(df)]
end

# B12 (2026-09-24 playtest): R's summary$rate = ... raises no error in Julia. Julia's parser reads
# it as a one-line definition of a new function named $, so summary is returned unchanged. Only
# that parse (name$name on the left of =) is recognised; string interpolation is a different form.
function _mystery_c2_dollar_note(code::AbstractString)
    found = Ref{Any}(nothing)
    function visit(ex)
        found[] === nothing || return
        ex isa Expr || return
        lhs = ex.head == :(=) ? ex.args[1] : nothing
        if lhs isa Expr && lhs.head == :call && length(lhs.args) == 3 && lhs.args[1] == :$ &&
           lhs.args[2] isa Symbol && lhs.args[3] isa Symbol
            found[] = (lhs.args[2], lhs.args[3])
            return
        end
        foreach(visit, ex.args)
    end
    try
        visit(Meta.parseall(code))
    catch
        return nothing
    end
    found[] === nothing && return nothing
    table, column = found[]
    return "Julia read $(table)\$$(column) = ... as a new function named \$, so $(table) did not change. " *
           "R's \$ does not reach a column in Julia: write $(table).$(column), with a dot."
end

function _mystery_c2_columns(value, expected_columns)
    value isa DataFrames.DataFrame || return false
    actual = _mystery_columns(value)
    return length(actual) == length(expected_columns) &&
           all(column -> column in actual, expected_columns)
end

function _mystery_c2_count_equal(value, expected)
    value isa Real && !(value isa Bool) || return false
    isfinite(value) || return false
    return value == expected
end

function _mystery_c2_rate_equal(value, expected)
    value isa Real && !(value isa Bool) || return false
    isfinite(value) || return false
    return isapprox(value, expected; rtol=1e-6, atol=1e-8)
end

function _mystery_c2_check_summary(value, step::String)
    required = step == "counts" ? MYSTERY_C2_COUNT_COLUMNS : MYSTERY_C2_RATE_COLUMNS
    _mystery_c2_columns(value, required) ||
        return (false, "Return exactly these columns: $(join(required, ", ")).")

    expected = _mystery_c2_expected()
    DataFrames.nrow(value) == DataFrames.nrow(expected) ||
        return (false, "Return one summary row for each tray exactly once.")
    seen = Set{String}()
    for row in 1:DataFrames.nrow(value)
        tray = value[row, "tray_id"]
        tray isa AbstractString || return (false, "tray_id must identify each tray by its recorded text label.")
        tray in seen && return (false, "Each tray needs exactly one summary row.")
        push!(seen, String(tray))
        expected_row = findfirst(==(tray), expected.tray_id)
        expected_row === nothing && return (false, "A returned tray is not in the B09 records.")
        _mystery_c2_count_equal(value[row, "n"], expected.n[expected_row]) ||
            return (false, "Each tray's n must equal its number of B09 records.")
        _mystery_c2_count_equal(value[row, "detected_n"], expected.detected_n[expected_row]) ||
            return (false, "Each tray's detected_n must equal its recorded detections.")
        if step == "rates" && !_mystery_c2_rate_equal(value[row, "rate"], expected.rate[expected_row])
            return (false, "Each rate must equal detected_n / n for the recorded B09 tray.")
        end
    end
    length(seen) == DataFrames.nrow(expected) || return (false, "At least one B09 tray is missing.")
    return (true, step == "rates" ?
        "The counts and rates match the recorded B09 tray summaries." :
        "The counts match the recorded B09 tray summaries.")
end

"""
    check_mystery_c2(value, step) -> (pass, feedback)

Check one C2 learning step.  `group` requires a `GroupedDataFrame` partitioned by `tray_id`
whose flattened rows are exactly the fresh B09 fixture; the later steps require one exact,
unordered summary row per tray.  Numeric representations may differ when their finite values do
not.
"""
function check_mystery_c2(value, step)
    step isa AbstractString && String(step) in MYSTERY_C2_STEPS ||
        return (false, "Choose one C2 step: group, counts, or rates.")
    step = String(step)
    if step == "group"
        value isa DataFrames.GroupedDataFrame ||
            return (false, "Use groupby(..., :tray_id) and return the grouped result.")
        DataFrames.groupcols(value) == [:tray_id] ||
            return (false, "Group the B09 records by tray_id.")
        grouped_rows = _mystery_c2_group_frame(value)
        _mystery_c2_columns(grouped_rows, MYSTERY_C2_SOURCE_COLUMNS) ||
            return (false, "The grouped jars must keep the B09 jar columns.")
        return check_mystery_c1(grouped_rows)
    end
    return _mystery_c2_check_summary(value, step)
end

function _mystery_c2_explanation(step::String, pass::Bool)
    if pass && step == "group"
        return Dict(
            "julia" => "The returned groups passed the check. The taught way is groupby(jars, :tray_id): it makes three groups, one per tray, and no jar is lost.",
            "case" => "Three trays, two jars each. Now count.",
        )
    elseif pass && step == "counts"
        return Dict(
            "julia" => "The returned table passed the check. The taught way is combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n): nrow counts the jars in each tray, and sum counts the trues in detected.",
            "case" => "T-A 2 of 2, T-B 2 of 2, T-C 1 of 2. Every tray has fleas, T-C included.",
        )
    elseif pass
        return Dict(
            "julia" => "The returned table passed the check. The taught way is counts.rate = counts.detected_n ./ counts.n: it divides each tray's detected_n by its n, one tray at a time.",
            "case" => "Every tray has fleas: T-A and T-B 1.0 (both jars), T-C 0.5 (one jar of two). The report's 0 for T-C does not match the notebook.",
            "limit" => "Two jars per tray is a small count, so a share of 0.5 is only one jar.",
        )
    end
    return Dict(
        "julia" => "Return the requested grouped value or DataFrame for this step.",
        "case" => "Nothing found yet: the returned result must match all B09 trays first.",
    )
end

function _mystery_c2_result(; request_id::String="", step::String="", status::String="error",
                            pass::Bool=false, message::String="", stdout::String="",
                            rows=Any[], columns=String[], feedback::String="", value_repr::String="")
    return Dict{String, Any}(
        "type" => "case_result",
        "request_id" => request_id,
        "chapter" => MYSTERY_C2_CHAPTER,
        "step" => step,
        "status" => status,
        "pass" => pass,
        "message" => message,
        "stdout" => stdout,
        "value_repr" => value_repr,
        "rows" => rows,
        "columns" => columns,
        "feedback" => feedback,
        "explanation" => _mystery_c2_explanation(step, pass),
    )
end

function mystery_c2_case_info(; request_id::String="")
    jars = _mystery_c2_input()
    return Dict{String, Any}(
        "type" => "case",
        "case_id" => MYSTERY_CASE_ID,
        "chapter" => MYSTERY_C2_CHAPTER,
        "request_id" => request_id,
        "title" => "The report says T-C has 0 fleas. What does the notebook say for each tray?",
        "question" => "What does the notebook say for each tray?",
        "goal" => "Group the B09 jars by tray, count the jars with fleas, then work out each tray's share.",
        "return_spec" => "One step at a time: group by tray, count, then work out each tray's share of jars with fleas.",
        "data_label" => MYSTERY_DATA_LABEL,
        "case_batch" => MYSTERY_CASE_BATCH,
        "columns" => copy(MYSTERY_C2_SOURCE_COLUMNS),
        "rows" => mystery_rows(jars),
        "steps" => [
            Dict("id" => "group", "title" => "Step 1 · Put each tray's jars together", "return_spec" => "Return the jars in groups, one group per tray."),
            Dict("id" => "counts", "title" => "Step 2 · Count jars and jars with fleas", "return_spec" => "Return one row per tray with three columns: tray_id, n (jars on the tray) and detected_n (jars with fleas)."),
            Dict("id" => "rates", "title" => "Step 3 · Work out each tray's share", "return_spec" => "Return the counts table with one more column, rate: jars with fleas divided by all jars on that tray."),
        ],
        "hints" => [
            Dict("stage" => "concept", "text" => "Grouping does not count or drop any jar. It just puts jars with the same tray label together, then combine makes one summary row per group."),
            Dict("stage" => "shape", "text" => "groupby(table, :column). Then combine(groupby(table, :column), nrow => :n) makes one row per group; add :detected => sum => :detected_n as a second piece after a comma."),
            Dict("stage" => "solution", "text" => "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n); counts.rate = counts.detected_n ./ counts.n; counts"),
        ],
        "glossary" => [
            Dict("term" => "groupby", "definition" => "Partition a table into groups sharing the same key; here the key is tray_id."),
            Dict("term" => "combine", "definition" => "Make one new row per group from summary calculations."),
            Dict("term" => "nrow", "definition" => "The number of rows in one group."),
            Dict("term" => "sum", "definition" => "Add values; with true-or-false detected values, it gives the number detected."),
            Dict("term" => "mean", "definition" => "The average of numeric values; it is an optional alternative way to calculate a true-or-false detection rate."),
            Dict("term" => "rate", "definition" => "Here, detected_n divided by n: the detected fraction of a tray's recorded jars."),
        ],
        "bridge" => Dict(
            "r" => "dplyr::summarise(dplyr::group_by(table, tray_id), n = dplyr::n(), detected_n = sum(detected), rate = detected_n / n)",
            "python" => "summary = table.groupby(\"tray_id\").agg(n=(\"detected\", \"size\"), detected_n=(\"detected\", \"sum\")); summary[\"rate\"] = summary[\"detected_n\"] / summary[\"n\"]",
        ),
    )
end

function mystery_c2_case_info(msg::AbstractDict)
    request_id = get(msg, "request_id", "")
    request_id isa AbstractString || return _mystery_c2_result(message="C2 case_info requires a string request_id.")
    return mystery_c2_case_info(request_id=String(request_id))
end

"""
    mystery_c2_case_run(msg) -> Dict

Run one C2 step in the usual sandbox.  The returned rows and columns serialise the player's
actual DataFrame (or the rows contained in their actual GroupedDataFrame); they are never
replaced with a server-computed expected result.
"""
function mystery_c2_case_run(msg::AbstractDict; on_status::Function=((_, __) -> nothing))
    request_id = get(msg, "request_id", "")
    request_id isa AbstractString || return _mystery_c2_result(
        message="`request_id` must be a string.", feedback="Send a string request ID before running code.")
    step = get(msg, "step", nothing)
    step isa AbstractString && String(step) in MYSTERY_C2_STEPS || return _mystery_c2_result(
        request_id=String(request_id), message="`step` must be group, counts, or rates.",
        feedback="Choose the current C2 step before running code.")
    code = get(msg, "code", nothing)
    code isa AbstractString || return _mystery_c2_result(request_id=String(request_id), step=String(step),
        message="`code` must be a string.", feedback="Type Julia code in the editor before running it.")
    isempty(strip(code)) && return _mystery_c2_result(request_id=String(request_id), step=String(step),
        message="Write some Julia before running the case.", feedback="The editor is empty, so no sandbox worker was started.")

    r = lock(_RUN_LOCK) do
        run_code(String(code); env=(jars=_mystery_c2_input(),), budget=RUN_BUDGET,
                 protected_bindings=(:jars,), on_status=on_status)
    end
    display = _mystery_c2_output_frame(r.value)
    columns = display === nothing ? String[] : _mystery_columns(display)
    rows = display === nothing ? Any[] : _mystery_c2_rows(display)
    value_repr = r.value === nothing ? "" : _mystery_safe_repr(r.value)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    pass, feedback = r.status == :ok ? check_mystery_c2(r.value, String(step)) :
        (false, "Julia stopped before the end. Check the names, then run again.")
    dollar_note = pass ? nothing : _mystery_c2_dollar_note(code)
    dollar_note === nothing || (feedback = dollar_note * " " * feedback)
    result = _mystery_c2_result(request_id=String(request_id), step=String(step), status=String(r.status),
        pass=pass, message=r.message, stdout=r.stdout, rows=rows, columns=columns, feedback=feedback,
        value_repr=value_repr)
    result["row_text"] = display === nothing ? Any[] : _mystery_c2_row_text(display)
    if pass && step == "rates"
        result["evidence"] = Dict(
            "id" => "c2-b09-tray-rates",
            "title" => "Fleas in every tray",
            "text" => "Every tray has fleas: T-A and T-B 1.0 (both jars), T-C 0.5 (one jar of two). The report's 0 for T-C does not match the notebook.",
        )
    end
    return result
end

# Missing Fleas, chapter 1: a self-contained case API alongside the legacy level registry.
# The fixture is deliberately small and entirely simulated.  Each call builds a new DataFrame so
# a player mutation can never alter either a later run or the server-side expected answer.

const MYSTERY_CASE_ID = "missing-fleas-v1"
const MYSTERY_CHAPTER = "C1"
const MYSTERY_CASE_BATCH = "B09"
const MYSTERY_COLUMNS = ["jar_id", "batch_id", "tray_id", "detected"]
const MYSTERY_FIXTURE_SEED = 20260907
const MYSTERY_DATA_LABEL = "Simulated data made for this game: no real jars, no real springtails."

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

# Round 1 night playtest (2026-09-27): a timeout used to get the names line below, which sent the
# player looking for a typo. Every chapter's case_run uses this one line for a run that did not finish.
function _mystery_stopped_feedback(status)
    status == :timeout || return "Julia stopped before the end. Check the names, then run again."
    seconds = isinteger(RUN_BUDGET) ? Int(RUN_BUDGET) : RUN_BUDGET
    return "Your code ran for more than $(seconds) seconds, so Julia stopped it. A loop that never ends is the usual cause."
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
        "title" => "First job: find the B09 jars in the notebook.",
        "goal" => "Find the six B09 jars in the notebook. This finds which jars are in the notebook; it does not say why any jar was or was not recorded as having springtails.",
        "return_spec" => "Return the six B09 jars, with all four columns: jar_id, batch_id, tray_id, detected. Any row order is fine.",
        "data_label" => MYSTERY_DATA_LABEL,
        "case_batch" => MYSTERY_CASE_BATCH,
        "columns" => copy(MYSTERY_COLUMNS),
        "rows" => mystery_rows(all_jars),
        "hints" => [
            Dict("stage" => "concept", "text" => "Keep a row when its batch is B09. You pick from a Julia table with jars[rows, columns]."),
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
            Dict("term" => "detected", "definition" => "true when at least one live springtail was seen during the two-minute look; not a count of animals."),
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

# Round 1 (2026-09-27): one line used to answer every row mismatch, so a player who copied the
# B08 worked example (picked by label, the wrong label) heard "not by where they sit".
function _mystery_c1_row_mismatch(value::DataFrames.DataFrame)
    batches = value.batch_id
    if all(b -> isequal(b, "B08"), batches)
        return "These are the B08 jars. Keep each row whose batch_id matches case_batch, which is $(MYSTERY_CASE_BATCH)."
    elseif all(b -> isequal(b, MYSTERY_CASE_BATCH), batches)
        ids = value.jar_id
        length(unique(ids)) == length(ids) ||
            return "At least one B09 jar appears twice. Keep each row whose batch_id matches case_batch, once each."
        return "These are B09 rows, but at least one value was changed. Return the rows as they are in jars."
    end
    return "Pick the rows by their batch label, not by where they sit: keep each row whose batch_id matches case_batch."
end

"""
    check_mystery_c1(value) -> (pass, feedback)

Compare the returned table to an independently regenerated B09 expectation.  The comparison is
an unordered multiset comparison: all columns, cell values and duplicate rows must agree, while a
different row order remains a valid solution.
"""
function check_mystery_c1(value)
    value isa DataFrames.AbstractDataFrame ||
        return (false, "Return a table of jars (a DataFrame), not a single value or a list.")
    # Round 1 (2026-09-27): @view jars[...] and filter(...; view=true) return the right rows as a
    # view of jars; it holds the same records, so it is checked as a table.
    value = DataFrames.DataFrame(value)

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
        expected_row === nothing && return (false, _mystery_c1_row_mismatch(value))
        matched[expected_row] = true
    end
    all(matched) || return (false, "At least one B09 jar is not in your result.")
    return (true, "All six B09 jars are present exactly once.")
end

# Round 2 (2026-09-27, r2-teacher.md): a learner who typed exactly the taught code was told "The
# taught way is ...", which reads as if they had done something else. Both codes are parsed, so
# spaces and line breaks do not matter. Every taught statement must appear among the learner's
# top-level statements; a learner statement `name = expr` also counts as `expr`.
# `a; b` on one line parses as a toplevel inside the toplevel; list every statement once.
function _mystery_top_nodes(parsed::Expr)
    nodes = Any[]
    for node in parsed.args
        node isa LineNumberNode && continue
        node isa Expr && node.head == :toplevel ? append!(nodes, _mystery_top_nodes(node)) : push!(nodes, node)
    end
    return nodes
end

function _mystery_statements(code::AbstractString; with_values::Bool=false)
    length(code) > 4_000 && return nothing
    parsed = try
        Meta.parseall(String(code))
    catch
        return nothing
    end
    parsed isa Expr || return nothing
    statements = Any[]
    for node in _mystery_top_nodes(parsed)
        node isa Expr && node.head in (:error, :incomplete) && return nothing
        node isa Expr && Base.remove_linenums!(node)
        push!(statements, node)
        with_values && node isa Expr && node.head == :(=) && node.args[1] isa Symbol &&
            push!(statements, node.args[2])
    end
    return statements
end

function _mystery_used_taught(code, taught::AbstractString)
    code isa AbstractString || return false
    mine = _mystery_statements(code; with_values=true)
    wanted = _mystery_statements(taught)
    (mine === nothing || wanted === nothing || isempty(wanted)) && return false
    return all(statement -> any(==(statement), mine), wanted)
end

# Round 3 (r3-bugs.md item 2): a step can teach more than one form (C2's cards teach the two-line
# groups = ...; combine(groups, ...) form next to the one-line hint). Any taught form counts.
_mystery_used_taught(code, taught::Union{AbstractVector, Tuple}) =
    any(form -> _mystery_used_taught(code, form), taught)

# Round 8 (r8-fuzz.md item 1): C3 to C6 used to run the learner's code as
# `answer = begin <code> end`, so Julia prepared the whole block at once and a counter named
# `count` (or `sum`, `mean`, ...) inside a loop was read as Base's function before `count = 0`
# ran ("cannot assign a value to imported variable Base.count"). Here the learner's statements
# run one at a time as top-level statements, with the same soft scope as C1 and C2
# (`_softscope`, src/sandbox.jl), and only the last value is kept. The guard lines before and
# after stay their own top-level statements. The learner's code travels as one string literal
# (`repr` escapes quotes, backslashes and `$`), so no learner text can end the wrapper early.
# `before` and `after` are Julia lines; `answer` is the name that holds the value.
function _mystery_guarded_code(code::String, answer::String; before=String[], after=String[])
    run = "$(answer) = Core.eval(@__MODULE__, Main.JuliaTime._softscope(Meta.parseall($(repr(code)); filename=\"none\")))"
    return join(vcat(before, [run], after, [answer]), "\n")
end

# Round 3 (r3-struggling.md): a few mistakes run, or stop with an error that blames the wrong
# thing. These helpers read the parsed code; each chapter uses them only after a failed run, so
# code that passes never sees their lines.
function _mystery_parsed_quietly(code)
    code isa AbstractString || return nothing
    length(code) > 4_000 && return nothing
    parsed = try
        Meta.parseall(String(code))
    catch
        return nothing
    end
    return parsed isa Expr ? parsed : nothing
end

function _mystery_any_node(found::Function, node)
    found(node) && return true
    node isa Expr || return false
    return any(arg -> _mystery_any_node(found, arg), node.args)
end

_mystery_calls(node, names) = node isa Expr && node.head == :call && !isempty(node.args) &&
    node.args[1] in names

# R's `a <- b` is read by Julia as `a < -b`: the left-most piece on the right of < is a unary minus.
function _mystery_leading_minus(node)
    node isa Expr && node.head == :call || return false
    length(node.args) == 2 && node.args[1] == :- && return true
    return length(node.args) >= 3 && _mystery_leading_minus(node.args[2])
end

const MYSTERY_R_ARROW_LINE = "Julia assigns with =, not <-. Julia read your <- as \"is less than minus\", a comparison, so nothing was stored. Write = where you wrote <-."

function _mystery_r_arrow_note(code)
    code isa AbstractString && occursin("<-", code) || return ""
    parsed = _mystery_parsed_quietly(code)
    parsed === nothing && return ""
    # A chain of comparisons (events <- sim_counts .>= observed_count) parses as one :comparison
    # node, [events, :<, -sim_counts, :.>=, observed_count], not as a call to <.
    found = _mystery_any_node(parsed) do node
        _mystery_calls(node, (:<,)) && length(node.args) == 3 && _mystery_leading_minus(node.args[3]) ||
            node isa Expr && node.head == :comparison &&
            any(i -> node.args[i] == :< && _mystery_leading_minus(node.args[i + 1]), 2:2:length(node.args) - 1)
    end
    return found ? MYSTERY_R_ARROW_LINE : ""
end

# Round 4 (r4-python.md): Python habits fell through to "Check the names", and `import pandas` left
# Julia's own "Pkg.add" advice as the only instruction on screen. Each habit gets one plain line
# naming the Julia form. Most of these codes do not parse (single quotes, a for line ending in a
# colon), so they are read from the text with strings and comments removed; print as the last
# line is read from the parsed code when it parses. Every chapter uses this after a failed run only.
const MYSTERY_PY_IMPORT_LINE = "No import line is needed: the game has already loaded what this step uses. Delete the import line."
# Round 6 (r6-audit.md item 10): a player who typed using sees "using", not "import".
const MYSTERY_PY_USING_LINE = "No using line is needed: the game has already loaded what this step uses. Delete the using line."
const MYSTERY_PY_PRINT_LINE = "print shows a value but returns nothing, so there is nothing to check. End with the value itself, without print."
const MYSTERY_PY_ZERO_LINE = "Julia counts from 1, not 0: the first item is at position 1."
const MYSTERY_PY_LEN_LINE = "Julia has no len: use length for a list or nrow for a table."
const MYSTERY_PY_NOT_LINE = "Julia writes ! for not, and .! for a whole column of true or false."
const MYSTERY_PY_HEAD_LINE = "Julia uses first(table, n)."
const MYSTERY_PY_FRACTION_LINE = "In Julia, // makes an exact fraction, not Python's whole-number division. Use / for a decimal, or div(a, b) for a whole number."
const MYSTERY_PY_MERGE_LINE = "For tables, Julia uses leftjoin, not merge."
const MYSTERY_PY_MEAN_LINE = "Julia has no .mean(): put the values inside mean( ), as in mean(x)."
# Round 5 (r5-bugs.md item 5): Python words that C1-C5 did not coach.
const MYSTERY_PY_AND_LINE = "Julia has no and: use .& to join two columns of true or false (with brackets around each comparison), and && for two single values."
const MYSTERY_PY_OR_LINE = "Julia has no or: use .| to join two columns of true or false (with brackets around each comparison), and || for two single values."
const MYSTERY_PY_NONE_LINE = "Julia has no None: it uses the value nothing for no value, and missing for a blank in a table."
const MYSTERY_PY_ELIF_LINE = "Julia writes elseif, not elif."
const MYSTERY_PY_DEF_LINE = "Julia has no def: write function name(x), the body, then end."
const MYSTERY_PY_RANGE_LINE = "Python's range(n) counts 0 to n-1; Julia counts from 1 and writes 1:n."
const MYSTERY_PY_LOOP_WAY = "dotted operators such as .>= work on every value at once."
# Modules the sandbox has already loaded; importing one of these is Julia, not a Python habit.
const _MYSTERY_LOADED_MODULES = ("Random", "Distributions", "DataFrames", "Statistics", "StatsBase")

# The code with every string emptied and every comment removed, so words there are never coached.
# Round 5 (r5-bugs.md item 4): """...""" strings and #= ... =# block comments (which nest) are
# removed too; a block comment keeps its line breaks, so line-based rules still see the lines.
function _mystery_code_text(code::AbstractString)
    src = String(code)
    out = IOBuffer()
    i = firstindex(src)
    stop = lastindex(src)
    while i <= stop
        if startswith(SubString(src, i), "\"\"\"")
            close = findnext("\"\"\"", src, nextind(src, i, 3))
            print(out, "\"\"")
            close === nothing && break
            i = nextind(src, last(close))
        elseif src[i] == '"'
            print(out, "\"\"")
            j = nextind(src, i)
            while j <= stop && src[j] != '"' && src[j] != '\n'
                src[j] == '\\' && (j = nextind(src, j))
                j = nextind(src, j)
            end
            i = j <= stop && src[j] == '"' ? nextind(src, j) : j
        elseif startswith(SubString(src, i), "#=")
            depth = 0
            while i <= stop
                if startswith(SubString(src, i), "#=")
                    depth += 1
                    i = nextind(src, i, 2)
                elseif startswith(SubString(src, i), "=#")
                    depth -= 1
                    i = nextind(src, i, 2)
                    depth == 0 && break
                else
                    src[i] == '\n' && print(out, '\n')
                    i = nextind(src, i)
                end
            end
        elseif src[i] == '#'
            while i <= stop && src[i] != '\n'
                i = nextind(src, i)
            end
        else
            print(out, src[i])
            i = nextind(src, i)
        end
    end
    return String(take!(out))
end

# The keyword of the first line that loads a module the game has not loaded ("import" or "using"),
# or nothing when there is none.
function _mystery_python_import(text)
    occursin(r"(?m)^\s*from\s+\w+\s+import\b", text) && return "import"
    for m in eachmatch(r"(?m)^\s*(import|using)\s+([^\n;]+)", text)
        # Round 5 (r5-bugs.md item 2): using DataFrames: nrow names a function after the colon;
        # only the module names before it are checked.
        names = replace(replace(m.captures[2], r":.*" => ""), r"\bas\s+\w+" => "")
        any(name -> !(name.match in _MYSTERY_LOADED_MODULES), collect(eachmatch(r"[A-Za-z_]\w*", names))) &&
            return String(m.captures[1])
    end
    return nothing
end

function _mystery_python_print_last(code, text)
    parsed = _mystery_parsed_quietly(code)
    if parsed !== nothing && !_mystery_any_node(n -> n isa Expr && n.head in (:error, :incomplete), parsed)
        nodes = _mystery_top_nodes(parsed)
        isempty(nodes) && return false
        final = last(nodes)
        # Round 8 (r8-fuzz.md item 8): `x |> println` prints and returns nothing, like print(x).
        return _mystery_calls(final, (:print, :println)) ||
            _mystery_calls(final, (:|>,)) && length(final.args) == 3 && final.args[3] in (:print, :println)
    end
    lines = filter(line -> !isempty(strip(line)), split(text, '\n'))
    return !isempty(lines) && (occursin(r"^println?\s*\(", last(lines)) || occursin(r"\|>\s*println?\s*$", last(lines)))
end

function _mystery_python_loop(text, way)
    colon = occursin(r"(?m)^\s*(?:for|while)\b[^\n]*:\s*$", text)
    append = occursin(r"\.append\s*\(", text)
    (colon || append) || return ""
    parts = String[]
    colon && push!(parts, "A Julia loop has no colon and finishes with end.")
    append && push!(parts, "push!(list, x) adds to a list; Julia has no .append.")
    push!(parts, "This step needs no loop: " * way)
    return join(parts, " ")
end

_mystery_python_note(code; message::AbstractString="", way::AbstractString=MYSTERY_PY_LOOP_WAY) =
    join(first(_mystery_python_lines(code; message=message, way=way), 2), " ")

function _mystery_python_lines(code; message::AbstractString="", way::AbstractString=MYSTERY_PY_LOOP_WAY)
    code isa AbstractString || return String[]
    length(code) > 4_000 && return String[]
    text = _mystery_code_text(code)
    lines = String[]
    loader = _mystery_python_import(text)
    loader === nothing || push!(lines, loader == "using" ? MYSTERY_PY_USING_LINE : MYSTERY_PY_IMPORT_LINE)
    _mystery_python_print_last(code, text) && push!(lines, MYSTERY_PY_PRINT_LINE)
    # Round 8 (r8-fuzz.md item 3): '\n', '\t', '\\', '\'' and '\u00e9' are one character each, so
    # every one-character literal is set aside before looking for text in single quotes.
    chars = replace(text, r"(?<![\w\)\]'])'(?:\\(?:u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|x[0-9a-fA-F]{1,2}|[0-7]{1,3}|[^\n])|[^'\\\n])'" => "_")
    quoted = match(r"(?<![\w\)\]'])'([^'\n]{2,})'", chars)
    quoted === nothing || push!(lines,
        "In Julia, text goes in double quotes: \"$(quoted.captures[1])\". Single quotes are for one character.")
    capital = match(r"\b(True|False)\b", text)
    capital === nothing || push!(lines, "Julia writes true and false in small letters: " *
        "the capital $(first(capital.captures[1])) in $(capital.captures[1]) is the problem, so write $(lowercase(capital.captures[1])).")
    occursin(r"\bnot\b(?=\s*[\w(])", text) && push!(lines, MYSTERY_PY_NOT_LINE)
    # Round 5 (r5-bugs.md items 5 and 6): a Python word counts only as a whole word used as code,
    # never inside another name, after a dot, or as a :symbol.
    word(w) = Regex("(?<![\\w.:@!])" * w * "(?![\\w!])")
    occursin(word("and"), text) && push!(lines, MYSTERY_PY_AND_LINE)
    occursin(word("or"), text) && push!(lines, MYSTERY_PY_OR_LINE)
    occursin(word("None"), text) && push!(lines, MYSTERY_PY_NONE_LINE)
    occursin(r"(?m)^\s*elif\b", text) && push!(lines, MYSTERY_PY_ELIF_LINE)
    occursin(r"(?m)^\s*def\s+\w+\s*\(", text) && push!(lines, MYSTERY_PY_DEF_LINE)
    # len called, or handed over as a function (pandas' .agg(len), :detected => len => :n).
    # Round 8 (r8-fuzz.md item 8): a learner's own variable called len is a name, not Python's len.
    own_len = occursin(r"(?<![\w.:@!])len\s*=(?![=>])", text)
    (!own_len && (occursin(r"\blen\s*\(", text) || occursin(r"=>\s*len(?![\w!])", text) ||
     occursin(r"[(,]\s*len\s*[,)]", text)) || occursin("UndefVarError: `len`", message)) &&
        push!(lines, MYSTERY_PY_LEN_LINE)
    # Python's range(n) has one argument; Julia's range needs more (range(0, 3), range(1, 6; length=6)).
    occursin(r"(?<![\w.])range\s*\(\s*[^(),;=]*(?:\([^()]*\)[^(),;=]*)*\)", text) &&
        push!(lines, MYSTERY_PY_RANGE_LINE)
    # x[0] and x[0:3] index from 0; Int[0] and Float64[0, 1] are typed lists, not indexing.
    zero = any(m -> !isuppercase(first(m.captures[1])),
               eachmatch(r"((?<!\w)[A-Za-z_]\w*|[\)\]])\[\s*0\s*[\],:]", text))
    (zero || occursin(r"BoundsError[^\n]*\[0(?!\d)", message)) && push!(lines, MYSTERY_PY_ZERO_LINE)
    occursin(r"\.head\s*\(", text) && push!(lines, MYSTERY_PY_HEAD_LINE)
    # Round 8 (r8-fuzz.md item 8): pandas' .loc[...], .query(...) and .mean().
    for (method, pattern) in (("loc", r"(\w+)\.loc\s*\["), ("query", r"(\w+)\.query\s*\("))
        m = match(pattern, text)
        m === nothing || push!(lines,
            "Julia has no .$(method): the row rule goes straight in the brackets, as in $(m.captures[1])[rule, :].")
    end
    occursin(r"\.mean\s*\(\s*\)", text) && push!(lines, MYSTERY_PY_MEAN_LINE)
    occursin(r"\.merge\s*\(", text) && push!(lines, MYSTERY_PY_MERGE_LINE)
    loop = _mystery_python_loop(text, way)
    isempty(loop) || push!(lines, loop)
    # Round 5 (r5-bugs.md item 1): // is correct Julia, so its line is given only when the fraction
    # is what failed (invalid index: 1//1 of type Rational; no method matching f(::Rational...)).
    occursin("//", text) && occursin("Rational", message) && push!(lines, MYSTERY_PY_FRACTION_LINE)
    return lines
end

# Round 7 (r7-r-struggling.md items 3, 4, 5 and the runners-up): the R habits a nervous R user types
# first got "Check the spelling", which blames the typing, not the habit. Each is read from the code
# with strings and comments removed (or from the parsed code). A name in Julia's UndefVarError is
# coached only when the code really uses it bare.
const MYSTERY_R_LIBRARY_LINE = "No library line is needed: the game has already loaded what this step uses. Delete it."
const MYSTERY_R_WHICH_LINE = "Julia's findall is like R's which."
const MYSTERY_R_C_LINE = "Julia writes a list with square brackets: [a, b]."
# Inside these calls, in a pair (=>) and after a keyword (on=) a column is named with a colon
# (:tray_id), and the chapter pages already say so; a bare column there is left to them.
const _MYSTERY_COLON_CALLS = (:groupby, :combine, :select, :select!, :transform, :transform!, :subset,
    :subset!, :sort, :sort!, :leftjoin, :innerjoin, :rightjoin, :outerjoin, :unique, :rename, :rename!, :(=>))
const _MYSTERY_R_COMPARISONS = (:<, :<=, :>, :>=, :(==), :!=, :.<, :.<=, :.>, :.>=, :.==, :.!=, :≤, :≥, :≠)

function _mystery_undefined_name(message::AbstractString)
    m = match(r"UndefVarError: `([^`]+)` not defined", message)
    return m === nothing ? nothing : String(m.captures[1])
end

# The one table (of this chapter's tables) that has this column, or nothing.
function _mystery_table_of(column::AbstractString, tables)
    owners = [first(t) for t in tables if column in last(t)]
    return length(owners) == 1 ? only(owners) : nothing
end

# True when `name` is used bare somewhere and never where a :name is wanted.
function _mystery_bare_use(parsed, name::Symbol)
    bare = Ref(false)
    colon = Ref(false)
    function visit(node, wanted::Bool)
        if node === name
            bare[] = true
            wanted && (colon[] = true)
            return
        end
        node isa Expr || return
        node.head == :. && return visit(node.args[1], wanted)   # jars.batch_id is not bare
        wants = wanted || node.head == :kw ||
            (node.head == :call && !isempty(node.args) && node.args[1] in _MYSTERY_COLON_CALLS)
        foreach(arg -> visit(arg, wants), node.head == :call ? node.args[2:end] : node.args)
    end
    visit(parsed, false)
    return bare[] && !colon[]
end

# R's filter(table, column == value): a table of this chapter first, then a rule on bare columns.
# Returns (table, column, operator or nothing), or nothing.
function _mystery_dplyr_filter(parsed, tables)
    found = Ref{Any}(nothing)
    _mystery_any_node(parsed) do node
        _mystery_calls(node, (:filter,)) && length(node.args) >= 3 || return false
        owner = [t for t in tables if first(t) === node.args[2]]
        isempty(owner) && return false
        table, columns = first(owner)
        rule = node.args[3]
        rule isa Expr && (rule.head == :-> || _mystery_calls(rule, (:(=>),))) && return false
        index = findfirst(s -> _mystery_bare_use(rule, s), Symbol.(columns))
        index === nothing && return false
        column = Symbol(columns[index])
        op = Ref{Any}(nothing)
        _mystery_any_node(rule) do inner
            if inner isa Expr && inner.head == :comparison
                i = findfirst(==(column), inner.args)
                i !== nothing && isodd(i) || return false
                op[] = inner.args[i < length(inner.args) ? i + 1 : i - 1]
                return true
            elseif _mystery_calls(inner, _MYSTERY_R_COMPARISONS) && column in inner.args[2:end]
                op[] = inner.args[1]
                return true
            end
            return false
        end
        found[] = (table, column, op[])
        return true
    end
    return found[]
end

# Round 8 (r8-fuzz.md items 2 and 7): when Julia stopped because a comparison or ! had no dot, the
# dot is what to fix, so it is named before the which, ifelse and TRUE lines (and before C6's
# brackets line). Keyed on Julia's own message; the operator named is the first plain one in the code.
const _MYSTERY_PLAIN_COMPARISONS = (:<, :<=, :>, :>=, :(==), :!=, :≤, :≥, :≠)
const MYSTERY_NOT_DOT_LINE = "Add a dot: write .! instead of !, so Julia flips every true or false, one at a time. A plain ! works on one value."
_mystery_dot_line(op) = "Add a dot: write .$(op) instead of $(op), so Julia compares every value, one at a time. " *
    "In R and pandas a plain $(op) already does that; Julia needs the dot."

function _mystery_plain_comparison(parsed)
    parsed === nothing && return nothing
    found = Ref{Any}(nothing)
    _mystery_any_node(parsed) do node
        if _mystery_calls(node, _MYSTERY_PLAIN_COMPARISONS)
            found[] = node.args[1]
            return true
        elseif node isa Expr && node.head == :comparison
            i = findfirst(op -> op in _MYSTERY_PLAIN_COMPARISONS, node.args[2:2:end])
            i === nothing && return false
            found[] = node.args[2i]
            return true
        end
        return false
    end
    return found[]
end

function _mystery_dot_rule(parsed, message::AbstractString)
    occursin(r"no method matching !\(::(?:BitVector|BitArray|Vector|AbstractVector)", message) &&
        return MYSTERY_NOT_DOT_LINE
    no_dot = occursin(r"no method matching (?:isless|<|<=|>|>=)\([^)\n]*Vector", message)
    bool_row = occursin("invalid row index of type Bool", message)
    (no_dot || bool_row) || return ""
    op = _mystery_plain_comparison(parsed)
    op === nothing || return _mystery_dot_line(op)
    return no_dot ? "Add a dot before the comparison, as in .>=, so Julia compares every value, one at a time." : ""
end

# Round 8 (r8-fuzz.md item 6): R's table$column. Named with the learner's own names when the left
# side is one of this chapter's tables or a table the code makes. Said nothing for table$col = ...
# (C2's own note explains that Julia read it as a new function) or inside groupby, combine and the
# other calls that want :column (the chapter pages say so).
function _mystery_dollar_line(code, text, tables)
    m = match(r"(\w+)\s*\$\s*(\w+)", text)
    m === nothing && return ""
    table, column = m.captures
    parsed = _mystery_parsed_quietly(code)
    known = Set(String(first(t)) for t in tables)
    if parsed !== nothing
        skip = Ref(false)
        function visit(node, wanted::Bool)
            node isa Expr || return
            if node.head == :(=) && _mystery_calls(node.args[1], (:$,))
                skip[] = true
                return
            end
            if _mystery_calls(node, (:$,))
                wanted && (skip[] = true)
                return
            end
            node.head == :(=) && node.args[1] isa Symbol && push!(known, String(node.args[1]))
            wants = wanted || node.head == :kw ||
                (node.head == :call && !isempty(node.args) && node.args[1] in _MYSTERY_COLON_CALLS)
            foreach(arg -> visit(arg, wants), node.args)
        end
        visit(parsed, false)
        skip[] && return ""
    end
    table in known &&
        return "R's \$ does not exist in Julia: write $(table).$(column), not $(table)\$$(column)."
    return "R's \$ does not exist in Julia: Julia reads a column of a table with a dot, as in table.column."
end

# Round 8 (r8-fuzz.md item 4): ifelse(...) on one value is correct Julia; the habit is R's ifelse
# on a whole column, seen in Julia's message or in a dotted rule or table.column as its first part.
function _mystery_column_ifelse(parsed, message::AbstractString, tables)
    occursin(r"no method matching ifelse\(::(?:BitVector|BitArray|Vector|AbstractVector)", message) && return true
    parsed === nothing && return false
    names = Set(first(t) for t in tables)
    return _mystery_any_node(parsed) do node
        _mystery_calls(node, (:ifelse,)) && length(node.args) >= 2 || return false
        rule = node.args[2]
        _mystery_any_node(rule) do inner
            inner isa Symbol && startswith(String(inner), ".") && length(String(inner)) > 1 ||
                inner isa Expr && inner.head == :. && inner.args[1] in names
        end
    end
end

const MYSTERY_R_PIPE_LINE = "Julia's pipe is |>, and this step needs no pipe."
const MYSTERY_R_JOIN_BY_LINE = "Julia's leftjoin uses on=, not by=."

function _mystery_r_lines(code, text; message::AbstractString="", way::AbstractString=MYSTERY_PY_LOOP_WAY,
                          tables=(), case_batch::Bool=false, which_tail::AbstractString="")
    lines = String[]
    dollar = _mystery_dollar_line(code, text, tables)
    isempty(dollar) || push!(lines, dollar)
    occursin(r"(?<![\w.:@!])(?:library|require)\s*\(", text) && push!(lines, MYSTERY_R_LIBRARY_LINE)
    occursin("%>%", text) && push!(lines, MYSTERY_R_PIPE_LINE)
    seed = match(r"(?<![\w.:@!])set\.seed\s*\(\s*(\d*)\s*\)", text)
    if seed !== nothing
        n = isempty(seed.captures[1]) ? "1" : seed.captures[1]
        push!(lines, "Julia writes Random.seed!($(n)), not set.seed($(n)).")
    end
    # Round 8 (r8-fuzz.md item 8): R's merge(a, b, by = ...) and a Julia join given R's by=. Julia's
    # own merge (of two Dicts) is correct, so merge is named only with R's by=.
    occursin(r"(?<![\w.:@!])merge\s*\([^()]*\bby\s*=(?!=)", text) && push!(lines, MYSTERY_PY_MERGE_LINE)
    occursin(r"(?<![\w.:@!])(?:leftjoin|innerjoin|rightjoin|outerjoin|merge)\s*\([^()]*\bby\s*=(?!=)", text) &&
        push!(lines, MYSTERY_R_JOIN_BY_LINE)
    parsed = _mystery_parsed_quietly(code)
    dplyr = parsed === nothing ? nothing : _mystery_dplyr_filter(parsed, tables)
    if dplyr !== nothing
        table, column, op = dplyr
        push!(lines, "In Julia, columns are named with the table: $(table).$(column), not $(column) on its own. " *
            "dplyr's filter($(table), $(column)$(op === nothing ? "" : " $(op)") ...) becomes a row rule inside $(table)[ ..., :].")
    end
    undefined = _mystery_undefined_name(message)
    if undefined !== nothing && occursin(r"^\w+$", undefined) &&
       occursin(Regex("(?<![\\w.:@!])" * undefined * "(?![\\w!])"), text)
        owner = _mystery_table_of(undefined, tables)
        if owner !== nothing
            dplyr === nothing && parsed !== nothing && _mystery_bare_use(parsed, Symbol(undefined)) &&
                push!(lines, "$(undefined) is a column of $(owner): write $(owner).$(undefined).")
        elseif occursin(r"^B\d\d$", undefined)
            push!(lines, "$(undefined) is text here: write it in double quotes, \"$(undefined)\"" *
                (case_batch && undefined == MYSTERY_CASE_BATCH ? ", or use case_batch." : "."))
        end
    end
    dot = _mystery_dot_rule(parsed, message)
    isempty(dot) || push!(lines, dot)
    spelling = match(r"(?<![\w.:@!])(TRUE|FALSE)(?![\w!])", text)
    spelling === nothing || push!(lines,
        "$(spelling.captures[1]) is R's spelling: Julia writes $(lowercase(spelling.captures[1])).")
    # ifelse.(...) is Julia's own broadcast form; R's ifelse(...) on a whole column is the habit.
    occursin(r"(?<![\w.:@!])ifelse\s*\(", text) && _mystery_column_ifelse(parsed, message, tables) &&
        push!(lines, "Julia has ifelse too, but this step needs no ifelse: " * way)
    occursin(r"(?<![\w.:@!])which\s*\(", text) &&
        push!(lines, isempty(which_tail) ? MYSTERY_R_WHICH_LINE : MYSTERY_R_WHICH_LINE * " " * which_tail)
    occursin(r"(?<![\w.:@!])c\s*\(", text) && push!(lines, MYSTERY_R_C_LINE)
    return lines
end

"""
    _mystery_coaching(code; message="", way=..., tables=(), case_batch=false, which_tail="") -> String

The shared coaching for a failed run in any chapter: R's `<-` first, then the other R habits, then
Python habits, at most two lines. `tables` lists this chapter's tables as `name => columns`, so a
bare column is named with its table; `case_batch` says the chapter supplies `case_batch`;
`which_tail` ends the which line where the step keeps rows with a true/false rule.
Returns "" when nothing is recognised; a chapter then tries its own lines.
"""
function _mystery_coaching(code; message::AbstractString="", way::AbstractString=MYSTERY_PY_LOOP_WAY,
                           tables=(), case_batch::Bool=false, which_tail::AbstractString="")
    arrow = _mystery_r_arrow_note(code)
    isempty(arrow) || return arrow
    code isa AbstractString && length(code) <= 4_000 || return ""
    lines = vcat(_mystery_r_lines(code, _mystery_code_text(code); message=message, way=way,
                                  tables=tables, case_batch=case_batch, which_tail=which_tail),
                 _mystery_python_lines(code; message=message, way=way))
    return join(first(unique(lines), 2), " ")
end

# Round 8 (r8-fuzz.md items 5 and 8): a table given one position in brackets, in C3 and C6. R's
# x[rule, ] reads to Julia as x[rule], so it gets its own line.
function _mystery_one_position_line(code, tables)
    parsed = _mystery_parsed_quietly(code)
    parsed === nothing && return ""
    names = Set(first(t) for t in tables)
    table = Ref{Any}(nothing)
    _mystery_any_node(parsed) do node
        node isa Expr && node.head == :ref && length(node.args) == 2 && node.args[1] in names &&
            !(node.args[2] isa Expr && node.args[2].head == :(:)) || return false
        table[] = node.args[1]
        return true
    end
    table[] === nothing && return ""
    occursin(Regex(string(table[]) * raw"\[[^\]\n]*,\s*\]"), _mystery_code_text(code)) &&
        return "Julia needs : after the comma: $(table[])[rule, :]."
    return MYSTERY_C3_ADD_COMMA_LINE
end

# Round 7 (r7-r-struggling.md item 8): joined[rule] without , : got "keep the comma", which reads
# as if the comma were there. Round 8 shares it with C6.
const MYSTERY_C3_ADD_COMMA_LINE = "A table needs two positions in the brackets: add a comma and a colon (, :) after the row rule, so Julia keeps every column of the matching rows."
# Round 8 (r8-audit.md item 10): findall really is R's which; the tail is said only where the step
# keeps rows with a true/false rule inside the brackets (C1, C3's second step, C6).
const MYSTERY_R_WHICH_RULE_TAIL = "Here a true/false rule inside the brackets is simpler."
const MYSTERY_C1_HEAD_LINE = "head is the R name for this. In Julia it is first: first(jars, 3) gives the first three rows."

const MYSTERY_C1_TAUGHT = "jars[jars.batch_id .== case_batch, :]"

function _mystery_explanation(pass::Bool; code=nothing)
    if pass
        return Dict(
            "julia" => _mystery_used_taught(code, MYSTERY_C1_TAUGHT) ?
                "Your table is right. You used the way this game teaches: jars.batch_id .== case_batch makes one true or false per jar, and jars[that, :] keeps the true rows and every column." :
                "Your table is right. The way this game teaches to build it is jars[jars.batch_id .== case_batch, :]: jars.batch_id .== case_batch makes one true or false per jar, and jars[that, :] keeps the true rows and every column.",
            "case" => "Six B09 jars on three trays. Now we can count what the notebook says.",
        )
    end
    return Dict(
        "julia" => "Return a table of jars (a DataFrame), not a single value or a list.",
        "case" => "Return the complete set of B09 jars to see what the notebook says.",
    )
end

function _mystery_result(; request_id::String="", status::String="error", pass::Bool=false,
                         message::String="", stdout::String="", rows=Any[], columns=String[],
                         feedback::String="", value_repr::String="", code=nothing)
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
        "explanation" => _mystery_explanation(pass; code=code),
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
        message="Write some Julia before running the case.", feedback="The editor is empty, so nothing was run.")

    r = lock(_RUN_LOCK) do
        run_code(String(code); env=(jars=mystery_jars(), case_batch=MYSTERY_CASE_BATCH), budget=RUN_BUDGET,
                 on_status=on_status)
    end
    shown = r.value isa DataFrames.AbstractDataFrame ? DataFrames.DataFrame(r.value) : r.value
    columns = shown isa DataFrames.DataFrame ? _mystery_columns(shown) : String[]
    rows = shown isa DataFrames.DataFrame ? mystery_rows(shown) : Any[]
    value_repr = r.value === nothing ? "" : _mystery_safe_repr(r.value)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    pass, feedback = r.status == :ok ? check_mystery_c1(r.value) :
        (false, _mystery_stopped_feedback(r.status))
    result = _mystery_result(request_id=String(request_id), status=String(r.status), pass=pass,
        message=r.message, stdout=r.stdout, rows=rows, columns=columns, feedback=feedback,
        value_repr=value_repr, code=String(code))
    # Round 4 (r4-bugs.md item 4): C1 had no coaching, so R's <- and Python habits were blamed on
    # a name. As in C2, the line replaces the feedback and is sent on its own for the page to lead with.
    coaching = pass ? "" : _mystery_coaching(String(code); message=r.message,
        way=".== compares every jar at once.", tables=(:jars => MYSTERY_COLUMNS,), case_batch=true,
        which_tail=MYSTERY_R_WHICH_RULE_TAIL)
    # Round 8 (r8-fuzz.md item 8): R's head(jars) in the case editor, not only in the practice box.
    isempty(coaching) && !pass && occursin("UndefVarError: `head`", r.message) && (coaching = MYSTERY_C1_HEAD_LINE)
    isempty(coaching) || (result["feedback"] = coaching)
    result["coaching"] = coaching
    if pass
        result["evidence"] = Dict(
            "id" => "c1-b09-records",
            "title" => "The B09 jars, found",
            "text" => "5 of the 6 B09 jars have springtails in the notebook. Next: which trays are they on?",
        )
    end
    return result
end

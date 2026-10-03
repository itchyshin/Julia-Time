# "Your own data" (lessons/own.json, kind "own", setup "own_data"). The browser reads a learner's CSV and sends its
# text. The server parses it in this process (never evaluating the text or the name), checks it, and holds ONE table
# in memory. Runs in lesson "own" see it as `data`. Nothing is written to disk. Contract: own_data_load,
# own_data_clear, own_data_status and own_data_starter in server.jl `handle_message`.

import Dates

const OWN_DATA_MAX_BYTES = 5_000_000
const OWN_DATA_MAX_ROWS = 50_000
const OWN_DATA_MAX_COLS = 100
const OWN_DATA_PREVIEW_ROWS = 20
const OWN_DATA_STARTER_NAME = "starter_ponds.csv"
const OWN_DATA_STARTER_NOTE = "This table is SIMULATED, made by the game for practice."

const OWN_DATA_NONE_FEEDBACK = "Read a table in the step 'Read the table' first, or use the starter table."
const OWN_DATA_PKG_LINE = "The game has already installed its packages, so this line is not run here. On your own computer, run it once at the julia> prompt; after that, using loads the package each time."
const OWN_DATA_LOADED_LINE = "Your table is loaded. Press Next."
const OWN_DATA_XLSX_LINE = "CSV.read reads CSV files. Save the sheet as CSV (File, Save As, CSV), copy it into data, and read that."
const OWN_DATA_TIMEOUT_LINE = "Reading this file took longer than 5 seconds. Use a smaller file (under 5 MB), or the button."
const OWN_DATA_KEEP_LINE = "Keep the read line on its own in this step: data = CSV.read(...)."
const OWN_DATA_READ_FORM_LINE = "To read a file, write it as data = CSV.read(\"data/yourfile.csv\", DataFrame)"
const OWN_DATA_REFUSE_NAME = "Only .csv or .txt files can be loaded. Save your table as a CSV file, then choose it again."
const OWN_DATA_REFUSE_NO_TEXT = "No file text arrived. Choose the file again."
const OWN_DATA_REFUSE_BIG = "That file is bigger than 5 MB. Use a smaller file, or keep only the rows and columns you need."
const OWN_DATA_REFUSE_EMPTY = "That file has no rows of data. It needs a first line of column names and at least one row under it."
const OWN_DATA_REFUSE_ROWS = "That file has more than 50,000 rows. Use a smaller file, or keep a sample of the rows."
const OWN_DATA_REFUSE_COLS = "That file has more than 100 columns. Keep only the columns you need, then save it again."
const OWN_DATA_REFUSE_READ = "Julia could not read that file as a table. Check that it is a plain CSV file with the column names on the first line."
const OWN_DATA_NA_NOTE = "Cells written NA were read as empty (missing)."
const OWN_DATA_COMMA_NOTE = "Commas in numbers were read as decimal points (12,5 as 12.5)."
const OWN_DATA_FALLBACK_FEEDBACK = "Julia could not run this line. Check each name and bracket."
const _OWN_READ = (stringtype=String, silencewarnings=true, ntasks=1, pool=false, missingstring=["", "NA"])
const OWN_DATA_NO_ROWS_LINE = "No rows matched this rule. Check the value: it must be written exactly as in the column."
const OWN_DATA_MISSING_LINE = "Some cells are empty (missing). Use skipmissing(...) inside sum or mean, or dropmissing(data, :col) first."

# The one held table: `nothing`, or (name, table, info). The lock keeps a load and a run from seeing half of each other.
const _OWN_HELD = Ref{Any}(nothing)
const _OWN_LOCK = ReentrantLock()

"""The held table's `(name, table, info)`, or `nothing`."""
own_data_held() = lock(() -> _OWN_HELD[], _OWN_LOCK)

"""`(data = <copy of the held table>,)` for a run, or `nothing` when nothing is held. A copy, so a run can never change
the held table."""
function own_data_env()
    h = own_data_held()
    h === nothing && return nothing
    return (data=copy(h.table),)
end

const _OWN_PLAIN_NAME = r"^[\p{L}_][\p{L}\p{N}_]*$"
_own_plain_name(col) = occursin(_OWN_PLAIN_NAME, col)

"""The note for a column name Julia cannot read after `data.`: a space, a dot, a dash or anything else that is not a plain
name (leading digit, symbols). "" for a plain name."""
function _own_space_line(col)
    _own_plain_name(col) && return ""
    occursin(' ', col) && return "The column `$col` has a space in its name: write data[!, \"$col\"], or rename it in the file."
    occursin('.', col) && return "The column `$col` has a dot in its name, so Julia reads data.$col as two steps: write data[!, \"$col\"]."
    occursin('-', col) && return "The column `$col` has a dash in its name, so Julia reads data.$col as a subtraction: write data[!, \"$col\"]."
    return "The column `$col` is not a plain Julia name, so data.$col does not work: write data[!, \"$col\"]."
end

"""`:name` does not work for such a name either: the line for a symbol written with it."""
_own_symbol_line(col) = "The column `$col` has a " * (occursin(' ', col) ? "space" : occursin('.', col) ? "dot" :
    occursin('-', col) ? "dash" : "special character") * " in its name: write \"$col\" in quotes instead of :$col."

"""A value as Julia text the page can paste into code: text in quotes, numbers and true/false as they print, dates as a
quoted string."""
function _own_literal(v)
    v isa Dates.TimeType && return sprint(show, string(v))
    return sprint(show, v)
end

"""Up to 3 distinct non-missing values of a column, in order of first appearance, as Julia literal text."""
function _own_examples(col)
    seen = Set{Any}(); out = String[]
    for v in col
        ismissing(v) && continue
        v in seen && continue
        push!(seen, v); push!(out, _own_literal(v))
        length(out) == 3 && break
    end
    return out
end
_own_text_line(col) = "`$col` was read as text: a cell that is not a number (like n/a or a comma decimal) is in it."

"""Plain words for a column's type."""
function _own_type_word(col)
    T = nonmissingtype(eltype(col))
    (T === Union{} || T === Missing) && return "empty"
    T <: Bool && return "true/false"
    T <: Integer && return "whole number"
    T <: AbstractFloat && return "number"
    T <: AbstractString && return "text"
    T <: Dates.TimeType && return "date"
    return string(T)
end

"""A cell written like 12,5 (a comma decimal)."""
_own_comma_decimal(v::AbstractString) = occursin(r"^\s*[+-]?\d*,\d+\s*$", v)

"""Names of the text columns whose cells are mostly numbers but not all: a stray n/a or a comma decimal made Julia read
the whole column as text."""
function _own_text_number_cols(df::DataFrames.AbstractDataFrame)
    out = String[]
    for name in names(df)
        col = df[!, name]
        nonmissingtype(eltype(col)) <: AbstractString || continue
        vals = [String(strip(v)) for v in skipmissing(col)]
        isempty(vals) && continue
        numeric = count(v -> tryparse(Float64, v) !== nothing, vals)
        commas = count(_own_comma_decimal, vals)   # 12,5: a number written the European way
        (2 * (numeric + commas) >= length(vals) && numeric < length(vals)) && push!(out, name)
    end
    return out
end

function _own_table_info(df::DataFrames.AbstractDataFrame, parse_notes::Vector{String}=String[]; skip_text_note=String[])
    columns = Any[Dict{String, Any}("name" => n, "type" => _own_type_word(df[!, n]),
                                     "missing" => count(ismissing, df[!, n]),
                                     "distinct" => length(unique(skipmissing(df[!, n]))),
                                     "examples" => _own_examples(df[!, n])) for n in names(df)]
    notes = copy(parse_notes)
    for n in names(df)
        _own_plain_name(n) || push!(notes, _own_space_line(n))
    end
    for n in _own_text_number_cols(df)
        n in skip_text_note && continue
        push!(notes, _own_text_line(n))
    end
    gaps = ["$(c["name"]) $(c["missing"])" for c in columns if c["missing"] > 0]
    nr, nc = DataFrames.nrow(df), DataFrames.ncol(df)
    summary = "$(_lesson_plural(nr, "row", "rows")), $(_lesson_plural(nc, "column", "columns")). " *
              (!isempty(gaps) ? "Empty cells: " * join(gaps, ", ") * "." :
               (!isempty(skip_text_note) || !isempty(_own_text_number_cols(df))) ? "No empty cells were found, but see the note above." :
               "No empty cells.")
    push!(notes, summary)
    return columns, notes
end

"""Parse `text` into a table, or say why not. Returns `(table, "", notes)` or `(nothing, refusal, [])`. Never evaluates the text."""
function _own_parse(name, text)
    name isa AbstractString && any(e -> endswith(lowercase(name), e), (".csv", ".txt")) ||
        return nothing, OWN_DATA_REFUSE_NAME, String[]
    text isa AbstractString || return nothing, OWN_DATA_REFUSE_NO_TEXT, String[]
    sizeof(text) > OWN_DATA_MAX_BYTES && return nothing, OWN_DATA_REFUSE_BIG, String[]
    t = startswith(text, "﻿") ? String(text[nextind(text, 1):end]) : String(text)
    isempty(strip(t)) && return nothing, OWN_DATA_REFUSE_EMPTY, String[]
    notes = String[]
    df = try
        CSV.read(IOBuffer(t), DataFrames.DataFrame; _OWN_READ...)
    catch
        return nothing, OWN_DATA_REFUSE_READ, notes
    end
    # R writes NA for a gap: those cells were read as missing above (n/a is not one: it stays text).
    occursin(r"(?m)(?:^|[,;\t])\"?NA\"?(?=[,;\t]|\r?$)", t) && push!(notes, OWN_DATA_NA_NOTE)
    # A semicolon file with cells like 12,5: read again with the comma as the decimal point.
    hdr = first(eachline(IOBuffer(t)), 1)
    if !isempty(hdr) && DataFrames.ncol(df) > 1 && count(==(';'), first(hdr)) + 1 == DataFrames.ncol(df)
        texts = [n for n in names(df) if nonmissingtype(eltype(df[!, n])) <: AbstractString &&
                 (vals = String.(collect(skipmissing(df[!, n]))); !isempty(vals) && 2 * count(_own_comma_decimal, vals) >= length(vals) && any(_own_comma_decimal, vals))]
        if !isempty(texts)
            df2 = try
                CSV.read(IOBuffer(t), DataFrames.DataFrame; delim=';', decimal=',', _OWN_READ...)
            catch
                nothing
            end
            if df2 !== nothing && DataFrames.ncol(df2) == DataFrames.ncol(df) &&
               any(n -> nonmissingtype(eltype(df2[!, n])) <: Real, texts)
                df = df2
                push!(notes, OWN_DATA_COMMA_NOTE)
            end
        end
    end
    (DataFrames.nrow(df) == 0 || DataFrames.ncol(df) == 0) && return nothing, OWN_DATA_REFUSE_EMPTY, String[]
    DataFrames.nrow(df) > OWN_DATA_MAX_ROWS && return nothing, OWN_DATA_REFUSE_ROWS, String[]
    DataFrames.ncol(df) > OWN_DATA_MAX_COLS && return nothing, OWN_DATA_REFUSE_COLS, String[]
    return df, "", notes
end

_own_info_reply(rid; status, name="", rows=0, cols=0, columns=Any[], notes=String[], message="", read_line="", starter=false) =
    Dict{String, Any}("type" => "own_data_info", "request_id" => rid, "status" => status, "name" => name,
                      "rows" => rows, "cols" => cols, "columns" => columns, "notes" => notes, "message" => message,
                      "read_line" => read_line, "starter" => starter)

"""Load `text` as the held table. Replies `ok` with what was read, or `refused` with one plain message (the table held
before, if any, is left as it was)."""
function own_data_load(msg::AbstractDict; starter::Bool=false)
    rid = _lesson_request_id(msg)
    name = get(msg, "name", nothing)
    text = get(msg, "text", nothing)
    df, refusal, parse_notes = _own_parse(name, text)
    df === nothing && return _own_info_reply(rid; status="refused", message=refusal)
    shown = String(basename(replace(String(name), '\\' => '/')))
    columns, notes = _own_table_info(df, parse_notes)
    starter && pushfirst!(notes, OWN_DATA_STARTER_NOTE)
    nr, nc = DataFrames.nrow(df), DataFrames.ncol(df)
    message = "Loaded $shown: $(_lesson_plural(nr, "row", "rows")) and $(_lesson_plural(nc, "column", "columns"))."
    # The line that reads this file exactly as the game did (the saved script uses it): the same missing-cell
    # words, and the semicolon/comma-decimal pair when that path was taken.
    read_line = "data = CSV.read($(repr(shown)), DataFrame; missingstring=[\"\", \"NA\"]" *
                (OWN_DATA_COMMA_NOTE in parse_notes ? ", delim=';', decimal=','" : "") * ")"
    info = _own_info_reply(rid; status="ok", name=shown, rows=nr, cols=nc, columns=columns, notes=notes, message=message,
                           read_line=read_line, starter=starter)
    lock(_OWN_LOCK) do
        _OWN_HELD[] = (name=shown, table=df, info=info)
    end
    return info
end

"""Load the game's simulated starter table through the same path as a learner's file."""
function own_data_starter(msg::AbstractDict)
    text = read(joinpath(@__DIR__, "..", "data", "starter_ponds.csv"), String)
    return own_data_load(Dict{String, Any}("name" => OWN_DATA_STARTER_NAME, "text" => text,
                                           "request_id" => _lesson_request_id(msg)); starter=true)
end

# ---- Typed reads (step "loads_table"): the learner writes `data = CSV.read("data/file.csv", DataFrame; ...)`. ----
# The line is parsed, never evaluated. If it is that one shape with literal arguments, the server reads the file itself,
# the same way, and holds the table.

"""The game folder: the sandbox worker's working directory, and the base of a typed read's relative path."""
_own_game_root() = realpath(joinpath(@__DIR__, ".."))

const _OWN_TYPED_KEYS = (:missingstring, :delim, :decimal, :header, :skipto, :comment, :quotechar, :escapechar,
                         :ignorerepeated, :normalizenames, :limit, :stripwhitespace, :select, :drop, :footerskip,
                         :dateformat, :truestrings, :falsestrings, :groupmark)

"""`(true, value)` for a literal (text, number, true/false, character, :symbol, or a vector of those), else `(false, nothing)`."""
function _own_literal_value(x)
    (x isa AbstractString || x isa Number || x isa Bool || x isa Char) && return true, x
    x isa QuoteNode && x.value isa Symbol && return true, x.value
    if x isa Expr && x.head === :vect
        vals = Any[]
        for a in x.args
            ok, v = _own_literal_value(a)
            ok || return false, nothing
            push!(vals, v)
        end
        return true, map(identity, vals)
    end
    return false, nothing
end

"""`(path, kwargs)` when `line` is exactly `data = CSV.read("<text>", DataFrame; key=literal, ...)`, else `nothing`. Parsed
with `Meta.parse`, never evaluated."""
function _own_typed_read(line::AbstractString)
    ex = try
        Meta.parse(strip(line))
    catch
        return nothing
    end
    ex isa Expr && ex.head === :(=) && length(ex.args) == 2 && ex.args[1] === :data || return nothing
    c = ex.args[2]
    c isa Expr && c.head === :call && c.args[1] == :(CSV.read) || return nothing
    pos = Any[]; kws = Any[]
    for a in c.args[2:end]
        if a isa Expr && a.head === :parameters
            append!(kws, a.args)
        elseif a isa Expr && a.head === :kw
            push!(kws, a)
        else
            push!(pos, a)
        end
    end
    length(pos) == 2 && pos[1] isa AbstractString || return nothing
    (pos[2] === :DataFrame || pos[2] == :(DataFrames.DataFrame)) || return nothing
    kwargs = Pair{Symbol, Any}[]
    for k in kws
        k isa Expr && k.head === :kw && k.args[1] isa Symbol && k.args[1] in _OWN_TYPED_KEYS || return nothing
        ok, v = _own_literal_value(k.args[2])
        ok || return nothing
        push!(kwargs, k.args[1] => v)
    end
    return (path=String(pos[1]), kwargs=kwargs)
end

"""Does `ex` change `data`: assign to it (or part of it), or call a `!` function with it?"""
function _own_changes_data(ex)
    root(t) = t isa Symbol ? t : t isa Expr && !isempty(t.args) && t.head in (:ref, :., :curly) ? root(t.args[1]) : nothing
    if ex isa Expr
        if ex.head in (:(=), :(.=), :(+=), :(-=), :(*=), :(/=)) && !isempty(ex.args)
            lhs = ex.args[1]
            if lhs isa Expr && lhs.head === :tuple
                any(t -> root(t) === :data, lhs.args) && return true
            else
                root(lhs) === :data && return true
            end
        end
        if ex.head === :call && ex.args[1] isa Symbol && endswith(String(ex.args[1]), "!") &&
           any(a -> a === :data || (a isa Expr && root(a) === :data), ex.args[2:end])
            return true
        end
        return any(_own_changes_data, ex.args)
    end
    return false
end

"""`(line, problem)` for the code of the read step. `problem` is `:none` (exactly one top-level `data = CSV.read(...)`
and nothing after it changes `data`: `line` is that read), `:no_read` (no such line), or `:keep` (two reads, or a later
statement changes `data`). Comes from `Meta.parseall`, so comments and text are never mistaken for code."""
function _own_typed_analysis(code::AbstractString)
    top = try
        Meta.parseall(String(code))
    catch
        return (line=nothing, problem=:no_read)
    end
    lines = split(String(code), '\n')
    stmts = Tuple{Int, Any}[]
    ln = 1
    function collect!(args)
        for a in args
            if a isa LineNumberNode
                ln = a.line
            elseif a isa Expr && a.head === :toplevel   # `a; b` on one line nests
                collect!(a.args)
            else
                push!(stmts, (ln, a))
            end
        end
    end
    collect!(top.args)
    isempty(stmts) && return (line=nothing, problem=:empty)
    reads = [k for (k, (_, a)) in enumerate(stmts) if a isa Expr && a.head === :(=) && a.args[1] === :data &&
             a.args[2] isa Expr && a.args[2].head === :call && a.args[2].args[1] == :(CSV.read)]
    isempty(reads) && return (line=nothing, problem=:no_read)
    length(reads) > 1 && return (line=nothing, problem=:keep)
    k = only(reads)
    any(t -> _own_changes_data(t[2]), stmts[k+1:end]) && return (line=nothing, problem=:keep)
    start = stmts[k][1]
    # the statement's own text: its lines, up to the next statement's line (or the end)
    stop = k < length(stmts) ? max(start, stmts[k+1][1] == start ? start : stmts[k+1][1] - 1) : length(lines)
    text = String(strip(join(lines[start:min(stop, length(lines))], "\n")))
    spec = _own_typed_read(text)
    if spec === nothing   # two statements on one line, or an unusual layout: rebuild the line from what was parsed
        spec = _own_typed_read(string(stmts[k][2]))
        spec === nothing && return (line=nothing, problem=:no_read)
        text = _own_fix_line(spec.path, spec.kwargs, Pair{Symbol, Any}[])
    end
    return (line=text, problem=:none)
end

"""The learner's own read line (trimmed), or `nothing`; see `_own_typed_analysis`."""
function _own_typed_line(code::AbstractString)
    a = _own_typed_analysis(code)
    return a.problem === :none ? a.line : nothing
end

_own_show_kw(k, v) = "$k=" * sprint(show, v)

"""The typed line rebuilt with `over` keywords added or replacing the learner's own."""
function _own_fix_line(path, kwargs, over)
    kw = Pair{Symbol, Any}[k => v for (k, v) in kwargs if !any(o -> first(o) == k, over)]
    append!(kw, over)
    return "data = CSV.read($(repr(path)), DataFrame" * (isempty(kw) ? "" : "; " * join((_own_show_kw(k, v) for (k, v) in kw), ", ")) * ")"
end

const _OWN_STRAY_TOKENS = ("NA", "n/a", "N/A", ".")

"""Notes for a typed read: a number column spoilt by NA / n/a / "." (name the column, give the keyword that fixes it), a
comma-decimal column, a semicolon file read as one column. Empty for a clean read."""
function _own_typed_notes(df, path, kwargs, header_line)
    notes = String[]
    kw = Dict(kwargs)
    done = String[]
    for n in names(df)
        col = df[!, n]
        nonmissingtype(eltype(col)) <: AbstractString || continue
        vals = [String(strip(v)) for v in skipmissing(col)]
        isempty(vals) && continue
        strays = [t for t in _OWN_STRAY_TOKENS if t in vals]
        rest = [v for v in vals if !(v in _OWN_STRAY_TOKENS)]
        if !isempty(strays) && !isempty(rest) && all(v -> tryparse(Float64, v) !== nothing, rest)
            tok = first(strays)
            ms = any(ismissing, col) ? Any["", tok] : tok
            push!(notes, "`$n` has the text $tok in a column of numbers, so it was read as text. Read it with " *
                         _own_fix_line(path, kwargs, [:missingstring => ms]) * ".")
            push!(done, n)
        end
    end
    commas = [n for n in _own_text_number_cols(df) if !(n in done) &&
              any(_own_comma_decimal, String.(collect(skipmissing(df[!, n]))))]
    if !isempty(commas) && get(kw, :decimal, nothing) != ','
        over = Pair{Symbol, Any}[:decimal => ',']
        semi = occursin(';', header_line) && !haskey(kw, :delim)
        semi && pushfirst!(over, :delim => ';')
        push!(notes, "`$(first(commas))` has commas as decimal points, so it was read as text. Read it with " *
                     _own_fix_line(path, kwargs, over) * ".")
    end
    if DataFrames.ncol(df) == 1 && occursin(';', header_line) && !haskey(kw, :delim)
        over = Pair{Symbol, Any}[:delim => ';']
        occursin(r"\d,\d", header_line) && push!(over, :decimal => ',')
        push!(notes, "This file separates its columns with semicolons, so it was read as one column. Read it with " *
                     _own_fix_line(path, kwargs, over) * ".")
    end
    return notes, done
end

"""Hold the table a typed read names. Returns `(info, line)` on success, or `(nothing, message)` with a plain message."""
function _own_hold_typed(line::AbstractString, rid)
    spec = _own_typed_read(line)
    spec === nothing && return nothing, OWN_DATA_READ_FORM_LINE
    full = normpath(joinpath(_own_game_root(), spec.path))
    shown = String(basename(full))
    (endswith(lowercase(shown), ".xlsx") || endswith(lowercase(shown), ".xls")) && return nothing, OWN_DATA_XLSX_LINE
    any(e -> endswith(lowercase(shown), e), (".csv", ".txt", ".tsv")) || return nothing, OWN_DATA_REFUSE_NAME
    isfile(full) || return nothing, _own_file_line()
    filesize(full) > OWN_DATA_MAX_BYTES && return nothing, _own_still_uses(OWN_DATA_REFUSE_BIG)
    df = try
        CSV.read(full, DataFrames.DataFrame; stringtype=String, silencewarnings=true, ntasks=1, pool=false,
                 Dict{Symbol, Any}(spec.kwargs)...)
    catch
        return nothing, OWN_DATA_REFUSE_READ
    end
    (DataFrames.nrow(df) == 0 || DataFrames.ncol(df) == 0) && return nothing, OWN_DATA_REFUSE_EMPTY
    DataFrames.nrow(df) > OWN_DATA_MAX_ROWS && return nothing, _own_still_uses(OWN_DATA_REFUSE_ROWS)
    DataFrames.ncol(df) > OWN_DATA_MAX_COLS && return nothing, _own_still_uses(OWN_DATA_REFUSE_COLS)
    header_line = try
        open(readline, full)
    catch
        ""
    end
    typed_notes, done = _own_typed_notes(df, spec.path, spec.kwargs, header_line)
    columns, notes = _own_table_info(df, String[]; skip_text_note=done)
    prepend!(notes, typed_notes)
    is_starter = try
        realpath(full) == realpath(joinpath(_own_game_root(), "data", OWN_DATA_STARTER_NAME))
    catch
        false
    end
    is_starter && pushfirst!(notes, OWN_DATA_STARTER_NOTE)
    nr, nc = DataFrames.nrow(df), DataFrames.ncol(df)
    message = "Loaded $shown: $(_lesson_plural(nr, "row", "rows")) and $(_lesson_plural(nc, "column", "columns"))."
    info = _own_info_reply(rid; status="ok", name=shown, rows=nr, cols=nc, columns=columns, notes=notes, message=message,
                           read_line=String(line), starter=is_starter)
    lock(_OWN_LOCK) do
        _OWN_HELD[] = (name=shown, table=df, info=info)
    end
    return info, String(line)
end

"""A refusal line, with the table still held named after it."""
function _own_still_uses(line)
    h = own_data_held()
    return h === nothing ? line : line * " The game still uses $(h.name)."
end

"""True when `code` reads a spreadsheet file with CSV.read."""
_own_reads_xlsx(code::AbstractString) = occursin(r"CSV\.read\(\s*\"[^\"]*\.xlsx?\"", code)

"""Where Julia is looking and what is in `data/`, for a file that is not there."""
function _own_file_line()
    root = _own_game_root()
    files = try
        sort(readdir(joinpath(root, "data")))
    catch
        String[]
    end
    shown = isempty(files) ? "none yet" : join(first(files, 20), ", ") * (length(files) > 20 ? ", and $(length(files) - 20) more" : "")
    return "Julia could not find that file. It looks in this folder: $root. The files in data/ are: $shown. " *
           "Copy your file into the data folder, then read it again."
end

const _PKG_NAMES = "add|rm|remove|update|up|instantiate|activate|develop|dev|build|resolve|pin|free|gc"
const _PKG_REPL_NOT = ("for", "if", "where", "isa", "in", "else", "end", "do", "elseif", "catch", "finally")

"""True when `code` asks for a package change, in any lesson or the speed lab: `Pkg.add` and the other changing calls
(also `Base.Pkg`, an `import Pkg as P` alias, `using Pkg: add`, a bare `add(...)` after `using Pkg`), `pkg"..."`, or a
line starting with `]` and a word (the package prompt). A `]` that only closes a bracket is not one. Text and comments
are ignored, except the text of `pkg"..."`."""
function _pkg_call(code::AbstractString)
    raw = String(code)
    occursin(r"(?<![\w.])pkg\"", raw) && return true
    bare = replace(replace(raw, r"\"[^\"\n]*\"" => "\"\""), r"#[^\n]*" => "")
    names = "(?:$_PKG_NAMES)"
    occursin(Regex("\\b(?:Base\\s*\\.\\s*)?Pkg\\s*\\.\\s*$names\\b"), bare) && return true
    for m in eachmatch(r"\b(?:import|using)\s+(?:Base\s*\.\s*)?Pkg\s+as\s+(\w+)", bare)
        occursin(Regex("\\b" * m.captures[1] * "\\s*\\.\\s*$names\\b"), bare) && return true
    end
    for m in eachmatch(r"\b(?:import|using)\s+(?:Base\s*\.\s*)?Pkg\s*:\s*([^\n;]*)", bare)
        occursin(Regex("\\b$names\\b"), m.captures[1]) && return true
    end
    occursin(r"\busing\s+(?:Base\s*\.\s*)?Pkg\b(?!\s*:)", bare) && occursin(Regex("(?<![\\w.])$names\\s*\\("), bare) && return true
    for l in split(bare, '\n')
        m = match(r"^\s*\]\s*([A-Za-z]\w*)", l)
        m !== nothing && !(m.captures[1] in _PKG_REPL_NOT) && return true
    end
    return false
end


function own_data_clear(msg::AbstractDict)
    lock(_OWN_LOCK) do
        _OWN_HELD[] = nothing
    end
    return _own_info_reply(_lesson_request_id(msg); status="cleared")
end

"""What is held, so a reloaded page can see it: the last own_data_info (status `none` when nothing is held)."""
function own_data_status(msg::AbstractDict)
    rid = _lesson_request_id(msg)
    h = own_data_held()
    h === nothing && return _own_info_reply(rid; status="none")
    info = copy(h.info)
    info["request_id"] = rid
    return info
end

_lesson_is_own(lesson) = get(lesson, "kind", nothing) == "own"

"""A table for the wire cut to `OWN_DATA_PREVIEW_ROWS` rows. `more_rows` says how many were left out (absent when none)."""
function _own_cap_table(table)
    table isa AbstractDict || return table
    rows = get(table, "rows", nothing)
    rows isa AbstractVector && length(rows) > OWN_DATA_PREVIEW_ROWS || return table
    out = Dict{String, Any}(table)
    out["rows"] = rows[1:OWN_DATA_PREVIEW_ROWS]
    cells = get(table, "cells", nothing)
    cells isa AbstractVector && (out["cells"] = cells[1:OWN_DATA_PREVIEW_ROWS])
    out["more_rows"] = length(rows) - OWN_DATA_PREVIEW_ROWS
    return out
end

"""Help for a slip with real data, from the table held and the run. "" when none applies. Computed from the table:
a name with a space after `data.`, a result or error that names `Missing`, and arithmetic on a text column that is
mostly numbers."""
function _own_help_line(code::AbstractString, r)
    if r.status == :error
        msg = String(r.message)
        _own_reads_xlsx(code) && return OWN_DATA_XLSX_LINE
        pm = match(r"Package ([A-Za-z_][A-Za-z0-9_]*) not found", msg)
        pm === nothing || return "$(pm.captures[1]) is not installed in this game. The game has CSV, DataFrames, GLM and Statistics. " *
            "On your own computer you would install $(pm.captures[1]) once with using Pkg; Pkg.add(\"$(pm.captures[1])\")."
        (occursin("No such file", msg) || occursin("doesn't exist", msg) || occursin("could not open file", msg)) && return _own_file_line()
    end
    h = own_data_held()
    h === nothing && return ""
    df = h.table
    r.status == :error && (ml = _own_model_line(code, r, df); isempty(ml) || return ml)
    odd = sort([n for n in names(df) if !_own_plain_name(n)]; by=length, rev=true)   # longest first
    for n in odd
        if r.status == :error
            occursin(Regex("(?<![\\w.])data\\.\\Q" * n * "\\E"), code) && return _own_space_line(n)
            occursin(Regex("(?<![\\w\":])[:]\\Q" * n * "\\E"), code) && return _own_symbol_line(n)
        end
    end
    # a number column compared with text (`data.Month .== "5"`): the slip is the quotes, never the empty cells it may hold
    for n in names(df)
        T = nonmissingtype(eltype(df[!, n]))
        T <: Real && T !== Bool || continue
        col = Regex("(?:data\\.\\Q" * n * "\\E|data\\[!?,\\s*\"\\Q" * n * "\\E\"\\])\\s*(?:\\.?==|\\.?!=|\\.?<=|\\.?>=|\\.?<|\\.?>)\\s*\"")
        if occursin(col, code)
            ex = _own_examples(df[!, n])
            eg = isempty(ex) ? "5" : first(ex)
            return "`$n` holds numbers: compare with a number, like data.$n .== $eg, without quotes."
        end
    end
    if r.status == :error
        msg = String(r.message)
        occursin("ParseError", msg) && return ""
        head = String(first(split(msg, "Closest candidates"; limit=2)))   # Julia's list of other methods names Missing too
        if occursin("String", head)
            for n in _own_text_number_cols(df)
                occursin(Regex("[.:\"]\\Q" * n * "\\E"), code) && return _own_text_line(n)
            end
        end
        # mean or sum of a column of words
        fm = match(r"\b(mean|sum|median|std|var)\(\s*(?:data\.(\w+)|data\[!?,\s*\"([^\"]+)\"\]|data\[!?,\s*:(\w+)\])\s*\)", code)
        if fm !== nothing && occursin(r"String|Char", head)
            col = something(fm.captures[2], fm.captures[3], fm.captures[4])
            col in names(df) && nonmissingtype(eltype(df[!, col])) <: AbstractString &&
                return "`$col` holds text, so $(fm.captures[1]) cannot work on it: pick a column of numbers."
        end
        occursin("Missing", head) && return OWN_DATA_MISSING_LINE
    elseif r.status == :ok
        v = r.value
        v isa DataFrames.AbstractDataFrame && DataFrames.nrow(v) == 0 && return OWN_DATA_NO_ROWS_LINE
        v === missing && return OWN_DATA_MISSING_LINE
        if v isa DataFrames.AbstractDataFrame
            fresh = [n for n in names(v) if !(n in names(df))]
            any(n -> any(ismissing, v[!, n]), fresh) && return OWN_DATA_MISSING_LINE
        end
    end
    return ""
end

"""Help for lm / glm that failed: a text column as the thing to explain, or a column name @formula cannot read."""
function _own_model_line(code::AbstractString, r, df)
    occursin(r"\b(?:lm|glm)\(", code) || return ""
    fm = match(r"@formula\(\s*(.*?)\s*~\s*(.*?)\s*\)\s*(?:,|$)", code)
    if fm !== nothing
        lhs = String(fm.captures[1])
        if lhs in names(df) && nonmissingtype(eltype(df[!, lhs])) <: AbstractString
            return "`$lhs` holds text, so lm and glm cannot explain it: put a column of numbers on the left of the ~."
        end
    end
    fstart = findfirst("@formula(", code)
    if fstart !== nothing
        ftext = code[first(fstart):end]
        odd = sort([n for n in names(df) if !_own_plain_name(n) && occursin(n, ftext)]; by=length, rev=true)
        if isempty(odd)
            m = match(r"non-call expression encountered: (.+)", String(r.message))
            m === nothing || (odd = [String(strip(first(split(m.captures[1], '\n'))))])
        end
        if !isempty(odd)
            term(n) = "Term(Symbol(\"$n\"))"
            ex = if fm !== nothing && String(fm.captures[1]) in names(df) && String(fm.captures[2]) in names(df)
                "$(occursin(r"\bglm\(", code) ? "glm" : "lm")($(term(String(fm.captures[1]))) ~ $(term(String(fm.captures[2]))), data" *
                    (occursin("Poisson", code) ? ", Poisson()" : "") * ")"
            else
                term(first(odd))
            end
            return "`$(first(odd))` is not a plain name, so @formula cannot read it. Write the name with Term, like $ex, or rename the column in the file."
        end
    end
    return ""
end

"""The error line of a play box. In lesson `own` there is no Pocket dictionary on screen, so the lines come without it
(`range=true` drops it) and the closing fallback is the stage's own."""
function _own_error_line(is_own::Bool, challenge, code, message, names, env)
    is_own || return _lesson_error_line(challenge, code, message; names=names, env=env)
    line = _lesson_error_line(challenge, code, message; names=names, env=env, range=true)
    return line == LESSON_RANGE_FALLBACK_FEEDBACK ? OWN_DATA_FALLBACK_FEEDBACK : line
end

# The beginner-slip sweep (Rose principle, round 5 Help): for every typed task in Lessons 1 to 6 and Chapters 1 to 6's
# exams, make the standard slips from the task's OWN solution, run each through the real judge, and keep the message so
# a test (test_lesson_sweep.jl) can check that the message names the slip that was made, or says only the honest
# generic line. This file holds the slip makers and the judges of a message; it runs nothing by itself.
using JuliaTime

const SWEEP_KINDS = ("write", "fix", "complete", "change", "checkpoint")

"""Positions of text outside double quotes: a Bool vector, true where the character is code (not inside a string)."""
function _sw_code_mask(s::AbstractString)
    cs = collect(s)
    mask = trues(length(cs))
    inq = false
    for (i, c) in enumerate(cs)
        if c == '"'
            mask[i] = false
            inq = !inq
        elseif inq
            mask[i] = false
        end
    end
    return cs, mask
end

"""Every bracket pair wholly in code: `(open, close, call)`, where `call` is true when a name or a closing bracket sits just before the opener."""
function _sw_bracket_pairs(cs, mask)
    out = Tuple{Int, Int, Bool}[]
    stack = Tuple{Int, Char}[]
    for (i, c) in enumerate(cs)
        mask[i] || continue
        if c in ('(', '[', '{')
            push!(stack, (i, c))
        elseif c in (')', ']', '}') && !isempty(stack)
            o, oc = pop!(stack)
            ok = (oc == '(' && c == ')') || (oc == '[' && c == ']') || (oc == '{' && c == '}')
            ok || continue
            call = o > 1 && (isletter(cs[o-1]) || isdigit(cs[o-1]) || cs[o-1] in ('_', ')', ']'))
            push!(out, (o, i, call))
        end
    end
    return sort(out; by=p -> p[1])
end

_sw_sub(cs, a, b, rep) = String(cs[1:a-1]) * rep * String(cs[b+1:end])

"""Every match of `re` that sits wholly in code, as `(first, last)` character positions of the match."""
function _sw_sites(s::AbstractString, re::Regex)
    cs, mask = _sw_code_mask(s)
    plain = String(cs)
    out = Tuple{Int, Int}[]
    for m in eachmatch(re, plain)
        a = length(plain[1:prevind(plain, m.offset)]) + 1
        b = a + length(m.match) - 1
        all(mask[a:b]) && push!(out, (a, b))
    end
    return out
end

"""The name (dotted, such as `logbook.jar_id`) just before position `a`."""
_sw_left_name(cs, a) = (m = match(r"([A-Za-z_][\w.]*)\s*$", String(cs[1:a-1])); m === nothing ? "" : String(m.captures[1]))

"""The word just before position `a` (a name or a :symbol), for naming the pair a slip was made in."""
_sw_left_word(cs, a) = (m = match(r"(:?\w+)\s*$", String(cs[1:a-1])); m === nothing ? "" : String(m.captures[1]))

_sw_pick(v, n) = length(v) <= n ? v : unique([v[1]; v[end]; v[cld(length(v), 2)]; v[2]])[1:n]

"""The slips for one solution: `(class, code)` pairs, each different from the solution."""
function sweep_slips(sol::AbstractString)
    out = NamedTuple{(:cls, :code, :from, :to), NTuple{4, String}}[]
    add(cls, code; from="", to="") = (code != sol && !isempty(strip(code)) && !any(o -> o.cls == cls && o.code == code, out)) &&
        push!(out, (cls=cls, code=code, from=String(from), to=String(to)))
    cs, mask = _sw_code_mask(sol)
    keep = Set(["true", "false", "for", "end"])
    # a dot lost before a comparison sign
    for (a, b) in _sw_sites(sol, r"\.(==|!=|<=|>=)")
        add("no_dot_cmp", _sw_sub(cs, a, b, String(cs[a+1:b])); from=String(cs[a+1:b]))
    end
    for (a, b) in _sw_sites(sol, r"\.[&|]")
        add("no_dot_and", _sw_sub(cs, a, b, string(cs[b])); from=string(cs[b]))
    end
    for (a, b) in _sw_sites(sol, r"\./")
        add("no_dot_div", _sw_sub(cs, a, b, "/"))
    end
    # a dot lost between a table and its column: a space, or run together
    for (a, b) in _sw_pick(_sw_sites(sol, r"(?<![\w.:])[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*"), 2)
        w = String(cs[a:b]); t, c = split(w, '.'; limit=2)
        add("no_dot_col", _sw_sub(cs, a, b, "$t $c"); from="$t.$c")
        add("no_dot_col_glued", _sw_sub(cs, a, b, "$t$c"))
        add("dollar", _sw_sub(cs, a, b, "$t\$$c"))
    end
    # a quote lost
    qs = [i for i in eachindex(cs) if cs[i] == '"']
    for (j, i) in enumerate(_sw_pick(qs, 3))
        add("quote_drop", _sw_sub(cs, i, i, ""))
    end
    pairs = [(qs[k], qs[k+1]) for k in 1:2:length(qs)-1]
    for (a, b) in _sw_pick(pairs, 2)
        add("quote_both", _sw_sub(cs, a, b, String(cs[a+1:b-1])); from=String(cs[a+1:b-1]))
    end
    # a number written in quotes (`"3"` for `3`): the slip is the quote marks, not a lost dot
    for (a, b) in _sw_pick(_sw_sites(sol, r"(?<![\w.\"])\d+(?:\.\d+)?(?![\w.])"), 3)
        w = String(cs[a:b]); add("quoted_number", _sw_sub(cs, a, b, "\"" * w * "\""); from=w)
    end
    # a list's values written bare, not in square brackets (`sum(4, 7, 1)`)
    lit = "(?:true|false|-?\\d+(?:\\.\\d+)?)"
    for (a, b) in _sw_sites(sol, Regex("(?<![\\w.])(?:sum|length|maximum|minimum|mean)\\(\\[" * lit * "(?:\\s*,\\s*" * lit * ")+\\]\\)"))
        w = String(cs[a:b]); add("list_unbracketed", _sw_sub(cs, a, b, replace(w, r"\(\[" => "(", r"\]\)" => ")")); from=String(match(r"^\w+", w).match))
    end
    # a repeat line spoilt: the name dropped (`for in 1:1000`), the range colon a comma (`for _ in 1,1000`)
    for (a, b) in _sw_sites(sol, r"\bfor\s+[A-Za-z_]\w*\s+in\b")
        add("for_name_drop", _sw_sub(cs, a, b, "for in"))
    end
    for (a, b) in _sw_sites(sol, r"(?<=\bin )\d+:\d+")
        add("for_range_comma", _sw_sub(cs, a, b, replace(String(cs[a:b]), ":" => ",")))
    end
    # the join column named short (`on=:shelf` for `on=:shelf_id`)
    for (a, b) in _sw_sites(sol, r"(?<=\bon=:)[a-z]+_id\b")
        add("join_col_short", _sw_sub(cs, a, b, replace(String(cs[a:b]), r"_id$" => "")); from=String(cs[a:b]))
    end
    # a comma where a pair needs => (`nrow, :n`)
    for (a, b) in _sw_pick(_sw_sites(sol, r"=>"), 2)
        add("pair_comma", _sw_sub(cs, a - (a > 1 && cs[a-1] == ' ' ? 1 : 0), b, ","); from=_sw_left_word(cs, a))
    end
    # a text value in the wrong case
    for (a, b) in _sw_pick(pairs, 2)
        v = String(cs[a+1:b-1])
        lowercase(v) != v && add("case_text", _sw_sub(cs, a+1, b-1, lowercase(v)); from=v, to=lowercase(v))
    end
    # = for ==
    for (a, b) in _sw_sites(sol, r"\.==")
        add("eq_for_eqeq", _sw_sub(cs, a, b, "="))
    end
    for (a, b) in _sw_sites(sol, r"(?<![.=!<>])==")
        add("eq_for_eqeq", _sw_sub(cs, a, b, "="))
    end
    # == for a named input's = (after ; or , or a bracket), and == for the naming =
    for (a, b) in _sw_sites(sol, r"(?:(?<=[;,(] )|(?<=[;,(]))[a-z_]+=(?![=>])")
        w = String(cs[a:b]); add("eqeq_named", _sw_sub(cs, a, b, w * "="))
    end
    for (a, b) in _sw_sites(sol, r"(?m)^[a-z_][a-z0-9_]*\s*=(?![=>])")
        w = String(cs[a:b]); add("eqeq_naming", _sw_sub(cs, a, b, w * "="))
    end
    # R's arrow for naming
    for (a, b) in _sw_sites(sol, r"(?m)^[a-z_][a-z0-9_]*\s*=(?![=>])")
        w = String(cs[a:b]); add("r_arrow", _sw_sub(cs, b, b, "<-"))
    end
    # a named input without its name (`on=:shelf_id` -> `:shelf_id`, `replace=false` -> `false`)
    for (a, b) in _sw_sites(sol, r"(?:(?<=[;,(] )|(?<=[;,(]))[a-z_]+=(?![=>])")
        w = String(cs[a:b]); add("name_drop", _sw_sub(cs, a, b, ""); from=chop(w))
    end
    # = for => in a pair
    for (a, b) in _sw_pick(_sw_sites(sol, r"=>"), 2)
        add("pair_eq", _sw_sub(cs, a, b, "="); from=_sw_left_word(cs, a))
    end
    # -> for =>
    for (a, b) in _sw_pick(_sw_sites(sol, r"=>"), 2)
        add("arrow", _sw_sub(cs, a, b, "->"); from=_sw_left_word(cs, a))
    end
    # a dash for a range colon
    for (a, b) in _sw_sites(sol, r"\d+:\d+")
        w = String(cs[a:b]); add("range_dash", _sw_sub(cs, a, b, replace(w, ":" => "-")))
    end
    # a missing colon in front of a column name
    for (a, b) in _sw_pick(_sw_sites(sol, r":[a-z_][a-z0-9_]*"), 2)
        add("colon_drop", _sw_sub(cs, a, a, ""))
    end
    # a missing comma
    for (a, b) in _sw_pick(_sw_sites(sol, r","), 3)
        add("comma_drop", _sw_sub(cs, a, a, ""))
    end
    # a semicolon where a comma is, and a comma where a semicolon is
    for (a, b) in _sw_sites(sol, r";")
        add("semi_for_comma", _sw_sub(cs, a, a, ","))
    end
    # a missing closing bracket
    for (a, b) in _sw_pick(_sw_sites(sol, r"[\)\]]"), 3)
        add("close_drop", _sw_sub(cs, a, a, ""))
    end
    # R's TRUE / True
    for (a, b) in _sw_sites(sol, r"\b(true|false)\b")
        w = String(cs[a:b]); add("bool_caps", _sw_sub(cs, a, b, uppercasefirst(w)))
        add("bool_caps", _sw_sub(cs, a, b, uppercase(w)))
    end
    # a misspelt name: a function or table, a column, a symbol. Two letters swapped, or one letter lost.
    names = _sw_sites(sol, r"(?<![\w.:$])[A-Za-z_][A-Za-z0-9_]{3,}")
    cols = _sw_sites(sol, r"(?<=[.:])[A-Za-z_][A-Za-z0-9_]{3,}")
    function typo(w)
        n = length(w)
        mid = n ÷ 2
        return (w[1:mid-1] * w[mid+1] * w[mid] * w[mid+2:end], w[1:mid-1] * w[mid+1:end])
    end
    for (kind, sites) in (("misspell_name", names), ("misspell_column", cols))
        for (a, b) in _sw_pick(filter(ab -> !(String(cs[ab[1]:ab[2]]) in keep), sites), 3)
            w = String(cs[a:b]); sw, dr = typo(w)
            sw != w && add(kind, _sw_sub(cs, a, b, sw); from=w, to=sw)
            add(kind, _sw_sub(cs, a, b, dr); from=w, to=dr)
        end
    end
    # a closing bracket too many, a doubled comma, a space inside a sign, single quotes for double quotes
    add("extra_close", sol * (occursin(r"\)\s*$", sol) ? ")" : "]"))
    for (a, b) in _sw_pick(_sw_sites(sol, r","), 2)
        add("double_comma", _sw_sub(cs, a, a, ",,"))
    end
    for (a, b) in _sw_pick(_sw_sites(sol, r"\.(==|!=|<=|>=)"), 2)
        add("space_in_sign", _sw_sub(cs, a, b, "." * " " * String(cs[a+1:b])))
    end
    for (a, b) in _sw_pick(pairs, 2)
        c2 = copy(cs); c2[a] = '\''; c2[b] = '\''
        add("single_quote", String(c2))
    end
    # a table or other plain name written with a capital letter
    for (a, b) in _sw_pick(_sw_sites(sol, r"(?<![\w.:$])[a-z_][a-z0-9_]{3,}(?![\w(])"), 2)
        w = String(cs[a:b]); w in keep || add("capital_table", _sw_sub(cs, a, a, string(uppercase(cs[a]))); from=w)
    end
    # a function written with a capital letter
    for (a, b) in _sw_pick(_sw_sites(sol, r"(?<![\w.:$])[a-z]{3,}(?=\()"), 2)
        add("capital_name", _sw_sub(cs, a, a, string(uppercase(cs[a]))); from=String(cs[a:b]))
    end
    # ---- Round 6 (Help) kinds ----
    # round brackets for square round a list comprehension, square for round in a call, round for square in a pick
    pr = _sw_bracket_pairs(cs, mask)
    for (o, c, call) in _sw_pick([p for p in pr if cs[p[1]] == '[' && occursin(r"\bfor\b", String(cs[p[1]:p[2]]))], 2)
        c2 = copy(cs); c2[o] = '('; c2[c] = ')'
        add("paren_for_square", String(c2))
    end
    for (o, c, call) in _sw_pick([p for p in pr if cs[p[1]] == '(' && p[3]], 3)
        c2 = copy(cs); c2[o] = '['; c2[c] = ']'
        add("square_for_round", String(c2); from=_sw_left_name(cs, o))
    end
    for (o, c, call) in _sw_pick([p for p in pr if cs[p[1]] == '[' && p[3] && !occursin(r"\bfor\b", String(cs[p[1]:p[2]]))], 2)
        c2 = copy(cs); c2[o] = '('; c2[c] = ')'
        add("round_for_square", String(c2); from=_sw_left_name(cs, o))
    end
    # a name written in quotes (a variable, a table or a column word that is not followed by ( or =)
    for (a, b) in _sw_pick(_sw_sites(sol, r"(?<![\w.:$\"])[a-z_][a-z0-9_]{3,}(?![\w(\"])(?!\s*=(?![=]))"), 2)
        w = String(cs[a:b])
        w in keep && continue
        add("quoted_name", _sw_sub(cs, a, b, "\"" * w * "\""); from=w)
    end
    # a semicolon before a plain input (not a named one): `first(x; 3)`
    cands = Int[]
    for (i, c) in enumerate(cs)
        (c == ',' && mask[i]) || continue
        enc = [p for p in pr if p[1] < i < p[2]]
        isempty(enc) && continue
        innermost = last(enc)
        (cs[innermost[1]] == '(' && innermost[3]) || continue
        # the next piece of that call, up to its next comma or its closing bracket
        seg = String(cs[i+1:innermost[2]-1])
        seg = first(split(seg, ','; limit=2))
        occursin(r"[=\[\(]", seg) || push!(cands, i)
    end
    for i in _sw_pick(cands, 2)
        add("semi_positional", _sw_sub(cs, i, i, ";"))
    end
    # a table prefix lost before a column (not on the left of an assignment)
    prefs = [ab for ab in _sw_sites(sol, r"(?<![\w.:$])[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*(?![\w(])")
             if !occursin(r"^\s*=(?![=>])", String(cs[ab[2]+1:end]))]
    for (a, b) in _sw_pick(prefs, 2)
        w = String(cs[a:b]); t, c = split(w, '.'; limit=2)
        add("no_table_prefix", _sw_sub(cs, a, b, c); from=w)
    end
    # .= (stores a value) for a comparison sign
    for (a, b) in _sw_sites(sol, r"\.(==|!=|<=|>=)")
        add("dot_assign", _sw_sub(cs, a, b, ".="); from=String(cs[a+1:b]))
    end
    # == and .== where an assignment to a column (`counts.rate = ...`) is meant
    for (a, b) in _sw_sites(sol, r"(?m)^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\s*=(?![=>])")
        w = String(cs[a:b])
        add("eqeq_assign_col", _sw_sub(cs, b, b, "=="))
        add("eqeq_assign_col", _sw_sub(cs, b, b, ".=="))
    end
    return out
end

"""All typed tasks of Lessons 1 to 6 and the exams, as `(lesson id, challenge id, solution)`."""
function sweep_tasks()
    out = Tuple{String, String, String}[]
    JuliaTime.reload_lessons!()
    for id in sort(collect(keys(JuliaTime.LESSONS)))
        occursin(r"^(lesson|exam)\d$", id) || continue
        for r in get(JuliaTime.LESSONS[id], "rounds", Any[]), c in get(r, "challenges", Any[])
            get(c, "kind", nothing) in SWEEP_KINDS || continue
            sol = get(c, "solution", nothing)
            sol isa AbstractString && !isempty(sol) && push!(out, (id, String(c["id"]), String(sol)))
        end
    end
    return out
end

"""Run one slip in the real judge: `(pass, feedback)`."""
function sweep_run(lesson::AbstractString, cid::AbstractString, code::AbstractString)
    r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => lesson, "challenge" => cid, "code" => code,
                                      "request_id" => "sweep"))
    return (r["pass"] === true, String(get(r, "feedback", "")))
end

# ---- Judging a message --------------------------------------------------------------------------------------------
# For each kind of slip: a pattern the message must match to name THAT slip. A kind in SWEEP_GENERIC_OK may also get the
# honest generic line (the fallback, or the task's own "wrong / requires / forbids" line, which only say what the answer
# should look like); every other kind must be named. Anything else is a wrong message.
const SWEEP_RIGHT = Dict{String, Regex}(
    "no_dot_cmp" => r"dot|\.==|\.!=|\.<=|\.>=",
    "no_dot_and" => r"dot|\.&",
    "no_dot_div" => r"dot|\./",
    "no_dot_col" => r"dot between",
    "no_dot_col_glued" => r"dot between|run together",
    "dollar" => r"\$",
    "quote_drop" => r"closing \"|double quotes",
    "quote_both" => r"double quotes|quotes",
    "quoted_number" => r"quot"i,
    "list_unbracketed" => r"square brackets",
    "for_name_drop" => r"repeat reads",
    "for_range_comma" => r"repeat reads",
    "join_col_short" => r"shared column",
    "pair_comma" => r"=>",
    "case_text" => r"Capital letters matter",
    "eq_for_eqeq" => r"\.==|single =|One =",
    "eqeq_named" => r"one =|single =",
    "eqeq_naming" => r"single =",
    "r_arrow" => r"<-",
    "arrow" => r"=>",
    "pair_eq" => r"=>",
    "range_dash" => r"minus|colon",
    "colon_drop" => r"colon",
    "name_drop" => r"=",
    "comma_drop" => r"comma|space alone|space",
    "semi_for_comma" => r"comma|semicolon",
    "close_drop" => r"has no [\)\]\}]|is closed with|brackets are still open|closing bracket|every [\(\[]|Close",
    "bool_caps" => r"small letters",
    "misspell_name" => r"",      # judged by the word, see below
    "misspell_column" => r"",
    "capital_name" => r"",
    "capital_table" => r"",
    "extra_close" => r"no opening bracket|has no opening|closing bracket|extra|Remove|Every [\(\[]|Close",
    "double_comma" => r"comma",
    "space_in_sign" => r"space",
    "single_quote" => r"double quotes|single quote|quote",
    "paren_for_square" => r"square brackets",
    "square_for_round" => r"round brackets",
    "round_for_square" => r"square brackets",
    "quoted_name" => r"quote marks",
    "semi_positional" => r"comma",
    "no_table_prefix" => r"dot in front",
    "dot_assign" => r"stores a value",
    "eqeq_assign_col" => r"single =|One =",
)
const SWEEP_GENERIC_OK = Set(["comma_drop", "semi_for_comma", "misspell_name", "misspell_column", "capital_name", "capital_table", "eq_for_eqeq", "extra_close", "double_comma", "space_in_sign", "single_quote"])

"""The task's own lines (wrong, requires, forbids, unchanged): they say what the answer should look like, not what is
wrong with the line, so they are an honest answer to any slip."""
function _sw_task_lines(lesson, cid)
    c = JuliaTime._lesson_challenge(JuliaTime.LESSONS[lesson], cid)
    return Set(String[JuliaTime._lesson_feedback(c, k) for k in ("wrong", "requires", "forbids", "unchanged")])
end

const SWEEP_FALLBACKS = (JuliaTime.LESSON_FALLBACK_FEEDBACK, JuliaTime.LESSON_RANGE_FALLBACK_FEEDBACK)

"""`:right` (names the slip), `:generic` (the honest fallback or the task's own line) or `:wrong`."""
function sweep_judge(slip, lesson, cid, fb)
    kind = slip.cls
    right = if kind in ("misspell_name", "misspell_column", "capital_name", "capital_table")
        occursin(slip.to, fb) || occursin(slip.from, fb)
    elseif kind == "name_drop"
        occursin(slip.from * "=", fb)
    elseif kind in ("no_dot_cmp", "no_dot_and")
        # it must name a dot, and when it names a sign, the sign that lost its dot
        signs = [String(m.captures[1]) for m in eachmatch(r"\.(==|!=|<=|>=|&|\|)", fb)]
        occursin(SWEEP_RIGHT[kind], fb) && (isempty(signs) || slip.from in signs || occursin(slip.from, fb))
    elseif kind == "no_dot_col"
        occursin(slip.from, fb)
    elseif kind == "quoted_number"
        # the general line names the quoted value; a step's own line (Lessons 4 and 5) names the quote marks around
        # a number: both name the slip, and neither may send the player after a missing dot
        (occursin("In quotes", fb) && occursin("\"" * slip.from * "\"", fb) ||
         occursin(r"quot"i, fb) && occursin(r"number"i, fb)) && !occursin("Add a dot", fb)
    elseif kind == "list_unbracketed"
        occursin("square brackets", fb) && occursin(slip.from * "([", fb)
    elseif kind == "join_col_short"
        occursin("shared column", fb) && occursin(slip.from, fb)
    elseif kind == "pair_comma"
        occursin("=>", fb) && occursin(slip.from, fb)
    elseif kind == "quote_both"
        occursin(SWEEP_RIGHT[kind], fb) && occursin(slip.from, fb)
    elseif kind == "case_text"
        occursin("\"" * slip.to * "\"", fb) && occursin("\"" * slip.from * "\"", fb)
    elseif kind == "square_for_round"
        occursin(SWEEP_RIGHT[kind], fb) && occursin("`" * slip.from * "`", fb)
    elseif kind == "semi_positional"
        occursin(r"comma|semicolon", fb)
    elseif kind == "quoted_name"
        occursin(SWEEP_RIGHT[kind], fb) && occursin("`" * slip.from * "`", fb)
    elseif kind == "no_table_prefix"
        occursin("dot", fb) && occursin(slip.from, fb)
    elseif kind == "dot_assign"
        occursin("." * slip.from, fb) && occursin(r"stores a value|not a comparison|One =", fb)
    elseif kind in ("arrow", "pair_eq")
        occursin("=>", fb) && occursin(slip.from, fb)
    else
        occursin(SWEEP_RIGHT[kind], fb)
    end
    right && return :right
    (fb in SWEEP_FALLBACKS || fb in _sw_task_lines(lesson, cid)) && return kind in SWEEP_GENERIC_OK ? :generic : :missed
    return :wrong
end

# ---- No message names anything the player did not type ------------------------------------------------------------------
# Round 6 (Help): "Julia does not know the word `Sandbox`" went to a player whose round-bracket list pointed back at the
# game's own throw-away module. A name inside backticks must be in the player's code, the lesson's own text (prompt,
# solution, hints, feedback) or the game's taught words; and no message names the game's machinery.
const SWEEP_INTERNAL = ("Sandbox", "Main.", "UndefVarError", "MethodError", "BoundsError", "ParseError", "ArgumentError",
                        "TypeError", "LoadError", "ErrorException", "DataFrames.", "Base.", "Core.", "KeyError")

"""The words a message may name: the player's code, the lesson's own text and the game's taught words."""
function sweep_allowed_words(code::AbstractString, lesson::AbstractString)
    haskey(JuliaTime.LESSONS, lesson) || JuliaTime.reload_lessons!()
    words(s) = Set(String(m.match) for m in eachmatch(r"[A-Za-z_][A-Za-z0-9_]*", s))
    return union(words(code), words(string(JuliaTime.LESSONS[lesson])), Set(String.(JuliaTime.LESSON_TAUGHT_WORDS)))
end

"""What a message names that the player did not type and the lesson does not say: backticked words and the game's machinery."""
function sweep_leaks(fb::AbstractString, code::AbstractString, lesson::AbstractString)
    allowed = sweep_allowed_words(code, lesson)
    leaks = String[]
    for m in eachmatch(r"`([^`]+)`", fb), w in eachmatch(r"[A-Za-z_][A-Za-z0-9_]*", m.captures[1])
        String(w.match) in allowed || push!(leaks, String(w.match))
    end
    for w in SWEEP_INTERNAL
        occursin(w, fb) && push!(leaks, w)
    end
    return unique(leaks)
end

# Fit and transfer of the chapter exams (gates I1 and I6 in .unlazy/integration/GATES.md; format in
# docs/dev-log/course/lesson-format.md, "Exams"). For every lessons/examN.json that exists:
#   facts: the file names chapter N and its moves in order; each move runs in the setup its checker wants; each setup
#          binds exactly the chapter's own inputs; close.finding is the chapter's own payoff text, read from the
#          chapter's real case_run.
#   fit:   every exam solution passes its wrapper in the real sandbox AND the Original chapter's case_run; Lesson N's
#          last checkpoint solution, as written, fails every move of Chapter N; each exam solution differs as written
#          from that checkpoint solution (comments and spaces aside; names are not normalised: Shinichi chose twin
#          data as the transfer on 30 Sep, and Ada dropped the names-normalised rule to match that choice); and every function and operator in an exam
#          solution is taught in Lessons 1 to N (a solution, a starter, a check.taught item or a dictionary line).
#   twists (0.5 fix, decision 11): a chapter round with no checker and "same_value": true is a twist, a new question on
#          the same idea with no new story fact. It runs on one of the chapter's own setups (which bind exactly the
#          chapter's inputs), its solution passes by value, it saves no chapter move, and it never changes the facts
#          above: the moves stay in order, and close.finding is still read from the chapter's last MOVE.
# Standalone (the gate):  JULIATIME_INTEGRATION=1 JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 julia --project=. test/test_exam_fit.jl
#   prints EXAM-FACTS-OK once the facts pass, PRINTS-OK once every feedback line that says "prints <number>" finds that
#   number in what Julia shows for the solution (P08), and EXAM-FIT-OK at the very end only if everything passed.
# Included from runtests.jl the same checks run as tests, except one thing: while Lesson N still trains on the case
# data (its setup is not a twin setup, practice1 to practice6), its two transfer checks are marked skipped, so the suite
# stays green while the lesson builders work. The standalone gate never skips them.
using Test, JuliaTime, JSON, DataFrames

const _XF_STANDALONE = abspath(PROGRAM_FILE) == @__FILE__
const _XF_MOVES = Dict("C1" => ["select-records"], "C2" => ["group", "counts", "rates"],
    "C3" => ["join-report-log", "filter-disagreement"], "C4" => ["plan-distinct-recheck"],
    "C5" => ["event-mask", "event-frequency"], "C6" => ["compatible-models"])

_xf_exam_files() = sort(filter(f -> occursin(r"^exam\d+\.json$", f), readdir(JuliaTime.LESSONS_DIR)))
_xf_load(f) = JuliaTime.load_lesson_file(joinpath(JuliaTime.LESSONS_DIR, f))
_xf_challenges(l) = [(r, c) for r in get(l, "rounds", Any[]) for c in get(r, "challenges", Any[])]
"""A twist has no exam checker and is judged by value (same_value true); every other step is a chapter move."""
_xf_is_twist(c) = JuliaTime._lesson_exam_spec(c) === nothing
"""The steps split into the chapter's moves and its twists, each as (round, challenge)."""
_xf_split(steps) = (filter(rc -> !_xf_is_twist(rc[2]), steps), filter(rc -> _xf_is_twist(rc[2]), steps))

"""The chapter's own inputs for a setup, built here from the chapter constructors (the same calls as its case_run)."""
function _xf_chapter_inputs(setup)
    setup == "case1" && return (jars=JuliaTime.mystery_jars(), case_batch=JuliaTime.MYSTERY_CASE_BATCH)
    setup == "case2" && return (jars=JuliaTime._mystery_c2_input(),)
    setup == "case3" && return (tray_counts=JuliaTime.mystery_c3_tray_counts(), tally_sheet=JuliaTime.mystery_c3_tally_sheet())
    setup == "case3_joined" && return (joined=JuliaTime.mystery_c3_joined(),)
    setup == "case4" && return (eligible=JuliaTime.mystery_c4_expected_eligible(),)
    setup == "case5" && return (sim_counts=JuliaTime.mystery_c5_sim_counts(), n_jars=JuliaTime.MYSTERY_C5_N_JARS,
        p_ref=JuliaTime.MYSTERY_C5_P_REF, observed_count=JuliaTime.mystery_c5_observed_count(), n_trials=JuliaTime.MYSTERY_C5_N_TRIALS)
    setup == "case6" && return (stories=JuliaTime.mystery_c6_candidates(), observed_count=JuliaTime.mystery_c6_observed_count(),
        n_trials=JuliaTime.MYSTERY_C6_N_TRIALS)
    return nothing
end
_xf_same(a, b) = a isa DataFrames.AbstractDataFrame ? isequal(DataFrame(a), DataFrame(b)) : isequal(a, b)
function _xf_same_env(a, b)
    (a === nothing || b === nothing) && return false
    Set(keys(a)) == Set(keys(b)) || return false
    return all(k -> typeof(getfield(a, k)) == typeof(getfield(b, k)) && _xf_same(getfield(a, k), getfield(b, k)), keys(b))
end

"""The Original chapter's reply for one move, through the server's own case_run routing."""
function _xf_case_run(chapter, move, code)
    msg = Dict{String, Any}("type" => "case_run", "contract_version" => 1, "case_id" => JuliaTime.MYSTERY_CASE_ID,
        "chapter" => chapter, "move_id" => move, "mode" => "challenge", "activity_id" => nothing,
        "simulation_id" => chapter == "C5" ? JuliaTime.MYSTERY_C5_SIMULATION_ID : nothing, "request_id" => "exam-fit", "code" => code)
    chapter == "C2" && (msg["step"] = move)
    return JuliaTime.handle_message(msg)
end
_xf_lesson_run(lesson, cid, code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => lesson,
    "challenge" => cid, "code" => code, "request_id" => "exam-fit"))

"""The text fields a chapter's payoff is read from: its evidence text or claim, or (C5, which has no evidence entry)
its explanation's case or limit line."""
function _xf_fact_texts(reply)
    ev = get(reply, "evidence", nothing)
    out = String[]
    if ev isa AbstractDict
        for f in ("text", "claim")
            t = get(ev, f, nothing)
            t isa AbstractString && !isempty(t) && push!(out, String(t))
        end
    end
    isempty(out) || return out
    ex = get(reply, "explanation", nothing)
    if ex isa AbstractDict
        for f in ("case", "limit")
            t = get(ex, f, nothing)
            t isa AbstractString && !isempty(t) && push!(out, String(t))
        end
    end
    return out
end

const _XF_STORY_NAMES = ["dying out", "coin flip", "thriving"]
"""The case facts in a text: numbers (1,000 is 1000 and 1.0 is 1), jar, tray and batch ids, and story names. The
"Part N" chapter labels are wording, not facts."""
function _xf_facts(text::AbstractString)
    t = replace(String(text), r"\bPart \d+\b" => "")
    facts = Set{String}()
    for m in eachmatch(r"\b(?:J|R)-\d{2,3}\b", t); push!(facts, "id:" * m.match); end
    for m in eachmatch(r"\bT-[A-Z]\b", t); push!(facts, "id:" * m.match); end
    for m in eachmatch(r"\bB\d{2}\b", t); push!(facts, "id:" * m.match); end
    for m in eachmatch(r"(?<![\w.\-])\d+(?:,\d{3})*(?:\.\d+)?", t)
        x = parse(Float64, replace(m.match, "," => ""))
        push!(facts, "n:" * (isinteger(x) ? string(Int(x)) : string(x)))
    end
    low = lowercase(t)
    for nm in _XF_STORY_NAMES
        occursin(nm, low) && push!(facts, "story:" * nm)
    end
    return facts
end

"""Lesson N's last graded checkpoint, or `nothing`."""
function _xf_last_checkpoint(n)
    path = joinpath(JuliaTime.LESSONS_DIR, "lesson$n.json")
    isfile(path) || return nothing
    l = JuliaTime.load_lesson_file(path)
    cps = [c for (_, c) in _xf_challenges(l) if get(c, "kind", "") == "checkpoint"]
    return isempty(cps) ? nothing : (lesson=l, challenge=last(cps))
end

# The line as written, with comments and spaces set aside: `jars[jars.batch_id .== "B09", :]` and
# `jars[ jars.batch_id .== "B09", : ]  # the case` are the same line.
_xf_as_written(code::AbstractString) = replace(JuliaTime._lesson_strip_comments(code), r"\s+" => "")

_xf_bare(code) = replace(JuliaTime._lesson_strip_comments(String(code)), r"\"(?:[^\"\\]|\\.)*\"" => "\"\"")
const _XF_OPERATORS = [
    ".==" => r"\.==", ".!=" => r"\.!=", ".>=" => r"\.>=", ".<=" => r"\.<=", ".>" => r"\.>(?!=)", ".<" => r"\.<(?!=)",
    ".&" => r"\.&", ".|" => r"\.\|", ".!" => r"\.!(?!=)", "./" => r"\./", ".*" => r"\.\*", "=>" => r"=>", "->" => r"->",
    "|>" => r"\|>", "&&" => r"&&", "||" => r"\|\|", "==" => r"(?<![.=!<>])==(?!=)", "!=" => r"(?<!\.)!=",
    ">=" => r"(?<![.=])>=", "<=" => r"(?<![.=])<=", "=" => r"(?:^|[^=!<>.:+\-*/|&])=(?![=>])",
    "/" => r"(?<![./])/(?!/)", "[ ]" => r"\[", ": for all" => r"[\[,]\s*:\s*[\],]", ":symbol" => r"(?<![\w\])}:]):[A-Za-z_]",
    ";" => r";", "." => r"[A-Za-z_\])]\.[A-Za-z_]",
]
"""The functions and operators a line of code uses."""
function _xf_tokens(code)
    bare = _xf_bare(code)
    toks = Set{String}()
    for m in eachmatch(r"(?<![\w.@])([A-Za-z_][A-Za-z0-9_!]*)\.?\(", bare)
        push!(toks, m.captures[1] * "(")
    end
    for (name, re) in _XF_OPERATORS
        occursin(re, bare) && push!(toks, name)
    end
    return toks
end
"""Everything Lessons 1 to N teach, as code: solutions, starters, check.taught items and dictionary lines."""
function _xf_taught(n)
    toks = Set{String}()
    for k in 1:n
        path = joinpath(JuliaTime.LESSONS_DIR, "lesson$k.json")
        isfile(path) || continue
        l = JuliaTime.load_lesson_file(path)
        for (_, c) in _xf_challenges(l)
            for t in (get(c, "solution", ""), get(c, "starter", ""))
                t isa AbstractString && union!(toks, _xf_tokens(t))
            end
            ch = get(c, "check", nothing)
            ch isa AbstractDict && for t in get(ch, "taught", Any[])
                t isa AbstractString && union!(toks, _xf_tokens(t))
            end
        end
        for row in get(l, "dictionary", Any[])
            j = get(row, "julia", nothing)
            j isa AbstractString && union!(toks, _xf_tokens(j))
        end
    end
    return toks
end

const _XF_INTEGRATION = get(ENV, "JULIATIME_INTEGRATION", "0") == "1"

"""Run a block of @tests in its own test set. Standalone, a failure is caught and reported; returns true when every
test in it passed."""
function _xf_block(f, name)
    if !_XF_STANDALONE
        @testset "$name" begin f() end
        return true
    end
    try
        @testset "$name" begin f() end
        return true
    catch e
        e isa Test.TestSetException || rethrow()
        return false
    end
end

"""P08: for every lesson and exam challenge whose feedback text says "prints <number>", that number is in what Julia
shows for the solution (the reply's `shown`, else its `value_repr`, which E1 replaces). "prints a rate of one whole as
1.0" must find 1.0 in the display."""
const _XF_PRINTS = r"\bprints\b[^0-9\n]{0,40}?(-?\d+(?:\.\d+)?)"i
function _xf_feedback_texts(fb)
    out = String[]
    fb isa AbstractString && return [String(fb)]
    if fb isa AbstractDict
        for (k, v) in fb
            k == "errors" && continue   # an error entry talks about a mistaken line, not the solution
            append!(out, _xf_feedback_texts(v))
        end
    end
    return out
end
function _xf_prints_block()
    for f in sort(filter(f -> occursin(r"^(lesson|exam)\d+\.json$", f), readdir(JuliaTime.LESSONS_DIR)))
        l = _xf_load(f)
        for (_, c) in _xf_challenges(l)
            sol = String(get(c, "solution", ""))
            isempty(strip(sol)) && continue
            nums = String[]
            for t in _xf_feedback_texts(get(c, "feedback", nothing)), m in eachmatch(_XF_PRINTS, t)
                push!(nums, m.captures[1])
            end
            isempty(nums) && continue
            res = _xf_lesson_run(l["id"], c["id"], sol)
            shown = string(get(res, "shown", get(res, "value_repr", "")))
            for num in nums
                @test occursin(num, shown) || (println("$f/$(c["id"]): the feedback says it prints $num but Julia shows: ", shown); false)
            end
        end
    end
end

function _xf_main()
    exams = _xf_exam_files()
    JuliaTime.reload_lessons!()
    if !_XF_INTEGRATION
        @info "test_exam_fit.jl: set JULIATIME_INTEGRATION=1 to run the exam fit checks (they use the sandbox)."
        _XF_STANDALONE && println("EXAM-FIT-SKIPPED (no JULIATIME_INTEGRATION=1)")
        return
    end
    isempty(exams) && @info "test_exam_fit.jl: no lessons/examN.json yet."

    facts_ok = _xf_block("exam facts: shape, inputs, payoff text") do
        for f in exams
            exam = _xf_load(f)
            n = parse(Int, match(r"\d+", f).match)
            ch = "C$n"
            @test get(exam, "id", "") == "exam$n"
            @test get(exam, "kind", "") == "exam"
            @test get(exam, "number", 0) == n
            @test get(exam, "chapter", "") == ch
            all_steps = _xf_challenges(exam)
            steps, twists = _xf_split(all_steps)
            specs = [JuliaTime._lesson_exam_spec(c) for (_, c) in steps]
            @test !isempty(steps) || (println("$f: no chapter move"); false)
            isempty(steps) && continue
            for (r, c) in twists
                setup = get(r, "setup", get(exam, "setup", nothing))
                chck = get(c, "check", Dict())
                @test get(chck, "same_value", false) === true || (println("$f/$(c["id"]): a twist is judged by value (same_value true)"); false)
                @test get(c, "kind", "") == "checkpoint" && get(c, "starter", "x") == "" && !isempty(strip(String(get(c, "solution", ""))))
                @test setup in [s.setup for s in specs] || (println("$f/$(c["id"]): a twist runs in one of the chapter's setups, not $(repr(setup))"); false)
                @test _xf_same_env(JuliaTime.lesson_env(setup), _xf_chapter_inputs(setup)) ||
                    (println("$f/$(c["id"]): twist setup $(repr(setup)) does not bind exactly the chapter's inputs"); false)
            end
            @test all(s -> s.chapter == ch, specs) || (println("$f: a checker belongs to another chapter"); false)
            @test [s.move_id for s in specs] == _XF_MOVES[ch] || (println("$f: moves ", [s.move_id for s in specs], ", want ", _XF_MOVES[ch]); false)
            for ((r, c), s) in zip(steps, specs)
                setup = get(r, "setup", get(exam, "setup", nothing))
                @test setup == s.setup || (println("$f/$(c["id"]): setup $(repr(setup)), its checker runs in $(s.setup)"); false)
                @test _xf_same_env(JuliaTime.lesson_env(s.setup), _xf_chapter_inputs(s.setup)) ||
                    (println("$f: setup $(s.setup) does not bind exactly the chapter's inputs"); false)
            end
            # the payoff: the chapter's last move, run through the Original case_run with the exam's own solution
            last_step = steps[end][2]   # the last MOVE: a twist never supplies the payoff
            reply = _xf_case_run(ch, specs[end].move_id, String(get(last_step, "solution", "")))
            texts = _xf_fact_texts(reply)
            finding = String(get(get(exam, "close", Dict()), "finding", ""))
            want = isempty(texts) ? Set{String}() : union((_xf_facts(t) for t in texts)...)
            got = _xf_facts(finding)
            @test get(reply, "pass", false) === true && !isempty(texts)
            @test got == want ||
                (println("$f: close.finding gives other facts than the chapter's payoff. Missing: ", sort(collect(setdiff(want, got))),
                    " Added: ", sort(collect(setdiff(got, want))), " The chapter says: ", texts); false)
        end
    end
    _XF_STANDALONE && facts_ok && println("EXAM-FACTS-OK")

    prints_ok = _xf_block("P08: a feedback line that says what Julia prints finds that number in what Julia shows") do
        _xf_prints_block()
    end
    _XF_STANDALONE && prints_ok && println("PRINTS-OK")

    fit_ok = _xf_block("exam fit: solutions pass, lessons do not, transfer, taught") do
        for f in exams
            exam = _xf_load(f)
            n = parse(Int, match(r"\d+", f).match)
            ch = "C$n"
            steps, twists = _xf_split(_xf_challenges(exam))
            for (_, c) in twists
                # a twist: the solution passes by value on the chapter's data, saves no chapter move, and says nothing new
                sol = String(get(c, "solution", ""))
                res = _xf_lesson_run(exam["id"], c["id"], sol)
                @test (res["type"] == "lesson_result" && res["pass"] === true) ||
                    (println("$f/$(c["id"]): the twist solution fails its own check: ", get(res, "feedback", res)); false)
                @test !haskey(res, "exam") || (println("$f/$(c["id"]): a twist must not save a chapter move"); false)
            end
            for (_, c) in steps
                sol = String(get(c, "solution", ""))
                res = _xf_lesson_run(exam["id"], c["id"], sol)
                @test (res["type"] == "lesson_result" && res["pass"] === true) ||
                    (println("$f/$(c["id"]): the exam solution fails its wrapper: ", get(res, "feedback", res)); false)
                spec = JuliaTime._lesson_exam_spec(c)
                spec === nothing && continue
                @test haskey(res, "exam") && res["exam"]["chapter"] == ch && res["exam"]["move_id"] == spec.move_id
                orig = _xf_case_run(ch, spec.move_id, sol)
                @test get(orig, "pass", false) === true ||
                    (println("$f/$(c["id"]): the exam solution fails the Original chapter: ", get(orig, "feedback", orig)); false)
            end
            # transfer: Lesson N's last checkpoint, as written, solves no move of Chapter N, and no exam line is that line
            cp = _xf_last_checkpoint(n)
            @test cp !== nothing || (println("$f: lessons/lesson$n.json has no checkpoint"); false)
            cp === nothing && continue
            twin = get(cp.lesson, "setup", "") in JuliaTime.LESSON_TWIN_SETUPS
            lesson_line = String(get(cp.challenge, "solution", ""))
            for (_, c) in vcat(steps, twists)
                passes = get(_xf_lesson_run(exam["id"], c["id"], lesson_line), "pass", false) === true
                same = _xf_as_written(String(get(c, "solution", ""))) == _xf_as_written(lesson_line)
                if !_XF_STANDALONE && !twin
                    @info "test_exam_fit.jl: lesson$n still trains on the case data; its transfer checks against $(c["id"]) are skipped here (the standalone gate runs them)."
                    @test_skip !passes
                    @test_skip !same
                    continue
                end
                @test !passes || (println("$f/$(c["id"]): Lesson $n's last checkpoint passes this move as written: ", lesson_line); false)
                @test !same || (println("$f/$(c["id"]): the exam line is Lesson $n's last checkpoint as written: ", lesson_line); false)
            end
            # every function and operator in an exam line is taught by Lesson N
            taught = _xf_taught(n)
            for (_, c) in vcat(steps, twists)
                missing_toks = setdiff(_xf_tokens(String(get(c, "solution", ""))), taught)
                @test isempty(missing_toks) || (println("$f/$(c["id"]): not taught in Lessons 1 to $n: ", join(sort(collect(missing_toks)), " ")); false)
            end
        end
    end
    _XF_STANDALONE && facts_ok && prints_ok && fit_ok && println("EXAM-FIT-OK")
    _XF_STANDALONE && !(facts_ok && prints_ok && fit_ok) && exit(1)
end

# The pure helpers are pinned whatever the mode.
@testset "exam fit helpers (pure)" begin
    @test _xf_as_written("jars[jars.batch_id .== \"B09\", :]") == _xf_as_written("jars[ jars.batch_id .== \"B09\", : ]  # the case")
    @test _xf_as_written("jars[jars.batch_id .== case_batch, :]") != _xf_as_written("jars[jars.batch_id .== \"B09\", :]")
    @test _xf_as_written("sample(eligible.jar_id, 3; replace=false)") != _xf_as_written("sample(open_jars.jar_id, 3; replace=false)")
    @test _xf_tokens("jars[jars.batch_id .== case_batch, :]") == Set(["[ ]", ".==", ": for all", "."])
    @test "=>" in _xf_tokens("combine(groupby(t, :k), nrow => :n)") && "groupby(" in _xf_tokens("combine(groupby(t, :k), nrow => :n)")
    @test ":symbol" in _xf_tokens("groupby(t, :k)") && !(":symbol" in _xf_tokens("t[r, :]"))
    @test "=" in _xf_tokens("e = a .>= b") && !("=" in _xf_tokens("a .== b")) && !("=" in _xf_tokens("a => b"))
    @test ";" in _xf_tokens("sample(x, 3; replace=false)")
end

# P27: the facts of a payoff are numbers, ids and story names; the wording and the "Part N" labels are free.
@testset "exam facts (pure)" begin
    a = "5 of the 6 B09 jars have springtails in the notebook. Next: which trays are they on?"
    b = "Part 1 done. In the notebook, 5 of the 6 jars of batch B09 have springtails. Next, find their trays."
    @test _xf_facts(a) == _xf_facts(b) == Set(["n:5", "n:6", "id:B09"])
    @test _xf_facts("T-A and T-B 1.0 (both jars), T-C 0.5 and a 0") == Set(["id:T-A", "id:T-B", "id:T-C", "n:1", "n:0.5", "n:0"])
    @test _xf_facts("113 rounds in 1,000, about 1 time in 9") == Set(["n:113", "n:1000", "n:1", "n:9"])
    @test _xf_facts("Coin flip and Thriving can give 5 of 6. Dying out almost never can.") == Set(["story:coin flip", "story:thriving", "story:dying out", "n:5", "n:6"])
    @test _xf_facts("Jars J-092 and J-096") == Set(["id:J-092", "id:J-096"])
    @test _xf_facts(a) != _xf_facts(a * " Six jars on 3 trays.")   # an added fact is caught
    @test match(_XF_PRINTS, "It prints a rate of one whole as 1.0.").captures[1] == "1.0"
    @test match(_XF_PRINTS, "The line has nothing to print") === nothing
end

# A twist is a chapter round with no checker, judged by value, on the chapter's own setup (synthetic exam, no file needed).
@testset "exam twists (pure split, then a synthetic twist in the sandbox)" begin
    move = Dict{String, Any}("id" => "m", "check" => Dict{String, Any}("same_value" => false, "checker" => "check_exam2_group"))
    twist = Dict{String, Any}("id" => "t", "kind" => "checkpoint", "starter" => "", "solution" => "nrow(jars[jars.detected, :])",
        "check" => Dict{String, Any}("same_value" => true))
    moves, twists = _xf_split([(Dict(), move), (Dict(), twist)])
    @test [c["id"] for (_, c) in moves] == ["m"] && [c["id"] for (_, c) in twists] == ["t"]
    @test _xf_is_twist(twist) && !_xf_is_twist(move)
    if _XF_INTEGRATION
        exam = Dict{String, Any}("id" => "exam-twist", "kind" => "exam", "number" => 2, "chapter" => "C2", "title" => "T", "setup" => "case2",
            "rounds" => Any[Dict{String, Any}("id" => "r1", "challenges" => Any[move, twist])], "close" => Dict{String, Any}("finding" => "f"))
        move["kind"] = "checkpoint"; move["starter"] = ""; move["solution"] = "groupby(jars, :tray_id)"
        JuliaTime.reload_lessons!()
        JuliaTime.LESSONS["exam-twist"] = exam
        try
            @test _xf_same_env(JuliaTime.lesson_env("case2"), _xf_chapter_inputs("case2"))
            res = _xf_lesson_run("exam-twist", "t", twist["solution"])
            @test res["pass"] === true && !haskey(res, "exam")
            @test _xf_lesson_run("exam-twist", "t", "nrow(jars)")["pass"] === false
            # the move beside it is unchanged: still a chapter move, still saved
            res = _xf_lesson_run("exam-twist", "m", move["solution"])
            @test res["pass"] === true && res["exam"]["move_id"] == "group"
        finally
            JuliaTime.reload_lessons!()
        end
    end
end

_xf_main()

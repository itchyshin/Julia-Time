# Lessons: data-driven teaching screens. One lesson is one JSON file in lessons/; the format is
# docs/dev-log/course/lesson-format.md. No lesson text or ids live in this file.

const LESSONS_DIR = joinpath(@__DIR__, "..", "lessons")
const LESSONS = Dict{String, Any}()
const _LESSON_SOLUTIONS = Dict{String, Any}()   # "lesson/challenge" -> SandboxResult of the solution
# Never points to the example: at a checkpoint the example is hidden.
const LESSON_FALLBACK_FEEDBACK = "Julia could not run this. Open the Pocket dictionary and check each name and bracket."
# The target range has no pocket dictionary on screen, so its fallback names no dictionary.
const LESSON_RANGE_FALLBACK_FEEDBACK = "Julia could not run this. Read your line again and check each name and bracket."
const LESSON_BRACKET_FEEDBACK = "A closing bracket or the end of the line is missing: every ( or [ needs its ) or ]. Check the ends of your line."
const LESSON_UNCHANGED_FEEDBACK = "This is the line as given. Change one thing first."
const LESSON_NAMING_EQ_FEEDBACK = "Use a single = to give a name; == compares."
const LESSON_KEYWORD_FEEDBACK = "Inside brackets, use .== to compare; a single = gives a name."
# Comma and space slips inside brackets. Each line points at the likely spot and never gives a whole line.
const LESSON_THREE_PARTS_FEEDBACK = "Check the commas inside the square brackets. A table takes two parts, rows then columns, with one comma between them. Several row numbers go together inside their own [ ]."
const LESSON_SPACE_FOR_COMMA_FEEDBACK = "Check the commas inside the square brackets: a space alone does not separate two parts or two items. Put a comma between them."
const LESSON_SEMICOLON_FEEDBACK = "Check the commas inside the square brackets: a semicolon does not separate the parts here. Use a comma."
const LESSON_LIST_COMMA_FEEDBACK = "A list takes one part between its square brackets: one position, or several positions together inside their own [ ]. Check for a comma."
const LESSON_TABLE_TRAILING_COMMA_FEEDBACK = "There is a comma with nothing after it. Put a : after the comma to keep every column."
const LESSON_TABLE_ONE_PART_FEEDBACK = "A table takes two parts inside its square brackets: rows, a comma, then columns. A : keeps every column."

# The exact four-row table of docs/dev-log/ladder/part1-ladder.md section 1e.
lesson_practice_jars() = DataFrame(
    jar_id = ["P-01", "P-02", "P-03", "P-04"],
    batch_id = ["B01", "B02", "B01", "B02"],
    tray_id = ["T-A", "T-A", "T-B", "T-B"],
    detected = [true, false, true, true],
)

"""Named Julia environments a lesson's `setup` can ask for. Built fresh for every run."""
function lesson_env(setup)
    setup == "jars" && return (jars=mystery_jars(), case_batch=MYSTERY_CASE_BATCH, practice_jars=lesson_practice_jars())
    if setup == "jars_b09"   # Lesson 2: `jars` stays the 12-row notebook; `b09` is its six B09 rows, ready for one-line counts
        all_jars = mystery_jars()
        return (jars=all_jars, b09=filter(:batch_id => ==(MYSTERY_CASE_BATCH), all_jars), practice_jars=lesson_practice_jars())
    end
    if setup == "b09_jars"   # The earlier Lesson 2 setup, where `jars` itself was the six B09 rows. No lesson uses it now.
        return (jars=filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars()), practice_jars=lesson_practice_jars())
    end
    if setup == "lists"      # Lesson 3: chapter 3's tray lists (copies, never views)
        c, s, pc, ps = mystery_c3_tray_counts(), mystery_c3_tally_sheet(), mystery_c3_practice_counts(), mystery_c3_practice_sheet()
        trays = String.(c.tray_id); notebook = collect(c.notebook_detected); typed = collect(s.sheet_detected)
        practice_keys = String.(pc.key); practice_notebook = collect(pc.notebook_detected); practice_typed = collect(ps.sheet_detected)
        return (trays=trays, notebook=notebook, typed=typed, box=String.(s.entry_status),
                practice_keys=practice_keys, practice_notebook=practice_notebook, practice_typed=practice_typed,
                records=DataFrame(trays=trays, notebook=notebook, typed=typed),
                practice_records=DataFrame(practice_keys=practice_keys, practice_notebook=practice_notebook,
                                           practice_typed=practice_typed),
                # The paper form as a fourth column, for Lesson 3's last checkpoint: the blank shows before the line names it.
                form_records=DataFrame(trays=trays, notebook=notebook, typed=typed, box=String.(s.entry_status)),
                practice_jars=lesson_practice_jars(),
                jars=filter(:batch_id => ==(MYSTERY_CASE_BATCH), mystery_jars()))
    end
    setup == "chance" && return (sim_counts=mystery_c5_sim_counts(), observed_count=mystery_c5_observed_count(),
                                 practice_jars=lesson_practice_jars())
    if setup == "stories"
        st = mystery_c6_candidates(); oc = mystery_c6_observed_count()
        # fits_low and fits_high are not pre-bound: the player names both, so a line that names only
        # one of them cannot pass on a pre-bound copy of the other.
        # `sim_counts` is Lesson 5's own list of 1,000 pretend rounds: Lesson 6's Coin flip range is where they landed.
        return (stories=st, observed_count=oc, sim_counts=mystery_c5_sim_counts(), practice_jars=lesson_practice_jars())
    end
    setup isa AbstractString && setup in LESSON_EXAM_SETUPS && return lesson_exam_env(setup)
    return lesson_twin_env(setup)
end

# ==== EXAM ENGINE: the six chapters as lesson files (kind "exam"; format: docs/dev-log/course/lesson-format.md) ====
# An exam binds EXACTLY the inputs of its chapter's own case_run (src/mystery*.jl), and each exam challenge is graded by
# a wrapper around that chapter's own checker, with the same input protection (protected bindings, guarded code).
const LESSON_EXAM_SETUPS = ("case1", "case2", "case3", "case3_joined", "case4", "case5", "case6")

"""The inputs of one chapter move, exactly as that chapter's case_run binds them. Built fresh for every run."""
function lesson_exam_env(setup)
    setup == "case1" && return (jars=mystery_jars(), case_batch=MYSTERY_CASE_BATCH)
    setup == "case2" && return (jars=_mystery_c2_input(),)
    setup == "case3" && return (tray_counts=mystery_c3_tray_counts(), tally_sheet=mystery_c3_tally_sheet())
    setup == "case3_joined" && return (joined=mystery_c3_joined(),)
    setup == "case4" && return (eligible=mystery_c4_expected_eligible(),)
    setup == "case5" && return (sim_counts=mystery_c5_sim_counts(), n_jars=MYSTERY_C5_N_JARS, p_ref=MYSTERY_C5_P_REF,
                                observed_count=mystery_c5_observed_count(), n_trials=MYSTERY_C5_N_TRIALS)
    setup == "case6" && return (stories=mystery_c6_candidates(), observed_count=mystery_c6_observed_count(),
                                n_trials=MYSTERY_C6_N_TRIALS)
    return nothing
end

"""C4's pass, as its case_run judges it: the plan, then the re-run under the chance seeds."""
function _exam_c4_check(value, code)
    ok, msg = _mystery_c4_check_plan(value)
    ok || return (false, msg)
    return _mystery_c4_check_chance(String(code))
end

# One entry per chapter move: the move it records (course-state.js KNOWN_MOVES), the setup its inputs come from, the
# bindings its case_run protects, the code guard its case_run wraps the learner's code in (`nothing` for none) and
# the check. The key is the name an exam challenge gives as `check.checker`.
const LESSON_EXAM_CHECKS = Dict{String, NamedTuple}(
    "check_exam1_select_records" => (chapter="C1", move_id="select-records", setup="case1", protected=(),
        guard=nothing, check=(v, c) -> check_mystery_c1(v)),
    "check_exam2_group" => (chapter="C2", move_id="group", setup="case2", protected=(:jars,),
        guard=nothing, check=(v, c) -> check_mystery_c2(v, "group")),
    "check_exam2_counts" => (chapter="C2", move_id="counts", setup="case2", protected=(:jars,),
        guard=nothing, check=(v, c) -> check_mystery_c2(v, "counts")),
    "check_exam2_rates" => (chapter="C2", move_id="rates", setup="case2", protected=(:jars,),
        guard=nothing, check=(v, c) -> check_mystery_c2(v, "rates")),
    "check_exam3_join_report_log" => (chapter="C3", move_id="join-report-log", setup="case3",
        protected=(:tray_counts, :tally_sheet), guard=c -> _mystery_c3_guarded_code(c, (:tray_counts, :tally_sheet)),
        check=(v, c) -> check_mystery_c3(v, "join-report-log")),
    "check_exam3_filter_disagreement" => (chapter="C3", move_id="filter-disagreement", setup="case3_joined",
        protected=(:joined,), guard=c -> _mystery_c3_guarded_code(c, (:joined,)),
        check=(v, c) -> check_mystery_c3(v, "filter-disagreement")),
    "check_exam4_plan_distinct_recheck" => (chapter="C4", move_id="plan-distinct-recheck", setup="case4",
        protected=(:eligible,), guard=_mystery_c4_guarded_code, check=_exam_c4_check),
    "check_exam5_event_mask" => (chapter="C5", move_id="event-mask", setup="case5",
        protected=(:sim_counts, :n_jars, :p_ref, :observed_count, :n_trials), guard=_mystery_c5_guarded_code,
        check=(v, c) -> check_mystery_c5(v, "event-mask"; code=String(c))),
    "check_exam5_event_frequency" => (chapter="C5", move_id="event-frequency", setup="case5",
        protected=(:sim_counts, :n_jars, :p_ref, :observed_count, :n_trials), guard=_mystery_c5_guarded_code,
        check=(v, c) -> check_mystery_c5(v, "event-frequency"; code=String(c))),
    "check_exam6_compatible_models" => (chapter="C6", move_id="compatible-models", setup="case6",
        protected=(:stories, :observed_count, :n_trials), guard=_mystery_c6_guarded_code,
        check=(v, c) -> check_mystery_c6(v)),
)

"""The exam spec of a challenge (its `check.checker` names one), else `nothing`."""
function _lesson_exam_spec(challenge)
    check = get(challenge, "check", nothing)
    name = check isa AbstractDict ? get(check, "checker", nothing) : nothing
    return name isa AbstractString ? get(LESSON_EXAM_CHECKS, name, nothing) : nothing
end

_lesson_is_exam(lesson) = get(lesson, "kind", nothing) == "exam"

"""The setup a challenge runs in: its round's `setup` when the round has one (an exam move whose chapter binds other
inputs, such as C3's second move), else the lesson's."""
function _lesson_setup_for(lesson, challenge)
    for r in get(lesson, "rounds", Any[]), c in get(r, "challenges", Any[])
        c === challenge && haskey(r, "setup") && return r["setup"]
    end
    return get(lesson, "setup", nothing)
end

"""Run the player's code for an exam challenge as its chapter's case_run does: the chapter's inputs, its protected
bindings, and its guard around the code (a parse error is reported on the player's own lines, never the guard's)."""
function _lesson_exam_run(spec, code::String; on_status::Function=((_, __) -> nothing))
    env = lesson_exam_env(spec.setup)
    if spec.guard !== nothing
        parse_error = _mystery_c4_parse_error(code)
        parse_error === nothing || return SandboxResult(:error, nothing, "", _format_error(parse_error))
        code = spec.guard(code)
    end
    return lock(_RUN_LOCK) do
        run_code(code; env=env, budget=RUN_BUDGET, protected_bindings=spec.protected, on_status=on_status)
    end
end

"""How many records an exam pass gave, for the evidence entry the chapter page would write (its `row_count`)."""
function _lesson_exam_row_count(value)
    value isa DataFrames.AbstractDataFrame && return DataFrames.nrow(value)
    value isa DataFrames.GroupedDataFrame && return DataFrames.nrow(_mystery_c2_group_frame(value))
    value isa AbstractVector && return length(value)
    return 1
end

"""What the screen needs to save an exam pass the way the chapter page does (web/lesson-exam-save.js)."""
function _lesson_exam_record(spec, value)
    rec = Dict{String, Any}("chapter" => spec.chapter, "move_id" => spec.move_id,
                            "row_count" => _lesson_exam_row_count(value))
    # C5's frequency is one number; its page counts the rounds it was worked out from.
    spec.move_id == "event-frequency" && (rec["row_count"] = MYSTERY_C5_N_TRIALS)
    if spec.chapter == "C4" && value isa AbstractVector && all(x -> x isa AbstractString, value)
        rec["jar_ids"] = String.(value)
    end
    return rec
end

"""One dictionary row for each name an exam's setups bind (the exam's `setup` and any round's), in order, marked
`from_setup => true`: what it is, never its value. A table gives its rows and columns; a list its length."""
function _lesson_setup_rows(exam)
    setups = Any[get(exam, "setup", nothing)]
    for r in get(exam, "rounds", Any[])
        r isa AbstractDict && haskey(r, "setup") && push!(setups, r["setup"])
    end
    rows = Any[]
    seen = Set{String}()
    for st in unique(setups)
        env = st isa AbstractString ? lesson_env(st) : nothing
        env === nothing && continue
        for k in keys(env)
            name = String(k)
            name in seen && continue
            push!(seen, name)
            v = getfield(env, k)
            means = if v isa DataFrames.AbstractDataFrame
                cols = _mystery_columns(DataFrames.DataFrame(v))
                "A table of the case: $(_lesson_plural(DataFrames.nrow(v), "row", "rows")), with the columns " *
                    (length(cols) == 1 ? cols[1] : join(cols[1:end-1], ", ") * " and " * cols[end]) * "."
            elseif v isa AbstractVector
                "A list of $(_lesson_plural(length(v), "item", "items")) from the case."
            elseif v isa Number
                "A number the chapter gives you."
            elseif v isa AbstractString
                "A text value the chapter gives you."
            else
                continue
            end
            push!(rows, Dict{String, Any}("julia" => name, "means" => means, "from_setup" => true))
        end
    end
    return rows
end

"""An exam's pocket dictionary. First the chapter's own rows (the exam file's `dictionary`, written with the chapter's
real table names), each marked `chapter => N`; then a row for each name the chapter's setups bind that those rows do
not give (`_lesson_setup_rows`, also marked `chapter => N`); then every row of Lessons 1 to N (the exam's number), in
order, each marked `lesson => k`. Each `julia` line appears once. A lesson row with `lesson_only: true` (it names a practice
table, such as `practice_jars`) is left out. Every other field of a row, such as `r` and `py`, passes through."""
function _lesson_exam_dictionary(exam)
    n = get(exam, "number", 0)
    rows = Any[]
    seen = Set{String}()
    keep(row) = Dict{String, Any}(k => v for (k, v) in row if !(k in ("from_round", "from_challenge", "idea", "lesson_only")))
    for row in get(exam, "dictionary", Any[])
        row isa AbstractDict || continue
        j = get(row, "julia", "")
        j isa AbstractString && !(j in seen) || continue
        push!(seen, j)
        out = keep(row)
        out["chapter"] = n
        push!(rows, out)
    end
    # then a row for each name the chapter's own setups bind that the exam's rows do not already give
    for row in _lesson_setup_rows(exam)
        row["julia"] in seen && continue
        push!(seen, row["julia"])
        row["chapter"] = n
        push!(rows, row)
    end
    n isa Integer || return rows
    for k in 1:n
        l = get(LESSONS, "lesson$k", nothing)
        l isa AbstractDict || continue
        for row in get(l, "dictionary", Any[])
            row isa AbstractDict || continue
            get(row, "lesson_only", false) === true && continue
            j = get(row, "julia", "")
            j isa AbstractString && !(j in seen) || continue
            push!(seen, j)
            out = keep(row)
            out["lesson"] = k
            push!(rows, out)
        end
    end
    return rows
end
# ==== end EXAM ENGINE ====

# ==== TWIN DATA: practice1 to practice6 (spec: docs/dev-log/course/twin-data.md) ====
# Look-alike practice data for the six lessons, so a lesson never shows its chapter's answer. Different
# names and values from the case; no case fact. Seeded and deterministic. Old setups above are untouched.
const LESSON_PRACTICE_DATA_LABEL = "Practice data, made up for training. Not the case, so nothing here answers the case."
const LESSON_TWIN_SETUPS = ("practice1", "practice2", "practice3", "practice4", "practice5", "practice6", "range_boss")
const LESSON_TWIN_SIM_SEED = 4242
const LESSON_TWIN_N_CARDS = 8
const LESSON_TWIN_SEEN_COUNT = 6

"""The data label a lesson screen shows: the practice label for the twin setups, the case label otherwise."""
lesson_data_label(setup) = setup in LESSON_TWIN_SETUPS ? LESSON_PRACTICE_DATA_LABEL : MYSTERY_DATA_LABEL

_twin_logbook(ids, batch, trays, detected) = DataFrame(jar_id=ids, batch_id=fill(batch, length(ids)),
                                                       tray_id=trays, detected=detected)

"""Twelve practice jars, two batches (Lesson 1)."""
function _twin_logbook12()
    trays = ["T-D", "T-D", "T-E", "T-E", "T-F", "T-F"]
    vcat(_twin_logbook(["Q-04$i" for i in 1:6], "B04", trays, [true, false, true, true, false, false]),
         _twin_logbook(["Q-05$i" for i in 1:6], "B05", trays, [true, true, false, true, true, false]))
end

"""Fifteen practice jars: six of B04 and nine of B05, three jars a tray (Lesson 2)."""
function _twin_ledger()
    vcat(_twin_logbook(["R-04$i" for i in 1:6], "B04", ["T-D", "T-D", "T-E", "T-E", "T-F", "T-F"],
                       [true, true, false, true, true, false]),
         _twin_logbook(["R-05$i" for i in 1:9], "B05", repeat(["T-D", "T-E", "T-F"]; inner=3),
                       [true, true, false, false, true, false, true, true, false]))
end

"""The target range's boss table (level 11): a bigger practice logbook of 30 jars, four batches (B03 to B06) on four
trays (T-D to T-G). Rows 10 to 21 are Lesson 1's twelve `logbook` jars, unchanged, so every line a player has
learned still works on it. Practice data, made up for training; no case value (twin-data rules)."""
function _twin_boss_logbook()
    vcat(_twin_logbook(["Q-03$i" for i in 1:9], "B03", ["T-G", "T-G", "T-D", "T-D", "T-E", "T-E", "T-F", "T-F", "T-G"],
                       [false, true, true, false, false, true, true, false, true]),
         _twin_logbook12(),
         _twin_logbook(["Q-06$i" for i in 1:9], "B06", ["T-D", "T-D", "T-E", "T-E", "T-F", "T-F", "T-G", "T-G", "T-G"],
                       [true, false, true, true, false, true, false, true, false]))
end

_twin_book_table() = DataFrame(shelf_id=["S-3", "S-1", "S-5", "S-4", "S-2"], logged=[0, 2, 1, 2, 1])
_twin_key_table(shelves, keyed) = DataFrame(shelf_id=shelves, keyed=keyed)

"""The setup of a twin lesson, or `nothing` for any other name. Built fresh for every run."""
function lesson_twin_env(setup)
    setup isa AbstractString && setup in LESSON_TWIN_SETUPS || return nothing
    pj = lesson_practice_jars()
    if setup == "practice1"
        return (logbook=_twin_logbook12(), practice_jars=pj)
    elseif setup == "range_boss"   # the target range's boss level: `logbook` is the 30-jar table
        return (logbook=_twin_boss_logbook(), practice_jars=pj)
    elseif setup == "practice2"
        ledger = _twin_ledger()
        return (ledger=ledger, batch5=filter(:batch_id => ==("B05"), ledger), practice_jars=pj)
    elseif setup == "practice3"
        shelves = ["S-1", "S-2", "S-3", "S-4", "S-5"]
        logged = [2, 1, 0, 2, 1]; keyed = [2, 1, 0, 22, 1]   # the slip: S-4 typed 22 for 2
        entry = ["ok", "ok", "ok", "key pressed twice", "ok"]
        return (shelves=shelves, logged=logged, keyed=keyed, entry=entry,
                desk=DataFrame(shelves=shelves, logged=logged, keyed=keyed),
                form_desk=DataFrame(shelves=shelves, logged=logged, keyed=keyed, entry=entry),
                book_table=_twin_book_table(), key_table=_twin_key_table(shelves, keyed),
                # Lesson 3's typed recall of Lesson 2's rate line: one row for each tray, with n and detected_n.
                counts=DataFrame(tray_id=["T-D", "T-E", "T-F"], n=[3, 3, 3], detected_n=[2, 1, 3]),
                practice_jars=pj)
    elseif setup == "practice4"
        # book_table and key_table are Lesson 3's two tables, here only for round 1's typed recall of the join line.
        return (open_jars=DataFrame(jar_id=["Q-071", "Q-072", "Q-074", "Q-077", "Q-078"]),
                book_table=_twin_book_table(), key_table=_twin_key_table(["S-1", "S-2", "S-3", "S-4", "S-5"], [2, 1, 0, 22, 1]),
                practice_jars=pj)
    end
    rng = Random.MersenneTwister(LESSON_TWIN_SIM_SEED)
    counts = [sum(rand(rng, Bool, LESSON_TWIN_N_CARDS)) for _ in 1:MYSTERY_C5_N_TRIALS]
    if setup == "practice5"
        return (pretend_counts=counts, seen_count=LESSON_TWIN_SEEN_COUNT, practice_jars=pj)
    end
    # practice6: the same three-guess shape as the case's story table, for eight cards
    ps = [0.15, 0.5, 0.85]
    bins = [Distributions.Binomial(LESSON_TWIN_N_CARDS, p) for p in ps]
    guesses = DataFrame(story=["Scarce", "Even split", "Plentiful"], p=ps,
                        lower=[Distributions.quantile(b, 0.1) for b in bins],
                        upper=[Distributions.quantile(b, 0.9) for b in bins])
    return (guesses=guesses, seen_count=LESSON_TWIN_SEEN_COUNT, pretend_counts=counts, practice_jars=pj)
end
# ==== end TWIN DATA ====

# Lesson 4's last checkpoint (setup practice4): three different jars from the lesson's own table, `open_jars`.
const LESSON4_OPEN_SIZE = 3

"""One pick from `open_jars`: a list of three different jar ids, every one in `open_jars`. Returns `(ok, line)`."""
function _lesson4_open_pick(value, allowed)
    value isa DataFrames.AbstractDataFrame && return (false, "Your line gives a whole table, but this step wants a list of three jar ids: pick the jar_id column of open_jars with a dot.")
    value isa AbstractVector && all(x -> x isa AbstractString, value) || return (false, "Return a list of three jar ids from open_jars.")
    length(value) == LESSON4_OPEN_SIZE || return (false, "Pick exactly three jars.")
    all(x -> x in allowed, value) || return (false, "Every jar must come from open_jars: use its jar_id column, not ids you type.")
    length(unique(value)) == LESSON4_OPEN_SIZE || return (false, "The same jar was picked twice. Add replace=false so no jar can come twice.")
    return (true, "")
end

"""The pick is judged as run, then the code runs again under every `MYSTERY_C4_CHANCE_SEEDS` seed with `open_jars`
bound (and protected from being overwritten): a pick that repeats a jar by bad luck fails, and a line that always
gives the same three jars (chosen by hand) fails too. `rerun(code, seed, budget)` is a hook for tests."""
function _check_lesson4_open(; rerun::Function=(code, seed, budget) -> lock(_RUN_LOCK) do
        run_code(code; env=lesson_env("practice4"), seed=seed, budget=budget,
                 protected_bindings=(:open_jars,))
    end, budget::Real=MYSTERY_C4_RERUN_BUDGET, clock::Function=time)
    return function (value, code)
        allowed = Set(String.(lesson_env("practice4").open_jars.jar_id))
        ok, line = _lesson4_open_pick(value, allowed)
        ok || return (false, line)
        rerun_code, _ = _mystery_c4_unseeded(String(code))
        picks = Set{Set{String}}([Set(String.(value))])
        deadline = clock() + budget
        for seed in MYSTERY_C4_CHANCE_SEEDS
            remaining = deadline - clock()
            remaining > 0 || return (false, MYSTERY_C4_SLOW_LINE)
            res = rerun(rerun_code, seed, remaining)
            res.status == :timeout && return (false, MYSTERY_C4_SLOW_LINE)
            res.status == :ok || return (false, "Julia ran your code again to check the pick, and it did not finish. Run it once more.")
            res.value isa AbstractVector && length(res.value) == LESSON4_OPEN_SIZE && length(unique(res.value)) < LESSON4_OPEN_SIZE &&
                return (false, "This run picked three different jars, but when Julia ran your code again it picked the same jar twice. Add replace=false so no jar is drawn twice.")
            ok, line = _lesson4_open_pick(res.value, allowed)
            ok || return (false, "When Julia ran your code again, the pick went wrong: " * line)
            push!(picks, Set(String.(res.value)))
        end
        length(picks) > 1 || return (false, "Julia ran your code again and it picked the same three jars every time. Let chance pick; do not choose the jars yourself.")
        return (true, "")
    end
end
const check_lesson4_case = _check_lesson4_open()

"""One practice pick of `n` jars: a list of ids, the right length, all from practice_jars, none twice.
Returns `(ok, line)`."""
function _lesson4_practice_pick(value, n::Int)
    value isa DataFrames.AbstractDataFrame && return (false, "Your line gives a whole table, but this step wants a list of $n jar ids: pick the jar_id column with a dot.")
    value isa AbstractVector && all(x -> x isa AbstractString, value) || return (false, "Return a list of $n jar ids.")
    length(value) == n || return (false, "Pick exactly $n jars.")
    ids = Set(lesson_practice_jars().jar_id)
    all(x -> x in ids, value) || return (false, "Every pick should be a jar id such as P-01: use the jar_id column.")
    length(unique(value)) == n || return (false, "The same jar was picked twice. Add replace=false so no jar can come twice.")
    return (true, "")
end

"""A pick of `n` practice jars. The run the player saw is judged, then the code runs again under every
`MYSTERY_C4_CHANCE_SEEDS` seed, so a pick that only avoided a repeat by luck (no `replace=false`) fails, and a
line that always gives the same jars (chosen by hand) fails too. `rerun(code, seed)` is a hook for tests."""
function _check_lesson4_practice(n::Int; rerun::Function=(code, seed) -> lock(_RUN_LOCK) do
        run_code(code; env=lesson_env("practice4"), seed=seed, budget=RUN_BUDGET)
    end)
    return function (value, code)
        ok, line = _lesson4_practice_pick(value, n)
        ok || return (false, line)
        picks = Set{Set{String}}([Set(String.(value))])
        orders = Set{Vector{String}}([String.(value)])
        for seed in MYSTERY_C4_CHANCE_SEEDS
            res = rerun(String(code), seed)
            res.status == :ok || return (false, "Julia ran your code again to check the pick, and it did not finish. Run it once more.")
            ok, line = _lesson4_practice_pick(res.value, n)
            ok || return (false, "This run looked fine, but sample picks by chance, and Julia tries your line a few more times. On one try it went wrong. " * line)
            push!(picks, Set(String.(res.value)))
            push!(orders, String.(res.value))
        end
        # picking every jar always gives the same set, so the order must change from run to run instead
        # (a hand-ordered line, `reverse(...)` or `first(..., 4)`, gives one order every time)
        n == nrow(lesson_practice_jars()) && length(orders) == 1 && return (false, "Julia ran your code again and it gave the four jars in the same order every time. Let chance mix them; do not order them yourself.")
        # picking every jar always gives the same set; only a smaller pick can show hand-chosen jars
        n < nrow(lesson_practice_jars()) && length(picks) == 1 && return (false, "Julia ran your code again and it picked the same jars every time. Let chance pick; do not choose the jars yourself.")
        return (true, "")
    end
end

# Lesson 5. Random steps: judged by type and range, and the code by its rand call, never by same_value.
_lesson_is_int(v) = v isa Integer && !(v isa Bool)
"""A random deal of `n` cards, judged by its value, not by its text: a list of `n` true/false values
(`count=false`) or one whole number from 0 to `n` (`count=true`). The player's code is then run `DEAL_TRIES` more
times in one go: every run must be a valid deal, the runs must not all be the same (a typed list or count is), and
a count must sometimes come near `n` (a count made from fewer cards never does; `slack` is how near, `tries` how many runs). So `rand(Bool, n)`,
`rand([true, false], n)` and a count made from either pass. `rerun(wrapped_code, seed)` is a hook for tests; it
returns the list of values."""
const LESSON5_DEAL_TRIES = 60
const LESSON5_DECIMALS_FEEDBACK = "That gave decimals: rand with only a count deals numbers between 0 and 1, not cards that are true or false. Tell rand what to deal: Bool."
function _check_lesson5_deal(n::Int, count::Bool; tries::Int=LESSON5_DEAL_TRIES, slack::Int=3,
                             rerun::Function=(code, seed) -> lock(_RUN_LOCK) do
        run_code(code; env=lesson_env("chance"), seed=seed, budget=RUN_BUDGET)
    end)
    valid(v) = count ? (_lesson_is_int(v) && 0 <= v <= n) : (v isa AbstractVector && length(v) == n && all(x -> x isa Bool, v))
    return function (value, code)
        if value isa AbstractFloat || (value isa AbstractVector && !isempty(value) && all(x -> x isa AbstractFloat, value))
            return (false, LESSON5_DECIMALS_FEEDBACK)
        end
        valid(value) || return (false, "")
        wrapped = "[begin\n" * String(code) * "\nend for _ in 1:$(tries)]"
        res = rerun(wrapped, first(MYSTERY_C4_CHANCE_SEEDS))
        res.status == :ok || return (false, "Julia ran your line again to check it, and it did not finish. Run it once more.")
        res.value isa AbstractVector && all(valid, res.value) || return (false, "")   # the step's own wrong line says what to deal
        seen = unique(vcat(Any[value], collect(Any, res.value)))
        length(seen) == 1 && return (false, "Julia ran your line again and it gave the same answer every time. Let rand deal the cards by luck; do not type them.")
        count && maximum(seen) < n - slack && return (false, "")
        return (true, "")
    end
end
const check_lesson5_flips4 = _check_lesson5_deal(4, false)
const check_lesson5_count10 = _check_lesson5_deal(10, true)
# Eight cards: six cards must be told apart from eight, so the count must come within one of 8 (six never reaches 7).
# That happens in 3.5% of deals, so 300 tries make a correct line fail about 2 times in 100000.
const check_lesson5_count8 = _check_lesson5_deal(8, true; tries=300, slack=1)

const LESSON_CHECKERS = Dict{String, Function}(
    "check_lesson4_case" => check_lesson4_case,
    "check_lesson4_practice_2" => _check_lesson4_practice(2),
    "check_lesson4_practice_3" => _check_lesson4_practice(3),
    "check_lesson4_practice_4" => _check_lesson4_practice(4),
    "check_lesson5_flips4" => check_lesson5_flips4,
    "check_lesson5_count10" => check_lesson5_count10,
    "check_lesson5_count8" => check_lesson5_count8,
    # the exam wrappers (src/lessons.jl EXAM ENGINE), one per chapter move
    (name => spec.check for (name, spec) in LESSON_EXAM_CHECKS)...,
)

"""Code with each `#` comment (outside double-quoted strings) removed, for the `requires` and `forbids` tests."""
function _lesson_strip_comments(code::AbstractString)
    out = IOBuffer()
    in_str = false
    esc = false
    in_comment = false
    for ch in code
        if in_comment
            ch == '\n' && (in_comment = false; write(out, ch))
            continue
        end
        if in_str
            write(out, ch)
            if esc; esc = false
            elseif ch == '\\'; esc = true
            elseif ch == '"'; in_str = false
            end
        elseif ch == '"'
            in_str = true; write(out, ch)
        elseif ch == '#'
            in_comment = true
        else
            write(out, ch)
        end
    end
    return String(take!(out))
end

"""Read one lesson file. Throws on unreadable JSON or a missing id."""
function load_lesson_file(path::AbstractString)
    lesson = JSON.parsefile(path)
    lesson isa AbstractDict && get(lesson, "id", nothing) isa AbstractString ||
        error("$(basename(path)) is not a lesson: it needs a string \"id\".")
    return Dict{String, Any}(lesson)
end

const _LESSONS_LOADED = Ref(false)
# One load at a time. The lesson page sends `lesson_list` and `lesson_info` together on a fresh server; if the
# flag were set before the files were read, the second message would find LESSONS empty ("Unknown lesson").
const _LESSONS_LOCK = ReentrantLock()

"""Load every `*.json` in `dir` into `LESSONS` (replacing what was there). A bad file is skipped with a warning.
The lessons are built aside and swapped in whole, and the loaded flag is set last, so no message can see a
half-filled `LESSONS`."""
function reload_lessons!(dir::AbstractString=LESSONS_DIR)
    lock(_LESSONS_LOCK) do
        fresh = Dict{String, Any}()
        if isdir(dir)
            for f in sort(filter(f -> endswith(f, ".json"), readdir(dir)))
                try
                    lesson = load_lesson_file(joinpath(dir, f))
                    fresh[lesson["id"]] = lesson
                catch e
                    @warn "Skipping lesson file $f" exception=(e,)
                end
            end
        end
        empty!(_LESSON_SOLUTIONS)
        empty!(LESSONS)
        merge!(LESSONS, fresh)
        _LESSONS_LOADED[] = true
        return LESSONS
    end
end

# Lessons load lazily, on the first lesson message in the server process. They must NOT load in
# `__init__`: sandbox workers also load this package, and player code could then read every
# checkpoint solution from `Main.JuliaTime.LESSONS`. Every lesson message (list, info, run) calls this first,
# and a message that arrives while another is loading waits for the load to finish.
function _ensure_lessons!()
    _LESSONS_LOADED[] && return LESSONS
    lock(_LESSONS_LOCK) do
        _LESSONS_LOADED[] || reload_lessons!()
    end
    return LESSONS
end

_lesson_error(message) = Dict{String, Any}("type" => "error", "message" => message)

"""The target range file (`lessons/range.json`, kind "range") is not a lesson: it has waves, not rounds."""
_lesson_is_range(lesson) = get(lesson, "kind", nothing) == "range"

function _lesson_challenges(lesson)
    out = Any[]
    for r in get(lesson, "rounds", Any[]), c in get(r, "challenges", Any[])
        push!(out, c)
    end
    return out
end

_lesson_challenge(lesson, id) = findfirst(c -> get(c, "id", nothing) == id, _lesson_challenges(lesson)) |>
    i -> i === nothing ? nothing : _lesson_challenges(lesson)[i]

"""One table cell as text, the way Julia prints it inside a table: `1.0`, `0.666667`, `true`, `missing`, text
without quotes."""
function _lesson_cell_text(x)
    x isa AbstractString && return String(x)
    x === missing && return "missing"
    x isa Symbol && return String(x)
    return try
        sprint(show, x; context=(:compact => true, :limit => true))
    catch
        "<unprintable $(typeof(x))>"
    end
end

"""A table for the wire. `rows` keep JSON values (JSON has no 1.0: it arrives as 1). With `cells=true` (a run's
result table) it also carries `cells`, Julia's own text for each cell."""
function _lesson_table(df::DataFrames.AbstractDataFrame; cells::Bool=false)
    df = DataFrames.DataFrame(df)
    columns = _mystery_columns(df)
    n = DataFrames.nrow(df)
    out = Dict{String, Any}("columns" => columns,
        "rows" => [Any[_mystery_wire_value(df[i, c]) for c in columns] for i in 1:n])
    cells && (out["cells"] = [String[_lesson_cell_text(df[i, c]) for c in columns] for i in 1:n])
    return out
end

"""The table a value draws as beside the result: a table, one row of a table (as a one-row table, so the
screen never shows a `DataFrameRow` type line), or a true/false list. Otherwise `nothing`."""
function _lesson_value_table(value)
    try
        value isa DataFrames.AbstractDataFrame && return _lesson_table(value; cells=true)
        value isa DataFrames.DataFrameRow && return _lesson_table(DataFrames.DataFrame(value); cells=true)
    catch
        return nothing
    end
    return _lesson_bool_vector(value) ? Dict{String, Any}("columns" => ["value"], "rows" => [Any[x] for x in value]) : nothing
end

_lesson_bool_vector(v) = v isa AbstractVector && !isempty(v) && all(x -> x isa Bool, v)

"""Text display of a value, as Julia prints it (decision D1 of round 2: never rewritten, so a true/false list
prints 1 and 0). Kept for the screen's older paths; `shown` is the field to read."""
function _lesson_repr(value)
    value === nothing && return ""
    return _mystery_safe_repr(value)
end

const LESSON_SHOWN_MAX = 4000
const LESSON_SHOWN_CONTEXT = (:limit => true, :displaysize => (24, 80))

"""Julia's own text/plain print of a value, as the REPL shows it in an 80 by 24 terminal. Never rewritten.
"" for `nothing`. Cut at a line end when longer than `LESSON_SHOWN_MAX` characters."""
function _lesson_shown(value)
    value === nothing && return ""
    s = try
        sprint(show, MIME"text/plain"(), value; context=LESSON_SHOWN_CONTEXT)
    catch
        _mystery_safe_repr(value)
    end
    if length(s) > LESSON_SHOWN_MAX
        s = first(s, LESSON_SHOWN_MAX)
        cut = findlast('\n', s)
        cut === nothing || (s = s[1:prevind(s, cut)])
    end
    return s
end

"""A whole number with a comma for thousands: 1000 gives "1,000"."""
function _lesson_count_text(n::Integer)
    d = string(abs(n))
    parts = String[]
    while length(d) > 3
        pushfirst!(parts, d[end-2:end]); d = d[1:end-3]
    end
    pushfirst!(parts, d)
    return (n < 0 ? "-" : "") * join(parts, ",")
end
_lesson_plural(n, one, many) = _lesson_count_text(n) * " " * (n == 1 ? one : many)

"""The row labels for a list with one item per row of a table the line names: `(table, column, values)`, or
`nothing`. The table is a setup table named in the code (outside a string and not after a dot) with as many rows as
the list has items; failing that, a setup table one of whose columns is a list the setup binds and the code names
(Lesson 3's `logged .!= keyed` is about `desk`). The column is the table's first column of all-different text."""
function _lesson_shown_keys(value, code::AbstractString, env)
    value isa AbstractVector && !isempty(value) && env !== nothing || return nothing
    value isa DataFrames.AbstractDataFrame && return nothing
    bare = _lesson_bracket_text(code)
    used(w) = occursin(Regex("(?<![\\w.])" * w * "(?![\\w])"), bare)
    tables = _lesson_table_names(env)
    fits(t) = DataFrames.nrow(getfield(env, Symbol(t))) == length(value)
    named = [t for t in tables if used(t) && fits(t)]
    if isempty(named)
        lists = [String(k) for k in keys(env) if getfield(env, k) isa AbstractVector && used(String(k))]
        named = [t for t in tables if fits(t) && any(l -> l in _mystery_columns(getfield(env, Symbol(t))), lists)]
    end
    isempty(named) && return nothing
    # the table named first in the code
    t = first(sort(named; by=t -> something(findfirst(Regex("(?<![\\w.])" * t * "(?![\\w])"), bare), 1:1).start))
    df = getfield(env, Symbol(t))
    for c in _mystery_columns(df)
        col = df[!, c]
        if all(x -> x isa AbstractString, col) && allunique(col)
            vals = String.(col)
            isequal(collect(value), vals) && return nothing   # the list is the labels themselves
            return (table=t, column=c, values=vals)
        end
    end
    return nothing
end

"""One plain line above `shown`, or "" when nothing surprises (a single value). See lesson-format.md."""
function _lesson_shown_caption(value, keys)
    if value isa DataFrames.AbstractDataFrame
        return "A table: $(_lesson_plural(DataFrames.nrow(value), "row", "rows")), $(_lesson_plural(DataFrames.ncol(value), "column", "columns"))."
    elseif value isa DataFrames.DataFrameRow
        return "One row of a table."
    elseif value isa DataFrames.GroupedDataFrame
        return "A table split into $(_lesson_plural(length(value), "group", "groups"))."
    elseif _lesson_bool_vector(value)
        n = length(value)
        head = keys === nothing ? "$(_lesson_plural(n, "answer", "answers")), true or false." :
            "$(_lesson_plural(n, "answer", "answers")), one per row of $(keys.table)."
        return head * " Julia prints true as 1 and false as 0."
    elseif value isa AbstractVector
        isempty(value) && return "An empty list. Julia calls a list a Vector."
        return "A list of $(_lesson_plural(length(value), "item", "items")). Julia calls a list a Vector."
    end
    return ""
end

"""Add `shown`, `shown_caption` and `shown_keys` to a run reply. Never throws."""
function _lesson_add_shown!(out::AbstractDict, r, code::AbstractString, env)
    ok = r.status == :ok
    out["shown"] = ok ? _lesson_shown(r.value) : ""
    keys = ok ? (try _lesson_shown_keys(r.value, code, env) catch; nothing end) : nothing
    out["shown_caption"] = ok ? _lesson_shown_caption(r.value, keys) : ""
    out["shown_keys"] = keys === nothing ? nothing :
        Dict{String, Any}("table" => keys.table, "column" => keys.column, "values" => keys.values)
    return out
end

"""The first raw Julia error line (the text after the friendly line, when there is one)."""
function _lesson_short_error(message::AbstractString)
    parts = split(strip(message), "\n\n"; limit=2)
    line = length(parts) == 2 ? parts[2] : parts[1]
    return String(strip(first(split(line, "\n"))))
end

function _lesson_data_value(value, name::AbstractString="value")
    value isa DataFrames.AbstractDataFrame && return _lesson_table(value)
    # A list is sent as a one-column table named after the data name, so the screen can draw it.
    value isa AbstractVector && return Dict{String, Any}("columns" => [String(name)],
        "rows" => [Any[_mystery_wire_value(x)] for x in value])
    return _mystery_wire_value(value)
end

"""The 12 case jars without `detected`, so a board never gives the answer away."""
function _lesson_jars_rack(cases=mystery_jars())
    return [Dict{String, Any}("jar_id" => cases.jar_id[i], "batch_id" => cases.batch_id[i],
                              "tray_id" => cases.tray_id[i]) for i in 1:DataFrames.nrow(cases)]
end

"""The names a setup binds, as strings (empty for an unknown setup)."""
_lesson_env_names(env) = env === nothing ? String[] : String[String(k) for k in keys(env)]

"""The lesson as sent to the screen: no checkpoint solutions, no `check` objects, plus `data_values`."""
function lesson_public(lesson)
    pub = deepcopy(lesson)
    if _lesson_is_range(lesson)
        # The targets are the question and go out; the example is the answer and never does. The `check` (its
        # `requires` and `forbids` name the taught way) stays on the server, like a lesson challenge's.
        for w in get(pub, "waves", Any[])
            w isa AbstractDict || continue
            foreach(k -> delete!(w, k), ("example", "check"))
            # A wave with its own table (the boss level's `jars`, or its own `setup`) carries its own rack and
            # columns. The rack never says which jars were seen, as for every rack.
            wlog = _range_wave_logbook(w)
            if wlog !== nothing
                w["jars"] = _lesson_jars_rack(wlog)
                w["columns"] = _mystery_columns(wlog)
            end
        end
        pub["data_values"] = Dict{String, Any}()
        setup = get(lesson, "setup", nothing)
        pub["data_label"] = lesson_data_label(setup)
        # A practice range draws its rack from the practice logbook, never from the case notebook.
        tw = lesson_twin_env(setup)
        if tw === nothing
            pub["jars"] = _lesson_jars_rack()
        elseif haskey(tw, :logbook)
            pub["jars"] = _lesson_jars_rack(tw.logbook)
            pub["columns"] = _mystery_columns(tw.logbook)   # the column strip above the editor
        end
        return pub
    end
    envs = Dict{Any, Any}()   # setup name -> its env; an exam round may name its own setup
    data_values = Dict{String, Any}()
    for r in get(pub, "rounds", Any[]), c in get(r, "challenges", Any[])
        setup = get(r, "setup", get(lesson, "setup", nothing))
        env = get!(() -> lesson_env(setup), envs, setup)
        delete!(c, "check")
        fb = get(c, "feedback", nothing)
        if fb isa AbstractDict
            for e in get(fb, "errors", Any[])
                e isa AbstractDict && delete!(e, "example")
            end
            foreach(k -> delete!(fb, k), ("taught_way", "also_works"))   # names the format bans; never sent
            delete!(fb, "taught")   # the words for the taught way come back only as `works_too`, after a pass
        end
        get(c, "kind", nothing) == "checkpoint" && delete!(c, "solution")
        # `data` is the table shown; an optional `data_also` names a second table shown under it (an exam round with two inputs).
        for key in ("data", "data_also")
            name = get(c, key, nothing)
            if name isa AbstractString && env !== nothing && haskey(env, Symbol(name))
                data_values[name] = _lesson_data_value(getfield(env, Symbol(name)), name)
            end
        end
    end
    pub["data_values"] = data_values
    pub["data_label"] = lesson_data_label(get(lesson, "setup", nothing))
    # An exam shows the pocket dictionary of Lessons 1 to N, built here from those lesson files so it never drifts.
    _lesson_is_exam(lesson) && (pub["dictionary"] = _lesson_exam_dictionary(lesson))
    # The jars rack: the case notebook's jars without `detected`, so the board never gives the answer away.
    # Never for a practice (twin) setup: the rack is the case notebook, and a practice lesson shows no case row.
    if !(get(lesson, "setup", nothing) in LESSON_TWIN_SETUPS) &&
       any(c -> get(c, "board", nothing) == "jars", _lesson_challenges(lesson))
        pub["jars"] = _lesson_jars_rack()
    end
    return pub
end

function lesson_list_reply(msg::AbstractDict=Dict())
    _ensure_lessons!()
    # The target range has no lesson number: it sorts after every numbered lesson.
    # Chapter N's exam sorts right after Lesson N.
    ls = sort!(collect(values(LESSONS)); by=l -> (_lesson_is_range(l), get(l, "number", 0), _lesson_is_exam(l), get(l, "id", "")))
    entry(l) = begin
        d = Dict{String, Any}("id" => l["id"], "number" => get(l, "number", nothing), "title" => get(l, "title", ""))
        _lesson_is_range(l) && (d["kind"] = "range")
        _lesson_is_exam(l) && (d["kind"] = "exam")
        get(l, "minutes", nothing) isa Integer && (d["minutes"] = l["minutes"])   # the estimated time, for the Board
        d
    end
    return Dict{String, Any}("type" => "lessons", "lessons" => [entry(l) for l in ls])
end

function _lesson_request_id(msg)
    rid = get(msg, "request_id", "")
    return rid isa AbstractString ? String(rid) : ""
end

function lesson_info_reply(msg::AbstractDict)
    _ensure_lessons!()
    id = get(msg, "lesson", nothing)
    lesson = id isa AbstractString ? get(LESSONS, id, nothing) : nothing
    lesson === nothing && return _lesson_error("Unknown lesson: $(repr(id))")
    return Dict{String, Any}("type" => "lesson", "request_id" => _lesson_request_id(msg),
                             "lesson" => lesson_public(lesson))
end

_lesson_feedback(challenge, key) = begin
    fb = get(challenge, "feedback", nothing)
    line = fb isa AbstractDict ? get(fb, key, nothing) : nothing
    line isa AbstractString ? String(line) : ""
end

"""True when `==` was used to give a name: the undefined name starts a line and `==` follows, with more than a
bare name after it (`tray == length(x)`, not `typd == notebook`, which may be a real comparison)."""
function _lesson_naming_with_eq(code::AbstractString, message::AbstractString)
    name = _mystery_undefined_name(message)
    name === nothing && return false
    occursin(r"^[A-Za-z_]\w*$", name) || return false
    bare = _lesson_strip_comments(code)
    for m in eachmatch(Regex("(?:^|\\n)[ \\t]*" * name * "[ \\t]*==(?!=)([^\\n]*)"), bare)
        occursin(r"^\s*[A-Za-z_]\w*\s*$", m.captures[1]) || return true
    end
    return false
end

# ---- Comma and space typos: lines that point at the likely spot, from Julia's own message and the code. ----

"""Code with comments and quoted text removed, for counting brackets."""
_lesson_bracket_text(code::AbstractString) =
    replace(_lesson_strip_comments(code), r"\"(?:[^\"\\\n]|\\.)*\"" => "\"\"")

"""Opening minus closing brackets, by kind. Above 0: something is not closed. Below 0: a closer has no opener."""
function _lesson_bracket_balance(code::AbstractString)
    t = _lesson_bracket_text(code)
    n(c) = Base.count(==(c), t)
    return (round=n('(') - n(')'), square=n('[') - n(']'), curly=n('{') - n('}'))
end

_lesson_brackets_unclosed(code) = any(>(0), values(_lesson_bracket_balance(code)))
_lesson_brackets_extra(code) = any(<(0), values(_lesson_bracket_balance(code)))

"""`(line, column)` of the first `# Error @ none:L:C` in a ParseError report, else `nothing`."""
function _lesson_parse_spot(message::AbstractString)
    m = match(r"# Error @ \S+?:(\d+):(\d+)", message)
    return m === nothing ? nothing : (parse(Int, m.captures[1]), parse(Int, m.captures[2]))
end

"""A few words of the player's code at a parse spot, or "" when the spot cannot be read. It is the word before
the spot and the word at it (with the next word too when the spot is a stray space), cut to whole words."""
function _lesson_spot_text(code::AbstractString, spot)
    spot === nothing && return ""
    lines = split(code, '\n')
    1 <= spot[1] <= length(lines) || return ""
    line = String(lines[spot[1]])
    toks = collect(eachmatch(r"\S+", line))
    isempty(toks) && return ""
    col = spot[2]
    # Match offsets are bytes; the columns Julia reports are characters. They agree for plain code.
    idx = findfirst(t -> length(line[1:prevind(line, t.offset + ncodeunits(t.match))]) >= col, toks)
    in_space = idx !== nothing && length(line[1:prevind(line, toks[idx].offset)]) >= col
    idx === nothing && (idx = length(toks) + 1)
    tail(x, n) = length(x) > n ? String(last(collect(x), n)) : String(x)
    # After the last opening bracket, so `sample(eligible.jar_id` reads `eligible.jar_id`.
    function after_opener(x)
        cut = findlast(in("[({"), x)
        return cut !== nothing && cut < lastindex(x) ? String(x[nextind(x, cut):end]) : String(x)
    end
    parts = String[]
    idx > 1 && push!(parts, tail(after_opener(toks[idx - 1].match), 24))
    idx <= length(toks) && push!(parts, tail(after_opener(toks[idx].match), 24))
    in_space && idx < length(toks) && push!(parts, tail(toks[idx + 1].match, 24))
    return join(parts, " ")
end

"""The kind of bracket still open at a parse spot (`'('`, `'['` or `'{'`), else `nothing`."""
function _lesson_open_bracket_at(code::AbstractString, spot)
    spot === nothing && return nothing
    lines = split(code, '\n')
    1 <= spot[1] <= length(lines) || return nothing
    head = join(lines[1:spot[1] - 1], "\n") * (spot[1] > 1 ? "\n" : "") *
           String(collect(lines[spot[1]])[1:min(max(spot[2] - 1, 0), length(lines[spot[1]]))])
    stack = Char[]
    for ch in _lesson_bracket_text(head)
        ch in "([{" && push!(stack, ch)
        ch in ")]}" && !isempty(stack) && pop!(stack)
    end
    return isempty(stack) ? nothing : last(stack)
end

_lesson_near(text) = isempty(text) ? "" : " near `$(text)`"

"""How many places a table's `getindex` was given (`jars[3, 4, :]` is three), or `nothing` when the error is not that."""
function _lesson_table_index_count(message::AbstractString)
    m = match(r"no method matching getindex\(::DataFrames\.DataFrame((?:, ::(?:[^,(){}\s]|\{[^{}]*\})+)*)\)", message)
    m === nothing && return nothing
    return length(collect(eachmatch(r"::", m.captures[1])))
end

"""A line for a slip that Julia reports as a MethodError or BoundsError about how the brackets were filled in.
Empty when the message is not one of those."""
function _lesson_shape_line(message::AbstractString)
    n = _lesson_table_index_count(message)
    n !== nothing && n >= 3 && return LESSON_THREE_PARTS_FEEDBACK
    occursin("no method matching typed_vcat(", message) && return LESSON_SEMICOLON_FEEDBACK
    (occursin("no method matching typed_hcat(", message) || occursin("2d row vector", message) ||
     occursin("unclear whether you intend to perform an indexing", message)) && return LESSON_SPACE_FOR_COMMA_FEEDBACK
    # A list picked with two places (`notebook[1, 2]`): "There are only 3 items" would be the wrong advice.
    occursin(r"attempt to access \d+-element .* at index \[[^\]]*,", message) && return LESSON_LIST_COMMA_FEEDBACK
    return ""
end

"""A table given one place only (`jars[1:6,]` or `jars[1:6]`)."""
function _lesson_table_one_part_line(message::AbstractString, code::AbstractString)
    _lesson_table_index_count(message) == 1 || return ""
    return occursin(r",\s*\]", _lesson_bracket_text(code)) ? LESSON_TABLE_TRAILING_COMMA_FEEDBACK : LESSON_TABLE_ONE_PART_FEEDBACK
end

"""A name split by a space (`practice jars`, `case batch`): the name Julia does not know, followed by a word that
makes a name the setup does have when joined by an underscore. Empty when it is not that."""
function _lesson_split_name_line(code::AbstractString, message::AbstractString, names)
    name = _mystery_undefined_name(message)
    name === nothing && return ""
    occursin(r"^[A-Za-z_]\w*$", name) || return ""
    bare = _lesson_strip_comments(code)
    for m in eachmatch(Regex("(?<![\\w.])" * name * "[ \\t]+([A-Za-z_]\\w*)"), bare)
        joined = name * "_" * m.captures[1]
        joined in names && return "A name cannot have a space in it: `$(name) $(m.captures[1])` is two names to Julia. Write it as one word, $(joined)."
    end
    return ""
end

"""A column name split by a space (`jars.batch id`): Julia looks for a column called `batch`."""
function _lesson_split_column_line(code::AbstractString, message::AbstractString)
    m = match(r"column name :(\w+) not found", message)
    m === nothing && return ""
    bare = _lesson_strip_comments(code)
    n = match(Regex("\\.\\Q" * m.captures[1] * "\\E[ \\t]+([A-Za-z_]\\w*)"), bare)
    n === nothing && return ""
    return "A column name cannot have a space in it: `$(m.captures[1]) $(n.captures[1])` is read as two names. Write the whole name without spaces."
end

"""A line for a ParseError that names the likely spot, or "" when the shared line is the better answer.
An unclosed bracket keeps its own line; the other slips are told apart by Julia's words and by the brackets."""
function _lesson_parse_help(code::AbstractString, message::AbstractString)
    occursin("ParseError", message) || return ""
    _lesson_brackets_unclosed(code) && return ""
    spot = _lesson_parse_spot(message)
    near = _lesson_spot_text(code, spot)
    reason = _lesson_parse_line(message)
    if occursin("premature end of input", reason)
        return "The line stops too soon: something is still needed$(_lesson_near(near))."
    elseif occursin(r"^Expected `[\)\]\}]`|unexpected comma in array expression|^unexpected `,`|missing last argument in range", reason)
        open = _lesson_open_bracket_at(code, spot)
        kind = open == '(' ? "round " : open == '[' ? "square " : ""
        return "Check the commas inside the $(kind)brackets$(_lesson_near(near)): one may be missing or doubled."
    elseif _lesson_brackets_extra(code) && occursin("extra tokens", reason)
        return "A closing bracket has no opening one before it$(_lesson_near(near)). Every ) and ] needs a ( or [ earlier in the line."
    elseif occursin("whitespace is not allowed", reason) || occursin("whitespace not allowed", reason)
        return "A space is in the wrong place$(_lesson_near(near)). A name and its brackets, and a sign such as .==, are written with no space inside."
    elseif occursin(r"\.\s+[=!<>]|\.[=!<>]+\s+=", _lesson_strip_comments(code))
        return "Check for a space inside a sign such as .== or .!=$(_lesson_near(near)). Write the sign together."
    elseif occursin("extra tokens", reason)
        return "Julia stopped reading$(_lesson_near(near)). Check for a missing comma, or a space inside a name or a sign."
    end
    return ""
end

"""The DataFrame names a setup binds, as strings."""
_lesson_table_names(env) = env === nothing ? String[] :
    String[String(k) for k in keys(env) if getfield(env, k) isa DataFrames.AbstractDataFrame]

"""A whole table given where one column (a list) is needed: `sum(jars)`, `length(jars)`, `sample(practice_jars, 2)`.
Julia says "AbstractDataFrame is not iterable" or "no method matching f(::DataFrame ...)"; the player has met
neither. Returns the coaching line, or "" when the error is not that. `env` gives the example its real table."""
function _lesson_table_for_list_line(code::AbstractString, message::AbstractString; env=nothing)
    fn = nothing
    m = match(r"no method matching ([A-Za-z_]\w*)\(::DataFrames\.DataFrame\b", message)
    m !== nothing && (fn = String(m.captures[1]))
    if fn === nothing && !occursin("AbstractDataFrame is not iterable", message)
        return ""
    end
    fn in ("getindex", "setindex!", "typed_vcat", "typed_hcat", "hcat", "vcat") && return ""
    bare = _lesson_strip_comments(code)
    tables = _lesson_table_names(env)
    known = vcat(tables, ["jars", "practice_jars"])
    # The name the player gave the function: `sum(b09[...])` names b09, `sum(tray)` names tray. A word that is
    # not a setup table (a name the player made) is shown as written, and its columns come from the table it was made from.
    shown = nothing
    mm = fn === nothing ? match(r"(?<![\w.])([A-Za-z_]\w*)\(\s*([A-Za-z_]\w*)\s*[,)\[]", bare) :
        match(Regex("(?<![\\w.])(" * fn * ")\\(\\s*([A-Za-z_]\\w*)\\s*[,)\\[]"), bare)
    if mm !== nothing
        fn === nothing && (fn = String(mm.captures[1]))
        shown = String(mm.captures[2])
    end
    fn === nothing && (fn = "This")
    base = nothing   # the setup table whose columns the example is chosen from
    if shown !== nothing
        if shown in known
            base = shown
        else
            ma = match(Regex("(?<![\\w.])" * shown * "\\s*=(?!=)\\s*([A-Za-z_]\\w*)"), bare)
            ma !== nothing && String(ma.captures[1]) in known && (base = String(ma.captures[1]))
        end
    end
    if base === nothing
        for name in known
            occursin(Regex("(?<![\\w.])" * name * "(?![\\w])"), bare) && (base = name; break)
        end
    end
    base === nothing && (base = isempty(tables) ? "jars" : first(tables))
    shown === nothing && (shown = base)
    df = env !== nothing && base in tables ? getfield(env, Symbol(base)) : nothing
    cols = df === nothing ? String.(MYSTERY_COLUMNS) : String.(_mystery_columns(df))
    counts = fn in ("sum", "count", "mean", "length", "maximum", "minimum")
    numeric(c) = df === nothing ? c == "detected" : eltype(df[!, c]) <: Union{Missing, Bool, Real}
    col = ""
    if counts
        i = "detected" in cols ? findfirst(==("detected"), cols) : findfirst(numeric, cols)
        i === nothing || (col = cols[i])
    elseif !isempty(cols)
        col = "jar_id" in cols ? "jar_id" : first(cols)
    end
    tail = isempty(col) ? " after the table's name." : " like $shown.$col."
    return "$fn needs one column, not the whole table: pick a column with a dot,$tail"
end

"""A count or a sum that came out wrong, from a comparison written without its dot (`sum(typed != 0)`): the
comparison gives one true/false for the whole list. Empty when the code has no undotted comparison sign."""
function _lesson_missing_dot_line(code::AbstractString)
    bare = replace(_lesson_bracket_text(code), r"\s+" => " ")
    m = match(r"(?<![.=!<>])(==|!=|<=|>=)(?![=(])", bare)
    m === nothing && return ""
    sign = m.captures[1]
    return "A comparison sign with no dot gives one answer for the whole list. Put a dot in front, like .$sign, to compare item by item."
end

"""A run whose value is a table where a list is wanted, or a list where a table is wanted. Empty otherwise."""
function _lesson_shape_mismatch_line(value, wanted; code::AbstractString="")
    if value isa DataFrames.AbstractDataFrame && wanted isa AbstractVector
        return "Your line gives a whole table, but this step wants a list: one column of it. Pick a column with a dot after the table's name."
    elseif value isa AbstractMatrix && size(value, 1) == 1 && wanted isa AbstractVector && length(wanted) == size(value, 2)
        return "Your line gives a row, not a list: a space does not separate the items inside [ ]. Put a comma between them."
    elseif value isa AbstractVector && wanted isa DataFrames.AbstractDataFrame
        # The last line gives a new column (`counts.rate = ...`) or names a list: the table's own name is missing
        # as the last line, so Julia shows the list.
        ls = [strip(l) for l in split(_lesson_strip_comments(code), '\n') if !isempty(strip(l))]
        if length(ls) > 1
            m = match(r"^([A-Za-z_]\w*)\.[A-Za-z_]\w*\s*=(?!=)", ls[end])
            m === nothing || return "Your last line gives a list, not the table. End with the table's name, $(m.captures[1]), on a line of its own, so Julia shows the table."
        end
        return "Your line gives a list, but this step wants a table of whole rows. Pick rows, and keep every column."
    end
    return ""
end

# ---- Round 2 (P06): diagnoses that name the actual mistake on the right line ----

"""Edit distance between two words (optimal string alignment: a swap of two neighbouring letters counts as one edit,
so `lenght` is one edit from `length`)."""
function _lesson_edit_distance(a::AbstractString, b::AbstractString)
    s, t = collect(a), collect(b)
    m, n = length(s), length(t)
    d = zeros(Int, m + 1, n + 1)
    for i in 0:m; d[i+1, 1] = i; end
    for j in 0:n; d[1, j+1] = j; end
    for i in 1:m, j in 1:n
        cost = s[i] == t[j] ? 0 : 1
        d[i+1, j+1] = min(d[i, j+1] + 1, d[i+1, j] + 1, d[i, j] + cost)
        if i > 1 && j > 1 && s[i] == t[j-1] && s[i-1] == t[j]
            d[i+1, j+1] = min(d[i+1, j+1], d[i-1, j-1] + 1)
        end
    end
    return d[m+1, n+1]
end

"""How far `w` (the word Julia did not know) is from a known name `c`, or `nothing` when it is not a likely slip.
A slip is: the same word with other capital letters (0); `w` cut short, at least 3 letters (`cou` for `counts`);
or a small spelling slip: 1 edit for words up to 5 letters, 2 edits for longer words. Words of 1 or 2 letters are
slips only with `short=true` (a name the player made, such as `big` for `bi`), and then only 1 edit away."""
function _lesson_slip_distance(w::AbstractString, c::AbstractString; short::Bool=false)
    w == c && return nothing
    lw, lc = lowercase(w), lowercase(c)
    lw == lc && return 0
    d = _lesson_edit_distance(lw, lc)
    n = length(w)
    if n <= 2
        return short && d == 1 ? d : nothing
    end
    length(c) > n && startswith(lc, lw) && return d
    return d <= (n <= 5 ? 1 : 2) ? d : nothing
end

const LESSON_TAUGHT_WORDS = ("length", "sum", "first", "last", "sample", "rand", "shuffle", "combine", "groupby", "nrow",
    "ncol", "leftjoin", "innerjoin", "filter", "count", "mean", "unique", "sort", "Bool", "true", "false", "collect",
    "println", "round", "findall", "isequal", "DataFrame", "names", "only", "maximum", "minimum", "string", "missing",
    "ismissing", "describe", "select", "transform", "subset", "occursin", "startswith")
const _LESSON_KEYWORDS = Set(["for", "in", "end", "if", "else", "elseif", "while", "function", "begin", "let", "do",
    "return", "using", "import", "local", "global", "const", "struct", "module", "try", "catch", "finally", "isa"])

"""Plain names in some code, in order, each once: not after a dot or a colon (columns, symbols), not inside a
string or a comment, not a keyword."""
function _lesson_plain_names(code::AbstractString)
    out = String[]
    for m in eachmatch(r"(?<![\w.:!@$])([A-Za-z_][A-Za-z0-9_!]*)", _lesson_bracket_text(code))
        w = String(m.captures[1])
        w in _LESSON_KEYWORDS || w in out || push!(out, w)
    end
    return out
end

"""The names the code makes with `name = ...`, as `(name, line)`, in order."""
function _lesson_assigned(code::AbstractString)
    out = Tuple{String, Int}[]
    for (i, l) in enumerate(split(_lesson_strip_comments(code), '\n'))
        m = match(r"^\s*([A-Za-z_][A-Za-z0-9_!]*)\s*=(?![=>])", l)
        m === nothing || push!(out, (String(m.captures[1]), i))
    end
    return out
end

"""The first line (1-based) where `w` is used as a plain name, else `nothing`."""
function _lesson_word_line(code::AbstractString, w::AbstractString)
    re = Regex("(?<![\\w.:!@\$])\\Q" * w * "\\E(?![\\w!])")
    for (i, l) in enumerate(split(_lesson_bracket_text(code), '\n'))
        occursin(re, l) && return i
    end
    return nothing
end

_lesson_line_count(code::AbstractString) = count(l -> !isempty(strip(l)), split(_lesson_strip_comments(code), '\n'))

"""The code a step expects (its solution, or a range wave's example), for the names it uses."""
function _lesson_expected_code(challenge)
    for k in ("solution", "example")
        s = get(challenge, k, nothing)
        s isa AbstractString && return String(s)
    end
    return ""
end

"""The setup's tables as `name => columns`."""
function _lesson_env_tables(env)
    env === nothing && return Pair{String, Vector{String}}[]
    return [String(k) => _mystery_columns(DataFrames.DataFrame(getfield(env, k))) for k in keys(env)
            if getfield(env, k) isa DataFrames.AbstractDataFrame]
end

"""How a known name differs from the word typed only in capital letters, as a short clause."""
function _lesson_case_clause(w::AbstractString, c::AbstractString)
    lowercase(w) == lowercase(c) || return ""
    return c == lowercase(c) ? ", in small letters" : ""
end

const LESSON_TAUGHT_VALUES = ("true", "false", "Bool", "missing")

"""Plain names in some code, split by use: `called` are followed by `(` (a function call), the rest are values."""
function _lesson_names_by_use(code::AbstractString)
    t = _lesson_bracket_text(code)
    called, values = String[], String[]
    for w in _lesson_plain_names(code)
        c = occursin(Regex("(?<![\\w.:!@\$])\\Q" * w * "\\E\\s*\\("), t)
        push!(c ? called : values, w)
    end
    return called, values
end

"""A near-miss name: the word Julia does not know is a slip of a name the code makes (rule 1a), or of a name the
setup binds, the step's own line uses or the course teaches (1b). A word used as a function (followed by `(`) is
matched only with functions, and any other word only with values (tables, lists, true and false), so `counts.rate`
is never read as `count`. Also a name used on a line before the line that makes it. "" when none fits."""
function _lesson_near_miss_line(challenge, code::AbstractString, word::AbstractString, env)
    many = _lesson_line_count(code) > 1
    used = _lesson_word_line(code, word)
    made = _lesson_assigned(code)
    # used before it is made
    for (a, i) in made
        if a == word && used !== nothing && used < i
            return "Line $used uses `$word`, but line $i makes it. Put the line that makes `$word` first."
        end
    end
    any(a -> a[1] == word, made) && return ""
    best(cands; short=false) = begin
        pick = nothing
        for c in cands
            d = _lesson_slip_distance(word, c; short=short)
            d === nothing && continue
            (pick === nothing || d < pick[2]) && (pick = (c, d))
        end
        pick
    end
    is_call = occursin(Regex("(?<![\\w.:!@\$])\\Q" * word * "\\E\\s*\\("), _lesson_bracket_text(code))
    if !is_call
        # 1a: a name the code makes
        pa = best([a for (a, _) in made]; short=true)
        if pa !== nothing
            a = pa[1]
            i = last(first(filter(x -> x[1] == a, made)))
            j = used === nothing ? i : used
            i == j && return "This line makes `$a` and also uses `$word`. Spell them the same."
            return "Line $i makes `$a`, but line $j uses `$word`. Spell them the same."
        end
    end
    # 1b: a name of the setup, of the step's own line, or a word the course teaches, of the same use
    sol_called, sol_values = _lesson_names_by_use(_lesson_expected_code(challenge))
    cands = is_call ? vcat(sol_called, [w for w in LESSON_TAUGHT_WORDS if !(w in LESSON_TAUGHT_VALUES)]) :
        vcat(_lesson_env_names(env), sol_values, collect(LESSON_TAUGHT_VALUES))
    pb = best(unique(cands))
    pb === nothing && return ""
    c = pb[1]
    where = many && used !== nothing ? " on line $used" : ""
    return "Julia does not know `$word`$where. Did you mean `$c`$(_lesson_case_clause(word, c))?"
end

"""A table and a column run together (`practice_jarsjar_id`, `logbook_detected`): the dot is missing."""
function _lesson_glued_line(word::AbstractString, env)
    for (t, cols) in _lesson_env_tables(env), c in cols
        (word == t * c || word == t * "_" * c) &&
            return "Julia does not know `$word`: it is `$t` and `$c` run together. Put a dot between the table and the column: `$t.$c`."
    end
    return ""
end

"""A column name that is not in the table, when Julia names a close one: "`logbook` has no column `deected`. Did you
mean `detected`?". "" when Julia names none that is a likely slip (the lesson's own entry then says more)."""
function _lesson_column_slip_line(code::AbstractString, message::AbstractString; env=nothing)
    m = match(r"column name [:\"]?(\w+)\"? not found in the data frame(?:; existing most similar names are: ([^\n]+))?", message)
    m === nothing && return ""
    x = String(m.captures[1])
    t = match(Regex("([A-Za-z_]\\w*)\\s*\\.\\s*\\Q" * x * "\\E(?![\\w])"), _lesson_bracket_text(code))
    sims = m.captures[2] === nothing ? String[] : [String(s.captures[1]) for s in eachmatch(r"[:\"](\w+)\"?", m.captures[2])]
    # Julia names no close column: read the columns of the setup table the code names
    if isempty(sims) && t !== nothing
        for (name, cols) in _lesson_env_tables(env)
            name == t.captures[1] && (sims = cols)
        end
    end
    pick = nothing
    for c in sims
        d = _lesson_slip_distance(x, c)
        d === nothing && continue
        (pick === nothing || d < pick[2]) && (pick = (c, d))
    end
    pick === nothing && return ""
    lead = t === nothing ? "The table has no column `$x`." : "`$(t.captures[1])` has no column `$x`."
    return "$lead Did you mean `$(pick[1])`$(_lesson_case_clause(x, pick[1]))?"
end

"""Text in double quotes that is never closed: the quote count on a line is odd. Returns the line or ""."""
function _lesson_open_quote_line(code::AbstractString, message::AbstractString)
    occursin("ParseError", message) || return ""
    for (i, l) in enumerate(split(_lesson_strip_comments(code), '\n'))
        n = count(==('"'), replace(l, "\\\"" => ""))
        if isodd(n)
            q = findlast('"', l)
            w = match(r"^\"([^\s,\])}]{0,12})", String(l[q:end]))
            start = w === nothing || isempty(w.captures[1]) ? "" : " that starts with `\"$(w.captures[1])`"
            return "The text$start on line $i has no closing \". Put a \" where the text ends."
        end
    end
    return ""
end

const _LESSON_CLOSER = Dict('(' => ')', '[' => ']', '{' => '}')

"""A bracket left open, or closed with the wrong kind, named with its line and the word beside it. Julia's own
report (`Expected )`) does not say which bracket; the scan of the code does. "" when every bracket pairs up."""
function _lesson_bracket_line(code::AbstractString, message::AbstractString)
    occursin("ParseError", message) || return ""
    text = _lesson_bracket_text(code)
    lines = split(text, '\n')
    stack = Tuple{Char, Int, String, Int}[]   # (opener, line, what it is beside, its place among the openers)
    opened = 0
    beside(l, k) = begin
        before = match(r"([A-Za-z_][\w.!]*)$", String(l[1:prevind(l, k)]))
        if before !== nothing
            "after `$(before.captures[1])`"
        else
            after = match(r"^\s*([^\s,()\[\]{}]+)", String(l[nextind(l, k):end]))
            after === nothing ? "" : "before `$(first(after.captures[1], 20))`"
        end
    end
    for (i, l) in enumerate(lines)
        for k in eachindex(l)
            ch = l[k]
            if ch in "([{"
                opened += 1
                push!(stack, (ch, i, beside(l, k), opened))
            elseif ch in ")]}"
                if isempty(stack)
                    return "The $ch on line $i has no opening bracket before it. Remove it, or add the bracket it closes."
                end
                open, li, near, _ = pop!(stack)
                if _LESSON_CLOSER[open] != ch
                    w = isempty(near) ? "" : " $near"
                    return "The $open$w on line $li is closed with $ch. Put $(_LESSON_CLOSER[open]) before the $ch."
                end
            end
        end
    end
    isempty(stack) && return ""
    name(s) = "the " * string(s[1]) * (isempty(s[3]) ? "" : " " * s[3])
    if length(stack) == 1
        open, li, near, at = only(stack)
        w = isempty(near) ? "" : " $near"
        close = _LESSON_CLOSER[open]
        more = any(l -> !isempty(strip(l)), lines[li+1:end])
        # The end of its line is the place for a call's or a table's bracket and for a list's [ (the course writes
        # one step per line). A grouping ( may close earlier when more brackets follow it, so the line says less.
        (startswith(near, "after") || open == '[' || (at == opened && !more)) ||
            return "The $open$w on line $li has no $close. Add $close where that part ends."
        return "The $open$w on line $li has no $close. Add $close at the end of line $li."
    end
    open = reverse(stack)
    same = all(s -> s[2] == open[1][2], open)
    at = same ? " on line $(open[1][2])" : ""
    parts = join([name(s) * (same ? "" : " on line $(s[2])") for s in reverse(open)], " and ")
    order = join([string(_LESSON_CLOSER[s[1]]) for s in open], " then ")
    return "$(length(open)) brackets are still open$at: $parts. Close them in this order: $order."
end

"""A named input written without `=` (`replace false`)."""
function _lesson_keyword_eq_line(code::AbstractString)
    m = match(r"(?<![\w.])(replace|on|dims|rev|by)\s+(true|false|:\w+|\d+)\b", _lesson_bracket_text(code))
    m === nothing && return ""
    return "A named input needs =: write $(m.captures[1])=$(m.captures[2])."
end

"""A number written with a comma for thousands (`1,000`)."""
function _lesson_thousands_line(code::AbstractString)
    m = match(r"(?:^|(?<=[:\s=(]))(\d{1,3}(?:,\d{3})+)(?![\d.])", _lesson_bracket_text(code))
    m === nothing && return ""
    n = replace(m.captures[1], "," => "")
    return "Write $n with no comma: to Julia, $(m.captures[1]) is more than one number."
end

"""A comma missing before a column name with a colon (`groupby(ledger :batch_id)`): Julia reads `ledger :batch_id` as
a range, so it looks for a name `batch_id`."""
function _lesson_missing_comma_symbol_line(code::AbstractString, word::AbstractString, env)
    any(tc -> word in last(tc), _lesson_env_tables(env)) || return ""
    m = match(Regex("([A-Za-z_][\\w.]*)\\s+:\\Q" * word * "\\E(?![\\w])"), _lesson_bracket_text(code))
    m === nothing && return ""
    return "Put a comma between `$(m.captures[1])` and `:$word`: a comma separates the inputs."
end

"""A division of two lists written without its dot (`counts.detected_n / counts.n`)."""
function _lesson_list_divide_line(code::AbstractString)
    occursin(r"[A-Za-z_]\w*\.[A-Za-z_]\w*\s*(?<!\.)/(?!/)\s*[A-Za-z_]\w*\.[A-Za-z_]\w*", _lesson_bracket_text(code)) || return ""
    return "Put a dot before the /: ./ divides the two lists item by item."
end

"""`True`, `FALSE` and friends: Julia writes true and false in small letters."""
function _lesson_bool_spelling_line(word)
    word in ("True", "TRUE", "False", "FALSE", "T", "F") || return ""
    word in ("T", "F") && return ""   # a lesson's own entry says more about R's T and F
    return "Julia writes true and false in small letters: `$(lowercase(word))`, not `$word`."
end

"""R's `by=` in a join: Julia writes `on=`."""
function _lesson_join_by_line(code::AbstractString)
    m = match(r"(?<![\w.])(leftjoin|innerjoin|rightjoin|outerjoin)\s*\([^()]*\bby\s*=\s*([^,)\s]+)", _lesson_bracket_text(code))
    m === nothing && return ""
    return "Julia writes on=$(m.captures[2]), not by=$(m.captures[2])."
end

"""`&`, `&&`, `|`, `||` between two yes/no lists: Julia combines lists item by item with `.&` and `.|`."""
function _lesson_and_or_line(code::AbstractString, message::AbstractString)
    t = _lesson_bracket_text(code)
    if occursin(r"(?<![.&])&&", t) && occursin("non-boolean", message)
        return "&& joins one true or false with another, not two lists. Combine the lists item by item with .&"
    elseif occursin(r"(?<![.|])\|\|", t) && occursin("non-boolean", message)
        return "|| joins one true or false with another, not two lists. Combine the lists item by item with .|"
    elseif occursin(r"(?<![.&])&(?!&)", t) && occursin(r"no method matching &\(::(?:BitVector|Vector|BitArray)", message)
        return "Combine yes/no lists item by item with .& (put a dot in front of the &)."
    elseif occursin(r"(?<![.|])\|(?![|>])", t) && occursin(r"no method matching \|\(::(?:BitVector|Vector|BitArray)", message)
        return "Combine yes/no lists item by item with .| (put a dot in front of the |)."
    end
    # `.&` with a question that is not in brackets: .& runs first, so it meets text or a number
    if occursin(r"\.[&|]", t) && occursin(r"no method matching [&|]\(::", message)
        return "Put each question in its own round brackets, then join them: (question 1) .& (question 2)."
    end
    return ""
end

"""A function call such as `sum(:detected)` inside `combine`, where a pair is wanted."""
function _lesson_combine_pair_line(code::AbstractString)
    m = match(r"(?<![\w.])(sum|mean|length|maximum|minimum|count)\s*\(\s*:(\w+)\s*\)\s*=>\s*:?(\w+)", _lesson_bracket_text(code))
    m === nothing && return ""
    f, col, new = m.captures
    return "In combine, a pair reads column, then function, then new name: :$col => $f => :$new."
end

"""The comparison sign (`==`, `!=`, `<=`, `>=`) the step's own solution asks with, after a dot; "" when it has none."""
function _lesson_solution_sign(solution::AbstractString)
    m = match(r"\.(==|!=|<=|>=)", _lesson_bracket_text(solution))
    return m === nothing ? "" : String(m.captures[1])
end

"""`.=` where a comparison is meant: `.=` stores a value into every row, it does not ask a question. The line names
the sign the step's own solution asks with (`.==`, `.!=`, `.<=`, `.>=`); "" when the solution asks no question."""
function _lesson_dot_assign_line(code::AbstractString, solution::AbstractString=".==")
    occursin(r"(?<![.=!<>])\.=(?![=!<>]|\s*=)", _lesson_bracket_text(code)) || return ""
    occursin(r"(?<![.=!<>])\.=(?![=!<>]|\s*=)", _lesson_bracket_text(solution)) && return ""   # the step itself stores with .=
    sign = _lesson_solution_sign(solution)
    sign == "==" && return "`.=` stores a value, it does not ask a question: write .== (two equals signs) to ask about every row."
    sign == "!=" && return "`.=` stores a value, it does not ask a question: write .!= to ask which rows differ."
    isempty(sign) && return ""
    return "`.=` stores a value, it does not ask a question: write .$sign to ask about every row."
end

"""A dash inside square brackets where a range with a colon is meant (`[1-3]`): Julia reads 1-3 as minus."""
function _lesson_range_dash_line(code::AbstractString; solution::AbstractString="")
    t = _lesson_bracket_text(code)
    m = match(r"\[\s*(\d+)\s*-\s*(\d+)\s*[\],]", t)
    if m === nothing
        # a range the step's own solution writes with a colon (`for _ in 1:1000`), typed with a dash
        for r in eachmatch(r"(?<![\w.:])(\d+):(\d+)(?![\w.:])", _lesson_bracket_text(solution))
            mm = match(Regex("(?<![\\w.-])" * r.captures[1] * "\\s*-\\s*" * r.captures[2] * "(?![\\w.])"), t)
            mm === nothing || (m = r; break)
        end
    end
    m === nothing && return ""
    a, b = m.captures
    return "In Julia the dash is minus, so $a-$b is $(parse(Int, a) - parse(Int, b)), not a range. A range uses a colon: $a:$b."
end

"""The semicolon before a plain input (`sample(list; 3, replace=false)`): the ; goes just before the named input."""
function _lesson_semicolon_line(code::AbstractString)
    m = match(r";\s*([\w.]+)\s*,\s*[A-Za-z_]\w*\s*=(?!=)", _lesson_bracket_text(code))
    m === nothing && return ""
    return "The semicolon is in the wrong place: `$(m.captures[1])` is a plain input, so it goes before the ;. The ; goes just before the named input."
end

"""A plain input after a semicolon (`first(list; 3)`): a semicolon only comes before a named input (`replace=false`),
so the plain input needs a comma. Names the input and shows the line with the comma. "" when the code has no such slip."""
function _lesson_semicolon_plain_line(code::AbstractString)
    m = match(r";\s*([\w.:]+)\s*(?=[,;)])", _lesson_bracket_text(code))
    m === nothing && return ""
    line = ""
    for l in split(_lesson_strip_comments(code), '\n')
        occursin(';', l) && (line = String(strip(l)); break)
    end
    fixed = replace(line, r";\s*" => ", "; count = 1)
    tail = (isempty(line) || length(fixed) > 70 || occursin('"', line)) ? "" : ": $fixed"
    return "Put a comma, not a semicolon, before `$(m.captures[1])`$tail. A semicolon is only for named inputs such as replace=false."
end

"""A list built with round brackets (`(sum(rand(Bool, 10)) for _ in 1:1000)`): a `for` inside ( ) is not a list. The
square brackets go round the whole line. "" when no such bracket is in the code."""
function _lesson_generator_line(code::AbstractString)
    s = collect(_lesson_strip_comments(code))
    stack = Tuple{Char, Int, Bool}[]
    inq = false
    for (i, c) in enumerate(s)
        if c == '"'
            inq = !inq
        elseif !inq
            if c in ('(', '[', '{')
                j = i - 1
                while j >= 1 && s[j] in (' ', '\t'); j -= 1; end
                push!(stack, (c, i, j >= 1 && (isletter(s[j]) || isdigit(s[j]) || s[j] in ('_', ')', ']', '!'))))
            elseif c in (')', ']', '}') && !isempty(stack)
                o, a, call = pop!(stack)
                if o == '(' && c == ')' && !call
                    inner = String(strip(String(s[a+1:i-1])))
                    flat = _lesson_bracket_text(inner)
                    while true
                        nxt = replace(flat, r"\([^()]*\)|\[[^\[\]]*\]|\{[^{}]*\}" => "")
                        nxt == flat && break
                        flat = nxt
                    end
                    occursin(r"\bfor\s+[A-Za-z_]\w*\s+in\b", flat) &&
                        return "Put square brackets round the whole line to keep every result in a list: [$inner], not round brackets."
                end
            end
        end
    end
    return ""
end

"""Square brackets where a call is meant (`sum[logbook.detected]`), or round brackets where a pick is meant
(`logbook(1:3, :)`), read against the step's own solution. "" when the code has neither."""
function _lesson_bracket_kind_line(solution::AbstractString, code::AbstractString)
    sol = _lesson_bracket_text(solution)
    t = _lesson_bracket_text(code)
    for m in eachmatch(r"(?<![\w.:$])([A-Za-z_]\w*)\[", t)
        w = String(m.captures[1])
        occursin(Regex("(?<![\\w.:\$])\\Q" * w * "\\E\\("), sol) &&
            return "`$w` is a function: call it with round brackets, $w(...), not square brackets."
    end
    for m in eachmatch(r"(?<![\w.:$])([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\(", t)
        w = String(m.captures[1])
        occursin(Regex("(?<![\\w.:\$])\\Q" * w * "\\E\\["), sol) &&
            return (n = match(Regex("\\Q" * w * "\\E\\((\\d+)\\)"), t)) !== nothing ?
                "Round brackets call a function; square brackets pick from a list: $w[$(n.captures[1])]." :
                "`$w` is a list, so pick from it with square brackets: $w[...], not round brackets."
    end
    return ""
end

"""A name written in double quotes (`.>= "seen_count"`): in quotes it is text, not the value the name holds. The word must
be a name the step's own solution writes without quotes. "" when the code has none."""
function _lesson_quoted_name_line(solution::AbstractString, code::AbstractString)
    sol_quotes = Set(String(m.captures[1]) for m in eachmatch(r"\"([^\"\n]*)\"", _lesson_strip_comments(solution)))
    names = Set(String(m.match) for m in eachmatch(r"[A-Za-z_]\w*", _lesson_bracket_text(solution)))
    for m in eachmatch(r"\"([A-Za-z_]\w*)\"(?!\s*=(?![=>]))", _lesson_strip_comments(code))   # not a name being made
        q = String(m.captures[1])
        (q in sol_quotes || q in ("true", "false", "missing", "nothing") || !(q in names)) && continue
        return "`$q` is a name, so write it without quote marks: in quotes, \"$q\" is just text."
    end
    return ""
end

"""A new column filled with `==` or `.==` (`counts.rate == counts.detected_n ./ counts.n`): filling a column takes a
single =. Read against the step's own solution, which fills the same column with =. "" when the code has no such line."""
function _lesson_assign_col_eqeq_line(solution::AbstractString, code::AbstractString)
    for m in eachmatch(r"(?m)^[ \t]*([A-Za-z_]\w*\.[A-Za-z_]\w*)[ \t]*=(?![=>])", _lesson_bracket_text(solution))
        col = String(m.captures[1])
        occursin(Regex("(?m)^[ \\t]*\\Q" * col * "\\E[ \\t]*\\.?==(?!=)"), _lesson_bracket_text(code)) &&
            return "Use a single = to fill a new column: write $col = ..., not $col ==."
    end
    return ""
end

"""A column written without its table (`tray_id`, `detected_n`): the step's own solution writes it as `table.column`, so
the line names the table and the dot. "" when the word is a column inside a `combine` or `groupby` (it needs a colon)."""
function _lesson_table_prefix_line(challenge, code::AbstractString, word::AbstractString)
    for m in eachmatch(r"(?<![\w.:$])([A-Za-z_]\w*)\.([A-Za-z_]\w*)(?![\w(])", _lesson_bracket_text(_lesson_expected_code(challenge)))
        String(m.captures[2]) == word || continue
        tb = String(m.captures[1])
        hit = false
        for l in split(_lesson_bracket_text(code), '\n')
            occursin(Regex("(?<![\\w.:\$])\\Q" * word * "\\E(?![\\w])"), l) || continue
            occursin(r"\b(?:combine|groupby)\s*\(", l) && return ""
            hit = true
        end
        hit && return "`$word` is a column: write $tb.$word, with the table name and a dot in front."
    end
    return ""
end

"""An arrow the wrong way round in a `combine` pair (`nrow -> :n`): the pair arrow is `=>`."""
function _lesson_pair_arrow_line(code::AbstractString)
    m = match(r"(:?[A-Za-z_]\w*)\s*->\s*(:[A-Za-z_]\w*)", _lesson_bracket_text(code))
    m === nothing && return ""
    return "The arrow is =>, not ->: write $(m.captures[1]) => $(m.captures[2]), not $(m.captures[1]) -> $(m.captures[2])."
end

"""A slip in a text value that makes the answer empty or wrong without an error: the code's quoted text differs from
the solution's only by capital letters (`"b01"` for `"B01"`), or a number is in quotes (`"1"` for `1`)."""
function _lesson_quote_slip_line(solution::AbstractString, code::AbstractString)
    quotes(s) = [String(m.captures[1]) for m in eachmatch(r"\"([^\"\n]*)\"", _lesson_strip_comments(s))]
    sol = quotes(solution)
    mine = quotes(code)
    for q in mine
        q in sol && continue
        i = findfirst(s -> lowercase(s) == lowercase(q), sol)
        i === nothing || return "Capital letters matter in text: \"$q\" is not the same as \"$(sol[i])\"."
    end
    return _lesson_quoted_number_line(solution, code)
end

"""A number written in quotes (`"3"` for `3`): the step's own solution writes it with no quotes. Julia reads the quoted
one as text, so the slip is the quote marks, whatever else Julia then says (a missing dot, a wrong type). "" when none."""
function _lesson_quoted_number_line(solution::AbstractString, code::AbstractString)
    quotes(s) = [String(m.captures[1]) for m in eachmatch(r"\"([^\"\n]*)\"", _lesson_strip_comments(s))]
    plain = replace(_lesson_strip_comments(solution), r"\"[^\"\n]*\"" => "\"\"")
    for q in quotes(code)
        occursin(r"^\d+(?:\.\d+)?$", q) && occursin(Regex("(?<![\\w\".])\\Q" * q * "\\E(?![\\w\".])"), plain) &&
            return "In quotes, \"$q\" is text, not a number: write $q with no quotes."
    end
    return ""
end

"""A single = where the step's own solution asks a question with == or .== (`logbook.batch_id[7] = "B05"`): a single =
gives a name or stores a value. "" when the code has no such line."""
function _lesson_single_eq_line(solution::AbstractString, code::AbstractString)
    sol = _lesson_bracket_text(solution)
    mine = _lesson_bracket_text(code)
    for m in eachmatch(r"([A-Za-z_][\w.]*(?:\[[^\]\n]*\])?)[ \t]*(\.?)==(?!=)", sol)
        lhs = String(m.captures[1])
        occursin(Regex("(?m)^[ \\t]*\\Q" * lhs * "\\E[ \\t]*=(?![=>])"), sol) && continue
        occursin(Regex("(?m)^[ \\t]*\\Q" * lhs * "\\E[ \\t]*=(?![=>])"), mine) || continue
        return isempty(m.captures[2]) ?
            "A single = gives a name or stores a value, it does not ask a question: write == (two equals signs) to ask whether they are equal." :
            "A single = gives a name or stores a value, it does not ask a question: write .== (a dot and two equals signs) to ask about every row."
    end
    return ""
end

"""Several plain values inside the round brackets of a function that adds up or counts one list
(`sum(true, false, true)`): the values go in square brackets. "" when the code has no such call."""
function _lesson_values_in_list_line(code::AbstractString)
    lit = "(?:true|false|-?\\d+(?:\\.\\d+)?)"
    m = match(Regex("(?<![\\w.])(sum|length|maximum|minimum|mean)\\(\\s*(" * lit * "(?:\\s*,\\s*" * lit * ")+)\\s*\\)"), _lesson_bracket_text(code))
    m === nothing && return ""
    vals = join(strip.(split(m.captures[2], ',')), ", ")
    return "Put the values in square brackets: $(m.captures[1])([$vals]). $(m.captures[1]) takes one list, not separate values."
end

"""A repeat line Julia could not read (`for _ in 1,3`, `for in 1:1000`): says how the step's own repeat reads."""
function _lesson_iteration_line(challenge, message::AbstractString)
    occursin("invalid iteration spec", message) || return ""
    m = match(r"\bfor\s+[A-Za-z_]\w*\s+in\s+[^\]\)\n]+", _lesson_bracket_text(_lesson_expected_code(challenge)))
    m === nothing && return ""
    return "The repeat reads $(strip(m.match)): the word for, a name, the word in, then a range with a colon."
end

"""The shared column of a join named wrong (`on=:shelf`): says the step's own column."""
function _lesson_join_column_line(challenge, code::AbstractString, message::AbstractString)
    occursin(r"column :?\w+ not found in the (left|right) data frame", message) || return ""
    want = match(r"\bon\s*=\s*(:[A-Za-z_]\w*)", _lesson_bracket_text(_lesson_expected_code(challenge)))
    mine = match(r"\bon\s*=\s*(:[A-Za-z_]\w*)", _lesson_bracket_text(code))
    (want === nothing || mine === nothing || want.captures[1] == mine.captures[1]) && return ""
    return "Julia does not find $(mine.captures[1]) in the tables: the shared column is $(want.captures[1]), so write on=$(want.captures[1])."
end

"""A comma where a pair needs =>, inside combine (`nrow, :n`, `:detected, sum, :detected_n`)."""
function _lesson_pair_comma_line(challenge, code::AbstractString)
    occursin("=>", _lesson_expected_code(challenge)) || return ""
    t = _lesson_bracket_text(code)
    m = match(r"(?<![\w.:])(:[A-Za-z_]\w*)\s*,\s*(sum|mean|length|maximum|minimum)\s*,\s*(:[A-Za-z_]\w*)", t)
    m === nothing || return "A pair is joined with =>, not a comma: write $(m.captures[1]) => $(m.captures[2]) => $(m.captures[3])."
    m = match(r"(?<![\w.:])(:[A-Za-z_]\w*)\s*,\s*(sum|mean|length|maximum|minimum)\b", t)
    m === nothing || return "A pair is joined with =>, not a comma: write $(m.captures[1]) => $(m.captures[2])."
    m = match(r"(?<![\w.:])(nrow|sum|mean|length|maximum|minimum)\s*,\s*(:[A-Za-z_]\w*)", t)
    m === nothing || return "A pair is joined with =>, not a comma: write $(m.captures[1]) => $(m.captures[2])."
    return ""
end

# ---- Round 5 (Help): slips read against the step's own solution ----

"""The table-and-column pairs a step can use: every column of the setup's tables, and every `table.column` the step's
own solution writes (so a table the player makes, such as `counts` or `merged`, is covered too)."""
function _lesson_table_columns(challenge, env)
    pairs = Tuple{String, String}[]
    for (t, cols) in _lesson_env_tables(env), c in cols
        push!(pairs, (t, c))
    end
    for m in eachmatch(r"(?<![\w.:$])([A-Za-z_]\w*)\.([A-Za-z_]\w*)", _lesson_bracket_text(_lesson_expected_code(challenge)))
        p = (String(m.captures[1]), String(m.captures[2]))
        p in pairs || push!(pairs, p)
    end
    return pairs
end

"""A table and its column split by a space (`practice_jars detected`): the dot is missing."""
function _lesson_space_for_dot_line(challenge, code::AbstractString, env)
    t = _lesson_bracket_text(code)
    for (tb, col) in _lesson_table_columns(challenge, env)
        occursin(Regex("(?<![\\w.:\$])\\Q" * tb * "\\E[ \\t]+\\Q" * col * "\\E(?![\\w])"), t) &&
            return "Put a dot between the table and the column: write $tb.$col, not $tb $col."
    end
    return ""
end

"""A made name that is a table and a column run together (`countsrate = ...`, `mergedlogged`): the dot is missing."""
function _lesson_glued_pairs_line(word::AbstractString, challenge, env)
    for (tb, col) in _lesson_table_columns(challenge, env)
        (word == tb * col || word == tb * "_" * col) &&
            return "Julia does not know `$word`: it is `$tb` and `$col` run together. Put a dot between the table and the column: `$tb.$col`."
    end
    return ""
end

"""A new name made by `table`+`column` run together on the left of a `=` (`countsrate = counts.detected_n ./ counts.n`):
it runs, and makes a stray name, so the table never gets its column."""
function _lesson_glued_assign_line(solution::AbstractString, code::AbstractString)
    for (a, _) in _lesson_assigned(code), m in eachmatch(r"(?<![\w.:$])([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*=(?![=>])", _lesson_bracket_text(solution))
        a == m.captures[1] * m.captures[2] &&
            return "`$a` is `$(m.captures[1])` and `$(m.captures[2])` run together. Put a dot between the table and the column: $(m.captures[1]).$(m.captures[2])."
    end
    return ""
end

"""R's table-dollar-column, anywhere in the code (a name, a dollar sign, a column): Julia reads a column with a dot."""
function _lesson_dollar_line(code::AbstractString)
    m = match(r"([A-Za-z_]\w*)\$([A-Za-z_]\w*)", _lesson_bracket_text(code))
    m === nothing && return ""
    return "R's \$ does not exist in Julia: write $(m.captures[1]).$(m.captures[2]), not $(m.captures[1])\$$(m.captures[2])."
end

"""The named inputs the step's own solution writes (`replace=false`, `on=:shelf_id`), as `name => value`."""
function _lesson_named_inputs(challenge)
    t = _lesson_bracket_text(_lesson_expected_code(challenge))
    return Pair{String, String}[String(m.captures[1]) => String(m.captures[2])
        for m in eachmatch(r"(?<=[;,(])\s*([A-Za-z_]\w*)\s*=(?![=>])\s*(:?[\w.]+)", t)]
end

"""A named input written with two equals signs (`replace==false`, `on==:shelf_id`)."""
function _lesson_named_eqeq_line(challenge, code::AbstractString)
    t = _lesson_bracket_text(code)
    for (w, _) in _lesson_named_inputs(challenge)
        m = match(Regex("(?<![\\w.])\\Q" * w * "\\E\\s*==\\s*(:?[\\w.]+)"), t)
        m === nothing || return "A named input takes one =: write $w=$(m.captures[1]), not $w==$(m.captures[1])."
    end
    return ""
end

"""A named input given without its name (`leftjoin(a, b, :shelf_id)`, `sample(x, 3; false)`)."""
function _lesson_named_missing_line(challenge, code::AbstractString)
    t = _lesson_bracket_text(code)
    for (w, v) in _lesson_named_inputs(challenge)
        occursin(Regex("(?<![\\w.])\\Q" * w * "\\E\\s*="), t) && continue
        occursin(Regex("[,;]\\s*\\Q" * v * "\\E\\s*[,)]"), t) || continue
        w == "on" && return "Name the shared column with on=: write on=$v after the two tables, so the column goes after on=."
        return "A named input needs its name in front: write $w=$v (the name, one =, then the value)."
    end
    return ""
end

"""A pair written with `=` where the solution has `=>` (`nrow = :n`, `sum = :detected_n`)."""
function _lesson_pair_eq_line(challenge, code::AbstractString)
    t = _lesson_bracket_text(code)
    for m in eachmatch(r"(:?[A-Za-z_]\w*)\s*=>", _lesson_bracket_text(_lesson_expected_code(challenge)))
        w = String(m.captures[1])
        r = match(Regex("(?<![\\w.])\\Q" * w * "\\E\\s*=(?![=>])\\s*(:?[A-Za-z_]\\w*)"), t)
        r === nothing || return "A pair is joined with =>, not =: write $w => $(r.captures[1])."
    end
    return ""
end

"""A named input spelt wrong (`relpace=false`), read from Julia's "unsupported keyword argument" report."""
function _lesson_keyword_typo_line(challenge, message::AbstractString)
    m = match(r"unsupported keyword argument \"(\w+)\"", message)
    m === nothing && return ""
    word = String(m.captures[1])
    for (w, _) in _lesson_named_inputs(challenge)
        _lesson_slip_distance(word, w) === nothing && continue
        return "Julia does not know the named input `$word`. Did you mean `$w`$(_lesson_case_clause(word, w))?"
    end
    return ""
end

"""A column name written without its colon (`groupby(jars, tray_id)`, `on=shelf_id`): Julia reads it as a word."""
function _lesson_missing_colon_line(challenge, word::AbstractString, env)
    syms = Set(String(m.captures[1]) for m in eachmatch(r"(?<![\w:]):([A-Za-z_]\w*)", _lesson_bracket_text(_lesson_expected_code(challenge))))
    word in syms || return ""
    word in _lesson_table_names(env) && return ""
    return "Julia does not know `$word` as a word: a column name needs a colon in front, like :$word."
end

"""Text written without its double quotes (`.== T-E`, `.== B05`): Julia reads the letters as names."""
function _lesson_unquoted_text_line(challenge, code::AbstractString, word::AbstractString)
    plain = _lesson_bracket_text(code)
    for m in eachmatch(r"\"([^\"\n]+)\"", _lesson_strip_comments(_lesson_expected_code(challenge)))
        lit = String(m.captures[1])
        word in split(lit, r"[^A-Za-z0-9_]+") && occursin(lit, plain) &&
            return "Text needs double quotes: write \"$lit\", not $lit."
    end
    return ""
end

"""Slips that run without an error but give a wrong answer, named for the step's own solution. "" when none."""
function _lesson_value_slip_line(solution::AbstractString, code::AbstractString)
    for line in (_lesson_pair_arrow_line(code), _lesson_range_dash_line(code; solution=solution),
                 _lesson_quote_slip_line(solution, code), _lesson_quoted_name_line(solution, code), _lesson_dollar_line(code), _lesson_glued_assign_line(solution, code),
                 _lesson_single_eq_line(solution, code))
        isempty(line) || return line
    end
    return _lesson_dot_assign_line(code, solution)
end

"""A last line that shows the table (`counts`) after an earlier line adds a column to it (`counts.rate = ...`), where
the step's list is that new column. The value is right; only the last line differs, so the step passes."""
function _lesson_new_column_shown(value, wanted, code::AbstractString)
    value isa DataFrames.AbstractDataFrame && wanted isa AbstractVector || return false
    ls = [strip(l) for l in split(_lesson_strip_comments(code), '\n') if !isempty(strip(l))]
    length(ls) > 1 && occursin(r"^[A-Za-z_]\w*$", ls[end]) || return false
    for l in ls[1:end-1]
        m = match(Regex("^" * ls[end] * "\\.([A-Za-z_]\\w*)\\s*=(?!=)"), l)
        m === nothing && continue
        col = String(m.captures[1])
        col in names(value) && _lesson_same(value[!, col], wanted) && return true
    end
    return false
end

"""A CHANGE step whose answer is the table, where the player made exactly the change asked for but their last line is
the line that adds the column (`counts.rate = ...`), so the run gives that column's list. The asked change is right
and the list is the table's new column, so the step passes: the prompt never asks for a last line."""
function _lesson_change_column_shown(challenge, value, wanted, code::AbstractString)
    get(challenge, "kind", nothing) == "change" || return false
    value isa AbstractVector && wanted isa DataFrames.AbstractDataFrame || return false
    ls = [strip(l) for l in split(_lesson_strip_comments(code), '\n') if !isempty(strip(l))]
    isempty(ls) && return false
    m = match(r"^[A-Za-z_]\w*\.([A-Za-z_]\w*)\s*=(?!=)", ls[end])
    m === nothing && return false
    col = String(m.captures[1])
    return col in names(wanted) && _lesson_same(wanted[!, col], value)
end

"""Rule 6 of `_lesson_error_line`: the engine's own diagnoses, tried in this order. "" when none applies."""
function _lesson_diagnosis_line(challenge, code::AbstractString, message::AbstractString; env=nothing)
    for line in (_lesson_open_quote_line(code, message), _lesson_bracket_line(code, message))
        isempty(line) || return line
    end
    for line in (_lesson_generator_line(code), _lesson_bracket_kind_line(_lesson_expected_code(challenge), code))
        isempty(line) || return line
    end
    for line in (_lesson_dot_assign_line(code, _lesson_expected_code(challenge)), occursin("BoundsError", message) ? _lesson_range_dash_line(code) : "",
                 occursin("keyword", message) ? _lesson_semicolon_line(code) : "",
                 occursin("keyword", message) ? _lesson_semicolon_plain_line(code) : "", _lesson_dollar_line(code),
                 _lesson_pair_arrow_line(code), _lesson_pair_eq_line(challenge, code), _lesson_pair_comma_line(challenge, code),
                 occursin("MethodError", message) ? _lesson_values_in_list_line(code) : "",
                 _lesson_join_column_line(challenge, code, message),
                 _lesson_named_eqeq_line(challenge, code), _lesson_named_missing_line(challenge, code),
                 occursin("unsupported keyword", message) ? _lesson_keyword_typo_line(challenge, message) : "")
        isempty(line) || return line
    end
    if occursin("ParseError", message) || occursin("MethodError", message)
        for line in (_lesson_keyword_eq_line(code), _lesson_thousands_line(code))
            isempty(line) || return line
        end
    end
    if occursin("ParseError", message)
        line = _lesson_iteration_line(challenge, message)
        isempty(line) || return line
    end
    word = _lesson_unknown_word(message, code)
    if word !== nothing
        for line in (_lesson_glued_pairs_line(word, challenge, env), _lesson_bool_spelling_line(word),
                     _lesson_missing_comma_symbol_line(code, word, env), _lesson_table_prefix_line(challenge, code, word),
                     _lesson_missing_colon_line(challenge, word, env),
                     _lesson_unquoted_text_line(challenge, code, word), _lesson_near_miss_line(challenge, code, word, env))
            isempty(line) || return line
        end
    end
    line = _lesson_quoted_name_line(_lesson_expected_code(challenge), code)
    isempty(line) || return line
    # R's c(...) and library(...), read from the code when Julia does not know the word
    word == "c" && occursin(r"(?<![\w.])c\s*\(", _lesson_bracket_text(code)) && return MYSTERY_R_C_LINE
    word in ("library", "require") && return MYSTERY_R_LIBRARY_LINE
    occursin("%>%", code) && return MYSTERY_R_PIPE_LINE
    if occursin("UndefVarError: `\$` not defined", message)
        tables = Tuple(Symbol(t) => Symbol.(cols) for (t, cols) in _lesson_env_tables(env))
        line = try
            _mystery_dollar_line(code, _mystery_code_text(code), tables)
        catch
            ""
        end
        isempty(line) || return line
    end
    line = _lesson_column_slip_line(code, message; env=env)
    isempty(line) || return line
    if occursin("MethodError", message) || occursin("unsupported keyword", message)
        line = _lesson_join_by_line(code)
        isempty(line) || return line
    end
    line = _lesson_and_or_line(code, message)
    isempty(line) || return line
    # a comparison with no dot, where the step's answer has one, that Julia met as a list against a number
    if occursin("MethodError", message) && occursin(r"\.(==|!=|<=|>=)", _lesson_expected_code(challenge))
        line = _lesson_missing_dot_line(code)
        isempty(line) || return line
    end
    line = _lesson_list_divide_line(code)
    isempty(line) || return line
    if occursin("MethodError", message) && occursin("combine", code)
        line = _lesson_combine_pair_line(code)
        isempty(line) || return line
    end
    return ""
end

# A lesson entry whose `match` is only an error kind (or Julia's general words for a parse slip or a missing column)
# is a catch-all: the engine's diagnoses above run before it. Any other `match` names the slip itself and runs first.
const LESSON_GENERIC_MATCHES = ("UndefVarError", "MethodError", "BoundsError", "ParseError", "TypeError", "ArgumentError",
    "Expected `)`", "Expected `]`", "Expected `}`", "premature end of input", "column name", "not found")

"""When the word Julia did not know has no capital letter, a catch-all line's advice about capital letters does not
fit. The clauses that only say "small letters" are removed; the names the line gives stay."""
function _lesson_drop_capitals_advice(say::AbstractString, word)
    word === nothing && return String(say)
    any(isuppercase, word) && return String(say)
    s = String(say)
    s = replace(s, r"(?:^|(?<=\. ))[^.]*\bare all (?:in )?(?:small letters|lower case)\.\s*" => "")
    s = replace(s, r": no capital letters, and an underscore\." => ", with an underscore.")
    s = replace(s, r",? and no capital letters(?=[.,])" => "")
    s = replace(s, r":? ?(?:with )?no capital letters(?=[.,])" => "")
    s = replace(s, r",? (?:all )?(?:in )?small letters(?=[.,])" => "")
    s = replace(s, r",? (?:all )?(?:in )?lower case(?=[.,])" => "")
    s = replace(s, r"\s+" => " ")
    s = replace(s, r" \." => ".")
    return String(strip(s))
end

"""The word Julia says it does not know, from its own message (`UndefVarError: `x` not defined`), or `nothing`.
Only a plain name: a word with odd characters, or a very long one, is never echoed back. With `code`, only a word the
player typed (outside text and comments): Julia also reports names of its own machinery (`Sandbox`, the throw-away module
a lazy value points back to), and a player must never be told they mistyped a word they did not write."""
function _lesson_unknown_word(message::AbstractString, code=nothing)
    m = match(r"UndefVarError: `([^`]+)` not defined", message)
    m === nothing && return nothing
    w = String(m.captures[1])
    occursin(r"^[A-Za-z_][A-Za-z0-9_!]*$", w) && length(w) <= 30 || return nothing
    code === nothing && return w
    occursin(Regex("(?<![\\w])\\Q" * w * "\\E(?![\\w])"), _lesson_bracket_text(code)) || return nothing
    return w
end

"""A lesson's line for an unknown word, with the word the player typed named in it. The entries are written about
the lesson's own tables ("the table is logbook"), which reads oddly when the player typed `x`: the line now starts
with the word Julia did not know, and the lesson's sentence follows. A leading "Julia does not know that word" or
"Julia does not know one of the words (in your line)" is replaced by the named word, so the idea is said once, and
advice about capital letters is dropped when the word has none."""
function _lesson_name_the_word(say::AbstractString, word)
    word === nothing && return String(say)
    occursin("`$word`", say) && return String(say)
    lead = match(r"^Julia does not know (?:that (?:word|name)|one of (?:the|your) words(?: in your line)?)([.:])\s*", say)
    rest = lead === nothing ? String(say) : String(say[lead.offset + ncodeunits(lead.match) : end])
    rest = _lesson_drop_capitals_advice(rest, word)
    sep = lead === nothing ? "." : lead.captures[1]
    isempty(rest) && return "Julia does not know the word `$word`. Check its spelling."
    return "Julia does not know the word `$word`" * sep * " " * rest
end

"""A lesson's own `feedback.errors` entry for this error, or "". `generic` picks the catch-all entries (their `match`
is only an error kind, see `LESSON_GENERIC_MATCHES`) or the specific ones. The skips keep an entry from misleading:
an entry about `<-` when the code has no `<-`; `code_has` and `code_lacks`; a catch-all for a MethodError, a
BoundsError or any table getindex when the shape line names the real slip; a bare MethodError line when the whole
table was given for one column; "a bracket is not closed" when every bracket is closed; "put each line on its own
line" when a bracket closes twice."""
function _lesson_entry_line(challenge, code, message; generic::Bool, shape="", table_line="", parse_help="")
    fb = get(challenge, "feedback", nothing)
    errs = fb isa AbstractDict ? get(fb, "errors", Any[]) : Any[]
    has_arrow = occursin("<-", code)
    bare = _lesson_strip_comments(code)
    for e in errs
        e isa AbstractDict || continue
        m = get(e, "match", nothing)
        say = get(e, "say", nothing)
        m isa AbstractString && say isa AbstractString && !isempty(m) && occursin(m, message) || continue
        (m in LESSON_GENERIC_MATCHES) == generic || continue
        occursin("<-", say) && !has_arrow && continue
        need = get(e, "code_has", nothing)
        need isa AbstractString && !occursin(need, bare) && continue
        lacks = get(e, "code_lacks", nothing)
        lacks isa AbstractString && !isempty(lacks) && occursin(lacks, bare) && continue
        !isempty(shape) && m in ("MethodError", "BoundsError", "getindex(::DataFrames.DataFrame") && continue
        !isempty(table_line) && m == "MethodError" && !occursin("table", say) && continue
        # A catch-all that says a bracket is missing, open or extra is wrong when every bracket pairs up (a doubled
        # comma or a space inside a sign stopped Julia): the parse-help line then names the real slip.
        generic && !_lesson_brackets_unclosed(code) && !_lesson_brackets_extra(code) && !occursin(r"comma|colon"i, say) &&
            occursin(r"check the brackets|bracket is open|needs a [\)\]\}]|every [\[(] needs|close every|extra bracket|add the missing [\)\]\}]"i, say) && continue
        if !isempty(parse_help)
            startswith(m, "Expected `") && !occursin("comma", say) &&
                occursin(r"not closed|did not close|closing|Every [\[(]", say) && continue
            startswith(m, "extra tokens") && _lesson_brackets_extra(code) && continue
        end
        line = _lesson_render_entry(m, say, code, message)
        isempty(line) || return line
    end
    return ""
end

"""An entry's `say` as the player sees it: a bracket entry keeps only what fits the code, and an UndefVarError entry
starts by naming the word. "" when nothing of it fits (the next rule then answers)."""
function _lesson_render_entry(m::AbstractString, say::AbstractString, code::AbstractString, message::AbstractString)
    startswith(m, "Expected `") && (say = _lesson_bracket_entry_text(say, code, message))
    isempty(say) && return ""
    return m == "UndefVarError" ? _lesson_name_the_word(say, _lesson_unknown_word(message, code)) : String(say)
end

"""A bracket entry ("Close every bracket ... Put a comma between Bool and the number.") says two things; keep only
what fits the code. "Close every bracket" goes when every bracket pairs up; a sentence about a comma goes when the
spot Julia stopped at already has one. "" when nothing fits."""
function _lesson_bracket_entry_text(say::AbstractString, code::AbstractString, message::AbstractString)
    sentences = [String(strip(m.match)) for m in eachmatch(r"[^.]+(?:\.|$)", say) if !isempty(strip(m.match))]
    closed = !_lesson_brackets_unclosed(code) && !_lesson_brackets_extra(code)
    near = _lesson_spot_text(code, _lesson_parse_spot(message))
    keep = String[]
    for t in sentences
        closed && occursin(r"^(?:Close every bracket|Close each bracket|Every [\[(]|Each [\[(])", t) && continue
        occursin(",", near) && occursin(r"\bcomma\b", t) && continue
        push!(keep, t)
    end
    return join(keep, " ")
end

"""The line the player sees when a run fails. The first rule that gives a line wins, in this order:

 1. a blank `___` still in the code;
 2. R's arrow `<-`;
 3. `==` used to give a name;
 4. a name or a column split by a space (`practice jars`, `jars.batch id`), or a comma missing before a column
    with its colon (`groupby(ledger :batch_id)`, which Julia reads as a range and so looks for a name `batch_id`);
 5. the lesson's own specific `feedback.errors` entries (their `match` names the slip itself, such as `` `True` ``
    or `&(::BitVector`): the lesson knows its step best;
 6. the engine's diagnoses (`_lesson_diagnosis_line`), which read the code and Julia's message to name the actual
    mistake on the right line: text with no closing quote; a bracket left open or closed with the wrong kind (named,
    with its line); a named input without `=` (`replace false`); a number with a thousands comma (`1,000`); a table
    and a column run together (`practice_jarsjar_id`); `True` or `FALSE`; a near-miss name (a slip of a name the code
    makes, "Line 1 makes `conts`, but line 2 uses `counts`", then of a setup name, a name in the step's own line
    or a taught word, matched by use: a function with functions, a value with values); R's `\$`; a column name Julia finds close to one it has; R's `by=`
    in a join; `&`, `&&`, `|`, `||` on lists and `.&` without brackets; a function call inside a `combine` pair;
 7. the lesson's catch-all entries (`match` is only an error kind: `UndefVarError`, `MethodError`, `Expected `)``,
    `column name` ...; see `LESSON_GENERIC_MATCHES`), with the unknown word named and one idea per sentence;
 8. the shared lines: a whole table where one column is needed, the bracket-shape lines, positions out of range,
    too many picks, a keyword inside brackets, round brackets on a value, the R and Python coaching lines, the
    parse-help line, Julia's parse reason, the unknown-word line, and the fallback.

A near-miss rule must stay before step 7: a lesson's catch-all for UndefVarError ("Each Run starts fresh, so
build counts again") is wrong advice for a typo, and it would otherwise answer first. `names` are the names the
setup binds; `range=true` (the target range, which has no pocket dictionary) keeps the dictionary out of the lines."""
function _lesson_error_line(challenge, code, message; names=(), env=nothing, range::Bool=false)
    # One last check: never ask for a dot the code already has before that sign (a step's "Add a dot before <="
    # entry matches Julia's isless error, which a text column or a quoted value also gives; Pat's final check).
    line = _lesson_error_line_raw(challenge, code, message; names=names, env=env, range=range)
    m = match(r"^Add a dot before (\S+?)\.", line)
    m === nothing && return line
    op = m.captures[1]
    plain = _lesson_strip_comments(code)
    # only when every such sign has its dot: a line with one dotted and one bare sign still needs the dot
    occursin(Regex("\\.\\Q" * op * "\\E"), plain) && !occursin(Regex("(?<![.<>=!])\\Q" * op * "\\E"), plain) || return line
    return occursin("String", message) ?
        "The dot is already there. One side of $op is text, so Julia cannot compare it with a number: use a column of numbers and a number with no quotes." :
        "The dot is already there. Julia cannot compare these two values with $op: check that both sides are numbers."
end

function _lesson_error_line_raw(challenge, code, message; names=(), env=nothing, range::Bool=false)
    # A changed protected input is the game's own note: say it, as it is written.
    note = _lesson_protected_note(message)
    if !isempty(note)
        # `.=` stores into the supplied table, which is why it changed: say that first
        dot = _lesson_dot_assign_line(code, _lesson_expected_code(challenge))
        return isempty(dot) ? note : dot * " " * note
    end
    occursin("___", code) && return "Replace ___ with your answer, then run."
    arrow = _mystery_r_arrow_note(code)
    isempty(arrow) || return arrow
    _lesson_naming_with_eq(code, message) && return LESSON_NAMING_EQ_FEEDBACK
    word = _lesson_unknown_word(message, code)
    # A table and its column split by a space: only a lost dot explains it, so it answers before the lesson's entries.
    line = _lesson_space_for_dot_line(challenge, code, env)
    isempty(line) || return line
    # Slips the code itself shows, whatever Julia then says about them: `.=` for a question, a new column filled with
    # ==, and a column written without its table.
    sol_now = _lesson_expected_code(challenge)
    # A number in quotes: the step's own line wins only when it is about the quotes too (it is written for that step);
    # a step line about anything else, such as a missing dot, points the wrong way here (round 7, Pat's final check).
    quoted = _lesson_quoted_number_line(sol_now, code)
    if !isempty(quoted)
        own = _lesson_entry_line(challenge, code, message; generic=false, shape=_lesson_shape_line(message),
                                 table_line=_lesson_table_for_list_line(code, message; env=env),
                                 parse_help=_lesson_parse_help(code, message))
        return occursin(r"quot"i, own) ? own : quoted
    end
    # A dotted comparison with a number in quotes, where the step's solution names no number (a fix step that uses
    # seen_count): Julia's isless error is about the quotes, never a missing dot, because the dot is there.
    qn = match(r"\"(\d+(?:\.\d+)?)\"", _lesson_strip_comments(code))
    if qn !== nothing && occursin("isless", message) && occursin(r"\.(?:<=|>=|<|>)", code) &&
       !occursin(r"(?<![.<>=!])(?:<=|>=|<(?!=)|>(?!=))", replace(code, r"\"[^\"\n]*\"" => "\"\""))
        q = qn.captures[1]
        return "In quotes, \"$q\" is text, not a number: write $q with no quotes."
    end
    for line in (_lesson_single_eq_line(sol_now, code),
                 _lesson_solution_sign(sol_now) == "==" ? "" : _lesson_dot_assign_line(code, sol_now),
                 _lesson_assign_col_eqeq_line(_lesson_expected_code(challenge), code),
                 word === nothing ? "" : _lesson_table_prefix_line(challenge, code, word))
        isempty(line) || return line
    end
    # A name in quotes is text, whatever else Julia then says about it (a missing dot, a wrong type).
    if word === nothing
        line = _lesson_quoted_name_line(_lesson_expected_code(challenge), code)
        isempty(line) || return line
    end
    for line in (_lesson_split_name_line(code, message, names), _lesson_split_column_line(code, message),
                 word === nothing ? "" : _lesson_missing_comma_symbol_line(code, word, env))
        isempty(line) || return line
    end
    # A whole table where one column is needed: a lesson's own line about a table (its say names "table") still
    # wins, but its bare MethodError line is written for a wrong number of inputs, so it steps aside.
    table_line = _lesson_table_for_list_line(code, message; env=env)
    shape = _lesson_shape_line(message)
    parse_help = _lesson_parse_help(code, message)
    line = _lesson_entry_line(challenge, code, message; generic=false, shape=shape, table_line=table_line, parse_help=parse_help)
    isempty(line) || return line
    line = try
        _lesson_diagnosis_line(challenge, code, message; env=env)
    catch
        ""
    end
    isempty(line) || return line
    line = _lesson_entry_line(challenge, code, message; generic=true, shape=shape, table_line=table_line, parse_help=parse_help)
    isempty(line) || return line
    isempty(table_line) || return table_line
    isempty(shape) || return shape
    bounds = _lesson_bounds_line(message)
    isempty(bounds) || return bounds
    one_part = _lesson_table_one_part_line(message, code)
    isempty(one_part) || return one_part
    occursin("Cannot draw more samples without replacement", message) &&
        return "You asked for more picks than the list holds, and with replace=false no pick can come twice. Ask for no more than the list has."
    occursin("invalid keyword argument", message) && return LESSON_KEYWORD_FEEDBACK
    if occursin("are not callable", message)
        m = match(r"([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\((\d+)\)", code)
        m === nothing || return "Round brackets call a function; square brackets pick from a list: $(m.captures[1])[$(m.captures[2])]."
        # No position inside the brackets (e.g. observed_count()): name the word, not a Lesson 1 example.
        e = match(r"([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\(\s*\)", code)
        e === nothing && return "Round brackets call a function, and this name is not a function. Remove the round brackets after it."
        return "$(e.captures[1]) is a value, not a function: remove the () after it."
    end
    coaching = try
        _mystery_coaching(code; message=message, tables=(:jars => MYSTERY_COLUMNS,
            :practice_jars => MYSTERY_COLUMNS), case_batch=false, which_tail=MYSTERY_R_WHICH_RULE_TAIL)
    catch
        ""
    end
    isempty(coaching) || return coaching
    if occursin("ParseError", message)
        isempty(parse_help) || return parse_help
        occursin(r"Expected `[\)\]\}]`|premature end of input", message) && return LESSON_BRACKET_FEEDBACK
    end
    if occursin("ParseError", message)
        line = _lesson_parse_line(message)
        length(line) > 80 && (line = first(line, 77) * "...")
        return "Julia could not read this line: $(line). Check the brackets, commas and dots."
    end
    if word !== nothing
        tail = range ? "or make it on an earlier line." : "in the Pocket dictionary, or make it on an earlier line."
        return "Julia does not know the word `$word`. Check its spelling $tail"
    end
    # Never Julia's error class name (UndefVarError, MethodError): a player has not met it. Julia's own
    # message goes out separately as `message`, behind the screen's closed "Julia's own message" link.
    return range ? LESSON_RANGE_FALLBACK_FEEDBACK : LESSON_FALLBACK_FEEDBACK
end

"""Julia's own words for what a parse error found (the text after the arrow in its report)."""
function _lesson_parse_line(message::AbstractString)
    for l in split(message, "\n")
        m = match(r"─+\s+(\S.*)$", l)
        m === nothing || return String(strip(m.captures[1]))
    end
    return _lesson_short_error(message)
end

"""Coaching for a BoundsError: a position of 0 or below, or past the end."""
function _lesson_bounds_line(message::AbstractString)
    occursin("BoundsError", message) || return ""
    # A true/false rule made from one table used on a list from another: `[6-element BitVector]` on a 4-item list.
    rule = match(r"access (\d+)-element .* at index \[(\d+)-element (?:BitVector|Vector\{Bool\})\]", message)
    rule !== nothing && return "The rule has $(rule.captures[2]) true/false answers, but the list it picks from has $(rule.captures[1]) items. Make the rule from the same table you pick from."
    idx = match(r"at index \[(-?\d+)", message)
    idx === nothing && return ""
    i = parse(Int, idx.captures[1])
    i <= 0 && return "Julia counts from 1, and there is no position 0 or below."
    n = match(r"access (\d+)(?:-element|×)", message)
    n === nothing && return ""
    return "There are only $(n.captures[1]) items."
end

_lesson_same(a, b) = a isa DataFrames.AbstractDataFrame && b isa DataFrames.AbstractDataFrame ?
    isequal(DataFrames.DataFrame(a), DataFrames.DataFrame(b)) : isequal(a, b)

function _lesson_solution_result(lesson, challenge, on_status)
    key = string(lesson["id"], "/", challenge["id"])
    haskey(_LESSON_SOLUTIONS, key) && return _LESSON_SOLUTIONS[key]
    r = lock(_RUN_LOCK) do
        run_code(String(challenge["solution"]); env=lesson_env(_lesson_setup_for(lesson, challenge)), budget=RUN_BUDGET, on_status=on_status)
    end
    r.status == :ok && (_LESSON_SOLUTIONS[key] = r)
    return r
end

"""True when the step wants a list of one item and the player's line gave that item itself (`only(...)`, or a
position such as `[3]` on a list). The value is right; only the wrapper differs."""
function _lesson_scalar_for_list(value, wanted)
    wanted isa AbstractVector && length(wanted) == 1 || return false
    (value === nothing || value isa AbstractVector || value isa DataFrames.AbstractDataFrame ||
     value isa DataFrames.DataFrameRow || value isa AbstractSet || value isa Tuple || value isa NamedTuple) && return false
    return isequal(value, only(wanted))
end

const LESSON_SCALAR_WORKS_TOO = "That works too. Your line gives the item itself; the lesson's line gives a list with just that one item."

const LESSON_ALSO_WORKS_FALLBACK = "That works too. This lesson teaches another way, and yours is just as good."

"""The "That works too" sentence for a step that passed without one of its `check.taught` substrings, or ""
when every taught item is there (or the step has none). The way the lesson teaches comes from `feedback.taught`,
in words."""
function _lesson_works_too(challenge, code)
    check = get(challenge, "check", nothing)
    taught = check isa AbstractDict ? get(check, "taught", Any[]) : Any[]
    taught isa AbstractVector || return ""
    bare = _lesson_strip_comments(code)   # comments go, on both sides
    squeezed = replace(bare, r"\s+" => "")            # a taught item with no newline: all whitespace goes
    keeplines = replace(bare, r"[ \t\r]+" => "")       # a taught item with a newline: spaces and tabs go, lines stay
    hit(s) = occursin('\n', s) ? occursin(replace(s, r"[ \t\r]+" => ""), keeplines) : occursin(replace(s, r"\s+" => ""), squeezed)
    any(s -> s isa AbstractString && !isempty(s) && !hit(s), taught) || return ""
    way = strip(_lesson_feedback(challenge, "taught"))
    isempty(way) && return LESSON_ALSO_WORKS_FALLBACK
    return "That works too. The way this lesson teaches: " * rstrip(way, '.') * "."
end

const _lesson_also_works = _lesson_works_too   # harmless alias of the old name

"""True when this run passed only because its value is the item of the solution's list of one item. The
solution's result is already cached by the value check, so this never runs the solution again."""
function _lesson_gave_scalar(lesson, challenge, r)
    check = get(challenge, "check", nothing)
    (check isa AbstractDict && get(check, "same_value", true) === true && get(check, "checker", nothing) === nothing) || return false
    sol = get(_LESSON_SOLUTIONS, string(lesson["id"], "/", challenge["id"]), nothing)
    sol === nothing && return false
    return !_lesson_same(r.value, sol.value) && _lesson_scalar_for_list(r.value, sol.value)
end

"""Judge a finished run: returns `(pass, feedback, works_too)`. Never throws. A step that passes but skips a
`check.taught` item still passes: `works_too` holds the "That works too" sentence, and `feedback` ends with it."""
function _lesson_judge(lesson, challenge, code, r, on_status)
    ok, feedback = _lesson_judge_value(lesson, challenge, code, r, on_status)
    also = ok ? _lesson_works_too(challenge, code) : ""
    if ok && _lesson_gave_scalar(lesson, challenge, r)
        also = isempty(also) ? LESSON_SCALAR_WORKS_TOO : also * " " * LESSON_SCALAR_WORKS_TOO[length("That works too. ")+1:end]
    end
    isempty(also) || (feedback = isempty(feedback) ? also : feedback * " " * also)
    return (ok, feedback, also)
end

"""The `check.requires`, `check.requires_any` and `check.forbids` tests of a challenge or a range wave, on the
player's code with `#` comments removed. Returns `(kind, line)`: `kind` is "requires" or "forbids" for the test
that failed, and `line` is what to show. `("", "")` means every test holds. The lines come from the data
(`feedback.requires`, `feedback.forbids`); `forbids_default` is used when the data has none."""
function _lesson_rules_check(challenge, code::AbstractString; forbids_default::AbstractString="")
    check = get(challenge, "check", nothing)
    check isa AbstractDict || return ("", "")
    bare = _lesson_strip_comments(code)   # a word in a comment does not count
    requires = get(check, "requires", Any[])
    missing_items = [String(s) for s in requires if s isa AbstractString && !occursin(s, bare)]
    if !isempty(missing_items)
        line = _lesson_feedback(challenge, "requires")
        return ("requires", isempty(line) ? "Your line needs to use: $(join(missing_items, ", "))." : line)
    end
    # `requires_any`: at least one of these must be in the code (a call with brackets, or a pipe, for example)
    any_of = [String(s) for s in get(check, "requires_any", Any[]) if s isa AbstractString && !isempty(s)]
    if !isempty(any_of) && !any(s -> occursin(s, bare), any_of)
        line = _lesson_feedback(challenge, "requires")
        return ("requires", isempty(line) ? "Your line needs to use one of: $(join(any_of, ", "))." : line)
    end
    forbids = get(check, "forbids", Any[])
    squeezed = replace(bare, r"\s+" => "")
    if any(f -> f isa AbstractString && !isempty(f) && occursin(f, squeezed), forbids)
        line = _lesson_feedback(challenge, "forbids")
        return ("forbids", isempty(line) ? String(forbids_default) : line)
    end
    return ("", "")
end

_lesson_rules_line(challenge, code::AbstractString; forbids_default::AbstractString="") =
    _lesson_rules_check(challenge, code; forbids_default=forbids_default)[2]

"""The value and rule checks of a run: returns `(pass, feedback)`."""
function _lesson_judge_value(lesson, challenge, code, r, on_status)
    wrong = _lesson_feedback(challenge, "wrong")
    isempty(wrong) && (wrong = "That is not the result we asked for. Compare your line with the example.")
    pass_line = _lesson_feedback(challenge, "pass")
    check = get(challenge, "check", Dict())
    check isa AbstractDict || (check = Dict())
    rules = _lesson_rules_line(challenge, code; forbids_default=wrong)
    bare = _lesson_strip_comments(code)
    # `.=` stores into the table instead of asking a question: even when the last line happens to give the right answer.
    sol0 = get(challenge, "solution", nothing)
    if sol0 isa AbstractString
        dot = _lesson_dot_assign_line(bare, String(sol0))
        isempty(dot) || return (false, dot)
    end
    if !isempty(rules)
        # A slip in the code (a text in the wrong case, a dash for a colon, -> for =>) is why a required word is
        # missing; the rule line ("change only the tray") would send the player the wrong way.
        sol = get(challenge, "solution", nothing)
        slip = sol isa AbstractString ? _lesson_value_slip_line(String(sol), bare) : ""
        return (false, isempty(slip) ? rules : slip)
    end
    checker = get(check, "checker", nothing)
    if checker isa AbstractString
        f = get(LESSON_CHECKERS, checker, nothing)
        f === nothing && return (false, "This step has no checker named $(checker).")
        ok, message = try
            f(r.value, code)
        catch e
            (false, "The checker could not read that result.")
        end
        ok && return (true, isempty(pass_line) ? String(message) : pass_line)
        # a slip in the code (-> for =>, a dollar sign, a name with its dot lost) is named before the checker's own line
        sol = get(challenge, "solution", nothing)
        slip = sol isa AbstractString ? _lesson_value_slip_line(String(sol), bare) : ""
        return (false, !isempty(slip) ? slip : isempty(message) ? wrong : String(message))
    end
    if get(check, "same_value", true) === true && haskey(challenge, "solution")
        sol = _lesson_solution_result(lesson, challenge, on_status)
        sol.status == :ok || return (false, "This step's own solution did not run: " * sol.message)
        _lesson_same(r.value, sol.value) && return (true, pass_line)
        _lesson_scalar_for_list(r.value, sol.value) && return (true, pass_line)   # the item itself, not a list of one
        _lesson_new_column_shown(r.value, sol.value, code) && return (true, pass_line)   # the table shown after the column is added
        _lesson_change_column_shown(challenge, r.value, sol.value, code) && return (true, pass_line)   # the asked change, no last line
        slip = _lesson_value_slip_line(String(challenge["solution"]), bare)
        isempty(slip) || return (false, slip)
        # Two slips that a step's own "wrong" line cannot name: a whole table where a list is wanted (or the
        # reverse), and a comparison written without its dot where the answer uses one.
        mismatch = _lesson_shape_mismatch_line(r.value, sol.value; code=code)
        isempty(mismatch) || return (false, mismatch)
        if !(r.value isa AbstractVector) && occursin(r"\.(==|!=|<=|>=)", String(challenge["solution"]))
            dot = _lesson_missing_dot_line(bare)
            isempty(dot) || return (false, dot)
        end
        return (false, wrong)
    end
    return (true, pass_line)
end

"""Jar ids in a run's value, else `nothing`. Read: a table with a `jar_id` column, one row of a table (a
`DataFrameRow`), a list or a set of id strings, and a named tuple with a `jar_id` field (one id or a list of them)."""
function _lesson_picked_ids(value)
    ids(x) = all(y -> y isa AbstractString, x) ? String[String(y) for y in x] : nothing
    if value isa AbstractString
        # One jar id on its own (`jars.jar_id[7]`). Any other text is not a pick.
        return occursin(r"^[A-Z]-\d+$", value) ? String[String(value)] : nothing
    elseif value isa DataFrames.AbstractDataFrame
        "jar_id" in _mystery_columns(value) || return nothing
        return ids(value[!, "jar_id"])
    elseif value isa DataFrames.DataFrameRow
        "jar_id" in names(value) || return nothing
        v = value[:jar_id]
        return v isa AbstractString ? String[String(v)] : nothing
    elseif value isa NamedTuple
        haskey(value, :jar_id) || return nothing
        v = value.jar_id
        return v isa AbstractString ? String[String(v)] : _lesson_picked_ids(v)
    elseif value isa AbstractSet
        found = ids(value)
        return found === nothing ? nothing : sort!(found)
    end
    return value isa AbstractVector ? ids(value) : nothing
end

"""Julia's own message as the screen's closed "Julia's own message" box shows it. A blank left in the line gets a
plain sentence instead of Julia's "all-underscore identifier" text. A parse error keeps Julia's reason and the
spot but not the boxed picture of the line and the general advice, which reads as alarming to a beginner."""
const LESSON_SANDBOX_LINES = ("A function was called with the wrong kind of argument.",
    "An index was outside the range of the collection.", "Integer division by zero.",
    "Something went wrong running this line.")

"""The game's own notes that the sandbox writes into an error or result message (src/sandbox.jl, src/mystery_c3.jl to
c6.jl). They are not Julia's words. Twin of GAME_NOTES in web/julia-text.js."""
_lesson_is_game_note(h::AbstractString) =
    occursin(r"^The supplied [^\n]*\bchanged\.", h) ||
    occursin(r"^Your code ran for more than [\d.]+ seconds and was stopped\.", h) ||
    occursin(r"^No \w+ worker is available\.", h) ||
    startswith(h, "This result is a function or a type you just defined") ||
    startswith(h, "The result was too large to show")

"""The protected-input note ("The supplied ... changed. Keep ...") inside a message, or "". The screen shows it as the
game's note in the feedback line, never under "Julia's own message"."""
function _lesson_protected_note(message::AbstractString)
    for part in split(String(message), "\n\n")
        p = String(strip(part))
        occursin(r"^The supplied [^\n]*\bchanged\.", p) && return p
    end
    return ""
end

"""Julia's own error text: the sandbox's generic first line (src/sandbox.jl `_novice_line`) is not Julia's message
and adds nothing, so it is removed, and so is a game note left on its own. "" when nothing is left."""
function _lesson_julia_text(message::AbstractString)
    is_generic(h) = h in LESSON_SANDBOX_LINES || startswith(h, "Julia couldn't parse this line.") ||
                    startswith(h, "That line stopped Julia itself") ||
                    endswith(h, "is a name Julia does not know yet. Check the spelling, or define it first.") ||
                    _lesson_is_game_note(h)
    parts = split(String(message), "\n\n"; limit=2)
    length(parts) == 2 || return is_generic(strip(message)) ? "" : String(message)
    is_generic(strip(parts[1])) || return String(message)
    rest = String(strip(parts[2]))
    return is_generic(rest) ? "" : rest
end

function _lesson_raw_message(code::AbstractString, message::AbstractString)
    message = _lesson_julia_text(message)
    occursin("___", code) && occursin("all-underscore", message) &&
        return "The blank ___ is still in your line. Replace it with your answer, then run."
    if occursin("ParseError", message)
        spot = _lesson_parse_spot(message)
        reason = _lesson_parse_line(message)
        if spot !== nothing && !isempty(reason) && !startswith(reason, "ParseError")
            return "ParseError: $reason (line $(spot[1]), column $(spot[2]))."
        end
    end
    return String(message)
end

function lesson_run_reply(msg::AbstractDict; on_status::Function=((_, __) -> nothing))
    _ensure_lessons!()
    id = get(msg, "lesson", nothing)
    lesson = id isa AbstractString ? get(LESSONS, id, nothing) : nothing
    lesson === nothing && return _lesson_error("Unknown lesson: $(repr(id))")
    _lesson_is_range(lesson) && return range_run_reply(lesson, msg; on_status=on_status)
    cid = get(msg, "challenge", nothing)
    challenge = cid isa AbstractString ? _lesson_challenge(lesson, cid) : nothing
    challenge === nothing && return _lesson_error("Unknown challenge: $(repr(cid))")
    code = get(msg, "code", nothing)
    code isa AbstractString || return _lesson_error("`code` must be a string.")
    code = String(code)
    rid = _lesson_request_id(msg)

    function reply(; status, pass, feedback, value_repr="", table=nothing, stdout="")
        return Dict{String, Any}("type" => "lesson_result", "request_id" => rid, "challenge" => cid,
            "status" => status, "value_repr" => value_repr, "value_table" => table, "stdout" => stdout,
            "pass" => pass, "feedback" => feedback)
    end

    # `look: true` is the "Try it" of a Look closer box: the code runs in the lesson's setup and is never
    # checked, exactly like a play box.
    is_look = get(msg, "look", false) === true
    is_play = get(challenge, "kind", nothing) == "play" || is_look
    # An untouched starter is not run (running it could show the answer), unless it still has a blank:
    # then the blank line below is the more useful one.
    # A `fix` is different: running the broken line as given is the point, so the player can read its error.
    if !is_look && get(challenge, "kind", nothing) in ("change", "complete") && !occursin("___", code)
        strip_ws(x) = replace(x, r"\s+" => "")
        starter = get(challenge, "starter", "")
        if starter isa AbstractString && !isempty(strip(starter)) && strip_ws(code) == strip_ws(starter)
            line = _lesson_feedback(challenge, "unchanged")
            return reply(status="ok", pass=false, feedback=isempty(line) ? LESSON_UNCHANGED_FEEDBACK : line)
        end
    end
    isempty(strip(code)) && return is_play ? reply(status="ok", pass=true, feedback="") : reply(status="error", pass=false, feedback="The editor is empty, so nothing was run.")

    # An exam challenge runs exactly as its chapter's case_run does (inputs, protection, guard); any other challenge
    # runs in its lesson's setup.
    spec = is_look ? nothing : _lesson_exam_spec(challenge)
    env = spec === nothing ? lesson_env(_lesson_setup_for(lesson, challenge)) : lesson_exam_env(spec.setup)
    names = _lesson_env_names(env)
    r = spec === nothing ? lock(_RUN_LOCK) do
        run_code(code; env=env, budget=RUN_BUDGET, on_status=on_status)
    end : _lesson_exam_run(spec, code; on_status=on_status)
    value_repr = _lesson_repr(r.value)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    table = _lesson_value_table(r.value)
    works_too = ""

    if is_play
        # An ungraded try-anything box: never checked, but an error always shows a line.
        pass = true
        feedback = r.status == :ok ? "" : r.status == :timeout ? _mystery_stopped_feedback(r.status) :
            _lesson_error_line(challenge, code, r.message; names=names, env=env)
    elseif r.status == :ok
        pass, feedback, works_too = try
            _lesson_judge(lesson, challenge, code, r, on_status)
        catch e
            (false, "This step could not be checked: " * sprint(showerror, e), "")
        end
        # R's arrow that ran without an error (a comparison) still gets the arrow line, not "wrong".
        if !pass
            arrow = _mystery_r_arrow_note(code)
            isempty(arrow) || (feedback = arrow)
        end
    elseif r.status == :timeout
        pass, feedback = false, _mystery_stopped_feedback(r.status)
    else
        pass, feedback = false, _lesson_error_line(challenge, code, r.message; names=names, env=env)
    end
    out = reply(status=String(r.status), pass=pass, feedback=feedback, value_repr=value_repr,
                table=table, stdout=r.stdout)
    _lesson_add_shown!(out, r, code, env)
    raw = r.status == :error ? _lesson_raw_message(code, r.message) : r.message
    # A play box shows Julia's first line only, unless the message was rewritten (a blank, a parse spot).
    out["message"] = is_play && r.status == :error && raw == _lesson_julia_text(r.message) ?
        String(strip(first(split(raw, "\n")))) : raw
    isempty(works_too) || (out["works_too"] = works_too)
    # An exam pass carries what the screen saves for the Board: the chapter move and its record count.
    spec !== nothing && pass === true && r.status == :ok && (out["exam"] = _lesson_exam_record(spec, r.value))
    if !is_look && get(challenge, "board", nothing) == "jars" && r.status == :ok
        picked = _lesson_picked_ids(r.value)
        picked === nothing || (out["picked_ids"] = picked)
    end
    return out
end

# ---- The target range: one wave is a question ("hit these jars"), the player's code is the answer. ----

function _range_wave(range, id)
    id isa AbstractString || return nothing
    for w in get(range, "waves", Any[])
        w isa AbstractDict && get(w, "id", nothing) == id && return w
    end
    return nothing
end

const _RANGE_JAR_KEYS = ("jar_id", "batch_id", "tray_id", "detected")

"""A range wave's own table, written in the file as `jars` (the boss level: rows with `jar_id`, `batch_id`, `tray_id`
and `detected`, true or false), as a `logbook` DataFrame. `nothing` when the wave has no `jars`, or when a row is not
of that shape (`lesson_contract_violations` names it)."""
function _range_wave_jars_table(wave)
    js = wave isa AbstractDict ? get(wave, "jars", nothing) : nothing
    js isa AbstractVector && !isempty(js) || return nothing
    ok = all(j -> j isa AbstractDict && all(k -> haskey(j, k), _RANGE_JAR_KEYS) &&
                  all(k -> j[k] isa AbstractString, _RANGE_JAR_KEYS[1:3]) && j["detected"] isa Bool, js)
    ok || return nothing
    return DataFrame(jar_id=String[String(j["jar_id"]) for j in js], batch_id=String[String(j["batch_id"]) for j in js],
                     tray_id=String[String(j["tray_id"]) for j in js], detected=Bool[j["detected"] for j in js])
end

"""The table a wave's line runs on, when the wave brings its own: its `jars` list first, else its `setup`'s
`logbook`. `nothing` for a wave that uses the range's table."""
function _range_wave_logbook(wave)
    t = _range_wave_jars_table(wave)
    t === nothing || return t
    ws = wave isa AbstractDict ? get(wave, "setup", nothing) : nothing
    tw = ws isa AbstractString ? lesson_twin_env(ws) : nothing
    return tw !== nothing && haskey(tw, :logbook) ? tw.logbook : nothing
end

_range_plural(n, one, many) = n == 1 ? one : many

"""`a`, `a and b`, `a, b and c`."""
_range_join(parts) = length(parts) <= 1 ? join(parts) : join(parts[1:end-1], ", ") * " and " * parts[end]

"""`J-086`, `J-086 and J-087`, `J-086, J-087, J-088 and 2 more`."""
function _range_name_ids(ids)
    length(ids) <= 3 && return _range_join(ids)
    return join(ids[1:3], ", ") * " and $(length(ids) - 3) more"
end

const RANGE_FORBIDS_FEEDBACK = "Those are the right jars, but this wave asks for a rule that finds them, not typed ids or row numbers. Write the question that picks them."
const RANGE_SAME_JARS_FEEDBACK = "Julia ran your line again and it picked the same jars every time. This wave asks for jars picked by chance: let Julia choose them, do not choose them yourself."

"""Judge picked jar ids against one wave. Pure. Returns the range result plus `pass` and `feedback`.
The range result has: `hits` (picks that are wanted), `wrong_picks` (picks that are not wanted, or that repeat),
`targets_missed` (how many wanted jars were left out; `missed_targets` lists them), `score` (hits minus wrong
picks), `clean`, `picked_ids`, `shot_number` (which run of this wave this is, when the screen says) and `first_shot`
(a clean wave on the first run). `misses` is a deprecated alias of `wrong_picks`.
A wave with `targets` passes only on an exact set match; a `rule` wave passes on `count` distinct ids that all
come from `from`. The wave's `check.requires`, `requires_any` and `forbids` are tested by `range_run_reply`, which
knows the code."""
function range_judge(wave::AbstractDict, picked::AbstractVector{<:AbstractString}; shot_number::Union{Nothing, Integer}=nothing)
    picked = String.(picked)
    distinct = unique(picked)
    repeats = length(picked) - length(distinct)
    targets = get(wave, "targets", nothing)
    rule = get(wave, "rule", nothing)
    function result(pass, feedback, hits, wrong, missed_ids, targets_missed)
        return Dict{String, Any}("pass" => pass, "feedback" => feedback, "range" => Dict{String, Any}(
            "hits" => hits, "wrong_picks" => wrong, "targets_missed" => targets_missed, "missed_targets" => missed_ids,
            "misses" => wrong,   # deprecated alias of wrong_picks
            "score" => hits - wrong, "clean" => pass, "picked_ids" => picked,
            "shot_number" => shot_number === nothing ? nothing : Int(shot_number),
            "first_shot" => pass && shot_number !== nothing && shot_number == 1))
    end
    if targets isa AbstractVector
        want = unique(String.(targets))
        hit = [t for t in want if t in distinct]
        missed = [t for t in want if !(t in distinct)]
        hits = length(hit)
        extra_ids = [p for p in distinct if !(p in want)]   # different jars that are not targets
        extra = length(extra_ids)
        wrong = extra + repeats
        clean = isempty(missed) && wrong == 0
        parts = String[]
        extra > 0 && push!(parts, "picked $extra jar$(_range_plural(extra, "", "s")) that $(_range_plural(extra, "is not a target", "are not targets")) ($(_range_name_ids(extra_ids)))")
        repeats > 0 && push!(parts, "picked $repeats jar$(_range_plural(repeats, "", "s")) more than once")
        if !isempty(missed)
            m = length(missed)
            push!(parts, isempty(parts) ? "missed $m target jar$(_range_plural(m, "", "s"))" : "missed $m target$(_range_plural(m, "", "s"))")
        end
        feedback = clean ? "Every target jar is picked, and no other jar." : "You " * _range_join(parts) * "."
        return result(clean, feedback, hits, wrong, missed, length(missed))
    elseif rule isa AbstractDict
        count = get(rule, "count", 0)
        from = unique(String.(get(rule, "from", Any[])))
        need_distinct = get(rule, "distinct", true) !== false
        inside = [p for p in distinct if p in from]
        hits = min(length(inside), count)
        wrong = length(distinct) - hits + (need_distinct ? repeats : 0)
        clean = length(distinct) == count && length(inside) == count && (!need_distinct || repeats == 0)
        feedback = if clean
            "That is $count different jar$(_range_plural(count, "", "s")), all from the right group."
        elseif repeats > 0 && need_distinct
            "A jar came twice. Each of the $count jars must be different."
        elseif length(inside) < length(distinct)
            "Some picks are not in the right group. Pick only from the jars named in the target."
        else
            "Pick exactly $count different jar$(_range_plural(count, "", "s")): you picked $(length(distinct))."
        end
        return result(clean, feedback, hits, wrong, String[], max(count - length(inside), 0))
    end
    return result(false, "This wave has no targets.", 0, length(picked), String[], 0)
end

"""A clean wave that broke one of the wave's own rules (`requires`, `forbids`, or the chance check): still
judged, but no longer passed, no longer clean and never a first shot. `rule_broken` says which."""
function _range_block!(j::AbstractDict, line::AbstractString, kind::AbstractString)
    j["pass"] = false
    j["feedback"] = String(line)
    rg = j["range"]
    rg["clean"] = false
    rg["first_shot"] = false
    rg["rule_broken"] = String(kind)
    return j
end

"""What to say when a run's value cannot be read as jar ids: it names what to return instead."""
function _range_refusal_line(value)
    isrow(v) = v isa DataFrames.AbstractDataFrame || v isa DataFrames.DataFrameRow || v isa NamedTuple
    value === nothing && return "Your line gave back nothing. End it with the jars you want to pick."
    if isrow(value)
        return "Julia cannot find jar ids in that: it has no jar_id column. Keep the jar_id column, or pick it out."
    end
    if _lesson_bool_vector(value) || value isa Bool
        return "That is a true or false answer, not jar ids. Use it inside [ ] to pick the jars."
    end
    if value isa Number || (value isa AbstractVector && !isempty(value) && all(x -> x isa Number, value))
        return "Numbers are not jar ids. A jar id looks like \"Q-053\": use the numbers to pick from the jar_id column."
    end
    return "Give back jar ids such as \"Q-053\": one id, a list of ids, or a table with a jar_id column."
end

"""Whether a chance wave's line picks different jars from run to run. `rerun(code, seed)` runs the line again
under a seed and returns its result; it is a hook for tests. A rerun that fails to give jar ids is skipped: the
first run already passed."""
function _range_picks_vary(code::AbstractString, first_picked, env; rerun::Function=(code, seed) -> lock(_RUN_LOCK) do
        run_code(code; env=env, seed=seed, budget=RUN_BUDGET)
    end)
    seen = Set{Set{String}}([Set(String.(first_picked))])
    for seed in MYSTERY_C4_CHANCE_SEEDS[1:4]
        res = rerun(String(code), seed)
        res.status == :ok || continue
        ids = res.value isa AbstractString ? String[String(res.value)] : _lesson_picked_ids(res.value)
        ids === nothing || push!(seen, Set(ids))
    end
    return length(seen) > 1
end

"""Run one wave of the target range: the player's code runs in the range's setup (the 12-jar notebook), its
value is read as jar ids, and the ids are judged against the wave. `msg["challenge"]` is the wave id."""
function range_run_reply(range::AbstractDict, msg::AbstractDict; on_status::Function=((_, __) -> nothing))
    cid = get(msg, "challenge", nothing)
    wave = _range_wave(range, cid)
    wave === nothing && return _lesson_error("Unknown challenge: $(repr(cid))")
    code = get(msg, "code", nothing)
    code isa AbstractString || return _lesson_error("`code` must be a string.")
    code = String(code)
    rid = _lesson_request_id(msg)

    function reply(; status, pass, feedback, value_repr="", table=nothing, stdout="")
        return Dict{String, Any}("type" => "lesson_result", "request_id" => rid, "challenge" => cid,
            "status" => status, "value_repr" => value_repr, "value_table" => table, "stdout" => stdout,
            "pass" => pass, "feedback" => feedback)
    end
    isempty(strip(code)) && return reply(status="error", pass=false, feedback="The editor is empty, so nothing was run.")

    # A wave may name its own setup (the boss level's bigger table); otherwise the range's.
    env = lesson_env(get(wave, "setup", get(range, "setup", "jars")))
    # The boss wave may carry its own `jars` in the file: the line then runs on that table as `logbook`.
    wave_jars = _range_wave_jars_table(wave)
    wave_jars !== nothing && env isa NamedTuple && (env = merge(env, (logbook=wave_jars,)))
    names = _lesson_env_names(env)
    r = lock(_RUN_LOCK) do
        run_code(code; env=env, budget=RUN_BUDGET, on_status=on_status)
    end
    value_repr = _lesson_repr(r.value)
    length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
    table = _lesson_value_table(r.value)

    if r.status == :ok
        # A single jar (`jars.jar_id[9]`) is one pick: a wave may ask for exactly one jar.
        picked = r.value isa AbstractString ? String[String(r.value)] : _lesson_picked_ids(r.value)
        if picked === nothing
            out = reply(status="ok", pass=false, value_repr=value_repr, table=table, stdout=r.stdout,
                        feedback=_range_refusal_line(r.value))
        else
            shot = get(msg, "shot_number", nothing)
            shot = shot isa Integer && !(shot isa Bool) && shot >= 1 ? shot : nothing
            j = range_judge(wave, picked; shot_number=shot)
            if j["pass"]
                # The wave's own rules come after the picks: typed ids or row numbers are right jars, but not the lesson.
                kind, rules = _lesson_rules_check(wave, code; forbids_default=RANGE_FORBIDS_FEEDBACK)
                rule = get(wave, "rule", nothing)
                if !isempty(kind)
                    _range_block!(j, rules, kind)
                elseif rule isa AbstractDict && get(rule, "random", true) !== false && !_range_picks_vary(code, picked, env)
                    _range_block!(j, RANGE_SAME_JARS_FEEDBACK, "same_jars")
                end
            end
            out = reply(status="ok", pass=j["pass"], feedback=j["feedback"], value_repr=value_repr, table=table, stdout=r.stdout)
            out["range"] = j["range"]
            out["picked_ids"] = picked
        end
        _lesson_add_shown!(out, r, code, env)
        out["message"] = r.message
        return out
    elseif r.status == :timeout
        out = reply(status="timeout", pass=false, feedback=_mystery_stopped_feedback(r.status), value_repr=value_repr,
                    table=table, stdout=r.stdout)
    else
        line = _lesson_error_line(wave, code, r.message; names=names, env=env, range=true)
        out = reply(status=String(r.status), pass=false, feedback=line,
                    value_repr=value_repr, table=table, stdout=r.stdout)
    end
    _lesson_add_shown!(out, r, code, env)
    out["message"] = r.status == :error ? _lesson_raw_message(code, r.message) : r.message
    return out
end

# ---- The round 2 field contract (docs/dev-log/course/lesson-format.md, "Round 2 field contract") ----

const LESSON_BOSS_MIN_JARS = 24
_lesson_words(s::AbstractString) = length(split(strip(s)))
_lesson_nonempty_string(x) = x isa AbstractString && !isempty(strip(x))

"""Every way a lesson, exam or range file breaks the round 2 field contract, as plain sentences (empty when it
keeps it). The contract: `code_has` and `code_lacks` on an error entry are non-empty text; a dictionary row's `py`
is non-empty text with no em dash, and `lesson_only` is true or false (never in an exam file); an exam's own
`dictionary` rows each have `julia` and `means`; an exam's `minutes` is a whole number from 3 to 60; a range wave's
`group` is short text and each group's waves sit together; `story` is at most 25 words; a wave `setup` binds a
`logbook`; and the one `boss` wave is the last, has a `story`, and a table of at least 24 jars that holds its targets."""
function lesson_contract_violations(lesson::AbstractDict)
    out = String[]
    id = string(get(lesson, "id", "?"))
    is_exam = _lesson_is_exam(lesson)
    items = _lesson_is_range(lesson) ? collect(Any, get(lesson, "waves", Any[])) : _lesson_challenges(lesson)
    for c in items
        c isa AbstractDict || continue
        fb = get(c, "feedback", nothing)
        errs = fb isa AbstractDict ? get(fb, "errors", Any[]) : Any[]
        for e in errs
            e isa AbstractDict || continue
            for key in ("code_has", "code_lacks")
                haskey(e, key) && !_lesson_nonempty_string(e[key]) &&
                    push!(out, "$id/$(get(c, "id", "?")): an error entry's $key must be non-empty text")
            end
        end
    end
    dict = get(lesson, "dictionary", nothing)
    if dict !== nothing
        dict isa AbstractVector || push!(out, "$id: dictionary must be a list of rows")
        for row in (dict isa AbstractVector ? dict : Any[])
            row isa AbstractDict || (push!(out, "$id: a dictionary row must be an object"); continue)
            j = get(row, "julia", "?")
            if haskey(row, "py")
                _lesson_nonempty_string(row["py"]) || push!(out, "$id: dictionary row $j: py must be non-empty text")
                row["py"] isa AbstractString && occursin('—', row["py"]) && push!(out, "$id: dictionary row $j: py has an em dash")
            end
            if haskey(row, "lesson_only")
                row["lesson_only"] isa Bool || push!(out, "$id: dictionary row $j: lesson_only must be true or false")
                is_exam && push!(out, "$id: dictionary row $j: lesson_only is for lesson files, not an exam")
            end
            if is_exam
                _lesson_nonempty_string(get(row, "julia", nothing)) && _lesson_nonempty_string(get(row, "means", nothing)) ||
                    push!(out, "$id: an exam dictionary row needs julia and means")
            end
        end
    end
    if is_exam && haskey(lesson, "minutes")
        m = lesson["minutes"]
        m isa Integer && !(m isa Bool) && 3 <= m <= 60 || push!(out, "$id: exam minutes must be a whole number from 3 to 60")
    end
    if _lesson_is_range(lesson)
        waves = [w for w in get(lesson, "waves", Any[]) if w isa AbstractDict]
        groups = [get(w, "group", nothing) for w in waves]
        if any(!isnothing, groups)
            all(_lesson_nonempty_string, groups) || push!(out, "$id: when one wave has a group, every wave needs one")
            for g in unique(filter(_lesson_nonempty_string, groups))
                _lesson_words(g) <= 5 || push!(out, "$id: group \"$g\" is more than 5 words")
                at = findall(==(g), groups)
                at == collect(first(at):last(at)) || push!(out, "$id: the waves of group \"$g\" must sit together")
            end
        end
        bosses = findall(w -> get(w, "boss", false) === true, waves)
        length(bosses) <= 1 || push!(out, "$id: at most one boss wave")
        for (i, w) in enumerate(waves)
            wid = get(w, "id", "?")
            haskey(w, "boss") && !(w["boss"] isa Bool) && push!(out, "$id/$wid: boss must be true or false")
            if haskey(w, "story")
                st = w["story"]
                _lesson_nonempty_string(st) || push!(out, "$id/$wid: story must be non-empty text")
                st isa AbstractString && _lesson_words(st) > 25 && push!(out, "$id/$wid: story is more than 25 words")
                st isa AbstractString && occursin('—', st) && push!(out, "$id/$wid: story has an em dash")
            end
            tw = nothing
            if haskey(w, "setup")
                tw = w["setup"] isa AbstractString ? lesson_twin_env(w["setup"]) : nothing
                tw !== nothing && haskey(tw, :logbook) || push!(out, "$id/$wid: a wave setup must be a practice setup with a logbook")
            end
            if haskey(w, "jars") && _range_wave_jars_table(w) === nothing
                push!(out, "$id/$wid: a wave's jars must be a list of rows, each with jar_id, batch_id and tray_id as text and detected as true or false")
            end
            wlog = _range_wave_logbook(w)   # the wave's own jars first, else its setup's logbook
            if get(w, "boss", false) === true
                i == length(waves) || push!(out, "$id/$wid: the boss wave must be the last wave")
                _lesson_nonempty_string(get(w, "story", nothing)) || push!(out, "$id/$wid: the boss wave needs a story line")
                if wlog === nothing || DataFrames.nrow(wlog) < LESSON_BOSS_MIN_JARS
                    push!(out, "$id/$wid: the boss wave needs its own jars or setup with at least $LESSON_BOSS_MIN_JARS jars")
                end
            end
            if wlog !== nothing
                allunique(wlog.jar_id) || push!(out, "$id/$wid: the wave's table repeats a jar_id")
                ids = Set(String.(wlog.jar_id))
                ts = get(w, "targets", nothing)
                ts isa AbstractVector && !all(t -> t in ids, ts) && push!(out, "$id/$wid: a target is not in the wave's table")
                rl = get(w, "rule", nothing)
                rl isa AbstractDict && !all(t -> t in ids, get(rl, "from", Any[])) && push!(out, "$id/$wid: a rule jar is not in the wave's table")
            end
        end
    end
    return out
end

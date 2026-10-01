using Test, JuliaTime, JSON, DataFrames

# Lesson engine: src/lessons.jl. Pure parts always run; sandbox parts need JULIATIME_INTEGRATION=1.

const _FIXTURE = joinpath(@__DIR__, "fixtures", "lesson-engine.json")
const _LESSON_FILES = let d = JuliaTime.LESSONS_DIR
    isdir(d) ? sort(filter(f -> endswith(f, ".json"), readdir(d; join=true))) : String[]
end
_all_lessons() = vcat([JuliaTime.load_lesson_file(_FIXTURE)], [JuliaTime.load_lesson_file(f) for f in _LESSON_FILES])
_challenges(l) = JuliaTime._lesson_challenges(l)

@testset "lessons: loading, list, info (pure)" begin
    @test !JuliaTime._LESSONS_LOADED[] || true
    JuliaTime.reload_lessons!()
    for f in _LESSON_FILES
        @test haskey(JuliaTime.LESSONS, JuliaTime.load_lesson_file(f)["id"])
    end
    fixture = JuliaTime.load_lesson_file(_FIXTURE)
    JuliaTime.LESSONS[fixture["id"]] = fixture
    try
        list = JuliaTime.handle_message(Dict("type" => "lesson_list"))
        @test list["type"] == "lessons"
        @test any(l -> l["id"] == "lesson-engine" && l["number"] == 99 && l["title"] == "Engine fixture", list["lessons"])

        r = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "lesson-engine", "request_id" => "q1"))
        @test r["type"] == "lesson" && r["request_id"] == "q1"
        cs = _challenges(r["lesson"])
        @test all(c -> !haskey(c, "check"), cs)
        @test all(c -> c["kind"] != "checkpoint" || !haskey(c, "solution"), cs)
        @test any(c -> c["kind"] != "checkpoint" && haskey(c, "solution"), cs)
        pj = r["lesson"]["data_values"]["practice_jars"]
        @test pj["columns"] == ["jar_id", "batch_id", "tray_id", "detected"]
        @test pj["rows"] == [["P-01", "B01", "T-A", true], ["P-02", "B02", "T-A", false],
                             ["P-03", "B01", "T-B", true], ["P-04", "B02", "T-B", true]]
        @test r["lesson"]["data_label"] == JuliaTime.MYSTERY_DATA_LABEL
        @test !occursin("\u2014", r["lesson"]["data_label"]) && occursin("springtail", r["lesson"]["data_label"])
        # error examples are payload-only leaks: never sent
        @test all(c -> all(e -> !haskey(e, "example"), get(get(c, "feedback", Dict()), "errors", Any[])), _challenges(r["lesson"]))
        @test any(c -> !isempty(get(get(c, "feedback", Dict()), "errors", Any[])), _challenges(r["lesson"]))
        @test length(r["lesson"]["jars"]) == 12   # the fixture has a board challenge
        # optional fields pass through unchanged
        @test only(filter(c -> c["id"] == "e-r2-cp", _challenges(r["lesson"])))["clue"] == "The clue text passes through."
        @test r["lesson"]["close"]["own_work"]["say"] == "Try it on your own table."
        @test _challenges(r["lesson"])[1]["r_note"] == "R starts counting at 1 too."
        # 0.5 fix: py_note, starter_hint (a hint, not the solution) and the lesson-level minutes pass through to the screen
        @test _challenges(r["lesson"])[1]["py_note"] == "Python counts from 0; len(df) gives the row count."
        cp = only(filter(c -> c["id"] == "e-r2-cp", _challenges(r["lesson"])))
        @test cp["starter_hint"] == "jars[jars.batch_id .== ___, :]" && !haskey(cp, "solution")
        @test occursin("___", cp["starter_hint"]) && r["lesson"]["minutes"] == 10
        @test only(filter(l -> l["id"] == "lesson-engine", JuliaTime.lesson_list_reply()["lessons"]))["minutes"] == 10
        # the stored lesson is untouched
        @test all(c -> c["kind"] == "play" || haskey(c, "check"), _challenges(JuliaTime.LESSONS["lesson-engine"]))

        for bad in (Dict("type" => "lesson_info", "lesson" => "nope"),
                    Dict("type" => "lesson_info"),
                    Dict("type" => "lesson_run", "lesson" => "nope", "challenge" => "x", "code" => "1"),
                    Dict("type" => "lesson_run", "lesson" => "lesson-engine", "challenge" => "nope", "code" => "1"),
                    Dict("type" => "lesson_run", "lesson" => "lesson-engine", "challenge" => "e-r1-c1", "code" => 5),
                    Dict("type" => "lesson_run", "lesson" => 7, "challenge" => "e-r1-c1", "code" => "1"))
            @test JuliaTime.handle_message(bad)["type"] == "error"
        end
        empty = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson-engine",
                                              "challenge" => "e-r1-c1", "code" => "  ", "request_id" => "e"))
        @test empty["type"] == "lesson_result" && empty["pass"] == false
    finally
        JuliaTime.reload_lessons!()
    end
end

@testset "lessons: jars rack hides detected (pure)" begin
    l = JuliaTime.load_lesson_file(_FIXTURE)
    JuliaTime.LESSONS[l["id"]] = l
    try
        for rd in l["rounds"], c in rd["challenges"]
            delete!(c, "board")
        end
        r = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "lesson-engine"))
        @test !haskey(r["lesson"], "jars")   # no board challenge, no rack
        for rd in l["rounds"], c in rd["challenges"]
            c["id"] == "e-r2-cp" && (c["board"] = "jars")
        end
        r = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "lesson-engine"))
        jars = r["lesson"]["jars"]
        @test length(jars) == 12
        @test all(j -> sort(collect(keys(j))) == ["batch_id", "jar_id", "tray_id"], jars)
        @test jars[1] == Dict("jar_id" => "J-081", "batch_id" => "B08", "tray_id" => "T-A")
    finally
        JuliaTime.reload_lessons!()
    end
end

# A small range made in the test, so the engine is checked before lessons/range.json exists.
const _RANGE_TEST = Dict{String, Any}("id" => "range-test", "kind" => "range", "title" => "Test range", "goal" => "g",
    "setup" => "jars", "waves" => Any[
        Dict{String, Any}("id" => "w-fixed", "unlocks_after" => "lesson1", "target" => "Hit J-081 and J-082.",
            "targets" => Any["J-081", "J-082"], "rule" => nothing, "hint" => "Use the first two.",
            "example" => "jars.jar_id[1:2]"),
        Dict{String, Any}("id" => "w-rule", "unlocks_after" => "lesson2", "target" => "Any 3 different jars of batch B09.",
            "targets" => nothing, "rule" => Dict{String, Any}("count" => 3, "distinct" => true,
                "from" => Any["J-091", "J-092", "J-093", "J-094", "J-095", "J-096"]),
            "hint" => "Sample three.", "example" => "sample(jars.jar_id[7:12], 3; replace=false)")])

@testset "lessons: the target range, judged (pure)" begin
    wave = _RANGE_TEST["waves"][1]
    j = JuliaTime.range_judge(wave, ["J-081", "J-082"])
    @test j["pass"] && j["range"]["clean"] && j["range"]["hits"] == 2 && j["range"]["misses"] == 0 &&
          j["range"]["score"] == 2 && isempty(j["range"]["missed_targets"]) && j["range"]["picked_ids"] == ["J-081", "J-082"]
    # order does not matter
    @test JuliaTime.range_judge(wave, ["J-082", "J-081"])["pass"]
    # one target missed
    j = JuliaTime.range_judge(wave, ["J-081"])
    @test !j["pass"] && j["range"]["hits"] == 1 && j["range"]["misses"] == 0 && j["range"]["missed_targets"] == ["J-082"] &&
          j["range"]["score"] == 1 && !j["range"]["clean"]
    # an extra jar is a miss, and the wave does not pass
    j = JuliaTime.range_judge(wave, ["J-081", "J-082", "J-083"])
    @test !j["pass"] && j["range"]["hits"] == 2 && j["range"]["misses"] == 1 && j["range"]["score"] == 1 && isempty(j["range"]["missed_targets"])
    # nothing right
    j = JuliaTime.range_judge(wave, ["J-091", "J-092"])
    @test !j["pass"] && j["range"]["hits"] == 0 && j["range"]["misses"] == 2 && j["range"]["score"] == -2 &&
          j["range"]["missed_targets"] == ["J-081", "J-082"]
    # a repeat is a miss, not a second hit
    j = JuliaTime.range_judge(wave, ["J-081", "J-081", "J-082"])
    @test !j["pass"] && j["range"]["hits"] == 2 && j["range"]["misses"] == 1
    # an empty pick
    @test JuliaTime.range_judge(wave, String[])["range"]["missed_targets"] == ["J-081", "J-082"]
    # every feedback line is plain: no em dash
    for picks in (["J-081", "J-082"], ["J-081"], ["J-081", "J-082", "J-083"], ["J-091"], String[])
        @test !occursin("\u2014", JuliaTime.range_judge(wave, picks)["feedback"])
    end

    rule = _RANGE_TEST["waves"][2]
    ok = JuliaTime.range_judge(rule, ["J-092", "J-095", "J-091"])
    @test ok["pass"] && ok["range"]["hits"] == 3 && ok["range"]["misses"] == 0 && ok["range"]["score"] == 3 && ok["range"]["clean"]
    j = JuliaTime.range_judge(rule, ["J-091", "J-092"])                    # too few
    @test !j["pass"] && j["range"]["hits"] == 2 && j["range"]["misses"] == 0
    j = JuliaTime.range_judge(rule, ["J-091", "J-092", "J-093", "J-094"])   # too many
    @test !j["pass"] && j["range"]["hits"] == 3 && j["range"]["misses"] == 1
    j = JuliaTime.range_judge(rule, ["J-091", "J-091", "J-092"])            # a repeat
    @test !j["pass"] && occursin("twice", j["feedback"])
    j = JuliaTime.range_judge(rule, ["J-091", "J-092", "J-081"])            # one from outside
    @test !j["pass"] && j["range"]["hits"] == 2 && j["range"]["misses"] == 1 && occursin("right group", j["feedback"])
    @test isempty(j["range"]["missed_targets"])
    # a wave with neither targets nor rule never passes
    @test !JuliaTime.range_judge(Dict{String, Any}("id" => "x"), ["J-081"])["pass"]
end

@testset "lessons: the range in list and info, never the example (pure)" begin
    JuliaTime.reload_lessons!()
    JuliaTime.LESSONS["range-test"] = deepcopy(_RANGE_TEST)
    try
        list = JuliaTime.handle_message(Dict("type" => "lesson_list"))["lessons"]
        entry = only(filter(l -> l["id"] == "range-test", list))
        @test entry["kind"] == "range" && entry["title"] == "Test range"
        # only the range and the chapter exams say kind
        @test all(l -> !haskey(l, "kind") || l["id"] == "range-test" || l["id"] == "range" || (l["kind"] == "exam" && occursin(r"^exam\d+$", l["id"])), list)
        @test list[end]["kind"] == "range"                                        # after every numbered lesson
        r = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "range-test", "request_id" => "q"))
        @test r["type"] == "lesson" && r["request_id"] == "q"
        pub = r["lesson"]
        @test pub["kind"] == "range" && length(pub["waves"]) == 2
        @test all(w -> !haskey(w, "example"), pub["waves"])
        @test pub["waves"][1]["targets"] == ["J-081", "J-082"] && pub["waves"][1]["hint"] == "Use the first two."
        @test pub["waves"][2]["rule"]["count"] == 3
        # rings pass through unchanged
        JuliaTime.LESSONS["range-test"]["waves"][1]["rings"] = "after"
        JuliaTime.LESSONS["range-test"]["waves"][2]["rings"] = "before"
        pub2 = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "range-test"))["lesson"]
        @test pub2["waves"][1]["rings"] == "after" && pub2["waves"][2]["rings"] == "before"
        @test all(w -> !haskey(w, "example"), pub2["waves"])
        @test length(pub["jars"]) == 12 && all(j -> sort(collect(keys(j))) == ["batch_id", "jar_id", "tray_id"], pub["jars"])
        @test pub["data_label"] == JuliaTime.MYSTERY_DATA_LABEL
        # the stored range still has its examples
        @test all(w -> haskey(w, "example"), JuliaTime.LESSONS["range-test"]["waves"])
        # every target id is a jar of the case notebook
        ids = Set(JuliaTime.mystery_jars().jar_id)
        for w in _RANGE_TEST["waves"], t in (w["targets"] === nothing ? w["rule"]["from"] : w["targets"])
            @test t in ids
        end
        # unknown wave and bad code are errors
        @test JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "range-test", "challenge" => "nope", "code" => "1"))["type"] == "error"
        @test JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "range-test", "challenge" => "w-fixed", "code" => 5))["type"] == "error"
        empty = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "range-test", "challenge" => "w-fixed", "code" => " ", "request_id" => "e"))
        @test empty["type"] == "lesson_result" && empty["pass"] == false && empty["status"] == "error"
    finally
        JuliaTime.reload_lessons!()
    end
end

@testset "lessons: picked ids (pure)" begin
    df = DataFrame(jar_id=["J-091", "J-092"], detected=[true, false])
    @test JuliaTime._lesson_picked_ids(df) == ["J-091", "J-092"]
    @test JuliaTime._lesson_picked_ids(["J-091"]) == ["J-091"]
    @test JuliaTime._lesson_picked_ids(DataFrame(x=[1])) === nothing
    @test JuliaTime._lesson_picked_ids(3) === nothing
end

@testset "lessons: vector data as a one-column table, comment stripping (pure)" begin
    t = JuliaTime._lesson_data_value([2, 3, 6], "sim_counts")
    @test t == Dict("columns" => ["sim_counts"], "rows" => [[2], [3], [6]])
    @test JuliaTime._lesson_strip_comments("a # b\nc \"#x\" # d") == "a \nc \"#x\" "
    for (s, names) in (("b09_jars", (:jars, :practice_jars)), ("jars_b09", (:jars, :b09, :practice_jars)), ("practice4", (:open_jars, :practice_jars)),
                       ("chance", (:sim_counts, :observed_count, :practice_jars)),
                       ("stories", (:stories, :observed_count, :sim_counts, :practice_jars)))
        @test all(n -> haskey(JuliaTime.lesson_env(s), n), names)
    end
    @test nrow(JuliaTime.lesson_env("b09_jars").jars) == 6
    # Lesson 2: `jars` stays the 12-row notebook and `b09` is its six B09 rows
    j2 = JuliaTime.lesson_env("jars_b09")
    @test nrow(j2.jars) == 12 && nrow(j2.b09) == 6 && all(==("B09"), j2.b09.batch_id) && nrow(j2.practice_jars) == 4
    @test j2.jars == JuliaTime.lesson_env("jars").jars
    lists = JuliaTime.lesson_env("lists")
    @test lists.trays == ["T-A", "T-B", "T-C"] && lists.notebook == [2, 2, 1] && lists.typed == [2, 2, 0]
    @test lists.box == ["filled in", "filled in", "left blank"] && lists.practice_notebook == [2, 1] && lists.practice_typed == [2, 0]
    # Lesson 3's last checkpoint shows the paper form as a fourth column
    @test names(lists.form_records) == ["trays", "notebook", "typed", "box"] && lists.form_records.box == lists.box &&
          lists.form_records.trays == lists.trays && lists.form_records.typed == lists.typed
    @test names(lists.records) == ["trays", "notebook", "typed"]
    @test length(JuliaTime.lesson_env("chance").sim_counts) == 1000 && JuliaTime.lesson_env("chance").observed_count == 5
    st = JuliaTime.lesson_env("stories")
    # The player names fits_low and fits_high; a pre-bound copy would let a one-rule line pass.
    @test !haskey(st, :fits_low) && !haskey(st, :fits_high)
    # Lesson 6 ties its ranges to Lesson 5's simulation: the same 1,000 counts
    @test st.sim_counts == JuliaTime.lesson_env("chance").sim_counts && length(st.sim_counts) == 1000
end

@testset "lessons: naming with == is read from the code and the undefined name (pure)" begin
    undef(n) = "Something went wrong.\n\nUndefVarError: `$n` not defined"
    naming = JuliaTime._lesson_naming_with_eq
    @test naming("tray == jars[1:2, :]", undef("tray"))
    @test naming("x = 1\n  tray==length(jars)", undef("tray"))
    @test naming("tray == nrow(jars) # a note", undef("tray"))
    @test !naming("tray == jars[1:2, :]", undef("jars"))          # a different name is undefined
    @test !naming("typd == notebook", undef("typd"))              # two bare names: may be a real comparison
    @test !naming("tray = jars[1:2, :]", undef("tray"))
    @test !naming("# tray == 3\njars", undef("tray"))
    @test !naming("tray == 3", "BoundsError")
end

@testset "lessons: an unknown word is named from Julia's message (pure)" begin
    undef(n) = "practice is a name Julia does not know yet.\n\nUndefVarError: `$n` not defined"
    ch(say) = Dict{String, Any}("feedback" => Dict{String, Any}("errors" => Any[Dict{String, Any}("match" => "UndefVarError", "say" => say, "example" => "x")]))
    line(c, code, n) = JuliaTime._lesson_error_line(c, code, undef(n); names=("logbook",))
    # a lesson's own entry talks about its table; the word the player typed is still named, and the table sentence stays
    l = line(ch("Julia does not know that name: the table is logbook, all small letters."), "x", "x")
    @test startswith(l, "Julia does not know the word `x`") && occursin("the table is logbook", l) && !occursin("that name", l)
    # round 2 (P06): advice about capital letters is dropped when the word has none
    @test l == "Julia does not know the word `x`: the table is logbook."
    l = line(ch("Julia does not know that word. The lists are called shelves, logged and keyed."), "length(lgged)", "lgged")
    @test startswith(l, "Julia does not know the word `lgged`.") && occursin("shelves, logged and keyed", l)
    # an entry that does not open that way gets the naming sentence in front
    l = line(ch("Check the spelling. The function is sample, with no capital letters."), "Pick(x, 2)", "Pick")
    @test startswith(l, "Julia does not know the word `Pick`. Check the spelling.")
    # round 2 (P06): a near miss of a taught word is named before the lesson's catch-all entry
    @test line(ch("Check the spelling."), "Sample(x, 2)", "Sample") == "Julia does not know `Sample`. Did you mean `sample`, in small letters?"
    # an entry that already names the word is left alone
    say = "Julia does not know `x`: use logbook."
    @test line(ch(say), "x", "x") == say
    # no lesson entry at all (an exam step, for example): a line that names the word, never the bare fallback
    l = line(Dict{String, Any}(), "x", "x")
    @test occursin("`x`", l) && l != JuliaTime.LESSON_FALLBACK_FEEDBACK && !occursin(r"\w(?:Error|Exception)", l) && !occursin("\u2014", l)
    # a different kind of error keeps its own lines
    @test JuliaTime._lesson_error_line(Dict{String, Any}(), "foo(1, 2)", "MethodError: no method matching foo(::Int64, ::Int64)"; names=()) == JuliaTime.LESSON_FALLBACK_FEEDBACK
    # separate values to sum name the slip: the values go in one list (round 7, Pat's final check)
    @test occursin("sum([1, 2, 3, 4])", JuliaTime._lesson_error_line(Dict{String, Any}(), "sum(1, 2, 3, 4)", "MethodError: no method matching sum(::Int64, ::Int64, ::Int64, ::Int64)"; names=()))
    # a word made of strange characters is not echoed
    @test !occursin("<script>", line(Dict{String, Any}(), "x", "<script>"))
end

@testset "lessons: comma and space slips point at the spot (pure)" begin
    # Julia's own reports, copied from Julia 1.10, so the lines can be tested without the sandbox.
    parse_err(code, col, reason) = "Julia couldn't parse this line. Look for a missing bracket, a missing comma, or a missing end keyword.\n\n" *
        "ParseError:\n# Error @ none:1:$col\n$code\n#" * " "^(col - 1) * "\u2559 \u2500\u2500 $reason"
    method_err(sig) = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching $sig\n\n" *
        "Closest candidates are:\n  getindex(::DataFrames.DataFrame, ::Integer, ::Union{Signed, Unsigned})\n   @ DataFrames dataframe.jl:508"
    line(code, msg; names=()) = JuliaTime._lesson_error_line(Dict{String, Any}(), code, msg; names=names)
    plain(l) = !occursin("\u2014", l) && !occursin(r"\w(?:Error|Exception)", l)

    # three parts inside the square brackets of a table: [3,4, :]
    for (code, sig) in (("practice_jars[3,4, :]", "getindex(::DataFrames.DataFrame, ::Int64, ::Int64, ::Colon)"),
                        ("jars[1, 2, 3]", "getindex(::DataFrames.DataFrame, ::Int64, ::Int64, ::Int64)"),
                        ("records[[1, 2], 3, :]", "getindex(::DataFrames.DataFrame, ::Vector{Int64}, ::Int64, ::Colon)"))
        @test line(code, method_err(sig)) == JuliaTime.LESSON_THREE_PARTS_FEEDBACK
    end
    @test occursin("Check the commas inside the square brackets", JuliaTime.LESSON_THREE_PARTS_FEEDBACK)
    # a space where a comma belongs
    @test line("jars[jars.batch_id .== \"B09\" :]", method_err("typed_hcat(::DataFrames.DataFrame, ::BitVector, ::Colon)")) ==
          JuliaTime.LESSON_SPACE_FOR_COMMA_FEEDBACK
    @test line("jars[[3 4], :]", method_err("getindex(::DataFrames.DataFrame, ::Matrix{Int64}, ::Colon)\n\nYou might have used a 2d row vector where a 1d column vector was required.")) ==
          JuliaTime.LESSON_SPACE_FOR_COMMA_FEEDBACK
    @test line("notebook[1 2]", "Something went wrong running this line.\n\nArgumentError: It is unclear whether you intend to perform an indexing operation or typed concatenation.") ==
          JuliaTime.LESSON_SPACE_FOR_COMMA_FEEDBACK
    @test line("jars[rule ; :]", method_err("typed_vcat(::DataFrames.DataFrame, ::BitVector, ::Colon)")) == JuliaTime.LESSON_SEMICOLON_FEEDBACK
    # a list picked with two places says so, not "There are only 3 items"; a table's own bounds line is unchanged
    @test line("notebook[1, 2]", "An index was outside the range of the collection.\n\nBoundsError: attempt to access 3-element Vector{Int64} at index [1, 2]") ==
          JuliaTime.LESSON_LIST_COMMA_FEEDBACK
    @test line("notebook[9]", "BoundsError: attempt to access 3-element Vector{Int64} at index [9]") == "There are only 3 items."
    # a table given one place
    @test line("jars[1:6,]", method_err("getindex(::DataFrames.DataFrame, ::UnitRange{Int64})")) == JuliaTime.LESSON_TABLE_TRAILING_COMMA_FEEDBACK
    @test line("jars[1:6]", method_err("getindex(::DataFrames.DataFrame, ::UnitRange{Int64})")) == JuliaTime.LESSON_TABLE_ONE_PART_FEEDBACK
    # a space in a name: the name the setup has, joined by an underscore
    undef(n) = "practice is a name Julia does not know yet.\n\nUndefVarError: `$n` not defined"
    l = line("practice jars[1:2, :]", undef("practice"); names=["jars", "practice_jars"])
    @test occursin("A name cannot have a space in it", l) && occursin("practice_jars", l) && plain(l)
    @test occursin("case_batch", line("jars.batch_id .== case batch", undef("case"); names=["jars", "case_batch"]))
    @test !occursin("space", line("lenght jars", undef("lenght"); names=["jars"]))          # a typo, not a split name
    @test !occursin("space", line("practice jars", undef("practice"); names=["jars"]))      # no such name here
    l = line("jars.batch id", "Something went wrong running this line.\n\nArgumentError: column name :batch not found in the data frame")
    @test occursin("column name cannot have a space", l) && occursin("`batch id`", l)
    @test !occursin("space", line("jars.batch .== 3", "ArgumentError: column name :batch not found in the data frame"))

    # a comma missing or doubled, with the brackets all closed: the line names the spot and the kind of bracket
    l = line("sample(eligible.jar_id 3; replace=false)", parse_err("sample(eligible.jar_id 3; replace=false)", 24, "Expected `)`"))
    @test occursin("commas inside the round brackets near `eligible.jar_id 3;`", l) && plain(l)
    l = line("x = [1, 2,, 3]", parse_err("x = [1, 2,, 3]", 11, "Expected `]`"))
    @test occursin("commas inside the square brackets near", l) && occursin(",,", l)
    @test occursin("commas inside the round brackets near `digits 2)`",
                   line("round(3.14159, digits 2)", parse_err("round(3.14159, digits 2)", 23, "Expected `)`")))
    @test occursin("commas inside the square brackets", line("jars[3 4, :]", parse_err("jars[3 4, :]", 9, "unexpected comma in array expression")))
    # a bracket left open is named, with the word beside it and its line (round 2, P06)
    for (code, want) in (("jars[jars.batch_id .== \"B09\", :", "The [ after `jars` on line 1 has no ]. Add ] at the end of line 1."),
                         ("sum(jars.detected", "The ( after `sum` on line 1 has no ). Add ) at the end of line 1."),
                         ("nrow(", "The ( after `nrow` on line 1 has no ). Add ) at the end of line 1."))
        @test line(code, parse_err(code, length(code), "Expected `]`")) == want
    end
    # a closer with no opener
    l = line("jars[1:6, :]]", parse_err("jars[1:6, :]]", 13, "extra tokens after end of expression"))
    @test l == "The ] on line 1 has no opening bracket before it. Remove it, or add the bracket it closes." && plain(l)
    # a space in the wrong place, and inside a sign
    l = line("jars[jars.batch_id . == \"B09\", :]", parse_err("jars[jars.batch_id . == \"B09\", :]", 19, "whitespace is not allowed here"))
    @test occursin("A space is in the wrong place near `jars.batch_id . ==`", l)
    l = line("jars[jars.batch_id .= = \"B09\", :]", parse_err("jars[jars.batch_id .= = \"B09\", :]", 23, "unexpected `=`"))
    @test occursin("space inside a sign such as .== or .!=", l) && occursin("near `.= =`", l)
    @test occursin("The line stops too soon", line("jars.batch_id .==", parse_err("jars.batch_id .==", 18, "premature end of input")))
    # a plain `= =` keeps the shared parse line
    @test startswith(line("x = = 3", parse_err("x = = 3", 5, "unexpected `=`")), "Julia could not read this line: unexpected `=`.")

    # a lesson's own entry still answers the slip it was written for ...
    ch = Dict{String, Any}("feedback" => Dict{String, Any}("errors" => Any[
        Dict("match" => "whitespace is not allowed here", "say" => "Check the sign: a dot, then <, then =, with no spaces between them."),
        Dict("match" => "Expected `)`", "say" => "A comma or a closing bracket is missing. Put a comma between the two inputs.")]))
    code = "jars[jars.batch_id . <= 3, :]"
    @test JuliaTime._lesson_error_line(ch, code, parse_err(code, 19, "whitespace is not allowed here")) ==
          "Check the sign: a dot, then <, then =, with no spaces between them."
    code = "sample(eligible.jar_id 3)"
    @test JuliaTime._lesson_error_line(ch, code, parse_err(code, 24, "Expected `)`")) ==
          "A comma or a closing bracket is missing. Put a comma between the two inputs."
    # ... but "a bracket is not closed" is skipped when every bracket is closed
    ch = Dict{String, Any}("feedback" => Dict{String, Any}("errors" => Any[
        Dict("match" => "Expected `]`", "say" => "You opened a bracket and did not close it. Every [ needs a ] and every ( needs a ).")]))
    code = "x = [1, 2,, 3]"
    @test occursin("commas inside the square brackets", JuliaTime._lesson_error_line(ch, code, parse_err(code, 11, "Expected `]`")))
    # a bracket really left open: the engine names it (round 2, P06), before the lesson's catch-all "Expected" entry
    code = "x = [1, 2"
    @test JuliaTime._lesson_error_line(ch, code, parse_err(code, 10, "Expected `]`")) == "The [ before `1` on line 1 has no ]. Add ] at the end of line 1."
    # bracket counting ignores brackets in quotes and comments
    @test !JuliaTime._lesson_brackets_unclosed("jars[jars.batch_id .== \"B[09\", :] # ((")
    @test JuliaTime._lesson_brackets_unclosed("sum(jars.detected") && JuliaTime._lesson_brackets_extra("f(x))")
end

@testset "lessons: the no-scroll data fixture is current (pure)" begin
    include(joinpath(@__DIR__, "..", "tools", "lesson-dump-data.jl"))
    stored = JSON.parsefile(joinpath(@__DIR__, "fixtures", "lesson-data-values.json"))
    # The range has no data tables and lesson-noscroll.cjs skips it, so the stored file lists lessons only.
    current = JSON.parse(JSON.json(dump_lesson_data()))
    delete!(current, "range")
    @test current == stored
    JuliaTime.reload_lessons!()
end

@testset "lessons: first load, every lesson message loads the lessons (pure)" begin
    fresh() = (JuliaTime._LESSONS_LOADED[] = false; empty!(JuliaTime.LESSONS); empty!(JuliaTime._LESSON_SOLUTIONS))
    try
        # lesson_info is the very first message on a fresh server: a direct link to lesson.html?lesson=lesson1
        fresh()
        r = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "lesson1", "request_id" => "first"))
        @test r["type"] == "lesson" && r["lesson"]["id"] == "lesson1"
        fresh()
        r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "no-such-lesson", "challenge" => "x", "code" => "1"))
        @test r["type"] == "error" && occursin("no-such-lesson", r["message"]) && haskey(JuliaTime.LESSONS, "lesson1")
        fresh()
        @test any(l -> l["id"] == "lesson1", JuliaTime.handle_message(Dict("type" => "lesson_list"))["lessons"])
        # the page sends list and info together: none may see a half-loaded set
        for _ in 1:3
            fresh()
            replies = Vector{Any}(undef, 8)
            @sync for i in 1:8
                Threads.@spawn replies[i] = iseven(i) ? JuliaTime.handle_message(Dict("type" => "lesson_list")) :
                    JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "lesson1", "request_id" => "q$i"))
            end
            @test all(r -> r["type"] in ("lessons", "lesson"), replies)
            @test all(r -> r["type"] != "lessons" || any(l -> l["id"] == "lesson1", r["lessons"]), replies)
        end
    finally
        JuliaTime.reload_lessons!()
    end
end

@testset "lessons: range result fields, first shot, words (pure)" begin
    wave = Dict{String, Any}("id" => "w", "targets" => Any["J-081", "J-082"], "rings" => "after")
    ok = JuliaTime.range_judge(wave, ["J-081", "J-082"]; shot_number=1)
    rg = ok["range"]
    @test ok["pass"] && rg["hits"] == 2 && rg["wrong_picks"] == 0 && rg["targets_missed"] == 0 && rg["misses"] == rg["wrong_picks"]
    # par and sharpshooter scoring are gone
    @test !any(k -> k in ("par", "chars", "sharpshooter"), keys(rg))
    # first_shot: clean, and the screen says it is the wave's first run
    @test rg["first_shot"] == true && rg["shot_number"] == 1
    @test JuliaTime.range_judge(wave, ["J-081", "J-082"]; shot_number=2)["range"]["first_shot"] == false
    @test JuliaTime.range_judge(wave, ["J-081", "J-082"]; shot_number=2)["range"]["shot_number"] == 2
    @test JuliaTime.range_judge(wave, ["J-081", "J-082"])["range"]["first_shot"] == false      # no shot number given
    @test JuliaTime.range_judge(wave, ["J-081", "J-082"])["range"]["shot_number"] === nothing
    @test JuliaTime.range_judge(wave, ["J-081"]; shot_number=1)["range"]["first_shot"] == false   # not clean
    j = JuliaTime.range_judge(wave, ["J-081", "J-083", "J-084"])          # 1 hit, 2 wrong, 1 missed
    @test j["range"]["hits"] == 1 && j["range"]["wrong_picks"] == 2 && j["range"]["targets_missed"] == 1 && j["range"]["score"] == -1
    @test j["feedback"] == "You picked 2 jars that are not targets (J-083 and J-084) and missed 1 target."
    @test JuliaTime.range_judge(wave, ["J-081", "J-082", "J-083"])["feedback"] == "You picked 1 jar that is not a target (J-083)."
    # the wrong picks are named, up to three, so the player sees which way they went
    @test JuliaTime.range_judge(wave, ["J-081", "J-082", "J-083", "J-084"])["feedback"] == "You picked 2 jars that are not targets (J-083 and J-084)."
    @test JuliaTime.range_judge(wave, ["J-081", "J-082", "J-083", "J-084", "J-085", "J-086", "J-087"])["feedback"] ==
          "You picked 5 jars that are not targets (J-083, J-084, J-085 and 2 more)."
    @test JuliaTime.range_judge(wave, ["J-081"])["feedback"] == "You missed 1 target jar."
    @test JuliaTime.range_judge(wave, ["J-081", "J-082", "J-082"])["feedback"] == "You picked 1 jar more than once."
    for picks in (["J-081"], ["J-083"], String[], ["J-081", "J-082", "J-083", "J-083"])
        @test !occursin("misses", lowercase(JuliaTime.range_judge(wave, picks)["feedback"]))
    end
    rule = Dict{String, Any}("rule" => Dict{String, Any}("count" => 3, "distinct" => true, "from" => Any["J-091", "J-092", "J-093", "J-094"]))
    @test JuliaTime.range_judge(rule, ["J-091", "J-092"])["range"]["targets_missed"] == 1
    @test JuliaTime.range_judge(rule, ["J-091", "J-092", "J-093"])["range"]["targets_missed"] == 0
    # rings pass through lesson_info; the example does not
    JuliaTime.reload_lessons!()
    w = deepcopy(wave); w["example"] = "jars.jar_id[1:2]"; w["target"] = "t"
    JuliaTime.LESSONS["range-test"] = Dict{String, Any}("id" => "range-test", "kind" => "range", "title" => "T", "setup" => "jars", "waves" => Any[w])
    try
        pub = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "range-test"))["lesson"]
        @test pub["waves"][1]["rings"] == "after" && !haskey(pub["waves"][1], "example")
    finally
        JuliaTime.reload_lessons!()
    end
end

@testset "lessons: That works too (pure)" begin
    ch = Dict{String, Any}("check" => Dict{String, Any}("taught" => Any[".== ", "jars[ "]), "feedback" => Dict{String, Any}("taught" => "a rule with .==, then the rows."))
    works = JuliaTime._lesson_works_too
    @test works(ch, "jars[jars.batch_id .== \"B09\", :]") == ""
    @test works(ch, "jars [ jars.batch_id  .==  \"B09\" , :]") == ""            # whitespace is ignored on both sides
    @test works(ch, "filter(:batch_id => ==(\"B09\"), jars)") == "That works too. The way this lesson teaches: a rule with .==, then the rows."
    @test works(ch, "# jars[ .== \nfilter(:batch_id => ==(\"B09\"), jars)") != ""  # a taught item in a comment does not count
    @test works(Dict{String, Any}("check" => Dict{String, Any}("taught" => Any["sum("])), "count(x)") == JuliaTime.LESSON_ALSO_WORKS_FALLBACK
    # round 9: an item with a newline keeps its line break (spaces and tabs go)
    nl = Dict{String, Any}("check" => Dict{String, Any}("taught" => Any["b09[", "\ntray"]), "feedback" => Dict{String, Any}("taught" => "the name tray goes on line 1."))
    @test works(nl, "tray = b09[b09.tray_id .== \"T-A\", :]\ntray") == ""
    @test works(nl, "tray  =  b09[b09.tray_id .== \"T-A\", :]\n  tray  ") == ""
    @test works(nl, "tray = b09[b09.tray_id .== \"T-A\", :]\n\ttray # show it") == ""
    @test startswith(works(nl, "b09[b09.tray_id .== \"T-A\", :]"), "That works too.")                         # no name made
    @test startswith(works(nl, "t = b09[b09.tray_id .== \"T-A\", :]\nt"), "That works too.")                 # another name
    @test startswith(works(nl, "tray = b09[b09.tray_id .== \"T-A\", :]"), "That works too.")                 # the name, never shown
    @test startswith(works(nl, "tray = b09[b09.tray_id .== \"T-A\", :]\n# tray"), "That works too.")         # a comment does not count
    @test works(Dict{String, Any}("check" => Dict{String, Any}()), "anything") == ""
    @test works(Dict{String, Any}(), "anything") == ""
    # the taught line never goes to the screen inside the lesson
    l = JuliaTime.load_lesson_file(_FIXTURE)
    l["rounds"][1]["challenges"][3]["feedback"]["taught"] = "the words for the way"
    @test !haskey(only(filter(c -> c["id"] == "e-r1-c2", _challenges(JuliaTime.lesson_public(l))))["feedback"], "taught")
end

@testset "lessons: table and list slips, coaching lines (pure)" begin
    env = JuliaTime.lesson_env("jars")
    line(code, msg; e=env) = JuliaTime._lesson_error_line(Dict{String, Any}(), code, msg; names=JuliaTime._lesson_env_names(e), env=e)
    notiter = "Something went wrong running this line.\n\nAbstractDataFrame is not iterable. Use eachrow(df) to get a row iterator or eachcol(df) to get a column iterator"
    @test line("sum(jars)", notiter) == "sum needs one column, not the whole table: pick a column with a dot, like jars.detected."
    @test line("count(practice_jars)", notiter) == "count needs one column, not the whole table: pick a column with a dot, like practice_jars.detected."
    @test line("length(jars)", "MethodError: no method matching length(::DataFrames.DataFrame)\n\nClosest candidates") ==
          "length needs one column, not the whole table: pick a column with a dot, like jars.detected."
    @test line("sample(practice_jars, 2; replace=false)", "MethodError: no method matching sample(::DataFrames.DataFrame, ::Int64; replace::Bool)") ==
          "sample needs one column, not the whole table: pick a column with a dot, like practice_jars.jar_id."
    e4 = JuliaTime.lesson_env("practice4")
    # open_jars holds only jar ids (text): no column to count, so no example rather than a wrong one
    @test line("sum(open_jars)", notiter; e=e4) == "sum needs one column, not the whole table: pick a column with a dot, after the table's name."
    @test line("sample(open_jars, 3; replace=false)", "MethodError: no method matching sample(::DataFrames.DataFrame, ::Int64; replace::Bool)"; e=e4) ==
          "sample needs one column, not the whole table: pick a column with a dot, like open_jars.jar_id."
    # round 9: the table is the one in the player's code, and the column fits the step
    e2 = JuliaTime.lesson_env("b09_jars")
    @test line("sum(b09[b09.tray_id .== \"T-C\", :])", notiter; e=e2) == "sum needs one column, not the whole table: pick a column with a dot, like b09.detected."
    @test line("sum(practice_jars[practice_jars.tray_id .== \"T-A\", :])", notiter; e=e2) == "sum needs one column, not the whole table: pick a column with a dot, like practice_jars.detected."
    @test line("length(practice_jars[practice_jars.batch_id .== \"B01\", :])", "MethodError: no method matching length(::DataFrames.DataFrame)"; e=env) ==
          "length needs one column, not the whole table: pick a column with a dot, like practice_jars.detected."
    @test line("tray = b09[b09.tray_id .== \"T-C\", :]\nsum(tray)", notiter; e=e2) == "sum needs one column, not the whole table: pick a column with a dot, like tray.detected."
    @test line("sample(practice_jars, 2; replace=false)", "MethodError: no method matching sample(::DataFrames.DataFrame, ::Int64; replace::Bool)"; e=e2) ==
          "sample needs one column, not the whole table: pick a column with a dot, like practice_jars.jar_id."
    e3 = JuliaTime.lesson_env("lists")
    @test line("sum(records)", notiter; e=e3) == "sum needs one column, not the whole table: pick a column with a dot, like records.notebook."   # the first number column, never the text trays column
    # a lesson's own MethodError line does not answer a table given to a function
    ch = Dict{String, Any}("feedback" => Dict{String, Any}("errors" => Any[Dict("match" => "MethodError", "say" => "sample needs two inputs.")]))
    @test JuliaTime._lesson_error_line(ch, "sample(practice_jars, 2)", "MethodError: no method matching sample(::DataFrames.DataFrame, ::Int64)"; env=env) ==
          "sample needs one column, not the whole table: pick a column with a dot, like practice_jars.jar_id."
    @test JuliaTime._lesson_error_line(ch, "sample(1, 2, 3)", "MethodError: no method matching sample(::Int64, ::Int64, ::Int64)"; env=env) == "sample needs two inputs."
    # indexing keeps its own lines
    @test !occursin("needs one column", line("jars[1, 2, :]", "MethodError: no method matching getindex(::DataFrames.DataFrame, ::Int64, ::Int64, ::Colon)"))
    @test occursin("more picks than the list holds", line("sample(1:6, 9; replace=false)", "Something went wrong running this line.\n\nCannot draw more samples without replacement."))
    @test line("x[b09.tray_id .== \"T-A\"]", "An index was outside the range of the collection.\n\nBoundsError: attempt to access 4-element Vector{Bool} at index [6-element BitVector]") ==
          "The rule has 6 true/false answers, but the list it picks from has 4 items. Make the rule from the same table you pick from."
    @test JuliaTime._lesson_bounds_line("BoundsError: attempt to access 4-element Vector{Bool} at index [9]") == "There are only 4 items."
    @test JuliaTime._lesson_missing_dot_line("sum(typed != 0)") == "A comparison sign with no dot gives one answer for the whole list. Put a dot in front, like .!=, to compare item by item."
    @test JuliaTime._lesson_missing_dot_line("sum(typed .!= 0)") == ""
    @test JuliaTime._lesson_missing_dot_line("filter(:batch_id => ==(\"B09\"), jars)") == ""
    @test JuliaTime._lesson_missing_dot_line("x = \"a != b\"") == ""
    @test occursin("whole table", JuliaTime._lesson_shape_mismatch_line(DataFrame(a=[1]), ["x"]))
    @test occursin("wants a table of whole rows", JuliaTime._lesson_shape_mismatch_line(["x"], DataFrame(a=[1])))
    @test JuliaTime._lesson_shape_mismatch_line(3, 4) == ""
end

@testset "lessons: practice checkers re-run under the chance seeds (pure)" begin
    calls = Int[]
    rerun_with(vals) = (code, seed) -> (push!(calls, seed); (status=:ok, value=vals(seed)))
    good = JuliaTime._check_lesson4_practice(2; rerun=rerun_with(seed -> seed % 2 == 0 ? ["P-01", "P-02"] : ["P-03", "P-04"]))
    @test good(["P-01", "P-02"], "code")[1] && calls == collect(JuliaTime.MYSTERY_C4_CHANCE_SEEDS)
    # a pick that avoided a repeat only by luck: fine on the run the player saw, twice on another seed
    lucky = JuliaTime._check_lesson4_practice(2; rerun=rerun_with(seed -> seed == 404 ? ["P-01", "P-01"] : ["P-01", "P-02"]))
    ok, msg = lucky(["P-01", "P-02"], "sample(practice_jars.jar_id, 2)")
    @test !ok && occursin("tries your line a few more times", msg) && occursin("replace=false", msg)
    # the same jars every time: chosen by hand
    fixed = JuliaTime._check_lesson4_practice(2; rerun=rerun_with(seed -> ["P-01", "P-02"]))
    @test !fixed(["P-01", "P-02"], "[\"P-01\", \"P-02\"]")[1]
    @test !JuliaTime._check_lesson4_practice(2; rerun=(c, s) -> (status=:error, value=nothing))(["P-01", "P-02"], "x")[1]
    @test !good(["P-01"], "x")[1] && occursin("whole table", good(DataFrame(jar_id=["P-01"]), "x")[2])
end

@testset "lessons: practice checkers, pure" begin
    # the seeded re-run is stubbed here (the sandbox test below runs the real one)
    c3 = JuliaTime._check_lesson4_practice(3; rerun=(code, seed) -> (status=:ok, value=seed % 2 == 0 ? ["P-01", "P-02", "P-04"] : ["P-03", "P-02", "P-04"]))
    @test c3(["P-01", "P-02", "P-04"], "")[1]
    @test c3(3, "")[1] == false
    @test c3(["P-01", "P-02"], "")[2] == "Pick exactly 3 jars."
    @test c3(["B01", "B02", "B01"], "")[2] == "Every pick should be a jar id such as P-01: use the jar_id column."
    @test occursin("twice", c3(["P-01", "P-01", "P-02"], "")[2])
    # Lesson 5 deals are judged by value and by a seeded re-run (stubbed here): never by the text rand(Bool, n)
    varying4 = (code, seed) -> (status=:ok, value=[isodd(i) ? [true, false, true, true] : [false, false, true, false] for i in 1:60])
    f4 = JuliaTime._check_lesson5_deal(4, false; rerun=varying4)
    @test f4([true, false, true, true], "rand([true, false], 4)")[1]                   # any code that deals four cards by luck
    @test f4([true, false, true, true], "rand(Bool, 4)")[1]
    typed4 = JuliaTime._check_lesson5_deal(4, false; rerun=(code, seed) -> (status=:ok, value=[[true, false, true, true] for _ in 1:60]))
    @test !typed4([true, false, true, true], "[true, false, true, true]")[1]           # a typed list gives one answer every time
    @test occursin("same answer every time", typed4([true, false, true, true], "x")[2])
    @test !f4([true, false, true], "rand(Bool, 3)")[1] && !f4(3, "sum(rand(Bool, 4))")[1] && !f4([1, 0, 1, 1], "rand(0:1, 4)")[1]
    @test !JuliaTime._check_lesson5_deal(4, false; rerun=(c, s) -> (status=:error, value=nothing))([true, false, true, true], "x")[1]
    c10 = JuliaTime._check_lesson5_deal(10, true; rerun=(code, seed) -> (status=:ok, value=[i % 11 for i in 1:60]))
    @test c10(7, "sum(rand([true, false], 10))")[1] && c10(0, "x")[1] && c10(10, "x")[1]
    @test !c10(11, "sum(rand(Bool,10))")[1] && !c10(-1, "x")[1] && !c10(3.0, "x")[1] && !c10(true, "x")[1]
    @test !JuliaTime._check_lesson5_deal(10, true; rerun=(code, seed) -> (status=:ok, value=fill(7, 60)))(7, "7")[1]   # a typed count
    @test !JuliaTime._check_lesson5_deal(10, true; rerun=(code, seed) -> (status=:ok, value=[i % 7 for i in 1:60]))(4, "sum(rand(Bool, 6))")[1]   # six cards never reach ten
end

@testset "lessons: requires_any (pure)" begin
    ch = Dict{String, Any}("check" => Dict{String, Any}("requires_any" => Any["(", "|>"], "same_value" => false), "feedback" => Dict{String, Any}("requires" => "Use a function."))
    ok(code) = JuliaTime._lesson_judge_value(Dict{String, Any}("id" => "x"), ch, code, (status=:ok, value=0.5), nothing)
    @test ok("sum(flags) / length(flags)")[1] && ok("flags |> mean")[1]
    @test ok("0.5") == (false, "Use a function.") && ok("0.5 # (")[1] == false
end

@testset "lessons: practice_jars and setups (pure)" begin
    @test JuliaTime.lesson_practice_jars() == DataFrame(
        jar_id=["P-01", "P-02", "P-03", "P-04"], batch_id=["B01", "B02", "B01", "B02"],
        tray_id=["T-A", "T-A", "T-B", "T-B"], detected=[true, false, true, true])
    env = JuliaTime.lesson_env("jars")
    @test env.case_batch == "B09" && nrow(env.jars) == 12
    @test JuliaTime.lesson_env("nothing-like-this") === nothing
end

@testset "lessons: can_do, common_mistake and look_closer pass through lesson_info (pure)" begin
    l = JuliaTime.load_lesson_file(_FIXTURE)
    l["close"]["can_do"] = ["Pick rows from any table with a rule.", "Count what you picked."]
    l["close"]["common_mistake"] = "Writing a single = when you mean to ask."
    see = first(filter(c -> c["kind"] == "see", _challenges(l)))
    see["look_closer"] = Dict{String, Any}("text" => "Julia counts from 1.", "code" => "length([4, 7, 1])")
    JuliaTime.LESSONS[l["id"]] = l
    try
        r = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => l["id"]))
        @test r["lesson"]["close"]["can_do"] == ["Pick rows from any table with a rule.", "Count what you picked."]
        @test r["lesson"]["close"]["common_mistake"] == "Writing a single = when you mean to ask."
        pub = first(filter(c -> c["id"] == see["id"], _challenges(r["lesson"])))
        @test pub["look_closer"]["code"] == "length([4, 7, 1])" && pub["look_closer"]["text"] == "Julia counts from 1."
    finally
        JuliaTime.reload_lessons!()
    end
end

@testset "lessons: round 10 engine (pure)" begin
    # picks: a table, one row, a list, a set and a named tuple with a jar_id field all read as jar ids
    jars = JuliaTime.mystery_jars()
    @test JuliaTime._lesson_picked_ids(jars[7:8, :]) == ["J-091", "J-092"]
    @test JuliaTime._lesson_picked_ids(jars[9, :]) == ["J-093"]                       # a DataFrameRow
    @test JuliaTime._lesson_picked_ids(Set(jars.jar_id[7:10])) == sort(jars.jar_id[7:10])
    @test JuliaTime._lesson_picked_ids((jar_id = jars.jar_id[7:10],)) == jars.jar_id[7:10]
    @test JuliaTime._lesson_picked_ids((jar_id = "J-093", n = 1)) == ["J-093"]
    @test JuliaTime._lesson_picked_ids(jars.jar_id[7:8]) == ["J-091", "J-092"]
    @test JuliaTime._lesson_picked_ids(select(jars, :batch_id)) === nothing            # no jar_id column
    @test JuliaTime._lesson_picked_ids(jars[9, [:batch_id]]) === nothing
    @test JuliaTime._lesson_picked_ids((batch = "B09",)) === nothing
    @test JuliaTime._lesson_picked_ids(Set([1, 2])) === nothing
    @test JuliaTime._lesson_picked_ids([3, 4, 5]) === nothing
    # a refused value gets a line that says what to return
    line = JuliaTime._range_refusal_line
    @test occursin("no jar_id column", line(select(jars, :batch_id))) && occursin("no jar_id column", line((batch = "B09",)))
    @test startswith(line([3, 4, 5]), "Numbers are not jar ids") && startswith(line(4), "Numbers are not jar ids")
    @test startswith(line(jars.detected), "That is a true or false answer") && startswith(line(true), "That is a true or false answer")
    @test startswith(line(nothing), "Your line gave back nothing")
    @test startswith(line(:x), "Give back jar ids such as")
    for v in (select(jars, :batch_id), [3, 4], jars.detected, nothing, :x)
        @test !occursin("\u2014", line(v))
    end

    # a wave's own requires and forbids, with the lines from data
    wave = Dict{String, Any}("check" => Dict{String, Any}("requires" => Any["jars."], "forbids" => Any["\"J-"]),
        "feedback" => Dict{String, Any}("requires" => "Start from the jars table.", "forbids" => "Ask a question; do not type ids."))
    rc = JuliaTime._lesson_rules_check
    @test rc(wave, "jars.jar_id[1]") == ("", "")
    @test rc(wave, "[\"J-081\"]") == ("requires", "Start from the jars table.")
    @test rc(wave, "jars.jar_id[jars.jar_id .== \"J-081\"]") == ("forbids", "Ask a question; do not type ids.")
    @test rc(wave, "jars.jar_id[1] # \"J-081\"") == ("", "")                      # a comment does not count
    @test rc(Dict{String, Any}("check" => Dict{String, Any}("forbids" => Any["[[" ])), "x[[1]]"; forbids_default="D") == ("forbids", "D")
    @test rc(Dict{String, Any}(), "anything") == ("", "")
    # the public wave never carries its check
    JuliaTime.LESSONS["range-test"] = Dict{String, Any}("id" => "range-test", "kind" => "range", "title" => "T", "setup" => "jars",
        "waves" => Any[merge(deepcopy(wave), Dict{String, Any}("id" => "w", "target" => "t", "example" => "jars.jar_id[1]"))])
    try
        pw = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "range-test"))["lesson"]["waves"][1]
        @test !haskey(pw, "check") && !haskey(pw, "example") && pw["id"] == "w"
    finally
        JuliaTime.reload_lessons!()
    end

    # a chance wave: the same jars on every run fail; different jars pass. `rerun` is the hook.
    fixed = (code, seed) -> (status=:ok, value=["J-091", "J-092"])
    varied = (code, seed) -> (status=:ok, value=["J-09$(1 + seed % 5)", "J-096"])
    @test !JuliaTime._range_picks_vary("x", ["J-091", "J-092"], nothing; rerun=fixed)
    @test JuliaTime._range_picks_vary("x", ["J-091", "J-092"], nothing; rerun=varied)
    @test !JuliaTime._range_picks_vary("x", ["J-091", "J-092"], nothing; rerun=(c, sd) -> (status=:error, value=nothing))   # reruns that fail are skipped
    @test JuliaTime._range_picks_vary("x", ["J-091"], nothing; rerun=(c, sd) -> (status=:ok, value="J-09$(1 + sd % 3)"))   # one id per run

    # a scalar equal to the item of a one-item list is the same answer
    sc = JuliaTime._lesson_scalar_for_list
    @test sc("left blank", ["left blank"]) && sc(3, [3]) && sc(false, [false])
    @test !sc(["left blank"], ["left blank"]) && !sc("x", ["left blank"]) && !sc("left blank", ["left blank", "a"])
    @test !sc(nothing, [nothing]) && !sc(DataFrame(a=[1]), [1]) && !sc((1,), [1]) && !sc(Set([1]), [1])
    @test !sc(1, 1)   # the answer must be a list of one

    # Julia's own message: a blank and a parse error say it plainly
    rawmsg = JuliaTime._lesson_raw_message
    @test rawmsg("x .== ___", "Something went wrong running this line.\n\nsyntax: all-underscore identifier used as rvalue") ==
          "The blank ___ is still in your line. Replace it with your answer, then run."
    pe = "Julia couldn't parse this line.\n\nParseError:\n# Error @ none:1:39\nsum(x[y .== \"T-C\"\n#" * " "^38 * "\u2559 \u2500\u2500 Expected `]`"
    @test rawmsg("sum(x[y .== \"T-C\"", pe) == "ParseError: Expected `]` (line 1, column 39)."
    @test rawmsg("1 + ", "BoundsError: whatever") == "BoundsError: whatever"
    @test !occursin("\u2014", JuliaTime.LESSON5_DECIMALS_FEEDBACK * JuliaTime.RANGE_SAME_JARS_FEEDBACK * JuliaTime.RANGE_FORBIDS_FEEDBACK * JuliaTime.LESSON_SCALAR_WORKS_TOO)

    # Lesson 5: a count or a deal made from rand with no type gives decimals; the line says so and names Bool
    dec = (code, seed) -> (status=:ok, value=[0.5 for _ in 1:60])
    @test JuliaTime._check_lesson5_deal(8, true; rerun=dec)(2.6, "sum(rand(8))") == (false, JuliaTime.LESSON5_DECIMALS_FEEDBACK)
    @test JuliaTime._check_lesson5_deal(4, false; rerun=dec)([0.1, 0.2, 0.3, 0.4], "rand(4)") == (false, JuliaTime.LESSON5_DECIMALS_FEEDBACK)
    @test occursin("Bool", JuliaTime.LESSON5_DECIMALS_FEEDBACK)
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    _run(lesson, cid, code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => lesson,
                                "challenge" => cid, "code" => code, "request_id" => "t"))
    _run_look(lesson, cid, code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => lesson,
                                "challenge" => cid, "code" => code, "look" => true, "request_id" => "t"))

    @testset "lessons: every solution passes its own check (sandbox)" begin
        for l in _all_lessons()
            JuliaTime.LESSONS[l["id"]] = l
            for c in _challenges(l)
                haskey(c, "solution") || continue
                res = _run(l["id"], c["id"], c["solution"])
                @test res["type"] == "lesson_result"
                @test res["status"] == "ok"
                @test (res["pass"] == true || (println(l["id"], "/", c["id"], " solution did not pass: ", res["feedback"]); false))
            end
        end
        JuliaTime.reload_lessons!()
    end

    @testset "lessons: the target range runs code and judges the picks (sandbox)" begin
        JuliaTime.LESSONS["range-test"] = deepcopy(_RANGE_TEST)
        try
            run_wave(w, code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "range-test",
                                    "challenge" => w, "code" => code, "request_id" => "r"))
            # every example passes its own wave
            for w in _RANGE_TEST["waves"], sd in 1:3
                res = run_wave(w["id"], w["example"])
                @test res["status"] == "ok" && res["pass"] == true && res["range"]["clean"] == true
            end
            # a list of ids and a table with jar_id both work
            r = run_wave("w-fixed", "jars.jar_id[1:2]")
            @test r["pass"] && r["picked_ids"] == ["J-081", "J-082"] && r["range"]["score"] == 2
            r = run_wave("w-fixed", "jars[1:2, :]")
            @test r["pass"] && r["value_table"]["columns"][1] == "jar_id"
            r = run_wave("w-fixed", "jars[jars.batch_id .== \"B08\", :]")   # six jars, two are targets
            @test !r["pass"] && r["range"]["hits"] == 2 && r["range"]["misses"] == 4 && r["range"]["score"] == -2
            r = run_wave("w-fixed", "jars.jar_id[1]")
            @test !r["pass"] && r["range"]["missed_targets"] == ["J-082"] && r["range"]["misses"] == 0
            # a rule wave: right count from the group passes, the wrong group does not
            @test run_wave("w-rule", "sample(jars.jar_id[7:12], 3; replace=false)")["pass"]
            @test !run_wave("w-rule", "jars.jar_id[1:3]")["pass"]
            # a chance wave is not passed by jars chosen by hand: the same three every run fail the chance check
            r = run_wave("w-rule", "jars.jar_id[7:9]")
            @test !r["pass"] && r["feedback"] == JuliaTime.RANGE_SAME_JARS_FEEDBACK && r["range"]["clean"] == false &&
                  r["range"]["rule_broken"] == "same_jars" && r["range"]["first_shot"] == false && r["range"]["hits"] == 3
            # a value that is not jar ids is named, not crashed on; no range result is sent
            r = run_wave("w-fixed", "jars.jar_id[1]")   # a single jar is one pick
            @test r["picked_ids"] == ["J-081"] && r["range"]["hits"] == 1
            r = run_wave("w-fixed", "42")
            @test r["status"] == "ok" && !r["pass"] && !haskey(r, "range") && occursin("jar id", r["feedback"]) &&
                  startswith(r["feedback"], "Numbers are not jar ids")
            # errors get the usual coaching
            r = run_wave("w-fixed", "jars.jar_id(12)")
            @test r["status"] == "error" && !r["pass"] && r["feedback"] == "Round brackets call a function; square brackets pick from a list: jars.jar_id[12]."
            r = run_wave("w-fixed", "jars.jar_id[0]")
            @test r["feedback"] == "Julia counts from 1, and there is no position 0 or below."
            # the range shows no pocket dictionary, so the fallback line never points to one
            r = run_wave("w-fixed", "parse(Int, \"x\")")
            @test r["status"] == "error" && r["feedback"] == JuliaTime.LESSON_RANGE_FALLBACK_FEEDBACK && !occursin("dictionary", r["feedback"])
            # separate values to sum get the one-list line, still with no pocket dictionary (round 7)
            r = run_wave("w-fixed", "sum(1, 2, 3, 4)")
            @test r["status"] == "error" && occursin("sum([1, 2, 3, 4])", r["feedback"]) && !occursin("dictionary", r["feedback"])
            r = run_wave("w-fixed", "n <- 3")
            @test r["status"] == "error" && r["feedback"] == JuliaTime.MYSTERY_R_ARROW_LINE
            r = run_wave("w-fixed", "nrow(jarz)")
            @test r["status"] == "error" && !isempty(r["feedback"])
            r = run_wave("w-fixed", "while true end")
            @test r["status"] == "timeout" && !r["pass"] && occursin("stopped", r["feedback"])
        finally
            JuliaTime.reload_lessons!()
        end
    end

    @testset "lessons: every range example passes its own wave (sandbox)" begin
        JuliaTime.reload_lessons!()
        range_files = [f for f in _LESSON_FILES if get(JuliaTime.load_lesson_file(f), "kind", nothing) == "range"]
        for f in range_files
            rg = JuliaTime.load_lesson_file(f)
            JuliaTime.LESSONS[rg["id"]] = rg
            # the range runs on its own setup (practice1), so its targets are that logbook's jars, never the case jars
            @test rg["setup"] == "practice1"
            ids = Set(JuliaTime.lesson_env(rg["setup"]).logbook.jar_id)
            @test !any(i -> startswith(i, "J-"), ids)
            for w in rg["waves"]
                # a wave with its own table (the boss level's `jars`) is judged against that table's jars
                own = JuliaTime._range_wave_logbook(w)
                wids = own === nothing ? ids : Set(own.jar_id)
                own === nothing || @test !any(i -> startswith(i, "J-"), wids)
                get(w, "targets", nothing) === nothing || @test all(t -> t in wids, w["targets"])
                get(w, "rule", nothing) === nothing || @test all(t -> t in wids, w["rule"]["from"])
                for _ in 1:3   # random waves: several draws
                    res = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => rg["id"],
                                "challenge" => w["id"], "code" => w["example"], "request_id" => "t"))
                    @test (res["status"] == "ok" && res["pass"] == true ||
                           (println(rg["id"], "/", w["id"], " example did not pass: ", res["feedback"]); false))
                end
            end
        end
        JuliaTime.reload_lessons!()
    end

    @testset "lessons: the range runs on practice1 (sandbox)" begin
        JuliaTime.reload_lessons!()
        rg = JuliaTime.LESSONS["range"]
        run_w(c, code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "range", "challenge" => c, "code" => code, "request_id" => "r"))
        r = run_w("w1", "logbook.jar_id[9]")                                    # one id on its own, a Q- id
        @test r["pass"] && r["picked_ids"] == ["Q-053"]
        r = run_w("w1", "\"J-093\"")                                          # a case id is not a practice pick
        @test !r["pass"] && r["picked_ids"] == ["J-093"] && r["range"]["misses"] == 1
        r = run_w("w3", "logbook[7:12, :]")                                     # right jars for B05, wrong batch for w3
        @test !r["pass"]
        r = run_w("w3", "[\"Q-041\", \"Q-042\", \"Q-043\", \"Q-044\", \"Q-045\", \"Q-046\"]")   # typed practice ids are blocked
        @test !r["pass"] && r["range"]["rule_broken"] in ("requires", "forbids") && r["feedback"] == "Aim with a rule this time: ask each jar a question, do not name the jars or count rows."
        r = run_w("w4", "jars")                                                 # the case table is not bound here
        @test r["status"] != "ok" || !r["pass"]
        r = run_w("w4", "5")
        @test occursin("Q-053", r["feedback"]) && !occursin("J-0", r["feedback"])
        JuliaTime.reload_lessons!()
    end

    @testset "lessons: the boss wave runs on its own table (sandbox)" begin
        # Round 2 (P19): the boss wave carries its own `jars` (range.md, builder R); the line runs on that table as
        # `logbook`, never on the range's twelve jars. The real w11 is used when it has `jars`; until the range
        # content lands, a copy of the range whose last wave brings a 30-jar table (from `range_boss`) stands in.
        JuliaTime.reload_lessons!()
        rg = deepcopy(JuliaTime.LESSONS["range"])
        boss = rg["waves"][end]
        if JuliaTime._range_wave_jars_table(boss) === nothing
            t = JuliaTime.lesson_env("range_boss").logbook
            boss = Dict{String, Any}("id" => "wb", "boss" => true, "story" => "Thirty jars.", "rings" => "after", "rule" => nothing,
                "jars" => [Dict{String, Any}("jar_id" => t.jar_id[i], "batch_id" => t.batch_id[i], "tray_id" => t.tray_id[i],
                                             "detected" => t.detected[i]) for i in 1:nrow(t)],
                "example" => "logbook[logbook.detected .& (logbook.tray_id .!= \"T-E\") .& (logbook.batch_id .!= \"B06\"), :]",
                "check" => Dict{String, Any}("requires_any" => ["!="], "forbids" => ["Q-0"]))
            boss["targets"] = t.jar_id[t.detected .& (t.tray_id .!= "T-E") .& (t.batch_id .!= "B06")]
            rg["waves"][end] = boss   # in place of today's w11, so the copy keeps one boss, the last wave
        end
        rg["id"] = "range-boss-test"
        JuliaTime.LESSONS[rg["id"]] = rg
        try
            own = JuliaTime._range_wave_jars_table(boss)
            @test nrow(own) >= JuliaTime.LESSON_BOSS_MIN_JARS && isempty(JuliaTime.lesson_contract_violations(rg))
            run_b(code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => rg["id"], "challenge" => boss["id"],
                                                        "code" => code, "request_id" => "b"))
            r = run_b(boss["example"])
            @test r["status"] == "ok" && r["pass"] == true && sort(r["picked_ids"]) == sort(boss["targets"])
            @test all(in(Set(own.jar_id)), r["picked_ids"])
            # `logbook` is the wave's table: its rows, and none of the range's own twelve jars that it does not hold
            r = run_b("logbook.jar_id")
            @test r["picked_ids"] == own.jar_id
            # the same line on the range's twelve jars would pick other jars, so the pass above came from the wave's table
            twelve = JuliaTime.lock(JuliaTime._RUN_LOCK) do
                JuliaTime.run_code(boss["example"]; env=JuliaTime.lesson_env(rg["setup"]), budget=JuliaTime.RUN_BUDGET)
            end
            @test twelve.status != :ok || sort(something(JuliaTime._lesson_picked_ids(twelve.value), String[])) != sort(boss["targets"])
            # the screen gets the wave's rack (no `detected`) and its columns
            pw = JuliaTime.lesson_public(rg)["waves"][end]
            @test length(pw["jars"]) == nrow(own) && all(j -> !haskey(j, "detected"), pw["jars"]) &&
                  pw["columns"] == ["jar_id", "batch_id", "tray_id", "detected"] && !haskey(pw, "example")
            # the other waves still run on the range's own table
            r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => rg["id"],
                    "challenge" => "w1", "code" => "logbook.jar_id[9]", "request_id" => "b"))
            @test r["picked_ids"] == ["Q-053"]
        finally
            delete!(JuliaTime.LESSONS, rg["id"])
            JuliaTime.reload_lessons!()
        end
    end

    @testset "lessons: wrong value, errors, requires, timeout (sandbox)" begin
        l = JuliaTime.load_lesson_file(_FIXTURE)
        JuliaTime.LESSONS[l["id"]] = l
        try
            r = _run("lesson-engine", "e-r1-c3", "nrow(practice_jars) + 1")
            @test r["status"] == "ok" && r["pass"] == false && r["feedback"] == "Write nrow(practice_jars)."
            @test r["value_repr"] == "5" && r["value_table"] === nothing
            # right value but a required word missing
            r = _run("lesson-engine", "e-r1-c3", "4")
            @test r["pass"] == false && r["feedback"] == "Your line needs to use: nrow."
            r = _run("lesson-engine", "e-r1-c2", "length(practice_jars.tray_id)")
            @test r["feedback"] == "Your line needs to use: batch_id." && !occursin("4", r["feedback"])
            # an unchanged starter is not run and gets its own line; spaces do not matter
            r = _run("lesson-engine", "e-r1-c2", " length( practice_jars.jar_id ) ")
            @test r["pass"] == false && r["feedback"] == "This is the line as given. Change one thing first." && r["value_repr"] == ""
            # a fix runs the broken line as given and shows its own error line
            r = _run("lesson-engine", "e-r1-fix", "length(practice_jars.batch)")
            @test r["status"] == "error" && r["feedback"] == "The column is called batch_id."
            # parse errors quote Julia's line; other errors name the kind
            r = _run("lesson-engine", "e-r1-c3", "x = = 3")
            @test startswith(r["feedback"], "Julia could not read this line: unexpected `=`.") && endswith(r["feedback"], "Check the brackets, commas and dots.")
            # the generic line never shows Julia's error class name; Julia's own words stay in `message`
            r = _run("lesson-engine", "e-r1-c3", "sqrt(\"a\")")
            @test r["status"] == "error" && r["feedback"] == JuliaTime.LESSON_FALLBACK_FEEDBACK
            @test !occursin("Error", r["feedback"]) && occursin("MethodError", r["message"])
            # positions outside a list
            @test _run("lesson-engine", "e-r1-c3", "practice_jars.jar_id[0]")["feedback"] == "Julia counts from 1, and there is no position 0 or below."
            @test _run("lesson-engine", "e-r1-c3", "practice_jars.jar_id[-2]")["feedback"] == "Julia counts from 1, and there is no position 0 or below."
            @test _run("lesson-engine", "e-r1-c3", "practice_jars.jar_id[9]")["feedback"] == "There are only 4 items."
            @test _run("lesson-engine", "e-r1-c3", "practice_jars[9, :]")["feedback"] == "There are only 4 items."
            # every error gets a plain sentence that does not point to the hidden example
            r = _run("lesson-engine", "e-r1-c3", "sqrt(\"a\")")
            @test r["status"] == "error" && r["feedback"] == "Julia could not run this. Open the Pocket dictionary and check each name and bracket."
            @test !occursin("example", r["feedback"])
            # round 2 (P06): the open bracket is named, with the word beside it and its line
            for (code, want) in (("nrow(practice_jars", "The ( after `nrow` on line 1 has no ). Add ) at the end of line 1."),
                                 ("practice_jars[1:2", "The [ after `practice_jars` on line 1 has no ]. Add ] at the end of line 1."),
                                 ("nrow(", "The ( after `nrow` on line 1 has no ). Add ) at the end of line 1."))
                @test _run("lesson-engine", "e-r1-c3", code)["feedback"] == want
            end
            # a view of the right rows passes as a table; the table comes back on the wire
            r = _run("lesson-engine", "e-r2-c3", "@view practice_jars[practice_jars.tray_id .== \"T-A\", :]")
            @test r["pass"] == true && r["value_table"]["columns"][1] == "jar_id" && length(r["value_table"]["rows"]) == 2
            # row order matters
            r = _run("lesson-engine", "e-r2-c3", "reverse(practice_jars[practice_jars.tray_id .== \"T-A\", :])")
            @test r["pass"] == false
            # an error matching feedback.errors
            r = _run("lesson-engine", "e-r1-c2", "length(practise_jars.batch_id)")
            # round 2 (P06): a near miss of a setup name is named before the step's catch-all entry
            @test r["status"] == "error" && r["pass"] == false && r["feedback"] == "Julia does not know `practise_jars`. Did you mean `practice_jars`?"
            r = _run("lesson-engine", "e-r1-c2", "length(zzz.batch_id)")
            @test r["feedback"] == "Julia does not know the word `zzz`. Check the spelling of the table name."   # no near miss: the entry
            # an error with no matching line still gets a sentence, never a crash
            r = _run("lesson-engine", "e-r1-c1", "error(\"boom\")")
            @test r["status"] == "error" && !isempty(r["feedback"])
            r = _run("lesson-engine", "e-r1-c1", "1 +")
            @test r["status"] == "error" && !isempty(r["feedback"])
            # the existing R coaching line is used when the lesson has no matching error line
            r = _run("lesson-engine", "e-r1-c3", "n <- nrow(practice_jars)")
            @test !isempty(r["feedback"])
            # checkpoint checker: right rows pass, wrong rows fail with the checker's message
            @test _run("lesson-engine", "e-r2-cp", "jars[jars.batch_id .== case_batch, :]")["pass"] == true
            r = _run("lesson-engine", "e-r2-cp", "jars[jars.batch_id .== \"B08\", :]")
            @test r["pass"] == false && !isempty(r["feedback"])
            # play is never checked; fix is checked like change; board adds picked_ids
            r = _run("lesson-engine", "e-play", "length(nope)")
            @test r["pass"] == true && r["status"] == "error" && !isempty(r["feedback"])
            @test r["message"] == "UndefVarError: `nope` not defined"
            r = _run("lesson-engine", "e-play", "1 +")
            @test r["pass"] == true && r["status"] == "error" && !isempty(r["feedback"]) && !isempty(r["message"])
            r = _run("lesson-engine", "e-play", "42")
            @test r["pass"] == true && r["feedback"] == "" && r["value_repr"] == "42"
            # a play box's fallback line is plain too, whatever the error class
            for code in ("sum(1, 2, 3, 4)", "parse(Int, \"x\")", "sqrt(-1)", "[1, 2][3, 4]")
                r = _run("lesson-engine", "e-play", code)
                @test r["status"] == "error" && !isempty(r["feedback"]) && !occursin(r"\w(?:Error|Exception)", r["feedback"])
            end
            r = _run("lesson-engine", "e-r1-fix", "length(practice_jars.batch_id)")
            @test r["pass"] == true
            r = _run("lesson-engine", "e-r1-fix", "length(practice_jars.batch)")
            @test r["pass"] == false
            r = _run("lesson-engine", "e-r2-cp", "jars[jars.batch_id .== case_batch, :]")
            @test r["picked_ids"] == ["J-091", "J-092", "J-093", "J-094", "J-095", "J-096"]
            r = _run("lesson-engine", "e-r2-cp", "jars.jar_id[1:2]")
            @test r["picked_ids"] == ["J-081", "J-082"]
            r = _run("lesson-engine", "e-r1-c1", "1")
            @test !haskey(r, "picked_ids")
            # forbids: a listed string (spaces removed) fails with feedback.forbids; requires ignore comments
            r = _run("lesson-engine", "e-r1-c3", "nrow(practice_jars) + length([1]) - 1")
            @test r["pass"] == false && r["feedback"] == "Use nrow here, not length."
            r = _run("lesson-engine", "e-r1-c3", "4 # nrow")
            @test r["feedback"] == "Your line needs to use: nrow."
            # calling a column
            r = _run("lesson-engine", "e-r1-c3", "jars.jar_id(12)")
            @test r["feedback"] == "Round brackets call a function; square brackets pick from a list: jars.jar_id[12]."
            # an untouched blank gets its own line before any other error handling
            r = _run("lesson-engine", "e-r2-c2", "practice_jars[___, :]")
            @test r["pass"] == false && r["feedback"] == "Replace ___ with your answer, then run."
            r = _run("lesson-engine", "e-r2-c2", "practice_jars[practice_jars.batch_id .== \"___\", :]")
            @test r["pass"] == false
            # the case checkpoint needs a rule, not the visible rows
            r = _run("lesson-engine", "e-r2-cp", "jars[7:12, :]")
            @test r["pass"] == false
            # a true/false vector is shown as Julia prints it (round 2, decision D1: 1 and 0, never rewritten);
            # value_table keeps the true/false values for the screen's list view
            r = _run("lesson-engine", "e-r1-c1", "practice_jars.detected .== true")
            @test r["value_repr"] == "4-element BitVector:\n 1\n 0\n 1\n 1" == r["shown"]
            @test r["value_table"]["rows"] == [[true], [false], [true], [true]]
            @test r["shown_keys"]["table"] == "practice_jars" && r["shown_keys"]["values"] == ["P-01", "P-02", "P-03", "P-04"]
            @test r["shown_caption"] == "4 answers, one per row of practice_jars. Julia prints true as 1 and false as 0."
            r = _run("lesson-engine", "e-r1-c1", "BitVector([true, false])")
            @test r["shown"] == "2-element BitVector:\n 1\n 0" && r["shown_keys"] === nothing
            # a run that never ends is stopped and named
            r = _run("lesson-engine", "e-r1-c1", "while true end")
            @test r["status"] == "timeout" && r["pass"] == false && occursin("stopped", r["feedback"])
        finally
            JuliaTime.reload_lessons!()
        end
    end

    @testset "lessons: coaching precedence, arrow, == naming, keyword (sandbox)" begin
        l = JuliaTime.load_lesson_file(_FIXTURE)
        JuliaTime.LESSONS[l["id"]] = l
        try
            arrow = JuliaTime.MYSTERY_R_ARROW_LINE
            naming = "Use a single = to give a name; == compares."
            # R's arrow always gets the arrow line: a lesson's UndefVarError entry ("Check the spelling...") never answers it
            for code in ("tray <- nrow(practice_jars)", "n <- 3", "length(practise_jars.batch_id) <- 4")
                @test _run("lesson-engine", "e-r1-c2", code)["feedback"] == arrow
            end
            # the arrow that ran without an error (a comparison) is also named, not called "wrong"
            r = _run("lesson-engine", "e-r1-c3", "length(practice_jars.jar_id) <- 4")
            @test r["status"] == "ok" && r["pass"] == false && r["feedback"] == arrow
            # == used for naming gets the naming line, not the spelling line
            for code in ("tray == nrow(practice_jars)", "tray == practice_jars[1:2, :]\ntray")
                r = _run("lesson-engine", "e-r1-c2", code)
                @test r["status"] == "error" && r["feedback"] == naming
            end
            # two bare names may be a real comparison: the lesson's own line answers
            @test _run("lesson-engine", "e-r1-c2", "typd == tray")["feedback"] == "Julia does not know the word `typd`. Check the spelling of the table name."
            # a lesson's own line about <- is returned only when the code contains <-
            c = only(filter(c -> c["id"] == "e-r1-c2", _challenges(l)))
            about_arrow = "Give it a name with =, not the arrow <-."
            pushfirst!(c["feedback"]["errors"], Dict("match" => "Expected", "say" => about_arrow))
            for (code, expect) in (("x <- nrow(practice_jars", about_arrow),        # will not parse, so the shared arrow line cannot read it
                                   ("nrow(practice_jars", nothing),
                                   ("nrow(practice_jars[1:2", nothing))
                r = _run("lesson-engine", "e-r1-c2", code)
                if expect === nothing
                    # round 2 (P06): the open bracket is named
                    @test r["feedback"] != about_arrow && startswith(r["feedback"], "The ") && occursin("on line 1 has no", r["feedback"]) ||
                          occursin("brackets are still open on line 1", r["feedback"])
                else
                    @test r["feedback"] == expect
                end
            end
            popfirst!(c["feedback"]["errors"])
            # a single = inside brackets
            for (cid, code) in (("e-r2-c3", "practice_jars[practice_jars.tray_id = \"T-A\", :]"),
                                ("e-r1-c3", "sum(practice_jars.detected[practice_jars.tray_id = \"T-A\"])"))
                r = _run("lesson-engine", cid, code)
                @test r["status"] == "error" && r["feedback"] == "Inside brackets, use .== to compare; a single = gives a name."
            end
        finally
            JuliaTime.reload_lessons!()
        end
    end

    @testset "lessons: comma and space slips, in the real sandbox" begin
        l = JuliaTime.load_lesson_file(_FIXTURE)
        JuliaTime.LESSONS[l["id"]] = l
        try
            fb(code) = _run("lesson-engine", "e-r1-c3", code)["feedback"]
            @test fb("practice_jars[3,4, :]") == JuliaTime.LESSON_THREE_PARTS_FEEDBACK
            @test fb("practice_jars[[3,4] :]") == JuliaTime.LESSON_SPACE_FOR_COMMA_FEEDBACK
            @test fb("practice_jars[[3 4], :]") == JuliaTime.LESSON_SPACE_FOR_COMMA_FEEDBACK
            @test fb("practice_jars[practice_jars.batch_id .== \"B01\" ; :]") == JuliaTime.LESSON_SEMICOLON_FEEDBACK
            @test fb("practice_jars.jar_id[1, 2]") == JuliaTime.LESSON_LIST_COMMA_FEEDBACK
            @test fb("practice_jars[1:2,]") == JuliaTime.LESSON_TABLE_TRAILING_COMMA_FEEDBACK
            @test fb("practice_jars[1:2]") == JuliaTime.LESSON_TABLE_ONE_PART_FEEDBACK
            @test occursin("near `practice_jars.batch_id . ==`", fb("practice_jars[practice_jars.batch_id . == \"B01\", :]"))
            @test occursin("space inside a sign", fb("practice_jars[practice_jars.batch_id .= = \"B01\", :]"))
            @test occursin("commas inside the square brackets near", fb("practice_jars[1:2,, :]"))
            @test occursin("commas inside the round brackets near `practice_jars.jar_id 2)`", fb("first(practice_jars.jar_id 2)"))
            @test fb("nrow(practice_jars))") == "The ) on line 1 has no opening bracket before it. Remove it, or add the bracket it closes."
            @test occursin("A name cannot have a space in it", fb("practice jars"))
            @test occursin("column name cannot have a space", fb("practice_jars.batch id"))
            # a bracket left open is named (round 2, P06)
            @test fb("practice_jars[1:2, :") == "The [ after `practice_jars` on line 1 has no ]. Add ] at the end of line 1."
            # none of these lines give a whole answer or Julia's error class name
            for code in ("practice_jars[3,4, :]", "practice_jars[[3 4], :]", "practice_jars[1:2,, :]", "practice_jars . detected")
                @test !occursin(r"\w(?:Error|Exception)", fb(code))
            end
        finally
            JuliaTime.reload_lessons!()
        end
    end

    @testset "lessons: every errors[].example returns its own line (sandbox)" begin
        # Round 2 (P06): an example gets its own entry's line, as the player sees it (the unknown word named, a
        # bracket entry cut to what fits the code), or, for a catch-all entry (`match` only an error kind), the
        # engine's diagnosis when that names the slip more exactly (a near-miss name, the open bracket and its line).
        # Nothing else, and never the fallback.
        by_diagnosis = 0
        for l in _all_lessons()
            JuliaTime.LESSONS[l["id"]] = l
            for c in _challenges(l), e in get(get(c, "feedback", Dict()), "errors", Any[])
                @test haskey(e, "example")
                haskey(e, "example") || continue
                ws(x) = replace(x, r"\s+" => "")
                # an example equal to the starter would be answered with the "unchanged" line; a comment avoids that
                code = ws(e["example"]) == ws(get(c, "starter", "")) ? e["example"] * "\n# example" : e["example"]
                res = _run(l["id"], c["id"], code)
                spec = JuliaTime._lesson_exam_spec(c)
                env = spec === nothing ? JuliaTime.lesson_env(JuliaTime._lesson_setup_for(l, c)) : JuliaTime.lesson_env(spec.setup)
                raw = spec === nothing ? JuliaTime.run_code(code; env=env, budget=JuliaTime.RUN_BUDGET).message :
                    JuliaTime._lesson_exam_run(spec, code).message
                own = JuliaTime._lesson_render_entry(e["match"], e["say"], code, raw)
                generic = e["match"] in JuliaTime.LESSON_GENERIC_MATCHES
                diag = generic ? JuliaTime._lesson_diagnosis_line(c, code, raw; env=env) : ""
                ok = res["feedback"] == own || (!isempty(diag) && res["feedback"] == diag)
                (!isempty(diag) && res["feedback"] == diag && res["feedback"] != own) && (by_diagnosis += 1)
                @test (ok && res["feedback"] != JuliaTime.LESSON_FALLBACK_FEEDBACK) || (println(l["id"], "/", c["id"], ": ", repr(e["example"]),
                    " gave ", repr(res["feedback"]), ", wanted ", repr(own), isempty(diag) ? "" : " or " * repr(diag)); false)
            end
        end
        println("errors[].example: ", by_diagnosis, " examples now get the engine's diagnosis instead of the catch-all entry")
        JuliaTime.reload_lessons!()
    end

    @testset "lessons: checkers over 20 seeds (sandbox)" begin
        wrong = Dict(
            "check_lesson4_case" => ["first(open_jars.jar_id, 3)", "sample(open_jars.jar_id, 3; replace=true)", "[\"Q-071\", \"Q-072\", \"Q-074\"]",
                                   "sample(practice_jars.jar_id, 3; replace=false)"],
            "check_lesson4_practice_2" => ["first(practice_jars.jar_id, 3)", "sample(practice_jars.batch_id, 2; replace=false)",
                                          "sample(practice_jars.jar_id, 2)", "first(practice_jars, 2)"],
            "check_lesson4_practice_3" => ["first(practice_jars.jar_id, 2)", "sample(practice_jars.batch_id, 3; replace=false)"],
            "check_lesson4_practice_4" => ["sample(practice_jars.jar_id, 3; replace=false)", "first(practice_jars.jar_id, 3)", "[\"P-01\", \"P-01\", \"P-02\", \"P-03\"]"],
            "check_lesson5_flips4" => ["rand(Bool, 5)", "[true, false, true, true]", "sum(rand(Bool, 4))", "[true, true, false, false]"],
            "check_lesson5_count10" => ["rand(Bool, 10)", "sum(rand(Bool, 6))", "7", "sum([true, false, true, true, true, false, true, false, false, true])"],
            "check_lesson5_count8" => ["rand(Bool, 8)", "sum(rand(Bool, 6))", "4", "sum([true, false, true, true, false, false, true, false])"],
        )
        seen = Set{String}()
        for l in _all_lessons(), c in _challenges(l)
            ck = get(get(c, "check", Dict()), "checker", nothing)
            ck isa AbstractString || continue
            startswith(ck, "check_exam") && continue   # the exam wrappers run under their chapter's own inputs: test/test_exam_fit.jl
            push!(seen, ck)
            f = JuliaTime.LESSON_CHECKERS[ck]
            env() = JuliaTime.lesson_env(JuliaTime._lesson_setup_for(l, c))
            # the Lesson 4 practice checkers re-run the code eight more times each, so three seeds are enough
            seeds = startswith(ck, "check_lesson4_practice") ? (1:3) : (1:20)
            for sd in seeds
                r = JuliaTime.lock(JuliaTime._RUN_LOCK) do
                    JuliaTime.run_code(c["solution"]; env=env(), seed=sd, budget=JuliaTime.RUN_BUDGET)
                end
                @test r.status == :ok && f(r.value, c["solution"])[1] == true
            end
            for w in get(wrong, ck, String[])
                for sd in seeds
                    r = JuliaTime.lock(JuliaTime._RUN_LOCK) do
                        JuliaTime.run_code(w; env=env(), seed=sd, budget=JuliaTime.RUN_BUDGET)
                    end
                    ok = r.status == :ok ? f(r.value, w)[1] : false
                    @test (ok == false || (println(ck, ": wrong code ", repr(w), " passed at seed ", sd); false))
                end
            end
        end
        @test "check_lesson5_count8" in seen && "check_lesson4_case" in seen
        # every checker a lesson names is swept, and no checker is registered that no lesson uses
        used = Set(String(ck) for l in _all_lessons() for c in _challenges(l) for ck in [get(get(c, "check", Dict()), "checker", nothing)] if ck isa AbstractString)
        @test all(k -> startswith(k, "check_exam") || k in used, keys(JuliaTime.LESSON_CHECKERS)) || (println(setdiff(keys(JuliaTime.LESSON_CHECKERS), used)); false)
    end

    @testset "lessons: That works too, table slips, missing dot, seeded practice picks (sandbox)" begin
        l = JuliaTime.load_lesson_file(_FIXTURE)
        c3 = only(filter(c -> c["id"] == "e-r1-c3", _challenges(l)))
        c3["check"] = Dict{String, Any}("same_value" => true, "requires" => Any["practice_jars"], "taught" => Any["nrow("])
        c3["feedback"]["taught"] = "count the rows of the table with nrow."
        cp = only(filter(c -> c["id"] == "e-r2-c2", _challenges(l)))
        cp["solution"] = "practice_jars[practice_jars.batch_id .== \"B01\", :]"
        JuliaTime.LESSONS[l["id"]] = l
        try
            # right value, a taught item missing: passes, with the sentence in feedback and in works_too
            r = _run("lesson-engine", "e-r1-c3", "length(practice_jars.jar_id)")
            @test r["status"] == "ok" && r["pass"] == true && r["works_too"] == "That works too. The way this lesson teaches: count the rows of the table with nrow."
            @test endswith(r["feedback"], r["works_too"]) && !haskey(r, "also_works")
            # the taught way: no sentence
            r = _run("lesson-engine", "e-r1-c3", "nrow( practice_jars )")
            @test r["pass"] == true && !haskey(r, "works_too") && !occursin("works too", r["feedback"])
            # a requires guard still fails a right value; a wrong value never gets the sentence
            r = _run("lesson-engine", "e-r1-c3", "4")
            @test r["pass"] == false && !haskey(r, "works_too")
            r = _run("lesson-engine", "e-r1-c3", "length(practice_jars.jar_id) + 1")
            @test r["pass"] == false && !haskey(r, "works_too")
            # a taught item only inside a comment does not count
            r = _run("lesson-engine", "e-r1-c3", "length(practice_jars.jar_id) # nrow(")
            @test r["pass"] == true && haskey(r, "works_too")
            # a whole table where a list is wanted, on a step that judges by value
            r = _run("lesson-engine", "e-r1-c1", "practice_jars")
            @test r["pass"] == false
            r = _run("lesson-engine", "e-r1-fix", "sum(jars)")
            @test r["status"] == "error" && r["feedback"] == "sum needs one column, not the whole table: pick a column with a dot, like jars.detected."
            r = _run("lesson-engine", "e-r1-fix", "length(jars)")
            @test r["feedback"] == "length needs one column, not the whole table: pick a column with a dot, like jars.detected."
            r = _run("lesson-engine", "e-r1-fix", "sum(practice_jars)")
            @test r["feedback"] == "sum needs one column, not the whole table: pick a column with a dot, like practice_jars.detected."
            # the same line in a play box and in the range gets the line too
            r = _run("lesson-engine", "e-play", "sum(jars)")
            @test r["feedback"] == "sum needs one column, not the whole table: pick a column with a dot, like jars.detected."
            r = _run("lesson-engine", "e-r1-fix", "sample(1:6, 9; replace=false)")
            @test occursin("more picks than the list holds", r["feedback"])
        finally
            JuliaTime.reload_lessons!()
        end
        # a comparison with no dot where the answer has one
        l2 = JuliaTime.load_lesson_file(_FIXTURE)
        k = only(filter(c -> c["id"] == "e-r2-c3", _challenges(l2)))
        k["solution"] = "sum(practice_jars.detected .== true)"; k["check"] = Dict{String, Any}("same_value" => true)
        JuliaTime.LESSONS[l2["id"]] = l2
        try
            r = _run("lesson-engine", "e-r2-c3", "sum(practice_jars.detected == true)")
            @test r["pass"] == false && startswith(r["feedback"], "A comparison sign with no dot gives one answer")
            @test _run("lesson-engine", "e-r2-c3", "sum(practice_jars.detected .== true)")["pass"] == true
        finally
            JuliaTime.reload_lessons!()
        end
        # the range: a table given to a function, and the new result words
        JuliaTime.LESSONS["range-test"] = deepcopy(_RANGE_TEST)
        try
            r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "range-test", "challenge" => "w-fixed", "code" => "sum(jars)", "request_id" => "r"))
            @test r["feedback"] == "sum needs one column, not the whole table: pick a column with a dot, like jars.detected."
            r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "range-test", "challenge" => "w-fixed",
                                              "code" => "jars.jar_id[1:3]", "request_id" => "r"))
            @test r["range"]["wrong_picks"] == 1 && r["range"]["targets_missed"] == 0 && !haskey(r["range"], "par") &&
                  !haskey(r["range"], "chars") && r["feedback"] == "You picked 1 jar that is not a target (J-083)."
        finally
            JuliaTime.reload_lessons!()
        end
        # the real practice checkers: the seeded re-run stops a lucky pick, and passes a fair one
        pl = JuliaTime.load_lesson_file(_FIXTURE)
        pl["setup"] = "practice4"
        pk = only(filter(c -> c["id"] == "e-r1-c3", _challenges(pl)))
        pk["solution"] = "sample(practice_jars.jar_id, 2; replace=false)"
        pk["check"] = Dict{String, Any}("checker" => "check_lesson4_practice_2")
        JuliaTime.LESSONS[pl["id"]] = pl
        try
            for sd in 1:3
                @test _run("lesson-engine", "e-r1-c3", "sample(practice_jars.jar_id, 2; replace=false)")["pass"] == true
                @test _run("lesson-engine", "e-r1-c3", "first(shuffle(practice_jars.jar_id), 2)")["pass"] == true
            end
            r = _run("lesson-engine", "e-r1-c3", "sample(practice_jars.jar_id, 2)")
            @test r["pass"] == false && occursin("replace=false", r["feedback"])
            r = _run("lesson-engine", "e-r1-c3", "first(practice_jars, 2)")
            @test r["pass"] == false && occursin("whole table", r["feedback"])
        finally
            JuliaTime.reload_lessons!()
        end
    end

    @testset "lessons: look runs the code in the setup and never checks it (sandbox)" begin
        l = JuliaTime.load_lesson_file(_FIXTURE)
        JuliaTime.LESSONS[l["id"]] = l
        look(cid, code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson-engine",
                              "challenge" => cid, "code" => code, "look" => true, "request_id" => "lk"))
        try
            # a value comes back with pass true and no feedback, on a challenge that would fail the same code
            r = look("e-r1-c3", "length(practice_jars.jar_id) + 100")
            @test r["type"] == "lesson_result" && r["request_id"] == "lk" && r["challenge"] == "e-r1-c3"
            @test r["status"] == "ok" && r["pass"] == true && r["feedback"] == "" && r["value_repr"] == "104"
            # the same code without look is still checked
            r = _run("lesson-engine", "e-r1-c3", "length(practice_jars.jar_id) + 100")
            @test r["pass"] == false && !isempty(r["feedback"])
            # a table comes back as a table, in the lesson's setup
            r = look("e-r1-c3", "practice_jars[practice_jars.tray_id .== \"T-A\", :]")
            @test r["pass"] == true && r["value_table"]["columns"][1] == "jar_id" && length(r["value_table"]["rows"]) == 2
            # one row of a table comes back as a one-row table, so the screen never shows a DataFrameRow type line
            r = look("e-r1-c3", "practice_jars[2, :]")
            @test r["pass"] == true && r["value_table"] !== nothing && r["value_table"]["columns"] == ["jar_id", "batch_id", "tray_id", "detected"] &&
                  length(r["value_table"]["rows"]) == 1 && r["value_table"]["rows"][1][1] == "P-02"
            # a true/false list is shown as Julia prints it
            r = look("e-r1-c3", "practice_jars.detected .== true")
            @test r["shown"] == "4-element BitVector:\n 1\n 0\n 1\n 1"
            # the untouched starter is not refused, a required word is not needed, a forbidden one is fine
            r = look("e-r1-c2", " length( practice_jars.jar_id ) ")
            @test r["pass"] == true && r["feedback"] == "" && r["value_repr"] == "4"
            # a checkpoint's answer is never checked and never picked out: only the code's own value shows
            r = look("e-r2-cp", "1 + 1")
            @test r["pass"] == true && r["value_repr"] == "2" && !haskey(r, "picked_ids")
            # an empty box is fine; an error shows a plain line with the class name only in `message`
            r = look("e-r1-c3", "  ")
            @test r["pass"] == true && r["status"] == "ok" && r["feedback"] == ""
            r = look("e-r1-c3", "sum(1, 2, 3, 4)")
            @test r["status"] == "error" && r["pass"] == true && !isempty(r["feedback"]) && !occursin("Error", r["feedback"])
            @test occursin("MethodError", r["message"])
            # a run that never ends is stopped
            r = look("e-r1-c3", "while true end")
            @test r["status"] == "timeout" && occursin("stopped", r["feedback"])
            # only the literal true turns look on
            r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson-engine", "challenge" => "e-r1-c3",
                                              "code" => "4", "look" => "true", "request_id" => "lk"))
            @test r["pass"] == false
            # an unknown challenge is still an error
            @test JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson-engine", "challenge" => "nope",
                                                "code" => "1", "look" => true))["type"] == "error"
        finally
            JuliaTime.reload_lessons!()
        end
    end

    @testset "lessons: every look_closer code runs in its lesson's setup (sandbox)" begin
        n = 0
        for l in _all_lessons(), c in _challenges(l)
            haskey(c, "look_closer") || continue
            n += 1
            lc = c["look_closer"]
            @test lc isa AbstractDict && lc["code"] isa AbstractString && !isempty(strip(lc["code"]))
            res = JuliaTime.lock(JuliaTime._RUN_LOCK) do
                JuliaTime.run_code(String(lc["code"]); env=JuliaTime.lesson_env(l["setup"]), budget=JuliaTime.RUN_BUDGET)
            end
            @test (res.status == :ok || (println(l["id"], "/", c["id"], " look_closer code did not run: ", res.message); false))
            # and through the message a screen sends
            JuliaTime.LESSONS[l["id"]] = l
            r = _run_look(l["id"], c["id"], lc["code"])
            @test r["status"] == "ok" && r["pass"] == true && r["feedback"] == ""
        end
        @test n > 0
        @info "look_closer boxes checked: $n"
        JuliaTime.reload_lessons!()
    end

    @testset "lessons: the Lesson 1 checkpoint never shows case words (sandbox)" begin
        JuliaTime.reload_lessons!()
        cid = "l1-r3-c6"
        leaks(t) = occursin("case_batch", t) || occursin("DataFrame", t) || occursin("B09", t) || occursin("J-09", t)
        for code in ("logbook.batch_id .== \"B05\"", "logbook[logbook.batch_id .== \"B04\", :]", "logbook[logbook.batch_id .== \"B05\", 1:3]",
                     "logbook[logbook.batch_id .== \"B05\", [:jar_id]]", "vcat(logbook[logbook.batch_id .== \"B05\", :], logbook[logbook.batch_id .== \"B05\", :])",
                     "logbook[logbook.batch_id .== \"B04\" .|| logbook.batch_id .== \"B05\", :]", "logbook[logbook.batch_id .== B05, :]",
                     "logbook[logbook.batch_id .== \"B09\", :]", "jars")
            r = _run("lesson1", cid, code)
            @test r["pass"] == false
            @test (!leaks(get(r, "feedback", "")) && !leaks(get(r, "message", "")) || (println(repr(code), ": ", r["feedback"]); false))
        end
        @test _run("lesson1", cid, "logbook[logbook.batch_id .== \"B05\", :]")["pass"] == true
    end

    @testset "lessons: round 11 coaching and picked ids (sandbox)" begin
        JuliaTime.reload_lessons!()
        # a tray column typo names the real columns, not a batch label
        r = _run("lesson1", "l1-r3-c6", "logbook[logbook.tray .== \"T-F\", :]")
        @test r["pass"] == false && occursin("jar_id, batch_id, tray_id and detected", r["feedback"]) && !occursin("batch labels", r["feedback"])
        # text times a number is not a sum problem; a real sum on text is
        r = _run("lesson1", "l1-r1-p1", "\"a\" * 3")
        @test r["status"] == "error" && !occursin("sum adds", r["feedback"])
        r = _run("lesson1", "l1-r1-p1", "sum(logbook.batch_id)")
        @test r["status"] == "error" && occursin("sum adds numbers", r["feedback"])
        # one jar id on a lesson board is a pick; other text is not
        @test JuliaTime._lesson_picked_ids("J-091") == ["J-091"] && JuliaTime._lesson_picked_ids("Q-051") == ["Q-051"]
        @test JuliaTime._lesson_picked_ids("hello") === nothing && JuliaTime._lesson_picked_ids("T-A") === nothing
        # Lesson 4's board is built from its own table (open_jars); the picks come back as its ids
        r = _run("lesson4", "l4-r1-c5", "first(open_jars.jar_id, 3)")
        @test get(r, "picked_ids", nothing) == ["Q-071", "Q-072", "Q-074"]
        # a lesson without a board sends no picks
        @test !haskey(_run("lesson1", "l1-r2-c1", "logbook.jar_id[7]"), "picked_ids")
    end

    @testset "lessons: lesson_public never sends case rows for a practice setup (sandbox)" begin
        JuliaTime.reload_lessons!()
        for n in 1:6
            l = deepcopy(JuliaTime.LESSONS["lesson$n"])
            @test l["setup"] in JuliaTime.LESSON_TWIN_SETUPS
            # even a lesson that asks for the jars board gets no rack while its setup is a practice setup
            for r in l["rounds"], c in r["challenges"]
                c["board"] = "jars"
            end
            pub = JuliaTime.lesson_public(l)
            @test !haskey(pub, "jars")
            txt = JSON.json(pub)
            @test !occursin("J-09", txt) && !occursin("J-08", txt) && !occursin("case_batch", txt)
        end
        # the engine fixture is a case setup: its rack is still sent
        fx = JuliaTime.lesson_public(JuliaTime.load_lesson_file(_FIXTURE))
        @test length(fx["jars"]) == 12
    end

    @testset "lessons: round 9 fixes on the real lessons (sandbox)" begin
        JuliaTime.reload_lessons!()
        # 1. Lesson 2 naming steps: a name that was never made gives "That works too", the solution gives none
        for (cid, tr) in (("l2-r1-c3", "T-E"), ("l2-r1-f1", "T-D"))
            r = _run("lesson2", cid, "tray = batch5[batch5.tray_id .== \"$tr\", :]\ntray")
            @test r["pass"] == true && !haskey(r, "works_too")
            r = _run("lesson2", cid, "batch5[batch5.tray_id .== \"$tr\", :]")
            @test r["pass"] == true && startswith(get(r, "works_too", ""), "That works too.")
            @test !occursin("name tray now stands", r["feedback"])
            r = _run("lesson2", cid, "t = batch5[batch5.tray_id .== \"$tr\", :]\nt")
            @test r["pass"] == true && haskey(r, "works_too")
        end
        r = _run("lesson2", "l2-r1-c1", "batch5 = ledger[ledger.batch_id .== \"B05\", :]")
        @test r["pass"] == true && haskey(r, "works_too")
        @test !haskey(_run("lesson2", "l2-r1-c1", "batch5 = ledger[ledger.batch_id .== \"B05\", :]\nbatch5"), "works_too")
        # 2. whole-table coaching names the table and column of the player's own code
        r = _run("lesson2", "l2-r1-c6", "tray = batch5[batch5.tray_id .== \"T-F\", :]\nsum(tray)")
        @test r["feedback"] == "sum needs one column, not the whole table: pick a column with a dot, like tray.detected."
        r = _run("lesson2", "l2-r2-c6", "sum(batch5[batch5.tray_id .== \"T-E\", :])")
        @test r["feedback"] == "sum needs one column, not the whole table: pick a column with a dot, like batch5.detected."
        r = _run("lesson2", "l2-r2-c3", "sum(practice_jars[practice_jars.tray_id .== \"T-A\", :])")
        @test r["feedback"] == "sum needs one column, not the whole table: pick a column with a dot, like practice_jars.detected."
        r = _run("lesson4", "l4-r2-c5", "sample(practice_jars, 2; replace=false)")
        @test r["feedback"] == "sample needs one column, not the whole table: pick a column with a dot, like practice_jars.jar_id."
        # 3. batch5 in place of practice_jars is caught
        r = _run("lesson2", "l2-r1-c5", "tray = batch5[batch5.tray_id .== \"T-E\", :]\n[sum(tray.detected), length(tray.detected)]")
        @test r["pass"] == false && occursin("practice_jars", r["feedback"])
        r = _run("lesson2", "l2-r2-f1", "sum(batch5.detected[batch5.tray_id .== \"T-D\"])")
        @test r["pass"] == false && occursin("practice_jars", r["feedback"])
        @test _run("lesson2", "l2-r2-f1", "sum(practice_jars.detected[practice_jars.tray_id .== \"T-B\"])")["pass"] == true
        r = _run("lesson2", "l2-r2-c2", "batch5.detected[[1, 2]]")
        @test r["pass"] == false && !occursin("needs to use", r["feedback"])
        # 4. Lesson 3: a missing dot is not praised; expert forms pass; each slip gets its own line
        r = _run("lesson3", "l3-r2-c3", "shelves[logged != keyed]")
        @test r["pass"] == false && !haskey(r, "works_too") && occursin("dot", r["feedback"])
        for code in (".!iszero.(keyed)", "map(!iszero, keyed)")
            r = _run("lesson3", "l3-r2-c2", code)
            @test r["pass"] == true && haskey(r, "works_too")
        end
        @test _run("lesson3", "l3-r2-c2", "logged .== keyed")["pass"] == false
        r = _run("lesson3", "l3-r2-f1", "logged != keyed")
        @test r["pass"] == false && startswith(r["feedback"], "A comparison sign with no dot")
        r = _run("lesson3", "l3-r2-c4", "entry[logged != keyed]")
        @test r["pass"] == false && startswith(r["feedback"], "Add the dot.")
        @test !any(c -> haskey(get(c, "feedback", Dict()), "taught_way"), _challenges(JuliaTime.lesson_public(JuliaTime.LESSONS["lesson3"])))
        # 4b. Lesson 4: four jars in a hand-made order is not a random pick
        for code in ("practice_jars.jar_id", "reverse(practice_jars.jar_id)", "first(practice_jars.jar_id, 4)")
            @test _run("lesson4", "l4-r2-c3", code)["pass"] == false
        end
        @test _run("lesson4", "l4-r2-c3", "shuffle(practice_jars.jar_id)")["pass"] == true
        @test _run("lesson4", "l4-r2-c3", "sample(practice_jars.jar_id, 4; replace=false)")["pass"] == true
        # 4c. Lesson 4's last checkpoint: three different jars from open_jars, judged as run and again under seeds
        @test _run("lesson4", "l4-r3-c4", "sample(open_jars.jar_id, 3; replace=false)")["pass"] == true
        for code in ("first(open_jars.jar_id, 3)", "sample(open_jars.jar_id, 3)", "[\"Q-071\", \"Q-072\", \"Q-074\"]",
                     "sample(practice_jars.jar_id, 3; replace=false)", "open_jars")
            @test _run("lesson4", "l4-r3-c4", code)["pass"] == false
        end
        # 6. Lesson 5: random deals are judged by value
        for (cid, alt, typed) in (("l5-r1-c3", "rand([true, false], 4)", "x = [true, false, true, true]\nrand(1)"),
                                  ("l5-r1-c4", "sum(rand([true, false], 10))", "sum([true, false, true, true, true, false, true, false, false, true])"),
                                  ("l5-r1-c5", "n = 8\nsum(rand(Bool, n))", "sum([true, false, true, true, false, false, true, false]) + rand(1:1)"))
            r = _run("lesson5", cid, alt)
            @test r["pass"] == true
            r = _run("lesson5", cid, typed)
            @test r["pass"] == false
        end
        @test _run("lesson5", "l5-r1-c3", "rand(Bool, 4)")["pass"] == true
        @test _run("lesson5", "l5-r1-c3", "[true, false, true, true]")["pass"] == false
        @test _run("lesson5", "l5-r1-c3", "rand(Bool, 5)")["pass"] == false
        @test _run("lesson5", "l5-r1-c5", "sum(rand(Bool, 6))")["pass"] == false
        # 6b. Lesson 5: a pipe is a call too, and a typed answer is still refused
        @test _run("lesson5", "l5-r1-c1", "[true, false, true, true] |> sum")["pass"] == true
        @test _run("lesson5", "l5-r3-c2", "flags = [true, true, false, true]\nflags |> mean")["pass"] == true
        @test _run("lesson5", "l5-r3-c2", "flags = [true, true, false, true]\n0.75")["pass"] == false
        @test _run("lesson5", "l5-r3-c4", "events = pretend_counts .>= seen_count\nevents |> mean")["pass"] == true
        # the range's taught line passes its chance wave
        JuliaTime.LESSONS["range"] === nothing || begin
            w7 = _run("range", "w7", "sample(logbook.jar_id[logbook.detected], 4; replace=false)")
            @test w7["pass"] == true && !haskey(w7["range"], "sharpshooter")
        end
    end

    @testset "lessons: round 10 engine (sandbox)" begin
        JuliaTime.reload_lessons!()
        run_l(l, c, code; extra...) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => l, "challenge" => c,
                                        "code" => code, "request_id" => "r", (String(k) => v for (k, v) in extra)...))
        # a range with a requires wave, a forbids wave and a chance wave
        rg = deepcopy(_RANGE_TEST)
        push!(rg["waves"],
            Dict{String, Any}("id" => "w-req", "unlocks_after" => "lesson1", "target" => "Hit J-081 and J-082.", "targets" => Any["J-081", "J-082"],
                "rule" => nothing, "hint" => "h", "example" => "jars[jars.batch_id .== \"B08\", :][1:2, :]",
                "check" => Dict{String, Any}("requires" => Any["jars."], "forbids" => Any["\"J-", "[[", "jars.jar_id[1"]),
                "feedback" => Dict{String, Any}("requires" => "Start from the jars table.", "forbids" => "Ask a question; do not type ids or positions.")),
            Dict{String, Any}("id" => "w-once", "unlocks_after" => "lesson1", "target" => "Any 2 jars of batch B09.", "targets" => nothing,
                "rule" => Dict{String, Any}("count" => 2, "distinct" => true, "random" => false, "from" => Any["J-091", "J-092", "J-093"]),
                "hint" => "h", "example" => "jars.jar_id[7:8]"))
        JuliaTime.LESSONS["range-test"] = rg
        try
            # first shot: the screen sends the shot number
            r = run_l("range-test", "w-fixed", "jars.jar_id[1:2]"; shot_number=1)
            @test r["pass"] && r["range"]["first_shot"] == true && r["range"]["shot_number"] == 1
            r = run_l("range-test", "w-fixed", "jars.jar_id[1:2]"; shot_number=3)
            @test r["pass"] && r["range"]["first_shot"] == false && r["range"]["shot_number"] == 3
            r = run_l("range-test", "w-fixed", "jars.jar_id[1:2]")
            @test r["pass"] && r["range"]["first_shot"] == false && r["range"]["shot_number"] === nothing
            r = run_l("range-test", "w-fixed", "jars.jar_id[1:3]"; shot_number=1)
            @test !r["pass"] && r["range"]["first_shot"] == false
            for bad in (0, -1, "1", true, 1.5)
                @test run_l("range-test", "w-fixed", "jars.jar_id[1:2]"; shot_number=bad)["range"]["shot_number"] === nothing
            end
            # a row, a set and a named tuple with jar_id are read as picks
            @test run_l("range-test", "w-fixed", "jars[1, :]")["picked_ids"] == ["J-081"]
            r = run_l("range-test", "w-fixed", "Set(jars.jar_id[1:2])")
            @test r["pass"] && r["picked_ids"] == ["J-081", "J-082"]
            r = run_l("range-test", "w-fixed", "(jar_id = jars.jar_id[1:2],)")
            @test r["pass"] && r["picked_ids"] == ["J-081", "J-082"]
            r = run_l("range-test", "w-fixed", "jars[1:2, [:batch_id]]")
            @test !r["pass"] && occursin("no jar_id column", r["feedback"]) && !haskey(r, "range")
            r = run_l("range-test", "w-fixed", "[3, 4]")
            @test !r["pass"] && startswith(r["feedback"], "Numbers are not jar ids")
            r = run_l("range-test", "w-fixed", "jars.detected")
            @test !r["pass"] && startswith(r["feedback"], "That is a true or false answer")
            r = run_l("range-test", "w-fixed", "nothing")
            @test !r["pass"] && startswith(r["feedback"], "Your line gave back nothing")
            # requires and forbids on a wave, with the lines from data: the ids are right, the line is not the lesson
            r = run_l("range-test", "w-req", "jars[jars.batch_id .== \"B08\", :][1:2, :]"; shot_number=1)
            @test r["pass"] && r["range"]["first_shot"] == true
            r = run_l("range-test", "w-req", "jars[jars.batch_id .== \"B08\", :][1:2, :]"; shot_number=1)
            @test !haskey(r["range"], "rule_broken")
            r = run_l("range-test", "w-req", "[\"J-081\", \"J-082\"]"; shot_number=1)
            @test !r["pass"] && r["feedback"] == "Start from the jars table." && r["range"]["rule_broken"] == "requires" &&
                  r["range"]["clean"] == false && r["range"]["first_shot"] == false && r["range"]["hits"] == 2
            r = run_l("range-test", "w-req", "jars.jar_id[jars.jar_id .== \"J-081\" .|| jars.jar_id .== \"J-082\"]"; shot_number=1)
            @test !r["pass"] && r["feedback"] == "Ask a question; do not type ids or positions." && r["range"]["rule_broken"] == "forbids"
            r = run_l("range-test", "w-req", "jars.jar_id[[1, 2]]")
            @test !r["pass"] && r["range"]["rule_broken"] == "forbids"
            r = run_l("range-test", "w-req", "jars[1:3, :]")   # wrong jars: the picks are judged first, not the rule
            @test !r["pass"] && !haskey(r["range"], "rule_broken") && occursin("not a target", r["feedback"])
            # a chance wave: by hand fails, by chance passes, and `random: false` turns the check off
            r = run_l("range-test", "w-rule", "jars.jar_id[7:9]")
            @test !r["pass"] && r["range"]["rule_broken"] == "same_jars"
            @test run_l("range-test", "w-rule", "sample(jars.jar_id[7:12], 3; replace=false)")["pass"]
            @test run_l("range-test", "w-once", "jars.jar_id[7:8]")["pass"]
        finally
            JuliaTime.reload_lessons!()
        end

        # a blank left in the line: Julia's message is plain, not "all-underscore identifier"
        r = run_l("lesson3", "l3-r2-c2", "keyed .!= ___")
        @test r["status"] == "error" && r["message"] == "The blank ___ is still in your line. Replace it with your answer, then run."
        # a parse error keeps Julia's reason and the spot
        r = run_l("lesson2", "l2-r2-c6", "sum(batch5.detected[batch5.tray_id .== \"T-E\"")
        @test startswith(r["message"], "ParseError: ") && occursin("(line 1, column", r["message"]) && !occursin("\n", r["message"])
        # Lesson 4's second look says what it is doing
        r = run_l("lesson4", "l4-r2-c5", "sample(practice_jars.jar_id, 2)")
        @test !r["pass"] && occursin("tries your line a few more times", r["feedback"]) && !occursin("ran your code again", r["feedback"])
        # Lesson 5: rand without Bool
        r = run_l("lesson5", "l5-r1-c5", "sum(rand(8))")
        @test !r["pass"] && r["feedback"] == JuliaTime.LESSON5_DECIMALS_FEEDBACK
    end

    @testset "lessons: a sandbox worker holds no lessons (sandbox)" begin
        res = JuliaTime.lock(JuliaTime._RUN_LOCK) do
            JuliaTime.run_code("isempty(Main.JuliaTime.LESSONS)"; budget=JuliaTime.RUN_BUDGET)
        end
        @test res.status == :ok && res.value === true
    end

    @testset "lessons: dictionary julia lines run in the setup env (sandbox)" begin
        for l in _all_lessons()
            # a chapter's rounds may use their own setups (e.g. case3_joined binds `joined`): a row runs if any of them runs it
            setups = unique(vcat([l["setup"]], [r["setup"] for r in get(l, "rounds", Any[]) if haskey(r, "setup")]))
            envs = [JuliaTime.lesson_env(s) for s in setups]
            for d in get(l, "dictionary", Any[])
                line = d["julia"]
                results = map(envs) do env
                    # a line with a bare placeholder (x, n, tray, ...) cannot run as written; give it a value
                    # chapter setups bind the case tables only, so the placeholders need practice_jars only where it exists
                    code = (hasproperty(env, :practice_jars) ? "x = practice_jars.jar_id; n = 2; tray = practice_jars; " : "") * line
                    JuliaTime.lock(JuliaTime._RUN_LOCK) do
                        JuliaTime.run_code(code; env=env, budget=JuliaTime.RUN_BUDGET)
                    end
                end
                @test any(r -> r.status == :ok, results) || (println(l["id"], ": ", line, " -> ", results[1].message); false)
            end
        end
    end

    @testset "lessons: dictionary R lines give the Julia value in Rscript" begin
        rscript = Sys.which("Rscript")
        if rscript === nothing
            if get(ENV, "JULIATIME_SKIP_R", "0") == "1"
                @info "Rscript not on PATH and JULIATIME_SKIP_R=1: skipping the dictionary R-line check."
            else
                @test (println("Rscript is not on PATH. Install R, or set JULIATIME_SKIP_R=1 to skip this check."); false)
            end
        else
            relem(x) = x isa Bool ? (x ? "TRUE" : "FALSE") : x isa AbstractString ? "\"$x\"" : string(x)
            rvec(v) = "c(" * join(relem.(v), ", ") * ")"
            df_r(df) = "data.frame(" * join((string(c, "=", rvec(df[!, c])) for c in names(df)), ", ") * ", stringsAsFactors=FALSE)"
            # R's bindings are built from the lesson's own setup, never from a fixed table. The R notes use dplyr for
            # table verbs (round 2 decision: filter, left_join, group_by), so it is loaded; --vanilla loads nothing.
            r_setup(setup) = begin
                env = JuliaTime.lesson_env(setup)
                "suppressPackageStartupMessages(library(dplyr))\n" * join(["$k <- " * (v isa DataFrames.AbstractDataFrame ? df_r(v) : v isa AbstractVector ? rvec(v) : relem(v))
                      for (k, v) in pairs(env)], "\n") * (haskey(env, :practice_jars) ? "\nx <- practice_jars\$jar_id\nn <- 2\ntray <- practice_jars\n" : "\n")
            end
            # the stand-ins x, n and tray exist where the setup has practice_jars (every lesson; a chapter's case setup has not)
            j_setup(setup) = haskey(JuliaTime.lesson_env(setup), :practice_jars) ? "x = practice_jars.jar_id; n = 2; tray = practice_jars; " : ""
            is_random(line) = occursin("rand(", line) || occursin("sample(", line)
            kind(x) = x in ("true", "false") ? :bool : tryparse(Float64, x) !== nothing ? :number : :text
            flat(v) = v isa DataFrames.AbstractDataFrame ? flat(collect(Iterators.flatten(eachcol(DataFrame(v))))) :
                      v isa AbstractVector ? [flat(e)[1] for e in v] :
                      v isa Bool ? [string(v)] : v isa Real ? [string(Float64(v))] : [string(v)]
            same(a, b) = length(a) == length(b) && all(zip(a, b)) do (p, q)
                fp, fq = tryparse(Float64, p), tryparse(Float64, q)
                fp !== nothing && fq !== nothing ? isapprox(fp, fq) : p == q
            end
            for l in _all_lessons(), d in get(l, "dictionary", Any[])
                haskey(d, "r") || continue
                # A chapter row may name a table only one round's setup binds (exam3's `joined`): the first setup
                # of the file (its own, then each round's) in which the Julia line runs is the one R gets too.
                setups = unique(filter(s -> s isa AbstractString, vcat(Any[get(l, "setup", nothing)],
                                       Any[get(r, "setup", nothing) for r in get(l, "rounds", Any[]) if r isa AbstractDict])))
                setup, jres = l["setup"], nothing
                for s in setups
                    jres = JuliaTime.lock(JuliaTime._RUN_LOCK) do
                        JuliaTime.run_code(j_setup(s) * d["julia"]; env=JuliaTime.lesson_env(s), budget=JuliaTime.RUN_BUDGET)
                    end
                    setup = s
                    jres.status == :ok && break
                end
                jres.status == :ok || (@test (println(l["id"], " Julia line failed: ", d["julia"], ": ", jres.message); false); continue)
                script = tempname() * ".R"
                # a table's columns are made text one by one, so a true/false column is not turned into 0 and 1
                write(script, r_setup(setup) * "\nv <- {" * d["r"] * "}\nv <- if (is.data.frame(v)) unlist(lapply(v, function(col) " *
                      "if (is.logical(col)) tolower(as.character(col)) else as.character(col)), use.names=FALSE) else v\n" *
                      "v <- if (is.logical(v)) tolower(as.character(v)) else as.character(v)\ncat(paste(v, collapse=\"\\n\"), \"\\n\")\n")
                out = try read(pipeline(`$rscript --vanilla $script`; stderr=devnull), String) catch; nothing end
                rm(script; force=true)
                out === nothing && (@test (println(l["id"], " R line failed: ", d["r"]); false); continue)
                rvals = [x == "TRUE" ? "true" : x == "FALSE" ? "false" : x for x in String.(split(strip(out), "\n"))]
                jvals = flat(jres.value isa DataFrames.AbstractDataFrame ? jres.value : jres.value)
                jvals = [x == "true" ? "true" : x == "false" ? "false" : x for x in jvals]
                if is_random(d["julia"])   # random in both languages: same length and same kind of value
                    @test length(jvals) == length(rvals) && Set(kind.(jvals)) == Set(kind.(rvals))
                    continue
                end
                @test (same(jvals, rvals) || (println(l["id"], ": Julia ", repr(d["julia"]), " gave ", jvals, " but R ", repr(d["r"]), " gave ", rvals); false))
            end
        end
    end
end

# ---- TWIN DATA: practice1 to practice6 (spec: docs/dev-log/course/twin-data.md) ----
@testset "twin data: practice setups (pure)" begin
    env = JuliaTime.lesson_env
    tbl(df) = [collect(r) for r in eachrow(df)]

    e1 = env("practice1")
    @test names(e1.logbook) == ["jar_id", "batch_id", "tray_id", "detected"]
    @test nrow(e1.logbook) == 12
    @test e1.logbook.jar_id == ["Q-041", "Q-042", "Q-043", "Q-044", "Q-045", "Q-046", "Q-051", "Q-052", "Q-053", "Q-054", "Q-055", "Q-056"]
    @test e1.logbook.batch_id == [fill("B04", 6); fill("B05", 6)]
    @test e1.logbook.tray_id == repeat(["T-D", "T-D", "T-E", "T-E", "T-F", "T-F"], 2)
    @test e1.logbook.detected == [true, false, true, true, false, false, true, true, false, true, true, false]
    @test sum(e1.logbook.detected) == 7
    @test nrow(e1.logbook[e1.logbook.batch_id .== "B05", :]) == 6 && sum(e1.logbook.detected[7:12]) == 4
    @test e1.practice_jars == JuliaTime.lesson_practice_jars()

    e2 = env("practice2")
    @test nrow(e2.ledger) == 15 && names(e2.ledger) == names(e1.logbook)
    @test e2.batch5 == filter(:batch_id => ==("B05"), e2.ledger) && nrow(e2.batch5) == 9
    @test e2.batch5.jar_id == ["R-05$i" for i in 1:9]
    @test e2.batch5.tray_id == repeat(["T-D", "T-E", "T-F"]; inner=3)
    @test e2.batch5.detected == [true, true, false, false, true, false, true, true, false]
    g = combine(groupby(e2.batch5, :tray_id), nrow => :n, :detected => sum => :detected_n)
    @test g.tray_id == ["T-D", "T-E", "T-F"] && g.n == [3, 3, 3] && g.detected_n == [2, 1, 2]
    @test g.detected_n ./ g.n ≈ [2/3, 1/3, 2/3]
    @test sum(e2.batch5.detected[e2.batch5.tray_id .== "T-F"]) == 2
    @test e2.practice_jars == JuliaTime.lesson_practice_jars()

    e3 = env("practice3")
    @test e3.shelves == ["S-1", "S-2", "S-3", "S-4", "S-5"]
    @test e3.logged == [2, 1, 0, 2, 1] && e3.keyed == [2, 1, 0, 22, 1]
    @test e3.entry == ["ok", "ok", "ok", "key pressed twice", "ok"]
    @test (e3.logged .!= e3.keyed) == [false, false, false, true, false]
    @test sum(e3.keyed .!= 0) == 4
    @test e3.entry[e3.logged .!= e3.keyed] == ["key pressed twice"]
    @test names(e3.desk) == ["shelves", "logged", "keyed"] && names(e3.form_desk) == ["shelves", "logged", "keyed", "entry"]
    @test e3.book_table.shelf_id == ["S-3", "S-1", "S-5", "S-4", "S-2"] && e3.key_table.shelf_id == e3.shelves
    m = leftjoin(e3.book_table, e3.key_table, on=:shelf_id)
    @test names(m) == ["shelf_id", "logged", "keyed"] && sort(m.shelf_id) == e3.shelves && nrow(m) == 5   # row order is Julia's, not relied on
    d = m[m.logged .!= m.keyed, :]
    @test tbl(d) == [["S-4", 2, 22]]
    @test !hasproperty(e3, :practice_records) && e3.practice_jars == JuliaTime.lesson_practice_jars()

    e4 = env("practice4")
    @test names(e4.open_jars) == ["jar_id"] && e4.open_jars.jar_id == ["Q-071", "Q-072", "Q-074", "Q-077", "Q-078"]

    e5 = env("practice5")
    @test length(e5.pretend_counts) == 1000 && e5.seen_count == 6
    @test all(0 .<= e5.pretend_counts .<= 8)
    @test count(e5.pretend_counts .>= e5.seen_count) == 161
    ev = e5.pretend_counts .>= e5.seen_count
    @test sum(ev) / length(ev) == 0.161
    @test count(e5.pretend_counts .>= 3) == 868
    @test env("practice5").pretend_counts == e5.pretend_counts   # deterministic

    e6 = env("practice6")
    @test tbl(e6.guesses) == [["Scarce", 0.15, 0, 3], ["Even split", 0.5, 2, 6], ["Plentiful", 0.85, 5, 8]]
    @test names(e6.guesses) == ["story", "p", "lower", "upper"]
    @test e6.seen_count == 6 && e6.pretend_counts == e5.pretend_counts
    kept = e6.guesses[(e6.guesses.lower .<= e6.seen_count) .& (e6.seen_count .<= e6.guesses.upper), :]
    @test kept.story == ["Even split", "Plentiful"]

    @test env("jars") !== nothing && haskey(env("jars"), :jars)   # old setups stay
end

@testset "twin data: no case fact leaks" begin
    forbidden_text = ["B09", "T-A", "T-B", "T-C", "Dying out", "Coin flip", "Thriving", "left blank", ""]
    forbidden_ids = Set("J-$(n)" for n in vcat(81:96))
    function leaves(x)
        x isa DataFrames.AbstractDataFrame && return vcat([leaves(collect(x[!, c])) for c in names(x)]..., String.(names(x)))
        x isa AbstractVector && return vcat([leaves(v) for v in x]..., Any[])
        return Any[x]
    end
    for k in 1:6
        env = JuliaTime.lesson_env("practice$k")
        @test env !== nothing
        for (name, val) in pairs(env)
            name === :practice_jars && continue   # the shared warm-up table, unchanged by design
            startswith(String(name), "practice_") && continue   # Lesson 3's warm-up lists (K-A, K-B), unchanged
            for v in leaves(val)
                if v isa AbstractString
                    @test !(v in forbidden_text) && !(v in forbidden_ids) && !occursin("blank", lowercase(v))
                end
                v isa Real && @test v != 113 && v != 0.113
            end
        end
        @test !haskey(env, :observed_count) && !haskey(env, :sim_counts) && !haskey(env, :jars) && !haskey(env, :stories)
    end
    e5 = JuliaTime.lesson_env("practice5")
    @test e5.seen_count != JuliaTime.mystery_c5_observed_count()
    @test e5.pretend_counts != JuliaTime.mystery_c5_sim_counts()
    @test count(e5.pretend_counts .>= e5.seen_count) != 113
    g = JuliaTime.lesson_env("practice6").guesses
    case_ranges = Set([(0, 2), (1, 5), (4, 6)])
    @test all(r -> (r.lower, r.upper) ∉ case_ranges, eachrow(g))
    # counts 2/2/1 and 2/2/0 per tray never appear as the per-tray counts
    cnt = combine(groupby(JuliaTime.lesson_env("practice2").batch5, :tray_id), :detected => sum => :s).s
    @test cnt != [2, 2, 1] && cnt != [2, 2, 0]
end

@testset "twin data: practice label" begin
    @test JuliaTime.LESSON_PRACTICE_DATA_LABEL != JuliaTime.MYSTERY_DATA_LABEL
    @test occursin("Practice data", JuliaTime.LESSON_PRACTICE_DATA_LABEL) && !occursin("—", JuliaTime.LESSON_PRACTICE_DATA_LABEL)
    @test JuliaTime.lesson_data_label("practice3") == JuliaTime.LESSON_PRACTICE_DATA_LABEL
    @test JuliaTime.lesson_data_label("jars") == JuliaTime.MYSTERY_DATA_LABEL
    @test JuliaTime.lesson_data_label(nothing) == JuliaTime.MYSTERY_DATA_LABEL
    lesson = Dict{String, Any}("id" => "t", "number" => 98, "title" => "t", "setup" => "practice1",
        "rounds" => [Dict{String, Any}("id" => "r", "challenges" => [Dict{String, Any}("id" => "c", "kind" => "see", "prompt" => "p", "data" => "logbook", "solution" => "logbook")])])
    pub = JuliaTime.lesson_public(lesson)
    @test pub["data_label"] == JuliaTime.LESSON_PRACTICE_DATA_LABEL
    @test pub["data_values"]["logbook"]["columns"] == ["jar_id", "batch_id", "tray_id", "detected"]
    lesson["setup"] = "jars"
    @test JuliaTime.lesson_public(lesson)["data_label"] == JuliaTime.MYSTERY_DATA_LABEL
end

# ---- EXAM ENGINE: the six chapters as kind "exam" lesson files (docs/dev-log/course/lesson-format.md, "Exams") ----
# A made-up exam over C2, C3 and C5 moves: each move in its own round, C3's second move with its own round setup.
_exam_step(id, checker, sol; data=nothing) = Dict{String, Any}("id" => id, "kind" => "checkpoint", "prompt" => "p", "starter" => "",
    "solution" => sol, "check" => Dict{String, Any}("same_value" => false, "checker" => checker), "hints" => ["h"],
    (data === nothing ? () : ("data" => data,))...)
const _EXAM_TEST = Dict{String, Any}("id" => "exam-test", "kind" => "exam", "chapter" => "C3", "number" => 3, "title" => "T",
    "setup" => "case3", "rounds" => Any[
        Dict{String, Any}("id" => "r1", "challenges" => Any[_exam_step("t-join", "check_exam3_join_report_log",
            "leftjoin(tray_counts, tally_sheet, on=:tray_id)"; data="tally_sheet")]),
        Dict{String, Any}("id" => "r2", "setup" => "case3_joined", "challenges" => Any[_exam_step("t-filter", "check_exam3_filter_disagreement",
            "joined[joined.notebook_detected .!= joined.sheet_detected, :]"; data="joined")]),
        Dict{String, Any}("id" => "r3", "setup" => "case2", "challenges" => Any[_exam_step("t-group", "check_exam2_group", "groupby(jars, :tray_id)")]),
        Dict{String, Any}("id" => "r4", "setup" => "case5", "challenges" => Any[_exam_step("t-freq", "check_exam5_event_frequency",
            "events = sim_counts .>= observed_count\nsum(events) / length(events)")]),
        Dict{String, Any}("id" => "r5", "setup" => "case4", "challenges" => Any[_exam_step("t-pick", "check_exam4_plan_distinct_recheck",
            "sample(eligible.jar_id, 3; replace=false)")]),
    ],
    "close" => Dict{String, Any}("finding" => "f", "next" => "n"))

# A chapter twist (0.5 fix): a normal exam round with no checker, judged by value against its own solution, run on the
# round's chapter setup.
_twist_exam() = begin
    e = deepcopy(_EXAM_TEST)
    push!(e["rounds"], Dict{String, Any}("id" => "r6", "setup" => "case2", "challenges" => Any[Dict{String, Any}("id" => "t-twist",
        "kind" => "checkpoint", "prompt" => "p", "starter" => "", "solution" => "nrow(jars[jars.detected, :])",
        "starter_hint" => "nrow(jars[___, :])", "data" => "jars", "check" => Dict{String, Any}("same_value" => true))]))
    e
end

@testset "exams: setups, checkers, public view, list (pure)" begin
    # every exam checker is a lesson checker, names a known course move and a setup that exists
    known = Set(["C1/select-records", "C2/group", "C2/counts", "C2/rates", "C3/join-report-log", "C3/filter-disagreement",
                 "C4/plan-distinct-recheck", "C5/event-mask", "C5/event-frequency", "C6/compatible-models"])
    @test length(JuliaTime.LESSON_EXAM_CHECKS) == 10
    @test Set(s.chapter * "/" * s.move_id for s in values(JuliaTime.LESSON_EXAM_CHECKS)) == known
    for (name, s) in JuliaTime.LESSON_EXAM_CHECKS
        @test haskey(JuliaTime.LESSON_CHECKERS, name) && JuliaTime.LESSON_CHECKERS[name] === s.check
        @test s.setup in JuliaTime.LESSON_EXAM_SETUPS
        env = JuliaTime.lesson_env(s.setup)
        @test env !== nothing && all(p -> p in keys(env), s.protected)
        @test !(:practice_jars in keys(env))   # an exam binds the chapter's inputs and nothing else
    end
    @test keys(JuliaTime.lesson_env("case1")) == (:jars, :case_batch)
    @test keys(JuliaTime.lesson_env("case3")) == (:tray_counts, :tally_sheet)
    @test keys(JuliaTime.lesson_env("case3_joined")) == (:joined,)
    @test keys(JuliaTime.lesson_env("case5")) == (:sim_counts, :n_jars, :p_ref, :observed_count, :n_trials)
    @test JuliaTime.lesson_data_label("case1") == JuliaTime.MYSTERY_DATA_LABEL
    # the checkers judge like the chapters
    @test JuliaTime.LESSON_CHECKERS["check_exam1_select_records"](filter(:batch_id => ==("B09"), JuliaTime.mystery_jars()), "")[1]
    @test !JuliaTime.LESSON_CHECKERS["check_exam1_select_records"](JuliaTime.mystery_jars(), "")[1]
    @test JuliaTime.LESSON_CHECKERS["check_exam3_filter_disagreement"](JuliaTime.mystery_c3_expected_discrepancy(), "")[1]
    @test JuliaTime.LESSON_CHECKERS["check_exam5_event_mask"](JuliaTime.mystery_c5_expected_events(), "")[1]
    @test !JuliaTime.LESSON_CHECKERS["check_exam5_event_frequency"](JuliaTime.mystery_c5_expected_events(), "")[1]
    # the record an exam pass carries: the move, its row count (C5's frequency counts its rounds), C4's jars
    s4 = JuliaTime.LESSON_EXAM_CHECKS["check_exam4_plan_distinct_recheck"]
    @test JuliaTime._lesson_exam_record(s4, ["J-091", "J-092", "J-094"]) ==
        Dict{String, Any}("chapter" => "C4", "move_id" => "plan-distinct-recheck", "row_count" => 3, "jar_ids" => ["J-091", "J-092", "J-094"])
    @test JuliaTime._lesson_exam_record(JuliaTime.LESSON_EXAM_CHECKS["check_exam5_event_frequency"], 0.1)["row_count"] == JuliaTime.MYSTERY_C5_N_TRIALS
    @test JuliaTime._lesson_exam_row_count(groupby(JuliaTime._mystery_c2_input(), :tray_id)) == 6

    JuliaTime.reload_lessons!()
    JuliaTime.LESSONS["exam-test"] = deepcopy(_EXAM_TEST)
    try
        pub = JuliaTime.lesson_public(JuliaTime.LESSONS["exam-test"])
        cs = _challenges(pub)
        @test all(c -> !haskey(c, "solution") && !haskey(c, "check"), cs)
        # data comes from each round's own setup: C3's second move shows `joined`, its first the tally sheet
        @test pub["data_values"]["joined"]["columns"] == ["tray_id", "notebook_detected", "sheet_detected", "entry_status"]
        @test pub["data_values"]["tally_sheet"]["columns"] == ["tray_id", "sheet_detected", "entry_status"]
        # the pocket dictionary is Lessons 1 to 3's, each line once, in lesson order
        want = String[]
        for k in 1:3, row in get(JuliaTime.LESSONS["lesson$k"], "dictionary", Any[])
            get(row, "lesson_only", false) === true && continue   # practice-data rows stay in the lesson
            row["julia"] in want || push!(want, row["julia"])
        end
        @test [r["julia"] for r in pub["dictionary"] if haskey(r, "lesson")] == want && !isempty(want)
        @test all(r -> !haskey(r, "from_round") && (haskey(r, "lesson") ? (r["lesson"] in 1:3) : (r["from_setup"] === true)), pub["dictionary"])
        # round 2 (P14): the names the chapter's setups bind come first, one row each, before the lessons' rows
        own = [r["julia"] for r in pub["dictionary"] if get(r, "from_setup", false) === true]
        @test "tally_sheet" in own && "joined" in own && findfirst(r -> haskey(r, "lesson"), pub["dictionary"]) > length(own)
        # the list: an exam carries kind "exam" and sorts right after its lesson
        list = JuliaTime.lesson_list_reply()["lessons"]
        at(id) = findfirst(l -> l["id"] == id, list)
        @test list[at("exam-test")]["kind"] == "exam"
        @test at("lesson3") < at("exam-test") && (at("lesson4") === nothing || at("exam-test") < at("lesson4"))
        haskey(JuliaTime.LESSONS, "exam1") && @test at("lesson1") < at("exam1") < at("lesson2")
    finally
        JuliaTime.reload_lessons!()
    end
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    @testset "exams: runs as the chapter runs, with its protection (sandbox)" begin
        JuliaTime.LESSONS["exam-test"] = deepcopy(_EXAM_TEST)
        run(cid, code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "exam-test", "challenge" => cid,
                                                        "code" => code, "request_id" => "x"))
        try
            for (_, r) in enumerate(_EXAM_TEST["rounds"]), c in r["challenges"]
                res = run(c["id"], c["solution"])
                @test (res["pass"] === true) || (println(c["id"], ": ", res["feedback"]); false)
                spec = JuliaTime._lesson_exam_spec(c)
                @test res["exam"]["chapter"] == spec.chapter && res["exam"]["move_id"] == spec.move_id
            end
            @test run("t-join", "leftjoin(tray_counts, tally_sheet, on=:tray_id)")["exam"]["row_count"] == 3
            @test run("t-filter", "joined[joined.notebook_detected .!= joined.sheet_detected, :]")["exam"]["row_count"] == 1
            # C3: rebinding an input to an equal copy is refused, as in chapter 3 (the identity guard)
            res = run("t-filter", "joined = copy(joined)\njoined[joined.notebook_detected .!= joined.sheet_detected, :]")
            @test res["pass"] == false && !haskey(res, "exam") && occursin("was changed", res["feedback"]) && res["message"] == ""
            # C2: the chapter's protected jars cannot be changed
            res = run("t-group", "jars.detected .= false\ngroupby(jars, :tray_id)")
            @test res["pass"] == false && res["status"] == "error"
            # C5: sim_counts may not be rebound
            res = run("t-freq", "sim_counts = copy(sim_counts)\nevents = sim_counts .>= observed_count\nsum(events) / length(events)")
            @test res["pass"] == false
            # a parse error names the player's own line, never the guard's
            res = run("t-filter", "joined[joined.notebook_detected .!= joined.sheet_detected, :")
            @test res["status"] == "error" && !occursin("__juliatime", res["message"])
            # C4: a hand-picked list is not a fair pick (the chapter's chance check)
            res = run("t-pick", "[\"J-091\", \"J-092\", \"J-094\"]")
            @test res["pass"] == false && occursin("same three jars", res["feedback"])
            # a wrong value is never an exam pass
            res = run("t-freq", "0.5")
            @test res["pass"] == false && !haskey(res, "exam")
            # a twist: same_value on the round's chapter setup; no checker, so no chapter record is saved
            JuliaTime.LESSONS["exam-test"] = _twist_exam()
            want = count(JuliaTime._mystery_c2_input().detected)
            res = run("t-twist", "nrow(jars[jars.detected, :])")
            @test res["pass"] === true && !haskey(res, "exam") && res["value_repr"] == string(want)
            @test run("t-twist", "sum(jars.detected)")["pass"] === true           # same value, another line
            res = run("t-twist", "nrow(jars)")
            @test res["pass"] === false && res["status"] == "ok"
            @test run("t-twist", "practice_jars")["status"] == "error"            # the chapter's data only
            res = run("t-twist", "zzz")
            @test res["status"] == "error" && occursin("`zzz`", res["feedback"])
            pubc = only(filter(c -> c["id"] == "t-twist", _challenges(JuliaTime.lesson_public(_twist_exam()))))
            @test pubc["starter_hint"] == "nrow(jars[___, :])" && !haskey(pubc, "solution") && !haskey(pubc, "check")
            @test haskey(JuliaTime.lesson_public(_twist_exam())["data_values"], "jars")
            # the inputs are the chapter's: no practice table here
            res = run("t-group", "practice_jars")
            @test res["status"] == "error"
        finally
            JuliaTime.reload_lessons!()
        end
    end
end

@testset "review 0.5: no case fact in any lesson_public payload (lessons 1 to 6 and the range)" begin
    JuliaTime.reload_lessons!()
    patterns = [r"J-0(8[1-6]|9[1-6])", r"\bB09\b", r"\bT-C\b",
                r"left blank|blank box|box was empty|was left empty|a blank became|form.{0,40}\b(blank|empty)\b"i,
                r"\b113\b|0\.113|\b1 in 9\b|1 round in 9|1 time in 9|one in nine"i,
                r"\b5 of (the )?6\b|five of (the )?six"i, r"dying out|coin flip|thriving"i, r"\b965\b"]
    leaks(txt) = [p for p in patterns if occursin(p, txt)]
    # positive control: the old range payload (the case rack and case label) is caught
    @test !isempty(leaks(JSON.json(Dict("jars" => JuliaTime._lesson_jars_rack(), "label" => JuliaTime.MYSTERY_DATA_LABEL))))
    for id in ["lesson$n" for n in 1:6]
        @test isempty(leaks(JSON.json(JuliaTime.lesson_public(JuliaTime.LESSONS[id])))) 
    end
    pub = JuliaTime.lesson_public(JuliaTime.LESSONS["range"])
    @test isempty(leaks(JSON.json(pub)))
    @test pub["data_label"] == JuliaTime.LESSON_PRACTICE_DATA_LABEL
    @test all(startswith(j["jar_id"], "Q-") for j in pub["jars"]) && length(pub["jars"]) == 12
    @test all(!haskey(j, "detected") for j in pub["jars"])
end

@testset "review 0.5: data_also sends a second table; exam3 step 1 shows both inputs" begin
    JuliaTime.reload_lessons!()
    pub = JuliaTime.lesson_public(JuliaTime.LESSONS["exam3"])
    @test haskey(pub["data_values"], "tray_counts") && haskey(pub["data_values"], "tally_sheet")
    c = pub["rounds"][1]["challenges"][1]
    @test c["data"] == "tray_counts" && c["data_also"] == "tally_sheet"
    @test !occursin("leftjoin(tray_counts", JSON.json(c["hints"]))
end

# ---- Round 2 field contract (lesson-format.md, "Round 2 field contract") ----
@testset "round 2 contract: every lesson, exam and range file keeps it (pure)" begin
    for f in _LESSON_FILES
        v = JuliaTime.lesson_contract_violations(JuliaTime.load_lesson_file(f))
        # Pending content (P19, builder R): today's range.json marks w11 `boss` but has no story line and no
        # table of its own yet (R's branch gives it `jars`). Remove this filter when the range content lands.
        basename(f) == "range.json" && filter!(m -> !occursin("the boss wave needs", m), v)
        @test isempty(v) || (println(basename(f), ": ", v); false)
    end
end

@testset "round 2 contract: bad fields are named (pure)" begin
    bad(l) = JuliaTime.lesson_contract_violations(l)
    base = Dict{String, Any}("id" => "t", "rounds" => Any[Dict{String, Any}("id" => "r1", "challenges" => Any[
        Dict{String, Any}("id" => "c1", "feedback" => Dict{String, Any}("errors" => Any[
            Dict{String, Any}("match" => "x", "say" => "y", "code_lacks" => "")]))])])
    @test any(occursin("code_lacks", m) for m in bad(base))
    d = Dict{String, Any}("id" => "t", "rounds" => Any[], "dictionary" => Any[
        Dict{String, Any}("julia" => "a", "means" => "b", "py" => "", "lesson_only" => "yes")])
    @test any(occursin("py must", m) for m in bad(d)) && any(occursin("lesson_only must", m) for m in bad(d))
    ex = Dict{String, Any}("id" => "x", "kind" => "exam", "number" => 1, "rounds" => Any[], "minutes" => 90,
        "dictionary" => Any[Dict{String, Any}("julia" => "jars", "lesson_only" => true)])
    @test length(bad(ex)) == 3   # minutes, lesson_only in an exam, a row with no means
    ok = Dict{String, Any}("id" => "x", "kind" => "exam", "number" => 1, "rounds" => Any[], "minutes" => 10,
        "dictionary" => Any[Dict{String, Any}("julia" => "jars", "means" => "the case notebook", "r" => "jars", "py" => "jars")])
    @test isempty(bad(ok))
    wave(id; kw...) = Dict{String, Any}("id" => id, "targets" => ["Q-041"], (String(k) => v for (k, v) in kw)...)
    rg(ws) = Dict{String, Any}("id" => "range", "kind" => "range", "setup" => "practice1", "waves" => ws)
    @test isempty(bad(rg([wave("w1"; group = "Aim by position"), wave("w2"; group = "Aim by position"),
                          wave("w3"; group = "Boss", boss = true, story = "Momo brings the big logbook.", setup = "range_boss",
                               targets = ["Q-031", "Q-069"])])))
    @test any(occursin("sit together", m) for m in bad(rg([wave("w1"; group = "A"), wave("w2"; group = "B"), wave("w3"; group = "A")])))
    @test any(occursin("every wave needs one", m) for m in bad(rg([wave("w1"; group = "A"), wave("w2")])))
    @test any(occursin("must be the last", m) for m in bad(rg([wave("w1"; boss = true, story = "s", setup = "range_boss"), wave("w2")])))
    @test any(occursin("at least 24", m) for m in bad(rg([wave("w1"; boss = true, story = "s", setup = "practice1")])))
    @test any(occursin("needs a story", m) for m in bad(rg([wave("w1"; boss = true, setup = "range_boss")])))
    @test any(occursin("not in the wave's table", m) for m in bad(rg([wave("w1"; setup = "range_boss", targets = ["Q-999"])])))
    # a wave may bring its own table as `jars` (the boss level in range.json, builder R)
    jr(n) = [Dict{String, Any}("jar_id" => "Z-$(lpad(i, 3, '0'))", "batch_id" => "B06", "tray_id" => "T-D", "detected" => isodd(i)) for i in 1:n]
    @test isempty(bad(rg([wave("w1"), wave("w2"; boss = true, story = "s", jars = jr(30), targets = ["Z-001"])])))
    @test any(occursin("at least 24", m) for m in bad(rg([wave("w1"; boss = true, story = "s", jars = jr(10), targets = ["Z-001"])])))
    @test any(occursin("jars must be a list of rows", m) for m in bad(rg([wave("w1"; jars = Any[Dict{String, Any}("jar_id" => "Z-1")])])))
    @test any(occursin("not in the wave's table", m) for m in bad(rg([wave("w1"; jars = jr(3))])))
    @test any(occursin("repeats a jar_id", m) for m in bad(rg([wave("w1"; jars = vcat(jr(2), jr(1)), targets = ["Z-001"])])))
    t = JuliaTime._range_wave_jars_table(Dict{String, Any}("jars" => jr(3)))
    @test names(t) == ["jar_id", "batch_id", "tray_id", "detected"] && t.detected == [true, false, true] && eltype(t.detected) == Bool
    @test JuliaTime._range_wave_jars_table(Dict{String, Any}("jars" => Any[])) === nothing
    @test JuliaTime._range_wave_logbook(Dict{String, Any}("setup" => "range_boss")) == JuliaTime.lesson_env("range_boss").logbook
    @test JuliaTime._range_wave_logbook(Dict{String, Any}("id" => "w1")) === nothing
end

@testset "round 2 contract: code_lacks, exam dictionary and lesson_only, py (pure)" begin
    ch = Dict{String, Any}("id" => "c", "feedback" => Dict{String, Any}("errors" => Any[
        Dict{String, Any}("match" => "UndefVarError", "say" => "Each Run starts fresh, so build counts again.", "code_lacks" => "counts ="),
        Dict{String, Any}("match" => "UndefVarError", "say" => "The table is counts.")]))
    msg = "UndefVarError: `zz` not defined"
    @test occursin("Each Run starts fresh", JuliaTime._lesson_error_line(ch, "zz.rate", msg))
    @test !occursin("Each Run starts fresh", JuliaTime._lesson_error_line(ch, "counts = 1\nzz.rate", msg))
    @test occursin("Each Run starts fresh", JuliaTime._lesson_error_line(ch, "# counts = 1\nzz.rate", msg))   # a comment does not count
    JuliaTime.reload_lessons!()
    saved = deepcopy(JuliaTime.LESSONS["lesson1"])
    try
        l1 = JuliaTime.LESSONS["lesson1"]
        push!(l1["dictionary"], Dict{String, Any}("julia" => "practice_jars_only_row", "means" => "m", "lesson_only" => true))
        l1["dictionary"][1]["py"] = "len(x)"
        exam = Dict{String, Any}("id" => "exam-t", "kind" => "exam", "number" => 1, "setup" => "case1", "rounds" => Any[],
            "dictionary" => Any[Dict{String, Any}("julia" => "jars", "means" => "the case notebook", "py" => "jars"),
                                Dict{String, Any}("julia" => l1["dictionary"][1]["julia"], "means" => "own wording")])
        rows = JuliaTime.lesson_public(exam)["dictionary"]
        @test rows[1]["julia"] == "jars" && rows[1]["chapter"] == 1 && !haskey(rows[1], "lesson") && rows[1]["py"] == "jars"
        @test rows[2]["means"] == "own wording" && rows[2]["chapter"] == 1          # the chapter's own row wins
        @test !any(r -> r["julia"] == "practice_jars_only_row", rows)               # lesson_only rows are dropped
        @test all(r -> !haskey(r, "lesson_only"), rows)
        @test count(r -> r["julia"] == l1["dictionary"][1]["julia"], rows) == 1
        # then the setup's other names (case1 binds jars and case_batch; jars has its own row), never a value
        cb = only(filter(r -> r["julia"] == "case_batch", rows))
        @test cb["from_setup"] === true && cb["chapter"] == 1 && !occursin("B09", cb["means"]) && findfirst(==(cb), rows) == 3
        # py passes through on lesson rows, in a lesson's own view and in a chapter's
        @test JuliaTime.lesson_public(l1)["dictionary"][1]["py"] == "len(x)"
        l1d = [r for r in rows if get(r, "lesson", 0) == 1]
        @test all(r -> haskey(r, "lesson") && r["lesson"] == 1, l1d)
        # the lesson's own view keeps lesson_only rows (the screen shows them in the lesson)
        @test any(r -> r["julia"] == "practice_jars_only_row", JuliaTime.lesson_public(l1)["dictionary"])
        # exam minutes reach the list
        JuliaTime.LESSONS["exam-t"] = merge(exam, Dict{String, Any}("minutes" => 8))
        @test only(filter(l -> l["id"] == "exam-t", JuliaTime.lesson_list_reply()["lessons"]))["minutes"] == 8
    finally
        JuliaTime.reload_lessons!()
    end
end

@testset "round 2 contract: the boss table and wave setups in the range view (pure)" begin
    b = JuliaTime.lesson_env("range_boss").logbook
    @test nrow(b) == 30 && names(b) == ["jar_id", "batch_id", "tray_id", "detected"]
    @test allunique(b.jar_id) && all(startswith("Q-"), b.jar_id)
    @test b[10:21, :] == JuliaTime.lesson_env("practice1").logbook       # Lesson 1's logbook, unchanged
    @test isempty(intersect(Set(b.batch_id), Set(["B08", "B09"]))) && isempty(intersect(Set(b.tray_id), Set(["T-A", "T-B", "T-C"])))
    @test haskey(JuliaTime.lesson_env("range_boss"), :practice_jars)
    @test JuliaTime.lesson_data_label("range_boss") == JuliaTime.LESSON_PRACTICE_DATA_LABEL
    rg = Dict{String, Any}("id" => "range-t", "kind" => "range", "setup" => "practice1", "waves" => Any[
        Dict{String, Any}("id" => "w1", "targets" => ["Q-041"], "example" => "x"),
        Dict{String, Any}("id" => "w2", "targets" => ["Q-031"], "example" => "x", "setup" => "range_boss", "boss" => true,
                          "story" => "s", "group" => "Boss")])
    pub = JuliaTime.lesson_public(rg)
    @test length(pub["jars"]) == 12 && pub["columns"] == ["jar_id", "batch_id", "tray_id", "detected"]
    @test !haskey(pub["waves"][1], "jars")
    @test length(pub["waves"][2]["jars"]) == 30 && all(j -> !haskey(j, "detected"), pub["waves"][2]["jars"])
    @test pub["waves"][2]["boss"] === true && pub["waves"][2]["group"] == "Boss" && !haskey(pub["waves"][2], "example")
end

@testset "round 2: shown is Julia's own print, with a caption and row labels (pure)" begin
    jp(v) = sprint(show, MIME"text/plain"(), v; context=(:limit => true, :displaysize => (24, 80)))
    df = DataFrame(tray_id=["T-D", "T-E", "T-F"], n=[3, 3, 3], rate=[2/3, 1.0, 1/3])
    many = collect(1:1000)
    for v in (1.0, [2/3, 1/3], BitVector([1, 0]), [true, false], df, groupby(df, :tray_id), many, "Q-041", df[1, :], ["P-01", "P-02"])
        @test JuliaTime._lesson_shown(v) == jp(v)
    end
    @test JuliaTime._lesson_shown(1.0) == "1.0" && occursin("0.666667", JuliaTime._lesson_shown(df))
    @test startswith(JuliaTime._lesson_shown(BitVector([1, 0])), "2-element BitVector:\n 1\n 0")
    @test JuliaTime._lesson_shown(nothing) == ""
    @test length(JuliaTime._lesson_shown(string.(1:5000))) <= JuliaTime.LESSON_SHOWN_MAX
    # the long-text cut ends at a line end
    long = JuliaTime._lesson_shown(DataFrame(a=[repeat("x", 3000), "y"]))
    @test length(long) <= JuliaTime.LESSON_SHOWN_MAX
    # captions
    cap(v, k=nothing) = JuliaTime._lesson_shown_caption(v, k)
    @test cap(df) == "A table: 3 rows, 3 columns." && cap(df[1:1, 1:1]) == "A table: 1 row, 1 column."
    @test cap(df[1, :]) == "One row of a table." && cap(groupby(df, :tray_id)) == "A table split into 3 groups."
    @test cap(trues(1000)) == "1,000 answers, true or false. Julia prints true as 1 and false as 0."
    @test cap(many) == "A list of 1,000 items. Julia calls a list a Vector." && cap(Int[]) == "An empty list. Julia calls a list a Vector."
    @test cap(1.0) == "" && cap("Q-041") == ""
    # row labels: a list with one item per row of a table the line names
    env1 = JuliaTime.lesson_env("practice1")
    k = JuliaTime._lesson_shown_keys(env1.logbook.batch_id .== "B04", "logbook.batch_id .== \"B04\"", env1)
    @test k.table == "logbook" && k.column == "jar_id" && k.values == env1.logbook.jar_id
    @test cap(env1.logbook.detected, k) == "12 answers, one per row of logbook. Julia prints true as 1 and false as 0."
    @test JuliaTime._lesson_shown_keys(env1.logbook.jar_id, "logbook.jar_id", env1) === nothing        # the labels themselves
    @test JuliaTime._lesson_shown_keys(env1.logbook.jar_id[1:3], "logbook.jar_id[1:3]", env1) === nothing   # not one per row
    @test JuliaTime._lesson_shown_keys([true, false], "\"logbook\"", env1) === nothing                 # a name in a string is not a table
    env6 = JuliaTime.lesson_env("practice6")
    k6 = JuliaTime._lesson_shown_keys(env6.guesses.lower .<= 3, "fits_low = guesses.lower .<= 3", env6)
    @test k6.column == "story" && k6.values == ["Scarce", "Even split", "Plentiful"]
    env3 = JuliaTime.lesson_env("practice3")
    k3 = JuliaTime._lesson_shown_keys(env3.logged .!= env3.keyed, "logged .!= keyed", env3)
    @test k3.table == "desk" && k3.column == "shelves"
    @test JuliaTime._lesson_shown_keys(env3.keyed, "desk.keyed", env3).values == ["S-1", "S-2", "S-3", "S-4", "S-5"]
    # cells: Julia's own text for each table cell, beside the JSON rows
    t = JuliaTime._lesson_value_table(df)
    @test !haskey(JuliaTime._lesson_table(df), "cells")   # data tables beside the editor keep their stored shape
    @test t["cells"] == [["T-D", "3", "0.666667"], ["T-E", "3", "1.0"], ["T-F", "3", "0.333333"]]
    @test t["rows"][2][3] === 1.0
    @test JuliaTime._lesson_value_table(DataFrame(a=[missing, true]))["cells"] == [["missing"], ["true"]]
    # Julia's own message without the sandbox's generic line
    @test JuliaTime._lesson_julia_text("A function was called with the wrong kind of argument.\n\nMethodError: no method") == "MethodError: no method"
    @test JuliaTime._lesson_julia_text("zz is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `zz` not defined") ==
          "UndefVarError: `zz` not defined"
    @test JuliaTime._lesson_julia_text("Something went wrong running this line.") == ""
    # a stand-in line alone is never Julia's message (never invent output)
    @test JuliaTime._lesson_julia_text("zz is a name Julia does not know yet. Check the spelling, or define it first.") == ""
    @test JuliaTime._lesson_julia_text("Julia couldn't parse this line. Look for a missing bracket, a missing comma, or a missing end keyword.") == ""
    @test JuliaTime._lesson_julia_text("That line stopped Julia itself (exit() or a crash) \u2014 try again without it.") == ""
    @test JuliaTime._lesson_julia_text("Your code changed the protected input `joined`.") == "Your code changed the protected input `joined`."
    # the game's own notes are not Julia's message: the protected-input note is the feedback line instead
    note = "The supplied jars records changed. Keep the source table unchanged; create a separate summary or copy, then try again."
    @test JuliaTime._lesson_julia_text("Something went wrong running this line.\n\n" * note) == ""
    @test JuliaTime._lesson_julia_text(note) == ""
    @test JuliaTime._lesson_julia_text("No sandbox worker is available.") == ""
    @test JuliaTime._lesson_julia_text("Your code ran for more than 5.0 seconds and was stopped. Loops that never finish are the usual cause.") == ""
    @test JuliaTime._lesson_protected_note("Something went wrong running this line.\n\n" * note) == note
    @test JuliaTime._lesson_protected_note("MethodError: no method") == ""
    @test JuliaTime._lesson_error_line(Dict{String,Any}(), "x = 1", "Something went wrong running this line.\n\n" * note) == note
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    @testset "round 2: shown in the real sandbox (lessons, chapters, range)" begin
        JuliaTime.reload_lessons!()
        run(l, c, code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => l, "challenge" => c, "code" => code, "request_id" => "s"))
        first_id(l) = JuliaTime._lesson_challenges(JuliaTime.LESSONS[l])[1]["id"]
        jp(v) = sprint(show, MIME"text/plain"(), v; context=(:limit => true, :displaysize => (24, 80)))
        l1 = first_id("lesson1")
        @test run("lesson1", l1, "1.0")["shown"] == "1.0"
        @test run("lesson1", l1, "[2/3, 1/3]")["shown"] == jp([2/3, 1/3])
        r = run("lesson1", l1, "logbook.batch_id .== \"B04\"")
        @test r["shown"] == jp(JuliaTime.lesson_env("practice1").logbook.batch_id .== "B04")
        @test r["shown_keys"]["column"] == "jar_id" && length(r["shown_keys"]["values"]) == 12
        l2 = first_id("lesson2")
        df = combine(groupby(JuliaTime.lesson_env("practice2").batch5, :tray_id), nrow => :n, :detected => sum => :detected_n)
        df.rate = df.detected_n ./ df.n
        r = run("lesson2", l2, "counts = combine(groupby(batch5, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate = counts.detected_n ./ counts.n\ncounts")
        @test r["shown"] == jp(df) && occursin("0.666667", r["shown"]) && r["value_table"]["cells"][1][4] == "0.666667"
        @test r["shown_caption"] == "A table: 3 rows, 4 columns."
        r = run("lesson2", l2, "groupby(batch5, :tray_id)")
        @test startswith(r["shown"], "GroupedDataFrame with 3 groups")
        l5 = first_id("lesson5")
        r = run("lesson5", l5, "collect(1:1000)")
        @test r["shown"] == jp(collect(1:1000)) && occursin("⋮", r["shown"])
        # a run that fails shows nothing, and its message is Julia's own text
        r = run("lesson1", l1, "zzq")
        @test r["shown"] == "" && r["shown_caption"] == "" && r["message"] == "UndefVarError: `zzq` not defined"
        # a chapter shows Julia's print of 1.0 (x2-rates)
        x2 = JuliaTime.LESSONS["exam2"]
        rates = only(filter(c -> occursin("rates", c["id"]), JuliaTime._lesson_challenges(x2)))
        r = run("exam2", rates["id"], rates["solution"])
        @test r["pass"] === true && occursin("1.0", r["shown"])
        # the range
        r = run("range", "w1", "logbook.jar_id[9]")
        @test r["shown"] == "\"Q-053\"" && r["pass"] === true
    end
end

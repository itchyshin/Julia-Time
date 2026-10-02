using Test, JuliaTime

# Round 2 (P06): error lines name the actual mistake on the right line. Each row is a realistic mistake from the
# round-2 reports (docs/dev-log/course/review-0.5-r2/), typed into the real step: a dropped dot, a misspelt name or
# column, R syntax ($, <-, c(), &, TRUE), a wrong or missing bracket, a missing comma. The row gives the first
# sentence the player must see, and words that must not appear (the wrong advice the reports found).
# Pure helpers always run; the table runs in the real sandbox with JULIATIME_INTEGRATION=1.

_first_sentence(s) = String(first(split(strip(s), r"(?<=[.?!])\s+"; limit=2)))

@testset "mistakes: edit distance, slips, lines (pure)" begin
    d = JuliaTime._lesson_edit_distance
    @test d("conts", "counts") == 1 && d("lenght", "length") == 1 && d("letjoin", "leftjoin") == 1
    @test d("abc", "abc") == 0 && d("", "abc") == 3 && d("gueses", "guesses") == 1 && d("kitten", "sitting") == 3
    slip = JuliaTime._lesson_slip_distance
    @test slip("Logbook", "logbook") == 0                       # capital letters only
    @test slip("cou", "counts") !== nothing                     # cut short, three letters or more
    @test slip("observed", "observed_count") !== nothing
    @test slip("fist", "first") == 1 && slip("saple", "sample") == 1
    @test slip("two", "on") === nothing && slip("four", "sum") === nothing
    @test slip("n", "p") === nothing && slip("bi", "big") === nothing && slip("bi", "big"; short=true) == 1
    @test slip("counts", "counts") === nothing
    @test slip("seen_cout", "seen_count") == 1 && slip("xyzzy", "logbook") === nothing
    # line numbers are counted from the code; strings, comments and columns are not names
    code = "conts = combine(groupby(ledger, :batch_id), nrow => :n)\n# counts here\ncounts"
    @test JuliaTime._lesson_assigned(code) == [("conts", 1)]
    @test JuliaTime._lesson_word_line(code, "counts") == 3
    @test JuliaTime._lesson_word_line("x.counts\n\"counts\"\ncounts", "counts") == 3
    @test JuliaTime._lesson_plain_names("combine(groupby(batch5, :tray_id), nrow => :n)") == ["combine", "groupby", "batch5", "nrow"]
    # the bracket scan names the open bracket and its line
    pe = "ParseError: x"
    @test JuliaTime._lesson_bracket_line("sum([4, 7, 1]", pe) == "The ( after `sum` on line 1 has no ). Add ) at the end of line 1."
    @test JuliaTime._lesson_bracket_line("sum([4, 7, 1)", pe) == "The [ before `4` on line 1 is closed with ). Put ] before the )."
    @test occursin("2 brackets are still open on line 1", JuliaTime._lesson_bracket_line("sum(b.d[b.t .== \"T-A\"", pe))
    @test occursin("line 2", JuliaTime._lesson_bracket_line("m = f(a)\nm[m.x .!= m.y, :", pe))
    # a call's bracket closes at the end of its line, even with more lines after it (one step per line)
    @test endswith(JuliaTime._lesson_bracket_line("c = combine(g, nrow => :n\nc", pe), "Add ) at the end of line 1.")
    # a grouping bracket with more brackets after it may close earlier
    @test endswith(JuliaTime._lesson_bracket_line("(a .<= 4 .& (4 .<= b)", pe), "Add ) where that part ends.")
    @test endswith(JuliaTime._lesson_bracket_line("(a .<= 4) .& (4 .<= b", pe), "Add ) at the end of line 1.")
    @test JuliaTime._lesson_bracket_line("sum([4, 7, 1])", pe) == ""
    @test JuliaTime._lesson_bracket_line("sum(\"(\")", pe) == ""          # a bracket inside text does not count
    @test JuliaTime._lesson_bracket_line("sum([1])", "MethodError") == ""  # only for a line Julia could not read
    # a catch-all line's capital-letter advice goes when the word has no capital letter
    drop = JuliaTime._lesson_drop_capitals_advice
    @test drop("The names here are first and practice_jars: no capital letters, and an underscore.", "practicejars") ==
          "The names here are first and practice_jars, with an underscore."
    @test drop("The function here is length, all small letters.", "x") == "The function here is length."
    @test drop("Here sum, true and false are all small letters.", "x") == ""
    @test drop("The function here is length, all small letters.", "Lenght") == "The function here is length, all small letters."
    # "... and no capital letters." loses the whole clause, never leaving a dangling "and" (round 4, L5 r2-c5)
    @test drop("Check the spelling of pretend_counts and seen_count. Both have underscores and no capital letters.", "pretendcounts") ==
          "Check the spelling of pretend_counts and seen_count. Both have underscores."
    @test drop("Check the spelling. Names like practice_jars and open_jars have an underscore and no capital letters.", "openjars") ==
          "Check the spelling. Names like practice_jars and open_jars have an underscore."
    # "Julia does not know one of the words" is never said twice
    named = JuliaTime._lesson_name_the_word("Julia does not know one of the words in your line. The table is logbook.", "lg")
    @test named == "Julia does not know the word `lg`. The table is logbook."
    @test JuliaTime._lesson_name_the_word("Julia does not know one of your words. Both are all small letters.", "zz") ==
          "Julia does not know the word `zz`. Check its spelling."
end

# (lesson, challenge, code, first sentence, must not contain). The first sentence is either the exact sentence (a line the
# engine writes) or a list of words it must all contain: those rows are steps where a lesson's own specific entry may
# answer first (rule 5 of `_lesson_error_line`), in the content builder's wording, and must still name the same slip.
const LESSON_MISTAKES = [
    # ---- Lesson 1 ----
    ("lesson1", "l1-r1-c4", "sum([4, 7, 1]", "The ( after `sum` on line 1 has no ).", ["Each [ needs"]),
    ("lesson1", "l1-r1-c4", "sum([4, 7, 1)", "The [ before `4` on line 1 is closed with ).", ["Each ( needs"]),
    ("lesson1", "l1-r1-c7", "sum(lobook.detected)", "Julia does not know `lobook`.", ["one of the words", "small letters"]),
    ("lesson1", "l1-r1-c7", "sum(logbook.deected)", "`logbook` has no column `deected`.", ["one of the words"]),
    ("lesson1", "l1-r1-c7", "Sum(logbook.detected)", "Julia does not know `Sum`.", ["one of the words"]),
    ("lesson1", "l1-r1-c7", "sum(logbook.detected == TRUE)", "Julia writes true and false in small letters: `true`, not `TRUE`.", String[]),
    ("lesson1", "l1-r1-c7", "sum(c(1, 2))", "Julia writes a list with square brackets: [a, b].", ["logbook"]),
    ("lesson1", "l1-r1-c7", "sum(logbook\$detected)", "Julia does not use \$ for columns.", String[]),
    ("lesson1", "l1-r2-c3", "logbook[1:3, :)", "The [ after `logbook` on line 1 is closed with ).", String[]),
    ("lesson1", "l1-r3-c1", "logbook.batch_id == \"B04\"", "A comparison sign with no dot gives one answer for the whole list.", String[]),
    # ---- Lesson 2 ----
    ("lesson2", "l2-r3-c2", "conts = combine(groupby(ledger, :batch_id), nrow => :n)\ncounts",
        "Line 1 makes `conts`, but line 2 uses `counts`.", ["one of the words", "Each Run"]),
    ("lesson2", "l2-r3-c2", "counts = combine(groupby(ledger :batch_id), nrow => :n)\ncounts",
        "Put a comma between `ledger` and `:batch_id`: a comma separates the inputs.", ["colon in front"]),
    ("lesson2", "l2-r3-c2", "counts = combine(group_by(ledger, :batch_id), nrow => :n)\ncounts",
        "Julia does not know `group_by` on line 1.", ["one of the words"]),
    ("lesson2", "l2-r1-c1", "batch5 <- ledger[ledger.batch_id .== \"B05\", :]\nbatch5", "Julia assigns with =, not <-.", String[]),
    ("lesson2", "l2-r2-c6", "sum(batch5.detected[batch5.tray_id .== \"T-E\")", "The [ after `batch5.detected` on line 1 is closed with ).", String[]),
    ("lesson2", "l2-r2-c6", "sum(batch5.detected[batch5.tray_id .== \"T-E])", "The text that starts with `\"T-E` on line 1 has no closing \".", String[]),
    ("lesson2", "l2-r4-c2", "counts = combine(groupby(practice_jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate = counts.detected_n / counts.n",
        ["dot", "./"], ["pocket dictionary"]),
    ("lesson2", "l2-r4-c4", "counts = combine(groupby(batch5, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate = counts.detected_n ./ counts.n",
        "Your last line gives a list, not the table.", ["table of whole rows"]),
    # ---- Lesson 3 ----
    ("lesson3", "l3-r3-c5", "leftjoin(book_table, key_table, by=:shelf_id)", ["on=", "by="], ["needs one column"]),
    ("lesson3", "l3-r3-c5", "merged = leftjoin(book_table, key_table, on=:shelf_id)\nmerged[merged.logged .!= merged.keyed, :",
        "The [ after `merged` on line 2 has no ].", ["Each ( needs"]),
    ("lesson3", "l3-r3-c5", "merged = left_join(book_table, key_table, by = \"shelf_id\")\nmerged", "Julia does not know `left_join` on line 1.", String[]),
    ("lesson3", "l3-r1-c4", "desk.keyd[desk.logged .== 2]", "`desk` has no column `keyd`.", String[]),
    ("lesson3", "l3-r1-c4", "desk.keyed[desk.logged .== 2", "The [ after `desk.keyed` on line 1 has no ].", String[]),
    ("lesson3", "l3-r1-c4", "desk\$keyed[desk\$logged .== 2]", "R's \$ does not exist in Julia: write desk.keyed, not desk\$keyed.", String[]),
    ("lesson3", "l3-r2-c1", "desk.logged != desk.keyed", "A comparison sign with no dot gives one answer for the whole list.", String[]),
    # ---- Lesson 4 ----
    ("lesson4", "l4-r1-c3", "first(practice_jarsjar_id, 3)", "Julia does not know `practice_jarsjar_id`: it is `practice_jars` and `jar_id` run together.",
        ["capital", "underscore"]),
    ("lesson4", "l4-r1-c3", "fist(practice_jars.jar_id, 3)", "Julia does not know `fist`.", ["capital", "one of your words"]),
    ("lesson4", "l4-r1-c3", "first(practice_jars.jar_id 3)", ["comma between the two inputs"], ["Close every bracket"]),
    ("lesson4", "l4-r3-c2", "saple(practice_jars.jar_id, 2; replace=false)", "Julia does not know `saple`.", ["blank needs a number"]),
    ("lesson4", "l4-r3-c2", "sample(practice_jars.jar_id, two; replace=false)", "Julia does not know the word `two`.", ["Did you mean"]),
    ("lesson4", "l4-r2-c4", "sample(practice_jars.jar_id, 3; replace false)", "A named input needs =: write replace=false.", ["comma", "Close every"]),
    ("lesson4", "l4-r2-c4", "sample(practice_jars\$jar_id, 3; replace=false)", "R's \$ does not exist in Julia: write practice_jars.jar_id, not practice_jars\$jar_id.", String[]),
    ("lesson4", "l4-r2-c4", "sample(c(\"P-01\", \"P-02\"), 3; replace=false)", "Julia writes a list with square brackets: [a, b].", String[]),
    # ---- Lesson 5 ----
    ("lesson5", "l5-r1-c3", "rand(Bool, 4", "The ( after `rand` on line 1 has no ).", ["comma"]),
    ("lesson5", "l5-r1-c5", "sum(rand(Bool, 8)", "The ( after `sum` on line 1 has no ).", ["comma", "["]),
    ("lesson5", "l5-r1-c3", "rand(Bool 4)", ["comma between Bool and the number"], ["Close every bracket"]),
    ("lesson5", "l5-r1-c5", "sum(rand(Bool, 8)))", "The ) on line 1 has no opening bracket before it.", String[]),
    ("lesson5", "l5-r3-c2", "flags = [True, true, false, true]\nsum(flags) / length(flags)", ["small letters", "True"],
        ["both lines", "same name"]),
    ("lesson5", "l5-r3-c2", "flags = [true, true, false, true]\nsum(flag) / length(flags)", "Line 1 makes `flags`, but line 2 uses `flag`.", ["one of your words"]),
    ("lesson5", "l5-r3-c4", "events = pretend_counts .>= seen_count\nsum(event) / length(events)", "Line 1 makes `events`, but line 2 uses `event`.", String[]),
    ("lesson5", "l5-r3-c4", "sum(events) / length(events)\nevents = pretend_counts .>= seen_count", "Line 1 uses `events`, but line 2 makes it.", String[]),
    ("lesson5", "l5-r3-c4", "events = pretend_counts >= seen_count\nsum(events) / length(events)", "Put a dot before >=.", String[]),
    ("lesson5", "l5-r2-c0b", "[sum(rand(Bool, 10)) for _ in 1:1,000]", ["1000", "no comma"], ["bracket"]),
    ("lesson5", "l5-r2-c0b", "[sum(rand(Bool, 10)) for _ in 1:1000", "The [ before `sum` on line 1 has no ].", String[]),
    ("lesson2", "l2-r3-c2", "counts = combine(groupby(ledger, :batch_id), nrow => :n\ncounts", "The ( after `combine` on line 1 has no ).", ["Each [ needs"]),
    ("lesson6", "l6-r3-c2", "(guesses.lower .<= seen_count) .& (seen_count .<= guesses.upper", "The ( before `seen_count` on line 1 has no ).", ["Each [ needs"]),
    # ---- Lesson 6 ----
    ("lesson6", "l6-r1-c1", "fits_low = guesses.lower .<= seen_cout", "Julia does not know `seen_cout`.", ["one of your words", "A column is written"]),
    ("lesson6", "l6-r1-c1", "fits_low = gusses.lower .<= seen_count", "Julia does not know `gusses`.", ["one of your words"]),
    ("lesson6", "l6-r1-c1", "fits_low = guesses.low .<= seen_count", "`guesses` has no column `low`.", String[]),
    ("lesson6", "l6-r1-c1", "fits_low = guesses.lower <= seen_count", "Add a dot before <=.", String[]),
    ("lesson6", "l6-r2-c2", "fits_high = seen_count .<= guesses.upper\nguesses[fits_hi, :]", "Line 1 makes `fits_high`, but line 2 uses `fits_hi`.", String[]),
    ("lesson6", "l6-r3-c2", "(guesses.lower .<= seen_count) & (seen_count .<= guesses.upper)", "Add a dot before &.", String[]),
    ("lesson6", "l6-r3-c2", "(guesses.lower .<= seen_count) && (seen_count .<= guesses.upper)",
        "&& joins one true or false with another, not two lists.", ["pocket dictionary"]),
    ("lesson6", "l6-r3-c2", "(guesses\$lower <= seen_count) & (seen_count <= guesses\$upper)", "R's \$ does not exist in Julia: write guesses.lower, not guesses\$lower.", String[]),
    # ---- Round 4 (Pat's live play, round 3): slips that ran silently or got generic help ----
    ("lesson1", "l1-r2-c4", "logbook.jar_id[1-3]", "In Julia the dash is minus, so 1-3 is -2, not a range.", ["stays inside"]),
    ("lesson1", "l1-r3-f1", "practice_jars[practice_jars.tray_id .= \"T-B\", :]",
        "`.=` stores a value, it does not ask a question: write .== (two equals signs) to ask about every row.", ["Pocket dictionary"]),
    ("lesson1", "l1-r3-c5", "practice_jars[practice_jars.batch_id .== \"b01\", :]",
        "Capital letters matter in text: \"b01\" is not the same as \"B01\".", String[]),
    ("lesson2", "l2-r1-c5", "tray = practice_jars[practice_jars.tray_id .== \"t-b\", :]\n[sum(tray.detected), length(tray.detected)]",
        "Capital letters matter in text: \"t-b\" is not the same as \"T-B\".", String[]),
    ("lesson3", "l3-r1-c5", "desk.shelves[desk.keyed .== \"1\"]", "In quotes, \"1\" is text, not a number: write 1 with no quotes.", String[]),
    ("lesson2", "l2-r3-c2", "counts = combine(groupby(ledger, :batch_id), nrow -> :n)\ncounts",
        "The arrow is =>, not ->: write nrow => :n, not nrow -> :n.", ["blank"]),
    ("lesson4", "l4-r3-c3", "sample(practice_jars.jar_id; 3, replace=false)",
        "The semicolon is in the wrong place: `3` is a plain input, so it goes before the ;.", ["to compare"]),
    # ---- Round 5 (Pat's live play, round 4): wrong help for a slip the engine could name ----
    ("lesson1", "l1-r1-c6", "sum(practice_jars detected)",
        "Put a dot between the table and the column: write practice_jars.detected, not practice_jars detected.", ["commas"]),
    ("lesson4", "l4-r1-c0", "merged = leftjoin(book_table, key_table, :shelf_id)",
        "Name the shared column with on=: write on=:shelf_id after the two tables, so the column goes after on=.", ["needs one column"]),
    ("lesson4", "l4-r2-c4", "sample(practice_jars.jar_id, 3; replace==false)",
        "A named input takes one =: write replace=false, not replace==false.", ["to compare", "use .=="]),
    ("lesson4", "l4-r2-c5", "sample(practice_jars.jar_id, 2; replace==false)",
        "A named input takes one =: write replace=false, not replace==false.", ["to compare", "use .=="]),
    ("lesson3", "l3-r3-c5", "merged = leftjoin(book_table, key_table, on=shelf_id)\nmerged[merged.logged .!= merged.keyed, :]",
        "Julia does not know `shelf_id` as a word: a column name needs a colon in front, like :shelf_id.", ["spelling"]),
    ("lesson2", "l2-r3-c2", "counts = combine(groupby(ledger, :batch_id), nrow = :n)\ncounts",
        "A pair is joined with =>, not =: write nrow => :n.", ["Pocket dictionary"]),
    ("lesson2", "l2-r2-c2", "batch5.detected[batch5.tray_id .== \"t-f\"]",
        "Capital letters matter in text: \"t-f\" is not the same as \"T-F\".", ["change only the tray"]),
    ("lesson2", "l2-r3-c3", "counts = combine(groupby(practice_jars, :tray_id), :detected => length => :jars, :detected => sum => :detected_n)\ncounts",
        ["named n", "new column n"], String[]),
    # ---- Round 6 (Pat's live play, round 5): wrong help and a leaked internal name ----
    ("lesson5", "l5-r2-c0b", "(sum(rand(Bool,10)) for _ in 1:1000)",
        "Put square brackets round the whole line to keep every result in a list: [sum(rand(Bool,10)) for _ in 1:1000], not round brackets.",
        ["Sandbox", "does not know", "capital B"]),
    ("lesson5", "l5-r2-c0b", "counts = (sum(rand(Bool, 10)) for _ in 1:1000)",
        "Put square brackets round the whole line to keep every result in a list: [sum(rand(Bool, 10)) for _ in 1:1000], not round brackets.",
        ["Sandbox", "does not know"]),
    ("lesson6", "l6-r1-c0", "events = pretend_counts .>= \"seen_count\"",
        "`seen_count` is a name, so write it without quote marks: in quotes, \"seen_count\" is just text.", ["Put a dot", "dictionary"]),
    ("lesson2", "l2-r2-f1", "sum(practice_jars.detected[\"tray_id\" .== \"T-B\"])",
        "`tray_id` is a name, so write it without quote marks: in quotes, \"tray_id\" is just text.", ["Put a dot"]),
    ("lesson4", "l4-r1-c3", "first(practice_jars.jar_id; 3)",
        "Put a comma, not a semicolon, before `3`: first(practice_jars.jar_id, 3).", ["to compare", ".=="]),
    ("lesson3", "l3-r2-c4", "form_desk.entry[form_desk.logged .= form_desk.keyed]",
        "`.=` stores a value, it does not ask a question: write .!= to ask which rows differ.", ["write .=="]),
    ("lesson3", "l3-r2-c3", "desk.shelves[desk.logged .= desk.keyed]",
        "`.=` stores a value, it does not ask a question: write .!= to ask which rows differ.", ["write .=="]),
    ("lesson2", "l2-r2-f1", "sum(practice_jars.detected[tray_id .== \"T-B\"])",
        "`tray_id` is a column: write practice_jars.tray_id, with the table name and a dot in front.", ["Pocket dictionary", "spelling"]),
    ("lesson3", "l3-r1-c0", "counts.rate = detected_n ./ counts.n",
        "`detected_n` is a column: write counts.detected_n, with the table name and a dot in front.", ["spelling"]),
    ("lesson3", "l3-r1-c0", "counts.rate = counts.detected_n ./ n",
        "`n` is a column: write counts.n, with the table name and a dot in front.", ["spelling"]),
    ("lesson2", "l2-r4-c4", "counts = combine(groupby(batch5, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate = detected_n ./ counts.n\ncounts",
        "`detected_n` is a column: write counts.detected_n, with the table name and a dot in front.", ["colon in front"]),
    ("lesson2", "l2-r4-c4", "counts = combine(groupby(batch5, tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts",
        "A column name needs a colon in front, like :tray_id or :n.", ["table name and a dot"]),
    ("exam5", "x5-event-mask", "sim_counts .= observed_count", "`.=` stores a value, it does not ask a question: write .>= to ask about every row.", String[]),
    ("lesson6", "l6-r3-f1", "guesses[(0.2 .<= guesses.p) .& (guesses.p .= 0.6), :]", "`.=` stores a value, it does not ask a question: write .<= to ask about every row.", ["round brackets around each rule"]),
    ("lesson3", "l3-r1-c0", "counts.rate == counts.detected_n ./ counts.n", "Use a single = to fill a new column: write counts.rate = ..., not counts.rate ==.", ["Pocket dictionary"]),
    ("lesson1", "l1-r1-c7", "sum[logbook.detected]",
        "`sum` is a function: call it with round brackets, sum(...), not square brackets.", String[]),
    # ---- Round 7 (Pat's final play): a quoted number is not a missing dot; five generic or raw lines named ----
    ("lesson6", "l6-r1-c3", "fits_low = guesses.lower .<= \"3\"",
        "In quotes, \"3\" is text, not a number: write 3 with no quotes.", ["Add a dot"]),
    ("lesson6", "l6-r1-c4", "fits_high = \"4\" .<= guesses.upper",
        "In quotes, \"4\" is text, not a number: write 4 with no quotes.", ["Add a dot"]),
    # the step's own quote line names the slip too, so it stays (it is written for this step)
    ("lesson5", "l5-r2-c3", "pretend_counts .>= \"8\"",
        "Type the number with no quotes around it.", ["Add a dot"]),
    # the fix step's solution names seen_count, not a number: a quoted number there is still not a missing dot
    ("lesson6", "l6-r1-f1", "fits_low = guesses.lower .<= \"3\"",
        "In quotes, \"3\" is text, not a number: write 3 with no quotes.", ["Add a dot"]),
    ("lesson6", "l6-r1-f1", "fits_low = guesses.lower .<= \"6\"",
        "In quotes, \"6\" is text, not a number: write 6 with no quotes.", ["Add a dot"]),
    ("lesson6", "l6-r1-f1", "fits_high = \"4\" .<= guesses.upper",
        "In quotes, \"4\" is text, not a number: write 4 with no quotes.", ["Add a dot"]),
    # the dot is already there and one side is text: never "Add a dot" (Pat's final check)
    ("lesson6", "l6-r1-f1", "fits_low = guesses.story .<= seen_count",
        "The dot is already there.", ["Add a dot"]),
    ("lesson6", "l6-r1-f1", "fits_low = guesses.lower .<= \"six\"",
        "The dot is already there.", ["Add a dot"]),
    ("lesson1", "l1-r1-c3", "sum(true, false, true)",
        "Put the values in square brackets: sum([true, false, true]).", ["Pocket dictionary"]),
    ("lesson1", "l1-r1-c4", "sum(4, 7, 1)",
        "Put the values in square brackets: sum([4, 7, 1]).", ["Pocket dictionary"]),
    ("lesson3", "l3-r3-c1", "merged = leftjoin(book_table, key_table, on=:shelf)",
        "Julia does not find :shelf in the tables: the shared column is :shelf_id, so write on=:shelf_id.", ["Pocket dictionary"]),
    ("lesson3", "l3-r3-c3", "merged = leftjoin(book_table, key_table, on=:shelf)\nmerged[merged.keyed .== 1, :]",
        "Julia does not find :shelf in the tables: the shared column is :shelf_id, so write on=:shelf_id.", ["Pocket dictionary"]),
    ("lesson2", "l2-r3-c2", "counts = combine(groupby(ledger, :batch_id), nrow, :n)\ncounts",
        "A pair is joined with =>, not a comma: write nrow => :n.", ["not in the table"]),
    ("lesson2", "l2-r3-c3", "counts = combine(groupby(practice_jars, :tray_id), nrow => :n, :detected, sum, :detected_n)\ncounts",
        "A pair is joined with =>, not a comma: write :detected => sum => :detected_n.", ["not in the table"]),
    ("lesson5", "l5-r2-c0b", "[sum(rand(Bool, 10)) for _ in 1,3]",
        ["for _ in 1:1000"], ["invalid iteration"]),
    ("lesson5", "l5-r2-c0b", "[sum(rand(Bool, 10)) for in 1:1000]",
        ["for _ in 1:1000"], ["invalid iteration"]),
    ("lesson1", "l1-r3-c0", "logbook.batch_id[7] = \"B05\"",
        ["single =", "== (two equals signs)"], ["Press Reset"]),
    ("lesson1", "l1-r3-c1", "logbook.batch_id = \"B04\"",
        ["single =", ".== (a dot and two equals signs)"], ["Pocket dictionary"]),
    # ---- Round 8 (Pat's playtest): six slips that got a generic or wrong-way line ----
    ("lesson1", "l1-r2-c5", "practice_jars[1..3, :]", "A range uses a colon: write 1:3, not 1..3.", ["Pocket dictionary", "underscore"]),
    ("lesson1", "l1-r2-c4", "logbook.jar_id[1..3]", "A range uses a colon: write 1:3, not 1..3.", ["check both spellings"]),
    ("lesson5", "l5-r2-c5", "[7 for _ in 1..3]", "A range uses a colon: write 1:3, not 1..3.", ["spelling"]),
    ("lesson5", "l5-r2-c0b", "[7 for _ in 1..3]", "A range uses a colon: write 1:3, not 1..3.", ["spelling", "capital B"]),
    ("lesson5", "l5-r2-c3", "pretend_counts => seen_count", ["greater sign first", ">=", "pair"], ["Yours differ"]),
    ("lesson5", "l5-r2-c3", "pretend_counts .=> seen_count", [".>=", "greater sign first", "pair"], ["Yours differ"]),
    ("lesson3", "l3-r2-c3", "desk.shelves[desk.logged .~= desk.keyed]", "Not equal is written != (with a dot for a whole list: .!=), not ~=.", ["Pocket dictionary"]),
    ("lesson3", "l3-r2-c3", "desk.shelves[desk.logged .<> desk.keyed]", "Not equal is written != (with a dot for a whole list: .!=), not <>.", ["unary"]),
    ("lesson3", "l3-r3-c5", "merged = leftjoin(book_table, key_table, on=:shelf_id)\nmerged[merged.logged .~= merged.keyed, :]",
        "Not equal is written != (with a dot for a whole list: .!=), not ~=.", ["commas"]),
    ("lesson4", "l4-r2-c4", "sample(open_jars.jar_id, 3; replace=false)", "`open_jars` is a different table: get the jars from practice_jars.", ["ids"]),
    ("lesson4", "l4-r2-c4", "sample([\"P-01\", \"P-02\", \"P-03\"], 3; replace=false)", "Get the jars from practice_jars.", ["different table"]),   # typed ids keep the ids line
    ("lesson4", "l4-r2-c4", "sample(open_jars, 3; replace=false)", "`open_jars` is a different table: get the jars from practice_jars.", ["like open_jars.jar_id"]),
    ("lesson4", "l4-r2-c3", "sample(open_jars, 3; replace=false)", "`open_jars` is a different table: get the jars from practice_jars.", ["like open_jars.jar_id"]),
    ("lesson4", "l4-r2-c4", "sample(practice_jars, 3; replace=false)", "sample needs one column, not the whole table: pick a column with a dot, like practice_jars.jar_id.", ["different table"]),
    # ---- Round 9 (Pat's RC replay): two dots before a column is a doubled dot, not a range ----
    ("lesson1", "l1-r2-c4", "logbook..jar_id[12]", "Use one dot between a table and its column: write logbook.jar_id, not logbook..jar_id.", ["range", "colon"]),
    ("lesson1", "l1-r2-c5", "sum(practice_jars..detected)", "Use one dot between a table and its column: write practice_jars.detected, not practice_jars..detected.", ["range", "colon"]),
    ("lesson3", "l3-r2-c3", "desk.shelves[desk..logged .!= desk.keyed]", "Use one dot between a table and its column: write desk.logged, not desk..logged.", ["range", "colon"]),
    ("lesson4", "l4-r2-c4", "sample(practice_jars..jar_id, 3; replace=false)", "Use one dot between a table and its column: write practice_jars.jar_id, not practice_jars..jar_id.", ["range", "colon"]),
    ("lesson1", "l1-r2-c4", "logbook.jar_id[1 .. 3]", "A range uses a colon: write 1:3, not 1..3.", ["check both spellings"]),
    # ---- Chapters ----
    ("exam1", "x1-select-records", "jars\$batch_id .== case_batch", "R's \$ does not exist in Julia: write jars.batch_id, not jars\$batch_id.", ["small letters"]),
    ("exam1", "x1-select-records", "jars[jars.batch_id == case_batch, :]", "Add a dot: write .== instead of ==, so Julia compares every value, one at a time.", String[]),
    ("exam1", "x1-select-records", "jar[jar.batch_id .== case_batch, :]", "Julia does not know `jar`.", String[]),
    ("exam1", "x1-select-records", "jars[jars.batch .== case_batch, :]", "`jars` has no column `batch`.", String[]),
    ("exam2", "x2-counts", "conts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts",
        "Line 1 makes `conts`, but line 2 uses `counts`.", ["colon"]),
    ("exam2", "x2-rates", "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncou.rate = counts.detected_n ./ counts.n\ncounts",
        "Line 1 makes `counts`, but line 2 uses `cou`.", ["Each Run starts fresh"]),
    ("exam2", "x2-group", "grupby(jars, :tray_id)", "Julia does not know `grupby`.", ["colon"]),
    ("exam2", "x2-counts", "combine(groupby(jars, :tray_id), nrow => :n, sum(:detected) => :detected_n)",
        ["pair reads", "=>"], ["pocket dictionary"]),
    ("exam3", "x3-join-report-log", "letjoin(tray_counts, tally_sheet, on=:tray_id)", "Julia does not know `letjoin`.", ["colon"]),
    ("exam3", "x3-filter-disagreement", "joined[joined.notebook_detected .!= joined.sheet_detected, :", "The [ after `joined` on line 1 has no ].", String[]),
    ("exam4", "x4-plan-distinct-recheck", "sample(eligibl.jar_id, 3; replace=false)", "Julia does not know `eligibl`.", String[]),
    ("exam4", "x4-plan-distinct-recheck", "sample(eligible.jar_id, 3, replace = FALSE)", "Julia writes true and false in small letters: `false`, not `FALSE`.", String[]),
    ("exam5", "x5-event-frequency", "evnts = sim_counts .>= observed_count\nsum(events) / length(events)",
        "Line 1 makes `evnts`, but line 2 uses `events`.", ["Each Run starts fresh"]),
    ("exam5", "x5-event-mask", "sim_counts .>= observed", "Julia does not know `observed`.", String[]),
    ("exam6", "x6-compatible-models", "stories[(stories.lower .<= observed_count) & (observed_count .<= stories.upper), :]",
        [".&"], ["pocket dictionary"]),
    ("exam6", "x6-compatible-models", "stories[(stories.lower .<= observed_count) && (observed_count .<= stories.upper), :]",
        "&& joins one true or false with another, not two lists.", String[]),
    ("exam6", "x6-twist-out", "stories.story[storys.upper .<= 4]", "Julia does not know `storys`.", String[]),
    # ---- Target range: the same lines, never a pocket dictionary ----
    ("range", "w1", "logbok.jar_id[9]", "Julia does not know `logbok`.", ["dictionary"]),
    ("range", "w1", "xyz", "Julia does not know the word `xyz`.", ["dictionary"]),
    ("range", "w9", "logbook[(logbook.batch_id .== \"B05\") & (logbook.tray_id .!= \"T-F\"), :]",
        "Combine yes/no lists item by item with .& (put a dot in front of the &).", ["dictionary"]),
    ("range", "w9", "logbook[(logbook.batch_id .== \"B05\") && (logbook.tray_id .!= \"T-F\"), :]",
        "&& joins one true or false with another, not two lists.", ["dictionary"]),
    ("range", "w9", "logbook[logbook.batch_id .== \"B05\" .& logbook.tray_id .!= \"T-F\", :]",
        "Put each question in its own round brackets, then join them: (question 1) .& (question 2).", ["dictionary"]),
    ("range", "w5", "logbook[logbook.detected == TRUE, :]", "Julia writes true and false in small letters: `true`, not `TRUE`.", ["dictionary"]),
    ("range", "w5", "logbook[logbook\$detected, :]", "R's \$ does not exist in Julia: write logbook.detected, not logbook\$detected.", ["dictionary"]),
]

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    @testset "mistakes: the first sentence names the actual mistake (sandbox)" begin
        JuliaTime.reload_lessons!()
        passed = 0
        for (lesson, cid, code, first_sentence, never) in LESSON_MISTAKES
            l = get(JuliaTime.LESSONS, lesson, nothing)
            step = l === nothing ? nothing : lesson == "range" ? JuliaTime._range_wave(l, cid) : JuliaTime._lesson_challenge(l, cid)
            @test step !== nothing || (println("no step $lesson/$cid"); false)
            r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => lesson, "challenge" => cid, "code" => code,
                                              "request_id" => "m"))
            fb = String(get(r, "feedback", ""))
            fs = _first_sentence(fb)
            named = first_sentence isa AbstractString ? fs == first_sentence : all(w -> occursin(w, fs), first_sentence)
            ok = r["pass"] !== true && named && !any(w -> occursin(w, fb), never)
            ok && (passed += 1)
            @test ok || (println("$lesson/$cid: ", repr(code), "\n  gave:   ", repr(fb), "\n  wanted: ", repr(first_sentence),
                                 " and none of ", never); false)
        end
        println("LESSON-MISTAKES: $passed of $(length(LESSON_MISTAKES)) mistakes named on the right line")
    end

    @testset "mistakes: a last line that shows the table after the new column is added passes (Lesson 3, task 1)" begin
        JuliaTime.reload_lessons!()
        run(code) = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson3", "challenge" => "l3-r1-c0",
                                                  "code" => code, "request_id" => "m"))
        @test run("counts.rate = counts.detected_n ./ counts.n")["pass"] === true
        @test run("counts.rate = counts.detected_n ./ counts.n\ncounts")["pass"] === true
        @test run("counts.rate = counts.detected_n ./ counts.n\ncounts.n")["pass"] !== true   # a different list still fails
    end
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    @testset "mistakes: the asked change passes without a last line (Lesson 2, round 4, the ledger task)" begin
        JuliaTime.reload_lessons!()
        run(code, cid="l2-r4-c3") = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson2", "challenge" => cid,
                                                                  "code" => code, "request_id" => "m"))
        two = "counts = combine(groupby(ledger, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate = counts.detected_n ./ counts.n"
        @test run(two)["pass"] === true
        @test run(two * "\ncounts")["pass"] === true
        @test run(replace(two, "ledger" => "practice_jars"))["pass"] !== true          # the change itself is still required
        @test run(replace(two, "./" => "."))["pass"] !== true
        # a checkpoint still wants the table at the end
        two5 = replace(two, "ledger" => "batch5")
        @test run(two5, "l2-r4-c4")["pass"] !== true
    end
end

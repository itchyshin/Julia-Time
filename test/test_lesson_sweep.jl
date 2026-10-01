using Test, JuliaTime

# The beginner-slip sweep (round 5, Help; the Rose principle: one wrong message means ten more). For every typed task in
# Lessons 1 to 6 and Chapters 1 to 6's exams (write, fix, complete, change, checkpoint), the standard slips are made from
# the task's OWN solution (a dot lost before == or a column, a quote lost, a text in the wrong case, = for ==, == for a
# named input's =, -> for =>, = for =>, a dash for a range colon, a missing colon, comma or closing bracket, a misspelt
# name, True/TRUE, R's $ and <-), each is run through the real judge in the real sandbox, and the message must name THAT
# slip (or be the honest generic line, for the few kinds where no better line exists). The makers and the judge of a
# message are in test/lesson_sweep.jl. The sandbox part runs with JULIATIME_INTEGRATION=1.

include("lesson_sweep.jl")

@testset "sweep: no message names what the player did not type (pure)" begin
    @test isempty(sweep_leaks("`sum` is a function: call it with round brackets.", "sum[xs]", "lesson1"))
    @test sweep_leaks("Julia does not know the word `Sandbox`.", "(x for x in 1:3)", "lesson5") == ["Sandbox"]
    @test "UndefVarError" in sweep_leaks("UndefVarError: no.", "x", "lesson1")
end

@testset "sweep: the slip makers (pure)" begin
    sol = "counts = combine(groupby(ledger, :batch_id), nrow => :n)\ncounts.rate = counts.detected_n ./ counts.n\nsample(x.jar_id, 3; replace=false)[1:3]"
    slips = sweep_slips(sol)
    kinds = Set(s.cls for s in slips)
    for k in ("no_dot_div", "no_dot_col", "no_dot_col_glued", "dollar", "eqeq_named", "name_drop", "r_arrow", "arrow", "pair_eq",
              "range_dash", "colon_drop", "comma_drop", "semi_for_comma", "close_drop", "misspell_name", "misspell_column", "capital_name")
        @test k in kinds
    end
    # Round 6 kinds
    sol6 = "counts = [sum(rand(Bool, n_cards)) for _ in 1:1000]\nfirst(desk.keyed[desk.logged .!= desk.keyed], 3)\ncounts.rate = counts.detected_n ./ counts.n"
    s6 = sweep_slips(sol6)
    @test any(s -> s.cls == "paren_for_square" && occursin("(sum(rand(Bool, n_cards)) for _ in 1:1000)", s.code), s6)
    @test any(s -> s.cls == "square_for_round" && s.from == "sum" && occursin("sum[rand", s.code), s6)
    @test any(s -> s.cls == "round_for_square" && s.from == "desk.keyed" && occursin("desk.keyed(desk.logged", s.code), s6)
    @test any(s -> s.cls == "quoted_name" && s.from == "n_cards" && occursin("\"n_cards\"", s.code), s6)
    @test any(s -> s.cls == "semi_positional" && occursin("; 3)", s.code), s6)
    @test any(s -> s.cls == "no_table_prefix" && s.from == "desk.keyed" && occursin("first(keyed[", s.code), s6)
    @test any(s -> s.cls == "dot_assign" && s.from == "!=" && occursin("desk.logged .= desk.keyed", s.code), s6)
    @test any(s -> s.cls == "eqeq_assign_col" && occursin("counts.rate == counts", s.code), s6) &&
          any(s -> s.cls == "eqeq_assign_col" && occursin("counts.rate .== counts", s.code), s6)
    @test !any(s -> s.cls == "no_table_prefix" && s.from == "counts.rate", s6)   # the left of an assignment keeps its table
    # Round 7 kinds: a number in quotes, bare list values, a spoilt repeat line, a short join column, a comma for =>
    sol7 = "merged = leftjoin(book_table, key_table, on=:shelf_id)\nfits = guesses.lower .<= 3\nsum([4, 7, 1])\n[sum(rand(Bool, 10)) for _ in 1:1000]\ncombine(g, nrow => :n)\nx = 0.5"
    s7 = sweep_slips(sol7)
    @test any(s -> s.cls == "quoted_number" && s.from == "3" && occursin(".<= \"3\"", s.code), s7)
    @test any(s -> s.cls == "quoted_number" && s.from == "0.5" && occursin("x = \"0.5\"", s.code), s7)
    @test !any(s -> s.cls == "quoted_number" && occursin("rand(Bool, \"10\"", s.code) && s.from != "10", s7)
    @test any(s -> s.cls == "list_unbracketed" && occursin("sum(4, 7, 1)", s.code), s7)
    @test any(s -> s.cls == "for_name_drop" && occursin("for in 1:1000", s.code), s7)
    @test any(s -> s.cls == "for_range_comma" && occursin("for _ in 1,1000", s.code), s7)
    @test any(s -> s.cls == "join_col_short" && occursin("on=:shelf)", s.code) && s.from == "shelf_id", s7)
    @test any(s -> s.cls == "pair_comma" && occursin("nrow, :n", s.code) && s.from == "nrow", s7)
    @test all(s -> s.code != sol, slips)
    @test any(s -> s.cls == "eqeq_named" && occursin("replace==false", s.code), slips)
    @test any(s -> s.cls == "name_drop" && occursin("; false)", s.code), slips)
    @test any(s -> s.cls == "range_dash" && occursin("[1-3]", s.code), slips)
    @test any(s -> s.cls == "arrow" && occursin("nrow -> :n", s.code), slips)
    @test any(s -> s.cls == "no_dot_col" && occursin("counts rate", s.code), slips)
    # a quote inside text is not code: nothing in a string is dotted, commented or misspelt
    q = sweep_slips("logbook[logbook.batch_id .== \"B05, x.y\", :]")
    @test !any(s -> occursin("x y", s.code) || occursin("xy", s.code) || s.cls == "comma_drop" && occursin("B05 x", s.code), q)
    @test any(s -> s.cls == "case_text" && occursin("\"b05, x.y\"", s.code), q)
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    @testset "sweep: every beginner slip gets a line that names it (sandbox)" begin
        tasks = sweep_tasks()
        @test length(tasks) >= 85
        counts = Dict{Symbol, Int}()
        bad = Any[]
        total = 0
        for (lesson, cid, sol) in tasks, slip in sweep_slips(sol)
            total += 1
            pass, fb = sweep_run(lesson, cid, slip.code)
            v = pass ? :passed : sweep_judge(slip, lesson, cid, fb)
            counts[v] = get(counts, v, 0) + 1
            v in (:wrong, :missed) && push!(bad, (lesson, cid, slip.cls, slip.code, fb))
            leaks = sweep_leaks(fb, slip.code, lesson)
            isempty(leaks) || push!(bad, (lesson, cid, slip.cls, slip.code, "LEAK $(leaks): $fb"))
            # a slip that passes must not be one the pass line then calls right: these change what the task asks for
            # (a number in quotes inside length([...]) still counts the same items, so that one is an honest pass)
            if pass && !(slip.cls == "quoted_number" && occursin("length([", sol)) && slip.cls in ("no_dot_cmp", "no_dot_col", "no_dot_col_glued", "dollar", "eqeq_named", "arrow", "pair_eq", "case_text", "quote_drop", "quote_both",
                                  "dot_assign", "quoted_name", "quoted_number", "pair_comma", "paren_for_square", "square_for_round", "round_for_square",
                                  "semi_positional", "eqeq_assign_col")
                push!(bad, (lesson, cid, slip.cls, slip.code, "PASSED: $fb"))
            end
        end
        for (l, c, k, code, fb) in bad
            println("$l/$c [$k] ", repr(code), "\n  gave: ", repr(fb))
        end
        println("LESSON-SWEEP: $total slips from $(length(tasks)) typed tasks: ",
                join(["$k $(counts[k])" for k in sort(collect(keys(counts)))], ", "))
        @test total >= 2200
        @test isempty(bad)
    end
end

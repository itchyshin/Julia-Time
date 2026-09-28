using Test
using DataFrames

# Round 4 night playtest (2026-09-27): r4-python.md, r4-bugs.md items 4, 6 and 7, r4-audit.md
# item 8. Python habits get one plain line naming the Julia form; C1 names R's <-; C5 shows what
# Julia really returned and praises only what the code did; C6 no longer tells bracketed code to
# add brackets. Coaching is only ever computed for a failed run.

r4_c1_request(code) = Dict{String, Any}("request_id" => "r4-c1", "code" => code)
r4_c5_request(move_id, code) = c5_run_request(move_id, code, "c5-simulated-counts-v1"; request_id="r4-c5")
py(code; kw...) = JuliaTime._mystery_python_note(code; kw...)

@testset "Round 4 Python-habit and chapter repairs" begin
    @testset "each Python habit gets its line" begin
        @test py("print(jars[jars.batch_id .== case_batch, :])") == JuliaTime.MYSTERY_PY_PRINT_LINE
        @test py("x = jars[1:3, :]\nprintln(x)") == JuliaTime.MYSTERY_PY_PRINT_LINE
        @test py("import pandas as pd\njars.groupby(\"tray_id\")") == JuliaTime.MYSTERY_PY_IMPORT_LINE
        @test py("import random\nrandom.sample(list(eligible.jar_id), 3)") == JuliaTime.MYSTERY_PY_IMPORT_LINE
        @test py("from random import sample\nsample(eligible.jar_id, 3)") == JuliaTime.MYSTERY_PY_IMPORT_LINE
        @test py("jars[0:3, :]") == JuliaTime.MYSTERY_PY_ZERO_LINE
        @test py("sim_counts[0]") == JuliaTime.MYSTERY_PY_ZERO_LINE
        @test py("jars[1:3, :]"; message="BoundsError: attempt to access 12×4 DataFrame at index [0:3, :]") ==
              JuliaTime.MYSTERY_PY_ZERO_LINE
        @test py("sum(events) / len(events)") == JuliaTime.MYSTERY_PY_LEN_LINE
        @test occursin("capital F", py("sample(eligible.jar_id, 3, replace=False)"))
        @test startswith(py("sample(eligible.jar_id, 3; replace=False)"), "Julia writes true and false in small letters")
        @test occursin("capital T", py("jars[jars.detected .== True, :]"))
        @test py("joined[not (joined.notebook_detected .== joined.sheet_detected), :]") == JuliaTime.MYSTERY_PY_NOT_LINE
        quotes = py("jars[jars['batch_id'] == 'B09']")
        @test startswith(quotes, "In Julia, text goes in double quotes: \"batch_id\".")
        @test occursin("Single quotes are for one character.", quotes)
        loop = py("marks = []\nfor c in sim_counts:\n    marks.append(c >= 5)"; way=".>= marks every round at once.")
        @test occursin("end", loop) && occursin("push!", loop) && occursin(".>= marks every round at once.", loop)
        @test !occursin("push!", py("x = 0\nfor c in sim_counts:\n    if c >= 5:\n        x += 1"))
        @test occursin("no loop", py("x = 0\nfor c in sim_counts:\n    if c >= 5:\n        x += 1"))
        @test py("jars.head(3)") == JuliaTime.MYSTERY_PY_HEAD_LINE
        @test py("sum(events) // length(events) + 1"; message="ArgumentError: invalid index: 113//1000 of type Rational{Int64}") == JuliaTime.MYSTERY_PY_FRACTION_LINE
        @test occursin("leftjoin", py("pd.merge(tray_counts, tally_sheet, on='tray_id')"))
        @test occursin("leftjoin", py("tray_counts.merge(tally_sheet, on=\"tray_id\", how=\"left\")"))
    end

    @testset "import comes first; at most two lines" begin
        both = py("import pandas as pd\nprint(jars.head(3))")
        @test startswith(both, JuliaTime.MYSTERY_PY_IMPORT_LINE)
        @test occursin(JuliaTime.MYSTERY_PY_PRINT_LINE, both)
        @test !occursin(JuliaTime.MYSTERY_PY_HEAD_LINE, both)
    end

    @testset "no Python line on Julia code" begin
        for code in ("jars[jars.batch_id .== case_batch, :]",
                     "using Random\nsample(eligible.jar_id, 3; replace=false)",
                     "import Random\nsample(eligible.jar_id, 3; replace=false)",
                     "using Random, Distributions",
                     "x = [0, 1, 2]\nx[1]",
                     "isTrue = true; notes = 1; lens = length(jars.jar_id)",
                     "# print(x), import pandas, len(x), True, not x, 'B09'\njars[1:3, :]",
                     "x = \"print(len(True)) 'B09' [0] // not a\"\nx",
                     "c = 'B'\nfor i in 1:3\n    println(i)\nend\ni = 2",
                     "x'",
                     "a = rand(3)'",
                     "sum(events) / length(events)",
                     "first(jars, 3)",
                     "leftjoin(tray_counts, tally_sheet, on=:tray_id)",
                     JuliaTime.MYSTERY_C6_TAUGHT,
                     JuliaTime.MYSTERY_C5_TAUGHT)
            @test py(code) == ""
        end
    end

    @testset "Python lines name Julia that runs" begin
        # AGENTS.md rule 3: the Julia forms named in the lines must be valid.
        df = DataFrame(a=1:5)
        @test nrow(first(df, 3)) == 3
        @test push!(Int[], 1) == [1]
        @test 113 // 1000 isa Rational
    end

    @testset "C1: R's <- and Python habits reach coaching and feedback" begin
        JuliaTime.warmup!()
        try
            arrow = JuliaTime.mystery_case_run(r4_c1_request("jars <- jars[jars.batch_id .== case_batch, :]\njars"))
            @test arrow["pass"] == false
            @test arrow["coaching"] == JuliaTime.MYSTERY_R_ARROW_LINE
            @test arrow["feedback"] == arrow["coaching"]
            printed = JuliaTime.mystery_case_run(r4_c1_request("print(jars[jars.batch_id .== case_batch, :])"))
            @test printed["pass"] == false
            @test printed["coaching"] == JuliaTime.MYSTERY_PY_PRINT_LINE
            @test printed["feedback"] == printed["coaching"]
            zero = JuliaTime.mystery_case_run(r4_c1_request("jars[0:3, :]"))
            @test zero["coaching"] == JuliaTime.MYSTERY_PY_ZERO_LINE
            quotes = JuliaTime.mystery_case_run(r4_c1_request("jars[jars.batch_id .== 'B09', :]"))
            @test startswith(quotes["coaching"], "In Julia, text goes in double quotes: \"B09\".")
            right = JuliaTime.mystery_case_run(r4_c1_request(JuliaTime.MYSTERY_C1_TAUGHT))
            @test right["pass"] == true
            @test right["coaching"] == ""

            # C2: import pandas leads, ahead of Julia's own Pkg.add advice.
            c2 = JuliaTime.mystery_c2_case_run(Dict{String, Any}("request_id" => "r4-c2", "step" => "group",
                "code" => "import pandas as pd\njars.groupby(\"tray_id\")"))
            @test c2["pass"] == false
            @test startswith(c2["coaching"], JuliaTime.MYSTERY_PY_IMPORT_LINE)
            @test c2["feedback"] == c2["coaching"]
            c2_print = JuliaTime.mystery_c2_case_run(Dict{String, Any}("request_id" => "r4-c2p", "step" => "rates",
                "code" => "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate = counts.detected_n ./ counts.n\nprint(counts)"))
            @test c2_print["coaching"] == JuliaTime.MYSTERY_PY_PRINT_LINE

            # C3 and C4: merge and False.
            c3 = JuliaTime.mystery_c3_case_run(c3_run_request("join-report-log",
                "pd.merge(tray_counts, tally_sheet, on=\"tray_id\")"; request_id="r4-c3"))
            @test occursin("leftjoin", c3["coaching"])
            c4 = JuliaTime.mystery_c4_case_run(fb_c4_request("sample(eligible.jar_id, 3, replace=False)"))
            @test c4["pass"] == false
            @test occursin("capital F", c4["coaching"])
            @test c4["feedback"] == c4["coaching"]

            # C5 step 2: len gets its line; // passes and the reply says what Julia returned.
            c5_len = JuliaTime.mystery_c5_case_run(r4_c5_request("event-frequency",
                "events = sim_counts .>= observed_count\nsum(events) / len(events)"))
            @test c5_len["coaching"] == JuliaTime.MYSTERY_PY_LEN_LINE
            frac = JuliaTime.mystery_c5_case_run(r4_c5_request("event-frequency",
                "events = sim_counts .>= observed_count\nsum(events) // length(events)"))
            @test frac["pass"] == true
            @test frac["coaching"] == ""
            @test frac["result_data"]["returned"] == "113//1000"
            @test occursin("Julia returned 113//1000", frac["explanation"]["julia"])
            plain = JuliaTime.mystery_c5_case_run(r4_c5_request("event-frequency",
                "events = sim_counts .>= observed_count\nsum(events) / length(events)"))
            @test plain["result_data"]["returned"] == "0.113"
            @test !occursin("Julia returned", plain["explanation"]["julia"])

            # C5 step 1: a loop passes, but is not praised for a .>= it did not use.
            loop = JuliaTime.mystery_c5_case_run(r4_c5_request("event-mask",
                "marks = Bool[]\nfor c in sim_counts; push!(marks, c >= observed_count); end\nmarks"))
            @test loop["pass"] == true
            @test !occursin(".>=", loop["explanation"]["julia"])
            dotted = JuliaTime.mystery_c5_case_run(r4_c5_request("event-mask", "sim_counts .>= observed_count"))
            @test occursin(".>=", dotted["explanation"]["julia"])
            c5_loop = JuliaTime.mystery_c5_case_run(r4_c5_request("event-mask",
                "marks = []\nfor c in sim_counts:\n    marks.append(c >= 5)\nmarks"))
            @test occursin("push!", c5_loop["coaching"])

            # C6: a Python not line; the bracketed form gets no brackets line.
            c6 = JuliaTime.mystery_c6_case_run(c6_run_request(
                "stories[((stories.lower .<= observed_count) .& (stories.upper .<= observed_count)) .== true, :]"; request_id="r4-c6"))
            @test c6["pass"] == false
            @test !occursin("own brackets", c6["coaching"])
        finally
            JuliaTime.shutdown!()
        end
    end

    @testset "C5: the 1.0 line reads the returned expression" begin
        line = JuliaTime._mystery_c5_coaching(1.0,
            "events = sim_counts .>= observed_count\ns = sum(events)\nlength(events) / length(events)")
        @test occursin("divides every round by every round", line)
        same = JuliaTime._mystery_c5_coaching(1.0, "events = sim_counts .>= observed_count\nsum(events) / sum(events)")
        @test occursin("by itself", same)
        _, wrong = JuliaTime.check_mystery_c5(1.0, "event-frequency";
            code="events = sim_counts .>= observed_count\nsum(events) / sum(events)")
        @test !occursin("use .>=", wrong)
        _, strict = JuliaTime.check_mystery_c5(sum(JuliaTime.mystery_c5_sim_counts() .> 5) / 1000, "event-frequency";
            code="events = sim_counts .> observed_count\nsum(events) / length(events)")
        @test occursin("use .>=", strict)
    end

    @testset "C6: brackets line only for loose code" begin
        brackets = JuliaTime.MYSTERY_C6_BRACKETS_LINE
        @test JuliaTime._mystery_c6_coaching("stories[stories.lower .<= observed_count .& stories.upper .>= observed_count, :]") == brackets
        @test JuliaTime._mystery_c6_coaching("stories[((stories.lower .<= observed_count) .& (stories.upper .<= observed_count)) .== true, :]") == ""
        @test JuliaTime._mystery_c6_coaching("x = (3 & 1) == 1\nstories[1:2, :]") == ""
        @test JuliaTime._mystery_c6_coaching("stories[stories.lower .<= observed_count .& (observed_count .<= stories.upper), :]") == brackets
    end

    @testset "C3: the typed table is not called the tally sheet" begin
        info = JuliaTime.mystery_c3_case_info(move_id="join-report-log", request_id="r4-c3-info")
        @test !occursin("tally-sheet", info["question"])
        @test occursin("Toto's typed copy", info["question"])
        join_move = only(filter(m -> m["id"] == "join-report-log", info["moves"]))
        @test !occursin("tally-sheet", join_move["required_result"])
    end
end

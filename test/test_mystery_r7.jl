using Test
using DataFrames

# Round 7 night playtest (2026-09-28, r7-bugs.md items 1, 4, 5 and r7-r-struggling.md items 2, 3,
# 4, 5, 8 and the runners-up). A coaching line never fires on correct code or an accepted run,
# never hides a more useful line, and never gives the finished answer.

r7_coach(code; kw...) = JuliaTime._mystery_coaching(code; kw...)
r7_undef(name) = "$(name) is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `$(name)` not defined"
const R7_JARS = (:jars => JuliaTime.MYSTERY_COLUMNS,)
r7_c1(code) = Dict{String, Any}("request_id" => "r7-c1", "code" => code)
r7_c2(step, code) = Dict{String, Any}("request_id" => "r7-c2", "step" => step, "code" => code)
r7_c5(move_id, code) = c5_run_request(move_id, code, "c5-simulated-counts-v1"; request_id="r7-c5")
const R7_C3_TAUGHT = "joined[joined.notebook_detected .!= joined.sheet_detected, :]"

@testset "Round 7 coaching and honest displays" begin
    @testset "false positives: correct or tricky Julia gets no R-habit line" begin
        snippets = (
            "jars[jars.batch_id .== case_batch, :]",
            "filter(row -> row.batch_id == case_batch, jars)",
            "filter(:batch_id => ==(case_batch), jars)",
            "subset(jars, :batch_id => x -> x .== case_batch)",
            "groupby(jars, :tray_id)",
            "combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)",
            "ifelse.(sim_counts .>= observed_count, true, false)",
            "findall(sim_counts .>= observed_count)",
            "x = [1, 2]; c = 3; x[c - 2]",
            "t = true; f = false; t & !f",
            "msg = \"library(dplyr) TRUE which(x) c(1, 2) filter(jars, batch_id == B09)\"\njars",
            "# library(dplyr); TRUE; which(x); c(1, 2)\njars",
            "#= require(x) ifelse(a, b, c) =#\njars",
            "batch_id = jars.batch_id\njars[batch_id .== case_batch, :]",
            "stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]",
            "leftjoin(tray_counts, tally_sheet, on=:tray_id)",
            R7_C3_TAUGHT,
            "sample(eligible.jar_id, 3; replace=false)",
            "TRUEISH = 1; FALSEY = 2; libraryx = 3; whichever = 4",
        )
        tables = (:jars => JuliaTime.MYSTERY_COLUMNS, :stories => JuliaTime.MYSTERY_C6_COLUMNS,
                  :joined => ["tray_id", "notebook_detected", "sheet_detected", "entry_status"],
                  :eligible => ["jar_id"])
        for code in snippets, message in ("", "MethodError: no method matching foo(::Int64)")
            @test (code, message, r7_coach(code; message=message, tables=tables, case_batch=true)) ==
                  (code, message, "")
        end
        # The names in an UndefVarError are coached only when the code really uses them bare.
        @test r7_coach("jars.batch_id"; message=r7_undef("batch_id"), tables=R7_JARS) == ""
        @test r7_coach("x = \"B09\""; message=r7_undef("B09"), tables=R7_JARS) == ""
        # A bare column where the chapter wants :name (inside groupby, combine, a pair, on=) is
        # left to the page's own colon line.
        @test r7_coach("groupby(jars, tray_id)"; message=r7_undef("tray_id"), tables=R7_JARS) == ""
        @test r7_coach("combine(groupby(jars, :tray_id), nrow => :n, sum(detected))";
                       message=r7_undef("detected"), tables=R7_JARS) == ""
        @test r7_coach("leftjoin(tray_counts, tally_sheet, on=tray_id)"; message=r7_undef("tray_id"),
                       tables=(:tray_counts => ["tray_id", "notebook_detected"],
                               :tally_sheet => ["tray_id", "sheet_detected", "entry_status"])) == ""
    end

    @testset "3: R habits get a plain line in every chapter" begin
        @test r7_coach("library(dplyr)"; message=r7_undef("dplyr"), tables=R7_JARS) ==
            JuliaTime.MYSTERY_R_LIBRARY_LINE
        @test r7_coach("require(dplyr)\njars"; tables=R7_JARS) == JuliaTime.MYSTERY_R_LIBRARY_LINE
        @test r7_coach("filter(jars, batch_id == \"B09\")"; message=r7_undef("batch_id"), tables=R7_JARS) ==
            "In Julia, columns are named with the table: jars.batch_id, not batch_id on its own. dplyr's filter(jars, batch_id == ...) becomes a row rule inside jars[ ..., :]."
        @test r7_coach("filter(stories, lower <= 5 & upper >= 5)"; message=r7_undef("lower"),
                       tables=(:stories => JuliaTime.MYSTERY_C6_COLUMNS,)) ==
            "In Julia, columns are named with the table: stories.lower, not lower on its own. dplyr's filter(stories, lower <= ...) becomes a row rule inside stories[ ..., :]."
        @test r7_coach("jars[batch_id .== case_batch, :]"; message=r7_undef("batch_id"), tables=R7_JARS) ==
            "batch_id is a column of jars: write jars.batch_id."
        @test r7_coach("stories[stories.lower .<= observed_count .& upper .>= 5, :]"; message=r7_undef("upper"),
                       tables=(:stories => JuliaTime.MYSTERY_C6_COLUMNS,)) ==
            "upper is a column of stories: write stories.upper."
        @test r7_coach("jars[jars.batch_id .== B09, :]"; message=r7_undef("B09"), tables=R7_JARS, case_batch=true) ==
            "B09 is text here: write it in double quotes, \"B09\", or use case_batch."
        @test r7_coach("jars[jars.batch_id .== B08, :]"; message=r7_undef("B08"), tables=R7_JARS) ==
            "B08 is text here: write it in double quotes, \"B08\"."
        @test r7_coach("ifelse(sim_counts >= 5, TRUE, FALSE)"; message="MethodError: no method matching isless(::Int64, ::Vector{Int64})",
                       way=".>= marks every round at once, and sum counts the trues.") ==
            # Round 8 (r8-fuzz.md item 7): Julia stopped on the missing dot, so that comes first.
            "Add a dot: write .>= instead of >=, so Julia compares every value, one at a time. In R and pandas a plain >= already does that; Julia needs the dot. TRUE is R's spelling: Julia writes true."
        # ifelse.(...) is Julia's own form, so only the spelling is coached.
        @test r7_coach("ifelse.(sim_counts .>= 5, TRUE, FALSE)"; message=r7_undef("TRUE")) ==
            "TRUE is R's spelling: Julia writes true."
        @test r7_coach("sample(eligible.jar_id, 3; replace = FALSE)"; message=r7_undef("FALSE")) ==
            "FALSE is R's spelling: Julia writes false."
        @test r7_coach("length(which(sim_counts .>= 5)) / 1000") == JuliaTime.MYSTERY_R_WHICH_LINE
        @test r7_coach("sample(c(\"J-091\", \"J-092\"), 2)"; message=r7_undef("c")) == JuliaTime.MYSTERY_R_C_LINE
        # The R arrow line still comes first.
        @test r7_coach("x <- TRUE") == JuliaTime.MYSTERY_R_ARROW_LINE
    end

    @testset "3: the real chapters send the R lines" begin
        c1 = JuliaTime.mystery_case_run(r7_c1("filter(jars, batch_id == \"B09\")"))
        @test c1["pass"] === false
        @test startswith(c1["coaching"], "In Julia, columns are named with the table: jars.batch_id")
        c1_lib = JuliaTime.mystery_case_run(r7_c1("library(dplyr)"))
        @test c1_lib["coaching"] == JuliaTime.MYSTERY_R_LIBRARY_LINE
        c1_b09 = JuliaTime.mystery_case_run(r7_c1("jars[jars.batch_id .== B09, :]"))
        @test c1_b09["coaching"] == "B09 is text here: write it in double quotes, \"B09\", or use case_batch."
        c1_ok = JuliaTime.mystery_case_run(r7_c1(JuliaTime.MYSTERY_C1_TAUGHT))
        @test c1_ok["pass"] === true && c1_ok["coaching"] == ""

        c6 = JuliaTime.mystery_c6_case_run(c6_run_request("filter(stories, lower <= 5 & upper >= 5)"))
        @test startswith(c6["coaching"], "In Julia, columns are named with the table: stories.lower")
        @test c6["coaching"] != JuliaTime.MYSTERY_C6_BRACKETS_LINE

        c5 = JuliaTime.mystery_c5_case_run(r7_c5("event-mask", "ifelse.(sim_counts .>= 5, TRUE, FALSE)"))
        @test startswith(c5["coaching"], "TRUE is R's spelling: Julia writes true.")

        c2_ok = JuliaTime.mystery_c2_case_run(r7_c2("counts",
            "combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)"))
        @test c2_ok["pass"] === true && c2_ok["coaching"] == ""
        c2_col = JuliaTime.mystery_c2_case_run(r7_c2("group", "groupby(jars, tray_id)"))
        @test c2_col["coaching"] == ""
    end

    @testset "3: C5 step 1 mean, C2 detected_sum" begin
        mean1 = JuliaTime.mystery_c5_case_run(r7_c5("event-mask", "mean(sim_counts .>= observed_count)"))
        @test mean1["pass"] === false
        @test mean1["coaching"] == JuliaTime.MYSTERY_C5_STEP1_MEAN_LINE
        ok1 = JuliaTime.mystery_c5_case_run(r7_c5("event-mask", "sim_counts .>= observed_count"))
        @test ok1["pass"] === true && ok1["coaching"] == ""

        sum2 = JuliaTime.mystery_c2_case_run(r7_c2("counts",
            "combine(groupby(jars, :tray_id), nrow => :n, :detected => sum)"))
        @test sum2["pass"] === false
        @test sum2["coaching"] == JuliaTime.MYSTERY_C2_DETECTED_SUM_LINE
        @test occursin("detected_sum", sum2["coaching"]) && occursin("=> :detected_n", sum2["coaching"])
    end

    @testset "r7-bugs 1: C5 says 'you divided by all 1,000 rounds' only when the code did" begin
        for code in ("1", "0", "0.5", "1/2", "113/100")
            pass, feedback = JuliaTime.check_mystery_c5(eval(Meta.parse(code)), "event-frequency"; code=code)
            @test pass === false
            @test !occursin("You divided", feedback)
        end
        @test JuliaTime.check_mystery_c5(0.5, "event-frequency"; code="0.5")[2] ==
            "Divide the rounds that matched by all 1,000 rounds."
        for code in ("sum(sim_counts .> observed_count) / length(sim_counts)",
                     "count(sim_counts .> observed_count) / 1000",
                     "count(sim_counts .> observed_count) / 1_000",
                     "count(sim_counts .> observed_count) / n_trials",
                     "mean(sim_counts .> observed_count)")
            @test startswith(JuliaTime.check_mystery_c5(18 / 1000, "event-frequency"; code=code)[2],
                             "You divided by all 1,000 rounds, but counted the wrong rounds.")
        end
        run1 = JuliaTime.mystery_c5_case_run(r7_c5("event-frequency", "1"))
        @test !occursin("You divided", run1["feedback"])
    end

    @testset "r7-bugs 4 and 5: C5 sends Julia's own display" begin
        pair_code = "events = sim_counts .>= observed_count\n(events=events, frequency=sum(events)//length(events))"
        pair = JuliaTime.mystery_c5_case_run(r7_c5("event-frequency", pair_code))
        @test pair["pass"] === true
        data = pair["result_data"]
        @test data["kind"] == "event-frequency"
        @test startswith(data["returned"], "(events = Bool[")
        @test occursin("  …  ", data["returned"])
        @test endswith(data["returned"], "frequency = 113//1000)")
        @test data["frequency_returned"] == "113//1000"
        julia_line = pair["explanation"]["julia"]
        @test !occursin("Julia returned (events", julia_line)
        @test occursin("Your frequency field is 113//1000, the same value written another way.", julia_line)

        pair_float = JuliaTime.mystery_c5_case_run(r7_c5("event-frequency",
            "events = sim_counts .>= observed_count\n(events=events, frequency=sum(events)/length(events))"))
        @test pair_float["pass"] === true
        @test !occursin("the same value written another way", pair_float["explanation"]["julia"])
        @test endswith(pair_float["result_data"]["returned"], "frequency = 0.113)")
        @test pair_float["result_data"]["frequency_returned"] == "0.113"

        frac = JuliaTime.mystery_c5_case_run(r7_c5("event-frequency",
            "events = sim_counts .>= observed_count\nsum(events) // length(events)"))
        @test frac["result_data"]["returned"] == "113//1000"
        @test occursin("Julia returned 113//1000, the same value written another way.", frac["explanation"]["julia"])

        mask = JuliaTime.mystery_c5_case_run(r7_c5("event-mask", "sim_counts .>= observed_count"))
        expected = sprint(show, JuliaTime.mystery_c5_expected_events(); context=:limit=>true)
        @test mask["result_data"]["returned"] == expected
        @test startswith(expected, "Bool[") && occursin("  …  ", expected)
    end

    @testset "r7-r 8 and 2: C3 missing , : and the shortcut success line" begin
        comma = JuliaTime.mystery_c3_case_run(c3_run_request("filter-disagreement",
            "joined[joined.notebook_detected .!= joined.sheet_detected]"))
        @test comma["pass"] === false
        @test comma["coaching"] == JuliaTime.MYSTERY_C3_ADD_COMMA_LINE
        @test occursin("add a comma and a colon (, :) after the row rule", comma["coaching"])

        taught = JuliaTime.mystery_c3_case_run(c3_run_request("filter-disagreement", R7_C3_TAUGHT))
        @test taught["pass"] === true && taught["coaching"] == ""
        @test startswith(taught["explanation"]["julia"], "Your row is right. You used the way this game teaches")

        shortcut = JuliaTime.mystery_c3_case_run(c3_run_request("filter-disagreement",
            "joined[joined.entry_status .== \"left blank\", :]"))
        if shortcut["pass"] === true
            @test shortcut["explanation"]["julia"] == JuliaTime.MYSTERY_C3_SHORTCUT_LINE
            @test !occursin("compares notebook_detected", shortcut["explanation"]["julia"])
        end
        @test JuliaTime._mystery_c3_explanation("filter-disagreement", true;
                code="joined[joined.entry_status .== \"left blank\", :]")["julia"] == JuliaTime.MYSTERY_C3_SHORTCUT_LINE
        other = JuliaTime._mystery_c3_explanation("filter-disagreement", true;
                code="joined[.!(joined.notebook_detected .== joined.sheet_detected), :]")["julia"]
        @test startswith(other, "Your row is right. The way this game teaches uses .!=")
    end
end

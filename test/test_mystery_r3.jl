using Test
using DataFrames

# Round 3 night playtest (2026-09-27): r3-bugs.md items 1, 2 and 8, and r3-struggling.md items 1,
# 2, 4 and 5. A wrong run must never be told it used the taught way; the page's own two-line C2 form
# counts as the taught way; mistakes that run but give a wrong value get a line naming the mistake;
# and a seeded C4 draw that keeps seed!'s value still works when Julia runs it again.

const R3_PRAISE = "You used the way this game teaches"
const R3_C3_PRACTICE = "leftjoin(practice_counts, practice_sheet, on=:key)"
const R3_C2_CARDS = "groups = groupby(jars, :tray_id)\ncounts = combine(groups, nrow => :n, :detected => sum => :detected_n)\ncounts"

r3_c2_request(step, code) = Dict{String, Any}("request_id" => "r3-c2", "step" => step, "code" => code)
r3_c3_practice(code) = c3_run_request("join-report-log", code; request_id="r3-c3-demo",
                                      mode="demonstration", activity_id="practice-join-v1")
r3_c5_request(code) = c5_run_request("event-frequency", code, "c5-simulated-counts-v1"; request_id="r3-c5")

@testset "Round 3 feedback repairs" begin
    @testset "the taught-way praise needs a passing run, in every chapter" begin
        # C3 practice: the taught line followed by a mistake is not praised.
        for practice_pass in (false, nothing)
            text = JuliaTime._mystery_c3_explanation("join-report-log", nothing; mode="demonstration",
                code=R3_C3_PRACTICE, practice_pass=practice_pass)["julia"]
            @test !occursin(R3_PRAISE, text)
        end
        @test occursin(R3_PRAISE, JuliaTime._mystery_c3_explanation("join-report-log", nothing;
            mode="demonstration", code=R3_C3_PRACTICE, practice_pass=true)["julia"])
        # Every other chapter: the exact taught code with a failed run gets no praise.
        @test !occursin(R3_PRAISE, JuliaTime._mystery_explanation(false; code=JuliaTime.MYSTERY_C1_TAUGHT)["julia"])
        for (step, taught) in JuliaTime.MYSTERY_C2_TAUGHT, code in (taught isa AbstractString ? (taught,) : taught)
            @test !occursin(R3_PRAISE, JuliaTime._mystery_c2_explanation(step, false; code=code)["julia"])
        end
        for move_id in JuliaTime.MYSTERY_C3_MOVES
            text = JuliaTime._mystery_c3_explanation(move_id, false; code=JuliaTime.MYSTERY_C3_TAUGHT[move_id])["julia"]
            @test !occursin(R3_PRAISE, text)
        end
        @test !occursin(R3_PRAISE, JuliaTime._mystery_c5_explanation("event-frequency", false; code=JuliaTime.MYSTERY_C5_TAUGHT)["julia"])
        @test !occursin(R3_PRAISE, JuliaTime._mystery_c6_explanation(false; code=JuliaTime.MYSTERY_C6_TAUGHT)["julia"])
    end

    @testset "C2 step 2: the page's two-line card form is the taught way" begin
        @test occursin(R3_PRAISE, JuliaTime._mystery_c2_explanation("counts", true; code=R3_C2_CARDS)["julia"])
        @test occursin(R3_PRAISE, JuliaTime._mystery_c2_explanation("counts", true;
            code="combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)")["julia"])
        # Another grouping name, or grouping by another column, is not the taught form.
        @test !occursin(R3_PRAISE, JuliaTime._mystery_c2_explanation("counts", true;
            code=replace(R3_C2_CARDS, "groupby(jars, :tray_id)" => "groupby(jars, :batch_id)"))["julia"])
        @test !occursin(R3_PRAISE, JuliaTime._mystery_c2_explanation("counts", true;
            code="combine(groups, nrow => :n, :detected => sum => :detected_n)")["julia"])
    end

    @testset "C5 step 2: a count or every round gets a line naming the mistake" begin
        matching = sum(JuliaTime.mystery_c5_expected_events())
        count_line = "$(matching) is how many rounds matched. Divide that number by all rounds to get how often 5 or more happened."
        length_line = "length counts every round; sum counts the matches."
        @test JuliaTime._mystery_c5_coaching(matching, "sum(sim_counts .>= observed_count)") == count_line
        @test JuliaTime._mystery_c5_coaching(Float64(matching), "events = sim_counts .>= observed_count\nsum(events)") == count_line
        @test occursin(length_line, JuliaTime._mystery_c5_coaching(1000, "length(sim_counts .>= observed_count)"))
        @test occursin(length_line, JuliaTime._mystery_c5_coaching(1.0, "length(sim_counts .>= observed_count) / 1000"))
        @test occursin(length_line, JuliaTime._mystery_c5_coaching(1.0, "events = sim_counts .>= observed_count\nlength(events) / length(events)"))
        # An all-true mask counted with sum is a different mistake: no length line.
        @test JuliaTime._mystery_c5_coaching(1.0, "sum(sim_counts .>= 0) / length(sim_counts)") == ""
        # The right answer, and other wrong numbers, get no line.
        @test JuliaTime._mystery_c5_coaching(matching / 1000, JuliaTime.MYSTERY_C5_TAUGHT) == ""
        @test JuliaTime._mystery_c5_coaching(0.5, "0.5") == ""
        # The checker says the same thing, and no longer blames .>= for a length mistake.
        @test JuliaTime.check_mystery_c5(matching, "event-frequency"; code="sum(sim_counts .>= observed_count)") == (false, count_line)
        passed, feedback = JuliaTime.check_mystery_c5(1.0, "event-frequency"; code="length(sim_counts .>= observed_count) / 1000")
        @test !passed
        @test occursin(length_line, feedback)
        @test !occursin(".>=", feedback)
        @test JuliaTime.check_mystery_c5(matching / 1000, "event-frequency"; code=JuliaTime.MYSTERY_C5_TAUGHT)[1]
        for text in (count_line, JuliaTime._mystery_c5_coaching(1.0, "length(sim_counts .>= observed_count) / 1000"))
            @test !occursin('—', text)
            @test !occursin(string(matching / 1000), text)
        end
    end

    @testset "C6: two comparisons joined by .& without brackets" begin
        line = JuliaTime._mystery_c6_coaching("stories[stories.lower .<= observed_count .& stories.upper .>= observed_count, :]")
        @test occursin("own brackets", line)
        @test !occursin("stories", line)
        @test JuliaTime._mystery_c6_coaching("stories.lower .<= observed_count .& stories.upper .>= observed_count") == line
        @test JuliaTime._mystery_c6_coaching("stories.lower .<= observed_count & stories.upper .>= observed_count") == line
        @test JuliaTime._mystery_c6_coaching("stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]") == ""
        @test JuliaTime._mystery_c6_coaching(JuliaTime.MYSTERY_C6_TAUGHT) == ""
        @test JuliaTime._mystery_c6_coaching("stories[") == ""
    end

    @testset "C2: R's <- and dplyr's summarise and n() are named" begin
        arrow = JuliaTime._mystery_c2_coaching("counts.rate <- counts.detected_n ./ counts.n")
        @test startswith(arrow, "Julia assigns with =, not <-.")
        @test JuliaTime._mystery_c2_coaching("counts <- combine(groupby(jars, :tray_id), nrow => :n)") == arrow
        @test JuliaTime._mystery_c2_coaching("counts.rate < -1") == ""
        @test JuliaTime._mystery_c2_coaching("x = \"<-\"; counts.rate = counts.detected_n ./ counts.n") == ""
        dplyr = JuliaTime._mystery_c2_coaching("summarise(groupby(jars, :tray_id), n = n(), detected_n = sum(detected))")
        @test occursin("summarise", dplyr) && occursin("combine", dplyr) && occursin("nrow", dplyr)
        @test !occursin("new column that combine makes", dplyr)
        @test JuliaTime._mystery_c2_coaching("g = groupby(jars, :tray_id)\nsummarize(g, n = n())") == dplyr
        @test JuliaTime._mystery_c2_coaching("combine(groupby(jars, :tray_id), :detected => n => :n)") == ""
        @test JuliaTime._mystery_c2_coaching(JuliaTime.MYSTERY_C2_TAUGHT["counts"][1]) == ""
        for text in (arrow, dplyr)
            @test !occursin('—', text)
            @test !occursin(":detected => sum => :detected_n", text)
        end
    end

    @testset "C4: seed!'s value is still a generator when Julia runs the code again" begin
        code, seeded = JuliaTime._mystery_c4_unseeded("rng = Random.seed!(42)\nsample(rng, eligible.jar_id, 3; replace=false)")
        @test seeded
        @test !occursin("seed!", code)
        @test occursin("Random.default_rng()", code)
        @test !occursin("nothing", code)
    end

    @testset "failure lines that were not true are gone" begin
        @test !haskey(JuliaTime._mystery_c2_explanation("counts", false), "case") ||
              isempty(JuliaTime._mystery_c2_explanation("counts", false)["case"])
        for move_id in JuliaTime.MYSTERY_C3_MOVES, key in ("case", "limit")
            @test isempty(get(JuliaTime._mystery_c3_explanation(move_id, false), key, ""))
        end
        failed_c4 = JuliaTime._mystery_c4_explanation(false)
        @test isempty(get(failed_c4, "case", "")) && isempty(get(failed_c4, "limit", ""))
    end

    @testset "live runs: the new lines reach the reply" begin
        JuliaTime.warmup!()
        try
            # C3 practice: a failed or crashing run after the taught line is not praised.
            for code in (R3_C3_PRACTICE * "\nnot_a_name", R3_C3_PRACTICE * "\n42")
                reply = JuliaTime.handle_message(r3_c3_practice(code))
                @test reply["practice_pass"] == false
                @test !occursin(R3_PRAISE, reply["explanation"]["julia"])
            end
            good = JuliaTime.handle_message(r3_c3_practice(R3_C3_PRACTICE))
            @test good["practice_pass"] == true
            @test occursin(R3_PRAISE, good["explanation"]["julia"])

            # C2: the card form passes with praise; <- and summarise get their lines.
            cards = JuliaTime.mystery_c2_case_run(r3_c2_request("counts", R3_C2_CARDS))
            @test cards["pass"] == true
            @test occursin(R3_PRAISE, cards["explanation"]["julia"])
            @test cards["coaching"] == ""
            arrow = JuliaTime.mystery_c2_case_run(r3_c2_request("rates",
                "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate <- counts.detected_n ./ counts.n\ncounts"))
            @test arrow["pass"] == false
            @test startswith(arrow["feedback"], "Julia assigns with =, not <-.")
            @test !occursin("Check the names", arrow["feedback"])
            @test arrow["coaching"] == arrow["feedback"]
            dplyr = JuliaTime.mystery_c2_case_run(r3_c2_request("counts",
                "g = groupby(jars, :tray_id)\nsummarise(g, n = n(), detected_n = sum(detected))"))
            @test dplyr["pass"] == false
            @test occursin("summarise", dplyr["coaching"])
            @test dplyr["feedback"] == dplyr["coaching"]

            # C5: the count alone and length each get their line in coaching.
            matching = sum(JuliaTime.mystery_c5_expected_events())
            counted = JuliaTime.mystery_c5_case_run(r3_c5_request("sum(sim_counts .>= observed_count)"))
            @test counted["pass"] == false
            @test startswith(counted["coaching"], "$(matching) is how many rounds matched.")
            lengthy = JuliaTime.mystery_c5_case_run(r3_c5_request("length(sim_counts .>= observed_count) / 1000"))
            @test lengthy["pass"] == false
            @test occursin("length counts every round", lengthy["coaching"])
            right = JuliaTime.mystery_c5_case_run(r3_c5_request("events = sim_counts .>= observed_count\n" * JuliaTime.MYSTERY_C5_TAUGHT))
            @test right["coaching"] == ""

            # C6: the unbracketed form runs, fails, and says why.
            loose = JuliaTime.mystery_c6_case_run(c6_run_request(
                "stories[stories.lower .<= observed_count .& stories.upper .>= observed_count, :]"; request_id="r3-c6"))
            @test loose["pass"] == false
            @test occursin("own brackets", loose["coaching"])
            tight = JuliaTime.mystery_c6_case_run(c6_run_request(JuliaTime.MYSTERY_C6_TAUGHT; request_id="r3-c6-good"))
            @test tight["pass"] == true
            @test tight["coaching"] == ""

            # C4: rng = Random.seed!(42) passes, with the seed praise.
            seeded = JuliaTime.mystery_c4_case_run(fb_c4_request("rng = Random.seed!(42)\nsample(rng, eligible.jar_id, 3; replace=false)"))
            @test seeded["status"] == "ok"
            @test seeded["pass"] == true
            @test occursin("Setting a seed makes your draw repeatable", seeded["explanation"]["julia"])
        finally
            JuliaTime.shutdown!()
        end
    end
    # v0.2.5 night (fixer I1): R's <- in C3 to C6 gets the shared arrow line in coaching and feedback,
    # including when <- sits in a chain of comparisons (events <- sim_counts .>= observed_count).
    @testset "R's <- in C3 to C6, chained comparisons included" begin
        arrow = JuliaTime.MYSTERY_R_ARROW_LINE
        @test JuliaTime._mystery_r_arrow_note("events <- sim_counts .>= observed_count") == arrow
        @test JuliaTime._mystery_r_arrow_note("fits <- stories.lower .<= observed_count") == arrow
        @test JuliaTime._mystery_r_arrow_note("x = \"<-\"; sim_counts .>= observed_count") == ""
        @test JuliaTime._mystery_r_arrow_note("sim_counts .>= observed_count") == ""
        @test JuliaTime._mystery_r_arrow_note("x < -1 .<= y") == ""
        JuliaTime.warmup!()
        try
            c3 = JuliaTime.mystery_c3_case_run(c3_run_request("join-report-log",
                "joined <- leftjoin(tray_counts, tally_sheet, on=:tray_id)"; request_id="i1-c3"))
            c3_right = JuliaTime.mystery_c3_case_run(c3_run_request("join-report-log",
                JuliaTime.MYSTERY_C3_TAUGHT["join-report-log"]; request_id="i1-c3-good"))
            c4 = JuliaTime.mystery_c4_case_run(fb_c4_request("picks <- sample(eligible.jar_id, 3; replace=false)"))
            c4_right = JuliaTime.mystery_c4_case_run(fb_c4_request("using Random\nsample(eligible.jar_id, 3; replace=false)"))
            c5 = JuliaTime.mystery_c5_case_run(r3_c5_request("events <- sim_counts .>= observed_count\nsum(events) / length(events)"))
            c5_mask = JuliaTime.mystery_c5_case_run(c5_run_request("event-mask", "events <- sim_counts .>= observed_count",
                "c5-simulated-counts-v1"; request_id="i1-c5-mask"))
            c6 = JuliaTime.mystery_c6_case_run(c6_run_request(
                "fits <- (stories.lower .<= observed_count) .& (observed_count .<= stories.upper)\nstories[fits, :]"; request_id="i1-c6"))
            for reply in (c3, c4, c5, c5_mask, c6)
                @test reply["pass"] != true
                @test reply["coaching"] == arrow
                @test reply["feedback"] == arrow
            end
            for reply in (c3_right, c4_right)
                @test reply["pass"] == true
                @test reply["coaching"] == ""
            end
        finally
            JuliaTime.shutdown!()
        end
    end
end

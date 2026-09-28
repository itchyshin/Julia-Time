using Test
using DataFrames

# Round 1 night playtest (2026-09-27): feedback that pointed at the wrong mistake, and a C4 checker
# that accepted a hand-picked or luck-only plan. Findings: r1-bugs.md items 1, 6 and 8,
# r1-expert.md item 1, r1-audit.md items F5 and F9.

const FB_TIMEOUT_LINE = "Your code ran for more than 5 seconds, so Julia stopped it. A loop that never ends is the usual cause."
const FB_NAMES_LINE = "Julia stopped before the end. Check the names, then run again."

fb_c4_request(code; request_id="fb-c4") = Dict{String, Any}(
    "type" => "case_run", "contract_version" => 1, "case_id" => "missing-fleas-v1",
    "chapter" => "C4", "move_id" => "plan-distinct-recheck", "mode" => "challenge",
    "activity_id" => nothing, "simulation_id" => nothing, "request_id" => request_id, "code" => code)

@testset "Round 1 feedback repairs" begin
    @testset "a timeout says the code took too long, in every chapter" begin
        @test JuliaTime._mystery_stopped_feedback(:timeout) == FB_TIMEOUT_LINE
        @test JuliaTime._mystery_stopped_feedback(:error) == FB_NAMES_LINE
        # Every chapter's case_run uses the one helper; no chapter hard-codes the names line.
        for file in filter(f -> occursin(r"^mystery.*\.jl$", f), readdir(joinpath(@__DIR__, "..", "src")))
            text = read(joinpath(@__DIR__, "..", "src", file), String)
            @test count(FB_NAMES_LINE, text) == (file == "mystery.jl" ? 1 : 0)
        end
    end

    @testset "C1: a view of the right rows is accepted" begin
        jars = JuliaTime.mystery_jars()
        rule = jars.batch_id .== "B09"
        @test JuliaTime.check_mystery_c1(view(jars, rule, :))[1]
        @test JuliaTime.check_mystery_c1(filter(:batch_id => ==("B09"), jars; view=true))[1]
    end

    @testset "C1: the row-mismatch line names the real mistake" begin
        jars = JuliaTime.mystery_jars()
        # The copied worked example (and jars[1:6, :], the same rows) picked by label, just the wrong one.
        passed, feedback = JuliaTime.check_mystery_c1(jars[jars.batch_id .== "B08", :])
        @test !passed
        @test !occursin("where they sit", feedback)
        @test occursin("B08", feedback) && occursin("case_batch", feedback)
        # A run of rows that mixes batches keeps the by-label advice.
        passed, feedback = JuliaTime.check_mystery_c1(jars[4:9, :])
        @test !passed
        @test occursin("not by where they sit", feedback)
        # Six B09 rows with one jar twice.
        passed, feedback = JuliaTime.check_mystery_c1(jars[[7, 7, 8, 9, 10, 11], :])
        @test !passed
        @test occursin("twice", feedback)
        @test !occursin("where they sit", feedback)
        # Six B09 rows with a changed value.
        changed = jars[jars.batch_id .== "B09", :]
        changed.detected[1] = !changed.detected[1]
        passed, feedback = JuliaTime.check_mystery_c1(changed)
        @test !passed
        @test !occursin("where they sit", feedback)
        @test occursin("changed", feedback)
    end

    @testset "C2 rates: ending on the new column says to end with the table" begin
        passed, feedback = JuliaTime.check_mystery_c2([1.0, 1.0, 0.5], "rates")
        @test !passed
        @test occursin("only the new rate column", feedback)
        @test occursin("counts", feedback)
        @test !occursin("Return exactly these columns", feedback)
    end

    @testset "C4: the failure explanation adds no generic list line" begin
        failed = JuliaTime._mystery_c4_explanation(false)
        @test !haskey(failed, "julia")
        @test haskey(failed, "case")
    end

    @testset "C4: the success line leaves Momo's doubt to Chapter 5" begin
        for ids in (nothing, ["J-091", "J-092", "J-094"])
            line = JuliaTime._mystery_c4_explanation(true, ids)["case"]
            @test !occursin("too good to be true", line)
            @test !occursin("Momo", line)
            @test endswith(line, "Nobody has looked yet. Until then, one question can be answered today: what would plain chance give?")
        end
    end

    @testset "C4: reruns under several seeds demand a chance pick with no repeats" begin
        ok(value) = JuliaTime.SandboxResult(:ok, value, "", "")
        ids = JuliaTime.mystery_c4_expected_eligible().jar_id
        # A pick that varies and never repeats passes.
        varying = (code, seed, _...) -> ok(ids[[mod1(seed, 4), mod1(seed + 1, 4), mod1(seed + 2, 4)]])
        @test JuliaTime._mystery_c4_check_chance("x"; rerun=varying) == (true, "")
        # The same three jars every time (hand-picked) fails.
        fixed = (code, seed, _...) -> ok(ids[1:3])
        passed, feedback = JuliaTime._mystery_c4_check_chance("eligible.jar_id[1:3]"; rerun=fixed)
        @test !passed
        @test occursin("same three jars", feedback)
        @test occursin("Let chance pick", feedback)
        # The same three in a new order is still the same three jars.
        shuffled = (code, seed, _...) -> ok(isodd(seed) ? ids[[1, 2, 3]] : ids[[3, 1, 2]])
        @test !JuliaTime._mystery_c4_check_chance("x"; rerun=shuffled)[1]
        # Round 2: a seed line is not the fault; a pick that never changes is hand-picked.
        passed, feedback = JuliaTime._mystery_c4_check_chance("Random.seed!(1); eligible.jar_id[1:3]"; rerun=fixed)
        @test !passed
        @test occursin("same three jars", feedback)
        @test !occursin("seed", feedback)
        # A repeat on any rerun fails with the replace=false advice.
        repeat_once = (code, seed, _...) -> ok(seed == JuliaTime.MYSTERY_C4_CHANCE_SEEDS[end] ? ids[[1, 1, 2]] : ids[[mod1(seed, 4), mod1(seed + 1, 4), mod1(seed + 2, 4)]])
        passed, feedback = JuliaTime._mystery_c4_check_chance("sample(eligible.jar_id, 3)"; rerun=repeat_once)
        @test !passed
        @test occursin("same jar twice", feedback)
        @test occursin("replace=false", feedback)
        # A rerun that stops is reported, not passed.
        stops = (code, seed, _...) -> JuliaTime.SandboxResult(:error, nothing, "", "boom")
        @test !JuliaTime._mystery_c4_check_chance("x"; rerun=stops)[1]
        for text in (feedback, JuliaTime._mystery_c4_check_chance("x"; rerun=fixed)[2],
                     JuliaTime._mystery_c4_check_chance("x"; rerun=stops)[2])
            @test !occursin('—', text)
            @test !occursin('`', text)
        end
    end

    # Round 2 (2026-09-27, r2-teacher.md): a seeded draw is good practice and must pass. The reruns
    # turn the learner's own seed calls into nothing, so the checker's seeds still vary the pick.
    @testset "C4 round 2: the reruns ignore the learner's own seed" begin
        code, seeded = JuliaTime._mystery_c4_unseeded("Random.seed!(1); sample(eligible.jar_id, 3; replace=false)")
        @test seeded
        @test !occursin("seed!", code)
        @test occursin("sample(eligible.jar_id, 3; replace = false)", code)
        for text in ["using Random\nRandom.seed!(20260927)\nsample(eligible.jar_id, 3; replace=false)",
                     "seed!(3); sample(eligible.jar_id, 3; replace=false)",
                     "begin\n  Random.seed!(7)\n  sample(eligible.jar_id, 3; replace=false)\nend"]
            code, seeded = JuliaTime._mystery_c4_unseeded(text)
            @test seeded
            @test !occursin("seed!", code)
        end
        # A seeded generator of its own becomes the checker's seeded default generator.
        code, seeded = JuliaTime._mystery_c4_unseeded("rng = MersenneTwister(5); sample(rng, eligible.jar_id, 3; replace=false)")
        @test seeded
        @test !occursin("MersenneTwister(5)", code)
        # Code without a seed is passed on unchanged.
        plain = "sample(eligible.jar_id, 3; replace=false)"
        @test JuliaTime._mystery_c4_unseeded(plain) == (plain, false)
        @test JuliaTime._mystery_c4_unseeded("sample(eligible.jar_id <> 3)") == ("sample(eligible.jar_id <> 3)", false)
        # The rerun receives the unseeded code, never the learner's seed line.
        ok(value) = JuliaTime.SandboxResult(:ok, value, "", "")
        ids = JuliaTime.mystery_c4_expected_eligible().jar_id
        seen = String[]
        spy = (code, seed, _...) -> (push!(seen, code); ok(ids[[mod1(seed, 4), mod1(seed + 1, 4), mod1(seed + 2, 4)]]))
        @test JuliaTime._mystery_c4_check_chance("Random.seed!(1); sample(eligible.jar_id, 3; replace=false)"; rerun=spy) == (true, "")
        @test length(seen) == length(JuliaTime.MYSTERY_C4_CHANCE_SEEDS)
        @test all(c -> !occursin("seed!", c), seen)
        # A seed named only in a comment is not a seed.
        @test JuliaTime._mystery_c4_unseeded("# Random.seed!(1)\nsample(eligible.jar_id, 3; replace=false)")[2] == false
        # r2-bugs.md: the reruns share one small budget and stop as soon as it is used up.
        fake_now = Ref(0.0)
        budgets = Float64[]
        slow = (code, seed, budget) -> (push!(budgets, budget); fake_now[] += 1.2;
                                        ok(ids[[mod1(seed, 4), mod1(seed + 1, 4), mod1(seed + 2, 4)]]))
        passed, feedback = JuliaTime._mystery_c4_check_chance("x"; rerun=slow, clock=() -> fake_now[])
        @test !passed
        @test feedback == JuliaTime.MYSTERY_C4_SLOW_LINE
        @test length(budgets) == ceil(Int, JuliaTime.MYSTERY_C4_RERUN_BUDGET / 1.2)  # each fake rerun costs 1.2 s
        @test budgets[1] == JuliaTime.MYSTERY_C4_RERUN_BUDGET
        @test all(b -> b <= JuliaTime.MYSTERY_C4_RERUN_BUDGET, budgets)
        timed_out = (code, seed, budget) -> JuliaTime.SandboxResult(:timeout, nothing, "", "")
        @test JuliaTime._mystery_c4_check_chance("x"; rerun=timed_out) == (false, JuliaTime.MYSTERY_C4_SLOW_LINE)
        # r2-bugs.md: the replace=false reminder is for sample only.
        @test JuliaTime._mystery_c4_calls_sample("sample(eligible.jar_id, 3; replace=false)")
        @test JuliaTime._mystery_c4_calls_sample("StatsBase.sample(eligible.jar_id, 3; replace=false)")
        @test !JuliaTime._mystery_c4_calls_sample("shuffle(eligible.jar_id)[1:3]")
        @test !JuliaTime._mystery_c4_calls_sample("# sample\neligible.jar_id[randperm(4)[1:3]]")
        @test !haskey(JuliaTime._mystery_c4_explanation(true; uses_sample=false), "reminder")
        # The praise line: plain, one sentence, only when the code set a seed.
        praise = "Setting a seed makes your draw repeatable: good practice."
        @test occursin(praise, JuliaTime._mystery_c4_explanation(true, nothing; seeded=true)["julia"])
        @test !occursin(praise, JuliaTime._mystery_c4_explanation(true, nothing)["julia"])
    end

    @testset "C4 round 2 live: seeded fair draws pass; seeded hand-picks and repeats fail" begin
        JuliaTime.warmup!()
        try
            praise = "Setting a seed makes your draw repeatable: good practice."
            for code in ["Random.seed!(1); sample(eligible.jar_id, 3; replace=false)",
                         "using Random; Random.seed!(20260927); sample(eligible.jar_id, 3; replace = false)",
                         "rng = MersenneTwister(42)\nsample(rng, eligible.jar_id, 3; replace=false)"]
                reply = JuliaTime.mystery_c4_case_run(fb_c4_request(code))
                @test reply["status"] == "ok"
                @test reply["pass"] == true
                @test occursin(praise, reply["explanation"]["julia"])
                @test haskey(reply, "evidence")
            end
            # The shown run keeps the learner's seed: the same seed shows the same three jars.
            first_rows = [row["jar_id"] for row in JuliaTime.mystery_c4_case_run(fb_c4_request(
                "Random.seed!(1); sample(eligible.jar_id, 3; replace=false)"))["rows"]]
            again_rows = [row["jar_id"] for row in JuliaTime.mystery_c4_case_run(fb_c4_request(
                "Random.seed!(1); sample(eligible.jar_id, 3; replace=false)"))["rows"]]
            @test first_rows == again_rows
            # An unseeded fair draw passes with no praise line, and the eight reruns are quick.
            started = time()
            plain = JuliaTime.mystery_c4_case_run(fb_c4_request("sample(eligible.jar_id, 3; replace=false)"))
            @test time() - started < JuliaTime.MYSTERY_C4_RERUN_BUDGET
            @test plain["pass"] == true
            @test !occursin(praise, plain["explanation"]["julia"])
            @test haskey(plain["explanation"], "reminder")
            commented = JuliaTime.mystery_c4_case_run(fb_c4_request("# Random.seed!(1)\nsample(eligible.jar_id, 3; replace=false)"))
            @test commented["pass"] == true
            @test !occursin(praise, commented["explanation"]["julia"])
            shuffled = JuliaTime.mystery_c4_case_run(fb_c4_request("shuffle(eligible.jar_id)[1:3]"))
            @test shuffled["pass"] == true
            @test !haskey(shuffled["explanation"], "reminder")
            # Slow code stops within the shared budget and says why (r2-bugs.md: it took about 30 s).
            started = time()
            slow = JuliaTime.mystery_c4_case_run(fb_c4_request("sleep(1.0); sample(eligible.jar_id, 3; replace=false)"))
            @test time() - started < 1.0 + JuliaTime.MYSTERY_C4_RERUN_BUDGET + 3.0
            @test slow["pass"] == false
            @test slow["feedback"] == JuliaTime.MYSTERY_C4_SLOW_LINE
            # A seed line does not rescue a hand-picked list.
            for code in ["Random.seed!(1); eligible.jar_id[1:3]",
                         "Random.seed!(1); [\"J-091\", \"J-092\", \"J-094\"]"]
                reply = JuliaTime.mystery_c4_case_run(fb_c4_request(code))
                @test reply["pass"] == false
                @test occursin("same three jars", reply["feedback"])
                @test !occursin("seed", reply["feedback"])
            end
            # A seed line does not rescue a draw that can repeat a jar, whatever the seed.
            for s in 1:6, code in ["Random.seed!($s); sample(eligible.jar_id, 3)",
                                   "Random.seed!($s); rand(eligible.jar_id, 3)"]
                reply = JuliaTime.mystery_c4_case_run(fb_c4_request(code))
                @test reply["pass"] == false
                @test occursin("replace=false", reply["feedback"])
            end
        finally
            JuliaTime.shutdown!()
        end
    end

    # Round 2 (r2-teacher.md): typing exactly the taught code must not be answered with
    # "The taught way is ...", as if the learner had done something else.
    @testset "the taught-way line notices when the learner used the taught way" begin
        @test JuliaTime._mystery_used_taught("jars[jars.batch_id .== case_batch, :]", "jars[jars.batch_id .== case_batch, :]")
        @test JuliaTime._mystery_used_taught("jars[ jars.batch_id.==case_batch , : ]", "jars[jars.batch_id .== case_batch, :]")
        @test !JuliaTime._mystery_used_taught("jars[jars.batch_id .== \"B09\", :]", "jars[jars.batch_id .== case_batch, :]")
        @test JuliaTime._mystery_used_taught("b09 = jars[jars.batch_id .== case_batch, :]\nb09", "jars[jars.batch_id .== case_batch, :]")
        @test JuliaTime._mystery_used_taught("leftjoin(tray_counts, tally_sheet, on = :tray_id)", "leftjoin(tray_counts, tally_sheet, on=:tray_id)")
        @test !JuliaTime._mystery_used_taught("innerjoin(tray_counts, tally_sheet, on=:tray_id)", "leftjoin(tray_counts, tally_sheet, on=:tray_id)")
        @test !JuliaTime._mystery_used_taught(nothing, "x")
        @test !JuliaTime._mystery_used_taught("sample(eligible <> 3", "x")
        # Several taught statements must all be there.
        c6 = "fits_low = stories.lower .<= observed_count; fits_high = observed_count .<= stories.upper; stories[fits_low .& fits_high, :]"
        @test JuliaTime._mystery_used_taught(replace(c6, "; " => "\n"), c6)
        @test !JuliaTime._mystery_used_taught("stories[stories.lower .<= observed_count .<= stories.upper, :]", c6)

        taught = "The way this game teaches"
        used = "You used the way this game teaches"
        cases = [
            ("C1", "jars[jars.batch_id .== case_batch, :]", "filter(r -> r.batch_id == case_batch, jars)",
             code -> JuliaTime._mystery_explanation(true; code=code)["julia"]),
            ("C2 group", "groupby(jars, :tray_id)", "groupby(jars, \"tray_id\")",
             code -> JuliaTime._mystery_c2_explanation("group", true; code=code)["julia"]),
            ("C2 counts", "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts",
             "combine(groupby(jars, :tray_id), :detected => length => :n, :detected => sum => :detected_n)",
             code -> JuliaTime._mystery_c2_explanation("counts", true; code=code)["julia"]),
            ("C2 rates", "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n); counts.rate = counts.detected_n ./ counts.n; counts",
             "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n); counts.rate = counts.detected_n ./ counts.n .* 1; counts",
             code -> JuliaTime._mystery_c2_explanation("rates", true; code=code)["julia"]),
            ("C3 join", "leftjoin(tray_counts, tally_sheet, on=:tray_id)", "innerjoin(tray_counts, tally_sheet, on=:tray_id)",
             code -> JuliaTime._mystery_c3_explanation("join-report-log", true; code=code)["julia"]),
            ("C3 filter", "joined[joined.notebook_detected .!= joined.sheet_detected, :]", "filter(r -> r.notebook_detected != r.sheet_detected, joined)",
             code -> JuliaTime._mystery_c3_explanation("filter-disagreement", true; code=code)["julia"]),
            ("C3 practice", "leftjoin(practice_counts, practice_sheet, on=:key)", "innerjoin(practice_counts, practice_sheet, on=:key)",
             code -> JuliaTime._mystery_c3_explanation("join-report-log", nothing; mode="demonstration", code=code, practice_pass=true)["julia"]),
            ("C5 frequency", "events = sim_counts .>= observed_count\nsum(events) / length(events)", "mean(sim_counts .>= observed_count)",
             code -> JuliaTime._mystery_c5_explanation("event-frequency", true; code=code)["julia"]),
            ("C6", c6, "stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]",
             code -> JuliaTime._mystery_c6_explanation(true; code=code)["julia"]),
        ]
        for (name, same, other, line) in cases
            @testset "$name" begin
                @test occursin(used, line(same))
                @test !occursin(taught, line(same))
                @test occursin(taught, line(other))
                @test !occursin(used, line(other))
                @test occursin(taught, line(nothing))
                @test !occursin('—', line(same))
            end
        end
    end

    @testset "C5: wrong direction and the 1,000 wording" begin
        events = JuliaTime.mystery_c5_sim_counts() .> JuliaTime.mystery_c5_observed_count()
        # Round 7 (r7-bugs.md item 1): the claim needs the division in the code, not only the value.
        passed, feedback = JuliaTime.check_mystery_c5(sum(events) / length(events), "event-frequency";
                                                      code="sum(events) / length(events)")
        @test !passed
        @test !occursin("Divide", feedback)
        @test occursin(".>=", feedback)
        # A wrong denominator keeps the denominator advice.
        right = JuliaTime.mystery_c5_expected_events()
        @test occursin("Divide", JuliaTime.check_mystery_c5(sum(right) / 999, "event-frequency")[2])
        success = JuliaTime._mystery_c5_explanation("event-frequency", true)
        @test occursin("divided by 1,000 rounds", success["julia"])
        @test occursin("rounds in 1,000,", success["case"])
        @test !occursin(r"\b1000\b", success["julia"] * success["case"])
    end

    @testset "no line says the sheet itself says 0 (canon: its box was left blank)" begin
        for file in filter(f -> occursin(r"^mystery.*\.jl$", f), readdir(joinpath(@__DIR__, "..", "src")))
            text = read(joinpath(@__DIR__, "..", "src", file), String)
            @test !occursin(r"sheet (says|shows|reads) 0"i, text)
        end
        c3 = read(joinpath(@__DIR__, "..", "src", "mystery_c3.jl"), String)
        @test occursin("The notebook says 1 for tray T-C. On the tally sheet its box was left blank, and Toto typed a 0 for it in his table. That 0 is not a count: nobody counted anything there.", c3)
    end

    # Round 2 (r2-story.md A1, A2, A10, A13): one mechanism for the 0, as in the story spine.
    @testset "server text tells the one mechanism for the 0" begin
        for file in filter(f -> occursin(r"^mystery.*\.jl$", f), readdir(joinpath(@__DIR__, "..", "src")))
            text = read(joinpath(@__DIR__, "..", "src", file), String)
            @test !occursin("the report was typed from", text)
            @test !occursin("typed in for that blank", text)
            @test !occursin("recorded B09 tray summaries", text)
            @test !occursin("Recheck tray", text)
        end
        info = JuliaTime.mystery_c3_case_info(; move_id="join-report-log")
        @test [input["label"] for input in info["inputs"]] ==
            ["Your counts from the notebook (Chapter 2)", "Toto's typed copy of the tally sheet"]
        line = JuliaTime._mystery_c3_explanation("filter-disagreement", true)["case"]
        @test occursin("On the tally sheet, T-C's box was left blank. Toto typed a 0 into his table for that blank, and his report used it.", line)
        @test occursin("Toto jumped to two conclusions: a blank box became a 0, and one 0 became “dying out”.", line)
        summary = JuliaTime._mystery_c2_expected()
        @test JuliaTime._mystery_c2_check_summary(summary[:, [:tray_id, :n, :detected_n]], "counts") ==
            (true, "The counts come from the notebook's B09 rows.")
        @test JuliaTime._mystery_c2_check_summary(summary, "rates") ==
            (true, "The counts and each tray's share come from the notebook's B09 rows.")
        passed = JuliaTime._mystery_c4_result(request_id="r", status="ok", pass=true, rows=Any[])
        @test passed["result_visual"]["label"] == "Recheck jars: planned, not looked at yet"
        @test passed["evidence"]["title"] == "Recheck jars: planned, not looked at yet"
    end

    @testset "live runs: C4 fair picks pass, hand-picked and luck-only picks fail" begin
        JuliaTime.warmup!()
        try
            for code in ["sample(eligible.jar_id, 3; replace=false)",
                         "sample(eligible.jar_id, 3, replace=false)",
                         "ids = eligible.jar_id\nsample(ids, 3; replace=false)",
                         "shuffle(eligible.jar_id)[1:3]",
                         "eligible.jar_id[randperm(4)[1:3]]"]
                reply = JuliaTime.mystery_c4_case_run(fb_c4_request(code))
                @test reply["status"] == "ok"
                @test reply["pass"] == true
                @test reply["progress_eligible"] == true
            end
            for code in ["eligible.jar_id[1:3]", "[\"J-091\", \"J-092\", \"J-094\"]",
                         "shuffle(eligible.jar_id[1:3])"]
                reply = JuliaTime.mystery_c4_case_run(fb_c4_request(code))
                @test reply["status"] == "ok"
                @test reply["pass"] == false
                @test occursin("same three jars", reply["feedback"])
                @test !haskey(reply, "evidence")
            end
            # Without replace=false a single run passes about 3 times in 8; it must never pass.
            for code in ["sample(eligible.jar_id, 3)", "rand(eligible.jar_id, 3)"], _ in 1:6
                reply = JuliaTime.mystery_c4_case_run(fb_c4_request(code))
                @test reply["pass"] == false
                @test occursin("replace=false", reply["feedback"])
            end
            # The reruns are seeded, but the next shown pick is not: several passing runs differ.
            picks = Set{Vector{String}}()
            for _ in 1:8
                reply = JuliaTime.mystery_c4_case_run(fb_c4_request("sample(eligible.jar_id, 3; replace=false)"))
                push!(picks, [row["jar_id"] for row in reply["rows"]])
            end
            @test length(picks) > 1
        finally
            JuliaTime.shutdown!()
        end
    end
end

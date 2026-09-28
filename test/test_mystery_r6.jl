using Test
using DataFrames

# Round 6 consistency audit (2026-09-27, r6-audit.md items 1, 5, 8, 10, 11, 12, 13, 17). Wording only:
# what each step asks, the numbers and the answers stay the same. Canon (06-story-spine.md): after C3
# opens, the typed table is "Toto's typed copy"; "the paper tally sheet" names only the paper.

r6_py(code; kw...) = JuliaTime._mystery_coaching(code; kw...)

@testset "Round 6 wording" begin
    @testset "1: C3 names Toto's typed copy, never a bare 'the sheet'" begin
        step1 = JuliaTime.mystery_c3_case_info(; move_id="join-report-log")
        step2 = JuliaTime.mystery_c3_case_info(; move_id="filter-disagreement")
        practice = JuliaTime.mystery_c3_case_info(; move_id="join-report-log", mode="demonstration",
                                                  activity_id=JuliaTime.MYSTERY_C3_PRACTICE_ACTIVITY)
        @test step2["title"] == "Keep the tray where the notebook and Toto's typed copy disagree"
        @test step1["goal"] == "Line up the two tables by tray_id (a join). A successful join prepares a comparison; it does not yet say why any counts differ."
        @test practice["question"] == "Can each practice key be matched to one practice-sheet row?"
        move2 = only(m for m in step2["moves"] if m["id"] == "filter-disagreement")
        concept = "Keep a row only where the notebook count is not equal to Toto's typed count."
        @test move2["title"] == step2["title"]
        @test move2["concept"] == concept
        @test only(h["text"] for h in move2["hints"] if h["stage"] == "concept") == concept
        join_case = JuliaTime._mystery_c3_explanation("join-report-log", true)["case"]
        @test join_case == "Now each tray has its notebook count and Toto's typed count in one row."
        @test occursin("the notebook and Toto's typed copy disagree",
                       JuliaTime._mystery_c3_explanation("join-report-log", true; mode="demonstration")["limit"])
        # No player-facing C3 string says "the sheet", "sheet box", "sheet count" or "two sheets".
        texts = String[]
        collect_text(x) = x isa AbstractString ? push!(texts, x) :
            x isa AbstractDict ? foreach(collect_text, values(x)) :
            x isa AbstractVector ? foreach(collect_text, x) : nothing
        foreach(collect_text, (step1, step2, practice, join_case))
        for move in JuliaTime.MYSTERY_C3_MOVES, pass in (true, false)
            collect_text(JuliaTime._mystery_c3_explanation(move, pass))
        end
        collect_text(JuliaTime._mystery_c3_explanation("join-report-log", true; mode="demonstration"))
        for t in texts
            @test !occursin(r"\bthe sheet\b|sheet box|sheet count|two sheets|tally-sheet row"i, t)
        end
    end

    @testset "5: the not line names the column form" begin
        @test JuliaTime.MYSTERY_PY_NOT_LINE == "Julia writes ! for not, and .! for a whole column of true or false."
    end

    @testset "8: the // line says what to write instead" begin
        @test JuliaTime.MYSTERY_PY_FRACTION_LINE ==
            "In Julia, // makes an exact fraction, not Python's whole-number division. Use / for a decimal, or div(a, b) for a whole number."
    end

    @testset "10: the import line uses the word the player typed" begin
        @test r6_py("using CSV\njars") == "No using line is needed: the game has already loaded what this step uses. Delete the using line."
        @test r6_py("import pandas as pd\njars") == "No import line is needed: the game has already loaded what this step uses. Delete the import line."
        @test r6_py("from random import sample\nsample(x, 3)") == JuliaTime.MYSTERY_PY_IMPORT_LINE
        @test r6_py("using Plots: plot\nplot(1:3)") == JuliaTime.MYSTERY_PY_USING_LINE
        @test r6_py("using DataFrames\njars") == ""
    end

    @testset "11 and 12: range and zero lines say what Python means" begin
        @test JuliaTime.MYSTERY_PY_RANGE_LINE == "Python's range(n) counts 0 to n-1; Julia counts from 1 and writes 1:n."
        @test JuliaTime.MYSTERY_PY_ZERO_LINE == "Julia counts from 1, not 0: the first item is at position 1."
    end

    @testset "13: C2 prose says share; the column is still rate" begin
        summary = JuliaTime._mystery_c2_expected()
        @test JuliaTime._mystery_c2_check_summary(summary, "rates") ==
            (true, "The counts and each tray's share come from the notebook's B09 rows.")
    end

    @testset "17: C5 checker says rounds, not trials or events" begin
        expected = JuliaTime.mystery_c5_expected_events()
        wrong = copy(expected); wrong[findfirst(identity, wrong)] = false
        mask_msg = JuliaTime.check_mystery_c5(wrong, "event-mask")[2]
        freq_msg = JuliaTime.check_mystery_c5(0.1234, "event-frequency")[2]
        pair_bad = JuliaTime.check_mystery_c5((events=expected, frequency=0.1234), "event-frequency")[2]
        pair_ok = JuliaTime.check_mystery_c5((events=expected, frequency=sum(expected) / length(expected)),
                                             "event-frequency")[2]
        @test freq_msg == "Divide the rounds that matched by all 1,000 rounds."
        @test pair_bad == freq_msg
        for msg in (mask_msg, freq_msg, pair_bad, pair_ok)
            @test !occursin(r"trial|event count|an event is|matching-events"i, msg)
        end
        @test mask_msg == "Check the direction: a round counts when its count is at least the observed count."
    end
end

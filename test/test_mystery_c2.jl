using Test
using DataFrames
using Statistics

@testset "Missing Fleas C2 mystery API" begin
    @testset "case information describes the three staged summaries" begin
        reply = JuliaTime.mystery_c2_case_info()

        @test reply["type"] == "case"
        @test reply["chapter"] == "C2"
        @test reply["case_batch"] == "B09"
        @test reply["columns"] == ["jar_id", "batch_id", "tray_id", "detected"]
        @test length(reply["rows"]) == 6
        @test all(row -> row["batch_id"] == "B09", reply["rows"])
        @test [stage["id"] for stage in reply["steps"]] == ["group", "counts", "rates"]
        @test all(stage -> haskey(stage, "return_spec"), reply["steps"])
        terms = [entry["term"] for entry in reply["glossary"]]
        @test all(term -> term in terms, ["groupby", "combine", "nrow", "sum", "mean", "rate"])
        @test sort(collect(keys(reply["bridge"]))) == ["python", "r"]
    end

    @testset "checker accepts the required grouped partition and summaries" begin
        jars = filter(:batch_id => ==("B09"), JuliaTime.mystery_jars())
        # Pinned against the real seeded fixture, observed in the prior C1 browser receipt:
        # B09 has two detected jars in T-A, two in T-B, and one in T-C.
        @test jars.detected == Bool[true, true, true, true, true, false]
        grouped = groupby(jars, :tray_id)
        counts = combine(grouped, nrow => :n, :detected => sum => :detected_n)
        rates = combine(grouped, nrow => :n, :detected => sum => :detected_n,
                        :detected => mean => :rate)

        @test counts.tray_id == ["T-A", "T-B", "T-C"]
        @test counts.n == [2, 2, 2]
        @test counts.detected_n == [2, 2, 1]
        @test rates.rate == [1.0, 1.0, 0.5]

        @test JuliaTime.check_mystery_c2(grouped, "group")[1]
        @test JuliaTime.check_mystery_c2(counts, "counts")[1]
        @test JuliaTime.check_mystery_c2(rates, "rates")[1]

        @test JuliaTime.check_mystery_c2(groupby(reverse(jars), :tray_id), "group")[1]
        @test JuliaTime.check_mystery_c2(select(reverse(counts), :detected_n, :tray_id, :n), "counts")[1]
        @test JuliaTime.check_mystery_c2(DataFrame(
            tray_id = rates.tray_id, n = Float64.(rates.n),
            detected_n = Float64.(rates.detected_n), rate = Float32.(rates.rate),
        ), "rates")[1]
    end

    @testset "checker refuses malformed, incomplete, duplicate, and non-finite results" begin
        jars = filter(:batch_id => ==("B09"), JuliaTime.mystery_jars())
        grouped = groupby(jars, :tray_id)
        counts = combine(grouped, nrow => :n, :detected => sum => :detected_n)
        rates = combine(grouped, nrow => :n, :detected => sum => :detected_n,
                        :detected => mean => :rate)

        @test !JuliaTime.check_mystery_c2(jars, "group")[1]
        @test !JuliaTime.check_mystery_c2(groupby(jars, :batch_id), "group")[1]
        wrong_batch = filter(:batch_id => ==("B08"), JuliaTime.mystery_jars())
        @test !JuliaTime.check_mystery_c2(groupby(wrong_batch, :tray_id), "group")[1]
        @test !JuliaTime.check_mystery_c2(counts[1:2, :], "counts")[1]
        @test !JuliaTime.check_mystery_c2(vcat(counts, counts[1:1, :]), "counts")[1]
        bad_counts = copy(counts)
        bad_counts.n .= 3
        @test !JuliaTime.check_mystery_c2(bad_counts, "counts")[1]
        @test !JuliaTime.check_mystery_c2(select(counts, Not(:detected_n)), "counts")[1]
        bad_rate = copy(rates)
        bad_rate.rate[1] = NaN
        @test !JuliaTime.check_mystery_c2(bad_rate, "rates")[1]
        bad_missing = copy(rates)
        bad_missing.rate = Union{Missing, Float64}[missing; bad_missing.rate[2:end]]
        @test !JuliaTime.check_mystery_c2(bad_missing, "rates")[1]
        @test !JuliaTime.check_mystery_c2(rates, "unknown")[1]
    end

    @testset "runs echo step and award evidence only for the rate finding" begin
        JuliaTime.warmup!()
        try
            grouped = JuliaTime.mystery_c2_case_run(Dict(
                "request_id" => "c2-group", "step" => "group",
                "code" => "groupby(jars, :tray_id)",
            ))
            @test grouped["type"] == "case_result"
            @test grouped["chapter"] == "C2"
            @test grouped["request_id"] == "c2-group"
            @test grouped["step"] == "group"
            @test grouped["status"] == "ok"
            @test grouped["pass"] == true
            @test grouped["columns"] == ["jar_id", "batch_id", "tray_id", "detected"]
            @test length(grouped["rows"]) == 6
            @test all(row -> row["batch_id"] == "B09", grouped["rows"])
            @test !haskey(grouped, "evidence")

            counted = JuliaTime.mystery_c2_case_run(Dict(
                "request_id" => "c2-counts", "step" => "counts",
                "code" => "combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)",
            ))
            @test counted["pass"] == true
            @test counted["columns"] == ["tray_id", "n", "detected_n"]
            @test !haskey(counted, "evidence")

            accepted = JuliaTime.mystery_c2_case_run(Dict(
                "request_id" => "c2-rates", "step" => "rates",
                "code" => "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n); transform(counts, [:detected_n, :n] => ((detected_n, n) -> detected_n ./ n) => :rate)",
            ))
            @test accepted["pass"] == true
            @test accepted["step"] == "rates"
            @test accepted["columns"] == ["tray_id", "n", "detected_n", "rate"]
            @test haskey(accepted, "evidence")

            # Checker-equivalent finite numeric types must remain JSON numbers in the actual
            # result rows, not fall back to labelled displays intended for unsupported values.
            numeric_types = JuliaTime.mystery_c2_case_run(Dict(
                "request_id" => "c2-numeric-types", "step" => "rates",
                "code" => "DataFrame(tray_id = [\"T-A\", \"T-B\", \"T-C\"], n = Float32[2, 2, 2], detected_n = [2 // 1, 2 // 1, 1 // 1], rate = [1 // 1, 1 // 1, 1 // 2])",
            ))
            @test numeric_types["pass"] == true
            @test all(row -> row["n"] isa Float64, numeric_types["rows"])
            @test all(row -> row["detected_n"] isa Float64, numeric_types["rows"])
            @test all(row -> row["rate"] isa Float64, numeric_types["rows"])
            @test occursin("Rational", numeric_types["value_repr"])

            wrong = JuliaTime.mystery_c2_case_run(Dict(
                "request_id" => "c2-wrong", "step" => "rates",
                "code" => "DataFrame(tray_id = [\"T-A\", \"T-B\", \"T-C\"], n = [2, 2, 2], detected_n = [0, 0, 0], rate = [0.0, 0.0, 0.0])",
            ))
            @test wrong["pass"] == false
            @test !haskey(wrong, "evidence")

            # This checks the returned summary, not a claim that the server can observe a
            # worker-local mutation directly. Mutating the sandbox fixture changes the actual
            # summary and therefore fails its independent comparison.
            mutated = JuliaTime.mystery_c2_case_run(Dict(
                "request_id" => "c2-mutated", "step" => "rates",
                "code" => "jars.detected .= false; counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n); transform(counts, [:detected_n, :n] => ((detected_n, n) -> detected_n ./ n) => :rate)",
            ))
            @test mutated["pass"] == false
            @test !haskey(mutated, "evidence")

            # A correct-looking returned table is not enough if the player mutated the supplied
            # source table after calculating it. The sandbox's protected binding check catches
            # that final-state integrity failure before C2 can award evidence.
            source_mutated_after_summary = JuliaTime.mystery_c2_case_run(Dict(
                "request_id" => "c2-source-mutated", "step" => "rates",
                "code" => "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n); answer = transform(counts, [:detected_n, :n] => ((detected_n, n) -> detected_n ./ n) => :rate); jars.detected .= false; answer",
            ))
            @test source_mutated_after_summary["status"] == "error"
            @test source_mutated_after_summary["pass"] == false
            @test !haskey(source_mutated_after_summary, "evidence")
            # Repair 5 (2026-09-24 browser walk-through): this failed-run line is shown to the
            # learner, so it names the move in plain words, not the internal chapter id.
            @test source_mutated_after_summary["feedback"] == "Julia did not produce the requested result for this move."
            @test !occursin(r"\bC[1-6]\b", source_mutated_after_summary["feedback"])

            # Repair C2 (2026-09-24): web/chapter2.js coaches these common mistakes by matching
            # the sandbox's actual error text. Pin that text here so a Julia or DataFrames
            # upgrade that rewords it fails a test instead of silently dropping the coaching.
            c2_error(step, code) = JuliaTime.mystery_c2_case_run(Dict(
                "request_id" => "c2-coaching-key", "step" => step, "code" => code))["message"]
            @test occursin("UndefVarError: `tray_id` not defined",
                           c2_error("group", "groupby(jars, tray_id)"))
            @test occursin("no method matching iterate(::Symbol)",
                           c2_error("counts", "g = groupby(jars, :tray_id)\ncombine(g, n = nrow, detected_n = sum(:detected))"))
            @test occursin(r"no method matching combine\(.*;",
                           c2_error("counts", "combine(groupby(jars, :tray_id), n = nrow)"))
            @test occursin("no method matching combine(::Pair",
                           c2_error("counts", "combine(nrow => :n, :detected => sum => :detected_n)"))
            summary_line = "summary = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\n"
            @test occursin("only allowed to pass a vector as a column",
                           c2_error("rates", summary_line * "summary.rate = summary.detected_n / summary.n\nsummary"))
            @test occursin("cannot broadcast array to have fewer non-singleton dimensions",
                           c2_error("rates", summary_line * "summary[!, :rate] .= summary.detected_n / summary.n\nsummary"))
            # Repair 2 C2 (B12): the R $ and pandas-bracket keys that web/chapter2.js coaches.
            @test occursin("UndefVarError: `\$` not defined",
                           c2_error("rates", summary_line * "summary.rate = (summary\$detected_n) ./ (summary\$n)\nsummary"))
            @test occursin("UndefVarError: `\$` not defined", c2_error("group", "groupby(jars, jars\$tray_id)"))
            @test occursin("UndefVarError: `detected_n` not defined",
                           c2_error("rates", summary_line * "summary.rate = summary\$detected_n ./ summary\$n\nsummary"))
            @test occursin("syntax df[column] is not supported",
                           c2_error("rates", summary_line * "summary[\"rate\"] = summary[\"detected_n\"] ./ summary[\"n\"]\nsummary"))
            # Repair 3 C2 (R5): the counts and group keys that web/chapter2.js now coaches.
            groups_line = "groups = groupby(jars, :tray_id)\n"
            @test occursin("UndefVarError: `n` not defined",
                           c2_error("counts", groups_line * "combine(groups, nrow => n, :detected => sum => detected_n)"))
            @test occursin("UndefVarError: `detected_n` not defined",
                           c2_error("counts", groups_line * "combine(groups, nrow => :n, :detected => sum => detected_n)"))
            @test occursin("column name :n not found",
                           c2_error("counts", "combine(groupby(jars, :tray_id), :n => nrow, :detected_n => sum => :detected)"))
            @test occursin("column name \"detected_n\" not found",
                           c2_error("counts", "combine(groupby(jars, :tray_id), nrow => :n, :detected_n => sum => :detected)"))
            @test occursin("UndefVarError: `practice_jars` not defined", c2_error("group", "groupby(practice_jars, :tray_id)"))
            # Repair 4: in rates, a dot read of a column combine never made gives the same text.
            @test occursin("column name :detected_n not found",
                           c2_error("rates", "summary = combine(groupby(jars, :tray_id), nrow, :detected => sum)\nsummary.rate = summary.detected_n ./ summary.nrow\nsummary"))
            @test occursin("column name :n not found",
                           c2_error("rates", "summary = combine(groupby(jars, :tray_id), nrow => :count, :detected => sum => :detected_n)\nsummary.rate = summary.detected_n ./ summary.n\nsummary"))
            @test occursin("column name \"detected_n\" not found", c2_error("rates", "jars.rate = jars.detected_n ./ jars.n\njars"))
            # R5c: without groupby, combine runs and returns one row with no tray_id column; the
            # page keys its groupby line on exactly that returned shape.
            ungrouped = JuliaTime.mystery_c2_case_run(Dict("request_id" => "c2-ungrouped", "step" => "counts",
                "code" => "combine(jars, nrow => :n, :detected => sum => :detected_n)"))
            @test ungrouped["status"] == "ok"
            @test ungrouped["pass"] == false
            @test ungrouped["columns"] == ["n", "detected_n"]
            @test length(ungrouped["rows"]) == 1

            # B12: summary$rate = ... raises no error. Julia reads it as a new function named $,
            # so summary is returned unchanged; the feedback now says so before the column list.
            dollar = JuliaTime.mystery_c2_case_run(Dict("request_id" => "c2-dollar", "step" => "rates",
                "code" => summary_line * "summary\$rate = summary\$detected_n / summary\$n\nsummary"))
            @test dollar["status"] == "ok"
            @test dollar["pass"] == false
            @test dollar["columns"] == ["tray_id", "n", "detected_n"]
            @test startswith(dollar["feedback"], "Julia read summary\$rate = ... as a new function named \$")
            @test occursin("summary.rate", dollar["feedback"])
            @test endswith(dollar["feedback"], "Return exactly these columns: tray_id, n, detected_n, rate.")
            no_return = JuliaTime.mystery_c2_case_run(Dict("request_id" => "c2-dollar-last", "step" => "rates",
                "code" => summary_line * "summary\$rate = summary\$detected_n ./ summary\$n"))
            @test no_return["pass"] == false
            @test startswith(no_return["feedback"], "Julia read summary\$rate = ... as a new function named \$")

            # B14: row_text carries Julia's own printed text for each numeric cell, because JSON
            # turns Julia's Float64 1.0 into the browser number 1.
            reference = JuliaTime.mystery_c2_case_run(Dict("request_id" => "c2-row-text", "step" => "rates",
                "code" => summary_line * "summary.rate = summary.detected_n ./ summary.n\nsummary"))
            @test reference["pass"] == true
            @test !startswith(reference["feedback"], "Julia read")
            @test [row["rate"] for row in reference["row_text"]] == ["1.0", "1.0", "0.5"]
            @test [row["n"] for row in reference["row_text"]] == ["2", "2", "2"]
            @test all(row -> !haskey(row, "tray_id"), reference["row_text"])
            @test length(reference["row_text"]) == length(reference["rows"])
            numeric_text = JuliaTime.mystery_c2_case_run(Dict("request_id" => "c2-row-text-types", "step" => "rates",
                "code" => "DataFrame(tray_id = [\"T-A\", \"T-B\", \"T-C\"], n = Float32[2, 2, 2], detected_n = [2, 2, 1], rate = [1 // 1, 1 // 1, 1 // 2])"))
            @test [row["rate"] for row in numeric_text["row_text"]] == ["1//1", "1//1", "1//2"]
            @test [row["n"] for row in numeric_text["row_text"]] == ["2.0", "2.0", "2.0"]
        finally
            JuliaTime.shutdown!()
        end
    end

    @testset "learner-facing C2 explanations carry no literal Markdown backticks" begin
        # UI-14: the client writes these strings with textContent, so a backtick shows on
        # screen as a stray character (and is Julia command-literal syntax if copied).
        for step in JuliaTime.MYSTERY_C2_STEPS, pass in (true, false)
            for text in values(JuliaTime._mystery_c2_explanation(step, pass))
                @test !occursin('`', text)
            end
        end
    end

    @testset "R's name\$column = ... is recognised from Julia's own parse only" begin
        note = JuliaTime._mystery_c2_dollar_note
        @test startswith(something(note("summary\$rate = summary\$detected_n / summary\$n"), ""),
                         "Julia read summary\$rate = ... as a new function named \$")
        @test occursin("tally.share", something(note("x = 1\nbegin\n  tally\$share = 2\nend"), ""))
        @test note("summary.rate = summary.detected_n ./ summary.n\nsummary") === nothing
        @test note("label = \"tray \$(1)\"\nx\$y") === nothing   # interpolation and a $ read
        @test note("summary\$rate(x) = 1") === nothing
        @test note("summary\$rate = (") === nothing              # incomplete code does not throw
        @test !occursin('—', something(note("a\$b = 1"), ""))
    end

    @testset "invalid requests do not produce evidence" begin
        blank = JuliaTime.mystery_c2_case_run(Dict(
            "request_id" => "c2-blank", "step" => "rates", "code" => "   ",
        ))
        @test blank["status"] == "error"
        @test blank["step"] == "rates"
        @test !haskey(blank, "evidence")

        malformed = JuliaTime.mystery_c2_case_run(Dict(
            "request_id" => 1, "step" => "rates", "code" => 2,
        ))
        @test malformed["status"] == "error"
        @test malformed["pass"] == false
        @test !haskey(malformed, "evidence")
    end
end

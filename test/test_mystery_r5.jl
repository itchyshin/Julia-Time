using Test
using DataFrames

# Round 5 night playtest (2026-09-27, r5-bugs.md items 1, 2, 4, 5, 6 and 8). The rule: a habit
# line must never hide the real, more useful message. A line is given only when the habit is in the
# code (not in a string or comment) and, for //, only when the fraction caused the failure.

r5_py(code; kw...) = JuliaTime._mystery_coaching(code; kw...)
r5_c1(code) = Dict{String, Any}("request_id" => "r5-c1", "code" => code)
r5_c5(move_id, code) = c5_run_request(move_id, code, "c5-simulated-counts-v1"; request_id="r5-c5")
const R5_RATIONAL_MESSAGE = "ArgumentError: invalid index: 1//1 of type Rational{Int64}"

@testset "Round 5 coaching never hides the real message" begin
    @testset "false positives: correct or tricky Julia gets no coaching" begin
        snippets = (
            "jars[jars.batch_id .== case_batch, :]",
            "r = 1//2\njars[jars.batch_id .== \"B08\", :]",
            "sum(sim_counts .> observed_count) // length(sim_counts)",
            "counts.rate = counts.n .// counts.detected_n",
            "using DataFrames: nrow\njars[jars.batch_id .== \"B08\", :]",
            "using DataFrames: nrow, subset\nstories[stories.lower .<= observed_count, :]",
            "using Random: shuffle, randperm\nshuffle(eligible.jar_id)[1:3]",
            "import Statistics: mean\nmean(events)",
            "msg = \"\"\"\nnot here, len(x), True, import pandas\n\"\"\"\njars",
            "#= import pandas\nlen(x) True 'B09' =#\njars",
            "#= outer #= inner len(x) =# still None and or =#\njars",
            "x = Int[0]",
            "y = Float64[0, 1]",
            "v = [0]",
            "v = [0, 1][1]",
            "band = 1; orbit = 2; android = 3; score = band + orbit",
            "x_and = 1; or_x = 2; defaults = 3; undef_x = 4",
            "xor(true, false)",
            "(jars.batch_id .== case_batch) .& jars.detected",
            "a = true; b = false; a && b || !a",
            "x = nothing",
            "x = missing",
            "if a\n    1\nelseif b\n    2\nelse\n    3\nend",
            "function f(x)\n    x + 1\nend",
            "f(x) = x + 1",
            "jars[1:6, :]",
            "range(1, 6; length=6)",
            "range(0, 3)",
            "lens = length(jars.jar_id); len_x = 3",
            "s = :len; t = :and; u = :or",
            "x = \"None and or elif def range(3) len(x)\"\nx",
            "# None and or def elif range(3)\njars",
            "c = 'B'",
            "x'",
            "combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)",
            "sim_counts .≥ observed_count",
            "jars.jar_id[end]",
            "Nonez = 1; NoneType = 2",
            "merge(Dict(:a => 1), Dict(:b => 2))",
            "x = r\"and|or\"",
            "x = 5 # print(x)\nx",
            "println(\"x\")\njars",
            "t = \"\"\"Toto's 'typed' copy\"\"\"\nt",
        )
        @test length(snippets) >= 30
        for code in snippets, message in ("", "MethodError: no method matching foo(::Int64)")
            @test (code, message, r5_py(code; message=message)) == (code, message, "")
        end
    end

    @testset "1: // only when the fraction caused the failure" begin
        @test r5_py("x = 1//2\njars[x, :]"; message=R5_RATIONAL_MESSAGE) == JuliaTime.MYSTERY_PY_FRACTION_LINE
        @test r5_py("sample(eligible.jar_id, 6//2)";
            message="MethodError: no method matching sample(::Vector{String}, ::Rational{Int64})") ==
            JuliaTime.MYSTERY_PY_FRACTION_LINE
        @test r5_py("sum(events) // length(events) + 1"; message="") == ""
    end

    @testset "2: using Module: name is not a Python import" begin
        @test r5_py("using Plots: plot\nplot(1:3)") == JuliaTime.MYSTERY_PY_USING_LINE
        @test r5_py("import pandas as pd\njars") == JuliaTime.MYSTERY_PY_IMPORT_LINE
        @test r5_py("from random import sample\nsample(x, 3)") == JuliaTime.MYSTERY_PY_IMPORT_LINE
    end

    @testset "3: the zero line is for indexing" begin
        @test JuliaTime.MYSTERY_PY_ZERO_LINE == "Julia counts from 1, not 0: the first item is at position 1."
        for code in ("eligible.jar_id[0]", "sim_counts[0]", "jars[0:3, :]", "jars[0, :]", "f(x)[0]")
            @test r5_py(code) == JuliaTime.MYSTERY_PY_ZERO_LINE
        end
    end

    @testset "4: more Python words, only as code" begin
        and_line = r5_py("jars[(jars.batch_id .== case_batch) and (jars.detected), :]")
        @test and_line == JuliaTime.MYSTERY_PY_AND_LINE
        @test occursin(".&", and_line) && occursin("&&", and_line)
        or_line = r5_py("jars[(jars.batch_id .== \"B08\") or (jars.batch_id .== \"B09\"), :]")
        @test or_line == JuliaTime.MYSTERY_PY_OR_LINE
        @test occursin(".|", or_line) && occursin("||", or_line)
        @test r5_py("x = None") == JuliaTime.MYSTERY_PY_NONE_LINE
        @test occursin("nothing", JuliaTime.MYSTERY_PY_NONE_LINE) && occursin("missing", JuliaTime.MYSTERY_PY_NONE_LINE)
        @test r5_py("if a\n    1\nelif b\n    2\nend") == JuliaTime.MYSTERY_PY_ELIF_LINE
        @test occursin("elseif", JuliaTime.MYSTERY_PY_ELIF_LINE)
        @test startswith(r5_py("def f(x):\n    return x + 1"), JuliaTime.MYSTERY_PY_DEF_LINE)
        @test occursin("function", JuliaTime.MYSTERY_PY_DEF_LINE) && occursin("end", JuliaTime.MYSTERY_PY_DEF_LINE)
        @test r5_py("jars[range(3), :]") == JuliaTime.MYSTERY_PY_RANGE_LINE
        @test r5_py("x = [c for c in range(len(sim_counts))]") ==
              JuliaTime.MYSTERY_PY_LEN_LINE * " " * JuliaTime.MYSTERY_PY_RANGE_LINE
        @test occursin("1:n", JuliaTime.MYSTERY_PY_RANGE_LINE)
    end

    @testset "5: len as a bare function name" begin
        @test r5_py("combine(groupby(jars, :tray_id), :detected => len => :n)") == JuliaTime.MYSTERY_PY_LEN_LINE
        @test r5_py("map(len, groups)") == JuliaTime.MYSTERY_PY_LEN_LINE
        @test r5_py("n = len"; message="UndefVarError: `len` not defined") == JuliaTime.MYSTERY_PY_LEN_LINE
    end

    @testset "6: small wording fixes" begin
        @test JuliaTime.MYSTERY_PY_MERGE_LINE == "For tables, Julia uses leftjoin, not merge."
        @test r5_py("pd.merge(tray_counts, tally_sheet, on=\"tray_id\")") == JuliaTime.MYSTERY_PY_MERGE_LINE
        @test JuliaTime._mystery_c5_uses_dotted_ge("sim_counts .≥ observed_count")
        @test JuliaTime._mystery_c5_uses_dotted_ge("0 .<= observed_count .≥ sim_counts")
    end

    @testset "Julia forms named in the new lines run" begin
        @test ([true, false] .& [true, true]) == [true, false]
        @test ([true, false] .| [false, false]) == [true, false]
        @test (true && false) == false && (true || false) == true
        @test collect(1:3) == [1, 2, 3]
        @test nothing === nothing && ismissing(missing)
        @test merge(Dict(:a => 1), Dict(:b => 2)) == Dict(:a => 1, :b => 2)
    end

    @testset "end to end: the chapter keeps its own feedback" begin
        JuliaTime.warmup!()
        try
            c1 = JuliaTime.mystery_case_run(r5_c1("r = 1//2\njars[jars.batch_id .== \"B08\", :]"))
            @test c1["pass"] == false
            @test c1["coaching"] == ""
            @test c1["feedback"] != JuliaTime.MYSTERY_PY_FRACTION_LINE
            c1_using = JuliaTime.mystery_case_run(r5_c1("using DataFrames: nrow\njars[jars.batch_id .== \"B08\", :]"))
            @test c1_using["pass"] == false
            @test c1_using["coaching"] == ""
            c1_and = JuliaTime.mystery_case_run(r5_c1("jars[(jars.batch_id .== case_batch) and (jars.detected), :]"))
            @test c1_and["coaching"] == JuliaTime.MYSTERY_PY_AND_LINE
            c1_ok = JuliaTime.mystery_case_run(r5_c1("using DataFrames: nrow\n" * JuliaTime.MYSTERY_C1_TAUGHT))
            @test c1_ok["pass"] == true

            c2 = JuliaTime.mystery_c2_case_run(Dict{String, Any}("request_id" => "r5-c2", "step" => "rates",
                "code" => "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate = counts.n .// counts.detected_n\ncounts"))
            @test c2["pass"] == false
            @test c2["coaching"] == ""
            c2_len = JuliaTime.mystery_c2_case_run(Dict{String, Any}("request_id" => "r5-c2l", "step" => "counts",
                "code" => "combine(groupby(jars, :tray_id), :detected => len => :n)"))
            @test c2_len["pass"] == false
            @test c2_len["coaching"] == JuliaTime.MYSTERY_PY_LEN_LINE

            c5 = JuliaTime.mystery_c5_case_run(r5_c5("event-frequency",
                "sum(sim_counts .> observed_count) // length(sim_counts)"))
            @test c5["pass"] == false
            @test c5["coaching"] != JuliaTime.MYSTERY_PY_FRACTION_LINE
            @test c5["feedback"] != JuliaTime.MYSTERY_PY_FRACTION_LINE
            c5_ge = JuliaTime.mystery_c5_case_run(r5_c5("event-mask", "sim_counts .≥ observed_count"))
            @test c5_ge["pass"] == true
            @test occursin(".>=", c5_ge["explanation"]["julia"])
        finally
            JuliaTime.shutdown!()
        end
    end
end

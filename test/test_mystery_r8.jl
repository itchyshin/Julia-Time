using Test
using DataFrames

# Round 8 (2026-09-28, r8-fuzz.md items 1 to 8 and r8-audit.md items 9 and 10). A correct answer is
# never refused, and a coaching line never fires on correct code, never hides a more useful line,
# and names what Julia actually stopped on.

r8_coach(code; kw...) = JuliaTime._mystery_coaching(code; kw...)
r8_undef(name) = "$(name) is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `$(name)` not defined"
const R8_ISLESS = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching isless(::Vector{Int64}, ::Int64)"
const R8_ISLESS_RIGHT = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching isless(::Int64, ::Vector{Int64})"
const R8_BOOL_ROW = "Something went wrong running this line.\n\nArgumentError: invalid row index of type Bool"
const R8_JARS = (:jars => JuliaTime.MYSTERY_COLUMNS,)
const R8_STORIES = (:stories => JuliaTime.MYSTERY_C6_COLUMNS,)
const R8_JOINED = (:joined => JuliaTime.MYSTERY_C3_JOIN_COLUMNS,)
const R8_ELIGIBLE = (:eligible => JuliaTime.MYSTERY_C4_ELIGIBLE_COLUMNS,)
r8_dot(op) = "Add a dot: write .$(op) instead of $(op), so Julia compares every value, one at a time. In R and pandas a plain $(op) already does that; Julia needs the dot."

r8_c1(code) = Dict{String, Any}("request_id" => "r8-c1", "code" => code)
r8_c2(step, code) = Dict{String, Any}("request_id" => "r8-c2", "step" => step, "code" => code)
r8_envelope(chapter, move_id, code; simulation_id=nothing) = Dict{String, Any}(
    "type" => "case_run", "contract_version" => 1, "case_id" => "missing-fleas-v1",
    "chapter" => chapter, "move_id" => move_id, "mode" => "challenge", "activity_id" => nothing,
    "simulation_id" => simulation_id, "request_id" => "r8-$(lowercase(chapter))", "code" => code)
r8_c3(move_id, code) = JuliaTime.mystery_c3_case_run(r8_envelope("C3", move_id, code))
r8_c4(code) = JuliaTime.mystery_c4_case_run(r8_envelope("C4", "plan-distinct-recheck", code))
r8_c5(move_id, code) = JuliaTime.mystery_c5_case_run(r8_envelope("C5", move_id, code;
    simulation_id="c5-simulated-counts-v1"))
r8_c6(code) = JuliaTime.mystery_c6_case_run(r8_envelope("C6", "compatible-models", code))

@testset "Round 8: correct loops, honest coaching" begin
    @testset "1: a counter named after a loaded function is accepted in C3 to C6" begin
        JuliaTime.warmup!()
        loop(name, over) = "$(name) = 0\nfor r in $(over)\n    $(name) += 1\nend\n"
        # C5: the fuzz's own case, with every counter name it found refused.
        for name in ("count", "sum", "length", "first", "filter", "mean", "sample", "rate", "nrow", "keys")
            code = "$(name) = 0\nfor c in sim_counts\n    if c >= observed_count\n        $(name) += 1\n    end\nend\n$(name) / 1000"
            reply = r8_c5("event-frequency", code)
            @test (name, reply["status"], reply["pass"]) == (name, "ok", true)
        end
        reply = r8_c5("event-frequency",
            "count = 0\nfor c in sim_counts\n    if c >= observed_count\n        count += 1\n    end\nend\ncount / length(sim_counts)")
        @test (reply["status"], reply["pass"]) == ("ok", true)
        for name in ("count", "sum", "filter")
            reply = r8_c3("filter-disagreement", loop(name, "eachrow(joined)") *
                "joined[joined.notebook_detected .!= joined.sheet_detected, :]")
            @test (name, reply["status"], reply["pass"]) == (name, "ok", true)
            reply = r8_c3("join-report-log", loop(name, "eachrow(tray_counts)") *
                "leftjoin(tray_counts, tally_sheet, on=:tray_id)")
            @test (name, reply["status"], reply["pass"]) == (name, "ok", true)
        end
        for name in ("count", "length", "sum")
            reply = r8_c4(loop(name, "1:3") * "sample(eligible.jar_id, $(name), replace=false)")
            @test (name, reply["status"], reply["pass"]) == (name, "ok", true)
        end
        for name in ("count", "nrow", "first")
            reply = r8_c6("keep = Bool[]\n" * "$(name) = 0\nfor r in eachrow(stories)\n    $(name) += 1\n" *
                "    push!(keep, r.lower <= observed_count <= r.upper)\nend\nstories[keep, :]")
            @test (name, reply["status"], reply["pass"]) == (name, "ok", true)
        end
        # Soft scope still works as in C1 and C2, and quotes, backslashes and $ inside the learner's
        # text reach Julia unchanged.
        reply = r8_c5("event-frequency",
            "note = \"cost \\\$5 \\\\ 'x' \\\"quoted\\\"\"\nsep = '\\n'\ni = 0\nwhile i < 3\n    i += 1\nend\nsum(sim_counts .>= observed_count) / length(sim_counts)")
        @test (reply["status"], reply["pass"]) == ("ok", true)
        # An error names the learner's own line, not a wrapper line.
        reply = r8_c5("event-frequency", "x = 1\ny = 2\nerror(\"stop here\")")
        @test reply["status"] == "error"
        @test occursin("stop here", reply["message"])
        @test !occursin("__juliatime", reply["message"])
    end

    @testset "1: every guard still keeps its meaning" begin
        JuliaTime.warmup!()
        reply = r8_c5("event-frequency", "sim_counts = copy(sim_counts)\nsum(sim_counts .>= observed_count) / 1000")
        @test reply["status"] == "error"
        @test occursin("The supplied sim_counts values were changed", reply["message"])
        reply = r8_c3("filter-disagreement", "joined = copy(joined)\njoined[joined.notebook_detected .!= joined.sheet_detected, :]")
        @test reply["status"] == "error"
        @test occursin("The supplied table joined was changed", reply["message"])
        reply = r8_c4("eligible = copy(eligible)\nsample(eligible.jar_id, 3, replace=false)")
        @test reply["status"] == "error"
        @test occursin("The supplied table eligible was changed", reply["message"])
        reply = r8_c6("stories = copy(stories)\nstories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]")
        @test reply["status"] == "error"
        @test occursin("The supplied table stories was changed", reply["message"])
        reply = r8_c6("stories.upper[1] = 6\nstories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]")
        @test reply["status"] == "error"
        @test occursin("stories", reply["message"]) && occursin("changed", reply["message"])
        # The wrapper text itself carries the learner's code as one literal, never as bare lines.
        wrapped = JuliaTime._mystery_c5_guarded_code("count = 0\ncount")
        @test !occursin("begin", wrapped)
        @test occursin(repr("count = 0\ncount"), wrapped)
    end

    @testset "false positives: none of the new lines fire on correct code" begin
        snippets = (
            "jars[jars.batch_id .== case_batch, :]",
            "sep = '\\n'\njars[jars.batch_id .== case_batch, :]",
            "jars[strip.(jars.batch_id, '\\t') .== case_batch, :]",
            "x = '\\\\'; y = '\\''; z = '\\u00e9'; jars",
            "jars[[ifelse(b == case_batch, true, false) for b in jars.batch_id], :]",
            "[ifelse(c >= observed_count, true, false) for c in sim_counts]",
            "ifelse.(sim_counts .>= observed_count, true, false)",
            "jars[findall(jars.batch_id .== case_batch), :]",
            "Random.seed!(1); sample(eligible.jar_id, 3; replace=false)",
            "leftjoin(tray_counts, tally_sheet, on=:tray_id)",
            "joined[.!(joined.notebook_detected .== joined.sheet_detected), :]",
            "sum(sim_counts .>= observed_count) / length(sim_counts)",
            "mean(sim_counts .>= observed_count)",
            "sim_counts .>= observed_count |> sum",
            "merge(Dict(:a => 1), Dict(:b => 2))",
            "len = 6; sum(sim_counts .>= observed_count) / max(len, 1)",
            "first(jars, 6)",
            "stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]",
            "stories[stories.lower .<= observed_count .& observed_count .<= stories.upper, :]",
            "msg = \"a\$b %>% set.seed(1) head(jars) x.loc[1] x.query(y) x.mean()\"\njars",
            "# eligible\$jar_id set.seed(1) %>% merge(a, b, by = 1) !(x) .loc[ .query( .mean()\njars",
        )
        tables = (:jars => JuliaTime.MYSTERY_COLUMNS, :stories => JuliaTime.MYSTERY_C6_COLUMNS,
                  :joined => JuliaTime.MYSTERY_C3_JOIN_COLUMNS, :eligible => ["jar_id"])
        for code in snippets, message in ("", "MethodError: no method matching foo(::Int64)")
            @test (code, message, r8_coach(code; message=message, tables=tables, case_batch=true)) ==
                  (code, message, "")
        end
        @test JuliaTime._mystery_c6_coaching(
            "stories[stories.lower .<= observed_count .& observed_count .<= stories.upper, :]") == ""
        @test JuliaTime._mystery_c3_coaching(
            "joined[joined.notebook_detected .!= joined.sheet_detected, :]", "filter-disagreement", "challenge") == ""
    end

    @testset "2 and 7: a missing dot is named first, before brackets, which, ifelse or TRUE" begin
        @test JuliaTime._mystery_c6_coaching(
            "stories[stories.lower <= observed_count & observed_count <= stories.upper, :]"; message=R8_ISLESS) ==
            r8_dot("<=")
        @test JuliaTime._mystery_c6_coaching(
            "stories[(stories.lower <= observed_count) & (observed_count <= stories.upper), :]"; message=R8_ISLESS) ==
            r8_dot("<=")
        @test JuliaTime._mystery_c6_coaching(
            "stories[(stories.lower .<= observed_count) .& (observed_count <= stories.upper), :]"; message=R8_ISLESS_RIGHT) ==
            r8_dot("<=")
        # The brackets line stays for the dotted form, where brackets really are the fix.
        @test JuliaTime._mystery_c6_coaching(
            "stories[stories.lower .<= observed_count .& stories.upper .>= observed_count, :]") ==
            JuliaTime.MYSTERY_C6_BRACKETS_LINE
        @test r8_coach("which(sim_counts >= observed_count)"; message=R8_ISLESS) ==
            r8_dot(">=") * " Julia's findall is like R's which."
        @test r8_coach("ifelse(sim_counts >= observed_count, TRUE, FALSE)"; message=R8_ISLESS) ==
            r8_dot(">=") * " TRUE is R's spelling: Julia writes true."
        @test r8_coach("jars[jars.batch_id == \"B09\", :]"; message=R8_BOOL_ROW, tables=R8_JARS) == r8_dot("==")
        @test r8_coach("joined[joined.notebook_detected != joined.sheet_detected, :]"; message=R8_BOOL_ROW,
                       tables=R8_JOINED) == r8_dot("!=")
        @test r8_coach("sim_counts < observed_count";
                       message="MethodError: no method matching <(::Vector{Int64}, ::Int64)") == r8_dot("<")
        # ! on a whole column.
        @test r8_coach("joined[!(joined.notebook_detected .== joined.sheet_detected), :]";
                       message="MethodError: no method matching !(::BitVector)", tables=R8_JOINED) ==
            "Add a dot: write .! instead of !, so Julia flips every true or false, one at a time. A plain ! works on one value."
    end

    @testset "7: the which line is true in each chapter" begin
        @test r8_coach("jars[which(jars.batch_id .== case_batch), :]"; which_tail=JuliaTime.MYSTERY_R_WHICH_RULE_TAIL) ==
            "Julia's findall is like R's which. Here a true/false rule inside the brackets is simpler."
        @test r8_coach("which(jars.tray_id)") == "Julia's findall is like R's which."
        # C2 and C4 steps use no true/false rule, so their chapters say only the first sentence.
        @test JuliaTime._mystery_c2_coaching("which(jars.detected)") == "Julia's findall is like R's which."
    end

    @testset "3: a character escape is not text in single quotes" begin
        @test r8_coach("sep = '\\n'\njars[jars.batch_id .== \"B9\", :]"; tables=R8_JARS) == ""
        @test r8_coach("join(counts.tray_id, '\\n')") == ""
        @test r8_coach("jars[jars.batch_id .== 'B09', :]"; tables=R8_JARS) ==
            "In Julia, text goes in double quotes: \"B09\". Single quotes are for one character."
    end

    @testset "4: the ifelse line needs ifelse on a whole column" begin
        way = ".== compares every jar at once."
        @test r8_coach("jars[[ifelse(b == \"B08\", true, false) for b in jars.batch_id], :]"; way=way, tables=R8_JARS) == ""
        @test r8_coach("ifelse(sim_counts .>= observed_count, true, false)"; way=way,
                       message="MethodError: no method matching ifelse(::BitVector, ::Bool, ::Bool)") ==
            "Julia has ifelse too, but this step needs no ifelse: " * way
        @test r8_coach("jars[ifelse(jars.batch_id .== case_batch, true, false), :]"; way=way, tables=R8_JARS) ==
            "Julia has ifelse too, but this step needs no ifelse: " * way
    end

    @testset "5 and 6: R's \$ first, and x[rule, ] gets its own line" begin
        dollar_undef = r8_undef("\$")
        @test JuliaTime._mystery_c3_coaching("joined[joined\$notebook_detected != joined\$sheet_detected, ]",
                "filter-disagreement", "challenge"; message=dollar_undef) ==
            "R's \$ does not exist in Julia: write joined.notebook_detected, not joined\$notebook_detected."
        @test JuliaTime._mystery_c3_coaching("joined[joined.notebook_detected .!= joined.sheet_detected, ]",
                "filter-disagreement", "challenge") == "Julia needs : after the comma: joined[rule, :]."
        @test JuliaTime._mystery_c3_coaching("joined[joined.notebook_detected .!= joined.sheet_detected]",
                "filter-disagreement", "challenge") == JuliaTime.MYSTERY_C3_ADD_COMMA_LINE
        @test r8_coach("sample(eligible\$jar_id, 3, replace = FALSE)"; message=dollar_undef, tables=R8_ELIGIBLE) ==
            "R's \$ does not exist in Julia: write eligible.jar_id, not eligible\$jar_id. FALSE is R's spelling: Julia writes false."
        @test JuliaTime._mystery_c6_coaching(
            "stories[(stories\$lower .<= observed_count) .& (observed_count .<= stories\$upper), :]"; message=dollar_undef) ==
            "R's \$ does not exist in Julia: write stories.lower, not stories\$lower."
        # C2 keeps its own lines: table$col = ... (the server note) and $ inside groupby (the page's
        # colon line). A table the learner made is named with its own names.
        counts = "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\n"
        @test JuliaTime._mystery_c2_coaching(counts * "counts\$rate = counts\$detected_n / counts\$n\ncounts") == ""
        @test JuliaTime._mystery_c2_coaching("groupby(jars, jars\$tray_id)"; message=dollar_undef) == ""
        @test JuliaTime._mystery_c2_coaching(counts * "counts.rate = counts\$detected_n ./ counts.n\ncounts";
                                             message=dollar_undef) ==
            "R's \$ does not exist in Julia: write counts.detected_n, not counts\$detected_n."
        # sim_counts is a list, not a table, so its own names are not offered.
        @test r8_coach("sim_counts\$x .>= observed_count"; message=dollar_undef) ==
            "R's \$ does not exist in Julia: Julia reads a column of a table with a dot, as in table.column."
    end

    @testset "8: habits that had no line" begin
        @test r8_coach("set.seed(1)\nsample(eligible.jar_id, 3, replace=false)"; message=r8_undef("set"),
                       tables=R8_ELIGIBLE) == "Julia writes Random.seed!(1), not set.seed(1)."
        @test r8_coach("set.seed(42)"; message=r8_undef("set")) == "Julia writes Random.seed!(42), not set.seed(42)."
        by_line = "Julia's leftjoin uses on=, not by=."
        @test r8_coach("leftjoin(tray_counts, tally_sheet, by = \"tray_id\")";
                       message="MethodError: no method matching leftjoin(::DataFrame, ::DataFrame; by::String)") == by_line
        @test r8_coach("merge(tray_counts, tally_sheet, by = \"tray_id\")"; message=r8_undef("merge")) ==
            JuliaTime.MYSTERY_PY_MERGE_LINE * " " * by_line
        @test r8_coach("jars %>% filter(batch_id == \"B09\")") |> x -> startswith(x, "Julia's pipe is |>, and this step needs no pipe.")
        @test r8_coach("jars.loc[jars.batch_id == \"B09\"]"; tables=R8_JARS) ==
            "Julia has no .loc: the row rule goes straight in the brackets, as in jars[rule, :]."
        @test r8_coach("joined.query(\"notebook_detected != sheet_detected\")"; tables=R8_JOINED) ==
            "Julia has no .query: the row rule goes straight in the brackets, as in joined[rule, :]."
        @test r8_coach("(sim_counts .>= observed_count).mean()") ==
            "Julia has no .mean(): put the values inside mean( ), as in mean(x)."
        @test JuliaTime._mystery_c6_coaching("stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper)]";
                message="MethodError: no method matching getindex(::DataFrame, ::BitVector)") ==
            JuliaTime.MYSTERY_C3_ADD_COMMA_LINE
        @test r8_coach("sum(sim_counts .>= observed_count) / 1000 |> println") == JuliaTime.MYSTERY_PY_PRINT_LINE
        @test r8_coach("x = sum(sim_counts .>= observed_count) / 1000\nx |> println") == JuliaTime.MYSTERY_PY_PRINT_LINE
        # The learner's own len is a name, not Python's len.
        @test r8_coach("len = 6; sum(events) / max(len, 1)"; message=r8_undef("events")) == ""
        @test r8_coach("len(sim_counts)"; message=r8_undef("len")) == JuliaTime.MYSTERY_PY_LEN_LINE
        # head in the C1 case.
        JuliaTime.warmup!()
        reply = JuliaTime.mystery_case_run(r8_c1("head(jars)"))
        @test reply["coaching"] == "head is the R name for this. In Julia it is first: first(jars, 3) gives the first three rows."
    end

    @testset "9: C4 names three jars" begin
        @test r8_coach("for j in eligible.jar_id:\n    x.append(j)"; way="sample picks all three jars in one call.") |>
            x -> occursin("sample picks all three jars in one call.", x)
        @test occursin("way=\"sample picks all three jars in one call.\"",
                       read(joinpath(@__DIR__, "..", "src", "mystery_c4.jl"), String))
    end
end

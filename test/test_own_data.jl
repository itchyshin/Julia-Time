using Test, JuliaTime, JSON, DataFrames

# "Your own data" (lessons/own.json, src/own_data.jl): the server reads a learner's CSV text, holds one table in
# memory, and binds it as `data` for runs in lesson "own". Everything goes through JuliaTime.handle_message, the
# real path. Pure parts always run; sandbox parts need JULIATIME_INTEGRATION=1.

const _OWN_FIX = joinpath(@__DIR__, "fixtures", "own")
_own_msg(d) = JuliaTime.handle_message(Dict{String, Any}(d))
_own_load(name, text; rid="q") = _own_msg(Dict("type" => "own_data_load", "name" => name, "text" => text, "request_id" => rid))
_own_file(f; name=f) = _own_load(name, read(joinpath(_OWN_FIX, f), String))
_own_clear() = _own_msg(Dict("type" => "own_data_clear", "request_id" => "c"))
_own_status() = _own_msg(Dict("type" => "own_data_status", "request_id" => "s"))
_own_col(info, n) = only(filter(c -> c["name"] == n, info["columns"]))
_own_text(rows, cols) = join(["c$(j)" for j in 1:cols], ",") * "\n" * join([join(fill("1", cols), ",") * "\n" for _ in 1:rows])

const _OWN_REFUSALS = String[]

@testset "own data: loading a table (pure)" begin
    _own_clear()
    @test _own_status()["status"] == "none"
    @test _own_status()["request_id"] == "s"

    ok = _own_file("good.csv")
    @test ok["type"] == "own_data_info" && ok["status"] == "ok" && ok["request_id"] == "q"
    @test ok["name"] == "good.csv" && ok["rows"] == 4 && ok["cols"] == 4
    @test [c["name"] for c in ok["columns"]] == ["site", "treatment", "frogs", "water_temp"]
    @test _own_col(ok, "site")["type"] == "text" && _own_col(ok, "frogs")["type"] == "whole number" &&
          _own_col(ok, "water_temp")["type"] == "number"
    @test all(c -> c["missing"] == 0, ok["columns"])
    @test ok["notes"] isa Vector && any(n -> occursin("No empty cells", n), ok["notes"])
    @test ok["message"] isa AbstractString && !isempty(ok["message"])

    # the status message reports what is held; clear forgets it
    st = _own_status()
    @test st["status"] == "ok" && st["name"] == "good.csv" && st["rows"] == 4 && st["request_id"] == "s"
    cl = _own_clear()
    @test cl["type"] == "own_data_info" && cl["status"] == "cleared" && cl["request_id"] == "c"
    @test _own_status()["status"] == "none"

    # a name with a space, empty cells, semicolons, text that is mostly numbers, a byte order mark
    sp = _own_file("spaces.csv")
    @test sp["status"] == "ok" && _own_col(sp, "water temp")["type"] == "number"
    @test "The column `water temp` has a space in its name: write data[!, \"water temp\"], or rename it in the file." in sp["notes"]

    mi = _own_file("missing.csv")
    @test mi["status"] == "ok" && _own_col(mi, "water_temp")["missing"] == 2 && _own_col(mi, "frogs")["missing"] == 1 &&
          _own_col(mi, "site")["missing"] == 0
    @test any(n -> occursin("water_temp 2", n) && occursin("frogs 1", n), mi["notes"])

    se = _own_file("semicolons.csv")
    @test se["status"] == "ok" && se["cols"] == 3 && [c["name"] for c in se["columns"]] == ["site", "water_temp", "frogs"]
    @test _own_col(se, "water_temp")["type"] == "number"

    tn = _own_file("textnumbers.csv")
    @test tn["status"] == "ok" && _own_col(tn, "mass")["type"] == "text" && _own_col(tn, "mass")["missing"] == 0
    @test "`mass` was read as text: a cell that is not a number (like n/a or a comma decimal) is in it." in tn["notes"]
    # a text column of real words is not flagged
    @test !any(n -> occursin("`site` was read as text", n), tn["notes"])

    bo = _own_file("bom.csv")
    @test bo["status"] == "ok" && [c["name"] for c in bo["columns"]] == ["site", "frogs"]

    # case-insensitive extension; .txt allowed
    @test _own_load("GOOD.CSV", "a,b\n1,2\n")["status"] == "ok"
    @test _own_load("notes.TXT", "a,b\n1,2\n")["status"] == "ok"
    @test _own_load("a", "a,b\n1,2\n")["status"] == "refused"
end

@testset "own data: what is refused, with one plain message each (pure)" begin
    _own_clear()
    refused(r) = (push!(_OWN_REFUSALS, r["message"]); r["status"] == "refused" && r["type"] == "own_data_info" &&
                  r["rows"] == 0 && r["cols"] == 0 && isempty(r["columns"]) && r["message"] isa AbstractString && !isempty(r["message"]))
    @test refused(_own_file("notcsv.xlsx"))
    @test refused(_own_file("empty.csv"))
    @test refused(_own_file("header_only.csv"))
    @test refused(_own_load("blank.csv", "   \n\n"))
    @test refused(_own_load("x.csv.exe", "a,b\n1,2\n"))
    @test refused(_own_msg(Dict("type" => "own_data_load", "name" => 5, "text" => "a\n1\n", "request_id" => "q")))
    @test refused(_own_msg(Dict("type" => "own_data_load", "name" => "a.csv", "text" => nothing, "request_id" => "q")))
    @test refused(_own_load("quote.csv", "a,b\n\"1,2\n3,4\n"))            # text CSV.jl cannot read
    # limits: 50,000 rows and 100 columns are the largest allowed
    @test _own_load("big.csv", _own_text(50_000, 2))["status"] == "ok"
    rows60k = _own_text(60_000, 2)
    r60 = _own_load("big.csv", rows60k)
    @test refused(r60) && occursin("50,000", r60["message"])
    @test refused(_own_load("big.csv", _own_text(50_001, 2)))
    @test _own_load("wide.csv", _own_text(2, 100))["status"] == "ok"
    rw = _own_load("wide.csv", _own_text(2, 101))
    @test refused(rw) && occursin("100", rw["message"])
    # over 5 MB
    huge = "a\n" * repeat("x", 5_200_000) * "\n"
    rh = _own_load("huge.csv", huge)
    @test refused(rh) && occursin("5 MB", rh["message"])
    # every refusal is its own sentence, with no em dash
    @test all(m -> !occursin('—', m) && !occursin('\n', m), _OWN_REFUSALS)
    # a refused load leaves a held table as it was
    _own_load("keep.csv", "a,b\n1,2\n3,4\n")
    _own_file("notcsv.xlsx")
    @test _own_status()["name"] == "keep.csv" && _own_status()["rows"] == 2
    _own_clear()
end

@testset "own data: kept in memory only, text never evaluated (pure)" begin
    snap(dir) = Set(joinpath(r, f) for (r, _, fs) in walkdir(dir) for f in fs if !occursin(r"[/\\]\.(git|scratch)([/\\]|$)", joinpath(r, f)))
    pkgdir_ = dirname(dirname(pathof(JuliaTime)))
    tmp_before, pkg_before = Set(readdir(tempdir(); join=true)), snap(pkgdir_)
    probe = joinpath(tempdir(), "own_data_must_not_exist_$(getpid()).txt")
    _own_file("good.csv"); _own_file("textnumbers.csv"); _own_file("missing.csv"); _own_file("notcsv.xlsx")
    _own_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
    # text that looks like code is data: it is never run, and a name is never run either
    _own_load("write(\"$probe\", \"x\").csv", "a,b\nwrite(\"$probe\", \"x\"),run(`touch $probe`)\n")
    _own_load("big.csv", _own_text(60_000, 2))
    _own_clear()
    @test !isfile(probe)
    # tempdir() is shared with other programs: only a new entry that could be ours (own, csv, txt, starter, data) counts
    fresh = setdiff(Set(readdir(tempdir(); join=true)), tmp_before)
    @test !any(f -> occursin(r"own|csv|txt|starter|data"i, basename(f)), fresh)
    @test snap(pkgdir_) == pkg_before
end

@testset "own data: the starter table (pure)" begin
    _own_clear()
    st = _own_msg(Dict("type" => "own_data_starter", "request_id" => "st"))
    @test st["type"] == "own_data_info" && st["status"] == "ok" && st["request_id"] == "st"
    @test st["name"] == "starter_ponds.csv" && st["rows"] == 60 && st["cols"] == 5
    @test [c["name"] for c in st["columns"]] == ["pond", "site", "treatment", "water_temp", "frogs"]
    @test _own_col(st, "water_temp")["missing"] == 2 && _own_col(st, "frogs")["type"] == "whole number"
    # distinct non-missing values per column, so the page can pick a column to split by
    @test _own_col(st, "site")["distinct"] == 2 && _own_col(st, "treatment")["distinct"] == 2
    @test _own_col(st, "pond")["distinct"] == 60
    @test "This table is SIMULATED, made by the game for practice." in st["notes"]
    @test _own_status()["name"] == "starter_ponds.csv"
    # an ordinary load is not marked simulated
    @test !any(n -> occursin("SIMULATED", n), _own_file("good.csv")["notes"])
    _own_clear()
end

@testset "own data: column examples and names that are not plain Julia names (pure)" begin
    st = _own_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
    @test _own_col(st, "site")["examples"] == ["\"north\"", "\"south\""]
    @test _own_col(st, "treatment")["examples"] == ["\"shaded\"", "\"open\""]
    @test _own_col(st, "frogs")["examples"] isa Vector && length(_own_col(st, "frogs")["examples"]) == 3
    @test all(e -> tryparse(Int, e) !== nothing, _own_col(st, "frogs")["examples"])
    @test all(e -> !occursin("missing", e), _own_col(st, "water_temp")["examples"])
    aq = _own_file("airq_like.csv")
    @test _own_col(aq, "Month")["examples"] == ["5", "6", "7"]
    @test _own_col(aq, "Ozone")["examples"] == ["41", "36", "12"]          # empty cells are skipped
    @test _own_col(aq, "Day")["examples"] == ["1", "2", "3"]
    d = _own_load("dates.csv", "when,flag\n2020-01-02,true\n2020-01-03,false\n2020-01-02,true\n")
    @test _own_col(d, "when")["examples"] == ["\"2020-01-02\"", "\"2020-01-03\""] && _own_col(d, "flag")["examples"] == ["true", "false"]
    @test _own_load("q.csv", "t\nsay \"hi\"\n")["columns"][1]["examples"] == ["\"say \\\"hi\\\"\""]

    ir = _own_file("iris_like.csv")
    @test "The column `Sepal.Length` has a dot in its name, so Julia reads data.Sepal.Length as two steps: write data[!, \"Sepal.Length\"]." in ir["notes"]
    @test "The column `Sepal.Width` has a dot in its name, so Julia reads data.Sepal.Width as two steps: write data[!, \"Sepal.Width\"]." in ir["notes"]
    @test any(n -> occursin("`Petal-Width`", n) && occursin("data[!, \"Petal-Width\"]", n), ir["notes"])
    @test !any(n -> occursin("`Species`", n), ir["notes"])
    @test !any(n -> occursin("`Species`", n) || occursin("`Month`", n), _own_file("airq_like.csv")["notes"])
    @test any(n -> occursin("`Solar.R` has a dot", n), _own_file("airq_like.csv")["notes"])
    @test any(n -> occursin("`1st`", n) && occursin("data[!, \"1st\"]", n), _own_load("n.csv", "1st,b\n1,2\n")["notes"])
    _own_clear()
end

@testset "own data: NA cells and comma decimals (pure)" begin
    na = _own_file("r_na.csv")
    @test na["status"] == "ok" && _own_col(na, "ozone")["type"] == "whole number" && _own_col(na, "ozone")["missing"] == 1 &&
          _own_col(na, "temp")["type"] == "whole number" && _own_col(na, "temp")["missing"] == 1
    @test "Cells written NA were read as empty (missing)." in na["notes"]
    @test any(n -> occursin("Empty cells: ozone 1, temp 1", n), na["notes"])
    # n/a stays text, with the read-as-text note, and no NA note
    tn = _own_file("textnumbers.csv")
    @test _own_col(tn, "mass")["type"] == "text" && !("Cells written NA were read as empty (missing)." in tn["notes"])
    @test !("Cells written NA were read as empty (missing)." in _own_file("good.csv")["notes"])

    cs = _own_file("comma_semicolon.csv")
    @test cs["status"] == "ok" && cs["cols"] == 3 && _own_col(cs, "water_temp")["type"] == "number" &&
          _own_col(cs, "water_temp")["examples"] == ["12.5", "19.7", "16.1"] && _own_col(cs, "frogs")["type"] == "whole number"
    @test "Commas in numbers were read as decimal points (12,5 as 12.5)." in cs["notes"]
    @test !any(n -> occursin("read as text", n), cs["notes"])
    # a semicolon file with no comma decimals gets no such note
    @test !("Commas in numbers were read as decimal points (12,5 as 12.5)." in _own_file("semicolons.csv")["notes"])
    cq = _own_file("comma_quoted.csv")
    @test _own_col(cq, "water_temp")["type"] == "text" && cq["cols"] == 3
    @test "`water_temp` was read as text: a cell that is not a number (like n/a or a comma decimal) is in it." in cq["notes"]
    @test !("Commas in numbers were read as decimal points (12,5 as 12.5)." in cq["notes"])
    _own_clear()
end

@testset "own data: listed and sent like a lesson (pure)" begin
    JuliaTime.reload_lessons!()
    list = JuliaTime.handle_message(Dict("type" => "lesson_list"))["lessons"]
    own = only(filter(l -> l["id"] == "own", list))
    @test own["kind"] == "own" && own["number"] == 7 && own["title"] == "Your own data" && own["minutes"] == 30
    ids = [l["id"] for l in list]
    @test findfirst(==("own"), ids) > findfirst(==("exam6"), ids)
    @test findfirst(==("own"), ids) < findfirst(==("range"), ids)
    # lessons 1 to 6 do not say kind
    @test all(l -> !haskey(l, "kind"), filter(l -> occursin(r"^lesson\d$", l["id"]), list))
    r = JuliaTime.handle_message(Dict("type" => "lesson_info", "lesson" => "own", "request_id" => "i"))
    @test r["type"] == "lesson" && r["request_id"] == "i"
    pub = r["lesson"]
    @test pub["kind"] == "own" && pub["setup"] == "own_data"
    @test occursin("stays on this laptop", pub["data_label"])   # the file's own label, not the case label
    cs = JuliaTime._lesson_challenges(pub)
    @test length(cs) == 12 && count(c -> c["kind"] == "play", cs) == 11 && cs[end]["kind"] == "say"
    @test all(c -> !haskey(c, "check"), cs)
end

# ---- sandbox parts ----
const _OWN_TOKENS = ["{any_col}" => "pond", "{group_col}" => "site", "{num_col}" => "water_temp", "{y_col}" => "frogs", "{group_value}" => "\"north\""]
_own_fill(s) = replace(replace(s, "\"a value from this column\"" => "\"north\""), _OWN_TOKENS...)

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    _own_run(cid, code; extra...) = JuliaTime.handle_message(Dict{String, Any}("type" => "lesson_run", "lesson" => "own",
                                "challenge" => cid, "code" => code, "request_id" => "r", (String(k) => v for (k, v) in extra)...))

    @testset "own data: runs in lesson own (sandbox)" begin
        JuliaTime.reload_lessons!()
        _own_clear()
        # nothing held: a plain line, no crash
        r = _own_run("own-r1-p1", "size(data)")
        @test r["type"] == "lesson_result" && r["pass"] == false &&
              r["feedback"] == "Read a table in the step 'Read the table' first, or use the starter table."

        _own_file("good.csv")
        r = _own_run("own-r1-p1", "size(data)")
        @test r["status"] == "ok" && r["pass"] == true && r["value_repr"] == "(4, 4)"

        # the table cap: at most 20 rows go out, and the reply says how many more
        _own_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
        r = _own_run("own-r1-p1", "size(data)")
        @test r["value_repr"] == "(60, 5)"
        r = _own_run("own-r1-p1", "data")
        @test r["status"] == "ok" && length(r["value_table"]["rows"]) == 20 && length(r["value_table"]["cells"]) == 20 &&
              r["value_table"]["more_rows"] == 40
        r = _own_run("own-r1-p1", "first(data, 5)")
        @test length(r["value_table"]["rows"]) == 5 && get(r["value_table"], "more_rows", 0) == 0
        r = _own_run("own-r1-p1", "data.frogs .> 5")           # a true/false list is capped too
        @test length(r["value_table"]["rows"]) == 20 && r["value_table"]["more_rows"] == 40
        # a run cannot change the held table
        _own_run("own-r1-p1", "select!(data, :pond); size(data)")
        @test _own_run("own-r1-p1", "size(data)")["value_repr"] == "(60, 5)"

        # the say step is not run
        r = _own_run("own-r1-s7", "anything")
        @test r["type"] == "lesson_result" && r["pass"] == true
        _own_clear()
    end

    @testset "own data: other lessons still send a whole table (sandbox)" begin
        JuliaTime.reload_lessons!()
        l1 = JuliaTime.LESSONS["lesson1"]
        cid = first(JuliaTime._lesson_challenges(l1))["id"]
        r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson1", "challenge" => cid,
                    "look" => true, "code" => "vcat([practice_jars for _ in 1:8]...)", "request_id" => "t"))
        @test r["status"] == "ok" && length(r["value_table"]["rows"]) == 32 && !haskey(r["value_table"], "more_rows")
    end

    @testset "own data: help for real-data slips (sandbox)" begin
        JuliaTime.reload_lessons!()
        _own_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
        miss_line = "Some cells are empty (missing). Use skipmissing(...) inside sum or mean, or dropmissing(data, :col) first."
        for code in ("sum(data.water_temp)", "mean(data.water_temp)", "maximum(data.water_temp)")
            r = _own_run("own-r1-p4", code)
            @test (r["feedback"] == miss_line || (println("missing result: ", code, " -> ", repr(r["feedback"])); false))
        end
        r = _own_run("own-r1-p4", "Int(data.water_temp[40])")                    # a Julia error that names Missing
        @test r["status"] == "error" && r["feedback"] == miss_line
        r = _own_run("own-r1-p4", "data[data.water_temp .> 15, :]")                # indexing with missing
        @test r["feedback"] == miss_line
        r = _own_run("own-r1-p6", "combine(groupby(data, :site), :water_temp => (x -> sum(x)) => :total)")
        @test r["feedback"] == miss_line
        # no line when nothing is missing, or when it is already handled
        @test _own_run("own-r1-p4", "sum(skipmissing(data.water_temp))")["feedback"] == ""
        @test _own_run("own-r1-p4", "sum(data.frogs)")["feedback"] == ""
        @test _own_run("own-r1-p4", "data.water_temp")["feedback"] == ""            # showing a column with gaps is fine

        _own_file("spaces.csv")
        space_line = "The column `water temp` has a space in its name: write data[!, \"water temp\"], or rename it in the file."
        r = _own_run("own-r1-p2", "data.water temp")
        @test r["status"] == "error" && (occursin("data[!, \"water temp\"]", r["feedback"]) || (println(r["feedback"]); false))
        @test _own_run("own-r1-p2", "data[!, \"water temp\"]")["feedback"] == ""

        _own_file("textnumbers.csv")
        text_line = "`mass` was read as text: a cell that is not a number (like n/a or a comma decimal) is in it."
        for code in ("data.mass .> 10", "sum(data.mass)", "data.mass .+ 1")
            r = _own_run("own-r1-p4", code)
            @test r["status"] == "error" && (occursin("was read as text", r["feedback"]) || (println(code, " -> ", r["feedback"]); false))
        end
        # the text line is not given when the column is real words
        _own_file("good.csv")
        r = _own_run("own-r1-p4", "sum(data.site)")
        @test r["status"] == "error" && !occursin("was read as text", r["feedback"])
        _own_clear()
    end

    @testset "own data: dotted names, and a number column compared with text (sandbox)" begin
        JuliaTime.reload_lessons!()
        _own_file("iris_like.csv")
        dot = "The column `Sepal.Length` has a dot in its name, so Julia reads data.Sepal.Length as two steps: write data[!, \"Sepal.Length\"]."
        r = _own_run("own-r1-p2", "data.Sepal.Length")
        @test r["status"] == "error" && r["feedback"] == dot
        @test _own_run("own-r1-p2", "first(data.Sepal.Length, 3)")["feedback"] == dot
        for code in ("combine(groupby(data, :Species), :Sepal.Length => sum)", "dropmissing(data, :Sepal.Length)")
            r = _own_run("own-r1-p6", code)
            @test (r["feedback"] == "The column `Sepal.Length` has a dot in its name: write \"Sepal.Length\" in quotes instead of :Sepal.Length." ||
                   (println(code, " -> ", r["feedback"]); false))
        end
        r = _own_run("own-r1-p2", "data.Petal-Width")
        @test occursin("`Petal-Width`", r["feedback"]) && occursin("data[!, \"Petal-Width\"]", r["feedback"])
        @test _own_run("own-r1-p2", "data[!, \"Sepal.Length\"]")["feedback"] == ""
        @test _own_run("own-r1-p6", "combine(groupby(data, :Species), \"Sepal.Length\" => sum)")["feedback"] == ""

        _own_file("airq_like.csv")
        num = "`Month` holds numbers: compare with a number, like data.Month .== 5, without quotes."
        r = _own_run("own-r1-p3", "data.Month .== \"a value from this column\"")
        @test r["feedback"] == num
        r = _own_run("own-r1-p3", "data[data.Month .== \"a value from this column\", :]")
        @test r["feedback"] == num
        # Ozone has gaps, yet the slip is text against a number, not the missing cells
        r = _own_run("own-r1-p3", "data[data.Ozone .== \"a value\", :]")
        @test r["feedback"] == "`Ozone` holds numbers: compare with a number, like data.Ozone .== 41, without quotes."
        r = _own_run("own-r1-p3", "sum(data.Ozone .> \"5\")")
        @test startswith(r["feedback"], "`Ozone` holds numbers")
        # a real missing slip still says missing, and a number compared with a number says nothing
        @test _own_run("own-r1-p4", "sum(data.Ozone)")["feedback"] == JuliaTime.OWN_DATA_MISSING_LINE
        @test _own_run("own-r1-p3", "data[data.Month .== 5, :]")["feedback"] == ""
        # text compared with text is fine
        _own_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
        @test _own_run("own-r1-p3", "data[data.site .== \"north\", :]")["feedback"] == ""
        _own_clear()
    end

    @testset "own data: round 2 help lines (sandbox)" begin
        JuliaTime.reload_lessons!()
        _own_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
        # no Pocket dictionary in this stage
        for code in ("sum(data.pond .+ 1, 2, 3)", "this_is_not_defined + 1", "xyz(")
            r = _own_run("own-r1-p2", code)
            @test r["status"] == "error" && !occursin("Pocket dictionary", r["feedback"])
        end
        r = _own_run("own-r1-p2", "this_is_not_defined + 1")
        @test occursin("Check its spelling or make it on an earlier line.", r["feedback"]) || occursin("this_is_not_defined", r["feedback"])
        @test JuliaTime.OWN_DATA_FALLBACK_FEEDBACK == "Julia could not run this line. Check each name and bracket."
        # mean or sum on a text column of words
        r = _own_run("own-r1-p4", "mean(data.treatment)")
        @test r["status"] == "error" && r["feedback"] == "`treatment` holds text, so mean cannot work on it: pick a column of numbers."
        r = _own_run("own-r1-p4", "sum(data[!, \"site\"])")
        @test r["feedback"] == "`site` holds text, so sum cannot work on it: pick a column of numbers."
        @test _own_run("own-r1-p4", "mean(data.frogs)")["feedback"] == ""
        # a table with no rows is a gentle line, not an error
        r = _own_run("own-r1-p3", "data[data.site .== \"zzz\", :]")
        @test r["status"] == "ok" && r["pass"] == true &&
              r["feedback"] == "No rows matched this rule. Check the value: it must be written exactly as in the column."
        @test _own_run("own-r1-p3", "data[data.site .== \"north\", :]")["feedback"] == ""
        # other lessons keep their wording (fallback with the Pocket dictionary)
        @test occursin("Pocket dictionary", JuliaTime.LESSON_FALLBACK_FEEDBACK)
        _own_file("comma_quoted.csv")
        r = _own_run("own-r1-p4", "mean(data.water_temp)")
        @test occursin("was read as text", r["feedback"])
        _own_clear()
    end

    ts = @testset "own data: every starter runs on the starter table (sandbox)" begin
        JuliaTime.reload_lessons!()
        _own_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
        own = JuliaTime.LESSONS["own"]
        plays = filter(c -> c["kind"] == "play", JuliaTime._lesson_challenges(own))
        @test length(plays) == 11
        for c in plays
            code = _own_fill(c["starter"])
            @test !occursin('{', code)
            r = _own_run(c["id"], code)
            @test (r["status"] == "ok" && r["pass"] == true ||
                   (println(c["id"], " starter failed: ", r["status"], " ", r["feedback"], " ", get(r, "message", ""), "\n", code); false))
        end
        _own_clear()
    end
    ts.anynonpass || println("OWN-LESSON-OK")
end

println("OWN-DATA-OK")

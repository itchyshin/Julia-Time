using Test, JuliaTime, JSON, DataFrames

# 0.5.2b server: typed reads (step own-r1-d3), read_line on button loads, steps that run with no table, the Pkg intercept,
# help lines for packages/files/models, and the sandbox's GLM and package isolation. Pure parts always run; sandbox parts
# need JULIATIME_INTEGRATION=1.

_ot_msg(d) = JuliaTime.handle_message(Dict{String, Any}(d))
_ot_clear() = _ot_msg(Dict("type" => "own_data_clear", "request_id" => "c"))
_ot_file(f) = _ot_msg(Dict("type" => "own_data_load", "name" => f, "request_id" => "q",
                           "text" => read(joinpath(@__DIR__, "fixtures", "own", f), String)))

@testset "own typed: reading the typed line (pure)" begin
    f = JuliaTime._own_typed_read
    @test f("data = CSV.read(\"data/starter_ponds.csv\", DataFrame)") == (path="data/starter_ponds.csv", kwargs=Pair{Symbol, Any}[])
    r = f("data = CSV.read(\"a.csv\", DataFrame; missingstring=[\"\", \"NA\"], delim=';', decimal=',', header=1, skipto=3)")
    @test r.path == "a.csv" && Dict(r.kwargs) == Dict(:missingstring => ["", "NA"], :delim => ';', :decimal => ',', :header => 1, :skipto => 3)
    r = f("data = CSV.read(\"a.csv\", DataFrame, missingstring=\"NA\")")      # keyword without the semicolon
    @test r !== nothing && Dict(r.kwargs) == Dict(:missingstring => "NA")
    @test f("data = CSV.read(\"a.csv\", DataFrames.DataFrame)") !== nothing
    @test f("  data = CSV.read(\"a.csv\", DataFrame)  ") !== nothing
    # never evaluated: anything that is not a plain literal is refused
    @test f("data = CSV.read(\"a.csv\", DataFrame; missingstring=string(\"N\", \"A\"))") === nothing
    @test f("data = CSV.read(path, DataFrame)") === nothing
    @test f("data = CSV.read(\"a.csv\" * \"b\", DataFrame)") === nothing
    @test f("d = CSV.read(\"a.csv\", DataFrame)") === nothing
    @test f("CSV.read(\"a.csv\", DataFrame)") === nothing
    @test f("data = CSV.read(\"a.csv\")") === nothing
    @test f("data = CSV.read(\"a.csv\", DataFrame; types=Dict(:a => Int))") === nothing
    @test f("data = CSV.read(\"a.csv\", DataFrame; ntasks=run(`ls`))") === nothing
    @test f("data = ") === nothing
    # a line among others is found, and its own text is the read line
    @test JuliaTime._own_typed_line("using CSV\ndata = CSV.read(\"a.csv\", DataFrame)\nsize(data)") == "data = CSV.read(\"a.csv\", DataFrame)"
    @test JuliaTime._own_typed_line("size(2)") === nothing

    # button loads carry the exact line that reproduces them
    _ot_clear()
    r = _ot_file("r_na.csv")
    @test r["read_line"] == "data = CSV.read(\"r_na.csv\", DataFrame; missingstring=[\"\", \"NA\"])"
    r = _ot_file("comma_semicolon.csv")
    @test r["read_line"] == "data = CSV.read(\"comma_semicolon.csv\", DataFrame; missingstring=[\"\", \"NA\"], delim=';', decimal=',')"
    @test _ot_file("good.csv")["read_line"] == "data = CSV.read(\"good.csv\", DataFrame; missingstring=[\"\", \"NA\"])"
    @test _ot_file("semicolons.csv")["read_line"] == "data = CSV.read(\"semicolons.csv\", DataFrame; missingstring=[\"\", \"NA\"])"
    r = _ot_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
    @test r["read_line"] == "data = CSV.read(\"starter_ponds.csv\", DataFrame; missingstring=[\"\", \"NA\"])"
    @test _ot_msg(Dict("type" => "own_data_status", "request_id" => "s"))["read_line"] == r["read_line"]
    # a refused load has no read line
    @test !haskey(_ot_msg(Dict("type" => "own_data_load", "name" => "x.xlsx", "text" => "a", "request_id" => "q")), "read_line") ||
          _ot_msg(Dict("type" => "own_data_load", "name" => "x.xlsx", "text" => "a", "request_id" => "q"))["read_line"] == ""
    _ot_clear()
end

@testset "own typed: the steps' flags (pure)" begin
    JuliaTime.reload_lessons!()
    cs = JuliaTime._lesson_challenges(JuliaTime.LESSONS["own"])
    @test length(cs) == 12 && count(c -> c["kind"] == "play", cs) == 11 && cs[end]["kind"] == "say"
    @test [c["id"] for c in cs][1:3] == ["own-r1-d1", "own-r1-d2", "own-r1-d3"]
end

@testset "own typed round 2: starter flag, one read statement, Pkg block (pure)" begin
    _ot_clear()
    r = _ot_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
    @test r["starter"] == true && first(r["notes"]) == JuliaTime.OWN_DATA_STARTER_NOTE
    @test _ot_file("good.csv")["starter"] == false
    @test _ot_msg(Dict("type" => "own_data_status", "request_id" => "s"))["starter"] == false
    @test _ot_msg(Dict("type" => "own_data_load", "name" => "x.xlsx", "text" => "a", "request_id" => "q"))["starter"] == false
    _ot_clear()

    a = JuliaTime._own_typed_analysis
    rd = "data = CSV.read(\"data/starter_ponds.csv\", DataFrame)"
    @test a(rd).problem == :none && a(rd).line == rd
    @test a("using CSV, DataFrames\n$rd\nsize(data)").problem == :none
    @test a("# data = CSV.read(\"data/a.csv\", DataFrame)\n$rd").line == rd            # commented out: ignored
    @test a("#= data = CSV.read(\"data/a.csv\", DataFrame) =#\n$rd").line == rd
    @test a("$rd\ndata = CSV.read(\"data/b.csv\", DataFrame)").problem == :keep         # two reads
    @test a("$rd\ndropmissing!(data)").problem == :keep                                # a later change
    @test a("$rd\ndata = dropmissing(data)").problem == :keep
    @test a("$rd\ndata[1, :frogs] = 3").problem == :keep
    @test a("$rd\ndata.frogs .= 0").problem == :keep
    @test a("$rd\nselect!(data, :pond)").problem == :keep
    @test a("$rd\nfirst(data, 3)").problem == :none
    @test a("x = 1\n$rd\nx = 2").problem == :none
    @test a("if true\n$rd\nend").problem == :no_read
    @test a("size(3)").problem == :no_read
    @test a("$rd; size(data)").problem == :none && a("$rd; size(data)").line == rd

    p = JuliaTime._pkg_call
    for code in ("Pkg.add(\"X\")", "Pkg.rm(\"X\")", "Pkg.update()", "Pkg.instantiate()", "Pkg.activate(\".\")", "Pkg.develop(\"X\")",
                 "Pkg.build()", "Pkg.resolve()", "Pkg.pin(\"X\")", "Pkg.free(\"X\")", "Pkg.gc()", "Base.Pkg.add(\"X\")",
                 "import Pkg as P\nP.add(\"X\")", "using Pkg: add\nadd(\"X\")", "import Pkg: add", "using Pkg\nadd(\"Plots\")",
                 "pkg\"add Plots\"", "] add Plots", "]add Plots", "x = 1\n] add Plots", "Pkg . add(\"X\")")
        @test p(code) || (println("not blocked: ", code); false)
    end
    for code in ("x = [1, 2,\n]", "y = select(df,\n  :a,\n  :b\n]", "z = [\n  1,\n  2\n]\n", "z = [\n  x\n] for x in 1:3",
                 "s = \"Pkg.add\"", "# Pkg.add(\"X\")", "using Pkg", "using Pkg\nPkg.status()", "add(1, 2)", "size(data)")
        @test !p(code) || (println("blocked: ", code); false)
    end
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    _ot_run(cid, code) = _ot_msg(Dict("type" => "lesson_run", "lesson" => "own", "challenge" => cid, "code" => code, "request_id" => "r"))

    @testset "own typed: steps with table none run with no table (sandbox)" begin
        JuliaTime.reload_lessons!()
        _ot_clear()
        r = _ot_run("own-r1-d1", "pwd()")
        @test r["status"] == "ok" && r["pass"] == true && r["value_repr"] == repr(JuliaTime._own_game_root())
        r = _ot_run("own-r1-d1", "readdir(\"data\")")
        @test r["status"] == "ok" && occursin("starter_ponds.csv", r["value_repr"])
        r = _ot_run("own-r1-d1", "data")        # no table held: `data` is simply not defined
        @test r["status"] == "error" && r["pass"] == true
        r = _ot_run("own-r1-p1", "size(data)")
        @test r["status"] == "error" && r["pass"] == false &&
              r["feedback"] == "Read a table in the step 'Read the table' first, or use the starter table."
        # with a table held, a none-step also sees it
        _ot_file("good.csv")
        @test _ot_run("own-r1-d1", "size(data)")["value_repr"] == "(4, 4)"
        _ot_clear()
    end

    @testset "own typed: d3 reads a typed line (sandbox)" begin
        JuliaTime.reload_lessons!()
        _ot_clear()
        line = "data = CSV.read(\"data/starter_ponds.csv\", DataFrame)"
        r = _ot_run("own-r1-d3", line)
        @test r["status"] == "ok" && r["pass"] == true
        @test r["read_line"] == line
        t = r["own_table"]
        @test t["status"] == "ok" && t["name"] == "starter_ponds.csv" && t["rows"] == 60 && t["cols"] == 5
        @test [c["name"] for c in t["columns"]] == ["pond", "site", "treatment", "water_temp", "frogs"]
        @test t["read_line"] == line && any(n -> occursin("rows", n), t["notes"])
        h = JuliaTime.own_data_held()
        @test h !== nothing && h.name == "starter_ponds.csv" && DataFrames.nrow(h.table) == 60
        @test _ot_run("own-r1-p1", "size(data)")["value_repr"] == "(60, 5)"

        # a later typed read replaces the held table, with the learner's own keywords
        _ot_clear()
        l2 = "data = CSV.read(\"test/fixtures/own/r_na.csv\", DataFrame; missingstring=\"NA\")"
        r = _ot_run("own-r1-d3", l2)
        @test r["pass"] == true && r["read_line"] == l2 && r["own_table"]["name"] == "r_na.csv"
        @test only(filter(c -> c["name"] == "ozone", r["own_table"]["columns"]))["missing"] > 0
        @test only(filter(c -> c["name"] == "ozone", r["own_table"]["columns"]))["type"] == "whole number"

        # no missingstring on a file with NA cells: held exactly as read, and the note names the column and the fix
        _ot_clear()
        l3 = "data = CSV.read(\"test/fixtures/own/r_na.csv\", DataFrame)"
        r = _ot_run("own-r1-d3", l3)
        @test r["pass"] == true && r["read_line"] == l3
        oz = only(filter(c -> c["name"] == "ozone", r["own_table"]["columns"]))
        @test oz["type"] == "text"
        notes = join(r["own_table"]["notes"], "\n")
        @test occursin("ozone", notes) && occursin("missingstring=", notes) && occursin("\"NA\"", notes)
        @test occursin("data = CSV.read(\"test/fixtures/own/r_na.csv\", DataFrame; missingstring=", notes)

        # a semicolon file read without delim is one column: the note says delim=';'
        _ot_clear()
        r = _ot_run("own-r1-d3", "data = CSV.read(\"test/fixtures/own/comma_semicolon.csv\", DataFrame)")
        @test occursin("delim=';'", join(r["own_table"]["notes"], "\n"))
        # and a comma-decimal column read with delim only
        r = _ot_run("own-r1-d3", "data = CSV.read(\"test/fixtures/own/comma_semicolon.csv\", DataFrame; delim=';')")
        n = join(r["own_table"]["notes"], "\n")
        @test occursin("decimal=','", n)
        _ot_clear()

        # anything else: the run is fine, nothing is held, and the line asks for the plain form
        form = "data = CSV.read(\"data/yourfile.csv\", DataFrame)"
        for code in ("CSV.read(\"data/starter_ponds.csv\", DataFrame)", "d = CSV.read(\"data/starter_ponds.csv\", DataFrame)",
                     "p = \"data/starter_ponds.csv\"\ndata = CSV.read(p, DataFrame)")
            r = _ot_run("own-r1-d3", code)
            @test r["status"] == "ok" && r["pass"] == true && !haskey(r, "own_table") && occursin(form, r["feedback"])
            @test JuliaTime.own_data_held() === nothing
        end
        # a missing file: the error line names the real folder and the data/ files
        r = _ot_run("own-r1-d3", "data = CSV.read(\"data/nope.csv\", DataFrame)")
        @test r["status"] == "error" && occursin("starter_ponds.csv", r["feedback"]) && occursin(JuliaTime._own_game_root(), r["feedback"])
        @test occursin("copy", lowercase(r["feedback"]))
        # a file that is not there on the server side is not held
        _ot_clear()
    end

    @testset "own typed: Pkg lines are not run (sandbox)" begin
        JuliaTime.reload_lessons!()
        line = "The game has already installed its packages, so this line is not run here. On your own computer, run it once at the julia> prompt; after that, using loads the package each time."
        for code in ("using Pkg; Pkg.add(\"Plots\")", "Pkg.add(\"CSV\")", "import Pkg\nPkg.rm(\"CSV\")", "Pkg.update()", "Pkg.instantiate()", "]add Plots",
                     "  ] add Plots")
            r = _ot_run("own-r1-d2", code)
            @test r["status"] == "ok" && r["pass"] == true && r["feedback"] == line && r["value_repr"] == ""
        end
        # other lines that mention Pkg are run
        r = _ot_run("own-r1-d2", "pkgs = [\"Pkg.add\"]")
        @test r["feedback"] != line
        # other lessons block it too (round 2): see the round 2 testset below
    end

    @testset "own typed: help lines (sandbox)" begin
        JuliaTime.reload_lessons!()
        _ot_clear()
        pk = "Plots is not installed in this game. The game has CSV, DataFrames, GLM and Statistics. On your own computer you would install Plots once with using Pkg; Pkg.add(\"Plots\")."
        r = _ot_run("own-r1-d2", "using Plots")
        @test r["status"] == "error" && r["feedback"] == pk
        @test occursin("Package Plots not found", r["message"])
        r = _ot_run("own-r1-d2", "using Plots, CSV")
        @test r["feedback"] == pk
        r = _ot_run("own-r1-d2", "using CSV, DataFrames, GLM")
        @test r["status"] == "ok" && r["feedback"] == ""
        # missing file
        r = _ot_run("own-r1-d1", "readlines(\"data/nope.csv\")")
        @test r["status"] == "error" && occursin("starter_ponds.csv", r["feedback"]) && occursin(JuliaTime._own_game_root(), r["feedback"]) &&
              occursin("copy", lowercase(r["feedback"]))
        # models, on the starter
        _ot_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
        r = _ot_run("own-r1-m1", "lm(@formula(frogs ~ water_temp), data)")
        @test r["status"] == "ok" && r["pass"] == true && r["feedback"] == ""
        r = _ot_run("own-r1-m2", "glm(@formula(frogs ~ water_temp), data, Poisson())")
        @test r["status"] == "ok" && r["feedback"] == ""
        r = _ot_run("own-r1-m1", "lm(@formula(frogs ~ site), data)")          # a text column as a predictor is fine (dummy coding)
        @test r["status"] == "ok"
        r = _ot_run("own-r1-m1", "lm(@formula(site ~ water_temp), data)")      # a text column as the response
        @test r["status"] == "error" && occursin("`site` holds text", r["feedback"]) && occursin("number", r["feedback"])
        r = _ot_run("own-r1-m1", "glm(@formula(site ~ water_temp), data, Poisson())")
        @test occursin("`site` holds text", r["feedback"])
        # a name that is not plain
        _ot_file("iris_like.csv")
        r = _ot_run("own-r1-m1", "lm(@formula(Sepal.Length ~ Sepal.Width), data)")
        @test r["status"] == "error" && occursin("Term(Symbol(\"Sepal.Length\"))", r["feedback"])
        r = _ot_run("own-r1-m1", "lm(Term(Symbol(\"Sepal.Length\")) ~ Term(Symbol(\"Sepal.Width\")), data)")
        @test r["status"] == "ok" && r["feedback"] == ""
        _ot_clear()
    end

    @testset "own typed: sandbox sees only the game's packages, and has GLM (sandbox)" begin
        JuliaTime.reload_lessons!()
        _ot_msg(Dict("type" => "own_data_starter", "request_id" => "s"))
        r = JuliaTime.run_code("using Plots"; budget=JuliaTime.RUN_BUDGET)
        @test r.status == :error && occursin("Package Plots not found", r.message)
        t0 = time()
        r = _ot_run("own-r1-m1", "lm(@formula(frogs ~ water_temp), data)")
        @test r["status"] == "ok" && time() - t0 < 5.0
        @test occursin("-0.58", r["value_repr"])
        r = JuliaTime.run_code("coef(lm(@formula(y ~ x), DataFrame(x=1.0:5.0, y=[2.0, 4.1, 5.9, 8.2, 9.9])))[2]"; budget=JuliaTime.RUN_BUDGET)
        @test r.status == :ok && isapprox(r.value, 1.99; atol=0.01)
        r = JuliaTime.run_code("pwd()"; budget=JuliaTime.RUN_BUDGET)
        @test r.value == JuliaTime._own_game_root()
        _ot_clear()
    end
    @testset "own typed round 2: d3 with several statements, cd, size cap, Pkg in other lessons (sandbox)" begin
        JuliaTime.reload_lessons!()
        _ot_clear()
        rd = "data = CSV.read(\"data/starter_ponds.csv\", DataFrame)"
        r = _ot_run("own-r1-d3", "using CSV, DataFrames\n$rd\nfirst(data, 2)")
        @test r["pass"] == true && haskey(r, "own_table") && r["read_line"] == rd && r["own_table"]["starter"] == true
        @test first(r["own_table"]["notes"]) == JuliaTime.OWN_DATA_STARTER_NOTE
        _ot_clear()
        r = _ot_run("own-r1-d3", rd)                         # the typed read of the starter file says SIMULATED too
        @test first(r["own_table"]["notes"]) == JuliaTime.OWN_DATA_STARTER_NOTE
        _ot_clear()
        keep = "Keep the read line on its own in this step: data = CSV.read(...)."
        for code in ("$rd\ndropmissing!(data)", "$rd\ndata = CSV.read(\"data/water_fleas.csv\", DataFrame)")
            r = _ot_run("own-r1-d3", code)
            @test r["status"] == "ok" && !haskey(r, "own_table") && r["feedback"] == keep && JuliaTime.own_data_held() === nothing
        end
        # a later cd() does not leak into the next run, whichever pooled worker takes it
        for _ in 1:4
            @test _ot_run("own-r1-d1", "cd(\"data\")")["status"] == "ok"
        end
        for _ in 1:4
            @test _ot_run("own-r1-d1", "pwd()")["value_repr"] == repr(JuliaTime._own_game_root())
        end
        _ot_clear()
    end

    @testset "own typed round 2: a value over the cap shows as text (sandbox)" begin
        JuliaTime.reload_lessons!()
        _ot_clear()
        n = 11_000
        txt = "x,y\n" * join(("$(i / 100),$(2 * i / 100 + sin(i))" for i in 1:n), "\n") * "\n"
        _ot_msg(Dict("type" => "own_data_load", "name" => "big.csv", "text" => txt, "request_id" => "b"))
        r = _ot_run("own-r1-m1", "lm(@formula(y ~ x), data)")
        @test r["status"] == "ok" && !occursin("too large", r["message"] * r["value_repr"] * get(r, "shown", "")) &&
              occursin("Coef", get(r, "shown", "") * r["value_repr"])
        _ot_clear()
        path = tempname() * ".csv"
        write(path, "a,b\n" * join(("$i,$(i * 2)" for i in 1:40_000), "\n") * "\n")
        r = _ot_run("own-r1-d3", "data = CSV.read($(repr(path)), DataFrame)")
        @test r["status"] == "ok" && r["pass"] == true && haskey(r, "own_table") && r["own_table"]["rows"] == 40_000
        @test !occursin("too large", r["message"]) && occursin("40000", get(r, "shown", "") * r["value_repr"]) &&
              occursin("1", get(r, "shown", ""))
        @test JuliaTime.own_data_held() !== nothing && DataFrames.nrow(JuliaTime.own_data_held().table) == 40_000
        rm(path)
        _ot_clear()
    end

    @testset "own typed round 2: Pkg is blocked in every lesson and the speed lab (sandbox)" begin
        JuliaTime.reload_lessons!()
        l1 = JuliaTime.LESSONS["lesson1"]
        cid = first(JuliaTime._lesson_challenges(l1))["id"]
        r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson1", "challenge" => cid,
                    "look" => true, "code" => "Pkg.add(\"X\")", "request_id" => "t"))
        @test r["feedback"] == JuliaTime.OWN_DATA_PKG_LINE && r["status"] == "ok"
        r = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => "lesson1", "challenge" => cid,
                    "code" => "pkg\"add X\"", "request_id" => "t"))
        @test r["feedback"] == JuliaTime.OWN_DATA_PKG_LINE && r["pass"] == false
        r = _ot_run("own-r1-d2", "x = [1, 2,\n]")
        @test r["feedback"] != JuliaTime.OWN_DATA_PKG_LINE && r["status"] == "ok"
        ran = Ref(false)
        r = JuliaTime.speed_lab_own_run_reply(Dict("type" => "speed_lab_own_run", "request_id" => "q", "code" => "using Pkg: add\nadd(\"X\")");
                                              sandbox=(code; budget) -> (ran[] = true; JuliaTime.SandboxResult(:ok, (0.1, 0.1), "", "")))
        @test !ran[] && r["status"] == "error" && occursin("already installed", r["first"]["message"])
    end

    @testset "own typed round 2: the speed lab's own run takes the run lock (sandbox)" begin
        held = Channel{Bool}(1); release = Channel{Bool}(1)
        t = @async lock(JuliaTime._RUN_LOCK) do
            put!(held, true); take!(release)
        end
        take!(held)
        done = Ref(false)
        w = @async (JuliaTime.speed_lab_own_run_reply(Dict("type" => "speed_lab_own_run", "request_id" => "q", "code" => "sum(1:10)")); done[] = true)
        sleep(1.0)
        @test !done[]
        put!(release, true)
        wait(w); wait(t)
        @test done[]
    end

    @testset "own typed round 3: no 'No empty cells' beside a text-number note (sandbox)" begin
        JuliaTime.reload_lessons!()
        _ot_clear()
        path = tempname() * ".csv"
        write(path, "site,ozone\nnorth,41\nsouth,NA\nnorth,12\n")
        r = _ot_run("own-r1-d3", "data = CSV.read($(repr(path)), DataFrame)")
        notes = r["own_table"]["notes"]
        @test any(n -> occursin("`ozone`", n) && occursin("missingstring", n), notes)
        @test any(n -> endswith(n, " No empty cells were found, but see the note above."), notes) && !any(n -> occursin("No empty cells.", n), notes)
        r = _ot_run("own-r1-d3", "data = CSV.read($(repr(path)), DataFrame; missingstring=\"NA\")")
        @test any(n -> occursin("Empty cells: ozone 1", n), r["own_table"]["notes"])
        rm(path); _ot_clear()
        _ot_file("good.csv")   # a clean file still says so
        @test any(n -> occursin("No empty cells.", n), JuliaTime.own_data_held().info["notes"])
        _ot_clear()
    end

    @testset "own typed round 4: comment-only d3, xlsx, timeout, refused limits (sandbox)" begin
        JuliaTime.reload_lessons!()
        _ot_clear()
        form = "To read a file, write it as data = CSV.read(\"data/yourfile.csv\", DataFrame)"
        cm = "# Your table is loaded (you chose it with the button). Press Next.\n# data = CSV.read(\"x.csv\", DataFrame)"
        r = _ot_run("own-r1-d3", cm)                      # nothing held: the usual write-it line
        @test r["status"] == "ok" && r["pass"] == true && r["feedback"] == form
        _ot_file("good.csv")
        r = _ot_run("own-r1-d3", cm)
        @test r["status"] == "ok" && r["pass"] == true && r["feedback"] == "Your table is loaded. Press Next." && !haskey(r, "own_table")
        @test JuliaTime.own_data_held().name == "good.csv"
        _ot_clear()

        xl = "CSV.read reads CSV files. Save the sheet as CSV (File, Save As, CSV), copy it into data, and read that."
        r = _ot_run("own-r1-d3", "data = CSV.read(\"data/survey.xlsx\", DataFrame)")
        @test r["feedback"] == xl
        xp = tempname() * ".xlsx"; write(xp, "a,b\n1,2\n")
        r = _ot_run("own-r1-d3", "data = CSV.read($(repr(xp)), DataFrame)")
        @test r["feedback"] == xl && !haskey(r, "own_table")
        rm(xp)

        # a read that runs past the budget: the file line, not the loop line
        r = _ot_run("own-r1-d3", "x = 1\nwhile true end\n# CSV.read")
        @test r["status"] == "timeout" && r["feedback"] == "Reading this file took longer than 5 seconds. Use a smaller file (under 5 MB), or the button."
        @test _ot_run("own-r1-d1", "while true end")["feedback"] != "Reading this file took longer than 5 seconds. Use a smaller file (under 5 MB), or the button."

        # a refused read (limits): no preview of the file, and the table held stays
        bigp = tempname() * ".csv"
        write(bigp, "a\n" * join(1:50_001, "\n") * "\n")
        r = _ot_run("own-r1-d3", "data = CSV.read($(repr(bigp)), DataFrame)")
        @test r["feedback"] == JuliaTime.OWN_DATA_REFUSE_ROWS && r["value_table"] === nothing && r["value_repr"] == "" && get(r, "shown", "") == ""
        @test JuliaTime.own_data_held() === nothing
        _ot_file("good.csv")
        r = _ot_run("own-r1-d3", "data = CSV.read($(repr(bigp)), DataFrame)")
        @test r["feedback"] == JuliaTime.OWN_DATA_REFUSE_ROWS * " The game still uses good.csv." && !haskey(r, "own_table")
        @test JuliaTime.own_data_held().name == "good.csv"
        rm(bigp)
        _ot_clear()
    end
end

println("OWN-TYPED-OK")

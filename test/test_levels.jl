using Distributions, Random, JSON

@testset "levels" begin
    JuliaTime.warmup!()

    @testset "registry shape" begin
        @test [l.id for l in JuliaTime.LEVELS] == ["L0", "L0.5", "L1", "L2", "L3", "L4", "L5", "L6"]
        for l in JuliaTime.LEVELS
            for t in l.tasks
                @test !isempty(t.prompt)
                @test !isempty(t.predict)
                if t.kind in (:change, :complete)
                    @test !isempty(t.starter)
                end
            end
            if !isempty(l.tasks)
                @test length(l.solution) == length(l.tasks)
            end
            @test !isempty(l.bridge.julia)
            @test !isempty(l.bridge.r)
            @test !isempty(l.bridge.python)
        end
    end

    @testset "legacy L6 does not claim an unmeasured language comparison" begin
        l6 = only(filter(level -> level.id == "L6", JuliaTime.LEVELS))
        taught_copy = lowercase(join((l6.title, l6.cast_line), " "))
        @test !occursin("r and python are still thinking", taught_copy)
        @test !occursin("the race", taught_copy)
    end

    @testset "solutions pass their checkers" begin
        for l in JuliaTime.LEVELS
            isempty(l.tasks) && continue
            ctx = JuliaTime.context(l)
            for (i, sol) in enumerate(l.solution)
                r = JuliaTime.run_code(l.preamble * "\n" * sol; env = JuliaTime.env_for(l), seed = l.seed)
                @test r.status === :ok
                if r.status !== :ok
                    println("$(l.id) task $i did not run: $(r.message)")
                    continue
                end
                pass, msg = l.tasks[i].check(r.value, ctx)
                if !pass
                    println("FAIL $(l.id) task $i: $msg")
                end
                @test pass
            end
        end
    end

    @testset "wrong answers fail cleanly" begin
        for l in JuliaTime.LEVELS
            isempty(l.tasks) && continue
            ctx = JuliaTime.context(l)
            wrongs = ["nothing"]
            l.id in ("L1", "L2") && push!(wrongs, "df")
            for wrong in wrongs
                r = JuliaTime.run_code(l.preamble * "\n" * wrong; env = JuliaTime.env_for(l), seed = l.seed)
                @test r.status === :ok
                r.status === :ok || continue
                for t in l.tasks
                    pass, msg = t.check(r.value, ctx)
                    @test pass == false
                    @test !isempty(msg)
                end
            end
        end
    end

    @testset "payload contract" begin
        for l in JuliaTime.LEVELS
            isempty(l.tasks) && continue
            ctx = JuliaTime.context(l)
            for (i, sol) in enumerate(l.solution)
                r = JuliaTime.run_code(l.preamble * "\n" * sol; env = JuliaTime.env_for(l), seed = l.seed)
                r.status === :ok || continue
                p = JuliaTime.payload(l, i, r.value, ctx)
                @test p isa Dict
                @test !haskey(p, "error")
                @test JSON.json(p) isa String

                if l.visual === :rows
                    @test haskey(p, "rows")
                    @test length(p["rows"]) == 48
                elseif l.visual === :gallery
                    @test p["overlap"] >= 0.6
                elseif l.visual === :deck && l.id == "L3" && i == 2
                    pair_truth = 1 - (binomial(13, 5) * 4^5) / binomial(52, 5)
                    @test isapprox(pair_truth, 0.4929; atol = 1e-3)
                    @test isapprox(p["truth"], pair_truth; atol = 1e-9)
                end
            end
        end
    end

    @testset "overlap sanity" begin
        rng = MersenneTwister(1)
        s = rand(rng, Normal(0, 1), 5000)
        @test JuliaTime.overlap(s, Normal(0, 1)) >= 0.9
        @test JuliaTime.overlap(s, Normal(5, 1)) <= 0.1
    end

    JuliaTime.shutdown!()
end

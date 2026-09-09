using Distributions, DataFrames

@testset "sandbox" begin
    JuliaTime.warmup!()

    # 1. arithmetic
    r = JuliaTime.run_code("1+1")
    @test r.status === :ok
    @test r.value == 2
    @test r.stdout == ""
    @test r.message == ""

    # 2. stdout capture
    r = JuliaTime.run_code("println(\"hi\"); 3")
    @test r.value == 3
    @test r.stdout == "hi\n"

    # 3. env bindings
    r = JuliaTime.run_code("x + 1"; env=(x=41,))
    @test r.value == 42

    # 4. seeded RNG determinism; packages loaded
    r1 = JuliaTime.run_code("rand()"; seed=1)
    r2 = JuliaTime.run_code("rand()"; seed=1)
    @test r1.status === :ok
    @test r2.status === :ok
    @test r1.value == r2.value

    r = JuliaTime.run_code("rand(Normal(0,1), 3)")
    @test r.status === :ok
    @test r.value isa Vector{Float64}
    @test length(r.value) == 3

    # 5. UndefVarError
    r = JuliaTime.run_code("undefined_name")
    @test r.status === :error
    @test occursin("doesn't exist", r.message)
    @test occursin("UndefVarError", r.message)
    @test !occursin("RemoteException", r.message)

    # 6. parse error
    r = JuliaTime.run_code("1 +")
    @test r.status === :error
    @test occursin("couldn't parse", r.message)

    # 7. BoundsError / MethodError
    r = JuliaTime.run_code("[1,2,3][5]")
    @test r.status === :error
    @test occursin("outside the range", r.message)

    r = JuliaTime.run_code("sqrt(\"a\")")
    @test r.status === :error
    @test occursin("wrong kind of argument", r.message)

    # 8. timeout regression guard
    t = @elapsed r = JuliaTime.run_code("while true end"; budget=2.0)
    @test r.status === :timeout
    @test t < 3.0
    @test JuliaTime.run_code("1+1").value == 2  # pool recovered

    t2 = @elapsed r3 = JuliaTime.run_code("s = 0.0; i = 0; while true; i += 1; s += sin(i); end"; budget=2.0)
    @test r3.status === :timeout
    @test t2 < 3.0

    # 9. value cap
    r = JuliaTime.run_code("zeros(10^7)")
    @test r.status === :ok
    @test r.value === nothing
    @test occursin("too large", r.message)

    # 10. reused worker is fast
    JuliaTime.run_code("1+1")
    t3 = @elapsed JuliaTime.run_code("1+1")
    @test t3 < 1.0

    # 11. review 2026-09-07 (Opus adversarial) regressions
    r = JuliaTime.run_code("f(x) = 2x")                       # finding 1: player-defined function
    @test r.status === :ok && r.value === nothing
    @test occursin("function or a type you just defined", r.message)
    r = JuliaTime.run_code("struct Pt; x::Int; end; [Pt(1), Pt(2)]")
    @test r.status === :ok && r.value === nothing && occursin("Pt(1)", r.message)
    @test JuliaTime.run_code("1+1").value == 2               # the worker survived it

    r = JuliaTime.run_code("Normal(0, 1)")                    # finding 2: Distributions crosses back
    @test r.status === :ok && r.value isa Distributions.Normal
    r = JuliaTime.run_code("DataFrame(a = 1:3)")
    @test r.status === :ok && r.value isa DataFrames.DataFrame

    r = JuliaTime.run_code("println(stderr, \"boo\"); display([1, 2]); 1")   # finding 5
    @test r.value == 1 && occursin("boo", r.stdout) && occursin("2", r.stdout)

    r = JuliaTime.run_code("exit()")                          # finding 9
    @test r.status === :error && occursin("stopped Julia itself", r.message)
    @test JuliaTime.run_code("1+1").value == 2               # exit() must not poison the next learner move

    # finding 4: two timeouts back to back drain the pool; the next call must still answer soon
    JuliaTime.run_code("while true end"; budget=1.0)
    JuliaTime.run_code("while true end"; budget=1.0)
    # Replacement is deliberately lazy: a stalled background Distributed refill used to make
    # this next ordinary learner move wait indefinitely after two killed workers.
    @test JuliaTime._REFILL[] === nothing
    t4 = @elapsed r = JuliaTime.run_code("1+1")
    @test r.value == 2
    @test t4 < 15.0

    # Repeated bad loops must not exhaust the replacement mechanism. This used to
    # strand the fifth ordinary move when `Distributed.addprocs` stopped launching
    # after several forced worker kills.
    for _ in 1:4
        r = JuliaTime.run_code("while true end"; budget=0.5)
        @test r.status === :timeout
        @test JuliaTime.run_code("1+1"; budget=3.0).value == 2
    end

    JuliaTime.shutdown!()
end

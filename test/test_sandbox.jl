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
    # The page shows messages as plain text (textContent), so our own first line carries no
    # Markdown backticks; Julia's own text below it stays exactly as Julia wrote it.
    r = JuliaTime.run_code("undefined_name")
    @test r.status === :error
    novice, julia_text = split(r.message, "\n\n"; limit=2)
    @test novice == "undefined_name is a name Julia does not know yet. Check the spelling, or define it first."
    @test occursin("UndefVarError: `undefined_name` not defined", julia_text)
    @test !occursin("RemoteException", r.message)

    # 6. parse error
    r = JuliaTime.run_code("1 +")
    @test r.status === :error
    @test first(split(r.message, "\n\n")) ==
          "Julia couldn't parse this line. Look for a missing bracket, a missing comma, or a missing end keyword."

    # Every plain-language first line is plain text: no Markdown backticks.
    for e in (UndefVarError(:tray_id), MethodError(sqrt, ("a",)), BoundsError([1], 5),
              Meta.ParseError("x"), DivideError(), JuliaTime.Distributed.ProcessExitedException(2), ErrorException("x"))
        @test !occursin('`', JuliaTime._novice_line(e))
    end

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

@testset "sandbox worker acquisition is not charged to the learner's budget (T1, S8-G1/G2)" begin
    # Deterministic reproduction of T1: on a slow machine, the replacement worker spawned after a
    # killed run is not ready within a short learner budget, so `run_code("1+1")` right after a
    # timeout falsely reports `:timeout`/`nothing` instead of running the learner's correct move.
    # `JULIATIME_TEST_SLOW_WORKER_START` (read by src/sandbox_worker.jl) makes this reproducible on
    # any machine, without depending on real JIT/process-start speed.
    JuliaTime.shutdown!()   # start with an empty pool: the next _take_worker! must spawn fresh
    on_status_events = Tuple{String,String}[]
    withenv("JULIATIME_TEST_SLOW_WORKER_START" => "4") do
        r = JuliaTime.run_code("1+1"; budget=3.0,
            on_status = (kind, msg) -> push!(on_status_events, (kind, msg)))
        @test r.status === :ok
        @test r.value == 2
        # The learner-visible status while the fresh worker starts must be truthful, and a
        # "running" status must follow once the worker is actually handed the code (B2).
        restarting_at = findfirst(e -> e[1] == "restarting" && occursin("Restarting Julia", e[2]), on_status_events)
        running_at = findfirst(e -> e[1] == "running", on_status_events)
        @test restarting_at !== nothing
        @test running_at !== nothing
        @test restarting_at < running_at
    end

    JuliaTime.shutdown!()
end

@testset "sandbox worker pool is prewarmed for the mystery chapters' DataFrames ops (T2)" begin
    # Reproduces the 2-vCPU CI failure: a fresh worker's *first* `leftjoin` (or groupby/combine,
    # filter, sample, boolean-indexing) used to JIT-compile inside the learner's 5 s budget and
    # read back as a false timeout (test/test_mystery_c3.jl:202-203 on ubuntu-latest,
    # 2026-09-13 three-OS run). `warmup!()` must pay that cost for every pool worker up front, so
    # the first learner move against a freshly warmed pool always completes.
    JuliaTime.shutdown!()   # start with an empty pool
    before = JuliaTime._PREWARM_RUNS[]
    JuliaTime.warmup!(n=2)
    @test JuliaTime._PREWARM_RUNS[] >= before + 2   # both pool workers were proven ready and prewarmed

    t = @elapsed r = JuliaTime.run_code("""
        left = DataFrame(tray_id=["A", "B", "C"], reported=[2, 1, 0])
        right = DataFrame(tray_id=["A", "B"], logged=[2, 1])
        leftjoin(left, right, on=:tray_id)
        """)
    @test r.status === :ok
    @test t < 5.0   # the production learner budget (RUN_BUDGET); prewarm must keep this well inside it

    JuliaTime.shutdown!()
end

@testset "a move arriving during a background warm-up waits for a worker instead of reporting none" begin
    JuliaTime.shutdown!()
    # Simulate an in-flight warm-up that only hands over a worker after 1.5 s, with the pool empty.
    slow = Threads.@spawn begin
        sleep(1.5)
        JuliaTime._top_up!(1)
    end
    JuliaTime._WARMUP_TASK[] = slow
    statuses = String[]
    t0 = time()
    r = JuliaTime.run_code("1+1"; on_status=(k, m) -> push!(statuses, k))
    elapsed = time() - t0
    @test r.status === :ok
    @test r.value == 2
    @test elapsed >= 1.0
    @test elapsed < JuliaTime.ACQUIRE_BUDGET
    @test statuses == ["restarting", "running"]
    wait(slow)
    JuliaTime.shutdown!()
end

@testset "a stale pooled worker is replaced, not reported as no worker" begin
    JuliaTime.shutdown!()
    JuliaTime._top_up!(1)
    stale = lock(JuliaTime._POOL_LOCK) do
        pop!(JuliaTime._POOL)
    end
    kill(stale.process)
    wait(stale.process)
    stale.ready = false
    lock(JuliaTime._POOL_LOCK) do
        push!(JuliaTime._POOL, stale)   # a dead worker at the front of the pool
    end
    statuses = String[]
    r = JuliaTime.run_code("1+1"; on_status=(k, m) -> push!(statuses, k))
    @test r.status === :ok
    @test r.value == 2
    @test "restarting" in statuses
    JuliaTime.shutdown!()
end

# Kill a pooled worker's OS process the way something outside the sandbox would (an out-of-band
# kill, or a stop that left it dead), without going through `_kill_worker!`.
_kill_out_of_band(w) = Sys.iswindows() ? kill(w.process) : kill(w.process, Base.SIGKILL)
_pooled_workers() = lock(() -> copy(JuliaTime._POOL), JuliaTime._POOL_LOCK)

@testset "a warm pooled worker that died while idle does not reject the next correct move" begin
    # 2026-09-24 (CI Linux/Windows/macOS, local full-suite runs): a pooled worker that had already
    # proven itself ready died while idle, and the next move taken from the pool failed with
    # "IOError: write: broken pipe" (death already visible here) or "EOFError: read end of file"
    # (killed but not yet reaped) — a correct answer rejected, and the move after it too while
    # the rest of the pool was dead. The learner's code never reached a live worker, so the move
    # must be answered on the FIRST call, and replacing the worker is acquisition, not budget.
    JuliaTime.shutdown!()
    JuliaTime.warmup!(n=2)
    dead = _pooled_workers()
    @test length(dead) >= 2
    @test all(w -> w.ready, dead)          # proven ready: the path that trusts `ready` is exercised
    for w in dead
        _kill_out_of_band(w)
        wait(w.process)                    # the death is fully visible: the broken-pipe variant
    end
    statuses = String[]
    withenv("JULIATIME_TEST_SLOW_WORKER_START" => "4") do   # the replacement takes longer than `budget`
        r = JuliaTime.run_code("1+1"; budget=3.0, on_status=(k, m) -> push!(statuses, k))
        @test r.status === :ok
        @test r.value == 2
    end
    @test "restarting" in statuses && last(statuses) == "running"
    owned = lock(() -> copy(JuliaTime._OWNED_PROCESSES), JuliaTime._POOL_LOCK)
    @test !any(w -> haskey(owned, w.id), dead)   # the dead workers were reaped, not left owned

    # Killed but not yet reaped by this process: the EOFError variant.
    JuliaTime.warmup!(n=2)
    foreach(_kill_out_of_band, _pooled_workers())
    r = JuliaTime.run_code("1+1")
    @test r.status === :ok
    @test r.value == 2
    JuliaTime.shutdown!()
end

@testset "a line that stops Julia itself is reported once and never re-run" begin
    # The dead-worker recovery above must never run a learner's line twice. Each line appends one
    # row to a file before stopping, so a second run would show as a second row.
    JuliaTime.shutdown!()
    JuliaTime.warmup!(n=2)
    mktempdir() do dir
        runs = joinpath(dir, "runs.txt")
        append_row = "open(io -> println(io, \"ran\"), $(repr(runs)), \"a\")"

        # The ordinary spelling is shadowed inside the sandbox and reads as a learner error.
        r = JuliaTime.run_code("$append_row; exit()")
        @test r.status === :error
        @test occursin("That line stopped Julia itself (exit() or a crash)", r.message)
        @test countlines(runs) == 1

        # `Base.exit()` really ends the worker process after the line started running: that must
        # stay a reported error, not be re-sent to a fresh worker.
        r = JuliaTime.run_code("$append_row; Base.exit()")
        @test r.status === :error
        @test countlines(runs) == 2
        @test JuliaTime.run_code("1+1").value == 2   # the next move still works
    end
    JuliaTime.shutdown!()
end

@testset "a live worker whose reply stream was detached is not sent the move twice" begin
    # Adversarial review 2026-09-24: an earlier move can leave a background task that closes the
    # worker's reply stream while the worker itself stays alive and keeps reading requests. The
    # next move then sees the stream end with no start receipt, although the live worker already
    # has the request and may run it. Only a worker positively observed dead may be sent the move
    # again, so this sequence must run the line at most once.
    JuliaTime.shutdown!()
    JuliaTime.warmup!(n=1)
    mktempdir() do dir
        runs = joinpath(dir, "runs.txt")
        touch(runs)
        detach = "@async (sleep(0.3); orig = stdout; redirect_stdout(devnull); close(orig)); nothing"
        @test JuliaTime.run_code(detach).status === :ok
        sleep(0.8)                                   # the worker is idle when the stream closes
        r = JuliaTime.run_code("open(io -> println(io, \"ran\"), $(repr(runs)), \"a\"); 1")
        sleep(1.0)                                   # give a second copy time to land, if sent
        @test countlines(runs) <= 1
        @test JuliaTime.run_code("1+1").value == 2   # the next move still works
    end
    JuliaTime.shutdown!()
end

@testset "stray output left by an earlier move does not make a stopped line run twice" begin
    # Adversarial review 2026-09-24: a background task from an earlier move can print into the
    # reply stream after that move returned. Those bytes garble the next move's start receipt, and
    # if that line then ends the worker the read fails. A stream that carried any bytes is not an
    # empty stream, so the line must be reported once and never sent to another worker.
    JuliaTime.shutdown!()
    JuliaTime.warmup!(n=1)
    mktempdir() do dir
        runs = joinpath(dir, "runs.txt")
        touch(runs)
        @test JuliaTime.run_code("Timer(_ -> println(\"...\"), 0.5); nothing").status === :ok
        sleep(1.5)                                   # the stray line lands while the worker is idle
        r = JuliaTime.run_code("open(io -> println(io, \"ran\"), $(repr(runs)), \"a\"); Base.exit()")
        @test r.status === :error
        sleep(1.0)
        @test countlines(runs) == 1
        @test JuliaTime.run_code("1+1").value == 2
    end
    JuliaTime.shutdown!()
end

# One worker carries one request at a time: its stdin/stdout pipes are shared, and two callers
# driving them at once interleave bytes, so both round trips fail and the worker can be left with a
# stray reply that the next move reads first ("the sandbox worker replied before acknowledging the
# request"; CI ubuntu-latest 2026-09-25, PR #1). `_prewarm_pool!` used to prove workers while they
# were still in `_POOL`, where an overlapping warm-up (every `start_server` starts one, and only the
# newest is tracked) or a learner move could take the same worker mid-proof. A worker being proven
# must be out of the pool.

@testset "a worker being proven ready is not in the pool" begin
    JuliaTime.shutdown!()
    withenv("JULIATIME_TEST_SLOW_WORKER_START" => "3") do   # the proof takes at least 3 s
        JuliaTime._top_up!(1)
        w = lock(() -> only(JuliaTime._POOL), JuliaTime._POOL_LOCK)
        proving = @async JuliaTime._prewarm_pool!()
        sleep(0.5)                                  # the proof of `w` is now in flight
        @test !istaskdone(proving)
        @test lock(() -> !(w in JuliaTime._POOL), JuliaTime._POOL_LOCK)
        wait(proving)
        @test w.ready
        @test lock(() -> w in JuliaTime._POOL, JuliaTime._POOL_LOCK)   # handed back once proven
    end
    JuliaTime.shutdown!()
end

@testset "two overlapping prewarms prove each worker once, and every worker then runs code" begin
    JuliaTime.shutdown!()
    JuliaTime._top_up!(2)
    before = JuliaTime._PREWARM_RUNS[]
    a = @async JuliaTime._prewarm_pool!()
    b = @async JuliaTime._prewarm_pool!()
    wait(a); wait(b)
    workers = lock(() -> copy(JuliaTime._POOL), JuliaTime._POOL_LOCK)
    @test length(workers) == 2
    @test all(w -> w.ready, workers)
    @test JuliaTime._PREWARM_RUNS[] == before + 2   # each worker proven exactly once
    for w in workers
        tag, reply, _ = JuliaTime._worker_round_trip(w, "1+1", (;), nothing, (), 20.0)
        @test tag === :ok
        tag === :ok && @test reply[2] == 2
    end
    JuliaTime.shutdown!()
end

# `_run_warmup_in_background!` (used by `start_server`) used to spawn an unconditional new task and
# overwrite `_WARMUP_TASK[]` with it every time it was called. Every `start_server` call starts one, so
# when two run in the same process (the test suite does this; the no-browser test above starts two
# servers) only the newest warm-up was tracked. `shutdown!()` waits only for `_WARMUP_TASK[]` before
# killing `_OWNED_PROCESSES` and lowering `_SHUTTING_DOWN[]` — so an older, untracked warm-up still
# mid-flight when `shutdown!()` returns could go on to call `_top_up!` (via `warmup!`) after
# `_SHUTTING_DOWN[]` was lowered again, and spawn a worker process that nothing then owns or kills: a
# leaked OS process on a shared machine.
@testset "an older untracked warm-up cannot spawn a worker after shutdown! returns" begin
    # Every raw observation below is gathered into a plain local first, and every `@test` runs
    # only at the end: a failing `@test` mid-sequence spends real wall-clock time formatting a
    # stack trace, and that would itself perturb the very timing this test depends on (the older
    # warm-up's `sleep(2.0)` racing the second `shutdown!()` call).
    JuliaTime.shutdown!()
    older_finished = Ref(false)
    older_fn = () -> begin
        JuliaTime._top_up!(1)   # the first spawn: fine on its own
        sleep(2.0)               # still "in the background" when a second warm-up starts and finishes
        JuliaTime._top_up!(1)   # the vulnerable second spawn: must be a no-op once shutdown! has begun
        older_finished[] = true
    end
    newer_started = Ref(false)
    newer_fn = () -> (newer_started[] = true)   # a second warm-up that would finish almost immediately

    task_older = JuliaTime._run_warmup_in_background!(older_fn)
    sleep(0.5)   # let the older warm-up spawn its first worker
    owned_after_first_spawn = lock(() -> length(JuliaTime._OWNED_PROCESSES), JuliaTime._POOL_LOCK)

    task_newer = JuliaTime._run_warmup_in_background!(newer_fn)   # must join, not replace, the in-flight older task
    joined_existing_task = task_newer === task_older
    newer_ran = newer_started[]

    shutdown_started = time()
    JuliaTime.shutdown!()   # must not return while the older warm-up can still spawn a worker
    shutdown_elapsed = time() - shutdown_started

    # Whether or not shutdown! already waited for it above, give the older warm-up (if the bug
    # left it still running) every chance to finish and attempt its vulnerable second `_top_up!`
    # before checking for a leak — a bare immediate check would pass by accident on the buggy
    # code too, since that second `_top_up!` has not necessarily run yet at this exact instant.
    older_completed = timedwait(() -> older_finished[], 5.0; pollint=0.05) == :ok
    owned_after_older_finished = length(JuliaTime._OWNED_PROCESSES)
    pool_after_older_finished = length(JuliaTime._POOL)

    @test owned_after_first_spawn == 1
    @test joined_existing_task   # the older, in-flight warm-up was reused rather than replaced
    @test !newer_ran             # ...so `newer_fn` itself never ran
    @test shutdown_elapsed > 1.0   # shutdown! actually waited for the older warm-up to finish
    @test older_finished[]
    @test older_completed
    @test owned_after_older_finished == 0   # no process leaked once the older warm-up finished
    @test pool_after_older_finished == 0
end

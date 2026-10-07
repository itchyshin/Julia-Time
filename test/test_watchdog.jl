isdefined(Main, :TestWatchdog) || include(joinpath(@__DIR__, "watchdog.jl"))

@testset "test watchdog: a stall is judged against the limit" begin
    @test !TestWatchdog.stalled(0.0, 10.0, 300)
    @test !TestWatchdog.stalled(0.0, 300.0, 300)
    @test TestWatchdog.stalled(0.0, 301.0, 300)
    @test !TestWatchdog.over_cap(0.0, 3600.0, 3600)
    @test TestWatchdog.over_cap(0.0, 3601.0, 3600)
    before = TestWatchdog.LAST[]
    TestWatchdog.progress!("test_watchdog.jl")
    @test TestWatchdog.CURRENT[] == "test_watchdog.jl"
    @test TestWatchdog.LAST[] >= before
end

@testset "test watchdog: every testset start, end and assertion counts as progress" begin
    TestWatchdog.LAST[] = 0.0
    @testset ProgressTestSet "a nested testset" begin
        @test TestWatchdog.LAST[] > 0.0               # the start was noted
        @test occursin("a nested testset", TestWatchdog.CURRENT[])
        TestWatchdog.LAST[] = 0.0
        @test true
        @test TestWatchdog.LAST[] > 0.0               # a recorded assertion was noted
        @testset "inherits the type, no edit needed" begin
            TestWatchdog.LAST[] = 0.0
            @test true
        end
        TestWatchdog.LAST[] = 0.0
    end
    @test TestWatchdog.LAST[] > 0.0                   # the end was noted
end

# Child processes with tiny limits: the real watchdog, the real include_watched, scaled down.
function _run_watched(body::AbstractString; limit, cap, timeout_s)
    dir = mktempdir()
    target = joinpath(dir, "target_file.jl")
    write(target, body)
    runner = joinpath(dir, "runner.jl")
    write(runner, """
        using Test
        include($(repr(joinpath(@__DIR__, "watchdog.jl"))))
        w = TestWatchdog.start!(; limit = $limit, cap = $cap, every = 0.5)
        include_watched($(repr(target)))
        close(w)
        println("CHILD FINISHED")
        """)
    out, err = joinpath(dir, "out.txt"), joinpath(dir, "err.txt")
    proc = run(pipeline(ignorestatus(`$(Base.julia_cmd()) --startup-file=no $runner`); stdout = out, stderr = err); wait = false)
    t0 = time()
    while process_running(proc) && time() - t0 < timeout_s
        sleep(0.25)
    end
    timed_out = process_running(proc)
    timed_out && kill(proc, Base.SIGKILL)
    wait(proc)
    return (code = proc.exitcode, secs = time() - t0, timed_out = timed_out, out = read(out, String), err = read(err, String), target = target)
end

@testset "test watchdog: steady progress for longer than the stall limit is not killed" begin
    # stall limit 2 s; the file runs 6 s, one testset per second (the old rule would have killed it)
    r = _run_watched("""
        using Test
        for i in 1:6
            @testset "step \$i" begin
                sleep(1)
                @testset "inner" begin @test true end
            end
        end
        """; limit = 2, cap = 60, timeout_s = 60)
    @test !r.timed_out
    @test r.code == 0
    @test occursin("CHILD FINISHED", r.out)
    @test !occursin("WATCHDOG", r.err)
    @test r.secs > 5                                  # it really ran longer than three stall limits
end

@testset "test watchdog: a real stall is reported with where it is stuck, and backtraces" begin
    r = _run_watched("""
        using Test
        @testset "quick" begin @test true end
        @testset "the hung one" begin sleep(60) end
        """; limit = 2, cap = 60, timeout_s = 60)
    @test !r.timed_out
    @test r.code != 0
    @test !occursin("CHILD FINISHED", r.out)
    @test occursin(r"WATCHDOG: no progress for \d+ s", r.err)
    @test occursin("stuck in: ", r.err)
    @test occursin("target_file.jl", r.err)
    @test occursin("the hung one", r.err)
    @test occursin("Backtraces of every task follow.", r.err)
    @test r.secs < 30                                 # stopped soon after the limit, not at the 60 s sleep
end

@testset "test watchdog: the hard cap stops a file that keeps progressing forever" begin
    r = _run_watched("""
        using Test
        for i in 1:60
            @testset "tick \$i" begin sleep(0.5) end
        end
        """; limit = 2, cap = 3, timeout_s = 60)
    @test !r.timed_out
    @test r.code != 0
    @test occursin(r"WATCHDOG: this file has run for \d+ s \(hard cap 3 s\)", r.err)
    @test occursin("stuck in: ", r.err)
    @test r.secs < 20
end

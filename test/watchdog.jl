# Fail-fast guard for the test suite (2026-09-26). A CI run (36203806989, PR #11) went silent for 25 minutes
# inside the sandbox tests and was cut off by the job's 30-minute limit, with nothing in the log saying which
# test was stuck. This watchdog records the test file and testset in progress; if nothing makes progress within
# the stall limit it prints where it is stuck and every task's backtrace, force-kills the sandbox workers it
# owns and exits at once. It skips atexit hooks on purpose: a hook (such as sandbox shutdown) may be the thing
# that is stuck.
module TestWatchdog

using Test

# Judged on PROGRESS, not on file length (2026-10-07). On GitHub's windows-latest test_sandbox.jl legitimately
# takes 610 to 970 s (about 45 cold worker starts of 13 to 23 s each) and an earlier "no test file finished in
# 720 s" rule killed it while it was still moving; the longest real gap between two pieces of progress was 32 s.
# Progress now means: a testset starts, a testset ends, an assertion is recorded, or a new file begins.
# A stall is no progress for the stall limit (default 300 s, JULIATIME_TEST_STALL_S). A hard cap per file
# (default 3600 s, JULIATIME_TEST_MAX_S) still stops a runaway that keeps "progressing" forever.

const CURRENT = Ref("suite start")
const LAST = Ref(time())
const FILE_START = Ref(time())
const FILE = Ref("")
const STALL_LIMIT = Ref(300.0)
const FILE_CAP = Ref(3600.0)

stalled(last::Real, now::Real, limit::Real) = now - last > limit
over_cap(file_start::Real, now::Real, cap::Real) = now - file_start > cap

# Quiet progress marker: no printing, so thousands of testsets do not flood the log.
touch!() = (LAST[] = time(); nothing)

function progress!(label::AbstractString)
    CURRENT[] = FILE[] = label
    LAST[] = FILE_START[] = time()
    println("[test file] ", label)
    flush(stdout)
    return nothing
end

# A testset type that wraps Julia's default one and notes progress at every testset start and end and at every
# recorded assertion. Nested testsets inherit the type of their parent, so no test file needs editing.
struct ProgressTestSet <: Test.AbstractTestSet
    inner::Test.DefaultTestSet
end
function ProgressTestSet(desc::AbstractString; kwargs...)
    CURRENT[] = (desc == FILE[] || isempty(FILE[])) ? String(desc) : string(FILE[], " :: ", desc)
    touch!()
    return ProgressTestSet(Test.DefaultTestSet(desc; kwargs...))
end
Test.record(ts::ProgressTestSet, child) = (touch!(); Test.record(ts.inner, child))
Test.record(ts::ProgressTestSet, child::ProgressTestSet) = (touch!(); Test.record(ts.inner, child.inner))
function Test.finish(ts::ProgressTestSet)
    touch!()
    return Test.finish(ts.inner)
end

function report_and_exit(msg::AbstractString)
    println(stderr, "\nWATCHDOG: ", msg, "; stuck in: ", CURRENT[])
    println(stderr, "Backtraces of every task follow.")
    flush(stderr)
    ccall(:jl_print_task_backtraces, Cvoid, (Cint,), 0)
    flush(stderr)
    try
        for (_, proc) in Main.JuliaTime._OWNED_PROCESSES
            try; kill(proc, Base.SIGKILL); catch; end
        end
    catch
    end
    ccall(:_exit, Cvoid, (Cint,), 1)
end

function check()
    now = time()
    limit = STALL_LIMIT[]
    stalled(LAST[], now, limit) &&
        report_and_exit("no progress for $(round(Int, now - LAST[])) s (stall limit $(round(Int, limit)) s)")
    over_cap(FILE_START[], now, FILE_CAP[]) &&
        report_and_exit("this file has run for $(round(Int, now - FILE_START[])) s (hard cap $(round(Int, FILE_CAP[])) s) although it kept progressing")
    return nothing
end

function start!(; limit::Real = parse(Float64, get(ENV, "JULIATIME_TEST_STALL_S", "300")),
                  cap::Real = parse(Float64, get(ENV, "JULIATIME_TEST_MAX_S", "3600")),
                  every::Real = 30)
    STALL_LIMIT[] = limit
    FILE_CAP[] = cap
    LAST[] = FILE_START[] = time()
    return Timer(_ -> check(), every; interval = every)
end

end # module

# Every testset in the file (however nested) runs under TestWatchdog.ProgressTestSet. A failing top-level
# testset now fails the file when the file ends, instead of aborting the file at that testset.
const ProgressTestSet = TestWatchdog.ProgressTestSet   # @testset accepts only a plain symbol as the type
function include_watched(file::AbstractString)
    TestWatchdog.progress!(file)
    @testset ProgressTestSet "$file" begin
        include(file)
    end
    return nothing
end

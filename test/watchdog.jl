# Fail-fast guard for the test suite (2026-09-26). A CI run (36203806989, PR #11) went silent for 25 minutes
# inside the sandbox tests and was cut off by the job's 30-minute limit, with nothing in the log saying which
# test was stuck. This watchdog records the test file in progress; if no file finishes within the stall limit
# it prints that file's name and every task's backtrace, force-kills the sandbox workers it owns and exits at
# once. It skips atexit hooks on purpose: a hook (such as sandbox shutdown) may be the thing that is stuck.
module TestWatchdog

const CURRENT = Ref("suite start")
const LAST = Ref(time())

stalled(last::Real, now::Real, limit::Real) = now - last > limit

function progress!(label::AbstractString)
    CURRENT[] = label
    LAST[] = time()
    println("[test file] ", label)
    flush(stdout)
    return nothing
end

function report_and_exit(limit)
    println(stderr, "\nWATCHDOG: no test file finished for $(round(Int, limit)) s; stuck in: ", CURRENT[])
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

function start!(; limit::Real = parse(Float64, get(ENV, "JULIATIME_TEST_STALL_S", "720")))
    return Timer(30; interval = 30) do _
        stalled(LAST[], time(), limit) && report_and_exit(limit)
    end
end

end # module

include_watched(file::AbstractString) = (TestWatchdog.progress!(file); include(file))

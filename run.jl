# Local-only game launcher. The server owns clean browser and sandbox shutdown.
#
# The launch helpers are easy to double-click before the one-time package setup.
# Load the project package inside a guard so that situation names the next safe
# action instead of exposing Julia's package-manager error as the whole lesson.
try
    @eval using JuliaTime
catch err
    println(stderr, "JULIA_TIME_NOT_READY — Julia Time's one-time setup has not finished yet.")
    println(stderr, "Next: run the matching setup command in docs/install.md, then start this launcher again.")
    println(stderr, "If setup still fails, show your facilitator the code JULIA_TIME_NOT_READY.")
    exit(1)
end

try
    JuliaTime.run_server(; host="127.0.0.1", port=8000)
catch err
    # `run_server` can fail before its own lifecycle `try` begins when the
    # loopback port is already occupied. Its warmup has already created owned
    # sandbox workers, so reap those before giving the learner an actionable
    # local recovery rather than a raw exception as their only next step.
    try
        JuliaTime.shutdown!()
    catch
    end
    println(stderr, "SERVER_START_FAILED — Julia Time could not start the Case Board at http://127.0.0.1:8000/course/index.html.")
    println(stderr, "Next: close a previous Julia Time launcher or ask the facilitator for help.")
    println(stderr, "Details: ", sprint(showerror, err))
    exit(1)
end

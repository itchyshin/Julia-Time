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

function launcher_start_detail(error)
    error isa JuliaTime.AllPortsBusy && return sprint(showerror, error)
    first_line = first(split(sprint(showerror, error), '\n'; limit=2))
    return isempty(first_line) ? "Julia reported an unknown local-server error." : first_line
end

try
    # Tries port 8000, then 8001 to 8009 if another program holds it; if Julia Time is already
    # running in an earlier window, reopens that game in the browser instead.
    JuliaTime.launch(; host="127.0.0.1", ports=JuliaTime.LAUNCH_PORTS)
catch err
    # Reap any sandbox workers a failed start created before giving the learner an actionable
    # local recovery rather than a raw exception as their only next step.
    try
        JuliaTime.shutdown!()
    catch
    end
    println(stderr, "SERVER_START_FAILED — Julia Time could not start the Case Board on this computer.")
    println(stderr, "Next: close a previous Julia Time launcher window. If none is open, another program may be using ports 8000 to 8009 (for example a Python or Jupyter server); close it or restart the computer, then start Julia Time again.")
    println(stderr, "Details: ", launcher_start_detail(err))
    exit(1)
end

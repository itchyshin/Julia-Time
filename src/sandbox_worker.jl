# Private worker entry point for Julia Time's process sandbox.
#
# The parent and this process exchange only Julia-serialised request/response values over
# stdin/stdout.  Each request is acknowledged with a start receipt before anything in it is
# evaluated (`_eval_on_worker`), which lets the parent tell a worker that died while idle from
# one that died while running a learner's line.  Keeping the worker outside `Distributed.addprocs` matters: after several
# forced worker kills, Julia 1.10's Distributed launcher can stop starting fresh workers even
# when it reports none alive.  A learner should always receive either a result or a timeout,
# never inherit that launcher dead end.

using JuliaTime
using Serialization

# Deterministic test hook for T1 (worker-acquisition recovery): a slow machine's replacement
# worker takes real wall-clock seconds to become ready before it can answer anything. Setting
# this env var before spawning simulates that delay on any machine, without waiting on actual
# JIT/package-load speed. See test/test_sandbox.jl and docs/design/01-architecture.md §2.
let delay = get(ENV, "JULIATIME_TEST_SLOW_WORKER_START", "")
    isempty(delay) || sleep(parse(Float64, delay))
end

# Keep the reply pipe to ourselves. A learner's background task (`@async`, a `Timer`) can print
# after its move has returned; with the global `stdout` still being the reply pipe, that text
# landed between protocol messages and broke the next move ("replied before acknowledging the
# request", night bug hunt 2026-09-27). So from here on the global stdout and stderr go to
# devnull, and only this loop and the start receipt write to `reply`. What a move prints during
# its own run is still captured by `_eval_on_worker`'s own redirect. Start-up errors above this
# point still reach the parent's stderr (`_spawn_worker`).
const reply = stdout
redirect_stdout(devnull)
redirect_stderr(devnull)

while true
    request = try
        deserialize(stdin)
    catch
        break
    end

    code, env, seed, protected_bindings = request
    result = try
        JuliaTime._eval_on_worker(code, env, seed, protected_bindings, reply)
    catch e
        (:error, nothing, "", JuliaTime._format_error(e))
    end

    try
        serialize(reply, result)
        flush(reply)
    catch
        break
    end
end

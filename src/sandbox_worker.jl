# Private worker entry point for Julia Time's process sandbox.
#
# The parent and this process exchange only Julia-serialised request/response values over
# stdin/stdout.  Keeping the worker outside `Distributed.addprocs` matters: after several
# forced worker kills, Julia 1.10's Distributed launcher can stop starting fresh workers even
# when it reports none alive.  A learner should always receive either a result or a timeout,
# never inherit that launcher dead end.

using JuliaTime
using Serialization

while true
    request = try
        deserialize(stdin)
    catch
        break
    end

    code, env, seed, protected_bindings = request
    result = try
        JuliaTime._eval_on_worker(code, env, seed, protected_bindings)
    catch e
        (:error, nothing, "", JuliaTime._format_error(e))
    end

    try
        serialize(stdout, result)
        flush(stdout)
    catch
        break
    end
end

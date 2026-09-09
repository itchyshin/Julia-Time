# Sandbox: evaluate player code in a fresh module inside a direct child Julia process, with a
# wall-clock budget enforced by killing that worker's OS process.
#
# Why a process, not an in-process Task interrupt: on this Mac (Julia 1.10.0, the default single
# OS thread), scheduling an InterruptException at a busy, non-allocating `while true; ...; end`
# loop never runs — the loop never yields to let the interrupt or a Timer fire, so the main
# process hangs. `rmprocs` on a busy worker hangs the same way (it waits for a graceful shutdown
# message the worker cannot process). Only `kill(process, SIGKILL)` on the worker's OS process
# works. See docs/design/01-architecture.md §2 (verified live on this machine).
#
# Workers run `src/sandbox_worker.jl`, which loads JuliaTime and exchanges serialised
# request/response values with this process through stdin/stdout.  This avoids Julia 1.10's
# `Distributed.addprocs` recovery failure after several forced worker kills, while preserving the
# non-negotiable process-kill timeout boundary.
#
# Player code is run through `_softscope` (below), not plain `include_string`. `include_string`
# evaluates top-level code with *hard* (file) scoping, under which the everyday beginner loop
# `i = 0; while i < 3; i += 1; end` throws `UndefVarError: i not defined` — the loop body's
# `i += 1` creates a new local shadowing the outer `i` instead of updating it, and only a
# `global i += 1` avoids that. That is exactly the ambiguity the real Julia REPL resolves
# silently in the player's favour, so the sandbox does the same.
#
# `_softscope` is `REPL.softscope` (Julia stdlib, `share/julia/stdlib/v1.10/REPL/src/REPL.jl`),
# copied rather than `using REPL`: `REPL` is not a declared dependency of this package
# (Project.toml is off limits for this slice) and, tried live, is not resolvable at all inside
# `Pkg.test()`'s isolated per-run test environment even via `Main` on a worker (only stdlibs this
# package actually declares get pulled into that temp environment) — so there is no way to reach
# the real `REPL.softscope` from here without a Project.toml change. The function is a tiny, pure
# AST transform with nothing REPL-specific in it: it just marks each top-level local-scope block
# with the core-language `Expr(:softscope, true)` marker that Julia's own lowering already
# understands, and it copies verbatim (Julia is MIT-licensed).

using Distributed
using Random
using Serialization
# Loaded here so that values the worker sends back (a `Normal`, a `DataFrame` column summary)
# can be deserialised in this process — review 2026-09-07-B1-sandbox-adversarial.md, finding 2.
using Distributions, Statistics

const VALUE_CAP_BYTES = 1_000_000
const STDOUT_CAP_CHARS = 10_000

struct SandboxResult
    status::Symbol   # :ok | :error | :timeout
    value::Any
    stdout::String
    message::String
end

# --- worker pool --------------------------------------------------------------------------

mutable struct _SandboxWorker
    id::Int
    process::Base.Process
end

const _POOL = _SandboxWorker[]
const _POOL_LOCK = ReentrantLock()
const MAX_WORKERS = 4          # hard cap on live workers, whatever the callers do (review finding 3)
const _OWNED_PROCESSES = Dict{Int, Any}()
const _SHUTTING_DOWN = Ref(false)
const _NEXT_WORKER_ID = Ref(0)
# Kept for the server shutdown and regression contract: replacement is deliberately lazy and
# synchronous, so no background recovery task can outlive a timed-out learner request.
const _REFILL = Ref{Union{Nothing,Base.Task}}(nothing)   # Base.Task qualified: levels.jl defines the spec's own `Task`

function _spawn_worker()
    project = dirname(Base.active_project())
    script = joinpath(@__DIR__, "sandbox_worker.jl")
    cmd = `$(Base.julia_cmd()) --startup-file=no --history-file=no --project=$project $script`
    proc = open(pipeline(cmd, stderr=devnull), "r+")
    _NEXT_WORKER_ID[] += 1
    worker = _SandboxWorker(_NEXT_WORKER_ID[], proc)
    lock(_POOL_LOCK) do
        _OWNED_PROCESSES[worker.id] = proc
    end
    return worker
end

function _top_up!(n::Integer)
    lock(_POOL_LOCK) do
        while !_SHUTTING_DOWN[] && length(_POOL) < n && length(_OWNED_PROCESSES) < MAX_WORKERS
            push!(_POOL, _spawn_worker())
        end
    end
    return nothing
end

const _KILL_PATH_WARM = Ref(false)

# Pay the child-process/JIT cost before the player can submit code.  The warmup exercises the
# exact timeout path, but its replacement stays in the same direct process protocol as a real
# learner run.
function _prewarm_kill_path!()
    _KILL_PATH_WARM[] && return nothing
    try
        run_code("while true end"; budget=0.1)
    catch
    end
    _KILL_PATH_WARM[] = true
    return nothing
end

"""
    warmup!(; n::Integer=2)

Ensure at least `n` idle sandbox workers exist, with packages already loaded. Idempotent: calling
it again once the pool already holds `n` or more workers does nothing.
"""
function warmup!(; n::Integer=2)
    _top_up!(n)
    _prewarm_kill_path!()  # consumes and kills one pool worker the first time; top up again after
    _top_up!(n)
    return nothing
end

"""
    shutdown!()

Kill every sandbox worker. Safe to call twice.
"""
function shutdown!()
    # Refills are refused from here. Wait outside the lock, because a currently running refill
    # needs that lock to finish.
    refill = lock(_POOL_LOCK) do
        _SHUTTING_DOWN[] = true
        _REFILL[]
    end
    if refill !== nothing
        try
            wait(refill)
        catch
        end
    end
    workers = lock(_POOL_LOCK) do
        _REFILL[] === refill && (_REFILL[] = nothing)
        workers = [_SandboxWorker(id, proc) for (id, proc) in _OWNED_PROCESSES]
        empty!(_POOL)
        workers
    end

    for w in workers
        _kill_worker!(w; timeout_s=2.0)
    end
    lock(_POOL_LOCK) do
        empty!(_OWNED_PROCESSES)
        _SHUTTING_DOWN[] = false
    end
    return nothing
end

function _schedule_refill!(n::Integer=2)
    # Replacement workers are created by the next `_take_worker!` call. Keeping this function
    # preserves the timeout call sites while ensuring no background process launch can outlive
    # the timed-out learner request.
    return nothing
end

function _await_refill!()
    r = lock(_POOL_LOCK) do
        _REFILL[]
    end
    r === nothing && return nothing
    try
        wait(r)
    catch
    end
    lock(_POOL_LOCK) do
        _REFILL[] === r && (_REFILL[] = nothing)
    end
    return nothing
end

function _take_worker!()
    _await_refill!()
    w = lock(_POOL_LOCK) do
        _SHUTTING_DOWN[] || isempty(_POOL) ? nothing : pop!(_POOL)
    end
    w === nothing || return w
    # A learner move needs one replacement worker, not the two-worker startup
    # reserve.  After several forced kills, bootstrapping a second worker before
    # answering this move can leave the launcher waiting in teardown.
    _top_up!(1)
    return lock(_POOL_LOCK) do
        isempty(_POOL) ? nothing : pop!(_POOL)
    end
end

_return_worker!(w::_SandboxWorker) = lock(_POOL_LOCK) do
    _SHUTTING_DOWN[] || push!(_POOL, w)
end

function _reap_killed_worker!(w::_SandboxWorker; timeout_s::Real=0.5)
    try
        if Base.timedwait(() -> process_exited(w.process), Float64(timeout_s)) == :ok
            wait(w.process)
            lock(_POOL_LOCK) do
                get(_OWNED_PROCESSES, w.id, nothing) === w.process && delete!(_OWNED_PROCESSES, w.id)
            end
        end
    catch e
        @warn "sandbox process reap failed" worker=w.id exception=(e, catch_backtrace())
    end
    return nothing
end

function _kill_worker!(w::_SandboxWorker; timeout_s::Real=0.5)
    try
        process_running(w.process) && (Sys.iswindows() ? kill(w.process) : kill(w.process, Base.SIGKILL))
    catch e
        @warn "sandbox OS-process termination failed" worker=w.id exception=(e, catch_backtrace())
    end
    try
        close(w.process)
    catch
    end
    _reap_killed_worker!(w; timeout_s=timeout_s)
    return nothing
end

# --- worker-side evaluation ----------------------------------------------------------------

# Copied verbatim from `REPL.softscope` (Julia stdlib, MIT-licensed) — see the module-top comment
# for why this is vendored rather than `using REPL`.
function _softscope(@nospecialize ex)
    if ex isa Expr
        h = ex.head
        if h === :toplevel
            ex′ = Expr(h)
            map!(_softscope, resize!(ex′.args, length(ex.args)), ex.args)
            return ex′
        elseif h in (:meta, :import, :using, :export, :module, :error, :incomplete, :thunk)
            return ex
        elseif h === :global && all(x -> isa(x, Symbol), ex.args)
            return ex
        else
            return Expr(:block, Expr(:softscope, true), ex)
        end
    end
    return ex
end

# Runs on the worker. Always returns plain, easily-serialised data except `value` itself — never
# throws (every failure path is caught and turned into a `:error` tuple).
function _eval_on_worker(code::String, env, seed, protected_bindings=())
    m = Module(:Sandbox)
    Core.eval(m, :(using Random, Distributions, DataFrames, Statistics))
    # A learner's bare `exit()` is almost always an accidental experiment, not a request to tear
    # down the game. Shadow the ordinary unqualified spelling inside the throw-away module so it
    # becomes an ordinary, recoverable learner error and the next move remains available.
    Core.eval(m, :(exit(args...) = error("That line stopped Julia itself (exit() or a crash) — try again without it.")))
    for (k, v) in pairs(env)
        Core.eval(m, Expr(:(=), k, v))
    end
    seed === nothing || Random.seed!(seed)
    # Opt-in teaching guard: compare final input bindings to a worker-local snapshot.
    # This is data-integrity feedback, not a security boundary or a mutation trace.
    originals = Dict(name => deepcopy(getfield(m, name)) for name in protected_bindings)

    p = Pipe()
    Base.link_pipe!(p; reader_supports_async=true, writer_supports_async=true)
    reader = @async read(p.out, String)

    value = nothing
    status = :ok
    message = ""
    try
        # stdout, stderr and `display` all go to the player's screen (review finding 5).
        redirect_stdout(p) do
            redirect_stderr(p) do
                d = TextDisplay(p)
                pushdisplay(d)
                try
                    value = Core.eval(m, _softscope(Meta.parseall(code)))
                    for (name, original) in originals
                        if !isdefined(m, name) || !isequal(getfield(m, name), original)
                            error("The supplied $(name) records changed. Keep the source table unchanged; create a separate summary or copy, then try again.")
                        end
                    end
                finally
                    popdisplay(d)
                end
            end
        end
    catch e
        status = :error
        value = nothing
        message = _format_error(e)
    finally
        close(p.in)
    end
    printed = fetch(reader)
    close(p.out)
    if length(printed) > STDOUT_CAP_CHARS
        printed = printed[1:STDOUT_CAP_CHARS] * "\n... (truncated)"
    end
    if status === :ok && _owned_by(value, m)
        # A value whose type lives in this throw-away module cannot be deserialised in the main
        # process (review finding 1). Send its text form instead, and say why.
        shown = replace(sprint(show, value), "Main.Sandbox." => "")
        length(shown) > 2000 && (shown = first(shown, 2000) * "…")
        message = "This result is a function or a type you just defined, so the game shows it as text: " *
                  shown * ". To use it, call it on the same line (for example f(3))."
        value = nothing
    end
    return (status, value, printed, message)
end

# Does `v` (or an element of it) have a type defined inside the sandbox module `m`? Such values
# exist only on the worker. Tasks and Modules never cross either.
function _owned_by(v, m::Module)
    (v isa Base.Task || v isa Module) && return true
    t = typeof(v)
    t isa DataType && parentmodule(t) === m && return true
    if v isa Union{AbstractArray, Tuple}
        for x in Iterators.take(v, 50)
            _owned_by(x, m) && return true
        end
    end
    return false
end

# --- error formatting ----------------------------------------------------------------------

# Unwrap the wrapper types that can sit between us and the real error: `include_string` wraps
# every error in a `LoadError`, and (on the rare path where an exception escapes the worker
# function itself rather than being caught inside it) Distributed wraps remote errors in
# `RemoteException` / `CapturedException`.
function _unwrap_error(e)
    while true
        if e isa LoadError
            e = e.error
        elseif e isa RemoteException
            e = e.captured
        elseif e isa CapturedException
            e = e.ex
        else
            return e
        end
    end
end

function _novice_line(e)
    if e isa UndefVarError
        return "`$(e.var)` is a name that doesn't exist yet — check the spelling, or define it first."
    elseif e isa MethodError
        return "A function was called with the wrong kind of argument."
    elseif e isa BoundsError
        return "An index was outside the range of the collection."
    elseif e isa Base.Meta.ParseError
        return "Julia couldn't parse this line — look for a missing bracket, comma or `end`."
    elseif e isa DivideError
        return "Integer division by zero."
    elseif e isa ProcessExitedException
        return "That line stopped Julia itself (exit() or a crash) — try again without it."
    else
        return "Something went wrong running this line."
    end
end

function _format_error(e)
    inner = _unwrap_error(e)
    return _novice_line(inner) * "\n\n" * sprint(showerror, inner)
end

# --- public entry point ---------------------------------------------------------------------

"""
    run_code(code::AbstractString; env=(;), seed=nothing, budget::Real=5.0) -> SandboxResult

Evaluate `code` in a fresh module on a sandbox worker process. `env` is a NamedTuple of bindings
made available before evaluation; `seed`, if given, seeds the worker's default RNG first. The
worker is killed if evaluation exceeds `budget` seconds. Optional `protected_bindings` names
input bindings whose final values must equal their initial snapshots. This does not audit
intermediate mutations and is not a security boundary; the default leaves legacy runs unchanged.
"""
function run_code(code::AbstractString; env=(;), seed=nothing, budget::Real=5.0, protected_bindings=())
    local w
    try
        w = _take_worker!()
    catch e
        return SandboxResult(:error, nothing, "", "Something went wrong running this line.\n\n" * sprint(showerror, e))
    end
    w === nothing && return SandboxResult(:error, nothing, "", "No sandbox worker is available.")

    task = @async begin
        try
            serialize(w.process, (String(code), env, seed, protected_bindings))
            flush(w.process)
            (:ok, deserialize(w.process))
        catch e
            (:error, e)
        end
    end

    outcome = timedwait(() -> istaskdone(task), Float64(budget); pollint=0.05)
    if outcome == :timed_out
        _kill_worker!(w)
        # Closing a direct child pipe makes its blocked deserialisation fail; do not wait
        # indefinitely for a killed worker's final I/O task.
        Base.timedwait(() -> istaskdone(task), 0.5)
        _schedule_refill!()
        return SandboxResult(:timeout, nothing, "",
            "Your code ran for more than $(budget) seconds and was stopped. Loops that never finish are the usual cause.")
    end

    tag, result = fetch(task)
    if tag === :error
        _kill_worker!(w)
        _schedule_refill!()
        return SandboxResult(:error, nothing, "", _format_error(result))
    end

    (status, value, printed, message) = result
    _return_worker!(w)
    status === :error && return SandboxResult(:error, nothing, printed, message)

    sz = try
        Base.summarysize(value)
    catch
        typemax(Int)
    end
    if sz > VALUE_CAP_BYTES
        mb = round(sz / 1_000_000; digits=1)
        return SandboxResult(:ok, nothing, printed,
            "The result was too large to show ($(mb) MB). Try a smaller n or summarise it (e.g. mean, length).")
    end
    return SandboxResult(:ok, value, printed, message)   # message carries the "shown as text" note for values that cannot cross back
end

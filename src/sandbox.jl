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
    ready::Bool   # true once one request/response round trip has proven this worker is alive
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
# Tracks the background task started by `_run_warmup_in_background!` (used by `start_server`) so
# `shutdown!()` can wait for it — see that function and `shutdown!()` for why.
const _WARMUP_TASK = Ref{Union{Nothing,Base.Task}}(nothing)
# Latches true the first time any worker in this process has ever completed a readiness round
# trip. Read by `_take_worker!` to pick a truthful restart message: "Warming up Julia for the
# first run…" before the pool has ever been ready at all, vs "Restarting Julia after the stopped
# run…" once it has (a later kill/replace). Deliberately never reset by `shutdown!()` — it answers
# "has this process ever had a ready worker", not "is the pool ready right now".
const _EVER_READY = Ref(false)

function _spawn_worker()
    project = dirname(Base.active_project())
    script = joinpath(@__DIR__, "sandbox_worker.jl")
    cmd = `$(Base.julia_cmd()) --startup-file=no --history-file=no --project=$project $script`
    proc = open(pipeline(cmd, stderr=devnull), "r+")
    _NEXT_WORKER_ID[] += 1
    worker = _SandboxWorker(_NEXT_WORKER_ID[], proc, false)
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

# Tiny representative calls of the operations the six Missing Fleas chapters ask learners to
# write (T2): boolean-indexing/filter, groupby+combine, leftjoin, sample/rand with a seeded RNG,
# and `.<=` comparisons — on throw-away 3-row frames, purely to force Julia to JIT-compile the
# method specialisations before any learner code runs on this worker. On the reported 2-vCPU CI
# runner, the *first* `leftjoin` a fresh worker ever saw compiled inside the learner's 5 s
# `budget` and read back as a false timeout (test/test_mystery_c3.jl); every one of these
# operations appears in a chapter's reference answer (src/mystery_c2.jl–mystery_c6.jl). This code
# runs inside `_eval_on_worker`, which never throws — an error here still reports :ok up here and
# simply fails to warm that one call path; it can never fail the worker or a real learner move.
const _PREWARM_CODE = """
let df = DataFrame(id=[1, 2, 3], g=[1, 1, 2], v=[1, 2, 3]), other = DataFrame(g=[1, 2], x=[10, 20])
    filter(:g => ==(1), df)
    df[df.v .<= 2, :]
    combine(groupby(df, :g), :v => sum => :s)
    leftjoin(df, other, on=:g)
    sample(MersenneTwister(1), df.id, 2; replace=false)
    rand(MersenneTwister(1), Bool, 3)
    nothing
end
"""

# Counts how many times a worker's readiness round trip actually ran `_PREWARM_CODE` and got a
# reply (tag === :ok), i.e. how many workers paid the DataFrames JIT cost. Exposed for tests
# (T2) — there is no other externally visible signal that prewarm happened, since a warm worker
# behaves identically to an unwarmed one except in timing.
const _PREWARM_RUNS = Ref(0)

# Prove `w` can actually process a request before handing it to a learner move. A worker fresh
# off `_spawn_worker()` is an OS process that may still be starting Julia / JIT-compiling
# packages; that cost belongs to `ACQUIRE_BUDGET`, never to the caller's `budget`. The readiness
# round trip runs `_PREWARM_CODE` rather than a no-op, so this same call also pays the DataFrames
# JIT cost (T2) — whichever call site first makes a worker ready (`warmup!`, or a learner's first
# move against a fresh replacement worker) is where that cost lands, always inside
# `ACQUIRE_BUDGET`, never inside a learner's `budget`.
function _ensure_ready!(w::_SandboxWorker)
    w.ready && return true
    tag, _, _ = _worker_round_trip(w, _PREWARM_CODE, (;), nothing, (), ACQUIRE_BUDGET)
    if tag === :ok
        w.ready = true
        _EVER_READY[] = true
        _PREWARM_RUNS[] += 1
    end
    return w.ready
end

# Prove-ready (and so JIT-prewarm, T2) every worker currently sitting in the pool, not only the
# one `_prewarm_kill_path!` happens to touch. Already-ready workers return immediately
# (`_ensure_ready!` is a no-op for them), so calling this repeatedly is cheap. A worker that fails
# to become ready here is left for the ordinary `_take_worker!` recovery path — prewarm failure
# must never itself break a worker or `warmup!`.
function _prewarm_pool!()
    workers = lock(_POOL_LOCK) do
        copy(_POOL)
    end
    for w in workers
        try
            _ensure_ready!(w)
        catch e
            @warn "sandbox prewarm failed" worker=w.id exception=(e, catch_backtrace())
        end
    end
    return nothing
end

"""
    warmup!(; n::Integer=2)

Ensure at least `n` idle sandbox workers exist, with packages already loaded and the DataFrames
operations the six chapters use already JIT-compiled (T2). Idempotent: calling it again once the
pool already holds `n` or more ready workers does nothing beyond a fast no-op readiness check.
"""
function warmup!(; n::Integer=2)
    _top_up!(n)
    _prewarm_kill_path!()  # consumes and kills one pool worker the first time; top up again after
    _top_up!(n)
    _prewarm_pool!()       # JIT the DataFrames ops every mystery chapter uses, before any learner move
    return nothing
end

"""
    _run_warmup_in_background!(warmup_fn::Function=warmup!) -> Task

Run `warmup_fn` on a background task instead of blocking the caller, so the HTTP server (see
`start_server` in src/server.jl) can start answering requests immediately and warm the sandbox pool
while learners are already looking at the Case Board. Uses `Threads.@spawn` — a genuine second OS
thread — when more than one Julia thread is available, since `warmup_fn` blocks on OS process spawn
and worker round-trip I/O and must not compete with the HTTP event loop for the only thread; falls
back to a cooperative `@async` task when Julia was started with a single thread (`Threads.nthreads()
== 1`), which still lets the server answer requests between `warmup_fn`'s own I/O-driven yield
points (the same cooperative pattern `_worker_round_trip` already relies on) even though there is no
second thread to run it on in parallel.

The returned task is recorded in `_WARMUP_TASK` so `shutdown!()` can wait for it — see there for why.
Never throws: a failing `warmup_fn` is caught and printed as a one-line warning, not a crash.
"""
function _run_warmup_in_background!(warmup_fn::Function=warmup!)
    body = function ()
        try
            warmup_fn()
            println("Sandbox ready.")
        catch e
            println("Warning: sandbox warm-up failed — ", sprint(showerror, e))
        finally
            flush(stdout)
        end
        return nothing
    end
    task = Threads.nthreads() > 1 ? Threads.@spawn(body()) : @async(body())
    lock(_POOL_LOCK) do
        _WARMUP_TASK[] = task
    end
    return task
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
    # A background warm-up (see `_run_warmup_in_background!`, used by `start_server`) may still be
    # spawning or proving-ready workers. Wait for it to finish now, with `_SHUTTING_DOWN[]` already
    # true so any `_top_up!` call still inside it stops growing the pool — otherwise it could spawn
    # a worker process after this call has already captured/killed `_OWNED_PROCESSES` and reset
    # `_SHUTTING_DOWN[]`, leaking an untracked process past a "clean shutdown".
    warmup_task = lock(_POOL_LOCK) do
        _WARMUP_TASK[]
    end
    if warmup_task !== nothing && !istaskdone(warmup_task)
        try
            wait(warmup_task)
        catch
        end
    end
    lock(_POOL_LOCK) do
        _WARMUP_TASK[] === warmup_task && (_WARMUP_TASK[] = nothing)
    end
    workers = lock(_POOL_LOCK) do
        _REFILL[] === refill && (_REFILL[] = nothing)
        workers = [_SandboxWorker(id, proc, true) for (id, proc) in _OWNED_PROCESSES]
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

# Generous cap on getting a live, request-ready worker (fresh process start, package JIT). Kept
# separate from `budget` (T1): a slow machine's replacement-worker startup must never be charged
# against the learner's code-execution timeout, or a correct first move after a stopped run reads
# as a false timeout. 180s, not the earlier 60s: the server now serves the Case Board immediately
# and warms the pool in the background (`_run_warmup_in_background!`, `start_server` in
# src/server.jl), so a learner's very first move can now race that background warm-up for the
# first worker and pay the full cold process-start + package-JIT cost inline, instead of that cost
# always hiding behind the old blocking pre-start warmup. The ceiling here must be at least as
# generous as a cold learner laptop's worst case. See docs/design/01-architecture.md §2 and
# test/test_sandbox.jl.
const ACQUIRE_BUDGET = 180.0

# Send `(code, env, seed, protected_bindings)` to `w` and wait up to `timeout_s` for its reply.
# Shared by the real evaluation round trip and the readiness ping below.
function _worker_round_trip(w::_SandboxWorker, code, env, seed, protected_bindings, timeout_s::Real)
    task = @async begin
        try
            serialize(w.process, (String(code), env, seed, protected_bindings))
            flush(w.process)
            (:ok, deserialize(w.process))
        catch e
            (:error, e)
        end
    end
    outcome = timedwait(() -> istaskdone(task), Float64(timeout_s); pollint=0.05)
    outcome == :timed_out && return (:timeout, nothing, task)
    return (fetch(task)..., task)
end

# Truthful restart message for `_take_worker!` below: before this process has ever had a ready
# worker (the very first move, possibly still racing the background warm-up started by
# `start_server`), vs. after a worker has been killed (timeout, exit()) and must be replaced.
_restart_message() = _EVER_READY[] ? "Restarting Julia after the stopped run…" : "Warming up Julia for the first run…"

# Wait (bounded by `ACQUIRE_BUDGET`) for an in-flight background warm-up before taking any
# worker: the warm-up is still spawning and proving the startup workers, and two callers driving
# one worker's pipes at once garble both. A first move that lands in this window is told the truth
# ("Warming up Julia for the first run…") and then gets a proven worker. Returns whether a wait
# actually happened, so the caller can pair it with a "running" status.
# The warm-up task itself calls `run_code` (kill-path prewarm), so a caller running *inside* that
# task must never wait on it: that would be a self-deadlock until the budget expires.
function _warmup_in_flight()
    warm = lock(_POOL_LOCK) do
        _WARMUP_TASK[]
    end
    (warm === nothing || istaskdone(warm) || warm === current_task()) && return nothing
    return warm
end

function _await_warmup!(on_status=nothing)
    warm = _warmup_in_flight()
    warm === nothing && return false
    on_status !== nothing && on_status("restarting", _restart_message())
    deadline = time() + ACQUIRE_BUDGET
    while !istaskdone(warm) && time() < deadline && !_SHUTTING_DOWN[]
        Base.timedwait(() -> istaskdone(warm), 0.5; pollint=0.05)
    end
    return true
end

function _take_worker!(on_status=nothing)
    _await_refill!()
    waited_for_warmup = _await_warmup!(on_status)
    w = lock(_POOL_LOCK) do
        _SHUTTING_DOWN[] || isempty(_POOL) ? nothing : pop!(_POOL)
    end
    # Only a worker that actually needed spawning or proving-ready gets a status pair: an
    # already-warm pooled worker serves the move immediately, so there is nothing to narrate and
    # ordinary fast moves stay silent on the wire (no "running" chatter on every keystroke's run).
    restarted = waited_for_warmup
    if w === nothing
        restarted || (on_status !== nothing && on_status("restarting", _restart_message()))
        restarted = true
        # A learner move needs one replacement worker, not the two-worker startup
        # reserve.  After several forced kills, bootstrapping a second worker before
        # answering this move can leave the launcher waiting in teardown.
        #
        # While a background warm-up (`_run_warmup_in_background!`) is still spawning the
        # startup workers, `_OWNED_PROCESSES` can already be at `MAX_WORKERS`, so `_top_up!(1)`
        # spawns nothing and an immediate pop finds an empty pool — a first move arriving in
        # that window must WAIT for the warm-up to hand over a worker, not report "no worker".
        # The wait is bounded by `ACQUIRE_BUDGET`, the same cap a cold replacement pays.
        deadline = time() + ACQUIRE_BUDGET
        while w === nothing && time() < deadline && !_SHUTTING_DOWN[]
            warm = _warmup_in_flight()
            if warm !== nothing
                Base.timedwait(0.5; pollint=0.05) do
                    istaskdone(warm) || lock(() -> !isempty(_POOL), _POOL_LOCK)
                end
            else
                _top_up!(1)
                lock(() -> isempty(_POOL), _POOL_LOCK) && sleep(0.2)
            end
            w = lock(_POOL_LOCK) do
                isempty(_POOL) ? nothing : pop!(_POOL)
            end
        end
    elseif !w.ready
        # A pool worker that has never answered a round trip (fresh off `warmup!`) still
        # pays the same JIT/process-start cost as a freshly spawned one below — the
        # learner is about to wait through `_ensure_ready!`, so tell them the same truth
        # (review 2026-09-12-v02-candidate-panel-adversary.md, S1).
        restarted || (on_status !== nothing && on_status("restarting", _restart_message()))
        restarted = true
    end
    w === nothing && return nothing
    # A pooled worker can be stale (its process torn down by an earlier shutdown, or crashed
    # while idle). One dead worker must never fail a learner's move: kill it, spawn a fresh
    # replacement and prove that one, a bounded number of times inside the same acquisition budget.
    attempts = 0
    while !_ensure_ready!(w)
        _kill_worker!(w)
        attempts += 1
        (attempts >= 3 || _SHUTTING_DOWN[]) && return nothing
        restarted = true
        on_status !== nothing && on_status("restarting", _restart_message())
        _top_up!(1)
        w = lock(_POOL_LOCK) do
            isempty(_POOL) ? nothing : pop!(_POOL)
        end
        w === nothing && return nothing
    end
    # Clears a "restarting" line and re-arms a client's deadline timer once the code this
    # worker was acquired for is actually about to run (B1/B2, same review).
    restarted && on_status !== nothing && on_status("running", "")
    return w
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
    run_code(code::AbstractString; env=(;), seed=nothing, budget::Real=5.0, on_status=nothing) -> SandboxResult

Evaluate `code` in a fresh module on a sandbox worker process. `env` is a NamedTuple of bindings
made available before evaluation; `seed`, if given, seeds the worker's default RNG first. The
worker is killed if evaluation exceeds `budget` seconds. `budget` covers only the learner's code
running on a live worker: acquiring or replacing a worker (spawning a fresh OS process, paying its
package JIT cost) is governed separately by `ACQUIRE_BUDGET` so a slow machine's replacement time
is never charged against the learner's move (T1). Optional `on_status(kind::String,
message::String)` is called `("restarting", text)` if a worker must be (re)spawned or proven ready
before this move, followed by `("running", "")` once that same worker is actually handed the code —
so a caller can surface a truthful status while the learner waits and clear it when the run really
starts. An already-warm pooled worker serves the move immediately and neither status fires (review
2026-09-12-v02-candidate-panel-adversary.md, B1/B2/S1). Optional `protected_bindings` names input
bindings whose
final values must equal their initial snapshots. This does not audit intermediate mutations and is
not a security boundary; the default leaves legacy runs unchanged.
"""
function run_code(code::AbstractString; env=(;), seed=nothing, budget::Real=5.0, protected_bindings=(), on_status=nothing)
    local w
    try
        w = _take_worker!(on_status)
    catch e
        return SandboxResult(:error, nothing, "", "Something went wrong running this line.\n\n" * sprint(showerror, e))
    end
    w === nothing && return SandboxResult(:error, nothing, "", "No sandbox worker is available.")

    tag, result, task = _worker_round_trip(w, code, env, seed, protected_bindings, budget)
    if tag === :timeout
        _kill_worker!(w)
        # Closing a direct child pipe makes its blocked deserialisation fail; do not wait
        # indefinitely for a killed worker's final I/O task.
        Base.timedwait(() -> istaskdone(task), 0.5)
        _schedule_refill!()
        return SandboxResult(:timeout, nothing, "",
            "Your code ran for more than $(budget) seconds and was stopped. Loops that never finish are the usual cause.")
    end

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

# Server: wires protocol.jl to HTTP.jl — static file serving plus the WebSocket message loop.
# APIs used by the static and WebSocket integration tests (original implementation used HTTP 1.11):
# `HTTP.WebSockets.isupgrade`, `HTTP.WebSockets.upgrade(f, ::Stream)`, `HTTP.listen!`.

using HTTP

const RUN_BUDGET = 5.0

# `run_code` spawns/kills worker processes in a shared pool (see src/sandbox.jl) — it is proven
# safe only for sequential calls, not concurrent ones from multiple WebSocket connections. Every
# call to it here goes through this lock so at most one sandbox run is in flight at a time.
const _RUN_LOCK = ReentrantLock()

const WEBROOT = joinpath(@__DIR__, "..", "web")
const COURSE_LANDING_PATH = "course/index.html"

"""
    _browser_url(host, port) -> String

Return the learner-facing Case Board URL opened by the local launcher. The legacy root page remains
served for saved links and regression coverage, but it is not the supported starting point.
"""
_browser_url(host::AbstractString, port::Integer) = "http://$host:$port/$COURSE_LANDING_PATH"

"""
    _level_by_id_or_nothing(id) -> Union{Level,Nothing}

Look up a registered level without throwing (unlike `level_by_id`), so the caller can produce the
client-facing "Unknown level: …" message instead of `level_by_id`'s internal wording.
"""
function _level_by_id_or_nothing(id)
    for l in LEVELS
        l.id == id && return l
    end
    return nothing
end

"""
    handle_message(msg::Dict) -> Dict

Handle one parsed client message and return the reply to send back. Never throws.
"""
function handle_message(msg::Dict; on_status::Function=((_, __) -> nothing))
    try
        type = get(msg, "type", nothing)
        if type == "ping"
            return Dict("type" => "pong")
        elseif type == "levels"
            return Dict(
                "type" => "levels",
                "levels" => [Dict("id" => l.id, "title" => l.title, "ungraded" => isempty(l.tasks)) for l in LEVELS],
            )
        elseif type == "setup_status"
            return setup_status_reply(msg)
        elseif type == "benchmark_info"
            return speed_lab_info_reply(msg)
        elseif type == "benchmark_run"
            return speed_lab_run_reply(msg)
        elseif type == "level_info"
            level = _level_by_id_or_nothing(get(msg, "level", nothing))
            level === nothing && return Dict("type" => "error", "message" => "Unknown level: $(repr(get(msg, "level", nothing)))")
            return Dict(
                "type" => "level",
                "id" => level.id,
                "title" => level.title,
                "cast_line" => level.cast_line,
                "bridge" => Dict("julia" => level.bridge.julia, "r" => level.bridge.r, "python" => level.bridge.python),
                "preamble" => level.preamble,
                "visual" => String(level.visual),
                "data_label" => DATA_LABEL,
                "tasks" => [Dict("kind" => String(t.kind), "prompt" => t.prompt, "predict" => t.predict, "starter" => t.starter)
                            for t in level.tasks],
            )
        elseif type == "case_info"
            chapter = get(msg, "chapter", "C1")
            chapter == "C1" && return mystery_case_info(msg)
            chapter == "C2" && return mystery_c2_case_info(msg)
            chapter == "C3" && return mystery_c3_case_info(msg)
            chapter == "C4" && return mystery_c4_case_info(msg)
            chapter == "C5" && return mystery_c5_case_info(msg)
            chapter == "C6" && return mystery_c6_case_info(msg)
            return Dict("type" => "error", "message" => "Unknown mystery chapter.")
        elseif type == "case_run"
            chapter = get(msg, "chapter", "C1")
            chapter == "C1" && return mystery_case_run(msg; on_status=on_status)
            chapter == "C2" && return mystery_c2_case_run(msg; on_status=on_status)
            chapter == "C3" && return mystery_c3_case_run(msg; on_status=on_status)
            chapter == "C4" && return mystery_c4_case_run(msg; on_status=on_status)
            chapter == "C5" && return mystery_c5_case_run(msg; on_status=on_status)
            chapter == "C6" && return mystery_c6_case_run(msg; on_status=on_status)
            return Dict("type" => "error", "message" => "Unknown mystery chapter.")
        elseif type == "lesson_list"
            return lesson_list_reply(msg)
        elseif type == "lesson_info"
            return lesson_info_reply(msg)
        elseif type == "lesson_run"
            return lesson_run_reply(msg; on_status=on_status)
        elseif type == "case_epilogue"
            return mystery_epilogue_info(msg)
        elseif type == "case_action"
            chapter = get(msg, "chapter", nothing)
            chapter == "C5" && return mystery_c5_case_action(msg)
            return Dict("type" => "error", "message" => "Unknown mystery chapter.")
        elseif type == "run"
            code = get(msg, "code", "")
            code isa AbstractString || (code = "")
            level_id = get(msg, "level", nothing)
            if level_id === nothing
                # Plain run, no level — today's behaviour, unused by the client but kept harmless.
                r = lock(_RUN_LOCK) do
                    run_code(code; budget=RUN_BUDGET, on_status=on_status)
                end
                value_repr = r.value === nothing ? "" : repr(r.value)
                length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))
                return Dict(
                    "type" => "result",
                    "status" => String(r.status),
                    "stdout" => r.stdout,
                    "message" => r.message,
                    "value_repr" => value_repr,
                )
            end

            level = _level_by_id_or_nothing(level_id)
            level === nothing && return Dict("type" => "error", "message" => "Unknown level: $(repr(level_id))")
            isempty(level.tasks) && return Dict("type" => "error", "message" => "This screen has nothing to run.")
            task_index = get(msg, "task", nothing)
            (task_index isa Integer && 1 <= task_index <= length(level.tasks)) ||
                return Dict("type" => "error", "message" => "Unknown task: $(repr(task_index))")
            task = level.tasks[task_index]

            # Time the sandbox call (inside the lock, since a locked-out call would otherwise wait
            # invisibly) so the :race visual can report a real Julia timing. Live runs are NOT
            # seeded: `rand()` must give a new number every time the player presses Run (the tests
            # seed their runs with `level.seed` for reproducibility; the checkers tolerate noise).
            local r
            elapsed = @elapsed r = lock(_RUN_LOCK) do
                run_code(level.preamble * "\n" * code; env=env_for(level), budget=RUN_BUDGET, on_status=on_status)
            end
            elapsed_ms = round(elapsed * 1000; digits=1)

            value_repr = r.value === nothing ? "" : sprint(show, MIME("text/plain"), r.value; context=:limit=>true)
            length(value_repr) > 2000 && (value_repr = first(value_repr, 2000))

            if r.status == :ok
                ctx = context(level)
                # The checker is contributor-written and must not be able to crash the server; an
                # unreadable value becomes a failing, readable message instead of an exception.
                pass, feedback = try
                    task.check(r.value, ctx)
                catch e
                    (false, "The checker could not read that result: " * sprint(showerror, e))
                end
                pl = payload(level, task_index, r.value, ctx)
                level.visual == :race && (pl["julia_ms"] = elapsed_ms)
            else
                pass = false
                feedback = ""
                pl = nothing
            end

            return Dict(
                "type" => "result",
                "status" => String(r.status),
                "stdout" => r.stdout,
                "message" => r.message,
                "value_repr" => value_repr,
                "pass" => pass,
                "feedback" => feedback,
                "payload" => pl,
                "elapsed_ms" => elapsed_ms,
            )
        else
            return Dict("type" => "error", "message" => "Unknown message type: $(repr(type))")
        end
    catch e
        return Dict("type" => "error", "message" => "Something went wrong handling that message.\n\n" * sprint(showerror, e))
    end
end

"""
    serve_static(http::HTTP.Stream)

Serve a file under `web/` for a plain HTTP request, or a 404 if the path is unsafe or missing.
"""
function serve_static(http::HTTP.Stream)
    path = safe_web_path(http.message.target, WEBROOT)
    if path === nothing
        HTTP.setstatus(http, 404)
        HTTP.startwrite(http)
        write(http, "Not found")
        return nothing
    end
    HTTP.setstatus(http, 200)
    HTTP.setheader(http, "Content-Type", content_type(path))
    HTTP.startwrite(http)
    write(http, read(path))
    return nothing
end

function _stream_handler(http::HTTP.Stream)
    if HTTP.WebSockets.isupgrade(http.message) && http.message.target == "/ws"
        HTTP.WebSockets.upgrade(http) do ws
            for msg in ws
                parsed = try
                    parse_message(msg)
                catch
                    nothing
                end
                # Truthful mid-run status (T1): a killed worker's replacement can take real
                # seconds on a slow machine, so tell the learner what is happening before the
                # final result arrives instead of leaving the run looking merely slow or stuck.
                # Carrying the same `request_id` as the run itself (B1/B2) lets the client tie a
                # status frame to the pending run: extend its own deadline timer and clear the
                # line once "running" arrives, without discarding a correct result that follows.
                request_id = parsed isa AbstractDict ? get(parsed, "request_id", nothing) : nothing
                notify_status(kind, text) = HTTP.WebSockets.send(ws, encode(Dict(
                    "type" => "status", "request_id" => request_id, "status" => kind, "message" => text)))
                reply = parsed === nothing ?
                    Dict("type" => "error", "message" => "Could not read that message.") :
                    handle_message(parsed; on_status=notify_status)
                HTTP.WebSockets.send(ws, encode(reply))
            end
        end
    else
        serve_static(http)
    end
    return nothing
end

"""
    _open_browser(url)

Fire-and-forget the OS command that opens `url` in the default browser. `run(cmd; wait=false)`
launches the subprocess without waiting for it, and the `try/catch` swallows a missing/erroring
opener (a headless CI runner has no `xdg-open`) — either way this call returns immediately and can
never block the server.
"""
function _open_browser(url::AbstractString)
    cmd = if Sys.isapple()
        `open $url`
    elseif Sys.iswindows()
        `cmd /c start $url`
    else
        `xdg-open $url`
    end
    try
        run(cmd; wait=false)
    catch
    end
    return nothing
end

"""
    _no_browser_env() -> Bool

`JULIATIME_NO_BROWSER=1` suppresses the browser open regardless of `open_browser` — set by CI
launch smokes (headless runners either hang opening a browser or leave an orphaned window) and by
anyone who wants the URL printed instead of a tab opened.
"""
_no_browser_env() = get(ENV, "JULIATIME_NO_BROWSER", "0") == "1"

"""
    start_server(; host="127.0.0.1", port=8000, open_browser=false, browser_opener=_open_browser, warmup_fn=warmup!) -> HTTP.Server

Start the game server and begin answering requests immediately; the sandbox pool warms up
afterwards, in the background (`_run_warmup_in_background!`), so a learner sees the Case Board right
away. A first Run still works while warm-up is in flight: it waits for a ready worker inside
`ACQUIRE_BUDGET` and narrates that wait. `warmup_fn` is test-only (inject a slow stand-in). Uses `HTTP.listen!` (non-blocking — it returns
immediately with a running server) rather than blocking `HTTP.listen`, so callers (including
tests) can start the server, use it, and `stop_server` it in the same call stack. When requested,
the browser opens the Case Board rather than the legacy root page — unless `JULIATIME_NO_BROWSER=1`
is set, in which case the open is skipped entirely and only the URL is printed. `browser_opener` is
injectable so tests can assert the opener was (not) called without actually opening a browser.
"""
function start_server(; host::AbstractString="127.0.0.1", port::Integer=8000, open_browser::Bool=false,
                       browser_opener::Function=_open_browser, warmup_fn::Function=warmup!)
    server = HTTP.listen!(_stream_handler, host, port)
    if open_browser && !_no_browser_env()
        browser_opener(_browser_url(host, port))
    end
    println("Julia Time is running at $(_browser_url(host, port))")
    flush(stdout)
    _run_warmup_in_background!(warmup_fn)
    return server
end

"""
    stop_server(server; force=false)

Close the running game server. `force=true` also closes active WebSocket connections; use that
only for application exit, where an idle browser connection must not block Ctrl-C forever.
"""
stop_server(server; force::Bool=false) = force ? HTTP.forceclose(server) : close(server)

"""
    _stop_mode(stop_input, is_tty::Bool) -> Symbol

Pure decision for how `run_server` should wait for the stop signal: `:enter` to print the prompt
and `readline(stop_input)`, or `:wait` to block on the server itself (the same path
`stop_input=nothing` takes).

Only `stop_input === stdin` is ever redirected to `:wait` — an explicit `IOBuffer` (what the tests
pass) always gets `:enter`, preserving the existing programmatic behaviour. `stdin` itself is
redirected to `:wait` whenever it is not a terminal: a background launcher (CI, a `/dev/null` or
piped stdin such as `tail -f /dev/null | julia run.jl`) would otherwise call `readline`, which
either returns immediately at EOF (a closed pipe) and shuts the server down before the first
request, or — for a pipe that never closes — blocks forever and the server never comes up at all.
Deciding this from `is_tty` alone (no `eof` probe) is deliberate: `eof` on a non-terminal stream
that never closes blocks just as badly as `readline` would.
"""
function _stop_mode(stop_input, is_tty::Bool)::Symbol
    stop_input === stdin && !is_tty ? :wait : :enter
end

"""
    run_server(; host="127.0.0.1", port=8000, open_browser=true, stop_input=stdin, warmup_fn=warmup!)

Entry point for `run.jl`: start the server, open the Case Board in a browser, and wait for Enter to
stop. The sandbox pool warms up in the background after the server starts (see `start_server`), not
before — a learner sees the Case Board immediately rather than a blank terminal while packages
JIT-compile. Use `stop_input=nothing` for programmatic callers that want to wait on the server
instead. `warmup_fn` is test-only, forwarded to `start_server`.
"""
function run_server(; host::AbstractString="127.0.0.1", port::Integer=8000, open_browser::Bool=true,
                     stop_input::Union{IO,Nothing}=stdin, warmup_fn::Function=warmup!)
    # `julia run.jl` runs non-interactively, where Julia's default is to exit the process
    # directly on SIGINT rather than deliver a catchable InterruptException (that default is
    # what the REPL turns off). Turn it off here too, so Ctrl-C reaches the try/catch below and
    # the sandbox workers get shut down instead of leaking as orphaned OS processes.
    Base.exit_on_sigint(false)
    server = start_server(; host=host, port=port, open_browser=open_browser, warmup_fn=warmup_fn)
    try
        if stop_input === nothing
            wait(server)
        else
            # Julia's Base has no `isatty` function; the documented way to tell a real terminal
            # apart from a redirected/piped stream (`/dev/null`, a CI runner's stdin, a shell
            # pipe such as `tail -f /dev/null | julia run.jl`) is its concrete IO type — a
            # genuine terminal is `Base.TTY`, a redirection is not. We deliberately never probe
            # `eof(stop_input)` here: on a pipe that never closes (`tail -f /dev/null`), `eof`
            # blocks forever just like `readline` would, and the server would never finish
            # starting up.
            is_tty = stop_input isa Base.TTY
            if _stop_mode(stop_input, is_tty) === :wait
                println("stdin is not a terminal: stop with Ctrl-C or by closing the process.")
                flush(stdout)
                wait(server)
            else
                println("Keep this terminal open while playing. Press Enter here to stop the game cleanly.")
                flush(stdout)
                readline(stop_input)
            end
        end
    catch e
        e isa InterruptException || rethrow()
    finally
        # A browser's idle WebSocket is an active HTTP connection. Graceful `close(server)` waits
        # for it, which makes Ctrl-C appear to do nothing; forceclose is the documented HTTP exit
        # path that closes tracked connections too. Keep sandbox cleanup in its own finally even
        # if the server is already broken or forceclose itself reports an error.
        try
            stop_server(server; force=true)
        finally
            shutdown!()
        end
    end
    return nothing
end

"""
    LAUNCH_PORTS

Ports the learner launcher tries, in order. 8000 first keeps saved browser progress (which the
browser stores per address) where earlier versions left it; the rest cover a Jupyter, Python or
other local server that already holds 8000 on a student's computer.
"""
const LAUNCH_PORTS = 8000:8009

"""
    AllPortsBusy(ports)

Thrown by `launch` when every port in `ports` is held by a program that is not Julia Time.
"""
struct AllPortsBusy <: Exception
    ports::UnitRange{Int}
end
Base.showerror(io::IO, e::AllPortsBusy) =
    print(io, "Ports $(first(e.ports)) to $(last(e.ports)) are all in use by other programs.")

"""
    _is_address_in_use(err) -> Bool

True when a server start failed only because the port is taken. The wording differs by platform
("address already in use" on macOS/Linux, the `EADDRINUSE` code on Windows), so match both.
"""
function _is_address_in_use(err)
    message = lowercase(sprint(showerror, err))
    return occursin("address already in use", message) || occursin("eaddrinuse", message)
end

"""
    _serves_julia_time(host, port) -> Bool

True when `host:port` already answers with the Julia Time Case Board, i.e. an earlier launcher
window is still running. A free port refuses at once; the 15 s request deadline is generous because
the first request in a fresh Julia session compiles the HTTP client, yet it still stops a silent
non-HTTP program from stalling the launcher.
"""
const JULIA_TIME_BOARD_TITLES = ("<title>Julia Time · Board</title>", "<title>Julia Time · Case Board</title>")

function _serves_julia_time(host::AbstractString, port::Integer)
    try
        response = HTTP.get(_browser_url(host, port); connect_timeout=2, request_timeout=15, retry=false,
                            redirect=false, status_exception=false)
        body = String(response.body)
        # 0.5 titles the Board "Julia Time · Board"; the Original (0.2.5) still says "Case Board".
        return response.status == 200 && any(t -> occursin(t, body), JULIA_TIME_BOARD_TITLES)
    catch
        return false
    end
end

"""
    launch(; host="127.0.0.1", ports=LAUNCH_PORTS, run=run_server, is_julia_time=_serves_julia_time, browser_opener=_open_browser)

Entry point for `run.jl`. For each port in turn: if Julia Time is already running there, open the
browser to it and return `(:reopened, port)`; otherwise try to serve there, moving to the next port
only when this one is taken. Returns `(:served, port)` after the learner stops the game, and throws
`AllPortsBusy` when no port works. `run`, `is_julia_time` and `browser_opener` are injectable so the
port choice is testable without real sockets.
"""
function launch(; host::AbstractString="127.0.0.1", ports=LAUNCH_PORTS, run=run_server,
                is_julia_time=_serves_julia_time, browser_opener::Function=_open_browser)
    for port in ports
        if is_julia_time(host, port)
            url = _browser_url(host, port)
            println("Julia Time is already running at $url, started from an earlier launcher window. Opening it in your browser.")
            println("Keep that earlier window open while you play; this new window can be closed.")
            flush(stdout)
            _no_browser_env() || browser_opener(url)
            return (:reopened, port)
        end
        try
            run(; host=host, port=port)
            return (:served, port)
        catch err
            _is_address_in_use(err) || rethrow()
            port == last(ports) || println("Port $port is used by another program; trying $(port + 1).")
        end
    end
    throw(AllPortsBusy(first(ports):last(ports)))
end

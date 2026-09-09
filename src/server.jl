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
function handle_message(msg::Dict)
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
            chapter == "C1" && return mystery_case_run(msg)
            chapter == "C2" && return mystery_c2_case_run(msg)
            chapter == "C3" && return mystery_c3_case_run(msg)
            chapter == "C4" && return mystery_c4_case_run(msg)
            chapter == "C5" && return mystery_c5_case_run(msg)
            chapter == "C6" && return mystery_c6_case_run(msg)
            return Dict("type" => "error", "message" => "Unknown mystery chapter.")
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
                    run_code(code; budget=RUN_BUDGET)
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
                run_code(level.preamble * "\n" * code; env=env_for(level), budget=RUN_BUDGET)
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
                reply = parsed === nothing ?
                    Dict("type" => "error", "message" => "Could not read that message.") :
                    handle_message(parsed)
                HTTP.WebSockets.send(ws, encode(reply))
            end
        end
    else
        serve_static(http)
    end
    return nothing
end

"""
    start_server(; host="127.0.0.1", port=8000, open_browser=false) -> HTTP.Server

Warm up the sandbox and start the game server. Uses `HTTP.listen!` (non-blocking — it returns
immediately with a running server) rather than blocking `HTTP.listen`, so callers (including
tests) can start the server, use it, and `stop_server` it in the same call stack. When requested,
the browser opens the Case Board rather than the legacy root page.
"""
function start_server(; host::AbstractString="127.0.0.1", port::Integer=8000, open_browser::Bool=false)
    warmup!()
    server = HTTP.listen!(_stream_handler, host, port)
    if open_browser
        url = _browser_url(host, port)
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
    end
    println("Julia Time is running at $(_browser_url(host, port))")
    return server
end

"""
    stop_server(server; force=false)

Close the running game server. `force=true` also closes active WebSocket connections; use that
only for application exit, where an idle browser connection must not block Ctrl-C forever.
"""
stop_server(server; force::Bool=false) = force ? HTTP.forceclose(server) : close(server)

"""
    run_server(; host="127.0.0.1", port=8000, open_browser=true, stop_input=stdin)

Entry point for `run.jl`: warm up, start the server, open the Case Board in a browser, and wait for
Enter to stop. Use `stop_input=nothing` for programmatic callers that want to wait on the server
instead.
"""
function run_server(; host::AbstractString="127.0.0.1", port::Integer=8000, open_browser::Bool=true, stop_input::Union{IO,Nothing}=stdin)
    # `julia run.jl` runs non-interactively, where Julia's default is to exit the process
    # directly on SIGINT rather than deliver a catchable InterruptException (that default is
    # what the REPL turns off). Turn it off here too, so Ctrl-C reaches the try/catch below and
    # the sandbox workers get shut down instead of leaking as orphaned OS processes.
    Base.exit_on_sigint(false)
    println("Warming up the sandbox…")
    server = start_server(; host=host, port=port, open_browser=open_browser)
    try
        if stop_input === nothing
            wait(server)
        else
            println("Keep this terminal open while playing. Press Enter here to stop the game cleanly.")
            readline(stop_input)
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

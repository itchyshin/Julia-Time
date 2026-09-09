# Fresh, browser-facing readiness status for the locally running story.
#
# This first slice deliberately implements only `scope: "story"`: it proves
# the already-running Julia process can still complete the fixed sandbox
# calculation. R/Python laboratory checks need owned-child cancellation and a
# session-aware WebSocket manager, so they must not be exposed as a decorative
# control until that separate protocol slice exists.

using Dates

const SETUP_STATUS_CONTRACT_VERSION = "setup-v1"
const SETUP_STATUS_ALLOWED_FIELDS = Set(("type", "request_id", "scope"))
const SETUP_STATUS_STORY_SCOPE = "story"
const JULIA_SANDBOX_FAILED_NEXT_ACTION = "Julia Time's sandbox did not respond. Close and restart the supplied launcher, then use Check Julia again. If it still fails, show the facilitator this message."

function _setup_status_error(message::AbstractString)
    return Dict("type" => "error", "message" => String(message))
end

function _setup_status_timestamp()
    return Dates.format(Dates.now(), dateformat"yyyy-mm-ddTHH:MM:SS")
end

function _setup_status_server_version()
    version = Base.pkgversion(@__MODULE__)
    return version === nothing ? "unknown" : string(version)
end

function _setup_status_report(; component::String, state::String, reason::String,
        version::Union{Nothing,String}, checked_at::String, next_action::String)
    return Dict(
        "contract_version" => SETUP_STATUS_CONTRACT_VERSION,
        "component" => component,
        "state" => state,
        "reason" => reason,
        "version" => version,
        "checked_at" => checked_at,
        "next_action" => next_action,
    )
end

function _story_julia_status()
    checked_at = _setup_status_timestamp()
    if !(v"1.10.0" <= VERSION < v"1.11.0")
        return _setup_status_report(
            component="julia",
            state="needs_attention",
            reason="JULIA_UNSUPPORTED",
            version=string(VERSION),
            checked_at=checked_at,
            next_action="Julia Time needs Julia 1.10.x. Select Julia 1.10, then restart the supplied launcher.",
        )
    end

    result = try
        lock(_RUN_LOCK) do
            run_code("20 + 22"; budget=RUN_BUDGET)
        end
    catch
        nothing
    end

    if result !== nothing && result.status === :ok && result.value isa Real &&
            isfinite(result.value) && result.value == 42
        return _setup_status_report(
            component="julia",
            state="ready",
            reason="JULIA_READY",
            version=string(VERSION),
            checked_at=checked_at,
            next_action="Julia is ready for the mystery.",
        )
    end

    return _setup_status_report(
        component="julia",
        state="needs_attention",
        reason="JULIA_SANDBOX_FAILED",
        version=string(VERSION),
        checked_at=checked_at,
        next_action=JULIA_SANDBOX_FAILED_NEXT_ACTION,
    )
end

"""
    setup_status_reply(msg) -> Dict

Return a fresh, fixed Julia story-readiness report. The client cannot choose a
command, host, code, path, or environment: this initial implementation accepts
only the exact story request fields. The optional comparison-laboratory scope
is intentionally rejected until the server has session-owned child-process
cancellation and reaping.
"""
function setup_status_reply(msg::AbstractDict)
    get(msg, "type", nothing) == "setup_status" ||
        return _setup_status_error("Expected a setup_status message.")
    all(key -> key isa AbstractString && key in SETUP_STATUS_ALLOWED_FIELDS, keys(msg)) ||
        return _setup_status_error("Setup status accepts only type, request_id, and scope.")

    request_id = get(msg, "request_id", nothing)
    request_id isa AbstractString && !isempty(strip(request_id)) ||
        return _setup_status_error("setup_status requires a non-empty string request_id.")
    scope = get(msg, "scope", nothing)
    scope isa AbstractString ||
        return _setup_status_error("setup_status requires scope story.")
    scope == SETUP_STATUS_STORY_SCOPE ||
        return _setup_status_error("The optional comparison-laboratory readiness check is not available in this build.")

    return Dict(
        "type" => "setup_status",
        "request_id" => String(request_id),
        "contract_version" => SETUP_STATUS_CONTRACT_VERSION,
        "server_version" => _setup_status_server_version(),
        "host" => "127.0.0.1",
        "story" => _story_julia_status(),
        "laboratory" => Dict("state" => "not_checked"),
    )
end

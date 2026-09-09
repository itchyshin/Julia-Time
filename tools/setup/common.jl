"""
Shared helpers for Julia Time's fixed, local readiness probes.

This file is deliberately small and dependency-free: it is used before the
browser is started, and it parses only the six fields emitted by the fixed
probe programs in this directory.
"""

const SETUP_CONTRACT_VERSION = "setup-v1"
const SETUP_REPORT_FIELDS = (
    "contract_version",
    "component",
    "state",
    "version",
    "probe",
    "value",
)

"""
    setup_version_status(version::VersionNumber) -> :supported | :unsupported

The meeting build is tested only on Julia 1.10.x. This is a check, not an
installer or a request to change a learner's global Julia selection.
"""
function setup_version_status(version::VersionNumber)
    return v"1.10.0" <= version < v"1.11.0" ? :supported : :unsupported
end

function _setup_report_fields(text::AbstractString)
    # Windows children use CRLF; normalize only that transport detail. A
    # single final newline is conventional output, but all other blank or
    # extra lines are rejected with the rest of the exact six-field contract.
    lines = split(replace(String(text), "\r\n" => "\n"), '\n'; keepempty=true)
    !isempty(lines) && isempty(last(lines)) && pop!(lines)
    length(lines) == length(SETUP_REPORT_FIELDS) || return nothing

    fields = Dict{String,String}()
    for line in lines
        count(==('='), line) == 1 || return nothing
        key, value = split(line, '='; limit=2)
        isempty(key) && return nothing
        key in SETUP_REPORT_FIELDS || return nothing
        haskey(fields, key) && return nothing
        fields[key] = value
    end
    all(field -> haskey(fields, field), SETUP_REPORT_FIELDS) || return nothing
    return fields
end

"""
    validate_setup_report(text; expected_component, expected_probe, expected_value)

Return the validated numeric value as a `Float64`, or `nothing` when a child
report is missing, malformed, duplicated, unexpected, non-ready, or wrong.
Raw child stdout never becomes a successful readiness result without this
exact validation step.
"""
function validate_setup_report(text::AbstractString;
        expected_component::AbstractString,
        expected_probe::AbstractString,
        expected_value::Real)
    fields = _setup_report_fields(text)
    fields === nothing && return nothing
    fields["contract_version"] == SETUP_CONTRACT_VERSION || return nothing
    fields["component"] == expected_component || return nothing
    fields["state"] == "ready" || return nothing
    isempty(fields["version"]) && return nothing
    fields["probe"] == expected_probe || return nothing

    value = tryparse(Float64, fields["value"])
    value === nothing && return nothing
    isfinite(value) || return nothing
    value == Float64(expected_value) || return nothing
    return value
end

"""Print one exact six-field setup-v1 child report to `io`."""
function write_setup_report(io::IO=stdout;
        contract_version::AbstractString=SETUP_CONTRACT_VERSION,
        component::AbstractString,
        state::AbstractString="ready",
        version::AbstractString,
        probe::AbstractString,
        value::Real)
    println(io, "contract_version=", contract_version)
    println(io, "component=", component)
    println(io, "state=", state)
    println(io, "version=", version)
    println(io, "probe=", probe)
    println(io, "value=", value)
    return nothing
end

# Fixed, local-only protocol for the optional Julia/R/Python speed laboratory.
# This module runs only a bundled, parity-gated fixed comparison and returns a
# closed local receipt. It never accepts client code, paths, commands,
# languages, workloads, or measurements.

const SPEED_LAB_CONTRACT_VERSION = 1
const SPEED_LAB_BENCHMARK_ID = "bootstrap-v1"
const SPEED_LAB_ALLOWED_FIELDS = Set(("type", "contract_version", "benchmark_id", "request_id"))
const SPEED_LAB_PROBE_TIMEOUT_SECONDS = 2.0
const SPEED_LAB_PARITY_TIMEOUT_SECONDS = 15.0
# A language gets one shared budget across both fixed workloads.  This is not a
# per-child limit: the second workload receives only the first workload's
# unused time.
const SPEED_LAB_BENCHMARK_LANGUAGE_TIMEOUT_SECONDS = 30.0

_speed_lab_error(message::AbstractString) = Dict("type" => "error", "message" => String(message))

function _speed_lab_identity_or_error(msg::AbstractDict, expected_type::String)
    all(key -> key isa AbstractString && key in SPEED_LAB_ALLOWED_FIELDS, keys(msg)) &&
        length(msg) == length(SPEED_LAB_ALLOWED_FIELDS) ||
        return nothing, _speed_lab_error("Speed-lab requests accept only type, contract_version, benchmark_id, and request_id.")
    get(msg, "type", nothing) == expected_type ||
        return nothing, _speed_lab_error("Expected a $expected_type speed-lab request.")
    get(msg, "contract_version", nothing) === SPEED_LAB_CONTRACT_VERSION ||
        return nothing, _speed_lab_error("Speed-lab requests require contract_version 1.")
    get(msg, "benchmark_id", nothing) == SPEED_LAB_BENCHMARK_ID ||
        return nothing, _speed_lab_error("Speed-lab requests require benchmark_id bootstrap-v1.")
    request_id = get(msg, "request_id", nothing)
    request_id isa AbstractString && !isempty(strip(request_id)) ||
        return nothing, _speed_lab_error("Speed-lab requests require a non-empty request_id.")
    return Dict(
        "contract_version" => SPEED_LAB_CONTRACT_VERSION,
        "benchmark_id" => SPEED_LAB_BENCHMARK_ID,
        "request_id" => String(request_id),
    ), nothing
end

"""Run one fixed, non-timing command with a bounded wait and no shell."""
function _speed_lab_fixed_command_succeeds(executable::AbstractString, arguments::Vector{String})
    command = pipeline(Cmd([executable; arguments]), stdout=devnull, stderr=devnull)
    process = try
        run(command; wait=false)
    catch
        return false
    end
    completed = Base.timedwait(() -> process_exited(process), SPEED_LAB_PROBE_TIMEOUT_SECONDS)
    if completed != :ok
        try
            kill(process)
            wait(process)
        catch
        end
        return false
    end
    return success(process)
end

"""Return only fixed local interpreter/probe availability; never a benchmark measurement."""
function _speed_lab_probe_availability()
    rscript = Sys.which("Rscript")
    python = Sys.which("python3")
    numpy_ready = python !== nothing &&
        _speed_lab_fixed_command_succeeds(python, ["-c", "import numpy"])
    return (
        julia=(ready=true, version=string(VERSION)),
        r=(ready=rscript !== nothing, version=nothing),
        python=(ready=python !== nothing, numpy_ready=numpy_ready, version=nothing),
    )
end

function _speed_lab_components(probe_result)
    julia = probe_result.julia
    r = probe_result.r
    python = probe_result.python
    julia_ready = getproperty(julia, :ready) === true
    r_ready = getproperty(r, :ready) === true
    python_ready = getproperty(python, :ready) === true
    numpy_ready = getproperty(python, :numpy_ready) === true
    components = Dict{String,Any}(
        "julia" => Dict("state" => julia_ready ? "ready" : "needs_attention", "version" => getproperty(julia, :version)),
        "r" => Dict("state" => r_ready ? "ready" : "needs_attention", "version" => getproperty(r, :version)),
        "python" => Dict(
            "state" => python_ready && numpy_ready ? "ready" : "needs_attention",
            "version" => getproperty(python, :version),
            "reason" => python_ready && !numpy_ready ? "NUMPY_MISSING" : nothing,
        ),
    )
    return components, julia_ready, r_ready, python_ready, numpy_ready
end

const SPEED_LAB_PARITY_CONTRACT = "bootstrap-parity-v1"
const SPEED_LAB_PARITY_KERNEL = "bootstrap_detection_rate_mean"
const SPEED_LAB_PARITY_IDENTITY = "detections-v1/resampling-indices-v1"
const SPEED_LAB_PARITY_LANGUAGES = ("julia", "r-base", "python-numpy")

function _speed_lab_fixed_environment()
    environment = Dict{String,String}(String(key) => String(value) for (key, value) in ENV)
    merge!(environment, Dict(
        "JULIA_NUM_THREADS" => "1",
        "OPENBLAS_NUM_THREADS" => "1",
        "OMP_NUM_THREADS" => "1",
        "MKL_NUM_THREADS" => "1",
        "VECLIB_MAXIMUM_THREADS" => "1",
    ))
    return environment
end

function _speed_lab_fixed_json(command::Cmd; timeout_seconds::Real=SPEED_LAB_PARITY_TIMEOUT_SECONDS)
    # Preserve PATH so the fixed Rscript and python3 commands remain discoverable; only the
    # numerical thread caps are imposed by the optional comparison runner.
    command = setenv(command, _speed_lab_fixed_environment())
    output_pipe = Pipe()
    process = run(pipeline(command, stdout=output_pipe, stderr=devnull); wait=false)
    close(output_pipe.in)
    if Base.timedwait(() -> process_exited(process), timeout_seconds) != :ok
        try
            kill(process)
            wait(process)
        catch
        end
        error("fixed speed-lab command exceeded its $(timeout_seconds)-second limit")
    end
    success(process) || error("fixed speed-lab command failed")
    output = read(output_pipe, String)
    lines = filter(!isempty, split(chomp(output), '\n'))
    length(lines) == 1 || error("fixed speed-lab runner must emit one JSON line")
    parsed = JSON.parse(only(lines))
    parsed isa AbstractDict || error("fixed speed-lab runner emitted non-object JSON")
    return Dict{String,Any}(String(key) => value for (key, value) in pairs(parsed))
end

function _speed_lab_default_parity_runner()
    root = joinpath(@__DIR__, "..", "benchmarks", "bootstrap")
    data = joinpath(root, "fixtures", "detections-v1.csv")
    indices = joinpath(root, "fixtures", "resampling-indices-v1.csv")
    shared = ["--data", data, "--indices", indices, "--replicates", "8"]
    commands = Dict(
        "julia" => `$(Base.julia_cmd()) --startup-file=no --history-file=no $(joinpath(root, "bootstrap.jl")) $shared`,
        "r-base" => `Rscript $(joinpath(root, "bootstrap.R")) $shared`,
        "python-numpy" => `python3 $(joinpath(root, "bootstrap.py")) $shared`,
    )
    return Dict(language => _speed_lab_fixed_json(commands[language]) for language in SPEED_LAB_PARITY_LANGUAGES)
end

function _speed_lab_parity_verified(reports)
    reports isa AbstractDict || return false
    all(language -> haskey(reports, language), SPEED_LAB_PARITY_LANGUAGES) || return false
    reference = reports["julia"]
    reference isa AbstractDict || return false
    expected_keys = ("contract", "kernel", "input_identity", "data_sha256", "indices_sha256", "fixture_index_base", "replicate_count", "replicate_rates", "bootstrap_mean")
    all(key -> haskey(reference, key), expected_keys) || return false
    reference["contract"] == SPEED_LAB_PARITY_CONTRACT || return false
    reference["kernel"] == SPEED_LAB_PARITY_KERNEL || return false
    reference["input_identity"] == SPEED_LAB_PARITY_IDENTITY || return false
    reference["fixture_index_base"] == 0 || return false
    reference["replicate_count"] == 8 || return false
    rates = reference["replicate_rates"]
    rates isa AbstractVector && length(rates) == 8 && all(value -> value isa Real && isfinite(value), rates) || return false
    reference["bootstrap_mean"] isa Real && isfinite(reference["bootstrap_mean"]) || return false
    for language in SPEED_LAB_PARITY_LANGUAGES
        report = reports[language]
        report isa AbstractDict || return false
        all(key -> haskey(report, key), expected_keys) || return false
        get(report, "language", nothing) == language || return false
        all(key -> get(report, key, nothing) == get(reference, key, nothing), ("contract", "kernel", "input_identity", "data_sha256", "indices_sha256", "fixture_index_base", "replicate_count")) || return false
        other_rates = report["replicate_rates"]
        other_rates isa AbstractVector && length(other_rates) == length(rates) || return false
        all(index -> abs(other_rates[index] - rates[index]) <= 1e-12, eachindex(rates)) || return false
        report["bootstrap_mean"] isa Real && abs(report["bootstrap_mean"] - reference["bootstrap_mean"]) <= 1e-12 || return false
    end
    return true
end

function _speed_lab_default_benchmark_runner()
    root = joinpath(@__DIR__, "..", "benchmarks", "bootstrap")
    data = joinpath(root, "fixtures", "detections-v1.csv")
    indices = joinpath(root, "fixtures", "resampling-indices-v1.csv")
    reports = Dict{String,Any}()
    for language in SPEED_LAB_PARITY_LANGUAGES
        language_started = time()
        by_workload = Dict{Int,Any}()
        for workload in (1000, 10_000)
            remaining = SPEED_LAB_BENCHMARK_LANGUAGE_TIMEOUT_SECONDS - (time() - language_started)
            remaining > 0 || error("fixed speed-lab language budget exhausted before workload $workload")
            options = ["--mode", "benchmark", "--data", data, "--indices", indices, "--workload", string(workload)]
            command = if language == "julia"
                `$(Base.julia_cmd()) --startup-file=no --history-file=no $(joinpath(root, "bootstrap.jl")) $options`
            elseif language == "r-base"
                `Rscript $(joinpath(root, "bootstrap.R")) $options`
            else
                `python3 $(joinpath(root, "bootstrap.py")) $options`
            end
            by_workload[workload] = _speed_lab_fixed_json(command; timeout_seconds=remaining)
        end
        reports[language] = by_workload
    end
    return reports
end

function _speed_lab_measurements_verified(measurements)
    measurements isa AbstractDict || return false
    all(language -> haskey(measurements, language), SPEED_LAB_PARITY_LANGUAGES) || return false
    reference_identity = nothing
    for language in SPEED_LAB_PARITY_LANGUAGES
        by_workload = measurements[language]
        by_workload isa AbstractDict || return false
        for workload in (1000, 10_000)
            haskey(by_workload, workload) || return false
            report = by_workload[workload]
            report isa AbstractDict || return false
            get(report, "contract", nothing) == "bootstrap-benchmark-v1" || return false
            get(report, "report_type", nothing) == "bootstrap_benchmark" || return false
            get(report, "language", nothing) == language || return false
            get(report, "input_identity", nothing) == SPEED_LAB_PARITY_IDENTITY || return false
            get(report, "fixture_index_base", nothing) == 0 || return false
            get(report, "thread_claim", nothing) == "single-threaded kernel" || return false
            version = get(report, "version", nothing)
            version isa AbstractString && !isempty(strip(version)) || return false
            get(report, "workload", nothing) == workload || return false
            get(report, "warmup_repetitions", nothing) == 1 || return false
            get(report, "timed_repetitions", nothing) == 5 || return false
            times = get(report, "times_seconds", nothing)
            times isa AbstractVector && length(times) == 5 && all(value -> value isa Real && isfinite(value) && value >= 0, times) || return false
            all(key -> get(report, key, nothing) isa Real && isfinite(get(report, key, nothing)) && get(report, key, nothing) >= 0, ("median_seconds", "min_seconds", "max_seconds")) || return false
            get(report, "min_seconds", Inf) <= get(report, "median_seconds", -Inf) <= get(report, "max_seconds", -Inf) || return false
            identity = (get(report, "data_sha256", nothing), get(report, "indices_sha256", nothing))
            if reference_identity === nothing
                reference_identity = identity
            elseif identity != reference_identity
                return false
            end
        end
    end
    return true
end

"""Return the fixed, local context required to interpret one timing receipt."""
function _speed_lab_machine_metadata()
    cpu_name = try String(Sys.CPU_NAME) catch; "not reported by Julia" end
    logical_cpus = try Int(Sys.CPU_THREADS) catch; 1 end
    return Dict{String,Any}(
        "os" => string(Sys.KERNEL),
        "architecture" => string(Sys.ARCH),
        "cpu_model" => cpu_name,
        "logical_cpus" => max(1, logical_cpus),
    )
end

"""Create the closed, learner-facing receipt from validated fixed reports."""
function _speed_lab_measurement_receipt(measurements; machine_provider::Function=_speed_lab_machine_metadata)
    language_versions = Dict{String,String}()
    for language in SPEED_LAB_PARITY_LANGUAGES
        first_version = String(measurements[language][1000]["version"])
        String(measurements[language][10_000]["version"]) == first_version ||
            error("fixed speed-lab reports disagree about $language version")
        language_versions[language] = first_version
    end
    workloads = Any[]
    for workload in (1000, 10_000)
        timings = Dict{String,Any}()
        for language in SPEED_LAB_PARITY_LANGUAGES
            report = measurements[language][workload]
            timings[language] = Dict(
                "median" => report["median_seconds"],
                "min" => report["min_seconds"],
                "max" => report["max_seconds"],
            )
        end
        push!(workloads, Dict(
            "iterations" => workload,
            "warmup_repetitions" => 1,
            "timed_repetitions" => 5,
            "timings_seconds" => timings,
        ))
    end
    return Dict{String,Any}(
        "receipt_version" => 1,
        "title" => "Fixed local bootstrap comparison",
        "parity" => Dict(
            "status" => "verified",
            "contract" => SPEED_LAB_PARITY_CONTRACT,
            "kernel" => SPEED_LAB_PARITY_KERNEL,
            "input_identity" => SPEED_LAB_PARITY_IDENTITY,
            "replicate_count" => 8,
        ),
        "machine" => machine_provider(),
        "thread_settings" => Dict(
            "kernel" => "single-threaded",
            "julia_num_threads" => 1,
            "openblas_num_threads" => 1,
            "omp_num_threads" => 1,
            "mkl_num_threads" => 1,
            "veclib_maximum_threads" => 1,
        ),
        "language_versions" => language_versions,
        "workloads" => workloads,
    )
end

function _speed_lab_availability_reply(identity::AbstractDict, probe::Function, parity_runner::Function)
    probe_result = try
        probe()
    catch
        nothing
    end
    probe_result === nothing && return Dict(
        "type" => "benchmark_info",
        identity...,
        "availability" => "unavailable",
        "reason" => "READINESS_PROBE_FAILED",
        "message" => "The mystery is complete; this optional comparison is unavailable because its fixed local readiness probe did not finish.",
        "components" => Dict{String,Any}(),
        "parity" => "not_run",
    )
    components, julia_ready, r_ready, python_ready, numpy_ready = try
        _speed_lab_components(probe_result)
    catch
        return Dict(
            "type" => "benchmark_info",
            identity...,
            "availability" => "unavailable",
            "reason" => "READINESS_PROBE_FAILED",
            "message" => "The mystery is complete; this optional comparison is unavailable because its fixed local readiness probe did not finish.",
            "components" => Dict{String,Any}(),
            "parity" => "not_run",
        )
    end
    reason, message = if !julia_ready
        "JULIA_UNAVAILABLE", "The mystery is complete; this optional comparison cannot run because Julia is unavailable. Restart the supplied launcher, then check again."
    elseif !r_ready
        "R_MISSING", "The mystery is complete; this optional comparison cannot run because Rscript is unavailable. Install R, then check again."
    elseif !python_ready
        "PYTHON_MISSING", "The mystery is complete; this optional comparison cannot run because Python is unavailable. Install Python and NumPy, then check again."
    elseif !numpy_ready
        "NUMPY_MISSING", "The mystery is complete; this optional comparison cannot run because NumPy is not available in this Python installation. Install NumPy, then check again."
    else
        nothing, "Julia, R, and Python/NumPy are available. Checking their fixed shared bootstrap result before any timing is shown."
    end
    parity = "not_run"
    if reason === nothing
        reports = try
            parity_runner()
        catch
            nothing
        end
        if _speed_lab_parity_verified(reports)
            parity = "verified"
            message = "Julia, R, and Python/NumPy returned the same fixed bootstrap result. You may now request the local timing run."
        else
            parity = "failed"
            reason = "PARITY_FAILED"
            message = "The mystery is complete; this optional comparison will not time the languages because their fixed bootstrap results did not verify together."
        end
    end
    return Dict(
        "type" => "benchmark_info",
        identity...,
        "availability" => reason === nothing ? "ready" : "unavailable",
        "reason" => reason,
        "message" => message,
        "components" => components,
        "parity" => parity,
    )
end

"""
    speed_lab_info_reply(msg; probe=_speed_lab_probe_availability) -> Dict

Return the fixed optional-laboratory availability report. The client cannot
choose a command, source code, fixture path, language, or workload.
"""
function speed_lab_info_reply(msg::AbstractDict; probe::Function=_speed_lab_probe_availability,
                              parity_runner::Function=_speed_lab_default_parity_runner)
    identity, error_reply = _speed_lab_identity_or_error(msg, "benchmark_info")
    error_reply === nothing || return error_reply
    return _speed_lab_availability_reply(identity, probe, parity_runner)
end

"""
    speed_lab_run_reply(msg; probe, parity_runner, benchmark_runner) -> Dict

Run only the bundled fixed kernels after the same parity gate used by the
information request. The caller cannot choose source code, paths, workloads,
or a language. Tests inject reports; the default runner is the local receipt.
"""
function speed_lab_run_reply(msg::AbstractDict;
                             probe::Function=_speed_lab_probe_availability,
                             parity_runner::Function=_speed_lab_default_parity_runner,
                             benchmark_runner::Function=_speed_lab_default_benchmark_runner,
                             machine_provider::Function=_speed_lab_machine_metadata)
    identity, error_reply = _speed_lab_identity_or_error(msg, "benchmark_run")
    error_reply === nothing || return error_reply
    availability = _speed_lab_availability_reply(identity, probe, parity_runner)
    if get(availability, "availability", nothing) != "ready" || get(availability, "parity", nothing) != "verified"
        return Dict(
            "type" => "benchmark_run", identity...,
            "status" => "unavailable", "reason" => get(availability, "reason", "PARITY_FAILED"),
            "message" => get(availability, "message", "The optional comparison is unavailable before a verified parity receipt."),
            "parity" => get(availability, "parity", "failed"),
        )
    end
    measurements = try
        benchmark_runner()
    catch
        nothing
    end
    _speed_lab_measurements_verified(measurements) || return Dict(
        "type" => "benchmark_run", identity...,
        "status" => "unavailable", "reason" => "MEASUREMENT_RECEIPT_FAILED",
        "message" => "The mystery is complete; this optional comparison did not produce a complete fixed local measurement receipt.",
        "parity" => "verified",
    )
    return Dict(
        "type" => "benchmark_run", identity..., "status" => "ok", "parity" => "verified",
        "result" => _speed_lab_measurement_receipt(measurements; machine_provider=machine_provider),
    )
end

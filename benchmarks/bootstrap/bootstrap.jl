#!/usr/bin/env julia

# Correctness-only bootstrap kernel shared with bootstrap.R and bootstrap.py.
# The checked-in CSV indices are zero-based so Python can consume them directly.
# Julia arrays are one-based, therefore every fixture index is converted with + 1
# at the one and only point where it addresses `detections` below.

using SHA

const CONTRACT = "bootstrap-parity-v1"
const KERNEL = "bootstrap_detection_rate_mean"
const INPUT_IDENTITY = "detections-v1/resampling-indices-v1"
const BENCHMARK_CONTRACT = "bootstrap-benchmark-v1"
const BENCHMARK_WORKLOADS = (1000, 10000)
const BENCHMARK_WARMUPS = 1
const BENCHMARK_REPETITIONS = 5

function parse_options(args)
    options = Dict{String,String}()
    position = 1
    while position <= length(args)
        option = args[position]
        startswith(option, "--") || error("unexpected argument: $option")
        position < length(args) || error("missing value for $option")
        haskey(options, option) && error("duplicate option: $option")
        options[option] = args[position + 1]
        position += 2
    end
    if !haskey(options, "--mode")
        required = ["--data", "--indices", "--replicates"]
        all(haskey(options, option) for option in required) || error("expected --data PATH --indices PATH --replicates N")
        length(options) == length(required) || error("only --data, --indices and --replicates are supported outside benchmark mode")
        replicates = try
            parse(Int, options["--replicates"])
        catch
            error("--replicates must be an integer")
        end
        replicates > 0 || error("--replicates must be positive")
        return (mode=:correctness, data_path=options["--data"], indices_path=options["--indices"], replicates=replicates)
    end
    options["--mode"] == "benchmark" || error("--mode must be benchmark when supplied")
    required = ["--mode", "--data", "--indices", "--workload"]
    all(haskey(options, option) for option in required) || error("benchmark mode expects --data PATH --indices PATH --workload 1000|10000")
    length(options) == length(required) || error("benchmark mode supports only --mode, --data, --indices and --workload")
    workload = try
        parse(Int, options["--workload"])
    catch
        error("--workload must be an integer")
    end
    workload in BENCHMARK_WORKLOADS || error("benchmark workload must be 1000 or 10000")
    return (mode=:benchmark, data_path=options["--data"], indices_path=options["--indices"], workload=workload)
end

function nonempty_lines(path)
    isfile(path) || error("fixture does not exist: $path")
    lines = filter(line -> !isempty(strip(line)), readlines(path))
    isempty(lines) && error("fixture is empty: $path")
    return lines
end

function parse_integer(token, description)
    try
        return parse(Int, strip(token))
    catch
        error("$description is not an integer: $(repr(token))")
    end
end

function read_detections(path)
    lines = nonempty_lines(path)
    strip(lines[1]) == "detection" || error("detection fixture header must be detection")
    length(lines) > 1 || error("detection fixture has no rows")
    detections = [parse_integer(line, "detection") for line in lines[2:end]]
    all(value -> value == 0 || value == 1, detections) || error("detections must be binary 0/1 values")
    return detections
end

function read_indices(path, row_width)
    lines = nonempty_lines(path)
    header = split(strip(lines[1]), ',')
    expected_header = ["draw_$column" for column in 1:row_width]
    header == expected_header || error("index fixture header must be $(join(expected_header, ','))")
    length(lines) > 1 || error("index fixture has no rows")
    rows = Vector{Vector{Int}}()
    for (offset, line) in enumerate(lines[2:end])
        line_number = offset + 1
        row = [parse_integer(token, "index at row $line_number") for token in split(strip(line), ',')]
        length(row) == row_width || error("index row $line_number has the wrong width")
        all(index -> 0 <= index < row_width, row) || error("index row $line_number is outside zero-based fixture bounds")
        push!(rows, row)
    end
    return rows
end

function json_string(value)
    escaped = replace(string(value), "\\" => "\\\\", '"' => "\\\"", '\n' => "\\n", '\r' => "\\r", '\t' => "\\t")
    return "\"" * escaped * "\""
end

function sha256_hex(path)
    return bytes2hex(SHA.sha256(read(path)))
end

function emit(detections, indices, replicates, data_path, indices_path)
    replicates <= length(indices) || error("--replicates exceeds available index rows")
    selected = indices[1:replicates]
    # This conversion is intentional: fixture index 0 is Julia element 1.
    rates = [sum(detections[row .+ 1]) / length(row) for row in selected]
    bootstrap_mean = sum(rates) / length(rates)
    rates_json = join(repr.(rates), ",")
    output = "{" *
        "\"contract\":$(json_string(CONTRACT))," *
        "\"kernel\":$(json_string(KERNEL))," *
        "\"language\":\"julia\"," *
        "\"version\":$(json_string(VERSION))," *
        "\"input_identity\":$(json_string(INPUT_IDENTITY))," *
        "\"data_sha256\":$(json_string(sha256_hex(data_path)))," *
        "\"indices_sha256\":$(json_string(sha256_hex(indices_path)))," *
        "\"fixture_index_base\":0," *
        "\"replicate_count\":$replicates," *
        "\"replicate_rates\":[$rates_json]," *
        "\"bootstrap_mean\":$(repr(bootstrap_mean))" *
        "}"
    println(output)
end

function bootstrap_workload_checksum(detections, indices, workload)
    total = 0.0
    for draw in 1:workload
        row = indices[mod1(draw, length(indices))]
        detected = 0
        for zero_index in row
            detected += detections[zero_index + 1]
        end
        total += detected / length(row)
    end
    return total
end

function emit_benchmark(detections, indices, workload, data_path, indices_path)
    # Fixture loading and this single warm-up are deliberately outside every timed region.
    bootstrap_workload_checksum(detections, indices, workload)
    times_seconds = Float64[]
    checksums = Float64[]
    for _ in 1:BENCHMARK_REPETITIONS
        started = time_ns()
        checksum = bootstrap_workload_checksum(detections, indices, workload)
        elapsed = (time_ns() - started) / 1_000_000_000
        push!(times_seconds, elapsed)
        push!(checksums, checksum)
    end
    all(isfinite, checksums) || error("benchmark kernel returned a non-finite checksum")
    sorted_times = sort(times_seconds)
    times_json = join(repr.(times_seconds), ",")
    output = "{" *
        "\"contract\":$(json_string(BENCHMARK_CONTRACT))," *
        "\"report_type\":\"bootstrap_benchmark\"," *
        "\"language\":\"julia\"," *
        "\"version\":$(json_string(VERSION))," *
        "\"input_identity\":$(json_string(INPUT_IDENTITY))," *
        "\"data_sha256\":$(json_string(sha256_hex(data_path)))," *
        "\"indices_sha256\":$(json_string(sha256_hex(indices_path)))," *
        "\"fixture_index_base\":0," *
        "\"thread_claim\":\"single-threaded kernel\"," *
        "\"workload\":$workload," *
        "\"warmup_repetitions\":$BENCHMARK_WARMUPS," *
        "\"timed_repetitions\":$BENCHMARK_REPETITIONS," *
        "\"times_seconds\":[$times_json]," *
        "\"median_seconds\":$(repr(sorted_times[3]))," *
        "\"min_seconds\":$(repr(first(sorted_times)))," *
        "\"max_seconds\":$(repr(last(sorted_times)))" *
        "}"
    println(output)
end

options = parse_options(ARGS)
detections = read_detections(options.data_path)
indices = read_indices(options.indices_path, length(detections))
if options.mode == :correctness
    emit(detections, indices, options.replicates, options.data_path, options.indices_path)
else
    emit_benchmark(detections, indices, options.workload, options.data_path, options.indices_path)
end

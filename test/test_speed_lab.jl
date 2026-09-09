using Test
using JuliaTime

const SPEED_LAB_VALID_INFO = Dict(
    "type" => "benchmark_info",
    "contract_version" => 1,
    "benchmark_id" => "bootstrap-v1",
    "request_id" => "speed-info-1",
)

const SPEED_LAB_VALID_RUN = Dict(
    "type" => "benchmark_run",
    "contract_version" => 1,
    "benchmark_id" => "bootstrap-v1",
    "request_id" => "speed-run-1",
)

function speed_lab_ready_probe()
    return (
        julia=(ready=true, version="Julia fixture"),
        r=(ready=true, version="R fixture"),
        python=(ready=true, numpy_ready=true, version="Python fixture; NumPy fixture"),
    )
end

function speed_lab_missing_numpy_probe()
    return (
        julia=(ready=true, version="Julia fixture"),
        r=(ready=true, version="R fixture"),
        python=(ready=true, numpy_ready=false, version="Python fixture"),
    )
end

function speed_lab_matching_parity()
    base = Dict(
        "contract" => "bootstrap-parity-v1",
        "kernel" => "bootstrap_detection_rate_mean",
        "input_identity" => "detections-v1/resampling-indices-v1",
        "data_sha256" => "a"^64,
        "indices_sha256" => "b"^64,
        "fixture_index_base" => 0,
        "replicate_count" => 8,
        "replicate_rates" => [0.5, 2 / 3, 0.0, 1.0, 0.5, 2 / 3, 0.5, 2 / 3],
        "bootstrap_mean" => 0.5625,
    )
    return Dict("julia" => merge(base, Dict("language" => "julia")),
                "r-base" => merge(base, Dict("language" => "r-base")),
                "python-numpy" => merge(base, Dict("language" => "python-numpy")))
end

function speed_lab_mismatched_parity()
    reports = speed_lab_matching_parity()
    reports["r-base"] = merge(reports["r-base"], Dict("bootstrap_mean" => 0.4))
    return reports
end

function speed_lab_fixed_measurements()
    base = Dict(
        "contract" => "bootstrap-benchmark-v1",
        "report_type" => "bootstrap_benchmark",
        "version" => "fixture version",
        "input_identity" => "detections-v1/resampling-indices-v1",
        "data_sha256" => "a"^64,
        "indices_sha256" => "b"^64,
        "fixture_index_base" => 0,
        "thread_claim" => "single-threaded kernel",
        "warmup_repetitions" => 1,
        "timed_repetitions" => 5,
        "times_seconds" => [0.01, 0.02, 0.03, 0.04, 0.05],
        "median_seconds" => 0.03,
        "min_seconds" => 0.01,
        "max_seconds" => 0.05,
    )
    return Dict(language => Dict(workload => merge(base, Dict("language" => language, "workload" => workload))
        for workload in (1000, 10000)) for language in ("julia", "r-base", "python-numpy"))
end

speed_lab_machine_fixture() = Dict(
    "os" => "fixtureOS",
    "architecture" => "fixtureArch",
    "cpu_model" => "fixtureCPU",
    "logical_cpus" => 4,
)

@testset "fixed speed-lab protocol" begin
    @test isdefined(JuliaTime, :speed_lab_info_reply)
    @test isdefined(JuliaTime, :speed_lab_run_reply)

    @testset "fixed runners retain interpreter discovery while capping threads" begin
        environment = JuliaTime._speed_lab_fixed_environment()
        @test environment["PATH"] == ENV["PATH"]
        @test environment["JULIA_NUM_THREADS"] == "1"
        @test environment["OPENBLAS_NUM_THREADS"] == "1"
    end

    if isdefined(JuliaTime, :speed_lab_info_reply) && isdefined(JuliaTime, :speed_lab_run_reply)
        @testset "info is a fixed, identity-echoing availability report" begin
            reply = speed_lab_info_reply(SPEED_LAB_VALID_INFO;
                probe=speed_lab_ready_probe, parity_runner=speed_lab_matching_parity)
            @test reply["type"] == "benchmark_info"
            @test reply["contract_version"] == 1
            @test reply["benchmark_id"] == "bootstrap-v1"
            @test reply["request_id"] == "speed-info-1"
            @test reply["availability"] == "ready"
            @test reply["reason"] === nothing
            @test reply["components"]["julia"]["state"] == "ready"
            @test reply["components"]["r"]["state"] == "ready"
            @test reply["components"]["python"]["state"] == "ready"
            @test !haskey(reply, "result")
            @test !haskey(reply, "timings")
            @test !haskey(reply, "command")
            @test !haskey(reply, "path")
        end

        @testset "missing NumPy is optional-comparison unavailability" begin
            reply = speed_lab_info_reply(SPEED_LAB_VALID_INFO; probe=speed_lab_missing_numpy_probe)
            @test reply["availability"] == "unavailable"
            @test reply["reason"] == "NUMPY_MISSING"
            @test occursin("optional", lowercase(reply["message"]))
            @test occursin("NumPy", reply["message"])
            @test reply["components"]["python"]["state"] == "needs_attention"
            @test reply["components"]["python"]["reason"] == "NUMPY_MISSING"
        end

        @testset "a failed readiness probe settles into an explanatory unavailable state" begin
            reply = speed_lab_info_reply(SPEED_LAB_VALID_INFO; probe=() -> error("fixture probe failure"))
            @test reply["availability"] == "unavailable"
            @test reply["reason"] == "READINESS_PROBE_FAILED"
            @test reply["parity"] == "not_run"
            @test reply["components"] == Dict{String,Any}()
        end

        @testset "the two fixed workloads share one per-language time budget" begin
            @test JuliaTime.SPEED_LAB_BENCHMARK_LANGUAGE_TIMEOUT_SECONDS == 30.0
        end

        @testset "a ready report means fixed-kernel parity, not merely interpreter discovery" begin
            good = speed_lab_info_reply(SPEED_LAB_VALID_INFO;
                probe=speed_lab_ready_probe, parity_runner=speed_lab_matching_parity)
            @test good["availability"] == "ready"
            @test good["parity"] == "verified"
            @test !haskey(good, "command")
            @test !haskey(good, "timings")

            bad = speed_lab_info_reply(SPEED_LAB_VALID_INFO;
                probe=speed_lab_ready_probe, parity_runner=speed_lab_mismatched_parity)
            @test bad["availability"] == "unavailable"
            @test bad["reason"] == "PARITY_FAILED"
            @test bad["parity"] == "failed"
        end

        @testset "requests reject client code, paths, commands, and identity drift" begin
            for invalid in (
                Dict{String,Any}(),
                merge(SPEED_LAB_VALID_INFO, Dict("type" => "benchmark_run")),
                merge(SPEED_LAB_VALID_INFO, Dict("contract_version" => 2)),
                merge(SPEED_LAB_VALID_INFO, Dict("benchmark_id" => "other")),
                merge(SPEED_LAB_VALID_INFO, Dict("request_id" => "   ")),
                merge(SPEED_LAB_VALID_INFO, Dict("code" => "run anything")),
                merge(SPEED_LAB_VALID_INFO, Dict("path" => "/tmp/client-file")),
                merge(SPEED_LAB_VALID_INFO, Dict("command" => "Rscript anything")),
                merge(SPEED_LAB_VALID_INFO, Dict("language" => "python")),
            )
                reply = speed_lab_info_reply(invalid; probe=speed_lab_ready_probe)
                @test reply["type"] == "error"
                @test !haskey(reply, "result")
                @test !haskey(reply, "timings")
            end
        end

        @testset "run never invents a measurement before a verified receipt exists" begin
            reply = speed_lab_run_reply(SPEED_LAB_VALID_RUN;
                probe=speed_lab_ready_probe,
                parity_runner=speed_lab_matching_parity,
                benchmark_runner=() -> nothing)
            @test reply["type"] == "benchmark_run"
            @test reply["contract_version"] == 1
            @test reply["benchmark_id"] == "bootstrap-v1"
            @test reply["request_id"] == "speed-run-1"
            @test reply["status"] == "unavailable"
            @test reply["reason"] == "MEASUREMENT_RECEIPT_FAILED"
            @test !haskey(reply, "result")
            @test !haskey(reply, "timings")
            @test !haskey(reply, "measurements")

            invalid = merge(SPEED_LAB_VALID_RUN, Dict("workload" => 10_000))
            rejected = speed_lab_run_reply(invalid)
            @test rejected["type"] == "error"
        end

        @testset "run returns only a fixed, parity-gated local measurement receipt" begin
            reply = speed_lab_run_reply(SPEED_LAB_VALID_RUN;
                probe=speed_lab_ready_probe,
                parity_runner=speed_lab_matching_parity,
                benchmark_runner=speed_lab_fixed_measurements,
                machine_provider=speed_lab_machine_fixture)
            @test reply["type"] == "benchmark_run"
            @test reply["status"] == "ok"
            @test reply["parity"] == "verified"
            @test reply["result"] isa AbstractDict
            @test Set(keys(reply["result"])) == Set(("receipt_version", "title", "parity", "machine", "thread_settings", "language_versions", "workloads"))
            @test reply["result"]["machine"] == speed_lab_machine_fixture()
            @test reply["result"]["thread_settings"]["julia_num_threads"] == 1
            @test reply["result"]["language_versions"]["python-numpy"] == "fixture version"
            @test [row["iterations"] for row in reply["result"]["workloads"]] == [1000, 10_000]
            @test reply["result"]["workloads"][1]["timings_seconds"]["julia"]["median"] == 0.03
            @test !haskey(reply["result"], "command")
            @test !haskey(reply["result"], "path")
            @test !haskey(reply["result"], "hostname")

            no_parity = speed_lab_run_reply(SPEED_LAB_VALID_RUN;
                probe=speed_lab_ready_probe,
                parity_runner=speed_lab_mismatched_parity,
                benchmark_runner=speed_lab_fixed_measurements,
                machine_provider=speed_lab_machine_fixture)
            @test no_parity["status"] == "unavailable"
            @test no_parity["reason"] == "PARITY_FAILED"
            @test !haskey(no_parity, "result")
        end
    end
end

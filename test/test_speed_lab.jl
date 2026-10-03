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

    @testset "an explicit local Python override takes precedence when it is executable" begin
        previous = get(ENV, "JULIATIME_PYTHON", nothing)
        try
            ENV["JULIATIME_PYTHON"] = "/not/an/executable/python"
            @test JuliaTime._speed_lab_python_executable() === nothing

            executable = Sys.which("python3")
            executable === nothing || begin
                ENV["JULIATIME_PYTHON"] = executable
                @test JuliaTime._speed_lab_python_executable() == executable
            end
        finally
            previous === nothing ? delete!(ENV, "JULIATIME_PYTHON") : (ENV["JULIATIME_PYTHON"] = previous)
        end
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

# --- Speed lab 0.5.2b: six fixed examples and "time your own code" -------------------------
const SPEED_LAB_EXAMPLE_IDS = ["loop-sum", "bootstrap-mean", "random-walk", "permutation-test", "running-stat", "group-means"]

function speed_lab_fake_runner(; r_answer=[1.0, 2.0], julia_answer=[1.0, 2.0], python_answer=[1.0, 2.0], calls=String[])
    answers = Dict("julia" => julia_answer, "r" => r_answer, "python" => python_answer)
    return function (language, id, mode)
        push!(calls, string(language, ":", id, ":", mode))
        mode == "check" && return Dict{String,Any}("answer" => answers[language])
        return Dict{String,Any}("answer" => answers[language], "times" => [0.3, 0.1, 0.2], "version" => string(language, " fixture"))
    end
end

const SPEED_LAB_ALL_PRESENT = () -> Dict("julia" => true, "r" => true, "python" => true)

@testset "Speed lab examples (0.5.2b)" begin
    root = joinpath(@__DIR__, "..", "benchmarks", "speedlab")
    @testset "six fixed examples each have Julia, base R and standard-library Python files" begin
        @test JuliaTime.SPEED_LAB_EXAMPLE_IDS == SPEED_LAB_EXAMPLE_IDS
        for id in SPEED_LAB_EXAMPLE_IDS, ext in ("jl", "R", "py")
            @test isfile(joinpath(root, id, "$id.$ext"))
        end
        for id in SPEED_LAB_EXAMPLE_IDS
            @test !occursin("numpy", lowercase(read(joinpath(root, id, "$id.py"), String)))
            @test !occursin("library(", read(joinpath(root, id, "$id.R"), String))
        end
    end

    @testset "examples list reports only fixed ids and language presence" begin
        reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_examples", "request_id" => "ex-1"); presence=SPEED_LAB_ALL_PRESENT)
        @test reply["type"] == "speed_lab_examples"
        @test reply["request_id"] == "ex-1"
        @test [e["id"] for e in reply["examples"]] == SPEED_LAB_EXAMPLE_IDS
        @test all(e -> !isempty(e["title"]) && !isempty(e["plain"]), reply["examples"])
        @test reply["languages"] == Dict("julia" => true, "r" => true, "python" => true)
        @test JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_examples", "request_id" => "ex-1", "x" => 1))["type"] == "error"
    end

    @testset "matching answers are timed; median of three after the check" begin
        calls = String[]
        reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_example_run", "request_id" => "r1", "example_id" => "loop-sum");
            presence=SPEED_LAB_ALL_PRESENT, runner=speed_lab_fake_runner(calls=calls))
        @test reply["type"] == "speed_lab_example_result"
        @test reply["example_id"] == "loop-sum"
        @test reply["label"] == "Measured on this computer, just now."
        for lang in ("julia", "r", "python")
            row = reply["languages"][lang]
            @test row["status"] == "timed"
            @test row["median"] == 0.2
            @test row["min"] == 0.1 && row["max"] == 0.3
        end
        # parity (check) of every language happens before any timing call
        first_time = findfirst(c -> endswith(c, ":time"), calls)
        @test all(endswith(c, ":check") for c in calls[1:first_time-1])
        @test count(endswith(":check"), calls) == 3
    end

    @testset "answers that differ are never timed" begin
        calls = String[]
        reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_example_run", "request_id" => "r2", "example_id" => "loop-sum");
            presence=SPEED_LAB_ALL_PRESENT, runner=speed_lab_fake_runner(r_answer=[1.0, 2.5], calls=calls))
        @test reply["languages"]["r"]["status"] == "answers_differ"
        @test reply["languages"]["r"]["message"] == "answers differ, not timed"
        @test !haskey(reply["languages"]["r"], "median")
        @test reply["languages"]["python"]["status"] == "timed"
        @test !("r:loop-sum:time" in calls)
    end

    @testset "a missing language says not installed, not timed" begin
        reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_example_run", "request_id" => "r3", "example_id" => "random-walk");
            presence=() -> Dict("julia" => true, "r" => false, "python" => true), runner=speed_lab_fake_runner())
        @test reply["languages"]["r"]["status"] == "not_installed"
        @test reply["languages"]["r"]["message"] == "not installed, not timed"
        @test !haskey(reply["languages"]["r"], "median")
    end

    @testset "a runner that throws becomes did-not-finish, not an invented number" begin
        boom = (language, id, mode) -> language == "python" ? error("timed out") : Dict{String,Any}("answer" => [1.0], "times" => [1.0, 1.0, 1.0], "version" => "v")
        reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_example_run", "request_id" => "r4", "example_id" => "loop-sum");
            presence=SPEED_LAB_ALL_PRESENT, runner=boom)
        @test reply["languages"]["python"]["status"] == "failed"
        @test reply["languages"]["python"]["message"] == "did not finish, not timed"
        @test !haskey(reply["languages"]["python"], "median")
    end

    @testset "requests accept only fixed example ids and exact fields" begin
        bad(m) = JuliaTime.speed_lab_reply(m; presence=SPEED_LAB_ALL_PRESENT, runner=speed_lab_fake_runner())["type"] == "error"
        @test bad(Dict("type" => "speed_lab_example_run", "request_id" => "x", "example_id" => "../../etc/passwd"))
        @test bad(Dict("type" => "speed_lab_example_run", "request_id" => "x", "example_id" => "loop-sum", "code" => "run(`ls`)"))
        @test bad(Dict("type" => "speed_lab_example_run", "request_id" => "", "example_id" => "loop-sum"))
        @test bad(Dict("type" => "speed_lab_nonsense", "request_id" => "x"))
    end

    @testset "own code: one sandbox run, the learner's lines inside a function, both times returned" begin
        seen = String[]
        fake = function (code; budget)
            push!(seen, code)
            return JuliaTime.SandboxResult(:ok, (0.8, 0.1), "", "")
        end
        code = "using Statistics\nimport Random\nx = mean(1:10)\nx"
        reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "o1", "code" => code); sandbox=fake)
        @test reply["type"] == "speed_lab_own_result"
        @test reply["status"] == "ok"
        @test reply["first"]["seconds"] == 0.8
        @test reply["second"]["seconds"] == 0.1
        @test length(seen) == 1
        w = seen[1]
        @test occursin("__jt_body() = begin", w)
        @test occursin("@elapsed __jt_body()", w)
        # using/import lines are lifted above the function; the rest sits inside it
        @test first(findfirst("using Statistics", w)) < first(findfirst("__jt_body()", w))
        @test first(findfirst("import Random", w)) < first(findfirst("__jt_body()", w))
        @test first(findfirst("x = mean(1:10)", w)) > first(findfirst("__jt_body()", w))
        @test occursin("compil", reply["explanation"])
        @test reply["label"] == "Measured on this computer, just now."
        @test JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "o1", "code" => "1+1"); sandbox=(c; budget) -> JuliaTime.SandboxResult(:ok, 0.5, "", ""))["status"] == "error"
    end

    @testset "own code: errors, const lines and timeouts become plain messages" begin
        n = Ref(0)
        failing = function (code; budget)
            n[] += 1
            return JuliaTime.SandboxResult(:error, nothing, "", "UndefVarError: y not defined")
        end
        reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "o2", "code" => "y"); sandbox=failing)
        @test reply["status"] == "error"
        @test occursin("UndefVarError", reply["first"]["message"])
        @test reply["second"] === nothing
        @test n[] == 1
        slow = (code; budget) -> JuliaTime.SandboxResult(:timeout, nothing, "", "That took longer than 5 seconds.")
        t = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "o3", "code" => "while true end"); sandbox=slow)
        @test t["status"] == "timeout"
        @test t["second"] === nothing
        # a const line is refused before the sandbox with a plain message
        n[] = 0
        c = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "o5", "code" => "const A = 3\nA + 1"); sandbox=failing)
        @test c["status"] == "error"
        @test occursin("const", c["first"]["message"])
        @test n[] == 0
        @test JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "o4", "code" => ""))["type"] == "error"
        @test JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "o4", "code" => "a"^30_000))["type"] == "error"
        @test JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "o4", "code" => 1))["type"] == "error"
    end

    @testset "server routes every speed_lab_ message" begin
        reply = JuliaTime.handle_message(Dict("type" => "speed_lab_examples", "request_id" => "ex-9"))
        @test reply["type"] == "speed_lab_examples"
        @test JuliaTime.handle_message(Dict("type" => "speed_lab_bogus", "request_id" => "x"))["type"] == "error"
    end

    if get(ENV, "JULIATIME_INTEGRATION", "") == "1"
        @testset "live: one real example, all languages present, answers agree" begin
            reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_example_run", "request_id" => "live-1", "example_id" => "group-means"))
            @test reply["type"] == "speed_lab_example_result"
            @test reply["languages"]["julia"]["status"] == "timed"
            for (lang, row) in reply["languages"]
                @test row["status"] in ("timed", "not_installed")
            end
        end
        @testset "live: own code in the real sandbox, first run compiles, second does not" begin
            # the coordinator's f(10^6) sum-of-roots example compiles in microseconds (measured: first
            # and second are equal to within noise), so the gap is asserted on code that needs real compiling
            code = "using Distributions\nf(n) = sum(rand(Normal(0, 1), n))\nf(10^5)"
            reply = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "live-2", "code" => code))
            @test reply["status"] == "ok"
            @test reply["first"]["seconds"] > reply["second"]["seconds"] > 0
            println("own-code Normal example: first=", reply["first"]["seconds"], " second=", reply["second"]["seconds"])
            parse_err = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "live-3", "code" => "x = (1 +"))
            @test parse_err["status"] == "error"
            @test !isempty(parse_err["first"]["message"])
            const_err = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "live-4", "code" => "const A = 2\nA"))
            @test const_err["status"] == "error"
            hang = JuliaTime.speed_lab_reply(Dict("type" => "speed_lab_own_run", "request_id" => "live-5", "code" => "while true end"))
            @test hang["status"] == "timeout"
        end
    end
end

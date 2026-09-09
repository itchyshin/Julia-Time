using Test

# Keep an early, precise RED failure if a future packaging mistake omits the
# shared setup helper altogether.
const SETUP_COMMON = joinpath(@__DIR__, "..", "tools", "setup", "common.jl")
if !isfile(SETUP_COMMON)
    @testset "setup contract bootstrap" begin
        @test isfile(SETUP_COMMON)
    end
end
include(SETUP_COMMON)

const SETUP_REPORT_FIELDS = (
    "contract_version",
    "component",
    "state",
    "version",
    "probe",
    "value",
)
const SETUP_NEXT_ACTION = "Next: open the Case Board with the matching command in docs/install.md."

function setup_text(path...)
    filename = joinpath(@__DIR__, "..", path...)
    @test isfile(filename)
    return read(filename, String)
end

function setup_report(; contract_version = "setup-v1",
        component = "julia",
        state = "ready",
        version = "1.10.0",
        probe = "julia-sandbox-timeout-recovery-42-v1",
        value = "42")
    join((
        "contract_version=$contract_version",
        "component=$component",
        "state=$state",
        "version=$version",
        "probe=$probe",
        "value=$value",
    ), "\n")
end

@testset "setup contract" begin
    # Keep this guard first: its absence is the sole expected RED failure now.
    @test isdefined(@__MODULE__, :setup_version_status)
    if isdefined(@__MODULE__, :setup_version_status)
        @test setup_version_status(v"1.9.9") == :unsupported
        @test setup_version_status(v"1.9.99") == :unsupported
        @test setup_version_status(v"1.10.0") == :supported
        @test setup_version_status(v"1.10.99") == :supported
        @test setup_version_status(v"1.11.0") == :unsupported
        @test setup_version_status(v"1.11.1") == :unsupported

        @test isdefined(@__MODULE__, :validate_setup_report)
        if isdefined(@__MODULE__, :validate_setup_report)
            valid = setup_report()
            @test validate_setup_report(valid;
                expected_component = "julia",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === 42.0

            @test validate_setup_report(valid * "\nvalue=42";
                expected_component = "julia",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === nothing
            @test validate_setup_report(valid * "\nextra=field";
                expected_component = "julia",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === nothing
            @test validate_setup_report(join(split(valid, '\n')[1:5], "\n");
                expected_component = "julia",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === nothing
            @test validate_setup_report(setup_report(contract_version = "setup-v2");
                expected_component = "julia",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === nothing
            @test validate_setup_report(setup_report(state = "pending");
                expected_component = "julia",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === nothing
            @test validate_setup_report(valid;
                expected_component = "python",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === nothing
            @test validate_setup_report(valid;
                expected_component = "julia",
                expected_probe = "python-version",
                expected_value = 42.0) === nothing
            @test validate_setup_report(setup_report(value = "41");
                expected_component = "julia",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === nothing

            check_setup = setup_text("check_setup.jl")
            run_script = setup_text("run.jl")
            macos_launcher = setup_text("tools", "setup", "launch-macos.command")
            windows_launcher = setup_text("tools", "setup", "launch-windows.cmd")
            install_guide = setup_text("docs", "install.md")

            for probe_artifact in (
                    setup_text("tools", "setup", "probe_julia.jl"),
                    setup_text("tools", "setup", "probe_r.R"),
                    setup_text("tools", "setup", "probe_python.py"),
                )
                @test occursin("setup-v1", probe_artifact)
                for field in SETUP_REPORT_FIELDS
                    @test occursin(field, probe_artifact)
                end
            end

            julia_probe = joinpath(@__DIR__, "..", "tools", "setup", "probe_julia.jl")
            course_root = normpath(joinpath(@__DIR__, ".."))
            julia_probe_report = read(`$(Base.julia_cmd()) --startup-file=no --history-file=no --project=$course_root $julia_probe`, String)
            @test validate_setup_report(julia_probe_report;
                expected_component = "julia",
                expected_probe = "julia-sandbox-timeout-recovery-42-v1",
                expected_value = 42.0) === 42.0

            @test occursin("while true end", setup_text("tools", "setup", "probe_julia.jl"))

            @test occursin("host=\"127.0.0.1\"", replace(run_script, ' ' => ""))
            @test occursin("port=8000", replace(run_script, ' ' => ""))
            @test occursin("validate_setup_report", check_setup)
            @test occursin("setup_version_status", check_setup)
            @test occursin("1.10", check_setup)
            @test occursin("OK — Julia Time is ready", check_setup)
            @test occursin(SETUP_NEXT_ACTION, check_setup)

            for launcher in (macos_launcher, windows_launcher)
                lowered = lowercase(launcher)
                @test occursin("run.jl", launcher)
                @test occursin("https://julialang.org/downloads/manual-downloads/", launcher)
                @test !occursin("curl", lowered)
                @test !occursin("winget", lowered)
                @test !occursin("sudo", lowered)
                @test !occursin("juliaup", lowered)
                @test !occursin("security-policy", lowered)
                @test !occursin("global-default", lowered)
            end

            lowered_guide = lowercase(install_guide)
            @test !occursin("<repo link", lowered_guide)
            @test !occursin("to follow", lowered_guide)
            @test !occursin("git clone", lowered_guide)
            @test occursin(r"(?i)supplied archive", install_guide)
            @test occursin("OK — Julia Time is ready", install_guide)
            @test occursin(SETUP_NEXT_ACTION, install_guide)
            @test occursin("1. Julia", install_guide)
            @test occursin("2. `julia` is not found", install_guide)
            @test occursin("3. Package download", install_guide)

            python_probe = setup_text("tools", "setup", "probe_python.py")
            @test occursin("np.__version__", python_probe)
            @test occursin("t_probe", check_setup)
            @test occursin("complete setup took", check_setup)
            @test occursin("SERVER_START_FAILED", run_script)
            @test occursin("close a previous Julia Time launcher", run_script)
            @test occursin("JuliaTime.shutdown!()", run_script)

            @testset "launcher explains a missing project setup" begin
                mktempdir() do empty_project
                    output = IOBuffer()
                    command = setenv(
                        `$(Base.julia_cmd()) --startup-file=no --history-file=no --project=$empty_project $(joinpath(@__DIR__, "..", "run.jl"))`,
                        "JULIA_LOAD_PATH" => "@",
                    )
                    process = run(pipeline(
                        ignorestatus(command),
                        stdout=output,
                        stderr=output,
                    ))
                    text = String(take!(output))
                    @test !success(process)
                    @test occursin("JULIA_TIME_NOT_READY", text)
                    @test occursin("docs/install.md", text)
                    @test !occursin("Pkg.add", text)
                end
            end
        end
    end
end

println("SETUP_CHECKS_OK")

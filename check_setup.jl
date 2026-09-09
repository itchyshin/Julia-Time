# One-time local setup for the extracted Julia Time folder.
#
# See docs/install.md for the Mac/Linux or Windows command that caps the local game threads.

include(joinpath(@__DIR__, "tools", "setup", "common.jl"))

const SETUP_NEXT_ACTION = "Next: open the Case Board with the matching command in docs/install.md."

function setup_failure(title::AbstractString, detail::AbstractString, next::AbstractString)
    println("NOT OK — ", title)
    println(detail)
    println("Next: ", next)
    exit(1)
end

println("Julia Time will install and precompile packages for this project.")
println("Julia may keep its normal local download and compile cache outside this extracted folder.")
println("The first setup may take several minutes, depending on your connection and computer.")
println("Julia version: ", VERSION)

if setup_version_status(VERSION) !== :supported
    setup_failure(
        "Julia Time needs Julia 1.10.x",
        "This folder is tested with Julia 1.10.x; found $(VERSION). Install or select Julia 1.10 manually, then rerun this command.",
        "repair 1 — install or select Julia 1.10.x manually, then rerun this setup command",
    )
end

using Pkg

function setup_step(label::AbstractString, action::Function)
    try
        elapsed = @elapsed action()
        println(label, " finished in ", round(elapsed; digits=1), " seconds.")
        return elapsed
    catch err
        setup_failure(
            "$label failed",
            sprint(showerror, err),
            "repair 3 — check your connection, then rerun this setup command; if it still fails, send the last lines to the facilitator",
        )
    end
end

t_instantiate = setup_step("Installing Julia Time packages", Pkg.instantiate)
t_precompile = setup_step("Precompiling Julia Time packages", Pkg.precompile)
t_load = setup_step("Loading Julia Time", () -> (@eval using JuliaTime))

function run_julia_probe(probe_path::AbstractString)
    try
        return read(`$(Base.julia_cmd()) --startup-file=no --history-file=no --project=$(@__DIR__) $probe_path`, String)
    catch err
        setup_failure(
            "the Julia sandbox check failed",
            sprint(showerror, err),
            "repair 3 — rerun this setup command; if it still fails, send the last lines to the facilitator",
        )
    end
end

probe_path = joinpath(@__DIR__, "tools", "setup", "probe_julia.jl")
probe_output, t_probe = let
    output = ""
    elapsed = @elapsed output = run_julia_probe(probe_path)
    (output, elapsed)
end

probe_value = validate_setup_report(probe_output;
    expected_component="julia",
    expected_probe="julia-sandbox-timeout-recovery-42-v1",
    expected_value=42.0,
)
probe_value === nothing && setup_failure(
    "the Julia sandbox check returned an unexpected result",
    "Julia Time expected its fixed local check to return 42.",
    "repair 3 — rerun this setup command; if it still fails, send the last lines to the facilitator",
)

total = t_instantiate + t_precompile + t_load + t_probe
println("OK — Julia Time is ready (complete setup took ", round(total; digits=1), " seconds).")
println(SETUP_NEXT_ACTION)

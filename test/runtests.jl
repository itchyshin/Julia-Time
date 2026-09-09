using Test
using JuliaTime
using CSV, DataFrames, Statistics

# Plain include-list (house style). Integration + bad-code suites are gated: JULIATIME_INTEGRATION=1.
@testset "JuliaTime stub" begin
    @test isdefined(JuliaTime, :run_server)
end

include("test_sandbox.jl")
include("test_protected_inputs.jl")
include("test_data.jl")
include("test_protocol.jl")
include("test_server.jl")
include("test_setup_contract.jl")
include("test_setup_status.jl")
include("test_setup_server.jl")
include("test_levels.jl")
include("test_mystery.jl")
include("test_mystery_c2.jl")
include("test_mystery_c3.jl")
include("test_mystery_c4.jl")
include("test_mystery_c5.jl")
include("test_mystery_c6.jl")
include("test_mystery_routing.jl")
include("test_speed_lab.jl")
include("test_integration.jl")

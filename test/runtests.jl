using Test
using JuliaTime
using CSV, DataFrames, Statistics

# Plain include-list (house style). Integration + bad-code suites are gated: JULIATIME_INTEGRATION=1.
# Each file goes through include_watched so a hang names its file and backtraces instead of silently
# using up the CI job's time limit (test/watchdog.jl; JULIATIME_TEST_STALL_S overrides the 720 s limit).
include("watchdog.jl")
const _WATCHDOG = TestWatchdog.start!()
@testset "JuliaTime stub" begin
    @test isdefined(JuliaTime, :run_server)
end

include_watched("test_watchdog.jl")
include_watched("test_sandbox.jl")
include_watched("test_prewarm_claim.jl")
include_watched("test_protected_inputs.jl")
include_watched("test_data.jl")
include_watched("test_protocol.jl")
include_watched("test_server.jl")
include_watched("test_launch.jl")
include_watched("test_setup_contract.jl")
include_watched("test_setup_status.jl")
include_watched("test_setup_server.jl")
include_watched("test_levels.jl")
include_watched("test_mystery.jl")
include_watched("test_mystery_c2.jl")
include_watched("test_mystery_c3.jl")
include_watched("test_mystery_c4.jl")
include_watched("test_mystery_c5.jl")
include_watched("test_mystery_c6.jl")
include_watched("test_mystery_epilogue.jl")
include_watched("test_lessons.jl")
include_watched("test_lesson_mistakes.jl")
include_watched("test_lesson_sweep.jl")
include_watched("test_exam_fit.jl")
include_watched("test_mystery_feedback.jl")
include_watched("test_mystery_r3.jl")
include_watched("test_mystery_r4.jl")
include_watched("test_mystery_r5.jl")
include_watched("test_mystery_r6.jl")
include_watched("test_mystery_r7.jl")
include_watched("test_mystery_r8.jl")
include_watched("test_mystery_routing.jl")
include_watched("test_speed_lab.jl")
include_watched("test_coaching_lines.jl")
include_watched("test_own_data.jl")
include_watched("test_own_typed.jl")
include_watched("test_integration.jl")
close(_WATCHDOG)

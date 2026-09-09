"""
    JuliaTime

A locally-run browser game for learning Julia: the player types real Julia, the screen answers.
Design: docs/design/00-spec.md · architecture: docs/design/01-architecture.md · build order: docs/build-plan.md.

The sandbox, dataset, local server (static page + WebSocket) and the seven level screens are
built; the server is not yet wired to the level registry (slice B6).
"""
module JuliaTime

export run_server, run_code, warmup!, shutdown!, SandboxResult, water_fleas, DATA_LABEL,
       start_server, stop_server,
       Level, Task, LEVELS, level_by_id, context, env_for, payload,
       mystery_jars, mystery_case_info, mystery_case_run, check_mystery_c1,
       mystery_c2_case_info, mystery_c2_case_run, check_mystery_c2,
       mystery_c3_report, mystery_c3_handling_log, mystery_c3_joined,
       mystery_c3_expected_join, mystery_c3_expected_discrepancy,
       mystery_c3_practice_report, mystery_c3_practice_log,
       mystery_c3_practice_expected_join, check_mystery_c3_practice_join,
       mystery_c3_case_info, mystery_c3_case_run, check_mystery_c3,
       mystery_c4_candidates, mystery_c4_expected_eligible,
       mystery_c4_case_info, mystery_c4_case_run, check_mystery_c4,
       mystery_c5_sim_counts, mystery_c5_observed_count, mystery_c5_expected_events,
       mystery_c5_case_info, mystery_c5_case_run, mystery_c5_case_action, check_mystery_c5,
       mystery_c6_candidates, mystery_c6_observed_count, mystery_c6_expected_compatible,
       mystery_c6_case_info, mystery_c6_case_run, check_mystery_c6,
       speed_lab_info_reply, speed_lab_run_reply

using CSV, DataFrames
using HTTP, JSON

include("sandbox.jl")
include("data.jl")
include("protocol.jl")
include("server.jl")
include("setup_status.jl")
include("speed_lab.jl")
include("levels.jl")

const _LEVEL_FILES = (
    "L0_first_contact", "L0.5_look", "L1_falling_rows", "L2_which_pond",
    "L3_totos_deck", "L4_gallery", "L5_flip", "L6_race",
)
for _f in _LEVEL_FILES
    include(joinpath(@__DIR__, "..", "levels", "$(_f).jl"))
end

# The mystery is a separate chapter protocol, deliberately loaded after legacy levels so it
# cannot change their registry or response shape.
include("mystery.jl")
include("mystery_c2.jl")
include("mystery_c3.jl")
include("mystery_c4.jl")
include("mystery_c5.jl")
include("mystery_c6.jl")

end # module

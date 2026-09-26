# "The same move in R and Python" (2026-09-25): dump the live Julia reference inputs and expected
# outputs for all ten bridge-card moves, as one JSON line on stdout. test/bridge-parity.test.cjs
# runs this script, writes the values out as CSVs, and re-checks each move's R and Python line
# against these Julia-computed values — never a hardcoded snapshot (AGENTS.md rule 3: never invent
# output; bridge lines must be valid).

using JuliaTime
using DataFrames, Statistics, JSON

function rows_of(df::DataFrames.DataFrame)
    cols = String.(DataFrames.names(df))
    return [Dict(c => df[i, c] for c in cols) for i in 1:DataFrames.nrow(df)]
end

function table_payload(df::DataFrames.DataFrame)
    return Dict("columns" => String.(DataFrames.names(df)), "rows" => rows_of(df))
end

jars = mystery_jars()
b09 = filter(:batch_id => ==("B09"), jars)

c2_counts = combine(groupby(b09, :tray_id), nrow => :n, :detected => sum => :detected_n)
c2_rates = combine(groupby(b09, :tray_id), nrow => :n, :detected => sum => :detected_n,
                    :detected => mean => :rate)

tray_counts = mystery_c3_tray_counts()
tally_sheet = mystery_c3_tally_sheet()
joined = mystery_c3_joined()
disagreement = mystery_c3_expected_discrepancy()

eligible = mystery_c4_expected_eligible()

sim_counts = mystery_c5_sim_counts()
c5_observed_count = mystery_c5_observed_count()
expected_events = mystery_c5_expected_events()
expected_frequency = sum(expected_events) / length(expected_events)

candidates = mystery_c6_candidates()
c6_observed_count = mystery_c6_observed_count()
compatible = mystery_c6_expected_compatible()

payload = Dict(
    "b09" => table_payload(b09),
    "c2_counts" => table_payload(c2_counts),
    "c2_rates" => table_payload(c2_rates),
    "c3_tray_counts" => table_payload(tray_counts),
    "c3_tally_sheet" => table_payload(tally_sheet),
    "c3_joined" => table_payload(joined),
    "c3_disagreement" => table_payload(disagreement),
    "c4_eligible" => table_payload(eligible),
    "c5_sim_counts" => sim_counts,
    "c5_observed_count" => c5_observed_count,
    "c5_expected_events" => expected_events,
    "c5_expected_frequency" => expected_frequency,
    "c6_stories" => table_payload(candidates),
    "c6_observed_count" => c6_observed_count,
    "c6_compatible" => table_payload(compatible),
)
println(JSON.json(payload))

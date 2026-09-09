# Assumes CSV and DataFrames are `using`-imported by the including module.

const DATA_LABEL = "Simulated data — generated from a seeded simulator (data/water_fleas.jl), not real water fleas."

function water_fleas()
    path = joinpath(@__DIR__, "..", "data", "water_fleas.csv")
    CSV.read(path, DataFrame; stringtype = String)
end

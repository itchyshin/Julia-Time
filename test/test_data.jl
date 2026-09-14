@testset "water fleas" begin
    df = water_fleas()

    @test nrow(df) == 48
    @test names(df) == ["pond", "jar", "count", "temp"]
    @test eltype(df.pond) == String
    @test sort(unique(df.pond)) == ["east", "north", "south", "west"]
    @test all(combine(groupby(df, :pond), nrow => :n).n .== 12)
    @test all(df.count .>= 0)

    pond_means = combine(groupby(df, :pond), :count => mean => :mean_count)
    @test maximum(pond_means.mean_count) > 1.5 * minimum(pond_means.mean_count)

    @test occursin("Simulated", DATA_LABEL)

    # Regeneration is byte-identical to the checked-in CSV.
    csvpath = joinpath(@__DIR__, "..", "data", "water_fleas.csv")
    include(joinpath(@__DIR__, "..", "data", "water_fleas.jl"))
    io = IOBuffer()
    CSV.write(io, simulate_water_fleas())
    normalize_eol(s) = replace(s, "\r\n" => "\n")
    @test normalize_eol(String(take!(io))) == normalize_eol(read(csvpath, String))
end

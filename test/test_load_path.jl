# Windows separates JULIA_LOAD_PATH entries with ';', others with ':'. 0.5.2 shipped "@:@stdlib" on every OS, so on
# Windows the worker saw one unknown entry and could not load JuliaTime (public CI run 37119314189).
@testset "worker load path uses the OS separator" begin
    @test JuliaTime._worker_load_path(true) == "@;@stdlib"
    @test JuliaTime._worker_load_path(false) == "@:@stdlib"
    @test JuliaTime._worker_load_path() == (Sys.iswindows() ? "@;@stdlib" : "@:@stdlib")
    src = read(joinpath(@__DIR__, "..", "src", "sandbox.jl"), String)
    @test occursin("\"JULIA_LOAD_PATH\" => _worker_load_path()", src)
    @test !occursin("\"@:@stdlib\"", src)
end
println("LOAD-PATH-OK")

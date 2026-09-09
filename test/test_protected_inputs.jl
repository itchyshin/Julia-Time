using Test, JuliaTime, DataFrames

@testset "Protected teaching inputs" begin
    JuliaTime.warmup!()
    try
        env = (jars=DataFrame(x=[1,2]),)
        ordinary = run_code("copy(jars)"; env, protected_bindings=(:jars,))
        @test ordinary.status == :ok
        changed = run_code("answer = copy(jars); jars.x[1] = 99; answer"; env, protected_bindings=(:jars,))
        @test changed.status == :error
        @test occursin("jars", changed.message)
        @test changed.value === nothing
        @test env.jars.x == [1,2]
        rebound = run_code("jars = DataFrame(x=[3,4]); 42"; env, protected_bindings=(:jars,))
        @test rebound.status == :error
        free = run_code("jars.x[1] = 99; jars"; env)
        @test free.status == :ok
    finally
        JuliaTime.shutdown!()
    end
end

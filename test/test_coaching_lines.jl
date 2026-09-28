# Adversary review B1 and its re-review (2026-09-27): coaching must never suggest Julia that does not
# run (AGENTS.md rule 3). The C2 pandas-habit line once suggested sample(jars, 3), which raises a
# MethodError in the sandbox. This file reads each suggested line from the page source and runs it
# through the real sandbox with that chapter's inputs, so the text cannot drift away from Julia.
# Gated with the other sandbox-backed suites (JULIATIME_INTEGRATION=1).

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    @testset "coaching lines run in the real sandbox" begin
        c2 = read(joinpath(@__DIR__, "..", "web", "chapter2.js"), String)
        known = match(r"const KNOWN_FUNCTIONS = Object\.freeze\(\{(.*?)\}\);", c2)
        @test known !== nothing
        lines = [m.captures[2] for m in eachmatch(r"(\w+):\"((?:[^\"\\]|\\.)*)\"", known.captures[1])]
        @test length(lines) == 3
        for line in lines
            r = JuliaTime.run_code(line; env=(jars=JuliaTime._mystery_c2_input(),), budget=JuliaTime.RUN_BUDGET)
            @test r.status == :ok
        end

        # Audit 2026-09-27 (design rule 2): the coaching no longer names the finished row rule with
        # the case's own names; it names the idea with placeholders (a, b, c, d) instead. This still
        # guards Rule 3 (never suggest code Julia rejects): run the extracted placeholder example
        # with an env that binds a, b, c, d to small vectors, and check it runs and returns a
        # true/false vector.
        c6 = read(joinpath(@__DIR__, "..", "web", "chapter6.js"), String)
        bracket = match(r"wrap each comparison in brackets, as in (.*?)\.\"", c6)
        @test bracket !== nothing
        rule = bracket.captures[1]
        env = (a=[1, 2, 3], b=[2, 2, 2], c=[0, 5, 5], d=[10, 10, 10])
        r = JuliaTime.run_code(rule; env=env, budget=JuliaTime.RUN_BUDGET)
        @test r.status == :ok
        @test r.value isa AbstractVector{Bool}
        @test length(r.value) == 3
    end
end

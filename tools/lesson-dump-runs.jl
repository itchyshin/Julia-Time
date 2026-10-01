# Runs every task's own solution through the real engine and writes what the screen would be given
# (test/fixtures/lesson-solution-runs.json): so the no-scroll tools and tests can draw REAL results.
#   julia --project=. tools/lesson-dump-runs.jl
using JuliaTime, JSON
function dump_solution_runs()
    JuliaTime.reload_lessons!()
    out = Dict{String, Any}()
    for (lid, l) in sort(collect(JuliaTime.LESSONS); by=first)
        get(l, "kind", nothing) == "range" && continue
        runs = Dict{String, Any}()
        for r in l["rounds"], c in r["challenges"]
            haskey(c, "solution") || continue
            # the screen runs a task's earlier lines too; the solution alone is what the grader runs
            rep = JuliaTime.handle_message(Dict("type" => "lesson_run", "lesson" => lid, "challenge" => c["id"],
                                                 "code" => c["solution"], "request_id" => "dump"))
            runs[c["id"]] = Dict{String, Any}(k => get(rep, k, nothing) for k in
                ("status", "value_repr", "value_table", "stdout", "shown", "shown_caption", "shown_keys", "pass", "feedback", "message"))
        end
        out[lid] = runs
    end
    return out
end
if abspath(PROGRAM_FILE) == @__FILE__
    path = joinpath(@__DIR__, "..", "test", "fixtures", "lesson-solution-runs.json")
    open(path, "w") do io; JSON.print(io, dump_solution_runs(), 1); end
    println("wrote ", normpath(path))
end

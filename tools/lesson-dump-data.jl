# Dumps each lesson's real `data_values` and jars rack (from the engine's own setups) so the no-scroll
# tool's fake mode draws real-size tables.   julia --project=. tools/lesson-dump-data.jl
# tools/notes-run.cjs (P10) turns the same tables into CSV and runs every R and Python note on them.
using JuliaTime, JSON
function dump_lesson_data()
    JuliaTime.reload_lessons!()
    out = Dict{String, Any}()
    for (id, l) in JuliaTime.LESSONS
        get(l, "kind", nothing) in ("range", "own") && continue   # the range and the own-data lesson have no data tables; the no-scroll tool skips them
        pub = JuliaTime.lesson_public(l)
        out[id] = Dict{String, Any}("data_values" => pub["data_values"], "jars" => get(pub, "jars", nothing))
    end
    return out
end
if abspath(PROGRAM_FILE) == @__FILE__
    path = joinpath(@__DIR__, "..", "test", "fixtures", "lesson-data-values.json")
    open(path, "w") do io
        JSON.print(io, dump_lesson_data(), 1)
    end
    println("wrote ", normpath(path))
end

# Fixed Speed lab example: random-walk. Julia, standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
function kernel()
    x = 12345
    sumsq = 0.0; sumfinal = 0.0; maxabs = 0
    for w in 1:6000
        pos = 0
        for s in 1:1000
            x = x * 16807 % 2147483647
            pos += x <= 1073741823 ? 1 : -1
            maxabs = max(maxabs, abs(pos))
        end
        sumsq += pos * pos
        sumfinal += pos
    end
    return [sumsq / 6000, Float64(maxabs), sumfinal / 6000]
end

function main()
    mode = length(ARGS) == 1 ? ARGS[1] : error("expected check or time")
    if mode == "check"
        println("{\"answer\":[", join(repr.(kernel()), ","), "]}")
    elseif mode == "time"
        kernel()
        times = Float64[]; answer = Float64[]
        for _ in 1:3
            t0 = time_ns(); answer = kernel(); push!(times, (time_ns() - t0) / 1e9)
        end
        println("{\"answer\":[", join(repr.(answer), ","), "],\"times\":[", join(repr.(times), ","), "],\"version\":\"Julia ", VERSION, "\"}")
    else
        error("expected check or time")
    end
end
main()

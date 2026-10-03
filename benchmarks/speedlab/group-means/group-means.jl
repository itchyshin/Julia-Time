# Fixed Speed lab example: group-means. Julia, standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
function kernel()
    x = 12345
    sums = zeros(Float64, 5000); counts = zeros(Int, 5000)
    for r in 1:3_000_000
        x = x * 16807 % 2147483647
        g = x % 5000 + 1
        x = x * 16807 % 2147483647
        sums[g] += x / 2147483647
        counts[g] += 1
    end
    total = 0.0; lo = Inf; hi = -Inf
    for g in 1:5000
        m = sums[g] / counts[g]
        total += m
        lo = min(lo, m); hi = max(hi, m)
    end
    return [total / 5000, lo, hi]
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

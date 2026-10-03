# Fixed Speed lab example: running-stat. Julia, standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
function kernel()
    x = 12345
    mean = 0.0; m2 = 0.0
    n = 4_000_000
    for i in 1:n
        x = x * 16807 % 2147483647
        u = x / 2147483647
        delta = u - mean
        mean += delta / i
        m2 += delta * (u - mean)
    end
    return [mean, m2 / (n - 1)]
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

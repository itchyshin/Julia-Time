# Fixed Speed lab example: bootstrap-mean. Julia, standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
function kernel()
    x = 12345
    data = Vector{Float64}(undef, 200)
    for j in 1:200
        x = x * 16807 % 2147483647
        data[j] = x / 2147483647 * 10
    end
    total = 0.0; lo = Inf; hi = -Inf
    for b in 1:30_000
        s = 0.0
        for k in 1:200
            x = x * 16807 % 2147483647
            s += data[x % 200 + 1]
        end
        m = s / 200
        total += m
        lo = min(lo, m); hi = max(hi, m)
    end
    return [total / 30_000, lo, hi]
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

# Fixed Speed lab example: permutation-test. Julia, standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
function kernel()
    x = 12345
    vals = Vector{Float64}(undef, 60)
    for i in 1:60
        x = x * 16807 % 2147483647
        vals[i] = x / 2147483647 + (i > 30 ? 0.1 : 0.0)
    end
    s1 = 0.0; s2 = 0.0
    for i in 1:30
        s1 += vals[i]
    end
    for i in 31:60
        s2 += vals[i]
    end
    observed = s2 / 30 - s1 / 30
    count = 0
    for p in 1:40_000
        for i in 59:-1:1
            x = x * 16807 % 2147483647
            j = x % (i + 1) + 1
            vals[i + 1], vals[j] = vals[j], vals[i + 1]
        end
        a = 0.0; b = 0.0
        for i in 1:30
            a += vals[i]
        end
        for i in 31:60
            b += vals[i]
        end
        if abs(b / 30 - a / 30) >= abs(observed)
            count += 1
        end
    end
    return [observed, Float64(count)]
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

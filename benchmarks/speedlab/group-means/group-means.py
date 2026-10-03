# Fixed Speed lab example: group-means. Python standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
import math, sys, time

def kernel():
    x = 12345
    sums = [0.0] * 5000; counts = [0] * 5000
    for r in range(3000000):
        x = x * 16807 % 2147483647
        g = x % 5000
        x = x * 16807 % 2147483647
        sums[g] += x / 2147483647
        counts[g] += 1
    total = 0.0; lo = float("inf"); hi = float("-inf")
    for g in range(5000):
        m = sums[g] / counts[g]
        total += m
        if m < lo: lo = m
        if m > hi: hi = m
    return [total / 5000, lo, hi]

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("check", "time"):
        raise SystemExit("expected check or time")
    if sys.argv[1] == "check":
        print('{"answer":[' + ",".join(repr(v) for v in kernel()) + "]}")
    else:
        kernel()
        times = []
        answer = None
        for _ in range(3):
            t0 = time.perf_counter(); answer = kernel(); times.append(time.perf_counter() - t0)
        print('{"answer":[' + ",".join(repr(v) for v in answer) + '],"times":[' + ",".join(repr(t) for t in times) + '],"version":"Python ' + sys.version.split()[0] + '"}')

main()

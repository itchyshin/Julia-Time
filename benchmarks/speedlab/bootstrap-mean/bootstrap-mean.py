# Fixed Speed lab example: bootstrap-mean. Python standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
import math, sys, time

def kernel():
    x = 12345
    data = [0.0] * 200
    for j in range(200):
        x = x * 16807 % 2147483647
        data[j] = x / 2147483647 * 10
    total = 0.0; lo = float("inf"); hi = float("-inf")
    for b in range(30000):
        s = 0.0
        for k in range(200):
            x = x * 16807 % 2147483647
            s += data[x % 200]
        m = s / 200
        total += m
        if m < lo: lo = m
        if m > hi: hi = m
    return [total / 30000, lo, hi]

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

# Fixed Speed lab example: running-stat. Python standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
import math, sys, time

def kernel():
    x = 12345
    mean = 0.0; m2 = 0.0
    n = 4000000
    for i in range(1, n + 1):
        x = x * 16807 % 2147483647
        u = x / 2147483647
        delta = u - mean
        mean += delta / i
        m2 += delta * (u - mean)
    return [mean, m2 / (n - 1)]

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

# Fixed Speed lab example: permutation-test. Python standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
import math, sys, time

def kernel():
    x = 12345
    vals = [0.0] * 60
    for i in range(60):
        x = x * 16807 % 2147483647
        vals[i] = x / 2147483647 + (0.1 if i >= 30 else 0.0)
    s1 = 0.0; s2 = 0.0
    for i in range(30):
        s1 += vals[i]
    for i in range(30, 60):
        s2 += vals[i]
    observed = s2 / 30 - s1 / 30
    count = 0
    for p in range(40000):
        for i in range(59, 0, -1):
            x = x * 16807 % 2147483647
            j = x % (i + 1)
            vals[i], vals[j] = vals[j], vals[i]
        a = 0.0; b = 0.0
        for i in range(30):
            a += vals[i]
        for i in range(30, 60):
            b += vals[i]
        if abs(b / 30 - a / 30) >= abs(observed):
            count += 1
    return [observed, float(count)]

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

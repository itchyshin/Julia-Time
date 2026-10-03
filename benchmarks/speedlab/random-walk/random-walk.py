# Fixed Speed lab example: random-walk. Python standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
import math, sys, time

def kernel():
    x = 12345
    sumsq = 0.0; sumfinal = 0.0; maxabs = 0
    for w in range(6000):
        pos = 0
        for s in range(1000):
            x = x * 16807 % 2147483647
            if x <= 1073741823:
                pos += 1
            else:
                pos -= 1
            if abs(pos) > maxabs: maxabs = abs(pos)
        sumsq += pos * pos
        sumfinal += pos
    return [sumsq / 6000, float(maxabs), sumfinal / 6000]

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

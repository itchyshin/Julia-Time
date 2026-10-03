# Fixed Speed lab example: loop-sum. Python standard library only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
import math, sys, time

def kernel():
    s = 0.0
    sqrt = math.sqrt
    for i in range(1, 20000001):
        s += sqrt(i)
    return [s]

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

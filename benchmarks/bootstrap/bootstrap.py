#!/usr/bin/env python3
"""Correctness-only bootstrap kernel shared with bootstrap.jl and bootstrap.R."""

# The fixture is deliberately zero-based, which lets NumPy index it directly.
# Julia and R use one-based vectors, so their sibling scripts add one exactly
# when looking up detections. Keep this file's indices unchanged.

import argparse
import csv
import hashlib
import json
import sys
import time

import numpy as np

CONTRACT = "bootstrap-parity-v1"
KERNEL = "bootstrap_detection_rate_mean"
INPUT_IDENTITY = "detections-v1/resampling-indices-v1"
BENCHMARK_CONTRACT = "bootstrap-benchmark-v1"
BENCHMARK_WORKLOADS = (1000, 10000)
BENCHMARK_WARMUPS = 1
BENCHMARK_REPETITIONS = 5


def sha256_hex(path):
    with open(path, "rb") as fixture:
        return hashlib.sha256(fixture.read()).hexdigest()


def parse_arguments():
    parser = argparse.ArgumentParser(description="Run the shared bootstrap parity kernel.")
    parser.add_argument("--data", required=True)
    parser.add_argument("--indices", required=True)
    parser.add_argument("--replicates", type=int)
    parser.add_argument("--mode", choices=("benchmark",))
    parser.add_argument("--workload", type=int)
    options = parser.parse_args()
    if options.mode is None:
        if options.replicates is None or options.replicates <= 0:
            parser.error("correctness mode requires positive --replicates")
        if options.workload is not None:
            parser.error("--workload is available only in --mode benchmark")
    else:
        if options.replicates is not None:
            parser.error("benchmark mode does not accept --replicates")
        if options.workload not in BENCHMARK_WORKLOADS:
            parser.error("benchmark workload must be 1000 or 10000")
    return options


def read_csv_rows(path):
    try:
        with open(path, newline="", encoding="utf-8") as fixture:
            rows = list(csv.reader(fixture))
    except OSError as error:
        raise ValueError(f"invalid fixture: {error}") from error
    rows = [row for row in rows if any(cell.strip() for cell in row)]
    if not rows:
        raise ValueError("fixture is empty")
    return rows


def read_detections(path):
    rows = read_csv_rows(path)
    if rows[0] != ["detection"]:
        raise ValueError("detection fixture header must be exactly detection")
    if len(rows) == 1 or any(len(row) != 1 for row in rows[1:]):
        raise ValueError("detection fixture must contain exactly one column")
    try:
        detections = np.asarray([int(row[0].strip()) for row in rows[1:]], dtype=int)
    except ValueError as error:
        raise ValueError(f"detection is not an integer: {error}") from error
    if detections.size == 0 or not np.all(np.isin(detections, [0, 1])):
        raise ValueError("detections must be nonempty binary 0/1 values")
    return detections


def read_indices(path, row_width):
    rows = read_csv_rows(path)
    expected_header = [f"draw_{column}" for column in range(1, row_width + 1)]
    if rows[0] != expected_header:
        raise ValueError(f"index fixture header must be {','.join(expected_header)}")
    if len(rows) == 1 or any(len(row) != row_width for row in rows[1:]):
        raise ValueError("index fixture rows must match the detection count")
    try:
        indices = np.asarray([[int(cell.strip()) for cell in row] for row in rows[1:]], dtype=int)
    except ValueError as error:
        raise ValueError(f"index is not an integer: {error}") from error
    if np.any(indices < 0) or np.any(indices >= row_width):
        raise ValueError("index fixture is outside zero-based bounds")
    return indices


def bootstrap_workload_checksum(detections, indices, workload):
    total = 0.0
    for draw in range(workload):
        row = indices[draw % len(indices)]
        total += float(detections[row].mean())
    return total


def benchmark_report(detections, indices, workload, data_path, indices_path):
    # Fixture loading and this one warm-up happen before every timed region.
    bootstrap_workload_checksum(detections, indices, workload)
    times_seconds = []
    checksums = []
    for _ in range(BENCHMARK_REPETITIONS):
        started = time.perf_counter()
        checksums.append(bootstrap_workload_checksum(detections, indices, workload))
        times_seconds.append(time.perf_counter() - started)
    if not np.all(np.isfinite(checksums)):
        raise ValueError("benchmark kernel returned a non-finite checksum")
    sorted_times = sorted(times_seconds)
    return {
        "contract": BENCHMARK_CONTRACT,
        "report_type": "bootstrap_benchmark",
        "language": "python-numpy",
        "version": f"{sys.version.split()[0]}; NumPy {np.__version__}",
        "input_identity": INPUT_IDENTITY,
        "data_sha256": sha256_hex(data_path),
        "indices_sha256": sha256_hex(indices_path),
        "fixture_index_base": 0,
        "thread_claim": "single-threaded kernel",
        "workload": workload,
        "warmup_repetitions": BENCHMARK_WARMUPS,
        "timed_repetitions": BENCHMARK_REPETITIONS,
        "times_seconds": times_seconds,
        "median_seconds": sorted_times[2],
        "min_seconds": sorted_times[0],
        "max_seconds": sorted_times[-1],
    }


def main():
    options = parse_arguments()
    detections = read_detections(options.data)
    indices = read_indices(options.indices, detections.size)
    if options.mode == "benchmark":
        output = benchmark_report(detections, indices, options.workload, options.data, options.indices)
    else:
        if options.replicates > indices.shape[0]:
            raise ValueError("--replicates exceeds available index rows")
        selected = indices[: options.replicates]
        # No conversion here: the on-disk fixture already uses Python's zero base.
        rates = detections[selected].mean(axis=1)
        bootstrap_mean = rates.mean()
        output = {
            "contract": CONTRACT,
            "kernel": KERNEL,
            "language": "python-numpy",
            "version": f"{sys.version.split()[0]}; NumPy {np.__version__}",
            "input_identity": INPUT_IDENTITY,
            "data_sha256": sha256_hex(options.data),
            "indices_sha256": sha256_hex(options.indices),
            "fixture_index_base": 0,
            "replicate_count": options.replicates,
            "replicate_rates": [float(rate) for rate in rates],
            "bootstrap_mean": float(bootstrap_mean),
        }
    print(json.dumps(output, separators=(",", ":"), allow_nan=False))


if __name__ == "__main__":
    main()

# Shared bootstrap parity fixture

This directory is a correctness substrate for the optional speed laboratory, not
a benchmark receipt.  Each runner receives the same binary detection data, the
same pre-generated resampling-index matrix, and a requested number of index
rows.  It reports only the kernel result and fixture identity/digests.

`resampling-indices-v1.csv` is deliberately **zero-based**.  Python/NumPy uses
it directly.  Julia and base R convert an index with `+ 1` only when indexing
their one-based detection vectors.  This makes the cross-language convention
visible and testable instead of silently relying on a different random draw.

The commands have the same argument contract:

```text
--data PATH --indices PATH --replicates N
```

They emit one compact JSON object on standard output.  They do not time the
kernel, load data inside a timed block, claim a speed advantage, or provide a
benchmark result.

## Explicit benchmark mode

The default command remains correctness-only.  A caller must explicitly select
benchmark mode and one approved workload; arbitrary workload sizes are refused:

```text
--mode benchmark --data PATH --indices PATH --workload 1000
--mode benchmark --data PATH --indices PATH --workload 10000
```

Benchmark mode reads and validates both fixtures before starting its timer,
warms the in-memory kernel once, then takes five **sequential** measurements.
The existing index rows cycle in file order to cover the requested workload;
there is no new random draw.  It reports the five seconds values, median and
range, fixture digests, language/version and the claim that this is a
single-threaded kernel.  Its JSON shape is pinned in
`benchmark-report.schema.json`.  It does not select or label a winner.

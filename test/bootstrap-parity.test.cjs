"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const bootstrapRoot = path.join(repositoryRoot, "benchmarks", "bootstrap");
const fixtureRoot = path.join(bootstrapRoot, "fixtures");
const benchmarkSchemaPath = path.join(bootstrapRoot, "benchmark-report.schema.json");
const dataPath = path.join(fixtureRoot, "detections-v1.csv");
const indicesPath = path.join(fixtureRoot, "resampling-indices-v1.csv");
const replicateCount = 8;
const expectedRates = [0.5, 2 / 3, 0, 1, 0.5, 2 / 3, 0.5, 2 / 3];
const expectedMean = 0.5625;

// The files are deliberately tiny correctness fixtures.  This is not a timing test:
// 1e-12 comfortably exceeds ordinary cross-runtime Float64 print/parse noise while
// still detecting a changed resample or a different statistic.
const parityTolerance = 1e-12;

function sha256(pathname) {
  return crypto.createHash("sha256").update(fs.readFileSync(pathname)).digest("hex");
}

function run(command, script, options = {}) {
  const argumentsForScript = [
    script,
    "--data", options.dataPath || dataPath,
    "--indices", options.indicesPath || indicesPath,
    "--replicates", String(options.replicates || replicateCount)
  ];
  const result = childProcess.spawnSync(command, argumentsForScript, {
    cwd:repositoryRoot,
    encoding:"utf8"
  });
  assert.equal(result.status, 0, `${command} failed:\n${result.stderr || result.stdout}`);
  const lines = result.stdout.split(/\r?\n/).filter(line => line.length > 0);
  assert.equal(lines.length, 1, `${command} must emit exactly one JSON line, got: ${result.stdout}`);
  const parsed = JSON.parse(lines[0]);
  assert.equal(lines[0], lines[0].trim(), `${command} must not add whitespace outside its JSON line`);
  return parsed;
}

function runRaw(command, argumentsForScript) {
  return childProcess.spawnSync(command, argumentsForScript, {
    cwd:repositoryRoot,
    encoding:"utf8"
  });
}

function assertKernelOutput(output, language, fixtureDataPath, fixtureIndicesPath) {
  assert.deepEqual(Object.keys(output), [
    "contract",
    "kernel",
    "language",
    "version",
    "input_identity",
    "data_sha256",
    "indices_sha256",
    "fixture_index_base",
    "replicate_count",
    "replicate_rates",
    "bootstrap_mean"
  ]);
  assert.equal(output.contract, "bootstrap-parity-v1");
  assert.equal(output.kernel, "bootstrap_detection_rate_mean");
  assert.equal(output.language, language);
  assert.equal(typeof output.version, "string");
  assert.ok(output.version.length > 0);
  assert.equal(output.input_identity, "detections-v1/resampling-indices-v1");
  assert.equal(output.data_sha256, sha256(fixtureDataPath));
  assert.equal(output.indices_sha256, sha256(fixtureIndicesPath));
  assert.equal(output.fixture_index_base, 0, "the checked-in fixture is intentionally zero-based");
  assert.equal(output.replicate_count, replicateCount);
  assert.equal(output.replicate_rates.length, replicateCount);
  for (let index = 0; index < expectedRates.length; index += 1) {
    assert.ok(
      Math.abs(output.replicate_rates[index] - expectedRates[index]) <= parityTolerance,
      `replicate ${index + 1} must use the fixed shared resample`
    );
  }
  assert.ok(Math.abs(output.bootstrap_mean - expectedMean) <= parityTolerance);
}

function assertParity(left, right) {
  assert.equal(left.contract, right.contract);
  assert.equal(left.kernel, right.kernel);
  assert.equal(left.input_identity, right.input_identity);
  assert.equal(left.data_sha256, right.data_sha256);
  assert.equal(left.indices_sha256, right.indices_sha256);
  assert.equal(left.replicate_count, right.replicate_count);
  assert.equal(left.replicate_rates.length, right.replicate_rates.length);
  for (let index = 0; index < left.replicate_rates.length; index += 1) {
    assert.ok(
      Math.abs(left.replicate_rates[index] - right.replicate_rates[index]) <= parityTolerance,
      `Julia/R differ at replicate ${index + 1}`
    );
  }
  assert.ok(Math.abs(left.bootstrap_mean - right.bootstrap_mean) <= parityTolerance);
}

test("the shared bootstrap fixture and Julia/R kernels agree, while a changed index is detected", () => {
  const juliaScript = path.join(bootstrapRoot, "bootstrap.jl");
  const rScript = path.join(bootstrapRoot, "bootstrap.R");
  const pythonScript = path.join(bootstrapRoot, "bootstrap.py");
  for (const requiredPath of [dataPath, indicesPath, juliaScript, rScript, pythonScript]) {
    assert.equal(fs.existsSync(requiredPath), true, `required parity artifact is missing: ${requiredPath}`);
  }

  const julia = run("julia", juliaScript);
  const r = run("Rscript", rScript);
  assertKernelOutput(julia, "julia", dataPath, indicesPath);
  assertKernelOutput(r, "r-base", dataPath, indicesPath);
  assertParity(julia, r);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "julia-time-bootstrap-negative-"));
  const changedIndicesPath = path.join(temporaryRoot, "changed-indices.csv");
  try {
    const rows = fs.readFileSync(indicesPath, "utf8").trimEnd().split(/\r?\n/);
    rows[1] = "1,1,1,1,1,1";
    fs.writeFileSync(changedIndicesPath, `${rows.join("\n")}\n`, "utf8");
    const changedJulia = run("julia", juliaScript, {indicesPath:changedIndicesPath});
    const changedR = run("Rscript", rScript, {indicesPath:changedIndicesPath});
    assertParity(changedJulia, changedR);
    assert.notEqual(changedJulia.indices_sha256, julia.indices_sha256);
    assert.notEqual(
      changedJulia.bootstrap_mean,
      julia.bootstrap_mean,
      "the deliberate changed-index negative control must change the kernel output"
    );
  } finally {
    fs.rmSync(temporaryRoot, {recursive:true, force:true});
  }

  const numpyProbe = childProcess.spawnSync("python3", ["-c", "import numpy; print(numpy.__version__)"], {
    cwd:repositoryRoot,
    encoding:"utf8"
  });
  if (numpyProbe.status === 0) {
    const python = run("python3", pythonScript);
    assertKernelOutput(python, "python-numpy", dataPath, indicesPath);
    assertParity(julia, python);
  } else {
    assert.notEqual(numpyProbe.status, 0, "a missing NumPy probe must be nonzero");
    const diagnostic = (numpyProbe.stderr || numpyProbe.stdout).trim().split(/\r?\n/).at(-1);
    console.log(`PYTHON_NUMPY_UNAVAILABLE: ${diagnostic}`);
  }

  console.log("BOOTSTRAP_PARITY_OK");
});

test("the opt-in benchmark report has a pinned safe schema and rejects invalid workloads before timing", () => {
  assert.equal(fs.existsSync(benchmarkSchemaPath), true, "benchmark report schema must be checked in");
  const schema = JSON.parse(fs.readFileSync(benchmarkSchemaPath, "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    "contract",
    "report_type",
    "language",
    "version",
    "input_identity",
    "data_sha256",
    "indices_sha256",
    "fixture_index_base",
    "thread_claim",
    "workload",
    "warmup_repetitions",
    "timed_repetitions",
    "times_seconds",
    "median_seconds",
    "min_seconds",
    "max_seconds"
  ]);
  assert.deepEqual(schema.properties.workload.enum, [1000, 10000]);
  assert.equal(schema.properties.warmup_repetitions.const, 1);
  assert.equal(schema.properties.timed_repetitions.const, 5);
  assert.equal(schema.properties.times_seconds.minItems, 5);
  assert.equal(schema.properties.times_seconds.maxItems, 5);

  // These invocations must fail during option validation.  They never enter a
  // stopwatch, so this test verifies the safe boundary without benchmarking.
  for (const [command, scriptName] of [["julia", "bootstrap.jl"], ["Rscript", "bootstrap.R"]]) {
    const result = runRaw(command, [
      path.join(bootstrapRoot, scriptName),
      "--mode", "benchmark",
      "--data", dataPath,
      "--indices", indicesPath,
      "--workload", "999"
    ]);
    assert.notEqual(result.status, 0, `${command} must reject an unapproved workload`);
    assert.match(result.stderr || result.stdout, /benchmark|workload|mode/i);
  }
});

test("runnable kernels reject a malformed shared resampling-index header", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "julia-time-bootstrap-header-"));
  const malformedIndicesPath = path.join(temporaryRoot, "malformed-indices.csv");
  try {
    const rows = fs.readFileSync(indicesPath, "utf8").trimEnd().split(/\r?\n/);
    rows[0] = "draw_1,draw_2,draw_3,draw_4,draw_5,wrong_draw";
    fs.writeFileSync(malformedIndicesPath, `${rows.join("\n")}\n`, "utf8");
    for (const [command, scriptName] of [["julia", "bootstrap.jl"], ["Rscript", "bootstrap.R"]]) {
      const result = runRaw(command, [
        path.join(bootstrapRoot, scriptName),
        "--data", dataPath,
        "--indices", malformedIndicesPath,
        "--replicates", String(replicateCount)
      ]);
      assert.notEqual(result.status, 0, `${command} must reject a malformed index header`);
      assert.match(result.stderr || result.stdout, /header|draw/i);
    }
  } finally {
    fs.rmSync(temporaryRoot, {recursive:true, force:true});
  }
});

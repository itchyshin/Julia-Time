"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const modulePath = path.join(__dirname, "..", "web", "course", "speed-lab.js");
const pagePath = path.join(__dirname, "..", "web", "course", "speed-lab.html");
const BENCHMARK_ID = "bootstrap-v1";

function clientUnderTest() {
  assert.equal(fs.existsSync(modulePath), true, "the pure speed-lab client module must exist");
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function infoReply(requestId, overrides = {}) {
  return Object.assign({
    type:"benchmark_info", contract_version:1, benchmark_id:BENCHMARK_ID,
    request_id:requestId, availability:"ready", reason:null,
    message:"Parity is checked before timing any language.",
    components:{julia:{state:"ready"},r:{state:"ready"},python:{state:"ready"}},
    parity:"verified"
  }, overrides);
}

function runReply(requestId, overrides = {}) {
  return Object.assign({
    type:"benchmark_run", contract_version:1, benchmark_id:BENCHMARK_ID,
    request_id:requestId, status:"ok", parity:"verified",
    result:{
      receipt_version:1, title:"Current benchmark report",
      parity:{status:"verified", contract:"bootstrap-parity-v1", kernel:"bootstrap_detection_rate_mean", input_identity:"detections-v1/resampling-indices-v1", replicate_count:8},
      machine:{os:"fixtureOS", architecture:"fixtureArch", cpu_model:"fixtureCPU", logical_cpus:4},
      thread_settings:{kernel:"single-threaded", julia_num_threads:1, openblas_num_threads:1, omp_num_threads:1, mkl_num_threads:1, veclib_maximum_threads:1},
      language_versions:{julia:"1.fixture", "r-base":"R fixture", "python-numpy":"Python fixture; NumPy fixture"},
      workloads:[
        {iterations:1000, warmup_repetitions:1, timed_repetitions:5, timings_seconds:{julia:{min:0.001,median:0.002,max:0.003},"r-base":{min:0.002,median:0.003,max:0.004},"python-numpy":{min:0.001,median:0.002,max:0.004}}},
        {iterations:10000, warmup_repetitions:1, timed_repetitions:5, timings_seconds:{julia:{min:0.01,median:0.02,max:0.03},"r-base":{min:0.02,median:0.03,max:0.04},"python-numpy":{min:0.01,median:0.02,max:0.04}}}
      ]
    }
  }, overrides);
}

test("speed-lab requests are fixed bootstrap envelopes without executable client input", () => {
  const client = clientUnderTest();
  assert.equal(client.validRequestId(""), false);
  assert.equal(client.validRequestId("speed-1"), true);
  assert.deepEqual(client.benchmarkInfoRequest("speed-info"), {
    type:"benchmark_info", contract_version:1, benchmark_id:BENCHMARK_ID, request_id:"speed-info"
  });
  const run = client.benchmarkRunRequest("speed-run");
  assert.deepEqual(run, {
    type:"benchmark_run", contract_version:1, benchmark_id:BENCHMARK_ID, request_id:"speed-run"
  });
  for (const forbidden of ["code", "path", "command", "shell", "language", "workload"]) {
    assert.equal(Object.hasOwn(run, forbidden), false, "run request must not contain " + forbidden);
  }
});

test("only a current exact info reply enables the optional comparison", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginInfo(state, "speed-old").state;
  state = client.beginInfo(state, "speed-current").state;

  assert.equal(state.phase, "loading");
  assert.equal(state.result, null);
  assert.equal(client.receiveInfoReply(state, infoReply("speed-old")), state);
  assert.equal(client.receiveInfoReply(state, infoReply("speed-current", {benchmark_id:"other"})), state);
  assert.equal(client.receiveInfoReply(state, infoReply("speed-current", {availability:"ready", extra:true})), state);

  state = client.receiveInfoReply(state, infoReply("speed-current"));
  assert.equal(state.phase, "ready");
  assert.equal(state.pending, null);
  assert.equal(client.canRunBenchmark(state), true);
  assert.equal(client.viewModel(state).result, null);
});

test("missing NumPy is visibly an optional-comparison state, never a result or a story failure", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginInfo(state, "numpy-info").state;
  state = client.receiveInfoReply(state, infoReply("numpy-info", {
    availability:"unavailable", reason:"NUMPY_MISSING",
    message:"NumPy is not available in this Python installation.", parity:"not_run"
  }));

  assert.equal(state.phase, "unavailable");
  assert.equal(state.result, null);
  assert.equal(client.canRunBenchmark(state), false);
  assert.match(client.viewModel(state).message, /optional comparison unavailable/i);
  assert.match(client.viewModel(state).message, /NumPy/i);
});

test("stale or malformed run replies cannot show a benchmark report", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginInfo(state, "speed-info").state;
  state = client.receiveInfoReply(state, infoReply("speed-info"));
  const started = client.beginBenchmarkRun(state, "speed-run");
  state = started.state;
  assert.deepEqual(started.message, client.benchmarkRunRequest("speed-run"));
  assert.equal(state.phase, "running");
  assert.equal(client.viewModel(state).result, null);

  assert.equal(client.receiveRunReply(state, runReply("old-run")), state);
  assert.equal(client.receiveRunReply(state, runReply("speed-run", {status:"ok", result:{title:42}})), state);
  assert.equal(client.viewModel(state).result, null);

  state = client.receiveRunReply(state, runReply("speed-run"));
  assert.equal(state.phase, "complete");
  assert.equal(client.viewModel(state).result.title, "Current benchmark report");
  assert.equal(client.viewModel(state).result.machine.cpu_model, "fixtureCPU");
  assert.equal(client.viewModel(state).result.workloads[1].timings_seconds["r-base"].median, 0.03);
  assert.equal(client.viewModel(state).result.thread_settings.julia_num_threads, 1);
});

test("an incomplete or dishonest timing receipt cannot reach the page", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginInfo(state, "speed-info").state;
  state = client.receiveInfoReply(state, infoReply("speed-info"));
  state = client.beginBenchmarkRun(state, "speed-run").state;
  assert.equal(client.receiveRunReply(state, runReply("speed-run", {result:Object.assign({}, runReply("speed-run").result, {workloads:[]})})), state);
  assert.equal(client.receiveRunReply(state, runReply("speed-run", {result:Object.assign({}, runReply("speed-run").result, {thread_settings:Object.assign({}, runReply("speed-run").result.thread_settings, {julia_num_threads:2})})})), state);
});

test("a current unavailable benchmark reply settles the page without inventing a report", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginInfo(state, "speed-info").state;
  state = client.receiveInfoReply(state, infoReply("speed-info"));
  state = client.beginBenchmarkRun(state, "speed-unavailable").state;
  state = client.receiveRunReply(state, {
    type:"benchmark_run", contract_version:1, benchmark_id:BENCHMARK_ID,
    request_id:"speed-unavailable", status:"unavailable", parity:"verified",
    reason:"MEASUREMENT_RECEIPT_FAILED", message:"The optional comparison did not produce a receipt."
  });
  assert.equal(state.phase, "unavailable");
  assert.equal(state.result, null);
  assert.match(client.viewModel(state).message, /optional comparison unavailable/i);
});

test("an expired reply settles the optional laboratory, while an unattributed error cannot cancel a current request", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginInfo(state, "speed-info").state;
  assert.equal(typeof client.receiveError, "undefined");
  assert.equal(state.phase, "loading");
  assert.equal(state.pending.request_id, "speed-info");

  state = client.beginInfo(client.connect(client.createState()), "speed-timeout").state;
  state = client.expirePending(state, "speed-timeout");
  assert.equal(state.phase, "unavailable");
  assert.equal(state.pending, null);
  assert.match(client.viewModel(state).message, /did not reply/i);
});

test("a failed local connection names the recovery step instead of leaving the optional lab connecting", () => {
  const client = clientUnderTest();
  const state = client.connectionFailed(client.createState());

  assert.equal(state.connection, "disconnected");
  assert.equal(state.phase, "not_checked");
  assert.match(client.viewModel(state).message, /not running/i);
  assert.match(client.viewModel(state).message, /run\.jl/i);
});

test("speed-lab page teaches parity before timing and uses native accessible controls without a winner", () => {
  assert.equal(fs.existsSync(pagePath), true, "the optional speed-lab page must exist");
  const html = fs.readFileSync(pagePath, "utf8");
  assert.match(html, /parity.*before.*timing/i);
  assert.match(html, /after you finish the mystery/i);
  assert.match(html, /bootstrap.*resampl/i);
  assert.match(html, /Julia.*R.*Python/i);
  assert.match(html, /same answer to the same supplied bootstrap calculation/i);
  assert.match(html, /What this page is for/i);
  assert.match(html, /same bootstrap runs in three languages/i);
  assert.match(html, /Step 1: confirm the answers agree/i);
  assert.match(html, /Step 2: time those matching calculations/i);
  assert.match(html, /You do not need to do this to learn Julia or finish the case/i);
  assert.match(html, /Leave the Julia Time terminal running/i);
  assert.match(html, /optional/i);
  assert.match(html, /30-second total limit/i);
  assert.match(html, /id="speed-status"[^>]*aria-live="polite"/);
  assert.match(html, /<button id="check-speed-lab" type="button">/);
  assert.match(html, /<button id="run-speed-lab" type="button" disabled>/);
  assert.match(html, /JuliaTimeSpeedLab/);
  assert.match(html, /beginInfo\(/);
  assert.match(html, /beginBenchmarkRun\(/);
  assert.match(html, /INFO_REPLY_TIMEOUT_MS = 60000/);
  assert.match(html, /RUN_REPLY_TIMEOUT_MS = 150000/);
  assert.match(html, /CONNECT_TIMEOUT_MS = 5000/);
  assert.match(html, /connectionFailed\(/);
  assert.match(html, /expirePending\(/);
  assert.match(html, /speedReport\.hidden = !model\.result/);
  assert.doesNotMatch(html, /winner|Julia wins|faster than/i);
});

test("an unsupported browser gets a visible optional-lab recovery instead of inert controls", () => {
  const html = fs.readFileSync(pagePath, "utf8");
  assert.match(html, /current browser[^.]*WebSocket/i);
  assert.match(html, /mystery is still playable/i);
  assert.match(html, /check\.disabled\s*=\s*true/);
  assert.match(html, /run\.disabled\s*=\s*true/);
});

test("pure helpers have no storage, DOM, or network dependency", () => {
  const source = fs.readFileSync(modulePath, "utf8");
  for (const forbidden of ["localStorage", "document", "WebSocket", "fetch(", "XMLHttpRequest"]) {
    assert.equal(source.includes(forbidden), false, "pure module must not use " + forbidden);
  }
});

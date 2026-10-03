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

test("a measured receipt gives a local, plain-language comparison against Julia without declaring a universal winner", () => {
  const client = clientUnderTest();
  const firstWorkload = runReply("speed-run").result.workloads[0];
  assert.equal(
    client.relativeTimingSummary(firstWorkload),
    "On this computer for 1,000 resamples: R took 1.5× Julia's median time; Python / NumPy took the same median time as Julia."
  );

  const html = fs.readFileSync(pagePath, "utf8");
  assert.match(html, /Measured on this computer, just now/);
  assert.match(html, /chartSvg/);
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

test("speed-lab page: six examples, parity before timing, own-code timer, no winner", () => {
  assert.equal(fs.existsSync(pagePath), true, "the optional speed-lab page must exist");
  const html = fs.readFileSync(pagePath, "utf8");
  assert.match(html, /after you finish the mystery/i);
  assert.match(html, /What this page is for/i);
  assert.match(html, /answers.*(agree|match).*before.*tim/i);
  assert.match(html, /You do not need to do this to learn Julia or finish the case/i);
  assert.match(html, /Leave the Julia Time terminal running/i);
  assert.match(html, /optional/i);
  assert.match(html, /Julia.*R.*Python/i);
  assert.match(html, /id="speed-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="own-code"/);
  assert.match(html, /first run \(includes compiling\)/i);
  assert.match(html, /second run/i);
  assert.match(html, /Your lines run inside a function, the way fast Julia code is written\./);
  assert.match(html, /one 5-second limit for both runs/);
  assert.match(html, /JuliaTimeSpeedLab/);
  assert.match(html, /exampleRunRequest\(/);
  assert.match(html, /ownRunRequest\(/);
  assert.match(html, /CONNECT_TIMEOUT_MS = 5000/);
  const waits = {};
  for (const m of html.matchAll(/(EXAMPLE_REPLY_TIMEOUT_MS|OWN_REPLY_TIMEOUT_MS) = (\d+)/g)) waits[m[1]] = Number(m[2]);
  assert.ok(waits.EXAMPLE_REPLY_TIMEOUT_MS >= 200000, "examples wait at least 200 s");
  assert.ok(waits.OWN_REPLY_TIMEOUT_MS >= 200000, "own code waits at least 200 s");
  assert.match(html, /Warming up Julia for the first run…/);
  assert.match(html, /<textarea id="own-code"[^>]*>[^<]*@sprintf/, "default own-code example is the measured one");
  assert.match(html, /Julia remembers what it compiled in earlier runs/);
  assert.match(html, /connectionFailed|could not connect/i);
  assert.doesNotMatch(html, /winner|Julia wins|faster than/i);
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/i, "no CDN or external script");
  assert.match(html, /name="viewport"/);
});

test("an unsupported browser gets a visible optional-lab recovery instead of inert controls", () => {
  const html = fs.readFileSync(pagePath, "utf8");
  assert.match(html, /current browser[^.]*WebSocket/i);
  assert.match(html, /mystery is still playable/i);
  assert.match(html, /disabled\s*=\s*true/);
});

test("pure helpers have no storage, DOM, or network dependency", () => {
  const source = fs.readFileSync(modulePath, "utf8");
  for (const forbidden of ["localStorage", "document", "WebSocket", "fetch(", "XMLHttpRequest"]) {
    assert.equal(source.includes(forbidden), false, "pure module must not use " + forbidden);
  }
});

// --- 0.5.2b: six fixed examples, SVG chart, time your own code ------------------------------
function exampleResult(requestId, languages) {
  return {
    type:"speed_lab_example_result", request_id:requestId, example_id:"loop-sum", title:"Add up square roots",
    label:"Measured on this computer, just now.", method:"One warm-up run, then the median of three timed runs, one language at a time.",
    machine:{os:"Darwin", architecture:"aarch64", cpu_model:"apple-m1", logical_cpus:20},
    languages:languages || {
      julia:{status:"timed", median:0.02, min:0.019, max:0.021, version:"Julia 1.10.0"},
      r:{status:"timed", median:0.6, min:0.59, max:0.62, version:"R version 4.6.0"},
      python:{status:"not_installed", message:"not installed, not timed"}
    }
  };
}

test("new requests are fixed envelopes; own code is bounded", () => {
  const client = clientUnderTest();
  assert.deepEqual(client.examplesRequest("a1"), {type:"speed_lab_examples", request_id:"a1"});
  assert.deepEqual(client.exampleRunRequest("a2", "loop-sum"), {type:"speed_lab_example_run", request_id:"a2", example_id:"loop-sum"});
  assert.equal(client.exampleRunRequest("a2", "../x"), null);
  assert.equal(client.exampleRunRequest("", "loop-sum"), null);
  assert.deepEqual(client.ownRunRequest("a3", "1+1"), {type:"speed_lab_own_run", request_id:"a3", code:"1+1"});
  assert.equal(client.ownRunRequest("a3", "   "), null);
  assert.equal(client.ownRunRequest("a3", "x".repeat(20001)), null);
  assert.equal(client.ownRunRequest("a3", 5), null);
  assert.deepEqual(client.EXAMPLE_IDS, ["loop-sum", "bootstrap-mean", "random-walk", "permutation-test", "running-stat", "group-means"]);
});

test("example results are accepted only when every language row is complete and honest", () => {
  const client = clientUnderTest();
  assert.equal(client.validExampleResult(exampleResult("r1"), "r1"), true);
  assert.equal(client.validExampleResult(exampleResult("r1"), "other"), false);
  assert.equal(client.validExampleResult(exampleResult("r1", {julia:{status:"timed", median:-1, min:0, max:1, version:"v"}, r:{status:"failed", message:"did not finish, not timed"}, python:{status:"failed", message:"did not finish, not timed"}}), "r1"), false);
  const missing = exampleResult("r1");
  delete missing.label;
  assert.equal(client.validExampleResult(missing, "r1"), false);
  const wrongLabel = exampleResult("r1");
  wrongLabel.label = "Typical result";
  assert.equal(client.validExampleResult(wrongLabel, "r1"), false);
  const answersDiffer = exampleResult("r1", {julia:{status:"timed", median:0.02, min:0.01, max:0.03, version:"v"}, r:{status:"answers_differ", message:"answers differ, not timed"}, python:{status:"not_installed", message:"not installed, not timed"}});
  assert.equal(client.validExampleResult(answersDiffer, "r1"), true);
});

test("the SVG chart is drawn only from measured medians, on a log scale, and is phone-width safe", () => {
  const client = clientUnderTest();
  const svg = client.chartSvg(exampleResult("r1").languages);
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 360 /);
  assert.match(svg, /role="img"/);
  assert.match(svg, /0\.02 s/);
  assert.match(svg, /0\.6 s/);
  assert.match(svg, /Julia/);
  assert.match(svg, /not installed, not timed/);
  assert.match(svg, /log scale/i);
  assert.doesNotMatch(svg, /Python[^<]*[0-9] s/, "no number for a language that was not timed");
  assert.doesNotMatch(svg, /<script|href=|<image/i);
  // the longer time gets the longer bar (log scale, same baseline)
  const widths = [...svg.matchAll(/data-bar="(julia|r)" [^>]*width="([0-9.]+)"/g)].reduce((o, m) => (o[m[1]] = Number(m[2]), o), {});
  assert.ok(widths.r > widths.julia && widths.julia > 0);
  assert.equal(client.chartSvg({julia:{status:"failed", message:"did not finish, not timed"}}), "");
  const evil = client.chartSvg({julia:{status:"timed", median:0.1, min:0.1, max:0.1, version:"<script>"}, r:{status:"not_installed", message:"<b>x</b>"}});
  assert.doesNotMatch(evil, /<script|<b>/);
});

test("seconds are written plainly and the comparison sentence is local, not universal", () => {
  const client = clientUnderTest();
  assert.equal(client.formatSeconds(0.0197), "0.0197 s");
  assert.equal(client.formatSeconds(1.234567), "1.23 s");
  assert.equal(client.formatSeconds(0.000642), "0.000642 s");
  assert.equal(client.formatSeconds(12.3456), "12.3 s");
  assert.equal(client.formatSeconds(NaN), "");
  assert.equal(
    client.comparisonSentence(exampleResult("r1").languages),
    "On this computer, R took 30× Julia's median time here."
  );
  assert.equal(client.comparisonSentence({julia:{status:"timed", median:0.1, min:0.1, max:0.1, version:"v"}}), "");
});

test("own-code results need both runs measured, or a plain stop after the first", () => {
  const client = clientUnderTest();
  const ok = {type:"speed_lab_own_result", request_id:"o1", status:"ok", label:"Measured on this computer, just now.", first:{status:"ok", seconds:0.8}, second:{status:"ok", seconds:0.1}, explanation:"Julia compiles code the first time it runs, so the first run includes that compiling time and the second run, reusing it, is faster."};
  assert.equal(client.validOwnResult(ok, "o1"), true);
  assert.equal(client.validOwnResult(ok, "o2"), false);
  const stopped = {type:"speed_lab_own_result", request_id:"o1", status:"error", label:ok.label, first:{status:"error", message:"UndefVarError: y not defined"}, second:null, explanation:null};
  assert.equal(client.validOwnResult(stopped, "o1"), true);
  assert.equal(client.validOwnResult(Object.assign({}, ok, {second:null}), "o1"), false);
  assert.equal(client.validOwnResult(Object.assign({}, ok, {first:{status:"ok", seconds:"fast"}}), "o1"), false);
});

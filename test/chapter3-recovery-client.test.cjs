"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter3.js");

test("C3 makes a missing current case file recoverable", () => {
  const waiting = client.beginInfo(client.createState(), "c3-info-now", "join-report-log");
  const recovered = client.failCaseInfo(waiting, {type:"error", message:"Unknown mystery chapter."});
  assert.equal(recovered.infoRequest, null);
  assert.match(recovered.metadataFailure, /does not recognise this chapter/i);
  assert.equal(client.INFO_DEADLINE_MS, 5000);
});

test("C3 expires only its current case run and keeps prior evidence", () => {
  const waiting = client.beginRun(Object.assign(client.createState(), {evidence:{move_id:"join-report-log"}}), "c3-run-now", "join-report-log");
  assert.equal(client.expireRun(waiting, "c3-run-old"), waiting);
  const recovered = client.expireRun(waiting, "c3-run-now");
  // `pending` is kept (not nulled) so a correct result arriving late for this same request is
  // still applied rather than discarded (B1); `isRunPending` is what makes the run retryable.
  assert.equal(recovered.pending.request_id, "c3-run-now");
  assert.equal(recovered.expired, true);
  assert.equal(client.isRunPending(recovered), false);
  assert.deepEqual(recovered.evidence, {move_id:"join-report-log"});
  assert.equal(recovered.result.status, "timeout");
  assert.match(recovered.result.message, /draft is still here/i);
  assert.equal(client.RUN_DEADLINE_MS, 7000);
});

test("C3 (B1) applies a correct result that arrives after the client's own deadline", () => {
  const waiting = client.beginRun(client.createState(), "c3-run-now", "join-report-log");
  const expired = client.expireRun(waiting, "c3-run-now");
  const late = client.applyCaseResult(expired, {
    type: "case_result", contract_version: 1, case_id: "missing-fleas-v1", chapter: "C3",
    move_id: "join-report-log", mode: "challenge", activity_id: null, simulation_id: null,
    request_id: "c3-run-now", status: "ok", pass: true, progress_eligible: true,
    columns: ["tray_id", "reported_detected_n", "logged_detected_n", "log_status"],
    rows: [{tray_id: "T-A", reported_detected_n: 1, logged_detected_n: 1, log_status: "ok"}],
  });
  assert.notEqual(late, expired);
  assert.equal(late.result.pass, true);
  assert.equal(late.pending, null);
});

test("C3 (B1) discards a result for a request superseded by a new run", () => {
  const waiting = client.beginRun(client.createState(), "c3-run-now", "join-report-log");
  const expired = client.expireRun(waiting, "c3-run-now");
  const restarted = client.beginRun(expired, "c3-run-again", "join-report-log");
  const stale = client.applyCaseResult(restarted, {
    type: "case_result", contract_version: 1, case_id: "missing-fleas-v1", chapter: "C3",
    move_id: "join-report-log", mode: "challenge", activity_id: null, simulation_id: null,
    request_id: "c3-run-now", status: "ok", pass: true, progress_eligible: true,
  });
  assert.equal(stale, restarted);
});

test("C3 (B1/B2) a restarting status extends the wait and running clears it", () => {
  const waiting = client.beginRun(client.createState(), "c3-run-now", "join-report-log");
  const restarting = client.applyRunStatus(waiting, {type:"status", request_id:"c3-run-now", status:"restarting", message:"Restarting Julia after the stopped run…"});
  assert.match(restarting.statusMessage, /Restarting Julia/);
  const running = client.applyRunStatus(restarting, {type:"status", request_id:"c3-run-now", status:"running"});
  assert.equal(running.statusMessage, "");
  const expired = client.expireRun(waiting, "c3-run-now");
  assert.equal(client.applyRunStatus(expired, {type:"status", request_id:"c3-run-now", status:"restarting"}), expired);
});

test("C3 demo (B1/B2) a restarting status extends the wait and running clears it, independent of the challenge track", () => {
  const waiting = client.beginDemoRun(Object.assign(client.createState(), {demoMetadata:{inputs:[]}}), "c3-practice-run-now");
  const restarting = client.applyDemoRunStatus(waiting, {type:"status", request_id:"c3-practice-run-now", status:"restarting", message:"Restarting Julia after the stopped run…"});
  assert.match(restarting.demoStatusMessage, /Restarting Julia/);
  const running = client.applyDemoRunStatus(restarting, {type:"status", request_id:"c3-practice-run-now", status:"running"});
  assert.equal(running.demoStatusMessage, "");
  // A demo-track status must not disturb the (absent) challenge track, and vice versa.
  assert.equal(client.applyRunStatus(waiting, {type:"status", request_id:"c3-practice-run-now", status:"restarting"}), waiting);
});

test("C3 expires a lost practice-table request without changing the case", () => {
  const waiting = client.beginDemoInfo(client.createState(), "c3-practice-info-now");
  assert.equal(client.expireDemoInfo(waiting, "c3-practice-info-old"), waiting);
  const recovered = client.expireDemoInfo(waiting, "c3-practice-info-now");
  assert.equal(recovered.demoInfoRequest, null);
  assert.equal(recovered.demoMetadata, null);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.demoResult.status, "timeout");
  assert.match(recovered.demoResult.message, /practice tables.*took too long/i);
});

test("C3 expires a lost practice run, keeps its identity for a late reply, but still discards a malformed one", () => {
  const metadata = {inputs:[]};
  const waiting = client.beginDemoRun(Object.assign(client.createState(), {demoMetadata:metadata}), "c3-practice-run-now");
  const recovered = client.expireDemoRun(waiting, "c3-practice-run-now");
  // `demoPending` is kept (not nulled) so a correct result arriving late for this same request
  // is still applied rather than discarded (B1); `isDemoRunPending` makes it retryable.
  assert.equal(recovered.demoPending.request_id, "c3-practice-run-now");
  assert.equal(recovered.demoExpired, true);
  assert.equal(client.isDemoRunPending(recovered), false);
  assert.equal(recovered.demoMetadata, metadata);
  assert.equal(recovered.demoResult.status, "timeout");
  assert.match(recovered.demoResult.message, /practice run took too long/i);
  // A reply missing the rest of the run's identity (case_id, chapter, move_id, mode,
  // activity_id, simulation_id) is still discarded even though the request_id matches.
  assert.equal(client.applyDemoResult(recovered, {type:"case_result", request_id:"c3-practice-run-now"}), recovered);
});

test("C3 (B1) a late but correctly-identified demo result is still applied after expiry", () => {
  const metadata = {inputs:[]};
  const waiting = client.beginDemoRun(Object.assign(client.createState(), {demoMetadata:metadata}), "c3-practice-run-now");
  const expired = client.expireDemoRun(waiting, "c3-practice-run-now");
  const late = client.applyDemoResult(expired, {
    type: "case_result", contract_version: 1, case_id: "missing-fleas-v1", chapter: "C3",
    move_id: "join-report-log", mode: "demonstration", activity_id: "practice-join-v1", simulation_id: null,
    request_id: "c3-practice-run-now", status: "ok", pass: null, practice_pass: true,
  });
  assert.notEqual(late, expired);
  assert.equal(late.demoResult.practice_pass, true);
  assert.equal(late.demoPending, null);
});

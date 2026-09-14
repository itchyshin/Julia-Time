"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter2.js");

test("C2 expires only the current stalled run and restores a retryable timeout result", () => {
  const waiting = client.beginRun(client.createState(), "c2-run-now", "rates");
  assert.equal(client.expireRun(waiting, "c2-run-old"), waiting);

  const recovered = client.expireRun(waiting, "c2-run-now");
  // The request id is kept (not nulled) so a late-arriving correct result is still applied (B1);
  // `isRunPending` is what makes the run retryable.
  assert.equal(recovered.outstandingRequestId, "c2-run-now");
  assert.equal(recovered.expired, true);
  assert.equal(client.isRunPending(recovered), false);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.result.status, "timeout");
  assert.equal(recovered.result.request_id, "c2-run-now");
  assert.match(recovered.result.feedback, /code is still here/i);
  assert.match(recovered.result.feedback, /run again/i);
});

test("C2 declares its learner-visible seven-second run deadline", () => {
  assert.equal(client.RUN_DEADLINE_MS, 7000);
});

test("C2 (B1) applies a correct result that arrives after the client's own deadline", () => {
  const waiting = client.beginRun(client.createState(), "c2-run-now", "rates");
  const expired = client.expireRun(waiting, "c2-run-now");
  const late = client.applyCaseResult(expired, {
    type: "case_result", chapter: "C2", step: "rates", request_id: "c2-run-now", status: "ok", pass: true,
    rows: [{ tray_id: "T-A", n: 2, detected_n: 1, rate: 0.5 }], columns: ["tray_id", "n", "detected_n", "rate"],
  });
  assert.notEqual(late, expired);
  assert.equal(late.result.pass, true);
  assert.notEqual(late.evidence, null);
  assert.equal(late.outstandingRequestId, null);
});

test("C2 (B1) discards a result for a request superseded by a new run", () => {
  const waiting = client.beginRun(client.createState(), "c2-run-now", "rates");
  const expired = client.expireRun(waiting, "c2-run-now");
  const restarted = client.beginRun(expired, "c2-run-again", "rates");
  const stale = client.applyCaseResult(restarted, {
    type: "case_result", chapter: "C2", step: "rates", request_id: "c2-run-now", status: "ok", pass: true,
    rows: [{ tray_id: "T-A", n: 2, detected_n: 1, rate: 0.5 }], columns: ["tray_id", "n", "detected_n", "rate"],
  });
  assert.equal(stale, restarted);
});

test("C2 (B1/B2) a restarting status extends the wait and running clears it", () => {
  const waiting = client.beginRun(client.createState(), "c2-run-now", "rates");
  const restarting = client.applyRunStatus(waiting, { type: "status", request_id: "c2-run-now", status: "restarting", message: "Restarting Julia after the stopped run…" });
  assert.match(restarting.statusMessage, /Restarting Julia/);
  const running = client.applyRunStatus(restarting, { type: "status", request_id: "c2-run-now", status: "running" });
  assert.equal(running.statusMessage, "");
  const expired = client.expireRun(waiting, "c2-run-now");
  assert.equal(client.applyRunStatus(expired, { type: "status", request_id: "c2-run-now", status: "restarting" }), expired);
});

test("C2 turns an unavailable current case file into a restart path", () => {
  const waiting = client.beginInfo(client.createState(), "c2-info-now");
  const recovered = client.failCaseInfo(waiting, {type:"error", message:"Unknown mystery chapter."});
  assert.equal(recovered.infoRequestId, null);
  assert.match(recovered.metadataFailure, /does not recognise this chapter/i);
  assert.equal(client.INFO_DEADLINE_MS, 5000);
});

test("C2 ignores a late or mismatched case file after metadata recovery", () => {
  const waiting = client.beginInfo(client.createState(), "c2-info-now");
  assert.equal(client.isCurrentCaseInfo(waiting, {type:"case", chapter:"C2", request_id:"c2-info-old"}), false);
  assert.equal(client.isCurrentCaseInfo(waiting, {type:"case", chapter:"C2", request_id:"c2-info-now"}), true);
  const recovered = client.expireInfo(waiting, "c2-info-now");
  assert.equal(client.isCurrentCaseInfo(recovered, {type:"case", chapter:"C2", request_id:"c2-info-now"}), false);
});

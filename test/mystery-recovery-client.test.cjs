"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/mystery.js");

test("C1 makes a current stalled run retryable without adding evidence", () => {
  const waiting = client.beginRun(client.createState(), "c1-run-now");
  assert.equal(client.expireRun(waiting, "c1-run-old"), waiting);
  const recovered = client.expireRun(waiting, "c1-run-now");
  // The request id is kept, not nulled (B1): a correct result that arrives late for this same
  // id must still be applied. `isRunPending` is what actually makes the run retryable.
  assert.equal(recovered.outstandingRequestId, "c1-run-now");
  assert.equal(recovered.expired, true);
  assert.equal(client.isRunPending(recovered), false);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.result.status, "timeout");
  assert.match(recovered.result.feedback, /code is still here/i);
  assert.equal(client.RUN_DEADLINE_MS, 7000);
});

test("C1 (B1) applies a correct result that arrives after the client's own deadline", () => {
  const waiting = client.beginRun(client.createState(), "c1-run-now");
  const expired = client.expireRun(waiting, "c1-run-now");
  const late = client.applyCaseResult(expired, {
    type: "case_result", chapter: "C1", request_id: "c1-run-now", status: "ok", pass: true,
    evidence: { id: "c1-b09-records", title: "B09 report records recovered" },
  });
  assert.notEqual(late, expired);
  assert.equal(late.result.pass, true);
  assert.equal(late.evidence.id, "c1-b09-records");
  assert.equal(late.outstandingRequestId, null);
});

test("C1 (B1) discards a result for a request superseded by a new run", () => {
  const waiting = client.beginRun(client.createState(), "c1-run-now");
  const expired = client.expireRun(waiting, "c1-run-now");
  const restarted = client.beginRun(expired, "c1-run-again");
  const stale = client.applyCaseResult(restarted, {
    type: "case_result", chapter: "C1", request_id: "c1-run-now", status: "ok", pass: true,
    evidence: { id: "stale", title: "Should never appear" },
  });
  assert.equal(stale, restarted);
  assert.equal(stale.outstandingRequestId, "c1-run-again");
});

test("C1 (B1/B2) a restarting status extends the wait and running clears it", () => {
  const waiting = client.beginRun(client.createState(), "c1-run-now");
  const restarting = client.applyRunStatus(waiting, {
    type: "status", request_id: "c1-run-now", status: "restarting", message: "Restarting Julia after the stopped run…",
  });
  assert.notEqual(restarting, waiting);
  assert.match(restarting.statusMessage, /Restarting Julia/);

  const running = client.applyRunStatus(restarting, { type: "status", request_id: "c1-run-now", status: "running" });
  assert.equal(running.statusMessage, "");

  // A status for a request that is not the pending one, or that arrives after expiry, changes nothing.
  assert.equal(client.applyRunStatus(waiting, { type: "status", request_id: "someone-else", status: "restarting" }), waiting);
  const expired = client.expireRun(waiting, "c1-run-now");
  assert.equal(client.applyRunStatus(expired, { type: "status", request_id: "c1-run-now", status: "restarting" }), expired);
});

test("C1 turns an unavailable current case file into restart guidance", () => {
  const waiting = client.beginInfo(client.createState(), "c1-info-now");
  const recovered = client.failCaseInfo(waiting, {type:"error", message:"Unknown mystery chapter."});
  assert.equal(recovered.infoRequestId, null);
  assert.match(recovered.metadataFailure, /does not recognise this chapter/i);
  assert.equal(client.INFO_DEADLINE_MS, 5000);
});

test("C1 ignores a late or mismatched case file after metadata recovery", () => {
  const waiting = client.beginInfo(client.createState(), "c1-info-now");
  assert.equal(client.isCurrentCaseInfo(waiting, {type:"case", request_id:"c1-info-old"}), false);
  assert.equal(client.isCurrentCaseInfo(waiting, {type:"case", request_id:"c1-info-now"}), true);
  const recovered = client.expireInfo(waiting, "c1-info-now");
  assert.equal(client.isCurrentCaseInfo(recovered, {type:"case", request_id:"c1-info-now"}), false);
});

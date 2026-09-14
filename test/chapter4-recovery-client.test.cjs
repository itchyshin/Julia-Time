"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter4.js");

const MOVE = "plan-distinct-recheck";

test("C4 makes a missing supplied eligible list recoverable", () => {
  const waiting = client.beginInfo(client.createState(), "c4-info-now", MOVE);
  const recovered = client.expireInfo(waiting, "c4-info-now");
  assert.equal(recovered.infoRequest, null);
  assert.match(recovered.metadataFailure, /draft is still here/i);
  assert.equal(client.INFO_DEADLINE_MS, 5000);
});

test("C4 expires only its active one-move recheck run without creating evidence", () => {
  const waiting = client.beginRun(Object.assign(client.createState(), {evidence:{move_id:MOVE}}), "c4-run-now", MOVE);
  assert.equal(client.expireRun(waiting, "c4-run-old"), waiting);
  const recovered = client.expireRun(waiting, "c4-run-now");
  // `pending` is kept (not nulled) so a correct result arriving late is still applied (B1);
  // `isRunPending` is what makes the run retryable.
  assert.equal(recovered.pending.request_id, "c4-run-now");
  assert.equal(recovered.expired, true);
  assert.equal(client.isRunPending(recovered), false);
  assert.deepEqual(recovered.evidence, {move_id:MOVE});
  assert.equal(recovered.result.status, "timeout");
  assert.equal(client.RUN_DEADLINE_MS, 7000);
});

function c4CaseResult(requestId, overrides) {
  return Object.assign({
    type: "case_result", contract_version: 1, case_id: "missing-fleas-v1", chapter: "C4",
    move_id: MOVE, mode: "challenge", activity_id: null, simulation_id: null, request_id: requestId,
    status: "ok", pass: true, progress_eligible: true, columns: ["jar_id"],
    rows: [{jar_id: "P-11"}, {jar_id: "P-12"}, {jar_id: "P-13"}],
  }, overrides || {});
}

test("C4 (B1) applies a correct result that arrives after the client's own deadline", () => {
  const waiting = client.beginRun(client.createState(), "c4-run-now", MOVE);
  const expired = client.expireRun(waiting, "c4-run-now");
  const late = client.applyCaseResult(expired, c4CaseResult("c4-run-now"));
  assert.notEqual(late, expired);
  assert.equal(late.result.pass, true);
  assert.notEqual(late.evidence, null);
  assert.equal(late.pending, null);
});

test("C4 (B1) discards a result for a request superseded by a new run", () => {
  const waiting = client.beginRun(client.createState(), "c4-run-now", MOVE);
  const expired = client.expireRun(waiting, "c4-run-now");
  const restarted = client.beginRun(expired, "c4-run-again", MOVE);
  const stale = client.applyCaseResult(restarted, c4CaseResult("c4-run-now"));
  assert.equal(stale, restarted);
});

test("C4 (B1/B2) a restarting status extends the wait and running clears it", () => {
  const waiting = client.beginRun(client.createState(), "c4-run-now", MOVE);
  const restarting = client.applyRunStatus(waiting, {type:"status", request_id:"c4-run-now", status:"restarting", message:"Restarting Julia after the stopped run…"});
  assert.match(restarting.statusMessage, /Restarting Julia/);
  const running = client.applyRunStatus(restarting, {type:"status", request_id:"c4-run-now", status:"running"});
  assert.equal(running.statusMessage, "");
  const expired = client.expireRun(waiting, "c4-run-now");
  assert.equal(client.applyRunStatus(expired, {type:"status", request_id:"c4-run-now", status:"restarting"}), expired);
});

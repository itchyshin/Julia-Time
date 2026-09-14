"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter6.js");

test("C6 converts an unrecognised metadata failure into restart guidance", () => {
  const waiting = client.beginInfo(client.createState(), "c6-info-now");
  const recovered = client.failCaseInfo(waiting, {type:"error", message:"Unknown mystery chapter."});
  assert.equal(recovered.infoRequest, null);
  assert.equal(recovered.metadata, null);
  assert.match(recovered.metadataFailure, /does not recognise this chapter/i);
  assert.equal(client.INFO_DEADLINE_MS, 5000);
});

test("C6 expires only the current run without evidence", () => {
  const waiting = client.beginRun(Object.assign(client.createState(), {metadata:{inputs:[]}}), "c6-run-now");
  assert.equal(client.expireRun(waiting, "c6-run-old"), waiting);
  const recovered = client.expireRun(waiting, "c6-run-now");
  // `pending` is kept (not nulled) so a correct result arriving late for this same request is
  // still applied rather than discarded (B1); `isRunPending` is what makes the run retryable.
  assert.equal(recovered.pending.request_id, "c6-run-now");
  assert.equal(recovered.expired, true);
  assert.equal(client.isRunPending(recovered), false);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.runFailure.status, "timeout");
  assert.equal(client.RUN_DEADLINE_MS, 7000);
});

function c6CaseResult(pending, overrides) {
  return Object.assign({
    type: "case_result", contract_version: 1, case_id: pending.case_id, chapter: pending.chapter,
    move_id: pending.move_id, mode: pending.mode, activity_id: pending.activity_id,
    simulation_id: pending.simulation_id, request_id: pending.request_id,
    status: "ok", pass: true, progress_eligible: true,
    result_data: {kind:"table", columns:["model", "p", "lower", "upper"], rows:[]},
  }, overrides || {});
}

test("C6 (B1) applies a correct result that arrives after the client's own deadline", () => {
  const waiting = client.beginRun(Object.assign(client.createState(), {metadata:{inputs:[]}}), "c6-run-now");
  const expired = client.expireRun(waiting, "c6-run-now");
  const late = client.applyCaseResult(expired, c6CaseResult(expired.pending));
  assert.notEqual(late, expired);
  assert.equal(late.result.pass, true);
  assert.equal(late.pending, null);
});

test("C6 (B1) discards a result for a request superseded by a new run", () => {
  const waiting = client.beginRun(Object.assign(client.createState(), {metadata:{inputs:[]}}), "c6-run-now");
  const expired = client.expireRun(waiting, "c6-run-now");
  const restarted = client.beginRun(expired, "c6-run-again");
  const stale = client.applyCaseResult(restarted, c6CaseResult(expired.pending));
  assert.equal(stale, restarted);
});

test("C6 (B1/B2) a restarting status extends the wait and running clears it", () => {
  const waiting = client.beginRun(Object.assign(client.createState(), {metadata:{inputs:[]}}), "c6-run-now");
  const restarting = client.applyRunStatus(waiting, {type:"status", request_id:"c6-run-now", status:"restarting", message:"Restarting Julia after the stopped run…"});
  assert.match(restarting.statusMessage, /Restarting Julia/);
  const running = client.applyRunStatus(restarting, {type:"status", request_id:"c6-run-now", status:"running"});
  assert.equal(running.statusMessage, "");
  const expired = client.expireRun(waiting, "c6-run-now");
  assert.equal(client.applyRunStatus(expired, {type:"status", request_id:"c6-run-now", status:"restarting"}), expired);
});

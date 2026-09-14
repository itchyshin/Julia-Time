"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter5.js");

test("C5 turns an unrecognised current metadata reply into restart guidance, not an endless load", () => {
  const waiting = client.beginInfo(client.createState(), "c5-info-now", "event-mask");
  const recovered = client.failCaseInfo(waiting, {type:"error", message:"Unknown mystery chapter."});

  assert.equal(recovered.infoRequest, null);
  assert.equal(recovered.metadata, null);
  assert.equal(recovered.pending, null);
  assert.match(recovered.metadataFailure, /does not recognise this chapter/i);
  assert.match(recovered.metadataFailure, /restart Julia Time/i);
});

test("C5 only expires the current metadata request and never creates evidence", () => {
  const waiting = client.beginInfo(client.createState(), "c5-info-now", "event-mask");
  assert.equal(client.expireInfo(waiting, "c5-info-old"), waiting);

  const recovered = client.expireInfo(waiting, "c5-info-now");
  assert.equal(recovered.infoRequest, null);
  assert.equal(recovered.evidence, null);
  assert.match(recovered.metadataFailure, /took too long/i);
  assert.equal(client.INFO_DEADLINE_MS, 5000);
  assert.equal(client.RUN_DEADLINE_MS, 7000);
});

test("C5 expires only its current code run and preserves prior evidence", () => {
  const metadata = {
    simulation_id:"opaque-server-simulation-42", n_jars:6, p_ref:0.5,
    observed_count:3, n_trials:1,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:[{simulation:1, count:3}]}]
  };
  const waiting = client.beginRun(Object.assign(client.createState(), {metadata, evidence:{move_id:"event-mask"}}), "c5-run-now", "event-mask");
  assert.equal(client.expireRun(waiting, "c5-run-old"), waiting);

  const recovered = client.expireRun(waiting, "c5-run-now");
  // `pending` is kept (not nulled) so a correct result arriving late for this same request is
  // still applied rather than discarded (B1); `isRunPending` is what makes the run retryable.
  assert.equal(recovered.pending.request_id, "c5-run-now");
  assert.equal(recovered.expired, true);
  assert.equal(client.isRunPending(recovered), false);
  assert.deepEqual(recovered.evidence, {move_id:"event-mask"});
  assert.equal(recovered.runFailure.status, "timeout");
  assert.match(recovered.runFailure.feedback, /code is still here/i);
});

function c5CaseResult(pending, overrides) {
  return Object.assign({
    type: "case_result", contract_version: 1, case_id: pending.case_id, chapter: pending.chapter,
    move_id: pending.move_id, mode: pending.mode, activity_id: pending.activity_id,
    simulation_id: pending.simulation_id, request_id: pending.request_id,
    status: "ok", pass: true, progress_eligible: true,
    result_data: {kind:"boolean-vector", length:1, true_count:1, preview:[true]},
  }, overrides || {});
}

test("C5 (B1) applies a correct result that arrives after the client's own deadline", () => {
  const metadata = {
    simulation_id:"opaque-server-simulation-42", n_jars:6, p_ref:0.5,
    observed_count:3, n_trials:1,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:[{simulation:1, count:3}]}]
  };
  const waiting = client.beginRun(Object.assign(client.createState(), {metadata}), "c5-run-now", "event-mask");
  const expired = client.expireRun(waiting, "c5-run-now");
  const late = client.applyCaseResult(expired, c5CaseResult(expired.pending));
  assert.notEqual(late, expired);
  assert.equal(late.result.pass, true);
  assert.notEqual(late.evidence, null);
  assert.equal(late.pending, null);
});

test("C5 (B1) discards a result for a request superseded by a new run", () => {
  const metadata = {
    simulation_id:"opaque-server-simulation-42", n_jars:6, p_ref:0.5,
    observed_count:3, n_trials:1,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:[{simulation:1, count:3}]}]
  };
  const waiting = client.beginRun(Object.assign(client.createState(), {metadata}), "c5-run-now", "event-mask");
  const expired = client.expireRun(waiting, "c5-run-now");
  const restarted = client.beginRun(expired, "c5-run-again", "event-mask");
  const stale = client.applyCaseResult(restarted, c5CaseResult(expired.pending));
  assert.equal(stale, restarted);
});

test("C5 (B1/B2) a restarting status extends the wait and running clears it", () => {
  const metadata = {
    simulation_id:"opaque-server-simulation-42", n_jars:6, p_ref:0.5,
    observed_count:3, n_trials:1,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:[{simulation:1, count:3}]}]
  };
  const waiting = client.beginRun(Object.assign(client.createState(), {metadata}), "c5-run-now", "event-mask");
  const restarting = client.applyRunStatus(waiting, {type:"status", request_id:"c5-run-now", status:"restarting", message:"Restarting Julia after the stopped run…"});
  assert.match(restarting.statusMessage, /Restarting Julia/);
  const running = client.applyRunStatus(restarting, {type:"status", request_id:"c5-run-now", status:"running"});
  assert.equal(running.statusMessage, "");
  const expired = client.expireRun(waiting, "c5-run-now");
  assert.equal(client.applyRunStatus(expired, {type:"status", request_id:"c5-run-now", status:"restarting"}), expired);
});

test("C5 expires a lost card-round action without adding case evidence", () => {
  const metadata = {
    simulation_id:"opaque-server-simulation-42", n_jars:6, p_ref:0.5,
    observed_count:5, n_trials:1,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:[{simulation:1, count:5}]}]
  };
  const waiting = client.beginAction(Object.assign(client.createState(), {metadata}), "c5-card-now", "draw-six");
  assert.equal(client.expireAction(waiting, "c5-card-old"), waiting);
  const recovered = client.expireAction(waiting, "c5-card-now");
  assert.equal(recovered.actionPending, null);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.actionFailure.status, "timeout");
  assert.match(recovered.actionFailure.message, /card activity took too long/i);
  assert.equal(client.applyActionResult(recovered, {type:"case_action_result", request_id:"c5-card-now"}), recovered);
});

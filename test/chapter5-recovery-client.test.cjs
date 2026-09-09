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
  assert.equal(recovered.pending, null);
  assert.deepEqual(recovered.evidence, {move_id:"event-mask"});
  assert.equal(recovered.runFailure.status, "timeout");
  assert.match(recovered.runFailure.feedback, /code is still here/i);
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

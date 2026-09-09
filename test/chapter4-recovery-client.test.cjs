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
  assert.equal(recovered.pending, null);
  assert.deepEqual(recovered.evidence, {move_id:MOVE});
  assert.equal(recovered.result.status, "timeout");
  assert.equal(client.RUN_DEADLINE_MS, 7000);
});

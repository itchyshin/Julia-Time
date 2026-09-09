"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter2.js");

test("C2 expires only the current stalled run and restores a retryable timeout result", () => {
  const waiting = client.beginRun(client.createState(), "c2-run-now", "rates");
  assert.equal(client.expireRun(waiting, "c2-run-old"), waiting);

  const recovered = client.expireRun(waiting, "c2-run-now");
  assert.equal(recovered.outstandingRequestId, null);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.result.status, "timeout");
  assert.equal(recovered.result.request_id, "c2-run-now");
  assert.match(recovered.result.feedback, /code is still here/i);
  assert.match(recovered.result.feedback, /run again/i);
});

test("C2 declares its learner-visible seven-second run deadline", () => {
  assert.equal(client.RUN_DEADLINE_MS, 7000);
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

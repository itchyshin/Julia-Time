"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/mystery.js");

test("C1 makes a current stalled run retryable without adding evidence", () => {
  const waiting = client.beginRun(client.createState(), "c1-run-now");
  assert.equal(client.expireRun(waiting, "c1-run-old"), waiting);
  const recovered = client.expireRun(waiting, "c1-run-now");
  assert.equal(recovered.outstandingRequestId, null);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.result.status, "timeout");
  assert.match(recovered.result.feedback, /code is still here/i);
  assert.equal(client.RUN_DEADLINE_MS, 7000);
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

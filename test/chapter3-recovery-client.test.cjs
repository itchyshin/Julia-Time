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
  assert.equal(recovered.pending, null);
  assert.deepEqual(recovered.evidence, {move_id:"join-report-log"});
  assert.equal(recovered.result.status, "timeout");
  assert.match(recovered.result.message, /draft is still here/i);
  assert.equal(client.RUN_DEADLINE_MS, 7000);
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

test("C3 expires a lost practice run and ignores its late reply", () => {
  const metadata = {inputs:[]};
  const waiting = client.beginDemoRun(Object.assign(client.createState(), {demoMetadata:metadata}), "c3-practice-run-now");
  const recovered = client.expireDemoRun(waiting, "c3-practice-run-now");
  assert.equal(recovered.demoPending, null);
  assert.equal(recovered.demoMetadata, metadata);
  assert.equal(recovered.demoResult.status, "timeout");
  assert.match(recovered.demoResult.message, /practice run took too long/i);
  assert.equal(client.applyDemoResult(recovered, {type:"case_result", request_id:"c3-practice-run-now"}), recovered);
});

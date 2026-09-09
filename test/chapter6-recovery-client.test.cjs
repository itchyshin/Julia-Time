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
  assert.equal(recovered.pending, null);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.runFailure.status, "timeout");
  assert.equal(client.RUN_DEADLINE_MS, 7000);
});

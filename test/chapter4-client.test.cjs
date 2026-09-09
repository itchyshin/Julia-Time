"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter4.js");

const CASE_ID = "missing-fleas-v1";
const MOVE = "plan-distinct-recheck";
const COLUMNS = ["jar_id"];
const ELIGIBLE_ROWS = [
  {jar_id:"J-091"}, {jar_id:"J-092"}, {jar_id:"J-094"}, {jar_id:"J-096"}
];

function eligibleInput() {
  return {id:"eligible", label:"Eligible simulated recheck candidates", columns:COLUMNS, rows:ELIGIBLE_ROWS};
}

function info(overrides = {}) {
  return Object.assign({
    type:"case", contract_version:1, case_id:CASE_ID, chapter:"C4", move_id:MOVE,
    mode:"challenge", activity_id:null, simulation_id:null, request_id:"info-1",
    inputs:[eligibleInput()]
  }, overrides);
}

function result(overrides = {}) {
  const rows = [{jar_id:"J-091"}, {jar_id:"J-094"}, {jar_id:"J-096"}];
  return Object.assign({
    type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C4", move_id:MOVE,
    mode:"challenge", activity_id:null, simulation_id:null, request_id:"run-1",
    status:"ok", pass:true, progress_eligible:true, columns:["jar_id"], rows,
    result_data:{kind:"recheck-rack", columns:["jar_id"], rows}
  }, overrides);
}

test("C4 has one evidence move: sample three visibly eligible jar IDs", () => {
  assert.deepEqual(client.activeInputIds(MOVE), ["eligible"]);
  assert.equal(client.knownMove(MOVE), true);
  assert.equal(client.knownMove("select-eligible"), false);
  assert.equal(client.lessonCopy(MOVE).solution, "sample(eligible.jar_id, 3; replace=false)");
  assert.match(client.lessonCopy(MOVE).returnSpec, /three different eligible jar IDs/i);
});

test("C4 names the eligible jar-ID list before asking learners to fill the generic sampling shape", () => {
  const copy = client.lessonCopy(MOVE);
  assert.match(copy.itemBridge, /eligible\.jar_id/);
  assert.match(copy.itemBridge, /where.*items/i);
  assert.doesNotMatch(copy.itemBridge, /sample\(eligible\.jar_id/);
});

test("C4 explains why the plan samples any three eligible jars before asking for code", () => {
  const copy = client.lessonCopy(MOVE);
  assert.match(copy.planningProtocol, /not claiming[^.]*more likely/i);
  assert.match(copy.planningProtocol, /fair and reproducible/i);
  assert.doesNotMatch(copy.planningProtocol, /sample\(eligible\.jar_id/);
});

test("C4 starts with a supplied eligible list, a separate practice rack, and an empty editor", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter4.html"), "utf8");
  assert.match(html, /id="visible-inputs"/);
  assert.match(html, /id="distinct-practice"/);
  assert.match(html, /Practice only.*does not add case evidence/i);
  assert.match(html, /<textarea id="code"[^>]*><\/textarea>/);
  assert.doesNotMatch(html, /<textarea id="code"[^>]*>\s*sample\(/);
  assert.doesNotMatch(html, /data-move=/);
});

test("C4 practice makes without-replacement tangible but cannot award case evidence", () => {
  assert.deepEqual(client.distinctPracticeResult(["P-11", "P-12", "P-13"]), {
    accepted:true,
    message:"Three different practice jar IDs selected. That is the rule replace=false expresses."
  });
  assert.equal(client.distinctPracticeResult(["P-11", "P-11", "P-13"]).accepted, false);
});

test("C4 accepts only matching one-move metadata and current result identities", () => {
  const waiting = client.beginInfo(client.createState(), "info-1", MOVE);
  assert.equal(client.applyCaseInfo(waiting, info({move_id:"select-eligible"})), waiting);
  const ready = client.applyCaseInfo(waiting, info());
  assert.equal(ready.infoRequest, null);
  assert.deepEqual(ready.metadata.inputs.map(input => input.id), ["eligible"]);

  const running = client.beginRun(ready, "run-1", MOVE);
  assert.equal(client.applyCaseResult(running, result({request_id:"old"})), running);
  const accepted = client.applyCaseResult(running, result());
  assert.equal(accepted.evidence.move_id, MOVE);
  assert.deepEqual(accepted.evidence.visual, {kind:"planned-recheck-rack", rows:result().rows});
});

test("C4's one accepted recheck rack is the route to the probability chapter", () => {
  assert.equal(client.nextDestination(MOVE, result()), "chapter5");
  assert.equal(client.nextDestination(MOVE, result({pass:false, progress_eligible:false})), null);
  assert.equal(client.nextChapterUrl("?attempt=field-7"), "chapter5.html?attempt=field-7");
});

test("C4 shows the revealed answer above the empty learner editor", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter4.html"), "utf8");
  assert.ok(html.indexOf('id="answer-before-editor"') < html.indexOf('id="code"'));
  assert.match(client.fullAnswerReference(MOVE), /does not enter your editor/i);
  assert.match(client.fullAnswerReference(MOVE), /sample\(eligible\.jar_id, 3; replace=false\)/);
});

test("C4 keeps recovery, keyboard use, and no-invented-observation wording", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter4.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../web/chapter4.css"), "utf8");
  assert.equal(client.needsRecoveryFocus({status:"timeout"}), true);
  assert.match(html, /Ctrl.*Enter/);
  assert.match(html, /no new observations/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

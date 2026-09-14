"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/course/course-client.js");

const FORBIDDEN = /\b(proven|solved|culprit)\b/i;
const MILESTONES = ["C1/select-records", "C2/rates", "C3/filter-disagreement", "C4/plan-distinct-recheck", "C5/event-frequency", "C6/compatible-models"];

test("the case file lists all six chapters as STILL UNKNOWN before any move is accepted", () => {
  const rows = client.caseFile(new Set());
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(row => row.chapter), ["C1", "C2", "C3", "C4", "C5", "C6"]);
  for (const row of rows) {
    assert.equal(row.label, "STILL UNKNOWN");
    assert.equal(row.line, "STILL UNKNOWN: " + row.fact);
    assert.doesNotMatch(row.line, FORBIDDEN);
  }
});

test("the case file marks each completed chapter ESTABLISHED with the verbatim Case-Board thread text", () => {
  const accepted = new Set();
  MILESTONES.forEach((key, index) => {
    accepted.add(key);
    const rows = client.caseFile(accepted);
    const row = rows[index];
    assert.equal(row.label, "ESTABLISHED");
    // Verbatim: the fact must equal what caseThread itself produces for this exact milestone,
    // not a rewritten paraphrase.
    const move = {chapter: row.chapter, move: key.split("/")[1]};
    assert.equal(row.fact, client.caseThread(new Set(accepted), move).established);
    for (const later of rows.slice(index + 1)) assert.equal(later.label, "STILL UNKNOWN");
  });
});

test("no case-file row uses proven, solved, or culprit language, complete or not", () => {
  const empty = client.caseFile(new Set());
  const full = client.caseFile(new Set(MILESTONES));
  for (const row of [...empty, ...full]) assert.doesNotMatch(row.line, FORBIDDEN);
});

test("C6 renders a Case file section from these six rows plus the existing recheck sentence, without forbidden words", () => {
  const c6 = require("../web/chapter6.js");
  assert.equal(typeof c6.caseFileRows, "function");
  const rows = c6.caseFileRows(MILESTONES);
  assert.equal(rows.length, 6);
  assert.ok(rows.every(row => row.label === "ESTABLISHED"));

  const source = fs.readFileSync(path.join(__dirname, "../web/chapter6.js"), "utf8");
  assert.match(source, /Case file/);
  const start = source.indexOf("function buildCaseFileSection");
  assert.ok(start >= 0, "buildCaseFileSection should exist");
  const end = source.indexOf("\n    function drawVisual", start);
  assert.doesNotMatch(source.slice(start, end), FORBIDDEN);

  // Keep the closing contract: "Case closed for today" and the one named next action.
  assert.match(source, /Case closed for today/);
  assert.match(source, /Review the Case Board/);
});

test("C6 keeps the fill-in template out of the main task body until the code-shape hint stage (S7-T1)", () => {
  const c6 = require("../web/chapter6.js");
  assert.equal(typeof c6.preEditorBridgeVisible, "function");
  assert.equal(c6.preEditorBridgeVisible(0), false, "the template must be absent from the initial task body");
  assert.equal(c6.preEditorBridgeVisible(1), false);
  assert.equal(c6.preEditorBridgeVisible(2), true, "the template appears once the code-shape hint stage is reached");
  assert.equal(c6.preEditorBridgeVisible(5), true);
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter6.js"), "utf8");
  assert.match(source, /preEditorBridgeVisible\(hint\)/);
});

test("a fresh C1 acceptance names one Case Board update fact next to the existing Next action", () => {
  const mystery = require("../web/mystery.js");
  assert.equal(typeof mystery.boardUpdateLine, "function");
  assert.equal(mystery.boardUpdateLine([]), "");
  assert.match(mystery.boardUpdateLine([{jar_id:"J-1"}]), /^Case Board updated: /);
  assert.doesNotMatch(mystery.boardUpdateLine([{jar_id:"J-1"}]), FORBIDDEN);
});

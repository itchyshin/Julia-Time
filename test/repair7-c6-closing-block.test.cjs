"use strict";

// Repair 7 (orchestrator browser check, 2026-09-26): the C6 closing block ("Case closed for today:
// a careful conclusion") was stiff and repeated the ending's own words ("do not justify", "the next
// responsible action", "a record, not a verdict", "the recheck chapter made a plan",
// "distinguish them"), and its "{models} can give 5 of 6" list had no "and" before the last item.
// docs/design/05-story-bible.md (approved v2) gives the exact plain-voice replacement (55 words,
// "Both claims checked", three lines) for this block; this test pins that content.
const test = require("node:test");
const assert = require("node:assert/strict");
const c6 = require("../web/chapter6.js");

const BANNED = [/do not justify/i, /next responsible action/i, /a record, not a verdict/i, /recheck chapter made a plan/i, /distinguish them/i];

const COLUMNS = ["story", "p", "lower", "upper"];
const ROWS = [
  {story:"Vanishing", p:0.1, lower:0, upper:2},
  {story:"Coin flip", p:0.5, lower:1, upper:5},
  {story:"Thriving", p:0.8, lower:4, upper:6}
];
function metadata() { return {type:"case", contract_version:1, case_id:"missing-fleas-v1", chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null, request_id:"c6-info", observed_count:5, n_trials:6, inputs:[{id:"stories", columns:COLUMNS, rows:ROWS}]}; }
function resultData() { return {kind:"table", columns:COLUMNS, rows:[ROWS[1], ROWS[2]]}; }

test("C6's closing block matches the bible's plain-voice rewrite, is short, and drops the stiff phrases", () => {
  const closure = c6.caseClosure(metadata(), resultData());
  assert.ok(closure, "a valid metadata and result produces a closure");
  const whole = JSON.stringify(closure);
  for (const banned of BANNED) assert.doesNotMatch(whole, banned, banned.toString());
  assert.doesNotMatch(whole, /—/, "no em dash");

  assert.equal(closure.title, "Three parts, one answer");
  assert.ok(closure.findings.length <= 4, "3 or 4 lines at most");
  assert.match(closure.findings[0], /Part 1 · Check the report.*blank box/i);
  assert.match(closure.findings[1], /Part 2 · Check the notebook.*not unusual/i);
  assert.match(closure.findings[2], /Part 3 · Test the claim.*dying out/i);
  assert.match(closure.findings[3], /Still open: the recheck/i);
});

test("C6 keeps the 'See how the case ends' link", () => {
  const source = require("fs").readFileSync(require.resolve("../web/chapter6.js"), "utf8");
  assert.match(source, /See how the case ends/);
});

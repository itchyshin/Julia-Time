"use strict";

// Repair 6 (real-browser check, 2026-09-24), final Case Board. Chapter 5 saves its accepted result
// with row_count = the number of simulations (1000), because its answer is one true-or-false value
// per simulation (event-mask), or those values plus their frequency (event-frequency). The board
// called them records: "Simulation event named — 1000 saved records." and "Simulation event
// frequency calculated — 1000 saved records." The stored data stay as they are (the course state keeps
// only the title and that count); only the words the board shows change, so they describe the result.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

// Exactly what the chapters write for an accepted move (web/mystery.js, web/chapter5.js).
const SAVED = [
  {chapter:"C1", move_id:"select-records", title:"B09 report records recovered", row_count:6, provenance:"historical-browser"},
  {chapter:"C5", move_id:"event-mask", title:"Simulation event named", row_count:1000, provenance:"historical-browser"},
  {chapter:"C5", move_id:"event-frequency", title:"Simulation event frequency calculated", row_count:1000, provenance:"historical-browser"}
];

function boardWith(saved, attempt = "") {
  const storage = memoryStorage();
  for (const item of saved) {
    courseState.recordHistoricalMoveIfMissing(storage, attempt, item.chapter, item.move_id);
    assert.equal(courseState.writeEvidenceIfMissing(storage, attempt, item), true);
  }
  return {storage, model: client.dashboardModel(client.loadCourseState(storage, attempt))};
}

test("the Case Board describes Chapter 5's saved true-or-false results, not records", () => {
  const {model} = boardWith(SAVED);
  const line = move => model.evidence.find(item => item.move_id === move).line;
  assert.equal(line("event-mask"), "Simulation event named — 1000 yes-or-no results, one per simulation. This board does not re-check saved work.");
  assert.equal(line("event-frequency"), "Simulation event frequency calculated — from 1000 yes-or-no results, one per simulation. This board does not re-check saved work.");
  for (const move of ["event-mask", "event-frequency"]) assert.doesNotMatch(line(move), /record/i);
});

test("record-based evidence keeps its record count", () => {
  const {model} = boardWith(SAVED);
  assert.equal(model.evidence.find(item => item.chapter === "C1").line, "B09 report records recovered — 6 saved records. This board does not re-check saved work.");
  const one = boardWith([Object.assign({}, SAVED[0], {row_count:1})]).model;
  assert.equal(one.evidence[0].line, "B09 report records recovered — 1 saved record. This board does not re-check saved work.");
});

test("the stored Chapter 5 evidence is unchanged by the new wording", () => {
  const {storage} = boardWith(SAVED);
  assert.deepEqual(courseState.readEvidence(storage, "").map(item => [item.move_id, item.row_count]),
    [["select-records", 6], ["event-mask", 1000], ["event-frequency", 1000]]);
});

test("the board page shows the model's evidence line and composes no record count itself", () => {
  const board = fs.readFileSync(path.join(__dirname, "../web/course/course-board.js"), "utf8");
  assert.match(board, /text\(line, item\.line\)/);
  assert.doesNotMatch(board, /saved record/);
});

test("the new Chapter 5 wording adds no em dash beyond the board's existing title separator", () => {
  const {model} = boardWith(SAVED);
  for (const item of model.evidence.filter(entry => entry.chapter === "C5")) {
    const afterTitle = item.line.slice((item.title + " — ").length);
    assert.ok(item.line.startsWith(item.title + " — "));
    assert.doesNotMatch(afterTitle, /—/);
  }
});

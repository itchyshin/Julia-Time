"use strict";

// UI-05 (2026-09-24 real-browser pass): a learner who accepts Chapter 1 and then follows each
// chapter's Next link to Chapter 6, without opening the Case Board, saw "Chapter 1: STILL UNKNOWN"
// in Chapter 6's case file. Chapter 1 saved only under its legacy key, which reaches the shared
// course record only when the Case Board page runs its importer. Chapter 2 had the same gap and
// was fixed by writing the accepted move directly (the "T3" comment in web/chapter2.js); these
// tests hold Chapter 1 to the same pattern.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");
const mystery = require("../web/mystery.js");
const chapter6 = require("../web/chapter6.js");

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    keys: () => Array.from(map.keys())
  };
}

const B09_ROWS = ["J-091", "J-092", "J-093", "J-094", "J-095", "J-096"].map(jar_id => ({jar_id, batch_id:"B09"}));
function acceptedC1() {
  return {type:"case_result", chapter:"C1", status:"ok", pass:true, rows:B09_ROWS,
    evidence:{id:"c1-b09-records", title:"B09 report records recovered"}};
}

test("an accepted C1 move reaches the shared course record without the Case Board, so C6's case file says ESTABLISHED", () => {
  const storage = memoryStorage();
  assert.equal(typeof mystery.persistAcceptedCourseState, "function");
  assert.equal(mystery.persistAcceptedCourseState(courseState, storage, "", acceptedC1()), true);

  // Chapters 2 to 6 record their own moves directly, as they already do in the browser.
  for (const [chapter, move] of [["C2", "rates"], ["C3", "filter-disagreement"], ["C4", "plan-distinct-recheck"], ["C5", "event-frequency"], ["C6", "compatible-models"]]) {
    courseState.recordHistoricalMoveIfMissing(storage, "", chapter, move);
  }

  // Chapter 6 builds its case file from the shared record as it stands; client.loadCourseState
  // (the Case Board importer) is deliberately never called here.
  const keys = courseState.acceptedMoves(courseState.readCourseState(storage, "")).map(move => move.key);
  assert.ok(keys.includes("C1/select-records"));
  const rows = chapter6.caseFileRows(keys);
  assert.equal(rows[0].chapter, "C1");
  assert.equal(rows[0].label, "ESTABLISHED");
  assert.equal(rows[0].fact, "The disputed B09 records have been identified in the supplied case table.");
});

test("the direct C1 write records the same evidence the Case Board importer would, and points the board at Chapter 2", () => {
  const storage = memoryStorage();
  mystery.persistAcceptedCourseState(courseState, storage, "", acceptedC1());
  const evidence = courseState.readEvidence(storage, "");
  assert.deepEqual(evidence, [{chapter:"C1", move_id:"select-records", title:"B09 report records recovered", row_count:6, provenance:"historical-browser"}]);
  assert.deepEqual(courseState.readCursor(storage, ""), {chapter:"C2", move_id:"group", mode:"challenge"});

  // A later Case Board visit that also finds the legacy C1 blob changes nothing and flags nothing.
  storage.setItem(mystery.EVIDENCE_KEY, JSON.stringify({evidence:acceptedC1().evidence, rows:B09_ROWS, explanation:null}));
  const view = client.loadCourseState(storage, "");
  assert.deepEqual(view.historicalChanged, []);
  assert.equal(courseState.readEvidence(storage, "").length, 1);
});

test("the direct C1 write stays inside the learner's attempt", () => {
  const storage = memoryStorage();
  mystery.persistAcceptedCourseState(courseState, storage, "attempt-b", acceptedC1());
  assert.deepEqual(courseState.acceptedMoves(courseState.readCourseState(storage, "")), []);
  assert.deepEqual(courseState.acceptedMoves(courseState.readCourseState(storage, "attempt-b")).map(move => move.key), ["C1/select-records"]);
});

test("a rejected, errored or evidence-free C1 run never marks Chapter 1 as established", () => {
  for (const message of [
    {status:"ok", pass:false, rows:B09_ROWS},
    {status:"error", pass:false, message:"UndefVarError: `$` not defined"},
    {status:"timeout", pass:false},
    {status:"ok", pass:true, rows:B09_ROWS},
    null
  ]) {
    const storage = memoryStorage();
    assert.equal(mystery.persistAcceptedCourseState(courseState, storage, "", message), false);
    assert.deepEqual(storage.keys(), []);
  }
  assert.equal(mystery.persistAcceptedCourseState(null, memoryStorage(), "", acceptedC1()), false);
});

test("Chapter 1 loads the shared course state before its own script and saves an accepted move there", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/index.html"), "utf8");
  const state = html.indexOf('<script src="course/course-state.js"></script>');
  const own = html.indexOf('<script src="mystery.js"></script>');
  assert.ok(state > -1, "index.html loads course/course-state.js");
  assert.ok(own > state, "course-state.js loads before mystery.js");
  const source = fs.readFileSync(path.join(__dirname, "../web/mystery.js"), "utf8");
  // The accepted branch of the result handler calls it right after the legacy save.
  assert.match(source, /persistEvidence\(storage, display\)[^\n]*\n\s*if \(storage\) persistAcceptedCourseState\(courseState, storage, attempt, message\);/);
  assert.match(source, /const courseState = typeof window !== "undefined" \? window\.JuliaTimeCourseState : null;/);
});

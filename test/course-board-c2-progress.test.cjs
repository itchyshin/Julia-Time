"use strict";

// S11b-G1 (2026-09-12): the panel's novice replay (docs/dev-log/reviews/2026-09-12-v02-candidate-panel-pat.md
// "Blocking findings") found that after finishing all six chapters in one browser session, the Case Board
// recommends "Continue Chapter 2" and treats Chapter 2 as untouched, because Chapter 2 (like Chapter 1) saves
// its evidence under its own legacy localStorage key rather than the shared course-state shape that Chapters
// 3-6 write directly. The board's legacy importer additionally freezes a legacy source's contribution the
// moment its underlying blob changes after a first partial import (see "changed legacy data is reported and
// does not silently fill a destination" in test/course-client.test.cjs) — exactly what happens across
// Chapter 2's three sub-moves if the board is checked between them, which the panel's own claim 1 write-up
// shows a player plausibly does (checking the board right after an accepted move).

const test = require("node:test");
const assert = require("node:assert/strict");
const courseState = require("../web/course/course-state.js");
const legacy = require("../web/course/legacy-import.js");
const client = require("../web/course/course-client.js");
const chapter2 = require("../web/chapter2.js");

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

test("Case Board recognises Chapter 2 as finished, and recommends the end-of-course action, after all six chapters are played in one browser session", () => {
  const storage = memoryStorage();
  const attempt = "";

  // C1 (mystery.js): a single evidence blob written once, in full, under its own legacy key.
  storage.setItem(legacy.c1EvidenceKey(attempt), JSON.stringify({
    evidence: {title: "Saved B09 records", id: "c1"},
    rows: [{jar_id: "J-1", batch_id: "B09"}],
    explanation: null
  }));
  // Claim 1 of the panel review: a player checks the Case Board right after an accepted move.
  client.loadCourseState(storage, attempt);

  // C2 (chapter2.js): three sub-moves, accepted one at a time through chapter2.js's real save path,
  // with a Case Board check after each move (as the panel's own methodology exercises).
  const groupResult = {status: "ok", pass: true, step: "group", rows: [{jar_id: "J-1", tray_id: "T-A"}], columns: ["jar_id", "tray_id"]};
  assert.equal(chapter2.persistAcceptedCourseState(courseState, storage, attempt, "group", groupResult), true);
  client.loadCourseState(storage, attempt);

  const countsResult = {status: "ok", pass: true, step: "counts", rows: [{tray_id: "T-A", n: 3, detected_n: 1}], columns: ["tray_id", "n", "detected_n"]};
  assert.equal(chapter2.persistAcceptedCourseState(courseState, storage, attempt, "counts", countsResult), true);
  client.loadCourseState(storage, attempt);

  const ratesResult = {status: "ok", pass: true, step: "rates", rows: [{tray_id: "T-A", n: 3, detected_n: 1, rate: 0.333}], columns: ["tray_id", "n", "detected_n", "rate"]};
  assert.equal(chapter2.persistAcceptedCourseState(courseState, storage, attempt, "rates", ratesResult), true);
  client.loadCourseState(storage, attempt);

  // C3-C6 (chapter3.js..chapter6.js): already write directly to the shared course state.
  for (const [chapter, move] of [
    ["C3", "join-report-log"], ["C3", "filter-disagreement"],
    ["C4", "plan-distinct-recheck"],
    ["C5", "event-mask"], ["C5", "event-frequency"],
    ["C6", "compatible-models"]
  ]) {
    courseState.recordHistoricalMoveIfMissing(storage, attempt, chapter, move);
    courseState.writeEvidenceIfMissing(storage, attempt, {chapter, move_id: move, title: "x", row_count: 1, provenance: "historical-browser"});
  }

  const view = client.loadCourseState(storage, attempt);
  const model = client.dashboardModel(view);

  // The recommended next move is the end-of-course action, not a demand to redo Chapter 2.
  assert.doesNotMatch(model.continue.label, /Continue Chapter 2/);
  assert.match(model.continue.label, /^Review Chapter 6/);

  // All ten known moves — including all three Chapter 2 sub-moves — are recognised as accepted.
  assert.deepEqual(
    courseState.acceptedMoves(view).map(move => move.key).sort(),
    ["C1/select-records", "C2/counts", "C2/group", "C2/rates", "C3/filter-disagreement", "C3/join-report-log",
      "C4/plan-distinct-recheck", "C5/event-frequency", "C5/event-mask", "C6/compatible-models"]
  );

  // Chapter 2's card gets the same completion treatment as its already-working siblings, not the
  // "as if never attempted" status the panel saw.
  const byChapter = Object.fromEntries(model.cards.map(card => [card.chapter, card.status]));
  assert.equal(byChapter.C2, byChapter.C1);
  assert.equal(byChapter.C2, byChapter.C6);
  assert.doesNotMatch(byChapter.C2, /group the tray records/);
});

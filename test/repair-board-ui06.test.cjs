"use strict";

// UI-06 (real-browser capture CB-02-end, 2026-09-24): after all six chapters were accepted in one browser
// visit, the Case Board's main button said "Continue Chapter 6: retain compatible model rows" while the same
// page said "Case closed for today"; every card and evidence line called minutes-old work "Historical" or
// "not checked in this visit"; and the draft notice listed raw storage keys such as "C3/filter-disagreement".
// These tests replay the real save path, including the cursor web/chapter6.js writes when its move is accepted.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

const LATER_MOVES = [
  ["C3", "join-report-log"], ["C3", "filter-disagreement"],
  ["C4", "plan-distinct-recheck"],
  ["C5", "event-mask"], ["C5", "event-frequency"],
  ["C6", "compatible-models"]
];

function playWholeCourse(storage, attempt) {
  // C1 (mystery.js) saves only under its own legacy key; the board imports it.
  storage.setItem(legacy.c1EvidenceKey(attempt), JSON.stringify({
    evidence: {title: "Saved B09 records", id: "c1"},
    rows: [{jar_id: "J-1", batch_id: "B09"}],
    explanation: null
  }));
  // C2 (chapter2.js) through its real save path.
  const results = {
    group: {status: "ok", pass: true, step: "group", rows: [{jar_id: "J-1", tray_id: "T-A"}], columns: ["jar_id", "tray_id"]},
    counts: {status: "ok", pass: true, step: "counts", rows: [{tray_id: "T-A", n: 3, detected_n: 1}], columns: ["tray_id", "n", "detected_n"]},
    rates: {status: "ok", pass: true, step: "rates", rows: [{tray_id: "T-A", n: 3, detected_n: 1, rate: 0.333}], columns: ["tray_id", "n", "detected_n", "rate"]}
  };
  for (const step of ["group", "counts", "rates"]) assert.equal(chapter2.persistAcceptedCourseState(courseState, storage, attempt, step, results[step]), true);
  // C3-C6 write the shared course state directly, and each chapter keeps the learner's own draft.
  for (const [chapter, move] of LATER_MOVES) {
    courseState.writeChallengeDraft(storage, attempt, chapter, move, "learner draft for " + move);
    courseState.recordHistoricalMoveIfMissing(storage, attempt, chapter, move);
    courseState.writeEvidenceIfMissing(storage, attempt, {chapter, move_id: move, title: "x", row_count: 1, provenance: "historical-browser"});
  }
  // Exactly what web/chapter6.js writes when Chapter 6 is accepted.
  assert.equal(courseState.writeCursor(storage, attempt, {chapter: "C6", move_id: "compatible-models", mode: "challenge"}), true);
}

test("a finished course is reviewed, not continued, after Chapter 6 saves its own cursor", () => {
  for (const attempt of ["", "field-7"]) {
    const storage = memoryStorage();
    playWholeCourse(storage, attempt);
    const model = client.dashboardModel(client.loadCourseState(storage, attempt));

    assert.match(model.caseThread.whyNext, /^Case closed for today/);
    assert.doesNotMatch(model.continue.label, /^Continue/);
    assert.equal(model.continue.label, "Review Chapter 6: retain compatible model rows");
  }
});

test("a resumed cursor still says Continue while the course is unfinished", () => {
  const storage = memoryStorage();
  courseState.recordHistoricalMoveIfMissing(storage, "field-7", "C4", "plan-distinct-recheck");
  courseState.writeCursor(storage, "field-7", {chapter: "C1", move_id: "select-records", mode: "challenge"});
  const model = client.dashboardModel(client.loadCourseState(storage, "field-7"));
  assert.equal(model.continue.label, "Continue Chapter 1: select the disputed records");
  assert.equal(client.dashboardModel(courseState.emptyCourseState()).continue.label, "Start Chapter 1: select the disputed records");
});

test("chapter cards say the work was done in this browser, not that it is historical, and still ask for a fresh check", () => {
  const storage = memoryStorage();
  playWholeCourse(storage, "");
  const finished = client.dashboardModel(client.loadCourseState(storage, ""));
  for (const card of finished.cards) {
    assert.doesNotMatch(card.status, /Historical/i);
    assert.match(card.status, /^Completed in this browser\./);
    assert.match(card.status, /fresh check/);
    assert.doesNotMatch(card.status, /—/);
  }

  const partway = client.dashboardModel(courseState.makeCourseState({moves: [{key: "C3/join-report-log", provenance: "historical-browser"}]}));
  assert.doesNotMatch(partway.cards[2].status, /Historical/i);
  assert.match(partway.cards[2].status, /^Started in this browser\./);
  assert.doesNotMatch(partway.cards[2].status, /—/);
  assert.match(partway.cards[0].status, /^Playable now/);
});

test("the draft notice names moves in plain words and skips moves already accepted", () => {
  const storage = memoryStorage();
  playWholeCourse(storage, "");
  const finished = client.dashboardModel(client.loadCourseState(storage, ""));
  assert.equal(finished.draftNotice, "");

  const midway = memoryStorage();
  courseState.recordHistoricalMoveIfMissing(midway, "", "C3", "join-report-log");
  courseState.writeChallengeDraft(midway, "", "C3", "join-report-log", "leftjoin(report, handling_log, on=:tray_id)");
  courseState.writeChallengeDraft(midway, "", "C3", "filter-disagreement", "joined[");
  courseState.writeChallengeDraft(midway, "", "C5", "event-mask", "events =");
  const model = client.dashboardModel(client.loadCourseState(midway, ""));
  assert.doesNotMatch(model.draftNotice, /C\d\/[a-z-]+/);
  assert.doesNotMatch(model.draftNotice, /join the report/);
  assert.doesNotMatch(model.draftNotice, /—/);
  assert.equal(model.draftNotice, "Saved browser drafts available for Chapter 3: filter the recording disagreement; Chapter 5: name a simulation event.");

  const single = memoryStorage();
  courseState.writeChallengeDraft(single, "", "C4", "plan-distinct-recheck", "sample(");
  assert.equal(client.dashboardModel(client.loadCourseState(single, "")).draftNotice, "Saved browser draft available for Chapter 4: plan three distinct rechecks.");
});

test("saved evidence lines no longer claim the work was not checked in this visit", () => {
  // Repair 6: the line is composed in course-client.js (dashboardModel evidence[].line); the board shows it.
  const board = ["course-board.js", "course-client.js"].map(file => fs.readFileSync(path.join(__dirname, "../web/course", file), "utf8")).join("\n");
  assert.doesNotMatch(board, /not checked in this visit/);
  assert.match(board, /This board does not re-check saved work\./);
});

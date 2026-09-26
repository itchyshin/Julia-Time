"use strict";

// 2026-09-25 human playtest: every chapter said "✓ Accepted — evidence saved." while the browser had
// refused the save. The line must follow the saved record, not the fact that Julia accepted the code.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const courseState = require("../web/course/course-state.js");

const CHAPTERS = ["mystery", "chapter2", "chapter3", "chapter4", "chapter5", "chapter6"];
const accepted = {status:"ok", pass:true, progress_eligible:true};

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
}

for (const name of CHAPTERS) {
  test(`${name}: "evidence saved" only when the save held`, () => {
    const chapter = require(`../web/${name}.js`);
    assert.equal(chapter.runOutcomeStatus(accepted), "Julia checked it: that's right.");
    assert.equal(chapter.runOutcomeStatus(accepted, true), "Julia checked it: that's right.");
    const unsaved = chapter.runOutcomeStatus(accepted, false);
    assert.doesNotMatch(unsaved, /evidence saved/);
    assert.match(unsaved, /could not save it/);
    assert.match(unsaved, /Case Board will not show it/);
  });
}

test("every chapter uses the same not-saved wording", () => {
  const lines = CHAPTERS.map(name => require(`../web/${name}.js`).runOutcomeStatus(accepted, false));
  assert.equal(new Set(lines).size, 1);
});

test("every chapter checks the saved record after saving, before it draws the outcome", () => {
  for (const name of CHAPTERS) {
    const source = fs.readFileSync(path.join(__dirname, "..", "web", name + ".js"), "utf8");
    assert.match(source, /saveOk = savedMove\(|saveOk=savedMove\(/, `${name} checks the saved record`);
    assert.match(source, /runOutcomeStatus\([a-zA-Z.]+, saveOk\)|runStatusText\(state, saveOk\)/, `${name} passes the check to the outcome line`);
  }
});

test("hasSavedMove reads the record, so a refused save is reported as not saved", () => {
  const storage = memoryStorage();
  assert.equal(courseState.hasSavedMove(storage, "", "C4", "plan-distinct-recheck"), false);
  assert.equal(courseState.recordHistoricalMoveIfMissing(storage, "", "C4", "plan-distinct-recheck"), true);
  assert.equal(courseState.hasSavedMove(storage, "", "C4", "plan-distinct-recheck"), true);
  // A second record call returns false (already there), yet the move IS saved: never trust the write's return value.
  assert.equal(courseState.recordHistoricalMoveIfMissing(storage, "", "C4", "plan-distinct-recheck"), false);
  assert.equal(courseState.hasSavedMove(storage, "", "C4", "plan-distinct-recheck"), true);

  const damaged = memoryStorage();
  damaged.setItem(courseState.courseKey(""), "not json");
  courseState.recordHistoricalMoveIfMissing(damaged, "", "C4", "plan-distinct-recheck");
  assert.equal(courseState.hasSavedMove(damaged, "", "C4", "plan-distinct-recheck"), false);

  const blocked = {getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }};
  courseState.recordHistoricalMoveIfMissing(blocked, "", "C4", "plan-distinct-recheck");
  assert.equal(courseState.hasSavedMove(blocked, "", "C4", "plan-distinct-recheck"), false);
});

"use strict";

// Screen-bot (2026-09-25): after solving both Chapter 3 steps and reloading, the page reopened on step 1.
// A chapter opened without a step in its address resumes at the first unsolved step, or the last step
// when every step is solved. An explicit, reachable step in the address still wins.
const test = require("node:test");
const assert = require("node:assert/strict");
const courseState = require("../web/course/course-state.js");
const c3 = require("../web/chapter3.js");
const c5 = require("../web/chapter5.js");

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
}
const solve = (storage, chapter, move) => courseState.recordHistoricalMoveIfMissing(storage, "", chapter, move);

test("Chapter 3 resumes at the first unsolved step, or the last when all are solved", () => {
  const storage = memoryStorage();
  assert.equal(c3.initialMove(courseState, storage, "", ""), "join-report-log");
  solve(storage, "C3", "join-report-log");
  assert.equal(c3.initialMove(courseState, storage, "", ""), "filter-disagreement");
  solve(storage, "C3", "filter-disagreement");
  assert.equal(c3.initialMove(courseState, storage, "", ""), "filter-disagreement");
  assert.equal(c3.initialMove(courseState, storage, "", "join-report-log"), "join-report-log");
});

test("Chapter 5 resumes at the first unsolved step, or the last when all are solved", () => {
  const storage = memoryStorage();
  assert.equal(c5.initialMove(courseState, storage, "", ""), "event-mask");
  solve(storage, "C5", "event-mask");
  assert.equal(c5.initialMove(courseState, storage, "", ""), "event-frequency");
  solve(storage, "C5", "event-frequency");
  assert.equal(c5.initialMove(courseState, storage, "", ""), "event-frequency");
  assert.equal(c5.initialMove(courseState, storage, "", "?move=event-mask"), "event-mask");
});

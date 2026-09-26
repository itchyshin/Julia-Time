"use strict";

// 2026-09-25 human playtest: a browser that played Chapter 4 between 8 and 9 September still holds the
// retired move "C4/select-eligible". That one retired name made the whole saved record "malformed", so
// every later save was silently refused and the Case file showed STILL UNKNOWN for all six chapters.
const test = require("node:test");
const assert = require("node:assert/strict");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
}
const snapshot = (chapter, move_id) => ({case_id:"missing-fleas-v1", chapter, move_id, provenance:"historical-browser"});
function oldRecord() {
  return JSON.stringify({schema_version:1, case_id:"missing-fleas-v1", accepted:{
    "C1/select-records": snapshot("C1", "select-records"),
    "C4/select-eligible": snapshot("C4", "select-eligible")
  }});
}

test("a saved record with a retired move keeps its current moves and is not malformed", () => {
  const storage = memoryStorage();
  storage.setItem(courseState.courseKey(""), oldRecord());
  assert.equal(courseState.courseStateStatus(storage, ""), "valid");
  assert.deepEqual(courseState.acceptedMoves(courseState.readCourseState(storage, "")).map(m => m.key), ["C1/select-records"]);
});

test("new accepted moves still save after a retired move was stored", () => {
  const storage = memoryStorage();
  storage.setItem(courseState.courseKey(""), oldRecord());
  assert.equal(courseState.recordHistoricalMoveIfMissing(storage, "", "C4", "plan-distinct-recheck"), true);
  const keys = courseState.acceptedMoves(courseState.readCourseState(storage, "")).map(m => m.key);
  assert.deepEqual(keys, ["C1/select-records", "C4/plan-distinct-recheck"]);
  assert.equal(JSON.parse(storage.getItem(courseState.courseKey(""))).accepted["C4/select-eligible"], undefined);
});

test("the Chapter 6 Case file shows every chapter established after an old record plus a full replay", () => {
  const storage = memoryStorage();
  storage.setItem(courseState.courseKey(""), oldRecord());
  for (const move of courseState.KNOWN_MOVES) courseState.recordHistoricalMoveIfMissing(storage, "", move.chapter, move.move_id);
  const keys = new Set(courseState.acceptedMoves(courseState.readCourseState(storage, "")).map(m => m.key));
  assert.deepEqual(client.caseFile(keys).map(row => row.label), Array(6).fill("What we know so far"));
});

test("a damaged entry under a current move name is still treated as malformed", () => {
  const storage = memoryStorage();
  storage.setItem(courseState.courseKey(""), JSON.stringify({schema_version:1, case_id:"missing-fleas-v1", accepted:{"C1/select-records": {chapter:"C2"}}}));
  assert.equal(courseState.courseStateStatus(storage, ""), "malformed");
});

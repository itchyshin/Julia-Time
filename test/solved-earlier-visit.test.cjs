"use strict";

// Round-3 screen-bot (2026-09-25): an older build saved Chapter 1's step without its result, so the page said
// "✓ Solved" above an empty editor with no evidence. A chapter whose steps are saved but whose results are not
// says "solved on an earlier visit" and how to see its evidence, on the Case Board card and the chapter bar.
const test = require("node:test");
const assert = require("node:assert/strict");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");
const banner = require("../web/course/progress-banner.js");

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
}
const board = storage => client.dashboardModel(client.loadCourseState(storage, ""));

test("a solved chapter with no saved result says 'solved on an earlier visit'", () => {
  const storage = memoryStorage();
  courseState.recordHistoricalMoveIfMissing(storage, "", "C1", "select-records");
  assert.equal(board(storage).cards[0].solvedLabel, "✓ Done on an earlier visit");
  assert.equal(banner.bannerModel(storage, "", "C1").status,
    "Chapter 1: ✓ solved on an earlier visit. Run it again to see its evidence here.");
});

test("a solved chapter with its result saved keeps the plain labels", () => {
  const storage = memoryStorage();
  courseState.recordHistoricalMoveIfMissing(storage, "", "C4", "plan-distinct-recheck");
  courseState.writeEvidenceIfMissing(storage, "", {chapter:"C4", move_id:"plan-distinct-recheck", title:"Three distinct rechecks planned", row_count:3, provenance:"historical-browser"});
  assert.equal(board(storage).cards[3].solvedLabel, "✓ Solved");
  assert.equal(banner.bannerModel(storage, "", "C4").status, "Chapter 4: ✓ solved in this browser.");
});

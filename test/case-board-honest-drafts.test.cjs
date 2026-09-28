"use strict";

// 2026-09-25 screen-bots (returning players): the Case Board said "Saved browser draft available for
// Chapter 2" while Chapter 2 opened with an empty editor, and "No evidence is saved" next to a list of
// concepts already learned. The board may only promise what the chapter page will actually show.
const test = require("node:test");
const assert = require("node:assert/strict");
const courseState = require("../web/course/course-state.js");
const legacy = require("../web/course/legacy-import.js");
const client = require("../web/course/course-client.js");

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
}
const board = storage => client.dashboardModel(client.loadCourseState(storage, ""));

test("a Chapter 2 draft in the shared record, which Chapter 2 never reads, is not announced", () => {
  const storage = memoryStorage();
  storage.setItem(courseState.coursePrefix("") + "draft:C2:group:challenge", "groupby(jars, :tray)");
  assert.equal(board(storage).draftNotice, "");
});

test("a Chapter 2 draft where Chapter 2 keeps it is announced", () => {
  const storage = memoryStorage();
  storage.setItem(legacy.c2DraftKey("", "group"), "groupby(jars, :tray_id)");
  assert.match(board(storage).draftNotice, /Chapter 2: group the jars by tray/);
});

test("a Chapter 1 draft where Chapter 1 keeps it is announced", () => {
  const storage = memoryStorage();
  storage.setItem(legacy.c1CodeKey(""), "jars[jars.batch .== case_batch, :]");
  assert.match(board(storage).draftNotice, /Chapter 1:/);
});

test("Chapter 3 to 6 drafts still come from the shared record", () => {
  const storage = memoryStorage();
  courseState.writeChallengeDraft(storage, "", "C4", "plan-distinct-recheck", "sample(eligible.jar_id, 3)");
  assert.match(board(storage).draftNotice, /Chapter 4:/);
});

test("empty drafts are not announced", () => {
  const storage = memoryStorage();
  storage.setItem(legacy.c2DraftKey("", "group"), "");
  storage.setItem(legacy.c1CodeKey(""), "   ");
  assert.equal(board(storage).draftNotice, "");
});

test("solved steps without saved result tables do not say 'No evidence is saved'", () => {
  const storage = memoryStorage();
  // A partly done chapter (one of three Chapter 2 steps): no chapter is solved, so no per-chapter line.
  courseState.recordHistoricalMoveIfMissing(storage, "", "C2", "group");
  const model = board(storage);
  assert.equal(model.evidence.length, 0);
  assert.match(model.evidenceEmpty, /solved steps are saved/i);
  assert.equal(board(memoryStorage()).evidenceEmpty, "No findings saved on this computer yet.");
});

// Round-2 screen-bot (2026-09-25): Chapter 1 showed "✓ Solved" but the saved-evidence list skipped it,
// because an earlier build saved the solved step without a result table.
test("a solved chapter without a saved result table still gets an evidence line", () => {
  const storage = memoryStorage();
  courseState.recordHistoricalMoveIfMissing(storage, "", "C1", "select-records");
  courseState.recordHistoricalMoveIfMissing(storage, "", "C4", "plan-distinct-recheck");
  courseState.writeEvidenceIfMissing(storage, "", {chapter:"C4", move_id:"plan-distinct-recheck", title:"Three distinct rechecks planned", row_count:3, provenance:"historical-browser"});
  const lines = board(storage).evidence.map(item => item.line);
  assert.equal(lines.length, 2);
  // The stored title is an older build's wording; the board shows today's title instead
  // (adversary review item 5), looked up by chapter/move_id rather than trusted verbatim.
  assert.ok(lines.some(line => /^Recheck jars: planned, not looked at yet\.$/.test(line)));
  assert.ok(!lines.some(line => /Three distinct rechecks planned/.test(line)));
  assert.ok(lines.some(line => /^Chapter 1: solved on this computer, but its result table was not saved here\. Run Chapter 1 again to see its evidence\.$/.test(line)));
});

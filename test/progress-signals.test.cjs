"use strict";

// 2026-09-25 human playtest: "it is not obvious when we finish or succeed" and "it is not clear why we can
// progress to the next one without getting evidence". Every chapter stays open, but the game must say plainly
// which chapters are solved, which earlier ones are still open, and when the whole case is solved.
const test = require("node:test");
const assert = require("node:assert/strict");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");
const progress = require("../web/course/progress-banner.js");
const c6 = require("../web/chapter6.js");

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
}
// Like a real accepted run: the step and its result are both saved (2026-09-25: a step saved without a result
// now reads "solved on an earlier visit"; see test/solved-earlier-visit.test.cjs).
function solve(storage, keys) {
  for (const key of keys) {
    const [chapter, move] = key.split("/");
    courseState.recordHistoricalMoveIfMissing(storage, "", chapter, move);
    courseState.writeEvidenceIfMissing(storage, "", {chapter, move_id:move, title:"Saved result", row_count:1, provenance:"historical-browser"});
  }
}
const ALL = courseState.KNOWN_MOVES.map(move => move.key);
const board = storage => client.dashboardModel(client.loadCourseState(storage, ""));

test("Case Board: nothing solved says so, and every card is 'Not solved yet'", () => {
  const model = board(memoryStorage());
  assert.equal(model.completion.complete, false);
  assert.equal(model.completion.solved, 0);
  assert.match(model.completion.line, /0 of 6 chapters solved/);
  assert.deepEqual(model.cards.map(card => card.solvedLabel), Array(6).fill("Not solved yet"));
});

test("Case Board: a chapter counts as solved only when all its steps are saved", () => {
  const storage = memoryStorage();
  solve(storage, ["C1/select-records", "C2/group"]);
  const model = board(storage);
  assert.equal(model.cards[0].solvedLabel, "✓ Solved");
  assert.equal(model.cards[1].solvedLabel, "Not solved yet: 1 of 3 steps saved");
  assert.equal(model.completion.solved, 1);
  assert.match(model.completion.line, /1 of 6 chapters solved\. Still open: Chapters 2, 3, 4, 5 and 6\./);
});

test("Case Board: all ten steps saved says the case is solved", () => {
  const storage = memoryStorage();
  solve(storage, ALL);
  const model = board(storage);
  assert.equal(model.completion.complete, true);
  assert.equal(model.completion.headline, "Case closed: all 6 chapters complete.");
  assert.deepEqual(model.cards.map(card => card.solvedLabel), Array(6).fill("✓ Solved"));
});

test("chapter banner: names this chapter's status and earlier unsolved chapters", () => {
  const storage = memoryStorage();
  solve(storage, ["C1/select-records", "C3/join-report-log", "C3/filter-disagreement"]);
  const banner = progress.bannerModel(storage, "", "C4");
  assert.equal(banner.solved, false);
  assert.match(banner.status, /Chapter 4: not solved yet/);
  assert.match(banner.earlier, /Chapter 2 is not solved yet/);
  assert.equal(banner.earlierLink.chapter, "C2");

  solve(storage, ["C4/plan-distinct-recheck"]);
  const after = progress.bannerModel(storage, "", "C4");
  assert.equal(after.solved, true);
  assert.match(after.status, /Chapter 4: ✓ solved/);
});

test("chapter banner: Chapter 1 has no earlier chapters, and a full case says solved", () => {
  const first = progress.bannerModel(memoryStorage(), "", "C1");
  assert.equal(first.earlier, "");
  assert.equal(first.earlierLink, null);
  const storage = memoryStorage();
  solve(storage, ALL);
  assert.match(progress.bannerModel(storage, "", "C6").status, /Case closed: all 6 chapters complete/);
});

test("Chapter 6 ending names the open chapters, or says the case is solved", () => {
  const partial = new Set(["C1/select-records", "C6/compatible-models"]);
  assert.match(c6.completionLine(client.caseFile(partial)), /^Chapter 6 is solved, but the case is not complete yet\. Still open: Chapters 2, 3, 4 and 5\./);
  assert.equal(c6.completionLine(client.caseFile(new Set(ALL))), "Case closed: all 6 chapters complete.");
});

// Round-2 screen-bot (2026-09-25): after step 1 of a multi-step chapter, the page said "✓ Accepted" while
// the bar said "not solved yet". The bar counts steps once any step of the chapter is saved.
test("chapter banner counts saved steps in a multi-step chapter", () => {
  const storage = memoryStorage();
  assert.match(progress.bannerModel(storage, "", "C5").status, /Chapter 5: not solved yet/);
  solve(storage, ["C5/event-mask"]);
  const partway = progress.bannerModel(storage, "", "C5");
  assert.equal(partway.solved, false);
  assert.match(partway.status, /^Chapter 5: step 1 of 2 saved\. Solve step 2 to finish this chapter\.$/);
  assert.doesNotMatch(partway.status, /not solved/);
  solve(storage, ["C2/group", "C2/counts"]);
  assert.match(progress.bannerModel(storage, "", "C2").status, /^Chapter 2: steps 1 and 2 of 3 saved\. Solve step 3 to finish this chapter\.$/);
});

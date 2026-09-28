"use strict";
// Round 7 (r7-r-struggling #1, 2026-09-28): the ending kept the FIRST accepted code for a step, so after
// a shortcut and then the taught .!= line, "Your code" and "Julia you typed" showed the shortcut while
// "Ideas you used" and the Case Board said .!=. Decision (Ada, night): show the LATEST accepted code,
// for every step, and take the ideas from that same saved code.
const test = require("node:test");
const assert = require("node:assert/strict");
const courseState = require("../web/course/course-state.js");
const legacy = require("../web/course/legacy-import.js");
const client = require("../web/course/course-client.js");
const ending = require("../web/course/ending.js");

function memoryStorage() {
  const values = new Map();
  return {getItem:key => values.has(key) ? values.get(key) : null, setItem:(key, value) => values.set(key, String(value)), removeItem:key => values.delete(key)};
}
const SHORTCUT = 'joined[joined.entry_status .== "left blank", :]';
const TAUGHT = "joined[joined.notebook_detected .!= joined.sheet_detected, :]";
const NOT_EQUAL = "not-equal, row by row, with .!=";
const FACTS = Object.freeze({batch_id:"B09", n_jars:6, n_detected:5,
  trays:[{tray_id:"T-A", detected_n:2}, {tray_id:"T-B", detected_n:2}, {tray_id:"T-C", detected_n:1}],
  disagreement:{tray_id:"T-C", notebook_detected:1, sheet_detected:0, entry_status:"left blank"},
  eligible_jars:["J-091", "J-092", "J-094", "J-096"], recheck_size:3,
  observed_count:5, n_per_simulation:6, n_simulations:1000, matching_events:113,
  models:[{model:"Coin flip", p:0.5, lower:1, upper:5, compatible:true}]});

// A page saves its draft on every keystroke, then calls recordHistoricalMoveIfMissing when Julia accepts the run.
function acceptC3(storage, code) {
  courseState.writeChallengeDraft(storage, "demo", "C3", "filter-disagreement", code);
  return courseState.recordHistoricalMoveIfMissing(storage, "demo", "C3", "filter-disagreement");
}

test("a later accepted run replaces the saved code in every chapter, with no chapter change", () => {
  const storage = memoryStorage();
  assert.equal(acceptC3(storage, SHORTCUT), true);
  assert.equal(courseState.readAcceptedCode(storage, "demo")["C3/filter-disagreement"], SHORTCUT);
  assert.equal(acceptC3(storage, TAUGHT), false, "the move was already saved, so this is not a new save");
  assert.equal(courseState.readAcceptedCode(storage, "demo")["C3/filter-disagreement"], TAUGHT);

  // Chapters 1 and 2 keep drafts under their older names.
  storage.setItem(legacy.c1CodeKey("demo"), 'jars[jars.batch_id .== "B09", :]');
  courseState.recordHistoricalMoveIfMissing(storage, "demo", "C1", "select-records");
  storage.setItem(legacy.c1CodeKey("demo"), "jars[jars.batch_id .== case_batch, :]");
  courseState.recordHistoricalMoveIfMissing(storage, "demo", "C1", "select-records");
  assert.equal(courseState.readAcceptedCode(storage, "demo")["C1/select-records"], "jars[jars.batch_id .== case_batch, :]");
  storage.setItem(legacy.c2DraftKey("demo", "rates"), "counts.rate = counts.detected_n ./ counts.n");
  courseState.recordHistoricalMoveIfMissing(storage, "demo", "C2", "rates");
  storage.setItem(legacy.c2DraftKey("demo", "rates"), "counts.rate = counts.detected_n ./ counts.n\ncounts");
  courseState.recordHistoricalMoveIfMissing(storage, "demo", "C2", "rates");
  assert.equal(courseState.readAcceptedCode(storage, "demo")["C2/rates"], "counts.rate = counts.detected_n ./ counts.n\ncounts");
});

test("the rest of the saved record stays write-once when the code is refreshed", () => {
  const storage = memoryStorage();
  acceptC3(storage, SHORTCUT);
  const before = courseState.readCourseState(storage, "demo").accepted["C3/filter-disagreement"];
  acceptC3(storage, TAUGHT);
  const after = courseState.readCourseState(storage, "demo").accepted["C3/filter-disagreement"];
  assert.deepEqual(Object.assign({}, after, {code:before.code}), before);
  // An empty draft never wipes the saved code.
  courseState.writeChallengeDraft(storage, "demo", "C3", "filter-disagreement", "   ");
  courseState.recordHistoricalMoveIfMissing(storage, "demo", "C3", "filter-disagreement");
  assert.equal(courseState.readAcceptedCode(storage, "demo")["C3/filter-disagreement"], TAUGHT);
});

test("'Julia you typed' and 'Ideas you used' come from the same saved code", () => {
  const storage = memoryStorage();
  acceptC3(storage, SHORTCUT);
  let code = ending.learnerCode(storage, "demo");
  let concepts = client.dashboardModel(client.loadCourseState(storage, "demo")).concepts;
  assert.equal(ending.featuring(code).includes(".!="), false);
  assert.equal(concepts.includes(NOT_EQUAL), false, "the shortcut never used .!=, so the ideas do not claim it");

  acceptC3(storage, TAUGHT);
  code = ending.learnerCode(storage, "demo");
  concepts = client.dashboardModel(client.loadCourseState(storage, "demo")).concepts;
  assert.equal(ending.featuring(code).includes(".!="), true);
  assert.equal(concepts.includes(NOT_EQUAL), true);
  assert.equal(ending.buildScenes(FACTS, require("../web/course/ending-script.js"), code)[2].code, TAUGHT);
});

test("a save with no code kept still lists every idea of its solved steps", () => {
  const storage = memoryStorage();
  for (const move of courseState.KNOWN_MOVES) courseState.recordHistoricalMoveIfMissing(storage, "", move.chapter, move.move_id);
  const concepts = client.dashboardModel(client.loadCourseState(storage, "")).concepts;
  for (const idea of [NOT_EQUAL, "dividing column by column with ./", "comparing every value with .>="]) assert.ok(concepts.includes(idea), idea);
});

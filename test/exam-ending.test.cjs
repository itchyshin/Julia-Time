"use strict";
// Gate I4b: exam-only progress opens the ending. The only writes are what web/lesson-exam-save.js makes when each of
// the ten chapter moves is passed as an exam on web/lesson.html (no chapter page, no lesson, no legacy import).
// Then the ending's own gate (web/course/ending.js) is open and the Board's one main button
// (web/course/course-client.js courseWalk) says "See how the case ends".
const test = require("node:test");
const assert = require("node:assert/strict");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");
const ending = require("../web/course/ending.js");
const legacy = require("../web/course/legacy-import.js");
const save = require("../web/lesson-exam-save.js");

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    keys() { return Array.from(map.keys()); },
  };
}
// What a passing exam run carries (src/lessons.jl _lesson_exam_record), and a line of code that passed.
const PASSES = [
  { chapter: "C1", move_id: "select-records", row_count: 6, code: "jars[jars.batch_id .== case_batch, :]" },
  { chapter: "C2", move_id: "group", row_count: 6, code: "groupby(jars, :tray_id)" },
  { chapter: "C2", move_id: "counts", row_count: 3, code: "combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)" },
  { chapter: "C2", move_id: "rates", row_count: 3, code: "c = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\nc.rate = c.detected_n ./ c.n\nc" },
  { chapter: "C3", move_id: "join-report-log", row_count: 3, code: "leftjoin(tray_counts, tally_sheet, on=:tray_id)" },
  { chapter: "C3", move_id: "filter-disagreement", row_count: 1, code: "joined[joined.notebook_detected .!= joined.sheet_detected, :]" },
  { chapter: "C4", move_id: "plan-distinct-recheck", row_count: 3, jar_ids: ["J-091", "J-092", "J-094"], code: "sample(eligible.jar_id, 3; replace=false)" },
  { chapter: "C5", move_id: "event-mask", row_count: 1000, code: "sim_counts .>= observed_count" },
  { chapter: "C5", move_id: "event-frequency", row_count: 1000, code: "e = sim_counts .>= observed_count\nsum(e) / length(e)" },
  { chapter: "C6", move_id: "compatible-models", row_count: 2, code: "stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]" },
];
const passAll = (storage, attempt) => PASSES.map((p) => save.saveExamPass(courseState, storage, attempt, p, p.code));

test("the save file covers exactly the ten course moves", () => {
  assert.deepStrictEqual(Object.keys(save.MOVES).sort(), courseState.KNOWN_MOVES.map((m) => m.key).sort());
  assert.deepStrictEqual(PASSES.map((p) => p.chapter + "/" + p.move_id), courseState.KNOWN_MOVES.map((m) => m.key));
  // every cursor it writes is one course-state accepts
  for (const m of Object.values(save.MOVES)) assert.ok(courseState.KNOWN_MOVES.some((k) => k.chapter === m.next.chapter && k.move_id === m.next.move_id));
});

test("chapters 1 and 2 keep their drafts where the chapter pages do (legacy-import.js)", () => {
  for (const attempt of ["", "a-1"]) {
    assert.equal(save.draftKey(attempt, "C1", "select-records"), legacy.c1CodeKey(attempt));
    for (const step of ["group", "counts", "rates"]) assert.equal(save.draftKey(attempt, "C2", step), legacy.c2DraftKey(attempt, step));
    assert.equal(save.draftKey(attempt, "C3", "join-report-log"), null, "C3 to C6 use course-state's own draft key");
  }
});

for (const attempt of ["", "class-a"]) {
  test(`I4b: exam passes alone open the ending and the Board says "See how the case ends" (attempt ${JSON.stringify(attempt)})`, () => {
    const storage = memoryStorage();
    assert.equal(ending.endingGate(storage, attempt).complete, false, "nothing saved: the ending is closed");
    const saved = passAll(storage, attempt);
    assert.deepStrictEqual(saved, PASSES.map(() => true), "every save reports that the move is really in the record");
    // only course-state keys (and the two chapters' draft keys) were written: no lesson key, no legacy evidence
    const keys = storage.keys();
    assert.ok(keys.length > 0);
    for (const k of keys) {
      assert.ok(k.startsWith(courseState.BASE_PREFIX) || k === legacy.c1CodeKey(attempt) || ["group", "counts", "rates"].some((s) => k === legacy.c2DraftKey(attempt, s)), "unexpected key " + k);
    }
    assert.ok(!keys.some((k) => k.startsWith("julia-time:lesson:v1:")), "no lesson progress was seeded");
    assert.equal(courseState.courseStateStatus(storage, attempt), "valid");
    for (const m of courseState.KNOWN_MOVES) assert.ok(courseState.hasSavedMove(storage, attempt, m.chapter, m.move_id), m.key);
    assert.equal(courseState.readEvidence(storage, attempt).length, 10, "one evidence entry per move");
    // the ending's own gate
    const gate = ending.endingGate(storage, attempt);
    assert.equal(gate.complete, true);
    assert.deepStrictEqual(gate.open, []);
    assert.equal(gate.line, "");
    // the Board's one main button
    const model = client.dashboardModel(client.loadCourseState(storage, attempt));
    for (const card of model.cards) assert.equal(card.done, true, card.chapter + " shows Case done");
    const walk = client.courseWalk(model, client.lessonProgress(storage), attempt);
    assert.equal(walk.next.kind, "ending");
    assert.equal(walk.next.label, "See how the case ends");
    assert.equal(walk.next.href, client.endingDestination(attempt));
    assert.ok(walk.rows.every((r) => r.caseDone), "every card reads Case done");
    // the ending shows the code the exams accepted
    const codes = courseState.readAcceptedCode(storage, attempt);
    assert.equal(codes["C1/select-records"], PASSES[0].code);
    assert.equal(codes["C6/compatible-models"], PASSES[9].code);
    assert.deepStrictEqual(courseState.readEvidence(storage, attempt).find((e) => e.chapter === "C4").jar_ids, ["J-091", "J-092", "J-094"]);
  });
}

test("I4b, the other way: nine of ten moves keep the ending closed, and the Board sends the player to the open chapter", () => {
  const storage = memoryStorage();
  PASSES.filter((p) => p.move_id !== "counts").forEach((p) => save.saveExamPass(courseState, storage, "", p, p.code));
  assert.equal(ending.endingGate(storage, "").complete, false);
  const walk = client.courseWalk(client.dashboardModel(client.loadCourseState(storage, "")), client.lessonProgress(storage), "");
  assert.notEqual(walk.next.kind, "ending");
  assert.equal(walk.next.n, 2);
});

test("a save that cannot be written says so (never a claimed save)", () => {
  const broken = { get length() { return 0; }, key() { return null; }, getItem() { return null; }, setItem() { throw new Error("full"); }, removeItem() {} };
  assert.equal(save.saveExamPass(courseState, broken, "", PASSES[0], PASSES[0].code), false);
  assert.equal(save.saveExamPass(courseState, memoryStorage(), "", { chapter: "C9", move_id: "x" }, "x"), false);
  assert.equal(save.saveExamPass(null, memoryStorage(), "", PASSES[0], "x"), false);
});

test("a later accepted C4 run replaces the saved jars and code, as chapter 4 does", () => {
  const storage = memoryStorage();
  const c4 = PASSES[6];
  save.saveExamPass(courseState, storage, "", c4, c4.code);
  save.saveExamPass(courseState, storage, "", Object.assign({}, c4, { jar_ids: ["J-081", "J-082", "J-084"] }), "sample(eligible.jar_id, 3, replace=false)");
  assert.deepStrictEqual(courseState.readEvidence(storage, "").find((e) => e.chapter === "C4").jar_ids, ["J-081", "J-082", "J-084"]);
  assert.equal(courseState.readAcceptedCode(storage, "")["C4/plan-distinct-recheck"], "sample(eligible.jar_id, 3, replace=false)");
});

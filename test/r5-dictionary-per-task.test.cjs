"use strict";
// Round 5: the pocket dictionary shows a row only once its idea is reached by the current task (a lesson), and
// a chapter shows only the table names that exist in the current task (an exam). The cheat sheet stays complete.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lesson = require("../web/lesson.js");

const dir = path.join(__dirname, "..", "lessons");
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => Array.from(m.keys())[i] }; };

function open(def, served) {
  let ctrl;
  ctrl = lesson.createController({ lessonId: def.id, storage: mem(), send: (m) => {
    if (m.type === "lesson_list") ctrl.handle({ type: "lessons", lessons: [{ id: def.id, number: def.number, title: "T", kind: def.kind }] });
    else if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: served });
  } });
  ctrl.open(); ctrl.start();
  return ctrl;
}
function goto(ctrl, def, id) {
  const flat = []; def.rounds.forEach((r) => r.challenges.forEach((c) => flat.push(c.id)));
  ctrl.state.warmDone = true; ctrl.state.index = flat.indexOf(id);
  return ctrl.view();
}

test("Lesson 4: the replace=false row waits for the task that uses replace", () => {
  const def = read("lesson4.json");
  const ctrl = open(def, def);
  const at = (id) => goto(ctrl, def, id).ch.dictionary.map((r) => r.julia);
  const row3 = "sample(1:10, 3; replace=false)";
  assert.ok(!at("l4-r2-c1").includes(row3), "task 1 of round 2 does not show it yet");
  assert.ok(at("l4-r2-c1").includes("sample(practice_jars.jar_id, 2)"), "the sample row is there");
  assert.ok(at("l4-r2-c2").includes(row3), "the task that introduces replace= shows it");
  assert.ok(at("l4-r3-c1").includes(row3), "and later tasks keep it");
});

test("every lesson row is shown by the end of its round, and the cheat sheet stays complete", () => {
  for (const f of fs.readdirSync(dir).filter((x) => /^lesson\d+\.json$/.test(x))) {
    const def = read(f);
    const ctrl = open(def, def);
    const last = def.rounds.map((r) => r.challenges[r.challenges.length - 1].id);
    const shown = new Set();
    def.rounds.forEach((r, i) => goto(ctrl, def, last[i]).ch.dictionary.forEach((x) => shown.add(x.julia)));
    def.dictionary.forEach((row) => assert.ok(shown.has(row.julia), f + ": " + row.julia));
  }
});

test("Chapter 3: task 2 lists only the table it works on, task 1 lists its two", () => {
  const def = read("exam3.json");
  const served = JSON.parse(JSON.stringify(def));
  served.rounds.forEach((r) => r.challenges.forEach((c) => { delete c.solution; delete c.check; }));
  served.dictionary = served.dictionary.map((r) => Object.assign({}, r, { chapter: 3 }));
  served.data_values = { tray_counts: { columns: ["tray_id", "notebook_detected"], rows: [["T-A", 1]] }, tally_sheet: { columns: ["tray_id", "sheet_detected", "entry_status"], rows: [["T-A", 1, "ok"]] }, joined: { columns: ["tray_id", "notebook_detected", "sheet_detected", "entry_status"], rows: [["T-A", 1, 1, "ok"]] } };
  const ctrl = open(def, served);
  const names = (id) => { const v = goto(ctrl, def, id).ch; return v.dictionary.concat(v.dictEarlier).map((r) => r.julia); };
  const t1 = names("x3-join-report-log"), t2 = names("x3-filter-disagreement");
  assert.ok(t1.includes("tray_counts") && t1.includes("tally_sheet"));
  assert.ok(!t1.includes("joined"), "joined does not exist in task 1");
  assert.ok(t2.includes("joined"));
  assert.ok(!t2.includes("tray_counts") && !t2.includes("tally_sheet"), "task 1's tables are not task 2's");
});

test("the end fold's title comes from the lesson (close.own_work.title), with the old text as the default", () => {
  const def = read("lesson5.json");
  const e = open(def, def); e.state.index = 0;
  const own = (d) => { const c = open(d, d); c.state.screen = "end"; return c.view().end; };
  assert.equal(own(def).own.title, "In your own work");
  const plain = JSON.parse(JSON.stringify(def)); delete plain.close.own_work.title;
  assert.equal(own(plain).own.title, "In your own work (not run here)");
});

test("a table shown for a position task carries row numbers; other tasks do not", () => {
  const def = read("lesson1.json");
  const dv = {};
  def.rounds.forEach((r) => r.challenges.forEach((c) => { if (c.data) dv[c.data] = { columns: ["jar_id", "batch"], rows: [["J-1", "B01"], ["J-2", "B01"]] }; }));
  const ctrl = open(def, Object.assign({}, def, { data_values: dv }));
  const flag = (id) => goto(ctrl, def, id).ch.rowNumbers;
  for (const id of ["l1-r2-c1", "l1-r2-c2", "l1-r2-c3", "l1-r2-c6"]) assert.equal(flag(id), true, id);
  assert.equal(flag(def.rounds[0].challenges[0].id), false, "a first-round task is not about positions");
});

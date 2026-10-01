"use strict";
// Gate I5 (screen part): a chapter exam (lessons/examN.json, kind "exam") on web/lesson.html runs in exam mode:
// no worked example, no "Show me the line", no test-out, the pocket dictionary of Lessons 1 to N present but collapsed (one click opens it), at
// most one hint, named "Chapter N: <title>", and its end screen shows the chapter's payoff and goes on to the next
// lesson (or, after Chapter 6, the ending). A pass is saved to the course record through web/lesson-exam-save.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lesson = require("../web/lesson.js");
const courseState = require("../web/course/course-state.js");
const examSave = require("../web/lesson-exam-save.js");

const root = path.join(__dirname, "..");
const dir = path.join(root, "lessons");
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const examFiles = fs.readdirSync(dir).filter((f) => /^exam\d+\.json$/.test(f)).sort();
const lessonFiles = fs.readdirSync(dir).filter((f) => /^lesson\d+\.json$/.test(f)).sort();
const flat = (L) => L.rounds.flatMap((r) => r.challenges);
const MOVE_OF = {
  check_exam1_select_records: ["C1", "select-records"], check_exam2_group: ["C2", "group"], check_exam2_counts: ["C2", "counts"],
  check_exam2_rates: ["C2", "rates"], check_exam3_join_report_log: ["C3", "join-report-log"],
  check_exam3_filter_disagreement: ["C3", "filter-disagreement"], check_exam4_plan_distinct_recheck: ["C4", "plan-distinct-recheck"],
  check_exam5_event_mask: ["C5", "event-mask"], check_exam5_event_frequency: ["C5", "event-frequency"],
  check_exam6_compatible_models: ["C6", "compatible-models"],
};

// What the server sends for an exam (src/lessons.jl lesson_public): no solutions, no checks, and the pocket dictionary
// of Lessons 1 to N, each julia line once.
function dictionaryUpTo(n) {
  const rows = [], seen = new Set();
  for (let k = 1; k <= n; k++) {
    const f = path.join(dir, "lesson" + k + ".json");
    if (!fs.existsSync(f)) continue;
    for (const row of JSON.parse(fs.readFileSync(f, "utf8")).dictionary || []) {
      if (seen.has(row.julia)) continue;
      seen.add(row.julia);
      const out = Object.assign({}, row, { lesson: k }); delete out.from_round; delete out.from_challenge; delete out.idea;
      rows.push(out);
    }
  }
  return rows;
}
function served(full) {
  const copy = JSON.parse(JSON.stringify(full));
  copy.rounds.forEach((r) => r.challenges.forEach((c) => { delete c.check; if (c.kind === "checkpoint") delete c.solution; }));
  if (copy.kind === "exam") copy.dictionary = dictionaryUpTo(copy.number);
  copy.data_values = copy.data_values || {};
  copy.data_label = "Simulated data made for this game: no real jars, no real springtails.";
  return copy;
}
const LIST = [
  { id: "lesson1", number: 1, title: "L1" }, { id: "exam1", number: 1, title: "E1", kind: "exam" },
  { id: "lesson2", number: 2, title: "L2" }, { id: "exam2", number: 2, title: "E2", kind: "exam" },
  { id: "exam6", number: 6, title: "E6", kind: "exam" }, { id: "range", kind: "range", number: null, title: "Target range" },
];

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    get length() { return m.size; }, key: (i) => Array.from(m.keys())[i] };
}
// A fake server: a run passes when it is the step's own solution; a pass carries the move, as the engine's does.
function setup(def, opts) {
  const o = opts || {};
  const sent = [], saves = [];
  const answers = {};
  flat(def).forEach((c) => { answers[c.id] = c.solution; });
  let ctrl;
  ctrl = lesson.createController({
    lessonId: def.id, storage: o.storage || memoryStorage(), attempt: o.attempt,
    onExamPass: (record, code) => { saves.push({ record, code }); return o.saveResult === undefined ? true : o.saveResult; },
    send: (msg) => {
      sent.push(msg);
      if (msg.type === "lesson_list") ctrl.handle({ type: "lessons", lessons: LIST });
      else if (msg.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: msg.request_id, lesson: served(def) });
      else if (msg.type === "lesson_run") {
        const c = flat(def).find((x) => x.id === msg.challenge);
        const pass = msg.code.trim() === String(answers[msg.challenge]).trim();
        const r = { type: "lesson_result", request_id: msg.request_id, challenge: msg.challenge, status: "ok", value_repr: "5", value_table: null, stdout: "", pass, feedback: pass ? "Good." : "Not yet." };
        if (pass && c.check && MOVE_OF[c.check.checker]) r.exam = { chapter: MOVE_OF[c.check.checker][0], move_id: MOVE_OF[c.check.checker][1], row_count: 6 };
        ctrl.handle(r);
      }
    },
  });
  ctrl.open();
  return { ctrl, sent, saves, answers };
}
// A made-up exam with two moves and one hint each, for the parts one real file cannot show.
const twoStep = () => ({
  id: "exam2", kind: "exam", chapter: "C2", number: 2, title: "Count by tray", goal: "g", story: "s", setup: "case2",
  rounds: [
    { id: "r1", title: "Group", challenges: [{ id: "t-g", kind: "checkpoint", prompt: "p", starter: "", solution: "groupby(jars, :tray_id)", check: { same_value: false, checker: "check_exam2_group" }, hints: ["one"] }] },
    { id: "r2", title: "Count", challenges: [{ id: "t-c", kind: "checkpoint", prompt: "p", starter: "", solution: "combine(x)", check: { same_value: false, checker: "check_exam2_counts" }, hints: ["one", "two"] }] },
  ],
  close: { finding: "the finding", next: "n" },
});

test("there is at least one exam file, and every exam file is kind exam", () => {
  assert.ok(examFiles.length >= 1, "lessons/exam1.json exists");
  for (const f of examFiles) assert.equal(read(f).kind, "exam", f);
});

for (const f of examFiles) {
  const def = read(f);
  test(`${f}: exam screen has no worked example, no Show me the line, no test-out; the dictionary of Lessons 1 to ${def.number} is present (collapsed, one click away); at most one hint`, () => {
    const { ctrl } = setup(def);
    let v = ctrl.view();
    assert.equal(v.screen, "start");
    assert.equal(v.lesson.heading, "Chapter " + def.number + ": " + def.title);
    assert.equal(v.lesson.name, "Chapter " + def.number);
    ctrl.start();
    const want = dictionaryUpTo(def.number).map((r) => r.julia);
    assert.ok(want.length > 0, "Lessons 1 to N have dictionary rows");
    for (const c of flat(def)) {
      v = ctrl.view();
      assert.equal(v.screen, "challenge");
      assert.equal(v.ch.id, c.id);
      assert.equal(v.strip.text, "Step " + def.number + " of 6 · Chapter " + def.number, "named for the chapter, in the bar");
      assert.doesNotMatch(v.strip.text, /Lesson|Round/);
      assert.equal(v.ch.pinned, null, "no worked example");
      assert.equal(v.ch.testOut.available, false, "no test-out");
      // the whole dictionary of Lessons 1 to N: this chapter's lesson first, the earlier lessons under a fold
      assert.deepEqual(v.ch.dictionary.map((r) => r.julia).concat(v.ch.dictEarlier.map((r) => r.julia)).sort(), want.slice().sort(), "the whole dictionary of Lessons 1 to N");
      assert.ok(v.ch.dictionary.every((r) => r.lesson === def.number), "this lesson's rows first");
      assert.ok(v.ch.dictEarlier.every((r) => r.lesson < def.number), "earlier rows under the fold");
      assert.ok(v.ch.dictionary.length > 0, "the chapter opens on its own lesson's rows");
      assert.equal(v.ch.dictClosed, true, "and it starts collapsed (one click opens it)");
      for (let i = 0; i < 4; i++) ctrl.run("wrong_" + i);
      v = ctrl.view();
      assert.equal(v.ch.showLine, false, "no Show me the line, even after four misses");
      assert.equal(ctrl.showLine(), "", "and it cannot be forced");
      assert.ok(v.ch.hintsTotal <= 1, "at most one hint");
      ctrl.hint(); ctrl.hint(); ctrl.hint();
      assert.ok(ctrl.view().ch.hints.length <= 1);
      ctrl.run(c.solution);
      assert.equal(ctrl.view().ch.nextEnabled, true);
      ctrl.next();
    }
    v = ctrl.view();
    assert.equal(v.screen, "end");
    assert.equal(v.end.finding, def.close.finding, "the end screen shows the chapter payoff");
  });
}

test("exam mode: a made-up exam with two moves and a two-hint step still offers one hint, and counts steps across the exam", () => {
  const { ctrl } = setup(twoStep());
  ctrl.start();
  assert.equal(ctrl.view().strip.text, "Step 2 of 6 · Chapter 2");
  assert.equal(ctrl.view().strip.line, "Task 1 of 2");
  ctrl.run("groupby(jars, :tray_id)"); ctrl.next();
  assert.equal(ctrl.view().strip.line, "Task 2 of 2", "a chapter counts its tasks across the chapter");
  ctrl.run("x");
  assert.equal(ctrl.view().ch.hintsTotal, 1);
  ctrl.hint(); ctrl.hint();
  assert.deepEqual(ctrl.view().ch.hints.map((h) => h.text), ["one"]);
  assert.equal(ctrl.view().ch.hints[0].label, "Hint: the idea", "one naming scheme: the chapter hint says what it gives (P12)");
});

// ---- 0.5 first-look fixes (docs/dev-log/course/0.5-fix-spec.md) ----
test("a chapter's dictionary names the chapter's own table: logbook.batch_id becomes jars.batch_id, a named result is never renamed", () => {
  const def = Object.assign(twoStep(), { id: "exam2", number: 2 });
  const jarsTable = { columns: ["jar_id", "batch_id", "tray_id", "detected"], rows: [["J-1", "B09", "T-A", true]] };
  def.rounds[0].challenges[0].data = "jars";
  let ctrl;
  ctrl = lesson.createController({ lessonId: "exam2", storage: memoryStorage(), send: (m) => {
    if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: Object.assign(served(def), { data_values: { jars: jarsTable } }) });
  } });
  ctrl.open(); ctrl.start();
  const v = ctrl.view();
  const all = v.ch.dictionary.concat(v.ch.dictEarlier).map((r) => r.julia);
  assert.ok(all.includes("jars.batch_id"), "Lesson 1's logbook.batch_id is shown on jars");
  assert.ok(all.includes("combine(groupby(jars, :tray_id), nrow => :n)"), "a new column name after => is not a column the table must have");
  assert.ok(all.includes("tray = jars[jars.tray_id .== \"T-A\", :]"), "practice_jars becomes jars; tray, a name the row gives, stays");
  assert.ok(all.includes("sum(tray.detected)"));
  assert.ok(!all.some((j) => /logbook|practice_jars/.test(j)), "no practice table name is left");
  const r = v.ch.dictEarlier.find((x) => x.julia === "jars.batch_id");
  assert.equal(r.r, "jars$batch_id", "the In R column follows");
  assert.equal(v.ch.dictEarlierFrom, "Lesson 1");
  assert.ok(v.ch.dictionary.every((x) => x.lesson === 2), "Lesson 2's rows come first");
});

test("P09: a chapter's dictionary shows the In Python column too, renamed to the chapter's own table", () => {
  const def = Object.assign(twoStep(), { id: "exam2", number: 2 });
  const jarsTable = { columns: ["jar_id", "batch_id", "tray_id", "detected"], rows: [["J-1", "B09", "T-A", true]] };
  def.rounds[0].challenges[0].data = "jars";
  let ctrl;
  ctrl = lesson.createController({ lessonId: "exam2", storage: memoryStorage(), send: (m) => {
    if (m.type !== "lesson_info") return;
    const L = Object.assign(served(def), { data_values: { jars: jarsTable } });
    L.dictionary = L.dictionary.map((row) => (row.julia === "logbook.batch_id" ? Object.assign({}, row, { py: "logbook[\"batch_id\"]" }) : row));
    ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: L });
  } });
  ctrl.open(); ctrl.start();
  const v = ctrl.view();
  const r = v.ch.dictEarlier.concat(v.ch.dictionary).find((x) => x.julia === "jars.batch_id");
  assert.equal(r.py, "jars[\"batch_id\"]", "the In Python column follows the rename");
  assert.deepEqual(v.show, { r: true, py: true }, "both columns show by default on a chapter");
});

test("a chapter's dictionary leaves a table alone when the rows use a column the chapter's table does not have", () => {
  const def = Object.assign(twoStep(), { id: "exam3", number: 3 });
  def.rounds[0].challenges[0].data = "joined";
  const joined = { columns: ["tray_id", "notebook_detected", "sheet_detected", "entry_status"], rows: [] };
  let ctrl;
  ctrl = lesson.createController({ lessonId: "exam3", storage: memoryStorage(), send: (m) => {
    if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: Object.assign(served(def), { data_values: { joined } }) });
  } });
  ctrl.open(); ctrl.start();
  const all = ctrl.view().ch.dictionary.concat(ctrl.view().ch.dictEarlier).map((r) => r.julia);
  assert.ok(all.includes("logbook.batch_id"), "batch_id is not a column of joined, so logbook stays");
  assert.ok(all.includes("df[df.a .!= df.b, :]") || all.some((j) => /df\.a/.test(j)), "df, a table the row makes itself, stays");
});

test("the chapter start card: its place, the fixed sentence above Start, and Continue with Start again once begun", () => {
  const storage = memoryStorage();
  const a = setup(twoStep(), { storage });
  let v = a.ctrl.view();
  assert.equal(v.lesson.place, "Chapter 2 · 2 tasks", "a chapter counts tasks, not rounds, and the bar already says Step 2 of 6");
  assert.equal(v.lesson.chapterLine, "This is the case notebook (made up for this game). You write the lines yourself. You can ask for one piece of help: a hint or a starter line.");
  assert.equal(v.lesson.startLabel, "Start");
  assert.equal(v.lesson.canRestart, false);
  a.ctrl.start(); a.ctrl.run("groupby(jars, :tray_id)");
  const b = setup(twoStep(), { storage });
  v = b.ctrl.view();
  assert.equal(v.screen, "start", "a chapter already begun opens on its start card");
  assert.equal(v.lesson.startLabel, "Continue");
  assert.equal(v.lesson.canRestart, true, "Start again sits inside the start card");
  assert.equal(v.lesson.resume, "You stopped at task 2 of 2.");
  b.ctrl.start();
  assert.equal(b.ctrl.view().ch.id, "t-c");
  const l = setup(read("lesson1.json")).ctrl.view();
  assert.equal(l.lesson.chapterLine, "", "a lesson card has no chapter sentence");
  assert.match(l.lesson.place, /^Lesson 1 · \d rounds/);
});

test("a chapter whose data is not the case notebook says so in its own banner (round 3: Chapter 5 is Toto's card deals)", () => {
  for (const n of [5, 6]) {
    const L = read("exam" + n + ".json");
    assert.ok(L.banner, "exam" + n + " carries a banner");
    assert.equal(setup(L).ctrl.view().lesson.chapterLine, L.banner);
  }
});

test("Show a starter line: shown on a chapter step that has one, and it is the chapter's one hint", () => {
  const def = twoStep();
  def.rounds[0].challenges[0].starter_hint = "groupby(jars, ___)";
  def.rounds[0].challenges[0].hints = ["one"];
  const { ctrl } = setup(def);
  ctrl.start();
  let c = ctrl.view().ch;
  assert.equal(c.starter.available, false, "not offered before the first run");
  ctrl.run("x");
  assert.equal(ctrl.view().ch.starter.available, false, "nor after one miss: the starter line waits for two");
  assert.equal(ctrl.showStarter(), "", "and the controller refuses it too");
  ctrl.run("x");
  c = ctrl.view().ch;
  assert.equal(c.starter.available, true, "offered after two misses");
  assert.equal(c.starter.shown, "");
  assert.equal(ctrl.showStarter(), "groupby(jars, ___)");
  c = ctrl.view().ch;
  assert.equal(c.starter.shown, "groupby(jars, ___)");
  assert.equal(c.starter.available, true, "the button keeps its place (P26)");
  assert.equal(c.helpUsed, true, "switched off: it was the one piece of help");
  assert.equal(ctrl.showStarter(), "", "and it cannot be used twice");
  // P26: the hint button stays in its place, switched off, with a line that says why (buttons never vanish or move)
  assert.equal(ctrl.view().ch.hintsAvailable, true, "the hint box keeps its place");
  assert.equal(ctrl.view().ch.helpUsed, true, "the starter line was the one piece of help");
  assert.equal(ctrl.view().ch.helpNote, "You have used this task's one piece of help.");
  ctrl.hint();
  assert.equal(ctrl.view().ch.hints.length, 0);
  // the other way round: a hint first, then no starter line
  const b = setup(def).ctrl; b.start(); b.run("x"); b.run("x"); b.hint();
  assert.equal(b.view().ch.hints.length, 1);
  assert.equal(b.view().ch.starter.available, true, "the starter button keeps its place");
  assert.equal(b.view().ch.helpUsed, true, "switched off");
  assert.equal(b.showStarter(), "");
  // a step with no starter_hint offers none
  b.run("groupby(jars, :tray_id)"); b.next();
  assert.equal(b.view().ch.starter.available, false);
});

test("an error names the unknown word from Julia's message instead of the plain fallback line", () => {
  const def = twoStep();
  let ctrl;
  ctrl = lesson.createController({ lessonId: def.id, storage: memoryStorage(), send: (m) => {
    if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: served(def) });
    if (m.type === "lesson_run") ctrl.handle({ type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "error", pass: false,
      value_repr: "", feedback: "Julia could not run this. Check the names and brackets against the pocket dictionary on the left.",
      message: m.code === "x" ? "UndefVarError: `x` not defined" : "ArgumentError: column name \"trays\" not found in the data frame" });
  } });
  ctrl.open(); ctrl.start();
  ctrl.run("x");
  assert.equal(ctrl.view().ch.feedback, "Julia does not know the name x. Check its spelling against the table names and the pocket dictionary.");
  assert.equal(ctrl.view().ch.feedbackTone, "alert", "an error is styled as an alert");
  ctrl.run("jars.trays");
  assert.match(ctrl.view().ch.feedback, /no column called trays/);
});

test("exam mode reaches exams only: a lesson keeps its worked example, its test-out and its two hints", () => {
  const def = read("lesson2.json");
  const { ctrl } = setup(def);
  ctrl.start();
  const v = ctrl.view();
  assert.equal(v.strip.text, "Step 2 of 6 · Lesson 2 · Round 1 of " + def.rounds.length);
  assert.equal(v.ch.dictClosed, true);
  assert.equal(v.lesson.heading, def.title);
  const cp = flat(def).find((c) => c.kind === "checkpoint");
  assert.equal(cp.hints.length, 2);
});

test("a pass is handed to the save hook with the move and the code; a failed save says so under the pass line", () => {
  const def = read("exam1.json");
  const a = setup(def);
  a.ctrl.start();
  a.ctrl.run("nope");
  assert.equal(a.saves.length, 0, "a miss saves nothing");
  const c = flat(def)[0];
  a.ctrl.run(c.solution);
  assert.deepEqual(a.saves, [{ record: { chapter: "C1", move_id: "select-records", row_count: 6 }, code: c.solution }]);
  assert.equal(a.ctrl.view().ch.worksToo, "");
  const b = setup(def, { saveResult: false });
  b.ctrl.start(); b.ctrl.run(c.solution);
  assert.match(b.ctrl.view().ch.worksToo, /could not save it/);
  assert.equal(b.ctrl.view().ch.nextEnabled, true, "the step still counts on this screen");
  // a lesson pass never calls the exam save, even if a reply carried a move
  const l = setup(read("lesson1.json"));
  l.ctrl.start(); l.ctrl.run(flat(read("lesson1.json"))[0].solution);
  assert.equal(l.saves.length, 0);
});

test("end screens: a lesson leads to its chapter exam; an exam leads to the next lesson; Chapter 6 leads to the ending", () => {
  const finish = (ctrl, def) => { ctrl.start(); for (const c of flat(def)) { if (c.predict) ctrl.predict(0); if (c.kind !== "play") ctrl.run(c.solution); ctrl.next(); } return ctrl.view(); };
  // Lesson 1: the main action is Chapter 1's exam, and it is the only forward route (P04)
  const l1 = read("lesson1.json");
  let v = finish(setup(l1).ctrl, l1);
  assert.equal(v.screen, "end");
  assert.deepEqual(v.end.go, { label: "Continue: Chapter 1", href: "lesson.html?lesson=exam1" });
  assert.equal(v.end.nextLesson, undefined, "no second route that skips the chapter");
  // the attempt travels with the link
  v = finish(setup(l1, { attempt: "class-a" }).ctrl, l1);
  assert.equal(v.end.go.href, "lesson.html?lesson=exam1&attempt=class-a");
  // Exam 1: on to Lesson 2
  const e1 = read("exam1.json");
  v = finish(setup(e1).ctrl, e1);
  assert.deepEqual(v.end.go, { label: "Continue: Lesson 2", href: "lesson.html?lesson=lesson2" });
  // the last chapter: the ending
  const e6 = Object.assign(twoStep(), { id: "exam6", number: 6, chapter: "C6" });
  v = finish(setup(e6).ctrl, e6);
  assert.deepEqual(v.end.go, { label: "See how the case ends", href: "course/ending.html" });
  v = finish(setup(e6, { attempt: "class-a" }).ctrl, e6);
  assert.equal(v.end.go.href, "course/ending.html?attempt=class-a");
  // a lesson with no chapter (the dummy is Lesson 7) has no exam link
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/lesson-dummy.json"), "utf8"));
  const dctrl = setup(d).ctrl; dctrl.start();
  while (dctrl.view().screen === "challenge") { const ch = dctrl.view().ch; if (ch.predict && ch.predict.guess === null) dctrl.predict(0); if (ch.kind !== "play") dctrl.run(flat(d).find((x) => x.id === ch.id).solution); dctrl.next(); }
  assert.equal(dctrl.view().end.go, null);
});

test("an exam's progress never opens a target range wave, and never counts as a lesson", () => {
  const storage = memoryStorage();
  storage.setItem(lesson.STORE_PREFIX + "exam6", JSON.stringify({ started: true, lastCheckpointDone: true }));
  const range = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/range-dummy.json"), "utf8"));
  let ctrl;
  ctrl = lesson.createController({ lessonId: "range", storage, send: (m) => { if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: range }); } });
  ctrl.open();
  assert.ok(ctrl.view().range.waves.every((w) => w.locked), "exam 6 opens no wave");
});

// ---- On the page (web/lesson.html + web/lesson.js + web/lesson-exam-save.js + web/course/course-state.js) ----
class FNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.hidden = false; this.value = ""; this.disabled = false; this.open = true; this.className = ""; this.parentNode = null; this.scrollHeight = 0; this.clientHeight = 0; this.scrollTop = 0; this._text = ""; }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() { const p = this.parentNode; return p ? p.children[p.children.indexOf(this) + 1] || null : null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); c.parentNode = null; return c; }
  insertBefore(n, ref) { n.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(n); else this.children.splice(i, 0, n); return n; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this.className = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  click() { (this.listeners.click || []).forEach((f) => f({})); }
  focus() {}
  get textContent() { return this.tag === "#text" ? this._text : this._text + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = String(v); }
  all() { return this.children.reduce((a, c) => a.concat(c, c.all()), []); }
}
function fakePage(storage, def, search) {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const byId = {};
  [...html.matchAll(/\sid="([^"]+)"/g)].forEach((m) => { byId[m[1]] = new FNode("div"); });
  Object.keys(byId).forEach((id) => { if (/hidden/.test(html.match(new RegExp('<[^>]*id="' + id + '"[^>]*>'))[0])) byId[id].hidden = true; });
  const answers = {}; flat(def).forEach((c) => { answers[c.id] = c.solution; });
  class WS {
    constructor() { this.readyState = 0; this.l = {}; Promise.resolve().then(() => { this.readyState = 1; (this.l.open || []).forEach((f) => f({})); }); }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    close() {}
    send(text) {
      const m = JSON.parse(text); let out = null;
      if (m.type === "lesson_list") out = { type: "lessons", lessons: LIST };
      if (m.type === "lesson_info") out = { type: "lesson", request_id: m.request_id, lesson: served(def) };
      if (m.type === "lesson_run") {
        const c = flat(def).find((x) => x.id === m.challenge);
        const pass = m.code.trim() === answers[m.challenge];
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", value_repr: "5", pass, feedback: pass ? "Good." : "Not yet." };
        // a twist step has no checker and saves no chapter move
        if (pass && c.check.checker) out.exam = { chapter: MOVE_OF[c.check.checker][0], move_id: MOVE_OF[c.check.checker][1], row_count: 6 };
      }
      (this.l.message || []).forEach((f) => f({ data: JSON.stringify(out) }));
    }
  }
  const win = { localStorage: storage, location: { search: search || "?lesson=" + def.id, host: "x", href: "" }, WebSocket: WS, addEventListener() {}, innerWidth: 1366,
    confirm: () => true, print() {}, navigator: {}, JuliaTimeCourseState: courseState, JuliaTimeLessonExamSave: examSave };
  const doc = { defaultView: win, getElementById: (id) => byId[id], createElement: (t) => new FNode(t), createTextNode: (t) => { const n = new FNode("#text"); n._text = t; return n; } };
  return { doc, byId, win };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test("on the page: exam 1 has no pinned card, no Show me the line, a collapsed dictionary, one hint button; a pass is saved for the Board", async () => {
  const def = read("exam1.json");
  const storage = memoryStorage();
  const page = fakePage(storage, def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("start-title").textContent, "Chapter 1: " + def.title);
  assert.equal($("strip-text").textContent, "Step 1 of 6 · Chapter 1");
  assert.equal($("start-chapter").textContent, "This is the case notebook (made up for this game). You write the lines yourself. You can ask for one piece of help: a hint or a starter line.");
  assert.equal($("start-chapter").hidden, false, "the fixed chapter sentence sits above Start");
  $("start").click();
  assert.equal($("strip-text").textContent, "Step 1 of 6 · Chapter 1");
  assert.equal($("board-link").attrs.href, "course/index.html", "the bar links to the Board");
  assert.equal($("brand").attrs.href, "course/index.html");
  assert.equal($("pinned").hidden, true, "no worked example card");
  assert.equal($("dict").hidden, false, "the dictionary is shown");
  assert.equal($("dict").open, false, "collapsed, one click opens it");
  assert.equal($("dict-body").children.length, dictionaryUpTo(1).length);
  assert.equal($("dict-earlier").hidden, true, "Chapter 1 has no earlier lessons to fold");
  assert.equal($("testout").hidden, true);
  $("code").value = "nope"; $("run").click(); $("code").value = "nope"; $("run").click(); $("run").click();
  assert.equal($("show-line").hidden, true, "no Show me the line after misses");
  const hintButtons = () => $("hints").all().filter((n) => n.tag === "button");
  assert.deepEqual(hintButtons().map((b) => b.textContent), ["Hint: the idea"]);
  hintButtons()[0].click();
  assert.equal($("hints").all().filter((n) => n.tag === "p" && n.className === "hint").length, 1);
  assert.equal(hintButtons().length, 0, "no second hint");
  assert.equal($("starter").hidden, false, "the starter button keeps its place");
  assert.equal($("starter").disabled, true, "switched off: the one help is used");
  assert.equal($("help-note").textContent, "You have used this task's one piece of help.");
  // the pass, saved through course-state.js exactly as chapter 1 saves it
  $("code").value = flat(def)[0].solution; $("run").click();
  assert.equal(courseState.hasSavedMove(storage, "", "C1", "select-records"), true);
  assert.equal(courseState.readAcceptedCode(storage, "")["C1/select-records"], flat(def)[0].solution);
  assert.deepEqual(courseState.readCursor(storage, ""), { chapter: "C2", move_id: "group", mode: "challenge" });
  $("next").click();
  // Chapter 1's twist step (Shinichi, 30 Sep): one more question on the real data, then the end screen
  $("code").value = flat(def)[1].solution; $("run").click();
  $("next").click();
  assert.equal($("end-title").textContent, "Chapter 1 done");
  assert.equal($("end-finding").textContent, def.close.finding);
  const go = $("end-go").all().find((n) => n.tag === "button");
  assert.equal(go.textContent, "Continue: Lesson 2");
  assert.equal(go.className, "primary");
  go.click();
  assert.equal(page.win.location.href, "lesson.html?lesson=lesson2");
  assert.equal($("end-next").all().find((n) => n.tag === "a"), undefined, "after an exam the main action is the only way on");
});

test("a twist step saves no move of its own, and the Board still counts the exam: the chapter move saves on the step before it", async () => {
  for (const [file, chapter, moveId] of [["exam1.json", "C1", "select-records"], ["exam6.json", "C6", "compatible-models"]]) {
    const def = read(file), steps = flat(def);
    const twist = steps.findIndex((c) => !c.check.checker);
    assert.ok(twist > 0, file + ": the twist comes after the step that carries the chapter move");
    assert.equal(steps.filter((c) => !c.check.checker).length, 1, file + ": one twist");
    const storage = memoryStorage(), page = fakePage(storage, def);
    lesson.init(page.doc); await tick();
    page.byId.start.click();
    for (let i = 0; i < twist; i++) { page.byId.code.value = steps[i].solution; page.byId.run.click(); page.byId.next.click(); }
    assert.equal(courseState.hasSavedMove(storage, "", chapter, moveId), true, file + ": the move is saved before the twist");
    page.byId.code.value = steps[twist].solution; page.byId.run.click();
    assert.equal(courseState.hasSavedMove(storage, "", chapter, moveId), true, file + ": passing the twist keeps it saved");
    assert.equal(page.byId["works-too"].textContent.indexOf("could not save"), -1, file + ": no false 'not saved' note");
  }
});

test("on the page: the lesson list names an exam by its chapter", async () => {
  const page = fakePage(memoryStorage(), read("exam1.json"), "?");
  lesson.init(page.doc); await tick();
  const links = page.byId["lesson-list"].all().filter((n) => n.tag === "a").map((n) => n.textContent);
  assert.deepEqual(links, ["Lesson 1: L1", "Chapter 1: E1", "Lesson 2: L2", "Chapter 2: E2", "Chapter 6: E6"]);
});

test("on the page: a lesson's end screen says Continue: Chapter N, and it is the one forward route (P04)", async () => {
  const def = read("lesson1.json");
  const storage = memoryStorage();
  // a finished lesson opens on its end screen
  const done = {}; flat(def).forEach((c) => { done[c.id] = { code: c.solution || "" }; });
  storage.setItem(lesson.STORE_PREFIX + "lesson1", JSON.stringify({ started: true, done }));
  const page = fakePage(storage, def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("end-title").textContent, "Lesson 1 done");
  const go = $("end-go").all().find((n) => n.tag === "button");
  assert.equal(go.textContent, "Continue: Chapter 1");
  assert.equal(go.attrs["data-href"], "lesson.html?lesson=exam1");
  // exactly one link or button leads on to a lesson or chapter; the others go to the Board, the range, or stay here
  const drawn = $("end-go").all().concat($("end-next").all());
  const forward = drawn.filter((n) => (n.tag === "a" && /lesson=(lesson|exam)/.test(n.attrs.href || "")) || (n.tag === "button" && /lesson=(lesson|exam)/.test(n.attrs["data-href"] || "")));
  assert.equal(forward.length, 1, "one forward route");
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const endHtml = html.slice(html.indexOf('id="screen-end"'), html.indexOf('id="screen-range-end"'));
  assert.doesNotMatch(endHtml, /lesson=(lesson|exam)/, "the page itself holds no other link to a lesson or chapter");
});

// ---- exam progress is per attempt (review 0.5, item 5) ----
test("exam progress is kept per attempt: attempt B opens fresh and its pass saves for B", () => {
  const def = read("exam1.json");
  const storage = memoryStorage();
  const c = flat(def)[0];
  const a = setup(def, { storage, attempt: "att-a" });
  a.ctrl.start(); a.ctrl.run(c.solution);
  assert.equal(a.saves.length, 1, "attempt A saved its pass");
  const b = setup(def, { storage, attempt: "att-b" });
  assert.notEqual(b.ctrl.view().screen, "end", "attempt B does not open as already solved");
  b.ctrl.start(); b.ctrl.run(c.solution);
  assert.equal(b.saves.length, 1, "attempt B saved its own pass");
  const again = setup(def, { storage, attempt: "att-a" });
  assert.equal(again.saves.length, 0);
  assert.ok(storage.getItem(lesson.STORE_PREFIX + "exam1:attempt:att-a") && storage.getItem(lesson.STORE_PREFIX + "exam1:attempt:att-b"));
  // no attempt keeps the old key
  const n = setup(def, { storage: memoryStorage() });
  n.ctrl.start(); n.ctrl.run(c.solution);
  assert.ok(n.ctrl.view());
});

test("Board walk: the exam's Case tick follows the attempt, and attempt B is sent to the exam again", () => {
  const cs = require("../web/course/course-state.js");
  const cl = require("../web/course/course-client.js");
  const storage = memoryStorage();
  for (const n of [1, 2, 3, 4, 5, 6]) storage.setItem("julia-time:lesson:v1:lesson" + n, JSON.stringify({ lastCheckpointDone: true }));
  cs.recordHistoricalMoveIfMissing(storage, "att-a", "C1", "select-records");
  const model = (att) => cl.courseWalk(cl.buildBoardModel ? cl.buildBoardModel(storage, att) : { cards: [1, 2, 3, 4, 5, 6].map((n) => ({ chapter: "C" + n, done: cs.hasSavedMove(storage, att, "C" + n, ({ 1: "select-records" })[n] || "x") })), startWithIntro: false }, cl.lessonProgress(storage), att);
  assert.equal(model("att-a").rows[0].caseDone, true);
  const b = model("att-b");
  assert.equal(b.rows[0].caseDone, false);
  assert.match(b.next.href, /lesson=exam1&attempt=att-b/);
  // attempt B passes the exam: its save lands under B, and B's Case tick shows
  const def = read("exam1.json");
  const c = flat(def)[0];
  let save = null;
  let ctrl;
  ctrl = lesson.createController({ lessonId: "exam1", storage, attempt: "att-b", onExamPass: (rec, code) => { save = rec; return examSave.saveExamPass(cs, storage, "att-b", rec, code); },
    send: (m) => {
      if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: served(def) });
      else if (m.type === "lesson_run") ctrl.handle({ type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", value_repr: "5", value_table: null, stdout: "", pass: true, feedback: "Good.", exam: { chapter: "C1", move_id: "select-records", row_count: 6 } });
    } });
  ctrl.open(); ctrl.start(); ctrl.run(c.solution);
  assert.ok(save, "the pass reached the save hook");
  assert.equal(cs.hasSavedMove(storage, "att-b", "C1", "select-records"), true);
  assert.equal(model("att-b").rows[0].caseDone, true);
});

// ---- fix round 2 (P04, P26) ------------------------------------------------------------------------------------
test("P04: every end page's main label is 'Continue: Lesson N', 'Continue: Chapter N' or 'See how the case ends'", () => {
  const finish = (ctrl, def) => { ctrl.start(); for (const c of flat(def)) { if (c.predict) ctrl.predict(0); if (c.kind !== "play") ctrl.run(c.solution); ctrl.next(); } return ctrl.view(); };
  const real = lessonFiles.concat(examFiles);
  assert.ok(real.length >= 2);
  for (const f of real) {
    const def = read(f);
    const v = finish(setup(def).ctrl, def);
    assert.equal(v.screen, "end", f);
    if (!v.end.go) continue;                    // a lesson whose next step is not in the fake list
    assert.match(v.end.go.label, /^(Continue: (Lesson|Chapter) [1-6]|See how the case ends)$/, f + ": " + v.end.go.label);
    assert.equal(v.end.nextLesson, undefined, f + ": no second forward route");
  }
});

test("P26: on every chapter task a wrong run offers the one help (a hint or a starter line) until it is used", () => {
  for (const f of examFiles) {
    const def = read(f);
    const { ctrl } = setup(def);
    ctrl.start();
    flat(def).forEach((c, i) => {
      ctrl.state.index = i; ctrl.state.screen = "challenge";
      ctrl.run("wrong_line");
      const ch = ctrl.view().ch;
      assert.ok(ch.hintsAvailable || ch.starter.available, f + " " + c.id + ": help offered after a wrong run");
      assert.equal(ch.helpUsed, false, f + " " + c.id);
      ctrl.run("wrong_again");
      assert.ok(ctrl.view().ch.hintsAvailable || ctrl.view().ch.starter.available, f + " " + c.id + ": still offered after a second miss");
      if (ch.hintsAvailable) { ctrl.hint(); assert.equal(ctrl.view().ch.hints.length, 1, f + " " + c.id); assert.equal(ctrl.view().ch.helpUsed, true); }
      ctrl.run(c.solution);
      ctrl.state.starter = false; ctrl.state.hints = 0;
    });
  }
});

test("P05, round 4 R3-37: a chapter's end page lists every passed line as a chapter line, none under practice lines", () => {
  const def = read("exam1.json");
  const { ctrl } = setup(def);
  ctrl.start();
  for (const c of flat(def)) { ctrl.run(c.solution); ctrl.next(); }
  const v = ctrl.view();
  assert.equal(v.screen, "end");
  const main = v.end.lines.filter((l) => l.caseLine).map((l) => l.code);
  const practice = v.end.lines.filter((l) => !l.caseLine).map((l) => l.code);
  assert.deepEqual(main, flat(def).map((c) => c.solution), "the second task of a chapter is chapter work too");
  assert.deepEqual(practice, [], "no 'Practice lines' on a chapter's end page");
  assert.equal(v.end.skills.length, 0, "no 'Skills from Lesson N' on a chapter end page (P05)");
});

test("r4: a chapter's dictionary renames table names inside code only, never in a sentence", () => {
  const def = Object.assign(twoStep(), { id: "exam2", number: 2 });
  const jarsTable = { columns: ["jar_id", "batch_id", "tray_id", "detected"], rows: [["J-1", "B09", "T-A", true]] };
  def.rounds[0].challenges[0].data = "jars";
  let ctrl;
  ctrl = lesson.createController({ lessonId: "exam2", storage: memoryStorage(), send: (m) => {
    if (m.type !== "lesson_info") return;
    const L = Object.assign(served(def), { data_values: { jars: jarsTable } });
    L.dictionary = L.dictionary.map((row) => (row.julia === "logbook.batch_id"
      ? Object.assign({}, row, { means: "the logbook lists each batch; `logbook.batch_id` is its batch column" }) : row));
    ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: L });
  } });
  ctrl.open(); ctrl.start();
  const v = ctrl.view();
  const r = v.ch.dictEarlier.concat(v.ch.dictionary).find((x) => x.julia === "jars.batch_id");
  assert.equal(r.means, "the logbook lists each batch; `jars.batch_id` is its batch column");
});

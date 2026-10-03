"use strict";
// Lesson screen: a controller driven by a fake socket that answers from the dummy fixture.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lesson = require("../web/lesson.js");

const root = path.join(__dirname, "..");
// The screen's code: web/lesson.js and the target range it calls (web/lesson-range.js).
const guessLineSrc = () => { const s = fs.readFileSync(path.join(root, "web/lesson.js"), "utf8"); const a = s.indexOf("function guessLine("); return s.slice(a, s.indexOf("\n    }\n", a)); };
const screenSrc = () => ["web/lesson.js", "web/lesson-range.js", "web/julia-text.js"].map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
const dummyFull = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/lesson-dummy.json"), "utf8"));

// What the server sends: checkpoint solutions and every check object removed.
function served(full) {
  const copy = JSON.parse(JSON.stringify(full));
  copy.rounds.forEach((r) => r.challenges.forEach((c) => { delete c.check; if (c.kind === "checkpoint") delete c.solution; }));
  return copy;
}
const answers = {};
dummyFull.rounds.forEach((r) => r.challenges.forEach((c) => { answers[c.id] = c.solution; }));

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    get length() { return m.size; }, key: (i) => Array.from(m.keys())[i] };
}

function setup(storage, lessonId) {
  const sent = [];
  let ctrl;
  const send = (msg) => {
    sent.push(msg);
    if (msg.type === "lesson_list") ctrl.handle({ type: "lessons", lessons: [{ id: "dummy", number: 7, title: dummyFull.title }] });
    else if (msg.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: msg.request_id, lesson: served(dummyFull) });
    else if (msg.type === "lesson_run") {
      const pass = msg.code.trim() === answers[msg.challenge];
      const reply = { type: "lesson_result", request_id: msg.request_id, challenge: msg.challenge, status: "ok",
        value_repr: pass ? "5" : "0", value_table: null, stdout: "", pass, feedback: pass ? "Good." : "Not yet." };
      if (msg.code.startsWith("bad(")) { reply.status = "error"; reply.value_repr = ""; reply.message = "UndefVarError: bad not defined"; reply.feedback = ""; }
      if (msg.challenge === "d-r2-c2") reply.picked_ids = pass ? ["J01", "J05", "J06"] : [];
      ctrl.handle(reply);
    }
  };
  ctrl = lesson.createController({ send, storage: storage || memoryStorage(), lessonId: lessonId === undefined ? "dummy" : lessonId });
  ctrl.open();
  return { ctrl, sent };
}
// A worked line that asks for a guess needs one before Run; the helper guesses the first button.
const runOk = (ctrl) => { const ch = ctrl.view().ch; if (ch.predict && ch.predict.guess === null) ctrl.predict(0); ctrl.run(answers[ch.id]); };
// pass every challenge from here to the end (a play challenge only needs Next)
function finishAll(ctrl) {
  while (ctrl.view().screen === "challenge") { if (ctrl.view().ch.kind !== "play") runOk(ctrl); ctrl.next(); }
}
const runBad = (ctrl) => ctrl.run("nothing_here");

test("start screen carries title, goal, story and the story link data", () => {
  const { ctrl } = setup();
  const v = ctrl.view();
  assert.equal(v.screen, "start");
  assert.equal(v.lesson.title, "Sort the marbles");
  assert.match(v.lesson.goal, /two tiny moves/);
  assert.ok(v.lesson.story && v.lesson.storyMore);
  assert.equal(v.lesson.storyOpen, false);
  ctrl.toggleStory();
  assert.equal(ctrl.view().lesson.storyOpen, true);
});

test("no lesson parameter asks for the list; the id is validated", () => {
  const { ctrl, sent } = setup(null, "");
  assert.equal(sent[0].type, "lesson_list");
  assert.equal(ctrl.view().screen, "list");
  assert.equal(ctrl.view().lessons[0].id, "dummy");
  assert.equal(lesson.lessonIdFromSearch("?lesson=dummy"), "dummy");
  assert.equal(lesson.lessonIdFromSearch("?lesson=../../x"), "");
  assert.equal(lesson.lessonIdFromSearch(""), "");
});

test("challenge screen: strip, dots, round text, pinned line and labels", () => {
  const { ctrl } = setup();
  ctrl.start();
  let v = ctrl.view();
  assert.equal(v.screen, "challenge");
  assert.equal(v.strip.text, "Lesson 7 · Round 1 of 2");
  assert.equal(v.strip.line, "Task 1 of 3");
  assert.equal(v.strip.dots, undefined, "fix round 2: no unlabelled dots; Task N of M says it in words");
  assert.equal(v.ch.roundTitle, "Count things");
  assert.match(v.ch.explain, /takes something in/);
  assert.equal(v.ch.remember, null);
  assert.equal(v.ch.pinned.code, "count_marbles(bag)");
  assert.equal(v.ch.pinned.labels.length, 2);
  assert.equal(v.ch.nextEnabled, false);
  runOk(ctrl);
  v = ctrl.view();
  assert.equal(v.ch.nextEnabled, true);
  ctrl.next();
  v = ctrl.view();
  assert.equal(v.strip.line, "Task 2 of 3");
  assert.equal(v.ch.explain, "", "explain only on the first challenge of a round");
  assert.equal(v.ch.pinned, null, "the worked example is hidden when the editor starts with that very line");
});

test("dictionary rows appear only from their round; the warm-up is on a round's first challenge only", () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.deepEqual(ctrl.view().ch.dictionary.map((r) => r.julia), ["count_marbles(x)"]);
  for (let i = 0; i < 3; i++) { runOk(ctrl); ctrl.next(); }
  const v = ctrl.view();
  assert.match(v.strip.text, /Round 2 of 2$/);
  assert.equal(v.strip.line, "Task 1 of 4");
  assert.equal(v.ch.dictionary.length, 0, "the dictionary is hidden while the warm-up quiz shows");
  ctrl.quiz(0); ctrl.startRound();
  assert.equal(ctrl.view().ch.dictionary.length, 2, "and back after Start the round");
  assert.match(v.ch.remember.prompt, /Remember/);
  assert.equal(v.ch.pinned.code, "bag[2]");
  ctrl.next();
  runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().ch.remember, null, "remember only on the first challenge of the round");
});

test("an r_note shows under the pinned line only when the see challenge has one, and only while Show R is on", () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.equal(ctrl.view().ch.pinned.notes.r, null);
  for (let i = 0; i < 3; i++) { runOk(ctrl); ctrl.next(); }
  assert.match(ctrl.view().ch.pinned.notes.r.text, /In R you write bag\[2\]/);
  assert.equal(ctrl.view().ch.pinned.notes.r.code, false, "a note in words is shown as words");
  runOk(ctrl); ctrl.next();                            // round 9: the note shows only on the see itself
  assert.equal(ctrl.view().ch.pinned.notes.r, null, "no R note on a later screen");
  assert.match(ctrl.view().ch.pinned.label, /^Worked example/);
});

test("Show me the line appears after two failures, opens Next, and never on a checkpoint", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl); ctrl.next();               // now on the change challenge
  assert.equal(ctrl.view().ch.kind, "change");
  runBad(ctrl);
  assert.equal(ctrl.view().ch.showLine, false);
  runBad(ctrl);
  assert.equal(ctrl.view().ch.showLine, true);
  assert.equal(ctrl.view().ch.nextEnabled, false);
  assert.equal(ctrl.showLine(), "count_marbles(red_bag)");
  assert.equal(ctrl.view().ch.nextEnabled, true);
  assert.equal(ctrl.editorCode(), "count_marbles(red_bag)");
  ctrl.next();
  // checkpoint: no line, two hints
  assert.equal(ctrl.view().ch.kind, "checkpoint");
  runBad(ctrl); runBad(ctrl); runBad(ctrl);
  let v = ctrl.view();
  assert.equal(v.ch.showLine, false);
  assert.equal(ctrl.showLine(), "");
  assert.equal(v.ch.hintsAvailable, true);
  assert.equal(v.ch.nextEnabled, false);
  ctrl.hint();
  assert.equal(ctrl.view().ch.hints.length, 1, "one hint at a time");
  assert.equal(ctrl.view().ch.hints[0].text, "Think of a function that counts things.");
  ctrl.hint();
  v = ctrl.view();
  assert.equal(v.ch.hints.length, 2);
  assert.match(v.ch.hints[1].text, /shape of the first line/);
  ctrl.hint();
  assert.equal(ctrl.view().ch.hints.length, 2, "never more than the two in the data");
  assert.equal(v.ch.pinned, null, "no pinned see line on a checkpoint");
  assert.equal(v.ch.nextEnabled, false, "hints never open Next");
});

test("a wrong prediction never blocks Run and shows one guess line", () => {
  const { ctrl, sent } = setup();
  ctrl.start();
  assert.equal(ctrl.view().ch.predict.choices.length, 3);
  const shown = ctrl.view().ch.predict.choices;
  ctrl.predict(shown.indexOf("9"));
  runOk(ctrl);
  assert.equal(sent.filter((m) => m.type === "lesson_run").length, 1);
  const v = ctrl.view();
  assert.equal(v.ch.guessLine, "Good try. You picked: 9. The answer is: 5.");
  assert.equal(v.ch.nextEnabled, true);
  // round 10: a guess is optional. Run with no guess just runs, and the guess line says so in plain words
  const b = setup();
  b.ctrl.start(); b.ctrl.run(answers[b.ctrl.view().ch.id]);
  assert.equal(b.sent.filter((m) => m.type === "lesson_run").length, 1);
  assert.equal(b.ctrl.view().ch.guessLine, "", "round 5: nothing picked, so no leftover line");
  assert.doesNotMatch(b.ctrl.view().ch.feedback, /pick an answer/i);
  assert.equal(b.ctrl.view().ch.guessWrong, false, "no guess is not a wrong guess");
});

test("a data table is offered only for a challenge that names one", () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.equal(ctrl.view().ch.data, null);
  for (let i = 0; i < 4; i++) { runOk(ctrl); ctrl.next(); }
  const v = ctrl.view();
  assert.equal(v.ch.kind, "write");
  assert.deepEqual(v.ch.data.columns, ["jar_id", "batch_id", "tray_id", "colour"]);
});

test("progress and drafts resume at the first unfinished challenge; Start again clears them", () => {
  const storage = memoryStorage();
  let a = setup(storage);
  a.ctrl.start();
  runOk(a.ctrl); a.ctrl.next();
  a.ctrl.draft("count_marbles(");
  const b = setup(storage);
  assert.equal(b.ctrl.view().screen, "start", "a lesson already begun opens on its start card");
  assert.equal(b.ctrl.view().lesson.startLabel, "Continue");
  assert.equal(b.ctrl.view().lesson.resume, "You stopped at Round 1, task 2.");
  assert.equal(b.ctrl.view().lesson.canRestart, true, "Start again sits inside the start card");
  b.ctrl.start();
  const v = b.ctrl.view();
  assert.equal(v.screen, "challenge");
  assert.equal(v.strip.line, "Task 2 of 3");
  assert.equal(b.ctrl.editorCode(), "count_marbles(");
  b.ctrl.restart();
  assert.equal(b.ctrl.view().screen, "start");
  assert.equal(setup(storage).ctrl.view().screen, "start");
});

test("broken storage never stops the lesson", () => {
  const bad = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); }, removeItem() { throw new Error("no"); } };
  const { ctrl } = setup(bad);
  ctrl.start(); runOk(ctrl);
  assert.equal(ctrl.view().ch.nextEnabled, true);
});

test("the end screen lists only the player's own passing code, the case line marked", () => {
  const { ctrl } = setup();
  ctrl.start();
  finishAll(ctrl);
  const v = ctrl.view();
  assert.equal(v.screen, "end");
  // see runs (d-r1-c1, d-r2-c1) and the play box are left out
  // case lines (checkpoints) first, then practice lines; see runs and the play box are left out
  // round 9: the case line is the lesson's last checkpoint only; an earlier checkpoint is practice
  assert.deepEqual(v.end.lines.map((l) => l.code), ["bag[1]", "count_marbles(red_bag)", "count_marbles(blue_bag)", "bag[3]", "bag[2]"]);
  assert.deepEqual(v.end.lines.map((l) => l.caseLine), [true, false, false, false, false]);
  assert.match(v.end.finding, /counted and picked/);
  assert.match(v.end.next, /Next lesson/);
});

test("lines shown with Show me the line are not listed, and a repeated line is listed once", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl); ctrl.next();                       // see
  runBad(ctrl); runBad(ctrl); ctrl.showLine(); ctrl.next();   // change: shown, not written
  ctrl.run("count_marbles(blue_bag)");            // checkpoint passes with the blue line
  // make the later case checkpoint repeat an earlier line by editing the stored answer
  ctrl.state.progress.done["d-r1-c3"] = { code: "count_marbles(blue_bag)" };
  ctrl.next();
  ctrl.state.progress.done["d-r2-c2"] = { code: "count_marbles(blue_bag)" };
  ctrl.state.progress.done["d-r2-c4"] = { code: "count_marbles(blue_bag)" };
  ctrl.state.index = ctrl.state.flat.length - 1; ctrl.next();
  const lines = ctrl.view().end.lines;
  assert.deepEqual(lines.map((l) => l.code), ["count_marbles(blue_bag)"]);
  assert.equal(lines[0].caseLine, true, "a repeated case line keeps its mark");
});

test("remember is a one-click quiz: choices, then the answer and why; it never blocks", () => {
  const { ctrl, sent } = setup();
  ctrl.start();
  for (let i = 0; i < 3; i++) { runOk(ctrl); ctrl.next(); }
  let r = ctrl.view().ch.remember;
  assert.equal(r.choices.length, 3);
  assert.equal(r.answered, false);
  const runsBefore = sent.filter((m) => m.type === "lesson_run").length;
  ctrl.quiz(r.choices.indexOf("9"));              // a wrong pick
  r = ctrl.view().ch.remember;
  assert.equal(r.answered, true);
  assert.equal(r.correct, false);
  assert.match(r.why, /counts every marble/);
  assert.equal(r.choices[r.pick], "9", "the pick is shown where it was clicked");
  assert.equal(sent.filter((m) => m.type === "lesson_run").length, runsBefore, "the quiz sends nothing");
  runOk(ctrl);                                    // Run is unaffected
  assert.equal(ctrl.view().ch.nextEnabled, true);
});

test("a play error shows Julia's message and a feedback line, never an empty box", () => {
  const { ctrl } = setup();
  ctrl.start();
  ctrl.state.index = ctrl.state.flat.findIndex((f) => f.challenge.kind === "play");
  ctrl.run("bad(1)");
  const v = ctrl.view();
  assert.equal(v.ch.result.message, "UndefVarError: bad not defined");
  assert.ok(v.ch.feedback.length > 10, "a feedback line is always there");
  assert.equal(v.ch.nextEnabled, true);
});

test("a finished lesson reopens on the end screen", () => {
  const storage = memoryStorage();
  const a = setup(storage);
  a.ctrl.start();
  finishAll(a.ctrl);
  assert.equal(setup(storage).ctrl.view().screen, "end");
});

test("kind fix is labelled and gets Show me the line; play is ungraded", () => {
  const { ctrl } = setup();
  ctrl.start();
  for (let i = 0; i < 5; i++) { runOk(ctrl); ctrl.next(); }
  let v = ctrl.view();
  assert.equal(v.ch.kind, "fix");
  assert.equal(v.ch.kindLabel, "Fix");
  runBad(ctrl); runBad(ctrl);
  assert.equal(ctrl.view().ch.showLine, true);
  assert.equal(ctrl.showLine(), "bag[2]");
  ctrl.next(); runOk(ctrl); ctrl.next();
  v = ctrl.view();
  assert.equal(v.ch.kind, "play");
  assert.equal(v.ch.kindLabel, "Try anything");
  assert.equal(v.ch.nextEnabled, true, "Next is open at once");
  runBad(ctrl); runBad(ctrl); runBad(ctrl);
  assert.equal(ctrl.view().ch.showLine, false, "play never offers the line");
  assert.equal(ctrl.view().ch.nextEnabled, true);
  ctrl.next();
  assert.equal(ctrl.view().screen, "end");
  assert.ok(!ctrl.view().end.lines.includes(""), "play adds no line");
});

test("board draws 12 jars in tray and batch groups, hits marked, summary counted, only after a run", () => {
  const { ctrl } = setup();
  ctrl.start();
  for (let i = 0; i < 4; i++) { runOk(ctrl); ctrl.next(); }
  assert.equal(ctrl.view().ch.kind, "write");
  assert.equal(ctrl.view().ch.board, null, "nothing before a run");
  runBad(ctrl);
  let b = ctrl.view().ch.board;
  assert.equal(b.tiles.length, 12);
  assert.equal(b.groups.length, 6);
  assert.deepEqual(b.groups[0].tiles.map((t) => t.id), ["J01", "J02"]);
  assert.equal(b.groups[0].label, "T-A \u00b7 B08");
  assert.equal(b.summary, "Your line picked 0 of 12 jars (ticked).");
  runOk(ctrl);
  b = ctrl.view().ch.board;
  assert.deepEqual(b.tiles.filter((t) => t.hit).map((t) => t.id), ["J01", "J05", "J06"]);
  assert.equal(b.summary, "Your line picked 3 of 12 jars (ticked).");
  // a challenge without `board` never draws one
  const o = setup(); o.ctrl.start(); runOk(o.ctrl);
  assert.equal(o.ctrl.view().ch.board, null);
});

test("board falls back to lesson.jars, grouping by batch when there are no trays", () => {
  const L = served(dummyFull);
  L.rounds[1].challenges[1].data = "";
  L.jars = [{ jar_id: "A1", batch_id: "B08" }, { jar_id: "A2", batch_id: "B09" }, { jar_id: "A3", batch_id: "B09" }];
  const ctrl = lesson.createController({ send() {}, storage: memoryStorage(), lessonId: "dummy" });
  ctrl.handle({ type: "lesson", lesson: L });
  ctrl.start();
  for (let i = 0; i < 4; i++) { ctrl.state.progress.done[ctrl.view().ch.id] = { code: "x" }; ctrl.next(); }
  ctrl.state.pending = "r1"; ctrl.state.lastCode = "x";
  ctrl.handle({ type: "lesson_result", request_id: "r1", status: "ok", value_repr: "", pass: false, feedback: "", picked_ids: ["A2"] });
  const b = ctrl.view().ch.board;
  assert.deepEqual(b.groups.map((g) => g.label), ["B08", "B09"]);
  assert.equal(b.summary, "Your line picked 1 of 3 jars (ticked).");
});

test("checkpoint clues show on pass as 'Worth remembering', with no counter, and list on the end screen (D6)", () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.equal(ctrl.view().strip.clues, undefined, "no Clues: N counter in the bar");
  runOk(ctrl); ctrl.next(); runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().ch.clue, "", "not before the pass");
  runBad(ctrl);
  assert.equal(ctrl.view().ch.clue, "");
  runOk(ctrl);
  assert.equal(ctrl.view().ch.clue, "Worth remembering: The blue bag is the biggest bag.", "one label, then the text");
  runBad(ctrl);
  assert.equal(ctrl.view().ch.clue, "", "a later failing run does not show it");
  ctrl.next();
  finishAll(ctrl);
  assert.deepEqual(ctrl.view().end.clues, ["The blue bag is the biggest bag.", "The green marble sits in place 3."]);
});

test("the end screen carries own_work and the whole dictionary for printing", () => {
  const { ctrl } = setup();
  ctrl.start(); finishAll(ctrl);
  const e = ctrl.view().end;
  assert.match(e.own.say, /your own script/);
  assert.equal(e.own.code, "n = length(marbles)\nmarbles[1]");
  assert.equal(e.dictionary.length, 2);
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  assert.match(css, /@media print/);
  assert.match(css, /prefers-reduced-motion/);
});

test("an error message from the server is shown, not hidden", () => {
  const { ctrl } = setup();
  ctrl.handle({ type: "error", message: "Unknown lesson." });
  assert.equal(ctrl.view().notice, "Unknown lesson.");
});

function leaves(x, out) {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) x.forEach((y) => leaves(y, out));
  else if (x && typeof x === "object") Object.keys(x).forEach((k) => leaves(x[k], out));
  return out;
}
function idsOf(L) {
  // The target range is a page of its own: its route name is the one id the screen must know.
  const ids = L.kind === "range" ? [] : [L.id];
  (L.rounds || []).forEach((r) => { ids.push(r.id); (r.challenges || []).forEach((c) => ids.push(c.id)); });
  return ids.filter((x) => typeof x === "string" && x.length >= 4);
}

test("propagation: lesson.js holds no string, id or word list from any lesson file", () => {
  const src = fs.readFileSync(path.join(root, "web/lesson.js"), "utf8");
  const files = [dummyFull];
  const dir = path.join(root, "lessons");
  if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.endsWith(".json")).forEach((f) => files.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
  let strings = 0;
  files.forEach((L) => {
    idsOf(L).forEach((id) => assert.ok(!src.includes(id), "id in lesson.js: " + id));
    // A glossary term is a plain word a lesson chose to explain; only its meaning is lesson text.
    const text = Object.assign({}, L, { glossary: (L.glossary || []).map((g) => ({ means: g.means })) });
    leaves(text, []).filter((t) => t.length > 12).forEach((t) => { strings += 1; assert.ok(!src.includes(t), "lesson text in lesson.js: " + t); });
  });
  assert.ok(strings > 40);
});

// ---- a tiny fake page, so the real page-drawing code (init) runs on the dummy -------------------
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
function fakePage(storage, lessonDef, search) {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const byId = {};
  [...html.matchAll(/\sid="([^"]+)"/g)].forEach((m) => { byId[m[1]] = new FNode("div"); });
  Object.keys(byId).forEach((id) => { if (/hidden/.test(html.match(new RegExp('<[^>]*id="' + id + '"[^>]*>'))[0])) byId[id].hidden = true; });
  const hooks = {};
  // A worked line that asks for a guess needs one before Run: this page clicks the first choice unless one is chosen.
  const runClick = byId.run.click.bind(byId.run);
  byId.run.click = () => {
    const buttons = byId.predict.hidden ? [] : byId.predict.all().filter((n) => n.tag === "button" && n.attrs.class === "choice");
    if (buttons.length && !buttons.some((b) => b.attrs["aria-pressed"] === "true")) buttons[0].click();
    runClick();
  };
  class WS {
    constructor() { this.readyState = 0; this.l = {}; Promise.resolve().then(() => { this.readyState = 1; (this.l.open || []).forEach((f) => f({})); }); }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    close() {}
    send(text) {
      const m = JSON.parse(text); let out = null;
      if (m.type === "lesson_list") out = { type: "lessons", lessons: [{ id: "dummy", number: 7, title: "Sort the marbles" }, { id: "range", kind: "range", number: null, title: "Target range" }] };
      if (m.type === "lesson_info") out = { type: "lesson", request_id: m.request_id, lesson: lessonDef.kind === "range" ? servedRange(lessonDef) : served(lessonDef) };
      if (m.type === "lesson_run" && lessonDef.kind === "range") {
        const ids = m.code.match(/J-\d+/g);
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: ids ? "ok" : "error", value_repr: "", pass: false, feedback: ids ? "Ran." : "", message: ids ? "" : "UndefVarError: x not defined" };
        if (ids) out.picked_ids = ids;
        if (hooks.run) hooks.run(out, m);
      } else if (m.type === "lesson_run") {
        const pass = m.code.trim() === answers[m.challenge];
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", value_repr: pass ? "5" : "0", pass, feedback: pass ? "Good." : "Not yet." };
        if (m.challenge === "d-r2-c2") out.picked_ids = pass ? ["J01"] : [];
        if (m.code.startsWith("bad(")) { out.status = "error"; out.value_repr = ""; out.message = "UndefVarError: bad not defined"; out.feedback = ""; }
        if (hooks.run) hooks.run(out, m);
        if (m.code.startsWith("parse(")) { out.status = "error"; out.value_repr = ""; out.message = "ParseError: incomplete: premature end of input"; out.feedback = ""; }
      }
      (this.l.message || []).forEach((f) => f({ data: JSON.stringify(out) }));
    }
  }
  const win = { localStorage: storage, location: { search: search === undefined ? "?lesson=dummy" : search, host: "x" }, WebSocket: WS, addEventListener() {}, innerWidth: 1366, confirm: () => true, print() {}, navigator: {} };
  const doc = { defaultView: win, getElementById: (id) => byId[id], createElement: (t) => new FNode(t), createTextNode: (t) => { const n = new FNode("#text"); n._text = t; return n; } };
  return { doc, byId, win, hooks };
}
const rangeFull = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/range-dummy.json"), "utf8"));
function servedRange(full) {
  const copy = JSON.parse(JSON.stringify(full));
  copy.waves.forEach((w) => { delete w.example; });
  return copy;
}
function ctrlToPlay(ctrl) {
  while (ctrl.view().screen === "challenge" && ctrl.view().ch.kind !== "play") { runOk(ctrl); ctrl.next(); }
}
function ctrl_kind(ctrl) { return ctrl.view().screen === "challenge" ? "on" : "last"; }
const tick = () => new Promise((r) => setTimeout(r, 0));
// A lesson already begun opens on its start card (0.5 fixes): Continue goes back to the first unfinished line.
const resume = (page) => { if (!page.byId["screen-start"].hidden && page.byId.start.textContent === "Continue") page.byId.start.click(); };
// On the page: a worked line that asks for a guess needs one before Run (round 9).
const guessFirst = ($) => { const b = $("predict").all().find((n) => n.tag === "button" && n.className === "choice"); if (b) b.click(); };
const clickText = (root, text) => root.all().find((n) => n.tag === "button" && n.textContent === text).click();

test("the real page code draws the dummy: start, challenge, quiz, hints, data, footer, end", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc);
  await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("screen-start").hidden, false);
  assert.equal($("start-title").textContent, "Sort the marbles");
  $("start").click();
  assert.equal($("screen-lesson").hidden, false);
  assert.equal($("strip-text").textContent, "Lesson 7 \u00b7 Round 1 of 2");
  assert.equal($("line-count").textContent, "Task 1 of 3");
  assert.match($("prompt").textContent, /worked line/);
  assert.equal($("data-label").textContent, "The marbles here are made up for practice.");
  assert.equal($("predict").hidden, false);
  assert.equal($("code").value, "count_marbles(bag)");
  $("run").click();
  assert.equal($("feedback").textContent, "Good.");
  assert.equal($("next").disabled, false);
  $("next").click();
  // the change challenge: two failures show the line button
  $("code").value = "x"; $("run").click(); $("run").click();
  assert.equal($("show-line").hidden, false);
  $("show-line").click();
  assert.equal($("code").value, "count_marbles(red_bag)");
  $("next").click();
  // checkpoint: no pinned line, hints one at a time
  assert.equal($("pinned").hidden, true);
  $("code").value = "x"; $("run").click(); $("run").click();
  assert.equal($("show-line").hidden, true);
  assert.equal($("hints").hidden, false);
  clickText($("hints"), "Hint 1: the idea");
  assert.match($("hints").textContent, /counts things/);
  assert.doesNotMatch($("hints").textContent, /first line/);
  clickText($("hints"), "Hint 2: the shape of the line");
  assert.match($("hints").textContent, /first line/);
  $("code").value = "count_marbles(blue_bag)"; $("run").click(); $("next").click();
  // round 2: quiz, dictionary from round 2, data table above the pinned line
  assert.match($("remember").textContent, /Remember the counting line/);
  clickText($("remember"), "9");
  assert.match($("remember").textContent, /The answer is 5\. It counts every marble/);
  assert.equal($("dict").hidden, true, "no dictionary while the quiz shows");
  clickText($("remember"), "Start the round");
  assert.equal($("dict").hidden, false);
  assert.equal($("dict-body").children.length, 2);
  $("run").click(); $("next").click();
  assert.equal($("data").hidden, false);
  assert.match($("data").textContent, /Table: marble_table/);
  $("code").value = "bag[3]"; $("run").click();
  assert.equal($("board").hidden, false);
  assert.match($("board").textContent, /Your line picked 1 of 12 jars \(ticked\)\./);
});

test("shuffle: stable per challenge, keeps the answer mapping, and varies between challenges", () => {
  const seeded = (n, seed) => lesson.seededOrder(n, seed);
  assert.deepEqual(seeded(3, "abc"), seeded(3, "abc"));
  assert.deepEqual(seeded(3, "abc").slice().sort(), [0, 1, 2]);
  const firsts = new Set();
  for (let i = 0; i < 30; i++) firsts.add(seeded(3, "id-" + i)[0]);
  assert.ok(firsts.size === 3, "the first slot is not always the same choice");
  // the recall quiz: whatever the order, the right text is judged right and a wrong one wrong
  for (const want of ["5", "9", "an error"]) {
    const { ctrl } = setup();
    ctrl.start();
    for (let i = 0; i < 3; i++) { runOk(ctrl); ctrl.next(); }
    const r = ctrl.view().ch.remember;
    ctrl.quiz(r.choices.indexOf(want));
    assert.equal(ctrl.view().ch.remember.correct, want === "5");
    assert.equal(ctrl.view().ch.remember.answerText, "5");
  }
  // predict: the guess line quotes the choice the player clicked, not the one at that place in the file
  const { ctrl } = setup();
  ctrl.start();
  const shown = ctrl.view().ch.predict.choices;
  ctrl.predict(shown.indexOf("an error"));
  assert.equal(ctrl.view().ch.predict.choices[ctrl.view().ch.predict.guess], "an error");
  runOk(ctrl);
  assert.equal(ctrl.view().ch.guessLine, "Good try. You picked: an error. The answer is: 5.");
  // a right guess says so plainly, decided by the answer index (the answer is choice 0, "5")
  const r = setup();
  r.ctrl.start();
  r.ctrl.predict(r.ctrl.view().ch.predict.choices.indexOf("5"));
  runOk(r.ctrl);
  assert.equal(r.ctrl.view().ch.guessLine, "Yes. You picked: 5. Julia showed 5.");
});

test("guess line: a true/false list is not called a table; a real table is", () => {
  const mk = (table, repr) => {
    const { ctrl } = setup();
    ctrl.start();
    ctrl.predict(0);
    ctrl.state.pending = "r"; ctrl.state.lastCode = "x";
    ctrl.handle({ type: "lesson_result", request_id: "r", status: "ok", value_repr: repr || "", value_table: table || null, pass: true, feedback: "ok" });
    return ctrl.view().ch.guessLine;
  };
  assert.match(mk({ columns: ["value"], rows: [[true], [false], [true]] }), /Julia showed a list of true and false\.$/);
  assert.match(mk({ columns: ["jar_id", "batch_id"], rows: [["J1", "B08"]] }), /a table with 1 row\.$/);
  assert.doesNotMatch(mk({ columns: ["value"], rows: [[true]] }), /table/);
  const vec = '12-element Vector{String}:\n ' + Array.from({ length: 12 }, (_, i) => '"J' + (i + 1) + '"').join("\n ");
  assert.match(mk(null, vec), /Julia showed a list of 12 items\.$/);
  assert.doesNotMatch(mk(null, vec), /Vector|element/);
  assert.match(mk(null, "12\u00d74 DataFrame\n Row | jar_id"), /a table with 12 rows\.$/);
  assert.match(mk(null, "42"), /Julia showed 42\.$/);
  assert.deepEqual(lesson.listItems('3-element Vector{Int64}:\n 4\n 7\n 1'), ["4", "7", "1"]);
  assert.equal(lesson.listItems("42"), null);
});

test("errors: the plain sentence comes first, Julia's message is folded; an error is an alert box, never red words", async () => {
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  assert.doesNotMatch(css, /#feedback\.bad/);
  assert.doesNotMatch(css, /(#feedback|#result|julia-msg)[^{]*\{[^}]*[^-]color:\s*var\(--bad\)/, "the words stay ink");
  assert.match(css, /#feedback\.alert \{[^}]*border-left: 4px solid var\(--bad\)[^}]*background: var\(--bad-soft\)/, "0.5 fixes: an error is styled as an alert");
  const storage = memoryStorage();
  // go to the play box through the controller state the page shares (storage), then reload the page there
  const a = setup(storage);
  a.ctrl.start(); ctrlToPlay(a.ctrl);
  const page2 = fakePage(storage, dummyFull);
  lesson.init(page2.doc);
  await tick();
  resume(page2);
  page2.byId.code.value = "bad(1)"; page2.byId.run.click();
  assert.equal(page2.byId.feedback.hidden === true, false);
  assert.equal(page2.byId.feedback.textContent, "Julia does not know the name bad. Check its spelling against the table names and the pocket dictionary.", "the fallback line names the unknown word");
  assert.equal(page2.byId["julia-msg"].hidden, false);
  const d = page2.byId["julia-msg"].children[0];
  assert.equal(d.tag, "details");
  assert.equal(d.children[0].textContent, "Julia's own message");
  assert.match(d.textContent, /UndefVarError/);
  assert.notEqual(d.attrs.open, "true", "closed by default");
  assert.ok(page2.byId.feedback.className !== "bad");
});

test("a checkpoint never points to the example on the left", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl); ctrl.next(); runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().ch.kind, "checkpoint");
  ctrl.state.pending = "r"; ctrl.state.lastCode = "x";
  ctrl.handle({ type: "lesson_result", request_id: "r", status: "error", value_repr: "", pass: false, feedback: "Julia could not run this. Compare your line with the example on the left.", message: "ParseError" });
  assert.doesNotMatch(ctrl.view().ch.feedback, /example on the left/i);
  ctrl.state.pending = "r2";
  ctrl.handle({ type: "lesson_result", request_id: "r2", status: "error", value_repr: "", pass: false, feedback: "", message: "ParseError" });
  assert.doesNotMatch(ctrl.view().ch.feedback, /example on the left/i);
  assert.ok(ctrl.view().ch.feedback.length > 10);
});

test("the warm-up sits in its own box above the round title; the round that ended is its own heading (P13)", async () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.ok(html.indexOf('id="remember"') < html.indexOf('id="round-title"'));
  assert.ok(html.indexOf('id="round-title"') < html.indexOf('id="then-line"'));
  assert.ok(html.indexOf('id="then-line"') < html.indexOf('id="explain"'));
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start();
  for (let i = 0; i < 3; i++) { runOk(a.ctrl); a.ctrl.next(); }
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc);
  await tick();
  resume(page);
  const $ = (id) => page.byId[id];
  assert.match($("remember").textContent, /^Round 1 done: Count thingsNext: Round 2 of 2, Pick a few\.Warm-up: remember this\?/, "the new round says the last one is done");
  assert.equal($("remember").children[0].tag, "h2", "the done line is a heading of its own");
  assert.doesNotMatch($("remember").textContent, /Well done/, "no praise before the warm-up is answered");
  // the warm-up stands alone: no task, no predict, until the round starts
  assert.equal($("right").hidden, true);
  assert.equal($("prompt").hidden, true);
  assert.equal($("round-title").hidden, true);
  assert.equal($("then-line").hidden, true);
  assert.ok(!$("remember").all().some((n) => n.textContent === "Start the round"), "no Start button before an answer");
  clickText($("remember"), "9");
  clickText($("remember"), "Start the round");
  assert.equal($("right").hidden, false);
  assert.equal($("prompt").hidden, false);
  assert.equal($("remember").hidden, true, "the warm-up box is gone once the round starts");
  assert.equal($("then-line").hidden, true, "no 'New in this round:' label with nothing listed after it (P12)");
  assert.equal($("predict").hidden, true, "this see has no predict; when it has, it shows only now");
});

test("Julia's message is folded and closed by default for every kind of error, a parse error included", async () => {
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); ctrlToPlay(a.ctrl);
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc);
  await tick();
  resume(page);
  const fold = () => page.byId["julia-msg"].children[0];
  page.byId.code.value = "bad(1)"; page.byId.run.click();
  assert.equal(fold().attrs.open, undefined);
  page.byId.code.value = "parse(1"; page.byId.run.click();
  assert.equal(fold().attrs.open, undefined, "parse error: closed too, so every error looks the same");
  page.byId.code.value = "bad(2)"; page.byId.run.click();
  assert.equal(fold().attrs.open, undefined, "other errors: closed");
});

test("Finish on the last challenge answers at once: end screen shown, named Finish, focus moved", async () => {
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start();
  while (ctrl_kind(a.ctrl) !== "last") { const v = a.ctrl.view(); if (v.ch.isLast) break; if (v.ch.kind !== "play") runOk(a.ctrl); a.ctrl.next(); }
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc);
  await tick();
  resume(page);
  const $ = (id) => page.byId[id];
  assert.equal($("next").textContent, "Finish");
  assert.equal($("next").attrs["aria-label"], "Finish", "the accessible name matches the visible word");
  assert.equal($("next").disabled, false);
  let focused = null;
  $("end-finding").focus = () => { focused = "end-finding"; };
  $("next").click();
  assert.equal($("screen-end").hidden, false);
  assert.equal($("screen-lesson").hidden, true);
  assert.equal(focused, "end-finding");
});

test("a short list result shows every item, and a table up to 12 rows", async () => {
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start();
  const page = fakePage(storage, dummyFull);
  const $ = (id) => page.byId[id];
  lesson.init(page.doc);
  await tick();
  resume(page);
  page.hooks.run = (out) => { out.value_repr = '12-element Vector{String}:\n ' + Array.from({ length: 12 }, (_, i) => '"J' + (i + 1) + '"').join("\n "); };
  guessFirst($); $("run").click();
  const text = $("result").textContent;
  assert.match(text, /A list of 12 items/);
  for (let i = 1; i <= 12; i++) assert.ok(text.includes('"J' + i + '"'), "item " + i);
  assert.doesNotMatch(text, /Vector\{/);
  page.hooks.run = (out) => { out.value_repr = ""; out.value_table = { columns: ["a"], rows: Array.from({ length: 12 }, (_, i) => [i]) }; };
  $("run").click();
  const rows = $("result").all().filter((n) => n.tag === "tr");
  assert.equal(rows.length, 13, "header plus 12 rows");
  assert.doesNotMatch($("result").textContent, /more rows/);
});

test("the real page code draws the end screen with case and practice headings and the dictionary", async () => {
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); finishAll(a.ctrl);
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc);
  await tick();
  resume(page);
  const $ = (id) => page.byId[id];
  assert.equal($("screen-end").hidden, false);
  const heads = $("end-lines").children.filter((n) => n.tag === "h3").map((n) => n.textContent);
  assert.deepEqual(heads, ["Your last checkpoint line", "Practice lines"]);
  assert.equal($("end-lines").all().filter((n) => n.tag === "li").length, 5);
  assert.deepEqual($("end-lines").children.map((n) => n.tag), ["h3", "ol", "h3", "ol"]);
  assert.equal($("end-lines").children[1].children.length, 1, "one case line");
  assert.equal($("end-lines").children[3].children.length, 4, "four practice lines");
  assert.equal($("end-dict-body").children.length, 2);
  assert.equal($("data-label").hidden, true, "the footer note belongs to challenge screens");
});

test("the page has only the listed elements", () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]).sort();
  // The spec is the plan's "The clean screen" (~/.claude/plans/mellow-singing-acorn.md), its "Fun and
  // useful" section, and the fix-round rules in lesson-format.md. Every element on the page must belong
  // to one of these entries; adding an element means adding a plan reason here first.
  const SPEC = {
    "round 4, keyboard: the landmark the skip link points to, and the one-line Run shortcut hint": ["main", "run-hint"],
    "strip: Lesson N, round, challenge, one dot per challenge": ["strip", "strip-text", "dots"],
    "round 5: the one line that says why Show R / Show Python changed nothing on a step with no note": ["switch-note"],
    "0.5, the bar on every screen: Julia Time and Board to the Board, Task N of M, the two switches Show R and Show Python (fix round 2), Cheat sheet": ["brand", "line-count", "board-link", "switches", "show-r", "show-py", "cheat"],
    "0.5, the cheat sheet off a line (start and end pages): the whole dictionary": ["sheet", "sheet-table", "sheet-body"],
    "0.5, start card: its place (Lesson 2 of 6, rounds, minutes), the chapter sentence, where you stopped": ["start-place", "start-chapter", "start-resume"],
    "0.5, the round's rule pinned as one collapsed line; notes for R and Python; the starter line": ["rule", "rule-sum", "rule-text", "notes", "starter", "starter-box", "starter-code"],
    "0.5, a chapter's dictionary: earlier lessons' rows under a fold": ["dict-earlier", "dict-earlier-sum", "dict-earlier-body"],
    "0.5, end page: lines, clues and own work in one fold, with Copy all, print and Start again": ["end-more", "end-more-sum", "copy-all", "end-restart"],
    "0.5, target range: locked levels as one line": ["locked-line"],
    "fix round 2 (D8, P12, P26): the fast lane on the start card; the one-time glossary tip; why Next is off; a chapter's one help used": ["fast-row", "fast-lane", "gloss-tip", "next-why", "help-note"],
    "fix round 2 (P14): the round's one-line story above its first task": ["round-story"],
    "0.5.2, your own data (kind own): the file button on the read step, the table panel with its four picks, the say step, the end-screen script": ["own-panel", "own-panel-h", "own-privacy", "own-file", "own-file-label", "own-starter", "own-error", "own-sim", "own-check", "own-picks", "own-load", "own-go-read", "own-stuck", "own-table", "own-table-sum", "own-end-file", "own-say", "own-say-label", "own-say-text", "own-say-note", "code-buttons", "own-end", "own-end-h", "own-end-lines", "own-end-say", "own-save", "own-save-note", "own-board", "own-notice", "own-still", "own-forget", "own-end-forget"],
    "left: the instruction": ["left", "prompt"],
    "left: the pinned worked line, labelled (on a later screen, captioned Worked example)": ["pinned", "pinned-code", "pinned-labels", "pinned-cap"],
    "left: pocket dictionary (a drawer on narrow screens)": ["dict", "dict-body"],
    "right: the editor, with its visible label (round 4, R3-35)": ["right", "code", "code-label"],
    "round 4, R3-28: the bar's middle holds the progress label and, in the same slot, Julia's connection status": ["strip-mid", "strip-info"],
    "round 4, R3-27: the result (and the jar rack) sit together above the verdict and Next": ["result-wrap"],
    "right: Run and Reset": ["run", "reset"],
    "right: the result, and the play box's one muted line under it": ["result", "play-note"],
    "right: one feedback sentence, and under a pass the \"That works too\" line": ["feedback", "works-too"],
    "right: Next": ["next"],
    "story: muted line and a Read the story link at the start": ["screen-start", "start-title", "start-goal", "start-story", "story-link", "story-more", "start"],
    "one screen per state": ["app", "screen-lesson", "screen-list", "screen-end", "screen-note", "lesson-list", "note"],
    "round text: title, one explain line, warm-up quiz (fix round 1)": ["round-title", "explain", "then-line", "remember"],
    "predict before Run, guess line": ["predict", "guess-line"],
    "show me the line, checkpoint hints, data table, data label": ["show-line", "hints", "data", "data-label"],
    "fun: jar board, kind label, clue and clue count": ["board", "kind-label", "clue", "clues"],
    "pinned line R note (r_note)": ["pinned-note"],
    "feedback: Julia's own message, folded (fix round 2)": ["julia-msg"],
    "progress: connection note, start again, and the way back to the lesson list": ["conn", "restart"],
    "end screen: finding, lines, clues, own work, next, print, dictionary": ["end-title", "end-finding", "end-lines", "end-clues", "end-own", "end-next", "print", "end-dict", "end-dict-body"],
    "0.5, end screen: the one main action (Now solve Chapter N after a lesson; the next lesson or the ending after an exam)": ["end-go"],
    "round 5, glossary: the meaning opens under the explain line or the prompt": ["gloss-explain", "gloss-prompt"],
    "round 5, test-out: one small button on a round's first screen, its note, and a way back": ["testout", "testout-btn", "testout-note", "testout-leave"],
    "round 5, end screen: skipped challenges, and the target range link (also on the list)": ["end-skipped", "end-range", "range-link"],
    "round 5, target range: level list and hint (the editor, Run and the rack are the lesson screen's; the bar has the way back)": ["waves", "wave-list", "wave-hint", "wave-hint-text"],
    "round 9, target range end screen: the stars, the best line per wave, and the ways back": ["screen-range-end", "range-end-say", "range-end-lines", "range-end-more", "range-end-back", "range-end-home"],
    "round 6, start page: the promise (can_do)": ["start-promise"],
    "round 6, end screen: You can now, the mistake everyone makes, Your skills so far; the lesson list carries Your skills so far": ["end-can-do", "end-mistake", "end-skills", "list-skills"],
    "round 6, Look closer: a closed link under the pinned line; open, its text, code, Try it and the value": ["look", "look-link", "look-box", "look-text", "look-code", "look-try", "look-result"],
    "round 6, the result label over the output, and the glossary meaning under a feedback line": ["result-label", "gloss-feedback"],
  };
  const allowed = Object.values(SPEC).flat().sort();
  // and everything the plan's clean screen demands is really there
  ["strip-text", "dots", "prompt", "pinned", "dict", "code", "run", "reset", "result", "feedback", "next"].forEach((id) => assert.ok(ids.includes(id), "plan element missing: " + id));
  assert.deepEqual(ids, allowed);
  // three stylesheets (the screen, the target range's own, and the delight layer), in that order
  assert.deepEqual([...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]), ["lesson.css", "lesson-range.css", "lesson-delight.css"]);
  // no images, no inline handlers; the scripts are the screen, the course record it saves exam passes
  // to, the glue between them (0.5), the shared Julia-text filter and the target range (fix round 2), and the delight layer that only watches the page (0.5 round 3), in that load order
  assert.deepEqual([...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]), ["course/course-state.js", "julia-text.js", "lesson-exam-save.js", "lesson-range.js", "lesson-own.js", "lesson.js", "lesson-delight.js"]);
  assert.equal((html.match(/<script/g) || []).length, 7);
  assert.equal((html.match(/<img/g) || []).length, 0);
  assert.doesNotMatch(html, /\son[a-z]+=/);
  // every button has an accessible name (text or aria-label)
  for (const m of html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)) assert.ok(/aria-label=/.test(m[0]) || m[1].trim(), m[0]);
  assert.match(html, /<p id="feedback" aria-live="polite">/);
  // element order: predict above the editor above Run; data under the prompt, above the pinned line
  const at = (id) => html.indexOf('id="' + id + '"');
  assert.ok(at("predict") < at("code") && at("code") < at("run"), "predict, then editor, then Run");
  assert.ok(at("prompt") < at("data") && at("data") < at("pinned"), "data sits between prompt and pinned line");
  assert.ok(at("data") > at("left") && at("data") < at("right"), "data is in the left column");
});

// ---- fix round 3: warm-up in round 1, clue rules, guess line, play note, message fold, type lines ----
function ctrlFor(mutate, storage) {
  const def = JSON.parse(JSON.stringify(dummyFull));
  if (mutate) mutate(def);
  let ctrl;
  ctrl = lesson.createController({
    lessonId: "dummy", storage: storage || memoryStorage(),
    send: (m) => {
      if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: served(def) });
      else if (m.type === "lesson_run") {
        const pass = m.code.trim() === answers[m.challenge];
        ctrl.handle({ type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", value_repr: pass ? "5" : "0", pass, feedback: pass ? "Good." : "Not yet." });
      }
    },
  });
  ctrl.open();
  return ctrl;
}
const feed = (ctrl, extra) => {
  ctrl.state.pending = "rq"; ctrl.state.lastCode = "x";
  ctrl.handle(Object.assign({ type: "lesson_result", request_id: "rq", status: "ok", value_repr: "5", pass: false, feedback: "f" }, extra));
  return ctrl.view().ch;
};

test("round 1 shows a warm-up quiz when the data has one, and hides the dictionary until it starts", () => {
  const ctrl = ctrlFor((d) => { d.rounds[0].remember = JSON.parse(JSON.stringify(d.rounds[1].remember)); });
  ctrl.start();
  let ch = ctrl.view().ch;
  assert.equal(ch.warmGate, true);
  assert.equal(ch.remember.choices.length, 3);
  assert.equal(ch.dictionary.length, 0, "no dictionary during the quiz");
  ctrl.quiz(0);
  assert.equal(ctrl.view().ch.dictionary.length, 0, "still none after the answer, until Start the round");
  ctrl.startRound();
  ch = ctrl.view().ch;
  assert.equal(ch.warmGate, false);
  assert.equal(ch.thenLine, undefined, "no 'New in this round:' label with nothing listed after it (P12)");
  assert.deepEqual(ch.dictionary.map((r) => r.julia), ["count_marbles(x)"]);
  assert.equal(ctrlFor().view().screen, "start");
});

test("the clue shows once, with one label, only when a checkpoint passes", () => {
  const ctrl = ctrlFor((d) => {
    d.rounds[0].challenges[0].clue = "Clue 9: this see must never show a clue.";   // a clue on a see step is ignored
    d.rounds[0].challenges[2].clue = "Clue 1: the blue bag is big.";
    d.rounds[1].challenges[3].clue = "the green marble is third.";                    // no label in the text
    d.rounds[1].challenges[4].clue = "A play box must not show a clue.";
  });
  ctrl.start();
  runOk(ctrl);
  assert.equal(ctrl.view().ch.clue, "", "not on a see step");
  ctrl.next(); runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().ch.kind, "checkpoint");
  assert.equal(ctrl.view().ch.clue, "");
  runOk(ctrl);
  assert.equal(ctrl.view().ch.clue, "Worth remembering: The blue bag is big.");
  assert.doesNotMatch(ctrl.view().ch.clue, /Clue/);
  ctrl.next();
  ctrl.quiz(0); ctrl.startRound();
  while (ctrl.view().ch.kind !== "checkpoint") { if (ctrl.view().ch.kind !== "play") runOk(ctrl); ctrl.next(); }
  runOk(ctrl);
  assert.equal(ctrl.view().ch.clue, "Worth remembering: The green marble is third.");
  ctrl.next();
  assert.equal(ctrl.view().ch.kind, "play");
  ctrl.run("1");
  assert.equal(ctrl.view().ch.clue, "", "not on the play box");
});

test("try anything: one muted line under the result, only for the play box", async () => {
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); ctrlToPlay(a.ctrl);
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc);
  await tick();
  resume(page);
  const $ = (id) => page.byId[id];
  assert.equal($("play-note").textContent, "Optional. Press Finish whenever you like.", "before a run it says the box is optional, with the real button word (the last task says Finish)");
  $("code").value = "1 + 1"; $("run").click();
  assert.equal($("play-note").hidden, true, "a one-line box needs no note about lines");
  $("code").value = "x = 1\nx + 1"; $("run").click();
  assert.equal($("play-note").hidden, false);
  assert.equal($("play-note").textContent, "Only the last line's value is shown.");
  assert.ok(fs.readFileSync(path.join(root, "web/lesson.html"), "utf8").indexOf('id="result"') < fs.readFileSync(path.join(root, "web/lesson.html"), "utf8").indexOf('id="play-note"'));
  const c = setup(); c.ctrl.start(); runOk(c.ctrl);
  assert.equal(c.ctrl.view().ch.playNote, "", "not on a see step");
});

test("Julia's own message: an empty or blank message hides the fold", async () => {
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); ctrlToPlay(a.ctrl);
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc);
  await tick();
  resume(page);
  page.hooks.run = (out) => { out.status = "error"; out.message = "  \n "; out.feedback = ""; };
  page.byId.code.value = "x"; page.byId.run.click();
  assert.equal(page.byId["julia-msg"].hidden, true);
  assert.equal(page.byId["julia-msg"].children.length, 0);
  page.hooks.run = (out) => { out.status = "error"; out.message = "UndefVarError: x not defined"; out.feedback = ""; };
  page.byId.run.click();
  assert.equal(page.byId["julia-msg"].hidden, false);
});

test("a Matrix or DataFrame value never shows its type line; a long list keeps its count", async () => {
  const ctrl = ctrlFor();
  ctrl.start();
  const mat = feed(ctrl, { value_repr: '1\u00d71 Matrix{String}:\n "J-096"' }).result;
  assert.equal(mat.tableRows, 1);
  assert.equal(mat.tableBody, '"J-096"');
  assert.equal(feed(ctrl, { value_repr: '2x3 Matrix{Int64}:\n 1  2  3\n 4  5  6' }).result.tableRows, 2);
  assert.equal(feed(ctrl, { value_repr: "12\u00d74 DataFrame\n Row | jar_id" }).result.tableRows, 12);
  const long = feed(ctrl, { value_repr: "1000-element Vector{Int64}:\n 3\n 2\n \u22ee\n 4" }).result;
  assert.equal(long.itemsTotal, 1000);
  assert.equal(long.itemsCut, true);
  assert.deepEqual(long.items, ["3", "2", "4"]);
  // in the page
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start();
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc);
  await tick();
  resume(page);
  page.hooks.run = (out) => { out.value_repr = '1\u00d71 Matrix{String}:\n "x"'; };
  guessFirst((id) => page.byId[id]); page.byId.run.click();
  const text = page.byId.result.textContent;
  // round 10: a Matrix is not a table; one column of values is "a column", and a real table stays "a table"
  assert.match(text, /A column of 1 value/);
  assert.doesNotMatch(text, /table|Matrix|Vector|\u00d7|element/);
  page.hooks.run = (out) => { out.value_repr = "40-element Vector{Int64}:\n " + Array.from({ length: 40 }, (_, i) => i).join("\n "); };
  page.byId.run.click();
  assert.match(page.byId.result.textContent, /A list of 40 items/);
  assert.doesNotMatch(page.byId.result.textContent, /Vector/);
  // the guess line says a table, never "1x1 Matrix{String}"
  ctrl.predict(0);
  const g = feed(ctrl, { value_repr: '1\u00d71 Matrix{String}:\n "x"' }).guessLine;
  assert.match(g, /a column of 1 value\.$/);
  assert.doesNotMatch(g, /Matrix|table/);
  assert.equal(feed(ctrl, { value_repr: '2x3 Matrix{Int64}:\n 1  2  3\n 4  5  6' }).result.tableLabel, "A grid of 2 rows by 3 columns");
  assert.equal(feed(ctrl, { value_repr: "12\u00d74 DataFrame\n Row | jar_id" }).result.tableLabel, "A table with 12 rows");
});

// ======================================================================================================
// Round 5 (29 Sep): human eyes. Glossary, test-out, target range. All three read their text from data.
// ======================================================================================================
const { glossaryViolations, rangeViolations } = require("./lesson-rules.cjs");
const joinParts = (parts) => parts.map((p) => p.text).join("");
const termsOf = (parts) => (parts || []).filter((p) => p.term).map((p) => p.term);

// ---- glossary --------------------------------------------------------------------------------------
test("glossary: the fixture obeys the format rules", () => {
  assert.deepEqual(glossaryViolations(dummyFull), []);
  assert.ok(dummyFull.glossary.length >= 4);
});

test("glossary: a term is underlined once in the whole lesson, in the first explain, prompt or predict question that holds it", () => {
  const { ctrl } = setup();
  ctrl.start();
  let ch = ctrl.view().ch;
  assert.deepEqual(termsOf(ch.explainParts), ["function"]);
  assert.deepEqual(termsOf(ch.promptParts), ["line"], "c1 prompt: 'line' first appears here");
  assert.equal(joinParts(ch.explainParts), ch.explain, "the parts read back as the same text");
  assert.equal(joinParts(ch.promptParts), ch.prompt);
  runOk(ctrl); ctrl.next();
  ch = ctrl.view().ch;
  assert.equal(ch.explainParts, null, "explain shows on the first challenge only");
  assert.deepEqual(termsOf(ch.promptParts), ["bag"], "a term earlier in the lesson is not underlined again");
  runOk(ctrl); ctrl.next();
  assert.deepEqual(termsOf(ctrl.view().ch.promptParts), [], "'bag' was already underlined in c2");
  runOk(ctrl); ctrl.next();
  ctrl.quiz(0); ctrl.startRound();
  ch = ctrl.view().ch;
  assert.deepEqual(termsOf(ch.explainParts), ["square brackets"], "a new round underlines only its new words");
  assert.equal(ch.explainParts[0].text, "Square brackets", "the text keeps the writer's capital letters");
  assert.deepEqual(termsOf(ch.promptParts), ["marble"], "'line' was underlined in round 1 and is plain now; 'marble' is new here (round 1 holds it only in a feedback line)");
});

test("glossary: a word left plain by the four-per-screen limit stays available for the next screen", () => {
  const ctrl = ctrlFor((def) => {
    def.glossary = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"].map((t) => ({ term: t, means: "m " + t }));
    def.rounds[0].explain = "Alpha and beta.";
    def.rounds[0].challenges[0].prompt = "Gamma, delta, epsilon and zeta.";
    def.rounds[0].challenges[0].predict.question = "Alpha or beta?";
    def.rounds[0].challenges[1].prompt = "Epsilon and zeta again, plus alpha.";
  });
  ctrl.start();
  let ch = ctrl.view().ch;
  assert.deepEqual(termsOf(ch.explainParts), ["alpha", "beta"], "explain first");
  assert.deepEqual(termsOf(ch.promptParts), ["gamma", "delta"], "two left in the budget of four");
  assert.deepEqual(termsOf(ch.predict.questionParts), [], "the budget is spent");
  const total = () => [ctrl.view().ch.explainParts, ctrl.view().ch.promptParts, ctrl.view().ch.predict && ctrl.view().ch.predict.questionParts].reduce((n, x) => n + termsOf(x).length, 0);
  assert.equal(total(), 4, "at most four on one screen");
  runOk(ctrl); ctrl.next();
  ch = ctrl.view().ch;
  assert.deepEqual(termsOf(ch.promptParts), ["epsilon", "zeta"], "words the limit left plain are underlined on the next screen; alpha was already met");
});

test("glossary: the warm-up quiz carries no underlined words, and the round's first screen then does", () => {
  const ctrl = ctrlFor((def) => {
    def.rounds[0].remember = JSON.parse(JSON.stringify(def.rounds[1].remember));
    def.rounds[0].remember.prompt = "Remember the line and the bag? What did it give?";
  });
  ctrl.start();
  let ch = ctrl.view().ch;
  assert.equal(ch.warmGate, true);
  assert.ok(!ch.remember.promptParts, "no underlines in the quiz question");
  ctrl.toggleTerm("line");
  assert.equal(ctrl.view().ch.gloss, null, "and no meaning to open there");
  ctrl.quiz(0); ctrl.startRound();
  ch = ctrl.view().ch;
  assert.deepEqual(termsOf(ch.promptParts), ["line"], "the quiz did not use up 'line'");
});

test("glossary: whole words only, case ignored, a plain plural counts, the longer term wins an overlap", () => {
  const gl = [{ term: "bag", means: "m1" }, { term: "text in quotes", means: "m2" }, { term: "text", means: "m3" }];
  const found = (text) => lesson.glossaryMarks([{ key: "a", text }], gl).a.map((m) => text.slice(m.start, m.end));
  assert.deepEqual(found("Bagpipes and handbags"), [], "no match inside a longer word");
  assert.deepEqual(found("Two BAGS here"), ["BAGS"]);
  assert.deepEqual(found("Put text in quotes now"), ["text in quotes"], "the longer term wins, and 'text' is not also marked");
  assert.deepEqual(found("bag, then bag"), ["bag"], "only the first time");
  assert.deepEqual(lesson.glossaryMarks([{ key: "a", text: "a bag" }, { key: "b", text: "the bag" }], gl).b, [], "and not in a later source");
  assert.deepEqual(lesson.glossaryMarks([{ key: "a", text: "x" }], []).a, []);
  const one = lesson.glossaryParts("a bag.", lesson.glossaryMarks([{ key: "a", text: "a bag." }], gl).a, gl);
  assert.deepEqual(one.map((p) => p.text), ["a ", "bag", "."]);
  assert.equal(one[1].means, "m1");
});

test("glossary: tapping a term opens its meaning under that text; tapping again, or moving on, closes it", () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.equal(ctrl.view().ch.gloss, null);
  ctrl.toggleTerm("function");
  let g = ctrl.view().ch.gloss;
  assert.equal(g.term, "function");
  assert.match(g.means, /takes something in/);
  assert.equal(g.under, "explain");
  assert.equal(ctrl.view().ch.explainParts.find((p) => p.term).open, true);
  ctrl.toggleTerm("line");
  g = ctrl.view().ch.gloss;
  assert.equal(g.term, "line", "one meaning at a time");
  assert.equal(g.under, "prompt");
  ctrl.toggleTerm("line");
  assert.equal(ctrl.view().ch.gloss, null);
  ctrl.toggleTerm("function"); runOk(ctrl);
  assert.equal(ctrl.view().ch.gloss.term, "function", "a run does not close it");
  ctrl.next();
  assert.equal(ctrl.view().ch.gloss, null, "Next clears it");
  ctrl.toggleTerm("function");
  assert.equal(ctrl.view().ch.gloss, null, "a term not on this screen opens nothing");
});

test("glossary: a lesson with no glossary shows plain text", () => {
  const ctrl = ctrlFor((d) => { delete d.glossary; });
  ctrl.start();
  const ch = ctrl.view().ch;
  assert.equal(ch.explainParts, null);
  assert.equal(ch.promptParts, null);
  assert.equal(ch.gloss, null);
});

test("glossary: on the page a term is a button with aria-expanded; the meaning opens inline and focus stays", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  const focused = [];
  const realFocus = FNode.prototype.focus;
  FNode.prototype.focus = function () { focused.push(this.attrs["data-term"] || this.tag); };
  try {
    lesson.init(page.doc);
    await tick();
    const $ = (id) => page.byId[id];
    $("start").click();
    const btn = () => $("explain").children.find((n) => n.tag === "button");
    assert.equal($("explain").textContent, dummyFull.rounds[0].explain, "plain reading order is unchanged");
    assert.equal(btn().attrs.type, "button");
    assert.equal(btn().className, "term");
    assert.equal(btn().attrs["aria-expanded"], "false");
    assert.equal($("gloss-explain").hidden, true);
    btn().click();
    assert.equal(btn().attrs["aria-expanded"], "true");
    assert.equal($("gloss-explain").hidden, false);
    assert.match($("gloss-explain").textContent, /^function: a named tool/);
    assert.equal($("gloss-prompt").hidden, true);
    assert.equal(focused[focused.length - 1], "function", "focus returns to the term after the redraw");
    btn().click();
    assert.equal($("gloss-explain").hidden, true);
    assert.equal(btn().attrs["aria-expanded"], "false");
    const p = $("prompt").children.find((n) => n.tag === "button");
    p.click();
    assert.match($("gloss-prompt").textContent, /^line: one row of code/);
    assert.equal($("gloss-explain").hidden, true);
    // the meaning sits directly under its own text, in the left column, never in the editor column
    const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
    const at = (id) => html.indexOf('id="' + id + '"');
    assert.ok(at("explain") < at("gloss-explain") && at("gloss-explain") < at("prompt"));
    assert.ok(at("prompt") < at("gloss-prompt") && at("gloss-prompt") < at("right"));
  } finally { FNode.prototype.focus = realFocus; }
});

test("glossary: real lessons that gloss terms use short meanings and real text", () => {
  const dir = path.join(root, "lessons");
  fs.readdirSync(dir).filter((f) => /^lesson\d/.test(f)).forEach((f) => {
    const L = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    assert.deepEqual(glossaryViolations(L), [], f);
  });
});

// ---- test-out --------------------------------------------------------------------------------------
test("test-out: offered on a round's first screen only, Lesson 1 round 1 included since fix round 2 (D8)", () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.equal(ctrl.view().ch.testOut.available, true, "round 1 of a lesson that is not lesson 1");
  runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().ch.testOut.available, false, "not on later screens of the round");
  const one = ctrlFor((d) => { d.number = 1; });
  one.start();
  assert.equal(one.view().ch.testOut.available, true, "lesson 1 round 1 (R17: coders may skip it too)");
  for (let i = 0; i < 3; i++) { runOk(one); one.next(); }
  one.quiz(0); one.startRound();
  assert.equal(one.view().ch.testOut.available, true, "lesson 1 round 2 offers it, on the warm-up screen and after");
  const warm = ctrlFor((d) => { d.number = 1; });
  warm.start(); for (let i = 0; i < 3; i++) { runOk(warm); warm.next(); }
  assert.equal(warm.view().ch.warmGate, true);
  assert.equal(warm.view().ch.testOut.available, true, "also while the warm-up quiz is showing");
  assert.equal(warm.view().ch.testOut.active, false);
});

test("test-out: every real round except lesson 1 round 1 has a checkpoint after its first challenge", () => {
  const dir = path.join(root, "lessons");
  fs.readdirSync(dir).filter((f) => /^lesson\d/.test(f)).forEach((f) => {
    const L = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    L.rounds.forEach((r, i) => {
      if (L.number === 1 && i === 0) return;
      const at = r.challenges.map((c) => c.kind).lastIndexOf("checkpoint");
      assert.ok(at > 0, f + " " + r.id + " needs a checkpoint after its first challenge");
    });
  });
});

test("test-out: passing on the first run skips the round, lists the rest as skipped, and moves on", () => {
  const { ctrl, sent } = setup();
  ctrl.start();
  ctrl.testOut();
  let v = ctrl.view();
  assert.equal(v.ch.kind, "checkpoint");
  assert.equal(v.ch.testOut.active, true);
  assert.equal(v.ch.testOut.note, "Test-out: 2 runs left.");
  assert.equal(v.ch.testOut.available, false);
  runOk(ctrl);
  v = ctrl.view();
  assert.equal(v.ch.testOut.passed, true);
  assert.match(v.ch.testOut.note, /round is done/);
  assert.equal(v.ch.nextEnabled, true);
  assert.equal(sent.filter((m) => m.type === "lesson_run").length, 1);
  ctrl.next();
  v = ctrl.view();
  assert.match(v.strip.text, /Round 2 of 2/);
  assert.equal(v.strip.line, "Task 1 of 4");
  assert.equal(v.ch.testOut.active, false);
  assert.deepEqual(Object.keys(ctrl.state.progress.skipped).sort(), ["d-r1-c1", "d-r1-c2"]);
  // finish the lesson: the end screen lists what was skipped, and only own typed lines under "Lines you wrote today"
  ctrl.quiz(0); ctrl.startRound();
  finishAll(ctrl);
  v = ctrl.view();
  assert.equal(v.screen, "end");
  // round 10: one short line per round, never each long prompt
  assert.equal(v.end.skipped.length, 1);
  v.end.skipped.forEach((x) => assert.equal(x.note, "skipped (tested out)"));
  assert.deepEqual(v.end.skipped[0].ns, [1, 2]);
  assert.equal(v.end.skipped[0].round, "Count things");
  assert.equal(v.end.skipped[0].label, "tasks 1 to 2");
  assert.equal(v.end.skipped[0].prompt, undefined, "the long prompt is not carried to the end screen");
  assert.ok(!v.end.lines.some((l) => l.code === "count_marbles(red_bag)"), "a skipped challenge is not a line you wrote");
  assert.ok(v.end.lines.some((l) => l.code === "count_marbles(blue_bag)"), "the checkpoint you passed is");
});

test("test-out: the second run may pass; a checkpoint clue still shows", () => {
  const { ctrl } = setup();
  ctrl.start();
  ctrl.testOut();
  runBad(ctrl);
  let v = ctrl.view();
  assert.equal(v.ch.testOut.note, "Test-out: 1 run left.");
  assert.equal(v.ch.testOut.active, true);
  assert.equal(ctrl.state.progress.fails["d-r1-c3"], undefined, "a test-out run counts no fail");
  assert.equal(v.ch.hintsAvailable, false);
  runOk(ctrl);
  v = ctrl.view();
  assert.equal(v.ch.testOut.passed, true);
  assert.match(v.ch.clue, /^Worth remembering: /);
  assert.equal(ctrl.state.progress.testedOut["d-r1"], true);
});

test("test-out: two failed runs return to the round start with no penalty", () => {
  const { ctrl } = setup();
  ctrl.start();
  ctrl.testOut();
  runBad(ctrl); runBad(ctrl);
  const v = ctrl.view();
  assert.equal(v.ch.id, "d-r1-c1", "back at the round's first challenge");
  assert.match(v.ch.feedback, /Back to the start of this round/);
  assert.match(v.ch.feedback, /Nothing is counted against you/);
  assert.deepEqual(ctrl.state.progress.fails, {}, "no fail is recorded");
  assert.deepEqual(ctrl.state.progress.skipped, {});
  assert.deepEqual(ctrl.state.progress.testedOut, {});
  assert.equal(v.ch.testOut.available, true, "the offer is still there");
  assert.equal(v.ch.testOut.active, false);
  // the checkpoint later behaves as if it had never been tried: no hint until the first ordinary miss (round 10: one, not two)
  runOk(ctrl); ctrl.next(); runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().ch.kind, "checkpoint");
  assert.equal(ctrl.view().ch.hintsAvailable, false, "the two test-out runs were free and left nothing behind");
  runBad(ctrl);
  assert.equal(ctrl.view().ch.hintsAvailable, true, "the first hint comes after the first ordinary miss");
});

test("test-out: Back to the round leaves without using a run; the last round can be tested out to the end", () => {
  const { ctrl } = setup();
  ctrl.start();
  ctrl.testOut(); runBad(ctrl);
  ctrl.leaveTestOut();
  assert.equal(ctrl.view().ch.id, "d-r1-c1");
  assert.deepEqual(ctrl.state.progress.fails, {});
  // pass round 1 normally, then test out of round 2 (a play box follows its checkpoint)
  for (let i = 0; i < 3; i++) { runOk(ctrl); ctrl.next(); }
  ctrl.quiz(0); ctrl.startRound();
  ctrl.testOut();
  assert.equal(ctrl.view().ch.id, "d-r2-c4");
  runOk(ctrl);
  const v = ctrl.view();
  assert.equal(v.ch.isLast, true, "nothing follows a tested-out last round");
  assert.equal(v.ch.testOut.passed, true);
  ctrl.next();
  assert.equal(ctrl.view().screen, "end");
  assert.equal(ctrl.view().end.skipped.length, 1, "one round, listed once");
  assert.equal(ctrl.view().end.skipped[0].ns.length, 3, "three typed or see steps; the ungraded play box was not skipped, so it is not listed");
  assert.ok(ctrl.view().end.skipped.every((x) => !/anything/i.test(x.label)));
});

test("test-out: a reload after passing lands on the next round; Start again clears it", () => {
  const storage = memoryStorage();
  const a = setup(storage);
  a.ctrl.start(); a.ctrl.testOut(); runOk(a.ctrl);
  const b = setup(storage);
  assert.equal(b.ctrl.view().screen, "start");
  b.ctrl.start();
  assert.equal(b.ctrl.view().screen, "challenge");
  assert.match(b.ctrl.view().strip.text, /Round 2 of 2/);
  b.ctrl.restart();
  assert.deepEqual(b.ctrl.state.progress.skipped, {});
  assert.deepEqual(b.ctrl.state.progress.testedOut, {});
  assert.equal(setup(storage).ctrl.view().screen, "start");
});

test("test-out: on the page the button shows on the first screen, starts the checkpoint, and offers a way back", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc);
  await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal($("testout").hidden, false);
  assert.equal($("testout-btn").hidden, false);
  const label = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8").match(/id="testout-btn"[^>]*>([^<]*)</)[1];
  assert.equal(label, "I know this: try the checkpoint (you can come back)");
  $("testout-btn").click();
  assert.match($("prompt").textContent, /blue bag from memory/);
  assert.equal($("testout-btn").hidden, true);
  assert.equal($("testout-leave").hidden, false);
  assert.equal($("testout-note").textContent, "Test-out: 2 runs left.");
  $("code").value = "nothing"; $("run").click();
  assert.equal($("testout-note").textContent, "Test-out: 1 run left.");
  $("code").value = "count_marbles(blue_bag)"; $("run").click();
  assert.match($("testout-note").textContent, /round is done/);
  assert.equal($("testout-leave").hidden, true);
  assert.equal($("next").disabled, false);
  $("next").click();
  assert.match($("strip-text").textContent, /Round 2 of 2/);
});

// ---- target range ----------------------------------------------------------------------------------
const jarIds = rangeFull.jars.map((j) => j.jar_id);
const lessonKey = (id) => lesson.STORE_PREFIX + id;
const passedLessons = (ids) => { const st = memoryStorage(); ids.forEach((id) => st.setItem(lessonKey(id), JSON.stringify({ started: true, lastCheckpointDone: true }))); return st; };

function setupRange(storage, mutateRun) {
  const sent = [];
  let ctrl;
  ctrl = lesson.createController({
    lessonId: "range", storage: storage || memoryStorage(),
    send: (msg) => {
      sent.push(msg);
      if (msg.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: msg.request_id, lesson: servedRange(rangeFull) });
      else if (msg.type === "lesson_run") {
        const ids = msg.code.match(/J-\d+/g);
        const reply = { type: "lesson_result", request_id: msg.request_id, challenge: msg.challenge, status: "ok", value_repr: "", pass: false, feedback: "Ran." };
        if (ids) reply.picked_ids = ids;
        if (mutateRun) mutateRun(reply, msg);
        ctrl.handle(reply);
      }
    },
  });
  ctrl.open();
  return { ctrl, sent };
}
const tileState = (v, id) => v.range.tiles.find((t) => t.id === id).state;

test("range: the fixture obeys the range rules, and the served copy never carries an example", () => {
  assert.deepEqual(rangeViolations(rangeFull, jarIds), []);
  assert.equal(jarIds.length, 12);
  servedRange(rangeFull).waves.forEach((w) => assert.equal(w.example, undefined));
});

test("range: scoring is hits minus misses; a clean wave needs every target and no miss", () => {
  const w = rangeFull.waves[1];                       // J-083, J-084, J-085
  let r = lesson.scoreShot(w, ["J-083", "J-084", "J-085"]);
  assert.deepEqual([r.hits, r.misses, r.score, r.clean], [3, 0, 3, true]);
  r = lesson.scoreShot(w, ["J-083", "J-091"]);
  assert.deepEqual([r.hits, r.misses, r.score, r.clean], [1, 1, 0, false]);
  assert.deepEqual(r.hitIds, ["J-083"]);
  assert.deepEqual(r.missIds, ["J-091"]);
  assert.deepEqual(r.missedIds, ["J-084", "J-085"]);
  r = lesson.scoreShot(w, ["J-083", "J-084", "J-085", "J-086", "J-087"]);
  assert.deepEqual([r.hits, r.misses, r.score, r.clean], [3, 2, 1, false]);
  r = lesson.scoreShot(w, []);
  assert.deepEqual([r.hits, r.misses, r.score, r.clean], [0, 0, 0, false]);
  const rule = rangeFull.waves[3];                    // any 2 different from J-091..093
  r = lesson.scoreShot(rule, ["J-091", "J-093"]);
  assert.deepEqual([r.hits, r.misses, r.clean], [2, 0, true]);
  r = lesson.scoreShot(rule, ["J-091", "J-091"]);
  assert.deepEqual([r.hits, r.clean], [1, false], "a repeated jar counts once");
  r = lesson.scoreShot(rule, ["J-091", "J-092", "J-093"]);
  assert.deepEqual([r.hits, r.misses, r.clean], [2, 1, false], "a third jar beyond the count is a miss");
  r = lesson.scoreShot(rule, ["J-091", "J-081"]);
  assert.deepEqual([r.hits, r.misses, r.clean], [1, 1, false]);
});

test("range: a wave is locked until its lesson's last checkpoint has passed on this browser", () => {
  const none = setupRange().ctrl.view();
  assert.equal(none.screen, "range");
  assert.deepEqual(none.range.waves.map((w) => w.locked), [true, true, true, true, true]);
  assert.equal(none.range.waves[0].unlockText, "Unlocks after Lesson 1");
  assert.equal(none.range.wave, null, "no wave to fire at yet");
  assert.equal(none.range.idle, "Unlocks after Lesson 1");
  const some = setupRange(passedLessons(["lesson1", "lesson2"])).ctrl.view();
  assert.deepEqual(some.range.waves.map((w) => w.locked), [false, false, false, true, true]);
  assert.equal(some.range.waves[3].unlockText, "Unlocks after Lesson 4");
  assert.equal(some.range.waves[4].unlockText, "Unlocks after Lesson 6");
  assert.equal(some.range.waves[0].unlockText === "" && some.range.waves[1].unlockText === "", true, "an open wave shows no lock text");
  assert.equal(some.range.wave.id, "w1", "opens on the first open wave");
  // a locked wave cannot be picked, and Fire does nothing there
  const { ctrl, sent } = setupRange(passedLessons(["lesson1"]));
  ctrl.selectWave("w3");
  assert.equal(ctrl.view().range.wave.id, "w1");
  ctrl.selectWave("w2");
  assert.equal(ctrl.view().range.wave.id, "w2");
  const none2 = setupRange();
  none2.ctrl.fire("J-091");
  assert.equal(none2.sent.filter((m) => m.type === "lesson_run").length, 0);
  assert.equal(sent.filter((m) => m.type === "lesson_run").length, 0);
});

test("range: finishing a lesson's last checkpoint sets the flag that opens its waves; Start again keeps it", () => {
  const storage = memoryStorage();
  const a = setup(storage, "lesson1");
  a.ctrl.start();
  assert.equal(JSON.parse(storage.getItem(lessonKey("lesson1"))).lastCheckpointDone, undefined);
  runOk(a.ctrl); a.ctrl.next(); runOk(a.ctrl); a.ctrl.next(); runOk(a.ctrl);   // round 1's checkpoint passes; not the last
  assert.equal(JSON.parse(storage.getItem(lessonKey("lesson1"))).lastCheckpointDone, undefined, "a middle checkpoint is not the last one");
  a.ctrl.next();
  a.ctrl.quiz(0); a.ctrl.startRound();
  while (a.ctrl.view().ch.kind !== "checkpoint") { if (a.ctrl.view().ch.kind !== "play") runOk(a.ctrl); a.ctrl.next(); }
  runOk(a.ctrl);
  assert.equal(JSON.parse(storage.getItem(lessonKey("lesson1"))).lastCheckpointDone, true);
  assert.equal(setupRange(storage).ctrl.view().range.waves[0].locked, false, "wave 1 unlocks after lesson 1");
  assert.equal(setupRange(storage).ctrl.view().range.waves[2].locked, true, "lesson 2 has not passed");
  a.ctrl.restart();
  assert.equal(setupRange(storage).ctrl.view().range.waves[0].locked, false, "Start again clears the steps but keeps what was earned");
  assert.equal(a.ctrl.view().screen, "start");
  assert.deepEqual(a.ctrl.state.progress.done, {});
  // a checkpoint passed by test-out counts the same
  const st2 = memoryStorage();
  const b = setup(st2, "lesson1");
  b.ctrl.start(); for (let i = 0; i < 3; i++) { runOk(b.ctrl); b.ctrl.next(); }
  b.ctrl.quiz(0); b.ctrl.startRound(); b.ctrl.testOut(); runOk(b.ctrl);
  assert.equal(JSON.parse(st2.getItem(lessonKey("lesson1"))).lastCheckpointDone, true);
  // and an old save (finished before this flag existed) is fixed the next time the lesson opens
  const st3 = memoryStorage();
  const c = setup(st3, "lesson1"); c.ctrl.start(); finishAll(c.ctrl);
  const saved = JSON.parse(st3.getItem(lessonKey("lesson1"))); delete saved.lastCheckpointDone; st3.setItem(lessonKey("lesson1"), JSON.stringify(saved));
  setup(st3, "lesson1");
  assert.equal(JSON.parse(st3.getItem(lessonKey("lesson1"))).lastCheckpointDone, true);
});

test("range: the rack shows targets as rings, then hits, misses and missed targets after a shot", () => {
  const { ctrl, sent } = setupRange(passedLessons(["lesson1"]));
  ctrl.selectWave("w2");
  let v = ctrl.view();
  assert.equal(v.range.tiles.length, 12);
  ["J-083", "J-084", "J-085"].forEach((id) => assert.equal(tileState(v, id), "target"));
  assert.equal(tileState(v, "J-081"), "");
  assert.equal(v.range.summary, "", "no score before the first shot");
  ctrl.fire("jars[[J-083, J-091], :]");
  assert.equal(sent.filter((m) => m.type === "lesson_run").at(-1).lesson, "range");
  assert.equal(sent.filter((m) => m.type === "lesson_run").at(-1).challenge, "w2");
  v = ctrl.view();
  assert.equal(tileState(v, "J-083"), "hit");
  assert.equal(tileState(v, "J-091"), "miss");
  assert.equal(tileState(v, "J-084"), "missed");
  assert.equal(tileState(v, "J-085"), "missed");
  assert.equal(tileState(v, "J-081"), "");
  assert.equal(v.range.summary, "Right jars: 1 of 3. Extra jars: 1.");
  assert.equal(v.range.clean, false);
  assert.equal(v.range.waves[1].done, false);
  ctrl.fire("J-083 J-084 J-085");
  v = ctrl.view();
  assert.equal(v.range.summary, "Right jars: 3 of 3. Extra jars: 0.");
  assert.equal(v.range.clean, true);
  assert.equal(v.range.waves[1].done, true);
  assert.match(v.range.feedback, /Level done/);
  assert.equal(tileState(v, "J-091"), "");
});

test("range: a done level stays done after a worse run and after a reload", () => {
  const storage = passedLessons(["lesson1"]);
  const a = setupRange(storage);
  a.ctrl.fire("J-091");
  assert.equal(a.ctrl.view().range.waves[0].done, true);
  a.ctrl.fire("J-091 J-092");
  assert.equal(a.ctrl.view().range.clean, false);
  assert.equal(a.ctrl.view().range.waves[0].done, true, "a later miss never takes a star away");
  const b = setupRange(storage).ctrl.view();
  assert.equal(b.range.waves[0].done, true);
  assert.equal(b.range.wave.id, "w2", "opens on the first open wave without a star");
  assert.equal(lesson.STORE_PREFIX + "range", "julia-time:lesson:v1:range");
});

test("range: a rule wave passes on any distinct jars from the group; the server's own numbers win", () => {
  const storage = passedLessons(["lesson1", "lesson2", "lesson4"]);
  const { ctrl } = setupRange(storage, (reply, msg) => {
    if (msg.code.includes("twice")) reply.range = { hits: 1, misses: 1, missed_targets: [], score: 0, clean: false, picked_ids: ["J-091", "J-091"] };
  });
  ctrl.selectWave("w4");
  ctrl.fire("J-092 J-093");
  assert.equal(ctrl.view().range.clean, true);
  assert.equal(ctrl.view().range.waves[3].done, true);
  ctrl.selectWave("w4");
  ctrl.fire("J-091 J-091 twice");
  const v = ctrl.view();
  assert.equal(v.range.summary, "Right jars: 1 of 2. Extra jars: 1 (J-091 came twice).");
  assert.equal(v.range.clean, false);
  assert.equal(tileState(v, "J-091"), "hit");
});

test("range: one jar id on its own is read; a value with no jars, an error, or a timeout keeps the rack still", () => {
  const storage = () => passedLessons(["lesson1"]);
  const one = setupRange(storage(), (reply) => { delete reply.picked_ids; reply.value_repr = '"J-091"'; reply.feedback = "Give back jar ids."; });
  one.ctrl.fire("x");
  assert.equal(one.ctrl.view().range.clean, true);
  const none = setupRange(storage(), (reply) => { delete reply.picked_ids; reply.value_repr = "7"; reply.feedback = ""; });
  none.ctrl.fire("x");
  let v = none.ctrl.view();
  assert.equal(v.range.summary, "");
  assert.match(v.range.feedback, /did not pick any jars/);
  assert.equal(tileState(v, "J-091"), "target");
  const err = setupRange(storage(), (reply) => { reply.status = "error"; delete reply.picked_ids; reply.feedback = ""; reply.message = "UndefVarError: x not defined"; });
  err.ctrl.fire("x");
  v = err.ctrl.view();
  assert.match(v.range.feedback, /could not run this|does not know the name x/);
  assert.equal(v.range.message, "UndefVarError: x not defined");
  const slow = setupRange(storage(), (reply) => { reply.status = "timeout"; delete reply.picked_ids; reply.feedback = ""; });
  slow.ctrl.fire("x");
  assert.match(slow.ctrl.view().range.feedback, /took too long/);
});

test("range: switching waves clears the last shot and keeps each wave's draft", () => {
  const { ctrl } = setupRange(passedLessons(["lesson1"]));
  ctrl.fire("J-091 draft one");
  ctrl.selectWave("w2");
  assert.equal(ctrl.view().range.summary, "");
  assert.equal(ctrl.view().range.code, "");
  ctrl.rangeDraft("second draft");
  ctrl.selectWave("w1");
  assert.equal(ctrl.rangeCode(), "J-091 draft one");
  ctrl.selectWave("w2");
  assert.equal(ctrl.rangeCode(), "second draft");
});

test("range: a hint sits behind a button and no example or answer ever reaches the screen", () => {
  const { ctrl } = setupRange(passedLessons(["lesson1"]));
  assert.equal(ctrl.view().range.wave.hintOpen, false);
  assert.equal(ctrl.view().range.wave.hint, "Square brackets pick one item by its place.");
  ctrl.toggleHint();
  assert.equal(ctrl.view().range.wave.hintOpen, true);
  assert.doesNotMatch(JSON.stringify(ctrl.view()), /jars\.jar_id\[7\]/, "the example stays on the server");
  ctrl.selectWave("w2");
  assert.equal(ctrl.view().range.wave.hintOpen, false, "the next wave starts with its hint shut");
});

test("range: no timer, no leaderboard, one short fade and nothing else that moves", () => {
  const js = screenSrc().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.doesNotMatch(js, /setInterval|requestAnimationFrame|Date\.now|performance\.now|countdown/i);
  assert.doesNotMatch(js + html, /leaderboard|high score|ranking/i);
  assert.equal((css.match(/@keyframes/g) || []).length, 1, "one keyframe animation");
  assert.match(css, /@keyframes fade \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/);
  const motion = css.replace(/@media \(prefers-reduced-motion[^\n]*\n?/, "");
  (motion.match(/animation:[^;]*;/g) || []).forEach((a) => assert.match(a, /fade 150ms/, a));
  (motion.match(/transition:[^;]*;/g) || []).forEach((t) => assert.match(t, /150ms/, t));
  assert.match(css, /prefers-reduced-motion/);
});

test("range: on the page Run runs the level, the rack marks hits, misses and rings, and locked levels are one line", async () => {
  const storage = passedLessons(["lesson1"]);
  const page = fakePage(storage, rangeFull, "?lesson=range");
  lesson.init(page.doc);
  await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("screen-lesson").hidden, false);
  assert.equal($("screen-lesson").attrs["data-mode"], "range");
  assert.equal($("run").textContent, "Run", "0.5: Run, never Fire");
  assert.equal($("run").attrs["aria-label"], "Run the code");
  assert.equal($("strip-text").textContent, "Target range (optional)");
  assert.equal($("board-link").attrs.href, "course/index.html", "the bar's Board link is the way back");
  assert.equal($("next").hidden, true);
  assert.equal($("dict").hidden, true);
  assert.equal($("predict").hidden, true);
  assert.equal($("testout").hidden, true);
  assert.equal($("round-title").textContent, "Target range dummy");
  assert.match($("prompt").textContent, /^Level 1: Hit jar J-091/);
  assert.equal($("waves").hidden, false);
  const waveButtons = () => $("wave-list").all().filter((n) => n.tag === "button");
  assert.deepEqual(waveButtons().map((b) => b.children[0].textContent), ["Level 1", "Level 2"], "only the open levels are buttons");
  assert.equal(waveButtons()[0].attrs["aria-current"], "true");
  assert.equal($("locked-line").hidden, false);
  assert.equal($("locked-line").textContent, "3 more levels open as you finish Lessons 2 to 6.", "the locked levels are one collapsed line");
  const jars = () => $("board").all().filter((n) => /(^| )jar( |$)/.test(n.className));
  assert.equal(jars().length, 12, "the 12 case jars");
  assert.equal(jars().filter((j) => / target/.test(j.className)).length, 1);
  assert.equal($("board").hidden, false);
  // Run, all clean: no points and no stars (Shinichi's decision, 30 Sep)
  $("code").value = "jars.jar_id[7] is J-091"; $("run").click();
  assert.equal(jars().filter((j) => / hit/.test(j.className)).length, 1);
  assert.equal(jars().find((j) => / hit/.test(j.className)).children[0].textContent, "✓");
  assert.equal($("board").all().find((n) => n.className === "board-summary").textContent, "Right jars: 1 of 1. Extra jars: 0. ✓");
  assert.equal($("feedback").textContent, "Every target hit, and nothing else. Level done.");
  assert.equal($("feedback").className, "ok");
  assert.equal(waveButtons()[0].children[1].textContent, "✓ done");
  assert.doesNotMatch($("board").textContent + $("feedback").textContent + $("then-line").textContent, /star|score|★/i);
  // level 2: a hit, a miss, two missed targets (ring only)
  waveButtons()[1].click();
  $("code").value = "J-083 J-091"; $("run").click();
  assert.equal(jars().filter((j) => / hit/.test(j.className)).length, 1);
  const miss = jars().find((j) => / miss( |$)/.test(j.className));
  assert.equal(miss.children[0].textContent, "✗");
  assert.equal(jars().filter((j) => / missed/.test(j.className)).length, 2);
  assert.equal($("board").all().find((n) => n.className === "board-summary").textContent, "Right jars: 1 of 3. Extra jars: 1.");
  assert.match($("board").attrs["aria-label"], /Right jars: 1 of 3\. Extra jars: 1\./);
  // hint behind a button
  assert.equal($("wave-hint-text").hidden, true);
  $("wave-hint").click();
  assert.equal($("wave-hint-text").hidden, false);
  assert.equal($("wave-hint-text").textContent, "Rows 3 to 5 are written 3:5.");
  assert.equal($("wave-hint").attrs["aria-expanded"], "true");
  // an error shows a line and Julia's message
  $("code").value = "oops"; $("run").click();
  assert.match($("feedback").textContent, /does not know the name x/);
  assert.equal($("julia-msg").hidden, false);
  // Reset clears the editor; the level stays done after a reload
  $("reset").click();
  assert.equal($("code").value, "");
  const again = fakePage(storage, rangeFull, "?lesson=range");
  lesson.init(again.doc);
  await tick();
  assert.equal(again.byId["wave-list"].all().filter((n) => n.tag === "button")[0].children[1].textContent, "✓ done");
});

test("range: with no lesson passed the page still draws, says what opens the first level, and Run is off", async () => {
  const page = fakePage(memoryStorage(), rangeFull, "?lesson=range");
  lesson.init(page.doc);
  await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("prompt").textContent, "Unlocks after Lesson 1");
  assert.equal($("run").disabled, true);
  assert.equal($("wave-hint").hidden, true);
  assert.equal($("board").all().filter((n) => /(^| )jar( |$)/.test(n.className)).length, 12);
});

test("range: the lesson list and every lesson's end screen link to it; the range is not listed as a lesson", async () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  // P05: the link says what it is once; the sentence beside it says it is optional practice
  assert.match(html, /<a id="range-link" href="lesson\.html\?lesson=range">Target range<\/a> <span class="muted">Optional practice: write a line that picks the right jars\.<\/span>/);
  assert.match(html, /<p id="end-range"><a href="lesson\.html\?lesson=range">Target range<\/a> <span class="muted">Optional practice/);
  assert.ok(html.indexOf('id="range-link"') > html.indexOf('id="lesson-list"'), "under the list");
  assert.ok(html.indexOf('id="end-range"') > html.indexOf('id="end-lines"'));
  assert.equal(lesson.RANGE_ID, "range");
  assert.equal(lesson.lessonIdFromSearch("?lesson=range"), "range");
  const page = fakePage(memoryStorage(), dummyFull, "");
  lesson.init(page.doc);
  await tick();
  const items = page.byId["lesson-list"].children;
  assert.equal(items.length, 1, "the range entry is not a numbered lesson");
  assert.equal(items[0].children[0].textContent, "Lesson 7: Sort the marbles");
  assert.equal(page.byId["screen-list"].hidden, false);
  // the print sheet leaves the link out
  assert.match(fs.readFileSync(path.join(root, "web/lesson.css"), "utf8"), /#end-range, #restart[^{]*\{ display: none !important/);
});

test("range: on the page a finished lesson's end screen keeps its link and lists tested-out lines", async () => {
  const storage = memoryStorage();
  const a = setup(storage);
  a.ctrl.start(); a.ctrl.testOut(); runOk(a.ctrl); a.ctrl.next(); a.ctrl.quiz(0); a.ctrl.startRound(); finishAll(a.ctrl);
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc);
  await tick();
  assert.equal(page.byId["screen-end"].hidden, false);
  assert.equal(page.byId["end-skipped"].hidden, false);
  const text = page.byId["end-skipped"].textContent;
  // round 10: one short line per round, not each challenge's long prompt
  assert.equal((text.match(/skipped \(tested out\)/g) || []).length, 1);
  assert.match(text, /Count things · tasks 1 to 2 \(skipped \(tested out\)\)/);
  assert.doesNotMatch(text, /Run the worked line/);
});

// ======================================================================================================
// Round 6 (29 Sep): empowered, Julia's way, calm screen.
// can_do, skills so far, the common mistake, Look closer, the pair line, the result label, glossary in
// every text, one filled button at a time, and the round 5 screen findings.
// ======================================================================================================
const skillKey = (id) => lesson.STORE_PREFIX + id;
const otherSkill = { started: true, lastCheckpointDone: true, skill: { number: 2, title: "Count by tray", can_do: ["Count jars on one tray.", "Name a result."] } };

// ---- can_do, the common mistake, skills so far -------------------------------------------------------
test("can_do: the start page shows the promise and the end screen the same words", () => {
  const { ctrl } = setup();
  assert.deepEqual(ctrl.view().lesson.canDo, dummyFull.close.can_do);
  ctrl.start(); finishAll(ctrl);
  const e = ctrl.view().end;
  assert.deepEqual(e.canDo, dummyFull.close.can_do);
  assert.equal(e.mistake, dummyFull.close.common_mistake);
  const bare = ctrlFor((d) => { delete d.close.can_do; delete d.close.common_mistake; });
  assert.deepEqual(bare.view().lesson.canDo, []);
  bare.start(); finishAll(bare);
  assert.deepEqual(bare.view().end.canDo, []);
  assert.equal(bare.view().end.mistake, "");
});

test("can_do: on the page the start page says 'By the end you will be able to:'; the pair line has moved to How to play", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc);
  await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("start-promise").hidden, false);
  assert.match($("start-promise").textContent, /^By the end you will be able to:Count the items in a bag\.Pick one marble by its place\.$/);
  assert.equal($("start-promise").children.filter((n) => n.tag === "ul")[0].children.length, 2);
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const start = html.slice(html.indexOf('id="screen-start"'), html.indexOf('id="screen-lesson"'));
  assert.ok(start.indexOf("start-promise") < start.indexOf('id="start"'));
  assert.doesNotMatch(html, /Working in pairs/, "fix round 2 (P12): the pair line lives on How to play, not on every card");
  // a lesson with no can_do shows no promise box
  const none = JSON.parse(JSON.stringify(dummyFull)); delete none.close.can_do;
  const p2 = fakePage(memoryStorage(), none);
  lesson.init(p2.doc); await tick();
  assert.equal(p2.byId["start-promise"].hidden, true);
});

test("skills: reaching the end saves this lesson's can_do; Start again keeps it; a list gathers them from storage", () => {
  const storage = memoryStorage();
  storage.setItem(skillKey("lesson2"), JSON.stringify(otherSkill));
  const { ctrl } = setup(storage);
  ctrl.start();
  assert.equal(JSON.parse(storage.getItem(skillKey("dummy"))).skill, undefined, "not before the end");
  finishAll(ctrl);
  const saved = JSON.parse(storage.getItem(skillKey("dummy"))).skill;
  assert.deepEqual(saved, { number: 7, title: "Sort the marbles", can_do: dummyFull.close.can_do });
  assert.deepEqual(ctrl.view().end.skills, [], "0.5: a lesson's end shows its own You can now, never the skills list so far");
  ctrl.restart();
  assert.deepEqual(JSON.parse(storage.getItem(skillKey("dummy"))).skill, saved, "Start again keeps the skill");
  // the lesson list reads the same storage, with no lesson open
  const list = setup(storage, "");
  assert.equal(list.ctrl.view().screen, "list");
  assert.deepEqual(list.ctrl.view().skills.map((k) => k.number), [2, 7]);
  assert.deepEqual(setup(memoryStorage(), "").ctrl.view().skills, [], "nothing finished, nothing listed");
  // a broken save is ignored
  const bad = memoryStorage(); bad.setItem(skillKey("x"), "{not json"); bad.setItem(skillKey("y"), JSON.stringify({ skill: { number: "two" } }));
  assert.deepEqual(setup(bad, "").ctrl.view().skills, []);
});

test("skills, page: the end screen shows You can now and the mistake, never the growing skills list; the list shows skills", async () => {
  const storage = memoryStorage();
  const a = setup(storage);
  a.ctrl.start(); finishAll(a.ctrl);
  let page = fakePage(storage, dummyFull);
  lesson.init(page.doc); await tick();
  let $ = (id) => page.byId[id];
  assert.equal($("screen-end").hidden, false);
  assert.match($("end-can-do").textContent, /^You can now:Count the items in a bag\.Pick one marble by its place\.$/);
  assert.match($("end-mistake").textContent, /^The mistake everyone makes hereRound brackets call a function/);
  assert.equal($("end-skills").hidden, true, "only this lesson is finished, so the skills list would repeat 'You can now'");
  storage.setItem(skillKey("lesson2"), JSON.stringify(otherSkill));
  page = fakePage(storage, dummyFull);
  lesson.init(page.doc); await tick();
  $ = (id) => page.byId[id];
  assert.equal($("end-skills").hidden, true, "0.5: only the latest skills; a lesson's are its You can now");
  // the lesson list
  const lp = fakePage(storage, dummyFull, "");
  lesson.init(lp.doc); await tick();
  assert.equal(lp.byId["list-skills"].hidden, false);
  assert.match(lp.byId["list-skills"].textContent, /^Your skills so far/);
  assert.match(lp.byId["list-skills"].textContent, /Count jars on one tray\./);
  const empty = fakePage(memoryStorage(), dummyFull, "");
  lesson.init(empty.doc); await tick();
  assert.equal(empty.byId["list-skills"].hidden, true);
  // where they sit: the end screen only, after the lines and before the print button
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const at = (id) => html.indexOf('id="' + id + '"');
  assert.ok(at("end-can-do") > at("screen-end") && at("end-mistake") > at("screen-end") && at("end-skills") > at("screen-end"));
  assert.ok(at("end-skills") < at("end-more"), "above the fold");
  assert.ok(at("list-skills") > at("screen-list") && at("list-skills") < at("screen-start"));
});

// ---- Look closer -----------------------------------------------------------------------------------
// A Look closer shows on the screen of the see that carries it. The dummy lesson is "Lesson 7", so its round 1 first screen
// offers test-out (which owns that screen); as Lesson 1 it does not, so these tests play it as Lesson 1.
const asLesson1 = (d) => { d.number = 1; };
const lookCtrl = () => ctrlFor(asLesson1);
// a see in the middle of round 1 that carries the box (the data rule keeps it off a round's first screen)
const midSee = (d) => {
  const c1 = d.rounds[0].challenges[0], c2 = d.rounds[0].challenges[1];
  c2.kind = "see"; c2.labels = c1.labels; c2.look_closer = c1.look_closer; delete c1.look_closer;
};

test("look closer: closed under the worked see line; open, it runs the line with look: true and shows the value, never graded", () => {
  const sent = [];
  const spy = lesson.createController({
    lessonId: "dummy", storage: memoryStorage(),
    send: (m) => {
      sent.push(m);
      if (m.type === "lesson_info") spy.handle({ type: "lesson", request_id: m.request_id, lesson: served(Object.assign(JSON.parse(JSON.stringify(dummyFull)), { number: 1 })) });
      else if (m.type === "lesson_run") {
        const pass = m.code.trim() === answers[m.challenge] && !m.look;
        spy.handle({ type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", value_repr: pass ? "5" : "0", pass, feedback: pass ? "Good." : "" });
      }
    },
  });
  spy.open(); spy.start();
  const ctrl = spy;
  let look = ctrl.view().ch.look;
  assert.equal(look.open, false);
  assert.equal(look.code, "typeof(bag)");
  assert.match(look.text, /what kind of thing/);
  ctrl.tryLook();
  assert.equal(sent.filter((m) => m.look).length, 0, "Try it does nothing while the box is closed");
  ctrl.toggleLook();
  assert.equal(ctrl.view().ch.look.open, true);
  const before = JSON.stringify(ctrl.state.progress);
  ctrl.tryLook();
  const req = sent.filter((m) => m.type === "lesson_run" && m.look);
  assert.equal(req.length, 1);
  assert.equal(req[0].challenge, "d-r1-c1", "it names the see challenge the box belongs to");
  assert.equal(req[0].code, "typeof(bag)");
  assert.equal(req[0].look, true);
  look = ctrl.view().ch.look;
  assert.ok(look.result, "the value came back");
  assert.equal(look.result.repr, "0");
  assert.equal(JSON.stringify(ctrl.state.progress), before, "never graded: no pass, no fail count, no draft");
  assert.equal(ctrl.view().ch.result, null, "the main result box is not touched");
  assert.equal(ctrl.view().ch.nextEnabled, false, "and Next is not opened by it");
  // a look run does not stop the main Run, and the main result does not land in the look box
  runOk(ctrl);
  assert.equal(ctrl.view().ch.nextEnabled, true);
  assert.equal(ctrl.view().ch.look.result.repr, "0");
  ctrl.toggleLook();
  assert.equal(ctrl.view().ch.look.open, false);
});

test("look closer: open, it takes the pocket dictionary's place; closed again, the dictionary is back", () => {
  const ctrl = lookCtrl();
  ctrl.start();
  assert.equal(ctrl.view().ch.dictionary.length, 1, "the dictionary shows while the box is closed");
  ctrl.toggleLook();
  assert.equal(ctrl.view().ch.dictionary.length, 0, "the box replaces it, so opening adds no height");
  ctrl.toggleLook();
  assert.equal(ctrl.view().ch.dictionary.length, 1);
});

test("look closer: only on its own see screen; never on the challenges after it, at a checkpoint, or where test-out is offered", () => {
  // as Lesson 1 round 1 (no test-out): the see's own screen shows it, the change after it does not
  const one = lookCtrl();
  one.start(); one.toggleLook(); one.tryLook();
  runOk(one); one.next();
  let ch = one.view().ch;
  assert.equal(ch.id, "d-r1-c2");
  assert.equal(ch.look, null, "the link is not carried over");
  assert.equal(ch.pinned, null, "0.5: the worked line is hidden here, since the editor starts with that very line");
  assert.equal(one.state.look.open, false, "closed on a new challenge");
  assert.equal(ch.look, null);
  one.toggleLook();
  assert.equal(one.state.look.open, false, "and it cannot be opened here");
  runOk(one); one.next();
  ch = one.view().ch;
  assert.equal(ch.kind, "checkpoint");
  assert.equal(ch.look, null, "no worked line at a checkpoint, so no way to look closer at it");
  // fix round 2: a round's first screen may offer test-out and Look closer side by side (Lesson 1 round 1 offers
  // test-out now, and its first see carries a Look closer)
  const seven = ctrlFor((d) => { d.rounds[0].challenges[0].look_closer = { text: "Try this.", code: "typeof(bag)" }; });
  seven.start();
  assert.equal(seven.view().ch.testOut.available, true);
  assert.ok(seven.view().ch.look, "Look closer still shows beside test-out");
  seven.toggleLook();
  assert.equal(seven.state.look.open, true);
  // a see that is not a round's first screen shows it, and only on that screen
  const mid = ctrlFor((d) => { asLesson1(d); midSee(d); d.number = 7; });
  mid.start();
  assert.equal(mid.view().ch.look, null, "the first screen carries none");
  runOk(mid); mid.next();
  assert.equal(mid.view().ch.id, "d-r1-c2");
  assert.ok(mid.view().ch.look, "a see in the middle of a round carries it");
  runOk(mid); mid.next();
  assert.equal(mid.view().ch.look, null, "and it is gone on the next screen");
  const none = ctrlFor((d) => { asLesson1(d); delete d.rounds[0].challenges[0].look_closer; });
  none.start();
  assert.equal(none.view().ch.look, null);
});

test("look closer: a run that fails shows a plain line, not an empty box, and a lost reply never blocks Run", () => {
  const ctrl = lookCtrl();
  ctrl.start(); ctrl.toggleLook();
  ctrl.state.look.pending = "look-x";                   // a look run is on its way
  ctrl.handle({ type: "lesson_result", request_id: "look-x", challenge: "d-r1-c1", status: "error", value_repr: "", value_table: null, stdout: "", message: "UndefVarError: x", pass: false, feedback: "" });
  const look = ctrl.view().ch.look;
  assert.equal(look.result.failed, true);
  assert.equal(look.result.message, "UndefVarError: x");
  ctrl.state.look.pending = "look-lost";
  runOk(ctrl);
  assert.equal(ctrl.view().ch.result.pass, true);
});

test("look closer: one row of a table is shown as a one-row table, never with Julia's type line", () => {
  const repr = "DataFrameRow\n Row \u2502 jar_id  batch_id  tray_id  detected\n     \u2502 String  String    String   Bool\n\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n   2 \u2502 J02     B08       T-A      false";
  assert.equal(lesson.rowTable(repr).columns.join(","), "jar_id,batch_id,tray_id,detected");
  assert.equal(lesson.rowTable(repr).rows[0].join(","), "J02,B08,T-A,false");
  assert.equal(lesson.rowTable("3-element Vector{Int64}:\n 1\n 2\n 3"), null);
  assert.equal(lesson.tableInfo(repr).rows, 1, "and it is a table, not plain text");
  const ctrl = lookCtrl();
  ctrl.start(); ctrl.toggleLook();
  ctrl.state.look.pending = "look-r";
  ctrl.handle({ type: "lesson_result", request_id: "look-r", challenge: "d-r1-c1", status: "ok", value_repr: repr, value_table: null, stdout: "", pass: false, feedback: "" });
  const res = ctrl.view().ch.look.result;
  assert.deepEqual(res.table.columns, ["jar_id", "batch_id", "tray_id", "detected"]);
  assert.ok(!/DataFrameRow/.test(JSON.stringify(res.table)));
  // a row that will not split cleanly falls back to the plain text under a "table" caption, still without the type line
  const odd = lesson.tableInfo("DataFrameRow\n Row \u2502 a\n     \u2502 String\n\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\n   1 \u2502 two words");
  assert.equal(odd.rows, 1);
  assert.ok(!/DataFrameRow/.test(odd.body));
});

test("look closer, page: a closed link; open shows text, code and a quiet Try it, and the value; the dictionary steps aside", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull)); asLesson1(def);
  const page = fakePage(memoryStorage(), def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal($("look").hidden, false);
  assert.equal($("look-link").attrs["aria-expanded"], "false");
  assert.equal($("look-box").hidden, true);
  assert.equal($("dict").hidden, false, "the dictionary is on show while the box is closed");
  $("look-link").click();
  assert.equal($("look-box").hidden, false);
  assert.equal($("dict").hidden, true, "an open box replaces the dictionary");
  assert.equal($("look-link").attrs["aria-expanded"], "true");
  assert.match($("look-text").textContent, /what kind of thing/);
  assert.equal($("look-code").textContent, "typeof(bag)");
  assert.equal($("look-result").hidden, true);
  $("look-try").click();
  assert.equal($("look-result").hidden, false);
  assert.match($("look-result").textContent, /0/);
  assert.equal($("result").hidden, true, "the main result box stays empty");
  $("look-link").click();
  assert.equal($("look-box").hidden, true);
  assert.equal($("dict").hidden, false, "and the dictionary comes back");
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const at = (id) => html.indexOf('id="' + id + '"');
  assert.ok(at("pinned") < at("look") && at("look-link") < at("look-box"), "it sits under the pinned line, link before box");
  assert.match(html, /<button id="look-try" type="button" class="quiet">/, "Try it is not a filled button");
  assert.match(html, /<button id="look-link" type="button" class="linkish"/);
  assert.doesNotMatch(html, /class="[^"]*\bsmall\b/, "fix round 2 (P15): no small text anywhere on the page");
  // the next screen (a change) carries no link, and a checkpoint has no pinned line, so none either
  guessFirst($); $("run").click(); $("next").click();
  assert.equal($("look").hidden, true);
  $("code").value = answers["d-r1-c2"]; $("run").click(); $("next").click();
  assert.equal($("look").hidden, true);
});

// ---- the result label --------------------------------------------------------------------------------
test("result label: a 'result' label chip stands out, and the output box is captioned Result", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.rounds[0].challenges[0].labels.push({ part: "5", is: "result" });
  const page = fakePage(memoryStorage(), def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  const chips = $("pinned-labels").children;
  // round 9: no answer before the guess, so the result label waits for the first Run
  assert.deepEqual(chips.map((c) => c.textContent), ["count_marbles function", "bag object"]);
  assert.equal($("result-label").hidden, true, "no caption before a run");
  guessFirst($); $("run").click();
  const chips2 = $("pinned-labels").children;
  assert.deepEqual(chips2.map((c) => c.textContent), ["count_marbles function", "bag object", "5 result"]);
  assert.equal(chips2[2].className, "chip result");
  assert.equal(chips2[0].className, "chip");
  assert.match(fs.readFileSync(path.join(root, "web/lesson.html"), "utf8"), /<p id="result-label" class="cap" hidden>Result<\/p>/);
  assert.equal($("result-label").hidden, false);
});

// ---- glossary in every text ---------------------------------------------------------------------------
test("glossary, round 6: terms are underlined in the predict question, hints, the warm-up and feedback lines", () => {
  const { ctrl } = setup();
  ctrl.start();
  let ch = ctrl.view().ch;
  assert.deepEqual(termsOf(ch.predict.questionParts), ["answer"], "the predict question");
  assert.equal(joinParts(ch.predict.questionParts), ch.predict.question);
  ctrl.toggleTerm("answer");
  assert.equal(ctrl.view().ch.gloss.under, "predict");
  assert.match(ctrl.view().ch.gloss.means, /gives back/);
  runOk(ctrl);
  // the pass line for c1 holds no gloss word; go on to c2, whose wrong line holds 'name' (first met there)
  ctrl.next();
  ch = feed(ctrl, { feedback: "Change the name inside the brackets." });
  assert.equal(ch.feedback, "Change the name inside the brackets.");
  assert.deepEqual(termsOf(ch.feedbackParts), ["name"], "a feedback line");
  assert.equal(joinParts(ch.feedbackParts), ch.feedback);
  ctrl.toggleTerm("name");
  assert.equal(ctrl.view().ch.gloss.under, "feedback");
  runOk(ctrl); ctrl.next();
  // the checkpoint's hints: 'shape' is first met in hint 2
  runBad(ctrl); runBad(ctrl);
  ctrl.hint(); ctrl.hint();
  ch = ctrl.view().ch;
  assert.deepEqual(termsOf(ch.hints[0].parts), [], "hint 1 holds no gloss word");
  assert.deepEqual(termsOf(ch.hints[1].parts), ["shape"]);
  ctrl.toggleTerm("shape");
  assert.equal(ctrl.view().ch.gloss.under, "hint1");
  // the warm-up question of round 2 carries no underlines, and 'line' (met in round 1) stays plain
  runOk(ctrl); ctrl.next();
  ch = ctrl.view().ch;
  assert.ok(!ch.remember.promptParts, "the warm-up quiz is plain");
  ctrl.quiz(0); ctrl.startRound();
  assert.deepEqual(termsOf(ctrl.view().ch.promptParts), ["marble"]);
});

test("glossary, round 6: hints and feedback are read last, so they never take a word from a prompt the player always meets", () => {
  const gl = [{ term: "table", means: "m" }];
  const src = [
    { key: "wrong1", text: "Check the table.", late: true },
    { key: "prompt2", text: "Look at the table." },
  ];
  const marks = lesson.glossaryMarks(src, gl);
  assert.deepEqual(marks.wrong1, []);
  assert.equal(marks.prompt2.length, 1);
  // with only late sources, the first of them takes it
  assert.equal(lesson.glossaryMarks([{ key: "a", text: "a table", late: true }, { key: "b", text: "the table", late: true }], gl).a.length, 1);
  assert.equal(lesson.glossaryMarks([{ key: "a", text: "a table", late: true }, { key: "b", text: "the table", late: true }], gl).b.length, 0);
});

test("glossary, round 6: a sign term is not found inside a longer sign, and a word and its plural are one term", () => {
  const gl = [{ term: "=", means: "save" }, { term: "==", means: "same" }, { term: ".!=", means: "differ" }, { term: "deal", means: "d1" }, { term: "deals", means: "d2" }];
  const found = (text) => lesson.glossaryMarks([{ key: "a", text }], gl).a.map((m) => text.slice(m.start, m.end));
  assert.deepEqual(found("Use .!= to compare."), [".!="], "the '=' inside '.!=' is not the term '='");
  assert.deepEqual(found("Two == ask a question."), ["=="]);
  assert.deepEqual(found("Type x = 5 now."), ["="]);
  assert.deepEqual(found("Use <= and >= here"), [], "the '=' of '<=' and '>=' is not '='");
  assert.equal(found("deal six cards, then deals more").length, 1, "'deal' and 'deals' are one word: once");
  const marks = lesson.glossaryMarks([{ key: "a", text: "deal six" }, { key: "b", text: "it deals six" }], gl);
  assert.equal(marks.a.length, 1);
  assert.equal(marks.b.length, 0);
});

test("glossary, round 6: on a test-out only the checkpoint's own texts count, so its words are underlined", () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  // the checkpoint's prompt names a word that round 1's earlier screens also hold
  def.rounds[0].challenges[2].prompt = "Count the blue bag from memory, using the function.";
  let ctrl;
  ctrl = lesson.createController({ lessonId: "dummy", storage: memoryStorage(), send: (m) => { if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: served(def) }); } });
  ctrl.open(); ctrl.start();
  ctrl.testOut();
  const ch = ctrl.view().ch;
  assert.equal(ch.kind, "checkpoint");
  assert.deepEqual(termsOf(ch.promptParts), ["bag", "function"], "'bag' and 'function' were in skipped screens; the test-out player never saw them");
  ctrl.leaveTestOut();
  ctrl.state.index = 2;
  assert.deepEqual(termsOf(ctrl.view().ch.promptParts), [], "a normal walk-through still underlines 'function' once, in the explain");
});

test("glossary: a word that would have been underlined in a round the player tested out is underlined in the next round", () => {
  const ctrl = ctrlFor((def) => { def.rounds[1].challenges[0].prompt = "Run the worked line and read the marble in the bag."; });
  ctrl.start(); ctrl.testOut(); runOk(ctrl); ctrl.next();
  ctrl.quiz(0); ctrl.startRound();
  const ch = ctrl.view().ch;
  assert.deepEqual(termsOf(ch.explainParts), ["square brackets"]);
  assert.deepEqual(termsOf(ch.promptParts), ["line", "marble"], "round 1's other screens were skipped, so 'line' was never underlined for this player ('bag' was, at the checkpoint they did meet)");
});

test("glossary, round 6: on the page terms in the predict question, hints and feedback are buttons and their meaning opens right under them", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  page.hooks.run = (out) => { if (!out.pass) out.feedback = "Change the name inside the brackets."; };
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  const q = $("predict").children[0];
  const term = q.children.find((n) => n.tag === "button");
  assert.equal(term.textContent, "answer");
  assert.equal(term.attrs["data-term"], "answer");
  term.click();
  const g = $("predict").children.find((n) => n.className === "gloss");
  assert.ok(g, "the meaning sits inside the predict box, right under the question");
  assert.match(g.textContent, /^answer: what Julia gives back/);
  assert.equal($("predict").children.indexOf(g), 1);
  term.click();
  assert.equal($("predict").children.find((n) => n.className === "gloss"), undefined);
  // feedback
  guessFirst($); $("run").click(); $("next").click();
  $("code").value = "count_marbles(nothing)"; $("run").click();
  assert.equal($("feedback").textContent, "Change the name inside the brackets.");
  const fb = $("feedback").children.find((n) => n.tag === "button");
  assert.equal(fb.textContent, "name");
  assert.equal($("gloss-feedback").hidden, true);
  fb.click();
  assert.equal($("gloss-feedback").hidden, false);
  assert.match($("gloss-feedback").textContent, /^name: a word that holds something/);
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.ok(html.indexOf('id="feedback"') < html.indexOf('id="gloss-feedback"') && html.indexOf('id="gloss-feedback"') < html.indexOf('id="julia-msg"'));
});

// ---- one filled button at a time ----------------------------------------------------------------------
test("calm screen: Run is the one filled button until the step is done, then Next is; a play box keeps Run", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal($("run").className, "primary");
  assert.equal($("next").className, "");
  guessFirst($); $("run").click();
  assert.equal($("run").className, "quiet", "the step is done: Run steps back");
  assert.equal($("next").className, "primary");
  $("next").click();
  assert.equal($("run").className, "primary", "a new step starts with Run again");
  assert.equal($("next").className, "");
  const filled = () => ["run", "next", "reset", "show-line"].filter((id) => !$(id).hidden && $(id).className === "primary").length;
  assert.equal(filled(), 1);
  $("code").value = answers["d-r1-c2"]; $("run").click();
  assert.equal(filled(), 1);
  // the play box
  const ctrl = setup().ctrl; ctrl.start(); ctrlToPlay(ctrl);
  assert.equal(ctrl.view().ch.kind, "play");
  assert.equal(ctrl.view().ch.nextEnabled, true);
  assert.equal(ctrl.view().ch.nextPrimary, false, "Next is open, but Run is the play box's main action");
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.equal((html.match(/class="primary"/g) || []).length, 2, "the page starts with two filled buttons: Start (its own screen) and Run");
});

// ---- the round 5 screen findings ------------------------------------------------------------------------
test("range: a rule wave shows the server's own line after a miss, and rings no single 'missed' jar", () => {
  const storage = passedLessons(["lesson1", "lesson2", "lesson4"]);
  const { ctrl } = setupRange(storage, (reply, msg) => { if (msg.challenge === "w4") reply.feedback = "Pick exactly 2 different jars: you picked 1."; });
  ctrl.selectWave("w4");
  ctrl.fire("J-092");
  const v = ctrl.view();
  assert.equal(v.range.clean, false);
  assert.equal(v.range.feedback, "Pick exactly 2 different jars: you picked 1.");
  assert.equal(v.range.tiles.filter((t) => t.state === "missed").length, 0, "any 2 of the 3 would do, so no jar is 'the one you missed'");
  assert.equal(tileState(v, "J-092"), "hit");
  // a targets wave still marks its missed targets
  ctrl.selectWave("w2");
  ctrl.fire("J-083");
  assert.equal(ctrl.view().range.tiles.filter((t) => t.state === "missed").length, 2);
  // with no server line the fixed sentence is the fallback
  const b = setupRange(storage, (reply) => { reply.feedback = ""; });
  b.ctrl.selectWave("w2"); b.ctrl.fire("J-083");
  assert.match(b.ctrl.view().range.feedback, /^Not yet\. Hit every target jar/);
});

test("test-out: the end screen lists only graded challenges as skipped; a play box is not listed", () => {
  const { ctrl } = setup();
  ctrl.start(); ctrl.testOut(); runOk(ctrl); ctrl.next();
  ctrl.quiz(0); ctrl.startRound(); ctrl.testOut(); runOk(ctrl); ctrl.next();
  const sk = ctrl.view().end.skipped;
  assert.equal(sk.length, 2, "one line per round");
  assert.equal(sk.reduce((n, x) => n + x.ns.length, 0), 5);
  assert.ok(sk.every((x) => !/anything/i.test(x.label)));
});

// ---- Round 6b: the calm screen on the six real lessons ------------------------------------------------
// At most four underlined words on any screen (the explain, prompt, predict question, both hints and any one feedback line
// together), none on a warm-up quiz, each word underlined once in the whole lesson, and a Look closer only on the screen of
// the `see` that carries it. The page-level counts (buttons, no scroll) are tools/lesson-noscroll.cjs.
function realCtrl(file) {
  const L = JSON.parse(fs.readFileSync(path.join(root, "lessons", file), "utf8"));
  const pub = served(L);
  let ctrl;
  ctrl = lesson.createController({ lessonId: L.id, storage: memoryStorage(), send: (m) => { if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: pub }); } });
  ctrl.open(); ctrl.start();
  return { ctrl, L };
}
const realLessons = () => fs.readdirSync(path.join(root, "lessons")).filter((f) => /^lesson\d+\.json$/.test(f));

test("calm screen, real lessons: at most 4 underlines on a screen, none on a warm-up quiz, and each word once in the lesson", () => {
  realLessons().forEach((f) => {
    const { ctrl } = realCtrl(f);
    const st = ctrl.state, met = {};
    st.flat.forEach((fl, i) => {
      const ch = fl.challenge;
      const at = (k) => `${f} ${ch.id} ${k}`;
      const shown = (ctrl2) => { const c = ctrl2.view().ch; return c; };
      st.index = i; st.screen = "challenge"; st.hints = 2; st.notice = ""; st.result = null; st.quiz = null; st.warmDone = false;
      st.progress.fails[ch.id] = 2;
      const base = shown(ctrl);
      if (base.warmGate) assert.ok(!base.remember.promptParts, at("warm-up quiz carries no underlines"));
      st.warmDone = true;
      const c = shown(ctrl);
      const always = termsOf(c.explainParts).concat(termsOf(c.promptParts), c.predict ? termsOf(c.predict.questionParts) : []);
      const hints = (c.hints || []).reduce((a, h) => a.concat(termsOf(h.parts)), []);
      const lines = [];
      const fb = ch.feedback || {};
      ["pass", "wrong", "forbids"].forEach((k) => { if (typeof fb[k] === "string") lines.push(fb[k]); });
      (fb.errors || []).forEach((e) => { if (e && typeof e.say === "string") lines.push(e.say); });
      const perLine = lines.map((t) => { st.notice = t; return termsOf(shown(ctrl).feedbackParts); });
      const most = Math.max(0, ...perLine.map((x) => x.length));
      assert.ok(always.length + hints.length + most <= 4, at(`${always.length + hints.length + most} underlines: ${always.concat(hints).join(", ")}`));
      always.concat(hints, ...perLine).forEach((t) => {
        const k = t.toLowerCase();
        assert.ok(!met[k] || met[k] === ch.id, at(`'${t}' is underlined again (first on ${met[k]})`));
        met[k] = ch.id;
      });
    });
  });
});

test("calm screen, real lessons: Look closer shows only on the screen of the see that carries it, never on a round's first screen", () => {
  realLessons().forEach((f) => {
    const { ctrl, L } = realCtrl(f);
    const st = ctrl.state;
    st.flat.forEach((fl, i) => {
      st.index = i; st.screen = "challenge"; st.warmDone = true; st.notice = "";
      const has = !!ctrl.view().ch.look;
      const carries = fl.challenge.kind === "see" && !!fl.challenge.look_closer;
      const first = fl.ci === 0 && !(L.number === 1 && fl.ri === 0);
      assert.equal(has, carries && !first, `${f} ${fl.challenge.id}: look ${has}, carries ${carries}, round's first screen ${first}`);
    });
  });
});

// ---- Round 7: the novice and educator screen fixes ----------------------------------------------------
test("guess line, round 7: a wrong guess is plain ('You guessed X; Julia showed Y'), never 'Not quite', and a failed run has none", () => {
  const { ctrl } = setup();
  ctrl.start();
  ctrl.predict(ctrl.view().ch.predict.choices.indexOf("9"));
  runOk(ctrl);
  const v = ctrl.view();
  assert.equal(v.ch.result.pass, true, "the run passed");
  assert.equal(v.ch.guessLine, "Good try. You picked: 9. The answer is: 5.");
  assert.ok(!/not quite/i.test(v.ch.guessLine));
  // a run that gave an error showed nothing, so there is nothing to compare the guess with
  const e = setup();
  e.ctrl.start();
  e.ctrl.predict(0);
  e.ctrl.run("bad(1)");
  assert.equal(e.ctrl.view().ch.guessLine, "");
  // a pick is never "Not quite" (fix round 2 keeps that word for the warm-up's recall question only, P13)
  assert.ok(!/not quite/i.test(guessLineSrc()), "the guess line code never says it");
  realLessons().forEach((f) => assert.ok(!/not quite/i.test(fs.readFileSync(path.join(root, "lessons", f), "utf8")), f));
  // the line is plain ink in the stylesheet, not the green of a pass or the red of a fault
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  assert.match(css, /#guess-line\s*\{[^}]*color:\s*var\(--ink\)/);
});

test("guess line, round 7, page: it never takes the green success class that the feedback line takes", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  const wrong = $("predict").children.find((n) => n.tag === "div").children.find((b) => b.textContent === "9");
  wrong.click();
  $("code").value = answers["d-r1-c1"]; $("run").click();
  assert.equal($("guess-line").textContent, "Good try. You picked: 9. The answer is: 5.");
  // round 10: after a wrong guess the line saying what the code did is plain ink, so green never reads as "you were right"
  assert.equal($("feedback").className, "", "the run passed, but the guess was wrong");
  assert.notEqual($("guess-line").className, "ok");
  // a right guess, and no guess at all, keep the green pass line
  const right = fakePage(memoryStorage(), dummyFull);
  lesson.init(right.doc); await tick();
  right.byId.start.click();
  right.byId.predict.children.find((n) => n.tag === "div").children.find((b) => b.textContent === "5").click();
  right.byId.code.value = answers["d-r1-c1"]; right.byId.run.click();
  assert.equal(right.byId.feedback.className, "ok");
  assert.equal(right.byId["guess-line"].textContent, "Yes. You picked: 5. Julia showed 5.");
});

test("dictionary, round 9: closed on every screen; the player can open it and it stays as they left it", async () => {
  const { ctrl } = setup();
  ctrl.start();
  const closed = [];
  ctrl.state.flat.forEach((f, i) => { ctrl.state.index = i; ctrl.state.warmDone = true; closed.push([f.challenge.id, f.challenge.kind, ctrl.view().ch.dictClosed]); });
  closed.forEach(([id, kind, c]) => {
    assert.equal(c, true, id + " (" + kind + ")");
  });
  // on the page: closed on the first screen, open on the second, closed on the checkpoint, opened by the player
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal($("dict").open, false, "first screen of round 1");
  assert.equal($("dict").hidden, false, "it is there to open");
  $("dict").open = true;                                   // the player opens it
  guessFirst($); $("run").click(); $("next").click();      // c1 -> c2 (a change)
  assert.equal($("dict").open, true, "the player's own choice stays");
  $("code").value = answers["d-r1-c2"]; $("run").click(); $("next").click();
  assert.equal($("line-count").textContent, "Task 3 of 3", "the checkpoint");
  $("dict").open = true;                                   // opened on purpose, it stays open while the checkpoint is on screen
  $("code").value = "nothing_here"; $("run").click();
  assert.equal($("dict").open, true, "a run does not close it");
});

test("dictionary, round 7: a row with from_challenge waits for that screen; a row without it shows from its round", () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.dictionary = [{ julia: "a(x)", means: "first", r: "a", from_round: "d-r1", idea: "function" },
    { julia: "b(x)", means: "later", r: "b", from_round: "d-r1", from_challenge: "d-r1-c2", idea: "function" },
    { julia: "c(x)", means: "next round", r: "c", from_round: "d-r2", from_challenge: "d-r2-c1", idea: "indexing" }];
  const ctrl = ctrlFor((d) => { d.dictionary = def.dictionary; });
  ctrl.start();
  const rows = () => ctrl.view().ch.dictionary.map((r) => r.julia);
  assert.deepEqual(rows(), ["a(x)"], "c1: only the row with no from_challenge");
  runOk(ctrl); ctrl.next();
  assert.deepEqual(rows(), ["a(x)", "b(x)"], "c2: b arrives on its own screen");
  runOk(ctrl); ctrl.next(); runOk(ctrl); ctrl.next();
  ctrl.quiz(0); ctrl.startRound();
  assert.deepEqual(rows(), ["a(x)", "b(x)", "c(x)"], "round 2, first screen: c is its own from_challenge");
});

test("pinned line, round 9: on a later screen it is captioned 'Worked example' and drops the R note; on the see itself no caption; on a checkpoint none", async () => {
  const { ctrl } = setup();
  ctrl.start();
  const seen = {};
  ctrl.state.flat.forEach((f, i) => {
    ctrl.state.index = i; ctrl.state.warmDone = true;
    const p = ctrl.view().ch.pinned;
    seen[f.challenge.kind] = p;
    if (f.challenge.kind === "checkpoint") assert.equal(p, null, "a checkpoint shows no pinned line");
    else if (f.challenge.kind === "play") assert.equal(p, null, "a try-anything box shows no older example beside its own starter line");
    else if (f.challenge.kind === "see") assert.equal(p.label, "", f.challenge.id + " is its own example: no caption");
    else if (p === null) assert.equal(f.challenge.kind, "change", "0.5: hidden only where the editor starts with the very same line (" + f.challenge.id + ")");
    else { assert.match(p.label, /^Worked example/, f.challenge.id); assert.equal(p.notes.r, null, "no R note after its own see"); assert.ok(p.code); }
  });
  assert.ok(seen.fix && "checkpoint" in seen);
  // on the page
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal($("pinned-cap").hidden, true);
  let guard = 0;
  while (page.byId["line-count"].textContent.indexOf("Task 3 of 4") < 0 || page.byId["strip-text"].textContent.indexOf("Round 2") < 0) {
    const q = $("remember").all().find((n) => n.tag === "button" && n.attrs["aria-label"] === "Start the round");
    if (q) { $("remember").all().find((n) => n.className === "choice").click(); $("remember").all().find((n) => n.attrs["aria-label"] === "Start the round").click(); }
    const id = page.byId["screen-lesson"].getAttribute("data-cid");
    if (answers[id]) { $("code").value = answers[id]; $("run").click(); }
    $("next").click();
    if (++guard > 20) throw new Error("did not reach the fix");
  }
  assert.equal($("pinned").hidden, false);
  assert.equal($("pinned-cap").hidden, false);
  assert.match($("pinned-cap").textContent, /^Worked example/);
});

test("pinned line, round 9, real lessons: every later screen is captioned, no checkpoint pins a line", () => {
  let fixes = 0, checks = 0;
  realLessons().forEach((f) => {
    const { ctrl } = realCtrl(f);
    const st = ctrl.state;
    st.flat.forEach((fl, i) => {
      st.index = i; st.screen = "challenge"; st.warmDone = true; st.notice = "";
      const p = ctrl.view().ch.pinned;
      if (fl.challenge.kind === "fix") { fixes += 1; if (p) assert.match(p.label, /^Worked example/, `${f} ${fl.challenge.id}`); }
      if (fl.challenge.kind === "checkpoint") { checks += 1; assert.equal(p, null, `${f} ${fl.challenge.id}`); }
    });
  });
  assert.ok(fixes >= 6 && checks >= 12);
});

// ---- fix round 2 (P09): two independent switches, "Show R" and "Show Python", both on by default ----------------
const withBothNotes = (d) => {
  const c = d.rounds[1].challenges[0]; c.r_note = "bag[[2]]"; c.py_note = "In Python a list starts at 0, so bag[1].";
  d.dictionary.forEach((r, i) => { r.py = ["len(x)", "x[i - 1]"][i]; });
};
const onBoth = (show) => { const st = memoryStorage(); if (show) st.setItem("julia-time:notes-show:v2", JSON.stringify(show)); return st; };

test("P09: all four switch combinations: the notes, and the In R and In Python columns, follow Show R and Show Python", async () => {
  const combos = [[true, true], [true, false], [false, true], [false, false]];
  for (const [r, py] of combos) {
    const ctrl = ctrlFor(withBothNotes, onBoth({ r, py }));
    ctrl.start(); jumpTo(ctrl, "d-r2-c1");
    const v = ctrl.view();
    assert.deepEqual(v.show, { r, py }, "the view says which switches are on");
    assert.deepEqual([v.usesR, v.usesPy], [r, py]);
    assert.equal(!!v.ch.pinned.notes.r, r, "R note follows Show R (" + r + "," + py + ")");
    assert.equal(!!v.ch.pinned.notes.py, py, "Python note follows Show Python (" + r + "," + py + ")");
    // on the page: the boxes, and the columns of the pocket dictionary, the cheat sheet and the print table
    const page = fakePage(onBoth({ r, py }), (() => { const d = JSON.parse(JSON.stringify(dummyFull)); withBothNotes(d); return d; })());
    lesson.init(page.doc); await tick();
    const $ = (id) => page.byId[id];
    assert.equal($("switches").hidden, false, "the switches sit in the bar on a lesson");
    assert.deepEqual([$("show-r").checked, $("show-py").checked], [r, py]);
    $("start").click();
    ["dict", "dict-earlier", "sheet-table", "end-dict"].forEach((id) => {
      assert.equal($(id).getAttribute("data-r"), r ? "1" : "0", id + " In R column");
      assert.equal($(id).getAttribute("data-py"), py ? "1" : "0", id + " In Python column");
    });
  }
  // every dictionary row draws four cells: Julia, what it does, In R, In Python
  const page = fakePage(memoryStorage(), (() => { const d = JSON.parse(JSON.stringify(dummyFull)); withBothNotes(d); return d; })());
  lesson.init(page.doc); await tick();
  page.byId.start.click();
  const row = page.byId["dict-body"].children[0];
  assert.deepEqual(row.children.map((c) => c.textContent), ["count_marbles(x)", "counts the marbles in x", "length(x)", "len(x)"]);
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  assert.match(css, /\[data-r="0"\] th:nth-child\(3\)[^{]*\[data-py="0"\] th:nth-child\(4\)[^{]*\{\s*display:\s*none/);
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.equal((html.match(/<th scope="col">In Python<\/th>/g) || []).length, 3, "pocket dictionary, cheat sheet and print table");
  assert.doesNotMatch(html, /Do you know R|Notes:/, "no language question and no Notes: label anywhere");
  assert.match(html, /<input id="show-r" type="checkbox" checked> Show R<\/label>/);
  assert.match(html, /<input id="show-py" type="checkbox" checked> Show Python<\/label>/);
});

test("P09: each switch flips on its own, is saved for every lesson, and the page's box follows", async () => {
  const storage = memoryStorage();
  const a = setup(storage);
  assert.deepEqual(a.ctrl.view().show, { r: true, py: true }, "both on by default");
  a.ctrl.toggleShow("r");
  assert.deepEqual(a.ctrl.view().show, { r: false, py: true });
  assert.deepEqual(setup(storage).ctrl.view().show, { r: false, py: true }, "a new controller on the same storage remembers it");
  a.ctrl.toggleShow("py");
  assert.deepEqual(setup(storage).ctrl.view().show, { r: false, py: false });
  a.ctrl.toggleShow("klingon");
  assert.deepEqual(a.ctrl.view().show, { r: false, py: false }, "an unknown switch is ignored");
  assert.deepEqual(setup(storage).ctrl.view().skills || [], [], "the switches are not read as a lesson");
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("show-py").click();
  assert.deepEqual([$("show-r").checked, $("show-py").checked], [true, false]);
  $("show-r").click();
  assert.deepEqual([$("show-r").checked, $("show-py").checked], [false, false]);
  $("show-py").click();
  assert.deepEqual([$("show-r").checked, $("show-py").checked], [false, true]);
  assert.equal(page.win.localStorage.getItem("julia-time:notes-show:v2"), JSON.stringify({ r: false, py: true }));
});

test("P09: an old saved language answer never hides a language, and both old keys are deleted on first load", () => {
  ["yes", "no", "r", "python", "neither", "both"].forEach((old) => {
    const st = memoryStorage();
    st.setItem("julia-time:uses-r:v1", old);
    st.setItem("julia-time:notes-lang:v1", old);
    const ctrl = ctrlFor(withBothNotes, st);
    assert.deepEqual(ctrl.view().show, { r: true, py: true }, "old answer " + old + " shows both");
    assert.equal(st.getItem("julia-time:uses-r:v1"), null, "old key uses-r gone (" + old + ")");
    assert.equal(st.getItem("julia-time:notes-lang:v1"), null, "old key notes-lang gone (" + old + ")");
    ctrl.start(); jumpTo(ctrl, "d-r2-c1");
    const n = ctrl.view().ch.pinned.notes;
    assert.ok(n.r && n.py, "both notes show after old answer " + old);
  });
  // the list and a range page drop the old keys too
  const st = memoryStorage(); st.setItem("julia-time:notes-lang:v1", "r");
  setup(st, "");
  assert.equal(st.getItem("julia-time:notes-lang:v1"), null);
});

test("P09: a note is labelled once by the screen; a label stored in the note itself is dropped", () => {
  const ctrl = ctrlFor((d) => { const c = d.rounds[1].challenges[0]; c.r_note = "R: bag[[2]]"; c.py_note = "Python: bag[1]"; });
  ctrl.start(); jumpTo(ctrl, "d-r2-c1");
  const n = ctrl.view().ch.pinned.notes;
  assert.deepEqual(n.r, { text: "bag[[2]]", code: true });
  assert.deepEqual(n.py, { text: "bag[1]", code: true });
  const words = ctrlFor((d) => { d.rounds[1].challenges[0].py_note = "In Python a list starts at 0, so bag[1]."; });
  words.start(); jumpTo(words, "d-r2-c1");
  assert.deepEqual(words.view().ch.pinned.notes.py, { text: "In Python a list starts at 0, so bag[1].", code: false }, "a sentence that names the language is kept");
});

// ---- round 9 (29 Sep, from the round 8 play test) ---------------------------------------------------------
function ctrl9(def, storage, reply) {
  const sent = [];
  let ctrl;
  ctrl = lesson.createController({
    lessonId: def.id, storage: storage || memoryStorage(), retry: (f) => { sent.retry = f; },
    send: (msg) => {
      sent.push(msg);
      if (msg.type === "lesson_info") ctrl.handle(sent.infoError ? { type: "error", message: sent.infoError } : { type: "lesson", request_id: msg.request_id, lesson: served(def) });
      else if (msg.type === "lesson_list") ctrl.handle({ type: "lessons", lessons: [{ id: "dummy", number: 7, title: "Sort the marbles" }, { id: "next-one", number: 8, title: "Next" }] });
      else if (msg.type === "lesson_run") {
        const pass = msg.code.trim() === answers[msg.challenge];
        const r = { type: "lesson_result", request_id: msg.request_id, challenge: msg.challenge, status: "ok", value_repr: pass ? "5" : "0", value_table: null, stdout: "", pass, feedback: pass ? "Good." : "Not yet." };
        if (reply) reply(r, msg);
        ctrl.handle(r);
      }
    },
  });
  return { ctrl, sent };
}

test("round 9, no answer before the guess: a result label and a dictionary row of the same challenge wait for the first Run", () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.rounds[0].challenges[0].labels.push({ part: "5", is: "result" });
  def.dictionary = def.dictionary.concat([{ julia: "count_marbles(bag)", means: "gives 5", r: "", from_round: "d-r1", from_challenge: "d-r1-c1" }]);
  const { ctrl } = ctrl9(def);
  ctrl.open(); ctrl.start();
  const has = (v) => v.ch.pinned.labels.some((l) => l.is === "result");
  assert.equal(has(ctrl.view()), false, "no result label before the guess");
  assert.equal(ctrl.view().ch.dictionary.some((r) => r.means === "gives 5"), false, "no dictionary row from this challenge");
  ctrl.predict(0);
  assert.equal(has(ctrl.view()), false, "a guess alone does not show it");
  ctrl.run("count_marbles(bag)");
  assert.equal(has(ctrl.view()), true, "after the first Run it shows");
  assert.equal(ctrl.view().ch.dictionary.some((r) => r.means === "gives 5"), true);
});

test("round 10, Run never waits for a guess: it runs, and the guess line says 'No guess this time' without scolding", () => {
  const { ctrl, sent } = ctrl9(dummyFull);
  ctrl.open(); ctrl.start();
  ctrl.run("count_marbles(bag)");
  assert.equal(sent.filter((m) => m.type === "lesson_run").length, 1, "Run just works");
  const v = ctrl.view().ch;
  assert.equal(v.guessLine, "", "round 5: nothing picked, so no leftover line");
  assert.doesNotMatch(v.feedback, /pick an answer|first|must/i, "no scolding");
  assert.equal(v.guessWrong, false);
  assert.equal(v.nextEnabled, true, "the step is done as usual");
  // no guess is never green-suppressed: the pass line stays the pass line
  assert.equal(v.result.pass, true);
  assert.ok(!/Pick an answer first/.test(fs.readFileSync(path.join(root, "web/lesson.js"), "utf8")), "the blocking line is gone from the screen code");
});

test("round 9, a wrong guess names the answer in plain words and a right one says so", () => {
  const { ctrl } = ctrl9(dummyFull);
  ctrl.open(); ctrl.start();
  const shown = ctrl.view().ch.predict.choices;
  ctrl.predict(shown.indexOf("9")); ctrl.run("count_marbles(bag)");
  assert.equal(ctrl.view().ch.guessLine, "Good try. You picked: 9. The answer is: 5.");
  assert.doesNotMatch(ctrl.view().ch.guessLine, /wrong|Not quite/i);
});

test("round 9, 'That works too' shows under the pass line, from works_too or from the end of the feedback", () => {
  const a = ctrl9(dummyFull, null, (r) => { if (r.pass) r.works_too = "That works too. The way this lesson teaches: count_marbles(bag)."; });
  a.ctrl.open(); a.ctrl.start(); a.ctrl.predict(0); a.ctrl.run("count_marbles(bag)");
  assert.equal(a.ctrl.view().ch.feedback, "Good.");
  assert.equal(a.ctrl.view().ch.worksToo, "That works too. The way this lesson teaches: count_marbles(bag).");
  const b = ctrl9(dummyFull, null, (r) => { if (r.pass) r.feedback = "Good. That works too. The way this lesson teaches: the marbles line."; });
  b.ctrl.open(); b.ctrl.start(); b.ctrl.predict(0); b.ctrl.run("count_marbles(bag)");
  assert.equal(b.ctrl.view().ch.feedback, "Good.", "the pass line stays whole");
  assert.equal(b.ctrl.view().ch.worksToo, "That works too. The way this lesson teaches: the marbles line.");
  const c = ctrl9(dummyFull);
  c.ctrl.open(); c.ctrl.start(); c.ctrl.predict(0); c.ctrl.run("count_marbles(bag)");
  assert.equal(c.ctrl.view().ch.worksToo, "", "no note when the line is the taught one");
  const d = ctrl9(dummyFull, null, (r) => { r.works_too = "That works too. x"; });
  d.ctrl.open(); d.ctrl.start(); d.ctrl.predict(0); d.ctrl.run("nothing_here");
  assert.equal(d.ctrl.view().ch.worksToo, "", "never on a failed run");
});

test("round 9, the pinned card: no caption on its own see, 'Worked example' after, a different table says so", () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  const { ctrl } = ctrl9(def);
  ctrl.open(); ctrl.start();
  assert.equal(ctrl.view().ch.pinned.label, "");
  ctrl.predict(0); ctrl.run("count_marbles(bag)"); ctrl.next();
  assert.equal(ctrl.view().ch.pinned, null, "0.5: the change starts from the very same line, so the example is hidden");
  const same = JSON.parse(JSON.stringify(dummyFull));
  same.rounds[0].challenges.forEach((c) => { delete c.data; });
  const b = ctrl9(same);
  b.ctrl.open(); b.ctrl.start(); b.ctrl.predict(0); b.ctrl.run("count_marbles(bag)"); b.ctrl.next();
  // the fixture's change starts from the very same line, so the example is hidden (0.5 fixes)
  assert.equal(b.ctrl.view().ch.pinned, null);
  same.rounds[0].challenges[1].starter = "count_marbles(red_bag)";
  const b2 = ctrl9(same);
  b2.ctrl.open(); b2.ctrl.start(); b2.ctrl.predict(0); b2.ctrl.run("count_marbles(bag)"); b2.ctrl.next();
  assert.equal(b2.ctrl.view().ch.pinned.label, "Worked example (task 1)");
  const c2 = JSON.parse(JSON.stringify(same));
  c2.rounds[0].challenges[0].data = "one_table";
  c2.rounds[0].challenges[1].data = "other_table";
  const c = ctrl9(c2);
  c.ctrl.open(); c.ctrl.start(); c.ctrl.predict(0); c.ctrl.run("count_marbles(bag)"); c.ctrl.next();
  assert.equal(c.ctrl.view().ch.pinned.label, "Worked example, a different table (task 1)");
  // P12: only when that is true: a worked line that names no table is not called a different one
  const d2 = JSON.parse(JSON.stringify(same));
  d2.rounds[0].challenges[1].data = "other_table";
  const d = ctrl9(d2);
  d.ctrl.open(); d.ctrl.start(); d.ctrl.predict(0); d.ctrl.run("count_marbles(bag)"); d.ctrl.next();
  assert.equal(d.ctrl.view().ch.pinned.label, "Worked example (task 1)");
});

test("round 9, the first lesson message may meet a server that has not read the lessons: one quiet retry, then the error", () => {
  const { ctrl, sent } = ctrl9(dummyFull);
  sent.infoError = 'Unknown lesson: "dummy"';
  ctrl.open();
  assert.equal(ctrl.view().screen, "loading", "no error yet");
  assert.equal(typeof sent.retry, "function");
  sent.infoError = null;
  sent.retry();
  assert.equal(ctrl.view().screen, "start", "the second try worked");
  const b = ctrl9(dummyFull);
  b.sent.infoError = 'Unknown lesson: "dummy"';
  b.ctrl.open(); b.sent.retry();
  assert.equal(b.ctrl.view().screen, "error", "a second failure shows the error");
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.match(html, /<a id="board-link" class="navlink" href="course\/index\.html">Board<\/a>/, "a way back to the Board on every screen");
  assert.match(html, /<a id="brand" href="course\/index\.html">Julia Time<\/a>/, "the title links to the Board too");
});

test("round 9, the end screen: a Lesson N done title, a link to the next lesson, one case line, one Copy all (0.5)", async () => {
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); finishAll(a.ctrl);
  assert.ok(a.sent.some((m) => m.type === "lesson_list"), "the end screen asks for the list once");
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("end-title").textContent, "Lesson 7 done");
  const link = $("end-next").all().find((n) => n.tag === "a");
  assert.equal(link, undefined, "the fake list holds no lesson 8, so no link");
  assert.equal($("end-lines").all().filter((n) => n.tag === "button").length, 0, "no Copy button per line");
  assert.equal($("copy-all").hidden, false);
  assert.equal($("copy-all")._lines.split("\n").length, 5, "Copy all takes every line");
  let copied = null;
  page.win.navigator.clipboard = { writeText: (t) => { copied = t; } };
  $("copy-all").click();
  assert.equal(copied, $("copy-all")._lines);
  assert.equal($("copy-all").textContent, "Copied");
  assert.equal($("end-more-sum").textContent, "Your lines and notes (5 saved lines)");
  // P04: one forward route. Even with a next lesson in the list, the end page has no "Next lesson" link that skips the chapter.
  const b = ctrl9(dummyFull);
  b.ctrl.open(); b.ctrl.start();
  while (b.ctrl.view().screen === "challenge") { const ch = b.ctrl.view().ch; if (ch.predict && ch.predict.guess === null) b.ctrl.predict(0); if (ch.kind !== "play") b.ctrl.run(answers[ch.id]); b.ctrl.next(); }
  assert.equal(b.ctrl.view().screen, "end");
  assert.equal(b.ctrl.view().end.nextLesson, undefined);
});

test("round 9, the warm-up says the last round is done, and shows its code on its own lines", async () => {
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start();
  for (let i = 0; i < 3; i++) { runOk(a.ctrl); a.ctrl.next(); }
  assert.equal(a.ctrl.view().ch.remember.roundLine, "Round 1 done: Count things");
  assert.equal(a.ctrl.view().ch.remember.nextLine, "Next: Round 2 of 2, Pick a few.");
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc); await tick(); resume(page);
  const pre = page.byId.remember.all().find((n) => n.tag === "pre");
  assert.ok(pre && pre.className === "warm-code", "the warm-up code is a block, not run into the question");
});

test("round 9, a play box says 'only the last line' only when there is more than one line", () => {
  const { ctrl } = setup();
  ctrl.start(); ctrlToPlay(ctrl);
  ctrl.run("1 + 1");
  assert.equal(ctrl.view().ch.playNote, "");
  ctrl.run("x = 1\n# note\nx + 1");
  assert.equal(ctrl.view().ch.playNote, "Only the last line's value is shown.");
});

test("fix round 2 (D6): a clue reads 'Worth remembering:', with no counter and nothing 'saved for the end'", () => {
  const { ctrl } = setup(); ctrl.start();
  runOk(ctrl); ctrl.next(); runOk(ctrl); ctrl.next(); runOk(ctrl);
  assert.match(ctrl.view().ch.clue, /^Worth remembering: /);
  assert.equal(ctrl.view().strip.clues, undefined);
  assert.doesNotMatch(fs.readFileSync(path.join(root, "web/lesson.js"), "utf8"), /saved for the end|"Clues: "/);
});

// ---- round 9, target range ----------------------------------------------------------------------------
const waveById = (v, id) => v.range.waves.find((w) => w.id === id);

test("round 9, range: with rings 'after' the rack shows no ring before the first shot, and the rings come with it", () => {
  const { ctrl } = setupRange(passedLessons(["lesson1", "lesson4", "lesson6"]));
  ctrl.selectWave("w3");
  let v = ctrl.view();
  assert.equal(v.range.wave.rings, "after");
  assert.equal(v.range.tiles.filter((t) => t.state === "target").length, 0, "aim from the words");
  assert.match(v.range.preShot, /rings show after your first run/);
  assert.doesNotMatch(v.range.wave.target, /ring/i);
  ctrl.fire("J-081");
  v = ctrl.view();
  assert.equal(tileState(v, "J-081"), "hit");
  assert.equal(tileState(v, "J-082"), "missed", "the target left over is ringed now");
  ctrl.selectWave("w1");
  ctrl.selectWave("w3");
  assert.equal(ctrl.view().range.tiles.filter((t) => t.state === "target").length, 2, "rings stay once shown");
  ctrl.selectWave("w1");
  assert.equal(ctrl.view().range.tiles.filter((t) => t.state === "target").length, 1, "a 'before' wave shows its ring at once");
  assert.equal(ctrl.view().range.preShot, "Ring: a jar to hit.", "the fixture names no table, so no table sentence");
});

test("round 9, range: the result says right jars and extra jars, never 'misses'", () => {
  const { ctrl } = setupRange(passedLessons(["lesson1"]));
  ctrl.selectWave("w2");
  ctrl.fire("J-083 J-091");
  const v = ctrl.view();
  assert.equal(v.range.summary, "Right jars: 1 of 3. Extra jars: 1.");
  assert.doesNotMatch(v.range.summary, /misses/);
  ctrl.fire("J-083 J-084 J-085");
  assert.equal(ctrl.view().range.summary, "Right jars: 3 of 3. Extra jars: 0.");
});

test("0.5, range: no points and no stars (Shinichi's decision, 30 Sep); a level is done when a run is clean", () => {
  const src = screenSrc();
  assert.doesNotMatch(src, /sharpshooter|\bpar\b|characters/i, "no par, no character count, no sharpshooter on the screen");
  const clean = (reply, msg) => { reply.picked_ids = { w1: ["J-091"], w3: ["J-081", "J-082"] }[msg.challenge] || reply.picked_ids; };
  const a = setupRange(passedLessons(["lesson2"]), clean);
  a.ctrl.selectWave("w3");
  a.ctrl.fire("this line is long, and still it counts .......");
  const v = a.ctrl.view();
  assert.equal(v.range.clean, true);
  assert.equal(waveById(v, "w3").done, true);
  assert.equal(v.range.feedback, "Every target hit, and nothing else. Level done.");
  assert.doesNotMatch(v.range.summary + v.range.feedback + v.range.rule, /score|star|\u2605/i);
  assert.equal(v.range.stars, undefined, "the view carries no stars");
  assert.equal(waveById(v, "w3").sharp, undefined);
  // a done level stays done after a worse run
  a.ctrl.fire("J-091 J-092");
  assert.equal(waveById(a.ctrl.view(), "w3").done, true);
});
test("round 9, range: after a clean wave a Next wave button appears; after the last open wave it is Finish and shows the end screen", () => {
  const { ctrl } = setupRange(passedLessons(["lesson2"]), (reply, msg) => { reply.picked_ids = { w1: ["J-091"], w2: ["J-083", "J-084", "J-085"], w3: ["J-081", "J-082"] }[msg.challenge]; });
  assert.equal(ctrl.view().range.next, null, "no button before a clean shot");
  ctrl.fire("J-091");
  assert.deepEqual(ctrl.view().range.next, { label: "Next level", last: false });
  ctrl.nextWave();
  assert.equal(ctrl.view().range.wave.id, "w2");
  assert.equal(ctrl.view().range.next, null, "the new level starts clean");
  ctrl.fire("J-083 J-084 J-085");
  ctrl.nextWave();
  assert.equal(ctrl.view().range.wave.id, "w3");
  ctrl.fire("jars[1:2, :]");
  assert.deepEqual(ctrl.view().range.next, { label: "Finish", last: true });
  assert.equal(ctrl.view().range.end, null);
  ctrl.nextWave();
  const end = ctrl.view().range.end;
  assert.ok(end, "the end screen");
  assert.equal(end.cleared, 3);
  assert.equal(end.locked, 2, "two levels still wait for later lessons");
  assert.equal(end.stars, undefined, "no stars");
  assert.equal(end.all, false, "two levels are still locked");
  assert.equal(end.waves.find((w) => w.label === "Level 3").line, "jars[1:2, :]", "the line that cleared it");
  assert.equal(end.waves.find((w) => w.label === "Level 1").line, "J-091");
  ctrl.leaveRangeEnd();
  assert.equal(ctrl.view().range.end, null);
  assert.equal(ctrl.view().range.wave.id, "w1");
});

test("round 10, range: the line kept for a wave is the one that earned the star, not the shortest", () => {
  const { ctrl } = setupRange(passedLessons(["lesson1"]), (reply) => { reply.picked_ids = ["J-091"]; });
  ctrl.fire("jars.jar_id[7] # long"); ctrl.fire("J-091 "); ctrl.fire("jars.jar_id[7] # longer again");
  assert.equal(ctrl.state.range.progress.lines.w1, "jars.jar_id[7] # long");
});

test("round 10, range: the rule stays on screen after the first run, so the layout never jumps", () => {
  const { ctrl } = setupRange(passedLessons(["lesson1"]));
  const rule = "Hit every ringed jar and nothing else.";
  assert.equal(ctrl.view().range.rule, rule);
  ctrl.fire("J-091");
  assert.equal(ctrl.view().range.rule, rule);
  ctrl.selectWave("w2");
  assert.equal(ctrl.view().range.rule, rule);
});
test("round 10, range: replaying a finished wave shows Next wave when one is open; Finish only after the last open wave", () => {
  const st = passedLessons(["lesson2"]);
  const reply = (r, m) => { r.picked_ids = { w1: ["J-091"], w2: ["J-083", "J-084", "J-085"], w3: ["J-081", "J-082"] }[m.challenge]; };
  const first = setupRange(st, reply);
  first.ctrl.fire("J-091"); first.ctrl.nextWave(); first.ctrl.fire("J-083 J-084 J-085"); first.ctrl.nextWave(); first.ctrl.fire("J-081 J-082");
  const { ctrl } = setupRange(st, reply);      // all three open waves have stars now
  ctrl.selectWave("w1");
  ctrl.fire("J-091");
  assert.deepEqual(ctrl.view().range.next, { label: "Next level", last: false }, "replaying level 1 leads on to level 2");
  ctrl.nextWave();
  assert.equal(ctrl.view().range.wave.id, "w2");
  ctrl.selectWave("w3");
  ctrl.fire("J-081 J-082");
  assert.deepEqual(ctrl.view().range.next, { label: "Finish", last: true }, "level 3 is the last open level");
});

test("round 10, range end: 'Every wave' when none is locked, 'Every open wave' while some wait", () => {
  const src = screenSrc();
  assert.match(src, /E\.all \? "Every level is done\. " : "Every open level is done\. "/);
  const all = setupRange(passedLessons(["lesson6"]), (r, m) => { r.picked_ids = { w1: ["J-091"], w2: ["J-083", "J-084", "J-085"], w3: ["J-081", "J-082"], w4: ["J-091", "J-092"], w5: ["J-096"] }[m.challenge]; });
  ["J-091", "J-083 J-084 J-085", "J-081 J-082", "J-091 J-092", "J-096"].forEach((c) => { all.ctrl.fire(c); all.ctrl.nextWave(); });
  const end = all.ctrl.view().range.end;
  assert.ok(end);
  assert.equal(end.all, true);
  assert.equal(end.locked, 0);
});

test("round 9, range: passing a later lesson also opens the earlier lesson's waves", () => {
  const { ctrl } = setupRange(passedLessons(["lesson4"]));
  const locked = ctrl.view().range.waves.map((w) => w.locked);
  assert.deepEqual(locked, [false, false, false, false, true], "lessons 1 to 4 are open; lesson 6 is not");
});

test("round 9, range on the page: Next wave is the one filled button after a clean wave, the rule line and the end screen draw", async () => {
  const storage = passedLessons(["lesson2"]);
  const page = fakePage(storage, rangeFull, "?lesson=range");
  page.hooks.run = (out, m) => { out.picked_ids = { w1: ["J-091"], w2: ["J-083", "J-084", "J-085"], w3: ["J-081", "J-082"] }[m.challenge]; };
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("then-line").textContent, "Hit every ringed jar and nothing else.");
  assert.equal($("next").hidden, true);
  $("code").value = "J-091"; $("run").click();
  assert.equal($("then-line").hidden, false, "the rule stays, so nothing jumps");
  assert.match($("then-line").textContent, /nothing else/);
  assert.equal($("next").hidden, false);
  assert.equal($("next").textContent, "Next level");
  assert.equal($("next").className, "primary");
  assert.equal($("run").className, "quiet", "Run steps back");
  $("next").click();
  assert.match($("prompt").textContent, /^Level 2:/);
  assert.equal($("next").hidden, true);
  $("code").value = "J-083 J-084 J-085"; $("run").click(); $("next").click();
  $("code").value = "jars[1:2, :]"; $("run").click();
  assert.equal($("next").textContent, "Finish");
  $("next").click();
  assert.equal($("screen-range-end").hidden, false);
  assert.equal($("screen-lesson").hidden, true);
  assert.equal($("range-end-say").textContent, "Every open level is done. Here is the line that cleared each one.");
  assert.equal($("range-end-lines").children.length, 3);
  assert.match($("range-end-more").textContent, /2 more levels open as you finish more lessons/);
  assert.equal($("range-end-home").attrs.href, "course/index.html");
  $("range-end-back").click();
  assert.equal($("screen-lesson").hidden, false);
});

// ======================================================================================================
// Round 10 (29 Sep): the screen findings from the round 10 play test.
// Run never waits for a guess, Run again, one calm fold, kinder start page, a short story, the range's
// first-shot star, and small wording and layout fixes.
// ======================================================================================================
const jumpTo = (ctrl, id) => { const st = ctrl.state; st.index = st.flat.findIndex((f) => f.challenge.id === id); st.screen = "challenge"; st.warmDone = true; st.result = null; st.guess = null; };

test("round 10, Run says 'Run again' once the step is done, and never looks switched off", async () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.equal(ctrl.view().ch.runLabel, "Run");
  runOk(ctrl);
  assert.equal(ctrl.view().ch.runLabel, "Run again");
  assert.equal(ctrl.view().ch.pending, false);
  jumpTo(ctrl, "d-r2-c5");
  assert.equal(ctrl.view().ch.runLabel, "Run", "a try-anything box keeps a plain Run: Next is open anyway");
  // on the page: the label changes, and the button is never disabled after a run
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal($("run").textContent, "Run");
  $("code").value = answers["d-r1-c1"]; $("run").click();
  assert.equal($("run").textContent, "Run again");
  assert.equal($("run").attrs["aria-label"], "Run the code again");
  assert.equal($("run").disabled, false);
  assert.equal($("run").className, "quiet", "Next is now the one filled button");
});

test("round 10, a try-anything box is 'try anything' on the strip, and challenge counts leave it out", () => {
  const { ctrl } = setup();
  ctrl.start();
  jumpTo(ctrl, "d-r2-c4");
  assert.equal(ctrl.view().strip.line, "Task 4 of 4", "the checkpoint is the last counted line");
  jumpTo(ctrl, "d-r2-c5");
  assert.equal(ctrl.view().strip.line, "Try anything");
  assert.equal(ctrl.view().strip.dots, undefined, "no dots: 'Task 4 of 4' says it");
});

test("round 10, Julia's own message is never blank, never a repeat of the friendly line, and never the jargon of a blank left in", () => {
  const ctrl = ctrlFor();
  ctrl.start();
  const shown = (extra, code) => { ctrl.state.pending = "rq"; ctrl.state.lastCode = code; ctrl.handle(Object.assign({ type: "lesson_result", request_id: "rq", status: "error", value_repr: "", pass: false, feedback: "Replace ___ with your answer, then run." }, extra)); return ctrl.view().ch.result.message; };
  assert.equal(shown({ message: "syntax: all-underscore identifier used as rvalue" }, "count(___)"), "", "a blank left in: the friendly line says it all");
  assert.equal(shown({ message: "  \n " }, "x"), "", "blank message");
  assert.equal(shown({ message: "Replace ___ with your answer, then run." }, "x"), "", "a repeat of the friendly line");
  assert.equal(shown({ message: "UndefVarError: `x` not defined in `Main`" }, "x"), "UndefVarError: `x` not defined in `Main`");
});

test("round 10, on a fix screen the fold's title carries the error's first line, so 'read the error' works closed; other screens do not", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  // walk to the fix through the real page
  $("start").click();
  let guard = 0;
  while (page.byId["screen-lesson"].getAttribute("data-cid") !== "d-r2-c3" && guard++ < 30) {
    const q = $("remember").all().find((n) => n.tag === "button" && n.attrs["aria-label"] === "Start the round");
    if (q) { $("remember").all().find((n) => n.className === "choice").click(); q.click(); }
    const id = page.byId["screen-lesson"].getAttribute("data-cid");
    if (answers[id]) { $("code").value = answers[id]; $("run").click(); }
    $("next").click();
  }
  assert.equal($("screen-lesson").getAttribute("data-cid"), "d-r2-c3");
  page.hooks.run = (out) => { out.status = "error"; out.value_repr = ""; out.feedback = ""; out.message = "ParseError:\n# Error @ none:1:9\nExpected `]`"; };
  $("code").value = "bag[2"; $("run").click();
  const summary = () => $("julia-msg").children[0].children.find((n) => n.tag === "summary");
  assert.equal(summary().textContent, "Julia's own message: # Error @ none:1:9", "the bare 'ParseError:' line is skipped");
  assert.equal($("julia-msg").children[0].attrs.open, undefined, "still closed");
  // the same error on a screen that is not a fix: just the name
  const c2 = ctrlFor(); c2.start();
  assert.equal(feed(c2, { status: "error", value_repr: "", message: "UndefVarError: x not defined" }).result.peek, "");
});

test("round 10, a hint at a checkpoint comes after the first run that missed; Show me the line still waits for two", () => {
  const { ctrl } = setup();
  ctrl.start();
  jumpTo(ctrl, "d-r1-c3");
  assert.equal(ctrl.view().ch.hintsAvailable, false, "nothing before a run");
  runBad(ctrl);
  assert.equal(ctrl.view().ch.hintsAvailable, true, "one miss is enough for the idea hint");
  assert.equal(ctrl.view().ch.showLine, false, "and a checkpoint never shows its line");
  jumpTo(ctrl, "d-r1-c2");
  runBad(ctrl);
  assert.equal(ctrl.view().ch.showLine, false, "Show me the line waits for two misses");
});

test("round 10, the story has a Hide toggle and reads as short paragraphs", async () => {
  const c = ctrlFor((d) => { d.story_more = "One is here. Two is here. Three is here. Four is here. Five is here."; });
  assert.deepEqual(c.view().lesson.storyParas, ["One is here. Two is here.", "Three is here. Four is here.", "Five is here."]);
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.story_more = "One is here. Two is here. Three is here.";
  const page = fakePage(memoryStorage(), def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("story-link").textContent, "Read the story");
  assert.equal($("story-more").hidden, true);
  $("story-link").click();
  assert.equal($("story-more").hidden, false);
  assert.equal($("story-link").textContent, "Hide the story");
  assert.equal($("story-link").attrs["aria-expanded"], "true");
  assert.equal($("story-more").children.length, 2, "two short paragraphs");
  $("story-link").click();
  assert.equal($("story-more").hidden, true);
  assert.equal($("story-link").textContent, "Read the story");
});

test("round 10, a quotation in the story is never split across two paragraphs", () => {
  const c = ctrlFor((d) => { d.story_more = 'Intro is here. He typed: "One is here. Two is here." Three is here. Four is here.'; });
  assert.deepEqual(c.view().lesson.storyParas, ['Intro is here. He typed: "One is here. Two is here." Three is here.', "Four is here."]);
});

test("fix round 2, a round's opening: a heading for the round that ended, then one line that looks ahead (P13)", async () => {
  const { ctrl } = setup();
  ctrl.start();
  for (let i = 0; i < 3; i++) { runOk(ctrl); ctrl.next(); }
  const r = ctrl.view().ch.remember;
  assert.equal(r.roundLine, "Round 1 done: Count things");
  assert.equal(r.nextLine, "Next: Round 2 of 2, Pick a few.");
  assert.ok(!r.roundLine.includes("\n"));
});

test("round 10, punctuation stuck to an underlined word stays with it, so a bracket or comma never starts a line", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.rounds[0].explain = "Use a (function), then run it.";
  const page = fakePage(memoryStorage(), def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal($("explain").textContent, "Use a (function), then run it.", "reading order is unchanged");
  const glue = $("explain").children.find((n) => n.tag === "span" && n.className === "nb");
  assert.ok(glue, "a no-break span holds the word and its punctuation");
  assert.deepEqual(glue.children.map((n) => n.textContent), ["(", "function", "),"]);
  assert.equal(glue.children[1].tag, "button");
  assert.match(fs.readFileSync(path.join(root, "web/lesson.css"), "utf8"), /\.nb\s*\{\s*white-space:\s*nowrap/);
});

test("round 10, a try-anything box shows the table of the step before it, and no older worked example", () => {
  const ctrl = ctrlFor((d) => { d.rounds[1].challenges[1].data = "marble_table"; d.rounds[1].challenges[4].data = undefined; });
  ctrl.start();
  jumpTo(ctrl, "d-r2-c5");
  const ch = ctrl.view().ch;
  assert.equal(ch.dataName, "marble_table");
  assert.ok(ch.data && ch.data.columns);
  assert.equal(ch.pinned, null);
  // a step that names its own table keeps it, and one with none anywhere stays without
  const bare = ctrlFor((d) => { d.rounds[1].challenges[1].data = undefined; });
  bare.start(); jumpTo(bare, "d-r2-c5");
  assert.equal(bare.view().ch.data, null);
});

test("round 10, a Look closer value that is a bare number is captioned, so it is not a mystery box", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull)); asLesson1(def);
  const page = fakePage(memoryStorage(), def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  $("look-link").click();
  page.hooks.run = (out) => { out.value_repr = "1"; };
  $("look-try").click();
  assert.equal($("look-result").children[0].textContent, "Julia shows:");
  assert.equal($("look-result").textContent, "Julia shows:1");
});

test("round 10, the stylesheet: Loading waits a moment before it shows, and end-page code wraps inside its card", () => {
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  assert.match(css, /#app\[data-screen="loading"\] #screen-note\s*\{\s*animation:\s*fade 150ms 700ms both/);
  assert.match(css, /#end-lines pre\s*\{[^}]*white-space:\s*pre-wrap[^}]*overflow-wrap:\s*anywhere/);
});
test("0.5, the worked example is hidden when the editor starts with the very same line", () => {
  const ctrl = ctrlFor((d) => { d.rounds[0].challenges[1].starter = d.rounds[0].challenges[0].starter; });
  ctrl.start();
  jumpTo(ctrl, "d-r1-c2");
  assert.equal(ctrl.view().ch.pinned, null);
  const other = ctrlFor((d) => { d.rounds[0].challenges[1].starter = "count_marbles(red_bag)"; });
  other.start(); jumpTo(other, "d-r1-c2");
  assert.equal(other.view().ch.pinned.label, "Worked example (task 1)", "a different starter keeps the example");
});
test("round 10, the range's hint sits by the editor, not at the foot of the wave list", () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const at = (id) => html.indexOf('id="' + id + '"');
  assert.ok(at("right") < at("wave-hint") && at("wave-hint") < at("wave-hint-text") && at("wave-hint-text") < at("guess-line"), "in the editor column, right under Fire and Reset");
  assert.ok(!(at("waves") < at("wave-hint") && at("wave-hint") < at("range-back")), "and not inside the wave list's column");
});

// ---- round 11: the first-shot star is wired between the screen and the engine ------------------------
test("range: Run sends shot_number (1, then 2 after a shot that picked jars); an error shot does not use up the first", () => {
  const { ctrl, sent } = setupRange(passedLessons(["lesson1"]));
  const runs = () => sent.filter((m) => m.type === "lesson_run");
  ctrl.fire("no ids here");                       // the fake server answers ok without picked ids only when ids exist; this one picks none
  assert.equal(runs()[0].shot_number, 1);
  ctrl.fire("J-091");
  assert.equal(runs()[runs().length - 1].shot_number, 1, "a run that picked no jars is not a shot");
  ctrl.fire("J-091 J-092");
  assert.equal(runs()[runs().length - 1].shot_number, 2);
  ctrl.selectWave("w2");
  ctrl.fire("J-083");
  assert.equal(runs()[runs().length - 1].shot_number, 1, "each wave counts its own shots");
});

test("range: a level the engine judges clean is done, whatever its shot_number", () => {
  const later = setupRange(passedLessons(["lesson1"]), (reply, msg) => { reply.range = { hits: 1, misses: 0, clean: true, shot_number: 2 }; });
  later.ctrl.fire("J-091");
  assert.equal(later.ctrl.view().range.waves[0].done, true);
});
test("play box: an empty run or `nothing` says Done in one line", () => {
  const { ctrl } = setup();
  ctrl.start();
  ctrl.state.index = ctrl.state.flat.findIndex((f) => f.challenge.kind === "play");
  ctrl.run("x");
  for (const repr of ["", "nothing"]) {
    ctrl.state.result = { status: "ok", feedback: "", value_repr: repr, pass: true };
    assert.match(ctrl.view().ch.feedback, /^Done\./);
  }
  ctrl.state.lastCode = "using CSV";
  ctrl.state.result = { status: "ok", feedback: "", value_repr: "nothing", pass: true };
  assert.equal(ctrl.view().ch.feedback, "Done. This line loads packages; it shows nothing.");
  ctrl.state.result = { status: "ok", feedback: "", value_repr: "5", pass: true };
  assert.doesNotMatch(ctrl.view().ch.feedback, /^Done\./);
});

// ======================================================================================================
// 0.5 first-look fixes (docs/dev-log/course/0.5-fix-spec.md): the bar, the rule line, the end page, the
// language, the cheat sheet, the starter line and the words.
// ======================================================================================================
test("0.5, the bar: 'Step N of 6 · Lesson N · Round r of R' on a line, 'Step N of 6 · Lesson N' on its cards; Board and title go to the Board", () => {
  const as1 = ctrlFor(asLesson1);
  assert.equal(as1.view().nav.text, "Step 1 of 6 · Lesson 1");
  assert.equal(as1.view().nav.board, "course/index.html");
  as1.start();
  assert.equal(as1.view().nav.text, "Step 1 of 6 · Lesson 1 · Round 1 of 2");
  const withAttempt = lesson.createController({ lessonId: "dummy", attempt: "class-a", storage: memoryStorage(), send: () => {} });
  assert.equal(withAttempt.view().nav.board, "course/index.html?attempt=class-a", "the Board link keeps the attempt");
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  assert.ok(header.indexOf('id="brand"') < header.indexOf('id="strip-text"') && header.indexOf('id="strip-text"') < header.indexOf('id="board-link"') && header.indexOf('id="board-link"') < header.indexOf('id="cheat"'), "left, middle, right");
  assert.doesNotMatch(header, /id="restart"/, "Start again is no longer in the bar");
  const card = html.slice(html.indexOf('id="screen-start"'), html.indexOf('id="screen-lesson"'));
  assert.match(card, /id="restart"/, "it sits inside the start card");
});

test("0.5, the round's rule stays pinned as one collapsed line on every line after the first", () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.equal(ctrl.view().ch.rule, "", "the first line shows the rule in full as its explain");
  runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().ch.rule, dummyFull.rounds[0].explain);
  assert.equal(ctrl.view().ch.explain, "");
});

test("0.5, a wrong answer is a quiet 'not yet'; Julia's error is an alert; a pass is ok; a play box is never styled", () => {
  const { ctrl } = setup();
  ctrl.start(); runOk(ctrl); ctrl.next();
  runBad(ctrl);
  assert.equal(ctrl.view().ch.feedbackTone, "notyet");
  ctrl.run("bad(1)");
  assert.equal(ctrl.view().ch.feedbackTone, "alert");
  runOk(ctrl);
  assert.equal(ctrl.view().ch.feedbackTone, "ok");
  ctrlToPlay(ctrl); ctrl.run("bad(1)");
  assert.equal(ctrl.view().ch.feedbackTone, "");
});

test("0.5, the end page: the main button right under the title; lines in one closed fold with one Copy all; Worth remembering and (round 4, R3-33) In your own work in view", async () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const at = (id) => html.indexOf('id="' + id + '"');
  assert.ok(at("end-title") < at("end-go") && at("end-go") < at("end-finding"), "the button sits right under the title");
  ["end-lines", "copy-all", "print", "end-restart"].forEach((id) => assert.ok(at(id) > at("end-more") && at(id) < html.indexOf("</details>", at("end-more")), id + " is inside the fold"));
  assert.ok(at("end-own") > 0 && at("end-own") < at("end-more"), "In your own work is a visible card above the fold, not inside it (R3-33)");
  assert.ok(at("end-clues") < at("end-more"), "Worth remembering is listed in view, not in the fold (D6)");
  assert.match(html, /<details id="end-more" class="end-more">/, "closed by default");
  assert.equal((html.match(/>Copy</g) || []).length, 0, "no per-line Copy button in the page");
  const src = fs.readFileSync(path.join(root, "web/lesson.js"), "utf8");
  assert.doesNotMatch(src, /"Copy line "/);
});

test("0.5, Cheat sheet: on a line it opens the pocket dictionary; on a card it opens the sheet of rounds reached", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("cheat").hidden, false);
  assert.equal($("sheet").hidden, true);
  $("cheat").click();
  assert.equal($("sheet").hidden, false, "the start card opens the sheet");
  assert.equal($("sheet-body").children.length, 1, "a fresh lesson: only round 1's rows, nothing not yet taught (P12)");
  $("cheat").click();
  assert.equal($("sheet").hidden, true, "and closes it again");
  $("start").click();
  $("dict").open = false;
  $("cheat").click();
  assert.equal($("dict").open, true, "on a line it opens the pocket dictionary beside the work");
  assert.equal($("sheet").hidden, true);
});

test("0.5, dictionary code cells break after a dot, a $, a comma or a bracket, never inside a word", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  page.byId.start.click();
  const row = page.byId["dict-body"].children[0];
  const cell = row.children[0];
  assert.ok(cell.children.some((n) => n.tag === "wbr"), "a break point after the bracket");
  assert.equal(cell.textContent, dummyFull.dictionary[0].julia, "the text itself is unchanged");
});

test("0.5, Show a starter line on the page: it fills an empty editor, and never shows the line a second time beside it (P14)", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.rounds[0].challenges[2].starter_hint = "count_marbles(___)";
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); runOk(a.ctrl); a.ctrl.next(); runOk(a.ctrl); a.ctrl.next();
  const page = fakePage(storage, def);
  lesson.init(page.doc); await tick(); resume(page);
  const $ = (id) => page.byId[id];
  assert.equal($("screen-lesson").getAttribute("data-cid"), "d-r1-c3");
  assert.equal($("starter").hidden, true, "not offered before two misses");
  $("code").value = "nope"; $("run").click(); $("run").click();
  assert.equal($("starter").hidden, false, "offered after two misses");
  $("code").value = "";
  $("starter").click();
  assert.equal($("code").value, "count_marbles(___)");
  assert.equal($("starter-box").hidden, true, "in the editor only, never twice");
  assert.equal($("starter").hidden, true, "shown once");
  // an editor that already holds other code keeps it: the line then shows beside the editor
  const p2 = fakePage(storage, def);
  lesson.init(p2.doc); await tick(); resume(p2);
  p2.byId.code.value = "my own try";
  p2.byId.starter.click();
  assert.equal(p2.byId.code.value, "my own try", "the player's typing is never overwritten");
  assert.equal(p2.byId["starter-box"].hidden, false);
  assert.equal(p2.byId["starter-code"].textContent, "count_marbles(___)");
});

test("0.5, one vocabulary on the lesson screen: line, round, level, Board; never challenge, wave, Fire, stars or Case Board in what a player reads", () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const text = html.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, /\b(challenge|challenges|wave|waves|Fire|stars?|Case Board|All lessons)\b/i);
  const src = screenSrc().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const strings = (src.match(/"(?:[^"\\\n]|\\.)*"/g) || []).map((x) => x.slice(1, -1)).filter((x) => /\s/.test(x));
  const bad = strings.filter((x) => /\b(challenge|challenges|Wave|waves|Fire|star|stars|Case Board|score)\b/.test(x));
  assert.deepEqual(bad, [], "player-facing strings");
});

// ---- fix round 2: P12 chrome and vocabulary, P13 marks, D8 fast lane, P05 end page ----------------------------
test("P12: every task shows its kind; the counter says Task, never Line; a switched-off Next says why", () => {
  const { ctrl } = setup();
  ctrl.start();
  const kinds = {};
  while (ctrl.view().screen === "challenge") {
    const v = ctrl.view();
    if (v.ch.warmGate) { ctrl.quiz(0); ctrl.startRound(); continue; }
    kinds[v.ch.kind] = v.ch.kindLabel;
    assert.ok(v.ch.kindLabel, v.ch.id + " has a kind label");
    assert.doesNotMatch(v.strip.line, /\bLine\b/, "the counter never says Line");
    if (!v.ch.nextEnabled) assert.equal(v.ch.nextWhy, "Run your line to go on.", v.ch.id);
    if (v.ch.kind !== "play" && v.ch.kind !== "see") {
      runBad(ctrl);
      if (!ctrl.view().ch.nextEnabled) assert.equal(ctrl.view().ch.nextWhy, "Next opens when your line gives the right answer.");
    }
    if (v.ch.kind !== "play") runOk(ctrl);
    assert.equal(ctrl.view().ch.nextWhy, "", "no reason once Next is on");
    ctrl.next();
  }
  assert.deepEqual(kinds, { see: "Watch", change: "Change", checkpoint: "Checkpoint", write: "Write", fix: "Fix", play: "Try anything" });
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.match(html, /<button id="next"[^>]*aria-describedby="next-why"/, "the reason is tied to the button for a screen reader");
  assert.doesNotMatch(screenSrc(), /New in this round:/, "no label with nothing listed after it");
});

test("P12: the one-word worked line says only what it is; the glossary tip shows once, on the first underlined screen", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.rounds[0].challenges[0].starter = "bag";
  def.rounds[0].challenges[0].labels = [{ part: "bag", is: "a name" }];
  const page = fakePage(memoryStorage(), def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal($("pinned-labels").textContent, "This line is a name.", "never 'bag a name' under 'bag'");
  // the tip: on the lesson's first screen that underlines a word, and on no other
  const ctrl = ctrlFor();
  ctrl.start();
  const tips = [];
  while (ctrl.view().screen === "challenge") {
    const v = ctrl.view();
    if (v.ch.warmGate) { ctrl.quiz(0); ctrl.startRound(); continue; }
    if (v.ch.glossTip) tips.push(v.ch.id);
    if (v.ch.kind !== "play") runOk(ctrl);
    ctrl.next();
  }
  assert.equal(tips.length, 1, "said once in the lesson");
  assert.equal(tips[0], "d-r1-c1");
});

test("P13: after a warm-up pick the right choice gets a tick and a wrong pick a cross; the verdict starts Yes. or Not quite.", async () => {
  const ctrl = ctrlFor();
  ctrl.start();
  for (let i = 0; i < 3; i++) { runOk(ctrl); ctrl.next(); }
  let r = ctrl.view().ch.remember;
  assert.deepEqual(r.marks, ["", "", ""], "no marks before a pick");
  assert.equal(r.canSkip, true, "Skip the warm-up is offered inside the card");
  const wrong = r.choices.indexOf("9");
  ctrl.quiz(wrong);
  r = ctrl.view().ch.remember;
  assert.equal(r.marks[wrong], "wrong");
  assert.equal(r.marks[r.choices.indexOf("5")], "right");
  assert.equal(r.marks.filter((m) => m).length, 2);
  assert.match(r.say, /^Not quite\. The answer is 5\. /);
  assert.equal(r.canSkip, false, "the skip goes once answered");
  // a right pick: one tick, no cross
  const b = ctrlFor(); b.start(); for (let i = 0; i < 3; i++) { runOk(b); b.next(); }
  b.quiz(b.view().ch.remember.choices.indexOf("5"));
  assert.match(b.view().ch.remember.say, /^Yes\. /);
  assert.deepEqual(b.view().ch.remember.marks.filter((m) => m), ["right"]);
  // Skip the warm-up starts the round
  const c = ctrlFor(); c.start(); for (let i = 0; i < 3; i++) { runOk(c); c.next(); }
  c.skipWarm();
  assert.equal(c.view().ch.warmGate, false);
  // on the page: the classes and the words a screen reader hears
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); for (let i = 0; i < 3; i++) { runOk(a.ctrl); a.ctrl.next(); }
  const page = fakePage(storage, dummyFull);
  lesson.init(page.doc); await tick(); resume(page);
  const $ = (id) => page.byId[id];
  assert.ok($("remember").all().some((n) => n.attrs.id === "skip-warm"), "the skip sits inside the warm-up card");
  clickText($("remember"), "9");
  const buttons = $("remember").all().filter((n) => n.tag === "button" && /\bchoice\b/.test(n.className));
  assert.equal(buttons.filter((b) => /\bwrong\b/.test(b.className)).length, 1);
  assert.equal(buttons.filter((b) => /\bright\b/.test(b.className)).length, 1);
  assert.match(buttons.find((b) => /\bright\b/.test(b.className)).textContent, /the right answer/);
  assert.ok(!$("remember").all().some((n) => n.attrs.id === "skip-warm"), "gone once answered");
});

test("P13: a prediction's marks wait for the run; then the right choice is ticked and a wrong pick crossed", () => {
  const { ctrl } = setup();
  ctrl.start();
  const shown = ctrl.view().ch.predict.choices;
  ctrl.predict(shown.indexOf("9"));
  assert.deepEqual(ctrl.view().ch.predict.marks, ["", "", ""], "no answer before the run");
  runOk(ctrl);
  const m = ctrl.view().ch.predict.marks;
  assert.equal(m[shown.indexOf("9")], "wrong");
  assert.equal(m[shown.indexOf("5")], "right");
  assert.match(ctrl.view().ch.guessLine, /You picked: 9/, "your pick, never your guess");
});

test("D8: the fast lane runs each round's checkpoint in a row; passing them all marks the lesson done", () => {
  const { ctrl, sent } = setup();
  assert.equal(ctrl.view().lesson.fastLane, "I know R or Python: try this lesson's checkpoints");
  ctrl.fastLane();
  let v = ctrl.view();
  assert.equal(v.screen, "challenge");
  assert.equal(v.ch.id, "d-r1-c3", "round 1's checkpoint");
  assert.equal(v.ch.testOut.active, true);
  assert.match(v.ch.testOut.note, /^Fast lane: the checkpoint of Round 1 of 2\. 2 runs left\.$/);
  runOk(ctrl); ctrl.next();
  v = ctrl.view();
  assert.equal(v.ch.id, "d-r2-c4", "straight on to round 2's checkpoint, with no warm-up in between");
  assert.equal(v.ch.warmGate, false);
  runOk(ctrl); ctrl.next();
  v = ctrl.view();
  assert.equal(v.screen, "end", "every checkpoint passed: the lesson is done");
  assert.equal(v.end.skipped.length, 2, "the other tasks are listed as tested out");
  assert.equal(sent.filter((m) => m.type === "lesson_run").length, 2);
  assert.equal(setup(ctrl.state.progress && (() => { const st = memoryStorage(); st.setItem(lesson.STORE_PREFIX + "dummy", JSON.stringify(ctrl.state.progress)); return st; })()).ctrl.view().lesson.fastLane, "", "a done lesson offers no fast lane");
});

test("D8: two misses in the fast lane drop the player into that round from its start; nothing is counted against them", () => {
  const { ctrl } = setup();
  ctrl.fastLane();
  runOk(ctrl); ctrl.next();                       // round 1 tested out
  runBad(ctrl); runBad(ctrl);                     // round 2: two misses
  const v = ctrl.view();
  assert.equal(v.screen, "challenge");
  assert.equal(v.ch.id, "d-r2-c1", "the start of round 2");
  assert.equal(v.ch.testOut.active, false, "the fast lane has ended");
  assert.match(v.notice, /Nothing is counted against you/);
  assert.equal(ctrl.state.progress.fails["d-r2-c4"], undefined);
});

test("D8: on the page the fast lane is a quiet button on a lesson's start card, never on a chapter's", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  assert.equal($("fast-row").hidden, false);
  assert.equal($("fast-lane").textContent, "I know R or Python: try this lesson's checkpoints");
  $("fast-lane").click();
  assert.equal($("screen-lesson").hidden, false);
  assert.equal($("screen-lesson").attrs["data-cid"], "d-r1-c3");
  assert.equal($("testout-leave").hidden, false, "Back to the round stays one click away");
  const exam = ctrlFor((d) => { d.kind = "exam"; d.id = "exam7"; });
  assert.equal(exam.view().lesson.fastLane, "", "a chapter has no fast lane");
});

test("P05: Start again sits at the foot of the fold, apart from Copy all, and still asks first; print names the pocket dictionary", async () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const tools = html.slice(html.indexOf('<p class="end-tools">'), html.indexOf("</p>", html.indexOf('<p class="end-tools">')));
  assert.ok(tools.includes('id="copy-all"') && !tools.includes('id="end-restart"'), "not a sibling of Copy all");
  assert.ok(html.indexOf('id="end-restart"') > html.indexOf('id="end-own"'), "at the foot of the fold");
  assert.match(html, /<button id="print"[^>]*>Print the pocket dictionary<\/button>/);
  assert.match(html, /Optional practice: write a line that picks the right jars\./);
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); finishAll(a.ctrl);
  const page = fakePage(storage, dummyFull);
  let asked = 0;
  page.win.confirm = () => { asked += 1; return false; };
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("end-restart").click();
  assert.equal(asked, 1, "it asks first");
  assert.equal($("screen-end").hidden, false, "and a No keeps the page");
  // the lines: numbered in one run, each with its round's title
  const ols = $("end-lines").children.filter((n) => n.tag === "ol");
  assert.equal(ols[1].attrs.start, String(ols[0].children.length + 1), "practice lines carry on the numbering");
  const caps = $("end-lines").all().filter((n) => n.className === "line-cap").map((n) => n.textContent);
  assert.ok(caps.length >= 5 && caps.every((c) => c === "Count things" || c === "Pick a few"), caps.join(","));
  assert.equal($("end-clues").hidden, false, "Worth remembering is listed in view");
  assert.match($("end-clues").textContent, /^Worth remembering:/);
});

test("P15: no rule in lesson.css sets text under 16px; prompts and explanations are 18px; no ellipsis anywhere", () => {
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const sizes = [...css.matchAll(/font(?:-size)?:\s*(?:[0-9]{3}\s+)?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 10);
  assert.deepEqual(sizes.filter((s) => s < 16), [], "every font size is at least 16px");
  assert.doesNotMatch(css, /text-overflow:\s*ellipsis|line-clamp/, "nothing is cut off");
  assert.match(css, /#explain, #rule-text \{ font-size: 18px; white-space: pre-line; \}/);
  assert.match(css, /\.prompt \{ font-size: 18px;/);
  assert.doesNotMatch(css, /opacity:\s*\.5/, "a switched-off button keeps readable words, not a faded look");
  // D2: the page is no longer pinned to the window's height; only the result box may scroll inside it
  assert.doesNotMatch(css, /[^-]height:\s*100vh/);
  const scrollers = [...css.matchAll(/([^{}]+)\{[^}]*overflow:\s*auto/g)].map((m) => m[1].trim());
  assert.deepEqual(scrollers.sort(), ["#look-result", "#result"], "only the result boxes scroll inside the page");
});

// ---- fix round 2, P08: the result is exactly what Julia prints ------------------------------------------------
test("P08: the Result block shows the engine's `shown` verbatim, with a plain caption and row names beside true/false answers", async () => {
  const shownMask = "3-element BitVector:\n 1\n 0\n 1";
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.data_values = Object.assign({}, def.data_values, { tiny: { columns: ["jar_id", "detected"], rows: [["J-081", true], ["J-082", false], ["J-083", true]] } });
  def.rounds[1].challenges[1].data = "tiny";
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); for (let i = 0; i < 3; i++) { runOk(a.ctrl); a.ctrl.next(); } a.ctrl.quiz(0); a.ctrl.startRound(); runOk(a.ctrl); a.ctrl.next();
  const page = fakePage(storage, def);
  page.hooks.run = (out) => { out.shown = shownMask; out.value_table = { columns: ["value"], rows: [["true"], ["false"], ["true"]] }; };
  lesson.init(page.doc); await tick(); resume(page);
  const $ = (id) => page.byId[id];
  assert.equal($("screen-lesson").attrs["data-cid"], "d-r2-c2");
  $("code").value = "x"; $("run").click();
  const pres = $("result").all().filter((n) => n.tag === "pre");
  // Round 6 (result fix): a list of 12 or fewer shows as ONE ROW of cells (position above, value below, row name under that) and Julia's exact
  // print waits in a closed fold, put in only while it is open. The values are the printed lines, trimmed and nothing else.
  assert.equal(pres.find((n) => n.className === "shown"), undefined, "the closed fold holds no print");
  const cells = $("result").all().filter((n) => /\bcell\b/.test(n.className));
  assert.deepEqual(cells.map((c) => c.all().filter((x) => x.tag === "span").map((x) => x.textContent)), [["1", "1", "J-081"], ["2", "0", "J-082"], ["3", "1", "J-083"]], "position, value, row name");
  const fold = $("result").all().find((n) => n.tag === "details" && /exact/.test(n.className));
  assert.match(fold.all().find((n) => n.tag === "summary").textContent, /^Julia's exact print \(these same values, in a column\)$/);
  const cap = $("result").all().find((n) => /shown-cap/.test(n.className)).textContent;
  assert.match(cap, /^3 answers, one per row of tiny\. Julia shows true as 1 and false as 0\. Under each: the jar_id, added by Julia Time\.$/);
  assert.ok(!$("result").all().some((n) => n.tag === "table"), "no rewritten 'value' table beside it");
  assert.equal($("data").all().find((n) => n.className === "cap").textContent, "Table: tiny");
});

test("P08: captions for a list, a table and a grouped table; a plain number has none; an error ignores `shown`", () => {
  const ctrl = ctrlFor();
  ctrl.start();
  const view = (extra) => { ctrl.state.pending = "rq"; ctrl.state.lastCode = "x"; ctrl.handle(Object.assign({ type: "lesson_result", request_id: "rq", status: "ok", pass: false, value_repr: "", feedback: "Not yet." }, extra)); return ctrl.view().ch.result.shown; };
  assert.deepEqual(view({ shown: "1.0" }), { text: "1.0", keys: null, caption: "" }, "1.0 stays 1.0");
  assert.equal(view({ shown: "2-element Vector{Float64}:\n 0.666667\n 0.333333" }).caption, "A list of 2 items.");
  assert.equal(view({ shown: "3×3 DataFrame\n Row │ a\n─────┼──\n   1 │ 1" }).caption, "A table: 3 rows, 3 columns.");
  assert.equal(view({ shown: "GroupedDataFrame with 3 groups based on key: tray_id" }).caption, "The table split into groups.");
  assert.equal(view({ shown: "2-element BitVector:\n 1\n 0" }).caption, "2 answers. Julia shows true as 1 and false as 0.", "no table on screen, so no row names");
  assert.equal(view({ status: "error", shown: "x", message: "UndefVarError" }), null);
  assert.equal(view({}), null, "an older server without `shown` keeps the old display");
});

test("P08: a list in the data panel is named a list; P06: `code` in feedback shows as code, never raw backticks", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.data_values = Object.assign({}, def.data_values, { sim_counts: { columns: ["value"], rows: [[3], [4]] } });
  def.rounds[1].challenges[1].data = "sim_counts";
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); for (let i = 0; i < 3; i++) { runOk(a.ctrl); a.ctrl.next(); } a.ctrl.quiz(0); a.ctrl.startRound(); runOk(a.ctrl); a.ctrl.next();
  const page = fakePage(storage, def);
  page.hooks.run = (out) => { out.feedback = "Julia does not know `lobook`. Did you mean `logbook`?"; };
  lesson.init(page.doc); await tick(); resume(page);
  const $ = (id) => page.byId[id];
  assert.equal($("data").all().find((n) => n.className === "cap").textContent, "List: sim_counts");
  $("code").value = "x"; $("run").click();
  assert.equal($("feedback").textContent, "Julia does not know lobook. Did you mean logbook?");
  assert.deepEqual($("feedback").all().filter((n) => n.tag === "code").map((n) => n.textContent), ["lobook", "logbook"]);
});

test("P10 (screen): on a worked line that asks for a pick, the R and Python notes open only after Run", () => {
  const ctrl = ctrlFor((d) => { const c = d.rounds[0].challenges[0]; c.r_note = "length(bag)"; c.py_note = "len(bag)"; });
  ctrl.start();
  assert.ok(ctrl.view().ch.predict, "the first see asks for a pick");
  assert.deepEqual(ctrl.view().ch.pinned.notes, { r: null, py: null }, "no note before the run");
  ctrl.predict(0); runOk(ctrl);
  const n = ctrl.view().ch.pinned.notes;
  assert.ok(n.r && n.py, "both notes after the run");
});

test("P12, P14: the cheat sheet on a start card shows only rows from rounds reached; the round's story shows above its first task", () => {
  const fresh = ctrlFor();
  assert.deepEqual(fresh.view().sheet.map((r) => r.julia), ["count_marbles(x)"], "a fresh start card: round 1's rows only");
  const ctrl = ctrlFor((d) => { d.rounds[0].story = "Momo counts the marbles first."; });
  ctrl.start();
  assert.equal(ctrl.view().ch.roundStory, "Momo counts the marbles first.");
  runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().ch.roundStory, "", "only on the round's first task");
  finishAll(ctrl); ctrl.quiz && finishAll(ctrl);
});

test("queue 3: a round's explanation keeps its lines (pre-line), notes render backtick code spans, clues read 'Worth remembering'", () => {
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  assert.match(css, /#explain, #rule-text \{[^}]*white-space: pre-line/);
  const src = screenSrc();
  assert.match(src, /Worth remembering: /);
  assert.match(src, /Text with `code` in backticks/);
});

// Round 4 (MUST_FIX): the verdict on screen belongs to the code in the editor.
test("r4: Show me the line clears the old wrong-run verdict and error", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl); ctrl.next();
  ctrl.run("bad(1)");
  ctrl.run("bad(2)");
  assert.equal(ctrl.view().ch.feedbackTone, "alert");
  assert.ok(ctrl.view().ch.result);
  ctrl.showLine();
  const ch = ctrl.view().ch;
  assert.equal(ch.result, null, "the old error is gone");
  assert.equal(ch.feedback, "Here is the line, in the editor. Press Run to see what Julia does with it.", "round 5: the note replaces it");
  assert.equal(ch.feedbackTone, "");
  assert.equal(ch.nextEnabled, true);
});
test("r4: Reset and any edit after a run drop the verdict that belonged to the old code", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl); ctrl.next();
  ctrl.run("nothing_here");
  assert.ok(ctrl.view().ch.result);
  ctrl.reset();
  assert.equal(ctrl.view().ch.result, null);
  ctrl.run("nothing_here");
  ctrl.draft("nothing_here2");
  assert.equal(ctrl.view().ch.result, null, "an edit makes the verdict stale");
  assert.equal(ctrl.view().ch.feedback, "");
});
test("r4: typing back the very same line keeps no stale verdict, and a no-op draft keeps the result", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl); ctrl.next();
  ctrl.run("nothing_here");
  ctrl.draft("nothing_here");              // same text: nothing changed
  assert.ok(ctrl.view().ch.result);
});
test("r4: after a pass, an edit or a reset puts Next back to secondary until the code passes again", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl);
  assert.equal(ctrl.view().ch.nextPrimary, true);
  ctrl.draft("count_marbles(bag) + 1");
  assert.equal(ctrl.view().ch.nextEnabled, true, "Next still works");
  assert.equal(ctrl.view().ch.nextPrimary, false);
  runOk(ctrl);
  assert.equal(ctrl.view().ch.nextPrimary, true);
  ctrl.reset();
  assert.equal(ctrl.view().ch.nextPrimary, false);
});
test("r4: the page redraws the stale verdict away when Show me the line is pressed", async () => {
  const page = fakePage(memoryStorage(), dummyFull);
  lesson.init(page.doc);
  await tick();
  const $ = (id) => page.byId[id];
  $("start").click(); guessFirst($); $("run").click(); $("next").click();
  $("code").value = "bad(1)"; $("run").click(); $("run").click();
  assert.notEqual($("feedback").textContent, "");
  $("show-line").click();
  assert.equal($("feedback").textContent, "Here is the line, in the editor. Press Run to see what Julia does with it.", "round 5: the old error gives way to the note");
  assert.equal($("code").value, "count_marbles(red_bag)");
});

// Round 4 (MUST_FIX): the confirmation line reads correctly for every choice label in every lesson file.
test("r4: the pick line is well formed for every predict choice in every lesson file", () => {
  const lessonsDir = path.join(root, "lessons");
  let n = 0;
  for (const f of fs.readdirSync(lessonsDir).filter((x) => /^(lesson|exam)\d+\.json$/.test(x))) {
    const L = JSON.parse(fs.readFileSync(path.join(lessonsDir, f), "utf8"));
    L.rounds.forEach((r) => r.challenges.forEach((c) => {
      if (!c.predict || !Array.isArray(c.predict.choices)) return;
      c.predict.choices.forEach((label, pick) => {
        const ctrl = lesson.createController({ send() {}, storage: memoryStorage(), lessonId: "x" });
        ctrl.handle({ type: "lesson", request_id: "r", lesson: JSON.parse(JSON.stringify(L)) });
        ctrl.state.progress.started = true;
        const at = ctrl.state.flat.findIndex((x) => x.challenge.id === c.id);
        ctrl.state.index = at; ctrl.state.screen = "challenge";
        ctrl.state.guess = pick;
        ctrl.state.result = { status: "ok", value_repr: "4", pass: true, feedback: "" };
        const line = ctrl.view().ch.guessLine;
        n += 1;
        assert.ok(line.includes("You picked: "), f + " " + c.id + ": " + line);
        // each sentence starts with a capital; nothing else in the template adds one mid-sentence
        const stripped = c.predict.choices.reduce((acc, l) => acc.split(l.replace(/[\s.!?;:,]+$/, "")).join(""), line);
        assert.doesNotMatch(stripped, /[a-z,;:] [A-Z]/, f + " " + c.id + " capital mid-sentence: " + line);
        assert.doesNotMatch(line, /\.\./, line);
        assert.doesNotMatch(line, /: you |, and Julia|; the answer/, "old splice: " + line);
      });
    }));
  }
  assert.ok(n > 60, "checked " + n + " labels");
});

test("r4: the note on added row names agrees with a plural column name (shelves are, jar_id is)", () => {
  const ctrl = ctrlFor();
  ctrl.start();
  // 13 rows: more than a row of cells holds, so the old column beside Julia's print (and its sentence) is still the display.
  const noteFor = (col) => {
    const d = ctrl.state.lesson.data_values;
    const cur = ctrl.view().ch;
    const rows = Array.from({ length: 13 }, (x, i) => ["k" + i, i]);
    ctrl.state.lesson.data_values = Object.assign({}, d, { tiny: { columns: [col, "n"], rows } });
    ctrl.state.flat[ctrl.state.index].challenge.data = "tiny";
    ctrl.state.pending = "rq"; ctrl.state.lastCode = "x";
    ctrl.handle({ type: "lesson_result", request_id: "rq", status: "ok", pass: false, value_repr: "", feedback: "Not yet.", shown: "13-element BitVector:\n" + rows.map(() => " 1").join("\n") });
    return ctrl.view().ch.result.shown.caption;
  };
  assert.match(noteFor("shelves"), /The shelves on the left are added by Julia Time/);
  assert.match(noteFor("jars"), /The jars on the left are added/);
  assert.match(noteFor("jar_id"), /The jar_id on the left is added/);
  assert.match(noteFor("status"), /The status on the left is added/);
});

// Round 4 (keyboard): focus goes to the next sensible control, never to the page body.
function focusPage(def, search) {
  const page = fakePage(memoryStorage(), def, search);
  page.focused = null;
  Object.keys(page.byId).forEach((id) => { page.byId[id].focus = () => { page.focused = id; }; });
  const base = page.doc.getElementById;
  page.doc.getElementById = (id) => base(id) || Object.values(page.byId).flatMap((n) => n.all()).find((n) => n.attrs && n.attrs.id === id);
  const make = page.doc.createElement;
  page.doc.createElement = (t) => { const n = make(t); n.focus = () => { page.focused = n.attrs.id; }; return n; };
  page.doc.querySelector = () => null;
  return page;
}
test("r4 focus: Start goes to the editor, a pass goes to Next, a wrong run stays on Run, Show me the line goes to Run", async () => {
  const page = focusPage(dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  assert.equal(page.focused, "code", "after Start");
  guessFirst($); $("code").value = "count_marbles(bag)"; $("run").click();
  assert.equal(page.focused, "next", "after a pass");
  $("next").click();
  $("code").value = "x"; $("run").click();
  assert.equal(page.focused, "run", "after a wrong run");
  $("run").click();
  $("show-line").click();
  assert.equal(page.focused, "run", "after Show me the line");
});
test("r4 focus: Try it in Look closer keeps the keyboard on Try it", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull)); asLesson1(def);
  const page = focusPage(def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click(); $("look-link").click();
  page.focused = null;
  $("look-try").click();
  assert.equal(page.focused, "look-try");
});
test("r4 focus: the finish page puts focus on the main Continue button", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull)); asLesson1(def);
  const page = focusPage(def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  for (let i = 0; i < 40 && page.byId["screen-end"].hidden; i++) {
    const c = $("code");
    if (!$("predict").hidden) guessFirst($);
    const cid = $("screen-lesson").attrs["data-cid"];
    if (!$("screen-lesson").hidden && $("remember") && !$("remember").hidden) { const b = $("remember").all().find((n) => n.tag === "button" && n.className === "choice"); if (b) b.click(); const s = $("remember").all().find((n) => n.tag === "button" && /Start/.test(n.textContent)); if (s) s.click(); }
    c.value = answers[cid] || "x"; if (!$("run").disabled) $("run").click();
    $("next").click();
  }
  assert.equal(page.byId["screen-end"].hidden, false);
  assert.equal(page.focused, "end-go-btn");
});
test("r4: lesson.html has a skip link to the main part and a short run hint near Run", () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.match(html, /<a class="skip" href="#main">[^<]+<\/a>/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /<p id="run-hint"[^>]*>Ctrl\+Enter or Cmd\+Enter runs<\/p>/);
  assert.ok(html.indexOf('id="run"') < html.indexOf('id="run-hint"') && html.indexOf('id="run-hint"') < html.indexOf('id="feedback"'));
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  assert.match(css, /\.skip:focus/);
  assert.match(css, /#run-hint \{[^}]*font-size: 16px/);
});

// ---- 0.5 round 5, "Screen": the shown line is not a pass; the end page keeps focus ------------------------------
const LINE_NOTE = "Here is the line, in the editor. Press Run to see what Julia does with it.";
test("r5: Show me the line says so, leaves Run primary and labelled Run, and Next is not primary until the shown line passes", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl); ctrl.next();
  runBad(ctrl); runBad(ctrl);
  ctrl.showLine();
  let ch = ctrl.view().ch;
  assert.equal(ch.feedback, LINE_NOTE, "a clear message");
  assert.equal(ch.lineShown, true);
  assert.equal(ch.runLabel, "Run", "the line has not run, so it is not 'Run again'");
  assert.equal(ch.nextPrimary, false, "Next is not the main action yet");
  assert.equal(ch.nextEnabled, true, "a stuck player may still go on");
  assert.equal(ctrl.view().ch.pass, undefined);
  ctrl.draft("count_marbles(red_bag) ");   // only a space: the same line, the message stays
  assert.equal(ctrl.view().ch.feedback, LINE_NOTE);
  ctrl.draft("count_marbles(blue_bag)");   // an edit: the message was about the shown line
  assert.equal(ctrl.view().ch.feedback, "");
  ctrl.draft("count_marbles(red_bag)");
  ctrl.run("count_marbles(red_bag)");
  ch = ctrl.view().ch;
  assert.equal(ch.lineShown, false, "it ran and passed");
  assert.equal(ch.nextPrimary, true);
  assert.equal(ch.runLabel, "Run again");
});
test("r5: running the shown line wrongly keeps Next secondary", () => {
  const { ctrl } = setup();
  ctrl.start();
  runOk(ctrl); ctrl.next();
  runBad(ctrl); runBad(ctrl);
  ctrl.showLine();
  ctrl.run("nothing_here");
  const ch = ctrl.view().ch;
  assert.equal(ch.nextPrimary, false);
  assert.equal(ch.runLabel, "Run");
});
test("r5 page: after Show me the line Run is the filled button and Next is not, and focus is on Run", async () => {
  const page = focusPage(dummyFull);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click(); guessFirst($); $("code").value = "count_marbles(bag)"; $("run").click(); $("next").click();
  $("code").value = "x"; $("run").click(); $("run").click();
  $("show-line").click();
  assert.equal($("feedback").textContent, LINE_NOTE);
  assert.equal($("run").textContent, "Run");
  assert.equal($("run").className, "primary");
  assert.notEqual($("next").className, "primary");
  assert.equal(page.focused, "run");
});
test("r5 page: the starter line that fills the editor says what to do", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.rounds[0].challenges[2].starter_hint = "count_marbles(___)";
  const storage = memoryStorage();
  const a = setup(storage); a.ctrl.start(); runOk(a.ctrl); a.ctrl.next(); runOk(a.ctrl); a.ctrl.next();
  const page = fakePage(storage, def);
  lesson.init(page.doc); await tick(); resume(page);
  const $ = (id) => page.byId[id];
  $("code").value = "nope"; $("run").click(); $("run").click();
  $("code").value = "";
  $("starter").click();
  assert.equal($("code").value, "count_marbles(___)");
  assert.equal($("feedback").textContent, "Here is a starter line. Fill each blank (___), then press Run.");
  assert.equal($("run").className, "primary");
});
test("r5 page: the finish page keeps focus on Continue even when the page draws again", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull)); asLesson1(def);
  const page = focusPage(def);
  lesson.init(page.doc); await tick();
  const $ = (id) => page.byId[id];
  $("start").click();
  for (let i = 0; i < 40 && page.byId["screen-end"].hidden; i++) {
    const c = $("code");
    if (!$("predict").hidden) guessFirst($);
    const cid = $("screen-lesson").attrs["data-cid"];
    if (!$("screen-lesson").hidden && $("remember") && !$("remember").hidden) { const b = $("remember").all().find((n) => n.tag === "button" && n.className === "choice"); if (b) b.click(); const s = $("remember").all().find((n) => n.tag === "button" && /Start/.test(n.textContent)); if (s) s.click(); }
    c.value = answers[cid] || "x"; if (!$("run").disabled) $("run").click();
    $("next").click();
  }
  assert.equal(page.byId["screen-end"].hidden, false);
  page.focused = null;                    // a second draw replaces the button, as the browser does
  $("show-r").click();
  assert.equal(page.focused, "end-go-btn");
});
test("r5/r6: a switch that changes nothing says so, on every toggle of the step (round 6); it goes with the step", () => {
  const { ctrl } = setup();
  ctrl.start();
  assert.equal(ctrl.view().nav.switchNote, "");
  const raw = ctrl.state.flat[ctrl.state.index].challenge;
  ctrl.toggleShow("r");
  if (!(raw.r_note || raw.py_note)) assert.match(ctrl.view().nav.switchNote, /no R or Python note/);
  ctrl.toggleShow("r");
  runOk(ctrl); ctrl.next();
  assert.equal(ctrl.view().nav.switchNote, "", "the line goes away on the next step");
});
test("r5: the left column's lines are paragraphs, each with a gap (page code)", async () => {
  const def = JSON.parse(JSON.stringify(dummyFull));
  def.rounds[0].explain = "First sentence.\nSecond sentence.\nThird sentence.";
  const page = fakePage(memoryStorage(), def);
  lesson.init(page.doc); await tick();
  page.byId.start.click();
  const kids = page.byId.explain.children;
  const gaps = kids.filter((k) => k.attrs.class === "para-gap");
  assert.equal(gaps.length, 2);
  assert.equal(page.byId.explain.textContent, "First sentence.Second sentence.Third sentence.");
});

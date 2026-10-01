"use strict";
// Round 4 small items: resume label on a play step; hints on a write task.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lesson = require("../web/lesson.js");

const dummyFull = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/lesson-dummy.json"), "utf8"));
const answers = {};
dummyFull.rounds.forEach((r) => r.challenges.forEach((c) => { answers[c.id] = c.solution; }));
function served(full) {
  const copy = JSON.parse(JSON.stringify(full));
  copy.rounds.forEach((r) => r.challenges.forEach((c) => { delete c.check; if (c.kind === "checkpoint") delete c.solution; }));
  return copy;
}
function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    get length() { return m.size; }, key: (i) => Array.from(m.keys())[i] };
}
function setup(storage, full = dummyFull) {
  let ctrl;
  const send = (msg) => {
    if (msg.type === "lesson_list") ctrl.handle({ type: "lessons", lessons: [{ id: "dummy", number: 7, title: full.title }] });
    else if (msg.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: msg.request_id, lesson: served(full) });
    else if (msg.type === "lesson_run") {
      const pass = msg.code.trim() === answers[msg.challenge];
      ctrl.handle({ type: "lesson_result", request_id: msg.request_id, challenge: msg.challenge, status: "ok",
        value_repr: pass ? "5" : "0", value_table: null, stdout: "", pass, feedback: pass ? "Good." : "Not yet." });
    }
  };
  ctrl = lesson.createController({ send, storage: storage || memoryStorage(), lessonId: "dummy" });
  ctrl.open();
  return ctrl;
}
const runOk = (ctrl) => { const ch = ctrl.view().ch; if (ch.predict && ch.predict.guess === null) ctrl.predict(0); ctrl.run(answers[ch.id]); };

test("resume on a Try anything step names the step, not a task number", () => {
  const storage = memoryStorage();
  const a = setup(storage);
  a.start();
  while (a.view().ch.kind !== "play") { runOk(a); a.next(); }
  const b = setup(storage);
  assert.equal(b.view().lesson.resume, "You stopped at Round 2, the Try anything step.");
});

test("a write task offers its hints after a miss, like a checkpoint", () => {
  const full = JSON.parse(JSON.stringify(dummyFull));
  const w = full.rounds[1].challenges.find((c) => c.kind === "write");
  w.hints = ["First hint.", "Second hint."];
  const ctrl = setup(memoryStorage(), full);
  ctrl.start();
  while (ctrl.view().ch.id !== w.id) { runOk(ctrl); ctrl.next(); }
  ctrl.run("nothing_here");
  assert.equal(ctrl.view().ch.hintsAvailable, true);
  ctrl.hint();
  assert.equal(ctrl.view().ch.hints.length, 1);
  assert.equal(ctrl.view().ch.hints[0].text, "First hint.");
});

test("the leak scan reads the hints of a write task too", () => {
  const rules = require("./lesson-rules.cjs");
  const lessonCopy = {
    rounds: [{ id: "x-r1", challenges: [
      { id: "x-r1-c1", kind: "checkpoint", prompt: "p", solution: "total = sum(xs)", hints: [] },
      { id: "x-r1-c2", kind: "write", prompt: "q", hints: ["Try total = sum(xs)"] },
    ] }],
  };
  assert.deepEqual(rules.leakViolations(lessonCopy), ["x-r1-c2 hints contains the solution of x-r1-c1"]);
});

test("lesson 6 own_work.say does not repeat the numbered first-time steps", () => {
  const l6 = JSON.parse(fs.readFileSync(path.join(__dirname, "../lessons/lesson6.json"), "utf8"));
  assert.equal(l6.close.own_work.say, "At the julia> prompt a name you make stays until you close Julia. This editor starts each Run fresh.");
});

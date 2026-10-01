"use strict";
// Never invent output: the fold labelled "Julia's own message" shows Julia's real error text only. The game's
// stand-in lines (the sandbox's generic first line, the server's fallbacks) never appear under that label.
const test = require("node:test");
const assert = require("node:assert/strict");
const lesson = require("../web/lesson.js");

const def = { id: "t", number: 1, title: "T", rounds: [{ id: "r", title: "R", challenges: [
  { id: "t-a", kind: "checkpoint", prompt: "p", starter: "", hints: [] }] }], dictionary: [], data_values: {} };
let lastCtrl;
function ctrlWith(reply) {
  let ctrl;
  const m = new Map();
  ctrl = lesson.createController({ lessonId: "t", storage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    send: (x) => {
      if (x.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: x.request_id, lesson: def });
      if (x.type === "lesson_run") ctrl.handle(Object.assign({ type: "lesson_result", request_id: x.request_id, challenge: x.challenge, pass: false, value_repr: "", feedback: "Not yet." }, reply));
    } });
  ctrl.open(); ctrl.start(); ctrl.run("x");
  lastCtrl = ctrl;
  return ctrl.view().ch.result;
}
const FALLBACKS = ["Something went wrong running this line.", "Something went wrong running this line.\n\n",
  "Something went wrong handling that message.", "A function was called with the wrong kind of argument.",
  "zz is a name Julia does not know yet. Check the spelling, or define it first.",
  "Julia couldn't parse this line. Look for a missing bracket, a missing comma, or a missing end keyword."];

test("a fallback line alone never fills the fold named Julia's own message", () => {
  for (const message of FALLBACKS) {
    assert.equal(ctrlWith({ status: "error", message }).message, "", JSON.stringify(message));
  }
});
test("a fallback head is dropped and Julia's real text stays", () => {
  const r = ctrlWith({ status: "error", message: "Something went wrong running this line.\n\nUndefVarError: `zz` not defined" });
  assert.equal(r.message, "UndefVarError: `zz` not defined");
});
test("a timeout note is not Julia's message", () => {
  assert.equal(ctrlWith({ status: "timeout", message: "Your code ran for more than 5 seconds and was stopped." }).message, "");
});

// The protected-input note and the sandbox's other own notes are the game's words, never Julia's.
const NOTE = "The supplied jars records changed. Keep the source table unchanged; create a separate summary or copy, then try again.";
const jt = require("../web/julia-text.js");
test("the protected-input note is the feedback line, and the fold stays empty", () => {
  for (const message of [NOTE, "Something went wrong running this line.\n\n" + NOTE, "Something went wrong running this line.\n\nThe supplied eligible was changed. Keep it."]) {
    const r = ctrlWith({ status: "error", message });
    assert.equal(r.message, "", JSON.stringify(message));
  }
  ctrlWith({ status: "error", feedback: "Julia could not run this. Read your line again.", message: "Something went wrong running this line.\n\n" + NOTE });
  assert.equal(lastCtrl.view().ch.feedback, NOTE);
});
test("the shared filter: the note is found for feedback, and other game notes give no Julia text", () => {
  assert.equal(jt.protectedNote("Something went wrong running this line.\n\n" + NOTE), NOTE);
  assert.equal(jt.protectedNote("MethodError: no method"), "");
  for (const m of ["No sandbox worker is available.", "The result was too large to show (3.1 MB). Try a smaller n.",
    "This result is a function or a type you just defined, so the game shows it as text: f.",
    "Your code ran for more than 5.0 seconds and was stopped. Loops that never finish are the usual cause."]) assert.equal(jt.juliaText(m), "", m);
  assert.equal(jt.juliaText("Something went wrong running this line.\n\nBoundsError: attempt to access"), "BoundsError: attempt to access");
});

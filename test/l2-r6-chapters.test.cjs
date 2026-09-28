// Round 6 fixes (L2, 2026-09-27) for Chapters 2 to 6: C3 "Toto's typed copy" wording, C5 fraction
// shape and 0/1 display, one coaching ending in C3 and C4, the C3 phone table, next buttons beside Run,
// a way forward on a solved chapter, a quiet "new attempt" button, and C4/C5/C6 wording.
// Reports: night/r6-rc.md, night/r6-audit.md.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", "web", file), "utf8");
const c2 = require("../web/chapter2.js");
const c3 = require("../web/chapter3.js");
const c4 = require("../web/chapter4.js");
const c5 = require("../web/chapter5.js");
const c6 = require("../web/chapter6.js");

const STOPPED_END = " Change your code, then run again, or open Stuck? Hints below.";
const FINISHED_END = " Your draft is still here. Change it and run again, or open Stuck? Hints below.";
const LOOP = "This step needs no loop: Julia applies the rule to the whole column at once.";

test("C3 names Toto's typed copy, not 'the sheet', where the count is meant", () => {
  const html = read("chapter3.html");
  assert.match(html, /<h2 id="scene-goal">Do Toto’s typed copy and the notebook agree\?<\/h2>|<h2 id="scene-goal">Do Toto's typed copy and the notebook agree\?<\/h2>/);
  const join = c3.lessonCopy("join-report-log"), filter = c3.lessonCopy("filter-disagreement");
  assert.match(join.why, /Toto's typed count/);
  assert.doesNotMatch(join.why, /sheet's box/);
  assert.equal(filter.title, "Step 2 · Keep the tray where the notebook and Toto's typed copy disagree");
  assert.match(filter.concept, /not equal to Toto's typed count/);
});

test("C3 and C4 end a server coaching line the way C1, C5 and C6 do", () => {
  const stopped = {status:"error", pass:false, message:"syntax", coaching:LOOP};
  const finished = {status:"ok", pass:false, feedback:LOOP, coaching:LOOP};
  assert.equal(c3.errorRecovery("filter-disagreement", stopped), LOOP + STOPPED_END);
  assert.equal(c4.recoveryCopy(stopped), LOOP + STOPPED_END);
  assert.equal(c3.finishedRecovery("filter-disagreement", finished), LOOP + FINISHED_END);
  assert.equal(c4.finishedRecovery(finished), LOOP + FINISHED_END);
  assert.equal(c5.challengeRecovery("event-frequency", stopped, null), LOOP + STOPPED_END);
  assert.equal(c6.challengeRecovery(finished), LOOP + FINISHED_END);
  // Without a coaching line, a finished run still shows the server's own feedback.
  assert.equal(c3.finishedRecovery("filter-disagreement", {status:"ok", pass:false, feedback:"Keep only T-C."}), "Keep only T-C.");
});

test("C5 treats a fraction such as 107//1000 as one number, so the server's message shows", () => {
  const fraction = {status:"ok", pass:false, value_repr:"107//1000", feedback:"You divided by all 1,000 rounds, but counted the wrong rounds."};
  const shown = c5.challengeRecovery("event-frequency", fraction, null);
  assert.doesNotMatch(shown, /this step needs one number/);
  assert.ok(shown.startsWith("You divided by all 1,000 rounds, but counted the wrong rounds."), shown);
  assert.ok(c5.challengeRecovery("event-frequency", Object.assign({}, fraction, {value_repr:"0.107"}), null).startsWith("You divided by all 1,000 rounds"));
  const text = {status:"ok", pass:false, value_repr:"\"0.113\""};
  assert.match(c5.challengeRecovery("event-frequency", text, null), /this step needs one number/);
});

test("C5 shows true or false the way Julia prints a Bool vector: 0 and 1", () => {
  const mask = {kind:"boolean-vector", length:1000, true_count:113, preview:[false, false, true, true]};
  assert.equal(c5.splitJuliaReturned(c5.juliaReturnedText(mask)).returned, "Bool[0, 0, 1, 1, …]");
  const pair = {kind:"event-frequency", length:1000, matching:113, trials:1000, frequency:0.113, preview:[true, false]};
  assert.match(c5.juliaReturnedText(pair), /^\(events = Bool\[1, 0, …\], frequency = 0\.113\)/);
});

test("C3 and C2 put the next button beside Run", () => {
  const html = read("chapter3.html");
  assert.match(html, /<div class="controls"><button id="run" class="run" type="button" disabled>Run this step →<\/button><button id="next-move" class="quiet next" type="button" hidden>/);
  assert.match(read("chapter2.html"), /<button id="run"[^>]*>Run this step →<\/button><button id="next-move"/);
});

test("C3 phone table: the lined-up table wraps its columns instead of hiding them", () => {
  const css = read("chapter3.css");
  assert.match(css, /@media \(max-width:\s*520px\)\s*\{ \.table-wrap table \{ font-size: \.8rem; \} \.table-wrap th, \.table-wrap td \{[^}]*overflow-wrap: break-word/);
  // A long column name may break after an underscore (a <wbr>), and nowhere else.
  assert.match(read("chapter3.js"), /th\.append\(document\.createElement\("wbr"\)\)/);
});

test("C2 solved on an earlier visit: the Chapter 3 button shows and the rack note is truthful", () => {
  assert.equal(c2.solvedNextDestination({accepted:{group:"g", counts:"c", rates:"r"}}), "chapter3");
  assert.equal(c2.solvedNextDestination({accepted:{group:"g", counts:"c"}}), null);
  assert.equal(c2.solvedNextDestination(null), null);
  const js = read("chapter2.js");
  assert.doesNotMatch(js, /has not checked it today/);
  assert.match(js, /Saved on this computer\. Run the last step again to check it now\./);
});

test("C3 and C6: the saved-work notes do not say 'today' about work just checked", () => {
  for (const file of ["chapter3.html", "chapter3.js"]) assert.doesNotMatch(read(file), /check it today/, file);
});

test("C6 solved on an earlier visit: the ending link is on the page without a new run", () => {
  const html = read("chapter6.html");
  assert.match(html, /<a id="solved-ending" class="ending-link" href="course\/ending\.html" hidden>See how the case ends →<\/a>/);
  // Round 7 (r7-bugs #2): the link beside Run stays after a run too.
  assert.match(read("chapter6.js"), /el\.solvedEnding\.hidden = !endingUrl;/);
});

test("C2 'Start a new empty attempt' is a quiet secondary button", () => {
  assert.match(read("chapter2.html"), /<button id="new-attempt" class="quiet" type="button">Start a new empty attempt<\/button>/);
  assert.match(read("chapter2.css"), /\.attempt #new-attempt \{[^}]*background:transparent/);
});

test("C4 wording: one full-answer label, one 'Not yet', no 'empty editor' once it holds code", () => {
  const js = read("chapter4.js");
  assert.doesNotMatch(js, /Complete runnable answer, reference only/);
  assert.match(js, /Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns\. It does not count as a saved answer until Julia checks it\./);
  assert.doesNotMatch(c4.draftStatus({status:"ok", pass:false}), /Not yet/);
  assert.doesNotMatch(c4.draftStatus({status:"error", pass:false}), /Not yet/);
  assert.doesNotMatch(read("chapter4.html"), /This empty editor/);
});

test("C3, C4 and C5 solved on an earlier run: the next-chapter button shows without a new run", () => {
  assert.match(read("chapter3.js"), /function showSolvedNext\(\) \{\s*if \(!el\.nextMove \|\| !acceptedMoveKeys\(courseState, storage, attempt\)\.includes\("C3\/filter-disagreement"\)\) return;/);
  assert.match(read("chapter4.js"), /el\.next\.hidden = !savedMove\(courseState, storage, attempt, CHAPTER, MOVE\);/);
  assert.match(read("chapter5.js"), /function showSolvedNext\(\) \{ if \(!acceptedMoveKeys\(course, storage, attempt\)\.includes\("C5\/event-frequency"\)\) return;/);
});

test("C5 names box and C6 accepted line read as plain sentences", () => {
  assert.doesNotMatch(read("chapter5.html"), /whatever you called it there, is not kept/);
  assert.match(read("chapter5.html"), /Each run starts fresh, so the list of true-or-false values from Step 1 is gone, whatever you called it there\. Make it again on the first line/);
  for (const file of ["chapter5.js", "chapter6.js"]) {
    assert.match(read(file), /Julia checked this code just now and accepted it\. You can change it and run again\./, file);
  }
});

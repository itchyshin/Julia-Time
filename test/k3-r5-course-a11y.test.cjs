"use strict";
// Round-5 fixes (K3, 2026-09-27): the intro announces each scene and never drops focus; the C1
// practice box honours Ctrl/Cmd+Enter and Run buttons keep focus while Julia runs; phone tap
// targets; the progress banner sits after the skip link; round-5 wording.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const intro = require("../web/course/intro.js");
const mystery = require("../web/mystery.js");
const ending = require("../web/course/ending.js");
const endingScript = require("../web/course/ending-script.js");
const client = require("../web/course/course-client.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

// ---- Fix 1: intro ----
test("intro: a polite live line says which scene is showing", () => {
  const html = read("web/course/intro.html");
  assert.match(html, /<p id="intro-progress" class="sr-only" aria-live="polite"><\/p>/);
  assert.equal(intro.sceneAnnouncement(2, 5, "Batch B09"), "Scene 2 of 5: Batch B09");
  assert.match(read("web/course/intro.js"), /text\(\$\("intro-progress"\), sceneAnnouncement\(/);
});

test("intro: focus moves off a control that hides or disables itself", () => {
  assert.equal(intro.focusHandoff("intro-next", 4, 5), "intro-start", "Next hides on the last scene");
  assert.equal(intro.focusHandoff("intro-back", 0, 5), "intro-next", "Back is disabled on scene 1");
  assert.equal(intro.focusHandoff("intro-next", 2, 5), null);
  assert.equal(intro.focusHandoff("intro-back", 3, 5), null);
  assert.equal(intro.focusHandoff("intro-skip", 4, 5), null);
});

// ---- Fix 2: C1 run buttons and the practice box ----
test("C1: a focused Run button stays focusable while Julia runs, and says it is busy", () => {
  assert.deepEqual(mystery.runButtonState(false, false, true), {disabled:false, ariaDisabled:false});
  assert.deepEqual(mystery.runButtonState(true, true, true), {disabled:false, ariaDisabled:true}, "busy and focused");
  assert.deepEqual(mystery.runButtonState(true, true, false), {disabled:true, ariaDisabled:true}, "busy, not focused");
  assert.deepEqual(mystery.runButtonState(true, false, true), {disabled:true, ariaDisabled:true}, "offline");
});

test("C1 practice: Ctrl/Cmd+Enter runs it, and its result can take focus", () => {
  const src = read("web/mystery.js");
  assert.match(src, /\$\("practice-code"\)\.addEventListener\("keydown", event => \{ if \(\(event\.metaKey \|\| event\.ctrlKey\) && event\.key === "Enter"\) \{ event\.preventDefault\(\); runPractice\(\); \} \}\)/);
  assert.match(src, /\$\("practice-run"\)\.addEventListener\("click", runPractice\)/);
  assert.match(read("web/index.html"), /<div id="practice-output" aria-live="polite" tabindex="-1"><\/div>/);
  assert.match(src, /focusPracticeResult\(\)/);
});

// ---- Fix 3: phone tap targets and the C1 result table ----
test("C1: the main link and every summary have a finger-sized touch area", () => {
  const css = read("web/mystery.css");
  assert.match(css, /\.start-link \{[^}]*min-height: 44px/);
  assert.match(css, /summary \{[^}]*min-height: 44px/);
  assert.match(read("web/course/course.css"), /summary \{[^}]*min-height:44px/);
});

test("C1: the returned table scrolls inside its own box", () => {
  assert.match(read("web/mystery.js"), /wrap\.className = "table-wrap returned-table-wrap"/);
  assert.match(read("web/mystery.css"), /\.returned-table-wrap \{[^}]*overflow-x: auto/);
});

// ---- Fix 4: banner order and summary focus ring ----
test("progress banner: goes after the skip link, so the skip link is the first Tab stop", () => {
  const src = read("web/course/progress-banner.js");
  assert.match(src, /const skip = document\.querySelector\("body > \.skip, body > \.skip-link"\)/);
  assert.match(src, /if \(skip\) skip\.after\(bar\); else document\.body\.prepend\(bar\)/);
});

test("course pages: summary gets the same focus ring as links and buttons", () => {
  assert.match(read("web/course/course.css"), /a:focus-visible, button:focus-visible, summary:focus-visible \{ outline:4px solid var\(--orange\)/);
});

// ---- Fix 5: wording ----
test("ending finale: the report's 0 is a digit from the server, like the scene title", () => {
  assert.match(endingScript.final.answer, /The report's \{logged\} was a blank box/);
  const facts = {batch_id:"B09", n_jars:6, n_detected:5, disagreement:{tray_id:"T-C", notebook_detected:1, sheet_detected:0, entry_status:"left blank"},
    eligible_jars:["J-091"], recheck_size:3, observed_count:5, n_per_simulation:6, models:[]};
  assert.match(ending.buildFinal(facts, endingScript, {}, [], "").answer, /The report's 0 was a blank box/);
});

test("Case Board C2 and the banner use plain words", () => {
  assert.match(read("web/course/course-client.js"), /"Ready: count the jars with springtails on each tray"/);
  const banner = read("web/course/progress-banner.js");
  assert.match(banner, /": not solved yet\. It counts once Julia checks your answer\."/);
  assert.doesNotMatch(banner, /accepts your answer and it is saved/);
});

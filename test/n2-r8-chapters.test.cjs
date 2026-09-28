// Round 8 fixes (N2, 2026-09-28) for Chapters 2 to 6. Reports: night/r8-audit.md #1, #3-#5, #7,
// #8 and night/r8-rc.md #3, #4, #6, #7.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", "web", file), "utf8");
const c5 = require("../web/chapter5.js");

const LABEL = "Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns. It does not count as a saved answer until Julia checks it.";

test("C5: an accepted run shows Julia, case and limit as separate paragraphs without labels (r8-audit #1)", () => {
  assert.deepEqual(c5.explanationText({julia: "J.", case: "C.", limit: "L."}), ["J.", "C.", "L."]);
  assert.deepEqual(c5.explanationText({julia: "J.", case: "C.", limit: ""}), ["J.", "C."]);
  assert.deepEqual(c5.explanationText({julia: "J.", case: "Not yet.", limit: "L."}, false), ["J."]);
  assert.doesNotMatch(read("chapter5.js"), /`(Julia|Case|Limit): \$\{/);
});

test("C6: no 'Julia: Case: Limit:' paragraph, and the limit sentence shows once (r8-audit #1)", () => {
  const js = read("chapter6.js");
  assert.doesNotMatch(js, /`Julia: \$\{/);
  assert.doesNotMatch(js, /Case: \$\{text/);
  const c6 = require("../web/chapter6.js");
  assert.equal(c6.resultLimitText("Fitting is not proof: two stories still fit. And one jar fewer on the newest tray is too few to show a trend."),
    "And one jar fewer on the newest tray is too few to show a trend.");
  assert.equal(c6.resultLimitText("Another limit."), "Another limit.");
});

test("C5 step 2: coaching names one number, not a labelled pair (r8-audit #3, #4)", () => {
  const js = read("chapter5.js");
  assert.doesNotMatch(js, /older labelled pair \(events=/);
  assert.doesNotMatch(js, /generic construction/);
  assert.doesNotMatch(js, /the returned pair needs both/);
  assert.equal(c5.recoveryLead("event-frequency", {status: "ok", pass: false, value_repr: "Bool[0, 1]"}),
    "Julia returned a result, but this step needs one number: the rounds that matched, divided by all rounds.");
  assert.match(js, /"Yes\. That is the order\. In your editor, use the case names above;/);
  assert.match(js, /"Not yet\. The share needs the events first: make events on the first line, then divide\./);
});

test("C2 to C6: one full-answer label that does not contradict itself (r8-audit #5)", () => {
  for (const file of ["chapter2.js", "chapter3.js", "chapter4.js", "chapter5.js", "chapter6.js"]) {
    const js = read(file);
    assert.ok(js.includes(LABEL), file);
    assert.doesNotMatch(js, /It does not enter your editor/, file);
  }
});

test("C5: round counts have a thousands comma (r8-audit #8)", () => {
  const js = read("chapter5.js");
  assert.doesNotMatch(js, /\$\{(state\.)?metadata\.n_trials\}/);
  assert.equal(c5.evidenceNotes({observed_count: 5, n_trials: 1000}, "event-frequency").distribution.includes("all 1,000 rounds"), true);
});

test("C2 and C3: button names match the buttons (r8 #5)", () => {
  assert.doesNotMatch(read("chapter2.js") + read("chapter2.html"), /Run Julia check/);
  assert.match(read("chapter2.js"), /Each Run this step starts fresh|Each run starts fresh/);
  assert.match(read("chapter3.html"), /id="run-demo" class="run" type="button" disabled>Run this practice</);
  assert.doesNotMatch(read("chapter3.js") + read("chapter3.html"), /Run demonstration|run this demonstration/);
});

test("C6: the optional page is called the speed lab (r8-audit #7)", () => {
  const js = read("chapter6.js");
  assert.doesNotMatch(js, /comparison laboratory/);
  assert.match(js, /"Optional: open the speed lab →"/);
});

test("C5: coaching has no literal backticks (r8-rc #4)", () => {
  const lead = c5.recoveryLead("event-frequency", {status: "error", message: "UndefVarError: `events` not defined"});
  assert.ok(lead.length > 0);
  assert.doesNotMatch(lead, /`/);
});

test("C4, C5, C6: a solved chapter's story scene also offers the way forward (r8-rc #3)", () => {
  assert.match(read("chapter4.html"), /<button id="scene-next" class="quiet next" type="button" hidden>Chapter 5: what would plain chance give\? →<\/button>/);
  assert.match(read("chapter5.html"), /<button id="scene-next" class="quiet next" type="button" hidden>Next: three stories →<\/button>/);
  assert.match(read("chapter6.html"), /<a id="scene-ending" class="ending-link" href="course\/ending\.html" hidden>See how the case ends →<\/a>/);
  assert.match(read("chapter4.js"), /el\.sceneNext\.hidden = !savedMove\(courseState, storage, attempt, CHAPTER, MOVE\)/);
  assert.match(read("chapter5.js"), /el\.sceneNext\.hidden\s*=\s*!acceptedMoveKeys\(course, storage, attempt\)\.includes\("C5\/event-frequency"\)/);
  assert.match(read("chapter6.js"), /el\.sceneEnding\.hidden = !endingUrl;/);
});

test("C5 and C6: the result box has inner padding so text clears the focus ring (r8-rc #7)", () => {
  assert.match(read("chapter5.css"), /\.result\{margin-top:18px;padding:[^}]+\}/);
});

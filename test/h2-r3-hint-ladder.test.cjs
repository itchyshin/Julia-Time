"use strict";
// Round 3 (H2, 2026-09-27): one hint-ladder layout in Chapters 2 to 6, the same spec as Chapter 1.
// One "Stuck? Hints" section below the editor; opening it shows the ladder button at once (no inner
// fold); the ladder reads Show the idea, Show the code shape, Show the whole line, then "All help
// shown" (disabled); exactly one "Show the full answer" button, after the ladder button, hidden once
// the answer is out. Plus the other r3 fixes in these chapters.
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

const LADDER = ["Show the idea", "Show the code shape", "Show the whole line"];
const PAGES = {
  2: {list:"hints", next:"show-hint", answer:"show-answer"},
  3: {list:"help-list", next:"next-help", answer:"show-answer"},
  4: {list:"help-list", next:"next-help", answer:"show-answer"},
  5: {list:"hint", next:"next-hint", answer:"show-full-answer"},
  6: {list:"hint", next:"next-hint", answer:"show-full-answer"}
};

for (const [n, ids] of Object.entries(PAGES)) {
  test(`C${n}: one Stuck? Hints section below the editor, ladder first, one full-answer button after it`, () => {
    const html = read(`chapter${n}.html`);
    assert.equal((html.match(/<details class="jt-help">/g) || []).length, 1, "one hint section");
    assert.equal((html.match(/<summary>Stuck\? Hints/g) || []).length, 1, "one Stuck? Hints label");
    const help = html.indexOf('<details class="jt-help">');
    assert.ok(html.indexOf('id="code"') < help, "the hints sit below the editor");
    assert.doesNotMatch(html, /Help me start/, "no inner fold to open first");
    assert.doesNotMatch(html, /<details class="help">/, "the ladder is not inside a second fold");
    assert.doesNotMatch(html, /Need the full answer\?/, "no answer box above the hints");
    // The ladder is the first thing inside the section.
    const summaryEnd = html.indexOf("</summary>", help) + "</summary>".length;
    assert.ok(/^\s*<div class="help hint-ladder">/.test(html.slice(summaryEnd)), "the ladder opens with the section");
    const list = html.indexOf(`id="${ids.list}"`), next = html.indexOf(`id="${ids.next}"`), answer = html.indexOf(`id="${ids.answer}"`);
    assert.ok(help < list && list < next && next < answer, "hint list, then the ladder button, then the full-answer button");
    assert.match(html.slice(next, next + 120), />Show the idea</);
    assert.equal((html.match(/Show the full answer/g) || []).length, 1, "exactly one full-answer button");
    assert.match(html.slice(answer, answer + 120), />Show the full answer</);
    // No fold inside the section carries a ladder button's name.
    const section = html.slice(help);
    for (const label of LADDER) assert.doesNotMatch(section, new RegExp(`<summary>${label}`), `no fold named ${label}`);
    // A code shape keeps its line breaks.
    assert.match(read(`chapter${n}.css`), /\.hint-ladder p\{white-space:pre-line\}/);
  });
}

test("the ladder labels are the same in every chapter, and the last level is not clickable", () => {
  // C2's steps have an idea and a code shape, then (r4, 2026-09-27) the whole line, shown above the editor.
  assert.deepEqual([0, 1, 2, 3].map(i => c2.hintButtonLabel(i, 3)), ["Show the idea", "Show the code shape", "Show the whole line", "All help shown"]);
  for (const step of ["group", "counts", "rates"]) { assert.equal(c2.allHints(step).length, 2, step); assert.equal(c2.ladderTotal(step), 3, step); }
  // C3, C4 and C5: the button a stage leaves behind, level by level.
  const levels = (stages) => [...new Set(stages.map(stage => stage.button))];
  for (const move of ["join-report-log", "filter-disagreement"]) {
    const stages = []; for (let i = 0; c3.helpStage(move, i); i++) stages.push(c3.helpStage(move, i));
    assert.deepEqual(levels(stages), ["Show the code shape", "Show the whole line", "All help shown"], move);
    assert.equal(stages[stages.length - 1].label, "Full answer");
  }
  const c4Stages = [0, 1, 2].map(i => c4.helpStage("plan-distinct-recheck", i));
  assert.deepEqual(c4Stages.map(stage => stage.button), ["Show the code shape", "Show the whole line", "All help shown"]);
  assert.equal(c4.helpStage("plan-distinct-recheck", 3), null);
  for (const move of ["event-mask", "event-frequency"]) {
    const stages = [0, 1, 2].map(i => c5.helpStage(move, i));
    assert.deepEqual(stages.map(stage => stage.button), ["Show the code shape", "Show the whole line", "All help shown"], move);
  }
  assert.deepEqual([0, 1, 2, 3].map(c6.hintButtonLabel), [...LADDER, "All help shown"]);
  assert.equal(c6.HINT_LEVELS, 3);
});

test("C3 'Show the whole line' shows the line on its first click", () => {
  assert.doesNotMatch(read("chapter3.js"), /Before the full answer|Show complete code now/);
  assert.equal(c3.helpStage("join-report-log", 2).label, "Full answer");
  // The step 2 row-rule pieces open together with the code shape.
  assert.equal(c3.helpLevelEnd("filter-disagreement", 1), 3);
});

test("each chapter disables the ladder at All help shown and hides the full-answer button once it is out", () => {
  const c2js = read("chapter2.js");
  // r4 (2026-09-27): the whole line is C2's last rung, so the ladder and the answer button end together.
  assert.match(c2js, /const done=hints >= total;\s*el\.hint\.textContent=hintButtonLabel\(hints, total\); el\.hint\.disabled=done;/);
  assert.match(c2js, /el\.answer\.hidden=done;/);
  assert.match(c2js, /el\.answer\.textContent = "Show the full answer"; el\.answer\.hidden = false;/);
  assert.doesNotMatch(c2js, /Show the complete answer|Complete answer shown/);
  const c3js = read("chapter3.js");
  assert.match(c3js, /if \(el\.nextHelp\) el\.nextHelp\.disabled = done;\s*if \(el\.showAnswer\) el\.showAnswer\.hidden = done;/);
  assert.match(read("chapter4.js"), /const done = !helpStage\(MOVE, hint\); el\.nextHelp\.disabled = done; el\.showAnswer\.hidden = done;/);
  assert.match(read("chapter5.js"), /el\.nextHint\.disabled=hint >= stages\.length;if\(el\.showFullAnswer\)el\.showFullAnswer\.hidden=hint >= stages\.length;/);
  assert.match(read("chapter6.js"), /el\.nextHint\.disabled = hint >= HINT_LEVELS;\s*if \(el\.showFullAnswer\) el\.showFullAnswer\.hidden = hint >= HINT_LEVELS;/);
});

test("C6 code shape keeps its three lines in the hint list", () => {
  const shape = c6.visibleHints(2).find(line => line.startsWith("Code shape:"));
  assert.equal(shape.split("\n").length, 3);
  // The row rule and row selection lines open with the code shape, before the whole line.
  assert.ok(c6.visibleHints(2).some(line => line.startsWith("Build the row rule:")));
  assert.ok(c6.visibleHints(2).some(line => line.startsWith("Select rows:")));
  assert.ok(!c6.visibleHints(2).some(line => line.includes(c6.COPY.solution)));
});

test("C2 hint drawer follows the step; the arranged lines say they are the full answer", () => {
  const html = read("chapter2.html");
  assert.match(html, /<section class="tangible-practice" data-step-help="group"/, "the grouping rehearsal is step 1 help");
  assert.match(html, /id="groupby-worked-example" class="worked-example" data-step-help="group"/, "the groupby example is step 1 help");
  assert.match(read("chapter2.js"), /node\.hidden = node\.dataset\.stepHelp !== step/);
  const scaffold = html.slice(html.indexOf('id="composition-scaffold"'));
  assert.match(scaffold, /<summary>Optional: the full answer in pieces/);
  assert.match(scaffold, /These pieces are the full answer for this step/);
  assert.ok(html.indexOf('id="composition-scaffold"') > html.indexOf('id="show-answer"'), "the pieces come after the hints");
  // combine is a name the player can type, with a meaning and no finished line.
  const names = html.match(/<section id="named-inputs"[\s\S]*?<\/section>/)[0];
  assert.match(names, /<dt><code>combine<\/code><\/dt><dd>Makes one summary row for each group\.<\/dd>/);
  assert.doesNotMatch(names, /combine\(/);
});

test("C2 success shows the limit line; a failed run gets no generic case line", () => {
  const src = read("chapter2.js");
  assert.match(src, /const limit=result\.status === "ok" && result\.pass === true && result\.explanation && result\.explanation\.limit;/);
  const failed = c2.resultText({status:"ok", pass:false, feedback:"Not yet.", explanation:{julia:"Return the requested result for this step.", case:"Match all B09 trays to see what this step finds."}});
  assert.doesNotMatch(failed, /Match all B09 trays/);
  const passed = c2.resultText({status:"ok", pass:true, feedback:"", explanation:{julia:"Your table is right.", case:"So where did the 0 come from?", limit:"T-C, the newest check, is down by one jar."}});
  assert.match(passed, /So where did the 0 come from\?/);
});

test("C3: a neutral table caption, and the blank note sits below the R and Python card", () => {
  assert.equal(c3.tableIdentity("tray_counts").title, "The notebook's counts for each tray");
  const html = read("chapter3.html");
  assert.ok(html.indexOf('id="blank-note"') > html.indexOf('id="bridge-card"'), "the note is below the card that says see below");
  assert.match(read("chapter3.js"), /const accepted = message\.status === "ok" && message\.pass === true;\s*\[explanation\.julia, accepted \? explanation\.case : ""/);
});

test("C4 no longer claims round(...) was seen before; failed runs drop the generic case and limit lines", () => {
  const note = c4.lessonCopy("plan-distinct-recheck").semicolonNote;
  assert.doesNotMatch(note, /seen this shape before/i);
  assert.match(note, /For example, round\(3\.14159; digits=2\) gives 3\.14\./);
  assert.match(read("chapter4.js"), /message\.status === "ok" && message\.pass === true \? \[message\.explanation\.julia, message\.explanation\.case, message\.explanation\.limit, message\.explanation\.reminder\] : \[message\.explanation\.julia, message\.explanation\.reminder\]/);
});

test("C5 and C6: a failed run shows only the Julia line of the explanation", () => {
  const c5js = read("chapter5.js");
  assert.match(c5js, /explanationText\(message\.explanation,message\.status === "ok" && message\.pass === true\)/);
  assert.deepEqual(c5.explanationText({julia:"J.", case:"Not yet.", limit:"A failed run says nothing."}, false), ["J."]);
  // Round 8 (r8-audit #1): one unlabelled paragraph per line, as in C1-C4.
  assert.match(read("chapter6.js"), /\(accepted \? \[message\.explanation\.julia, message\.explanation\.case, resultLimitText\(message\.explanation\.limit\)\] : \[message\.explanation\.julia\]\)/);
});

test("C6 status before a run does not give the answer", () => {
  assert.match(read("chapter6.js"), /unknown:"Still unknown: which stories could give 5\. Fitting will not prove one; it can only rule some out\."/);
  assert.doesNotMatch(read("chapter6.js"), /unknown:"Still unknown: fitting is not proof/);
});

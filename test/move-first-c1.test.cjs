"use strict";

// move-first layout + two repairs (2026-09-25), Chapter 1 ("The Case of the Missing Fleas").
//
// Chapter 1 already kept its optional aids (the hint ladder, worked example, glossary, R/Python
// bridge) collapsed inside one `<details class="help-drawer">` placed directly after the editor's
// Run/result area — the Missing Fleas revision of 2026-09-07 did this before the shared move-first
// contract existed. This suite marks that drawer with the shared `.jt-help` class, and since 2026-09-25
// its summary uses the label every chapter shares ("Stuck? Help and practice (optional)"); the pointers
// in Chapter 1's own text name that label. Its hint ladder stays inside the same drawer as
// the other aids because helpDrawerVisible() reveals all of it together after a rejected run — unlike
// chapters whose hint ladder is a separate details left untouched beside their new jt-help block.
//
// It also pins two repairs made alongside the layout pass:
//  A. The notebook-stage choice between "Learn rows and columns first" (practice) and "I know
//     indexing — try the case" used to be a loud orange primary button over a plain outlined one,
//     visually pushing an experienced learner onto the slower path. Both are now the same button
//     style, in a `.path-choice` wrapper, each labelled with who it is for.
//  B. The evidence board staggered each card's fade-in by `index * 70`ms (`animation: pin .55s both`
//     is fill-mode `both`, so an unstarted or mid-flight card sits at partial opacity). A screenshot
//     or a fast glance during that up-to-900ms window catches a later card faded while earlier ones
//     are already solid — exactly what two playtesters saw on J-094, the 4th of 6 cards. Every card
//     now animates from the same moment, so the whole board reaches full opacity together.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "web", "index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "web", "mystery.js"), "utf8");
const css = fs.readFileSync(path.join(root, "web", "mystery.css"), "utf8");

test("C1 has a single closed jt-help details, marked for the shared contract", () => {
  assert.match(html, /<details class="help-drawer jt-help">/, "the jt-help details exists");
  assert.doesNotMatch(html, /<details class="help-drawer jt-help"[^>]*\bopen\b/, "closed by default");
  assert.equal((html.match(/\bjt-help\b/g) || []).length, 1, "exactly one jt-help block on the page");
});

test("C1's jt-help comes after #code, and after the Run/result area, in the document", () => {
  const editor = html.indexOf('<textarea id="code"');
  const runButton = html.indexOf('id="run"');
  const resultArea = html.indexOf('id="result-area"');
  const jtHelp = html.indexOf('class="help-drawer jt-help"');
  assert.ok(editor > -1 && runButton > -1 && resultArea > -1 && jtHelp > -1);
  assert.ok(jtHelp > editor && jtHelp > runButton && jtHelp > resultArea);
});

test("C1's jt-help contains all the optional aids for this move, in their existing order", () => {
  const jtHelpStart = html.indexOf('<details class="help-drawer jt-help">');
  const jtHelpEnd = html.indexOf("</details>", jtHelpStart) === -1 ? html.length : html.lastIndexOf("</aside></details>") + "</aside></details>".length;
  const inside = html.slice(jtHelpStart, jtHelpEnd);
  assert.match(inside, /id="hint-list"/, "the hint ladder is inside (kept with the aids it gates, see file header)");
  assert.match(inside, /id="worked-example"/, "the worked example moved/stayed in");
  assert.match(inside, /id="glossary"/, "the glossary is in");
  const hintIndex = inside.indexOf('id="hint-list"');
  const workedIndex = inside.indexOf('id="worked-example"');
  const glossaryIndex = inside.indexOf('id="glossary"');
  assert.ok(hintIndex < workedIndex && workedIndex < glossaryIndex, "aids keep their existing relative order");
});

// 2026-09-25: the generic pre-run "Coming from R or Python?" bridge (id="bridge-r"/"bridge-python",
// inside this same jt-help drawer) is gone. Chapter 1 now has exactly one R/Python comparison place:
// the "The same move in R and Python" card in #evidence-board, built by web/course/bridges.js, which
// shows the learner's own accepted code only after Julia accepts the move — never a generic example,
// and never inside the pre-answer help drawer.
test("C1's old pre-run R/Python bridge is gone; one post-acceptance bridge card lives in #evidence-board instead", () => {
  assert.doesNotMatch(html, /id="bridge-r"/);
  assert.doesNotMatch(html, /id="bridge-python"/);
  assert.doesNotMatch(html, /Coming from R or Python\?/);
  const evidenceBoardStart = html.indexOf('id="evidence-board"');
  const bridgeCardIndex = html.indexOf('id="bridge-card"');
  assert.ok(evidenceBoardStart > -1 && bridgeCardIndex > evidenceBoardStart, "the bridge card sits inside #evidence-board, after the accepted evidence");
  assert.equal((html.match(/id="bridge-card"/g) || []).length, 1, "exactly one comparison place on the page");
  const source = fs.readFileSync(path.join(root, "web", "mystery.js"), "utf8");
  assert.match(source, /bridges\.renderCard\(el\["bridge-card"\], "C1\/select-records"/);
});

test("C1 keeps the essentials visible before jt-help: goal, table, named inputs, editor", () => {
  const jtHelpStart = html.indexOf('<details class="help-drawer jt-help">');
  assert.ok(html.indexOf('id="case-goal"') < jtHelpStart, "the goal stays visible before help");
  assert.ok(html.indexOf('id="return-spec"') < jtHelpStart, "the required-return spec stays visible before help");
  assert.ok(html.indexOf('id="case-table"') < jtHelpStart, "the field-notebook table stays visible before help");
  assert.ok(html.indexOf('class="binding-note"') < jtHelpStart, "the named-inputs (jars/case_batch) card stays visible before help");
  assert.ok(html.indexOf('id="code"') < jtHelpStart, "the editor stays visible before help");
});

test("C1's summary text and hint-ladder visibility wiring are unchanged (pinned deliberately elsewhere)", () => {
  assert.match(html, /<summary>Stuck\? Hints <span>Small hints first, the full answer last\. Your editor stays as you left it\.<\/span><\/summary>/);
  assert.match(source, /\.help-drawer"\)\.hidden = !helpDrawerVisible\(stage, state\.result\)/);
});

test("A: the notebook-stage choice buttons are equal weight, side by side, each labelled for its audience", () => {
  assert.match(html, /<div class="path-choice" id="path-choice" hidden>/, "a shared wrapper replaces the two lone buttons");
  const learnMatch = html.match(/<button id="learn-indexing" class="([^"]+)">New to picking rows\? Start here →<\/button><p class="path-for">([^<]+)<\/p>/);
  const stepMatch = html.match(/<button id="step-next" class="([^"]+)">I know how to pick rows: go to the case →<\/button><p class="path-for">([^<]+)<\/p>/);
  assert.ok(learnMatch && stepMatch, "both buttons keep their existing text and ids, each with a 'who it's for' line");
  assert.equal(learnMatch[1], stepMatch[1], "both buttons share one class: equal visual weight");
  assert.notEqual(learnMatch[1], "run-button", "no longer the loud primary style");
  assert.notEqual(stepMatch[1], "quiet-button", "no longer styled as the lesser secondary");
  assert.equal(learnMatch[2], "New to indexing");
  assert.equal(stepMatch[2], "Already know indexing");
  // Neither path was removed.
  assert.match(html, /New to picking rows\? Start here/);
  assert.match(html, /I know how to pick rows: go to the case/);
});

test("A: the choice wrapper lays out side by side on wide screens and stacks on narrow", () => {
  assert.match(css, /\.path-choice\s*\{[^}]*display:\s*flex/, "flex layout for side-by-side buttons");
  assert.match(css, /@media \(max-width:\s*760px\)\s*\{\s*\.path-choice\s*\{[^}]*flex-direction:\s*column/, "stacked under the page's existing narrow-screen breakpoint");
  assert.doesNotMatch(css, /#learn-indexing\s*\{/, "the old per-id display:block rule is gone");
  assert.doesNotMatch(css, /#step-next\s*\{/, "the old per-id display:block rule is gone");
});

test("A: showStage toggles the shared wrapper, not each button separately", () => {
  assert.match(source, /\$\("path-choice"\)\.hidden = stage !== "notebook"/);
  assert.doesNotMatch(source, /\$\("learn-indexing"\)\.hidden/);
  assert.doesNotMatch(source, /\$\("step-next"\)\.hidden/);
});

test("B: evidence cards no longer stagger their fade-in, so every card reaches full opacity together", () => {
  assert.doesNotMatch(source, /animationDelay/, "root cause removed: no per-card animation-delay stagger");
  // The fade-in itself, and its reduced-motion override, remain.
  assert.match(css, /\.evidence-arrived \.evidence-card\{animation:pin \.55s both\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\*,\*:before,\*:after\{animation-duration:\.01ms!important/);
});

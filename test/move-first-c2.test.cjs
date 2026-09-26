"use strict";

// move-first layout (2026-09-25): Chapter 2 (three moves: group, counts, rates) had every optional
// teaching aid sitting above the editor, so learners scrolled past several optional blocks on every
// move. This test pins the new contract: one collapsed `.jt-help` details after the editor's
// Run/result area holds all the optional aids for the move, closed by default.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "web", "chapter2.html"), "utf8");

test("C2 has a single closed jt-help details with the exact summary text", () => {
  assert.match(html, /<details class="jt-help">/, "the jt-help details exists");
  assert.doesNotMatch(html, /<details class="jt-help"[^>]*\bopen\b/, "jt-help is closed by default");
  assert.match(html, /<details class="jt-help"><summary>Stuck\? Hints <span>Small hints first, the full answer last\. Your editor stays as you left it\.<\/span><\/summary>/, "the summary text matches exactly");
  // exactly one jt-help block on the page
  assert.equal((html.match(/class="jt-help"/g) || []).length, 1);
});

test("C2's jt-help comes after #code in the document", () => {
  const editor = html.indexOf('<textarea id="code"');
  const jtHelp = html.indexOf('class="jt-help"');
  assert.ok(editor > -1 && jtHelp > -1 && jtHelp > editor);
});

test("C2's jt-help contains the optional aids moved out of the pre-editor area", () => {
  const jtHelpStart = html.indexOf('<details class="jt-help">');
  const jtHelpEnd = html.lastIndexOf("</details>") + "</details>".length;
  const inside = html.slice(jtHelpStart, jtHelpEnd);
  assert.match(inside, /id="grouping-preview"/, "the visual grouping rehearsal moved in");
  assert.match(inside, /id="groupby-worked-example"/, "the worked example moved in");
  assert.match(inside, /class="words"/, "the glossary moved in");
  assert.match(inside, /id="composition-scaffold"/, "the arrange-the-lines rehearsal moved in");
});

// 2026-09-25: the old "Other Julia, R and Python ways" details (id="comparisons", hardcoded
// aggregate/dplyr/pandas text for the "rates" step only) is gone. C2 now has exactly one R/Python
// comparison place per accepted step: the "The same move in R and Python" card (#bridge-card),
// right after #result, shown with the learner's own accepted code only after Julia accepts group,
// counts, or rates — built from web/course/bridges.js, not duplicated per chapter.
test("C2's old 'Other Julia, R and Python ways' block is gone; one post-acceptance bridge card follows #result instead", () => {
  assert.doesNotMatch(html, /id="comparisons"/);
  assert.doesNotMatch(html, /Other Julia, R and Python ways/);
  const resultIndex = html.indexOf('id="result"');
  const bridgeCardIndex = html.indexOf('id="bridge-card"');
  const jtHelpIndex = html.indexOf('<details class="jt-help">');
  assert.ok(resultIndex > -1 && bridgeCardIndex > resultIndex && bridgeCardIndex < jtHelpIndex, "the bridge card sits directly after #result, before jt-help");
  assert.equal((html.match(/id="bridge-card"/g) || []).length, 1, "exactly one comparison place on the page");
  const source = fs.readFileSync(path.join(__dirname, "..", "web", "chapter2.js"), "utf8");
  assert.match(source, /function renderBridgeCard\(step\)/);
});

test("C2 keeps the essentials visible outside jt-help: source table, named inputs, and the reference answer", () => {
  const jtHelpStart = html.indexOf('<details class="jt-help">');
  assert.ok(html.indexOf('id="source-rows"') < jtHelpStart, "the jars table stays visible before help");
  assert.ok(html.indexOf('id="named-inputs"') < jtHelpStart, "the named-inputs card stays visible before help");
  assert.ok(html.indexOf('id="complete-answer"') < jtHelpStart, "the reference answer stays in place before help");
});

test("C2: the small hints sit first inside the help panel; the bridge card stays visible before it", () => {
  // 2026-09-25: after the editor come the accepted result, then the post-acceptance bridge card
  // (#bridge-card, see the test above), then the shared help panel with small hints first inside it.
  const editor = html.indexOf('id="code"');
  const jtHelp = html.indexOf('<details class="jt-help">');
  const hintLadder = html.indexOf('<details class="help">');
  const summaryEnd = html.indexOf('</summary>', jtHelp) + '</summary>'.length;
  assert.ok(editor > -1 && jtHelp > editor, "the help panel sits after the editor");
  assert.equal(hintLadder, summaryEnd, "the small hints are the first thing inside the help panel");
});

"use strict";

// move-first layout (2026-09-25): Chapter 3 (two moves: join-report-log, filter-disagreement) had
// its worked example (demo-panel) sitting above the editor and its R/Python comparisons below the
// hint ladder, so learners scrolled past optional blocks on every move. This test pins the new
// contract: one collapsed `.jt-help` details after the editor's Run/result area holds all the
// optional aids for the move, closed by default.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "web", "chapter3.html"), "utf8");

test("C3 has a single closed jt-help details with the exact summary text", () => {
  assert.match(html, /<details class="jt-help">/, "the jt-help details exists");
  assert.doesNotMatch(html, /<details class="jt-help"[^>]*\bopen\b/, "jt-help is closed by default");
  assert.match(html, /<details class="jt-help"><summary>Stuck\? Hints <span>Small hints first, the full answer last\. Your editor stays as you left it\.<\/span><\/summary>/, "the summary text matches exactly");
  // exactly one jt-help block on the page (shared by both moves; JS shows/hides per-move aids)
  assert.equal((html.match(/class="jt-help"/g) || []).length, 1);
});

test("C3's jt-help comes after #code in the document", () => {
  const editor = html.indexOf('<textarea id="code"');
  const jtHelp = html.indexOf('class="jt-help"');
  assert.ok(editor > -1 && jtHelp > -1 && jtHelp > editor);
});

test("C3's jt-help contains the optional aids moved out of the pre-editor area, in their original order", () => {
  const jtHelpStart = html.indexOf('<details class="jt-help">');
  const jtHelpEnd = html.lastIndexOf("</details>") + "</details>".length;
  const inside = html.slice(jtHelpStart, jtHelpEnd);
  assert.match(inside, /id="demo-panel"/, "the worked example (practise matching two records) moved in");
});

// 2026-09-25: the old "R and Python comparisons" details (class="comparisons", placeholder
// table/left_count/right_count text keyed by move via chapter3.js's COPY.r/.python) is gone. C3 now
// has exactly one R/Python comparison place per move: the "The same move in R and Python" card
// (#bridge-card), directly after #result and before jt-help, showing the learner's own accepted
// code with real case names (report, handling_log, joined) — built from web/course/bridges.js.
test("C3's old 'R and Python comparisons' block is gone; one post-acceptance bridge card follows #result instead", () => {
  assert.doesNotMatch(html, /class="comparisons"/);
  assert.doesNotMatch(html, /R and Python comparisons/);
  const resultIndex = html.indexOf('id="result"');
  const bridgeCardIndex = html.indexOf('id="bridge-card"');
  const jtHelpIndex = html.indexOf('<details class="jt-help">');
  assert.ok(resultIndex > -1 && bridgeCardIndex > resultIndex && bridgeCardIndex < jtHelpIndex, "the bridge card sits directly after #result, before jt-help");
  assert.equal((html.match(/id="bridge-card"/g) || []).length, 1, "exactly one comparison place on the page");
  const source = fs.readFileSync(path.join(__dirname, "..", "web", "chapter3.js"), "utf8");
  assert.match(source, /bridges\.renderCard\(el\.bridgeCard, "C3\/"\+state\.result\.move_id/);
});

test("C3 keeps the essentials visible outside jt-help: the case panel, visible inputs, and the named-inputs card", () => {
  const jtHelpStart = html.indexOf('<details class="jt-help">');
  assert.ok(html.indexOf('class="case-panel"') < jtHelpStart, "the case question/goal/return stays visible before help");
  assert.ok(html.indexOf('id="visible-inputs"') < jtHelpStart, "the input tables stay visible before help");
  assert.ok(html.indexOf('id="case-bindings"') < jtHelpStart, "the real-Julia-names card stays visible before help");
});

test("C3: the small hints sit first inside the help panel; the bridge card stays visible before it", () => {
  // 2026-09-25: after the editor come the accepted result, then the post-acceptance bridge card
  // (#bridge-card, see the test above), then the shared help panel with small hints first inside it.
  const editor = html.indexOf('id="code"');
  const jtHelp = html.indexOf('<details class="jt-help">');
  const hintLadder = html.indexOf('<div class="help hint-ladder">');
  const summaryEnd = html.indexOf('</summary>', jtHelp) + '</summary>'.length;
  const answerReference = html.indexOf('id="answer-before-editor"');
  assert.ok(answerReference > -1 && answerReference < editor, "the reference-answer area stays before the editor");
  assert.ok(editor > -1 && jtHelp > editor, "the help panel sits after the editor");
  assert.equal(hintLadder, summaryEnd, "the small hints are the first thing inside the help panel");
});

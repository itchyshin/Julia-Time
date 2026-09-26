"use strict";

// Move-first layout guard for Chapter 4 (move: plan-distinct-recheck). Optional aids for this
// move — the practice jar rack and the R/Python comparisons — now live inside one collapsed
// <details class="jt-help"> after the editor's Run/result area, so the editor is reachable
// without scrolling past them. See docs/dev-log/ for the move-first brief this implements.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../web/chapter4.html"), "utf8");
// The jt-help details nests the comparisons details inside it, so its content ends at the last
// </details> before the editor-panel's closing </section> — not the first </details> encountered.
const jtHelpMatch = html.match(/<details class="jt-help">([\s\S]*?)<\/details>\s*<\/section>/);

test("C4 has one closed-by-default jt-help details with the exact summary text", () => {
  assert.ok(jtHelpMatch, "a <details class=\"jt-help\"> block exists");
  assert.doesNotMatch(html, /<details class="jt-help"[^>]*\bopen\b/, "jt-help is closed by default");
  assert.match(jtHelpMatch[1], /<summary>Stuck\? Hints<span>Small hints first, the full answer last\. Your editor stays as you left it\.<\/span><\/summary>/);
});

test("C4's jt-help details comes after the #code editor in the document", () => {
  const jtHelp = html.indexOf('<details class="jt-help">');
  const code = html.indexOf('id="code"');
  assert.ok(jtHelp >= 0 && code >= 0 && code < jtHelp, "jt-help appears after #code");
});

test("C4's jt-help details contains the optional practice rack, moved intact", () => {
  const block = jtHelpMatch[1];
  assert.match(block, /id="distinct-practice"/);
  assert.match(block, /id="practice-jar-rack"/);
});

// 2026-09-25: the old "R and Python comparisons" details (class="comparisons", real-named
// eligible$jar_id/random.sample text from chapter4.js's COPY.r/.python) is gone. C4 now has exactly
// one R/Python comparison place: the "The same move in R and Python" card (#bridge-card), directly
// after #result and before jt-help, shown with the learner's own accepted code only after Julia
// accepts the move — built from web/course/bridges.js.
test("C4's old 'R and Python comparisons' block is gone; one post-acceptance bridge card follows #result instead", () => {
  assert.doesNotMatch(html, /class="comparisons"/);
  assert.doesNotMatch(html, /R and Python comparisons/);
  const resultIndex = html.indexOf('id="result"');
  const bridgeCardIndex = html.indexOf('id="bridge-card"');
  const jtHelpIndex = html.indexOf('<details class="jt-help">');
  assert.ok(resultIndex > -1 && bridgeCardIndex > resultIndex && bridgeCardIndex < jtHelpIndex, "the bridge card sits directly after #result, before jt-help");
  assert.equal((html.match(/id="bridge-card"/g) || []).length, 1, "exactly one comparison place on the page");
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter4.js"), "utf8");
  assert.match(source, /bridges\.renderCard\(el\.bridgeCard, "C4\/"\+MOVE/);
});

test("C4's essential blocks (goal, visible inputs, real variable names) stay outside jt-help, above the editor", () => {
  const jtHelp = html.indexOf('<details class="jt-help">');
  const casePanel = html.indexOf('class="case-panel"');
  const visibleInputs = html.indexOf('id="visible-inputs"');
  const caseBindings = html.indexOf('id="case-bindings"');
  const code = html.indexOf('id="code"');
  assert.ok(casePanel >= 0 && casePanel < jtHelp, "case-panel precedes jt-help");
  assert.ok(visibleInputs >= 0 && visibleInputs < code, "visible-inputs precedes the editor");
  assert.ok(caseBindings >= 0 && caseBindings < code, "case-bindings precedes the editor");
});

test("C4: the small hints sit first inside the help panel; the bridge card stays visible before it", () => {
  // 2026-09-25: after the editor come the accepted result, then the post-acceptance bridge card
  // (#bridge-card, see the test above), then the shared help panel with small hints first inside it.
  const editor = html.indexOf('id="code"');
  const jtHelp = html.indexOf('<details class="jt-help">');
  const hintLadder = html.indexOf('<details class="help">');
  const summaryEnd = html.indexOf('</summary>', jtHelp) + '</summary>'.length;
  const answerBeforeEditor = html.indexOf('id="answer-before-editor"');
  assert.ok(answerBeforeEditor >= 0 && answerBeforeEditor < editor, "answer-before-editor stays before the editor");
  assert.ok(editor > -1 && jtHelp > editor, "the help panel sits after the editor");
  assert.equal(hintLadder, summaryEnd, "the small hints are the first thing inside the help panel");
});

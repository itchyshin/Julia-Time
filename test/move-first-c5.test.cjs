"use strict";

// move-first (2026-09-25): C5 was the busiest page before its editor (students called it the
// busiest screen). This asserts the one contract every chapter now follows: all optional aids for
// a move sit inside one collapsed <details class="jt-help"> placed right after the editor's
// Run/result area, so a learner never has to scroll past practice content to reach the essentials.
// See /private/tmp/claude-503/move-first-brief.md.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../web/chapter5.html"), "utf8");

function jtHelpBlock(source) {
  const start = source.indexOf('<details class="jt-help">');
  assert.ok(start >= 0, "a single .jt-help details exists");
  // Find the matching close: jt-help nests other <details>, so walk depth rather than
  // grabbing the first </details>.
  let depth = 0, i = start;
  const closeTag = "</details>";
  while (i < source.length) {
    const nextOpen = source.indexOf("<details", i + 1);
    const nextClose = source.indexOf(closeTag, i);
    if (nextClose === -1) throw new Error("unterminated <details>");
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; i = nextOpen + 1; }
    else { if (depth === 0) return { start, end: nextClose + closeTag.length }; depth--; i = nextClose + 1; }
  }
  throw new Error("unterminated <details>");
}

test("C5 has exactly one closed .jt-help details, after #code, holding the optional aids", () => {
  const matches = html.match(/<details class="jt-help">/g) || [];
  assert.equal(matches.length, 1, "exactly one .jt-help details on the page");
  assert.doesNotMatch(html, /<details class="jt-help"\s+open/, "closed by default");

  const { start, end } = jtHelpBlock(html);
  const block = html.slice(start, end);
  assert.match(block, /<summary>Stuck\? Hints <span>Small hints first, the full answer last\. Your editor stays as you left it\.<\/span><\/summary>/, "exact summary text");

  const codeIndex = html.indexOf('id="code"');
  assert.ok(codeIndex >= 0 && codeIndex < start, ".jt-help comes after #code in the document");

  // The optional aids moved for C5's two moves (event-mask, event-frequency) all live inside it.
  for (const id of ["model-recipe", "practice-event", "cards", "frequency-composition"]) {
    assert.ok(block.includes(`id="${id}"`), `#${id} is inside .jt-help`);
  }

  // Essentials stay visible, outside .jt-help and before #code: the case goal, the simulated
  // counts table (with its own compact "show more"), and the compact case-status banner.
  const simDataIndex = html.indexOf('id="simulation-data"');
  const caseStatusIndex = html.indexOf('id="case-status"');
  assert.ok(simDataIndex >= 0 && simDataIndex < codeIndex, "#simulation-data stays visible before the editor");
  assert.ok(caseStatusIndex >= 0 && caseStatusIndex < codeIndex, "#case-status stays visible before the editor");
  assert.ok(simDataIndex < start && caseStatusIndex < start, "essentials are not inside .jt-help");

  // #answer-before-editor is explicitly left in place (before the textarea), not moved into help.
  const answerIndex = html.indexOf('id="answer-before-editor"');
  assert.ok(answerIndex >= 0 && answerIndex < codeIndex, "#answer-before-editor stays before #code");
  assert.ok(answerIndex < start, "#answer-before-editor is not inside .jt-help");
});

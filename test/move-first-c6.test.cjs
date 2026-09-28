"use strict";

// move-first (2026-09-25): same contract as C5 (see test/move-first-c5.test.cjs and
// /private/tmp/claude-503/move-first-brief.md): C6's one optional aid (the range-practice
// scaffold) now lives inside a single collapsed <details class="jt-help"> right after the
// editor's Run/result area, and the ending "Case closed" section stays untouched and visible.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../web/chapter6.html"), "utf8");

test("C6 has one closed .jt-help details, after #code, holding the learning scaffold", () => {
  const matches = html.match(/<details class="jt-help">/g) || [];
  assert.equal(matches.length, 1, "exactly one .jt-help details on the page");
  assert.doesNotMatch(html, /<details class="jt-help"\s+open/, "closed by default");

  const start = html.indexOf('<details class="jt-help">');
  // Nesting-aware end: the small hints are a <details> nested inside the panel (2026-09-25).
  let depth = 0, end = start;
  for (const m of html.slice(start).matchAll(/<details\b|<\/details>/g)) { depth += m[0] === "<details" ? 1 : -1; if (depth === 0) { end = start + m.index + m[0].length; break; } }
  const block = html.slice(start, end);
  assert.match(block, /<summary>Stuck\? Hints <span>Small hints first, the full answer last\. Your editor stays as you left it\.<\/span><\/summary>/, "exact summary text");
  assert.ok(block.includes('id="learning-scaffold"'), "#learning-scaffold is inside .jt-help");

  const codeIndex = html.indexOf('id="code"');
  assert.ok(codeIndex >= 0 && codeIndex < start, ".jt-help comes after #code in the document");

  // Essentials stay visible, before #code: the case goal, the model legend, the candidate table,
  // and the compact case-status banner. #pre-editor-bridge names the real case variables, so it
  // also stays visible; #answer-before-editor is explicitly left in place.
  for (const id of ["model-context", "data", "case-status", "pre-editor-bridge", "answer-before-editor"]) {
    const index = html.indexOf(`id="${id}"`);
    assert.ok(index >= 0 && index < codeIndex, `#${id} stays visible before #code`);
    assert.ok(index < start, `#${id} is not inside .jt-help`);
  }
});

test("C6's ending (case closure inside #visual) is untouched and stays outside .jt-help", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter6.js"), "utf8");
  // The ending copy is built in JS (drawVisual/caseClosure), not static HTML; guard that the
  // building blocks this contract must not disturb are still present and wired to #visual.
  assert.match(source, /completionLine/);
  assert.match(source, /caseClosure/);
  assert.match(source, /el\.visual\.append\(section\)/);

  const visualIndex = html.indexOf('id="visual"');
  const jtHelpIndex = html.indexOf('<details class="jt-help">');
  assert.ok(visualIndex > jtHelpIndex, "#visual (the ending) still follows the editor, outside .jt-help");
  assert.doesNotMatch(
    html.slice(jtHelpIndex, html.indexOf("</details>", jtHelpIndex)),
    /id="visual"/,
    "#visual is not nested inside .jt-help"
  );
});

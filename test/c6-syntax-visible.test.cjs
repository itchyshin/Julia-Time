"use strict";

// Round-3 screen-bot (2026-09-25): Chapter 6 is the only step that needs .& (combine two row checks), and
// after the layout pass nothing visible on the page introduced it (the practice card sits in the help panel).
// Its "Read this before you write" syntax line, defined in COPY.syntax but never rendered, now sits above the
// editor, like Chapter 5's .>= line.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c6 = require("../web/chapter6.js");
const html = fs.readFileSync(path.join(__dirname, "../web/chapter6.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../web/chapter6.js"), "utf8");

test("Chapter 6 shows its .& syntax line above the editor, outside the help panel", () => {
  const syntax = html.indexOf('id="syntax"'), code = html.indexOf('id="code"'), help = html.indexOf('class="jt-help"');
  assert.ok(syntax > -1 && syntax < code, "the syntax line sits before the editor");
  assert.ok(help === -1 || syntax < help, "and is not inside the help panel");
  assert.match(js, /el\.syntax\.textContent = COPY\.syntax/);
  assert.match(c6.COPY.syntax, /\.& keeps a row only when both comparisons are true/);
  assert.doesNotMatch(c6.COPY.syntax, /stories\[/, "the line teaches the operator without giving the answer");
});

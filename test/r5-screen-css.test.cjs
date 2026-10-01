"use strict";
// Round 5, "Screen": the page source for the layout fixes (Tufte r4 B, D, E and the range strip). Behaviour is in lesson-screen.test.cjs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const css = read("web/lesson.css"), rangeCss = read("web/lesson-range.css"), rangeJs = read("web/lesson-range.js"), html = read("web/lesson.html");

test("r5: the focused skip link lies below the bar's left side, clear of the Sound pill", () => {
  assert.match(css, /\.skip:focus \{ left: 16px; top: 56px;/);
  assert.doesNotMatch(css, /\.skip:focus \{[^}]*left: 50%/);
});
test("r5: the jar board sits under Next on a lesson line; the range keeps its own order", () => {
  assert.match(css, /\.result-wrap \{ display: contents; \}/);
  assert.match(css, /#app:not\(\[data-screen="range"\]\) #board \{ order: 9; \}/);
});
test("r5: the left column's lines have a gap and the task paragraph a top margin", () => {
  assert.match(css, /\.para-gap \{ display: block; height: 10px; \}/);
  assert.match(css, /#prompt \{ margin-top: 14px; \}/);
});
test("r5: the sweep chip lies over the legend strip, so it never covers a group label", () => {
  const legend = rangeJs.indexOf('class: "range-legend"'), wrap = rangeJs.indexOf('const wrap = el("div", { class: "rack-wrap" })');
  assert.ok(wrap > 0 && legend > wrap, "the legend is drawn inside the rack wrap");
  assert.match(rangeCss, /\.range-legend \{ margin: 0 0 8px; line-height: 22px;/);
  assert.match(rangeCss, /\.sweeper-line \{[^}]*line-height: 22px/);
  assert.match(rangeCss, /\[data-boss="1"\] \.sweeper-line \{ left: auto; right: 0; \}/);
});
test("r5/r6: each switch carries a title that says where its notes show", () => {
  assert.match(html, /title="Show the R note under a result, when the step has one\. R columns are also in the Cheat sheet and Pocket dictionary\."><input id="show-r"/);
  assert.match(html, /title="Show the Python note under a result, when the step has one\. Python columns are also in the Cheat sheet and Pocket dictionary\."><input id="show-py"/);
  assert.match(html, /<p id="switch-note" class="switch-note" aria-live="polite" hidden><\/p>/);
});

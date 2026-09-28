// Round 6 fixes (2026-09-27, r6-audit #2 #7 #9, r6-rc #3 #5 #7): story words on the C1 opening, the
// Case Board and the ending; the C1 restored-code note clears; the closed board tells the truth; and
// small layout fixes (jar IDs stay whole, buttons line up, Toto's closing quote looks like Itchy's).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const read = file => fs.readFileSync(file, "utf8");

test("C1 opening: Toto read the typed table, not the paper, as 2, 2, then 0", () => {
  const html = read("web/index.html");
  assert.match(html, /Toto typed the tally sheet into the lab’s table, then read that table as T-A: 2 of 2 jars, T-B: 2 of 2 jars, then T-C: 0 jars\./);
  assert.doesNotMatch(html, /then read it as 2, 2, then 0/);
});

test("Momo's cast card says tray, as every later screen does", () => {
  const html = read("web/index.html");
  assert.match(html, /“A zero in a report is not always an empty tray\.”/);
  assert.doesNotMatch(html, /empty jar/);
});

test("Case Board C3 reason does not say typed twice", () => {
  const src = read("web/course/course-client.js");
  assert.match(src, /Toto typed his report from his typed table\. Line that table up with the notebook\./);
  assert.doesNotMatch(src, /from his typed copy/);
});

test("Ending C4 picture text does not say the jars are empty", () => {
  const src = read("web/course/ending-script.js");
  assert.doesNotMatch(src, /empty jars/);
  assert.match(src, /alt:"Eddie points to a rack of jars while the team plans the recheck\."/);
});

test("C1: the restored-code note is removed on typing and on a new run", () => {
  const src = read("web/mystery.js");
  assert.match(src, /restoredCodeNote = appendText\(el\.code\.parentElement, "p", "saved-code-note", "Restored your saved code: this is not a supplied answer\."\)/);
  assert.match(src, /function clearRestoredCodeNote\(\) \{ if \(restoredCodeNote\) \{ restoredCodeNote\.remove\(\); restoredCodeNote = null; \} \}/);
  const input = src.match(/el\.code\.addEventListener\("input", \(\) => \{[^\n]*/)[0];
  assert.match(input, /clearRestoredCodeNote\(\)/);
  const run = src.match(/function run\(\) \{[\s\S]*?\n    \}/)[0];
  assert.match(run, /clearRestoredCodeNote\(\)/);
});

test("Closed or saved Case Board: no promise of a 'fresh check today'", () => {
  const src = read("web/course/course-client.js");
  assert.doesNotMatch(src, /fresh check today/);
  assert.match(src, /"Your saved work is on this computer\. Open any chapter to run it again\."/);
});

test("C1 full-answer label matches the other chapters", () => {
  const src = read("web/mystery.js");
  // r8-audit #5 (2026-09-28): the round-8 label, shared with C2 to C6.
  assert.match(src, /Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns\. It does not count as a saved answer until Julia checks it\./);
  assert.doesNotMatch(src, /or save evidence\./);
});

test("Case Board: jar IDs such as J-092 are kept on one line", () => {
  const board = read("web/course/course-board.js");
  assert.match(board, /jar-id/);
  assert.match(read("web/course/course.css"), /\.jar-id \{ white-space:nowrap; \}/);
});

test("Buttons line up on the intro's last scene and on the finale", () => {
  const css = read("web/course/ending.css");
  assert.match(css, /\.ending-controls > \*, \.ending-actions > \* \{ margin-top:0; \}/);
});

test("Finale: Toto's closing quote uses the same quote box as Itchy's", () => {
  assert.match(read("web/course/ending.html"), /<p id="ending-pun" class="ending-pun ending-line"><\/p>/);
});

// Shinichi's v0.2.4 play-through (2026-09-27): Chapter 4 never said why the jars are rechecked, so he
// could not tell whether the recheck tests the notebook or the tally sheet; and the ending movie
// changed scene too fast to read. Approved: add the reason, retitle to a plan, 12 s per scene.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

test("C4 opening says the recheck tests the notebook, and why", () => {
  const html = fs.readFileSync("web/chapter4.html", "utf8");
  // Story spine (2026-09-27) refined the wording: Part 2 opens by asking whether the notebook is right.
  assert.match(html, /<h1 id="chapter-title" tabindex="-1">The report was wrong\. Is the notebook right\?<\/h1>/);
  assert.match(html, /Toto meant the springtails are dying out, tray after tray, but three trays of two jars are too few to show that\. What we can test is simpler: if the springtails were dying out, most jars would have none\./);
  // Setting rename (2026-09-28): the recheck reason and the freezer reason are on the page.
  assert.match(html, /A two-minute look can miss springtails hiding deep in the leaves/);
  assert.match(html, /J-093 and J-095 were checked with their trays, then went to the freezer the next day\./);
  assert.match(html, /chance may even leave out J-096, and that is the price of a fair test\./);
  assert.doesNotMatch(html, /Now look at the jars again/);
});

test("the ending movie holds each scene for 12 seconds", () => {
  const ending = require("../web/course/ending.js");
  assert.equal(ending.SCENE_MS, 12000);
});

// Same play-through: "Vanishing" read as the case title rather than as the report's claim. The story
// board now says that the Vanishing story is Claim 2 written as a number. The 1-in-10 matches the
// server's p = 0.1 for Vanishing (test/test_mystery_c6.jl pins the names and p values).
test("C6 story board says the Dying out story is the report's claim, as a number", () => {
  const html = fs.readFileSync("web/chapter6.html", "utf8");
  assert.match(html, /Dying out is the report’s claim, “the springtails are dying out”, written as a number: a jar shows springtails only 1 time in 10\./);
  const board = html.indexOf('id="candidate-model-cards"'), line = html.indexOf("Dying out is the report’s claim, “");
  assert.ok(board >= 0 && line > board, "the line sits right after the three story cards");
});

// Same play-through: the "Show the full answer" button sat right above an empty editor, which
// invites a click before the learner has tried. It now sits below the Run button and the result;
// in C5 and C6 the revealed answer still opens above the editor (#answer-before-editor).
for (const [file, button] of [["web/chapter2.html", "show-answer"], ["web/chapter5.html", "show-full-answer"], ["web/chapter6.html", "show-full-answer"]]) {
  test(`${file}: the full-answer button comes after Run and the result`, () => {
    const html = fs.readFileSync(file, "utf8");
    const run = html.indexOf('id="run"'), result = html.indexOf('id="result"'), answer = html.indexOf(`id="${button}"`);
    assert.ok(run > 0 && result > run, "run and result exist in order");
    assert.ok(answer > result, `#${button} comes after #result`);
  });
}

"use strict";

// Repair 7 (orchestrator browser check, 2026-09-26): the "Case question" box under each chapter's
// eyebrow held an assertion, not a question (C2: "The report says T-C has 0 springtails."; C3: "The
// report was typed from the tally sheet."), because web/chapter2.js overwrote the static question
// text with the step "goal" line (there was no server "question" field for C2), which also
// duplicated that goal line already printed lower on the same page (once with a straight
// apostrophe from the server, once with a curly one in the static HTML).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("C2's Case question box holds a real question, and the goal line is not duplicated", () => {
  const html = fs.readFileSync("web/chapter2.html", "utf8");
  const brief = html.match(/<div class="scene-brief">([\s\S]*?)<\/div>/)[1];
  assert.match(brief, /<h2 id="question">What does the notebook say for each tray\?<\/h2>/);
  assert.doesNotMatch(brief, /The report says T-C has 0 springtails\.<\/h2>/);

  // src/mystery_c2.jl now supplies its own "question", so web/chapter2.js's
  // `message.question || message.goal` fallback (renderCase) no longer falls through to "goal" and
  // overwrites the static #question text with the duplicate goal sentence at runtime.
  const source = fs.readFileSync("src/mystery_c2.jl", "utf8");
  assert.match(source, /"question" => "What does the notebook say for each tray\?"/);
});

test("C2's caseQuestionText prefers the real question over the duplicate goal sentence", () => {
  const chapter2 = require("../web/chapter2.js");
  const goal = "Group the B09 jars by tray, count the jars with springtails, then work out each tray's share.";
  const question = "What does the notebook say for each tray?";
  assert.equal(chapter2.caseQuestionText({question, goal}), question);
  // Still falls back safely if a future case omits "question".
  assert.equal(chapter2.caseQuestionText({goal}), goal);
});

test("C3's Case question box holds a real question", () => {
  const html = fs.readFileSync("web/chapter3.html", "utf8");
  const brief = html.match(/<section class="scene-brief"[\s\S]*?<\/section>/)[0];
  assert.match(brief, /<h2 id="scene-goal">Do Toto’s typed copy and the notebook agree\?<\/h2>/);
  assert.doesNotMatch(brief, /The report was typed from the tally sheet\.<\/h2>/);
});

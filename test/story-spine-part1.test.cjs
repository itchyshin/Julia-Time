// Story spine Part 1 (docs/design/06-story-spine.md, approved by Shinichi 2026-09-27): builds the
// C1-C3 "why this code" beat-2 lines (shared `.step-why` element, one paragraph directly under each
// step's title, before the task text) and checks the C3 claim-stamp rewording and the Case Board
// case question. Complements test/story-spine-gates.test.cjs (part labels, case question presence,
// repo-wide Claim 1/2 ban), which another lane in this worktree also writes to.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const norm = s => s.replace(/&#39;|&rsquo;|’/g, "'");

test("C1 case editor: step-why sits between the step title and the task text", () => {
  const html = read("web/index.html");
  const title = html.indexOf('id="editor-heading"');
  const why = html.indexOf('The report is about batch B09, so first we need exactly those six jars.');
  const task = html.indexOf('id="practice-to-case-bridge"');
  assert.ok(title > -1 && why > -1 && task > -1, "all three markers exist");
  assert.ok(title < why && why < task, "step-why sits between the title and the task text");
  assert.match(html, /class="step-why"[^>]*>The report is about batch B09/);
});

test("C1 practice: step-why sits between the practice heading and the practice task", () => {
  const html = read("web/index.html");
  const heading = html.indexOf('id="practice-heading"');
  const why = html.indexOf('Two short warm-ups on practice rows, so picking the B09 jars is not your first try.'); // one line for both warm-ups, 2026-09-27
  const task = html.indexOf('id="practice-task"');
  assert.ok(heading > -1 && why > -1 && task > -1, "all three markers exist");
  assert.ok(heading < why && why < task, "step-why sits between the heading and the practice task");
});

test("C1 opening: the exact case question sits under the headline, before the existing lede", () => {
  const html = norm(read("web/index.html"));
  const headline = html.indexOf('id="chapter-title"');
  const question = html.indexOf("Toto's report says the springtails are dying out. Are they?");
  const lede = html.indexOf("Toto rushes in with a one-page report");
  assert.ok(headline > -1 && question > -1 && lede > -1);
  assert.ok(headline < question && question < lede);
});

test("C2 lessonCopy carries the new why-this-code line for each step", () => {
  const client = require(path.join(ROOT, "web/chapter2.js"));
  assert.equal(client.lessonCopy("group").why, "To count per tray, first put each tray's jars together.");
  assert.equal(client.lessonCopy("counts").why, "Count the jars and the jars with springtails on each tray: this is the number the report says is 0 for T-C.");
  assert.equal(client.lessonCopy("rates").why, "A share is what the report's 0 really claims: 0 of 2 jars. Write every tray the same way.");
});

test("C2 chapter2.html: step-why sits between the step title and the step prompt", () => {
  const html = read("web/chapter2.html");
  const title = html.indexOf('id="step-title"');
  const why = html.indexOf('id="step-why"');
  const prompt = html.indexOf('id="step-prompt"');
  assert.ok(title > -1 && why > -1 && prompt > -1);
  assert.ok(title < why && why < prompt);
});

test("C3 lessonCopy carries the new why-this-code line for each move", () => {
  const client = require(path.join(ROOT, "web/chapter3.js"));
  assert.equal(client.lessonCopy("join-report-log").why, "Put the notebook's count and Toto's typed count for each tray in one row, so they can be compared.");
  assert.equal(client.lessonCopy("filter-disagreement").why, "Keep only the tray where they disagree: that is where the 0 came from.");
});

test("C3 chapter3.html: step-why sits between the move title and the move question", () => {
  const html = read("web/chapter3.html");
  const title = html.indexOf('id="move-title"');
  const why = html.indexOf('id="step-why"');
  const question = html.indexOf('id="move-question"');
  assert.ok(title > -1 && why > -1 && question > -1);
  assert.ok(title < why && why < question);
});

test("C3 practice: its own why-this-code line sits between the demo heading and the demo plan", () => {
  const html = read("web/chapter3.html");
  const heading = html.indexOf('id="demo-heading"');
  const why = html.indexOf('Line up two small tables first, so the real one is not your first try.');
  const plan = html.indexOf('id="demo-plan"');
  assert.ok(heading > -1 && why > -1 && plan > -1);
  assert.ok(heading < why && why < plan);
  assert.match(html, /class="step-why"[^>]*>Line up two small tables first/);
});

test("C3 claim stamp is reworded to the part name, not Claim 1", () => {
  const src = read("web/chapter3.js");
  assert.match(src, /Part 1 · Check the report: the 0 was a blank box, not an empty tray\./);
  assert.doesNotMatch(src, /Claim 1/);
});

test("Case Board case question matches the exact spec wording", () => {
  const client = require(path.join(ROOT, "web/course/course-client.js"));
  const move = { chapter: "C1", move: "select-records" };
  assert.equal(client.caseThread(new Set(), move).question, "Toto's report says the springtails are dying out. Are they?");
});

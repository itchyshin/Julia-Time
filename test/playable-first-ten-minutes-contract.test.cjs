"use strict";

// Structural guard for the shared learner contract. It protects interface order;
// it does not claim that a human has learned or enjoyed the game.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const web = path.join(__dirname, "..", "web");
const read = name => fs.readFileSync(path.join(web, name), "utf8");

test("every chapter puts a result directly after Run and before optional help", () => {
  for (const [page, runId, resultId] of [
    ["index.html", "run", "result-area"],
    ["chapter2.html", "run", "result"],
    ["chapter3.html", "run", "result"],
    ["chapter4.html", "run", "result"],
    ["chapter5.html", "run", "result"],
    ["chapter6.html", "run", "result"],
  ]) {
    const html = read(page);
    const run = html.indexOf(`id=\"${runId}\"`);
    const result = html.indexOf(`id=\"${resultId}\"`);
    const help = html.indexOf("<details class=\"help");
    assert.ok(run >= 0 && result > run, `${page} places its result after Run`);
    assert.ok(help < 0 || result < help, `${page} places its result before optional help`);
  }
});

test("runnable answers are dark references above editors, while templates say not to run", () => {
  const c1 = read("index.html");
  assert.ok(c1.indexOf('id="answer-before-editor"') < c1.indexOf('id="code"'));
  assert.match(read("mystery.js"), /Reference code answer — runnable Julia/);
  assert.match(read("mystery.js"), /complete-answer-code/);

  const c2 = read("chapter2.html");
  assert.ok(c2.indexOf('id="complete-answer"') < c2.indexOf('id="code"'));
  // T2 (2026-09-12 playtest): the code shape moved from an always-visible template in the main
  // body into the same staged-hint sequence as the rest of C2's help — one click away, not shown
  // unprompted above the real input names.
  assert.doesNotMatch(c2, /Template — replace the names; do not run it/);
  assert.match(read("chapter2.js"), /complete-answer-code/);

  for (const chapter of [3, 4, 5, 6]) {
    const html = read(`chapter${chapter}.html`);
    const source = read(`chapter${chapter}.js`);
    assert.ok(html.indexOf('id="answer-before-editor"') < html.indexOf('id="code"'), `C${chapter} answer reference precedes its editor`);
    assert.match(source, /(Complete runnable answer|Reference code answer — runnable Julia)/);
  }
  // T2 (2026-09-12 playtest): C5's Move 2 code shape used to leak into the always-visible
  // pre-editor bridge on every render, duplicating its own gated "Code shape" hint stage. It now
  // lives only in that staged hint (see chapter5-client.test.cjs).
  assert.doesNotMatch(read("chapter5.js"), /Template — replace these placeholders; do not run this/);
  assert.match(read("chapter6.js"), /Template — replace these placeholders; do not run this/);
});

test("Chapter 5 assigns visible pixel heights to its fixed-area distribution bars", () => {
  const c5 = read("chapter5.js");
  const css = read("chapter5.css");
  assert.match(c5, /160\*bin\.frequency\/largest\)\)\}px/);
  assert.match(css, /\.distribution-bars li\s*\{height:220px/);
});

test("every chapter keeps the original Julia error available after a recovery message", () => {
  assert.match(read("mystery.js"), /Original Julia error/, "C1 retains the server error detail");
  for (const chapter of [2, 3, 4, 5, 6]) {
    assert.match(read(`chapter${chapter}.js`), /Original Julia error/, `C${chapter} retains the server error detail`);
  }
});

test("optional-lab navigation preserves an attempt, while the static setup guide keeps a real local destination", () => {
  const c6 = read("chapter6.js");
  const speed = read("course/speed-lab.html");
  const setup = read("course/getting-started.html");
  assert.match(c6, /course\/speed-lab\.html/);
  assert.match(speed, /id="return-case-board"/);
  assert.match(speed, /index\.html\?attempt=/);
  assert.match(setup, /id="local-case-board"/);
  assert.match(setup, /href="http:\/\/127\.0\.0\.1:8000\/course\/index\.html"/);
  assert.doesNotMatch(setup, /<script\b/i);
});

test("T2: chapters 2-5 keep the fill-in code shape one click away, not shown unprompted in the challenge body", () => {
  const chapter2 = require(path.join(web, "chapter2.js"));
  const groupShape = chapter2.lessonCopy("group").shape;
  assert.equal(chapter2.allHints("group")[0], groupShape, "C2's code shape is now the first staged hint");
  assert.doesNotMatch(read("chapter2.html"), new RegExp(groupShape.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "C2's code shape is not baked into the static HTML");
  assert.doesNotMatch(read("chapter2.js"), /el\.shape\.textContent/, "C2 no longer writes the shape into an always-visible element");

  const chapter3 = require(path.join(web, "chapter3.js"));
  const joinShape = chapter3.lessonCopy("join-report-log").shape;
  assert.equal(chapter3.helpStage("join-report-log", 1).text, joinShape, "C3's code shape is reachable only through its gated hint stage");
  assert.doesNotMatch(read("chapter3.js"), /Template only — not code to run yet/, "C3 no longer duplicates the shape into an always-visible panel");

  const chapter4 = require(path.join(web, "chapter4.js"));
  const recheckShape = chapter4.lessonCopy("plan-distinct-recheck").shape;
  assert.equal(chapter4.helpStage("plan-distinct-recheck", 1).text, recheckShape, "C4's code shape is reachable only through its gated hint stage");
  assert.doesNotMatch(read("chapter4.js"), /el\.syntax\.textContent\s*=\s*"Code shape:/, "C4 no longer duplicates the shape into an always-visible panel");

  assert.doesNotMatch(read("chapter5.js"), /Template — replace these placeholders; do not run this/, "C5's Move 2 shape no longer leaks into the pre-editor bridge");
});

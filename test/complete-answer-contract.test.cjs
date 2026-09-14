"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

for (const chapter of [3, 4, 5, 6]) {
  test(`C${chapter} presents a deliberate complete answer as a code snippet before the editor`, () => {
    const html = fs.readFileSync(`web/chapter${chapter}.html`, "utf8");
    const source = fs.readFileSync(`web/chapter${chapter}.js`, "utf8");
    const answer = html.indexOf('id="answer-before-editor"');
    const editor = html.indexOf('id="code"');
    assert.ok(answer >= 0, "an answer reference target is required");
    assert.ok(answer < editor, "the answer reference belongs immediately before the editor");
    assert.match(source, /(Complete runnable answer|Reference code answer — runnable Julia)/);
    assert.match(source, /document\.createElement\("pre"\)/);
  });
}

test("runnable references look like code answers and explain where live Julia output appears", () => {
  for (const sourceFile of ["mystery.js", "chapter2.js", "chapter3.js", "chapter5.js", "chapter6.js"]) {
    const source = fs.readFileSync(`web/${sourceFile}`, "utf8");
    assert.match(source, /Reference code answer — runnable Julia/,
      `${sourceFile} names a revealed solution as code, not prose`);
    assert.match(source, /Run this code in your editor to see Julia.?s actual returned value below Run/,
      `${sourceFile} tells the learner how to see a real Julia result`);
  }

  for (const page of ["index.html", "chapter2.html", "chapter3.html", "chapter4.html", "chapter5.html", "chapter6.html"]) {
    const html = fs.readFileSync(`web/${page}`, "utf8");
    assert.match(html, /href="answer-reference\.css"/,
      `${page} uses the shared reference-code presentation`);
  }

  const css = fs.readFileSync("web/answer-reference.css", "utf8");
  assert.match(css, /\.answer-reference\s*\{[^}]*border[^}]*background/s,
    "the reference answer has a separate panel");
  assert.match(css, /\.complete-answer-code\s*\{[^}]*background:\s*#0[0-9a-f]{5}/i,
    "the code answer has a near-black background");
});

test("C5 recognises only the known obsolete incomplete event-frequency draft", () => {
  const c5 = require("../web/chapter5.js");
  assert.equal(c5.isObsoleteDraft("event-frequency", "sim_counts .>= observed_count; (events=events, frequency=sum(events)/length(events))"), true);
  assert.equal(c5.isObsoleteDraft("event-frequency", "events = sim_counts .>= observed_count; (events=events, frequency=sum(events)/length(events))"), false);
  assert.equal(c5.isObsoleteDraft("event-mask", "sim_counts .>= observed_count"), false);
});

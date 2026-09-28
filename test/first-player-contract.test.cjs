"use strict";

// This is a structural regression guard, not a claim that a human has learned.
// It protects the minimum information a first-time player needs before typing.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function page(name) {
  return fs.readFileSync(path.join(__dirname, "../web", name), "utf8");
}

test("each playable chapter exposes its data, required result, and an optional answer route", () => {
  const c1 = page("index.html");
  assert.match(c1, /Your code can use this table as <code>jars<\/code>/);
  assert.match(c1, /<code>case_batch<\/code>/);
  assert.match(c1, /id="return-spec"/);
  assert.match(c1, /id="case-table"/);
  // Story bible v2 (2026-09-26): every chapter's help panel shares one label, "Stuck? Hints".
  assert.match(c1, /Stuck\? Hints/);
  assert.match(c1, /id="show-answer"[^>]*>Show the full answer/);

  const c2 = page("chapter2.html");
  assert.match(c2, /Your code can use them as <code>jars<\/code>/);
  assert.match(c2, /id="return-spec"/);
  assert.match(c2, /id="source-rows"/);
  assert.doesNotMatch(c2, /Need the full answer\?/, "r3: the full-answer button lives in Stuck? Hints, after the hints");
  assert.match(c2, /id="show-answer"[^>]*>Show the full answer/);

  const c3 = page("chapter3.html");
  assert.match(c3, /id="return-spec"/);
  assert.match(c3, /id="visible-inputs"/);
  assert.match(c3, /id="case-bindings"/);
  // Story bible v2 (2026-09-26): every chapter's help panel shares one label, "Stuck? Hints".
  assert.match(c3, /Stuck\? Hints <span>Small hints first, the full answer last/);
  assert.match(c3, /id="show-answer"[^>]*>Show the full answer/);

  const c4 = page("chapter4.html");
  assert.match(c4, /id="return-spec"/);
  assert.match(c4, /id="visible-inputs"/);
  assert.match(c4, /id="case-bindings"/);
  assert.match(c4, /Stuck\? Hints <span>Small hints first, the full answer last/);
  assert.match(c4, /id="show-answer"[^>]*>Show the full answer/);

  const c5 = page("chapter5.html");
  const c5Script = page("chapter5.js");
  assert.match(c5, /id="required-result"/);
  assert.match(c5, /id="simulation-data"/);
  assert.match(c5Script, /Julia inputs: sim_counts/);
  assert.match(c5, /Stuck\? Hints/);
  // Night round 2 (r2-bugs.md finding 2): one full-answer button per step.
  assert.match(c5, /id="show-full-answer"[^>]*>Show the full answer/);
  assert.doesNotMatch(c5, /id="answer"/);

  const c6 = page("chapter6.html");
  const c6Script = page("chapter6.js");
  assert.match(c6, /Required result/);
  assert.match(c6, /id="data"/);
  assert.match(c6, /id="learning-scaffold"/);
  assert.match(c6Script, /candidate_models|stories/);
  assert.match(c6, /Stuck\? Hints|Help me start/);
  assert.match(c6, /id="show-full-answer"[^>]*>Show the full answer/);
  assert.doesNotMatch(c6, /id="answer"/);
});

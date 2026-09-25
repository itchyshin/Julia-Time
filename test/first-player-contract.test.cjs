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
  assert.match(c1, /available to your Julia code as <code>jars<\/code>/);
  assert.match(c1, /<code>case_batch<\/code>/);
  assert.match(c1, /id="return-spec"/);
  assert.match(c1, /id="case-table"/);
  assert.match(c1, /Need the full answer\?/);
  assert.match(c1, /id="show-answer"[^>]*>Show the complete answer/);

  const c2 = page("chapter2.html");
  assert.match(c2, /<code>jars<\/code> is the table below/);
  assert.match(c2, /id="return-spec"/);
  assert.match(c2, /id="source-rows"/);
  assert.match(c2, /Need the full answer\?/);
  assert.match(c2, /id="show-answer"[^>]*>Show the complete answer/);

  const c3 = page("chapter3.html");
  assert.match(c3, /id="return-spec"/);
  assert.match(c3, /id="visible-inputs"/);
  assert.match(c3, /id="case-bindings"/);
  assert.match(c3, /Need the full answer\?/);
  assert.match(c3, /id="show-answer"[^>]*>Show the complete answer/);

  const c4 = page("chapter4.html");
  assert.match(c4, /id="return-spec"/);
  assert.match(c4, /id="visible-inputs"/);
  assert.match(c4, /id="case-bindings"/);
  assert.match(c4, /Need the full answer\?/);
  assert.match(c4, /id="show-answer"[^>]*>Show the complete answer/);

  const c5 = page("chapter5.html");
  const c5Script = page("chapter5.js");
  assert.match(c5, /id="required-result"/);
  assert.match(c5, /id="simulation-data"/);
  assert.match(c5Script, /Julia inputs: sim_counts/);
  assert.match(c5, /Help me start/);
  assert.match(c5, /id="answer"[^>]*>Show the complete answer/);

  const c6 = page("chapter6.html");
  const c6Script = page("chapter6.js");
  assert.match(c6, /Required result/);
  assert.match(c6, /id="data"/);
  assert.match(c6, /id="learning-scaffold"/);
  assert.match(c6Script, /candidate_models/);
  assert.match(c6, /Help me start/);
  assert.match(c6, /id="answer"[^>]*>Show the complete answer/);
});

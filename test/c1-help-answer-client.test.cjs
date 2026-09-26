"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/mystery.js");

test("C1 gives a learner a visible optional complete-answer route without inserting code", () => {
  assert.deepEqual(client.hintIndicesThrough(1, 3, true), {indices:[1, 2], shown:3});
  assert.deepEqual(client.hintIndicesThrough(1, 3, false), {indices:[1], shown:2});

  const html = fs.readFileSync(path.join(__dirname, "../web/index.html"), "utf8");
  assert.match(html, /Stuck\? Hints/);
  assert.match(html, /id="show-answer"[^>]*>Show the full answer/);
  assert.match(html, /your editor stays as you left it/i);
});

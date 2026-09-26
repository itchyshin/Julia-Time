"use strict";

// Round-4 review (2026-09-26): the page that briefly appears between the Case Board and a chapter said "This keeps
// the established chapter page authoritative", developer wording a learner on a slow computer would read.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("the chapter routing page speaks to the learner", () => {
  const js = fs.readFileSync(path.join(__dirname, "../web/course/chapter-route.js"), "utf8");
  assert.match(js, /"Your chapter is opening\. If it does not appear in a moment, use the link below\."/);
  assert.doesNotMatch(js, /authoritative/);
});

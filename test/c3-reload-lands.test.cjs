"use strict";

// Round-4 screen-bot (2026-09-26): after a reload, Chapter 2 went straight to the next unsolved step but
// Chapter 3 stopped on its story screen and needed a "Resume saved move" click. With saved Chapter 3 work (or a
// step named in the address), Chapter 3 now opens the investigation directly, like Chapter 2.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c3 = require("../web/chapter3.js");

test("Chapter 3 lands in the investigation when there is saved work or a requested step", () => {
  assert.equal(c3.landsInInvestigation(false, ""), false);
  assert.equal(c3.landsInInvestigation(true, ""), true);
  assert.equal(c3.landsInInvestigation(false, "filter-disagreement"), true);
});

test("the landing rule is wired into the page start-up", () => {
  const js = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.match(js, /if \(landsInInvestigation\(Boolean\(savedChallengeResume\(courseState, storage, attempt\)\), requested\)\) \{ el\.scene\.hidden = true; el\.investigation\.hidden = false; \}/);
});

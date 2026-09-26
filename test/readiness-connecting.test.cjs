"use strict";

// Round-3 screen-bots (2026-09-25): the Case Board's readiness box read "Connecting to the local Julia lab…"
// with nothing saying that a short wait is normal; two players could not tell whether setup was broken.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("the connecting message says a short wait is normal", () => {
  const board = fs.readFileSync(path.join(__dirname, "../web/course/setup-status-board.js"), "utf8");
  assert.match(board, /"Connecting to the local Julia lab… This usually takes a few seconds\."/);
});

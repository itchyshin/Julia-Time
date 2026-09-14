"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("the Continue action's visible text is the only thing that names it (S7-T2)", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/course/index.html"), "utf8");
  assert.doesNotMatch(html, /id="continue-action"[^>]*aria-label/);

  const board = fs.readFileSync(path.join(__dirname, "../web/course/course-board.js"), "utf8");
  const setup = fs.readFileSync(path.join(__dirname, "../web/course/setup-status-board.js"), "utf8");
  assert.doesNotMatch(board, /continueAction\.(setAttribute\("aria-label"|ariaLabel)/);
  assert.doesNotMatch(setup, /continueAction\.(setAttribute\("aria-label"|ariaLabel)/);

  // The readiness controller must not overwrite the computed next-move label with a
  // Julia-connection status string ("Checking Julia…" / "Check Julia below"): that status
  // belongs to the adjacent #setup-status live region, not this link's name.
  assert.doesNotMatch(setup, /text\(continueAction,[^)]*storyActionLabel/);
  assert.doesNotMatch(setup, /text\(continueAction,[^)]*"Checking Julia…"/);
});

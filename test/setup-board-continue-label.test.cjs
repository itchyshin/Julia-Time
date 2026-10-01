"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Julia readiness gates the dashboard Continue action without replacing its computed next-move label", () => {
  const board = fs.readFileSync(path.join(__dirname, "../web/course/course-board.js"), "utf8");
  const setup = fs.readFileSync(path.join(__dirname, "../web/course/setup-status-board.js"), "utf8");

  // Once the case is complete the label becomes "See how the case ends →" (docs/design/03-ending.md);
  // otherwise it stays the computed next-move label, unchanged from before the ending existed.
  // 0.5: the label is the walk's next step ("Train: Lesson N", "Solve: Chapter N", "See how the case ends").
  assert.match(board, /const readyLabel\s*=\s*next\.label;/);
  assert.match(board, /continueAction\.dataset\.readyLabel\s*=\s*readyLabel/);
  assert.match(setup, /continueAction\.dataset\.readyLabel\s*\|\|\s*"Start Lesson 1"/);
  assert.doesNotMatch(setup, /text\(continueAction, awaitingPong \? "Checking Julia…" : client\.storyActionLabel\(state\)\)/);
});

test("Case Board bounds a missing local-lab connection and names the recovery step", () => {
  const setup = fs.readFileSync(path.join(__dirname, "../web/course/setup-status-board.js"), "utf8");

  assert.match(setup, /CONNECT_TIMEOUT_MS\s*=\s*5000/);
  assert.match(setup, /The local Julia lab did not answer/);
  assert.match(setup, /Start the supplied Julia Time launcher/);
  assert.match(setup, /clearConnectionTimer\(/);
  assert.match(setup, /addEventListener\("error"/);
});

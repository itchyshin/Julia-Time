"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Julia readiness gates the dashboard Continue action without replacing its computed next-move label", () => {
  const board = fs.readFileSync(path.join(__dirname, "../web/course/course-board.js"), "utf8");
  const setup = fs.readFileSync(path.join(__dirname, "../web/course/setup-status-board.js"), "utf8");

  assert.match(board, /const readyLabel\s*=\s*model\.continue\.label\s*\+\s*" →"/);
  assert.match(board, /continueAction\.dataset\.readyLabel\s*=\s*readyLabel/);
  assert.match(setup, /continueAction\.dataset\.readyLabel\s*\|\|\s*"Start Chapter 1 →"/);
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

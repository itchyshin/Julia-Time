"use strict";

// Round-4 screen-bots (2026-09-26): a finished Chapter 2 step left everything open (notebook table, notes, names,
// reference answer) above the result and the tray-rack payoff, so the finished page ran to about 4,400 px.
// Once a step is accepted its notebook table folds closed (one click reopens it); the next step opens it again.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c2 = require("../web/chapter2.js");

test("the notebook is open for a step still to solve and folded once it is accepted", () => {
  assert.equal(c2.notebookOpen(false), true);
  assert.equal(c2.notebookOpen(true), false);
});

test("Chapter 2 applies the rule on accept and when a step opens", () => {
  const js = fs.readFileSync(path.join(__dirname, "../web/chapter2.js"), "utf8");
  assert.match(js, /setNotebookOpen\(notebookOpen\(true\)\)/, "folds on accept");
  assert.match(js, /setNotebookOpen\(notebookOpen\(false\)\)/, "reopens when a step opens");
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter2.html"), "utf8");
  assert.match(html, /<details class="source-notebook" open>/, "open by default, so a page without scripts still shows the table");
});

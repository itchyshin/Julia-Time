"use strict";

// Repair 7 (orchestrator browser check, 2026-09-26): plain and consistent Case Board wording.
// "Find your next move." -> "Your next step."; "What this browser remembers" and "Concepts will
// appear here after this browser has saved progress." -> plain, and "browser" unified to the one
// word the rest of the page already uses, "this computer".
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("the Case Board headline is a plain instruction, not 'Find your next move.'", () => {
  const html = fs.readFileSync("web/course/index.html", "utf8");
  assert.match(html, /<h1 id="board-title">Your next step\.<\/h1>/);
  assert.doesNotMatch(html, /Find your next move\./);
});

test("the Case Board never says 'this browser'; it always says 'this computer'", () => {
  const html = fs.readFileSync("web/course/index.html", "utf8");
  const boardJs = fs.readFileSync("web/course/course-board.js", "utf8");
  const clientJs = fs.readFileSync("web/course/course-client.js", "utf8");
  for (const source of [html, boardJs, clientJs]) assert.doesNotMatch(source, /this browser/i);
  assert.match(html, /<h2 id="evidence-heading">What you found so far<\/h2>/);
  assert.match(boardJs, /The Julia you use will appear here as you solve steps\./);
});

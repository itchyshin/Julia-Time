"use strict";

// Repair 7 (orchestrator browser check, 2026-09-26): a beginner trap. Each step/move runs fresh, so
// a name made in an earlier step (C2's `groups` or `counts`, C5's `events`) does not exist in the
// next one. A learner who wrote `combine(groups, ...)` in C2 step 2 only got Julia's raw
// "UndefVarError: `groups` not defined", with no hint that `groups` was a step 1 name. This pins
// coaching keyed on that exact error text (matching the existing coaching pattern in
// web/chapter2.js / chapter3.js / chapter5.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const chapter2 = require("../web/chapter2.js");
const chapter5 = require("../web/chapter5.js");

test("C2: `groups` carried from step 1 gets named coaching, not just Julia's raw error", () => {
  const line = chapter2.c2ErrorNextStep({status:"error", step:"counts", message:"UndefVarError: `groups` not defined"});
  assert.match(line, /`groups`/);
  assert.match(line, /step 1/);
  assert.match(line, /each step starts fresh/i);
  assert.match(line, /jars/);
});

test("C2: `counts` carried from step 2 gets named coaching", () => {
  const line = chapter2.c2ErrorNextStep({status:"error", step:"rates", message:"UndefVarError: `counts` not defined"});
  assert.match(line, /`counts`/);
  assert.match(line, /step 2/);
  assert.match(line, /each step starts fresh/i);
  assert.match(line, /jars/);
});

test("C5: `events` carried from move 1 gets named coaching in move 2", () => {
  const line = chapter5.recoveryLead("event-frequency", {status:"error", message:"UndefVarError: `events` not defined"}, null);

  assert.match(line, /`events`/);
  assert.match(line, /each run starts fresh/i);
});

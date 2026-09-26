"use strict";

// Repair 7 (orchestrator browser check, 2026-09-26): Chapter 5 step 2's learner code returned a
// plain number (events = sim_counts .>= observed_count; sum(events) / length(events)), value
// 0.113, but the "Julia returned" box fabricated a named tuple (events = Bool[...], frequency =
// 0.113). AGENTS.md rule 3: never invent output. The server now tags that shape "frequency-number"
// (src/mystery_c5.jl); this test pins the client's matching display, plus a thousands separator on
// the trial counts learners read (1000 -> 1,000).
const test = require("node:test");
const assert = require("node:assert/strict");
const c5 = require("../web/chapter5.js");

test("formatCount adds a thousands separator", () => {
  assert.equal(c5.formatCount(1000), "1,000");
  assert.equal(c5.formatCount(6), "6");
  assert.equal(c5.formatCount(0.113), "0.113");
});

test("a plain-number result shows exactly the number, never a fabricated named tuple", () => {
  const data = {kind: "frequency-number", length: 1000, matching: 113, trials: 1000, frequency: 0.113, preview: [true, false, true]};
  const text = c5.juliaReturnedText(data);
  assert.equal(text, "0.113\n113 matching rounds of 1,000 rounds");
  assert.doesNotMatch(text, /events =/, "must not show the named-tuple shape for a plain number");
});

test("a named-tuple result still shows the named tuple, with a thousands separator", () => {
  const data = {kind: "event-frequency", length: 1000, matching: 113, trials: 1000, frequency: 0.113, preview: [true, false, true]};
  const text = c5.juliaReturnedText(data);
  assert.match(text, /^\(events = Bool\[true, false, true, …\], frequency = 0\.113\)/);
  assert.match(text, /113 matching rounds of 1,000 rounds/);
});

// Nit 15 (adversary review 2026-09-26): the "113 matching rounds of 1,000 rounds" line is the
// game's own count, not something Julia printed; the page must label it as the game's note rather
// than showing it as part of "Julia returned".
test("splitJuliaReturned separates what Julia returned from the game's own count line", () => {
  const data = {kind: "frequency-number", length: 1000, matching: 113, trials: 1000, frequency: 0.113, preview: [true, false, true]};
  const {returned, note} = c5.splitJuliaReturned(c5.juliaReturnedText(data));
  assert.equal(returned, "0.113");
  assert.equal(note, "113 matching rounds of 1,000 rounds");
});

test("splitJuliaReturned has no note when Julia's own text carries no second line", () => {
  assert.deepEqual(c5.splitJuliaReturned("0.113"), {returned:"0.113", note:null});
});

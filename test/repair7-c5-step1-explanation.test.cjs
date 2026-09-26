"use strict";

// Repair 7 (orchestrator browser check, 2026-09-26): C5 step 1's success text was jargon and
// ungrammatical ("The event mask marks exactly the simulated counts at least the observed
// count."), and the explanation line always printed "Limit: " even when empty. The bible says step
// 1 has no limit line (step 2 carries it), so the client must omit "Limit:" entirely rather than
// show it empty.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const c5 = require("../web/chapter5.js");

test("C5 step 1's pass message is plain, not jargon", () => {
  const source = fs.readFileSync(require.resolve("../src/mystery_c5.jl"), "utf8");
  assert.doesNotMatch(source, /The event mask marks exactly the simulated counts at least the observed count\./);
});

test("explanationText omits an empty Limit rather than showing it blank", () => {
  const text = c5.explanationText({julia: "J.", case: "C.", limit: ""});
  assert.equal(text, "Julia: J. Case: C.");
  assert.doesNotMatch(text, /Limit:/);
});

test("explanationText keeps a real Limit line", () => {
  const text = c5.explanationText({julia: "J.", case: "C.", limit: "L."});
  assert.equal(text, "Julia: J. Case: C. Limit: L.");
});

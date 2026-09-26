"use strict";

// Owner playtest (2026-09-26): in Chapter 5 the practice example's name (practice_target) was typed into the real
// task and the page only said "Julia could not run this code". A practice-only name now gets a plain line naming
// the case's real input instead. Chapter 2 (practice_jars) and Chapter 3 (placeholders) already had one.
const test = require("node:test");
const assert = require("node:assert/strict");
const c5 = require("../web/chapter5.js");
const c6 = require("../web/chapter6.js");
const err = name => ({status:"error", pass:false, message:"UndefVarError: `" + name + "` not defined"});

test("Chapter 5 names the real input when a practice name is used", () => {
  for (const name of ["practice_target", "practice_counts"]) {
    const line = c5.challengeRecovery("event-mask", err(name), null);
    assert.match(line, new RegExp(name + " is a name from the practice example"));
    assert.match(line, /sim_counts/); assert.match(line, /observed_count/);
  }
});

test("Chapter 6 names the real inputs when a practice name is used", () => {
  for (const name of ["practice_pass", "practice_stays", "practice_fails"]) {
    const line = c6.challengeRecovery(err(name));
    assert.match(line, new RegExp(name + " is a name from the practice example"));
    assert.match(line, /stories/); assert.match(line, /observed_count/);
  }
});

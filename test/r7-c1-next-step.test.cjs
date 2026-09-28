"use strict";
// Round 7 (r7-r-struggling #8 and runners-up, 2026-09-28).
// #8: C1 added the fixed "Next step: read the batch_id column as a list, make a true-or-false row rule"
// right after "Close: you gave the rows", which the learner had already done. The fixed step is shown only
// where it fits the mistake, and never with a server coaching line.
// Runner-up: C1 warm-up 1's jars[1:3] (R picks columns with df[1:3]) got the generic "Check the names and
// brackets" line; this is practice, so the page names the fix.
const test = require("node:test");
const assert = require("node:assert/strict");
const mystery = require("../web/mystery.js");

const SHARED = "Next step: read the batch_id column as a list, make a true-or-false row rule from it, then open “Show the idea” under “Stuck? Hints” below if you need to place that rule in the table.";
const NO_COLUMNS = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching getindex(::DataFrames.DataFrame, ::BitVector)";
const PLAIN_EQ = "Something went wrong running this line.\n\nArgumentError: invalid row index of type Bool";
const RANGE_ONLY = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching getindex(::DataFrames.DataFrame, ::UnitRange{Int64})";

test("a learner who already made the row rule is not told to make one", () => {
  for (const message of [NO_COLUMNS, PLAIN_EQ]) {
    const line = mystery.challengeRecovery({status:"error", pass:false, message});
    assert.equal(line.includes(SHARED), false, message);
    assert.doesNotMatch(line, /make a true-or-false row rule/);
    assert.match(line, /Change your code, then run again, or open Stuck\? Hints below\.$/);
  }
  assert.match(mystery.challengeRecovery({status:"error", pass:false, message:NO_COLUMNS}), /^Close: you gave the rows/);
});

test("the fixed next step stays where it fits, and never with a server coaching line", () => {
  const dollar = mystery.challengeRecovery({status:"error", pass:false, message:"UndefVarError: `$` not defined"});
  assert.ok(dollar.endsWith(SHARED));
  assert.equal(mystery.challengeRecovery({status:"error", pass:false, message:"UndefVarError: `x` not defined"}), SHARED);
  const coached = mystery.challengeRecovery({status:"error", pass:false, message:NO_COLUMNS, coaching:"Julia assigns with =, not <-."});
  assert.equal(coached.includes("Next step:"), false);
  assert.equal(coached.includes("Close:"), false);
});

test("warm-up 1: jars[1:3] is told to add , : after 1:3", () => {
  const line = mystery.practiceFeedback("jars[1:3]", {status:"error", pass:false, message:RANGE_ONLY});
  assert.match(line, /^Add a comma and a colon after 1:3 to keep every column: jars\[1:3, :\]/);
  assert.match(mystery.practiceFeedback(" jars[ 1:3 ] ", {status:"error", pass:false, message:RANGE_ONLY}), /^Add a comma and a colon after 1:3/);
  // Only that shape: another error keeps the generic line, and a server coaching line still comes first.
  assert.match(mystery.practiceFeedback("jars[1:3, 7]", {status:"error", pass:false, message:"BoundsError"}), /^Julia could not run this expression/);
  assert.match(mystery.practiceFeedback("jars[1:3]", {status:"error", pass:false, message:RANGE_ONLY, coaching:"Server line."}), /^Server line\./);
});

"use strict";

// v0.2.5 night (fixer I1): a rejected run whose reply carries a non-empty "coaching" line
// (src/mystery_c2.jl .. src/mystery_c6.jl) leads with that line. The page's generic "That result
// did not meet the stated check" line and any page-built guess that contradicts it are dropped.
// With empty coaching the pages behave as before, and coaching never shows on an accepted run.
const test = require("node:test");
const assert = require("node:assert/strict");
const c2 = require("../web/chapter2.js");
const c3 = require("../web/chapter3.js");
const c4 = require("../web/chapter4.js");
const c5 = require("../web/chapter5.js");
const c6 = require("../web/chapter6.js");

const ARROW = "Julia assigns with =, not <-. Julia read your <- as \"is less than minus\", a comparison, so nothing was stored. Write = where you wrote <-.";
const DPLYR = "summarise and n() are R's (dplyr) names. In Julia, combine makes one summary row per tray, and nrow counts the jars in each tray.";
const BRACKETS = "Each comparison needs its own brackets. Without them, Julia joins the two values next to .& first, then compares, so the rows come out wrong. Put brackets around each comparison, as in (a .<= b) .& (c .<= d).";
const GENERIC = "That result did not meet the stated check.";
const undefName = name => name + " is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `" + name + "` not defined";

test("C2: summarise with n = n() leads with the dplyr line, not the combine column guess", () => {
  const message = {type:"case_result", chapter:"C2", step:"counts", status:"error", pass:false, message:undefName("n"), feedback:DPLYR, coaching:DPLYR, explanation:{julia:"Return the requested result for this step."}, rows:[], columns:[], value_repr:""};
  const text = c2.resultText(message);
  assert.ok(text.startsWith(DPLYR));
  assert.doesNotMatch(text, /new column that combine makes/);
});

test("C2: counts <- combine(...) in step 2 leads with the arrow line, not the step 2 carry-over guess", () => {
  const message = {type:"case_result", chapter:"C2", step:"counts", status:"error", pass:false, message:undefName("counts"), feedback:ARROW, coaching:ARROW, rows:[], columns:[], value_repr:""};
  const text = c2.resultText(message);
  assert.ok(text.startsWith(ARROW));
  assert.doesNotMatch(text, /was made in step/);
});

test("C2: empty coaching keeps the page's own line", () => {
  const message = {type:"case_result", chapter:"C2", step:"counts", status:"error", pass:false, message:undefName("counts"), feedback:"", coaching:"", rows:[], columns:[], value_repr:""};
  assert.match(c2.resultText(message), /`counts` was made in step 2/);
});

test("C5: sum(events) and length(...)/1000 lead with the server line and drop the generic line", () => {
  for (const [value, coaching] of [["474", "474 is how many rounds matched. Divide it by all rounds to get how often it happened."],
                                    ["1.0", "Your line divides every round by every round, so it always gives 1.0: length counts every round; sum counts the matches."]]) {
    const message = {type:"case_result", status:"ok", pass:false, move_id:"event-frequency", value_repr:value, feedback:coaching, coaching};
    const text = c5.challengeRecovery("event-frequency", message, null);
    assert.ok(text.startsWith(coaching), text);
    assert.ok(!text.includes(GENERIC), text);
    assert.match(text, /Stuck\? Hints/);
  }
});

test("C5: <- in step 1 leads with the arrow line instead of the error pointer", () => {
  const message = {type:"case_result", status:"error", pass:false, move_id:"event-mask", message:undefName("events"), feedback:ARROW, coaching:ARROW};
  const text = c5.challengeRecovery("event-mask", message, null);
  assert.ok(text.startsWith(ARROW));
  assert.doesNotMatch(text, /Original Julia error/);
});

test("C5 and C6: empty or missing coaching keeps the old text", () => {
  const plain = {type:"case_result", status:"ok", pass:false, move_id:"event-frequency", value_repr:"0.5", coaching:""};
  assert.ok(c5.challengeRecovery("event-frequency", plain, null).startsWith(GENERIC));
  assert.ok(c6.challengeRecovery({status:"ok", pass:false}).startsWith(GENERIC));
});

test("C6: no brackets leads with the brackets line and drops the add-a-dot guess", () => {
  const message = {status:"error", pass:false, message:"MethodError: no method matching &(::Int64, ::Vector{Int64})", feedback:BRACKETS, coaching:BRACKETS};
  const text = c6.challengeRecovery(message);
  assert.ok(text.startsWith(BRACKETS));
  assert.doesNotMatch(text, /Add a dot/);
  const ran = c6.challengeRecovery({status:"ok", pass:false, feedback:BRACKETS, coaching:BRACKETS});
  assert.ok(ran.startsWith(BRACKETS));
  assert.ok(!ran.includes(GENERIC));
});

test("C3 and C4: an error run with the arrow line leads with it", () => {
  const c3Message = {status:"error", pass:false, message:undefName("joined"), feedback:ARROW, coaching:ARROW};
  assert.ok(c3.errorRecovery("join-report-log", c3Message).startsWith(ARROW));
  const c4Message = {status:"error", pass:false, message:undefName("picks"), feedback:ARROW, coaching:ARROW};
  assert.ok(c4.recoveryCopy(c4Message).startsWith(ARROW));
});

test("coaching never shows on an accepted run", () => {
  const accepted = {status:"ok", pass:true, coaching:ARROW, feedback:"Julia checked it."};
  assert.ok(!c2.resultText(Object.assign({step:"counts"}, accepted)).includes(ARROW));
  assert.ok(!c5.challengeRecovery("event-frequency", accepted, null).includes(ARROW));
  assert.ok(!c6.challengeRecovery(accepted).includes(ARROW));
  assert.ok(!c3.errorRecovery("join-report-log", accepted).includes(ARROW));
  assert.ok(!c4.recoveryCopy(accepted).includes(ARROW));
});

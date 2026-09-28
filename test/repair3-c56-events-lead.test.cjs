"use strict";

// Repair round 3, slice C56, R1 (2026-09-24 simulated-student re-test: P38, H09, H02, P10, H10).
// In C5 Move 2 a student returned the count of events instead of the events themselves:
// (events = 113, frequency = 0.113). The frequency was right, but the page showed only the shared
// "did not meet the stated check" step. The server's own feedback is still not passed through,
// because other server messages print the answer. Instead a lead is keyed on Julia's actual
// returned value: an events field that is not a true-or-false vector. The value_repr strings below
// were measured on this machine's Julia 1.10.0 through JuliaTime.handle_message.
const test = require("node:test");
const assert = require("node:assert/strict");
const c5 = require("../web/chapter5.js");

const EM_DASH = /—/;
const CASE_ID = "missing-fleas-v1";
const COUNTS = [0, 2, 3, 3, 5, 6];
function c5Pending(move) {
  let state = c5.beginInfo(c5.createState(), "c5-info", move);
  state = c5.applyCaseInfo(state, {
    type:"case", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:move,
    mode:"challenge", activity_id:null, simulation_id:"opaque-server-simulation-42", request_id:"c5-info",
    n_jars:6, p_ref:0.5, observed_count:3, n_trials:COUNTS.length,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:COUNTS.map((count, index) => ({simulation:index + 1, count}))}]
  });
  return c5.beginRun(state, "c5-run", move);
}
function c5Result(move, overrides) {
  return Object.assign({
    type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:move,
    mode:"challenge", activity_id:null, simulation_id:"opaque-server-simulation-42", request_id:"c5-run",
    status:"ok", pass:false, progress_eligible:false, value_repr:"", result_data:null
  }, overrides || {});
}
function rejected(move, value_repr, feedback) {
  const state = c5.applyCaseResult(c5Pending(move), c5Result(move, {value_repr, feedback:feedback || ""}));
  assert.equal(state.runFailure.status, "rejected", value_repr);
  return state.runFailure;
}
const NO_ANSWER = /sim_counts\s*\.>=|observed_count|sum\(events\)|length\(events\)/;

// Measured: each of these came back with status ok, pass false and server feedback
// "The events field needs one true-or-false value for every round."
const EVENTS_NOT_A_MASK = [
  "(events = 113, frequency = 0.113)",
  "(events = true, frequency = 0.113)",
  "(events = [0, 0, 1], frequency = 0.3)",
  "(events = [0, 0, 1, 1, 0, 0, 0, 0, 0, 0  …  0, 0, 1, 0, 0, 0, 0, 0, 0, 0], frequency = 0.113)"
];

test("R1: an events field that is not a true-or-false vector gets a lead keyed on the returned value", () => {
  const shared = c5.challengeRecovery("event-frequency");
  for (const repr of EVENTS_NOT_A_MASK) {
    const failure = rejected("event-frequency", repr, "The events field needs one true-or-false value for every round.");
    assert.notEqual(failure.feedback, shared, repr);
    assert.match(failure.feedback, /events/, repr);
    assert.match(failure.feedback, /true-or-false/, repr);
    assert.match(failure.feedback, /every round/, repr);
    assert.match(failure.feedback, /not a count/i, repr);
    assert.match(failure.feedback, /Step 1/, repr);
    // Round 7 (r7-r-struggling #8): a specific lead drops the fixed "did not meet the stated check".
    assert.ok(failure.feedback.endsWith(" Your draft is still here. Change it and run again, or open Stuck? Hints below."), `${repr}: the lead ends as a coaching line does`);
    assert.doesNotMatch(failure.feedback, /did not meet the stated check/, repr);
    assert.doesNotMatch(failure.feedback, NO_ANSWER, `${repr}: no answer leak`);
    assert.doesNotMatch(failure.feedback, EM_DASH, repr);
    assert.equal(failure.value_repr, repr, "Julia's actual returned value still reaches the page verbatim");
  }
});

test("R1: a vector of true and false values keeps the shared step only, so no hint gives away the values", () => {
  const shared = c5.challengeRecovery("event-frequency");
  for (const repr of [
    "(events = Bool[0, 0, 1, 1, 1, 1], frequency = 0.5)",
    "(events = Bool[0, 0, 1, 1, 0, 0], frequency = 0.5)",
    "(events = Bool[0, 0, 1, 0, 0, 0, 0, 0, 0, 0  …  0, 0, 0, 0, 0, 0, 0, 0, 0, 0], frequency = 0.018)",
    "(events = Any[false, false, true, true, true, true], frequency = 0.5)",
    "(events = Union{Missing, Bool}[false, false, true, true, true, true], frequency = 0.5)"
  ]) {
    assert.equal(rejected("event-frequency", repr).feedback, shared, repr);
  }
});

test("R1: the lead stays on Move 2, needs a returned pair, and never forwards the server's own feedback", () => {
  assert.equal(rejected("event-mask", "(events = 113, frequency = 0.113)").feedback, c5.challengeRecovery("event-mask"), "Step 1 does not ask for the pair");
  // A bare number is now a valid returned shape (the taught plain-number answer); whether 113 is the
  // right number is the server's call, so the client gives the shared step only, not a shape lead.
  assert.equal(rejected("event-frequency", "113").feedback, c5.challengeRecovery("event-frequency"), "a bare number keeps the shared step, since a plain number is now a valid shape");
  // Repair 7 (2026-09-26): `events` is made in move 1 and does not survive to a fresh move 2 run,
  // so this specific error now gets its own named coaching (the fresh-start beginner trap) instead
  // of falling through to the shared step alone.
  const error = c5.applyCaseResult(c5Pending("event-frequency"), c5Result("event-frequency", {status:"error", message:"UndefVarError: `events` not defined", value_repr:""}));
  // Audit 2026-09-27 (design rule 2): this lead used to spell out the finished step-2 code line;
  // it now says only what is missing, in words, and must not leak it either.
  assert.match(error.runFailure.feedback, /Nothing from Step 1 is kept between runs, so events is not defined here/);
  assert.doesNotMatch(error.runFailure.feedback, NO_ANSWER, "the fresh-start coaching no longer leaks the step 2 code");
  assert.ok(error.runFailure.feedback.endsWith(c5.challengeRecovery("event-frequency", {status:"error"})));

  // Other server messages print the answer. The page must not pass any of them through.
  const leaking = rejected("event-frequency", "(events = 113, frequency = 0.113)", "The events field must use sim_counts .>= observed_count exactly.");
  assert.doesNotMatch(leaking.feedback, NO_ANSWER);
  assert.doesNotMatch(leaking.feedback, /exactly/);
});

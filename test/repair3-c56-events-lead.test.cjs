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
// "The events field needs one Boolean value for every simulated trial."
const EVENTS_NOT_A_MASK = [
  "(events = 113, frequency = 0.113)",
  "(events = true, frequency = 0.113)",
  "(events = [0, 0, 1], frequency = 0.3)",
  "(events = [0, 0, 1, 1, 0, 0, 0, 0, 0, 0  …  0, 0, 1, 0, 0, 0, 0, 0, 0, 0], frequency = 0.113)"
];

test("R1: an events field that is not a true-or-false vector gets a lead keyed on the returned value", () => {
  const shared = c5.challengeRecovery("event-frequency");
  for (const repr of EVENTS_NOT_A_MASK) {
    const failure = rejected("event-frequency", repr, "The events field needs one Boolean value for every simulated trial.");
    assert.notEqual(failure.feedback, shared, repr);
    assert.match(failure.feedback, /events/, repr);
    assert.match(failure.feedback, /true-or-false/, repr);
    assert.match(failure.feedback, /every simulation/, repr);
    assert.match(failure.feedback, /not a count/i, repr);
    assert.match(failure.feedback, /Move 1/, repr);
    assert.ok(failure.feedback.endsWith(shared), `${repr}: the lead sits in front of the unchanged shared step`);
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
  assert.equal(rejected("event-mask", "(events = 113, frequency = 0.113)").feedback, c5.challengeRecovery("event-mask"), "Move 1 does not ask for the pair");
  assert.match(rejected("event-frequency", "113").feedback, /labelled pair/i, "a bare count keeps the existing labelled-pair lead");
  const error = c5.applyCaseResult(c5Pending("event-frequency"), c5Result("event-frequency", {status:"error", message:"UndefVarError: `events` not defined", value_repr:""}));
  assert.equal(error.runFailure.feedback, c5.challengeRecovery("event-frequency", {status:"error"}), "an error has no returned value to judge");

  // Other server messages print the answer. The page must not pass any of them through.
  const leaking = rejected("event-frequency", "(events = 113, frequency = 0.113)", "The events field must use sim_counts .>= observed_count exactly.");
  assert.doesNotMatch(leaking.feedback, NO_ANSWER);
  assert.doesNotMatch(leaking.feedback, /exactly/);
});

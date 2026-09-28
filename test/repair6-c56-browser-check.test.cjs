"use strict";

// Repair round 6, slice C56 (2026-09-24 real-browser check of Chapters 5 and 6), items 1 to 7.
// Every Julia reply below is real: captured with JuliaTime.handle_message on this machine's
// Julia 1.10.0 on 2026-09-24, and copied verbatim (value_repr, result_data, message, feedback).
// These tests protect what the learner sees; they do not claim that a human has learned.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c5 = require("../web/chapter5.js");
const c6 = require("../web/chapter6.js");

const web = name => fs.readFileSync(path.join(__dirname, "../web", name), "utf8");
const EM_DASH = /—/;
const CASE_ID = "missing-fleas-v1";
const SIMULATION_ID = "c5-simulated-counts-v1";
const NO_ANSWER = /sim_counts\s*\.>=|observed_count|sum\(events\)|length\(events\)|0\.113|\b113\b/;

// The real 1,000 simulated counts (JuliaTime.mystery_c5_sim_counts(), seed 5107), one digit each.
const REAL_COUNTS = (
  "2365143234321544333342344066450312334334342244231434422432332434135125221264444546333334324515122134" +
  "2331354454454323333414224541432325364034143043443432434332316133254323222144255133442151415354242143" +
  "2234532222433313505552323314224442335443423414252441245633033434323245501143213134341531344545443333" +
  "4511241231323333121435464414233124533223324453343542322222143234243223322343443342203344322332223334" +
  "3545425524444232424443332424362435161432423433544411513032233244144251350113345432333532443536442222" +
  "5224553413441350334345324324543235332632234211344323343542454142334133322352323445243345222343332342" +
  "4522021323354242463312244433424343343223243343250514444323443434434321322222044342023353412413344243" +
  "2445453552235123313442313331442315212453521335245333246344121405331323423231432413434334431334522033" +
  "4232323532344212214323423444433324244242323321112212345434233233344333352332132623523433342253453333" +
  "3343234153233653533233333536443434435343332353253422351422243243322421433254214213541333333352224133"
).split("").map(Number);
const OBSERVED = 5;

function realC5Info(move, request_id) {
  return {
    type:"case", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:move, mode:"challenge",
    activity_id:null, simulation_id:SIMULATION_ID, request_id:request_id || "c5-info",
    n_jars:6, p_ref:0.5, observed_count:OBSERVED, n_trials:1000,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:REAL_COUNTS.map((count, index) => ({simulation:index + 1, count}))}]
  };
}
function c5Ready(state, move, infoId) {
  state = c5.beginInfo(state, infoId, move);
  state = c5.applyCaseInfo(state, realC5Info(move, infoId));
  assert.ok(state.metadata, "the real metadata is valid");
  return state;
}
function c5Reply(move, request_id, fields) {
  return Object.assign({type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:move, mode:"challenge", activity_id:null, simulation_id:SIMULATION_ID, request_id}, fields);
}
function c5Run(state, move, request_id, fields) {
  state = c5.beginRun(state, request_id, move);
  return c5.applyCaseResult(state, c5Reply(move, request_id, fields));
}
const F = false, T = true;
const BITVECTOR = rows => "1000-element BitVector:\n " + rows.join("\n ");

// Move 1: sim_counts .>= observed_count (accepted).
const ACCEPTED_MASK = {status:"ok", pass:true, progress_eligible:true, message:"",
  feedback:"The event mask marks exactly the simulated counts at least the observed count.",
  value_repr:BITVECTOR([0, 0, 1, 1, 0, 0, 0, 0, 0, 0, "⋮", 0, 1, 0, 0, 0, 0, 0, 0, 0]),
  result_data:{kind:"boolean-vector", length:1000, true_count:113, preview:[F, F, T, T, F, F, F, F, F, F, F, F, F, T, F, F, F, F, F, F]}};
// Move 1: sim_counts .> observed_count. The same value came back for sim_counts .>= observed_count + 1.
const STRICT_MASK = {status:"ok", pass:false, progress_eligible:false, message:"",
  feedback:"Check the direction: an event is a round's count at least the observed count.",
  value_repr:BITVECTOR([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, "⋮", 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  result_data:{kind:"boolean-vector", length:1000, true_count:18, preview:[F, F, T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F]}};
// Move 1: sim_counts .== observed_count and sim_counts .< observed_count.
const EQUAL_MASK = {status:"ok", pass:false, progress_eligible:false, message:"",
  feedback:"Check the direction: an event is a round's count at least the observed count.",
  value_repr:BITVECTOR([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, "⋮", 0, 1, 0, 0, 0, 0, 0, 0, 0]),
  result_data:{kind:"boolean-vector", length:1000, true_count:95, preview:[F, F, F, T, F, F, F, F, F, F, F, F, F, T, F, F, F, F, F, F]}};
const BELOW_MASK = {status:"ok", pass:false, progress_eligible:false, message:"",
  feedback:"Check the direction: an event is a round's count at least the observed count.",
  value_repr:BITVECTOR([1, 1, 0, 0, 1, 1, 1, 1, 1, 1, "⋮", 1, 0, 1, 1, 1, 1, 1, 1, 1]),
  result_data:{kind:"boolean-vector", length:1000, true_count:887, preview:[T, T, F, F, T, T, T, T, T, T, T, T, T, F, T, T, T, T, T, T]}};
// Move 1: sim_counts >= observed_count (no dot).
const NO_DOT_ERROR = {status:"error", pass:false, progress_eligible:false, value_repr:"", result_data:null,
  feedback:"Julia did not complete this move. Keep the supplied inputs unchanged, then try again.",
  message:"A function was called with the wrong kind of argument.\n\nMethodError: no method matching isless(::Int64, ::Vector{Int64})\n\nClosest candidates are:\n  isless(!Matched::Missing, ::Any)\n   @ Base missing.jl:87\n  isless(::Any, !Matched::Missing)\n   @ Base missing.jl:88\n  isless(::Real, !Matched::Union{StatsBase.PValue, StatsBase.TestStat})\n   @ StatsBase ~/.julia/packages/StatsBase/TkBxP/src/statmodels.jl:38\n  ...\n"};
// Move 2: events = sim_counts .>= observed_count; (events=events, frequency=sum(events)/length(events)) (accepted).
const ACCEPTED_FREQUENCY = {status:"ok", pass:true, progress_eligible:true, message:"",
  feedback:"The named event mask and matching-events / all-trials frequency agree.",
  value_repr:"(events = Bool[0, 0, 1, 1, 0, 0, 0, 0, 0, 0  …  0, 0, 1, 0, 0, 0, 0, 0, 0, 0], frequency = 0.113)",
  result_data:{kind:"event-frequency", length:1000, matching:113, trials:1000, frequency:0.113, preview:[F, F, T, T, F, F, F, F, F, F, F, F, F, T, F, F, F, F, F, F]}};
// Move 2: the same pair built on sim_counts .> observed_count.
const STRICT_FREQUENCY = {status:"ok", pass:false, progress_eligible:false, message:"",
  feedback:"The events field must use sim_counts .>= observed_count exactly.",
  value_repr:"(events = Bool[0, 0, 1, 0, 0, 0, 0, 0, 0, 0  …  0, 0, 0, 0, 0, 0, 0, 0, 0, 0], frequency = 0.018)",
  result_data:{kind:"event-frequency", length:1000, matching:18, trials:1000, frequency:0.018, preview:[F, F, T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F]}};

const C6_COLUMNS = ["story", "p", "lower", "upper"];
const C6_ROWS = [
  {lower:0, story:"Vanishing", p:0.1, upper:2},
  {lower:1, story:"Coin flip", p:0.5, upper:5},
  {lower:4, story:"Thriving", p:0.8, upper:6}
];
function c6Ready() {
  let state = c6.beginInfo(c6.createState(), "c6-info");
  state = c6.applyCaseInfo(state, {type:"case", contract_version:1, case_id:CASE_ID, chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null, request_id:"c6-info", observed_count:5, n_trials:6, inputs:[{id:"stories", columns:C6_COLUMNS, rows:C6_ROWS}]});
  assert.ok(state.metadata);
  return state;
}
function c6Run(request_id, fields) {
  const state = c6.beginRun(c6Ready(), request_id);
  return c6.applyCaseResult(state, Object.assign({type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null, request_id}, fields));
}
// stories[(stories.lower .<= observed_count) && (observed_count .<= stories.upper), :]
const C6_ANDAND = {status:"error", pass:false, progress_eligible:false, value_repr:"", result_data:null,
  feedback:"Julia did not complete this move. Keep the supplied inputs unchanged, then try again.",
  message:"Something went wrong running this line.\n\nTypeError: non-boolean (BitVector) used in boolean context"};
// stories[(lower .<= observed_count) .& (observed_count .<= upper), :]
const C6_UNDEFINED = {status:"error", pass:false, progress_eligible:false, value_repr:"", result_data:null,
  feedback:"Julia did not complete this move. Keep the supplied inputs unchanged, then try again.",
  message:"lower is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `lower` not defined"};
// stories[stories.lower .<= observed_count, :]
const C6_LOWER_ONLY = {status:"ok", pass:false, progress_eligible:false, message:"",
  feedback:"Return every candidate whose displayed bounds contain the observation, once each.",
  value_repr:"3×4 DataFrame\n Row │ story      p        lower  upper\n     │ String     Float64  Int64  Int64\n─────┼──────────────────────────────────\n   1 │ Vanishing      0.1      0      2\n   2 │ Coin flip      0.5      1      5\n   3 │ Thriving       0.8      4      6",
  result_data:{kind:"table", columns:C6_COLUMNS, rows:C6_ROWS}};
// The reference answer (accepted).
const C6_ACCEPTED_DATA = {kind:"table", columns:C6_COLUMNS, rows:[C6_ROWS[1], C6_ROWS[2]]};

test("the real counts fixture matches the captured totals", () => {
  assert.equal(REAL_COUNTS.length, 1000);
  assert.equal(REAL_COUNTS.filter(count => count >= OBSERVED).length, 113);
  assert.equal(REAL_COUNTS.filter(count => count === OBSERVED).length, 95);
  assert.equal(REAL_COUNTS.filter(count => count > OBSERVED).length, 18);
});

// ---- 1. The move line says Move 2 is done once it is ----
test("item 1: after Move 2 is accepted the move line says Move 2 is done, not that it is now open", () => {
  assert.equal(typeof c5.moveLockText, "function");
  let state = c5.createState();
  assert.equal(c5.moveLockText(state), "Complete and run Step 1 to unlock Step 2.");

  state = c5Run(c5Ready(state, "event-mask", "c5-info-1"), "event-mask", "c5-run-1", ACCEPTED_MASK);
  assert.ok(state.evidence, "the real Move 1 answer is accepted");
  assert.equal(c5.moveLockText(state), "Step 1 is done: every round is marked. Step 2 is open.");

  state = c5Run(c5Ready(state, "event-frequency", "c5-info-2"), "event-frequency", "c5-run-2", ACCEPTED_FREQUENCY);
  assert.ok(state.evidence, "the real Move 2 answer is accepted");
  const done = c5.moveLockText(state);
  assert.match(done, /Step 2 is done/);
  assert.doesNotMatch(done, /now open/);
  assert.doesNotMatch(done, EM_DASH);

  // It stays done when the learner looks back at Move 1 or runs another draft.
  state = c5Ready(state, "event-mask", "c5-info-3");
  assert.equal(c5.moveLockText(state), done);
  state = c5Run(state, "event-mask", "c5-run-3", STRICT_MASK);
  assert.equal(c5.moveLockText(state), done);

  const source = web("chapter5.js");
  assert.match(source, /el\.moveLock\.textContent\s*=\s*moveLockText\(state\)/, "the page renders this line");
  assert.match(source, /state\.secondAccepted\s*=\s*acceptedMoveKeys\(course,\s*storage,\s*attempt\)\.includes\("C5\/event-frequency"\)/, "a reload after Move 2 still says done");
});

// ---- 2. Move 2's evidence area fits Move 2 ----
test("item 2: once Move 1 is done, the evidence area shows Move 2 text instead of Move 1 text", () => {
  assert.equal(typeof c5.evidenceNotes, "function");
  const first = c5.evidenceNotes(realC5Info("event-mask"), "event-mask");
  assert.equal(first.distribution, "Each bar is the number of rounds with that count. Your next Julia step will name the bars for counts of at least 5.", "Step 1 is unchanged");
  assert.match(first.comparison, /so it returns one true-or-false answer per round/, "Step 1 is unchanged");

  const second = c5.evidenceNotes(realC5Info("event-frequency"), "event-frequency");
  for (const text of [second.distribution, second.comparison]) {
    assert.doesNotMatch(text, /Your next Julia step will name the bars/);
    assert.doesNotMatch(text, /so it returns one true-or-false answer per round/);
    assert.match(text, /Step 1/);
    assert.match(text, /fraction of all/);
    assert.doesNotMatch(text, EM_DASH);
    assert.doesNotMatch(text, NO_ANSWER, "no code and no answer");
  }
  assert.match(second.distribution, /counts of at least 5 are the event/);
  assert.match(second.distribution, /1,000 rounds/);
  assert.match(second.comparison, /not a second dataset; it does not count for the case/);

  const source = web("chapter5.js");
  assert.match(source, /evidenceNotes\(state\.metadata,\s*state\.activeMove\)/, "the page passes the active move");
});

// ---- 3. A strict comparison gets a lead keyed on the returned value ----
test("item 3: the real strict-comparison result gets a lead about equal counts, keyed on the returned value", () => {
  const shared = c5.challengeRecovery("event-mask");
  const failure = c5Run(c5Ready(c5.createState(), "event-mask", "c5-info"), "event-mask", "c5-run", STRICT_MASK).runFailure;
  assert.equal(failure.status, "rejected");
  assert.notEqual(failure.feedback, shared);
  assert.match(failure.feedback, /“at least the observed count”/);
  assert.match(failure.feedback, /equal to the observed count/);
  assert.match(failure.feedback, /\.>= means at least/);
  assert.match(failure.feedback, /\.> means greater than/);
  // Round 7 (r7-r-struggling #8): a specific lead drops the fixed "did not meet the stated check".
  assert.ok(failure.feedback.endsWith(" Your draft is still here. Change it and run again, or open Stuck? Hints below."), "the lead ends as a coaching line does");
  assert.doesNotMatch(failure.feedback, /did not meet the stated check/);
  assert.doesNotMatch(failure.feedback, NO_ANSWER, "no answer leak");
  assert.doesNotMatch(failure.feedback, EM_DASH);
  assert.equal(failure.value_repr, STRICT_MASK.value_repr, "Julia's actual returned value still reaches the page verbatim");

  // The same mistake inside the Move 2 pair gets the same lead, after the pair checks.
  let state = c5Run(c5Ready(c5.createState(), "event-mask", "c5-info-1"), "event-mask", "c5-run-1", ACCEPTED_MASK);
  state = c5Run(c5Ready(state, "event-frequency", "c5-info-2"), "event-frequency", "c5-run-2", STRICT_FREQUENCY);
  assert.equal(state.runFailure.status, "rejected");
  assert.match(state.runFailure.feedback, /“at least the observed count”/);
  assert.ok(state.runFailure.feedback.endsWith(" Your draft is still here. Change it and run again, or open Stuck? Hints below."));
  assert.doesNotMatch(state.runFailure.feedback, NO_ANSWER);
});

test("item 3: other returned values and errors do not get the equal-counts lead", () => {
  for (const reply of [EQUAL_MASK, BELOW_MASK]) {
    const failure = c5Run(c5Ready(c5.createState(), "event-mask", "c5-info"), "event-mask", "c5-run", reply).runFailure;
    assert.equal(failure.feedback, c5.challengeRecovery("event-mask"), `true_count ${reply.result_data.true_count}`);
  }
  // Same true count but a different preview is not the strict comparison.
  const shuffled = Object.assign({}, STRICT_MASK, {result_data:Object.assign({}, STRICT_MASK.result_data, {preview:STRICT_MASK.result_data.preview.slice().reverse()})});
  assert.equal(c5Run(c5Ready(c5.createState(), "event-mask", "c5-info"), "event-mask", "c5-run", shuffled).runFailure.feedback, c5.challengeRecovery("event-mask"));
  // Without the case metadata nothing can be judged.
  assert.equal(c5.challengeRecovery("event-mask", STRICT_MASK), c5.challengeRecovery("event-mask"));
  const error = c5Run(c5Ready(c5.createState(), "event-mask", "c5-info"), "event-mask", "c5-run", NO_DOT_ERROR).runFailure;
  assert.doesNotMatch(error.feedback, /“at least the observed count”/);
});

// ---- 4. An error run ends with words that are true for an error ----
test("item 4: C6 and C5 error runs end with next steps that fit an error, not 'did not meet the stated check'", () => {
  const andand = c6Run("c6-andand", C6_ANDAND);
  assert.equal(c6.runOutcomeStatus(andand.runFailure), "Not yet. Julia could not run this code. Your code is still here.");
  const errorShared = c6.challengeRecovery({status:"error"});
  // Replay notes (2026-09-27): the shown outcome above already says "Your code is still here", so
  // an error's challengeRecovery text no longer repeats the same idea as "Your draft is still here".
  for (const text of [andand.runFailure.message, c6Run("c6-undefined", C6_UNDEFINED).runFailure.message]) {
    assert.doesNotMatch(text, /did not meet the stated check/);
    assert.doesNotMatch(text, /Your draft is still here/);
    assert.match(text, /Original Julia error below/);
    assert.match(text, /run again/);
    assert.ok(text.endsWith(errorShared), "one shared error step");
    assert.doesNotMatch(text, /stories|observed_count/);
    assert.doesNotMatch(text, EM_DASH);
  }
  assert.match(andand.runFailure.message, /&&/, "the && lead is kept");
  assert.equal(andand.runFailure.original_error, C6_ANDAND.message, "Julia's own error text stays verbatim");
  // A run that returned a value keeps the wording about the returned result.
  assert.match(c6Run("c6-lower", C6_LOWER_ONLY).runFailure.message, /^That result did not meet the stated check\./);

  // Same kind (Rose sweep): C5 error runs.
  const c5Error = c5Run(c5Ready(c5.createState(), "event-mask", "c5-info"), "event-mask", "c5-run", NO_DOT_ERROR).runFailure.feedback;
  assert.match(c5Error, /without a dot/, "the no-dot lead is kept");
  assert.doesNotMatch(c5Error, /did not meet the stated check/);
  assert.ok(c5Error.endsWith(c5.challengeRecovery("event-mask", {status:"error"})));
  assert.match(c5Error, /Original Julia error below/);
  assert.doesNotMatch(c5Error, EM_DASH);
  assert.match(c5Run(c5Ready(c5.createState(), "event-mask", "c5-info"), "event-mask", "c5-run", EQUAL_MASK).runFailure.feedback, /^That result did not meet the stated check\./);

  for (const page of ["chapter5.js", "chapter6.js"]) assert.match(web(page), /summary\.textContent\s*=\s*"Original Julia error"/, `${page} really shows that label`);
});

// ---- 5. Story cards show p unless the story name already states it ----
test("item 5: a story card shows p once, skipping it only when the story name already states it", () => {
  assert.equal(typeof c6.cardProbabilityLabel, "function");
  // The story names (Vanishing, Coin flip, Thriving) do not state p, so the card shows it.
  for (const row of C6_ROWS) assert.equal(c6.cardProbabilityLabel({story:row.story, p:row.p}), "p = " + row.p, row.story);
  assert.equal(c6.cardProbabilityLabel({story:"Rare recorded detection", p:0.2}), "p = 0.2", "a name without p still shows p");
  assert.equal(c6.cardProbabilityLabel({story:"Rare (p = 0.2)", p:0.2}), "", "a name that already states p is not repeated");
  assert.match(web("chapter6.js"), /cardProbabilityLabel\(card\)/, "the page uses it");
});

// ---- 6. Plain wording for the observed count ----
test("item 6: C6 calls the count what C5 calls it: Observed B09 count", () => {
  const c6source = web("chapter6.js");
  assert.doesNotMatch(c6source, /Retained B09/);
  assert.doesNotMatch(c6source, /retained observation/);
  // 2026-09-25 (short-scroll): the "Rule: lower <= observed_count <= upper" clause was dropped from
  // this line because it repeats the required-result line directly above it on screen; the count
  // wording this test protects ("Observed B09 count: N.") is unchanged.
  assert.match(c6source, /`Observed B09 count: \$\{state\.metadata\.observed_count\}\.`/);
  assert.match(web("chapter5.js"), /`Observed B09 count: \$\{state\.metadata\.observed_count\}\./, "the same words as Chapter 5");
});

// ---- 7. The conclusion is short and names both claims ----
// Repair 7 (2026-09-26): the closure no longer lists the kept candidate names dynamically (that
// list had no "and" before its last item, e.g. "Coin flip, Thriving can give 5 of 6"); it now uses
// the bible's fixed, plain three-line summary (docs/design/05-story-bible.md, "Both claims checked").
test("item 7: the case conclusion is short and names all three parts plainly", () => {
  const closure = c6.caseClosure(c6Ready().metadata, C6_ACCEPTED_DATA);
  const text = closure.findings.join("\n");
  assert.doesNotMatch(text, /retained these displayed candidate rows/);
  assert.ok(closure.findings.length <= 4);
  assert.match(text, /Part 1/);
  assert.match(text, /Part 2/);
  assert.match(text, /Part 3/);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("C5 renders the opaque simulation fixture ID with the visible model inputs", () => {
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  assert.match(source, /Simulation fixture ID:/);
});

test("C5 frames its probability move as the next bounded question in the B09 investigation", () => {
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  assert.match(html, /cannot say why B09 differs/i);
  assert.match(html, /under one explicitly stated model/i);
  assert.match(html, /at least as high as B09/i);
});
const c5 = require("../web/chapter5.js");

const CASE_ID = "missing-fleas-v1";
const COUNTS = [0, 2, 3, 3, 5, 6];

test("C5 only resumes Move 2 from a recorded C5 event-mask, never from a query string alone", () => {
  const priorMask = {
    readCourseState: () => ({accepted:{"C5/event-mask":{case_id:CASE_ID, chapter:"C5", move_id:"event-mask", provenance:"historical-browser"}}}),
    acceptedMoves: () => ([{key:"C5/event-mask", provenance:"historical-browser"}])
  };
  const noPriorMask = {
    readCourseState: () => ({accepted:{}}),
    acceptedMoves: () => ([])
  };
  assert.equal(c5.initialMove(priorMask, null, "pilot-c5", "?move=event-frequency"), "event-frequency");
  assert.equal(c5.initialMove(noPriorMask, null, "pilot-c5", "?move=event-frequency"), "event-mask");
  assert.equal(c5.initialMove(null, null, "pilot-c5", "?move=event-frequency"), "event-mask");
  assert.equal(c5.initialMove(priorMask, null, "pilot-c5", "?move=not-a-move"), "event-mask");
});

test("a checked C5 frequency gives the learner one named route to the model-comparison chapter", () => {
  assert.equal(c5.nextDestination("event-mask", true), "event-frequency");
  assert.equal(c5.nextDestination("event-frequency", true), "chapter6");
  assert.equal(c5.nextDestination("event-frequency", false), null);
  assert.equal(c5.nextChapterUrl("?attempt=field-7"), "chapter6.html?attempt=field-7");
  assert.equal(c5.nextChapterUrl("?attempt=not valid"), "chapter6.html");
});

test("C5 refuses a direct file launch before creating a WebSocket or retry loop", () => {
  assert.equal(c5.canOpenSocket("file:"), false);
  assert.equal(c5.canOpenSocket("http:"), true);
  assert.match(c5.connectionMessageForProtocol("file:"), /run\.jl/);
  assert.match(c5.connectionMessageForProtocol("file:"), /http:\/\/127\.0\.0\.1:8000/);
  assert.equal(c5.connectionMessageForProtocol("http:"), "");
});

test("C5 opening tells the learner which action begins its deferred lab connection", () => {
  assert.equal(
    c5.openingConnectionMessageForProtocol("http:"),
    "Open Toto’s simulation table to load the lab data."
  );
  assert.match(c5.openingConnectionMessageForProtocol("file:"), /run\.jl/);
});

test("C5 keeps concrete challenge bindings for the warned final answer, not the code shape", () => {
  assert.equal(c5.COPY["event-mask"].shape, "counts .>= threshold");
  assert.equal(c5.COPY["event-frequency"].shape,
    "events = counts .>= threshold; (events=events, frequency=sum(events)/length(events))");
  assert.match(c5.COPY["event-mask"].solution, /sim_counts \.>= observed_count/);
  assert.match(c5.COPY["event-frequency"].solution, /sim_counts \.>= observed_count/);
});

test("C5 turns a rejected run into a syntax-specific next step without leaking its answer", () => {
  const recovery = c5.challengeRecovery("event-mask");
  assert.match(recovery, /draft is still here/i);
  assert.match(recovery, /\.>= comparison cue above/i);
  assert.doesNotMatch(recovery, /compare every count/i);
  assert.match(recovery, /run again/i);
  assert.doesNotMatch(recovery, /sim_counts\s*\.>=\s*observed_count/);
  assert.equal(c5.runStatusText({runFailure:{feedback:recovery}}), "Your code is ready to revise.");
});

test("C5 distinguishes a restored learner draft from supplied code and names accepted runs", () => {
  assert.equal(typeof c5.draftNotice, "function");
  assert.match(c5.draftNotice(true, true), /Restored your saved draft.*not supplied code/i);
  assert.match(c5.draftNotice(false, false), /starts empty/i);
  assert.equal(c5.runOutcomeStatus({status:"ok", pass:true, progress_eligible:true}), "✓ Accepted — evidence saved.");
  assert.match(c5.runOutcomeStatus({status:"ok", pass:false}), /Not accepted.*no evidence was saved/i);
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  assert.match(html, /id="draft-note"/);
});

test("C5 teaches the Move 2 two-part return before revealing the concrete answer", () => {
  const concept = c5.helpStage("event-frequency", 0);
  const shape = c5.helpStage("event-frequency", 1);
  const parts = c5.helpStage("event-frequency", 2);
  const warning = c5.helpStage("event-frequency", 3);
  const full = c5.helpStage("event-frequency", 4);
  assert.match(concept.text, /matching events divided by all simulations/i);
  assert.match(shape.text, /counts/);
  assert.match(parts.text, /events.*true-or-false/i);
  assert.match(parts.text, /frequency.*matching.*all/i);
  assert.match(parts.text, /named tuple/i);
  assert.match(parts.text, /fresh.*run.*events/i);
  assert.doesNotMatch(parts.text, /sim_counts\s*\.>=\s*observed_count/);
  assert.match(warning.text, /will not write/i);
  assert.match(full.text, /sim_counts\s*\.>=\s*observed_count/);
  assert.match(c5.COPY["event-frequency"].bridge_note, /two labelled pieces/i);
});

test("C5 puts the generic Move 2 assignment and named-return bridge before the editor", () => {
  const bridge = c5.preEditorBridge("event-frequency");
  assert.match(bridge.lead, /build.*event.*return/i);
  assert.match(bridge.shape, /events = counts \.>= threshold/);
  assert.match(bridge.shape, /\(events=events, frequency=/);
  assert.match(bridge.explanation, /semicolon/i);
  assert.match(bridge.explanation, /named tuple/i);
  assert.doesNotMatch(bridge.shape, /sim_counts\s*\.>=\s*observed_count/);
});

test("C5 lets learners rehearse the generic event-to-frequency construction before free typing", () => {
  const cards = c5.frequencyCompositionCards();
  assert.deepEqual(cards.map(card => card.id), ["event", "frequency", "return"]);
  assert.ok(cards.every(card => !/sim_counts|observed_count/.test(card.text)));
  assert.equal(c5.frequencyCompositionIsCorrect(["event", "frequency", "return"]), true);
  assert.equal(c5.frequencyCompositionIsCorrect(["frequency", "event", "return"]), false);
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  const scaffold = html.indexOf('id="frequency-composition"');
  const editor = html.indexOf('<textarea id="code"');
  assert.ok(scaffold > -1 && scaffold < editor);
  assert.match(html, /practice only.*does not write into your editor/i);
});

test("C5 keeps its raw simulation window small while leaving the full vector and distribution understandable", () => {
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  assert.match(source, /Julia inputs: sim_counts/);
  assert.match(source, /vector of all \$\{state\.metadata\.n_trials\} simulated counts/);
  assert.match(source, /First 12 supplied counts/);
  assert.match(source, /You do not need to count these by hand/);
  assert.match(source, /Show 18 more supplied counts/);
  assert.match(source, /table\(el\.data,state\.metadata\.inputs\[0\]\.rows,12\)/);
  assert.match(c5.COPY["event-mask"].python, /import numpy as np/);
  assert.match(c5.COPY["event-mask"].python, /np\.asarray\(sim_counts\) >= observed_count/);
});

test("C5 names both case inputs before asking for an observed-count comparison", () => {
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  assert.match(source, /Julia inputs: sim_counts/);
  assert.match(source, /observed_count — the supplied B09 count/);
});

test("C5 puts a reader-first case status before the empty challenge without supplying code", () => {
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  const status = c5.caseStatus(caseInfo());
  assert.match(status.established, /report and handling log disagree.*T-C/i);
  assert.match(status.established, /observed B09 count is 3 of 6 jars/i);
  assert.match(status.unknown, /does not establish a biological cause/i);
  assert.match(status.why_now, /smaller probability question/i);
  assert.doesNotMatch(status.why_now, /sim_counts\s*\.>=\s*observed_count/);
  assert.ok(html.indexOf('id="case-status"') < html.indexOf('id="editor-title"'));
  assert.match(html, /Case status before you write/i);
  assert.match(source, /Why this move now/);
});

function caseInfo(overrides = {}) {
  const base = {
    type:"case", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:"event-mask",
    mode:"challenge", activity_id:null, simulation_id:"opaque-server-simulation-42", request_id:"c5-info",
    n_jars:6, p_ref:0.5, observed_count:3, n_trials:COUNTS.length,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:COUNTS.map((count, index) => ({simulation:index + 1, count}))}]
  };
  return Object.assign(base, overrides);
}

function acceptedInfo(move = "event-mask") {
  let state = c5.beginInfo(c5.createState(), "c5-info", move);
  return c5.applyCaseInfo(state, caseInfo({move_id:move}));
}

function frequencyResult(overrides = {}) {
  return Object.assign({
    type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:"event-frequency",
    mode:"challenge", activity_id:null, simulation_id:"opaque-server-simulation-42", request_id:"c5-run",
    status:"ok", pass:true, progress_eligible:true,
    result_data:{kind:"event-frequency", matching:4, trials:6, frequency:4 / 6, preview:[false, false, true, true, true, true]}
  }, overrides);
}

test("C5 client exposes an empty independent editor and only accepts complete verified metadata", () => {
  assert.equal(c5.initialEditorText(c5.createState()), "");
  assert.equal(c5.beginRun(Object.assign(c5.createState(), {metadata:{simulation_id:"opaque-server-simulation-42"}}), "unverified-run", "event-mask").pending, null);
  let waiting = c5.beginInfo(c5.createState(), "c5-info", "event-mask");
  for (const altered of [
    {simulation_id:""}, {n_jars:0}, {p_ref:"0.5"}, {observed_count:7}, {n_trials:5},
    {inputs:[{id:"sim_counts", columns:["count"], rows:COUNTS.map((count, index) => ({simulation:index + 1, count}))}]},
    {inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:COUNTS.map((count, index) => ({simulation:index + 2, count}))}]},
    {inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:COUNTS.map((count, index) => ({simulation:index + 1, count:index === 0 ? "0" : count}))}]}
  ]) assert.equal(c5.applyCaseInfo(waiting, caseInfo(altered)), waiting);
  const accepted = c5.applyCaseInfo(waiting, caseInfo());
  assert.equal(accepted.infoRequest, null);
  assert.equal(accepted.metadata.simulation_id, "opaque-server-simulation-42");
  assert.deepEqual(accepted.metadata.inputs[0].columns, ["simulation", "count"]);
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  assert.match(source, /Model inputs: \$\{state\.metadata\.n_jars\} trials per simulation; reference probability \$\{state\.metadata\.p_ref\}/);
});

test("a failed, stale, or malformed Move 2 result cannot replace an accepted result or become persistable", () => {
  let state = acceptedInfo("event-frequency");
  state = c5.beginRun(state, "c5-run", "event-frequency");
  const stale = c5.applyCaseResult(state, frequencyResult({request_id:"c5-old"}));
  assert.equal(stale, state);
  const failed = c5.applyCaseResult(state, frequencyResult({status:"error", pass:false, progress_eligible:false}));
  assert.equal(failed.result, null);
  assert.equal(failed.evidence, null);
  assert.equal(failed.runFailure.status, "rejected");
  assert.equal(failed.runFailure.feedback, c5.challengeRecovery("event-frequency"));
  assert.equal(c5.isNewAcceptedResult(state, failed, frequencyResult()), false);

  // S11b-G2 (2026-09-12 panel finding): a server-reported timeout (arriving as an ordinary
  // case_result, not via the client's own armRunDeadline expiry) must render the honest timeout
  // message, not the generic "did not meet the stated check" wrong-answer text.
  const timedOut = c5.applyCaseResult(state, frequencyResult({status:"timeout", pass:false, progress_eligible:false}));
  assert.equal(timedOut.result, null);
  assert.equal(timedOut.evidence, null);
  assert.equal(timedOut.runFailure.status, "timeout");
  assert.equal(c5.runOutcomeStatus(timedOut.runFailure), "Not accepted — the run timed out. No evidence was saved.");
  assert.notEqual(timedOut.runFailure.feedback, c5.challengeRecovery("event-frequency"));
  const malformed = c5.applyCaseResult(state, frequencyResult({result_data:{kind:"event-frequency", matching:4, trials:6, frequency:0.2}}));
  assert.equal(malformed.result, null);
  assert.equal(malformed.evidence, null);

  const accepted = c5.applyCaseResult(state, frequencyResult());
  assert.equal(c5.isNewAcceptedResult(state, accepted, frequencyResult()), false);
  assert.equal(c5.isNewAcceptedResult(state, accepted, accepted.result), true);
  const retried = c5.beginRun(accepted, "c5-run-2", "event-frequency");
  const rejectedRetry = c5.applyCaseResult(retried, frequencyResult({request_id:"c5-run-2", pass:false, progress_eligible:false}));
  assert.equal(rejectedRetry.result, null);
  assert.equal(rejectedRetry.evidence, accepted.evidence);
  assert.equal(c5.isNewAcceptedResult(retried, rejectedRetry, frequencyResult({request_id:"c5-run-2"})), false);
});

test("C5 histogram uses only verified immutable rows and a matching accepted frequency result", () => {
  const metadata = acceptedInfo("event-frequency").metadata;
  assert.deepEqual(c5.histogramData(metadata, frequencyResult().result_data), [
    {count:0, frequency:1, tail:false}, {count:1, frequency:0, tail:false},
    {count:2, frequency:1, tail:false}, {count:3, frequency:2, tail:true},
    {count:4, frequency:0, tail:true}, {count:5, frequency:1, tail:true},
    {count:6, frequency:1, tail:true}
  ]);
  assert.equal(c5.histogramData(metadata, Object.assign({}, frequencyResult().result_data, {matching:3, frequency:0.5})), null);
  assert.equal(c5.histogramData(null, frequencyResult().result_data), null);
});

test("C5 turns one returned six-card draw into a concrete event decision before code", () => {
  const draw = ["teal", "orange", "teal", "orange", "teal", "orange"];
  const yes = c5.cardEventFeedback(draw, 3, "yes");
  const no = c5.cardEventFeedback(draw, 3, "no");
  assert.equal(yes.tealCount, 3);
  assert.equal(yes.meetsEvent, true);
  assert.equal(yes.correct, true);
  assert.equal(no.correct, false);
  assert.match(yes.feedback, /at least 3/i);
});

test("C5 derives an honest visible distribution from returned simulation rows before a learner writes code", () => {
  const metadata = acceptedInfo("event-mask").metadata;
  assert.deepEqual(c5.simulationBins(metadata), [
    {count:0, frequency:1, tail:false}, {count:1, frequency:0, tail:false},
    {count:2, frequency:1, tail:false}, {count:3, frequency:2, tail:true},
    {count:4, frequency:0, tail:true}, {count:5, frequency:1, tail:true},
    {count:6, frequency:1, tail:true}
  ]);
  assert.equal(c5.simulationBins(null), null);
});

test("C5 turns a few supplied counts into the exact yes-or-no event before free typing", () => {
  const metadata = acceptedInfo("event-mask").metadata;
  assert.deepEqual(c5.eventDecisionRows(metadata, 4), [
    {simulation:1, count:0, meets_event:false},
    {simulation:2, count:2, meets_event:false},
    {simulation:3, count:3, meets_event:true},
    {simulation:4, count:3, meets_event:true}
  ]);
  assert.equal(c5.eventDecisionRows(metadata, 0).length, 1);
  assert.deepEqual(c5.eventDecisionRows(null, 4), []);
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  assert.match(source, /From one count to one yes-or-no result/);
  assert.match(source, /Your Julia move will make this same comparison for every supplied count/);
  assert.doesNotMatch(source.match(/From one count to one yes-or-no result[\s\S]{0,1800}/)[0], /sim_counts\s*\.>=\s*observed_count/);
});

test("C5 presents a blank challenge editor, keeps cards optional, and accepts only the exact server card response", () => {
  const html = fs.readFileSync(require.resolve("../web/chapter5.html"), "utf8");
  assert.match(html, /placeholder="Write your own Julia code here…"/);
  assert.doesNotMatch(html, /textarea[^>]*>sim_counts \.>= observed_count/);
  assert.ok(html.indexOf('id="simulation-data"') < html.indexOf('id="cards"'), "the named case data appears before the optional card practice");
  assert.match(html, /id="cards"/);
  assert.match(html, /id="card-event"/);
  assert.match(html, /Show Toto’s six cards/);
  assert.match(html, /Optional: try Toto’s card round first/);
  assert.match(html, /id="cards"[\s\S]*?<details[\s\S]*?<summary>Optional physical rehearsal/i);
  assert.doesNotMatch(html, /id="cards"[\s\S]*?<details\s+open/i);
  assert.match(html, /id="card-prediction"/);
  assert.match(html, /optional prediction/i);
  assert.match(html, /not case evidence/i);

  assert.equal(c5.beginAction(c5.createState(), "c5-card", "draw-six").actionPending, null);
  let state = acceptedInfo();
  state = c5.beginAction(state, "c5-card", "draw-six");
  const valid = {
    type:"case_action_result", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:"card-draw-demo",
    mode:"demonstration", activity_id:"card-round", simulation_id:"c5-card-round-v1", request_id:"c5-card",
    action:"draw-six", status:"ok", progress_eligible:false,
    generated_code:"draws = rand(MersenneTwister(5105), Bool, 6)", result_data:{kind:"card-draws", draws:["teal", "orange", "teal", "orange", "teal", "orange"]}
  };
  for (const altered of [
    {contract_version:2}, {case_id:"other"}, {chapter:"C4"}, {move_id:"event-mask"}, {mode:"challenge"},
    {activity_id:null}, {simulation_id:null}, {request_id:"old"}, {action:"replay-100"},
    {result_data:{kind:"card-draws", draws:[true, false, true, false, true, false]}}
  ]) assert.equal(c5.applyActionResult(state, Object.assign({}, valid, altered)), state);
  const accepted = c5.applyActionResult(state, valid);
  assert.equal(accepted.evidence, null);
  assert.equal(accepted.demo.result_data.kind, "card-draws");
  assert.deepEqual(accepted.demo.result_data.draws, ["teal", "orange", "teal", "orange", "teal", "orange"]);
});

test("C5 keeps optional model context and toy syntax practice available without burying the supplied simulation data", () => {
  const html = fs.readFileSync(require.resolve("../web/chapter5.html"), "utf8");
  assert.match(html, /<details id="model-recipe"[^>]*>/);
  assert.match(html, /<details id="practice-event"[^>]*>/);
  assert.doesNotMatch(html, /<details id="model-recipe"[^>]*\bopen\b/);
  assert.doesNotMatch(html, /<details id="practice-event"[^>]*\bopen\b/);
  assert.match(html, /Why use a simple simulation\?/);
  assert.match(html, /Practise the \.(&gt;|>)= rule with six toy counts/);
  assert.ok(html.indexOf('id="simulation-data"') < html.indexOf('id="case-status"'));
  assert.ok(html.indexOf('id="simulation-data"') < html.indexOf('id="editor-title"'));
});

test("C5 never makes the optional card demonstration a prerequisite for the named case move", () => {
  const ready = Object.assign(c5.createState(), {connection:"connected", metadata:caseInfo(), pending:null});
  assert.equal(c5.challengeReady(ready), true);
  assert.equal(c5.challengeReady(Object.assign({}, ready, {pending:{request_id:"running"}})), false);
  assert.equal(c5.challengeReady(Object.assign({}, ready, {connection:"offline"})), false);
});

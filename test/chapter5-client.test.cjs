"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

// repair5-7 (2026-09-24 walk-through): the opaque id stays in the data flow, not on the page.
test("C5 keeps the opaque simulation fixture ID off the visible page", () => {
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  assert.doesNotMatch(source, /Simulation fixture ID:/);
});

// Setting rename (2026-09-28): C5 is no longer a suspicion test. It asks what a plain 50:50
// starting guess gives, and says healthy jars would usually do better.
test("C5 frames its probability move as what plain chance gives, not as Momo's doubt", () => {
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  assert.doesNotMatch(html, /too good to be true|doubt/i);
  assert.match(html, /What would plain chance give\?/);
  assert.match(html, /Before we use what we know about the jars, what would a plain 50:50 guess give\?/);
  assert.match(html, /healthy jars would usually do better than 50:50/);
  assert.match(html, /5 or more of 6 jars show springtails/i);
});

// Hana playtest (2026-09-26): the abstract card round took a beat to reconnect to "jars with
// springtails"; tie the cards to the jars in the scene, before the card game opens.
test("C5 ties the cards to the jars before the card game opens", () => {
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  const sceneStart = html.indexOf('id="scene"');
  const cardsStart = html.indexOf('id="cards"');
  const tie = html.indexOf("Each card is one jar; teal means springtails.");
  assert.ok(tie > sceneStart && tie < cardsStart, "the tie-in line sits in the scene, before the card game");
});
// Panel adversary item 10 (2026-09-26): the static case-context line named the conclusion ("This
// shows 5 of 6 is not strange...") before the player ran step 2 to find it out. The limit line is
// shown dynamically in the result panel once step 2 is accepted (mystery_c5.jl "limit"); the
// static paragraph must start empty so it never leaks the answer on page load.
test("C5's static case-context paragraph starts empty; the limit line comes from the run result, not the page", () => {
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  const match = html.match(/<p id="case-context"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(match, "case-context element exists");
  assert.equal(match[1].trim(), "");
});

const c5 = require("../web/chapter5.js");
const bridges = require("../web/course/bridges.js");

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
  // An unknown step counts as no step: resume at the first unsolved step (2026-09-25 resume fix).
  assert.equal(c5.initialMove(priorMask, null, "pilot-c5", "?move=not-a-move"), "event-frequency");
  assert.equal(c5.initialMove(noPriorMask, null, "pilot-c5", "?move=not-a-move"), "event-mask");
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
    "Open Toto’s card table to load the cards."
  );
  assert.match(c5.openingConnectionMessageForProtocol("file:"), /run\.jl/);
});

test("C5 keeps concrete challenge bindings for the warned final answer, not the code shape", () => {
  assert.equal(c5.COPY["event-mask"].shape, "counts .>= threshold");
  assert.equal(c5.COPY["event-frequency"].shape,
    "events = counts .>= threshold, then on the next line sum(events) / length(events)");
  assert.match(c5.COPY["event-mask"].solution, /sim_counts \.>= observed_count/);
  assert.match(c5.COPY["event-frequency"].solution, /sim_counts \.>= observed_count/);
  assert.match(c5.COPY["event-frequency"].solution, /sum\(events\) \/ length\(events\)/);
});

test("C5 turns a rejected run into a syntax-specific next step without leaking its answer", () => {
  const recovery = c5.challengeRecovery("event-mask");
  assert.match(recovery, /draft is still here/i);
  assert.match(recovery, /Required result line near the top of the page, or open Stuck\? Hints below/);
  assert.doesNotMatch(recovery, /compare every count/i);
  assert.match(recovery, /run again/i);
  assert.doesNotMatch(recovery, /sim_counts\s*\.>=\s*observed_count/);
  assert.equal(c5.runStatusText({runFailure:{feedback:recovery}}), "Your code is ready to revise.");
});

test("C5 distinguishes a restored learner draft from supplied code and names accepted runs", () => {
  assert.equal(typeof c5.draftNotice, "function");
  assert.match(c5.draftNotice(true, true), /Restored your saved draft.*not supplied code/i);
  assert.match(c5.draftNotice(false, false), /starts empty/i);
  assert.equal(c5.runOutcomeStatus({status:"ok", pass:true, progress_eligible:true}), "Julia checked it: that's right.");
  assert.match(c5.runOutcomeStatus({status:"ok", pass:false}), /Not yet\. Julia ran your code/i);
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  assert.match(html, /id="draft-note"/);
});

test("C5 teaches the plain-number Move 2 return before revealing the concrete answer", () => {
  const idea = c5.helpStage("event-frequency", 0);
  const shape = c5.helpStage("event-frequency", 1);
  const full = c5.helpStage("event-frequency", 2);
  assert.match(idea.text, /rounds that matched divided by all rounds/i);
  assert.match(idea.text, /Coming from R\?/);
  assert.match(shape.text, /counts/);
  assert.match(shape.note, /counts is sim_counts/i);
  assert.doesNotMatch(shape.text, /sim_counts\s*\.>=\s*observed_count/);
  assert.equal(full.label, "Full answer");
  assert.match(full.text, /sim_counts\s*\.>=\s*observed_count/);
  assert.match(full.text, /sum\(events\) \/ length\(events\)/);
  // The older labelled-pair answer still runs; it is no longer taught here. The shared R/Python
  // bridge card (shown only after Move 2 is accepted) now teaches the plain-number shape instead.
  assert.match(bridges.BRIDGES["C5/event-frequency"].differences.join(" "), /sum\(events\) \/ length\(events\)/i);
});

// Since T2 (2026-09-12) only bridge.lead renders before the editor; the shape is a gated hint stage
// (UI-02, 2026-09-24). These assertions keep the unrendered bridge fields generic and answer-free.
test("C5 keeps the Move 2 bridge generic: only its lead renders before the editor", () => {
  const bridge = c5.preEditorBridge("event-frequency");
  assert.match(bridge.lead, /fresh.*events/i);
  assert.match(bridge.shape, /events = counts \.>= threshold/);
  assert.match(bridge.explanation, /sum\(events\)/i);
  assert.doesNotMatch(bridge.shape, /sim_counts\s*\.>=\s*observed_count/);
});

test("C5 lets learners rehearse the generic event-to-frequency construction before free typing", () => {
  const cards = c5.frequencyCompositionCards();
  assert.deepEqual(cards.map(card => card.id), ["event", "frequency"]);
  assert.ok(cards.every(card => !/sim_counts|observed_count/.test(card.text)));
  assert.equal(c5.frequencyCompositionIsCorrect(["event", "frequency"]), true);
  assert.equal(c5.frequencyCompositionIsCorrect(["frequency", "event"]), false);
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  const scaffold = html.indexOf('id="frequency-composition"');
  const editor = html.indexOf('<textarea id="code"');
  // move-first (2026-09-25): this rehearsal is optional, so it now lives in the collapsed
  // "Stuck? Help and practice" details after the editor rather than before the textarea; it still
  // never writes into the editor, which the next assertion protects.
  assert.ok(scaffold > -1 && scaffold > editor);
  assert.match(html, /practice only.*does not write into your editor/i);
});

test("C5 keeps its raw simulation window small while leaving the full vector and distribution understandable", () => {
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  assert.match(source, /Julia inputs: sim_counts/);
  assert.match(source, /sim_counts: all \$\{formatCount\(state\.metadata\.n_trials\)\} round counts, one number per round/);
  assert.match(source, /First 12 supplied counts/);
  assert.match(source, /You do not need to count these by hand/);
  assert.match(source, /Show 18 more supplied counts/);
  // 2026-09-25: the 12-row window is drawn inside one closed "See the first 30 counts as a table" section.
  assert.match(source, /table\(tableBox,state\.metadata\.inputs\[0\]\.rows,12\)/);
  assert.match(source, /See the first 30 counts as a table/);
  // 2026-09-25: chapter5.js's own COPY.python moved to web/course/bridges.js (the shared
  // post-acceptance "same move in R and Python" card); this still pins the exact Python line.
  assert.match(bridges.BRIDGES["C5/event-mask"].python, /import numpy as np/);
  assert.match(bridges.BRIDGES["C5/event-mask"].python, /np\.asarray\(sim_counts\) >= observed_count/);
});

test("C5 names both case inputs before asking for an observed-count comparison", () => {
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  assert.match(source, /Julia inputs: sim_counts/);
  assert.match(source, /observed_count: the notebook.s B09 count/);
});

test("C5 puts a reader-first case status before the empty challenge without supplying code", () => {
  const html = fs.readFileSync("web/chapter5.html", "utf8");
  const source = fs.readFileSync(require.resolve("../web/chapter5.js"), "utf8");
  // Night round 1: "Part 1 done" only once Chapter 3 is solved (third argument); see f4-chapters-2-6.test.cjs.
  const status = c5.caseStatus(caseInfo(), undefined, true);
  // Replay notes (2026-09-27): "Claim 1 is settled" asserted C3's finding even when C3 was skipped
  // (all six chapters are playable from the Case Board). "Chapter 3 settles Claim 1" holds in any
  // order. The "Still unknown" line was dropped (adds nothing beyond what "So far" already says).
  assert.match(status.established, /Part 1 done/i);
  assert.match(status.established, /blank box, not an empty tray/i);
  assert.match(status.established, /under a plain 50:50 guess, how often would 3 or more of 6 jars show springtails/i);
  assert.equal(status.unknown, "");
  assert.doesNotMatch(status.why_now, /too good to be true/i);
  assert.match(status.why_now, /what plain chance gives/i);
  assert.match(status.why_now, /mark each card round/i);
  assert.doesNotMatch(status.why_now, /sim_counts\s*\.>=\s*observed_count/);
  assert.ok(html.indexOf('id="case-status"') < html.indexOf('id="editor-title"'));
  assert.match(html, /Case status before you write/i);
  assert.match(source, /Why this step now/);
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
  assert.match(source, /Each round: \$\{state\.metadata\.n_jars\} cards, each teal half the time \(\$\{state\.metadata\.p_ref\}\)/);
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
  // repair6-4: an error run gets the error step, not "did not meet the stated check".
  assert.equal(failed.runFailure.feedback, c5.challengeRecovery("event-frequency", {status:"error"}));
  assert.equal(c5.isNewAcceptedResult(state, failed, frequencyResult()), false);

  // S11b-G2 (2026-09-12 panel finding): a server-reported timeout (arriving as an ordinary
  // case_result, not via the client's own armRunDeadline expiry) must render the honest timeout
  // message, not the generic "did not meet the stated check" wrong-answer text.
  const timedOut = c5.applyCaseResult(state, frequencyResult({status:"timeout", pass:false, progress_eligible:false}));
  assert.equal(timedOut.result, null);
  assert.equal(timedOut.evidence, null);
  assert.equal(timedOut.runFailure.status, "timeout");
  assert.equal(c5.runOutcomeStatus(timedOut.runFailure), "Not yet. Your code took too long, so the lab stopped it. Your code is still here.");
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
  assert.match(source, /Your Julia step will make this same comparison for every round/);
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
  assert.match(html, /Try one round yourself \(optional\)/);
  assert.match(html, /id="cards"[\s\S]*?<details[\s\S]*?<summary>Try one round yourself/i);
  assert.doesNotMatch(html, /id="cards"[\s\S]*?<details\s+open/i);
  assert.match(html, /id="card-prediction"/);
  assert.match(html, /optional prediction/i);
  assert.match(html, /does not count for the case/i);

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
  assert.match(html, /How the cards work/);
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

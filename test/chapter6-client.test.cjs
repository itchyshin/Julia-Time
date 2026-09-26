"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const COLUMNS = ["model", "p", "lower", "upper"];
const ROWS = [
  // This is the server-owned teaching fixture.  The browser must not reject a
  // legitimate case just because it duplicated an old range by hand.
  {model:"Vanishing", p:0.1, lower:0, upper:2},
  {model:"Coin flip", p:0.5, lower:1, upper:5},
  {model:"Thriving", p:0.8, lower:4, upper:6}
];
const COMPATIBLE = [ROWS[1], ROWS[2]];

function info(request_id = "c6-info") {
  return {type:"case",contract_version:1,case_id:"missing-fleas-v1",chapter:"C6",move_id:"compatible-models",mode:"challenge",activity_id:null,simulation_id:null,request_id,observed_count:5,n_trials:6,inputs:[{id:"stories",columns:COLUMNS,rows:ROWS}]};
}
function reply(request_id = "c6-run", overrides = {}) {
  return Object.assign({type:"case_result",contract_version:1,case_id:"missing-fleas-v1",chapter:"C6",move_id:"compatible-models",mode:"challenge",activity_id:null,simulation_id:null,request_id,status:"ok",pass:true,progress_eligible:true,result_data:{kind:"table",columns:COLUMNS,rows:COMPATIBLE}}, overrides);
}
function ready(c6) {
  let state = c6.createState();
  state = c6.beginInfo(state, "c6-info");
  state = c6.applyCaseInfo(state, info());
  assert.ok(state.metadata);
  return state;
}

test("C6 tells a new learner which visible action loads the candidate models", () => {
  const c6 = require("../web/chapter6.js");
  const opening = c6.createState();
  assert.equal(opening.connection, "idle");
  assert.equal(c6.connectionStatusText(opening), "Open the story board to load the stories.");
  assert.equal(c6.shouldShowReconnect(opening), false);
  const source = fs.readFileSync("web/chapter6.js", "utf8");
  assert.match(source, /shape\.style\.whiteSpace\s*=\s*"pre-wrap"/);
});
function accepted(c6) {
  let state = ready(c6);
  state = c6.beginRun(state, "c6-accepted");
  state = c6.applyCaseResult(state, reply("c6-accepted"));
  assert.ok(state.evidence);
  return state;
}

test("C6 starts with an empty editor and never uses learner-facing culprit language", () => {
  const c6 = require("../web/chapter6.js");
  const html = fs.readFileSync("web/chapter6.html", "utf8");
  assert.equal(c6.initialEditorText(), "");
  assert.doesNotMatch(html, /textarea[^>]*>[^<\s]/i);
  assert.doesNotMatch(html, /culprit/i);
});

test("C6 distinguishes a restored learner draft from supplied code and names accepted runs", () => {
  const c6 = require("../web/chapter6.js");
  assert.equal(typeof c6.draftNotice, "function");
  assert.match(c6.draftNotice(true, true), /Restored your saved draft.*not supplied code/i);
  assert.match(c6.draftNotice(false, false), /starts empty/i);
  assert.equal(c6.runOutcomeStatus(reply()), "Julia checked it: that's right.");
  assert.match(c6.runOutcomeStatus(reply("c6-rejected", {pass:false, progress_eligible:false})), /Not yet\. Julia ran your code/i);
  const html = fs.readFileSync("web/chapter6.html", "utf8");
  assert.match(html, /id="draft-note"/);
});

test("C6 prepares the inclusive-range decision before the editor and derives candidate cards from current metadata", () => {
  const c6 = require("../web/chapter6.js");
  const html = fs.readFileSync("web/chapter6.html", "utf8");
  const contextStart = html.indexOf('id="model-context"');
  assert.ok(contextStart >= 0, "the model context should be present");
  assert.ok(contextStart < html.indexOf('id="editor-title"'), "the model context should prepare the learner before the editor");
  const context = html.slice(contextStart, html.indexOf('class="editor"', contextStart));
  assert.match(context, /story.*chance that one jar shows fleas/i);
  assert.match(context, /usual range/i);
  assert.match(context, /exactly on either edge stays in/i);

  const changed = info("c6-changed");
  changed.inputs[0].rows = [
    { model: "Rare recorded detection", p: 0.2, lower: 0, upper: 3 },
    { model: "Common recorded detection", p: 0.9, lower: 4, upper: 6 }
  ];
  const cards = c6.candidateModelCards(changed);
  assert.deepEqual(cards, [
    { model: "Rare recorded detection", p: 0.2 },
    { model: "Common recorded detection", p: 0.9 }
  ]);
});

test("C6 has an accepted-result-only closing route rather than leaving the learner to search", () => {
  const source = fs.readFileSync("web/chapter6.js", "utf8");
  const nestedVisualStart = source.lastIndexOf("function drawVisual(){");
  const nestedVisualEnd = source.indexOf("function render(){", nestedVisualStart);
  const activeVisual = source.slice(nestedVisualStart, nestedVisualEnd);
  assert.match(activeVisual, /caseClosure\(state\.metadata, state\.evidence\.result_data\)/);
  assert.match(activeVisual, /Review the Case Board/);
  assert.match(activeVisual, /Optional: open the comparison laboratory/);
  assert.match(activeVisual, /fitting is not proof/i);
});

test("C6 stamps Claim 2 as not supported, matching the server's claim field, right after the fitting-is-not-proof line", () => {
  const source = fs.readFileSync("web/chapter6.js", "utf8");
  const nestedVisualStart = source.lastIndexOf("function drawVisual(){");
  const nestedVisualEnd = source.indexOf("function render(){", nestedVisualStart);
  const activeVisual = source.slice(nestedVisualStart, nestedVisualEnd);
  const limitIndex = activeVisual.indexOf("Fitting is not proof");
  const claimIndex = activeVisual.indexOf("Claim 2");
  assert.ok(limitIndex >= 0 && claimIndex > limitIndex, "the Claim 2 stamp follows the limit line");
  assert.match(activeVisual, /claim\.className\s*=\s*"claim-stamp"/);
  assert.match(activeVisual, /section\.append\(title, intro, list, limit, claim, closing\)/);
  const clientClaim = activeVisual.match(/claim\.textContent = "([^"]*)"/)[1];

  // The client's wording must match the server's, word for word (src/mystery_c6.jl's "claim" field).
  const server = fs.readFileSync("src/mystery_c6.jl", "utf8");
  const serverClaim = server.match(/"claim" => "((?:[^"\\]|\\.)*)"/)[1].replace(/\\"/g, '"');
  const normalize = text => text.replace(/[“”]/g, '"');
  assert.equal(normalize(clientClaim), normalize(serverClaim));
});

test("C6 turns a checked compatible-range result into a bounded case conclusion", () => {
  const c6 = require("../web/chapter6.js");
  const closure = c6.caseClosure(info(), {kind:"table", columns:COLUMNS, rows:COMPATIBLE});
  assert.equal(closure.title, "Both claims checked");
  assert.match(closure.findings[0], /Claim 1.*T-C has no fleas.*blank box/i);
  assert.match(closure.findings[1], /Claim 2.*vanishing.*not suspicious/i);
  assert.match(closure.findings[2], /Still open.*recheck.*three jars/i);
  assert.equal(c6.caseClosure(info(), {kind:"table", columns:COLUMNS, rows:[ROWS[0]]}), null);
});

test("C6 direct-file recovery never plans a socket or retry and tells the player exactly how to return", () => {
  const c6 = require("../web/chapter6.js");
  const plan = c6.connectionPlan("file:");
  assert.deepEqual(plan, {
    open_socket:false,
    retry:false,
    message:"This page was opened directly. Start run.jl, then open http://127.0.0.1:8000 to run Chapter 6."
  });
  assert.deepEqual(c6.connectionPlan("http:"), {open_socket:true, retry:true, message:null});
  const recovered = c6.enterFileUrlRecovery(ready(c6));
  assert.equal(recovered.connection, "offline");
  assert.equal(recovered.infoRequest, null);
  assert.equal(recovered.pending, null);
  assert.equal(recovered.fileUrlRecovery, true);
  assert.equal(c6.connectionStatusText(recovered), plan.message);
  assert.equal(c6.shouldShowReconnect(recovered), false);
  assert.equal(c6.shouldShowReconnect(c6.disconnect(c6.createState())), true);
  const source = fs.readFileSync("web/chapter6.js", "utf8");
  const connect = source.slice(source.indexOf("function connect(){"));
  assert.ok(connect.indexOf("const plan=connectionPlan(location.protocol)") < connect.indexOf("new WebSocket"));
  assert.match(connect.slice(0, connect.indexOf("new WebSocket")), /if\(!plan\.open_socket\).*?return;/);
});

test("C6 turns an overdue current metadata request into a visible recovery, without replacing a newer request", () => {
  const c6 = require("../web/chapter6.js");
  const waiting = c6.beginInfo(c6.createState(), "c6-current-info");
  assert.equal(c6.expireInfo(waiting, "c6-stale-info"), waiting, "an old timer must not replace a newer request");
  const recovered = c6.expireInfo(waiting, "c6-current-info");
  assert.equal(recovered.infoRequest, null);
  assert.equal(recovered.metadata, null);
  assert.match(recovered.metadataFailure, /story board took too long/i);
  assert.match(recovered.metadataFailure, /draft is still here/i);
  assert.equal(c6.shouldShowReconnect(recovered), true);
});

test("C6 stages a generic composed range rule before its explicit complete-answer reveal", () => {
  const c6 = require("../web/chapter6.js");
  // The bible teaches the fits_low/fits_high shape with placeholders table/target (not the case's
  // own names), so the shape itself is generic even though it shows the real .<=/.& operators.
  assert.doesNotMatch(c6.COPY.shape, /stories|observed_count/);
  assert.match(c6.COPY.shape, /fits_low/);
  assert.match(c6.COPY.shape, /fits_high/);
  assert.match(c6.COPY.shape, /\.<=/);
  assert.match(c6.COPY.shape, /\.&/);
  assert.match(c6.COPY.range_rule, /low end/i);
  assert.match(c6.COPY.range_rule, /high end/i);
  assert.match(c6.COPY.selection, /\[fits_low \.& fits_high, :\]/);
  assert.match(c6.COPY.solution, /\[fits_low \.& fits_high, :\]/);
  assert.match(c6.COPY.solution, /stories/);
  assert.match(c6.COPY.solution, /observed_count/);
  assert.match(c6.COPY.syntax, /\.<=/);
  assert.match(c6.COPY.syntax, /\[rows, :\]/);
});

// A returning player's saved draft may still use the pre-rename name (bible v2 3.1:
// candidate_models -> stories); the coaching leads with the actual UndefVarError.
test("C6 coaches a returning player whose draft still uses candidate_models", () => {
  const c6 = require("../web/chapter6.js");
  const recovery = c6.challengeRecovery({status:"error", message:"UndefVarError: `candidate_models` not defined"});
  assert.match(recovery, /This name changed: use stories instead of candidate_models\./);
  assert.match(recovery, /draft is still here/i);
});

test("C6 turns a rejected run into a syntax-specific next step without leaking its answer", () => {
  const c6 = require("../web/chapter6.js");
  const recovery = c6.challengeRecovery();
  assert.match(recovery, /draft is still here/i);
  assert.match(recovery, /Required result line near the top of the page, or open Help me start in Stuck\? Hints below/);
  assert.doesNotMatch(recovery, /both comparisons/i);
  assert.match(recovery, /run again/i);
  assert.doesNotMatch(recovery, /stories/);
  assert.doesNotMatch(recovery, /observed_count/);
  assert.equal(c6.connectionStatusText({runFailure:{message:recovery}}), "Your code is ready to revise.");
});

test("C6 puts a generic two-check code shape before the empty editor", () => {
  const c6 = require("../web/chapter6.js");
  const html = fs.readFileSync("web/chapter6.html", "utf8");
  const bridge = c6.preEditorBridge();
  assert.match(bridge.shape, /fits_low\s*=\s*table\.lower \.<= target/);
  assert.match(bridge.shape, /table\[fits_low \.& fits_high, :\]/);
  assert.match(bridge.explanation, /Replace the generic names/i);
  assert.doesNotMatch(bridge.shape, /stories|observed_count/);
  assert.equal(bridge.checks[0].inCase, "stories.lower .<= observed_count");
  assert.match(bridge.checks[0].note, /one true-or-false value per story/i);
  assert.ok(html.indexOf('id="pre-editor-bridge"') < html.indexOf('id="code"'));
});

test("C6 gives learners a tangible lower-bound, upper-bound, then combined-rule practice before case code", () => {
  const c6 = require("../web/chapter6.js");
  assert.deepEqual(c6.rangePracticeStep(0), {
    label:"Check the lower bounds",
    result:"Both practice rows pass the lower-bound check: 1 ≤ 3 and 0 ≤ 3 are true.",
    next:"Now check the upper bounds →"
  });
  assert.deepEqual(c6.rangePracticeStep(1), {
    label:"Check the upper bounds",
    result:"Only the first practice row passes the upper-bound check: 3 ≤ 4 is true, but 3 ≤ 2 is false.",
    next:"Combine both checks →"
  });
  assert.deepEqual(c6.rangePracticeStep(2), {
    label:"Combine both checks",
    result:"Both checks must be true. The 1–4 practice range stays; the 0–2 range is left out.",
    next:null
  });
  const source = fs.readFileSync("web/chapter6.js", "utf8");
  assert.match(source, /Try the range check on two practice rows/);
  assert.match(source, /rangePracticeStep\(practiceStage\)/);
  assert.match(source, /This is practice data\. Your code box stays empty\./);
});

test("C6 rejects malformed candidate metadata without duplicating server ranges", () => {
  const c6 = require("../web/chapter6.js");
  const variants = [
    Object.assign(info(), {inputs:[info().inputs[0], {id:"extra",columns:[],rows:[]}]}),
    Object.assign(info(), {inputs:[Object.assign({}, info().inputs[0], {columns:[...COLUMNS, "extra"]})]}),
    Object.assign(info(), {inputs:[Object.assign({}, info().inputs[0], {rows:[Object.assign({}, ROWS[0], {p:"0.1"}), ROWS[1], ROWS[2]]})]}),
    Object.assign(info(), {inputs:[Object.assign({}, info().inputs[0], {rows:[Object.assign({}, ROWS[0], {lower:3, upper:2}), ROWS[1], ROWS[2]]})]}),
    Object.assign(info(), {inputs:[Object.assign({}, info().inputs[0], {rows:[Object.assign({}, ROWS[0], {model:""}), ROWS[1], ROWS[2]]})]}),
    Object.assign(info(), {observed_count:7}),
    Object.assign(info(), {observed_count:1.5}),
    Object.assign(info(), {chapter:"C5"})
  ];
  for (const message of variants) {
    let state = c6.createState();
    state = c6.beginInfo(state, "c6-info");
    state = c6.applyCaseInfo(state, message);
    assert.equal(state.metadata, null);
    assert.ok(state.infoRequest);
  }
});

test("C6 accepts the server-owned candidate ranges instead of a duplicated browser fixture", () => {
  const c6 = require("../web/chapter6.js");
  let state = c6.createState();
  state = c6.beginInfo(state, "c6-live-fixture");
  state = c6.applyCaseInfo(state, info("c6-live-fixture"));
  assert.ok(state.metadata, "the current server fixture must unlock the visible table and editor");
});

test("C6 accepts a structurally valid server-owned candidate table with changed ranges", () => {
  const c6 = require("../web/chapter6.js");
  const serverOwnedRows = [
    {model:"Rare story", p:0.2, lower:0, upper:3},
    {model:"Common story", p:0.6, lower:2, upper:6}
  ];
  const message = Object.assign(info("c6-server-owned"), {
    observed_count:4,
    inputs:[{id:"stories", columns:COLUMNS, rows:serverOwnedRows}]
  });
  let state = c6.createState();
  state = c6.beginInfo(state, "c6-server-owned");
  state = c6.applyCaseInfo(state, message);
  assert.equal(state.metadata, message);
});

test("C6 keeps the Case Board visible and makes the returned-data learning scaffold available after the editor", () => {
  const c6 = require("../web/chapter6.js");
  const html = fs.readFileSync("web/chapter6.html", "utf8");
  assert.match(html, /id="case-board-scene"[^>]*>Case Board/);
  assert.match(html, /id="case-board"[^>]*>Case Board/);
  // move-first (2026-09-25): the range-practice scaffold is optional, so it now lives in the
  // collapsed "Stuck? Help and practice" details after the editor rather than before the textarea.
  assert.ok(html.indexOf('id="learning-scaffold"') > html.indexOf('id="code"'));
  const scaffold = c6.learningScaffold(info());
  assert.match(scaffold.why, /compare the story board.s usual ranges/i);
  assert.match(scaffold.observation, /observed B09 count is 5/i);
  assert.match(scaffold.observation, /chance that one jar shows fleas/i);
  assert.match(scaffold.observation, /six-jar counts/i);
  assert.match(scaffold.observation, /not every count.*possibly give/i);
  assert.match(scaffold.observation, /not.*story true/i);
  assert.match(scaffold.practice_stays, /practice story.*1 ≤ 3 ≤ 4/i);
  assert.match(scaffold.practice_fails, /practice story.*0 ≤ 3 ≤ 2/i);
  assert.doesNotMatch(scaffold.practice_stays, /Candidate p|B09|5/);
  assert.doesNotMatch(scaffold.practice_fails, /Candidate p|B09|5/);
  assert.match(scaffold.bridge, /Help me start/i);
  assert.doesNotMatch(scaffold.bridge, /stories\[/);
});

test("C6 puts a cautious case-status bridge before the empty challenge without supplying code", () => {
  const c6 = require("../web/chapter6.js");
  const html = fs.readFileSync("web/chapter6.html", "utf8");
  const source = fs.readFileSync(require.resolve("../web/chapter6.js"), "utf8");
  const status = c6.caseStatus(info());
  assert.match(status.established, /notebook and the tally sheet disagree.*T-C/i);
  assert.match(status.established, /notebook has 1, the tally sheet.s box was left blank/i);
  assert.match(status.established, /observed B09 count is 5/i);
  assert.match(status.unknown, /fitting is not proof/i);
  assert.match(status.why_now, /could give 5 of 6/i);
  assert.doesNotMatch(status.why_now, /stories\[/);
  assert.ok(html.indexOf('id="case-status"') < html.indexOf('id="editor-title"'));
  assert.match(html, /Case status before you write/i);
  assert.match(source, /Why this move now/);
});

test("C6 frames compatibility as a cautious case decision with a real next investigation", () => {
  const html = fs.readFileSync("web/chapter6.html", "utf8");
  const source = fs.readFileSync(require.resolve("../web/chapter6.js"), "utf8");
  assert.match(html, /Which stories could give the notebook.s 5 of 6/i);
  assert.match(source, /fitting is not proof/i);
  assert.match(source, /Still open.*recheck of three jars/i);
});

test("C6 clears previously accepted evidence before and after a matching failed or malformed run", () => {
  const c6 = require("../web/chapter6.js");
  let state = accepted(c6);
  state = c6.beginRun(state, "c6-failed");
  assert.equal(state.evidence, null);
  assert.equal(state.result, null);
  state = c6.applyCaseResult(state, reply("c6-failed", {status:"error", pass:false, progress_eligible:false, result_data:null}));
  assert.equal(state.pending, null);
  assert.equal(state.evidence, null);
  assert.equal(state.runFailure.status, "rejected");
  // repair6-4: an error run gets the error step, not "did not meet the stated check".
  assert.equal(state.runFailure.message, c6.challengeRecovery({status:"error"}));

  // S11b-G2 (2026-09-12 panel finding): a server-reported timeout (arriving as an ordinary
  // case_result, not via the client's own armRunDeadline expiry) must render the honest timeout
  // message, not the generic "did not meet the stated check" wrong-answer text.
  state = c6.beginRun(state, "c6-timeout");
  state = c6.applyCaseResult(state, reply("c6-timeout", {status:"timeout", pass:false, progress_eligible:false, result_data:null}));
  assert.equal(state.evidence, null);
  assert.equal(state.runFailure.status, "timeout");
  assert.equal(c6.runOutcomeStatus(state.runFailure), "Not yet. Your code took too long, so the lab stopped it. Your code is still here.");
  assert.notEqual(state.runFailure.message, c6.challengeRecovery());

  state = c6.beginRun(state, "c6-malformed");
  state = c6.applyCaseResult(state, reply("c6-malformed", {result_data:{kind:"table",columns:COLUMNS,rows:[Object.assign({}, ROWS[1], {upper:4})]}}));
  assert.equal(state.pending, null);
  assert.equal(state.evidence, null);
});

test("C6 ignores wrong-identity results and rejects changed, invented, or extra returned rows", () => {
  const c6 = require("../web/chapter6.js");
  let state = accepted(c6);
  state = c6.beginRun(state, "c6-current");
  const pending = state;
  state = c6.applyCaseResult(state, reply("c6-other"));
  assert.equal(state, pending);
  assert.equal(state.evidence, null);

  for (const result_data of [
    {kind:"table",columns:[...COLUMNS, "extra"],rows:COMPATIBLE},
    {kind:"table",columns:COLUMNS,rows:[Object.assign({}, ROWS[1], {model:"A different story"})]},
    {kind:"table",columns:COLUMNS,rows:[Object.assign({}, ROWS[1], {p:0.6})]},
    {kind:"table",columns:COLUMNS,rows:[ROWS[1], ROWS[1]]},
    {kind:"table",columns:COLUMNS,rows:[{model:"Invented",p:0.4,lower:0,upper:6}]},
    {kind:"table",columns:COLUMNS,rows:[ROWS[0]]}
  ]) {
    let attempt = c6.beginRun(ready(c6), "c6-result");
    attempt = c6.applyCaseResult(attempt, reply("c6-result", {result_data}));
    assert.equal(attempt.pending, null);
    assert.equal(attempt.evidence, null);
  }
});

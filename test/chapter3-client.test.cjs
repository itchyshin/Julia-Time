"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter3.js");

const CASE_ID = "missing-fleas-v1";
const JOIN_COLUMNS = ["tray_id", "reported_detected_n", "logged_detected_n", "log_status"];
const JOIN_ROWS = [
  {tray_id:"T-A", reported_detected_n:2, logged_detected_n:2, log_status:"entered"},
  {tray_id:"T-B", reported_detected_n:2, logged_detected_n:2, log_status:"entered"},
  {tray_id:"T-C", reported_detected_n:1, logged_detected_n:0, log_status:"not entered"}
];

test("C3 begins with its handling-desk scene and an empty challenge editor", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
  assert.match(html, /assets\/course\/scene-c3-handling-desk\.png/);
  assert.match(html, /Eddie holds two blank sheets side by side/);
  assert.match(html, /id="investigation" hidden/);
  assert.match(html, /id="start-investigation"/);
  assert.match(html, /id="visible-inputs"/);
  assert.match(html, /id="returned-visual"/);
  assert.match(html, /id="case-board"/);
  assert.match(html, /<a class="skip" href="#chapter-title">/);
  assert.match(html, /<textarea id="code"[^>]*><\/textarea>/);
  assert.match(html, /recording disagreement/);
  assert.match(html, /does not tell us which record is biologically true/i);
});

test("C3 recognises only the two contract move IDs and their visible input sets", () => {
  assert.equal(client.knownMove("join-report-log"), true);
  assert.equal(client.knownMove("filter-disagreement"), true);
  assert.equal(client.knownMove("join"), false);
  assert.deepEqual(client.activeInputIds("join-report-log"), ["report", "handling_log"]);
  assert.deepEqual(client.activeInputIds("filter-disagreement"), ["joined"]);
});

test("a metadata reply needs the current request, full identity, and exactly the active inputs", () => {
  let state = client.beginInfo(client.createState(), "info-1", "join-report-log");
  const stale = client.applyCaseInfo(state, validInfo({request_id:"old"}));
  assert.equal(stale, state);
  const wrongMode = client.applyCaseInfo(state, validInfo({mode:"demonstration", activity_id:"practice-join-v1"}));
  assert.equal(wrongMode, state);
  const wrongActivity = client.applyCaseInfo(state, validInfo({activity_id:"unexpected"}));
  assert.equal(wrongActivity, state);
  const wrongSimulation = client.applyCaseInfo(state, validInfo({simulation_id:"unexpected"}));
  assert.equal(wrongSimulation, state);
  const wrongMove = client.applyCaseInfo(state, validInfo({move_id:"filter-disagreement", inputs:[joinedInput()]}));
  assert.equal(wrongMove, state);
  const extraInput = client.applyCaseInfo(state, validInfo({inputs:[reportInput(), logInput(), joinedInput()]}));
  assert.equal(extraInput, state);
  const accepted = client.applyCaseInfo(state, validInfo());
  assert.equal(accepted.infoRequest, null);
  assert.equal(accepted.metadata.inputs.length, 2);
});

test("case-info messages and fences keep challenge and demonstration identities separate", () => {
  assert.deepEqual(client.infoMessage("join-report-log", "challenge-info"), {
    type:"case_info", contract_version:1, case_id:CASE_ID, chapter:"C3", move_id:"join-report-log",
    mode:"challenge", activity_id:null, simulation_id:null, request_id:"challenge-info"
  });
  assert.deepEqual(client.demoInfoMessage("demo-info"), {
    type:"case_info", contract_version:1, case_id:CASE_ID, chapter:"C3", move_id:"join-report-log",
    mode:"demonstration", activity_id:"practice-join-v1", simulation_id:null, request_id:"demo-info"
  });
  let state = client.beginDemoInfo(client.createState(), "practice-info");
  assert.equal(client.applyDemoInfo(state, validDemoInfo({mode:"challenge", activity_id:null})), state);
  assert.equal(client.applyDemoInfo(state, validDemoInfo({simulation_id:"unexpected"})), state);
});

test("a result can settle only its exact C3 challenge request", () => {
  const waiting = client.beginRun(client.createState(), "run-1", "join-report-log");
  for (const altered of [
    {request_id:"old"},
    {case_id:"other-case"},
    {chapter:"C2"},
    {move_id:"filter-disagreement"},
    {mode:"demonstration"},
    {activity_id:"practice-join-v1"},
    {simulation_id:"unexpected"}
  ]) {
    assert.equal(client.applyCaseResult(waiting, validResult(altered)), waiting);
  }
  const accepted = client.applyCaseResult(waiting, validResult());
  assert.equal(accepted.pending, null);
  assert.equal(accepted.result.move_id, "join-report-log");
});

test("only a passing, current returned join becomes fresh evidence", () => {
  let state = client.beginRun(client.createState(), "run-1", "join-report-log");
  state = client.applyCaseResult(state, validResult({pass:false, progress_eligible:false}));
  assert.equal(state.evidence, null);
  state = client.beginRun(state, "run-2", "join-report-log");
  state = client.applyCaseResult(state, validResult({request_id:"run-2", pass:true, progress_eligible:true}));
  assert.equal(state.evidence.move_id, "join-report-log");
  assert.deepEqual(state.evidence.rows, JOIN_ROWS);
});

test("key-alignment and disagreement visuals are derived only from returned rows", () => {
  assert.deepEqual(client.visualData("join-report-log", {columns:JOIN_COLUMNS, rows:JOIN_ROWS}), {
    kind:"key-alignment",
    rows:JOIN_ROWS.map(row => ({tray_id:row.tray_id, report:row.reported_detected_n, log:row.logged_detected_n, log_status:row.log_status}))
  });
  const disagreement = client.visualData("filter-disagreement", {columns:JOIN_COLUMNS, rows:[JOIN_ROWS[2]]});
  assert.deepEqual(disagreement, {
    kind:"recording-disagreement",
    rows:[{tray_id:"T-C", report:1, log:0, log_status:"not entered"}]
  });
  assert.equal(client.visualData("filter-disagreement", {columns:JOIN_COLUMNS, rows:[JOIN_ROWS[0]]}), null);
  assert.equal(client.visualData("join-report-log", {columns:JOIN_COLUMNS, rows:[JOIN_ROWS[0], JOIN_ROWS[0]]}), null);
});

test("a failed or malformed result cannot create a discrepancy card", () => {
  let state = client.beginRun(client.createState(), "run-1", "filter-disagreement");
  state = client.applyCaseResult(state, validResult({move_id:"filter-disagreement", rows:[JOIN_ROWS[2]], pass:false, progress_eligible:false}));
  assert.equal(state.evidence, null);
  state = client.beginRun(state, "run-2", "filter-disagreement");
  state = client.applyCaseResult(state, validResult({request_id:"run-2", move_id:"filter-disagreement", rows:[JOIN_ROWS[0]], pass:true, progress_eligible:true}));
  assert.equal(state.evidence, null);
});

test("a table-shaped rejected case result never receives the evidence visual", () => {
  assert.equal(client.shouldRenderCaseVisual(validResult({pass:false, progress_eligible:false})), false);
  assert.equal(client.shouldRenderCaseVisual(validResult({move_id:"filter-disagreement", rows:[JOIN_ROWS[2]], pass:false, progress_eligible:false})), false);
  assert.equal(client.shouldRenderCaseVisual(validResult()), true);
  assert.equal(client.shouldRenderCaseVisual(validResult({move_id:"filter-disagreement", rows:[JOIN_ROWS[2]]})), true);
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.match(source, /if \(shouldRenderCaseVisual\(message\)\) renderVisual\(message\);/);
});

test("C3 offers concept, code shape, solution, bridge comparisons, and error recovery without supplying editor code", () => {
  const lesson = client.lessonCopy("join-report-log");
  assert.match(lesson.concept, /one-to-one/i);
  assert.match(lesson.shape, /leftjoin\(left_table, right_table, on=:shared_column\)/);
  assert.match(lesson.solution, /leftjoin\(report, handling_log, on=:tray_id\)/);
  assert.match(lesson.syntax, /leftjoin means/i);
  assert.match(lesson.syntax, /first comma/i);
  assert.match(lesson.syntax, /second comma/i);
  assert.match(client.lessonCopy("filter-disagreement").shape, /table\[table\.left_count \.!= table\.right_count, :\]/);
  assert.match(client.lessonCopy("filter-disagreement").syntax, /Chapter 1.*\.==/i);
  assert.match(client.lessonCopy("filter-disagreement").solution, /joined\[joined\.reported_detected_n \.!= joined\.logged_detected_n, :\]/);
  assert.match(client.recoveryCopy("join-report-log"), /comma/i);
  assert.match(client.recoveryCopy("filter-disagreement"), /\.!=/);
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
  assert.match(html, /R and Python/);
  // T2 (2026-09-12 playtest): the code shape used to duplicate into an always-visible
  // "Template only — not code to run yet" panel, above the real bindings. It now lives only in
  // the gated "Code shape" help stage (lesson.shape, asserted above), one click away.
  assert.doesNotMatch(html, /id="code-shape"/);
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.doesNotMatch(source, /Template only — not code to run yet/);
  assert.doesNotMatch(html, /<textarea id="code"[^>]*>\s*leftjoin/);
  assert.doesNotMatch(html, /Now use this idea on the case table above\./);
  assert.match(html, /Use the visible case tables and the required result/i);
});

test("C3 distinguishes a restored learner draft from supplied code and names accepted runs", () => {
  assert.equal(typeof client.draftNotice, "function");
  assert.match(client.draftNotice(true, true), /Restored your saved draft.*not supplied code/i);
  assert.match(client.draftNotice(false, false), /starts empty/i);
  assert.equal(client.runOutcomeStatus({status:"ok", pass:true, progress_eligible:true}), "✓ Accepted — evidence saved.");
  assert.match(client.runOutcomeStatus({status:"ok", pass:false}), /Not accepted.*no evidence was saved/i);
});

test("move two stays closed until this browser has a checked join", () => {
  const unavailable = {acceptedMoves(){ return []; }};
  const joined = {acceptedMoves(){ return [{key:"C3/join-report-log", provenance:"historical-browser"}]; }};
  assert.equal(client.initialMove(unavailable, {}, "", "filter-disagreement"), "join-report-log");
  assert.equal(client.initialMove(unavailable, {}, "", "join-report-log"), "join-report-log");
  assert.equal(client.initialMove(joined, {}, "", "filter-disagreement"), "filter-disagreement");
  assert.equal(client.canOpenMove(joined, {}, "", "filter-disagreement"), true);
});

test("a valid saved C3 challenge cursor offers a fresh-check resume target", () => {
  const joined = {
    readCursor(){ return {chapter:"C3", move_id:"filter-disagreement", mode:"challenge"}; },
    readCourseState(){ return {}; },
    acceptedMoves(){ return [{key:"C3/join-report-log", provenance:"historical-browser"}]; }
  };
  assert.equal(client.savedChallengeResume(joined, {}, "try-1"), "filter-disagreement");
  assert.equal(client.savedChallengeResume(Object.assign({}, joined, {readCursor(){ return {chapter:"C2", move_id:"rates", mode:"challenge"}; }}), {}, "try-1"), null);
  assert.equal(client.savedChallengeResume(Object.assign({}, joined, {readCursor(){ return {chapter:"C3", move_id:"filter-disagreement", mode:"demonstration", activity_id:"practice-join-v1"}; }}), {}, "try-1"), null);
  assert.equal(client.savedChallengeResume({readCursor(){ return {chapter:"C3", move_id:"filter-disagreement", mode:"challenge"}; }, readCourseState(){ return {}; }, acceptedMoves(){ return []; }}, {}, "try-1"), null);
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
  assert.match(html, /id="resume-saved"[^>]*hidden/);
  assert.match(html, /id="resume-saved-move"/);
  assert.match(html, /fresh Julia check/i);
});

test("only an accepted current challenge persists a draft-free historical progress, evidence, and next cursor", () => {
  const calls = [];
  const courseState = {
    recordHistoricalMoveIfMissing(...args) { calls.push(["progress", ...args]); return true; },
    writeEvidenceIfMissing(...args) { calls.push(["evidence", ...args]); return true; },
    writeCursor(...args) { calls.push(["cursor", ...args]); return true; },
    writeChallengeDraft(...args) { calls.push(["draft", ...args]); return true; }
  };
  const storage = {};
  assert.equal(client.persistChallengeDraft(courseState, storage, "try-1", "join-report-log", "my code"), true);
  assert.deepEqual(calls.pop(), ["draft", storage, "try-1", "C3", "join-report-log", "my code"]);
  assert.equal(client.persistAcceptedCourseResult(courseState, storage, "try-1", validResult({pass:false, progress_eligible:false})), false);
  assert.equal(calls.length, 0);
  assert.equal(client.persistAcceptedCourseResult(courseState, storage, "try-1", validResult()), true);
  assert.deepEqual(calls, [
    ["progress", storage, "try-1", "C3", "join-report-log"],
    ["evidence", storage, "try-1", {chapter:"C3", move_id:"join-report-log", title:"Connected tray records", row_count:3, provenance:"historical-browser"}],
    ["cursor", storage, "try-1", {chapter:"C3", move_id:"filter-disagreement", mode:"challenge"}]
  ]);
});

test("C3 makes joining the first question and gives keyboard users a recovery route", () => {
  assert.match(client.lessonCopy("join-report-log").question, /put each report tray beside its matching handling record/i);
  assert.match(client.lessonCopy("filter-disagreement").question, /disagree/i);
  assert.equal(client.needsRecoveryFocus({status:"error"}), true);
  assert.equal(client.needsRecoveryFocus({status:"timeout"}), true);
  assert.equal(client.needsRecoveryFocus({status:"ok"}), false);
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
  assert.match(html, /id="reconnect"/);
  assert.match(html, /Before the case: practise matching two records/);
  assert.doesNotMatch(html, /The practice step is optional/);
});

test("a checked C3 disagreement gives the learner one named route to the recheck chapter", () => {
  assert.equal(client.nextDestination("join-report-log", validResult()), "filter-disagreement");
  assert.equal(client.nextDestination("filter-disagreement", validResult({move_id:"filter-disagreement", rows:[JOIN_ROWS[2]]})), "chapter4");
  assert.equal(client.nextDestination("filter-disagreement", validResult({move_id:"filter-disagreement", pass:false, progress_eligible:false, rows:[JOIN_ROWS[2]]})), null);
  assert.equal(client.nextChapterUrl("?attempt=field-7"), "chapter4.html?attempt=field-7");
  assert.equal(client.nextChapterUrl("?attempt=not valid"), "chapter4.html");
});

test("C3 never calls a checked result an unrun draft", () => {
  assert.match(client.draftStatus({status:"ok", pass:true}), /checked this code just now/i);
  assert.match(client.draftStatus({status:"ok", pass:false}), /ran this code/i);
  assert.match(client.draftStatus({status:"timeout"}), /not accepted/i);
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.match(source, /el\.draftNote\.textContent = draftStatus\(message\);/);
});

test("the full-answer hint stops for an explicit confirmation and never supplies challenge code", () => {
  assert.equal(client.helpStage("join-report-log", 0).label, "Concept");
  assert.equal(client.helpStage("join-report-log", 0).button, "Show the code shape");
  assert.equal(client.helpStage("join-report-log", 1).label, "Code shape");
  assert.equal(client.helpStage("join-report-log", 1).button, "Show a full answer?");
  const warning = client.helpStage("join-report-log", 2);
  assert.match(warning.text, /will not write into your challenge editor/i);
  assert.equal(warning.button, "Show complete code now");
  assert.equal(client.helpStage("join-report-log", 3).label, "Full answer");
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.match(source, /local server address shown by the launcher/i);
});

test("C3 teaches a generic Boolean row mask in two small moves before the case answer", () => {
  const comparison = client.helpStage("filter-disagreement", 1);
  assert.equal(comparison.label, "Build the row rule");
  assert.equal(comparison.text, "row_rule = table.left_count .!= table.right_count");
  assert.equal(comparison.button, "Use the row rule to select rows");
  assert.doesNotMatch(comparison.text, /joined|reported_detected_n|logged_detected_n/);

  const selection = client.helpStage("filter-disagreement", 2);
  assert.equal(selection.label, "Select with the row rule");
  assert.equal(selection.text, "table[row_rule, :]");
  assert.equal(selection.button, "Show the combined code shape");
  assert.doesNotMatch(selection.text, /joined|reported_detected_n|logged_detected_n/);

  assert.equal(client.helpStage("filter-disagreement", 3).label, "Code shape");
  assert.equal(client.helpStage("filter-disagreement", 4).label, "Before the full answer");
  assert.equal(client.helpStage("filter-disagreement", 5).label, "Full answer");
});

test("practice metadata and results need a separate exact demonstration identity", () => {
  let state = client.beginDemoInfo(client.createState(), "practice-info");
  assert.equal(client.applyDemoInfo(state, validDemoInfo({request_id:"old"})), state);
  assert.equal(client.applyDemoInfo(state, validDemoInfo({activity_id:null})), state);
  assert.equal(client.applyDemoInfo(state, validDemoInfo({inputs:[practiceReport()]})), state);
  state = client.applyDemoInfo(state, validDemoInfo());
  assert.equal(state.demoInfoRequest, null);
  assert.deepEqual(state.demoMetadata.inputs.map(input => input.id), ["practice_report", "practice_log"]);
  state = client.beginDemoRun(state, "practice-run");
  assert.equal(client.applyDemoResult(state, validDemoResult({request_id:"old"})), state);
  assert.equal(client.applyDemoResult(state, validDemoResult({mode:"challenge", activity_id:null, pass:true, progress_eligible:true})), state);
  const done = client.applyDemoResult(state, validDemoResult());
  assert.equal(done.demoPending, null);
  assert.equal(done.demoResult.mode, "demonstration");
  assert.equal(done.demoResult.pass, null);
  assert.equal(done.demoResult.practice_pass, true);
  assert.equal(done.evidence, null);
});

test("practice drafts use their own demonstration key and never create case evidence", () => {
  const calls = [];
  const courseState = {writeDraft(...args) { calls.push(args); return true; }};
  assert.equal(client.persistDemoDraft(courseState, {}, "try-1", "my practice code"), true);
  assert.deepEqual(calls, [[{}, "try-1", "C3", "join-report-log", "demonstration", "practice-join-v1", "my practice code"]]);
  assert.equal(client.persistDemoDraft(courseState, {}, "try-1", 42), false);
});

test("the optional practice panel has its own blank editor and deliberate build/run controls", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
  assert.match(html, /id="demo-panel"/);
  assert.match(html, /Before the case: practise matching two records/);
  assert.ok(html.indexOf('id="demo-panel"') < html.indexOf('id="code"'));
  assert.match(html, /id="demo-inputs"/);
  assert.match(html, /<textarea id="demo-code"[^>]*><\/textarea>/);
  assert.match(html, /data-demo-token="open"/);
  assert.match(html, /data-demo-token="key"/);
  assert.match(html, /id="run-demo"/);
  assert.match(html, /Run demonstration/);
  assert.match(html, /predict.*shared key.*how many rows/i);
  assert.match(html, /id="demo-case-bridge"/);
  assert.match(html, /<code>report<\/code>.*<code>tray_id<\/code>.*<code>reported_detected_n<\/code>/s);
  assert.match(html, /<code>handling_log<\/code>.*<code>tray_id<\/code>.*<code>logged_detected_n<\/code>.*<code>log_status<\/code>/s);
  assert.match(html, /How can we put each report tray beside its matching handling record\?/);
  assert.match(html, /One row per report tray, with that tray’s matching handling-log fields\./);
  assert.match(html, /<a id="return-to-case"[^>]*href="#code"/);
  assert.equal(client.shouldOfferCaseReturn(validDemoResult()), true);
  assert.equal(client.shouldOfferCaseReturn(validDemoResult({status:"error"})), true);
  assert.equal(client.shouldOfferCaseReturn(validDemoResult({mode:"challenge", activity_id:null, pass:true, progress_eligible:true})), false);
  assert.equal(client.shouldShowDemoCaseBridge(validDemoResult()), true);
  assert.equal(client.shouldShowDemoCaseBridge(validDemoResult({practice_pass:false})), false);
  assert.equal(client.shouldShowDemoCaseBridge(validDemoResult({practice_pass:null})), false);
  assert.equal(client.shouldShowDemoCaseBridge(validDemoResult({pass:true, practice_pass:false})), false);
  assert.equal(client.shouldShowDemoCaseBridge(validDemoResult({status:"error"})), false);
  assert.equal(client.shouldShowDemoCaseBridge(validDemoResult({mode:"challenge", activity_id:null, pass:true, progress_eligible:true})), false);
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.match(source, /const showCaseBridge = shouldShowDemoCaseBridge\(message\);/);
  assert.match(source, /el\.demoCaseBridge\.hidden = !showCaseBridge/);
});

test("C3 keeps provisional authoring notes out of the learner-facing scene", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
  assert.doesNotMatch(html, /Draft dialogue for Shinichi to edit\./);
});

test("a disconnected or hidden practice request cannot settle later", () => {
  let state = client.beginDemoInfo(client.createState(), "info-1");
  state = client.disconnect(state);
  assert.equal(client.applyDemoInfo(state, validDemoInfo({request_id:"info-1"})), state);
  state = client.applyDemoInfo(client.beginDemoInfo(client.createState(), "info-2"), validDemoInfo({request_id:"info-2"}));
  state = client.beginDemoRun(state, "run-1");
  state = client.cancelDemo(state);
  assert.equal(client.applyDemoResult(state, validDemoResult({request_id:"run-1"})), state);
  const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.match(source, /if \(el\.demoPanel && el\.demoPanel\.open\) requestDemoInfo\(\);/);
});

function reportInput() {
  return {id:"report", columns:["tray_id", "reported_detected_n"], rows:[{tray_id:"T-A", reported_detected_n:2}]};
}
function logInput() {
  return {id:"handling_log", columns:["tray_id", "logged_detected_n", "log_status"], rows:[{tray_id:"T-A", logged_detected_n:2, log_status:"entered"}]};
}
function joinedInput() {
  return {id:"joined", columns:JOIN_COLUMNS, rows:JOIN_ROWS};
}
function practiceReport() {
  return {id:"practice_report", columns:["key", "reported_detected_n"], rows:[{key:"K-A", reported_detected_n:2}, {key:"K-B", reported_detected_n:1}]};
}
function practiceLog() {
  return {id:"practice_log", columns:["key", "logged_detected_n", "log_status"], rows:[{key:"K-A", logged_detected_n:2, log_status:"entered"}, {key:"K-B", logged_detected_n:0, log_status:"not entered"}]};
}
function validDemoInfo(overrides = {}) {
  return Object.assign({
    type:"case", contract_version:1, case_id:CASE_ID, chapter:"C3", move_id:"join-report-log", mode:"demonstration", activity_id:"practice-join-v1", request_id:"practice-info",
    simulation_id:null,
    inputs:[practiceReport(), practiceLog()]
  }, overrides);
}
function validDemoResult(overrides = {}) {
  return Object.assign({
    type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C3", move_id:"join-report-log", mode:"demonstration", activity_id:"practice-join-v1", simulation_id:null,
    request_id:"practice-run", status:"ok", pass:null, practice_pass:true, progress_eligible:false, columns:["key", "reported_detected_n", "logged_detected_n", "log_status"],
    rows:[{key:"K-A", reported_detected_n:2, logged_detected_n:2, log_status:"entered"}, {key:"K-B", reported_detected_n:1, logged_detected_n:0, log_status:"not entered"}]
  }, overrides);
}
function validInfo(overrides = {}) {
  return Object.assign({
    type:"case", contract_version:1, case_id:CASE_ID, chapter:"C3", move_id:"join-report-log", mode:"challenge", activity_id:null, simulation_id:null, request_id:"info-1",
    inputs:[reportInput(), logInput()]
  }, overrides);
}
function validResult(overrides = {}) {
  return Object.assign({
    type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C3", move_id:"join-report-log", mode:"challenge",
    activity_id:null, simulation_id:null, request_id:"run-1", status:"ok", pass:true, progress_eligible:true,
    columns:JOIN_COLUMNS, rows:JOIN_ROWS, result_data:{kind:"table", columns:JOIN_COLUMNS, rows:JOIN_ROWS}
  }, overrides);
}

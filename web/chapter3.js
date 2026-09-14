/* Julia Time: Missing Fleas C3. The server remains the source of all case data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeChapter3 = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.init);
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const INFO_DEADLINE_MS = 5000;
  const RUN_DEADLINE_MS = 7000;

  const CASE_ID = "missing-fleas-v1";
  const CHAPTER = "C3";
  const MOVES = ["join-report-log", "filter-disagreement"];
  const DEMO_ACTIVITY = "practice-join-v1";
  const DEMO_INPUTS = ["practice_report", "practice_log"];
  const TABLE_IDENTITIES = Object.freeze({
    report:Object.freeze({name:"report", title:"Tray summary from Chapter 2", role:"Left table — keep every tray summary row"}),
    handling_log:Object.freeze({name:"handling_log", title:"Simulated handling log", role:"Right table — add its matching log fields"}),
    joined:Object.freeze({name:"joined", title:"Canonical joined table for the next check", role:"The lab’s regenerated copy of the table your accepted join matched"}),
    practice_report:Object.freeze({name:"practice_report", title:"Practice report", role:"Practice-only left table"}),
    practice_log:Object.freeze({name:"practice_log", title:"Practice log", role:"Practice-only right table"})
  });
  const INPUTS = {
    "join-report-log": ["report", "handling_log"],
    "filter-disagreement": ["joined"]
  };
  const JOIN_COLUMNS = ["tray_id", "reported_detected_n", "logged_detected_n", "log_status"];
  const COPY = {
    "join-report-log": {
      label: "1 of 2 · Connect the two records",
      title: "Connect the tray summary to its handling record",
      question: "How can we put each report tray beside its matching handling record?",
      returnSpec: "One row per report tray, with that tray’s matching handling-log fields.",
      bridge: "Both tables use tray_id. Each tray ID occurs once in each table, so every report tray can safely meet one handling record.",
      concept: "A key is the shared label that tells Julia which row in one table belongs with which row in the other. Here the matching is one-to-one: one report row and one handling-log row for each tray.",
      shape: "leftjoin(left_table, right_table, on=:shared_column)",
      solution: "leftjoin(report, handling_log, on=:tray_id)",
      syntax: "leftjoin means ‘keep every row from the left table, and add matching details from the right table’. The first comma separates the left table from the right table. The second comma separates those table inputs from the on= instruction. on= means ‘join using’; :shared_column means ‘the column named shared_column’.",
      recovery: "Check that leftjoin has two tables separated by a comma, then check the second comma comes before the on= instruction that names their shared column. Run the join again.",
      r: "dplyr::left_join(left_table, right_table, by = \"shared_column\")",
      python: "left_table.merge(right_table, on=\"shared_column\", how=\"left\")",
      visualTitle: "Rows connected by their shared key"
    },
    "filter-disagreement": {
      label: "2 of 2 · Inspect the disagreement",
      title: "Keep only the row whose two records differ",
      question: "Which returned joined row has records that disagree?",
      returnSpec: "Exactly the returned joined row where reported_detected_n and logged_detected_n differ.",
      bridge: "Your accepted join unlocked the same canonical comparison table below. The lab regenerates it for this next check so it can verify the result independently; use a Boolean rule to keep the row where the two count columns are not equal.",
      concept: "A dotted comparison checks each row. .!= asks whether the two values are not equal for that row, producing a true-or-false rule that can select rows.",
      scaffolds: [
        {label:"Build the row rule", text:"row_rule = table.left_count .!= table.right_count", button:"Use the row rule to select rows"},
        {label:"Select with the row rule", text:"table[row_rule, :]", button:"Show the combined code shape"}
      ],
      shape: "table[table.left_count .!= table.right_count, :]",
      solution: "joined[joined.reported_detected_n .!= joined.logged_detected_n, :]",
      syntax: "C1’s .== compared each value with a target. .!= is its ‘not equal’ partner: it checks each paired count and is true when they differ. Inside brackets, the comma separates the rows rule from the columns position; : in the second position means all columns.",
      recovery: "Check that .!= has the dot, then keep the comma before : so Julia knows you want every column of the matching row.",
      r: "dplyr::filter(table, left_count != right_count)",
      python: "table.loc[table[\"left_count\"] != table[\"right_count\"]]",
      visualTitle: "The returned recording disagreement"
    }
  };

  function knownMove(move) { return MOVES.includes(move); }
  function tableIdentity(id) {
    const identity = TABLE_IDENTITIES[id];
    return identity ? {name:identity.name, title:identity.title, role:identity.role} : null;
  }
  function activeInputIds(move) { return knownMove(move) ? INPUTS[move].slice() : []; }
  function lessonCopy(move) { return COPY[knownMove(move) ? move : MOVES[0]]; }
  function recoveryCopy(move) { return lessonCopy(move).recovery; }
  function needsRecoveryFocus(message) { return Boolean(message && (message.status === "error" || message.status === "timeout")); }
  function draftStatus(message) {
    if (!message || message.status === "timeout") return "This code was not accepted; your draft is still here to check and run again.";
    if (message.status === "error") return "Julia could not run this code; your draft is still here to revise and run again.";
    if (message.status === "ok" && message.pass === true) return "✓ Accepted — evidence saved. Julia checked this code just now; you can change it and run again.";
    if (message.status === "ok") return "Julia ran this code, but the returned result does not yet meet the stated requirement.";
    return "This is your own unrun draft for this move.";
  }
  function draftNotice(hasCode, restored) {
    if (!hasCode) return "This challenge editor starts empty. Write your own Julia result.";
    return restored ? "Restored your saved draft — it is your earlier typing, not supplied code." : "This is your own unrun draft for this move.";
  }
  function runOutcomeStatus(message) {
    if (!message) return "";
    if (message.status === "ok" && message.pass === true) return "✓ Accepted — evidence saved.";
    if (message.status === "timeout") return "Not accepted — the run timed out. No evidence was saved.";
    if (message.status === "error") return "Not accepted — Julia could not run this code. No evidence was saved.";
    return "Not accepted — no evidence was saved.";
  }
  function helpStages(move) {
    const copy = lessonCopy(move);
    const scaffolds = Array.isArray(copy.scaffolds) ? copy.scaffolds : [];
    return [
      {label:"Concept", text:copy.concept, button:"Show the code shape"},
      ...scaffolds,
      {label:"Code shape", text:copy.shape, button:"Show a full answer?"},
      {label:"Before the full answer", text:"This will show one complete expression for the idea above. It will not write into your challenge editor or add case evidence.", button:"Show complete code now"},
      {label:"Full answer", text:copy.solution, button:"All help shown"}
    ];
  }
  function helpStage(move, index) {
    return helpStages(move)[index] || null;
  }
  function validAttempt(value) { return /^[a-z0-9-]{1,80}$/.test(value || ""); }
  function caseBoardUrl(search) {
    const attempt = new URLSearchParams(search || "").get("attempt");
    return "course/index.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function nextChapterUrl(search) {
    const attempt = new URLSearchParams(search || "").get("attempt");
    return "chapter4.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function requestedMove(search) {
    const move = new URLSearchParams(search || "").get("move_id") || new URLSearchParams(search || "").get("move");
    return knownMove(move) ? move : "";
  }
  function createState() {
    return {connection:"connecting", activeMove:MOVES[0], infoRequest:null, pending:null, expired:false, statusMessage:null, metadata:null, metadataFailure:"", result:null, evidence:null, joinAccepted:false, demoInfoRequest:null, demoPending:null, demoExpired:false, demoStatusMessage:null, demoMetadata:null, demoResult:null};
  }
  function beginInfo(state, requestId, moveId) {
    const move = knownMove(moveId) ? moveId : MOVES[0];
    return Object.assign({}, state, {
      activeMove:move,
      infoRequest:{case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:null, request_id:requestId},
      pending:null,
      expired:false,
      statusMessage:null,
      metadata:null,
      result:null,
      metadataFailure:""
    });
  }
  function failCaseInfo(state, message) {
    if (!state.infoRequest || !message || message.type !== "error") return state;
    const text = /unknown mystery chapter/i.test(String(message.message || "")) ? "The local lab does not recognise this chapter. Restart Julia Time, then reload this page. Your draft is still here." : "The chapter inputs are unavailable. Restart Julia Time, then reload this page. Your draft is still here.";
    return Object.assign({}, state, {infoRequest:null, metadata:null, metadataFailure:text});
  }
  function expireInfo(state, requestId) {
    if (!state.infoRequest || state.infoRequest.request_id !== requestId) return state;
    return Object.assign({}, state, {infoRequest:null, metadata:null, metadataFailure:"The case data took too long to arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here."});
  }
  function beginRun(state, requestId, moveId) {
    const move = knownMove(moveId) ? moveId : state.activeMove;
    if (!knownMove(move)) return state;
    return Object.assign({}, state, {
      activeMove:move,
      pending:{case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:null, request_id:requestId},
      expired:false,
      statusMessage:null,
      result:null
    });
  }
  // `pending` is kept (not nulled) on expiry so a correct result arriving late for this same
  // request is still applied rather than discarded (B1); `isRunPending` makes the run retryable.
  function expireRun(state, requestId) {
    if (!state.pending || state.pending.request_id !== requestId) return state;
    return Object.assign({}, state, {expired:true, statusMessage:null, result:{type:"case_result", status:"timeout", message:"This check took too long. Your draft is still here; check it, then run again."}});
  }
  function cancelRun(state) { return Object.assign({}, state, {pending:null, expired:false, statusMessage:null, result:null}); }
  function cancelDemo(state) { return Object.assign({}, state, {demoInfoRequest:null, demoPending:null, demoExpired:false, demoStatusMessage:null, demoResult:null}); }
  function disconnect(state) { return Object.assign({}, state, {connection:"offline", infoRequest:null, pending:null, expired:false, statusMessage:null, demoInfoRequest:null, demoPending:null, demoExpired:false, demoStatusMessage:null}); }
  function isRunPending(state) { return Boolean(state.pending) && !state.expired; }
  function isDemoRunPending(state) { return Boolean(state.demoPending) && !state.demoExpired; }
  function applyRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.pending || state.expired || message.request_id !== state.pending.request_id) return state;
    return Object.assign({}, state, {statusMessage: message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : ""});
  }
  function applyDemoRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.demoPending || state.demoExpired || message.request_id !== state.demoPending.request_id) return state;
    return Object.assign({}, state, {demoStatusMessage: message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : ""});
  }
  function exactInputSet(inputs, move) {
    if (!Array.isArray(inputs) || inputs.length !== activeInputIds(move).length) return false;
    const expected = activeInputIds(move).slice().sort();
    const ids = inputs.map(input => input && input.id).sort();
    return ids.every((id, index) => id === expected[index]) && new Set(ids).size === ids.length && inputs.every(validTableInput);
  }
  function validTableInput(input) {
    return Boolean(input && typeof input.id === "string" && Array.isArray(input.columns) && input.columns.every(column => typeof column === "string") && Array.isArray(input.rows) && input.rows.every(row => row && typeof row === "object" && !Array.isArray(row)));
  }
  function sameCaseIdentity(message, expected) {
    return Boolean(message && expected && message.contract_version === 1 && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id && message.request_id === expected.request_id);
  }
  function applyCaseInfo(state, message) {
    if (!state.infoRequest || !message || message.type !== "case" || !sameCaseIdentity(message, state.infoRequest) || message.move_id !== state.activeMove || !exactInputSet(message.inputs, state.activeMove)) return state;
    return Object.assign({}, state, {infoRequest:null, metadata:message, metadataFailure:""});
  }
  function exactDemoInputSet(inputs) {
    if (!Array.isArray(inputs) || inputs.length !== DEMO_INPUTS.length) return false;
    const ids = inputs.map(input => input && input.id).sort();
    return ids.every((id, index) => id === DEMO_INPUTS.slice().sort()[index]) && new Set(ids).size === ids.length && inputs.every(validTableInput);
  }
  function beginDemoInfo(state, requestId) {
    if (state.activeMove !== "join-report-log") return state;
    return Object.assign({}, state, {demoInfoRequest:{case_id:CASE_ID, chapter:CHAPTER, move_id:"join-report-log", mode:"demonstration", activity_id:DEMO_ACTIVITY, simulation_id:null, request_id:requestId}, demoMetadata:null, demoResult:null, demoPending:null});
  }
  function expireDemoInfo(state, requestId) {
    if (!state || !state.demoInfoRequest || state.demoInfoRequest.request_id !== requestId) return state;
    return Object.assign({}, state, {demoInfoRequest:null, demoMetadata:null, demoPending:null, demoResult:{type:"case_result", status:"timeout", request_id:requestId, message:"The practice tables took too long to arrive. Reconnect or reopen this practice section to try again; your challenge editor is unchanged."}});
  }
  function applyDemoInfo(state, message) {
    if (!state.demoInfoRequest || !message || message.type !== "case" || !sameCaseIdentity(message, state.demoInfoRequest) || message.mode !== "demonstration" || message.activity_id !== DEMO_ACTIVITY || !exactDemoInputSet(message.inputs)) return state;
    return Object.assign({}, state, {demoInfoRequest:null, demoMetadata:message});
  }
  function sameRunIdentity(message, expected) {
    return sameCaseIdentity(message, expected) && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id;
  }
  function applyCaseResult(state, message) {
    if (!state.pending || !message || message.type !== "case_result" || !sameRunIdentity(message, state.pending)) return state;
    const visual = message.status === "ok" && message.pass === true && message.progress_eligible === true ? visualData(state.activeMove, message) : null;
    const evidence = visual ? {move_id:state.activeMove, columns:message.columns.slice(), rows:message.rows.map(row => Object.assign({}, row)), visual:visual} : state.evidence;
    return Object.assign({}, state, {pending:null, expired:false, statusMessage:null, result:message, evidence:evidence});
  }
  function beginDemoRun(state, requestId) {
    if (state.activeMove !== "join-report-log" || !state.demoMetadata) return state;
    return Object.assign({}, state, {demoPending:{case_id:CASE_ID, chapter:CHAPTER, move_id:"join-report-log", mode:"demonstration", activity_id:DEMO_ACTIVITY, simulation_id:null, request_id:requestId}, demoExpired:false, demoStatusMessage:null, demoResult:null});
  }
  // `demoPending` is kept (not nulled) on expiry, same reasoning as `expireRun` above (B1).
  function expireDemoRun(state, requestId) {
    if (!state || !state.demoPending || state.demoPending.request_id !== requestId) return state;
    return Object.assign({}, state, {demoExpired:true, demoStatusMessage:null, demoResult:{type:"case_result", status:"timeout", request_id:requestId, message:"The practice run took too long. Your practice code is still here; check it and run again."}});
  }
  function applyDemoResult(state, message) {
    if (!state.demoPending || !message || message.type !== "case_result" || !sameRunIdentity(message, state.demoPending)) return state;
    return Object.assign({}, state, {demoPending:null, demoExpired:false, demoStatusMessage:null, demoResult:message});
  }
  function normalisedJoinRows(payload) {
    if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.rows) || !JOIN_COLUMNS.every(column => payload.columns.includes(column))) return null;
    if (payload.rows.length === 0 || !payload.rows.every(row => row && typeof row === "object" && typeof row.tray_id === "string" && row.tray_id.length > 0 && Number.isFinite(row.reported_detected_n) && Number.isFinite(row.logged_detected_n) && typeof row.log_status === "string")) return null;
    if (new Set(payload.rows.map(row => row.tray_id)).size !== payload.rows.length) return null;
    return payload.rows.map(row => ({tray_id:row.tray_id, report:row.reported_detected_n, log:row.logged_detected_n, log_status:row.log_status}));
  }
  function visualData(move, payload) {
    const rows = normalisedJoinRows(payload);
    if (!rows) return null;
    if (move === "join-report-log") return {kind:"key-alignment", rows:rows};
    if (move === "filter-disagreement" && rows.length === 1 && rows[0].report !== rows[0].log) return {kind:"recording-disagreement", rows:rows};
    return null;
  }
  function acceptedMoveKeys(courseState, storage, attempt) {
    if (!courseState || typeof courseState.acceptedMoves !== "function") return [];
    try {
      const course = typeof courseState.readCourseState === "function" ? courseState.readCourseState(storage, attempt) : undefined;
      const moves = courseState.acceptedMoves(course);
      return Array.isArray(moves) ? moves.map(move => move && move.key).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function canOpenMove(courseState, storage, attempt, move) {
    if (!knownMove(move)) return false;
    return move === "join-report-log" || acceptedMoveKeys(courseState, storage, attempt).includes("C3/join-report-log");
  }
  function initialMove(courseState, storage, attempt, requested) {
    const move = knownMove(requested) ? requested : "join-report-log";
    return canOpenMove(courseState, storage, attempt, move) ? move : "join-report-log";
  }
  function savedChallengeResume(courseState, storage, attempt) {
    if (!courseState || typeof courseState.readCursor !== "function") return null;
    try {
      const cursor = courseState.readCursor(storage, attempt);
      if (!cursor || cursor.chapter !== CHAPTER || cursor.mode !== "challenge" || !knownMove(cursor.move_id)) return null;
      return canOpenMove(courseState, storage, attempt, cursor.move_id) ? cursor.move_id : null;
    } catch (_) { return null; }
  }
  function nextMove(move) { return move === "join-report-log" ? "filter-disagreement" : "filter-disagreement"; }
  function isAcceptedChallengeResult(result) {
    return Boolean(result && result.type === "case_result" && result.contract_version === 1 && result.case_id === CASE_ID && result.chapter === CHAPTER && knownMove(result.move_id) && result.mode === "challenge" && result.activity_id === null && result.simulation_id === null && result.status === "ok" && result.pass === true && result.progress_eligible === true && visualData(result.move_id, result));
  }
  function shouldRenderCaseVisual(result) { return isAcceptedChallengeResult(result); }
  function shouldOfferCaseReturn(result) {
    return Boolean(result && result.type === "case_result" && result.contract_version === 1 && result.case_id === CASE_ID && result.chapter === CHAPTER && result.move_id === "join-report-log" && result.mode === "demonstration" && result.activity_id === DEMO_ACTIVITY && result.simulation_id === null && typeof result.request_id === "string" && result.request_id.length > 0 && ["ok", "error", "timeout"].includes(result.status));
  }
  function shouldShowDemoCaseBridge(result) { return shouldOfferCaseReturn(result) && result.status === "ok" && result.practice_pass === true; }
  function persistChallengeDraft(courseState, storage, attempt, move, code) {
    if (!courseState || typeof courseState.writeChallengeDraft !== "function" || !knownMove(move) || typeof code !== "string") return false;
    try { return courseState.writeChallengeDraft(storage, attempt, CHAPTER, move, code) === true; } catch (_) { return false; }
  }
  function persistDemoDraft(courseState, storage, attempt, code) {
    if (!courseState || typeof courseState.writeDraft !== "function" || typeof code !== "string") return false;
    try { return courseState.writeDraft(storage, attempt, CHAPTER, "join-report-log", "demonstration", DEMO_ACTIVITY, code) === true; } catch (_) { return false; }
  }
  function persistAcceptedCourseResult(courseState, storage, attempt, result) {
    if (!isAcceptedChallengeResult(result) || !courseState || typeof courseState.recordHistoricalMoveIfMissing !== "function" || typeof courseState.writeEvidenceIfMissing !== "function" || typeof courseState.writeCursor !== "function") return false;
    const title = result.move_id === "join-report-log" ? "Connected tray records" : "Recording disagreement";
    try {
      courseState.recordHistoricalMoveIfMissing(storage, attempt, CHAPTER, result.move_id);
      courseState.writeEvidenceIfMissing(storage, attempt, {chapter:CHAPTER, move_id:result.move_id, title:title, row_count:result.rows.length, provenance:"historical-browser"});
      courseState.writeCursor(storage, attempt, {chapter:CHAPTER, move_id:nextMove(result.move_id), mode:"challenge"});
      return true;
    } catch (_) { return false; }
  }
  function requestId(prefix) { return (prefix || "c3") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function infoMessage(move, id) { return {type:"case_info", contract_version:1, case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:null, request_id:id}; }
  function runMessage(move, code, id) { return {type:"case_run", contract_version:1, case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:null, code:code, request_id:id}; }
  function demoInfoMessage(id) { return {type:"case_info", contract_version:1, case_id:CASE_ID, chapter:CHAPTER, move_id:"join-report-log", mode:"demonstration", activity_id:DEMO_ACTIVITY, simulation_id:null, request_id:id}; }
  function demoRunMessage(code, id) { return {type:"case_run", contract_version:1, case_id:CASE_ID, chapter:CHAPTER, move_id:"join-report-log", mode:"demonstration", activity_id:DEMO_ACTIVITY, simulation_id:null, code:code, request_id:id}; }
  function safeText(value) {
    if (value == null) return "";
    if (typeof value === "object") return value.display == null ? JSON.stringify(value) : String(value.display);
    return String(value);
  }

  function init() {
    const $ = id => document.getElementById(id);
    const el = {
      scene:$("scene"), investigation:$("investigation"), start:$("start-investigation"), back:$("back-to-scene"), resumeSaved:$("resume-saved"), resumeSavedNote:$("resume-saved-note"), resumeSavedMove:$("resume-saved-move"),
      board:$("case-board"), location:$("course-location"), reconnect:$("reconnect"), moveButtons:document.querySelectorAll("[data-move]"),
      title:$("move-title"), question:$("move-question"), bridge:$("move-bridge"), returnSpec:$("return-spec"), syntax:$("syntax-note"), challengeBridge:$("challenge-bridge"),
      inputs:$("visible-inputs"), bindings:$("case-bindings"), code:$("code"), run:$("run"), runStatus:$("run-status"), result:$("result"), visual:$("returned-visual"),
      help:$("help-list"), nextHelp:$("next-help"), showAnswer:$("show-answer"), answerReference:$("answer-before-editor"), comparisons:$("comparisons"), connection:$("connection"), nextMove:$("next-move"), draftNote:$("draft-note"),
      demoPanel:$("demo-panel"), demoCopy:$("demo-copy"), demoInputs:$("demo-inputs"), demoCode:$("demo-code"), demoTokenButtons:document.querySelectorAll("[data-demo-token]"), runDemo:$("run-demo"), demoPlan:$("demo-plan"), demoResult:$("demo-result"), demoCaseBridge:$("demo-case-bridge"), returnToCase:$("return-to-case"), demoDraftNote:$("demo-draft-note")
    };
    let storage = null;
    try { storage = localStorage; } catch (_) {}
    const courseState = typeof window !== "undefined" ? window.JuliaTimeCourseState : null;
    const requestedAttempt = new URLSearchParams(location.search).get("attempt");
    const attempt = validAttempt(requestedAttempt) ? requestedAttempt : "";
    let state = createState();
    let socket = null;
    let stopped = false;
    let timer = null;
    let runTimer = null;
    let infoTimer = null;
    let demoInfoTimer = null;
    let demoRunTimer = null;
    let reconnects = 0;
    let hintIndex = 0;
    const drafts = Object.create(null), restoredDrafts = Object.create(null);
    let demoDraft = "";
    try {
      const savedDrafts = courseState && typeof courseState.readChallengeDrafts === "function" ? courseState.readChallengeDrafts(storage, attempt) : {};
      Object.entries(savedDrafts || {}).forEach(([key, value]) => { if (key.startsWith("C3/") && typeof value === "string") { drafts[key.slice(3)] = value; restoredDrafts[key.slice(3)] = value.length > 0; } });
      demoDraft = courseState && typeof courseState.readDraft === "function" ? courseState.readDraft(storage, attempt, CHAPTER, "join-report-log", "demonstration", DEMO_ACTIVITY) : "";
    } catch (_) {}
    const requested = requestedMove(location.search);
    state.activeMove = initialMove(courseState, storage, attempt, requested);
    state.joinAccepted = canOpenMove(courseState, storage, attempt, "filter-disagreement");
    if (el.board) el.board.href = caseBoardUrl(location.search);
    if (el.demoCode) el.demoCode.value = demoDraft;

    function current() { return lessonCopy(state.activeMove); }
    function renderSavedResume() {
      const move = savedChallengeResume(courseState, storage, attempt);
      if (!el.resumeSaved) return;
      el.resumeSaved.hidden = !move;
      if (!move) return;
      if (el.resumeSavedNote) el.resumeSavedNote.textContent = "Your earlier C3 work is saved only in this browser. Reopen your next move for a fresh Julia check.";
      if (el.resumeSavedMove) el.resumeSavedMove.textContent = "Resume saved move: " + lessonCopy(move).title + " →";
    }
    function updateControls() {
      if (el.run) el.run.disabled = state.connection !== "connected" || !state.metadata || isRunPending(state);
      if (el.runStatus) el.runStatus.textContent = isRunPending(state) ? (state.statusMessage || "Checking your Julia result…") : state.metadataFailure || (state.result ? runOutcomeStatus(state.result) : (state.connection === "connected" ? (state.metadata ? "Lab file ready" : "Loading the case file…") : "Connect to the lab to run Julia"));
      if (el.reconnect) el.reconnect.hidden = !state.metadataFailure && (state.connection === "connected" || state.connection === "connecting");
      const demoReady = state.connection === "connected" && state.activeMove === "join-report-log" && Boolean(state.demoMetadata) && !isDemoRunPending(state);
      if (el.runDemo) el.runDemo.disabled = !demoReady;
      el.demoTokenButtons.forEach(button => {
        const code = el.demoCode ? el.demoCode.value.trim() : "";
        button.disabled = !demoReady || (button.dataset.demoToken === "key" && code !== "leftjoin(");
      });
    }
    function clearResult() {
      if (el.result) el.result.replaceChildren();
      if (el.visual) el.visual.replaceChildren();
      if (el.nextMove) { el.nextMove.hidden = true; el.nextMove.dataset.destination = ""; }
    }
    function clearDemoResult() { if (el.demoResult) el.demoResult.replaceChildren(); if (el.demoCaseBridge) el.demoCaseBridge.hidden = true; if (el.returnToCase) el.returnToCase.hidden = true; }
    function clearRunTimer() { if (runTimer) { clearTimeout(runTimer); runTimer = null; } }
    function clearInfoTimer() { if (infoTimer) { clearTimeout(infoTimer); infoTimer = null; } }
    function clearDemoInfoTimer() { if (demoInfoTimer) { clearTimeout(demoInfoTimer); demoInfoTimer = null; } }
    function clearDemoRunTimer() { if (demoRunTimer) { clearTimeout(demoRunTimer); demoRunTimer = null; } }
    function renderInputsFailure() {
      if (el.inputs) el.inputs.textContent = state.metadataFailure || "The case inputs are unavailable.";
      if (el.bindings) el.bindings.textContent = "Your draft is safe. Reconnect or restart Julia Time, then reload this page.";
    }
    function armRunDeadline(id) {
      clearRunTimer();
      runTimer = setTimeout(() => {
        const before = state; state = expireRun(state, id); if (state === before) return;
        renderResult(state.result); renderMoveButtons(); updateControls();
        if (el.code) el.code.focus();
      }, RUN_DEADLINE_MS);
    }
    function armDemoRunDeadline(id) {
      clearDemoRunTimer();
      demoRunTimer = setTimeout(() => {
        const before = state; state = expireDemoRun(state, id); if (state === before) return;
        renderDemoResult(state.demoResult); updateControls();
        if (el.demoCode) el.demoCode.focus();
      }, RUN_DEADLINE_MS);
    }
    function renderDemoFallback() {
      if (!el.demoInputs) return;
      el.demoInputs.replaceChildren();
      const p = document.createElement("p");
      p.textContent = state.demoResult && state.demoResult.status === "timeout" ? state.demoResult.message : "The separate K-A/K-B practice tables will appear here when the lab supplies them. They are not Missing Fleas case evidence.";
      el.demoInputs.append(p);
      if (el.demoCaseBridge) el.demoCaseBridge.hidden = true;
      if (el.returnToCase) el.returnToCase.hidden = true;
    }
    function renderMove() {
      const copy = current();
      if (el.location) el.location.textContent = "Case 3 of 6 · " + copy.label;
      if (el.title) el.title.textContent = copy.title;
      if (el.question) el.question.textContent = copy.question;
      if (el.bridge) el.bridge.textContent = copy.bridge;
      if (el.returnSpec) el.returnSpec.textContent = copy.returnSpec;
      if (el.syntax) el.syntax.textContent = copy.syntax;
      // T2 (2026-09-12 playtest): the code shape used to leak into this always-visible panel,
      // duplicating the gated "Code shape" hint stage below and turning the move into
      // substitution rather than a decision. It now lives only in that staged hint.
      if (el.challengeBridge) el.challengeBridge.textContent = "Use the visible case tables and the required result to decide your next Julia move. This empty editor is for your own result.";
      if (el.comparisons) el.comparisons.textContent = "R (dplyr): " + copy.r + "\n\nPython (pandas): " + copy.python;
      if (el.code) el.code.value = drafts[state.activeMove] || "";
      if (el.draftNote) el.draftNote.textContent = draftNotice(Boolean(el.code && el.code.value), Boolean(restoredDrafts[state.activeMove]));
      if (el.help) el.help.replaceChildren();
      if (el.answerReference) { el.answerReference.hidden = true; el.answerReference.replaceChildren(); }
      if (el.nextHelp) el.nextHelp.textContent = "Show the first small hint";
      hintIndex = 0;
      clearResult();
      if (el.demoPanel) el.demoPanel.hidden = state.activeMove !== "join-report-log";
      if (state.activeMove !== "join-report-log") {
        state = cancelDemo(Object.assign({}, state, {demoMetadata:null}));
        renderDemoFallback();
      } else if (!state.demoMetadata) renderDemoFallback();
      if (el.inputs) {
        el.inputs.replaceChildren();
        const p = document.createElement("p");
        p.textContent = "Waiting for the lab to supply this move’s complete tables and column names…";
        el.inputs.append(p);
      }
      if (el.bindings) {
        el.bindings.replaceChildren();
        const p = document.createElement("p");
        p.textContent = "Loading the exact Julia names you can use in this move…";
        el.bindings.append(p);
      }
      el.moveButtons.forEach(button => {
        const available = button.dataset.move === "join-report-log" || state.joinAccepted || canOpenMove(courseState, storage, attempt, button.dataset.move);
        button.disabled = !available;
        button.setAttribute("aria-current", button.dataset.move === state.activeMove ? "step" : "false");
      });
      updateControls();
    }
    function renderTable(input) {
      const panel = document.createElement("section");
      panel.className = "input-table";
      const heading = document.createElement("h3");
      const identity = tableIdentity(input.id);
      heading.textContent = (identity && identity.title) || input.label || input.id;
      if (identity) {
        const binding = document.createElement("p");
        binding.className = "data-label";
        binding.append("Julia name: ");
        const code = document.createElement("code");
        code.textContent = identity.name;
        binding.append(code, " — " + identity.role);
        panel.append(heading, binding);
      } else panel.append(heading);
      const label = document.createElement("p");
      label.className = "data-label";
      label.textContent = input.data_label || "Simulated teaching case — seeded fixture; no real experiment.";
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      wrap.tabIndex = 0;
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      input.columns.forEach(column => { const th = document.createElement("th"); th.textContent = column; headRow.append(th); });
      thead.append(headRow);
      const body = document.createElement("tbody");
      input.rows.forEach(row => { const tr = document.createElement("tr"); input.columns.forEach(column => { const td = document.createElement("td"); td.textContent = safeText(row[column]); tr.append(td); }); body.append(tr); });
      table.append(thead, body); wrap.append(table); panel.append(label, wrap); return panel;
    }
    function renderBindings(metadata) {
      if (!el.bindings) return;
      el.bindings.replaceChildren();
      const heading = document.createElement("strong");
      heading.textContent = "Use these exact Julia names in your editor";
      el.bindings.append(heading);
      (metadata.inputs || []).forEach(input => {
        const identity = tableIdentity(input.id);
        if (!identity) return;
        const line = document.createElement("p");
        const code = document.createElement("code");
        code.textContent = identity.name;
        line.append(code, " — " + identity.title + ". " + identity.role + ".");
        el.bindings.append(line);
      });
      if (state.activeMove === "join-report-log") {
        const key = document.createElement("p");
        const code = document.createElement("code");
        code.textContent = ":tray_id";
        key.append("Match the two tables on ", code, ". The colon says this is the column named tray_id.");
        el.bindings.append(key);
      }
    }
    function renderInputs(metadata) {
      if (!el.inputs) return;
      el.inputs.replaceChildren();
      const copy = current();
      const heading = document.createElement("div");
      const label = document.createElement("p"); label.className = "eyebrow"; label.textContent = "Evidence in hand";
      const h = document.createElement("h2"); h.textContent = state.activeMove === "join-report-log" ? "Two sheets, one shared tray label" : "Your accepted join, ready for the next check";
      const note = document.createElement("p"); note.className = "shared-key"; note.textContent = state.activeMove === "join-report-log" ? "tray_id names the same tray in both tables; every tray ID occurs once in each table." : "Your returned join matched the lab’s canonical comparison table. The lab regenerates that same table for the next check, so the browser never becomes checker truth. It has the columns you need for the next rule.";
      heading.append(label, h, note); el.inputs.append(heading);
      metadata.inputs.forEach(input => el.inputs.append(renderTable(input)));
      const returnNote = document.createElement("p"); returnNote.className = "return-bridge"; returnNote.textContent = "Your task: " + copy.returnSpec;
      el.inputs.append(returnNote);
    }
    function renderDemoInputs(metadata) {
      if (!el.demoInputs) return;
      el.demoInputs.replaceChildren();
      const label = document.createElement("p"); label.className = "data-label"; label.textContent = "Simulated practice data — separate from the Missing Fleas case.";
      el.demoInputs.append(label);
      metadata.inputs.forEach(input => el.demoInputs.append(renderTable(input)));
      if (el.demoCopy) el.demoCopy.textContent = "These are the separate K-A/K-B practice tables supplied by the lab. Build the join below; it cannot add a Missing Fleas case finding.";
      if (el.demoPlan) el.demoPlan.textContent = "Before you run, predict which shared keys will match and how many rows Julia will return. Then add the join’s opening, followed by the two practice tables and their shared key. These controls write only this practice editor.";
    }
    function appendTechnical(message, target) {
      const raw = [message && message.stdout, message && message.message, message && message.value_repr].filter(Boolean).join("\n");
      if (!raw) return;
      const details = document.createElement("details");
      const summary = document.createElement("summary"); summary.textContent = message.status === "error" ? "Original Julia error" : "Actual Julia output";
      const pre = document.createElement("pre"); pre.textContent = raw; details.append(summary, pre); target.append(details);
    }
    function appendReturnedTable(message, target) {
      if (!Array.isArray(message.columns) || !Array.isArray(message.rows) || !message.rows.every(row => row && typeof row === "object")) return false;
      target.append(renderTable({id:"returned", label:"Actual returned data", data_label:"Returned by Julia from your code.", columns:message.columns, rows:message.rows}));
      return true;
    }
    function renderVisual(message) {
      if (!el.visual) return;
      el.visual.replaceChildren();
      const visual = visualData(state.activeMove, message);
      if (!visual) return;
      const section = document.createElement("section"); section.className = "returned-card";
      const h = document.createElement("h2"); h.textContent = current().visualTitle; section.append(h);
      visual.rows.forEach(row => {
        const card = document.createElement("article");
        const tray = document.createElement("h3"); tray.textContent = row.tray_id;
        const line = document.createElement("p"); line.textContent = "Report: " + row.report + " · Handling log: " + row.log + " · " + row.log_status;
        card.append(tray, line); section.append(card);
      });
      const note = document.createElement("p"); note.className = "caution";
      note.textContent = visual.kind === "recording-disagreement" ? "This is a recording disagreement. It does not tell us which record is biologically true, why the entries differ, who entered them, or whether anyone is at fault." : "These connections show matching record keys. They do not establish a biological cause.";
      section.append(note); el.visual.append(section);
    }
    function renderResult(message) {
      if (!el.result) return;
      el.result.replaceChildren();
      if (el.draftNote) el.draftNote.textContent = draftStatus(message);
      const outcome = document.createElement("p"); outcome.className = "run-outcome"; outcome.textContent = runOutcomeStatus(message); el.result.append(outcome);
      const p = document.createElement("p");
      if (message.status === "error") p.textContent = recoveryCopy(state.activeMove);
      else if (message.status === "timeout") p.textContent = "The lab stopped this run to keep the session responsive. Your code is still here; check it and run again.";
      else if (message.status === "ok" && message.pass === true) p.textContent = message.feedback || "Julia returned your checked result. Read the returned table and visual together before making a claim.";
      else p.textContent = message.feedback || "That result does not yet match the requested return. " + recoveryCopy(state.activeMove);
      el.result.append(p);
      const explanation = message.explanation;
      if (explanation && typeof explanation === "object") {
        [explanation.julia, explanation.case, explanation.limit].filter(Boolean).forEach(text => { const item = document.createElement("p"); item.textContent = String(text); el.result.append(item); });
      }
      if (message.status === "ok") {
        if (!appendReturnedTable(message, el.result)) {
          const notice = document.createElement("p"); notice.textContent = "The result could not be displayed as a table. The original output is kept below."; el.result.append(notice);
        }
        if (shouldRenderCaseVisual(message)) renderVisual(message);
      }
      appendTechnical(message, el.result);
      const destination = nextDestination(state.activeMove, message);
      if (destination && el.nextMove) {
        el.nextMove.hidden = false;
        el.nextMove.dataset.destination = destination;
        el.nextMove.textContent = destination === "chapter4" ? "Next: plan a recheck →" : "Next: inspect the disagreement →";
      }
    }
    function focusResult() { if (el.result) el.result.focus(); }
    function renderDemoResult(message) {
      if (!el.demoResult) return;
      el.demoResult.replaceChildren();
      const p = document.createElement("p");
      if (message.status === "error") p.textContent = "Check the practice table names and the shared key, then run this demonstration again. Your challenge editor is unchanged.";
      else if (message.status === "timeout") p.textContent = message.message || "The lab stopped this practice run. Your practice code is still here; check it and run again.";
      else p.textContent = message.feedback || "Julia returned the separate practice result. It adds no case evidence.";
      el.demoResult.append(p);
      const explanation = message.explanation;
      if (explanation && typeof explanation === "object") [explanation.julia, explanation.case, explanation.limit].filter(Boolean).forEach(text => { const item = document.createElement("p"); item.textContent = String(text); el.demoResult.append(item); });
      if (message.status === "ok" && !appendReturnedTable(message, el.demoResult)) {
        const notice = document.createElement("p"); notice.textContent = "The practice result could not be displayed as a table. The original output is kept below."; el.demoResult.append(notice);
      }
      appendTechnical(message, el.demoResult);
      const showCaseBridge = shouldShowDemoCaseBridge(message);
      if (el.demoCaseBridge) el.demoCaseBridge.hidden = !showCaseBridge;
      if (el.returnToCase) el.returnToCase.hidden = !showCaseBridge;
      if (showCaseBridge && el.challengeBridge) el.challengeBridge.textContent = "That practice result used separate K-A/K-B data. The visible case tables and required result are your guide for the independent challenge.";
    }
    function requestInfo(move) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const id = requestId("info");
      state = beginInfo(state, id, move);
      socket.send(JSON.stringify(infoMessage(move, id)));
      clearInfoTimer();
      infoTimer = setTimeout(() => { state = expireInfo(state, id); renderInputsFailure(); updateControls(); }, INFO_DEADLINE_MS);
      updateControls();
    }
    function requestDemoInfo() {
      if (!socket || socket.readyState !== WebSocket.OPEN || state.activeMove !== "join-report-log" || state.demoInfoRequest || state.demoMetadata) return;
      const id = requestId("practice-info");
      state = beginDemoInfo(state, id);
      socket.send(JSON.stringify(demoInfoMessage(id)));
      clearDemoInfoTimer();
      demoInfoTimer = setTimeout(() => {
        const before = state; state = expireDemoInfo(state, id); if (state === before) return;
        renderDemoFallback(); renderDemoResult(state.demoResult); updateControls();
      }, INFO_DEADLINE_MS);
      if (el.demoCopy) el.demoCopy.textContent = "Loading the separate K-A/K-B practice tables from the lab…";
      updateControls();
    }
    function sendRun() {
      if (!socket || socket.readyState !== WebSocket.OPEN || !state.metadata || isRunPending(state)) return;
      const id = requestId("run");
      state = beginRun(state, id, state.activeMove);
      armRunDeadline(id);
      socket.send(JSON.stringify(runMessage(state.activeMove, el.code.value, id)));
      clearResult();
      updateControls();
      if (el.result) el.result.textContent = "Julia is checking your move…";
    }
    function sendDemoRun() {
      if (!socket || socket.readyState !== WebSocket.OPEN || !state.demoMetadata || isDemoRunPending(state) || !el.demoCode) return;
      const id = requestId("practice-run");
      state = beginDemoRun(state, id);
      armDemoRunDeadline(id);
      socket.send(JSON.stringify(demoRunMessage(el.demoCode.value, id)));
      clearDemoResult();
      updateControls();
      if (el.demoResult) el.demoResult.textContent = "Julia is running the separate practice join…";
    }
    function handle(message) {
      if (!message || typeof message !== "object") return;
      if (message.type === "case") {
        const demoBefore = state; state = applyDemoInfo(state, message);
        if (demoBefore !== state) { clearDemoInfoTimer(); renderDemoInputs(state.demoMetadata); updateControls(); return; }
        const before = state; state = applyCaseInfo(state, message);
        if (before !== state) { clearInfoTimer(); renderInputs(state.metadata); renderBindings(state.metadata); updateControls(); }
        return;
      }
      if (message.type === "error") {
        const before = state; state = failCaseInfo(state, message);
        if (before !== state) { clearInfoTimer(); renderInputsFailure(); updateControls(); }
        return;
      }
      if (message.type === "status") {
        const before = state; state = applyRunStatus(state, message);
        if (before !== state) { armRunDeadline(state.pending.request_id); updateControls(); return; }
        const demoBefore = state; state = applyDemoRunStatus(state, message);
        if (demoBefore !== state) {
          armDemoRunDeadline(state.demoPending.request_id);
          if (el.demoResult) el.demoResult.textContent = state.demoStatusMessage || "Julia is running the separate practice join…";
          updateControls();
        }
        return;
      }
      if (message.type === "case_result") {
        const before = state; state = applyCaseResult(state, message);
        if (before !== state) {
          clearRunTimer();
          if (state.evidence !== before.evidence && isAcceptedChallengeResult(state.result)) {
            state = Object.assign({}, state, {joinAccepted:state.joinAccepted || state.result.move_id === "join-report-log"});
            persistAcceptedCourseResult(courseState, storage, attempt, state.result);
            renderSavedResume();
          }
          renderResult(state.result); renderMoveButtons(); updateControls();
          if (needsRecoveryFocus(state.result) && el.code) setTimeout(() => el.code.focus(), 0);
          else focusResult();
          return;
        }
        const demoBefore = state; state = applyDemoResult(state, message);
        if (demoBefore !== state) {
          clearDemoRunTimer();
          renderDemoResult(state.demoResult); updateControls();
          if (needsRecoveryFocus(state.demoResult) && el.demoCode) setTimeout(() => el.demoCode.focus(), 0);
        }
      }
    }
    function retry() {
      if (stopped) return;
      clearInfoTimer(); clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer(); state = disconnect(state); updateControls();
      if (++reconnects > 3) { if (el.connection) el.connection.textContent = "Lab link offline — your draft is still here."; return; }
      if (el.connection) el.connection.textContent = "Lab link interrupted — reconnecting…";
      timer = setTimeout(connect, 900 * reconnects);
    }
    function connect() {
      if (stopped) return;
      clearTimeout(timer); clearInfoTimer(); clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer();
      if (location.protocol === "file:") { state = disconnect(state); if (el.connection) el.connection.textContent = "Start the Julia server, then open the local server address shown by the launcher (usually http://127.0.0.1:8000) to run this case."; updateControls(); return; }
      const old = socket; socket = null; if (old) old.close();
      state = Object.assign({}, disconnect(state), {demoMetadata:null, demoResult:null});
      state.connection = "connecting"; if (el.connection) el.connection.textContent = "Connecting to the lab…"; updateControls();
      try { socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"); } catch (_) { retry(); return; }
      const ws = socket;
      ws.addEventListener("open", () => { if (socket !== ws) return; reconnects = 0; state = Object.assign({}, state, {connection:"connected"}); if (el.connection) el.connection.textContent = "Lab link ready"; requestInfo(state.activeMove); if (el.demoPanel && el.demoPanel.open) requestDemoInfo(); updateControls(); });
      ws.addEventListener("message", event => { if (socket !== ws) return; try { handle(JSON.parse(event.data)); } catch (_) {} });
      ws.addEventListener("close", () => { if (socket !== ws) return; retry(); });
    }
    function renderMoveButtons() {
      el.moveButtons.forEach(button => {
        const available = button.dataset.move === "join-report-log" || state.joinAccepted || canOpenMove(courseState, storage, attempt, button.dataset.move);
        button.disabled = !available;
        button.setAttribute("aria-current", button.dataset.move === state.activeMove ? "step" : "false");
      });
    }
    function setMove(move) {
      if (!knownMove(move)) return;
      if (move === "filter-disagreement" && !(state.joinAccepted || canOpenMove(courseState, storage, attempt, move))) {
        if (el.runStatus) el.runStatus.textContent = "First connect the two records with a checked join; then this move opens.";
        return;
      }
      if (el.code) drafts[state.activeMove] = el.code.value;
      clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer(); state = cancelDemo(cancelRun(Object.assign({}, state, {activeMove:move, metadata:null, infoRequest:null, demoMetadata:null})));
      renderMove();
      if (state.connection === "connected") requestInfo(move);
      if (el.title) { el.title.tabIndex = -1; el.title.focus(); }
    }

    renderMove();
    renderSavedResume();
    el.moveButtons.forEach(button => button.addEventListener("click", () => setMove(button.dataset.move)));
    if (el.start) el.start.addEventListener("click", () => { el.scene.hidden = true; el.investigation.hidden = false; if (el.title) { el.title.tabIndex = -1; el.title.focus(); } });
    if (el.resumeSavedMove) el.resumeSavedMove.addEventListener("click", () => {
      const move = savedChallengeResume(courseState, storage, attempt);
      if (!move) return;
      el.scene.hidden = true;
      el.investigation.hidden = false;
      setMove(move);
    });
    if (el.back) el.back.addEventListener("click", () => { if (el.code) drafts[state.activeMove] = el.code.value; clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer(); state = cancelDemo(cancelRun(state)); clearResult(); clearDemoResult(); updateControls(); el.investigation.hidden = true; el.scene.hidden = false; $("chapter-title").focus(); });
    if (el.run) el.run.addEventListener("click", sendRun);
    if (el.code) {
      el.code.addEventListener("input", () => { clearRunTimer(); drafts[state.activeMove] = el.code.value; restoredDrafts[state.activeMove] = false; persistChallengeDraft(courseState, storage, attempt, state.activeMove, el.code.value); state = cancelRun(state); clearResult(); if (el.draftNote) el.draftNote.textContent = draftNotice(Boolean(el.code.value), false); updateControls(); });
      el.code.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); sendRun(); } });
    }
    if (el.demoPanel) el.demoPanel.addEventListener("toggle", () => { if (el.demoPanel.open && state.activeMove === "join-report-log") requestDemoInfo(); });
    if (el.demoCode) {
      el.demoCode.addEventListener("input", () => {
        demoDraft = el.demoCode.value;
        persistDemoDraft(courseState, storage, attempt, demoDraft);
        state = cancelDemo(state); clearDemoResult();
        if (el.demoDraftNote) el.demoDraftNote.textContent = "This is your own unrun practice draft; it is separate from the case editor.";
        if (el.demoPlan) el.demoPlan.textContent = "Not run yet. Editing this practice code does not affect the Missing Fleas case editor.";
        updateControls();
      });
      el.demoCode.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); sendDemoRun(); } });
    }
    el.demoTokenButtons.forEach(button => button.addEventListener("click", () => {
      if (!el.demoCode || !state.demoMetadata || state.demoPending) return;
      const currentCode = el.demoCode.value.trim();
      if (button.dataset.demoToken === "open" && currentCode === "") el.demoCode.value = "leftjoin(";
      if (button.dataset.demoToken === "key" && currentCode === "leftjoin(") el.demoCode.value = "leftjoin(practice_report, practice_log, on=:key)";
      demoDraft = el.demoCode.value;
      persistDemoDraft(courseState, storage, attempt, demoDraft);
      state = cancelDemo(state); clearDemoResult();
      if (el.demoDraftNote) el.demoDraftNote.textContent = "Planned practice code — not run yet. It is separate from the case editor.";
      if (el.demoPlan) el.demoPlan.textContent = "Not run yet. The practice expression above will run only when you choose Run demonstration.";
      updateControls();
    }));
    if (el.runDemo) el.runDemo.addEventListener("click", sendDemoRun);
    function showHelpThrough(lastStage) {
      while (hintIndex <= lastStage) {
        const stage = helpStage(state.activeMove, hintIndex);
        if (!stage) break;
        if (stage.label === "Full answer" && el.answerReference) {
          const label = document.createElement("p"), code = document.createElement("pre");
          label.textContent = "Reference code answer — runnable Julia. Run this code in your editor to see Julia’s actual returned value below Run. It does not enter your editor or add evidence.";
          code.className = "complete-answer-code";
          code.textContent = stage.text;
          el.answerReference.replaceChildren(label, code);
          el.answerReference.hidden = false;
          hintIndex += 1;
          if (el.nextHelp) el.nextHelp.textContent = stage.button;
          continue;
        }
        const item = document.createElement("p"); const strong = document.createElement("strong"); strong.textContent = stage.label + ": "; item.append(strong, document.createTextNode(stage.text)); el.help.append(item); hintIndex += 1;
        if (el.nextHelp) el.nextHelp.textContent = stage.button;
      }
    }
    if (el.nextHelp) el.nextHelp.addEventListener("click", () => showHelpThrough(hintIndex));
    if (el.showAnswer) el.showAnswer.addEventListener("click", () => showHelpThrough(helpStages(state.activeMove).length - 1));
    if (el.nextMove) el.nextMove.addEventListener("click", () => {
      const destination = el.nextMove.dataset.destination;
      if (destination === "chapter4") { window.location.assign(nextChapterUrl(location.search)); return; }
      if (destination === "filter-disagreement") setMove(destination);
    });
    if (el.reconnect) el.reconnect.addEventListener("click", () => { reconnects = 0; connect(); });
    window.addEventListener("pagehide", () => { stopped = true; clearTimeout(timer); clearInfoTimer(); clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer(); state = cancelDemo(cancelRun(state)); if (socket) socket.close(); });
    connect();
  }

  function nextDestination(move, result) {
    if (!isAcceptedChallengeResult(result) || result.move_id !== move) return null;
    if (move === "join-report-log") return "filter-disagreement";
    if (move === "filter-disagreement") return "chapter4";
    return null;
  }

  return {CASE_ID, CHAPTER, INFO_DEADLINE_MS, RUN_DEADLINE_MS, knownMove, tableIdentity, activeInputIds, lessonCopy, recoveryCopy, needsRecoveryFocus, draftStatus, draftNotice, runOutcomeStatus, helpStage, caseBoardUrl, nextChapterUrl, nextDestination, requestedMove, createState, beginInfo, failCaseInfo, expireInfo, beginRun, expireRun, cancelRun, cancelDemo, disconnect, isRunPending, isDemoRunPending, applyRunStatus, applyDemoRunStatus, applyCaseInfo, applyCaseResult, beginDemoInfo, expireDemoInfo, applyDemoInfo, beginDemoRun, expireDemoRun, applyDemoResult, visualData, shouldRenderCaseVisual, shouldOfferCaseReturn, shouldShowDemoCaseBridge, acceptedMoveKeys, canOpenMove, initialMove, savedChallengeResume, persistChallengeDraft, persistDemoDraft, persistAcceptedCourseResult, infoMessage, runMessage, demoInfoMessage, demoRunMessage, init};
});

/* Julia Time: Missing Fleas C1. No framework, no external dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeMystery = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.init);
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  function chapter2Url(search) {
    const attempt = new URLSearchParams(search || "").get("attempt");
    return "chapter2.html" + (/^[a-z0-9-]{1,80}$/.test(attempt || "") ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function caseBoardUrl(search) {
    const attempt = new URLSearchParams(search || "").get("attempt");
    return "course/index.html" + (/^[a-z0-9-]{1,80}$/.test(attempt || "") ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function introUrl(search) {
    const attempt = new URLSearchParams(search || "").get("attempt");
    return "course/intro.html" + (/^[a-z0-9-]{1,80}$/.test(attempt || "") ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function caseLocation(stage) {
    return ({
      intro: "Chapter 1 of 6 · Meet the case",
      notebook: "Chapter 1 of 6 · Inspect the notebook",
      practice: "Chapter 1 of 6 · Learn to pick rows",
      code: "Chapter 1 of 6 · Find the B09 jars",
      result: "Chapter 1 of 6 · The B09 jars",
    })[stage] || "Chapter 1 of 6 · Meet the case";
  }
  function storagePrefix(attempt) {
    const base = "julia-time:missing-fleas:v1:";
    return /^[a-z0-9-]{1,80}$/.test(attempt || "") ? base + "attempt:" + attempt + ":" : base;
  }
  const STORAGE_PREFIX = storagePrefix(typeof location === "undefined" ? "" : new URLSearchParams(location.search).get("attempt"));
  const EVIDENCE_KEY = STORAGE_PREFIX + "evidence";
  const CODE_KEY = STORAGE_PREFIX + "code";
  const STAGE_KEY = STORAGE_PREFIX + "stage";
  function readPractice(raw) {
    try { const value = JSON.parse(raw); if (["rows", "rule"].includes(value?.lesson) && typeof value.code === "string") return {lesson:value.lesson, code:value.code}; } catch (_) {}
    return {lesson:"rows", code:""};
  }
  // R habits the case editor coaches (challengeRecovery below); the practice box uses the same words (r3 struggling #7).
  const R_DOLLAR_LINE = "R's $ does not exist in Julia: write jars.batch_id, not jars$batch_id.";
  const R_EQUALS_LINE = "In R, == already compares every row, and so does pandas' == on a column. In Julia a plain == on a whole column gives one true-or-false answer, not one per row: add a dot, .==, to compare row by row.";
  const PRACTICE_NOTE = " Practice does not count for the case.";
  // v0.2.5 night (fixer J3): the server's "coaching" line names the mistake it read from the code
  // (R's <-, Python habits). It is "" when there is none, and never used on an accepted run.
  function serverCoaching(message) {
    return message && message.pass !== true && typeof message.coaching === "string" ? message.coaching.trim() : "";
  }
  // r4 bug hunt #5: only a whole column compared with a plain == (jars.batch_id == ..., jars[:, :batch_id] == ...),
  // with no index after the column name, gives one true or false for the whole column.
  const WHOLE_COLUMN_EQUALS = /(?:^|[^.=!<>])==\s*jars\.\w+(?![\w\[(])|\bjars\.\w+\s*==(?!=)|\bjars\[\s*[:!]\s*,\s*:\w+\s*\]\s*==(?!=)/;
  // Disabling a focused button drops focus to the page. While Julia runs, a Run button that has
  // focus stays enabled but says aria-disabled; the run handlers already ignore a second press.
  function runButtonState(off, busy, focused) {
    const keep = off && busy && focused;
    return {disabled:off && !keep, ariaDisabled:off};
  }
  function practiceFeedback(code, message) {
    const coaching = serverCoaching(message);
    if (coaching) return coaching + PRACTICE_NOTE;
    if (message.status === "ok" && /^(?:true|false)$/.test(String(message.value_repr || "").trim()) && WHOLE_COLUMN_EQUALS.test(code)) {
      return "Julia returned one " + String(message.value_repr).trim() + " for the whole column. " + R_EQUALS_LINE + PRACTICE_NOTE;
    }
    if (message.status === "error" && /UndefVarError.*`\$`/.test(message.message || "")) return R_DOLLAR_LINE + PRACTICE_NOTE;
    if (message.status === "error" && /UndefVarError.*`head`/.test(message.message || "")) {
      return "head is the R name for this. In Julia it is first: first(jars, 3) gives the first three rows. This practice picks rows by position, so try jars[1:3, :]." + PRACTICE_NOTE;
    }
    if (message.status === "ok" && /^\d+-element BitVector:/.test(message.value_repr || "")) {
      return "Julia returned a list of true or false values, not the selected records: BitVector is Julia’s name for this list, 1 for true and 0 for false. Use that list in the rows position of jars[rows, :] to keep the true rows and every column. Practice does not count for the case.";
    }
    if (message.status === "ok") return "Julia returned this. Practice does not count for the case.";
    // r7-r-struggling (2026-09-28): R's df[1:3] picks columns, so jars[1:3] is a common slip. Practice may name the fix.
    const rangeOnly = /^\s*jars\[\s*(\d+)\s*:\s*(\d+)\s*\]\s*;?\s*$/.exec(code);
    if (rangeOnly && /getindex.*DataFrame/s.test(message.message || "")) {
      const range = rangeOnly[1] + ":" + rangeOnly[2];
      return "Add a comma and a colon after " + range + " to keep every column: jars[" + range + ", :]. Julia needs both positions, jars[rows, columns]. Your code has not been changed.";
    }
    if (/^\s*jars\[\s*\d+\s*:\s*\d+\s*,\s*\]\s*;?\s*$/.test(code) && /getindex.*DataFrame/s.test(message.message || "")) {
      return "You chose the rows, but left the columns blank. R lets you leave the columns position blank; Julia does not. Julia needs both: jars[rows, columns]. Put : after the comma to keep all columns, then run again. Your code has not been changed.";
    }
    return "Julia could not run this expression. Check the names and brackets against the example, or open the original error below for more detail. Your code is still here to edit.";
  }
  // T3 (2026-09-12 playtest): a player who picks "I know indexing — try the case" never sees the
  // practice screen, so a reference to "the practice" is a dangling pronoun for them. The two
  // variants below carry the same instruction; only the entry-path-specific lead differs.
  function bridgeText(visitedPractice) {
    return visitedPractice
      ? '<strong>Same rule as the practice, now on the real notebook.</strong> Your step: make one true or false for each jar (is its batch B09?), put that in the <strong>rows position</strong>, and keep <strong>all columns</strong>. If you need the Julia punctuation, open <strong>Stuck? Hints</strong> below the editor for small hints, one at a time.'
      : '<strong>Your step:</strong> make one true or false for each jar (is its batch B09?), put that in the <strong>rows position</strong>, and keep <strong>all columns</strong>. If you need the Julia punctuation, open <strong>Stuck? Hints</strong> below the editor for small hints, one at a time.';
  }
  // T4 (2026-09-12 playtest): the shared next step used to open with identical wording after two
  // different errors, which read as "no progress made" even when the player had fixed the first
  // mistake. An error-specific first line now names what changed before the shared step.
  const C1_SHARED_NEXT_STEP = "Next step: read the batch_id column as a list, make a true-or-false row rule from it, then open “Show the idea” under “Stuck? Hints” below if you need to place that rule in the table.";
  // S1 (2026-09-27 adversary review): only a specific coaching line replaces the server's feedback;
  // an uncoached error (a plain typo) keeps the server's line and the shared next step, as in v0.2.3.
  function hidesServerFeedback(recovery) { return Boolean(recovery) && recovery !== C1_SHARED_NEXT_STEP; }
  // r7-r-struggling #8 (2026-09-28): the fixed step goes only after mistakes made before the row rule
  // exists. A plain == or a missing columns position already has the rule, so those lines end like the
  // other chapters' coaching instead.
  const C1_ERROR_ENDING = " Change your code, then run again, or open Stuck? Hints below.";
  function challengeRecovery(message) {
    // With the server's line, the page's own guesses below are dropped (as in chapter5.js, chapter6.js).
    const coaching = serverCoaching(message);
    if (coaching) return coaching + (message.status === "error" ? C1_ERROR_ENDING : " Your draft is still here. Change it and run again, or open Stuck? Hints below.");
    if (message?.status !== "error") return "";
    const text = message.message || "";
    const shared = C1_SHARED_NEXT_STEP;
    if (/UndefVarError.*`\$`/.test(text)) {
      return R_DOLLAR_LINE + " " + shared;
    }
    if (/invalid row index of type Bool/.test(text)) {
      return R_EQUALS_LINE + C1_ERROR_ENDING;
    }
    // 2026-09-24 playtest: pandas, MATLAB and missing-column habits, each keyed on Julia's own text.
    if (/syntax df\[column\] is not supported/.test(text)) {
      return "A Julia table needs two positions in square brackets, rows then columns: jars[rows, columns]. One position, pandas style, does not work here; to read one column, write jars.batch_id rather than jars[\"batch_id\"]. " + shared;
    }
    if (/objects of type (?:DataFrames\.)?DataFrame are not callable/.test(text)) {
      return "Julia's filter takes the rule first: filter(row -> ..., jars), or keep rows with jars[rule, :]. " + shared;
    }
    if (/no method matching getindex\(::(?:DataFrames\.)?DataFrame, ::[^,\n]*\)/.test(text)) {
      return "Close: you gave the rows, but no columns position. Julia tables need both, jars[rows, columns]; put : in the columns position to keep every column." + C1_ERROR_ENDING;
    }
    return shared;
  }
  // Re-test (2026-09-24): a copied practice batch or the glossary's jars[1:6, :] ran without error
  // and heard only the generic checker line. This lead reads the rows Julia actually returned,
  // never the code, and sits in front of that line.
  function returnedRowsLead(result, info) {
    if (!result || result.status !== "ok" || result.pass === true || !info || serverCoaching(result)) return "";
    const rows = Array.isArray(result.rows) ? result.rows : [], caseRows = Array.isArray(info.rows) ? info.rows : [];
    const batches = rows.map(row => row && row.batch_id);
    if (!rows.length || !batches.every(batch => typeof batch === "string")) return "";
    const practice = info.worked_example && info.worked_example.batch_id;
    // r8-audit #6 (2026-09-28): when the server's line already names the batch or the rule, the page does not repeat it.
    const feedback = String(result.feedback || "");
    if (typeof practice === "string" && batches.every(batch => batch === practice)) {
      if (feedback.includes("These are the " + practice + " jars")) return "";
      return "Every row you returned has batch_id " + practice + ", the practice batch used in the examples. This case needs the rows whose batch_id matches case_batch (" + info.case_batch + ").";
    }
    const start = caseRows.findIndex(row => row && row.jar_id === rows[0].jar_id);
    const distinct = Array.from(new Set(batches));
    const isRun = start >= 0 && rows.length < caseRows.length && rows.every((row, index) => caseRows[start + index] && row.jar_id === caseRows[start + index].jar_id);
    if (isRun && distinct.length > 1) {
      const where = "These are rows " + (start + 1) + " to " + (start + rows.length) + " of the table, in order, so they mix batches " + distinct.join(" and ") + ".";
      return feedback.includes("not by where they sit") ? where : where + " Pick the rows by their batch label, not by where they sit: keep each row whose batch_id matches case_batch.";
    }
    return "";
  }
  // UI-10 (2026-09-24): the recovery line above sends the learner to the first hint ("Show the idea"), so the drawer
  // that holds it stays on screen after any run that was not accepted, as in Chapters 2 to 6.
  function helpDrawerVisible(stage, result) { return stage === "code" || (stage === "result" && !(result && result.pass === true)); }
  function boardUpdateLine(rows) {
    return Array.isArray(rows) && rows.length ? "Case Board updated: the B09 jars have been found in the notebook." : "";
  }
  const NOT_SAVED_STATUS = "Right answer, but this computer could not save it, so the Case Board will not show it. Run it once more; if this keeps happening, ask your helper.";
  // Ask the saved record itself, never the write call: a write can fail silently (blocked storage, a damaged record).
  function savedMove(courseState, storage, attempt, chapter, moveId) { try { return Boolean(storage && courseState && typeof courseState.hasSavedMove === "function" && courseState.hasSavedMove(storage, attempt, chapter, moveId)); } catch (_) { return false; } }
  function runOutcomeStatus(message, saved) {
    if (!message) return "";
    if (message.status === "ok" && message.pass === true) return saved === false ? NOT_SAVED_STATUS : "Julia checked it: that's right.";
    if (message.status === "timeout") return "Not yet. Your code took too long, so the lab stopped it. Your code is still here.";
    if (message.status === "error") return "Not yet. Julia could not run this code. Your code is still here.";
    return "Not yet. Julia ran your code; the result below is not quite what we need.";
  }
  // Momo counts the jars WITH springtails in the learner's own result, never the rows returned (browser play, 2026-09-26).
  // Story spine consistency pass (2026-09-27): the report never gives a batch count, only T-C's 0, so
  // Momo compares like with like: T-C in the learner's own returned rows against the report's 0.
  function momoReaction(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const tc = list.filter(row => row && row.tray_id === "T-C");
    const tcFleas = tc.filter(row => row.detected === true).length;
    if (tc.length && tcFleas > 0) return "Momo: \u201cThe report says T-C has 0 jars with springtails. The notebook shows springtails in " + tcFleas + " of T-C's " + tc.length + " jars. One of them is wrong.\u201d";
    const detected = list.filter(row => row && row.detected === true).length;
    return "Momo: \u201cThe report says T-C has 0 jars with springtails. The notebook says " + detected + " jar" + (detected === 1 ? "" : "s") + " with springtails. Let us count tray by tray.\u201d";
  }
  function restoreStage(value, hasEvidence) { return value === "result" ? (hasEvidence ? "result" : "code") : ["intro", "notebook", "code", "practice"].includes(value) ? value : "intro"; }
  const MAX_RECONNECTS = 3;
  const INFO_DEADLINE_MS = 5000;
  const RUN_DEADLINE_MS = 7000;
  function nextStage(stage) { return ({ intro: "notebook", notebook: "code" })[stage] || stage; }
  function previousStage(stage) { return ({ result: "code", code: "notebook", notebook: "intro", practice:"notebook" })[stage] || "intro"; }
  function hintButtonLabel(shown, total) {
    if (shown >= total) return "All help shown";
    return ["Show the idea", "Show the code shape", "Show the whole line"][shown] || "Show more help";
  }
  function hintIndicesThrough(shown, total, completeAnswer) {
    const start = Math.max(0, Math.min(Number.isFinite(shown) ? Math.floor(shown) : 0, Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0));
    const end = completeAnswer ? (Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0) : Math.min(start + 1, Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0);
    return {indices:Array.from({length:Math.max(0, end - start)}, (_, index) => start + index), shown:end};
  }
  function retainedJarIds(rows) { return rows.map(row => row && row.jar_id).filter(id => typeof id === "string"); }
  function evidenceSummary(evidence, rows) {
    const detected = rows.filter(row => row && row.detected).length;
    return detected + " of " + rows.length + " B09 jars have springtails. Next: which trays are they on?";
  }
  function discoveryText(rows) {
    if (!rows.length || !rows.every(row => row && typeof row.detected === "boolean")) return "";
    const detected = rows.filter(row => row.detected).length;
    return detected + " of " + rows.length + " B09 jars have springtails in the notebook. This is what the notebook says; the notebook could still be wrong.";
  }
  function createState() { return { connection: "connecting", infoRequestId:null, metadataFailure:"", outstandingRequestId: null, expired: false, statusMessage: null, result: null, evidence: null, code: "" }; }
  function beginInfo(state, requestId) { return Object.assign({}, state, {infoRequestId:requestId, metadataFailure:""}); }
  function failCaseInfo(state, message) {
    if (!state.infoRequestId || !message || message.type !== "error") return state;
    const text = /unknown mystery chapter/i.test(String(message.message || "")) ? "The local lab does not recognise this chapter. Restart Julia Time, then reload this page. Your draft is still here." : "The chapter inputs are unavailable. Restart Julia Time, then reload this page. Your draft is still here.";
    return Object.assign({}, state, {infoRequestId:null, metadataFailure:text});
  }
  function expireInfo(state, requestId) {
    if (!state.infoRequestId || state.infoRequestId !== requestId) return state;
    return Object.assign({}, state, {infoRequestId:null, metadataFailure:"The case data took too long to arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here."});
  }
  function isCurrentCaseInfo(state, message) {
    return Boolean(state && state.infoRequestId && message && message.type === "case" && message.request_id === state.infoRequestId);
  }
  function beginRun(state, requestId, runKind = "case") { return Object.assign({}, state, { outstandingRequestId: requestId, expired: false, statusMessage: null, result: null, runKind }); }
  // A client-side expiry (B1) is a display state, not a cancellation: `outstandingRequestId` is
  // kept so a correct result that later arrives for this same request is still applied instead of
  // discarded — the exact bug the panel review found. `expired` alone makes the run retryable
  // (see `isRunPending`); starting a fresh run overwrites the id and this placeholder result.
  function expireRun(state, requestId) {
    if (!state.outstandingRequestId || state.outstandingRequestId !== requestId) return state;
    return Object.assign({}, state, {expired:true, statusMessage:null, result:{type:"case_result", status:"timeout", pass:false, feedback:"This check took too long. Check your code, then run again."}});
  }
  function cancelRun(state) { return Object.assign({}, state, { outstandingRequestId: null, expired: false, statusMessage: null, result: null }); }
  function isCurrentSocket(activeSocket, callbackSocket) { return activeSocket === callbackSocket; }
  // True while a run is genuinely in flight (not yet expired) — the busy signal that should
  // disable Run and the practice button. A request that has expired keeps its id (above) but is
  // no longer "pending": the learner may run again immediately, per B1.
  function isRunPending(state) { return Boolean(state.outstandingRequestId) && !state.expired; }
  // A `status` frame for the pending request (B1/B2): resets the learner-visible line under Run
  // and, in `init()`, re-arms the client's own deadline timer. Ignored once already expired —
  // the client's deadline is the safety net for a dead server, not something further messages
  // should keep pushing out indefinitely.
  function applyRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.outstandingRequestId || state.expired || message.request_id !== state.outstandingRequestId) return state;
    const statusMessage = message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : "";
    return Object.assign({}, state, { statusMessage });
  }
  function applyCaseResult(state, message) {
    if (!message || message.type !== "case_result" || message.chapter !== "C1" || !state.outstandingRequestId || message.request_id !== state.outstandingRequestId) return state;
    const evidence = state.runKind !== "practice" && message.status === "ok" && message.pass === true && message.evidence ? message.evidence : state.evidence;
    return Object.assign({}, state, { outstandingRequestId: null, expired: false, statusMessage: null, result: message, evidence });
  }
  function disconnect(state) { return Object.assign({}, state, { connection: "offline", infoRequestId:null, outstandingRequestId: null, expired: false, statusMessage: null }); }
  function persistEvidence(storage, evidence) { try { storage.setItem(EVIDENCE_KEY, JSON.stringify(evidence)); return true; } catch (_) { return false; } }
  // UI-05 (2026-09-24): the legacy key above reaches the shared course record only when the Case
  // Board page runs its importer, so a learner who followed the Next links to Chapter 6 saw Chapter 1
  // as still unknown. Write the accepted move directly, the "T3" pattern chapter2.js..chapter6.js use.
  function persistAcceptedCourseState(courseState, storage, attempt, message) {
    if (!message || message.status !== "ok" || message.pass !== true || !message.evidence || typeof message.evidence !== "object") return false;
    if (!courseState || typeof courseState.recordHistoricalMoveIfMissing !== "function" || typeof courseState.writeEvidenceIfMissing !== "function" || typeof courseState.writeCursor !== "function") return false;
    const title = typeof message.evidence.title === "string" && message.evidence.title.trim() ? message.evidence.title.trim().slice(0, 160) : "Saved B09 records";
    const rowCount = Array.isArray(message.rows) && message.rows.length > 0 ? Math.min(message.rows.length, 10000) : 1;
    try {
      courseState.recordHistoricalMoveIfMissing(storage, attempt, "C1", "select-records");
      courseState.writeEvidenceIfMissing(storage, attempt, {chapter:"C1", move_id:"select-records", title, row_count:rowCount, provenance:"historical-browser"});
      courseState.writeCursor(storage, attempt, {chapter:"C2", move_id:"group", mode:"challenge"});
      return true;
    } catch (_) { return false; }
  }
  function validEvidenceDisplay(value) {
    return Boolean(value && typeof value === "object" && value.evidence &&
      typeof value.evidence === "object" && !Array.isArray(value.evidence) &&
      Array.isArray(value.rows) && value.rows.every(row => row !== null && typeof row === "object") &&
      (value.explanation === null || (typeof value.explanation === "object" && !Array.isArray(value.explanation))));
  }
  function loadEvidence(storage) { try { const raw = storage.getItem(EVIDENCE_KEY); const parsed = raw ? JSON.parse(raw) : null; return validEvidenceDisplay(parsed) ? parsed : null; } catch (_) { return null; } }
  function restoredEvidenceDisplay(saved) {
    return Object.assign({}, saved, { explanation: {
      julia: "These records were saved from a previous visit. This display does not identify how your code selected them. Run your code again to check its current result; open the comparison below to compare picking rows by position and by a rule.",
      case: "These are the jars you kept. They show what the notebook says, not why."
    }});
  }
  // Round-3 bots (2026-09-25): the attempt controls appear only when they mean something. A brand-new browser
  // sees none; saved Chapter 1 work offers a new attempt; inside an attempt the return link is offered too.
  function sessionOptions(hasSavedWork, attempt) {
    const inAttempt = /^[a-z0-9-]{1,80}$/.test(attempt || "");
    const section = Boolean(hasSavedWork) || inAttempt;
    return {section, newAttempt:section, returnLink:inAttempt};
  }
  function persistCode(storage, code) { try { storage.setItem(CODE_KEY, code); return true; } catch (_) { return false; } }
  function loadCode(storage) { try { return storage.getItem(CODE_KEY) || ""; } catch (_) { return ""; } }
  function requestId() { return "c1-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10); }
  // A jar card in plain words, "tray T-A · springtails seen", when the row has those two columns
  // (r2 story review C2, 2026-09-27); any other row keeps its column names.
  function jarCardText(row) {
    const raw = value => value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "display") ? String(value.display) : String(value);
    if (row && !Array.isArray(row) && typeof row === "object" && "tray_id" in row && "detected" in row && ["true", "false"].includes(raw(row.detected))) {
      return "tray " + raw(row.tray_id) + " · " + (raw(row.detected) === "true" ? "springtails seen" : "no springtails seen");
    }
    return Array.isArray(row) ? row.map(displayCell).join(" · ") : Object.keys(row).map((key) => key + ": " + displayCell(row[key])).join(" · ");
  }
  function displayCell(value) {
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "display")) {
      return value.type ? String(value.display) + " (" + String(value.type) + ")" : String(value.display);
    }
    return value == null ? "" : String(value);
  }

  function init() {
    const $ = (id) => document.getElementById(id);
    const courseState = typeof window !== "undefined" ? window.JuliaTimeCourseState : null;
    const attempt = new URLSearchParams(location.search).get("attempt") || "";
    $("new-attempt").addEventListener("click", () => {
      const url = new URL(location.href); url.searchParams.set("attempt", requestId()); url.hash = "";
      location.assign(url.href);
    });
    $("original-save").href = location.pathname;
    {
      let store = null; try { store = localStorage; } catch (_) {}
      const saved = Boolean(store && (loadCode(store).trim() || loadEvidence(store)));
      const options = sessionOptions(saved, attempt);
      $("session-options").hidden = !options.section;
      $("new-attempt").hidden = !options.newAttempt;
      $("original-save").hidden = !options.returnLink;
    }
    $("case-board").href = caseBoardUrl(location.search);
    $("intro-link").href = introUrl(location.search);
    const names = ["connection-text", "reconnect", "case-goal", "return-spec", "data-label", "case-table", "code", "run-status", "run", "reset-code", "result-area", "answer-before-editor", "hint-list", "next-hint", "show-answer", "worked-example", "glossary", "evidence-board", "evidence-summary", "evidence-rows", "explanation-julia", "explanation-case", "bridge-card"];
    const el = names.reduce((out, name) => { out[name] = $(name); return out; }, {});
    const bridges = typeof window !== "undefined" ? window.JuliaTimeBridges : null;
    let state = createState(), socket = null, reconnects = 0, reconnectTimer = null, infoTimer = null, runTimer = null, caseInfo = null, hintsShown = 0, stopped = false, storageWarningShown = false, acceptedRows = [], saveOk = true, lastSubmittedCode = "", restoredCodeNote = null;
    function clearInfoTimer() { if (infoTimer) { clearTimeout(infoTimer); infoTimer = null; } }
    function clearRunTimer() { if (runTimer) { clearTimeout(runTimer); runTimer = null; } }
    function expireCurrentRun(id) {
      const before = state; state = expireRun(state, id); if (before === state) return;
      if (state.runKind === "practice") {
        $("practice-output").textContent = state.result.feedback; updateRunControl(); focusPracticeResult();
      } else {
        renderResult(state.result); showStage("result", false);
      }
      updateRunControl();
    }
    function armRunDeadline(id) { clearRunTimer(); runTimer = setTimeout(() => expireCurrentRun(id), RUN_DEADLINE_MS); }
    let stage = "intro", visitedPractice = false;
    function showStage(next, focus = true) {
      if (stage === "practice" && next !== "practice" && next !== "result" && state.runKind === "practice") { state = cancelRun(state); clearRunTimer(); }
      if (next !== "result" && state.outstandingRequestId) { state = cancelRun(state); clearRunTimer(); }
      if (next === "practice") visitedPractice = true;
      if (next === "code") $("practice-to-case-bridge").innerHTML = bridgeText(visitedPractice);
      stage = next; document.body.dataset.stage = stage;
      if (storage) { try { storage.setItem(STAGE_KEY, stage); } catch (_) {} }
      document.querySelector(".hero").hidden = stage !== "intro";
      document.querySelector(".cast").hidden = stage !== "intro";
      document.querySelector(".case-grid").hidden = stage === "intro" || stage === "practice";
      $("indexing-practice").hidden = stage !== "practice";
      $("path-choice").hidden = stage !== "notebook";
      document.querySelector(".brief").hidden = stage === "result";
      document.querySelector(".data-panel").hidden = stage !== "notebook" && stage !== "code";
      document.querySelector(".move-stack").hidden = stage === "notebook";
      document.querySelector(".editor-panel").hidden = stage !== "code" && stage !== "result";
      document.querySelector(".help-drawer").hidden = !helpDrawerVisible(stage, state.result);
      el["result-area"].hidden = stage !== "result";
      el["evidence-board"].hidden = stage !== "result" || !state.result?.pass;
      $("step-back").hidden = stage === "intro";
      $("view-evidence").hidden = !state.evidence || stage === "result";
      $("step-label").textContent = caseLocation(stage);
      updateRunControl();
      if (focus) { const target = stage === "practice" ? $("practice-heading") : stage === "code" ? el.code : stage === "result" ? el["result-area"] : stage === "notebook" ? $("goal-heading") : $("chapter-title"); if (target !== el.code) target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:"start",behavior:"instant"}); }
    }
    document.querySelector(".start-link").addEventListener("click", event => { if (location.protocol === "file:") return; event.preventDefault(); showStage("notebook"); });
    $("step-next").addEventListener("click", () => showStage(nextStage(stage)));
    $("step-back").addEventListener("click", () => showStage(previousStage(stage)));
    $("learn-indexing").addEventListener("click", () => showStage("practice"));
    $("practice-done").addEventListener("click", () => showStage("code"));
    let practiceLesson = "rows";
    function showRuleLesson() {
      practiceLesson = "rule";
      $("practice-heading").textContent = "Pick rows by a rule, not by position";
      $("practice-explanation").textContent = "The first three rows might be the wrong batch. jars.batch_id reads the batch labels. .== compares each label with a target and gives one true or false per row. The dot means “do it for each row”.";
      $("practice-shape").textContent = 'jars.batch_id .== "B08"';
      $("practice-task").textContent = 'Replace your first try with the rule shown above: type jars.batch_id .== "B08" for B08 (our practice batch). Each true says keep this row; each false says leave it out. To select whole records, put this true-or-false list in the rows position: jars[rule, :]. Then use the batch from Toto’s report (case_batch) in the case.';
      $("practice-code").value = "";
      $("practice-next").hidden = true;
    }
    function savePractice() {
      if (!storage) return;
      try { storage.setItem(STORAGE_PREFIX + "practice-v2", JSON.stringify({lesson:practiceLesson, code:$("practice-code").value})); }
      catch (_) { appendNotice("Practice stays on screen, but could not be saved."); }
    }
    function beginRuleLesson() {
      state = cancelRun(state); updateRunControl();
      showRuleLesson();
      $("practice-output").textContent = "New practice step: your first try has been cleared. Type the true-or-false rule shown above; this is a different way to pick rows.";
      savePractice();
      $("practice-heading").tabIndex = -1; $("practice-heading").focus();
    }
    $("practice-next").addEventListener("click", beginRuleLesson);
    $("practice-code").addEventListener("input", savePractice);
    $("practice-code").addEventListener("input", () => { state = cancelRun(state); updateRunControl(); if (storage) { try { storage.setItem(STORAGE_PREFIX + "practice-code", $("practice-code").value); } catch (_) { if (!storageWarningShown) { storageWarningShown = true; appendNotice("Practice code remains here, but this browser cannot save it."); } } } });
    function runPractice() {
      if (state.connection !== "connected" || !caseInfo || isRunPending(state)) return;
      const id = requestId(); state = beginRun(state, id, "practice"); armRunDeadline(id); updateRunControl(); $("practice-output").textContent = "Julia is running your practice code…";
      send({type:"case_run",case_id:"missing-fleas-v1",chapter:"C1",code:$("practice-code").value,request_id:id});
    }
    // A run started from the button moves focus to its result; one started from the box with
    // Ctrl/Cmd+Enter leaves focus in the box so typing can go on (the result is still announced).
    function focusPracticeResult() { if (document.activeElement === $("practice-run")) $("practice-output").focus(); }
    $("practice-run").addEventListener("click", runPractice);
    $("practice-code").addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); runPractice(); } });
    $("view-evidence").addEventListener("click", () => {
      if (!state.evidence) return;
      state = Object.assign({}, cancelRun(state), {result:{pass:true,restored:true}});
      el["result-area"].textContent = "";
      appendText(el["result-area"], "p", "", "Previously recovered evidence. Run your code again for a fresh check.");
      showStage("result");
    });
    let storage = null;
    try { storage = window.localStorage; } catch (_) { storageWarningShown = true; }
    if (storage) { try { $("practice-code").value = storage.getItem(STORAGE_PREFIX + "practice-code") || ""; } catch (_) {} }
    if (storage) { try {
      const raw = storage.getItem(STORAGE_PREFIX + "practice-v2");
      if (raw) { const saved = readPractice(raw); if (saved.lesson === "rule") showRuleLesson(); $("practice-code").value = saved.code; if (saved.code) appendText($("practice-code").parentElement, "p", "saved-code-note", "Restored your practice draft from a previous visit; this is not supplied starting code."); }
    } catch (_) {} }
    if (storage) { state = Object.assign({}, state, { code: loadCode(storage) }); el.code.value = state.code; if (state.code) restoredCodeNote = appendText(el.code.parentElement, "p", "saved-code-note", "Restored your saved code: this is not a supplied answer."); }
    const savedEvidence = storage ? loadEvidence(storage) : null;
    if (savedEvidence) { const display = restoredEvidenceDisplay(savedEvidence); state.evidence = display.evidence; renderEvidence(display.evidence, display.rows, display.explanation, true); }
    let initialStage = "intro";
    if (storage) { try { initialStage = restoreStage(storage.getItem(STAGE_KEY), Boolean(savedEvidence)); } catch (_) {} }
    if (initialStage === "result") {
      state.result = { pass: true, restored: true };
      appendText(el["result-area"], "p", "", "Saved evidence from your previous visit. Run your code again to check it afresh.");
    }
    function setConnection(next, detail) {
      state = Object.assign({}, state, { connection: next });
      el["connection-text"].textContent = detail || state.metadataFailure || ({ connected: "Julia is ready", connecting: "Connecting to the lab…", offline: "Julia is offline" }[next]);
      document.body.dataset.connection = next; el.reconnect.hidden = next !== "offline" && !state.metadataFailure; updateRunControl();
    }
    function updateRunControl() {
      const busy = isRunPending(state);
      const off = state.connection !== "connected" || busy || !caseInfo;
      for (const button of [el.run, $("practice-run")]) {
        const look = runButtonState(off, busy, document.activeElement === button);
        button.disabled = look.disabled; button.setAttribute("aria-disabled", String(look.ariaDisabled));
      }
      el["run-status"].textContent = busy ? (state.statusMessage || "Checking your result…") : state.metadataFailure || (state.result ? (state.result.pass ? "Accepted: the six B09 jars" : "Not accepted yet: see feedback") : state.connection === "connected" ? "Julia is ready" : "Code runs when Julia is ready");
    }
    function socketURL() { return (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"; }
    function connect(manual) {
      if (location.protocol === "file:") {
        stopped = true; setConnection("offline", "Start the Julia server to play"); el.reconnect.hidden = true;
        appendNotice("You opened the page as a file. From the julia-time folder, run the command below, then open http://127.0.0.1:8000. The picture can load without Julia, but code cannot run here.");
        appendText($("notices"), "pre", "", "JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 julia --project=. run.jl");
        const start = document.querySelector(".start-link"); start.href = "http://127.0.0.1:8000"; start.textContent = "Open the running game →";
        return;
      }
      if (stopped) return; clearTimeout(reconnectTimer); if (manual) reconnects = 0; caseInfo = null; setConnection("connecting");
      try { socket = new WebSocket(socketURL()); } catch (_) { scheduleReconnect(); return; }
      const ws = socket;
      ws.addEventListener("open", () => { if (!isCurrentSocket(socket, ws)) return; reconnects = 0; setConnection("connected"); const id=requestId(); state=beginInfo(state,id); send({ type: "case_info", request_id:id }); clearInfoTimer(); infoTimer=setTimeout(()=>{const before=state;state=expireInfo(state,id);if(before!==state){appendNotice(state.metadataFailure,true);setConnection("offline",state.metadataFailure);}},INFO_DEADLINE_MS); });
      ws.addEventListener("message", (event) => { if (!isCurrentSocket(socket, ws)) return; let message; try { message = JSON.parse(event.data); } catch (_) { return; } handleMessage(message); });
      ws.addEventListener("close", () => { if (!isCurrentSocket(socket, ws)) return; clearInfoTimer(); clearRunTimer(); state = disconnect(state); if (!stopped) scheduleReconnect(); });
    }
    function scheduleReconnect() {
      if (reconnects >= MAX_RECONNECTS) { setConnection("offline", "Julia is offline: reconnect when you are ready"); return; }
      reconnects += 1; setConnection("connecting", "Reconnecting to the lab (" + reconnects + "/" + MAX_RECONNECTS + ")…"); reconnectTimer = setTimeout(() => connect(false), 1200 * reconnects);
    }
    function send(message) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
    function handleMessage(message) {
      if (isCurrentCaseInfo(state, message)) { clearInfoTimer(); state=Object.assign({},state,{infoRequestId:null,metadataFailure:""}); caseInfo = message; renderCase(message); updateRunControl(); return; }
      if (message.type === "status") {
        const before = state; state = applyRunStatus(state, message); if (before === state) return;
        armRunDeadline(state.outstandingRequestId); updateRunControl(); return;
      }
      if (message.type === "case_result") {
        const before = state; state = applyCaseResult(state, message); if (before === state) return; clearRunTimer();
        if (state.runKind === "practice") {
          const output = $("practice-output"); output.textContent = "";
          appendText(output,"p","",practiceFeedback($("practice-code").value, message));
          if (message.status !== "ok" && message.message) {
            const details = document.createElement("details");
            appendText(details,"summary","","Original Julia error");
            appendText(details,"pre","",message.message);
            output.appendChild(details);
          }
          if (message.columns?.length) { const table = document.createElement("table"); renderTable(table,message.columns,message.rows || []); output.appendChild(table); }
          else if (message.value_repr) appendText(output,"pre","",message.value_repr);
          updateRunControl(); focusPracticeResult(); return;
        }
        saveOk = true;
        if (message.status === "ok" && message.pass === true && message.evidence && storage) {
          persistAcceptedCourseState(courseState, storage, attempt, message);
          saveOk = savedMove(courseState, storage, attempt, "C1", "select-records");
        }
        renderResult(message);
        if (message.status === "ok" && message.pass === true && message.evidence) {
          const display = { evidence: message.evidence, rows: message.rows || [], explanation: message.explanation || null };
          if ((!storage || !persistEvidence(storage, display)) && !storageWarningShown) { storageWarningShown = true; appendNotice("Your evidence is visible, but this browser could not save it for a later visit."); }
          renderEvidence(message.evidence, message.rows || [], message.explanation || null, false, lastSubmittedCode);
        }
        updateRunControl();
        showStage("result", false);
        const outcome = message.status === "ok" && message.pass ? el["evidence-board"] : el["result-area"];
        outcome.tabIndex = -1;
        focusResult(outcome);
        outcome.scrollIntoView({ block: "start", behavior: "instant" });
        return;
      }
      if (message.type === "error") { const before=state; state=failCaseInfo(state,message); if(before!==state){clearInfoTimer();appendNotice(state.metadataFailure,true);setConnection("offline",state.metadataFailure);} else appendNotice(message.message || "The lab could not read that request.", true); }
    }
    function renderCase(info) {
      el["case-goal"].textContent = info.goal || "Find the six B09 jars in the notebook."; el["return-spec"].textContent = info.return_spec || "the filtered records"; el["data-label"].textContent = info.data_label || "Case records";
      renderTable(el["case-table"], info.columns || [], info.rows || []); renderReferences(info); renderHints(info.hints || []);
      highlightSource();
    }
    function highlightSource() {
      const ids = new Set(retainedJarIds(acceptedRows));
      Array.from(el["case-table"].tBodies[0]?.rows || []).forEach((tr, index) => {
        const jar = caseInfo && caseInfo.rows && caseInfo.rows[index] && caseInfo.rows[index].jar_id;
        const retained = ids.has(jar);
        tr.classList.toggle("record-retained", retained);
        if (retained) tr.setAttribute("aria-label", jar + ": kept in your answer");
        else tr.removeAttribute("aria-label");
      });
    }
    // r8-rc #2 (2026-09-28): breakHeaders lets a phone wrap a header after each underscore, as C3 does.
    function renderTable(table, columns, rows, breakHeaders = false) {
      const head = table.tHead || table.createTHead(), body = table.tBodies[0] || table.createTBody(); head.textContent = ""; body.textContent = "";
      const hr = document.createElement("tr"); columns.forEach((name) => { const th = document.createElement("th"); th.scope = "col"; if (breakHeaders) String(name).split("_").forEach((part, i, parts) => { th.append(part + (i < parts.length - 1 ? "_" : "")); if (i < parts.length - 1) th.append(document.createElement("wbr")); }); else th.textContent = String(name); hr.appendChild(th); }); head.appendChild(hr);
      rows.forEach((row) => { const tr = document.createElement("tr"); columns.forEach((name, index) => { const td = document.createElement("td"); const value = Array.isArray(row) ? row[index] : row[name]; td.textContent = displayCell(value); tr.appendChild(td); }); body.appendChild(tr); });
    }
    function renderHints(hints) {
      el["hint-list"].textContent = ""; el["answer-before-editor"].replaceChildren(); el["answer-before-editor"].hidden = true; hintsShown = 0; el["show-answer"].hidden = false; el["next-hint"].textContent = hints.length ? hintButtonLabel(0, hints.length) : "Hints arrive with the case"; el["next-hint"].disabled = !hints.length;
      function reveal(completeAnswer) {
        const next = hintIndicesThrough(hintsShown, hints.length, completeAnswer);
        let focusTarget = null;
        next.indices.forEach(index => {
          const item = document.createElement("li"), hint = hints[index];
          const isSolution = hint && typeof hint === "object" && hint.stage === "solution";
          if (isSolution) {
            const label = document.createElement("p"), code = document.createElement("pre");
            label.textContent = "Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns. It does not count as a saved answer until Julia checks it.";
            code.className = "complete-answer-code"; code.textContent = hint.text || "";
            el["answer-before-editor"].replaceChildren(label, code); el["answer-before-editor"].hidden = false;
            item.textContent = "The complete runnable answer is shown above your editor.";
            focusTarget = el["answer-before-editor"];
          } else { item.textContent = typeof hint === "string" ? hint : hint.text || "Hint unavailable."; if (!focusTarget || focusTarget !== el["answer-before-editor"]) focusTarget = item; }
          el["hint-list"].appendChild(item);
        });
        // r4 bug hunt #3: disabling or hiding the focused button drops focus to <body>, so move it to what was just shown.
        if (hintsShown < hints.length && next.shown >= hints.length && focusTarget) { focusTarget.tabIndex = -1; focusTarget.focus(); }
        hintsShown = next.shown; el["next-hint"].textContent = hintButtonLabel(hintsShown, hints.length); el["next-hint"].disabled = hintsShown >= hints.length;
        // One full-answer control (r2 bug hunt, 2026-09-27): once every hint is out, the separate answer button has nothing left to show.
        el["show-answer"].hidden = hintsShown >= hints.length;
      }
      el["next-hint"].onclick = () => reveal(false);
      el["show-answer"].onclick = () => reveal(true);
    }
    function renderReferences(info) {
      const example = info.worked_example || {}; el["worked-example"].textContent = "";
      if (typeof example === "string") appendText(el["worked-example"], "p", "", example);
      else {
        appendText(el["worked-example"], "p", "", "Compare a different batch: " + (example.batch_id || ""));
        appendText(el["worked-example"], "pre", "example-code", example.code || "");
        appendText(el["worked-example"], "p", "", example.note || "");
      }
      el.glossary.textContent = "";
      (Array.isArray(info.glossary) ? info.glossary : Object.keys(info.glossary || {}).map((term) => ({ term, definition: info.glossary[term] }))).forEach((entry) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = entry.term; dd.textContent = entry.definition; el.glossary.append(dt, dd); });
    }
    // r6-rc #3 (2026-09-27): the restored-code note goes once the learner types or runs, as C4's draft note does.
    function clearRestoredCodeNote() { if (restoredCodeNote) { restoredCodeNote.remove(); restoredCodeNote = null; } }
    function run() {
      if (state.connection !== "connected" || !caseInfo || isRunPending(state)) return;
      const id = requestId(); clearRestoredCodeNote(); state = beginRun(state, id); armRunDeadline(id); updateRunControl(); el["result-area"].textContent = ""; lastSubmittedCode = state.code; send({ type: "case_run", case_id: "missing-fleas-v1", chapter: "C1", code: state.code, request_id: id });
    }
    function appendText(parent, tag, className, text) { const node = document.createElement(tag); node.className = className || ""; node.textContent = text; parent.appendChild(node); return node; }
    function appendNotice(text, isError) { appendText($("notices"), "p", "notice" + (isError ? " error" : ""), text); }
    function renderResult(result) {
      el["result-area"].textContent = ""; appendText(el["result-area"], "h2", result.pass ? "result-title pass" : "result-title fail", runOutcomeStatus(result, saveOk));
      if (result.message) {
        if (result.pass) appendText(el["result-area"], "p", "result-message", result.message);
        else {
          const original = document.createElement("details");
          original.className = "original-error";
          appendText(original, "summary", "", "Original Julia error");
          appendText(original, "pre", "", result.message);
          el["result-area"].appendChild(original);
        }
      }
      if (result.stdout) appendText(el["result-area"], "pre", "stdout", result.stdout); if (result.value_repr && !(result.columns && result.columns.length)) appendText(el["result-area"], "pre", "value-repr", "Julia returned:\n" + result.value_repr);
      const rowsLead = returnedRowsLead(result, caseInfo); if (rowsLead) appendText(el["result-area"], "p", "recovery-next-step", rowsLead);
      // Night playtest 2026-09-26: a coached mistake (e.g. R's $) used to show the server's generic
      // "Julia stopped before the end" line above the specific coaching, reading as one wrong message
      // followed by the right one. The specific coaching now replaces the generic line, not adds to it.
      const recovery = challengeRecovery(result);
      if (result.feedback && !hidesServerFeedback(recovery)) appendText(el["result-area"], "p", "feedback", result.feedback);
      if (recovery) appendText(el["result-area"], "p", "recovery-next-step", recovery);
      if (Array.isArray(result.rows) && Array.isArray(result.columns) && result.columns.length) {
        const tableParent = el["result-area"];
        if (result.pass) appendText(tableParent, "h3", "returned-table-title", "Julia returned this table:");
        else appendText(tableParent, "p", "wrong-rows-label", result.rows.length + " rows returned by your code:");
        const table = document.createElement("table"); table.className = "returned-table";
        // The wrap scrolls a wide table inside its own box on a phone instead of spilling past the card.
        const wrap = document.createElement("div"); wrap.className = "table-wrap returned-table-wrap"; wrap.tabIndex = 0;
        wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", "Returned table");
        renderTable(table, result.columns, result.rows, true); wrap.appendChild(table); tableParent.appendChild(wrap);
      }
      const back = appendText(el["result-area"], "button", "quiet-button", "Return to your code");
      back.type = "button"; back.onclick = () => showStage("code");
    }
    function focusResult(target) { (target || el["result-area"]).focus(); }
    function renderEvidence(evidence, rows, explanation, restored = false, submittedCode = "") {
      acceptedRows = rows; highlightSource();
      if (bridges) bridges.renderCard(el["bridge-card"], "C1/select-records", restored ? "" : submittedCode);
      el["evidence-board"].hidden = false; el["evidence-board"].classList.remove("evidence-arrived"); void el["evidence-board"].offsetWidth; el["evidence-board"].classList.add("evidence-arrived");
      el["evidence-summary"].textContent = evidenceSummary(evidence, rows); el["evidence-rows"].textContent = "";
      rows.forEach((row, index) => { const card = document.createElement("article"), title = document.createElement("h3"), text = document.createElement("p"); card.className = "evidence-card"; title.textContent = row.jar_id || "Record " + (index + 1); const jar = document.createElement("div"); jar.className = "evidence-jar"; jar.setAttribute("aria-hidden", "true"); jar.textContent = row.batch_id || ""; text.textContent = jarCardText(row); card.append(jar, title, text); el["evidence-rows"].appendChild(card); });
      let reaction = $("toto-reaction");
      if (!reaction) { reaction = document.createElement("p"); reaction.id = "toto-reaction"; reaction.className = "toto-reaction"; el["evidence-summary"].after(reaction); }
      reaction.textContent = restored ? "Previously saved: " + rows.length + " records from your earlier investigation. Run again for a fresh check." : momoReaction(rows);
      let discovery = $("case-discovery");
      if (!discovery) { discovery = document.createElement("p"); discovery.id = "case-discovery"; reaction.after(discovery); }
      discovery.textContent = restored ? "" : discoveryText(rows);
      el["explanation-julia"].textContent = explanation && explanation.julia || evidence.text || "Julia returned exactly the records you asked it to filter."; el["explanation-case"].textContent = explanation && explanation.case || "Case reading: the kept rows are evidence, not a story invented by the screen.";
      let back = el["evidence-board"].querySelector("button");
      if (!back) { back = appendText(el["evidence-board"], "button", "quiet-button", "Return to your code"); back.type = "button"; back.onclick = () => showStage("code"); }
      let boardUpdate = $("case-board-update");
      if (!boardUpdate) { boardUpdate = document.createElement("p"); boardUpdate.id = "case-board-update"; boardUpdate.className = "case-board-update"; el["evidence-board"].querySelector(".complete-line").after(boardUpdate); }
      boardUpdate.textContent = boardUpdateLine(rows);
      let next = $("chapter-two-link");
      if (!next) { next = appendText(el["evidence-board"], "a", "start-link", "Chapter 2: count by tray →"); next.id="chapter-two-link"; }
      next.href=chapter2Url(location.search);
      // r8-rc #1 (2026-09-28): once C1 is solved, the next chapter also sits beside Run, as in C2 to C6.
      $("next-chapter").href = next.href; $("next-chapter").hidden = false;
      el["evidence-board"].querySelector(".complete-line span").textContent="Your Chapter 1 code is saved.";
    }
    el.code.addEventListener("input", () => { clearRunTimer(); clearRestoredCodeNote(); state = Object.assign({}, cancelRun(state), { code: el.code.value }); updateRunControl(); if (storage && !persistCode(storage, state.code) && !storageWarningShown) { storageWarningShown = true; appendNotice("Your code remains on screen, but this browser cannot save it for reload."); } });
    el.code.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); run(); } });
    el.run.addEventListener("click", run); el["reset-code"].addEventListener("click", () => { state = Object.assign({}, cancelRun(state), { code: "" }); el.code.value = ""; updateRunControl(); if (storage && !persistCode(storage, "") && !storageWarningShown) { storageWarningShown = true; appendNotice("Your code is reset on screen, but the reset could not be saved."); } el.code.focus(); }); el.reconnect.addEventListener("click", () => connect(true));
    window.addEventListener("pagehide", () => { stopped = true; clearInfoTimer(); clearRunTimer(); state = disconnect(state); clearTimeout(reconnectTimer); if (socket) socket.close(); }); if (!storage) appendNotice("Browser storage is unavailable: evidence and code cannot be restored after reload."); showStage(initialStage, false); connect(false);
  }
  return { jarCardText, momoReaction, runButtonState, sessionOptions, STORAGE_PREFIX, EVIDENCE_KEY, CODE_KEY, INFO_DEADLINE_MS, RUN_DEADLINE_MS, createState, beginInfo, failCaseInfo, expireInfo, isCurrentCaseInfo, beginRun, expireRun, cancelRun, isRunPending, applyRunStatus, isCurrentSocket, applyCaseResult, disconnect, persistEvidence, persistAcceptedCourseState, loadEvidence, persistCode, loadCode, validEvidenceDisplay, displayCell, retainedJarIds, hintButtonLabel, hintIndicesThrough, nextStage, previousStage, restoreStage, practiceFeedback, challengeRecovery, hidesServerFeedback, returnedRowsLead, helpDrawerVisible, boardUpdateLine, runOutcomeStatus, restoredEvidenceDisplay, readPractice, storagePrefix, discoveryText, evidenceSummary, chapter2Url, caseBoardUrl, caseLocation, init, bridgeText };
});

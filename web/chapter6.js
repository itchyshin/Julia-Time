/* Julia Time: Missing Fleas C6. Candidate data and checked conclusions stay server-side. */
(function(root, factory) {
  const courseClient = typeof module === "object" && module.exports ? require("./course/course-client.js") : root && root.JuliaTimeCourseClient;
  const api = factory(courseClient);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeChapter6 = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.init);
})(typeof window !== "undefined" ? window : null, function(courseClient) {
  "use strict";

  const CASE_ID = "missing-fleas-v1";
  const CHAPTER = "C6";
  const MOVE = "compatible-models";
  const COLUMNS = ["model", "p", "lower", "upper"];
  const FILE_URL_RECOVERY_MESSAGE = "This page was opened directly. Start run.jl, then open http://127.0.0.1:8000 to run Chapter 6.";
  const INFO_DEADLINE_MS = 5000;
  const RUN_DEADLINE_MS = 7000;
  const COPY = {
    concept: "A story fits when 5 is between its low end and its high end, both ends included. Check each end separately, then keep the rows that pass both. Coming from R? In R you'd reach for dplyr's filter with two conditions; Julia makes two true/false lists and combines them. Julia's .& combines them row by row, the same way R's & does; both languages save && for a single true-or-false answer, not a whole column.",
    shape: "fits_low  = table.lower .<= target\nfits_high = target .<= table.upper\ntable[fits_low .& fits_high, :]",
    // B9 (simulated playtest, P21/P43): name the template placeholders and map them, as in C3.
    shape_note: "table and target are placeholders, not names in this case. In this case, table is stories and target is observed_count. .& keeps a row only when both are true.",
    range_rule: "Check the low end, then the high end, then keep the rows that pass both.",
    selection: "table[fits_low .& fits_high, :]",
    solution: "fits_low = stories.lower .<= observed_count\nfits_high = observed_count .<= stories.upper\nstories[fits_low .& fits_high, :]",
    syntax: "Read this before you write: .<= compares every row; .& keeps a row only when both comparisons are true; and [rows, :] means use a row rule, then keep all columns."
  };

  function initialEditorText() { return ""; }
  // UI-12 (2026-09-24 audit): like C1's T4 recovery, an optional first line is keyed on Julia's
  // actual error text for a missing broadcast dot. The shared next step after it is unchanged and
  // names no case input.
  // A returning player's saved draft may still use a name from before the story rename (bible v2
  // section 3.1: "candidate_models" became "stories"). Keyed on Julia's own UndefVarError, matching
  // C3's oldNameCoaching pattern, so the coaching leads with the actual cause.
  const RENAMED_NAMES = Object.freeze({candidate_models:"stories"});
  function recoveryLead(message) {
    // Owner playtest (2026-09-26): a practice-only name typed into the case gets a plain pointer to the real inputs.
    const practice = String(message && message.message || "").match(/UndefVarError: `(practice_pass|practice_stays|practice_fails)` not defined/);
    if (practice) return practice[1] + " is a name from the practice example, not this case. In the case, use stories and observed_count.";
    const renamedName = String(message && message.message || "").match(/UndefVarError: `(candidate_models)` not defined/);
    if (renamedName) return "This name changed: use " + RENAMED_NAMES[renamedName[1]] + " instead of " + renamedName[1] + ".";
    const text = message && message.status === "error" ? String(message.message || "") : "";
    if (/non-boolean \(BitVector\) used in boolean context/.test(text)) return "Julia needed a single true or false here, which is what && and || expect, but each dotted comparison gives one value per row. Use .& to keep a row only when both checks are true.";
    if (/no method matching isless\([^)]*Vector/.test(text)) return "Julia cannot compare a whole column with one number using a comparison without a dot, such as <=. Put a dot before the comparison, as in .<=, so Julia compares every row.";
    if (/no method matching &\(::BitVector, ::BitVector\)/.test(text)) return "A plain & cannot combine two columns of true-or-false values. Put a dot before it, as in .&, so Julia combines them row by row.";
    return "";
  }
  function challengeRecovery(message) {
    // repair5-5 (2026-09-24 walk-through): name the labelled Required result line and the Help me start
    // control, which the page really shows; no element is labelled as a "cue".
    // repair6-4 (2026-09-24 browser check): an error run returned no result, so it gets its own step.
    const shared = message && message.status === "error"
      ? "Your draft is still here. Use the Original Julia error below to decide what to change, or open Help me start in Stuck? Hints below, then run again."
      : "That result did not meet the stated check. Your draft is still here. Compare it with the Required result line near the top of the page, or open Help me start in Stuck? Hints below, then revise it and run again.";
    const lead = recoveryLead(message);
    return lead ? `${lead} ${shared}` : shared;
  }
  function id(prefix) { return (prefix || "c6") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function validAttempt(value) { return /^[a-z0-9-]{1,80}$/.test(value || ""); }
  // The door to the ending: only once every Case file row says "What we know so far" (docs/design/03-ending.md).
  function endingHref(rows, attempt) {
    return completionLine(rows).startsWith("Case closed") ? "course/ending.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "") : null;
  }
  function boardUrl(search) {
    const attempt = new URLSearchParams(search || "").get("attempt");
    return "course/index.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function envelope(request_id) {
    return { case_id: CASE_ID, chapter: CHAPTER, move_id: MOVE, mode: "challenge", activity_id: null, simulation_id: null, request_id };
  }
  function same(message, expected) {
    return Boolean(message && expected && message.contract_version === 1 && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id && message.request_id === expected.request_id);
  }
  function createState() {
    return { connection: "idle", infoRequest: null, pending: null, expired: false, statusMessage: null, metadata: null, result: null, evidence: null, fileUrlRecovery: false, metadataFailure: "", runFailure: null };
  }
  function beginInfo(state, request_id) {
    return Object.assign({}, state, { infoRequest: envelope(request_id), pending: null, expired: false, statusMessage: null, metadata: null, result: null, evidence: null, metadataFailure: "", runFailure: null });
  }
  function failCaseInfo(state, message) {
    if (!state.infoRequest || !message || message.type !== "error") return state;
    const unknown = /unknown mystery chapter/i.test(String(message.message || ""));
    const text = unknown
      ? "The local lab does not recognise this chapter. Restart Julia Time, then reload this page. Your draft is still here."
      : "The chapter inputs are unavailable. Restart Julia Time, then reload this page. Your draft is still here.";
    return Object.assign({}, state, { infoRequest: null, metadata: null, metadataFailure: text });
  }
  function expireInfo(state, request_id) {
    if (!state.infoRequest || state.infoRequest.request_id !== request_id) return state;
    return Object.assign({}, state, {
      infoRequest: null,
      metadata: null,
      metadataFailure: "The story board took too long to arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here."
    });
  }
  function sameColumns(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && actual.every((column, index) => column === expected[index]);
  }
  function sameColumnSet(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === expected.length && actual.every(column => expected.includes(column));
  }
  function finiteNumber(value) { return typeof value === "number" && Number.isFinite(value); }
  function validCandidateRow(row, n_trials) {
    return Boolean(row && typeof row.model === "string" && row.model.trim() && finiteNumber(row.p) && row.p >= 0 && row.p <= 1 && Number.isInteger(row.lower) && Number.isInteger(row.upper) && row.lower >= 0 && row.lower <= row.upper && row.upper <= n_trials);
  }
  function sameRow(actual, expected) {
    return Boolean(actual && expected && actual.model === expected.model && actual.p === expected.p && actual.lower === expected.lower && actual.upper === expected.upper);
  }
  function validInfo(message) {
    const input = message && Array.isArray(message.inputs) && message.inputs.length === 1 ? message.inputs[0] : null;
    const trials = message && message.n_trials;
    return Boolean(
      input && input.id === "stories" && sameColumns(input.columns, COLUMNS) &&
      Number.isInteger(trials) && trials > 0 &&
      Number.isInteger(message.observed_count) && message.observed_count >= 0 && message.observed_count <= trials &&
      Array.isArray(input.rows) && input.rows.length >= 2 && input.rows.every(row => validCandidateRow(row, trials)) &&
      new Set(input.rows.map(row => row.model)).size === input.rows.length
    );
  }
  function candidateModelCards(metadata) {
    if (!validInfo(metadata)) return [];
    return metadata.inputs[0].rows.map(row => ({ model: row.model, p: row.p }));
  }
  // repair6-5 (2026-09-24 browser check): a card shows p separately only when its name does not already.
  function cardProbabilityLabel(card) {
    const label = `p = ${card.p}`;
    return String(card.model).includes(label) ? "" : label;
  }
  function applyCaseInfo(state, message) {
    if (!state.infoRequest || !message || message.type !== "case" || !same(message, state.infoRequest) || !validInfo(message)) return state;
    return Object.assign({}, state, { infoRequest: null, metadata: message, metadataFailure: "" });
  }
  function beginRun(state, request_id) {
    return state.metadata ? Object.assign({}, state, { pending: envelope(request_id), expired: false, statusMessage: null, result: null, evidence: null, runFailure: null }) : state;
  }
  // `pending` is kept (not nulled) on expiry so a correct result arriving late for this same
  // request is still applied rather than discarded (B1); `isRunPending` makes the run retryable.
  function expireRun(state, request_id) {
    if (!state.pending || state.pending.request_id !== request_id) return state;
    return Object.assign({}, state, { expired: true, statusMessage: null, runFailure: { status: "timeout", message: "This check took too long. Your draft is still here; check it, then run again." } });
  }
  function isRunPending(state) { return Boolean(state.pending) && !state.expired; }
  function applyRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.pending || state.expired || message.request_id !== state.pending.request_id) return state;
    return Object.assign({}, state, { statusMessage: message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : "" });
  }
  function validResult(metadata, message) {
    const data = message && message.result_data;
    const input = metadata && metadata.inputs && metadata.inputs[0];
    if (!(data && data.kind === "table" && sameColumnSet(data.columns, COLUMNS) && Array.isArray(data.rows) && data.rows.length > 0 && input && Array.isArray(input.rows))) return false;
    const unused = input.rows.slice();
    return data.rows.every(row => {
      const index = unused.findIndex(candidate => sameRow(row, candidate));
      if (index < 0 || row.lower > metadata.observed_count || metadata.observed_count > row.upper) return false;
      unused.splice(index, 1);
      return true;
    });
  }
  // T4 (2026-09-12 panel finding): a server timeout that arrives as a normal case_result (rather
  // than via the client's own armRunDeadline expiry) used to be flattened into the same generic
  // "rejected" status as a wrong answer, so a genuinely-hanging run read as "did not meet the
  // stated check" instead of the honest timeout message. Preserve a reported "timeout" status.
  function applyCaseResult(state, message) {
    if (!state.pending || !message || message.type !== "case_result" || !same(message, state.pending)) return state;
    const accepted = message.status === "ok" && message.pass === true && message.progress_eligible === true && validResult(state.metadata, message);
    const runFailure = accepted ? null : message.status === "timeout"
      ? { status: "timeout", message: "This check took too long. Your draft is still here; check it, then run again." }
      : { status: "rejected", run_status: message.status, message: challengeRecovery(message), original_error: message.status === "error" ? String(message.message || message.feedback || "") : "" };
    return Object.assign({}, state, { pending: null, expired: false, statusMessage: null, result: message, evidence: accepted ? { move_id: MOVE, result_data: message.result_data } : null, runFailure });
  }
  function disconnect(state) { return Object.assign({}, state, { connection: "offline", infoRequest: null, pending: null, expired: false, statusMessage: null }); }
  function connectionPlan(protocol) {
    return protocol === "file:" ? { open_socket: false, retry: false, message: FILE_URL_RECOVERY_MESSAGE } : { open_socket: true, retry: true, message: null };
  }
  function enterFileUrlRecovery(state) { return Object.assign({}, disconnect(state), { fileUrlRecovery: true }); }
  function connectionStatusText(state) {
    return state.fileUrlRecovery ? FILE_URL_RECOVERY_MESSAGE : state.runFailure ? "Your code is ready to revise." : state.metadataFailure ? state.metadataFailure : isRunPending(state) ? (state.statusMessage || "Checking your Julia result…") : state.connection === "idle" ? "Open the story board to load the stories." : state.connection === "connected" ? (state.metadata ? "Lab file ready" : "Loading the story board…") : "Connecting to the lab…";
  }
  function draftNotice(hasCode, restored) {
    if (!hasCode) return "This editor starts empty. Write your own Julia result.";
    return restored ? "Restored your saved draft: it is your earlier typing, not supplied code." : "This is your own unrun draft for this move.";
  }
  // UI-03 (2026-09-24 audit): after a run the caption says what Julia did with this code, as C3 and
  // C4 do. It says "unrun draft" again only once the learner edits the code.
  function draftStatus(message) {
    if (!message || message.status === "timeout") return "This code was not accepted; your draft is still here to check and run again.";
    if (message.status === "error") return "Julia could not run this code; your draft is still here to revise and run again.";
    if (message.status === "ok" && message.pass === true && message.progress_eligible === true) return "Julia checked this code just now and accepted it; you can change it and run again.";
    if (message.status === "ok") return "Julia ran this code, but the returned result does not yet meet the stated requirement.";
    return "This code was not accepted; your draft is still here to check and run again.";
  }
  const NOT_SAVED_STATUS = "Right answer, but this computer could not save it, so the Case Board will not show it. Run it once more; if this keeps happening, ask your helper.";
  // Ask the saved record itself, never the write call: a write can fail silently (blocked storage, a damaged record).
  function savedMove(courseState, storage, attempt, chapter, moveId) { try { return Boolean(storage && courseState && typeof courseState.hasSavedMove === "function" && courseState.hasSavedMove(storage, attempt, chapter, moveId)); } catch (_) { return false; } }
  function runOutcomeStatus(message, saved) {
    if (!message) return "";
    if (message.status === "ok" && message.pass === true && message.progress_eligible === true) return saved === false ? NOT_SAVED_STATUS : "Julia checked it: that's right.";
    if (message.status === "timeout") return "Not yet. Your code took too long, so the lab stopped it. Your code is still here.";
    // repair5-6: a rejected run keeps Julia's own status, so an error gets the same title as C1-C4.
    if (message.status === "error" || message.run_status === "error") return "Not yet. Julia could not run this code. Your code is still here.";
    return "Not yet. Julia ran your code; the result below is not quite what we need.";
  }
  function shouldShowReconnect(state) { return !state.fileUrlRecovery && (Boolean(state.metadataFailure) || (state.connection !== "connected" && state.connection !== "connecting" && state.connection !== "idle")); }
  function infoMessage(request_id) { return Object.assign({ type: "case_info", contract_version: 1 }, envelope(request_id)); }
  function runMessage(code, request_id) { return Object.assign({ type: "case_run", contract_version: 1, code }, envelope(request_id)); }

  function learningScaffold(metadata) {
    const observed = metadata.observed_count;
    return {
      why: "Chapter 5 asked whether the B09 count was surprising under one small story. Here, we compare the story board's usual ranges: which stories could still give the count we actually observed?",
      observation: `The observed B09 count is ${observed}. In each row, p is that story's chance that one jar shows fleas. The lower and upper values are the usual range of six-jar counts for that story, not every count it could possibly give. A range that includes ${observed} does not make that story true; it only means this observation does not rule the story out.`,
      practice_stays: "Different practice story: its displayed range is 1 to 4 and its practice observation is 3. 1 ≤ 3 ≤ 4 is true, so that practice row stays.",
      practice_fails: "Different practice story: its displayed range is 0 to 2 and its practice observation is 3. 0 ≤ 3 ≤ 2 is false, so that practice row is left out.",
      bridge: "That was practice data. Now make the same yes/no check on the named stories table above. If the symbols are new, open Help me start in Stuck? Hints: it introduces .lower and .upper, .<=, .&, and [rows, :] before the full answer."
    };
  }

  function caseStatus(metadata) {
    if (!validInfo(metadata)) return null;
    return {
      established:`So far: the notebook and the tally sheet disagree for tray T-C: the notebook has 1, the tally sheet's box was left blank. The observed B09 count is ${metadata.observed_count}.`,
      unknown:"Still unknown: fitting is not proof, two stories still fit.",
      why_now:"Why this move now: the report says vanishing. See which stories could give 5 of 6."
    };
  }

  // docs/design/05-story-bible.md (v2, approved), "In-page case summary after C6": the plain-voice
  // replacement for this block, consistent with the ending finale (both claims checked, the fleas
  // never shown missing, the recheck still open).
  function caseClosure(metadata, resultData) {
    if (!validInfo(metadata) || !validResult(metadata, {result_data:resultData})) return null;
    return {
      title:"Both claims checked",
      findings:[
        "Claim 1, “T-C has no fleas”: the notebook shows fleas in T-C. The 0 was a blank box on the tally sheet.",
        "Claim 2, “the fleas are vanishing”: 5 of 6 is not suspicious, and the vanishing story almost never gives it.",
        "Still open: the recheck of three jars."
      ]
    };
  }

  function caseFileRows(acceptedKeys) {
    if (!courseClient || typeof courseClient.caseFile !== "function") return [];
    return courseClient.caseFile(new Set(Array.isArray(acceptedKeys) ? acceptedKeys : []));
  }
  // repair5-8 (2026-09-24 walk-through): the Chapter 6 fact is the last line of the Case file just
  // below, so this line points there instead of repeating it, and only when Chapter 6 is saved.
  function boardUpdateLine(rows) {
    const row = Array.isArray(rows) ? rows.find(item => item && item.chapter === "C6") : null;
    return row && row.label === "What we know so far" ? "Case Board updated: your Chapter 6 finding is now the last line of the Case file below." : "";
  }

  // The first line of the ending: the whole case is solved only when all six Case file rows say "What we know so far".
  function completionLine(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const open = list.filter(row => row && row.label !== "What we know so far").map(row => row.chapter.slice(1));
    if (list.length === 6 && open.length === 0) return "Case closed: all 6 chapters complete.";
    const names = open.length === 1 ? "Chapter " + open[0] : "Chapters " + open.slice(0, -1).join(", ") + " and " + open[open.length - 1];
    const c6Open = open.includes("6");
    return (c6Open ? "The case is not complete yet." : "Chapter 6 is solved, but the case is not complete yet.") + " Still open: " + names + ". Each one counts once Julia accepts its answer and it is saved.";
  }
  function rangePracticeStep(stage) {
    return [
      { label:"Check the lower bounds", result:"Both practice rows pass the lower-bound check: 1 ≤ 3 and 0 ≤ 3 are true.", next:"Now check the upper bounds →" },
      { label:"Check the upper bounds", result:"Only the first practice row passes the upper-bound check: 3 ≤ 4 is true, but 3 ≤ 2 is false.", next:"Combine both checks →" },
      { label:"Combine both checks", result:"Both checks must be true. The 1–4 practice range stays; the 0–2 range is left out.", next:null }
    ][Math.max(0, Math.min(2, Number.isInteger(stage) ? stage : 0))];
  }

  // UI-11 (2026-09-24 audit): an opened hint stays on screen when the next one opens, as in C1-C4.
  // The full answer itself stays in its reference panel above the editor, never in this list.
  function visibleHints(hint) {
    const stages = [[COPY.concept], [`Code shape: ${COPY.shape}`, COPY.shape_note], [`Build the row rule: ${COPY.range_rule}`], [`Select rows: ${COPY.selection}`], ["Complete runnable answer is shown in the code panel above your editor."]];
    const count = Math.max(0, Math.min(stages.length, Number.isInteger(hint) ? hint : 0));
    return count === 0 ? ["Open a small hint only if you need it."] : stages.slice(0, count).flat();
  }

  function preEditorBridgeVisible(hintLevel) { return Number.isInteger(hintLevel) && hintLevel >= 2; }
  // repair5-1 (2026-09-24 walk-through): the lead promises two checks, so both are listed, in the
  // row-rule hint's placeholders. Only the lower one is also shown with case names (2026-09-09).
  function preEditorBridge() {
    return {
      lead: "Check the low end, then the high end, before you write the case version:",
      checks: [
        { label: "Low-end check", template: "table.lower .<= target", inCase: "stories.lower .<= observed_count", note: "This gives one true-or-false value per story." },
        { label: "High-end check", template: "target .<= table.upper", inCase: "", note: "Write it with the named case inputs in the same way. It also gives one true-or-false value per story." }
      ],
      shape: "fits_low  = table.lower .<= target\nfits_high = target .<= table.upper\ntable[fits_low .& fits_high, :]",
      explanation: "Replace the generic names with the named case inputs above. This is a code shape, not the case answer."
    };
  }

  function init() {
    const $ = id => document.getElementById(id);
    const el = { syntax: $("syntax"), showFullAnswer: $("show-full-answer"), scene: $("scene"), work: $("work"), start: $("start"), back: $("back"), board: $("case-board"), sceneBoard: $("case-board-scene"), sceneTitle: $("scene-title"), title: $("move-title"), reconnect: $("reconnect"), status: $("status"), observed: $("observed"), modelCards: $("candidate-model-cards"), data: $("data"), scaffold: $("learning-scaffold"), caseStatus: $("case-status"), preEditorBridge: $("pre-editor-bridge"), answerReference: $("answer-before-editor"), code: $("code"), draft: $("draft-note"), run: $("run"), result: $("result"), visual: $("visual"), hint: $("hint"), nextHint: $("next-hint"), answer: $("answer"), bridgeCard: $("bridge-card") };
    const bridges = typeof window !== "undefined" ? window.JuliaTimeBridges : null;
    let submittedCode = "";
    if (!el.work) return;
    // The only step that needs .& says so on the page, not only in the help panel (round-3 bot, 2026-09-25).
    if (el.syntax) el.syntax.textContent = COPY.syntax;
    let state = createState(), socket = null, timer = null, infoTimer = null, runTimer = null, hint = 0, practiceStage = -1, storage = null, saveOk = true;
    try { storage = localStorage; } catch (_) {}
    const course = window.JuliaTimeCourseState;
    const attempt = new URLSearchParams(location.search).get("attempt") || "";
    const caseBoard = boardUrl(location.search);
    if (el.board) el.board.href = caseBoard;
    if (el.sceneBoard) el.sceneBoard.href = caseBoard;
    let restoredDraft = false;
    let lastRun = null; // UI-03: the run Julia last checked for this editor text; cleared by any edit.
    try { const drafts = course && course.readChallengeDrafts ? course.readChallengeDrafts(storage, attempt) : {}; el.code.value = drafts && drafts["C6/compatible-models"] || ""; restoredDraft = el.code.value.length > 0; } catch (_) {}

    function text(value) { return value == null ? "" : String(value); }
    function clearInfoTimer() { if (infoTimer) { clearTimeout(infoTimer); infoTimer = null; } }
    function clearRunTimer() { if (runTimer) { clearTimeout(runTimer); runTimer = null; } }
    function armRunDeadline(requestId) { clearRunTimer(); runTimer = setTimeout(() => { state = expireRun(state, requestId); if (state.runFailure) { lastRun = state.runFailure; showResult(state.runFailure); el.code.focus(); } render(); }, RUN_DEADLINE_MS); }
    function draftCaption() { return lastRun ? draftStatus(lastRun) : draftNotice(Boolean(el.code.value), restoredDraft); }
    function renderHints(lines) {
      const shown = Array.from(el.hint.children, item => item.textContent);
      const grows = shown.length <= lines.length && shown.every((line, index) => line === lines[index]);
      if (!grows) el.hint.replaceChildren();
      lines.slice(grows ? shown.length : 0).forEach(line => { const p = document.createElement("p"); p.textContent = line; el.hint.append(p); });
    }
    function send(message) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
    function drawModelCards() {
      if (!el.modelCards) return;
      el.modelCards.replaceChildren();
      if (!state.metadata) {
        const item = document.createElement("li");
        item.textContent = "The story board will appear when the lab file loads.";
        el.modelCards.append(item);
        return;
      }
      // short-scroll (2026-09-25): the intro paragraph above already says what p means once; the
      // candidate table below repeats every model's exact p, lower and upper. Each card here only
      // needs to name the model (plus its p when the name does not already state it), one line.
      candidateModelCards(state.metadata).forEach(card => {
        const item = document.createElement("li"), name = document.createElement("strong"), label = cardProbabilityLabel(card);
        name.textContent = card.model;
        item.append(name);
        if (label) { const probability = document.createElement("code"); probability.textContent = label; item.append(" · ", probability); }
        el.modelCards.append(item);
      });
    }
    function drawTable() {
      el.data.replaceChildren();
      if (!state.metadata) {
        if (state.metadataFailure) { const p = document.createElement("p"); p.className = "recovery"; p.textContent = state.metadataFailure; el.data.append(p); }
        return;
      }
      const label = document.createElement("p"), name = document.createElement("code");
      label.className = "data-label"; name.textContent = state.metadata.inputs[0].id; label.append("Julia name: ", name);
      const caption = document.createElement("p"); caption.textContent = "Simulated data made for this game: no real jars, no real fleas.";
      const table = document.createElement("table"), head = document.createElement("thead"), body = document.createElement("tbody"), header = document.createElement("tr");
      state.metadata.inputs[0].columns.forEach(column => { const th = document.createElement("th"); th.textContent = column; header.append(th); });
      head.append(header);
      state.metadata.inputs[0].rows.forEach(row => { const tr = document.createElement("tr"); state.metadata.inputs[0].columns.forEach(column => { const td = document.createElement("td"); td.textContent = text(row[column]); tr.append(td); }); body.append(tr); });
      table.append(head, body); el.data.append(label, caption, table);
    }
    function drawScaffold() {
      el.scaffold.replaceChildren();
      if (!state.metadata) { el.scaffold.hidden = true; return; }
      const copy = learningScaffold(state.metadata);
      const eyebrow = document.createElement("p"), title = document.createElement("h2"), why = document.createElement("p"), observation = document.createElement("p"), examples = document.createElement("div"), stays = document.createElement("p"), fails = document.createElement("p"), bridge = document.createElement("p"), practice = document.createElement("section"), practiceTitle = document.createElement("h3"), practiceRule = document.createElement("p"), practiceResult = document.createElement("p"), practiceButton = document.createElement("button");
      eyebrow.className = "eyebrow"; eyebrow.textContent = "Read the evidence before you write";
      title.textContent = "Why this check matters";
      why.textContent = copy.why; observation.textContent = copy.observation;
      examples.className = "range-examples"; stays.textContent = copy.practice_stays; fails.textContent = copy.practice_fails; examples.append(stays, fails);
      const nextPracticeStage = Math.min(2, practiceStage + 1);
      const nextStep = rangePracticeStep(nextPracticeStage);
      practice.className="range-practice"; practiceTitle.textContent="Try the range check on two practice rows"; practiceRule.textContent="Practice observation: 3. Row A has range 1–4; Row B has range 0–2. Make one comparison at a time, then combine them. This is practice data. Your code box stays empty.";
      practiceButton.type="button"; practiceButton.className="quiet"; practiceButton.textContent=nextStep.label;
      practiceButton.disabled=practiceStage >= 2;
      practiceButton.addEventListener("click", () => { practiceStage = nextPracticeStage; drawScaffold(); });
      practiceResult.textContent=practiceStage < 0 ? "Choose the first check, then read what it tells us." : rangePracticeStep(practiceStage).result;
      practice.append(practiceTitle,practiceRule,practiceButton,practiceResult);
      if (practiceStage >= 0 && rangePracticeStep(practiceStage).next) { const next = document.createElement("p"); next.className="bridge"; next.textContent=rangePracticeStep(practiceStage).next; practice.append(next); }
      bridge.className = "bridge"; bridge.textContent = copy.bridge;
      el.scaffold.append(eyebrow, title, why, observation, examples, practice, bridge); el.scaffold.hidden = false;
    }
    // short-scroll (2026-09-25): the established fact stays visible (it is what changes move to
    // move); the epistemic caution and the "why now" justification, which read the same on every
    // candidate-range move, sit one click away in a closed, clearly labelled details.
    function drawCaseStatus() {
      if (!el.caseStatus) return;
      el.caseStatus.replaceChildren();
      const status = caseStatus(state.metadata);
      if (!status) return;
      const eyebrow = document.createElement("p"), title = document.createElement("h2"), established = document.createElement("p");
      const details = document.createElement("details"), summary = document.createElement("summary"), unknown = document.createElement("p"), why = document.createElement("p");
      eyebrow.className = "eyebrow"; eyebrow.textContent = "Case status before you write";
      title.textContent = "Why this move now";
      established.textContent = status.established;
      // The limit stays visible: every step says what it does not establish (spec; 2026-09-25 review).
      // Only the "why now" reasoning sits one click away.
      summary.textContent = "Why this move now";
      unknown.textContent = status.unknown;
      why.textContent = status.why_now;
      details.append(summary, why);
      el.caseStatus.append(eyebrow, title, established, unknown, details);
    }
    function acceptedMoveKeys() {
      try { return course && course.acceptedMoves ? course.acceptedMoves(course.readCourseState(storage, attempt)).map(move => move.key) : []; } catch (_) { return []; }
    }
    // UI-15 (2026-09-24 audit): the recheck sentence is shown once, in the closing block above,
    // where "them" follows the retained candidates; the Case file no longer repeats it.
    function buildCaseFileSection(rows) {
      const section = document.createElement("section"), title = document.createElement("h2"), list = document.createElement("ol");
      title.textContent = "Case file";
      rows.forEach(row => {
        const item = document.createElement("li"), chapterLabel = document.createElement("strong"), fact = document.createElement("span");
        if (row.label === "What we know so far") item.className = "case-file-established";
        chapterLabel.textContent = "Chapter " + row.chapter.slice(1) + ": ";
        fact.textContent = row.line;
        item.append(chapterLabel, fact);
        list.append(item);
      });
      section.append(title, list);
      return section;
    }
    function drawVisual(){
      el.visual.replaceChildren();
      if (!state.metadata || !state.result || !state.evidence || state.result.result_data !== state.evidence.result_data) return;
      const closure = caseClosure(state.metadata, state.evidence.result_data);
      if (!closure) return;
      const rows = caseFileRows(acceptedMoveKeys());
      const section = document.createElement("section"), title = document.createElement("h2"), intro = document.createElement("p"), list = document.createElement("ul"), limit = document.createElement("p"), claim = document.createElement("p"), closing = document.createElement("section"), closingTitle = document.createElement("h3"), closingFindings = document.createElement("ul"), review = document.createElement("a"), speed = document.createElement("a"), boardUpdate = document.createElement("p");
      title.textContent = "Stories that fit 5 of 6"; intro.textContent = "Your Julia result kept these rows because their usual range includes the notebook\u2019s 5:";
      state.evidence.result_data.rows.forEach(row => { const item = document.createElement("li"); item.textContent = `${row.model}: ${row.lower} ≤ ${state.metadata.observed_count} ≤ ${row.upper}`; list.append(item); });
      limit.className = "limit"; limit.textContent = "Fitting is not proof: two stories still fit.";
      claim.className = "claim-stamp"; claim.textContent = "Claim 2, “the fleas are vanishing”: not supported.";
      closingTitle.textContent = closure.title;
      const completion = document.createElement("p"); completion.className = "case-completion" + (completionLine(rows).startsWith("Case closed") ? " case-completion--solved" : ""); completion.textContent = completionLine(rows);
      closure.findings.forEach(finding => { const item = document.createElement("li"); item.textContent = finding; closingFindings.append(item); });
      review.href = boardUrl(location.search); review.textContent = "Review the Case Board →";
      speed.href = "course/speed-lab.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : ""); speed.textContent = "Optional: open the comparison laboratory →";
      boardUpdate.className = "board-update"; boardUpdate.textContent = boardUpdateLine(rows);
      closing.append(completion, closingTitle, closingFindings, review, document.createTextNode(" "), speed, boardUpdate); section.append(title, intro, list, limit, claim, closing);
      const endingUrl = endingHref(rows, attempt);
      if (endingUrl) { const ending = document.createElement("a"); ending.className = "ending-link"; ending.href = endingUrl; ending.textContent = "See how the case ends →"; completion.after(ending); }
      if (rows.length) section.append(buildCaseFileSection(rows));
      el.visual.append(section);
    }
    function render() {
      if (el.preEditorBridge) {
        if (preEditorBridgeVisible(hint)) {
          const bridge = preEditorBridge(), lead = document.createElement("p"), checks = document.createElement("ol"), templateLabel = document.createElement("p"), shape = document.createElement("pre"), explanation = document.createElement("p");
          const code = value => { const item = document.createElement("code"); item.textContent = value; return item; };
          lead.textContent = bridge.lead;
          bridge.checks.forEach(check => { const item = document.createElement("li"); item.append(`${check.label}: `, code(check.template), "."); if (check.inCase) item.append(" In this case: ", code(check.inCase), "."); item.append(` ${check.note}`); checks.append(item); });
          templateLabel.textContent = "Template: replace these placeholders; do not run this:";
          shape.className = "template-code"; shape.style.whiteSpace = "pre-wrap"; shape.textContent = bridge.shape;
          explanation.textContent = bridge.explanation;
          el.preEditorBridge.replaceChildren(lead, checks, templateLabel, shape, explanation);
        }
        else el.preEditorBridge.replaceChildren();
      }
      if (el.draft) el.draft.textContent = draftCaption();
      el.status.textContent = connectionStatusText(state);
      el.run.disabled = state.connection !== "connected" || !state.metadata || isRunPending(state);
      el.reconnect.hidden = !shouldShowReconnect(state);
      // short-scroll (2026-09-25): the rule (lower <= observed_count <= upper) is already the
      // required-result line just above; this only needs to name the observed count.
      el.observed.textContent = state.metadata ? `Observed B09 count: ${state.metadata.observed_count}.` : state.metadataFailure ? "The story board is unavailable; your saved draft is safe." : "The observed B09 count will appear when the lab file loads.";
      if (el.answerReference) {
        if (hint >= 5) { const label = document.createElement("p"), code = document.createElement("pre"); label.textContent = "Reference code answer: runnable Julia. Run this code in your editor to see Julia’s actual returned value below Run. It does not enter your editor or count as a saved answer."; code.className = "complete-answer-code"; code.textContent = COPY.solution; el.answerReference.replaceChildren(label, code); el.answerReference.hidden = false; }
        else { el.answerReference.replaceChildren(); el.answerReference.hidden = true; }
      }
      renderHints(visibleHints(hint));
      el.nextHint.textContent = hint >= 5 ? "All shown" : hint === 0 ? "Show the idea" : hint === 1 ? "Show the code shape" : hint === 2 ? "Show the row rule" : hint === 3 ? "Show row selection" : "Show the full answer";
      el.nextHint.disabled = hint >= 5;
      if (bridges) bridges.renderCard(el.bridgeCard, "C6/"+MOVE, state.evidence ? submittedCode : "");
      drawModelCards(); drawTable(); drawScaffold(); drawCaseStatus(); drawVisual();
    }
    function persist() { restoredDraft = false; try { if (course && course.writeChallengeDraft) course.writeChallengeDraft(storage, attempt, CHAPTER, MOVE, el.code.value); } catch (_) {} }
    function record(message) {
      if (!course || !state.evidence || state.result !== message || state.evidence.result_data !== message.result_data) return;
      try { course.recordHistoricalMoveIfMissing(storage, attempt, CHAPTER, MOVE); course.writeEvidenceIfMissing(storage, attempt, { chapter: CHAPTER, move_id: MOVE, title: "Kept the stories that fit", row_count: message.result_data.rows.length, provenance: "historical-browser" }); course.writeCursor(storage, attempt, { chapter: CHAPTER, move_id: MOVE, mode: "challenge" }); } catch (_) {}
    }
    function showResult(message) {
      el.result.replaceChildren(); const outcome = document.createElement("p"); outcome.className = "run-outcome"; outcome.textContent = runOutcomeStatus(message, saveOk); el.result.append(outcome); const p = document.createElement("p"); p.textContent = text(message.message || message.feedback || "Julia returned a result."); el.result.append(p);
      if (message.original_error) { const details = document.createElement("details"), summary = document.createElement("summary"), original = document.createElement("pre"); summary.textContent = "Original Julia error"; original.textContent = text(message.original_error); details.append(summary, original); el.result.append(details); }
      if (message.explanation) { const explanation = document.createElement("p"); explanation.textContent = `Julia: ${text(message.explanation.julia)} Case: ${text(message.explanation.case)} Limit: ${text(message.explanation.limit)}`; el.result.append(explanation); }
      if (message.status === "ok" && message.result_data && Array.isArray(message.result_data.columns) && Array.isArray(message.result_data.rows)) {
        const heading = document.createElement("h3"), table = document.createElement("table"), head = document.createElement("thead"), body = document.createElement("tbody"), header = document.createElement("tr");
        heading.textContent = "Julia returned this table";
        message.result_data.columns.forEach(column => { const th = document.createElement("th"); th.textContent = text(column); header.append(th); });
        head.append(header);
        message.result_data.rows.forEach(row => { const tr = document.createElement("tr"); message.result_data.columns.forEach(column => { const td = document.createElement("td"); td.textContent = text(row[column]); tr.append(td); }); body.append(tr); });
        table.append(head, body); el.result.append(heading, table);
      }
    }
    function focusResult() { if (el.result) el.result.focus(); }
    function connect(){
      const plan=connectionPlan(location.protocol); clearInfoTimer(); clearRunTimer();
      if(!plan.open_socket) { if (timer) { clearTimeout(timer); timer = null; } state = enterFileUrlRecovery(state); render(); return; }
      if (socket) try { socket.close(); } catch (_) {}
      state = Object.assign({}, state, { connection: "connecting", fileUrlRecovery: false }); render(); socket = new WebSocket(`ws://${location.host}/ws`);
      socket.onopen = () => { state.connection = "connected"; state = beginInfo(state, id("c6-info")); const requestId = state.infoRequest.request_id; send(infoMessage(requestId)); clearInfoTimer(); infoTimer = setTimeout(() => { state = expireInfo(state, requestId); render(); }, INFO_DEADLINE_MS); render(); };
      socket.onmessage = event => {
        let message; try { message = JSON.parse(event.data); } catch (_) { return; }
        const before = state; state = applyCaseInfo(state, message);
        if (state !== before) clearInfoTimer();
        else if (message && message.type === "status") {
          state = applyRunStatus(state, message);
          if (state !== before) { armRunDeadline(state.pending.request_id); render(); }
          return;
        }
        else { state = failCaseInfo(state, message); if (state === before) { state = applyCaseResult(state, message); if (state !== before) { clearRunTimer(); lastRun = state.evidence ? message : { status: message.status, pass: false }; if (state.evidence) { record(message); saveOk = savedMove(course, storage, attempt, CHAPTER, MOVE); } showResult(state.runFailure || message); } } }
        render();
        if (state.runFailure) el.code.focus(); else if (state.result) focusResult();
      };
      socket.onclose = () => { clearInfoTimer(); clearRunTimer(); state = disconnect(state); render(); if (plan.retry && !timer) timer = setTimeout(() => { timer = null; connect(); }, 1500); };
    }
    function focusElement(element) { if (element) element.focus(); }
    el.start.addEventListener("click", () => { el.scene.hidden = true; el.work.hidden = false; connect(); focusElement(el.title); });
    el.back.addEventListener("click", () => { clearRunTimer(); el.work.hidden = true; el.scene.hidden = false; focusElement(el.sceneTitle); });
    el.reconnect.addEventListener("click", connect);
    el.code.addEventListener("input", () => { clearRunTimer(); lastRun = null; persist(); if (el.draft) el.draft.textContent = draftCaption(); });
    el.run.addEventListener("click", () => { persist(); submittedCode = el.code.value; state = beginRun(state, id("c6-run")); if (state.pending) { const requestId = state.pending.request_id; el.result.replaceChildren(); el.visual.replaceChildren(); send(runMessage(el.code.value, requestId)); armRunDeadline(requestId); render(); } });
    el.code.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); el.run.click(); } });
    el.nextHint.addEventListener("click", () => { hint = Math.min(5, hint + 1); render(); });
    // Owner playtest (2026-09-26): the full answer is one visible click away, as in Chapters 2-4; it reuses the
    // hint ladder's own reference display (shown at hint 5) and never enters the editor.
    if (el.showFullAnswer) el.showFullAnswer.addEventListener("click", () => { hint = 5; render(); if (el.answerReference) el.answerReference.scrollIntoView({block:"nearest"}); });
    el.answer.addEventListener("click", () => { hint = 5; render(); });
    window.addEventListener("pagehide", () => { clearInfoTimer(); clearRunTimer(); if (socket) socket.close(); });
    render();
  }

  return { CASE_ID, CHAPTER, MOVE, COPY, completionLine, endingHref, INFO_DEADLINE_MS, RUN_DEADLINE_MS, createState, initialEditorText, challengeRecovery, beginInfo, failCaseInfo, expireInfo, candidateModelCards, applyCaseInfo, beginRun, expireRun, isRunPending, applyRunStatus, applyCaseResult, disconnect, connectionPlan, enterFileUrlRecovery, connectionStatusText, draftNotice, draftStatus, runOutcomeStatus, shouldShowReconnect, infoMessage, runMessage, boardUrl, learningScaffold, caseStatus, caseClosure, cardProbabilityLabel, caseFileRows, boardUpdateLine, rangePracticeStep, visibleHints, preEditorBridge, preEditorBridgeVisible, init };
});

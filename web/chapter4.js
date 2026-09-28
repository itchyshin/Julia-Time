/* Julia Time: Missing Fleas C4. The supplied eligible list and checked rack come from the server. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeChapter4 = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.init);
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const INFO_DEADLINE_MS = 5000;
  const RUN_DEADLINE_MS = 7000;
  const CASE_ID = "missing-fleas-v1", CHAPTER = "C4", MOVE = "plan-distinct-recheck";
  const PRACTICE_JAR_IDS = Object.freeze(["P-11", "P-12", "P-13", "P-14"]);
  const TABLE = Object.freeze({name:"eligible", title:"Eddie's recheck list", role:"The four B09 jars that can still be rechecked, in one column called jar_id. The function sample is ready to use."});
  const COPY = Object.freeze({
    label:"Chapter 4 of 6 · Plan a fair recheck",
    title:"Your step · Pick three different jars by chance",
    question:"How do we choose three of the four jars without picking favourites?",
    returnSpec:"A list of three different jar IDs from Eddie's list.",
    bridge:"Let Julia pick three IDs at random from eligible.jar_id, so every jar on the list has the same chance. Each run may pick a different three; any three different jars are right.",
    planningProtocol:"Let Julia choose three different jar IDs at random, so the plan is fair: every jar on the list has the same chance. Each run may choose a different three, and any three different jars are right.",
    itemBridge:"In Julia, eligible.jar_id is the four B09 jars that can still be rechecked. Open Stuck? Hints below the editor: the idea comes first, then the code shape, where you put the list in place of the word items. Julia's sample can pick the same ID twice unless you add replace=false.",
    concept:"Take the list of jar IDs and draw three at random, with no jar drawn twice. Coming from R? In R you would use sample(); Julia has a sample too, with one extra setting.",
    shape:"sample(items, n; replace=false) picks n items from a list. items is the list, n is how many. The ; starts the named settings, and replace=false means no jar is picked twice.",
    semicolonNote:"The ; separates what to use (before it) from how to do it (after it): before it, the list and how many; after it, a named setting. For example, round(3.14159; digits=2) gives 3.14.",
    solution:"sample(eligible.jar_id, 3; replace=false)",
    syntax:".jar_id reads the visible jar-ID column as a list. The ; starts a named setting; replace=false means the same jar cannot be selected twice.",
    recovery:"Use eligible.jar_id, request 3 IDs, and include replace=false so the plan cannot duplicate a jar.",
    visualTitle:"Recheck jars: planned, not looked at yet"
  });

  function knownMove(move) { return move === MOVE; }
  function activeInputIds(move) { return knownMove(move) ? ["eligible"] : []; }
  function tableIdentity(id) { return id === "eligible" ? Object.assign({}, TABLE) : null; }
  function lessonCopy() { return COPY; }
  // UI-12 (2026-09-24 audit): an R habit gets a line keyed on Julia's own UndefVarError text,
  // in front of the shared recovery copy, as Chapter 1's challengeRecovery does.
  // Night round 1 (2026-09-27, r1-bugs.md bug 2): the sandbox refuses a run that rebinds or edits a
  // supplied input (src/sandbox.jl protected_bindings and each chapter's guarded code), so the checker
  // can compare against the untouched case data. That guard stays; this line gives its real reason,
  // keyed on the sandbox's own text, instead of unrelated advice. It never shows the finished line.
  function protectedInputCoaching(message) {
    const found = String(message && message.status === "error" && message.message || "").match(/The supplied (\w+) (binding|records|values) changed/);
    if (!found) return "";
    const name = found[1];
    const how = found[2] === "binding" ? "gives " + name + " a new value (" + name + " = …)" : "changes " + name + ", by giving it a new value or by editing it";
    return "Your code " + how + ". This step needs " + name + " kept exactly as it was supplied, so the check stopped. Your idea may still be right: leave " + name + " as it is and let the last line return your result, or give the result a new name, such as result = …, and end with result.";
  }
  // v0.2.5 night (fixer I1): the server's "coaching" line names the mistake it read from the code
  // (src/mystery_c2.jl .. mystery_c6.jl). It is "" when there is none, and never used on a passing run.
  function serverCoaching(message) {
    return message && message.pass !== true && typeof message.coaching === "string" ? message.coaching.trim() : "";
  }
  // Round 6 (r6-audit #10): after a server coaching line, the same ending as C1, C5 and C6. The
  // coaching line may name no line of code, so it never ends with "Change that line".
  function coachingWithEnding(message) {
    const coaching = serverCoaching(message);
    if (!coaching) return "";
    return coaching + (message.status === "error" ? " Change your code, then run again, or open Stuck? Hints below." : " Your draft is still here. Change it and run again, or open Stuck? Hints below.");
  }
  function finishedRecovery(message) {
    return coachingWithEnding(message) || (message && message.feedback) || recoveryCopy(message);
  }
  function recoveryCopy(message) {
    const coached = coachingWithEnding(message);
    if (coached) return coached;
    const guarded = protectedInputCoaching(message);
    if (guarded) return guarded;
    const text = message && message.status === "error" ? String(message.message || "") : "";
    const rName = text.match(/UndefVarError: `(FALSE|TRUE)`/);
    if (rName) return rName[1]+" is R's spelling. Julia writes "+rName[1].toLowerCase()+" in lower case. "+COPY.recovery;
    if (/UndefVarError: `\$` not defined/.test(text)) return "R's $ does not exist in Julia: write eligible.jar_id, not eligible$jar_id. "+COPY.recovery;
    return COPY.recovery;
  }
  function distinctPracticeResult(selected) {
    const picks = Array.isArray(selected) ? selected : [];
    if (picks.length !== 3) return {accepted:false, message:"Choose exactly three practice jars."};
    const duplicate = picks.find((id, index) => picks.indexOf(id) !== index);
    if (duplicate) return {accepted:false, message:String(duplicate)+" was chosen twice. Pick three different jars before you move on."};
    if (!picks.every(id => PRACTICE_JAR_IDS.includes(id))) return {accepted:false, message:"Choose jars from the displayed practice rack."};
    return {accepted:true, message:"Three different practice jar IDs selected. That is the rule replace=false expresses."};
  }
  function needsRecoveryFocus(message) { return Boolean(message && (message.status === "error" || message.status === "timeout")); }
  // Round 6 (r6-rc #10): the run status and the result already open with "Not yet", so the note
  // under the editor says only what the editor now holds.
  function draftStatus(message) {
    if (!message || message.status === "timeout") return "Your code took too long, so the lab stopped it. Your code is still here.";
    if (message.status === "ok" && message.pass === true) return "Julia checked it: that's right. You can change it and run again.";
    return "This is your code from the last run.";
  }
  function draftNotice(hasCode, restored) {
    if (!hasCode) return "This editor starts empty. Write your own Julia code.";
    return restored ? "Restored your saved draft: it is your earlier typing, not supplied code." : "This is your own unrun draft for this step.";
  }
  const NOT_SAVED_STATUS = "Right answer, but this computer could not save it, so the Case Board will not show it. Run it once more; if this keeps happening, ask your helper.";
  // Ask the saved record itself, never the write call: a write can fail silently (blocked storage, a damaged record).
  function savedMove(courseState, storage, attempt, chapter, moveId) { try { return Boolean(storage && courseState && typeof courseState.hasSavedMove === "function" && courseState.hasSavedMove(storage, attempt, chapter, moveId)); } catch (_) { return false; } }
  function runOutcomeStatus(message, saved) {
    if (!message) return "";
    if (message.status === "ok" && message.pass === true) return saved === false ? NOT_SAVED_STATUS : "Julia checked it: that's right.";
    if (message.status === "timeout") return "Not yet. Your code took too long, so the lab stopped it.";
    if (message.status === "error") return "Not yet. Julia could not run this code.";
    return "Not yet. Julia ran your code; the result below is not quite what we need.";
  }
  function fullAnswerReference() { return "Full answer (for reference only; it does not go into your editor): " + COPY.solution; }
  function helpStage(_move, index) {
    return [
      {label:"Idea", text:COPY.concept, button:"Show the code shape"},
      {label:"Code shape", text:COPY.shape, note:COPY.semicolonNote, button:"Show the whole line"},
      {label:"Full answer", text:COPY.solution, button:"All help shown"}
    ][index] || null;
  }
  function validAttempt(value) { return /^[a-z0-9-]{1,80}$/.test(value || ""); }
  function caseBoardUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "course/index.html" + (validAttempt(attempt) ? "?attempt="+encodeURIComponent(attempt) : ""); }
  function nextChapterUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "chapter5.html" + (validAttempt(attempt) ? "?attempt="+encodeURIComponent(attempt) : ""); }
  function envelope(id) { return {case_id:CASE_ID, chapter:CHAPTER, move_id:MOVE, mode:"challenge", activity_id:null, simulation_id:null, request_id:id}; }
  function createState() { return {connection:"connecting", activeMove:MOVE, infoRequest:null, pending:null, expired:false, statusMessage:null, metadata:null, metadataFailure:"", result:null, evidence:null}; }
  function beginInfo(state, requestId, moveId) { if (!knownMove(moveId)) return state; return Object.assign({}, state, {activeMove:MOVE, infoRequest:envelope(requestId), pending:null, expired:false, statusMessage:null, metadata:null, metadataFailure:"", result:null}); }
  function failCaseInfo(state, message) {
    if (!state.infoRequest || !message || message.type !== "error") return state;
    const unknown = /unknown mystery chapter/i.test(String(message.message || ""));
    return Object.assign({}, state, {infoRequest:null, metadata:null, metadataFailure:unknown ? "The local lab does not recognise this chapter. Restart Julia Time, then reload this page. Your draft is still here." : "The chapter inputs are unavailable. Restart Julia Time, then reload this page. Your draft is still here."});
  }
  function expireInfo(state, requestId) { if (!state.infoRequest || state.infoRequest.request_id !== requestId) return state; return Object.assign({}, state, {infoRequest:null, metadata:null, metadataFailure:"The supplied eligible list took too long to arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here."}); }
  function beginRun(state, requestId, moveId) { return knownMove(moveId) ? Object.assign({}, state, {pending:envelope(requestId), expired:false, statusMessage:null, result:null}) : state; }
  // `pending` is kept (not nulled) on expiry so a correct result arriving late for this same
  // request is still applied rather than discarded (B1); `isRunPending` makes the run retryable.
  function expireRun(state, requestId) { if (!state.pending || state.pending.request_id !== requestId) return state; return Object.assign({}, state, {expired:true, statusMessage:null, result:{type:"case_result", status:"timeout", message:"This check took too long. Check your code, then run again."}}); }
  function cancelRun(state) { return Object.assign({}, state, {pending:null, expired:false, statusMessage:null, result:null}); }
  function isRunPending(state) { return Boolean(state.pending) && !state.expired; }
  function applyRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.pending || state.expired || message.request_id !== state.pending.request_id) return state;
    return Object.assign({}, state, {statusMessage: message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : ""});
  }
  function disconnect(state) { return Object.assign({}, state, {connection:"offline", infoRequest:null, pending:null, expired:false, statusMessage:null}); }
  function validTableInput(input) { return Boolean(input && input.id === "eligible" && Array.isArray(input.columns) && input.columns.length === 1 && input.columns[0] === "jar_id" && Array.isArray(input.rows) && input.rows.length >= 3 && input.rows.every(row => row && typeof row.jar_id === "string" && row.jar_id.length > 0)); }
  function sameCaseIdentity(message, expected) { return Boolean(message && expected && message.contract_version === 1 && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id && message.request_id === expected.request_id); }
  function applyCaseInfo(state, message) { if (!state.infoRequest || !message || message.type !== "case" || !sameCaseIdentity(message, state.infoRequest) || !Array.isArray(message.inputs) || message.inputs.length !== 1 || !validTableInput(message.inputs[0])) return state; return Object.assign({}, state, {infoRequest:null, metadata:message, metadataFailure:""}); }
  function planRows(payload) { if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.rows) || payload.columns.length !== 1 || payload.columns[0] !== "jar_id" || payload.rows.length !== 3) return null; const rows = payload.rows.map(row => ({jar_id:row && row.jar_id})); return rows.every(row => typeof row.jar_id === "string" && row.jar_id.length > 0) && new Set(rows.map(row => row.jar_id)).size === 3 ? rows : null; }
  function visualData(move, payload) { const rows = knownMove(move) ? planRows(payload) : null; return rows ? {kind:"planned-recheck-rack", rows} : null; }
  function applyCaseResult(state, message) { if (!state.pending || !message || message.type !== "case_result" || !sameCaseIdentity(message, state.pending)) return state; const visual = message.status === "ok" && message.pass === true && message.progress_eligible === true ? visualData(MOVE, message) : null; return Object.assign({}, state, {pending:null, expired:false, statusMessage:null, result:message, evidence:visual ? {move_id:MOVE, columns:message.columns.slice(), rows:message.rows.map(row => Object.assign({}, row)), visual} : state.evidence}); }
  function isAcceptedChallengeResult(result) { return Boolean(result && result.type === "case_result" && result.contract_version === 1 && result.case_id === CASE_ID && result.chapter === CHAPTER && result.move_id === MOVE && result.mode === "challenge" && result.activity_id === null && result.simulation_id === null && result.status === "ok" && result.pass === true && result.progress_eligible === true && visualData(MOVE, result)); }
  function nextDestination(move, result) { return knownMove(move) && isAcceptedChallengeResult(result) ? "chapter5" : null; }
  function shouldRenderCaseVisual(result) { return isAcceptedChallengeResult(result); }
  function persistChallengeDraft(courseState, storage, attempt, move, code) { if (!courseState || typeof courseState.writeChallengeDraft !== "function" || !knownMove(move) || typeof code !== "string") return false; try { return courseState.writeChallengeDraft(storage, attempt, CHAPTER, MOVE, code) === true; } catch (_) { return false; } }
  function persistAcceptedCourseResult(courseState, storage, attempt, result) { if (!isAcceptedChallengeResult(result) || !courseState || typeof courseState.recordHistoricalMoveIfMissing !== "function" || typeof courseState.writeEvidenceIfMissing !== "function" || typeof courseState.writeCursor !== "function") return false; try { const jarIds = result.rows.map(row => row.jar_id); courseState.recordHistoricalMoveIfMissing(storage, attempt, CHAPTER, MOVE); if (typeof courseState.refreshAcceptedCode === "function") courseState.refreshAcceptedCode(storage, attempt, CHAPTER, MOVE); courseState.writeEvidenceIfMissing(storage, attempt, {chapter:CHAPTER, move_id:MOVE, title:"Three distinct rechecks planned", row_count:result.rows.length, jar_ids:jarIds, provenance:"historical-browser"}); /* r3 bug hunt #3: the latest accepted draw is the one the Case Board and ending name. */ if (typeof courseState.updateEvidenceJarIds === "function") courseState.updateEvidenceJarIds(storage, attempt, CHAPTER, MOVE, jarIds); courseState.writeCursor(storage, attempt, {chapter:"C5", move_id:"event-mask", mode:"challenge"}); return true; } catch (_) { return false; } }
  function requestId(prefix) { return (prefix || "c4")+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2, 9); }
  function infoMessage(id) { return Object.assign({type:"case_info", contract_version:1}, envelope(id)); }
  function runMessage(code, id) { return Object.assign({type:"case_run", contract_version:1}, envelope(id), {code}); }
  function safeText(value) { return value == null ? "" : typeof value === "object" ? (value.display == null ? JSON.stringify(value) : String(value.display)) : String(value); }

  function init() {
    const $ = id => document.getElementById(id);
    const el = {sceneNext:$("scene-next"), scene:$("scene"), investigation:$("investigation"), start:$("start-investigation"), back:$("back-to-scene"), board:$("case-board"), location:$("course-location"), reconnect:$("reconnect"), connection:$("connection"), title:$("move-title"), question:$("move-question"), bridge:$("move-bridge"), returnSpec:$("return-spec"), inputs:$("visible-inputs"), bindings:$("case-bindings"), answerReference:$("answer-before-editor"), code:$("code"), draft:$("draft-note"), run:$("run"), status:$("run-status"), result:$("result"), visual:$("returned-visual"), next:$("next-move"), help:$("help-list"), nextHelp:$("next-help"), showAnswer:$("show-answer"), bridgeCard:$("bridge-card")};
    let storage = null; try { storage = localStorage; } catch (_) {}
    const courseState = typeof window !== "undefined" ? window.JuliaTimeCourseState : null;
    const bridges = typeof window !== "undefined" ? window.JuliaTimeBridges : null;
    let submittedCode = "";
    const requestedAttempt = new URLSearchParams(location.search).get("attempt"), attempt = validAttempt(requestedAttempt) ? requestedAttempt : "";
    let state = createState(), socket = null, timer = null, runTimer = null, infoTimer = null, reconnects = 0, stopped = false, hint = 0, saveOk = true;
    let draft = "", restoredDraft = false, practiceSelection = [], practiceFeedback = "";
    try { const saved = courseState && typeof courseState.readChallengeDrafts === "function" ? courseState.readChallengeDrafts(storage, attempt) : {}; draft = saved && typeof saved["C4/"+MOVE] === "string" ? saved["C4/"+MOVE] : ""; restoredDraft = draft.length > 0; } catch (_) {}
    if (el.board) el.board.href = caseBoardUrl(location.search);
    function clear() { el.result.replaceChildren(); el.visual.replaceChildren(); el.next.hidden = !savedMove(courseState, storage, attempt, CHAPTER, MOVE); }
    function clearRunTimer() { if (runTimer) { clearTimeout(runTimer); runTimer = null; } }
    function armRunDeadline(id) { clearRunTimer(); runTimer = setTimeout(() => { const before = state; state = expireRun(state, id); if (before === state) return; renderResult(state.result); update(); el.code.focus(); }, RUN_DEADLINE_MS); }
    function clearInfoTimer() { if (infoTimer) { clearTimeout(infoTimer); infoTimer = null; } }
    /* r5 (2026-09-27): while Julia runs, Run stays focusable and reads as busy (aria-disabled), so keyboard focus is not dropped to the page. */ function holdRun(button, blocked, busy) { if (!button) return; button.disabled = blocked; if (busy && !blocked) button.setAttribute("aria-disabled", "true"); else button.removeAttribute("aria-disabled"); } function update() { const busy = isRunPending(state); holdRun(el.run, state.connection !== "connected" || !state.metadata, busy); el.status.textContent = busy ? (state.statusMessage || "Checking your Julia result…") : state.metadataFailure || (state.result ? runOutcomeStatus(state.result, saveOk) : (state.connection === "connected" ? (state.metadata ? "Julia is ready" : "Loading the supplied eligible list…") : "Connect to the lab to run Julia")); el.reconnect.hidden = !state.metadataFailure && (state.connection === "connected" || state.connection === "connecting"); }
    function table(input) { const section = document.createElement("section"), h = document.createElement("h3"), p = document.createElement("p"), wrap = document.createElement("div"), t = document.createElement("table"), thead = document.createElement("thead"), head = document.createElement("tr"), body = document.createElement("tbody"); section.className = "input-table"; h.textContent = input.id === "eligible" ? TABLE.title : input.label || "Actual returned result"; p.className = "data-label"; if (input.id === "eligible") { p.append("Julia name: "); const c = document.createElement("code"); c.textContent = "eligible"; p.append(c, ": " + TABLE.role + "."); } else { p.append("Returned by Julia from your code."); } input.columns.forEach(column => { const th = document.createElement("th"); th.textContent = column; head.append(th); }); thead.append(head); input.rows.forEach(row => { const tr = document.createElement("tr"); input.columns.forEach(column => { const td = document.createElement("td"); td.textContent = safeText(row[column]); tr.append(td); }); body.append(tr); }); t.append(thead, body); wrap.className = "table-wrap"; wrap.tabIndex = 0; wrap.append(t); section.append(h, p, wrap); return section; }
    function renderPractice() { const panel = $("distinct-practice"), rack = $("practice-jar-rack"), selection = $("practice-selection"), check = $("practice-check"), result = $("practice-result"); if (!panel || !rack || !selection || !check || !result) return; panel.hidden = !state.metadata; if (!state.metadata) return; rack.replaceChildren(); PRACTICE_JAR_IDS.forEach(id => { const picked = practiceSelection.includes(id), button = document.createElement("button"); button.type = "button"; button.className = "quiet"; button.textContent = id; button.setAttribute("aria-pressed", picked ? "true" : "false"); button.disabled = !picked && practiceSelection.length >= 3; button.addEventListener("click", () => { practiceSelection = picked ? practiceSelection.filter(value => value !== id) : practiceSelection.concat(id); practiceFeedback = ""; renderPractice(); }); rack.append(button); }); selection.textContent = practiceSelection.length ? "Practice plan: "+practiceSelection.join(", ")+"." : "Choose three cards. The cards are practice data, not Missing Fleas evidence."; result.textContent = practiceFeedback; check.onclick = () => { practiceFeedback = distinctPracticeResult(practiceSelection).message; renderPractice(); }; }
    function renderInputs(metadata) { el.inputs.replaceChildren(); const eyebrow = document.createElement("p"), h = document.createElement("h2"), note = document.createElement("p"); eyebrow.className = "eyebrow"; eyebrow.textContent = "From Eddie"; h.textContent = "The eligible list for this plan"; note.textContent = "These are the B09 jars that can still be rechecked. Nothing on this list is a new springtail count."; el.inputs.append(eyebrow, h, note, ...metadata.inputs.map(table)); el.bindings.replaceChildren(); const strong = document.createElement("strong"); strong.textContent = "Use this exact Julia name in your editor"; const p = document.createElement("p"), c = document.createElement("code"), protocol = document.createElement("p"), bridge = document.createElement("p"); c.textContent = "eligible"; p.append(c, ": supplied table with column jar_id. sample is ready to use."); protocol.textContent = COPY.planningProtocol; bridge.textContent = COPY.itemBridge; el.bindings.append(strong, p, protocol, bridge); renderPractice(); }
    function renderMove() { el.location.textContent = COPY.label; el.title.textContent = COPY.title; el.question.textContent = COPY.question; el.bridge.textContent = COPY.bridge; el.returnSpec.textContent = COPY.returnSpec; if (bridges) bridges.renderCard(el.bridgeCard, "C4/"+MOVE, submittedCode); el.code.value = draft; el.draft.textContent = draftNotice(Boolean(draft), restoredDraft); el.answerReference.hidden = true; el.answerReference.replaceChildren(); el.help.replaceChildren(); el.nextHelp.textContent = "Show the idea"; el.nextHelp.disabled = false; el.showAnswer.hidden = false; hint = 0; clear(); el.inputs.textContent = "Waiting for the lab to supply the eligible list and column name…"; el.bindings.textContent = "Loading the exact Julia name for this case input…"; update(); }
    function appendReturned(message) { if (!Array.isArray(message.columns) || !Array.isArray(message.rows) || !message.columns.length) return; el.result.append(table({id:"returned", label:"Actual returned result", columns:message.columns, rows:message.rows})); }
    function renderVisual(message) { el.visual.replaceChildren(); const visual = visualData(MOVE, message); if (!visual) return; const section = document.createElement("section"), h = document.createElement("h2"); section.className = "returned-card"; h.textContent = COPY.visualTitle; section.append(h); visual.rows.forEach(row => { const card = document.createElement("article"), title = document.createElement("h3"), line = document.createElement("p"); title.textContent = row.jar_id; line.textContent = "Planned to recheck; no observation is shown."; card.append(title, line); section.append(card); }); const note = document.createElement("p"); note.className = "caution"; note.textContent = "A plan finds nothing yet; the jars still have to be looked at. " + (savedMove(courseState, storage, attempt, "C3", "filter-disagreement") ? "Part 1 done. " : "") + "Part 2 has begun: a fair recheck is planned, and one check is left for today."; section.append(note); el.visual.append(section); }
    function renderResult(message) { el.result.replaceChildren(); el.draft.textContent = draftStatus(message); const outcome = document.createElement("p"); outcome.className = "run-outcome"; outcome.textContent = runOutcomeStatus(message, saveOk); el.result.append(outcome); const p = document.createElement("p"); if (message.status === "error") p.textContent = recoveryCopy(message); else if (message.status === "timeout") p.textContent = "Julia stopped your code because it ran too long. A loop that never ends is the usual cause. Change your code, then run again."; else if (message.pass === true) p.textContent = message.feedback || "Three different jars from the list."; else p.textContent = finishedRecovery(message); el.result.append(p); if (message.status === "error" && message.message) { const details = document.createElement("details"), summary = document.createElement("summary"), original = document.createElement("pre"); summary.textContent = "Original Julia error"; original.textContent = safeText(message.message); details.append(summary, original); el.result.append(details); } if (message.explanation && typeof message.explanation === "object") (message.status === "ok" && message.pass === true ? [message.explanation.julia, message.explanation.case, message.explanation.limit, message.explanation.reminder] : [message.explanation.julia, message.explanation.reminder]).filter(Boolean).forEach(text => { const item = document.createElement("p"); item.textContent = String(text); el.result.append(item); }); if (message.status === "ok") appendReturned(message); if (shouldRenderCaseVisual(message)) renderVisual(message); if (nextDestination(MOVE, message)) { el.next.hidden = false; el.next.textContent = "Chapter 5: what would plain chance give? →"; } }
    function focusResult() { if (el.result) el.result.focus(); }
    function requestInfo() { if (!socket || socket.readyState !== WebSocket.OPEN) return; const id = requestId("info"); state = beginInfo(state, id, MOVE); socket.send(JSON.stringify(infoMessage(id))); clearInfoTimer(); infoTimer = setTimeout(() => { const before = state; state = expireInfo(state, id); if (state === before) return; el.inputs.textContent = state.metadataFailure; el.bindings.textContent = "Your draft is safe. Reconnect or restart Julia Time, then reload this page."; update(); }, INFO_DEADLINE_MS); update(); }
    function sendRun() { if (!socket || socket.readyState !== WebSocket.OPEN || !state.metadata || isRunPending(state)) return; const id = requestId("run"); state = beginRun(state, id, MOVE); armRunDeadline(id); submittedCode = el.code.value; socket.send(JSON.stringify(runMessage(el.code.value, id))); clear(); el.result.textContent = "Julia is checking your code…"; update(); }
    function handle(message) { if (!message || typeof message !== "object") return; if (message.type === "case") { const before = state; state = applyCaseInfo(state, message); if (before !== state) { clearInfoTimer(); renderInputs(state.metadata); update(); } return; } if (message.type === "error") { const before = state; state = failCaseInfo(state, message); if (before !== state) { clearInfoTimer(); el.inputs.textContent = state.metadataFailure; el.bindings.textContent = "Your draft is safe. Reconnect or restart Julia Time, then reload this page."; update(); } return; } if (message.type === "status") { const before = state; state = applyRunStatus(state, message); if (before === state) return; armRunDeadline(state.pending.request_id); update(); return; } if (message.type === "case_result") { const before = state; state = applyCaseResult(state, message); if (before === state) return; clearRunTimer(); if (state.evidence !== before.evidence && isAcceptedChallengeResult(state.result)) { persistAcceptedCourseResult(courseState, storage, attempt, state.result); saveOk = savedMove(courseState, storage, attempt, CHAPTER, MOVE); if (bridges) bridges.renderCard(el.bridgeCard, "C4/"+MOVE, submittedCode); } renderResult(state.result); update(); if (needsRecoveryFocus(state.result)) setTimeout(() => el.code.focus(), 0); else focusResult(); } }
    function retry() { if (stopped) return; clearInfoTimer(); clearRunTimer(); state = disconnect(state); update(); if (++reconnects > 3) { el.connection.textContent = "Julia is offline: your draft is still here."; return; } el.connection.textContent = "Connection to Julia lost. Reconnecting…"; timer = setTimeout(connect, 900*reconnects); }
    function connect() { if (stopped) return; clearTimeout(timer); clearInfoTimer(); if (location.protocol === "file:") { state = disconnect(state); el.connection.textContent = "Start the Julia server, then open the local server address shown by the launcher (usually http://127.0.0.1:8000) to run this case."; update(); return; } const old = socket; socket = null; if (old) old.close(); state = Object.assign({}, disconnect(state), {connection:"connecting"}); el.connection.textContent = "Connecting to the lab…"; update(); try { socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://")+location.host+"/ws"); } catch (_) { retry(); return; } const ws = socket; ws.addEventListener("open", () => { if (socket !== ws) return; reconnects = 0; state = Object.assign({}, state, {connection:"connected"}); el.connection.textContent = "Julia is ready"; requestInfo(); update(); }); ws.addEventListener("message", event => { if (socket !== ws) return; try { handle(JSON.parse(event.data)); } catch (_) {} }); ws.addEventListener("close", () => { if (socket === ws) retry(); }); }
    /* Round 6 (r6-rc #5): a chapter solved on an earlier run still offers the way on to Chapter 5. */ el.next.hidden = !savedMove(courseState, storage, attempt, CHAPTER, MOVE); /* Round 8 (r8-rc #3): and on the story scene too. */ if (el.sceneNext) { el.sceneNext.hidden = !savedMove(courseState, storage, attempt, CHAPTER, MOVE); el.sceneNext.addEventListener("click", () => { window.location.assign(nextChapterUrl(location.search)); }); }
    renderMove(); el.start.addEventListener("click", () => { el.scene.hidden = true; el.investigation.hidden = false; el.title.focus(); }); el.back.addEventListener("click", () => { draft = el.code.value; clearInfoTimer(); clearRunTimer(); state = cancelRun(state); clear(); el.investigation.hidden = true; el.scene.hidden = false; $("chapter-title").focus(); }); el.run.addEventListener("click", sendRun); el.next.addEventListener("click", () => { window.location.assign(nextChapterUrl(location.search)); }); el.reconnect.addEventListener("click", () => { reconnects = 0; connect(); }); el.code.addEventListener("input", () => { clearRunTimer(); draft = el.code.value; restoredDraft = false; persistChallengeDraft(courseState, storage, attempt, MOVE, draft); state = cancelRun(state); clear(); el.draft.textContent = draftNotice(Boolean(draft), false); update(); }); el.code.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); sendRun(); } }); function focusShown(target) { if (!target || target.hidden) return; target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:"nearest"}); } /* r5 (2026-09-27): a new hint is added above the button, so scroll both into view; the focused button stays on screen. It runs again after 100 ms because code-names.js marks up the hint's code names 50 ms later, which moves the button. */ function keepHintInView(hint, button) { const show = () => { if (hint) hint.scrollIntoView({block:"nearest"}); if (button && !button.disabled) button.scrollIntoView({block:"nearest"}); }; show(); setTimeout(show, 100); } function showHelp(last) { const wasDone = !helpStage(MOVE, hint); let added = null; while (hint <= last) { const stage = helpStage(MOVE, hint); if (!stage) break; if (stage.label === "Full answer") { const label = document.createElement("p"), code = document.createElement("pre"); label.textContent = "Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns. It does not count as a saved answer until Julia checks it."; code.className = "complete-answer-code"; code.textContent = COPY.solution; el.answerReference.replaceChildren(label, code); el.answerReference.hidden = false; } else { const p = document.createElement("p"), strong = document.createElement("strong"); strong.textContent = stage.label+": "; p.append(strong, document.createTextNode(stage.text)); el.help.append(p); added = p; if (stage.note) { const n = document.createElement("p"); n.textContent = stage.note; el.help.append(n); } } hint += 1; el.nextHelp.textContent = stage.button; } const done = !helpStage(MOVE, hint); el.nextHelp.disabled = done; el.showAnswer.hidden = done; /* r4 (2026-09-27): the focused button is now disabled or hidden, so focus moves to the answer. */ if (done && !wasDone) focusShown(el.answerReference); else keepHintInView(added, el.nextHelp); } el.nextHelp.addEventListener("click", () => showHelp(hint)); el.showAnswer.addEventListener("click", () => showHelp(2)); window.addEventListener("pagehide", () => { stopped = true; clearInfoTimer(); clearRunTimer(); clearTimeout(timer); if (socket) socket.close(); }); connect();
  }

  return {CASE_ID, CHAPTER, INFO_DEADLINE_MS, RUN_DEADLINE_MS, PRACTICE_JAR_IDS, knownMove, activeInputIds, tableIdentity, lessonCopy, recoveryCopy, finishedRecovery, distinctPracticeResult, helpStage, needsRecoveryFocus, draftStatus, draftNotice, runOutcomeStatus, fullAnswerReference, caseBoardUrl, nextChapterUrl, nextDestination, createState, beginInfo, failCaseInfo, expireInfo, beginRun, expireRun, cancelRun, isRunPending, applyRunStatus, disconnect, applyCaseInfo, applyCaseResult, visualData, isAcceptedChallengeResult, shouldRenderCaseVisual, persistChallengeDraft, persistAcceptedCourseResult, infoMessage, runMessage, requestId, init};
});

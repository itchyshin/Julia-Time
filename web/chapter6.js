/* Julia Time: Missing Fleas C6. Candidate data and checked conclusions stay server-side. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeChapter6 = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.init);
})(typeof window !== "undefined" ? window : null, function() {
  "use strict";

  const CASE_ID = "missing-fleas-v1";
  const CHAPTER = "C6";
  const MOVE = "compatible-models";
  const COLUMNS = ["model", "p", "lower", "upper"];
  const FILE_URL_RECOVERY_MESSAGE = "This page was opened directly. Start run.jl, then open http://127.0.0.1:8000 to run Chapter 6.";
  const INFO_DEADLINE_MS = 5000;
  const RUN_DEADLINE_MS = 7000;
  const COPY = {
    concept: "A candidate is compatible here only when its displayed range contains the observed count. This is a stated range rule, not a ranking.",
    shape: "table[row_rule, :]",
    range_rule: "Template only — not code to run yet: row_rule = (lower_bound .<= target) .& (target .<= upper_bound). .<= compares the target with every displayed bound; .& keeps true only when both bound checks are true.",
    selection: "Template only — not code to run yet: table[row_rule, :]. Put the yes/no row rule before the comma; : means keep all columns.",
    solution: "candidate_models[(candidate_models.lower .<= observed_count) .& (observed_count .<= candidate_models.upper), :]",
    syntax: "Read this before you write: .<= compares every row; .& keeps a row only when both comparisons are true; and [rows, :] means use a row rule, then keep all columns."
  };

  function initialEditorText() { return ""; }
  function challengeRecovery() {
    return "That result did not meet the stated check. Your draft is still here. Use the paired-comparisons cue above, revise it, and run again.";
  }
  function id(prefix) { return (prefix || "c6") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function validAttempt(value) { return /^[a-z0-9-]{1,80}$/.test(value || ""); }
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
    return { connection: "idle", infoRequest: null, pending: null, metadata: null, result: null, evidence: null, fileUrlRecovery: false, metadataFailure: "", runFailure: null };
  }
  function beginInfo(state, request_id) {
    return Object.assign({}, state, { infoRequest: envelope(request_id), pending: null, metadata: null, result: null, evidence: null, metadataFailure: "", runFailure: null });
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
      metadataFailure: "The candidate table took too long to arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here."
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
      input && input.id === "candidate_models" && sameColumns(input.columns, COLUMNS) &&
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
  function applyCaseInfo(state, message) {
    if (!state.infoRequest || !message || message.type !== "case" || !same(message, state.infoRequest) || !validInfo(message)) return state;
    return Object.assign({}, state, { infoRequest: null, metadata: message, metadataFailure: "" });
  }
  function beginRun(state, request_id) {
    return state.metadata ? Object.assign({}, state, { pending: envelope(request_id), result: null, evidence: null, runFailure: null }) : state;
  }
  function expireRun(state, request_id) {
    if (!state.pending || state.pending.request_id !== request_id) return state;
    return Object.assign({}, state, { pending: null, runFailure: { status: "timeout", message: "This check took too long. Your draft is still here; check it, then run again." } });
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
  function applyCaseResult(state, message) {
    if (!state.pending || !message || message.type !== "case_result" || !same(message, state.pending)) return state;
    const accepted = message.status === "ok" && message.pass === true && message.progress_eligible === true && validResult(state.metadata, message);
    return Object.assign({}, state, { pending: null, result: message, evidence: accepted ? { move_id: MOVE, result_data: message.result_data } : null, runFailure: accepted ? null : { status: "rejected", message: challengeRecovery() } });
  }
  function disconnect(state) { return Object.assign({}, state, { connection: "offline", infoRequest: null, pending: null }); }
  function connectionPlan(protocol) {
    return protocol === "file:" ? { open_socket: false, retry: false, message: FILE_URL_RECOVERY_MESSAGE } : { open_socket: true, retry: true, message: null };
  }
  function enterFileUrlRecovery(state) { return Object.assign({}, disconnect(state), { fileUrlRecovery: true }); }
  function connectionStatusText(state) {
    return state.fileUrlRecovery ? FILE_URL_RECOVERY_MESSAGE : state.runFailure ? "Your code is ready to revise." : state.metadataFailure ? state.metadataFailure : state.pending ? "Checking your Julia result…" : state.connection === "idle" ? "Open the evidence board to load the candidate models." : state.connection === "connected" ? (state.metadata ? "Lab file ready" : "Loading candidate models…") : "Connecting to the lab…";
  }
  function shouldShowReconnect(state) { return !state.fileUrlRecovery && (Boolean(state.metadataFailure) || (state.connection !== "connected" && state.connection !== "connecting" && state.connection !== "idle")); }
  function infoMessage(request_id) { return Object.assign({ type: "case_info", contract_version: 1 }, envelope(request_id)); }
  function runMessage(code, request_id) { return Object.assign({ type: "case_run", contract_version: 1, code }, envelope(request_id)); }

  function learningScaffold(metadata) {
    const observed = metadata.observed_count;
    return {
      why: "Chapter 5 asked whether the B09 count was surprising under one small model. Here, we compare the displayed model ranges: which could still contain the count we actually observed?",
      observation: `The observed B09 count is ${observed}. In each row, p is that model's chance of a detection in one single jar. The lower and upper values are a supplied central range of six-jar counts for that model, not every count it could possibly produce. A range containing ${observed} does not make that model true; it only means this observation does not rule it out under this stated check.`,
      practice_stays: "Different practice model: its displayed range is 1 to 4 and its practice observation is 3. 1 ≤ 3 ≤ 4 is true, so that practice row stays.",
      practice_fails: "Different practice model: its displayed range is 0 to 2 and its practice observation is 3. 0 ≤ 3 ≤ 2 is false, so that practice row is left out.",
      bridge: "That was practice data. Now make the same yes/no check on the named candidate_models table above. If the symbols are new, open Help me start: it introduces .lower and .upper, .<=, .&, and [rows, :] before the full answer."
    };
  }

  function caseStatus(metadata) {
    if (!validInfo(metadata)) return null;
    return {
      established:`Established in the case: the report and handling log disagree for tray T-C. The observed B09 count is ${metadata.observed_count}.`,
      unknown:"Still unknown: that recording difference does not establish a biological cause, and compatibility does not make any candidate model true.",
      why_now:"Why this move now: compare the stated ranges so we can retain only the candidate models whose displayed predictions could still contain the observed count."
    };
  }

  function caseClosure(metadata, resultData) {
    if (!validInfo(metadata) || !validResult(metadata, {result_data:resultData})) return null;
    const models = resultData.rows.map(row => row.model).join(", ");
    return {
      title:"Case closed for today — a careful conclusion",
      conclusion:"The disputed B09 records do not justify saying the fleas vanished: the report and handling log disagree, so the next responsible action is a reproducible recheck.",
      findings:[
        `The observed B09 count is ${metadata.observed_count}; it is a record, not a biological verdict.`,
        "The report and handling log disagree for tray T-C.",
        `Your range check retained these displayed candidate rows: ${models}.`
      ],
      next:"The planned recheck is the next thing that could distinguish them: collect a new observation rather than assume its outcome.",
      limit:"Compatible candidates are not true or ranked explanations, and this check does not choose a cause."
    };
  }

  function rangePracticeStep(stage) {
    return [
      { label:"Check the lower bounds", result:"Both practice rows pass the lower-bound check: 1 ≤ 3 and 0 ≤ 3 are true.", next:"Now check the upper bounds →" },
      { label:"Check the upper bounds", result:"Only the first practice row passes the upper-bound check: 3 ≤ 4 is true, but 3 ≤ 2 is false.", next:"Combine both checks →" },
      { label:"Combine both checks", result:"Both checks must be true. The 1–4 practice range stays; the 0–2 range is left out.", next:null }
    ][Math.max(0, Math.min(2, Number.isInteger(stage) ? stage : 0))];
  }

  function preEditorBridge() {
    return {
      lead: "Build the two yes-or-no checks before you write the case version:",
      firstCheck: "Start with the named lower-bound check: candidate_models.lower .<= observed_count. This returns one true-or-false value per candidate model. Then add the upper-bound check and combine them.",
      shape: "row_rule = (lower_bound .<= target) .& (target .<= upper_bound)\ntable[row_rule, :]",
      explanation: "Replace the generic names with the named case inputs above. This is a code shape, not the case answer."
    };
  }

  function init() {
    const $ = id => document.getElementById(id);
    const el = { scene: $("scene"), work: $("work"), start: $("start"), back: $("back"), board: $("case-board"), sceneBoard: $("case-board-scene"), sceneTitle: $("scene-title"), title: $("move-title"), reconnect: $("reconnect"), status: $("status"), observed: $("observed"), modelCards: $("candidate-model-cards"), data: $("data"), scaffold: $("learning-scaffold"), caseStatus: $("case-status"), preEditorBridge: $("pre-editor-bridge"), code: $("code"), run: $("run"), result: $("result"), visual: $("visual"), hint: $("hint"), nextHint: $("next-hint"), answer: $("answer"), bridges: $("bridges") };
    if (!el.work) return;
    let state = createState(), socket = null, timer = null, infoTimer = null, runTimer = null, hint = 0, practiceStage = -1, storage = null;
    try { storage = localStorage; } catch (_) {}
    const course = window.JuliaTimeCourseState;
    const attempt = new URLSearchParams(location.search).get("attempt") || "";
    const caseBoard = boardUrl(location.search);
    if (el.board) el.board.href = caseBoard;
    if (el.sceneBoard) el.sceneBoard.href = caseBoard;
    try { const drafts = course && course.readChallengeDrafts ? course.readChallengeDrafts(storage, attempt) : {}; el.code.value = drafts && drafts["C6/compatible-models"] || ""; } catch (_) {}

    function text(value) { return value == null ? "" : String(value); }
    function clearInfoTimer() { if (infoTimer) { clearTimeout(infoTimer); infoTimer = null; } }
    function clearRunTimer() { if (runTimer) { clearTimeout(runTimer); runTimer = null; } }
    function send(message) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
    function drawModelCards() {
      if (!el.modelCards) return;
      el.modelCards.replaceChildren();
      if (!state.metadata) {
        const item = document.createElement("li");
        item.textContent = "The current candidate cards will appear when the lab file loads.";
        el.modelCards.append(item);
        return;
      }
      candidateModelCards(state.metadata).forEach(card => {
        const item = document.createElement("li"), name = document.createElement("strong"), probability = document.createElement("code");
        name.textContent = card.model;
        probability.textContent = `p = ${card.p}`;
        item.append(name, " · ", probability, " · assumed recorded-detection chance for one jar in this candidate model.");
        el.modelCards.append(item);
      });
    }
    function drawTable() {
      el.data.replaceChildren();
      if (!state.metadata) {
        if (state.metadataFailure) { const p = document.createElement("p"); p.className = "recovery"; p.textContent = state.metadataFailure; el.data.append(p); }
        return;
      }
      const caption = document.createElement("p"); caption.textContent = "Candidate detection models — supplied simulated teaching table.";
      const table = document.createElement("table"), head = document.createElement("thead"), body = document.createElement("tbody"), header = document.createElement("tr");
      state.metadata.inputs[0].columns.forEach(column => { const th = document.createElement("th"); th.textContent = column; header.append(th); });
      head.append(header);
      state.metadata.inputs[0].rows.forEach(row => { const tr = document.createElement("tr"); state.metadata.inputs[0].columns.forEach(column => { const td = document.createElement("td"); td.textContent = text(row[column]); tr.append(td); }); body.append(tr); });
      table.append(head, body); el.data.append(caption, table);
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
    function drawCaseStatus() {
      if (!el.caseStatus) return;
      el.caseStatus.replaceChildren();
      const status = caseStatus(state.metadata);
      if (!status) return;
      const eyebrow = document.createElement("p"), title = document.createElement("h2"), established = document.createElement("p"), unknown = document.createElement("p"), why = document.createElement("p");
      eyebrow.className = "eyebrow"; eyebrow.textContent = "Case status before you write";
      title.textContent = "Why this move now";
      established.textContent = status.established;
      unknown.textContent = status.unknown;
      why.textContent = status.why_now;
      el.caseStatus.append(eyebrow, title, established, unknown, why);
    }
    function drawVisual(){
      el.visual.replaceChildren();
      if (!state.metadata || !state.result || !state.evidence || state.result.result_data !== state.evidence.result_data) return;
      const closure = caseClosure(state.metadata, state.evidence.result_data);
      if (!closure) return;
      const section = document.createElement("section"), title = document.createElement("h2"), intro = document.createElement("p"), list = document.createElement("ul"), limit = document.createElement("p"), closing = document.createElement("section"), closingTitle = document.createElement("h3"), closingText = document.createElement("p"), closingFindings = document.createElement("ul"), closingNext = document.createElement("p"), closingLimit = document.createElement("p"), review = document.createElement("a"), speed = document.createElement("a");
      title.textContent = "Your compatible candidates"; intro.textContent = "Your Julia result retained these rows because their displayed ranges contain the observation:";
      state.evidence.result_data.rows.forEach(row => { const item = document.createElement("li"); item.textContent = `${row.model}: ${row.lower} ≤ ${state.metadata.observed_count} ≤ ${row.upper}`; list.append(item); });
      limit.className = "limit"; limit.textContent = "This range rule does not rank candidates, estimate support, or explain why detections differed. It does not identify a culprit or prove a model true.";
      closingTitle.textContent = closure.title; closingText.textContent = closure.conclusion;
      closure.findings.forEach(finding => { const item = document.createElement("li"); item.textContent = finding; closingFindings.append(item); });
      closingNext.textContent = closure.next; closingLimit.className = "limit"; closingLimit.textContent = closure.limit;
      review.href = boardUrl(location.search); review.textContent = "Review the Case Board →";
      speed.href = "speed-lab.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : ""); speed.textContent = "Optional: open the comparison laboratory →";
      closing.append(closingTitle, closingText, closingFindings, closingNext, closingLimit, review, document.createTextNode(" "), speed); section.append(title, intro, list, limit, closing); el.visual.append(section);
    }
    function render() {
      if (el.preEditorBridge) { const bridge = preEditorBridge(), first = document.createElement("code"), shape = document.createElement("code"); first.textContent = "candidate_models.lower .<= observed_count"; shape.textContent = bridge.shape; shape.style.whiteSpace = "pre-wrap"; el.preEditorBridge.replaceChildren(document.createTextNode(bridge.lead), document.createElement("br"), first, document.createTextNode(" — one true-or-false value per candidate model."), document.createElement("br"), document.createTextNode("Then use the generic two-check shape:"), document.createElement("br"), shape, document.createElement("br"), document.createTextNode(bridge.explanation)); }
      el.status.textContent = connectionStatusText(state);
      el.run.disabled = state.connection !== "connected" || !state.metadata || Boolean(state.pending);
      el.reconnect.hidden = !shouldShowReconnect(state);
      el.observed.textContent = state.metadata ? `Retained B09 detection count: ${state.metadata.observed_count}. Rule: lower ≤ observed_count ≤ upper.` : state.metadataFailure ? "The candidate table is unavailable; your saved draft is safe." : "The retained observation will appear when the lab file loads.";
      el.hint.textContent = hint === 0 ? "Open a small hint only if you need it." : hint === 1 ? COPY.concept : hint === 2 ? `Code shape: ${COPY.shape}` : hint === 3 ? `Build the row rule: ${COPY.range_rule}` : hint === 4 ? `Select rows: ${COPY.selection}` : `Complete answer: ${COPY.solution}`;
      el.nextHint.textContent = hint >= 5 ? "All help shown" : hint === 0 ? "Show the concept" : hint === 1 ? "Show the code shape" : hint === 2 ? "Show the row rule" : hint === 3 ? "Show row selection" : "Show complete code now";
      el.nextHint.disabled = hint >= 5;
      el.bridges.textContent = "R (dplyr)\ndplyr::filter(candidate_models, lower <= observed_count, observed_count <= upper)\n\nPython (pandas)\ncandidate_models.loc[(candidate_models[\"lower\"] <= observed_count) & (observed_count <= candidate_models[\"upper\"])]";
      drawModelCards(); drawTable(); drawScaffold(); drawCaseStatus(); drawVisual();
    }
    function persist() { try { if (course && course.writeChallengeDraft) course.writeChallengeDraft(storage, attempt, CHAPTER, MOVE, el.code.value); } catch (_) {} }
    function record(message) {
      if (!course || !state.evidence || state.result !== message || state.evidence.result_data !== message.result_data) return;
      try { course.recordHistoricalMoveIfMissing(storage, attempt, CHAPTER, MOVE); course.writeEvidenceIfMissing(storage, attempt, { chapter: CHAPTER, move_id: MOVE, title: "Compatible candidate models retained", row_count: message.result_data.rows.length, provenance: "historical-browser" }); course.writeCursor(storage, attempt, { chapter: CHAPTER, move_id: MOVE, mode: "challenge" }); } catch (_) {}
    }
    function showResult(message) {
      el.result.replaceChildren(); const p = document.createElement("p"); p.textContent = text(message.message || message.feedback || "Julia returned a result."); el.result.append(p);
      if (message.explanation) { const explanation = document.createElement("p"); explanation.textContent = `Julia: ${text(message.explanation.julia)} Case: ${text(message.explanation.case)} Limit: ${text(message.explanation.limit)}`; el.result.append(explanation); }
    }
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
        else { state = failCaseInfo(state, message); if (state === before) { state = applyCaseResult(state, message); if (state !== before) { clearRunTimer(); showResult(state.runFailure || message); if (state.evidence) record(message); } } }
        render();
      };
      socket.onclose = () => { clearInfoTimer(); clearRunTimer(); state = disconnect(state); render(); if (plan.retry && !timer) timer = setTimeout(() => { timer = null; connect(); }, 1500); };
    }
    function focusElement(element) { if (element) element.focus(); }
    el.start.addEventListener("click", () => { el.scene.hidden = true; el.work.hidden = false; connect(); focusElement(el.title); });
    el.back.addEventListener("click", () => { clearRunTimer(); el.work.hidden = true; el.scene.hidden = false; focusElement(el.sceneTitle); });
    el.reconnect.addEventListener("click", connect);
    el.code.addEventListener("input", () => { clearRunTimer(); persist(); });
    el.run.addEventListener("click", () => { persist(); state = beginRun(state, id("c6-run")); if (state.pending) { const requestId = state.pending.request_id; el.result.replaceChildren(); el.visual.replaceChildren(); send(runMessage(el.code.value, requestId)); clearRunTimer(); runTimer = setTimeout(() => { state = expireRun(state, requestId); if (state.runFailure) { showResult(state.runFailure); el.code.focus(); } render(); }, RUN_DEADLINE_MS); render(); } });
    el.code.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); el.run.click(); } });
    el.nextHint.addEventListener("click", () => { hint = Math.min(5, hint + 1); render(); });
    el.answer.addEventListener("click", () => { hint = 5; render(); });
    window.addEventListener("pagehide", () => { clearInfoTimer(); clearRunTimer(); if (socket) socket.close(); });
    render();
  }

  return { CASE_ID, CHAPTER, MOVE, COPY, INFO_DEADLINE_MS, RUN_DEADLINE_MS, createState, initialEditorText, challengeRecovery, beginInfo, failCaseInfo, expireInfo, candidateModelCards, applyCaseInfo, beginRun, expireRun, applyCaseResult, disconnect, connectionPlan, enterFileUrlRecovery, connectionStatusText, shouldShowReconnect, infoMessage, runMessage, boardUrl, learningScaffold, caseStatus, caseClosure, rangePracticeStep, preEditorBridge, init };
});

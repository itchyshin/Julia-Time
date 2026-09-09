/* Julia Time: Missing Fleas C5. The server alone supplies case data and checks Julia. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeChapter5 = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.init);
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const CASE_ID = "missing-fleas-v1", CHAPTER = "C5";
  const MOVES = ["event-mask", "event-frequency"];
  const INFO_DEADLINE_MS = 5000, RUN_DEADLINE_MS = 7000;
  const COPY = Object.freeze({
    "event-mask": {
      step: "1 of 2 · Name the event", title: "Name the simulated event",
      question: "Which of the 1,000 simulated counts are at least the observed B09 count?",
      required: "Return one true-or-false value for every simulation: true exactly when count is at least observed_count.",
      concept: "An event is a yes-or-no rule applied to every simulated count. Here: was the simulated count at least the observed count?",
      shape: "counts .>= threshold", solution: "sim_counts .>= observed_count",
      syntax: "The dot in .>= means compare every count, producing one true-or-false result per simulation.",
      r: "sim_counts >= observed_count", python: "import numpy as np\nnp.asarray(sim_counts) >= observed_count",
      visual: "The event mask marks the simulations in the highlighted tail."
    },
    "event-frequency": {
      step: "2 of 2 · Calculate a frequency", title: "Calculate the event frequency",
      question: "Among all 1,000 simulations, what fraction meet that event?",
      required: "Return both the exact event mask and `frequency = matching events / all trials` as `(events=..., frequency=...)`.",
      concept: "A simulated frequency is a count of matching events divided by all simulations under this stated teaching model. In plain language: out of every 100 model runs, about how many meet the rule?",
      shape: "events = counts .>= threshold; (events=events, frequency=sum(events)/length(events))",
      solution: "events = sim_counts .>= observed_count; (events=events, frequency=sum(events)/length(events))",
      syntax: "sum(events) counts true values; length(events) counts every simulation. The semicolon lets you make the event before returning the named result.",
      r: "events <- sim_counts >= observed_count\nmean(events)", python: "import numpy as np\nevents = np.asarray(sim_counts) >= observed_count\nevents.mean()",
      bridge_note: "These R and Python lines show only the frequency calculation. The Julia case result still needs two labelled pieces: events and frequency.",
      visual: "The highlighted tail is the matching-event count divided by all trials."
    }
  });
  function helpStages(move) {
    const copy = COPY[move];
    if (!copy) return [];
    const beforeFull = {label:"Before the full answer", text:"This will show one complete expression. It will not write into your challenge editor or add case evidence.", button:"Show complete code now"};
    if (move === "event-frequency") return [
      {label:"Concept", text:copy.concept, button:"Show the code shape"},
      {label:"Code shape", text:copy.shape, button:"Explain the two returned pieces"},
      {label:"Two labelled pieces", text:"events is the true-or-false vector: one result for every simulation. frequency is matching events divided by all trials. (events=events, frequency=...) is a Julia named tuple, one returned result with two labelled pieces. Each fresh sandbox run starts fresh, so your code must create events again before it returns both pieces.", button:"Show a full answer?"},
      beforeFull,
      {label:"Full answer", text:copy.solution, button:"All help shown"}
    ];
    return [
      {label:"Concept", text:copy.concept, button:"Show the code shape"},
      {label:"Code shape", text:copy.shape, button:"Show a full answer?"},
      beforeFull,
      {label:"Full answer", text:copy.solution, button:"All help shown"}
    ];
  }
  function helpStage(move, index) { return helpStages(move)[index] || null; }
  function preEditorBridge(move) {
    const copy = COPY[move];
    if (!copy) return {lead:"", shape:"", explanation:""};
    if (move !== "event-frequency") return {lead:copy.syntax, shape:"", explanation:""};
    return {
      lead:"Build the yes-or-no event first, then return both labelled pieces:",
      shape:copy.shape,
      explanation:"events = gives the true-or-false vector a name. The semicolon starts the second expression. The parentheses return one Julia named tuple with labels events and frequency. Replace the generic names with the named case inputs above."
    };
  }
  const FREQUENCY_COMPOSITION = Object.freeze([
    Object.freeze({id:"event", text:"events = counts .>= threshold"}),
    Object.freeze({id:"frequency", text:"frequency = sum(events) / length(events)"}),
    Object.freeze({id:"return", text:"(events=events, frequency=frequency)"})
  ]);
  function frequencyCompositionCards() { return FREQUENCY_COMPOSITION.map(card => ({id:card.id, text:card.text})); }
  function frequencyCompositionIsCorrect(order) { const cards=frequencyCompositionCards(); return Array.isArray(order) && order.length === cards.length && order.every((id,index) => id === cards[index].id); }
  function knownMove(move) { return MOVES.includes(move); }
  function requestedMove(search) { const move = new URLSearchParams(search || "").get("move"); return knownMove(move) ? move : MOVES[0]; }
  function acceptedMoveKeys(courseState, storage, attempt) {
    if (!courseState || typeof courseState.readCourseState !== "function" || typeof courseState.acceptedMoves !== "function") return [];
    try {
      const moves = courseState.acceptedMoves(courseState.readCourseState(storage, attempt));
      return Array.isArray(moves) ? moves.map(move => move && move.key).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function canOpenMove(courseState, storage, attempt, move) { return knownMove(move) && (move === "event-mask" || acceptedMoveKeys(courseState, storage, attempt).includes("C5/event-mask")); }
  function initialMove(courseState, storage, attempt, search) { const move = requestedMove(search); return canOpenMove(courseState, storage, attempt, move) ? move : MOVES[0]; }
  function canOpenSocket(protocol) { return protocol !== "file:"; }
  function connectionMessageForProtocol(protocol) { return protocol === "file:" ? "This page was opened directly from a file. Start the game with run.jl, then open http://127.0.0.1:8000 in your browser." : ""; }
  function openingConnectionMessageForProtocol(protocol) { return connectionMessageForProtocol(protocol) || "Open Toto’s simulation table to load the lab data."; }
  function initialEditorText() { return ""; }
  function challengeRecovery(move) {
    const currentMove = knownMove(move) ? move : MOVES[0];
    return `That result did not meet the stated check. Your draft is still here. Use the ${currentMove === "event-mask" ? ".>= comparison" : "event-frequency"} cue above, revise it, and run again.`;
  }
  function requestId(prefix) { return (prefix || "c5") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function validAttempt(value) { return /^[a-z0-9-]{1,80}$/.test(value || ""); }
  function caseBoardUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "course/index.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : ""); }
  function nextChapterUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "chapter6.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : ""); }
  function nextDestination(move, accepted) { if (!accepted) return null; return move === "event-mask" ? "event-frequency" : move === "event-frequency" ? "chapter6" : null; }
  function createState() { return {connection:"connecting", activeMove:MOVES[0], infoRequest:null, pending:null, actionPending:null, actionFailure:null, metadata:null, metadataFailure:"", runFailure:null, result:null, demo:null, cardChoice:null, evidence:null, firstAccepted:false}; }
  function identity(move, requestId, simulationId) { return {case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:simulationId == null ? null : simulationId, request_id:requestId}; }
  function sameIdentity(message, expected) { return Boolean(message && expected && message.contract_version === 1 && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id && message.request_id === expected.request_id); }
  function beginInfo(state, requestId, move) { move = knownMove(move) ? move : MOVES[0]; return Object.assign({}, state, {activeMove:move, infoRequest:identity(move,requestId,null), pending:null, metadata:null, metadataFailure:"", runFailure:null, result:null}); }
  function beginRun(state, requestId, move) { move = knownMove(move) ? move : state.activeMove; if (!knownMove(move) || !validMetadata(state.metadata)) return state; return Object.assign({}, state, {activeMove:move, pending:identity(move,requestId,state.metadata.simulation_id), runFailure:null, result:null}); }
  function validSimulationId(value) { return typeof value === "string" && value.length > 0 && value.length <= 200; }
  function expectedInputs(message) {
    const input = message && Array.isArray(message.inputs) && message.inputs.length === 1 ? message.inputs[0] : null;
    return Boolean(input && input.id === "sim_counts" && Array.isArray(input.columns) && input.columns.length === 2 && input.columns[0] === "simulation" && input.columns[1] === "count" && Array.isArray(input.rows) && input.rows.length === message.n_trials && input.rows.every((row,index) => row && row.simulation === index + 1 && Number.isInteger(row.count) && row.count >= 0 && row.count <= message.n_jars));
  }
  function validMetadata(message) { return Boolean(message && Number.isInteger(message.n_jars) && message.n_jars > 0 && Number.isFinite(message.p_ref) && message.p_ref >= 0 && message.p_ref <= 1 && Number.isInteger(message.observed_count) && message.observed_count >= 0 && message.observed_count <= message.n_jars && Number.isInteger(message.n_trials) && message.n_trials > 0 && validSimulationId(message.simulation_id) && expectedInputs(message)); }
  function caseStatus(metadata) {
    if (!validMetadata(metadata)) return null;
    return {
      established:`Established in the case: the report and handling log disagree for tray T-C. The observed B09 count is ${metadata.observed_count} of ${metadata.n_jars} jars.`,
      unknown:"Still unknown: this does not establish a biological cause, or tell us which record describes what happened in the jars.",
      why_now:"Why this move now: Toto asks a smaller probability question under one stated teaching model. Before we estimate how often it happens, we need a yes-or-no event for each simulated count."
    };
  }
  function simulationBins(metadata) {
    if (!validMetadata(metadata)) return null;
    const bins = Array.from({length:metadata.n_jars + 1}, (_, count) => ({count, frequency:0, tail:count >= metadata.observed_count}));
    metadata.inputs[0].rows.forEach(row => { bins[row.count].frequency += 1; });
    return bins;
  }
  function cardEventFeedback(draws, observed, choice) {
    if (!Array.isArray(draws) || draws.length !== 6 || !draws.every(value => value === "teal" || value === "orange") || !Number.isInteger(observed) || observed < 0 || typeof choice !== "string") return null;
    const tealCount = draws.filter(value => value === "teal").length;
    const meetsEvent = tealCount >= observed;
    const correct = (choice === "yes") === meetsEvent;
    return {tealCount, meetsEvent, correct, feedback: correct ? `${tealCount} is ${meetsEvent ? "at least" : "below"} ${observed}, so your event decision is right.` : `Try once more: compare ${tealCount} with “at least ${observed}.”`};
  }
  function answerCardEvent(state, choice) {
    const draws = state && state.demo && state.demo.result_data && state.demo.result_data.draws;
    const answer = state && state.metadata ? cardEventFeedback(draws, state.metadata.observed_count, choice) : null;
    return answer ? Object.assign({}, state, {cardChoice:choice}) : state;
  }
  function hasAnsweredCard(state) {
    const draws = state && state.demo && state.demo.result_data && state.demo.result_data.draws;
    const answer = state && state.metadata ? cardEventFeedback(draws, state.metadata.observed_count, state.cardChoice) : null;
    return Boolean(answer && answer.correct);
  }
  function challengeReady(state) {
    return Boolean(state && state.connection === "connected" && validMetadata(state.metadata) && !state.pending);
  }
  function runStatusText(state) {
    return state && state.runFailure ? "Your code is ready to revise." : state && state.metadataFailure ? state.metadataFailure : state && state.pending ? "Checking your Julia result…" : state && state.connection === "connected" ? (validMetadata(state.metadata) ? "Lab file ready" : "Loading the simulation file…") : "Connect to the lab to run Julia";
  }
  function sameInfoIdentity(message, expected) { return Boolean(message && expected && message.contract_version === 1 && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.request_id === expected.request_id && typeof message.simulation_id === "string" && message.simulation_id.length > 0); }
  function applyCaseInfo(state, message) { if (!state.infoRequest || !message || message.type !== "case" || !sameInfoIdentity(message,state.infoRequest) || !validMetadata(message)) return state; return Object.assign({}, state, {infoRequest:null, metadata:message, activeMove:message.move_id}); }
  function metadataFailureText(message) { const detail = safeText(message && (message.message || message.feedback)); return /unknown mystery chapter|does not recognise|does not recognize/i.test(detail) ? "The local lab does not recognise this chapter. Restart Julia Time, then reload this page. Your draft is still here." : "The case data did not arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here."; }
  function failCaseInfo(state, message) { if (!state || !state.infoRequest) return state; return Object.assign({}, state, {infoRequest:null, metadata:null, pending:null, metadataFailure:metadataFailureText(message), result:null}); }
  function expireInfo(state, requestId) { if (!state || !state.infoRequest || state.infoRequest.request_id !== requestId) return state; return Object.assign({}, state, {infoRequest:null, metadata:null, pending:null, metadataFailure:"The case data took too long to arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here.", result:null}); }
  function expireRun(state, requestId) { if (!state || !state.pending || state.pending.request_id !== requestId) return state; return Object.assign({}, state, {pending:null, runFailure:{status:"timeout", request_id:requestId, feedback:"This check took too long. Your code is still here; check it, then run again."}, result:null}); }
  function histogramData(metadata, data) {
    if (!validMetadata(metadata) || !data || data.kind !== "event-frequency" || !Number.isInteger(data.matching) || !Number.isInteger(data.trials) || data.trials !== metadata.n_trials || data.matching < 0 || data.matching > data.trials || typeof data.frequency !== "number" || !Number.isFinite(data.frequency) || Math.abs(data.frequency - data.matching / data.trials) >= 1e-12) return null;
    const bins = simulationBins(metadata);
    return bins.reduce((total, bin) => total + (bin.tail ? bin.frequency : 0), 0) === data.matching ? bins : null;
  }
  function validVisual(metadata, move, result) {
    const data = result && result.result_data;
    if (!data || typeof data !== "object") return false;
    if (move === "event-mask") return data.kind === "boolean-vector" && Number.isInteger(data.length) && data.length === metadata.n_trials && Number.isInteger(data.true_count) && data.true_count >= 0 && data.true_count <= data.length && Array.isArray(data.preview) && data.preview.every(value => typeof value === "boolean");
    return histogramData(metadata,data) !== null;
  }
  function applyCaseResult(state, message) { if (!state.pending || !message || message.type !== "case_result" || !sameIdentity(message,state.pending)) return state; const accepted = message.status === "ok" && message.pass === true && message.progress_eligible === true && validVisual(state.metadata,state.activeMove,message); return accepted ? Object.assign({}, state, {pending:null, result:message, evidence:{move_id:state.activeMove, result_data:message.result_data}, firstAccepted:true}) : Object.assign({}, state, {pending:null, result:null, runFailure:{status:"rejected", request_id:state.pending.request_id, feedback:challengeRecovery(state.activeMove)}}); }
  function isNewAcceptedResult(before, after, message) { return Boolean(before && after && before !== after && after.result === message && after.evidence && after.evidence.result_data === message.result_data); }
  function actionSimulationId(action) { return action === "draw-six" ? "c5-card-round-v1" : "c5-" + action + "-v1"; }
  function beginAction(state, requestId, action) { if (!validMetadata(state.metadata) || !["draw-six","replay-100","replay-1000"].includes(action)) return state; return Object.assign({}, state, {actionPending:{contract_version:1,case_id:CASE_ID,chapter:CHAPTER,move_id:"card-draw-demo",mode:"demonstration",activity_id:"card-round",simulation_id:actionSimulationId(action),request_id:requestId,action:action}, actionFailure:null, demo:null, cardChoice:action === "draw-six" ? null : state.cardChoice}); }
  function validDemo(message, expected) { const data = message && message.result_data; if (!data || typeof data !== "object") return false; if (expected.action === "draw-six") return data.kind === "card-draws" && Array.isArray(data.draws) && data.draws.length === 6 && data.draws.every(value => value === "teal" || value === "orange"); return data.kind === "simulation-counts" && Array.isArray(data.counts) && data.counts.length === (expected.action === "replay-100" ? 100 : 1000) && data.counts.every(Number.isInteger); }
  function sameActionIdentity(message, expected) { return Boolean(message && expected && message.contract_version === expected.contract_version && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id && message.request_id === expected.request_id && message.action === expected.action); }
  function expireAction(state, requestId) { if (!state || !state.actionPending || state.actionPending.request_id !== requestId) return state; return Object.assign({}, state, {actionPending:null, actionFailure:{status:"timeout", request_id:requestId, message:"Toto’s card activity took too long. Nothing changed in the case; try it again or continue to the Julia move."}}); }
  function applyActionResult(state, message) { const expected = state.actionPending; if (!expected || !message || message.type !== "case_action_result" || !sameActionIdentity(message,expected)) return state; if (message.status === "error") return Object.assign({}, state, {actionPending:null, actionFailure:{status:"error", request_id:expected.request_id, message:"Toto’s card activity could not run. Nothing changed in the case; try it again or continue to the Julia move."}}); if (message.status !== "ok" || message.progress_eligible !== false || !validDemo(message,expected)) return state; return Object.assign({}, state, {actionPending:null, actionFailure:null, demo:message}); }
  function disconnect(state) { return Object.assign({}, state, {connection:"offline",infoRequest:null,pending:null,actionPending:null}); }
  function infoMessage(move,id) { return Object.assign({type:"case_info",contract_version:1},identity(move,id,null)); }
  function runMessage(state,code,id) { return Object.assign({type:"case_run",contract_version:1,code:code},identity(state.activeMove,id,state.metadata && state.metadata.simulation_id)); }
  function actionMessage(action,id) { return {type:"case_action",contract_version:1,case_id:CASE_ID,chapter:CHAPTER,move_id:"card-draw-demo",mode:"demonstration",activity_id:"card-round",simulation_id:null,request_id:id,action:action}; }
  function safeText(value) { return value == null ? "" : String(value); }
  function table(parent, rows, limit) { const t=document.createElement("table"), head=document.createElement("thead"), body=document.createElement("tbody"), hr=document.createElement("tr"); ["simulation","count"].forEach(name=>{const th=document.createElement("th");th.textContent=name;hr.append(th);});head.append(hr);rows.slice(0,limit).forEach(row=>{const tr=document.createElement("tr");[row.simulation,row.count].forEach(value=>{const td=document.createElement("td");td.textContent=safeText(value);tr.append(td);});body.append(tr);});t.append(head,body);parent.append(t); }
  function renderDistribution(parent, bins, title, text, accepted) {
    if (!Array.isArray(bins) || !bins.length) return;
    const section=document.createElement("section"), heading=document.createElement("h3"), note=document.createElement("p"), list=document.createElement("ol");
    section.className="distribution"; heading.textContent=title; note.textContent=text; list.className="distribution-bars";
    const largest=Math.max(1,...bins.map(bin=>bin.frequency));
    bins.forEach(bin=>{const item=document.createElement("li"), bar=document.createElement("span"), label=document.createElement("span"); item.className=bin.tail ? "tail" : ""; if(accepted && bin.tail)item.classList.add("accepted"); bar.className="distribution-bar";bar.style.setProperty("--height", String(Math.max(3,Math.round(100*bin.frequency/largest))));label.textContent=`${bin.count}: ${bin.frequency}${bin.tail ? " — at least the observed count" : ""}`;item.append(bar,label);list.append(item);});
    section.append(heading,note,list);parent.append(section);
  }
  function init() {
    const $ = id => document.getElementById(id); const el={scene:$("scene"),work:$("work"),start:$("start"),back:$("back"),board:$("case-board"),sceneTitle:$("scene-title"),connection:$("connection"),reconnect:$("reconnect"),moves:document.querySelectorAll("[data-move]"),moveLock:$("move-lock"),step:$("move-step"),title:$("move-title"),question:$("move-question"),required:$("required-result"),context:$("case-context"),data:$("simulation-data"),caseStatus:$("case-status"),code:$("code"),run:$("run"),status:$("run-status"),syntax:$("syntax"),result:$("result"),visual:$("visual"),next:$("next"),hint:$("hint"),nextHint:$("next-hint"),answer:$("answer"),bridges:$("bridges"),actionButtons:document.querySelectorAll("[data-action]"),prediction:$("card-prediction"),demo:$("demo"),cardEvent:$("card-event"),frequencyComposition:$("frequency-composition"),frequencyCompositionCards:$("frequency-composition-cards"),frequencyCompositionFeedback:$("frequency-composition-feedback"),checkFrequencyComposition:$("check-frequency-composition"),resetFrequencyComposition:$("reset-frequency-composition")};
    if (!el.work) return; let storage=null; try {storage=localStorage;} catch (_) {} const course=window.JuliaTimeCourseState; const attempt=new URLSearchParams(location.search).get("attempt") || ""; let state=createState(), socket=null, timer=null, infoTimer=null, runTimer=null, actionTimer=null, stopped=false, hint=0, drafts=Object.create(null), frequencyOrder=[]; state.activeMove=initialMove(course,storage,attempt,location.search); state.firstAccepted=canOpenMove(course,storage,attempt,"event-frequency"); if (location.protocol === "file:") state.connection="offline"; if (el.connection) el.connection.textContent=openingConnectionMessageForProtocol(location.protocol); if (el.board) el.board.href=caseBoardUrl(location.search);
    try {const saved=course && course.readChallengeDrafts ? course.readChallengeDrafts(storage,attempt) : {}; Object.keys(saved || {}).forEach(key=>{if(key.startsWith("C5/")) drafts[key.slice(3)]=saved[key];});} catch (_) {}
    function moveCopy() { return COPY[state.activeMove]; }
    function clearResult() { el.result.replaceChildren(); el.visual.replaceChildren(); el.next.hidden=true; el.next.dataset.destination=""; }
    function clearInfoTimer() { if(infoTimer) { clearTimeout(infoTimer); infoTimer=null; } }
    function clearRunTimer() { if(runTimer) { clearTimeout(runTimer); runTimer=null; } }
    function clearActionTimer() { if(actionTimer) { clearTimeout(actionTimer); actionTimer=null; } }
    function renderData() {
      el.data.replaceChildren();
      if (!validMetadata(state.metadata)) {
        if (state.metadataFailure) {
          const p = document.createElement("p");
          p.className = "recovery";
          p.textContent = state.metadataFailure;
          el.data.append(p);
        }
        return;
      }
      const rows = state.metadata.inputs[0].rows;
      const label = document.createElement("p");
      label.className = "data-label";
      label.textContent = "Simulated teaching data — fixed seeded model, not a new flea observation.";
      const model = document.createElement("p");
      model.textContent = `Model inputs: ${state.metadata.n_jars} trials per simulation; reference probability ${state.metadata.p_ref}.`;
      const lead = document.createElement("p");
      lead.textContent = `Observed B09 count: ${state.metadata.observed_count}. Supplied simulations: ${state.metadata.n_trials}.`;
      const binding = document.createElement("p");
      binding.className = "practice-bridge";
      binding.textContent = `Julia inputs: sim_counts — a vector of all ${state.metadata.n_trials} simulated counts; observed_count — the supplied B09 count (${state.metadata.observed_count}) used as the comparison threshold.`;
      const previewHeading = document.createElement("h3");
      previewHeading.textContent = "First 12 supplied counts";
      const previewNote = document.createElement("p");
      previewNote.textContent = "You do not need to count these by hand. Use only the count values in Julia: sim_counts contains every supplied count; this small window lets you see what one count looks like, and the histogram below shows all simulations.";
      const fixture = document.createElement("p");
      fixture.className = "limit";
      fixture.textContent = `Simulation fixture ID: ${state.metadata.simulation_id}. This opaque ID identifies the supplied fixed teaching simulation; Julia receives it but does not derive it.`;
      const columnDetails = document.createElement("details"), columnSummary = document.createElement("summary"), columnExplanation = document.createElement("p");
      columnSummary.textContent = "Why the table has two columns but Julia uses one vector";
      columnExplanation.textContent = "The simulation column is the row label. sim_counts contains the count column in that same order.";
      columnDetails.append(columnSummary, columnExplanation);
      const moreDetails = document.createElement("details"), moreSummary = document.createElement("summary"), moreTable = document.createElement("div");
      moreSummary.textContent = "Show 18 more supplied counts";
      moreDetails.append(moreSummary, moreTable);
      el.data.append(label, model, lead, binding, previewHeading, previewNote);
      table(el.data,state.metadata.inputs[0].rows,12);
      table(moreTable, rows.slice(12,30), 18);
      el.data.append(moreDetails, fixture, columnDetails);
      const bins = simulationBins(state.metadata);
      if (bins) renderDistribution(el.data, bins, "Before you write: see the full simulated distribution", `Each bar is the number of supplied simulations with that count. Your next Julia move will name the bars at least the observed count (${state.metadata.observed_count}).`, false);
    }
    function renderVisual() { el.visual.replaceChildren(); if(!state.result || !state.evidence || state.result.result_data !== state.evidence.result_data) return; const data=state.evidence.result_data, panel=document.createElement("section"), heading=document.createElement("h2"); heading.textContent=state.activeMove === "event-mask" ? "Your event mask" : "Your simulated tail frequency"; const p=document.createElement("p"); p.textContent=state.activeMove === "event-mask" ? `${data.true_count} of ${data.length} supplied simulations meet your event.` : `${data.matching} of ${data.trials} supplied simulations meet your event: ${(100*data.frequency).toFixed(1)}%.`; const bars=document.createElement("div");bars.className="tail-bar"; const fill=document.createElement("span");fill.style.width=`${100*(state.activeMove === "event-mask" ? data.true_count/data.length : data.frequency)}%`;bars.append(fill);const limit=document.createElement("p");limit.className="limit";limit.textContent="This is a frequency under the displayed teaching model. It does not identify a cause or show that the model is true.";panel.append(heading,p,bars,limit);const bins=state.activeMove === "event-frequency" ? histogramData(state.metadata,data) : simulationBins(state.metadata);if(bins && (state.activeMove === "event-frequency" || bins.filter(bin=>bin.tail).reduce((total,bin)=>total+bin.frequency,0) === data.true_count)) renderDistribution(panel,bins,"Your Julia rule marks this tail",`Counts at least ${state.metadata.observed_count} are the bars your returned Boolean result marks true.`,true);el.visual.append(panel); }
    function renderDemo() { el.demo.replaceChildren();el.cardEvent.replaceChildren(); if(!validMetadata(state.metadata)) return; if(state.actionFailure) {const recovery=document.createElement("p");recovery.className="recovery";recovery.textContent=state.actionFailure.message;el.demo.append(recovery);} if(!state.demo) return; const data=state.demo.result_data, p=document.createElement("p"); p.className="demo-result"; if(data.kind === "card-draws") {p.textContent="Toto’s recorded six-card draw: ";data.draws.forEach(value=>{const card=document.createElement("span");card.className=value === "teal" ? "teal-card":"orange-card";card.textContent=value;p.append(card);});p.append(". That count is one model outcome; the case task applies the same yes-or-no idea to sim_counts.");el.demo.append(p);const answer=cardEventFeedback(data.draws,state.metadata.observed_count,state.cardChoice);const question=document.createElement("p");question.className="card-question";question.textContent=`There are ${data.draws.filter(value=>value === "teal").length} teal cards. Is that at least the observed B09 count (${state.metadata.observed_count})?`;const choices=document.createElement("div");choices.className="controls";[["yes","Yes — it meets the event"],["no","No — it does not meet the event"]].forEach(([choice,label])=>{const button=document.createElement("button");button.type="button";button.dataset.cardChoice=choice;button.textContent=label;button.disabled=Boolean(answer && answer.correct);button.addEventListener("click",()=>{state=answerCardEvent(state,choice);render();});choices.append(button);});el.cardEvent.append(question,choices);if(answer){const feedback=document.createElement("p");feedback.className=answer.correct ? "demo-result" : "recovery";feedback.textContent=answer.correct ? `${answer.feedback} That was practice data. Now apply the same at-least comparison to the named sim_counts below.` : answer.feedback;el.cardEvent.append(feedback);}} else {const atLeast=data.counts.filter(value=>value >= state.metadata.observed_count).length;p.textContent=`Recorded non-credit replay: ${atLeast} of ${data.n_trials} model counts were at least the observed count. It does not change case evidence.`;el.demo.append(p);if(typeof state.demo.generated_code === "string" && state.demo.generated_code.trim()) {const note=document.createElement("p"), code=document.createElement("pre");note.className="limit";note.textContent="Server-supplied demonstration code (shown as text only; it is not your code and earns no case credit).";code.textContent=state.demo.generated_code;el.demo.append(note,code);}} }
    function renderFrequencyComposition() {
      const active=state.activeMove === "event-frequency";
      el.frequencyComposition.hidden=!active;
      el.frequencyCompositionCards.replaceChildren();
      if(!active) return;
      const cards=frequencyCompositionCards();
      cards.slice().reverse().forEach(card=>{
        const button=document.createElement("button");
        button.type="button";
        button.className="quiet";
        button.textContent=card.text;
        button.disabled=frequencyOrder.includes(card.id);
        button.addEventListener("click",()=>{frequencyOrder.push(card.id);renderFrequencyComposition();});
        el.frequencyCompositionCards.append(button);
      });
      el.frequencyCompositionFeedback.textContent=frequencyOrder.length === 0 ? "Choose the first piece." : "Your construction: " + frequencyOrder.map(id=>cards.find(card=>card.id===id).text).join(" → ");
    }
    function renderCaseStatus() { if(!el.caseStatus) return; el.caseStatus.replaceChildren(); const status=caseStatus(state.metadata); if(!status) return; const eyebrow=document.createElement("p"), title=document.createElement("h2"), established=document.createElement("p"), unknown=document.createElement("p"), why=document.createElement("p"); eyebrow.className="eyebrow";eyebrow.textContent="Case status before you write";title.textContent="Why this move now";established.textContent=status.established;unknown.textContent=status.unknown;why.textContent=status.why_now;el.caseStatus.append(eyebrow,title,established,unknown,why); }
    function render() { const c=moveCopy(), stages=helpStages(state.activeMove), stage=hint > 0 ? stages[hint - 1] : null, bridge=preEditorBridge(state.activeMove); el.step.textContent=c.step;el.title.textContent=c.title;el.question.textContent=c.question;el.required.textContent=c.required;el.syntax.replaceChildren(document.createTextNode(bridge.lead));if(bridge.shape){const shape=document.createElement("code");shape.textContent=bridge.shape;el.syntax.append(document.createElement("br"),shape,document.createElement("br"),document.createTextNode(bridge.explanation));}el.run.disabled=!challengeReady(state);el.status.textContent=runStatusText(state);el.reconnect.hidden=(state.connection === "connected" && !state.metadataFailure) || state.connection === "connecting";el.moves.forEach(button=>{const current=button.dataset.move === state.activeMove;button.setAttribute("aria-current",String(current));button.disabled=button.dataset.move === "event-frequency" && !state.firstAccepted;});if(el.moveLock) {el.moveLock.textContent=state.firstAccepted ? "Event saved; Move 2 is now open." : "Complete and run Move 1 to unlock Move 2.";}el.actionButtons.forEach(button=>{button.disabled=state.connection !== "connected" || !validMetadata(state.metadata)||Boolean(state.actionPending);});el.hint.textContent=stage ? `${stage.label}: ${stage.text}` : "Open a small hint when you need it.";el.nextHint.textContent=hint >= stages.length ? "All help shown" : hint === 0 ? "Show the concept" : stages[hint - 1].button;el.nextHint.disabled=hint >= stages.length;el.bridges.textContent=`${c.bridge_note ? `${c.bridge_note}\n\n` : ""}R\n${c.r}\n\nPython\n${c.python}`;renderFrequencyComposition();renderData();renderCaseStatus();renderVisual();renderDemo();}
    function persistDraft() { drafts[state.activeMove]=el.code.value;try{if(course && course.writeChallengeDraft) course.writeChallengeDraft(storage,attempt,CHAPTER,state.activeMove,el.code.value);}catch(_){}}
    function selectMove(move) { if(!knownMove(move) || (move === "event-frequency" && !state.firstAccepted)) return; clearInfoTimer();clearRunTimer();drafts[state.activeMove]=el.code.value;state=beginInfo(state,requestId("c5-info"),move);hint=0;frequencyOrder=[];el.code.value=drafts[move] || initialEditorText();clearResult();send(infoMessage(move,state.infoRequest.request_id));const id=state.infoRequest.request_id;infoTimer=setTimeout(()=>{const before=state;state=expireInfo(state,id);if(state!==before)render();},INFO_DEADLINE_MS);render(); }
    function persistAccepted(result) { if(!course || !result || !state.evidence) return;try{course.recordHistoricalMoveIfMissing(storage,attempt,CHAPTER,result.move_id);course.writeEvidenceIfMissing(storage,attempt,{chapter:CHAPTER,move_id:result.move_id,title:result.move_id === "event-mask" ? "Simulation event named" : "Simulation event frequency calculated",row_count:result.result_data.trials || result.result_data.length,provenance:"historical-browser"});course.writeCursor(storage,attempt,{chapter:CHAPTER,move_id:result.move_id === "event-mask" ? "event-frequency" : "event-frequency",mode:"challenge"});}catch(_){}}
    function resultMessage(message) { el.result.replaceChildren();const p=document.createElement("p");p.textContent=safeText(message.message || message.feedback || "Julia returned a result.");el.result.append(p);if(message.explanation){const e=document.createElement("p");e.textContent=`Julia: ${safeText(message.explanation.julia)} Case: ${safeText(message.explanation.case)} Limit: ${safeText(message.explanation.limit)}`;el.result.append(e);} }
    function send(message) { if(socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
    function connect() { if(stopped) return; clearTimeout(timer); timer=null;clearInfoTimer();clearRunTimer(); if(!canOpenSocket(location.protocol)){const old=socket;socket=null;if(old)try{old.close();}catch(_){}state=disconnect(state);if(el.connection)el.connection.textContent=connectionMessageForProtocol(location.protocol);render();return;} const old=socket;socket=null;if(old)try{old.close();}catch(_){}state.connection="connecting";if(el.connection)el.connection.textContent="● Connecting to the lab…";render();try{socket=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/ws");}catch(_){return retry();}const ws=socket;ws.onopen=()=>{if(socket!==ws)return;state.connection="connected";if(el.connection)el.connection.textContent="● Lab link ready";selectMove(state.activeMove);};ws.onmessage=event=>{if(socket!==ws)return;let message;try{message=JSON.parse(event.data);}catch(_){return;} const before=state;state=applyCaseInfo(state,message);if(state!==before){clearInfoTimer();render();return;} if(message && message.type === "error"){state=failCaseInfo(state,message);if(state!==before){clearInfoTimer();render();return;}}state=applyCaseResult(state,message);if(state!==before){clearRunTimer();resultMessage(state.runFailure || message);const destination=nextDestination(message.move_id,isNewAcceptedResult(before,state,message));if(destination){persistAccepted(message);el.next.hidden=false;el.next.dataset.destination=destination;el.next.textContent=destination==="chapter6"?"Next: compare explanations →":"Next: calculate the event frequency →";}render();return;}state=applyActionResult(state,message);if(state!==before)renderDemo();render();};ws.onclose=()=>{if(socket!==ws)return;clearInfoTimer();clearRunTimer();state=disconnect(state);render();retry();};ws.onerror=()=>{};}
    function retry() { if(stopped || !canOpenSocket(location.protocol) || timer) return; timer=setTimeout(()=>{timer=null;connect();},1500); }
    el.checkFrequencyComposition.addEventListener("click",()=>{
      const cards=frequencyCompositionCards();
      if(frequencyOrder.length !== cards.length) { el.frequencyCompositionFeedback.textContent="Choose every piece, then check the order."; return; }
      el.frequencyCompositionFeedback.textContent=frequencyCompositionIsCorrect(frequencyOrder) ? "Yes. That is the generic construction. In your editor, replace the placeholders with the named case inputs; this practice did not add evidence or write code for you." : "Not yet. The frequency needs the event, and the returned pair needs both. Start again and build from the yes-or-no event.";
    });
    el.resetFrequencyComposition.addEventListener("click",()=>{frequencyOrder=[];renderFrequencyComposition();});
    function focusElement(element) { if (element) element.focus(); }
    el.start.addEventListener("click",()=>{el.scene.hidden=true;el.work.hidden=false;connect();focusElement(el.title);});el.back.addEventListener("click",()=>{el.work.hidden=true;el.scene.hidden=false;focusElement(el.sceneTitle);});el.reconnect.addEventListener("click",connect);el.moves.forEach(button=>button.addEventListener("click",()=>selectMove(button.dataset.move)));el.code.addEventListener("input",()=>{clearRunTimer();persistDraft();});el.run.addEventListener("click",()=>{persistDraft();state=beginRun(state,requestId("c5-run"));if(state.pending){clearResult();send(runMessage(state,el.code.value,state.pending.request_id));const id=state.pending.request_id;runTimer=setTimeout(()=>{const before=state;state=expireRun(state,id);if(state===before)return;resultMessage(state.runFailure);render();el.code.focus();},RUN_DEADLINE_MS);render();}});el.code.addEventListener("keydown",event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter"){event.preventDefault();el.run.click();}});el.next.addEventListener("click",()=>{const destination=el.next.dataset.destination;if(destination==="chapter6"){window.location.assign(nextChapterUrl(location.search));return;}if(destination==="event-frequency")selectMove(destination);});el.nextHint.addEventListener("click",()=>{hint=Math.min(helpStages(state.activeMove).length,hint+1);render();});el.answer.addEventListener("click",()=>{hint=helpStages(state.activeMove).length;render();});el.actionButtons.forEach(button=>button.addEventListener("click",()=>{const action=button.dataset.action;if(!action || !validMetadata(state.metadata))return;state=beginAction(state,requestId("c5-card"),action);if(state.actionPending)send(actionMessage(action,state.actionPending.request_id));render();}));window.addEventListener("pagehide",()=>{stopped=true;clearTimeout(timer);clearInfoTimer();clearRunTimer();timer=null;const old=socket;socket=null;if(old)try{old.close();}catch(_){}});render();
    el.actionButtons.forEach(button => button.addEventListener("click", () => {
      if (state.connection !== "connected" || !state.actionPending) return;
      const id = state.actionPending.request_id;
      clearActionTimer();
      actionTimer = setTimeout(() => {
        const before = state; state = expireAction(state, id); if (state === before) return;
        render();
      }, RUN_DEADLINE_MS);
    }));
  }
  return {CASE_ID,CHAPTER,MOVES,INFO_DEADLINE_MS,RUN_DEADLINE_MS,COPY,helpStage,preEditorBridge,frequencyCompositionCards,frequencyCompositionIsCorrect,challengeRecovery,requestedMove,acceptedMoveKeys,canOpenMove,initialMove,canOpenSocket,connectionMessageForProtocol,openingConnectionMessageForProtocol,createState,initialEditorText,beginInfo,beginRun,applyCaseInfo,failCaseInfo,expireInfo,expireRun,applyCaseResult,isNewAcceptedResult,beginAction,expireAction,applyActionResult,simulationBins,cardEventFeedback,answerCardEvent,hasAnsweredCard,challengeReady,runStatusText,histogramData,validMetadata,caseStatus,disconnect,infoMessage,runMessage,actionMessage,caseBoardUrl,nextChapterUrl,nextDestination,requestId,init};
});

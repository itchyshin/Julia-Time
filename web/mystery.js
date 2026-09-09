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
  function caseLocation(stage) {
    return ({
      intro: "Case 1 of 6 · Meet the case",
      notebook: "Case 1 of 6 · Inspect the notebook",
      practice: "Case 1 of 6 · Learn the selection tool",
      code: "Case 1 of 6 · Make your move",
      result: "Case 1 of 6 · Inspect your evidence",
    })[stage] || "Case 1 of 6 · Meet the case";
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
  function practiceFeedback(code, message) {
    if (message.status === "ok" && /^\d+-element BitVector:/.test(message.value_repr || "")) {
      return "Julia returned a list of yes/no values, not the selected records. BitVector is Julia’s name for this compact boolean list: 1 means true and 0 means false. For a comparison of jars.batch_id, the entries follow the notebook’s row order. Use that list in the rows position of jars[rows, :] to keep the true rows and every column. Practice does not add case evidence.";
    }
    if (message.status === "ok") return "Julia returned this. Practice does not add case evidence.";
    if (/^\s*jars\[\s*\d+\s*:\s*\d+\s*,\s*\]\s*;?\s*$/.test(code) && /getindex.*DataFrame/s.test(message.message || "")) {
      return "You chose the rows, but left the columns blank. Julia needs both: jars[rows, columns]. Put : after the comma to keep all columns, then run again. Your code has not been changed.";
    }
    return "Julia could not run this expression. Check the names and brackets against the example, or open the original error below for more detail. Your code is still here to edit.";
  }
  function challengeRecovery(message) {
    if (message?.status !== "error") return "";
    return "Next step: read the batch_id column as a vector, make a true-or-false row rule from it, then use the first nudge if you need to place that rule in the table. Your draft is unchanged.";
  }
  function restoreStage(value, hasEvidence) { return value === "result" ? (hasEvidence ? "result" : "code") : ["intro", "notebook", "code", "practice"].includes(value) ? value : "intro"; }
  const MAX_RECONNECTS = 3;
  const INFO_DEADLINE_MS = 5000;
  const RUN_DEADLINE_MS = 7000;
  function nextStage(stage) { return ({ intro: "notebook", notebook: "code" })[stage] || stage; }
  function previousStage(stage) { return ({ result: "code", code: "notebook", notebook: "intro", practice:"notebook" })[stage] || "intro"; }
  function hintButtonLabel(shown, total) {
    if (shown >= total) return "All help shown";
    return ["Show a first nudge", "Show the code shape", "Show the complete Julia line"][shown] || "Show more help";
  }
  function hintIndicesThrough(shown, total, completeAnswer) {
    const start = Math.max(0, Math.min(Number.isFinite(shown) ? Math.floor(shown) : 0, Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0));
    const end = completeAnswer ? (Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0) : Math.min(start + 1, Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0);
    return {indices:Array.from({length:Math.max(0, end - start)}, (_, index) => start + index), shown:end};
  }
  function retainedJarIds(rows) { return rows.map(row => row && row.jar_id).filter(id => typeof id === "string"); }
  function discoveryText(rows) {
    if (!rows.length || !rows.every(row => row && typeof row.detected === "boolean")) return "";
    const detected = rows.filter(row => row.detected).length;
    return detected + " of " + rows.length + " retained jars have a recorded detection. That is what this notebook says—not proof of what caused it. Your selection matters: we are now checking Toto’s batch, not mixing in the other batch. The next question is whether these records differ by tray.";
  }
  function createState() { return { connection: "connecting", infoRequestId:null, metadataFailure:"", outstandingRequestId: null, result: null, evidence: null, code: "" }; }
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
  function beginRun(state, requestId, runKind = "case") { return Object.assign({}, state, { outstandingRequestId: requestId, result: null, runKind }); }
  function expireRun(state, requestId) {
    if (!state.outstandingRequestId || state.outstandingRequestId !== requestId) return state;
    return Object.assign({}, state, {outstandingRequestId:null, result:{type:"case_result", status:"timeout", pass:false, feedback:"This check took too long. Your code is still here; check it, then run again."}});
  }
  function cancelRun(state) { return Object.assign({}, state, { outstandingRequestId: null, result: null }); }
  function isCurrentSocket(activeSocket, callbackSocket) { return activeSocket === callbackSocket; }
  function applyCaseResult(state, message) {
    if (!message || message.type !== "case_result" || message.chapter !== "C1" || !state.outstandingRequestId || message.request_id !== state.outstandingRequestId) return state;
    const evidence = state.runKind !== "practice" && message.status === "ok" && message.pass === true && message.evidence ? message.evidence : state.evidence;
    return Object.assign({}, state, { outstandingRequestId: null, result: message, evidence });
  }
  function disconnect(state) { return Object.assign({}, state, { connection: "offline", infoRequestId:null, outstandingRequestId: null }); }
  function persistEvidence(storage, evidence) { try { storage.setItem(EVIDENCE_KEY, JSON.stringify(evidence)); return true; } catch (_) { return false; } }
  function validEvidenceDisplay(value) {
    return Boolean(value && typeof value === "object" && value.evidence &&
      typeof value.evidence === "object" && !Array.isArray(value.evidence) &&
      Array.isArray(value.rows) && value.rows.every(row => row !== null && typeof row === "object") &&
      (value.explanation === null || (typeof value.explanation === "object" && !Array.isArray(value.explanation))));
  }
  function loadEvidence(storage) { try { const raw = storage.getItem(EVIDENCE_KEY); const parsed = raw ? JSON.parse(raw) : null; return validEvidenceDisplay(parsed) ? parsed : null; } catch (_) { return null; } }
  function restoredEvidenceDisplay(saved) {
    return Object.assign({}, saved, { explanation: {
      julia: "These records were saved from a previous visit. This display does not identify how your code selected them. Run your code again to check its current result; open the comparison below to explore indexing and filter.",
      case: "Saved records show which jars were retained, not why a detection was or was not recorded. This is not a fresh check of the case."
    }});
  }
  function persistCode(storage, code) { try { storage.setItem(CODE_KEY, code); return true; } catch (_) { return false; } }
  function loadCode(storage) { try { return storage.getItem(CODE_KEY) || ""; } catch (_) { return ""; } }
  function requestId() { return "c1-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10); }
  function displayCell(value) {
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "display")) {
      return value.type ? String(value.display) + " (" + String(value.type) + ")" : String(value.display);
    }
    return value == null ? "" : String(value);
  }

  function init() {
    const $ = (id) => document.getElementById(id);
    $("new-attempt").addEventListener("click", () => {
      const url = new URL(location.href); url.searchParams.set("attempt", requestId()); url.hash = "";
      location.assign(url.href);
    });
    $("original-save").href = location.pathname;
    $("case-board").href = caseBoardUrl(location.search);
    $("evidence-board").appendChild($("selection-connections").content.cloneNode(true));
    const names = ["connection-text", "reconnect", "case-goal", "return-spec", "data-label", "case-table", "code", "run-status", "run", "reset-code", "result-area", "hint-list", "next-hint", "show-answer", "worked-example", "glossary", "bridge-r", "bridge-python", "evidence-board", "evidence-summary", "evidence-rows", "explanation-julia", "explanation-case"];
    const el = names.reduce((out, name) => { out[name] = $(name); return out; }, {});
    let state = createState(), socket = null, reconnects = 0, reconnectTimer = null, infoTimer = null, runTimer = null, caseInfo = null, hintsShown = 0, stopped = false, storageWarningShown = false, acceptedRows = [];
    function clearInfoTimer() { if (infoTimer) { clearTimeout(infoTimer); infoTimer = null; } }
    function clearRunTimer() { if (runTimer) { clearTimeout(runTimer); runTimer = null; } }
    function expireCurrentRun(id) {
      const before = state; state = expireRun(state, id); if (before === state) return;
      if (state.runKind === "practice") {
        $("practice-output").textContent = state.result.feedback;
      } else {
        renderResult(state.result); showStage("result", false);
      }
      updateRunControl();
    }
    function armRunDeadline(id) { clearRunTimer(); runTimer = setTimeout(() => expireCurrentRun(id), RUN_DEADLINE_MS); }
    let stage = "intro";
    function showStage(next, focus = true) {
      if (stage === "practice" && next !== "practice" && next !== "result" && state.runKind === "practice") { state = cancelRun(state); clearRunTimer(); }
      if (next !== "result" && state.outstandingRequestId) { state = cancelRun(state); clearRunTimer(); }
      stage = next; document.body.dataset.stage = stage;
      if (storage) { try { storage.setItem(STAGE_KEY, stage); } catch (_) {} }
      document.querySelector(".hero").hidden = stage !== "intro";
      document.querySelector(".cast").hidden = stage !== "intro";
      document.querySelector(".case-grid").hidden = stage === "intro" || stage === "practice";
      $("indexing-practice").hidden = stage !== "practice";
      $("learn-indexing").hidden = stage !== "notebook";
      document.querySelector(".brief").hidden = stage === "result";
      document.querySelector(".data-panel").hidden = stage !== "notebook" && stage !== "code";
      document.querySelector(".move-stack").hidden = stage === "notebook";
      document.querySelector(".editor-panel").hidden = stage !== "code";
      document.querySelector(".help-drawer").hidden = stage !== "code";
      el["result-area"].hidden = stage !== "result";
      el["evidence-board"].hidden = stage !== "result" || !state.result?.pass;
      $("step-back").hidden = stage === "intro";
      $("step-next").hidden = stage !== "notebook";
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
      $("practice-heading").textContent = "Choose by a rule, not a position";
      $("practice-explanation").textContent = "The first three rows might be the wrong batch. jars.batch_id reads the batch labels. .== compares each label with a target and returns one true or false per row; the dot means compare each entry.";
      $("practice-shape").textContent = 'jars.batch_id .== "B08"';
      $("practice-task").textContent = 'Replace the earlier indexing expression with the rule shown above: type jars.batch_id .== "B08" for B08 (our practice batch). Each true says keep this row; each false says leave it out. To select whole records, put this yes/no list in the rows position: jars[rule, :]. Then use Toto’s requested batch in the case.';
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
      $("practice-output").textContent = "New practice step: your earlier indexing expression has been cleared. Type the Boolean rule shown above from scratch; this is a different way to select rows.";
      savePractice();
      $("practice-heading").tabIndex = -1; $("practice-heading").focus();
    }
    $("practice-next").addEventListener("click", beginRuleLesson);
    $("practice-code").addEventListener("input", savePractice);
    $("practice-code").addEventListener("input", () => { state = cancelRun(state); updateRunControl(); if (storage) { try { storage.setItem(STORAGE_PREFIX + "practice-code", $("practice-code").value); } catch (_) { if (!storageWarningShown) { storageWarningShown = true; appendNotice("Practice code remains here, but this browser cannot save it."); } } } });
    $("practice-run").addEventListener("click", () => {
      if (state.connection !== "connected" || !caseInfo || state.outstandingRequestId) return;
      const id = requestId(); state = beginRun(state, id, "practice"); armRunDeadline(id); updateRunControl(); $("practice-output").textContent = "Julia is running your practice code…";
      send({type:"case_run",case_id:"missing-fleas-v1",chapter:"C1",code:$("practice-code").value,request_id:id});
    });
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
    if (storage) { state = Object.assign({}, state, { code: loadCode(storage) }); el.code.value = state.code; if (state.code) appendText(el.code.parentElement, "p", "saved-code-note", "Restored your saved code — this is not a supplied answer."); }
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
      el["connection-text"].textContent = detail || state.metadataFailure || ({ connected: "Lab link ready", connecting: "Connecting to the lab…", offline: "Lab link offline" }[next]);
      document.body.dataset.connection = next; el.reconnect.hidden = next !== "offline" && !state.metadataFailure; updateRunControl();
    }
    function updateRunControl() {
      const busy = Boolean(state.outstandingRequestId);
      el.run.disabled = state.connection !== "connected" || busy || !caseInfo;
      $("practice-run").disabled = state.connection !== "connected" || busy || !caseInfo;
      el["run-status"].textContent = busy ? "Checking your result…" : state.metadataFailure || (state.result ? (state.result.pass ? "Evidence recovered" : "Not accepted yet — see feedback") : state.connection === "connected" ? "Lab link ready" : "Code runs when the lab link is ready");
    }
    function socketURL() { return (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"; }
    function connect(manual) {
      if (location.protocol === "file:") {
        stopped = true; setConnection("offline", "Start the Julia server to play"); el.reconnect.hidden = true;
        appendNotice("You opened the page as a file. From the julia-time folder, run the command below, then open http://localhost:8000. The picture can load without Julia, but code cannot run here.");
        appendText($("notices"), "pre", "", "JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 julia --project=. run.jl");
        const start = document.querySelector(".start-link"); start.href = "http://localhost:8000"; start.textContent = "Open the running game →";
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
      if (reconnects >= MAX_RECONNECTS) { setConnection("offline", "Lab link offline — reconnect when you are ready"); return; }
      reconnects += 1; setConnection("connecting", "Reconnecting to the lab (" + reconnects + "/" + MAX_RECONNECTS + ")…"); reconnectTimer = setTimeout(() => connect(false), 1200 * reconnects);
    }
    function send(message) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
    function handleMessage(message) {
      if (isCurrentCaseInfo(state, message)) { clearInfoTimer(); state=Object.assign({},state,{infoRequestId:null,metadataFailure:""}); caseInfo = message; renderCase(message); updateRunControl(); return; }
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
          updateRunControl(); return;
        }
        renderResult(message);
        if (message.status === "ok" && message.pass === true && message.evidence) {
          const display = { evidence: message.evidence, rows: message.rows || [], explanation: message.explanation || null };
          if ((!storage || !persistEvidence(storage, display)) && !storageWarningShown) { storageWarningShown = true; appendNotice("Your evidence is visible, but this browser could not save it for a later visit."); }
          renderEvidence(message.evidence, message.rows || [], message.explanation || null);
        }
        updateRunControl();
        showStage("result", false);
        const outcome = message.status === "ok" && message.pass ? el["evidence-board"] : el["result-area"];
        outcome.tabIndex = -1;
        outcome.focus({ preventScroll: true });
        outcome.scrollIntoView({ block: "start", behavior: "instant" });
        return;
      }
      if (message.type === "error") { const before=state; state=failCaseInfo(state,message); if(before!==state){clearInfoTimer();appendNotice(state.metadataFailure,true);setConnection("offline",state.metadataFailure);} else appendNotice(message.message || "The lab could not read that request.", true); }
    }
    function renderCase(info) {
      el["case-goal"].textContent = info.goal || "Filter the records from disputed batch B09."; el["return-spec"].textContent = info.return_spec || "the filtered records"; el["data-label"].textContent = info.data_label || "Case records";
      renderTable(el["case-table"], info.columns || [], info.rows || []); renderReferences(info); renderHints(info.hints || []);
      highlightSource();
    }
    function highlightSource() {
      const ids = new Set(retainedJarIds(acceptedRows));
      Array.from(el["case-table"].tBodies[0]?.rows || []).forEach((tr, index) => {
        const jar = caseInfo && caseInfo.rows && caseInfo.rows[index] && caseInfo.rows[index].jar_id;
        const retained = ids.has(jar);
        tr.classList.toggle("record-retained", retained);
        if (retained) tr.setAttribute("aria-label", jar + ": retained in your accepted evidence");
        else tr.removeAttribute("aria-label");
      });
    }
    function renderTable(table, columns, rows) {
      const head = table.tHead || table.createTHead(), body = table.tBodies[0] || table.createTBody(); head.textContent = ""; body.textContent = "";
      const hr = document.createElement("tr"); columns.forEach((name) => { const th = document.createElement("th"); th.scope = "col"; th.textContent = String(name); hr.appendChild(th); }); head.appendChild(hr);
      rows.forEach((row) => { const tr = document.createElement("tr"); columns.forEach((name, index) => { const td = document.createElement("td"); const value = Array.isArray(row) ? row[index] : row[name]; td.textContent = displayCell(value); tr.appendChild(td); }); body.appendChild(tr); });
    }
    function renderHints(hints) {
      el["hint-list"].textContent = ""; hintsShown = 0; el["next-hint"].textContent = hints.length ? hintButtonLabel(0, hints.length) : "Hints arrive with the case"; el["next-hint"].disabled = !hints.length;
      function reveal(completeAnswer) {
        const next = hintIndicesThrough(hintsShown, hints.length, completeAnswer);
        next.indices.forEach(index => { const item = document.createElement("li"), hint = hints[index]; item.textContent = typeof hint === "string" ? hint : hint.text || "Hint unavailable."; el["hint-list"].appendChild(item); });
        hintsShown = next.shown; el["next-hint"].textContent = hintButtonLabel(hintsShown, hints.length); el["next-hint"].disabled = hintsShown >= hints.length;
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
      el["bridge-r"].textContent = info.bridge && info.bridge.r || ""; el["bridge-python"].textContent = info.bridge && info.bridge.python || "";
    }
    function run() {
      if (state.connection !== "connected" || !caseInfo || state.outstandingRequestId) return;
      const id = requestId(); state = beginRun(state, id); armRunDeadline(id); updateRunControl(); el["result-area"].textContent = ""; send({ type: "case_run", case_id: "missing-fleas-v1", chapter: "C1", code: state.code, request_id: id });
    }
    function appendText(parent, tag, className, text) { const node = document.createElement(tag); node.className = className || ""; node.textContent = text; parent.appendChild(node); return node; }
    function appendNotice(text, isError) { appendText($("notices"), "p", "notice" + (isError ? " error" : ""), text); }
    function renderResult(result) {
      el["result-area"].textContent = ""; appendText(el["result-area"], "h2", result.pass ? "result-title pass" : "result-title fail", result.pass ? "The evidence holds" : "Not evidence yet");
      if (result.message) appendText(el["result-area"], "p", "result-message", result.message); if (result.stdout) appendText(el["result-area"], "pre", "stdout", result.stdout); if (result.value_repr && !(result.columns && result.columns.length)) appendText(el["result-area"], "pre", "value-repr", "Julia returned:\n" + result.value_repr); if (result.feedback) appendText(el["result-area"], "p", "feedback", result.feedback);
      const recovery = challengeRecovery(result); if (recovery) appendText(el["result-area"], "p", "recovery-next-step", recovery);
      if (Array.isArray(result.rows) && Array.isArray(result.columns) && result.columns.length) {
        let tableParent = el["result-area"];
        if (result.pass) { tableParent = document.createElement("details"); tableParent.className = "returned-details"; appendText(tableParent, "summary", "", "Inspect Julia’s returned table (" + result.rows.length + " rows)"); el["result-area"].appendChild(tableParent); }
        else appendText(tableParent, "p", "wrong-rows-label", result.rows.length + " rows returned by your code:");
        const table = document.createElement("table"); table.className = "returned-table";
        renderTable(table, result.columns, result.rows); tableParent.appendChild(table);
      }
      const back = appendText(el["result-area"], "button", "quiet-button", "Return to your code");
      back.type = "button"; back.onclick = () => showStage("code");
    }
    function renderEvidence(evidence, rows, explanation, restored = false) {
      acceptedRows = rows; highlightSource();
      el["evidence-board"].hidden = false; el["evidence-board"].classList.remove("evidence-arrived"); void el["evidence-board"].offsetWidth; el["evidence-board"].classList.add("evidence-arrived");
      el["evidence-summary"].textContent = (rows.length ? rows.length + " retained record" + (rows.length === 1 ? "" : "s") + " from disputed batch B09. " : "Saved evidence: ") + (evidence.title || evidence.id || "Evidence"); el["evidence-rows"].textContent = "";
      rows.forEach((row, index) => { const card = document.createElement("article"), title = document.createElement("h3"), text = document.createElement("p"); card.className = "evidence-card"; card.style.animationDelay = (index * 70) + "ms"; title.textContent = row.jar_id || "Record " + (index + 1); const jar = document.createElement("div"); jar.className = "evidence-jar"; jar.setAttribute("aria-hidden", "true"); jar.textContent = row.batch_id || ""; text.textContent = Array.isArray(row) ? row.map(displayCell).join(" · ") : Object.keys(row).map((key) => key + ": " + displayCell(row[key])).join(" · "); card.append(jar, title, text); el["evidence-rows"].appendChild(card); });
      let reaction = $("toto-reaction");
      if (!reaction) { reaction = document.createElement("p"); reaction.id = "toto-reaction"; reaction.className = "toto-reaction"; el["evidence-summary"].after(reaction); }
      reaction.textContent = restored ? "Previously saved: " + rows.length + " records from your earlier investigation. Run again for a fresh check." : "Toto: “You found " + rows.length + " records for the report. Now we have the right rows in front of us—not the other batch.”";
      let discovery = $("case-discovery");
      if (!discovery) { discovery = document.createElement("p"); discovery.id = "case-discovery"; reaction.after(discovery); }
      discovery.textContent = restored ? "" : discoveryText(rows);
      el["explanation-julia"].textContent = explanation && explanation.julia || evidence.text || "Julia returned exactly the records you asked it to filter."; el["explanation-case"].textContent = explanation && explanation.case || "Case reading: the retained rows are evidence, not a story invented by the screen.";
      let back = el["evidence-board"].querySelector("button");
      if (!back) { back = appendText(el["evidence-board"], "button", "quiet-button", "Return to your code"); back.type = "button"; back.onclick = () => showStage("code"); }
      let next = $("chapter-two-link");
      if (!next) { next = appendText(el["evidence-board"], "a", "start-link", "Chapter 2: compare the trays →"); next.id="chapter-two-link"; }
      next.href=chapter2Url(location.search);
      el["evidence-board"].querySelector(".complete-line span").textContent="Next, compare the B09 trays. Your Chapter 1 code and evidence stay saved; Chapter 2 uses a separate workspace.";
    }
    el.code.addEventListener("input", () => { clearRunTimer(); state = Object.assign({}, cancelRun(state), { code: el.code.value }); updateRunControl(); if (storage && !persistCode(storage, state.code) && !storageWarningShown) { storageWarningShown = true; appendNotice("Your code remains on screen, but this browser cannot save it for reload."); } });
    el.code.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); run(); } });
    el.run.addEventListener("click", run); el["reset-code"].addEventListener("click", () => { state = Object.assign({}, cancelRun(state), { code: "" }); el.code.value = ""; updateRunControl(); if (storage && !persistCode(storage, "") && !storageWarningShown) { storageWarningShown = true; appendNotice("Your code is reset on screen, but the reset could not be saved."); } el.code.focus(); }); el.reconnect.addEventListener("click", () => connect(true));
    window.addEventListener("pagehide", () => { stopped = true; clearInfoTimer(); clearRunTimer(); state = disconnect(state); clearTimeout(reconnectTimer); if (socket) socket.close(); }); if (!storage) appendNotice("Browser storage is unavailable: evidence and code cannot be restored after reload."); showStage(initialStage, false); connect(false);
  }
  return { STORAGE_PREFIX, EVIDENCE_KEY, CODE_KEY, INFO_DEADLINE_MS, RUN_DEADLINE_MS, createState, beginInfo, failCaseInfo, expireInfo, isCurrentCaseInfo, beginRun, expireRun, cancelRun, isCurrentSocket, applyCaseResult, disconnect, persistEvidence, loadEvidence, persistCode, loadCode, validEvidenceDisplay, displayCell, retainedJarIds, hintButtonLabel, hintIndicesThrough, nextStage, previousStage, restoreStage, practiceFeedback, challengeRecovery, restoredEvidenceDisplay, readPractice, storagePrefix, discoveryText, chapter2Url, caseBoardUrl, caseLocation, init };
});

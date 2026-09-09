/* Julia Time: Missing Fleas C2. The server remains the source of case data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeChapter2 = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.init);
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  function storagePrefix(attempt) { const base = "julia-time:missing-fleas:v1:c2:"; return /^[a-z0-9-]{1,80}$/.test(attempt || "") ? base + "attempt:" + attempt + ":" : base; }
  function caseBoardUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "course/index.html" + (/^[a-z0-9-]{1,80}$/.test(attempt || "") ? "?attempt=" + encodeURIComponent(attempt) : ""); }
  function caseLocation(step) { return ({group:"Case 2 of 6 · Group by tray", counts:"Case 2 of 6 · Count records and detections", rates:"Case 2 of 6 · Calculate rates"})[step] || "Case 2 of 6 · Group by tray"; }
  const attempt = typeof location === "undefined" ? "" : new URLSearchParams(location.search).get("attempt");
  const PREFIX = storagePrefix(attempt), EVIDENCE_KEY = PREFIX + "evidence", STEP_KEY = PREFIX + "step";
  const STEPS = ["group", "counts", "rates"];
  const INFO_DEADLINE_MS = 5000, RUN_DEADLINE_MS = 7000;
  function requestedMove(search) { const move = new URLSearchParams(search || "").get("move"); return STEPS.includes(move) ? move : ""; }
  function hasAcceptedMove(progress, step) { return Boolean(progress && progress.accepted && typeof progress.accepted[step] === "string" && progress.accepted[step].trim()); }
  function canEnterStep(progress, step) {
    const index = STEPS.indexOf(step);
    return index === 0 || (index > 0 && hasAcceptedMove(progress, STEPS[index - 1]));
  }
  function initialStep(progress, requested) {
    const fallback = progress && STEPS.includes(progress.step) ? progress.step : "group";
    if (!STEPS.includes(requested)) return fallback;
    const accepted = progress && progress.accepted && typeof progress.accepted === "object" ? progress.accepted : {};
    const unlocked = accepted.counts ? "rates" : accepted.group ? "counts" : "group";
    return STEPS.indexOf(requested) <= STEPS.indexOf(unlocked) ? requested : unlocked;
  }
  const COPY = {
    group: {title:"First, make tray groups", prompt:"Put the simulated jar records into groups using the tray label.", shape:"groupby(table, column_name)", hints:["The table is called jars. groupby makes a GroupedDataFrame: a set of smaller tables, one per tray.",":tray_id names the tray_id column. The colon is part of Julia’s column-name syntax here; it is not indexing all rows.","Answer reveal: groupby(jars, :tray_id)"], returnSpec:"a group for each tray"},
    counts: {title:"Now count records and detections", prompt:"Starting from your groups, return one row per tray with its record count and recorded detections.", shape:"combine(groups, count_rows => :n, boolean_column => sum => :detected_n)", hints:["combine turns each group into one summary row. nrow counts rows in a group.","=> reads ‘send this to’ or ‘name the result’: nrow => :n calls nrow and names its column n.","Answer reveal: combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n). sum(Bools) counts true values: true acts like 1 and false like 0."], returnSpec:"tray_id, n, detected_n"},
    rates: {title:"Compare proportions, not just totals", prompt:"Extend the summary with each tray’s detected proportion: detections divided by records.", shape:"summary.rate = summary.detected_n ./ summary.n\nsummary", hints:["A rate needs a numerator and denominator. Here it is detected_n / n for each tray.","The dot in ./ means divide each tray’s detected_n by that same tray’s n. Assignment (=) stores the new rate column on summary.", "Answer reveal: after making summary with tray_id, n, and detected_n, write summary.rate = summary.detected_n ./ summary.n, then put summary on the final line. A mean-based alternative is available after success."], returnSpec:"tray_id, n, detected_n, rate"}
  };
  COPY.group.teaching="A row is one jar. groupby is the Julia function that does not count or discard jars: it puts rows with the same tray label together. jars is your supplied B09 table; :tray_id names its tray column. The comma separates the table argument from the column argument. Replace the placeholders in the shape below.";
  COPY.counts.teaching="Give your earlier result a name: put groups = before your grouping expression. The equals sign stores that result as groups. On a new line, combine makes a summary from those groups. nrow => :n means count the rows and call the new column n. :detected => sum => :detected_n means source column → calculation → result name. true counts as 1; false counts as 0. Before running, pick one tray in the source table: how many jars and how many true entries should its summary contain?";
  COPY.rates.shape="summary.new_column = summary.numerator ./ summary.denominator\nsummary";
  COPY.rates.teaching="Keep the grouping and counting code. Put summary = before the expression that produces your count table. Then add a rate column: a recorded detection count divided by a jar count. The dot in ./ divides corresponding entries, one tray at a time; = assigns that new column. Finish with summary on its own line to return the table. Each run starts fresh, so include the earlier expressions too. Here every tray has the same number of jars: counts and proportions will rank them the same. The fraction still tells you the share of jars with a recorded detection—not the number of fleas.";
  const COMPOSITION = Object.freeze({
    counts: Object.freeze([
      Object.freeze({id:"group", text:"groups = groupby(table, group_column)"}),
      Object.freeze({id:"summary", text:"summary = combine(groups, count_rows => :n, boolean_column => sum => :detected_n)"}),
      Object.freeze({id:"return", text:"summary"})
    ]),
    rates: Object.freeze([
      Object.freeze({id:"group", text:"groups = groupby(table, group_column)"}),
      Object.freeze({id:"summary", text:"summary = combine(groups, count_rows => :n, boolean_column => sum => :detected_n)"}),
      Object.freeze({id:"rate", text:"summary.rate = summary.detected_n ./ summary.n"}),
      Object.freeze({id:"return", text:"summary"})
    ])
  });
  function compositionCards(step) { return (COMPOSITION[step] || []).map(card => ({id:card.id, text:card.text})); }
  function compositionIsCorrect(step, order) { const cards=compositionCards(step); return Array.isArray(order) && order.length === cards.length && order.every((id,index) => id === cards[index].id); }
  function lessonCopy(step) { return COPY[step]; }
  function casePurpose(step) {
    return ({
      group:"Put the records from the same tray together so the next check compares like with like.",
      counts:"A tray label alone is not evidence: we need to know how many jars and how many recorded detections belong to each tray.",
      rates:"Trays can hold different numbers of jars. Calculate a share so we can fairly compare trays, not just their totals."
    })[step] || "Use the visible B09 records to make the next checkable move.";
  }
  function allHints(step) { const lesson=lessonCopy(step); return lesson && Array.isArray(lesson.hints) ? lesson.hints.slice() : []; }
  function createState() { return {connection:"connecting", infoRequestId:null, outstandingRequestId:null, metadataFailure:"", activeStep:"group", result:null, evidence:null, unlocked:"group"}; }
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
    return Boolean(state && state.infoRequestId && message && message.type === "case" && message.chapter === "C2" && message.request_id === state.infoRequestId);
  }
  function beginRun(state, requestId, step) { return Object.assign({}, state, {outstandingRequestId:requestId, activeStep:step, result:null}); }
  function cancelRun(state) { return Object.assign({}, state, {outstandingRequestId:null, result:null}); }
  function expireRun(state, requestId) {
    if (!state || !state.outstandingRequestId || state.outstandingRequestId !== requestId) return state;
    return Object.assign({}, state, {outstandingRequestId:null, result:{
      type:"case_result", chapter:"C2", step:state.activeStep, request_id:requestId,
      status:"timeout", pass:false,
      feedback:"This check took too long. Your code is still here; check it, then run again."
    }});
  }
  function leaveInvestigation(state) { return cancelRun(state); }
  function disconnect(state) { return Object.assign({}, state, {connection:"offline", infoRequestId:null, outstandingRequestId:null}); }
  function shouldShowReconnect(state) { return Boolean(state && (state.connection === "offline" || state.metadataFailure)); }
  function validRows(rows, columns, requireRate) {
    if (!Array.isArray(rows) || !Array.isArray(columns) || !rows.every(row => row && typeof row === "object" && !Array.isArray(row))) return false;
    const needed = requireRate ? ["tray_id", "n", "detected_n", "rate"] : ["tray_id", "n", "detected_n"];
    return rows.length > 0 && new Set(rows.map(r => r.tray_id)).size === rows.length && needed.every(k => columns.includes(k)) && rows.every(row => typeof row.tray_id === "string" && Number.isInteger(row.n) && row.n > 0 && Number.isInteger(row.detected_n) && row.detected_n >= 0 && row.detected_n <= row.n && (!requireRate || (Number.isFinite(row.rate) && Math.abs(row.rate-row.detected_n/row.n) < 1e-6)));
  }
  function validEvidenceDisplay(value) { return Boolean(value && validRows(value.rows, value.columns, true)); }
  function applyCaseResult(state, message) {
    if (!message || message.type !== "case_result" || message.chapter !== "C2" || !state.outstandingRequestId || message.request_id !== state.outstandingRequestId || message.step !== state.activeStep) return state;
    const evidence = state.activeStep === "rates" && message.status === "ok" && message.pass === true && validRows(message.rows, message.columns, true) ? {rows:message.rows, columns:message.columns, explanation:message.explanation || null} : state.evidence;
    return Object.assign({}, state, {outstandingRequestId:null, result:message, evidence});
  }
  function persistDraft(storage, step, code) { try { storage.setItem(PREFIX + "draft:" + step, code); return true; } catch (_) { return false; } }
  function loadDraft(storage, step) { try { return storage.getItem(PREFIX + "draft:" + step) || ""; } catch (_) { return ""; } }
  function hasDraft(storage, step) { try { return storage.getItem(PREFIX+"draft:"+step) !== null; } catch (_) { return false; } }
  function saveProgress(storage, progress) { try { storage.setItem(PREFIX + "progress-v2",JSON.stringify(progress)); return true; } catch (_) { return false; } }
  function loadProgress(storage) {
    const empty={step:"group",accepted:{}};
    try { const p=JSON.parse(storage.getItem(PREFIX+"progress-v2")||"null");
      if(!p || !STEPS.includes(p.step) || !p.accepted || typeof p.accepted !== "object") return empty;
      return {step:p.step,accepted:Object.fromEntries(STEPS.filter(s => typeof p.accepted[s] === "string").map(s => [s,p.accepted[s]]))};
    } catch (_) { return empty; }
  }
  function persistEvidence(storage, evidence) { try { storage.setItem(EVIDENCE_KEY, JSON.stringify(evidence)); return true; } catch (_) { return false; } }
  function loadEvidence(storage) { try { const v = JSON.parse(storage.getItem(EVIDENCE_KEY) || "null"); return validEvidenceDisplay(v) ? v : null; } catch (_) { return null; } }
  function rackLabels(rows) { return Array.isArray(rows) ? rows.map(r => r.tray_id + ": " + r.detected_n + " / " + r.n + " = " + r.rate) : []; }
  function rateExample(rows) { if (!Array.isArray(rows)) return null; const first=rows.find(row=>row&&typeof row.tray_id==="string"&&typeof row.detected==="boolean"); if(!first)return null;const trayRows=rows.filter(row=>row&&row.tray_id===first.tray_id&&typeof row.detected==="boolean"), detected=trayRows.filter(row=>row.detected).length;return {tray_id:first.tray_id,detected_n:detected,n:trayRows.length,rate:detected/trayRows.length}; }
  function groupingPreview(rows) {
    if (!Array.isArray(rows)) return [];
    const groups = new Map();
    rows.forEach(row => {
      if (!row || typeof row.tray_id !== "string" || !row.tray_id || typeof row.jar_id !== "string" || !row.jar_id) return;
      if (!groups.has(row.tray_id)) groups.set(row.tray_id, []);
      groups.get(row.tray_id).push(row.jar_id);
    });
    return Array.from(groups, ([tray_id, jar_ids]) => ({tray_id, jar_ids}));
  }
  function groupingPreviewMessage() { return "You gathered the same supplied jars into tray groups. Julia's grouping operation needs the supplied table jars and the tray-column name :tray_id; use the code shape below to put those ingredients in place. This was practice, so no case evidence was added."; }
  function jarMarks(row) { return row && Number.isInteger(row.n) && row.n > 0 && row.n <= 100 && Number.isInteger(row.detected_n) && row.detected_n >= 0 && row.detected_n <= row.n ? Array.from({length:row.n},(_,i)=>i<row.detected_n) : []; }
  function nextStep(step, result) { return result && result.status === "ok" && result.pass === true && result.step === step ? ({group:"counts", counts:"rates", rates:"chapter3"})[step] || null : null; }
  function nextChapterUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "chapter3.html" + (/^[a-z0-9-]{1,80}$/.test(attempt || "") ? "?attempt=" + encodeURIComponent(attempt) : ""); }
  function carryDraft(step, priorDraft, priorAccepted) { return priorAccepted && ["counts", "rates"].includes(step) && typeof priorDraft === "string" ? priorDraft : ""; }
  function blockedStepMessage(step) {
    const prior = STEPS[STEPS.indexOf(step) - 1];
    const label = ({group:"grouping", counts:"counting"})[prior] || "earlier";
    return "This move uses the " + label + " line from the previous move. Each Julia check starts fresh, so finish that move first (or use its deliberate full-answer reveal if you already know it). Your draft is safe.";
  }
  function displayError(message) { return String(message && (message.message || message.error || message.value_repr) || "No error detail was returned."); }
  function resultText(message) { const explanation = message && message.explanation; const parts = [message && (message.feedback || message.message)]; if (message && message.value_repr) parts.push("Julia returned: " + message.value_repr); if (explanation && explanation.julia) parts.push(explanation.julia); if (explanation && explanation.case) parts.push(explanation.case); return parts.filter(Boolean).join(" ") || (message && message.status === "error" ? displayError(message) : "No explanation was returned."); }
  function requestId() { return "c2-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function isCurrentSocket(active, callback) { return active === callback; }

  function init() {
    const $ = id => document.getElementById(id); let storage = null; try { storage = localStorage; } catch (_) {}
    let state = createState(), socket = null, caseInfo = null, hints = 0, reconnects = 0, timer = null, infoTimer = null, runTimer = null, stopped=false, compositionOrder=[];
    const progress=loadProgress(storage);
    state.unlocked=progress.accepted.counts ? "rates" : progress.accepted.group ? "counts" : "group";
    const el = {code:$("code"), run:$("run"), status:$("run-status"), output:$("result"), rows:$("returned-rows"), sourceRows:$("source-rows"), rack:$("rack"), liveRack:$("live-rack"), groupingPreview:$("grouping-preview"), groupingPreviewResult:$("grouping-preview-result"), showGroups:$("show-groups"), stepTitle:$("step-title"), prompt:$("step-prompt"), purpose:$("case-purpose"), shape:$("code-shape"), hints:$("hints"), hint:$("show-hint"), answer:$("show-answer"), connection:$("connection"), reconnect:$("reconnect"), question:$("question"), draftNote:$("draft-note"), next:$("next-move"), rateParts:$("rate-parts"), composition:$("composition-scaffold"), compositionCards:$("composition-cards"), compositionFeedback:$("composition-feedback"), checkComposition:$("check-composition"), resetComposition:$("reset-composition")};
    const saved = storage ? loadEvidence(storage) : null; if (saved) { state.evidence = saved; renderEvidence(saved, true); }
    function current() { return COPY[state.activeStep]; }
    function clearRunTimer() { if(runTimer) { clearTimeout(runTimer); runTimer=null; } }
    function clearInfoTimer() { if(infoTimer) { clearTimeout(infoTimer); infoTimer=null; } }
    function renderComposition() {
      const cards=compositionCards(state.activeStep);
      el.composition.hidden=cards.length === 0;
      el.compositionCards.replaceChildren();
      if (!cards.length) return;
      cards.slice().reverse().forEach(card => {
        const button=document.createElement("button");
        button.type="button";
        button.textContent=card.text;
        button.disabled=compositionOrder.includes(card.id);
        button.addEventListener("click",()=>{compositionOrder.push(card.id);renderComposition();});
        el.compositionCards.append(button);
      });
      el.compositionFeedback.textContent=compositionOrder.length === 0 ? "Choose the first piece." : "Your construction: " + compositionOrder.map(id => cards.find(card => card.id === id).text).join(" → ");
    }
    function showTimeout() { el.output.replaceChildren(); const copy=document.createElement("p"); copy.textContent=state.result.feedback; el.output.append(copy); }
    function setStep(step, focus=true) {
      clearRunTimer();
      if (!STEPS.includes(step)) return;
      if (!canEnterStep(progress, step)) {
        el.output.textContent = blockedStepMessage(step);
        const prior = STEPS[STEPS.indexOf(step) - 1];
        const priorButton = document.querySelector('.moves > [data-step="' + prior + '"]');
        if (focus && priorButton) priorButton.focus();
        return;
      }
      state = cancelRun(state); state.activeStep = step; hints = 0; compositionOrder=[];
      $("course-location").textContent = caseLocation(step);
      el.stepTitle.textContent = current().title; el.prompt.textContent = current().prompt; el.purpose.textContent = casePurpose(step); el.shape.textContent = current().shape; $("return-spec").textContent = current().returnSpec;
      $("step-teaching").textContent=current().teaching;
      el.rateParts.hidden=step!=="rates";
      let draft = storage ? loadDraft(storage, step) : "";
      const prior = STEPS[STEPS.indexOf(step) - 1];
      if (!hasDraft(storage,step) && prior) draft = carryDraft(step, progress.accepted[prior], typeof progress.accepted[prior] === "string");
      progress.step=step; saveProgress(storage,progress);
      el.code.value = draft; el.draftNote.textContent = draft ? (storage && loadDraft(storage, step) ? "Restored your saved draft for this move; it is not supplied code." : "Your accepted previous move is carried into this fresh sandbox. Add the next operation yourself.") : "This editor begins empty. Your typing is saved separately for this move.";
      el.hints.textContent = ""; el.hint.textContent = "Show a first nudge"; el.output.replaceChildren(); el.rows.replaceChildren(); el.liveRack.replaceChildren(); el.next.hidden = true; renderComposition();
      if (caseInfo) renderCase(caseInfo);
      document.querySelectorAll(".moves > [data-step]").forEach(b => { b.setAttribute("aria-current", b.dataset.step === step ? "step" : "false"); b.disabled = !canEnterStep(progress, b.dataset.step); }); updateControls(); if(focus) { el.stepTitle.tabIndex=-1; el.stepTitle.focus(); }
    }
    function updateControls() { el.run.disabled = state.connection !== "connected" || !caseInfo || Boolean(state.outstandingRequestId); el.status.textContent = state.outstandingRequestId ? "Checking your Julia result…" : state.metadataFailure || (state.connection === "connected" ? "Ready when you are" : "Connect to the lab to run Julia"); el.reconnect.hidden = !shouldShowReconnect(state); }
    function plain(value) { return value == null ? "" : typeof value === "object" ? (value.display == null ? JSON.stringify(value) : String(value.display)) : String(value); }
    function renderTable(rows, columns, target = el.rows) { target.replaceChildren(); if (!Array.isArray(rows) || !Array.isArray(columns)) return; const table = document.createElement("table"), head = document.createElement("thead"), tr = document.createElement("tr"); columns.forEach(c => { const th=document.createElement("th"); th.textContent=c; tr.append(th); }); head.append(tr); table.append(head); const body=document.createElement("tbody"); rows.forEach(row => { const r=document.createElement("tr"); columns.forEach(c => { const td=document.createElement("td"); td.textContent=plain(row[c]); r.append(td); }); body.append(r); }); table.append(body); target.append(table); }
    function renderGroupingPreview(rows) {
      el.groupingPreview.replaceChildren();
      groupingPreview(rows).forEach(group => {
        const card=document.createElement("article"), heading=document.createElement("h4"), jars=document.createElement("div");
        heading.textContent=group.tray_id; jars.className="jars";
        group.jar_ids.forEach(jar_id => { const jar=document.createElement("span"); jar.className="jar"; jar.textContent=jar_id; jars.append(jar); });
        card.append(heading,jars); el.groupingPreview.append(card);
      });
      el.groupingPreviewResult.textContent = groupingPreviewMessage();
    }
    function renderRack(step, rows, target=el.liveRack) {
      target.replaceChildren(); if (!Array.isArray(rows)) return;
      const byTray=new Map(); rows.forEach(row=>{const tray=String(row.tray_id); if(!byTray.has(tray))byTray.set(tray,[]); byTray.get(tray).push(row);});
      byTray.forEach((items,tray)=>{
        const card=document.createElement("article"), h=document.createElement("h3"), jars=document.createElement("div");
        h.textContent=tray; jars.className="jars"; card.append(h);
        const labels=step === "group" ? items.map(row=>String(row.jar_id)) : jarMarks(items[0]).map(d=>d ? "✓ detected" : "– not detected");
        labels.forEach((label,i)=>{const jar=document.createElement("span"); jar.className="jar"; jar.style.animationDelay=(i*70)+"ms"; jar.textContent=label; jars.append(jar);}); card.append(jars);
        if(step !== "group") {const row=items[0], p=document.createElement("p"); p.textContent=row.detected_n+" detected / "+row.n+" jars"+(step === "rates" ? " = "+row.rate+" ("+Math.round(row.rate*100)+"%)" : ""); card.append(p);}
        target.append(card);
      });
      if(step !== "group") {const note=document.createElement("small"); note.textContent="Each symbol represents one counted jar, not a particular jar ID."; target.append(note);}
    }
    function renderEvidence(evidence, restored) { renderRack("rates",evidence.rows,el.rack); $("evidence").hidden=false; $("comparisons").hidden=restored; $("evidence-copy").textContent = restored ? "Unverified saved display from this browser, not a fresh lab check. Saved data can be changed or become stale. Run the final move again to verify these values against the server's B09 records." : "These are your checked returned summaries. They describe recorded detections by tray, not a cause. Pick two trays: explain their detected counts, jar counts and proportions. What would you want to check in the handling log next?"; }
    function renderCase(message) { caseInfo = message; state = Object.assign({}, state, {infoRequestId:null, metadataFailure:""}); clearInfoTimer(); const q = message.question || message.goal || "Do recorded detections differ by tray?"; el.question.textContent=q; if (Array.isArray(message.rows) && Array.isArray(message.columns)) renderTable(message.rows, message.columns, el.sourceRows); const example=rateExample(message.rows);if(state.activeStep==="rates"&&example)el.rateParts.innerHTML=`<strong>Rate parts:</strong> In tray <code>${example.tray_id}</code>, <code>detected_n</code> is ${example.detected_n} and <code>n</code> is ${example.n}, so <code>${example.detected_n} / ${example.n} = ${example.rate}</code>. Julia applies that matching division to every tray with <code>detected_n ./ n</code>.`; updateControls(); }
    function handle(message) {
      if (isCurrentCaseInfo(state, message)) return renderCase(message);
      if (message.type === "error") { const before=state; state=failCaseInfo(state,message); if(before!==state) { clearInfoTimer(); el.sourceRows.textContent=state.metadataFailure; updateControls(); } return; }
      const before=state; state=applyCaseResult(state,message); if (before===state) return;
      clearRunTimer();
      const result=state.result; el.output.replaceChildren(); el.next.hidden=true;
      const copy=document.createElement("p");
      copy.textContent=resultText(Object.assign({},result,{value_repr:""})); el.output.append(copy);
      if(result.value_repr || result.message || result.stdout) {
        const raw=document.createElement("details"), summary=document.createElement("summary"), pre=document.createElement("pre");
        summary.textContent=result.status === "error" ? "Original Julia error" : "Actual Julia output";
        pre.textContent=[result.stdout,result.message,result.value_repr].filter(Boolean).join("\n"); raw.append(summary,pre); el.output.append(raw);
      }
      if (Array.isArray(result.rows) && Array.isArray(result.columns)) renderTable(result.rows,result.columns);
      el.liveRack.replaceChildren();
      if(result.status === "ok" && result.pass === true) {
        renderRack(result.step,result.rows);
        progress.accepted[state.activeStep]=el.code.value; saveProgress(storage,progress);
        const next=nextStep(state.activeStep,result);
        if(next) { if(next !== "chapter3" && STEPS.indexOf(next)>STEPS.indexOf(state.unlocked)) state.unlocked=next; el.next.hidden=false; el.next.dataset.destination=next; el.next.textContent=next === "chapter3" ? "Next: connect the report to the handling log →" : "Next move: " + COPY[next].title + " →"; }
      }
      if(state.evidence) {
        const fresh=state.evidence !== before.evidence;
        if(fresh && storage) persistEvidence(storage,state.evidence);
        renderEvidence(state.evidence,!fresh);
      }
      updateControls();
    }
    function send(msg) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg)); }
    function connect() { if(stopped) return; clearInfoTimer(); clearRunTimer(); if (location.protocol === "file:") { state.connection="offline"; el.connection.textContent="Start the Julia server: open http://127.0.0.1:8000 after running run.jl"; updateControls(); return; } clearTimeout(timer); state=disconnect(state); caseInfo=null; const old=socket; socket=null; if(old) old.close(); state.connection="connecting"; el.connection.textContent="Connecting to the lab…"; updateControls(); try { socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"); } catch (_) { return retry(); } const ws=socket;
      ws.addEventListener("open", () => { if(!isCurrentSocket(socket,ws)) return; reconnects=0; state.connection="connected"; el.connection.textContent="Lab link ready"; const id=requestId(); state=beginInfo(state,id); updateControls(); send({type:"case_info", chapter:"C2", request_id:id}); infoTimer=setTimeout(()=>{const before=state;state=expireInfo(state,id);if(state!==before){el.sourceRows.textContent=state.metadataFailure;updateControls();}},INFO_DEADLINE_MS); });
      ws.addEventListener("message", event => { if(!isCurrentSocket(socket,ws)) return; try { handle(JSON.parse(event.data)); } catch (_) {} });
      ws.addEventListener("close", () => { if(!isCurrentSocket(socket,ws)) return; clearInfoTimer(); clearRunTimer(); state=disconnect(state); retry(); });
    }
    function retry() { if(stopped) return; clearInfoTimer(); state=disconnect(state); updateControls(); if (++reconnects > 3) { el.connection.textContent="Lab link offline — your draft is still here."; return; } el.connection.textContent="Lab link interrupted — reconnecting…"; timer=setTimeout(connect, 1000 * reconnects); }
    document.querySelectorAll(".moves [data-step]").forEach(b => b.addEventListener("click", () => setStep(b.dataset.step)));
    el.showGroups.addEventListener("click", () => {
      if (!caseInfo || !Array.isArray(caseInfo.rows)) { el.groupingPreviewResult.textContent="The jar records are still loading. Your code draft is unaffected."; return; }
      renderGroupingPreview(caseInfo.rows);
    });
    el.checkComposition.addEventListener("click",()=>{
      const cards=compositionCards(state.activeStep);
      if (!cards.length) return;
      if (compositionOrder.length !== cards.length) { el.compositionFeedback.textContent="Choose every piece, then check the order."; return; }
      el.compositionFeedback.textContent=compositionIsCorrect(state.activeStep,compositionOrder) ? "Yes. That is the generic build order. In your editor, replace the placeholders with the named case inputs; this practice did not add evidence or write code for you." : "Not yet. A later line needs a name made by an earlier line. Start again and build from the input table toward the returned summary.";
    });
    el.resetComposition.addEventListener("click",()=>{compositionOrder=[];renderComposition();});
    el.code.addEventListener("input", () => { clearRunTimer(); state=cancelRun(state); el.next.hidden=true; if(storage) persistDraft(storage,state.activeStep,el.code.value); updateControls(); });
    el.code.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); el.run.click(); } });
    el.run.addEventListener("click", () => { if(el.run.disabled) return; const id=requestId(); state=beginRun(state,id,state.activeStep); updateControls(); el.output.textContent="Julia is checking this move (usually under two seconds)…"; send({type:"case_run", case_id:"missing-fleas-v1", chapter:"C2", step:state.activeStep, code:el.code.value, request_id:id}); runTimer=setTimeout(() => { const before=state; state=expireRun(state,id); if(state===before) return; showTimeout(); updateControls(); el.code.focus(); }, RUN_DEADLINE_MS); });
    function revealHints(lastIndex) {
      const list=allHints(state.activeStep);
      while(hints <= lastIndex && hints < list.length) { const p=document.createElement("p"); p.textContent=list[hints++]; el.hints.append(p); }
      el.hint.textContent=hints === list.length ? "All help shown" : hints === 1 ? "Show the code shape" : "Reveal the complete answer";
    }
    el.hint.addEventListener("click", () => revealHints(hints));
    el.answer.addEventListener("click", () => revealHints(Number.POSITIVE_INFINITY));
    el.next.addEventListener("click", () => { const next=el.next.dataset.destination || nextStep(state.activeStep,state.result); if(next === "chapter3") { location.assign(nextChapterUrl(location.search)); return; } if(next) setStep(next); });
    $("back-c1").href = "index.html" + (attempt ? "?attempt=" + encodeURIComponent(attempt) : "");
    $("case-board").href = caseBoardUrl(location.search);
    $("new-attempt").addEventListener("click", () => { const url=new URL(location.href); url.searchParams.set("attempt",requestId()); location.assign(url.href); });
    setStep(initialStep(progress, requestedMove(location.search)),false);
    $("start-investigation").addEventListener("click", () => {
      $("scene").hidden=true; $("investigation").hidden=false;
      el.stepTitle.tabIndex=-1; el.stepTitle.focus();
    });
    $("back-to-scene").addEventListener("click", () => {
      state=leaveInvestigation(state); el.output.textContent=""; updateControls();
      $("investigation").hidden=true; $("scene").hidden=false;
      $("title").focus();
    });
    $("reconnect").addEventListener("click", () => { reconnects=0; connect(); });
    window.addEventListener("pagehide", () => { stopped=true; clearTimeout(timer); clearInfoTimer(); clearRunTimer(); state=cancelRun(state); if(socket) socket.close(); }); connect();
  }
  return {INFO_DEADLINE_MS, RUN_DEADLINE_MS, storagePrefix, caseBoardUrl, caseLocation, nextChapterUrl, requestedMove, initialStep, canEnterStep, blockedStepMessage, createState, beginInfo, failCaseInfo, expireInfo, isCurrentCaseInfo, beginRun, cancelRun, expireRun, leaveInvestigation, disconnect, shouldShowReconnect, applyCaseResult, validEvidenceDisplay, persistDraft, loadDraft, hasDraft, saveProgress, loadProgress, persistEvidence, loadEvidence, rackLabels, rateExample, groupingPreview, groupingPreviewMessage, jarMarks, nextStep, carryDraft, resultText, displayError, isCurrentSocket, lessonCopy, casePurpose, allHints, compositionCards, compositionIsCorrect, init};
});

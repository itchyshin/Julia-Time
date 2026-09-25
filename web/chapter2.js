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
    group: {title:"First, make tray groups", prompt:"Put the simulated jar records into groups using the tray label.", shape:"Start with the supplied jars table. Group its rows by the tray_id column. Return the groups so Julia can show one group for each tray.", hints:["The table is called jars. groupby makes a GroupedDataFrame: a set of smaller tables, one per tray.",":tray_id names the tray_id column. The colon is part of Julia’s column-name syntax here; it is not indexing all rows."], answerCode:"groupby(jars, :tray_id)", returnSpec:"a group for each tray"},
    counts: {title:"Now count records and detections", prompt:"Use the supplied jar table to build tray groups and return one row per tray with its record count and recorded detections.", shape:"Make tray groups from jars, then combine them into one summary row per tray. combine takes pairs: nrow => :n counts the rows, and :detected => sum => :detected_n counts the true values.", hints:["A fresh Julia run starts with the supplied jars table, so first create groups again and give that result a name.","combine turns each group into one summary row. nrow => :n counts rows and names that new column n; true values contribute 1 when sum counts :detected."], answerCode:"groups = groupby(jars, :tray_id)\ncombine(groups, nrow => :n, :detected => sum => :detected_n)", returnSpec:"tray_id, n, detected_n"},
    rates: {title:"Compare proportions, not just totals", prompt:"Build the tray summary again, then add each tray’s detected proportion: detections divided by records.", shape:"Build one summary row per tray from jars, as in move 2. Add a rate column by dividing with the dot: detected_n ./ n divides tray by tray. Return the completed summary table.", hints:["Give the summary table a name, such as summary. Its columns are then summary.detected_n and summary.n; on their own, detected_n and n are not names Julia knows.","A rate needs a numerator and denominator: detected_n ./ n. The dot divides each tray’s matching entries, and = stores the new rate column on summary."], answerCode:"summary = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\nsummary.rate = summary.detected_n ./ summary.n\nsummary", returnSpec:"tray_id, n, detected_n, rate"}
  };
  COPY.group.teaching="A row is one jar. groupby is the Julia function that does not count or discard jars: it puts rows with the same tray label together. jars is your supplied B09 table; :tray_id names its tray column. The comma separates the table argument from the column argument. Check the exact names in the “Use these real names” card below.";
  COPY.counts.teaching="Every Run Julia check starts with the supplied jars table. Make groups in this same editor, then combine them into one row per tray. nrow => :n means count the rows and call the new column n. :detected => sum => :detected_n means source column → calculation → result name. true counts as 1; false counts as 0. Before running, pick one tray in the source table: how many jars and how many true entries should its summary contain?";
  COPY.rates.teaching="Every Run Julia check starts with jars, so this move needs a complete little script: build the summary, add a rate column, then return summary. The dot in ./ divides corresponding entries, one tray at a time; = assigns that new column. Here every tray has the same number of jars: counts and proportions will rank them the same. The fraction still tells you the share of jars with a recorded detection—not the number of fleas.";
  const COMPOSITION = Object.freeze({
    counts: Object.freeze([
      Object.freeze({id:"group", text:"groups = groupby(jars, :tray_id)"}),
      Object.freeze({id:"summary", text:"summary = combine(groups, nrow => :n, :detected => sum => :detected_n)"}),
      Object.freeze({id:"return", text:"summary"})
    ]),
    rates: Object.freeze([
      Object.freeze({id:"group", text:"groups = groupby(jars, :tray_id)"}),
      Object.freeze({id:"summary", text:"summary = combine(groups, nrow => :n, :detected => sum => :detected_n)"}),
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
      rates:"Calculate a share so we can fairly compare trays of any size, not just their totals."
    })[step] || "Use the visible B09 records to make the next checkable move.";
  }
  // T2 (2026-09-12 playtest): the code shape used to render unconditionally in the main task
  // body, above the real input names, turning the move into substitution rather than a decision.
  // It is now the first staged hint, one click away, same as the rest of the hint sequence.
  function allHints(step) { const lesson=lessonCopy(step); if (!lesson) return []; return [lesson.shape, ...(Array.isArray(lesson.hints) ? lesson.hints : [])]; }
  // UI-09 (2026-09-24): the first staged hint is a plain-language plan, so its button offers the
  // smallest help first, as in C1, and the exhausted button is disabled rather than a no-op.
  function hintButtonLabel(shown, total) {
    if (shown >= total) return "All hints shown";
    if (shown === 0) return "Show a first nudge";
    return shown === total - 1 ? "Show the last hint" : "Show the next hint";
  }
  function freshRunNote(step) {
    return ({
      group:"Each run starts fresh from jars. Julia returns the value of your last line, so end with the groups.",
      counts:"Each run starts fresh from jars, so make the groups again here. Julia returns the value of your last line, so end with the summary table.",
      rates:"Each run starts fresh from jars, so build the summary again here. Julia returns the value of your last line, so end with summary on its own line."
    })[step] || "";
  }
  function createState() { return {connection:"connecting", infoRequestId:null, outstandingRequestId:null, expired:false, statusMessage:null, metadataFailure:"", activeStep:"group", result:null, evidence:null, unlocked:"group"}; }
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
  function beginRun(state, requestId, step) { return Object.assign({}, state, {outstandingRequestId:requestId, expired:false, statusMessage:null, activeStep:step, result:null}); }
  function cancelRun(state) { return Object.assign({}, state, {outstandingRequestId:null, expired:false, statusMessage:null, result:null}); }
  // Kept (not nulled) on expiry so a correct result arriving late for this same request is still
  // applied rather than discarded (B1); `isRunPending` makes the run retryable in the meantime.
  function expireRun(state, requestId) {
    if (!state || !state.outstandingRequestId || state.outstandingRequestId !== requestId) return state;
    return Object.assign({}, state, {expired:true, statusMessage:null, result:{
      type:"case_result", chapter:"C2", step:state.activeStep, request_id:requestId,
      status:"timeout", pass:false,
      feedback:"This check took too long. Your code is still here; check it, then run again."
    }});
  }
  function isRunPending(state) { return Boolean(state.outstandingRequestId) && !state.expired; }
  function applyRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.outstandingRequestId || state.expired || message.request_id !== state.outstandingRequestId) return state;
    return Object.assign({}, state, {statusMessage: message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : ""});
  }
  function leaveInvestigation(state) { return cancelRun(state); }
  function disconnect(state) { return Object.assign({}, state, {connection:"offline", infoRequestId:null, outstandingRequestId:null, expired:false, statusMessage:null}); }
  function shouldShowReconnect(state) { return Boolean(state && (state.connection === "offline" || state.metadataFailure)); }
  function validRows(rows, columns, requireRate) {
    if (!Array.isArray(rows) || !Array.isArray(columns) || !rows.every(row => row && typeof row === "object" && !Array.isArray(row))) return false;
    const needed = requireRate ? ["tray_id", "n", "detected_n", "rate"] : ["tray_id", "n", "detected_n"];
    return rows.length > 0 && new Set(rows.map(r => r.tray_id)).size === rows.length && needed.every(k => columns.includes(k)) && rows.every(row => typeof row.tray_id === "string" && Number.isInteger(row.n) && row.n > 0 && Number.isInteger(row.detected_n) && row.detected_n >= 0 && row.detected_n <= row.n && (!requireRate || (Number.isFinite(row.rate) && Math.abs(row.rate-row.detected_n/row.n) < 1e-6)));
  }
  function validEvidenceDisplay(value) { return Boolean(value && validRows(value.rows, value.columns, true)); }
  function applyCaseResult(state, message) {
    if (!message || message.type !== "case_result" || message.chapter !== "C2" || !state.outstandingRequestId || message.request_id !== state.outstandingRequestId || message.step !== state.activeStep) return state;
    const evidence = state.activeStep === "rates" && message.status === "ok" && message.pass === true && validRows(message.rows, message.columns, true) ? {rows:message.rows, columns:message.columns, explanation:message.explanation || null, row_text:Array.isArray(message.row_text) ? message.row_text : null} : state.evidence;
    return Object.assign({}, state, {outstandingRequestId:null, expired:false, statusMessage:null, result:message, evidence});
  }
  function persistDraft(storage, step, code) { try { storage.setItem(PREFIX + "draft:" + step, code); return true; } catch (_) { return false; } }
  function loadDraft(storage, step) { try { return storage.getItem(PREFIX + "draft:" + step) || ""; } catch (_) { return ""; } }
  function hasDraft(storage, step) { try { return storage.getItem(PREFIX+"draft:"+step) !== null; } catch (_) { return false; } }
  function starterDraft(storage, step) {
    const draft = storage ? loadDraft(storage, step) : "";
    if (!/\b(?:table|group_column|count_rows|boolean_column|numerator|denominator)\b/.test(draft)) return draft;
    try { storage.removeItem(PREFIX + "draft:" + step); } catch (_) {}
    return "";
  }
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
  function groupingPreviewMessage() { return "You gathered the same supplied jars into tray groups. Julia's grouping operation needs the supplied table jars and the tray-column name :tray_id; the tiny code example below shows where each one goes. This was practice, so no case evidence was added."; }
  function jarMarks(row) { return row && Number.isInteger(row.n) && row.n > 0 && row.n <= 100 && Number.isInteger(row.detected_n) && row.detected_n >= 0 && row.detected_n <= row.n ? Array.from({length:row.n},(_,i)=>i<row.detected_n) : []; }
  // Repair 5 (2026-09-24 browser walk-through): an accepted rates run also fills the Descriptive
  // summary's tray rack, so the returned-evidence panel does not draw the same rack a second time.
  function showsLiveRack(result, freshEvidence) { return Boolean(result && result.status === "ok" && result.pass === true && !freshEvidence); }
  function nextStep(step, result) { return result && result.status === "ok" && result.pass === true && result.step === step ? ({group:"counts", counts:"rates", rates:"chapter3"})[step] || null : null; }
  function nextChapterUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "chapter3.html" + (/^[a-z0-9-]{1,80}$/.test(attempt || "") ? "?attempt=" + encodeURIComponent(attempt) : ""); }
  function blockedStepMessage(step) {
    const prior = STEPS[STEPS.indexOf(step) - 1];
    const label = ({group:"grouping", counts:"counting"})[prior] || "earlier";
    return "This move uses the " + label + " line from the previous move. Each Julia check starts fresh, so finish that move first (or use its deliberate full-answer reveal if you already know it). Your draft is safe.";
  }
  function displayError(message) { return String(message && (message.message || message.error || message.value_repr) || "No error detail was returned."); }
  // UI-12 and playtest stopping points (2026-09-24): each line below is keyed on the sandbox's
  // actual error text for a common C2 mistake (pinned in test/test_mystery_c2.jl). It names the
  // habit and leads the chapter's existing recovery copy; Julia's own error stays verbatim below.
  function c2ErrorNextStep(message) {
    if (!message || message.status !== "error") return "";
    const detail = displayError(message), step = message.step;
    if (/\b(?:table|group_column|count_rows|boolean_column|numerator|denominator)\b.*(?:not defined|doesn't exist)|(?:not defined|doesn't exist).*\b(?:table|group_column|count_rows|boolean_column|numerator|denominator)\b/i.test(detail)) return "That is a template word, not one of this chapter's inputs. Use the named B09 inputs above: jars, :tray_id, nrow, and :detected. Or use Show the complete answer just above your editor.";
    const column = detail.match(/UndefVarError: `(tray_id|detected)` not defined/);
    if (column) return column[1] + " is a column of jars, not a name Julia knows on its own. Name the column with a colon: :" + column[1] + ".";
    // Repair 3 (R5, 2026-09-24 re-test): the counts and group stopping points below were left with
    // only the generic line. Each is keyed on the sandbox's actual text (pinned in test_mystery_c2.jl).
    if (/UndefVarError: `practice_jars` not defined/.test(detail)) return "practice_jars is the table in the tiny code example only. This case's supplied table is jars: keep the same shape and write jars in its place.";
    const pairFor = name => name === "n" ? "nrow => :n" : ":detected => sum => :detected_n";
    const newColumn = step === "counts" && detail.match(/UndefVarError: `(detected_n|n)` not defined/);
    if (newColumn) return newColumn[1] + " is a new column that combine makes, so Julia does not know it as a name yet. Write the new name with a colon, as in " + pairFor(newColumn[1]) + ".";
    const reversed = step !== "group" && detail.match(/column name (?::|")(detected_n|n)"? not found/);
    // Repair 4: in rates the same text also comes from a dot read of a column combine never made
    // (summary.n after nrow => :count), so rates gets a line that is true for both causes.
    if (reversed && step === "rates") return "Julia looked for a column named " + reversed[1] + ", and the table has no column with that name. In combine, the new column's name comes last in each pair, like " + pairFor(reversed[1]) + ".";
    if (reversed) return "Julia looked for a column named " + reversed[1] + " before combine made it. In a combine pair the source comes first and the new name goes last: " + pairFor(reversed[1]) + ".";
    // Repair 2 (B12): R's $ and pandas' df["col"] habits. summary$rate = ... raises no error at
    // all (Julia reads it as a new function named $); src/mystery_c2.jl says so in the feedback.
    const reach = step === "rates" ? "read a column from your table with a dot, such as summary.detected_n" : "inside groupby and combine, name a column with a colon, such as :tray_id";
    if (/UndefVarError: `\$` not defined/.test(detail)) return "R's $ does not exist in Julia: " + reach + ".";
    if (/syntax df\[column\] is not supported/.test(detail)) return "A Julia table does not take a column name alone in square brackets, as pandas does: " + reach + ".";
    const summaryColumn = step === "rates" && detail.match(/UndefVarError: `(detected_n|n)` not defined/);
    if (summaryColumn) return summaryColumn[1] + " is not a name Julia knows on its own. When combine makes it, write :" + summaryColumn[1] + ". When you read it from your summary table, write summary." + summaryColumn[1] + ", with a dot.";
    if (step === "rates" && /only allowed to pass a vector as a column|cannot broadcast array to have fewer non-singleton dimensions/.test(detail)) return "Dividing two whole columns needs the dot: detected_n ./ n divides tray by tray. A plain / does not, and the .= suggestion in Julia's original error does not fix this.";
    if (step !== "group" && /no method matching iterate\(::Symbol\)/.test(detail)) return "combine takes pairs, not name = value: write nrow => :n and :detected => sum => :detected_n. In sum(:detected), sum gets only the column's name, not its values, so it cannot add them up.";
    if (/no method matching combine\(.*;/.test(detail)) return "combine takes pairs, not name = value: write nrow => :n, not n = nrow, and :detected => sum => :detected_n for the detections.";
    if (/no method matching combine\(::Pair/.test(detail)) return "combine needs the grouped table first, then the pairs. Make the groups with groupby, then pass them to combine before nrow => :n.";
    return "";
  }
  // Repair 3 (R5c): combine(jars, ...) without groupby runs and returns one ungrouped row, so there
  // is no error text to key on. This line is keyed on the returned table itself: one row, no tray_id.
  function c2ResultNextStep(message) {
    if (!message || message.status !== "ok" || message.pass === true || (message.step !== "counts" && message.step !== "rates")) return "";
    const columns = Array.isArray(message.columns) ? message.columns : [], rows = Array.isArray(message.rows) ? message.rows : [];
    if (rows.length === 1 && columns.length > 0 && !columns.includes("tray_id")) return "Julia returned one row with no tray_id column, not one row per tray. combine makes one row for each tray only when you give it the tray groups: make them with groupby first.";
    return "";
  }
  // B14 (2026-09-24 playtest): JSON carries Julia's Float64 1.0 as the number 1, which String()
  // drew as "1". row_text is Julia's own printed text for each numeric cell (src/mystery_c2.jl);
  // without it, as in evidence saved by an older version, the plain value is shown as before.
  function juliaCell(row, text, column) {
    if (text && typeof text[column] === "string") return text[column];
    const value = row ? row[column] : null;
    return value == null ? "" : typeof value === "object" ? (value.display == null ? JSON.stringify(value) : String(value.display)) : String(value);
  }
  // Julia's / on two whole numbers always returns a Float64, which Julia prints with a decimal point.
  function juliaDivision(value) { return Number.isInteger(value) ? value.toFixed(1) : String(value); }
  function resultText(message) { const explanation = message && message.explanation; const parts = [c2ErrorNextStep(message) || c2ResultNextStep(message), message && (message.feedback || message.message)]; if (message && message.value_repr) parts.push("Julia returned: " + message.value_repr); if (explanation && explanation.julia) parts.push(explanation.julia); if (explanation && explanation.case) parts.push(explanation.case); return parts.filter(Boolean).join(" ") || (message && message.status === "error" ? displayError(message) : "No explanation was returned."); }
  function runOutcomeStatus(message) {
    if (!message) return "";
    if (message.status === "ok" && message.pass === true) return "✓ Accepted — evidence saved.";
    if (message.status === "timeout") return "Not accepted — the run timed out. No evidence was saved.";
    if (message.status === "error") return "Not accepted — Julia could not run this code. No evidence was saved.";
    return "Not accepted — no evidence was saved.";
  }
  function requestId() { return "c2-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function isCurrentSocket(active, callback) { return active === callback; }
  // T3 (2026-09-12 panel finding): C2 used to save only under its own legacy key, which the Case
  // Board's freshness-tracking legacy importer can freeze mid-chapter (see the "changed legacy data"
  // guard in course-client.js). Writing directly to the shared course state on each accepted move —
  // the same pattern chapter3.js..chapter6.js already use — makes C2 recognised immediately, with no
  // dependency on that importer for a fresh play.
  function courseStepTitle(step) { return ({group:"Tray records grouped", counts:"Tray record and detection counts", rates:"Tray detection rates compared"})[step] || "Tray progress recorded"; }
  function courseEvidencePayload(step, result) {
    const rowCount = Array.isArray(result && result.rows) && result.rows.length > 0 ? Math.min(result.rows.length, 10000) : 1;
    return {chapter:"C2", move_id:step, title:courseStepTitle(step), row_count:rowCount, provenance:"historical-browser"};
  }
  function persistAcceptedCourseState(courseState, storage, attempt, step, result) {
    if (!STEPS.includes(step) || !result || result.status !== "ok" || result.pass !== true || result.step !== step) return false;
    if (!courseState || typeof courseState.recordHistoricalMoveIfMissing !== "function" || typeof courseState.writeEvidenceIfMissing !== "function" || typeof courseState.writeCursor !== "function") return false;
    try {
      courseState.recordHistoricalMoveIfMissing(storage, attempt, "C2", step);
      courseState.writeEvidenceIfMissing(storage, attempt, courseEvidencePayload(step, result));
      const next = nextStep(step, result);
      const cursor = next === "chapter3" ? {chapter:"C3", move_id:"join-report-log", mode:"challenge"} : next ? {chapter:"C2", move_id:next, mode:"challenge"} : null;
      if (cursor) courseState.writeCursor(storage, attempt, cursor);
      return true;
    } catch (_) { return false; }
  }

  function init() {
    const $ = id => document.getElementById(id); let storage = null; try { storage = localStorage; } catch (_) {}
    const courseState = typeof window !== "undefined" ? window.JuliaTimeCourseState : null;
    let state = createState(), socket = null, caseInfo = null, hints = 0, answerShown = false, reconnects = 0, timer = null, infoTimer = null, runTimer = null, stopped=false, compositionOrder=[];
    const progress=loadProgress(storage);
    state.unlocked=progress.accepted.counts ? "rates" : progress.accepted.group ? "counts" : "group";
    const el = {code:$("code"), run:$("run"), status:$("run-status"), output:$("result"), rows:$("returned-rows"), returnedEmpty:$("returned-empty"), sourceRows:$("source-rows"), rack:$("rack"), liveRack:$("live-rack"), groupingPreview:$("grouping-preview"), groupingPreviewResult:$("grouping-preview-result"), showGroups:$("show-groups"), stepTitle:$("step-title"), prompt:$("step-prompt"), purpose:$("case-purpose"), hints:$("hints"), hint:$("show-hint"), answer:$("show-answer"), answerOutput:$("complete-answer"), connection:$("connection"), reconnect:$("reconnect"), question:$("question"), draftNote:$("draft-note"), next:$("next-move"), rateParts:$("rate-parts"), composition:$("composition-scaffold"), compositionCards:$("composition-cards"), compositionFeedback:$("composition-feedback"), checkComposition:$("check-composition"), resetComposition:$("reset-composition")};
    const saved = storage ? loadEvidence(storage) : null; if (saved) { state.evidence = saved; renderEvidence(saved, true); }
    function current() { return COPY[state.activeStep]; }
    function clearRunTimer() { if(runTimer) { clearTimeout(runTimer); runTimer=null; } }
    function armRunDeadline(id) { clearRunTimer(); runTimer=setTimeout(() => { const before=state; state=expireRun(state,id); if(state===before) return; showTimeout(); updateControls(); el.code.focus(); }, RUN_DEADLINE_MS); }
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
      state = cancelRun(state); state.activeStep = step; hints = 0; answerShown = false; compositionOrder=[];
      $("course-location").textContent = caseLocation(step);
      el.stepTitle.textContent = current().title; el.prompt.textContent = current().prompt; el.purpose.textContent = casePurpose(step); $("return-spec").textContent = current().returnSpec; $("fresh-run").textContent = freshRunNote(step);
      $("step-teaching").textContent=current().teaching;
      el.rateParts.hidden=step!=="rates";
      const draft = starterDraft(storage, step);
      progress.step=step; saveProgress(storage,progress);
      el.code.value = draft; el.draftNote.textContent = draft ? "Restored your saved draft for this move; it is not supplied code." : "This editor begins empty. Each run starts with the supplied jars table, so write the complete little script for this move.";
      el.hints.textContent = ""; el.hint.textContent = hintButtonLabel(0, allHints(step).length); el.hint.disabled = false; el.answerOutput.replaceChildren(); el.answer.textContent = "Show the complete answer"; el.answer.disabled = false; el.output.replaceChildren(); el.rows.replaceChildren(); el.liveRack.replaceChildren(); el.returnedEmpty.hidden = false; el.next.hidden = true; renderComposition();
      if (caseInfo) renderCase(caseInfo);
      refreshMoveNav(); updateControls(); if(focus) { el.stepTitle.tabIndex=-1; el.stepTitle.focus(); }
    }
    function refreshMoveNav() { document.querySelectorAll(".moves > [data-step]").forEach(b => { b.setAttribute("aria-current", b.dataset.step === state.activeStep ? "step" : "false"); b.disabled = !canEnterStep(progress, b.dataset.step); }); }
    function updateControls() { const busy = isRunPending(state); el.run.disabled = state.connection !== "connected" || !caseInfo || busy; el.status.textContent = busy ? (state.statusMessage || "Checking your Julia result…") : state.metadataFailure || (state.result ? runOutcomeStatus(state.result) : (state.connection === "connected" ? "Ready when you are" : "Connect to the lab to run Julia")); el.reconnect.hidden = !shouldShowReconnect(state); }
    function renderTable(rows, columns, target = el.rows, texts = null) { target.replaceChildren(); if (!Array.isArray(rows) || !Array.isArray(columns)) return; const table = document.createElement("table"), head = document.createElement("thead"), tr = document.createElement("tr"); columns.forEach(c => { const th=document.createElement("th"); th.textContent=c; tr.append(th); }); head.append(tr); table.append(head); const body=document.createElement("tbody"); rows.forEach((row, i) => { const r=document.createElement("tr"); columns.forEach(c => { const td=document.createElement("td"); td.textContent=juliaCell(row, Array.isArray(texts) ? texts[i] : null, c); r.append(td); }); body.append(r); }); table.append(body); target.append(table); }
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
    function renderRack(step, rows, target=el.liveRack, texts=null) {
      target.replaceChildren(); if (!Array.isArray(rows)) return;
      const byTray=new Map(), textOf=new Map(); rows.forEach((row,i)=>{const tray=String(row.tray_id); if(!byTray.has(tray))byTray.set(tray,[]); byTray.get(tray).push(row); if(Array.isArray(texts)) textOf.set(row,texts[i]);});
      byTray.forEach((items,tray)=>{
        const card=document.createElement("article"), h=document.createElement("h3"), jars=document.createElement("div");
        h.textContent=tray; jars.className="jars"; card.append(h);
        const labels=step === "group" ? items.map(row=>String(row.jar_id)) : jarMarks(items[0]).map(d=>d ? "✓ detected" : "– not detected");
        labels.forEach((label,i)=>{const jar=document.createElement("span"); jar.className="jar"; jar.style.animationDelay=(i*70)+"ms"; jar.textContent=label; jars.append(jar);}); card.append(jars);
        if(step !== "group") {const row=items[0], p=document.createElement("p"); p.textContent=row.detected_n+" detected / "+row.n+" jars"+(step === "rates" ? " = "+juliaCell(row,textOf.get(row),"rate")+" ("+Math.round(row.rate*100)+"%)" : ""); card.append(p);}
        target.append(card);
      });
      if(step !== "group") {const note=document.createElement("small"); note.textContent="Each symbol represents one counted jar, not a particular jar ID."; target.append(note);}
    }
    function renderEvidence(evidence, restored) { renderRack("rates",evidence.rows,el.rack,evidence.row_text); $("evidence").hidden=false; $("comparisons").hidden=restored; $("evidence-copy").textContent = restored ? "Unverified saved display from this browser, not a fresh lab check. Saved data can be changed or become stale. Run the final move again to verify these values against the server's B09 records." : "These are your checked returned summaries. They describe recorded detections by tray, not a cause. Pick two trays: explain their detected counts, jar counts and proportions. What would you want to check in the handling log next?"; }
    function renderCase(message) { caseInfo = message; state = Object.assign({}, state, {infoRequestId:null, metadataFailure:""}); clearInfoTimer(); const q = message.question || message.goal || "Do recorded detections differ by tray?"; el.question.textContent=q; if (Array.isArray(message.rows) && Array.isArray(message.columns)) renderTable(message.rows, message.columns, el.sourceRows); const example=rateExample(message.rows);if(state.activeStep==="rates"&&example)el.rateParts.innerHTML=`<strong>Rate parts:</strong> In tray <code>${example.tray_id}</code>, <code>detected_n</code> is ${example.detected_n} and <code>n</code> is ${example.n}, so <code>${example.detected_n} / ${example.n} = ${juliaDivision(example.rate)}</code>. Julia applies that matching division to every tray with <code>detected_n ./ n</code>.`; updateControls(); }
    function handle(message) {
      if (isCurrentCaseInfo(state, message)) return renderCase(message);
      if (message.type === "error") { const before=state; state=failCaseInfo(state,message); if(before!==state) { clearInfoTimer(); el.sourceRows.textContent=state.metadataFailure; updateControls(); } return; }
      if (message.type === "status") { const before=state; state=applyRunStatus(state,message); if(before===state) return; armRunDeadline(state.outstandingRequestId); updateControls(); return; }
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
      if (Array.isArray(result.rows) && Array.isArray(result.columns)) renderTable(result.rows,result.columns,el.rows,result.row_text);
      el.liveRack.replaceChildren();
      const freshEvidence=state.evidence !== before.evidence;
      if(result.status === "ok" && result.pass === true) {
        if(showsLiveRack(result,freshEvidence)) renderRack(result.step,result.rows,el.liveRack,result.row_text);
        progress.accepted[state.activeStep]=el.code.value; saveProgress(storage,progress); refreshMoveNav();
        persistAcceptedCourseState(courseState, storage, attempt, state.activeStep, result);
        const next=nextStep(state.activeStep,result);
        if(next) { if(next !== "chapter3" && STEPS.indexOf(next)>STEPS.indexOf(state.unlocked)) state.unlocked=next; el.next.hidden=false; el.next.dataset.destination=next; el.next.textContent=next === "chapter3" ? "Next: connect the report to the handling log →" : "Next move: " + COPY[next].title + " →"; }
      }
      el.returnedEmpty.hidden = el.rows.childElementCount > 0 || el.liveRack.childElementCount > 0;
      if(state.evidence) {
        if(freshEvidence && storage) persistEvidence(storage,state.evidence);
        renderEvidence(state.evidence,!freshEvidence);
      }
      updateControls();
      focusResult();
    }
    function focusResult() { if (el.output) el.output.focus(); }
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
      el.compositionFeedback.textContent=compositionIsCorrect(state.activeStep,compositionOrder) ? "Yes. That is the build order. These use the real names from this chapter; this practice did not run Julia, add evidence, or write code for you." : "Not yet. A later line needs a name made by an earlier line. Start again and build from the supplied jars table toward the returned summary.";
    });
    el.resetComposition.addEventListener("click",()=>{compositionOrder=[];renderComposition();});
    el.code.addEventListener("input", () => { clearRunTimer(); state=cancelRun(state); el.next.hidden=true; if(storage) persistDraft(storage,state.activeStep,el.code.value); updateControls(); });
    el.code.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); el.run.click(); } });
    el.run.addEventListener("click", () => { if(el.run.disabled) return; const id=requestId(); state=beginRun(state,id,state.activeStep); updateControls(); el.output.textContent="Julia is checking this move (usually under two seconds)…"; send({type:"case_run", case_id:"missing-fleas-v1", chapter:"C2", step:state.activeStep, code:el.code.value, request_id:id}); armRunDeadline(id); });
    function revealHints(lastIndex) {
      const list=allHints(state.activeStep);
      while(hints <= lastIndex && hints < list.length) { const p=document.createElement("p"); p.textContent=list[hints++]; el.hints.append(p); }
      el.hint.textContent=hintButtonLabel(hints, list.length); el.hint.disabled=hints >= list.length;
    }
    function revealCompleteAnswer() {
      if (answerShown) return;
      const label=document.createElement("p"), pre=document.createElement("pre"), note=document.createElement("p");
      label.className="complete-answer-label"; label.textContent="Reference code answer — runnable Julia. Run this code in your editor to see Julia’s actual returned value below Run. It does not enter your editor or add evidence.";
      pre.className="complete-answer-code"; pre.textContent=current().answerCode;
      note.textContent="Each Run Julia check starts fresh with the supplied jars table, so this block includes every line it needs.";
      el.answerOutput.append(label,pre,note); answerShown=true; el.answer.textContent="Complete answer shown"; el.answer.disabled=true;
    }
    el.hint.addEventListener("click", () => revealHints(hints));
    el.answer.addEventListener("click", revealCompleteAnswer);
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
  return {INFO_DEADLINE_MS, RUN_DEADLINE_MS, storagePrefix, caseBoardUrl, caseLocation, nextChapterUrl, requestedMove, initialStep, canEnterStep, blockedStepMessage, createState, beginInfo, failCaseInfo, expireInfo, isCurrentCaseInfo, beginRun, cancelRun, expireRun, isRunPending, applyRunStatus, leaveInvestigation, disconnect, shouldShowReconnect, applyCaseResult, validEvidenceDisplay, persistDraft, loadDraft, hasDraft, starterDraft, saveProgress, loadProgress, persistEvidence, loadEvidence, rackLabels, rateExample, groupingPreview, groupingPreviewMessage, jarMarks, showsLiveRack, nextStep, resultText, juliaCell, juliaDivision, runOutcomeStatus, displayError, c2ErrorNextStep, c2ResultNextStep, isCurrentSocket, lessonCopy, casePurpose, allHints, hintButtonLabel, freshRunNote, compositionCards, compositionIsCorrect, courseStepTitle, courseEvidencePayload, persistAcceptedCourseState, init};
});

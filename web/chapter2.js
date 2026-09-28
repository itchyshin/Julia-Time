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
  function caseLocation(step) { return ({group:"Chapter 2 of 6 · Put each tray’s jars together", counts:"Chapter 2 of 6 · Count jars and jars with springtails", rates:"Chapter 2 of 6 · Work out each tray’s share"})[step] || "Chapter 2 of 6 · Put each tray’s jars together"; }
  const attempt = typeof location === "undefined" ? "" : new URLSearchParams(location.search).get("attempt");
  const PREFIX = storagePrefix(attempt), EVIDENCE_KEY = PREFIX + "evidence", STEP_KEY = PREFIX + "step";
  const STEPS = ["group", "counts", "rates"];
  const INFO_DEADLINE_MS = 5000, RUN_DEADLINE_MS = 7000;
  function requestedMove(search) { const move = new URLSearchParams(search || "").get("move"); return STEPS.includes(move) ? move : ""; }
  function hasAcceptedMove(progress, step) { return Boolean(progress && progress.accepted && typeof progress.accepted[step] === "string" && progress.accepted[step].trim()); }
  // Round-4 bots (2026-09-26): a solved step folds its notebook table closed so the result and tray rack are not
  // buried; the next step opens it again. One click on the summary reopens it at any time.
  function notebookOpen(stepAccepted) { return !stepAccepted; }
  function canEnterStep(progress, step) {
    const index = STEPS.indexOf(step);
    return index === 0 || (index > 0 && hasAcceptedMove(progress, STEPS[index - 1]));
  }
  // The first unsolved step, or the last step once every step is solved — the same rule
  // chapter3.js's and chapter5.js's `initialMove` use (2026-09-25 fix).
  function unlockedStep(accepted) {
    const a = accepted && typeof accepted === "object" ? accepted : {};
    return a.counts ? "rates" : a.group ? "counts" : "group";
  }
  // With no step in the address, resume at the first unsolved step (or the last when all are
  // solved), not at `progress.step` (the step last *visited*, which stays "group" once a learner
  // accepts it without also clicking Next — the AI-student reload bug, 2026-09-25). An explicit,
  // reachable step in the address still wins.
  function initialStep(progress, requested) {
    const unlocked = unlockedStep(progress && progress.accepted);
    if (!STEPS.includes(requested)) return unlocked;
    return STEPS.indexOf(requested) <= STEPS.indexOf(unlocked) ? requested : unlocked;
  }
  // A learner with any accepted C2 move in this browser has work worth resuming into the
  // investigation directly, the same signal chapter3.js's `hasOwnChapterWork` uses.
  function hasOwnChapterWork(progress) { return Boolean(progress && progress.accepted && Object.keys(progress.accepted).length > 0); }
  // The "same move in R and Python" card must not show for a step unless that step's accepted
  // result is also visible on the page (2026-09-25 fix). C2 only restores a visible accepted
  // result after a reload for the "rates" step (its final evidence table, labelled as saved from
  // an earlier visit — see `renderEvidence`'s `restored` text); group and counts have no such
  // restored display, so their card stays hidden until run again in this session.
  function bridgeCardCode(step, progress, evidence, freshlyAccepted) {
    const visible = Boolean(freshlyAccepted) || (step === "rates" && Boolean(evidence));
    return visible && progress && progress.accepted && typeof progress.accepted[step] === "string" ? progress.accepted[step] : "";
  }
  const COPY = {
    group: {title:"Step 1 · Put each tray’s jars together", prompt:"Start from jars. Group its rows by the tray_id column and return the groups.", shape:"Grouping does not count or drop any jar. It just puts jars with the same tray label together.\n\nComing from R? In R you would use dplyr’s group_by; Julia’s grouping function is spelled groupby.", hints:["groupby(table, :column). The colon before the column name is how Julia names a column here."], answerCode:"groupby(jars, :tray_id)", returnSpec:"the jars in groups, one group per tray"},
    counts: {title:"Step 2 · Count jars and jars with springtails", prompt:"Group again, then use combine to turn each group into one row.", shape:"For each tray, count its rows, and count the jars where detected is true.\n\nComing from R? In R you would use summarise after group_by; Julia’s version is combine.", hints:["combine(groupby(table, :column), nrow => :n) makes one row per group. Read nrow => :n aloud as “count the rows, call it n”. Then add a second piece after a comma: :detected => sum => :detected_n. Read it aloud as “take detected, sum it, call it detected_n”. Each => is one “then”."], answerCode:"counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)", returnSpec:"one row per tray with tray_id, n (jars on the tray) and detected_n (jars with springtails)"},
    rates: {title:"Step 3 · Work out each tray’s share", prompt:"Build counts as in Step 2. Then add the new column with counts.rate = counts.detected_n ./ counts.n, and end with counts on its own line.", shape:"A share is a top number divided by a bottom number: jars with springtails over all jars, tray by tray.\n\nComing from R? In R you would use mutate; in Julia you add a column by assigning to it.", hints:["table.new_column = table.top ./ table.bottom, then the table’s name on the last line so Julia shows it."], answerCode:"counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\ncounts.rate = counts.detected_n ./ counts.n\ncounts", returnSpec:"the counts table with one more column, rate (the share of jars with springtails): jars with springtails divided by all jars on that tray"}
  };
  COPY.group.teaching="Put jars from the same tray together, so we compare trays fairly.";
  COPY.counts.teaching="A tray label is not enough: we need how many jars, and how many had springtails, on each tray.";
  COPY.rates.teaching="A share lets us compare trays of any size, not just their totals.";
  // Story spine beat 2 ("why this code", docs/design/06-story-spine.md, approved 2026-09-27):
  // one plain line under the step title, before the task text, saying why this code answers the
  // case question.
  COPY.group.why="To count per tray, first put each tray's jars together.";
  COPY.counts.why="Count the jars and the jars with springtails on each tray: this is the number the report says is 0 for T-C.";
  COPY.rates.why="A share is what the report's 0 really claims: 0 of 2 jars. Write every tray the same way.";
  const COMPOSITION = Object.freeze({
    counts: Object.freeze([
      Object.freeze({id:"group", text:"groups = groupby(jars, :tray_id)"}),
      Object.freeze({id:"counts", text:"counts = combine(groups, nrow => :n, :detected => sum => :detected_n)"}),
      Object.freeze({id:"return", text:"counts"})
    ]),
    rates: Object.freeze([
      Object.freeze({id:"group", text:"groups = groupby(jars, :tray_id)"}),
      Object.freeze({id:"counts", text:"counts = combine(groups, nrow => :n, :detected => sum => :detected_n)"}),
      Object.freeze({id:"rate", text:"counts.rate = counts.detected_n ./ counts.n"}),
      Object.freeze({id:"return", text:"counts"})
    ])
  });
  function compositionCards(step) { return (COMPOSITION[step] || []).map(card => ({id:card.id, text:card.text})); }
  function compositionIsCorrect(step, order) { const cards=compositionCards(step); return Array.isArray(order) && order.length === cards.length && order.every((id,index) => id === cards[index].id); }
  function lessonCopy(step) { return COPY[step]; }
  function casePurpose(step) {
    return ({
      group:"Toto: “Every tray gets counted the same way, before anyone points at one.”",
      counts:"Toto: “T-C has one jar with springtails. So where did my zero come from?”",
      rates:"Two jars per tray is a small count, so a share of 0.5 is only one jar."
    })[step] || "";
  }
  // T2 (2026-09-12 playtest): the code shape used to render unconditionally in the main task
  // body, above the real input names, turning the move into substitution rather than a decision.
  // It is now the first staged hint, one click away, same as the rest of the hint sequence.
  function allHints(step) { const lesson=lessonCopy(step); if (!lesson) return []; return [lesson.shape, ...(Array.isArray(lesson.hints) ? lesson.hints : [])]; }
  // UI-09 (2026-09-24): the first staged hint is a plain-language plan, so its button offers the
  // smallest help first, as in C1, and the exhausted button is disabled rather than a no-op.
  // r4 (2026-09-27): the ladder ends with the whole line, as in C1 and C3-C6. The last rung is the
  // step's full answer, shown above the editor, so the ladder is the text hints plus one.
  function hintButtonLabel(shown, total) {
    if (shown >= total) return "All help shown";
    return ["Show the idea", "Show the code shape", "Show the whole line"][shown] || "Show more help";
  }
  function ladderTotal(step) { return allHints(step).length + 1; }
  // Repair 7 (orchestrator browser check, 2026-09-26): mystery_c2_case_info now always supplies its
  // own "question", so this no longer falls through to "goal" and overwrites the Case question box
  // with the step-goal sentence already shown lower on the page (a duplicate, item 5).
  function caseQuestionText(message) { return message.question || message.goal || "Do recorded detections differ by tray?"; }
  function freshRunNote(step) {
    return ({
      group:"Each run starts fresh from jars. Julia returns the value of your last line, so end with the groups.",
      counts:"Each run starts fresh from jars, so make the groups again here. Julia returns the value of your last line, so end with the counts table.",
      rates:"Each run starts fresh from jars, so build counts again here. Julia returns the value of your last line, so end with counts on its own line."
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
      feedback:"This check took too long. Check your code, then run again."
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
  // Round 6 (r6-rc #5): a chapter solved on an earlier run still offers the way on to Chapter 3.
  function solvedNextDestination(progress) { return hasAcceptedMove(progress, "rates") ? "chapter3" : null; }
  function nextStep(step, result) { return result && result.status === "ok" && result.pass === true && result.step === step ? ({group:"counts", counts:"rates", rates:"chapter3"})[step] || null : null; }
  function nextChapterUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "chapter3.html" + (/^[a-z0-9-]{1,80}$/.test(attempt || "") ? "?attempt=" + encodeURIComponent(attempt) : ""); }
  function blockedStepMessage(step) {
    const prior = STEPS[STEPS.indexOf(step) - 1];
    const label = ({group:"grouping", counts:"counting"})[prior] || "earlier";
    return "This step uses the " + label + " line from the previous step. Each Julia check starts fresh, so finish that step first (or open its full answer if you already know it). Your draft is safe.";
  }
  function displayError(message) { return String(message && (message.message || message.error || message.value_repr) || "No error detail was returned."); }
  // UI-12 and playtest stopping points (2026-09-24): each line below is keyed on the sandbox's
  // actual error text for a common C2 mistake (pinned in test/test_mystery_c2.jl). It names the
  // habit and leads the chapter's existing recovery copy; Julia's own error stays verbatim below.
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
  function c2ErrorNextStep(message) {
    if (!message || message.status !== "error") return "";
    const detail = displayError(message), step = message.step;
    const guarded = protectedInputCoaching(message);
    if (guarded) return guarded;
    // Night round 1 (r1-novice.md item 1): R's group_by, keyed on Julia's own UndefVarError, as C3 does for left_join.
    if (/UndefVarError: `group_by` not defined/.test(detail)) return "group_by is R's (dplyr) name. Julia's grouping function is groupby, with no underscore; it takes the table first, then the column.";
    // Night playtest 2026-09-26: R's %>% is not Julia syntax, so it reaches the sandbox as a raw
    // parse error with no word about the pipe. Keyed on the pipe itself, which the parse error's
    // source excerpt always reprints verbatim.
    if (/%>%/.test(detail)) return "R's pipe %>% does not exist in Julia. Julia's pipe is |>, and grouping is groupby(jars, :tray_id).";
    // Night playtest 2026-09-26: a pandas-style method call after a dot (e.g. jars.groupby(...))
    // reads as a missing column named after the method, which looks like a typo rather than a
    // habit. Keyed on the exact DataFrames text for a missing column.
    const KNOWN_FUNCTIONS = Object.freeze({groupby:"groupby(jars, :tray_id)", sample:"sample(jars.jar_id, 3; replace=false)", mean:"mean(jars.detected)"});
    const methodCall = detail.match(/column name :([a-zA-Z_]\w*) not found in the data frame/);
    if (methodCall && KNOWN_FUNCTIONS[methodCall[1]]) return methodCall[1] + " is a function in Julia, not something you call after a dot: " + KNOWN_FUNCTIONS[methodCall[1]] + ".";
    // Repair 7 (orchestrator browser check, 2026-09-26): a learner who kept `groups` or `counts`
    // from an earlier step (e.g. combine(groups, ...) in step 2) got only Julia's raw
    // "UndefVarError: `groups` not defined", with no hint that the name does not survive to a
    // fresh step. Keyed on that exact error text, made in step 1 (groups) or step 2 (counts).
    const carried = detail.match(/UndefVarError: `(groups|counts)` not defined/);
    if (carried) return "`" + carried[1] + "` was made in step " + (carried[1] === "groups" ? "1" : "2") + ". Each step starts fresh, so make it again here, starting from jars.";
    if (/\b(?:table|group_column|count_rows|boolean_column|numerator|denominator)\b.*(?:not defined|doesn't exist)|(?:not defined|doesn't exist).*\b(?:table|group_column|count_rows|boolean_column|numerator|denominator)\b/i.test(detail)) return "That is a template word, not one of this chapter's inputs. Use the named B09 inputs above: jars, :tray_id, nrow, and :detected. Or open Stuck? Hints below the editor and use Show the full answer.";
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
    const reach = step === "rates" ? "read a column from your table with a dot, such as counts.detected_n" : "inside groupby and combine, name a column with a colon, such as :tray_id";
    if (/UndefVarError: `\$` not defined/.test(detail)) return "R's $ does not exist in Julia: " + reach + ".";
    if (/syntax df\[column\] is not supported/.test(detail)) return "A Julia table does not take a column name alone in square brackets, as pandas does: " + reach + ".";
    const countsColumn = step === "rates" && detail.match(/UndefVarError: `(detected_n|n)` not defined/);
    if (countsColumn) return countsColumn[1] + " is not a name Julia knows on its own. When combine makes it, write :" + countsColumn[1] + ". When you read it from your counts table, write counts." + countsColumn[1] + ", with a dot.";
    if (step === "rates" && /only allowed to pass a vector as a column|cannot broadcast array to have fewer non-singleton dimensions/.test(detail)) return "Dividing two whole columns needs the dot: detected_n ./ n divides tray by tray. A plain / does not, and the .= suggestion in Julia's original error does not fix this.";
    if (step !== "group" && /no method matching iterate\(::Symbol\)/.test(detail)) return "combine takes pairs, not name = value: write nrow => :n and :detected => sum => :detected_n. In sum(:detected), sum gets only the column's name, not its values, so it cannot add them up.";
    if (/no method matching combine\(.*;/.test(detail)) return "combine takes pairs, not name = value: write nrow => :n, not n = nrow, and :detected => sum => :detected_n for the detections.";
    if (/no method matching combine\(::Pair/.test(detail)) return "combine needs the grouped table first, then the pairs. Make the groups with groupby, then pass them to combine before nrow => :n.";
    if (step === "counts" && /no method matching nrow\(::DataFrames\.GroupedDataFrame/.test(detail)) return "nrow does not take the groups directly here. Inside combine, write nrow => :n; combine calls nrow for you, once per group.";
    const oldName = detail.match(/UndefVarError: `(summary)` not defined/);
    if (oldName) return "This name changed: use counts instead of " + oldName[1] + ". " + (step === "counts" ? "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)" : "counts.rate = counts.detected_n ./ counts.n") + ".";
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
  // Replay notes (2026-09-27): an error-specific line (R's %>%, a pandas-style dot call, and the
  // other c2ErrorNextStep coaching below) used to be followed by the chapter's generic recovery
  // copy and explanation, reading as one wrong message ("Julia stopped before the end...") after
  // the right one. The specific coaching now replaces that generic stack, the same rule C1's
  // challengeRecovery already applies (web/mystery.js). c2ResultNextStep (a wrong-shape but
  // non-error result) is unaffected: that coaching still leads the server's own feedback.
  // v0.2.5 night (fixer I1): the server's "coaching" line names the mistake it read from the code
  // (src/mystery_c2.jl .. mystery_c6.jl). It is "" when there is none, and never used on a passing run.
  function serverCoaching(message) {
    return message && message.pass !== true && typeof message.coaching === "string" ? message.coaching.trim() : "";
  }
  const STOPPED_ENDING = " Change your code, then run again, or open Stuck? Hints below.";
  const FINISHED_ENDING = " Your draft is still here. Change it and run again, or open Stuck? Hints below.";
  const RESTORED_DRAFT_NOTE = "Restored your saved draft for this step; it is not supplied code.";
  function resultText(message) {
    // The server's line replaces the page's own guess (for summarise, the page used to blame the
    // n column; for counts <- ..., a step 2 carry-over).
    // Round 7 (r7-bugs #9): a coaching line ends the way it does in C1 and C3 to C6.
    const coaching = serverCoaching(message);
    if (coaching) return coaching + (message.status === "error" ? STOPPED_ENDING : FINISHED_ENDING);
    const errorCoaching = c2ErrorNextStep(message);
    if (errorCoaching) return errorCoaching + STOPPED_ENDING;
    const explanation = message && message.explanation;
    const parts = [c2ResultNextStep(message), message && (message.feedback || message.message)];
    if (message && message.value_repr) parts.push("Julia returned: " + message.value_repr);
    if (explanation && explanation.julia) parts.push(explanation.julia);
    // r3 (2026-09-27): the server's failure "case" line ("Match all B09 trays to see what this
    // step finds") told a stuck learner nothing, so the case line shows only on an accepted run.
    if (explanation && explanation.case && message.status === "ok" && message.pass === true) parts.push(explanation.case);
    return parts.filter(Boolean).join(" ") || (message && message.status === "error" ? displayError(message) : "No explanation was returned.");
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
    let state = createState(), socket = null, caseInfo = null, hints = 0, answerShown = false, reconnects = 0, timer = null, infoTimer = null, runTimer = null, stopped=false, compositionOrder=[], saveOk = true;
    const progress=loadProgress(storage);
    state.unlocked=unlockedStep(progress.accepted);
    const el = {code:$("code"), run:$("run"), status:$("run-status"), output:$("result"), rows:$("returned-rows"), returnedEmpty:$("returned-empty"), sourceRows:$("source-rows"), rack:$("rack"), liveRack:$("live-rack"), groupingPreview:$("grouping-preview"), groupingPreviewResult:$("grouping-preview-result"), showGroups:$("show-groups"), stepTitle:$("step-title"), stepWhy:$("step-why"), prompt:$("step-prompt"), purpose:$("case-purpose"), hints:$("hints"), hint:$("show-hint"), answer:$("show-answer"), answerOutput:$("complete-answer"), connection:$("connection"), reconnect:$("reconnect"), question:$("question"), draftNote:$("draft-note"), next:$("next-move"), rateParts:$("rate-parts"), composition:$("composition-scaffold"), compositionCards:$("composition-cards"), compositionFeedback:$("composition-feedback"), checkComposition:$("check-composition"), resetComposition:$("reset-composition"), bridgeCard:$("bridge-card")};
    const bridges = typeof window !== "undefined" ? window.JuliaTimeBridges : null;
    function renderBridgeCard(step) { if (bridges) bridges.renderCard(el.bridgeCard, "C2/"+step, typeof progress.accepted[step] === "string" ? progress.accepted[step] : ""); }
    // The card must not show for a step unless that step's accepted result is also visible
    // (2026-09-25 fix, bridgeCardCode above). Kept separate from renderBridgeCard itself so its
    // existing single-step contract (test/bridge-card.test.cjs) is unchanged.
    function showBridgeCard(step, freshlyAccepted) {
      if (bridgeCardCode(step, progress, state.evidence, freshlyAccepted)) renderBridgeCard(step);
      else if (el.bridgeCard) { el.bridgeCard.replaceChildren(); el.bridgeCard.hidden = true; }
    }
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
      el.compositionFeedback.textContent=compositionOrder.length === 0 ? "Choose the first piece." : "Your order: " + compositionOrder.map(id => cards.find(card => card.id === id).text).join(" → ");
    }
    // r3 struggling #3 (2026-09-27): the step 1 rehearsal and groupby example stayed in the hint
    // drawer on steps 2 and 3. Help marked with data-step-help shows only on its own step.
    function showStepHelp(step) { document.querySelectorAll("[data-step-help]").forEach(node => { node.hidden = node.dataset.stepHelp !== step; }); }
    function showTimeout() { el.output.replaceChildren(); const copy=document.createElement("p"); copy.textContent=state.result.feedback; el.output.append(copy); }
    function setNotebookOpen(open) { const notebook = document.querySelector(".source-notebook"); if (notebook) notebook.open = open; }
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
      setNotebookOpen(notebookOpen(false));
      $("course-location").textContent = caseLocation(step);
      el.stepTitle.textContent = current().title; el.stepWhy.textContent = current().why || ""; el.prompt.textContent = current().prompt; el.purpose.textContent = casePurpose(step); $("return-spec").textContent = current().returnSpec; $("fresh-run").textContent = freshRunNote(step);
      $("step-teaching").textContent=current().teaching;
      el.rateParts.hidden=step!=="rates";
      const draft = starterDraft(storage, step);
      progress.step=step; saveProgress(storage,progress);
      el.code.value = draft; el.draftNote.textContent = draft ? RESTORED_DRAFT_NOTE : "This editor starts empty. Each run starts with the supplied jars table, so write the complete little script for this step.";
      el.hints.textContent = ""; el.hint.textContent = hintButtonLabel(0, ladderTotal(step)); el.hint.disabled = false; el.answerOutput.replaceChildren(); el.answer.textContent = "Show the full answer"; el.answer.hidden = false; el.answer.disabled = false; showStepHelp(step); el.output.replaceChildren(); el.rows.replaceChildren(); el.liveRack.replaceChildren(); el.returnedEmpty.hidden = false; el.rows.removeAttribute("tabindex"); showSolvedNext(); renderComposition(); showBridgeCard(step, false);
      if (caseInfo) renderCase(caseInfo);
      refreshMoveNav(); updateControls(); if(focus) { el.stepTitle.tabIndex=-1; el.stepTitle.focus(); }
    }
    function refreshMoveNav() { document.querySelectorAll(".moves > [data-step]").forEach(b => { b.setAttribute("aria-current", b.dataset.step === state.activeStep ? "step" : "false"); b.disabled = !canEnterStep(progress, b.dataset.step); }); }
    // r5 (2026-09-27): while Julia runs, Run stays focusable and reads as busy (aria-disabled), so keyboard focus is not dropped to the page.
    function holdRun(button, blocked, busy) { if (!button) return; button.disabled = blocked; if (busy && !blocked) button.setAttribute("aria-disabled", "true"); else button.removeAttribute("aria-disabled"); }
    function updateControls() { const busy = isRunPending(state); holdRun(el.run, state.connection !== "connected" || !caseInfo, busy); el.status.textContent = busy ? (state.statusMessage || "Checking your Julia result…") : state.metadataFailure || (state.result ? runOutcomeStatus(state.result, saveOk) : (state.connection === "connected" ? "Julia is ready" : "Connect to the lab to run Julia")); el.reconnect.hidden = !shouldShowReconnect(state); }
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
    function showSolvedNext() { const next = solvedNextDestination(progress); el.next.hidden = !next; if (next) { el.next.dataset.destination = next; el.next.textContent = "Chapter 3: where did the 0 come from? →"; } }
    function renderEvidence(evidence, restored) { renderRack("rates",evidence.rows,el.rack,evidence.row_text); $("evidence").hidden=false; $("evidence-copy").textContent = restored ? "This rack is from an earlier run. Saved on this computer. Run the last step again to check it now." : "Julia checked these counts. They show how many jars had springtails on each tray, not why. Next: check these counts against the tally sheet."; }
    function renderCase(message) { caseInfo = message; state = Object.assign({}, state, {infoRequestId:null, metadataFailure:""}); clearInfoTimer(); el.question.textContent=caseQuestionText(message); if (Array.isArray(message.rows) && Array.isArray(message.columns)) renderTable(message.rows, message.columns, el.sourceRows); const example=rateExample(message.rows);if(state.activeStep==="rates"&&example)el.rateParts.innerHTML=`<strong>Share parts:</strong> In tray <code>${example.tray_id}</code>, <code>detected_n</code> is ${example.detected_n} and <code>n</code> is ${example.n}, so <code>${example.detected_n} / ${example.n} = ${juliaDivision(example.rate)}</code>. Julia applies that matching division to every tray with <code>detected_n ./ n</code>.`; updateControls(); }
    function handle(message) {
      if (isCurrentCaseInfo(state, message)) return renderCase(message);
      if (message.type === "error") { const before=state; state=failCaseInfo(state,message); if(before!==state) { clearInfoTimer(); el.sourceRows.textContent=state.metadataFailure; updateControls(); } return; }
      if (message.type === "status") { const before=state; state=applyRunStatus(state,message); if(before===state) return; armRunDeadline(state.outstandingRequestId); updateControls(); return; }
      const before=state; state=applyCaseResult(state,message); if (before===state) return;
      clearRunTimer();
      const result=state.result; el.output.replaceChildren(); showSolvedNext();
      const copy=document.createElement("p");
      copy.textContent=resultText(Object.assign({},result,{value_repr:""})); el.output.append(copy);
      // r3 story F1 (2026-09-27): the step 3 limit ("T-C, the newest check, is down by one jar...")
      // is its own line after an accepted run, the way Chapter 3 shows its limit.
      const limit=result.status === "ok" && result.pass === true && result.explanation && result.explanation.limit;
      if(limit) { const line=document.createElement("p"); line.className="limit"; line.textContent=String(limit); el.output.append(line); }
      if(result.value_repr || result.message || result.stdout) {
        const raw=document.createElement("details"), summary=document.createElement("summary"), pre=document.createElement("pre");
        summary.textContent=result.status === "error" ? "Original Julia error" : "Actual Julia output";
        // Mia's playtest: sibling elements built with createElement carry no whitespace between
        // them, so a plain textContent read (unlike the visual, block-level layout) ran the
        // explanation straight into "Actual Julia output" and that straight into the raw Julia
        // value, e.g. "...T-C included.Actual Julia output3×3 DataFrame...". A leading newline on
        // the <pre> and a separating text node before it keep every reading of the page spaced.
        pre.textContent="\n"+[result.stdout,result.message,result.value_repr].filter(Boolean).join("\n"); raw.append(summary,pre); el.output.append(document.createTextNode(" "),raw);
      }
      if (Array.isArray(result.rows) && Array.isArray(result.columns)) renderTable(result.rows,result.columns,el.rows,result.row_text);
      el.liveRack.replaceChildren();
      const freshEvidence=state.evidence !== before.evidence;
      if(result.status === "ok" && result.pass === true) {
        if(showsLiveRack(result,freshEvidence)) renderRack(result.step,result.rows,el.liveRack,result.row_text);
        setNotebookOpen(notebookOpen(true));
        progress.accepted[state.activeStep]=el.code.value; saveProgress(storage,progress); refreshMoveNav(); showBridgeCard(state.activeStep, true);
        persistAcceptedCourseState(courseState, storage, attempt, state.activeStep, result); saveOk = savedMove(courseState, storage, attempt, "C2", state.activeStep);
        const next=nextStep(state.activeStep,result);
        if(next) { if(next !== "chapter3" && STEPS.indexOf(next)>STEPS.indexOf(state.unlocked)) state.unlocked=next; el.next.hidden=false; el.next.dataset.destination=next; el.next.textContent=next === "chapter3" ? "Chapter 3: where did the 0 come from? →" : "Next: " + COPY[next].title + " →"; }
      }
      el.returnedEmpty.hidden = el.rows.childElementCount > 0 || el.liveRack.childElementCount > 0;
      // r5 (2026-09-27): the returned table is a tab stop only when it has rows; empty, it was an invisible stop.
      if (el.rows.childElementCount > 0) el.rows.tabIndex = 0; else el.rows.removeAttribute("tabindex");
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
      ws.addEventListener("open", () => { if(!isCurrentSocket(socket,ws)) return; reconnects=0; state.connection="connected"; el.connection.textContent="Julia is ready"; const id=requestId(); state=beginInfo(state,id); updateControls(); send({type:"case_info", chapter:"C2", request_id:id}); infoTimer=setTimeout(()=>{const before=state;state=expireInfo(state,id);if(state!==before){el.sourceRows.textContent=state.metadataFailure;updateControls();}},INFO_DEADLINE_MS); });
      ws.addEventListener("message", event => { if(!isCurrentSocket(socket,ws)) return; try { handle(JSON.parse(event.data)); } catch (_) {} });
      ws.addEventListener("close", () => { if(!isCurrentSocket(socket,ws)) return; clearInfoTimer(); clearRunTimer(); state=disconnect(state); retry(); });
    }
    function retry() { if(stopped) return; clearInfoTimer(); state=disconnect(state); updateControls(); if (++reconnects > 3) { el.connection.textContent="Julia is offline: your draft is still here."; return; } el.connection.textContent="Connection to Julia lost. Reconnecting…"; timer=setTimeout(connect, 1000 * reconnects); }
    document.querySelectorAll(".moves [data-step]").forEach(b => b.addEventListener("click", () => setStep(b.dataset.step)));
    el.showGroups.addEventListener("click", () => {
      if (!caseInfo || !Array.isArray(caseInfo.rows)) { el.groupingPreviewResult.textContent="The jar records are still loading. Your code draft is unaffected."; return; }
      renderGroupingPreview(caseInfo.rows);
    });
    el.checkComposition.addEventListener("click",()=>{
      const cards=compositionCards(state.activeStep);
      if (!cards.length) return;
      if (compositionOrder.length !== cards.length) { el.compositionFeedback.textContent="Choose every piece, then check the order."; return; }
      el.compositionFeedback.textContent=compositionIsCorrect(state.activeStep,compositionOrder) ? "Yes. That is the build order. These use the real names from this chapter; this practice did not run Julia, add evidence, or write code for you." : "Not yet. A later line needs a name made by an earlier line. Start again and build from the supplied jars table toward the returned counts table.";
    });
    el.resetComposition.addEventListener("click",()=>{compositionOrder=[];renderComposition();});
    // Round 7 (r7-bugs #7): the restored-draft note goes on the first edit and on Run, as in Chapter 1.
    function clearRestoredDraftNote() { if (el.draftNote.textContent === RESTORED_DRAFT_NOTE) el.draftNote.textContent = ""; }
    el.code.addEventListener("input", () => { clearRunTimer(); clearRestoredDraftNote(); state=cancelRun(state); showSolvedNext(); if(storage) persistDraft(storage,state.activeStep,el.code.value); updateControls(); });
    el.code.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); el.run.click(); } });
    el.run.addEventListener("click", () => { if(el.run.disabled || isRunPending(state)) return; clearRestoredDraftNote(); const id=requestId(); state=beginRun(state,id,state.activeStep); updateControls(); el.output.textContent="Julia is checking this step (usually under two seconds)…"; send({type:"case_run", case_id:"missing-fleas-v1", chapter:"C2", step:state.activeStep, code:el.code.value, request_id:id}); armRunDeadline(id); });
    function revealHints(lastIndex) {
      const list=allHints(state.activeStep), total=ladderTotal(state.activeStep);
      while(hints <= lastIndex && hints < total) {
        if (hints < list.length) { const p=document.createElement("p"); p.textContent=list[hints]; el.hints.append(p); }
        else revealCompleteAnswer();
        hints++;
      }
      const done=hints >= total;
      el.hint.textContent=hintButtonLabel(hints, total); el.hint.disabled=done;
      // One full-answer control (r3, 2026-09-27): once the answer is out, the button has nothing left to show.
      el.answer.hidden=done;
      // r4 (2026-09-27): the button that had focus is now disabled or hidden, so focus moves to the answer.
      if (done) focusShown(el.answerOutput);
    }
    function focusShown(target) { if (!target) return; target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:"nearest"}); }
    function revealCompleteAnswer() {
      if (answerShown) return;
      const label=document.createElement("p"), pre=document.createElement("pre"), note=document.createElement("p"), pointer=document.createElement("p");
      label.className="complete-answer-label"; label.textContent="Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns. It does not count as a saved answer until Julia checks it.";
      pre.className="complete-answer-code"; pre.textContent=current().answerCode;
      note.textContent="Each run starts fresh with the supplied jars table, so this block includes every line it needs.";
      el.answerOutput.append(label,pre,note); answerShown=true;
      pointer.textContent="The complete runnable answer is shown above your editor."; el.hints.append(pointer);
    }
    el.hint.addEventListener("click", () => revealHints(hints));
    el.answer.addEventListener("click", () => revealHints(ladderTotal(state.activeStep) - 1));
    el.next.addEventListener("click", () => { const next=el.next.dataset.destination || nextStep(state.activeStep,state.result); if(next === "chapter3") { location.assign(nextChapterUrl(location.search)); return; } if(next) setStep(next); });
    $("back-c1").href = "index.html" + (attempt ? "?attempt=" + encodeURIComponent(attempt) : "");
    $("case-board").href = caseBoardUrl(location.search);
    $("new-attempt").addEventListener("click", () => { const url=new URL(location.href); url.searchParams.set("attempt",requestId()); location.assign(url.href); });
    setStep(initialStep(progress, requestedMove(location.search)),false);
    // A learner with saved C2 progress (or an explicit move in the address, as the Case Board's
    // Continue link sends) lands in the investigation directly, instead of the story screen they
    // already read (2026-09-25 fix; matches chapter3.js's resume behaviour). The story stays
    // reachable through the existing "Back to the story" button.
    if (hasOwnChapterWork(progress) || requestedMove(location.search)) { $("scene").hidden=true; $("investigation").hidden=false; }
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
  return {notebookOpen, INFO_DEADLINE_MS, RUN_DEADLINE_MS, storagePrefix, caseBoardUrl, caseLocation, nextChapterUrl, requestedMove, initialStep, unlockedStep, hasOwnChapterWork, bridgeCardCode, canEnterStep, blockedStepMessage, createState, beginInfo, failCaseInfo, expireInfo, isCurrentCaseInfo, beginRun, cancelRun, expireRun, isRunPending, applyRunStatus, leaveInvestigation, disconnect, shouldShowReconnect, applyCaseResult, validEvidenceDisplay, persistDraft, loadDraft, hasDraft, starterDraft, saveProgress, loadProgress, persistEvidence, loadEvidence, rackLabels, rateExample, groupingPreview, groupingPreviewMessage, jarMarks, showsLiveRack, nextStep, solvedNextDestination, resultText, juliaCell, juliaDivision, runOutcomeStatus, displayError, c2ErrorNextStep, c2ResultNextStep, isCurrentSocket, lessonCopy, casePurpose, allHints, ladderTotal, hintButtonLabel, freshRunNote, caseQuestionText, compositionCards, compositionIsCorrect, courseStepTitle, courseEvidencePayload, persistAcceptedCourseState, init};
});

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
  const COLUMNS = ["story", "p", "lower", "upper"];
  const FILE_URL_RECOVERY_MESSAGE = "This page was opened directly. Start run.jl, then open http://127.0.0.1:8000 to run Chapter 6.";
  const INFO_DEADLINE_MS = 5000;
  const RUN_DEADLINE_MS = 7000;
  const COPY = {
    concept: "A story fits when 5 is between its low end and its high end, both ends included. Check each end separately, then keep the rows that pass both. Coming from R? In R you would use dplyr's filter with two conditions; Julia makes two true-or-false lists and combines them. Julia's .& combines them row by row, the same way R's & does; both languages use && only for a single true-or-false answer, not a whole column.",
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
  function recoveryLead(message) {
    const guarded = protectedInputCoaching(message);
    if (guarded) return guarded;
    // Owner playtest (2026-09-26): a practice-only name typed into the case gets a plain pointer to the real inputs.
    const practice = String(message && message.message || "").match(/UndefVarError: `(practice_pass|practice_stays|practice_fails)` not defined/);
    if (practice) return practice[1] + " is a name from the practice example, not this case. In the case, use stories and observed_count.";
    const renamedName = String(message && message.message || "").match(/UndefVarError: `(candidate_models)` not defined/);
    if (renamedName) return "This name changed: use " + RENAMED_NAMES[renamedName[1]] + " instead of " + renamedName[1] + ".";
    const text = message && message.status === "error" ? String(message.message || "") : "";
    if (/non-boolean \(BitVector\) used in boolean context/.test(text)) return "Julia needed a single true or false here, which is what && and || expect, but each dotted comparison gives one value per row. Use .& to keep a row only when both checks are true.";
    if (/no method matching isless\([^)]*Vector/.test(text)) return "Julia cannot compare a whole column with one number using a comparison without a dot, such as <=. Put a dot before the comparison, as in .<=, so Julia compares every row.";
    if (/no method matching &\(::BitVector, ::BitVector\)/.test(text)) return "A plain & cannot combine two columns of true-or-false values. Put a dot before it, as in .&, so Julia combines them row by row.";
    // Night playtest (2026-09-26, claude-eyes.md, aiko.md): a plain & written on one line, before
    // the two comparisons are split into fits_low/fits_high, is a precedence trap: & binds tighter
    // than .<=, so Julia tries to combine a number with a whole column first and errors. Checked
    // live: stories.lower .<= observed_count & stories.upper .>= observed_count raises "no method
    // matching &(::Int64, ::Vector{Int64})".
    // Audit 2026-09-27 (design rule 2): this used to print the finished row rule with the case's
    // own names; it now names the idea with placeholders, not stories/observed_count.
    if (/no method matching &\(::(?!BitVector)/.test(text)) return "In R, & works row by row. In Julia, as in pandas, a plain & is done before a comparison such as .<=, so Julia tries to combine the wrong values first and fails. Add a dot: .&, and wrap each comparison in brackets, as in (a .<= b) .& (c .<= d).";
    // Sam playtest (2026-09-26, sam.md): Python's and is not a Julia keyword; it parses as a bare
    // identifier, so the ParseError points at the trailing comma rather than at and itself. Checked
    // live: Julia's own message reports "unexpected comma in array expression" for this shape.
    if (/\band\b/.test(text) && /unexpected comma/i.test(text)) return "Julia has no and: use .& between two true/false lists instead, and wrap each comparison in brackets, as in (a .<= b) .& (c .<= d).";
    return "";
  }
  // v0.2.5 night (fixer I1): the server's "coaching" line names the mistake it read from the code
  // (src/mystery_c2.jl .. mystery_c6.jl). It is "" when there is none, and never used on a passing run.
  function serverCoaching(message) {
    return message && message.pass !== true && typeof message.coaching === "string" ? message.coaching.trim() : "";
  }
  function challengeRecovery(message) {
    // With the server's line, the generic line and the page's own guess are dropped.
    const coaching = serverCoaching(message);
    if (coaching) return coaching + (message.status === "error" ? " Change your code, then run again, or open Stuck? Hints below." : " Your draft is still here. Change it and run again, or open Stuck? Hints below.");
    // repair5-5 (2026-09-24 walk-through): name the labelled Required result line and the Help me start
    // control, which the page really shows; no element is labelled as a "cue".
    // r3 (2026-09-27): that inner fold is gone, so the line names the Stuck? Hints section itself.
    // repair6-4 (2026-09-24 browser check): an error run returned no result, so it gets its own step.
    // Replay notes (2026-09-27): an error run's shown outcome already says "Your code is still
    // here" (runOutcomeStatus); this line used to add "Your draft is still here" right after it, so
    // the same idea appeared twice in one message. The error branch below drops that lead-in.
    const shared = message && message.status === "error"
      ? "Use the Original Julia error below to decide what to change, or open Stuck? Hints below, then run again."
      : "That result did not meet the stated check. Your draft is still here. Compare it with the Required result line near the top of the page, or open Stuck? Hints below, then revise it and run again.";
    const lead = recoveryLead(message);
    return lead ? `${lead} ${shared}` : shared;
  }
  function id(prefix) { return (prefix || "c6") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function validAttempt(value) { return /^[a-z0-9-]{1,80}$/.test(value || ""); }
  // The door to the ending: only once every Case file row says "What we know so far" (docs/design/03-ending.md).
  // Round 8 (r8-audit #1): the stories box already says this sentence, so the result's limit
  // paragraph leaves it out and keeps only the rest of the server's limit line.
  const BOX_LIMIT = "Fitting is not proof: two stories still fit.";
  function resultLimitText(limit) { const line = limit == null ? "" : String(limit); return line.startsWith(BOX_LIMIT) ? line.slice(BOX_LIMIT.length).trim() : line; }
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
    return Boolean(row && typeof row.story === "string" && row.story.trim() && finiteNumber(row.p) && row.p >= 0 && row.p <= 1 && Number.isInteger(row.lower) && Number.isInteger(row.upper) && row.lower >= 0 && row.lower <= row.upper && row.upper <= n_trials);
  }
  function sameRow(actual, expected) {
    return Boolean(actual && expected && actual.story === expected.story && actual.p === expected.p && actual.lower === expected.lower && actual.upper === expected.upper);
  }
  function validInfo(message) {
    const input = message && Array.isArray(message.inputs) && message.inputs.length === 1 ? message.inputs[0] : null;
    const trials = message && message.n_trials;
    return Boolean(
      input && input.id === "stories" && sameColumns(input.columns, COLUMNS) &&
      Number.isInteger(trials) && trials > 0 &&
      Number.isInteger(message.observed_count) && message.observed_count >= 0 && message.observed_count <= trials &&
      Array.isArray(input.rows) && input.rows.length >= 2 && input.rows.every(row => validCandidateRow(row, trials)) &&
      new Set(input.rows.map(row => row.story)).size === input.rows.length
    );
  }
  function candidateModelCards(metadata) {
    if (!validInfo(metadata)) return [];
    return metadata.inputs[0].rows.map(row => ({ story: row.story, p: row.p }));
  }
  // repair6-5 (2026-09-24 browser check): a card shows p separately only when its name does not already.
  function cardProbabilityLabel(card) {
    const label = `p = ${card.p}`;
    return String(card.story).includes(label) ? "" : label;
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
  // Night round 2 (r2-bugs.md finding 1): a server timeout carries its own feedback naming the
  // cause (the code ran over the time limit; a loop that never ends is the usual cause). Show that
  // line. The client's own deadline (expireRun) keeps its "took too long" text.
  const TIMEOUT_FALLBACK = "Julia stopped your code because it ran too long. A loop that never ends is the usual cause.";
  function serverTimeoutText(message) {
    const feedback = message && typeof message.feedback === "string" ? message.feedback.trim() : "";
    return (feedback || TIMEOUT_FALLBACK) + " Change your code, then run again.";
  }
  function expireRun(state, request_id) {
    if (!state.pending || state.pending.request_id !== request_id) return state;
    return Object.assign({}, state, { expired: true, statusMessage: null, runFailure: { status: "timeout", message: "This check took too long. Check your code, then run again." } });
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
      ? { status: "timeout", message: serverTimeoutText(message) }
      : { status: "rejected", run_status: message.status, message: challengeRecovery(message), original_error: message.status === "error" ? String(message.message || message.feedback || "") : "" };
    return Object.assign({}, state, { pending: null, expired: false, statusMessage: null, result: message, evidence: accepted ? { move_id: MOVE, result_data: message.result_data } : null, runFailure });
  }
  function disconnect(state) { return Object.assign({}, state, { connection: "offline", infoRequest: null, pending: null, expired: false, statusMessage: null }); }
  function connectionPlan(protocol) {
    return protocol === "file:" ? { open_socket: false, retry: false, message: FILE_URL_RECOVERY_MESSAGE } : { open_socket: true, retry: true, message: null };
  }
  function enterFileUrlRecovery(state) { return Object.assign({}, disconnect(state), { fileUrlRecovery: true }); }
  function connectionStatusText(state) {
    return state.fileUrlRecovery ? FILE_URL_RECOVERY_MESSAGE : state.runFailure ? "Your code is ready to revise." : state.metadataFailure ? state.metadataFailure : isRunPending(state) ? (state.statusMessage || "Checking your Julia result…") : state.connection === "idle" ? "Open the story board to load the stories." : state.connection === "connected" ? (state.metadata ? "Julia is ready" : "Loading the story board…") : "Connecting to the lab…";
  }
  function draftNotice(hasCode, restored) {
    if (!hasCode) return "This editor starts empty. Write your own Julia code.";
    return restored ? "Restored your saved draft: it is your earlier typing, not supplied code." : "This is your own unrun draft for this step.";
  }
  // UI-03 (2026-09-24 audit): after a run the caption says what Julia did with this code, as C3 and
  // C4 do. It says "unrun draft" again only once the learner edits the code.
  function draftStatus(message) {
    if (!message || message.status === "timeout") return "This code was not accepted; your draft is still here to check and run again.";
    if (message.status === "error") return "Julia could not run this code; your draft is still here to revise and run again.";
    if (message.status === "ok" && message.pass === true && message.progress_eligible === true) return "Julia checked this code just now and accepted it. You can change it and run again.";
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
      why: "Chapter 5 showed that 5 of 6 is not unusual under a plain 50:50 guess. Here we test the report's claim: which stories could give the count we actually observed?",
      observation: `The observed B09 count is ${observed}. In each row, p is that story's chance that one jar shows springtails. The lower and upper values are the usual range of six-jar counts for that story, not every count it could possibly give. A range that includes ${observed} does not make that story true; it only means this observation does not rule the story out.`,
      practice_stays: "Different practice story: its displayed range is 1 to 4 and its practice observation is 3. 1 ≤ 3 ≤ 4 is true, so that practice row stays.",
      practice_fails: "Different practice story: its displayed range is 0 to 2 and its practice observation is 3. 0 ≤ 3 ≤ 2 is false, so that practice row is left out.",
      bridge: "That was practice data. Now make the same true-or-false check on the named stories table above. If the symbols are new, open Stuck? Hints: it introduces .lower and .upper, .<=, .&, and [rows, :] before the full answer."
    };
  }

  // Night round 1 (r1-audit.md): every chapter is playable from the Case Board, so "Part 1 done" is
  // said only once Chapter 3 is solved in this attempt. Otherwise the line says which chapter
  // settles it, the order-free wording of story bible v2.1 change 4.
  function caseStatus(metadata, part1Done) {
    if (!validInfo(metadata)) return null;
    return {
      established:`${part1Done ? "Part 1 done: the report's 0 was a blank box, not an empty tray." : "Chapter 3 settles Part 1: whether the report's 0 is real."} Part 2 done for today: under a plain 50:50 guess, ${metadata.observed_count} of ${metadata.n_trials} is not unusual, and a fair recheck is planned. Part 3 now: does the notebook's ${metadata.observed_count} of ${metadata.n_trials} look like springtails dying out?`,
      unknown:"Still unknown: which stories could give 5. Fitting will not prove one; it can only rule some out.",
      why_now:"Why now: the report says dying out. See which stories could give 5 of 6."
    };
  }

  // docs/design/05-story-bible.md (v2, approved), "In-page case summary after C6": the plain-voice
  // replacement for this block, consistent with the ending finale (both claims checked, the springtails
  // never shown missing, the recheck still open).
  function caseClosure(metadata, resultData) {
    if (!validInfo(metadata) || !validResult(metadata, {result_data:resultData})) return null;
    return {
      title:"Three parts, one answer",
      findings:[
        "Part 1 · Check the report: the 0 for T-C was a blank box on the tally sheet, not an empty tray.",
        "Part 2 · Check the notebook: under a plain 50:50 guess, 5 of 6 is not unusual, and a fair recheck of three jars is planned.",
        "Part 3 · Test the claim: dying out almost never gives 5 of 6.",
        "Still open: the recheck. Only looking at the jars again can settle this."
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
    return row && row.label === "What we know so far" ? "Case Board updated: your Chapter 6 finding is now the last line of the case file below." : "";
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
      { label:"Check the low ends", result:"Both practice rows pass the low-end check: 1 ≤ 3 and 0 ≤ 3 are true.", next:"Now check the high ends →" },
      { label:"Check the high ends", result:"Only the first practice row passes the high-end check: 3 ≤ 4 is true, but 3 ≤ 2 is false.", next:"Combine both checks →" },
      { label:"Combine both checks", result:"Both checks must be true. The 1–4 practice range stays; the 0–2 range is left out.", next:null }
    ][Math.max(0, Math.min(2, Number.isInteger(stage) ? stage : 0))];
  }

  // UI-11 (2026-09-24 audit): an opened hint stays on screen when the next one opens, as in C1-C4.
  // The full answer itself stays in its reference panel above the editor, never in this list.
  function visibleHints(hint) {
    // r3 (2026-09-27): one ladder in every chapter (idea, code shape, whole line). The row-rule and
    // row-selection lines belong to the code-shape level and open with it.
    const stages = [[COPY.concept], [`Code shape: ${COPY.shape}`, COPY.shape_note, `Build the row rule: ${COPY.range_rule}`, `Select rows: ${COPY.selection}`], ["The complete runnable answer is shown in the code panel above your editor."]];
    const count = Math.max(0, Math.min(stages.length, Number.isInteger(hint) ? hint : 0));
    return count === 0 ? ["Open a small hint only if you need it."] : stages.slice(0, count).flat();
  }

  const HINT_LEVELS = 3;
  function hintButtonLabel(hint) { return hint >= HINT_LEVELS ? "All help shown" : ["Show the idea", "Show the code shape", "Show the whole line"][Math.max(0, hint)]; }
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
    const el = { sceneEnding: $("scene-ending"), solvedEnding: $("solved-ending"), syntax: $("syntax"), showFullAnswer: $("show-full-answer"), scene: $("scene"), work: $("work"), start: $("start"), back: $("back"), board: $("case-board"), sceneBoard: $("case-board-scene"), sceneTitle: $("scene-title"), title: $("move-title"), reconnect: $("reconnect"), status: $("status"), observed: $("observed"), modelCards: $("candidate-model-cards"), data: $("data"), scaffold: $("learning-scaffold"), caseStatus: $("case-status"), preEditorBridge: $("pre-editor-bridge"), answerReference: $("answer-before-editor"), code: $("code"), draft: $("draft-note"), run: $("run"), result: $("result"), visual: $("visual"), hint: $("hint"), nextHint: $("next-hint"), bridgeCard: $("bridge-card") };
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
        item.textContent = "The story board will appear when Julia loads.";
        el.modelCards.append(item);
        return;
      }
      // short-scroll (2026-09-25): the intro paragraph above already says what p means once; the
      // candidate table below repeats every model's exact p, lower and upper. Each card here only
      // needs to name the model (plus its p when the name does not already state it), one line.
      candidateModelCards(state.metadata).forEach(card => {
        const item = document.createElement("li"), name = document.createElement("strong"), label = cardProbabilityLabel(card);
        name.textContent = card.story;
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
      const caption = document.createElement("p"); caption.textContent = "Simulated data made for this game: no real jars, no real springtails.";
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
      const status = caseStatus(state.metadata, acceptedMoveKeys().includes("C3/filter-disagreement"));
      if (!status) return;
      const eyebrow = document.createElement("p"), established = document.createElement("p");
      const details = document.createElement("details"), summary = document.createElement("summary"), unknown = document.createElement("p"), why = document.createElement("p");
      eyebrow.className = "eyebrow"; eyebrow.textContent = "Case status before you write";
      established.textContent = status.established;
      // The limit stays visible: every step says what it does not establish (spec; 2026-09-25 review).
      // Only the "why now" reasoning sits one click away. Repair (2026-09-27 playtest): the outer
      // heading used to repeat this same summary text word for word, reading as an empty duplicate
      // heading (docs/dev-log/playtest/2026-09-26-night/claude-eyes.md, Chapter 6). One label only.
      summary.textContent = "Why now";
      unknown.textContent = status.unknown;
      why.textContent = status.why_now;
      details.append(summary, why);
      el.caseStatus.append(eyebrow, established, unknown, details);
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
      state.evidence.result_data.rows.forEach(row => { const item = document.createElement("li"); item.textContent = `${row.story}: ${row.lower} ≤ ${state.metadata.observed_count} ≤ ${row.upper}`; list.append(item); });
      limit.className = "limit"; limit.textContent = "Fitting is not proof: two stories still fit.";
      claim.className = "claim-stamp"; claim.textContent = "Part 3 done: “dying out” was never shown.";
      closingTitle.textContent = closure.title;
      const completion = document.createElement("p"); completion.className = "case-completion" + (completionLine(rows).startsWith("Case closed") ? " case-completion--solved" : ""); completion.textContent = completionLine(rows);
      closure.findings.forEach(finding => { const item = document.createElement("li"); item.textContent = finding; closingFindings.append(item); });
      review.href = boardUrl(location.search); review.className = "quiet finale-link"; review.textContent = "Review the Case Board →";
      speed.href = "course/speed-lab.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : ""); speed.className = "quiet finale-link"; speed.textContent = "Optional: open the speed lab →";
      boardUpdate.className = "board-update"; boardUpdate.textContent = boardUpdateLine(rows);
      /* r5 (2026-09-27): the two finale links are separate button-sized links on a wrapping row, not one run-together line. */ const links = document.createElement("div"); links.className = "controls finale-links"; links.append(review, speed); closing.append(completion, closingTitle, closingFindings, links, boardUpdate); section.append(title, intro, list, limit, claim, closing);
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
      holdRun(el.run, state.connection !== "connected" || !state.metadata, isRunPending(state));
      el.reconnect.hidden = !shouldShowReconnect(state);
      // short-scroll (2026-09-25): the rule (lower <= observed_count <= upper) is already the
      // required-result line just above; this only needs to name the observed count.
      el.observed.textContent = state.metadata ? `Observed B09 count: ${state.metadata.observed_count}.` : state.metadataFailure ? "The story board is unavailable; your saved draft is safe." : "The observed B09 count will appear when Julia loads.";
      if (el.answerReference) {
        if (hint >= HINT_LEVELS) { const label = document.createElement("p"), code = document.createElement("pre"); label.textContent = "Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns. It does not count as a saved answer until Julia checks it."; code.className = "complete-answer-code"; code.textContent = COPY.solution; el.answerReference.replaceChildren(label, code); el.answerReference.hidden = false; }
        else { el.answerReference.replaceChildren(); el.answerReference.hidden = true; }
      }
      renderHints(visibleHints(hint));
      el.nextHint.textContent = hintButtonLabel(hint);
      el.nextHint.disabled = hint >= HINT_LEVELS;
      if (el.showFullAnswer) el.showFullAnswer.hidden = hint >= HINT_LEVELS;
      if (bridges) bridges.renderCard(el.bridgeCard, "C6/"+MOVE, state.evidence ? submittedCode : "");
      drawModelCards(); drawTable(); drawScaffold(); drawCaseStatus(); drawVisual();
      // Round 6 (r6-rc #5) and round 7 (r7-bugs #2): once the case can close, the ending stays
      // beside Run, on a first solve and on return. The closing block below keeps a second link.
      const endingUrl = endingHref(caseFileRows(acceptedMoveKeys()), attempt);
      if (el.solvedEnding) { el.solvedEnding.hidden = !endingUrl; if (endingUrl) el.solvedEnding.href = endingUrl; }
      // Round 8 (r8-rc #3): a solved chapter also offers the ending on its story scene.
      if (el.sceneEnding) { el.sceneEnding.hidden = !endingUrl; if (endingUrl) el.sceneEnding.href = endingUrl; }
    }
    function persist() { restoredDraft = false; try { if (course && course.writeChallengeDraft) course.writeChallengeDraft(storage, attempt, CHAPTER, MOVE, el.code.value); } catch (_) {} }
    function record(message) {
      if (!course || !state.evidence || state.result !== message || state.evidence.result_data !== message.result_data) return;
      try { course.recordHistoricalMoveIfMissing(storage, attempt, CHAPTER, MOVE); course.writeEvidenceIfMissing(storage, attempt, { chapter: CHAPTER, move_id: MOVE, title: "Kept the stories that fit", row_count: message.result_data.rows.length, provenance: "historical-browser" }); course.writeCursor(storage, attempt, { chapter: CHAPTER, move_id: MOVE, mode: "challenge" }); } catch (_) {}
    }
    function showResult(message) {
      el.result.replaceChildren(); const outcome = document.createElement("p"); outcome.className = "run-outcome"; outcome.textContent = runOutcomeStatus(message, saveOk); el.result.append(outcome); const p = document.createElement("p"); p.textContent = text(message.message || message.feedback || "Julia returned a result."); el.result.append(p);
      if (message.original_error) { const details = document.createElement("details"), summary = document.createElement("summary"), original = document.createElement("pre"); summary.textContent = "Original Julia error"; original.textContent = text(message.original_error); details.append(summary, original); el.result.append(details); }
      if (message.explanation) { const accepted = message.status === "ok" && message.pass === true; /* Round 8 (r8-audit #1): one paragraph per line, no labels, as in C1-C4; the stories box keeps the first limit sentence. */ (accepted ? [message.explanation.julia, message.explanation.case, resultLimitText(message.explanation.limit)] : [message.explanation.julia]).map(text).filter(Boolean).forEach(line => { const item = document.createElement("p"); item.textContent = line; el.result.append(item); }); }
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
    // r5 (2026-09-27): while Julia runs, Run stays focusable and reads as busy (aria-disabled), so keyboard focus is not dropped to the page.
    function holdRun(button, blocked, busy) { if (!button) return; button.disabled = blocked; if (busy && !blocked) button.setAttribute("aria-disabled", "true"); else button.removeAttribute("aria-disabled"); }
    // r5 (2026-09-27): on first load the skip link's target sits in the hidden work area; open it as the start button does.
    const skip = document.querySelector("a.skip"); if (skip) skip.addEventListener("click", event => { if (!el.work.hidden) return; event.preventDefault(); el.start.click(); });
    el.start.addEventListener("click", () => { el.scene.hidden = true; el.work.hidden = false; connect(); focusElement(el.title); });
    el.back.addEventListener("click", () => { clearRunTimer(); el.work.hidden = true; el.scene.hidden = false; focusElement(el.sceneTitle); });
    el.reconnect.addEventListener("click", connect);
    el.code.addEventListener("input", () => { clearRunTimer(); lastRun = null; persist(); if (el.draft) el.draft.textContent = draftCaption(); });
    el.run.addEventListener("click", () => { if (isRunPending(state)) return; persist(); submittedCode = el.code.value; state = beginRun(state, id("c6-run")); if (state.pending) { const requestId = state.pending.request_id; el.result.replaceChildren(); el.visual.replaceChildren(); send(runMessage(el.code.value, requestId)); armRunDeadline(requestId); render(); } });
    el.code.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); el.run.click(); } });
    // r4 (2026-09-27): the ladder button (now disabled) or the full-answer button (now hidden) had focus, so focus moves to the answer.
    function focusShown(target) { if (!target || target.hidden) return; target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:"nearest"}); }
    el.nextHint.addEventListener("click", () => { hint = Math.min(HINT_LEVELS, hint + 1); render(); if (hint >= HINT_LEVELS) focusShown(el.answerReference); });
    // Owner playtest (2026-09-26): the full answer is one visible click away, as in Chapters 2-4; it reuses the
    // hint ladder's own reference display (shown at the last hint level) and never enters the editor.
    if (el.showFullAnswer) el.showFullAnswer.addEventListener("click", () => { hint = HINT_LEVELS; render(); focusShown(el.answerReference); });
    window.addEventListener("pagehide", () => { clearInfoTimer(); clearRunTimer(); if (socket) socket.close(); });
    render();
  }

  return { resultLimitText, CASE_ID, CHAPTER, MOVE, COPY, HINT_LEVELS, hintButtonLabel, completionLine, endingHref, INFO_DEADLINE_MS, RUN_DEADLINE_MS, createState, initialEditorText, challengeRecovery, beginInfo, failCaseInfo, expireInfo, candidateModelCards, applyCaseInfo, beginRun, expireRun, isRunPending, applyRunStatus, applyCaseResult, disconnect, connectionPlan, enterFileUrlRecovery, connectionStatusText, draftNotice, draftStatus, runOutcomeStatus, shouldShowReconnect, infoMessage, runMessage, boardUrl, learningScaffold, caseStatus, caseClosure, cardProbabilityLabel, caseFileRows, boardUpdateLine, rangePracticeStep, visibleHints, preEditorBridge, preEditorBridgeVisible, init };
});

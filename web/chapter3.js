/* Julia Time: Missing Fleas C3. The server remains the source of all case data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeChapter3 = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", api.init);
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const INFO_DEADLINE_MS = 5000;
  const RUN_DEADLINE_MS = 7000;

  const CASE_ID = "missing-fleas-v1";
  const CHAPTER = "C3";
  const MOVES = ["join-report-log", "filter-disagreement"];
  const DEMO_ACTIVITY = "practice-join-v1";
  const DEMO_INPUTS = ["practice_counts", "practice_sheet"];
  const TABLE_IDENTITIES = Object.freeze({
    tray_counts:Object.freeze({name:"tray_counts", title:"The notebook's counts for each tray", role:"Left table: keep every tray"}),
    tally_sheet:Object.freeze({name:"tally_sheet", title:"Toto’s typed copy of the tally sheet", role:"Right table: add its matching sheet columns"}),
    joined:Object.freeze({name:"joined", title:"The lined-up table", role:"Your step 1 result, made again for this step"}),
    practice_counts:Object.freeze({name:"practice_counts", title:"Practice counts", role:"Practice-only left table"}),
    practice_sheet:Object.freeze({name:"practice_sheet", title:"Practice sheet", role:"Practice-only right table"})
  });
  const INPUTS = {
    "join-report-log": ["tray_counts", "tally_sheet"],
    "filter-disagreement": ["joined"]
  };
  const JOIN_COLUMNS = ["tray_id", "notebook_detected", "sheet_detected", "entry_status"];
  const COPY = {
    "join-report-log": {
      label: "Step 1 of 2 · Line up the two records",
      title: "Step 1 · Put each tray’s two records side by side",
      question: "How do we put each tray’s notebook count next to its row in Toto’s typed copy?",
      returnSpec: "One row per tray, with its notebook count and the columns from Toto’s typed copy.",
      bridge: "Both tables have a tray_id column, and each tray appears once in each. That shared label tells Julia which rows belong together.",
      // Story spine beat 2 ("why this code", docs/design/06-story-spine.md, approved 2026-09-27):
      // one plain line under the step title, before the task text.
      why: "Put the notebook's count and Toto's typed count for each tray in one row, so they can be compared.",
      concept: "Match each tray in tray_counts with the row for the same tray in tally_sheet.\n\nComing from R? In R you would use dplyr’s left_join; Julia’s is spelled leftjoin.",
      shape: "leftjoin(left_table, right_table, on=:shared_column)",
      shapeNote: "The three words are placeholders: use the table names above and :tray_id.",
      solution: "leftjoin(tray_counts, tally_sheet, on=:tray_id)",
      syntax: "leftjoin means: keep every row of the left table, and add the matching columns from the right table. on= means “match using”; :tray_id is the column.",
      recovery: "Check that leftjoin has two tables separated by a comma, then check the second comma comes before the on= instruction that names their shared column. Run the join again.",
      visualTitle: "Rows lined up by tray"
    },
    "filter-disagreement": {
      label: "Step 2 of 2 · Find the tray that disagrees",
      title: "Step 2 · Keep the tray where the notebook and Toto's typed copy disagree",
      question: "On which tray do the two counts differ?",
      returnSpec: "Only the row where notebook_detected and sheet_detected differ.",
      bridge: "This step reuses your step 1 join: one row per tray, ready to compare the notebook count with Toto's typed count.",
      why: "Keep only the tray where they disagree: that is where the 0 came from.",
      concept: "Keep a row only where the notebook count is not equal to Toto's typed count.\n\nComing from R? In R you would use dplyr’s filter with !=; Julia uses the same true-or-false row rule as Chapter 1.",
      scaffolds: [
        // B9 (simulated playtest, P21/P43): the placeholders were typed as written. Say so and map them.
        {label:"Build the row rule", text:"row_rule = table.left_count .!= table.right_count", note:"table, left_count and right_count are placeholders, not names in this case. Here table is joined, left_count is notebook_detected, and right_count is sheet_detected."},
        {label:"Select with the row rule", text:"table[row_rule, :]"}
      ],
      shape: "table[table.left_count .!= table.right_count, :]",
      solution: "joined[joined.notebook_detected .!= joined.sheet_detected, :]",
      syntax: "Chapter 1’s .== compared each value with a target. .!= is its “not equal” partner: it checks each paired count and is true when they differ. Inside brackets, the comma separates the row rule from the columns position; : in the second position means all columns. The dot: .!= compares row by row; a plain != compares the two whole columns and gives one answer.",
      recovery: "Check that .!= has the dot, then keep the comma before : so Julia knows you want every column of the matching row.",
      visualTitle: "The tray that disagrees"
    }
  };

  function knownMove(move) { return MOVES.includes(move); }
  function tableIdentity(id) {
    const identity = TABLE_IDENTITIES[id];
    return identity ? {name:identity.name, title:identity.title, role:identity.role} : null;
  }
  function activeInputIds(move) { return knownMove(move) ? INPUTS[move].slice() : []; }
  function lessonCopy(move) { return COPY[knownMove(move) ? move : MOVES[0]]; }
  function recoveryCopy(move) { return lessonCopy(move).recovery; }
  // UI-12 (2026-09-24 browser check): an R (dplyr) join habit used to get only the comma advice,
  // with the cause hidden in the collapsed Julia error. Like C1's challengeRecovery, each line is
  // keyed on Julia's actual error text and sits in front of the move's existing recovery copy.
  function joinErrorCoaching(message) {
    if (!message || message.status !== "error") return "";
    const text = String(message.message || "");
    const rName = text.match(/UndefVarError: `((?:left|inner|right|full)_join)` not defined/);
    if (rName) return rName[1] + " is an R (dplyr) name. Julia's join here is leftjoin, with no underscore, and it names the shared column with on= where R uses by=.";
    if (/unsupported keyword argument "by"/.test(text)) return "by= is how R (dplyr) names the join column. Julia's leftjoin uses on= instead.";
    return "";
  }
  // UI-12 (filter part): != without the dot compares the two whole columns and returns a single
  // Bool, which DataFrames rejects as a row index (or as a subset result). Keyed on that real text.
  function filterErrorCoaching(message) {
    if (!message || message.status !== "error") return "";
    const text = String(message.message || "");
    if (/invalid row index of type Bool|returned value of type `Bool` while it must return an `AbstractVector`/.test(text)) return "Julia got just one true or false, but it needs one for each row. Without the dot, != compares the two whole columns at once and gives a single answer. Write .!= so each row gets its own true or false.";
    if (/objects of type (?:DataFrames\.)?DataFrame are not callable/.test(text)) return "Julia's filter takes the rule first: filter(row -> ..., joined), or keep rows with joined[rule, :].";
    return "";
  }
  // Repair 3 R6 (simulated re-test): the join shape's placeholders typed as written. Challenge
  // editor only; the practice editor (renderDemoResult) has different table names.
  function joinPlaceholderCoaching(message) {
    if (!message || message.status !== "error") return "";
    const text = String(message.message || "");
    const placeholder = text.match(/UndefVarError: `(left_table|right_table|shared_column)` not defined|column :(shared_column) not found/);
    if (placeholder) return (placeholder[1] || placeholder[2]) + " is a placeholder from the code shape, not a name in this case. Here the left table is tray_counts, the right table is tally_sheet, and the shared column is :tray_id.";
    return "";
  }
  // Repair 4 (review of repair 3): move 2's own code-shape placeholders typed as written, mapped
  // like the B9 hint note. Keyed on Julia's UndefVarError or DataFrames' missing-column text.
  function filterPlaceholderCoaching(message) {
    if (!message || message.status !== "error") return "";
    const text = String(message.message || "");
    const placeholder = text.match(/UndefVarError: `(table|left_count|right_count)` not defined|column name (?::|")(left_count|right_count)"? not found/);
    if (placeholder) return (placeholder[1] || placeholder[2]) + " is a placeholder from the code shape, not a name in this case. Here table is joined, left_count is notebook_detected, and right_count is sheet_detected.";
    return "";
  }
  function undefinedName(message) {
    const name = String(message.message || "").match(/UndefVarError: `([^`]+)` not defined/);
    return name ? name[1] : "";
  }
  // Repair 4: a bare column name and R's $ also raise UndefVarError, and the fresh-start line gave
  // them a wrong cause. Keyed on the same real text, each gets the move's own way to name a column.
  function columnNameCoaching(move, message) {
    if (!message || message.status !== "error") return "";
    const name = undefinedName(message);
    const join = move === "join-report-log";
    if (name === "$") return "R's $ does not exist in Julia: Julia reads a column with a dot, as in " + (join ? "tray_counts.tray_id. In leftjoin, name the shared column with a colon: on=:tray_id." : "joined.notebook_detected.");
    if (!JOIN_COLUMNS.includes(name)) return "";
    return join ? name + " is a column name, not a name Julia knows on its own. Name a column with a colon, as in on=:tray_id."
      : name + " is a column of joined, not a name Julia knows on its own. Read a column from joined with a dot, as in joined." + name + ".";
  }
  // A returning player's saved draft may still use a name from before the story rename (bible v2
  // section 3.1). Keyed on Julia's own UndefVarError so the coaching leads with the actual cause.
  const RENAMED_NAMES = Object.freeze({
    report:"tray_counts", handling_log:"tally_sheet", reported_detected_n:"notebook_detected",
    logged_detected_n:"sheet_detected", log_status:"entry_status"
  });
  function oldNameCoaching(message) {
    const name = undefinedName(message);
    const renamed = RENAMED_NAMES[name];
    return renamed ? "This name changed: use " + renamed + " instead of " + name + "." : "";
  }
  // Repair 3 R2 (simulated re-test): move 2 supplies only joined, so rebuilding the join from
  // report, handling_log or jars fails. Repair 4: keyed on Julia's UndefVarError for a case table
  // name that is not an active input of this move, and only for those.
  const CASE_TABLES = ["tray_counts", "tally_sheet", "jars", "joined", "practice_counts", "practice_sheet"];
  function missingInputCoaching(move, message) {
    if (!message || message.status !== "error") return "";
    const name = undefinedName(message);
    const inputs = activeInputIds(move);
    if (!CASE_TABLES.includes(name) || !inputs.length || inputs.includes(name)) return "";
    return name + " is not defined in this run. Each run starts fresh, and this step supplies only " + inputs.join(" and ") + ", so start from " + (inputs.length === 1 ? inputs[0] : "those") + ".";
  }
  // Repair 4: after a line about one name, the move's checklist would name a different mistake.
  // r5 (2026-09-27): the outcome line above already says "Your code is still here", so this says it no second time.
  const NAME_LEAD_NEXT = "Change that line and run again.";
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
  function finishedRecovery(move, message) {
    return coachingWithEnding(message) || (message && message.feedback) || "That result does not yet match the requested return. " + recoveryCopy(move);
  }
  function errorRecovery(move, message) {
    const coached = coachingWithEnding(message);
    if (coached) return coached;
    const guarded = protectedInputCoaching(message);
    if (guarded) return guarded;
    const named = move === "join-report-log" ? joinErrorCoaching(message) : move === "filter-disagreement" ? filterErrorCoaching(message) : "";
    // Round 7 (r7-r-struggling #8): the named line says what is wrong, so the fixed comma advice
    // is dropped and the line ends as a coaching line does.
    if (named) return named + " Change your code, then run again, or open Stuck? Hints below.";
    const nameLead = !knownMove(move) ? "" : oldNameCoaching(message) || (move === "join-report-log" ? joinPlaceholderCoaching(message) : filterPlaceholderCoaching(message)) || columnNameCoaching(move, message) || missingInputCoaching(move, message);
    return nameLead ? nameLead + " " + NAME_LEAD_NEXT : recoveryCopy(move);
  }
  function needsRecoveryFocus(message) { return Boolean(message && (message.status === "error" || message.status === "timeout")); }
  // Round 7 (r7-bugs #6): the run status and the result already say "Not yet" and why, so the
  // note under the editor does not repeat it; the same wording as Chapter 4.
  function draftStatus(message) {
    if (!message || message.status === "timeout") return "Your code took too long, so the lab stopped it. Your code is still here.";
    if (message.status === "ok" && message.pass === true) return "Julia checked it: that's right. You can change it and run again.";
    if (message.status === "ok" || message.status === "error") return "This is your code from the last run.";
    return "This is your own unrun draft for this step.";
  }
  // UI-08 (2026-09-24 browser check): the practice lines used to keep saying "not run yet" above
  // Julia's returned table. A null message means the run has started and not yet settled.
  function demoDraftStatus(message) {
    if (!message) return "Julia is running this practice code now. It is separate from the case editor.";
    if (message.status === "ok") return "Julia ran this practice code just now. It is separate from the case editor; change it and run again if you like.";
    if (message.status === "error") return "Julia could not run this practice code. Your practice draft is still here to revise and run again.";
    return "This practice run did not finish in time. Your practice draft is still here to check and run again.";
  }
  function demoPlanStatus(message) {
    if (!message) return "Julia is running this practice code. Its result will appear below, ready to compare with your prediction.";
    if (message.status === "ok") return "Julia ran this practice code. Compare what it returned below with your prediction.";
    if (message.status === "error") return "Julia could not run this practice code, so there is no result to compare with your prediction yet.";
    return "This practice run did not finish, so there is no result to compare with your prediction yet.";
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
    if (message.status === "timeout") return "Not yet. Your code took too long, so the lab stopped it. Your code is still here.";
    if (message.status === "error") return "Not yet. Julia could not run this code. Your code is still here.";
    return "Not yet. Julia ran your code; the result below is not quite what we need.";
  }
  function helpStages(move) {
    const copy = lessonCopy(move);
    const scaffolds = Array.isArray(copy.scaffolds) ? copy.scaffolds : [];
    // r3 (2026-09-27): one ladder in every chapter, Show the idea, Show the code shape, Show the
    // whole line. Step 2's two row-rule pieces belong to its code-shape level and open with it, and
    // "Show the whole line" shows the line at once (no warning card first). button is the label
    // the ladder shows once that stage's level is out.
    return [
      {label:"Idea", text:copy.concept, level:0, button:"Show the code shape"},
      ...scaffolds.map(item => Object.assign({}, item, {level:1, button:"Show the whole line"})),
      Object.assign({label:"Code shape", text:copy.shape, level:1, button:"Show the whole line"}, copy.shapeNote ? {note:copy.shapeNote} : {}),
      {label:"Full answer", text:copy.solution, level:2, button:"All help shown"}
    ];
  }
  // The last stage index on the same ladder level as stage index, so one click opens a whole level.
  function helpLevelEnd(move, index) {
    const stages = helpStages(move), stage = stages[index];
    if (!stage) return index;
    let last = index;
    while (stages[last + 1] && stages[last + 1].level === stage.level) last += 1;
    return last;
  }
  function helpStage(move, index) {
    return helpStages(move)[index] || null;
  }
  function validAttempt(value) { return /^[a-z0-9-]{1,80}$/.test(value || ""); }
  function caseBoardUrl(search) {
    const attempt = new URLSearchParams(search || "").get("attempt");
    return "course/index.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function nextChapterUrl(search) {
    const attempt = new URLSearchParams(search || "").get("attempt");
    return "chapter4.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function requestedMove(search) {
    const move = new URLSearchParams(search || "").get("move_id") || new URLSearchParams(search || "").get("move");
    return knownMove(move) ? move : "";
  }
  function createState() {
    return {connection:"connecting", activeMove:MOVES[0], infoRequest:null, pending:null, expired:false, statusMessage:null, metadata:null, metadataFailure:"", result:null, evidence:null, joinAccepted:false, demoInfoRequest:null, demoPending:null, demoExpired:false, demoStatusMessage:null, demoMetadata:null, demoResult:null};
  }
  function beginInfo(state, requestId, moveId) {
    const move = knownMove(moveId) ? moveId : MOVES[0];
    return Object.assign({}, state, {
      activeMove:move,
      infoRequest:{case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:null, request_id:requestId},
      pending:null,
      expired:false,
      statusMessage:null,
      metadata:null,
      result:null,
      metadataFailure:""
    });
  }
  function failCaseInfo(state, message) {
    if (!state.infoRequest || !message || message.type !== "error") return state;
    const text = /unknown mystery chapter/i.test(String(message.message || "")) ? "The local lab does not recognise this chapter. Restart Julia Time, then reload this page. Your draft is still here." : "The chapter inputs are unavailable. Restart Julia Time, then reload this page. Your draft is still here.";
    return Object.assign({}, state, {infoRequest:null, metadata:null, metadataFailure:text});
  }
  function expireInfo(state, requestId) {
    if (!state.infoRequest || state.infoRequest.request_id !== requestId) return state;
    return Object.assign({}, state, {infoRequest:null, metadata:null, metadataFailure:"The case data took too long to arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here."});
  }
  function beginRun(state, requestId, moveId) {
    const move = knownMove(moveId) ? moveId : state.activeMove;
    if (!knownMove(move)) return state;
    return Object.assign({}, state, {
      activeMove:move,
      pending:{case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:null, request_id:requestId},
      expired:false,
      statusMessage:null,
      result:null
    });
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
  function expireRun(state, requestId) {
    if (!state.pending || state.pending.request_id !== requestId) return state;
    return Object.assign({}, state, {expired:true, statusMessage:null, result:{type:"case_result", status:"timeout", message:"This check took too long. Check your code, then run again."}});
  }
  function cancelRun(state) { return Object.assign({}, state, {pending:null, expired:false, statusMessage:null, result:null}); }
  function cancelDemo(state) { return Object.assign({}, state, {demoInfoRequest:null, demoPending:null, demoExpired:false, demoStatusMessage:null, demoResult:null}); }
  function disconnect(state) { return Object.assign({}, state, {connection:"offline", infoRequest:null, pending:null, expired:false, statusMessage:null, demoInfoRequest:null, demoPending:null, demoExpired:false, demoStatusMessage:null}); }
  function isRunPending(state) { return Boolean(state.pending) && !state.expired; }
  function isDemoRunPending(state) { return Boolean(state.demoPending) && !state.demoExpired; }
  function applyRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.pending || state.expired || message.request_id !== state.pending.request_id) return state;
    return Object.assign({}, state, {statusMessage: message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : ""});
  }
  function applyDemoRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.demoPending || state.demoExpired || message.request_id !== state.demoPending.request_id) return state;
    return Object.assign({}, state, {demoStatusMessage: message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : ""});
  }
  function exactInputSet(inputs, move) {
    if (!Array.isArray(inputs) || inputs.length !== activeInputIds(move).length) return false;
    const expected = activeInputIds(move).slice().sort();
    const ids = inputs.map(input => input && input.id).sort();
    return ids.every((id, index) => id === expected[index]) && new Set(ids).size === ids.length && inputs.every(validTableInput);
  }
  function validTableInput(input) {
    return Boolean(input && typeof input.id === "string" && Array.isArray(input.columns) && input.columns.every(column => typeof column === "string") && Array.isArray(input.rows) && input.rows.every(row => row && typeof row === "object" && !Array.isArray(row)));
  }
  function sameCaseIdentity(message, expected) {
    return Boolean(message && expected && message.contract_version === 1 && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id && message.request_id === expected.request_id);
  }
  function applyCaseInfo(state, message) {
    if (!state.infoRequest || !message || message.type !== "case" || !sameCaseIdentity(message, state.infoRequest) || message.move_id !== state.activeMove || !exactInputSet(message.inputs, state.activeMove)) return state;
    return Object.assign({}, state, {infoRequest:null, metadata:message, metadataFailure:""});
  }
  function exactDemoInputSet(inputs) {
    if (!Array.isArray(inputs) || inputs.length !== DEMO_INPUTS.length) return false;
    const ids = inputs.map(input => input && input.id).sort();
    return ids.every((id, index) => id === DEMO_INPUTS.slice().sort()[index]) && new Set(ids).size === ids.length && inputs.every(validTableInput);
  }
  function beginDemoInfo(state, requestId) {
    if (state.activeMove !== "join-report-log") return state;
    return Object.assign({}, state, {demoInfoRequest:{case_id:CASE_ID, chapter:CHAPTER, move_id:"join-report-log", mode:"demonstration", activity_id:DEMO_ACTIVITY, simulation_id:null, request_id:requestId}, demoMetadata:null, demoResult:null, demoPending:null});
  }
  function expireDemoInfo(state, requestId) {
    if (!state || !state.demoInfoRequest || state.demoInfoRequest.request_id !== requestId) return state;
    return Object.assign({}, state, {demoInfoRequest:null, demoMetadata:null, demoPending:null, demoResult:{type:"case_result", status:"timeout", request_id:requestId, message:"The practice tables took too long to arrive. Reconnect or reopen this practice section to try again; your editor is unchanged."}});
  }
  function applyDemoInfo(state, message) {
    if (!state.demoInfoRequest || !message || message.type !== "case" || !sameCaseIdentity(message, state.demoInfoRequest) || message.mode !== "demonstration" || message.activity_id !== DEMO_ACTIVITY || !exactDemoInputSet(message.inputs)) return state;
    return Object.assign({}, state, {demoInfoRequest:null, demoMetadata:message});
  }
  function sameRunIdentity(message, expected) {
    return sameCaseIdentity(message, expected) && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id;
  }
  function applyCaseResult(state, message) {
    if (!state.pending || !message || message.type !== "case_result" || !sameRunIdentity(message, state.pending)) return state;
    const visual = message.status === "ok" && message.pass === true && message.progress_eligible === true ? visualData(state.activeMove, message) : null;
    const evidence = visual ? {move_id:state.activeMove, columns:message.columns.slice(), rows:message.rows.map(row => Object.assign({}, row)), visual:visual} : state.evidence;
    return Object.assign({}, state, {pending:null, expired:false, statusMessage:null, result:message, evidence:evidence});
  }
  function beginDemoRun(state, requestId) {
    if (state.activeMove !== "join-report-log" || !state.demoMetadata) return state;
    return Object.assign({}, state, {demoPending:{case_id:CASE_ID, chapter:CHAPTER, move_id:"join-report-log", mode:"demonstration", activity_id:DEMO_ACTIVITY, simulation_id:null, request_id:requestId}, demoExpired:false, demoStatusMessage:null, demoResult:null});
  }
  // `demoPending` is kept (not nulled) on expiry, same reasoning as `expireRun` above (B1).
  function expireDemoRun(state, requestId) {
    if (!state || !state.demoPending || state.demoPending.request_id !== requestId) return state;
    return Object.assign({}, state, {demoExpired:true, demoStatusMessage:null, demoResult:{type:"case_result", status:"timeout", request_id:requestId, message:"The practice run took too long. Your practice code is still here; check it and run again."}});
  }
  function applyDemoResult(state, message) {
    if (!state.demoPending || !message || message.type !== "case_result" || !sameRunIdentity(message, state.demoPending)) return state;
    return Object.assign({}, state, {demoPending:null, demoExpired:false, demoStatusMessage:null, demoResult:message});
  }
  function normalisedJoinRows(payload) {
    if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.rows) || !JOIN_COLUMNS.every(column => payload.columns.includes(column))) return null;
    if (payload.rows.length === 0 || !payload.rows.every(row => row && typeof row === "object" && typeof row.tray_id === "string" && row.tray_id.length > 0 && Number.isFinite(row.notebook_detected) && Number.isFinite(row.sheet_detected) && typeof row.entry_status === "string")) return null;
    if (new Set(payload.rows.map(row => row.tray_id)).size !== payload.rows.length) return null;
    return payload.rows.map(row => ({tray_id:row.tray_id, notebook:row.notebook_detected, sheet:row.sheet_detected, entry_status:row.entry_status}));
  }
  function visualData(move, payload) {
    const rows = normalisedJoinRows(payload);
    if (!rows) return null;
    if (move === "join-report-log") return {kind:"key-alignment", rows:rows};
    if (move === "filter-disagreement" && rows.length === 1 && rows[0].notebook !== rows[0].sheet) return {kind:"tray-disagrees", rows:rows};
    return null;
  }
  function acceptedMoveKeys(courseState, storage, attempt) {
    if (!courseState || typeof courseState.acceptedMoves !== "function") return [];
    try {
      const course = typeof courseState.readCourseState === "function" ? courseState.readCourseState(storage, attempt) : undefined;
      const moves = courseState.acceptedMoves(course);
      return Array.isArray(moves) ? moves.map(move => move && move.key).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function canOpenMove(courseState, storage, attempt, move) {
    if (!knownMove(move)) return false;
    return move === "join-report-log" || acceptedMoveKeys(courseState, storage, attempt).includes("C3/join-report-log");
  }
  // No step in the address: resume at the first unsolved step, or the last when both are solved (2026-09-25).
  function initialMove(courseState, storage, attempt, requested) {
    const solved = acceptedMoveKeys(courseState, storage, attempt);
    const resume = MOVES.find(item => !solved.includes(CHAPTER + "/" + item)) || MOVES[MOVES.length - 1];
    const move = knownMove(requested) ? requested : resume;
    return canOpenMove(courseState, storage, attempt, move) ? move : "join-report-log";
  }
  // UI-04 (2026-09-24 browser check): C2 hands over a C3 cursor when its last move is accepted, so
  // a cursor alone is not earlier C3 work. Resume needs an accepted C3 move or the learner's own
  // non-blank C3 challenge draft in this browser.
  function hasOwnChapterWork(courseState, storage, attempt) {
    if (acceptedMoveKeys(courseState, storage, attempt).some(key => key.startsWith(CHAPTER + "/"))) return true;
    if (!courseState || typeof courseState.readChallengeDrafts !== "function") return false;
    try {
      return Object.entries(courseState.readChallengeDrafts(storage, attempt) || {}).some(([key, value]) => key.startsWith(CHAPTER + "/") && typeof value === "string" && value.trim() !== "");
    } catch (_) { return false; }
  }
  // With saved Chapter 3 work or a step in the address, open the investigation directly (round-4 bot,
  // 2026-09-26), as Chapter 2 does; the story stays one click away via "Back to the story".
  function landsInInvestigation(hasSavedWork, requested) { return Boolean(hasSavedWork) || Boolean(requested); }
  function savedChallengeResume(courseState, storage, attempt) {
    if (!courseState || typeof courseState.readCursor !== "function") return null;
    try {
      const cursor = courseState.readCursor(storage, attempt);
      if (!cursor || cursor.chapter !== CHAPTER || cursor.mode !== "challenge" || !knownMove(cursor.move_id)) return null;
      if (!hasOwnChapterWork(courseState, storage, attempt)) return null;
      return canOpenMove(courseState, storage, attempt, cursor.move_id) ? cursor.move_id : null;
    } catch (_) { return null; }
  }
  function nextMove(move) { return move === "join-report-log" ? "filter-disagreement" : "filter-disagreement"; }
  function isAcceptedChallengeResult(result) {
    return Boolean(result && result.type === "case_result" && result.contract_version === 1 && result.case_id === CASE_ID && result.chapter === CHAPTER && knownMove(result.move_id) && result.mode === "challenge" && result.activity_id === null && result.simulation_id === null && result.status === "ok" && result.pass === true && result.progress_eligible === true && visualData(result.move_id, result));
  }
  function shouldRenderCaseVisual(result) { return isAcceptedChallengeResult(result); }
  function shouldOfferCaseReturn(result) {
    return Boolean(result && result.type === "case_result" && result.contract_version === 1 && result.case_id === CASE_ID && result.chapter === CHAPTER && result.move_id === "join-report-log" && result.mode === "demonstration" && result.activity_id === DEMO_ACTIVITY && result.simulation_id === null && typeof result.request_id === "string" && result.request_id.length > 0 && ["ok", "error", "timeout"].includes(result.status));
  }
  function shouldShowDemoCaseBridge(result) { return shouldOfferCaseReturn(result) && result.status === "ok" && result.practice_pass === true; }
  function persistChallengeDraft(courseState, storage, attempt, move, code) {
    if (!courseState || typeof courseState.writeChallengeDraft !== "function" || !knownMove(move) || typeof code !== "string") return false;
    try { return courseState.writeChallengeDraft(storage, attempt, CHAPTER, move, code) === true; } catch (_) { return false; }
  }
  function persistDemoDraft(courseState, storage, attempt, code) {
    if (!courseState || typeof courseState.writeDraft !== "function" || typeof code !== "string") return false;
    try { return courseState.writeDraft(storage, attempt, CHAPTER, "join-report-log", "demonstration", DEMO_ACTIVITY, code) === true; } catch (_) { return false; }
  }
  function persistAcceptedCourseResult(courseState, storage, attempt, result) {
    if (!isAcceptedChallengeResult(result) || !courseState || typeof courseState.recordHistoricalMoveIfMissing !== "function" || typeof courseState.writeEvidenceIfMissing !== "function" || typeof courseState.writeCursor !== "function") return false;
    const title = result.move_id === "join-report-log" ? "Notebook and Toto’s typed copy lined up" : "The 0 was a blank box";
    try {
      courseState.recordHistoricalMoveIfMissing(storage, attempt, CHAPTER, result.move_id);
      courseState.writeEvidenceIfMissing(storage, attempt, {chapter:CHAPTER, move_id:result.move_id, title:title, row_count:result.rows.length, provenance:"historical-browser"});
      courseState.writeCursor(storage, attempt, {chapter:CHAPTER, move_id:nextMove(result.move_id), mode:"challenge"});
      return true;
    } catch (_) { return false; }
  }
  function requestId(prefix) { return (prefix || "c3") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function infoMessage(move, id) { return {type:"case_info", contract_version:1, case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:null, request_id:id}; }
  function runMessage(move, code, id) { return {type:"case_run", contract_version:1, case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:null, code:code, request_id:id}; }
  function demoInfoMessage(id) { return {type:"case_info", contract_version:1, case_id:CASE_ID, chapter:CHAPTER, move_id:"join-report-log", mode:"demonstration", activity_id:DEMO_ACTIVITY, simulation_id:null, request_id:id}; }
  function demoRunMessage(code, id) { return {type:"case_run", contract_version:1, case_id:CASE_ID, chapter:CHAPTER, move_id:"join-report-log", mode:"demonstration", activity_id:DEMO_ACTIVITY, simulation_id:null, code:code, request_id:id}; }
  function safeText(value) {
    if (value == null) return "";
    if (typeof value === "object") return value.display == null ? JSON.stringify(value) : String(value.display);
    return String(value);
  }

  function init() {
    const $ = id => document.getElementById(id);
    const el = {
      scene:$("scene"), investigation:$("investigation"), start:$("start-investigation"), back:$("back-to-scene"), resumeSaved:$("resume-saved"), resumeSavedNote:$("resume-saved-note"), resumeSavedMove:$("resume-saved-move"),
      board:$("case-board"), location:$("course-location"), reconnect:$("reconnect"), moveButtons:document.querySelectorAll("[data-move]"),
      title:$("move-title"), stepWhy:$("step-why"), question:$("move-question"), bridge:$("move-bridge"), returnSpec:$("return-spec"), syntax:$("syntax-note"), challengeBridge:$("challenge-bridge"),
      inputs:$("visible-inputs"), bindings:$("case-bindings"), code:$("code"), run:$("run"), runStatus:$("run-status"), result:$("result"), visual:$("returned-visual"),
      help:$("help-list"), nextHelp:$("next-help"), showAnswer:$("show-answer"), answerReference:$("answer-before-editor"), bridgeCard:$("bridge-card"), blankNote:$("blank-note"), connection:$("connection"), nextMove:$("next-move"), draftNote:$("draft-note"),
      demoPanel:$("demo-panel"), demoCopy:$("demo-copy"), demoInputs:$("demo-inputs"), demoCode:$("demo-code"), demoTokenButtons:document.querySelectorAll("[data-demo-token]"), runDemo:$("run-demo"), demoPlan:$("demo-plan"), demoResult:$("demo-result"), demoCaseBridge:$("demo-case-bridge"), returnToCase:$("return-to-case"), demoDraftNote:$("demo-draft-note")
    };
    let storage = null;
    try { storage = localStorage; } catch (_) {}
    const courseState = typeof window !== "undefined" ? window.JuliaTimeCourseState : null;
    const bridges = typeof window !== "undefined" ? window.JuliaTimeBridges : null;
    const submittedCode = Object.create(null);
    // Separate from submittedCode: only ever written inside the accepted branch below, so a later
    // failed resubmit (which overwrites submittedCode) can never leak into the bridge card when the
    // learner switches moves and back (renderMove() below reads only this map).
    const acceptedCode = Object.create(null);
    const requestedAttempt = new URLSearchParams(location.search).get("attempt");
    const attempt = validAttempt(requestedAttempt) ? requestedAttempt : "";
    let state = createState(), saveOk = true;
    let socket = null;
    let stopped = false;
    let timer = null;
    let runTimer = null;
    let infoTimer = null;
    let demoInfoTimer = null;
    let demoRunTimer = null;
    let reconnects = 0;
    let hintIndex = 0;
    const drafts = Object.create(null), restoredDrafts = Object.create(null);
    let demoDraft = "";
    try {
      const savedDrafts = courseState && typeof courseState.readChallengeDrafts === "function" ? courseState.readChallengeDrafts(storage, attempt) : {};
      Object.entries(savedDrafts || {}).forEach(([key, value]) => { if (key.startsWith("C3/") && typeof value === "string") { drafts[key.slice(3)] = value; restoredDrafts[key.slice(3)] = value.length > 0; } });
      demoDraft = courseState && typeof courseState.readDraft === "function" ? courseState.readDraft(storage, attempt, CHAPTER, "join-report-log", "demonstration", DEMO_ACTIVITY) : "";
    } catch (_) {}
    const requested = requestedMove(location.search);
    state.activeMove = initialMove(courseState, storage, attempt, requested);
    state.joinAccepted = canOpenMove(courseState, storage, attempt, "filter-disagreement");
    if (el.board) el.board.href = caseBoardUrl(location.search);
    if (el.demoCode) el.demoCode.value = demoDraft;
    if (el.scene && el.investigation) {
      if (landsInInvestigation(Boolean(savedChallengeResume(courseState, storage, attempt)), requested)) { el.scene.hidden = true; el.investigation.hidden = false; }
    }

    function current() { return lessonCopy(state.activeMove); }
    function renderSavedResume() {
      const move = savedChallengeResume(courseState, storage, attempt);
      if (!el.resumeSaved) return;
      el.resumeSaved.hidden = !move;
      if (!move) return;
      if (el.resumeSavedNote) el.resumeSavedNote.textContent = "Your earlier work in this chapter is saved only on this computer. Run it again to check it now.";
      if (el.resumeSavedMove) el.resumeSavedMove.textContent = "Back to your saved step: " + lessonCopy(move).title + " →";
    }
    // r5 (2026-09-27): while Julia runs, Run stays focusable and reads as busy (aria-disabled), so keyboard focus is not dropped to the page.
    function holdRun(button, blocked, busy) { if (!button) return; button.disabled = blocked; if (busy && !blocked) button.setAttribute("aria-disabled", "true"); else button.removeAttribute("aria-disabled"); }
    function updateControls() {
      holdRun(el.run, state.connection !== "connected" || !state.metadata, isRunPending(state));
      if (el.runStatus) el.runStatus.textContent = isRunPending(state) ? (state.statusMessage || "Checking your Julia result…") : state.metadataFailure || (state.result ? runOutcomeStatus(state.result, saveOk) : (state.connection === "connected" ? (state.metadata ? "Julia is ready" : "Loading the case file…") : "Connect to the lab to run Julia"));
      if (el.reconnect) el.reconnect.hidden = !state.metadataFailure && (state.connection === "connected" || state.connection === "connecting");
      const demoReady = state.connection === "connected" && state.activeMove === "join-report-log" && Boolean(state.demoMetadata) && !isDemoRunPending(state);
      if (el.runDemo) el.runDemo.disabled = !demoReady;
      el.demoTokenButtons.forEach(button => {
        const code = el.demoCode ? el.demoCode.value.trim() : "";
        button.disabled = !demoReady || (button.dataset.demoToken === "key" && code !== "leftjoin(");
      });
    }
    function clearResult() {
      if (el.result) el.result.replaceChildren();
      if (el.visual) el.visual.replaceChildren();
      if (el.nextMove) { el.nextMove.hidden = true; el.nextMove.dataset.destination = ""; }
      showSolvedNext();
    }
    // Round 6 (r6-rc #5): a chapter solved on an earlier run still offers the way on to Chapter 4.
    function showSolvedNext() {
      if (!el.nextMove || !acceptedMoveKeys(courseState, storage, attempt).includes("C3/filter-disagreement")) return;
      el.nextMove.hidden = false; el.nextMove.dataset.destination = "chapter4"; el.nextMove.textContent = "Chapter 4: plan a fair recheck →";
    }
    function clearDemoResult() { if (el.demoResult) el.demoResult.replaceChildren(); if (el.demoCaseBridge) el.demoCaseBridge.hidden = true; if (el.returnToCase) el.returnToCase.hidden = true; }
    function clearRunTimer() { if (runTimer) { clearTimeout(runTimer); runTimer = null; } }
    function clearInfoTimer() { if (infoTimer) { clearTimeout(infoTimer); infoTimer = null; } }
    function clearDemoInfoTimer() { if (demoInfoTimer) { clearTimeout(demoInfoTimer); demoInfoTimer = null; } }
    function clearDemoRunTimer() { if (demoRunTimer) { clearTimeout(demoRunTimer); demoRunTimer = null; } }
    function renderInputsFailure() {
      if (el.inputs) el.inputs.textContent = state.metadataFailure || "The case inputs are unavailable.";
      if (el.bindings) el.bindings.textContent = "Your draft is safe. Reconnect or restart Julia Time, then reload this page.";
    }
    function armRunDeadline(id) {
      clearRunTimer();
      runTimer = setTimeout(() => {
        const before = state; state = expireRun(state, id); if (state === before) return;
        renderResult(state.result); renderMoveButtons(); updateControls();
        if (el.code) el.code.focus();
      }, RUN_DEADLINE_MS);
    }
    function armDemoRunDeadline(id) {
      clearDemoRunTimer();
      demoRunTimer = setTimeout(() => {
        const before = state; state = expireDemoRun(state, id); if (state === before) return;
        renderDemoResult(state.demoResult); renderDemoRunStatus(state.demoResult); updateControls();
        if (el.demoCode) el.demoCode.focus();
      }, RUN_DEADLINE_MS);
    }
    function renderDemoFallback() {
      if (!el.demoInputs) return;
      el.demoInputs.replaceChildren();
      const p = document.createElement("p");
      p.textContent = state.demoResult && state.demoResult.status === "timeout" ? state.demoResult.message : "The K-A/K-B practice tables will appear here when the lab supplies them. Practice only.";
      el.demoInputs.append(p);
      if (el.demoCaseBridge) el.demoCaseBridge.hidden = true;
      if (el.returnToCase) el.returnToCase.hidden = true;
    }
    function renderMove() {
      const copy = current();
      if (el.location) el.location.textContent = "Chapter 3 of 6 · " + copy.label;
      if (el.title) el.title.textContent = copy.title;
      if (el.stepWhy) el.stepWhy.textContent = copy.why || "";
      if (el.question) el.question.textContent = copy.question;
      if (el.bridge) el.bridge.textContent = copy.bridge;
      if (el.returnSpec) el.returnSpec.textContent = copy.returnSpec;
      if (el.syntax) el.syntax.textContent = copy.syntax;
      // T2 (2026-09-12 playtest): the code shape used to leak into this always-visible panel,
      // duplicating the gated "Code shape" hint stage below and turning the move into
      // substitution rather than a decision. It now lives only in that staged hint.
      if (el.challengeBridge) el.challengeBridge.textContent = "Use the visible case tables and the required result to decide your next Julia step.";
      if (bridges) bridges.renderCard(el.bridgeCard, "C3/"+state.activeMove, acceptedCode[state.activeMove] || "");
      syncBlankNote();
      if (el.code) el.code.value = drafts[state.activeMove] || "";
      if (el.draftNote) el.draftNote.textContent = draftNotice(Boolean(el.code && el.code.value), Boolean(restoredDrafts[state.activeMove]));
      if (el.help) el.help.replaceChildren();
      if (el.answerReference) { el.answerReference.hidden = true; el.answerReference.replaceChildren(); }
      if (el.nextHelp) { el.nextHelp.textContent = "Show the idea"; el.nextHelp.disabled = false; }
      if (el.showAnswer) el.showAnswer.hidden = false;
      hintIndex = 0;
      clearResult();
      if (el.demoPanel) el.demoPanel.hidden = state.activeMove !== "join-report-log";
      if (state.activeMove !== "join-report-log") {
        state = cancelDemo(Object.assign({}, state, {demoMetadata:null}));
        renderDemoFallback();
      } else if (!state.demoMetadata) renderDemoFallback();
      if (el.inputs) {
        el.inputs.replaceChildren();
        const p = document.createElement("p");
        p.textContent = "Waiting for the lab to supply this step’s complete tables and column names…";
        el.inputs.append(p);
      }
      if (el.bindings) {
        el.bindings.replaceChildren();
        const p = document.createElement("p");
        p.textContent = "Loading the exact Julia names you can use in this step…";
        el.bindings.append(p);
      }
      el.moveButtons.forEach(button => {
        const available = button.dataset.move === "join-report-log" || state.joinAccepted || canOpenMove(courseState, storage, attempt, button.dataset.move);
        button.disabled = !available;
        button.setAttribute("aria-current", button.dataset.move === state.activeMove ? "step" : "false");
      });
      updateControls();
    }
    const DEFAULT_DATA_LABEL = "Simulated data made for this game: no real jars, no real springtails.";
    // short-scroll (2026-09-25): when every visible table shares the same data-label sentence,
    // renderInputs hoists one shared line above them instead of repeating it per table.
    function renderTable(input, opts) {
      const hideDataLabel = Boolean(opts && opts.hideDataLabel);
      const panel = document.createElement("section");
      panel.className = "input-table";
      const heading = document.createElement("h3");
      const identity = tableIdentity(input.id);
      heading.textContent = (identity && identity.title) || input.label || input.id;
      if (identity) {
        const binding = document.createElement("p");
        binding.className = "data-label";
        binding.append("Julia name: ");
        const code = document.createElement("code");
        code.textContent = identity.name;
        binding.append(code, ": " + identity.role);
        panel.append(heading, binding);
      } else panel.append(heading);
      const label = document.createElement("p");
      label.className = "data-label";
      label.textContent = input.data_label || DEFAULT_DATA_LABEL;
      if (hideDataLabel) label.hidden = true;
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      wrap.tabIndex = 0;
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      // Round 6 (r6-rc #1): on a phone a long column name may break after an underscore, so all four
      // columns of the lined-up table fit on screen. The text itself is unchanged.
      input.columns.forEach(column => { const th = document.createElement("th"); String(column).split("_").forEach((part, i, parts) => { th.append(part + (i < parts.length - 1 ? "_" : "")); if (i < parts.length - 1) th.append(document.createElement("wbr")); }); headRow.append(th); });
      thead.append(headRow);
      const body = document.createElement("tbody");
      input.rows.forEach(row => { const tr = document.createElement("tr"); input.columns.forEach(column => { const td = document.createElement("td"); td.textContent = safeText(row[column]); tr.append(td); }); body.append(tr); });
      table.append(thead, body); wrap.append(table); panel.append(label, wrap); return panel;
    }
    function renderBindings(metadata) {
      if (!el.bindings) return;
      el.bindings.replaceChildren();
      const heading = document.createElement("strong");
      heading.textContent = "Names you can type";
      el.bindings.append(heading);
      (metadata.inputs || []).forEach(input => {
        const identity = tableIdentity(input.id);
        if (!identity) return;
        const line = document.createElement("p");
        const code = document.createElement("code");
        code.textContent = identity.name;
        line.append(code, ": " + identity.title + ". " + identity.role + ".");
        el.bindings.append(line);
      });
      if (state.activeMove === "join-report-log") {
        const key = document.createElement("p");
        const code = document.createElement("code");
        code.textContent = ":tray_id";
        key.append("Match the two tables on ", code, ". The colon says this is the column named tray_id.");
        el.bindings.append(key);
      }
    }
    function renderInputs(metadata) {
      if (!el.inputs) return;
      el.inputs.replaceChildren();
      const heading = document.createElement("div");
      const label = document.createElement("p"); label.className = "eyebrow"; label.textContent = "Evidence in hand";
      const h = document.createElement("h2"); h.textContent = state.activeMove === "join-report-log" ? "The two tables to match" : "Your lined-up table, ready for the next check";
      const note = document.createElement("p"); note.className = "shared-key"; note.textContent = state.activeMove === "join-report-log" ? "Left table: keep every tray. Right table: add its matching sheet columns." : "The lined-up table, rebuilt fresh for this step from your step 1 join.";
      heading.append(label, h, note);
      // short-scroll (2026-09-25): both move-1 tables normally carry the identical "simulated
      // teaching case" sentence; show it once above them instead of once per table, and lay the
      // tables out side by side (CSS, #visible-inputs.two-up) so the code box is not stacked below
      // two full-height tables. A single table (move 2) keeps its own label and full width.
      const dataLabels = metadata.inputs.map(input => input.data_label || DEFAULT_DATA_LABEL);
      const sharedLabel = metadata.inputs.length > 1 && dataLabels.every(text => text === dataLabels[0]) ? dataLabels[0] : null;
      if (sharedLabel) { const shared = document.createElement("p"); shared.className = "data-label"; shared.textContent = sharedLabel; heading.append(shared); }
      el.inputs.append(heading);
      el.inputs.classList.toggle("two-up", metadata.inputs.length > 1);
      metadata.inputs.forEach(input => el.inputs.append(renderTable(input, {hideDataLabel: Boolean(sharedLabel)})));
      const returnNote = document.createElement("p"); returnNote.className = "return-bridge"; returnNote.textContent = "These are the tables your code should use for the required result above.";
      el.inputs.append(returnNote);
    }
    function renderDemoInputs(metadata) {
      if (!el.demoInputs) return;
      el.demoInputs.replaceChildren();
      const label = document.createElement("p"); label.className = "data-label"; label.textContent = "Practice data with labels K-A and K-B. Does not count for the case.";
      el.demoInputs.append(label);
      metadata.inputs.forEach(input => el.demoInputs.append(renderTable(input)));
      if (el.demoCopy) el.demoCopy.textContent = "Practice data with labels K-A and K-B. Does not count for the case.";
      if (el.demoPlan) el.demoPlan.textContent = "Before you run: which labels will match, and how many rows will Julia return? Then add the join’s opening, followed by the two practice tables and their shared key. These controls write into this practice editor only.";
    }
    function appendTechnical(message, target) {
      const raw = [message && message.stdout, message && message.message, message && message.value_repr].filter(Boolean).join("\n");
      if (!raw) return;
      const details = document.createElement("details");
      const summary = document.createElement("summary"); summary.textContent = message.status === "error" ? "Original Julia error" : "Actual Julia output";
      const pre = document.createElement("pre"); pre.textContent = raw; details.append(summary, pre); target.append(details);
    }
    function appendReturnedTable(message, target) {
      if (!Array.isArray(message.columns) || !Array.isArray(message.rows) || !message.rows.every(row => row && typeof row === "object")) return false;
      target.append(renderTable({id:"returned", label:"Actual returned data", data_label:"Returned by Julia from your code.", columns:message.columns, rows:message.rows}));
      return true;
    }
    function renderVisual(message) {
      if (!el.visual) return;
      el.visual.replaceChildren();
      const visual = visualData(state.activeMove, message);
      if (!visual) return;
      const section = document.createElement("section"); section.className = "returned-card";
      const h = document.createElement("h2"); h.textContent = current().visualTitle; section.append(h);
      visual.rows.forEach(row => {
        const card = document.createElement("article");
        const tray = document.createElement("h3"); tray.textContent = row.tray_id;
        const line = document.createElement("p"); line.textContent = "Notebook: " + row.notebook + " · Toto typed: " + row.sheet + " · paper box: " + row.entry_status;
        card.append(tray, line); section.append(card);
      });
      const note = document.createElement("p"); note.className = "caution";
      note.textContent = visual.kind === "tray-disagrees" ? "We know the box was left blank, not why. Next: plan a fair recheck of the jars." : "These connections show which tray each row belongs to.";
      section.append(note); el.visual.append(section);
    }
    function renderBlankNote() {
      const section = document.createElement("section");
      section.className = "blank-note";
      const h = document.createElement("h3"); h.textContent = "How each language stores a blank"; section.append(h);
      const intro = document.createElement("p");
      intro.textContent = "On the paper tally sheet, T-C\u2019s box was left blank, yet Toto\u2019s typed copy shows 0. A 0 and a blank are not the same thing. Here is what happens if you store the blank as a blank instead:";
      section.append(intro);
      const list = document.createElement("ul");
      [
        "R, the trap: if T-C\u2019s box were NA, dplyr::filter(joined, notebook_detected != sheet_detected) would quietly drop T-C, with no warning. The one tray that disagrees would be gone.",
        "Julia: missing. The same row rule stops with an error, so you notice. sum([1, missing]) gives missing.",
        "R: NA. sum(c(1, NA)) gives NA; na.rm = TRUE gives 1.",
        "pandas: NaN. pd.Series([1, None]).sum() gives 1.0: it quietly skips the blank."
      ].forEach(text => { const li = document.createElement("li"); li.textContent = text; list.append(li); });
      section.append(list);
      return section;
    }
    // The blank note shows whenever the step 2 R and Python card shows, right below it.
    function syncBlankNote() {
      if (!el.blankNote) return;
      const show = state.activeMove === "filter-disagreement" && Boolean(acceptedCode["filter-disagreement"]);
      el.blankNote.replaceChildren(...(show ? [renderBlankNote()] : []));
      el.blankNote.hidden = !show;
    }
    function renderResult(message) {
      if (!el.result) return;
      el.result.replaceChildren();
      if (el.draftNote) el.draftNote.textContent = draftStatus(message);
      const outcome = document.createElement("p"); outcome.className = "run-outcome"; outcome.textContent = runOutcomeStatus(message, saveOk); el.result.append(outcome);
      const p = document.createElement("p");
      if (message.status === "error") p.textContent = errorRecovery(state.activeMove, message);
      else if (message.status === "timeout") p.textContent = message.feedback ? serverTimeoutText(message) : (message.message || serverTimeoutText(message));
      else if (message.status === "ok" && message.pass === true) p.textContent = message.feedback || "Julia returned your checked result. Read the returned table and visual together before making a claim.";
      else p.textContent = finishedRecovery(state.activeMove, message);
      el.result.append(p);
      const explanation = message.explanation;
      if (explanation && typeof explanation === "object") {
        // Night round 1 (r1-audit.md): the step 2 tray card below already ends with the limit line
        // (story bible v2.1 change 3), so the server's own limit line is left out when that card shows.
        const visual = message.status === "ok" && shouldRenderCaseVisual(message) ? visualData(state.activeMove, message) : null;
        const cardCarriesLimit = Boolean(visual && visual.kind === "tray-disagrees");
        // r3 (2026-09-27): the server's failure case and limit lines ("Match this step's required
        // result...", "A failed run does not tell us...") are generic, so they show only on an accepted run.
        const accepted = message.status === "ok" && message.pass === true;
        [explanation.julia, accepted ? explanation.case : "", accepted && !cardCarriesLimit ? explanation.limit : ""].filter(Boolean).forEach(text => { const item = document.createElement("p"); item.textContent = String(text); el.result.append(item); });
      }
      if (message.status === "ok") {
        if (!appendReturnedTable(message, el.result)) {
          const notice = document.createElement("p"); notice.textContent = "The result could not be displayed as a table. The original output is kept below."; el.result.append(notice);
        }
        if (shouldRenderCaseVisual(message)) renderVisual(message);
      }
      if (state.activeMove === "filter-disagreement" && message.status === "ok" && message.pass === true) {
        const toto = document.createElement("p"); toto.textContent = "Toto: \u201cSo my zero was a box nobody filled in. Zero jars with springtails, or just an empty box?\u201d"; el.result.append(toto);
        const claim = document.createElement("p"); claim.className = "claim-stamp"; claim.textContent = "Part 1 · Check the report: the 0 was a blank box, not an empty tray."; el.result.append(claim);
        // r3 (2026-09-27): the R and Python card says "See \"How each language stores a blank\" below",
        // so the note sits just after that card (syncBlankNote), not inside the result above it.
        if (!el.blankNote) el.result.append(renderBlankNote());
      }
      appendTechnical(message, el.result);
      const destination = nextDestination(state.activeMove, message);
      if (destination && el.nextMove) {
        el.nextMove.hidden = false;
        el.nextMove.dataset.destination = destination;
        el.nextMove.textContent = destination === "chapter4" ? "Chapter 4: plan a fair recheck →" : "Step 2: find the tray that disagrees →";
      }
    }
    function focusResult() { if (el.result) el.result.focus(); }
    function renderDemoResult(message) {
      if (!el.demoResult) return;
      el.demoResult.replaceChildren();
      const p = document.createElement("p");
      if (message.status === "error") p.textContent = [serverCoaching(message) || joinErrorCoaching(message), "Check the practice table names and the shared key, then run this practice again. Your editor is unchanged."].filter(Boolean).join(" ");
      else if (message.status === "timeout") p.textContent = message.message || "The lab stopped this practice run. Your practice code is still here; check it and run again.";
      else p.textContent = message.feedback || "Julia lined up the K-A/K-B practice tables. Practice only.";
      el.demoResult.append(p);
      const explanation = message.explanation;
      if (explanation && typeof explanation === "object") [explanation.julia, explanation.case, explanation.limit].filter(Boolean).forEach(text => { const item = document.createElement("p"); item.textContent = String(text); el.demoResult.append(item); });
      if (message.status === "ok" && !appendReturnedTable(message, el.demoResult)) {
        const notice = document.createElement("p"); notice.textContent = "The practice result could not be displayed as a table. The original output is kept below."; el.demoResult.append(notice);
      }
      appendTechnical(message, el.demoResult);
      const showCaseBridge = shouldShowDemoCaseBridge(message);
      if (el.demoCaseBridge) el.demoCaseBridge.hidden = !showCaseBridge;
      if (el.returnToCase) el.returnToCase.hidden = !showCaseBridge;
      if (showCaseBridge && el.challengeBridge) el.challengeBridge.textContent = "Case tables: tray_counts (tray_id, notebook_detected) and tally_sheet (tray_id, sheet_detected, entry_status). Case question: how do we put each tray’s notebook count next to its row in Toto’s typed copy?";
    }
    function renderDemoRunStatus(message) {
      if (el.demoDraftNote) el.demoDraftNote.textContent = demoDraftStatus(message);
      if (el.demoPlan) el.demoPlan.textContent = demoPlanStatus(message);
    }
    function requestInfo(move) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const id = requestId("info");
      state = beginInfo(state, id, move);
      socket.send(JSON.stringify(infoMessage(move, id)));
      clearInfoTimer();
      infoTimer = setTimeout(() => { state = expireInfo(state, id); renderInputsFailure(); updateControls(); }, INFO_DEADLINE_MS);
      updateControls();
    }
    function requestDemoInfo() {
      if (!socket || socket.readyState !== WebSocket.OPEN || state.activeMove !== "join-report-log" || state.demoInfoRequest || state.demoMetadata) return;
      const id = requestId("practice-info");
      state = beginDemoInfo(state, id);
      socket.send(JSON.stringify(demoInfoMessage(id)));
      clearDemoInfoTimer();
      demoInfoTimer = setTimeout(() => {
        const before = state; state = expireDemoInfo(state, id); if (state === before) return;
        renderDemoFallback(); renderDemoResult(state.demoResult); updateControls();
      }, INFO_DEADLINE_MS);
      if (el.demoCopy) el.demoCopy.textContent = "Loading the separate K-A/K-B practice tables from the lab…";
      updateControls();
    }
    function sendRun() {
      if (!socket || socket.readyState !== WebSocket.OPEN || !state.metadata || isRunPending(state)) return;
      const id = requestId("run");
      state = beginRun(state, id, state.activeMove);
      armRunDeadline(id);
      submittedCode[state.activeMove] = el.code.value;
      socket.send(JSON.stringify(runMessage(state.activeMove, el.code.value, id)));
      clearResult();
      updateControls();
      if (el.result) el.result.textContent = "Julia is checking your code…";
    }
    function sendDemoRun() {
      if (!socket || socket.readyState !== WebSocket.OPEN || !state.demoMetadata || isDemoRunPending(state) || !el.demoCode) return;
      const id = requestId("practice-run");
      state = beginDemoRun(state, id);
      armDemoRunDeadline(id);
      socket.send(JSON.stringify(demoRunMessage(el.demoCode.value, id)));
      clearDemoResult();
      renderDemoRunStatus(null);
      updateControls();
      if (el.demoResult) el.demoResult.textContent = "Julia is running the separate practice join…";
    }
    function handle(message) {
      if (!message || typeof message !== "object") return;
      if (message.type === "case") {
        const demoBefore = state; state = applyDemoInfo(state, message);
        if (demoBefore !== state) { clearDemoInfoTimer(); renderDemoInputs(state.demoMetadata); updateControls(); return; }
        const before = state; state = applyCaseInfo(state, message);
        if (before !== state) { clearInfoTimer(); renderInputs(state.metadata); renderBindings(state.metadata); updateControls(); }
        return;
      }
      if (message.type === "error") {
        const before = state; state = failCaseInfo(state, message);
        if (before !== state) { clearInfoTimer(); renderInputsFailure(); updateControls(); }
        return;
      }
      if (message.type === "status") {
        const before = state; state = applyRunStatus(state, message);
        if (before !== state) { armRunDeadline(state.pending.request_id); updateControls(); return; }
        const demoBefore = state; state = applyDemoRunStatus(state, message);
        if (demoBefore !== state) {
          armDemoRunDeadline(state.demoPending.request_id);
          if (el.demoResult) el.demoResult.textContent = state.demoStatusMessage || "Julia is running the separate practice join…";
          updateControls();
        }
        return;
      }
      if (message.type === "case_result") {
        const before = state; state = applyCaseResult(state, message);
        if (before !== state) {
          clearRunTimer();
          if (state.evidence !== before.evidence && isAcceptedChallengeResult(state.result)) {
            state = Object.assign({}, state, {joinAccepted:state.joinAccepted || state.result.move_id === "join-report-log"});
            persistAcceptedCourseResult(courseState, storage, attempt, state.result);
            saveOk = savedMove(courseState, storage, attempt, CHAPTER, state.result.move_id);
            renderSavedResume();
            acceptedCode[state.result.move_id] = submittedCode[state.result.move_id] || "";
            if (bridges) bridges.renderCard(el.bridgeCard, "C3/"+state.result.move_id, acceptedCode[state.result.move_id]);
            syncBlankNote();
          }
          renderResult(state.result); renderMoveButtons(); updateControls();
          if (needsRecoveryFocus(state.result) && el.code) setTimeout(() => el.code.focus(), 0);
          else focusResult();
          return;
        }
        const demoBefore = state; state = applyDemoResult(state, message);
        if (demoBefore !== state) {
          clearDemoRunTimer();
          renderDemoResult(state.demoResult); renderDemoRunStatus(state.demoResult); updateControls();
          if (needsRecoveryFocus(state.demoResult) && el.demoCode) setTimeout(() => el.demoCode.focus(), 0);
        }
      }
    }
    function retry() {
      if (stopped) return;
      clearInfoTimer(); clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer(); state = disconnect(state); updateControls();
      if (++reconnects > 3) { if (el.connection) el.connection.textContent = "Julia is offline: your draft is still here."; return; }
      if (el.connection) el.connection.textContent = "Connection to Julia lost. Reconnecting…";
      timer = setTimeout(connect, 900 * reconnects);
    }
    function connect() {
      if (stopped) return;
      clearTimeout(timer); clearInfoTimer(); clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer();
      if (location.protocol === "file:") { state = disconnect(state); if (el.connection) el.connection.textContent = "Start the Julia server, then open the local server address shown by the launcher (usually http://127.0.0.1:8000) to run this case."; updateControls(); return; }
      const old = socket; socket = null; if (old) old.close();
      state = Object.assign({}, disconnect(state), {demoMetadata:null, demoResult:null});
      state.connection = "connecting"; if (el.connection) el.connection.textContent = "Connecting to the lab…"; updateControls();
      try { socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"); } catch (_) { retry(); return; }
      const ws = socket;
      ws.addEventListener("open", () => { if (socket !== ws) return; reconnects = 0; state = Object.assign({}, state, {connection:"connected"}); if (el.connection) el.connection.textContent = "Julia is ready"; requestInfo(state.activeMove); if (el.demoPanel && el.demoPanel.open) requestDemoInfo(); updateControls(); });
      ws.addEventListener("message", event => { if (socket !== ws) return; try { handle(JSON.parse(event.data)); } catch (_) {} });
      ws.addEventListener("close", () => { if (socket !== ws) return; retry(); });
    }
    function renderMoveButtons() {
      el.moveButtons.forEach(button => {
        const available = button.dataset.move === "join-report-log" || state.joinAccepted || canOpenMove(courseState, storage, attempt, button.dataset.move);
        button.disabled = !available;
        button.setAttribute("aria-current", button.dataset.move === state.activeMove ? "step" : "false");
      });
    }
    function setMove(move) {
      if (!knownMove(move)) return;
      if (move === "filter-disagreement" && !(state.joinAccepted || canOpenMove(courseState, storage, attempt, move))) {
        if (el.runStatus) el.runStatus.textContent = "First connect the two records with a checked join; then this step opens.";
        return;
      }
      if (el.code) drafts[state.activeMove] = el.code.value;
      clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer(); state = cancelDemo(cancelRun(Object.assign({}, state, {activeMove:move, metadata:null, infoRequest:null, demoMetadata:null})));
      renderMove();
      if (state.connection === "connected") requestInfo(move);
      if (el.title) { el.title.tabIndex = -1; el.title.focus(); }
    }

    renderMove();
    renderSavedResume();
    el.moveButtons.forEach(button => button.addEventListener("click", () => setMove(button.dataset.move)));
    if (el.start) el.start.addEventListener("click", () => { el.scene.hidden = true; el.investigation.hidden = false; if (el.title) { el.title.tabIndex = -1; el.title.focus(); } });
    if (el.resumeSavedMove) el.resumeSavedMove.addEventListener("click", () => {
      const move = savedChallengeResume(courseState, storage, attempt);
      if (!move) return;
      el.scene.hidden = true;
      el.investigation.hidden = false;
      setMove(move);
    });
    if (el.back) el.back.addEventListener("click", () => { if (el.code) drafts[state.activeMove] = el.code.value; clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer(); state = cancelDemo(cancelRun(state)); clearResult(); clearDemoResult(); updateControls(); el.investigation.hidden = true; el.scene.hidden = false; $("chapter-title").focus(); });
    if (el.run) el.run.addEventListener("click", sendRun);
    if (el.code) {
      el.code.addEventListener("input", () => { clearRunTimer(); drafts[state.activeMove] = el.code.value; restoredDrafts[state.activeMove] = false; persistChallengeDraft(courseState, storage, attempt, state.activeMove, el.code.value); state = cancelRun(state); clearResult(); if (el.draftNote) el.draftNote.textContent = draftNotice(Boolean(el.code.value), false); updateControls(); });
      el.code.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); sendRun(); } });
    }
    if (el.demoPanel) el.demoPanel.addEventListener("toggle", () => { if (el.demoPanel.open && state.activeMove === "join-report-log") requestDemoInfo(); });
    if (el.demoCode) {
      el.demoCode.addEventListener("input", () => {
        demoDraft = el.demoCode.value;
        persistDemoDraft(courseState, storage, attempt, demoDraft);
        state = cancelDemo(state); clearDemoResult();
        if (el.demoDraftNote) el.demoDraftNote.textContent = "This is your own unrun practice draft; it is separate from the case editor.";
        if (el.demoPlan) el.demoPlan.textContent = "Not run yet. Editing this practice code does not affect the Missing Fleas case editor.";
        updateControls();
      });
      el.demoCode.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); sendDemoRun(); } });
    }
    el.demoTokenButtons.forEach(button => button.addEventListener("click", () => {
      if (!el.demoCode || !state.demoMetadata || state.demoPending) return;
      const currentCode = el.demoCode.value.trim();
      if (button.dataset.demoToken === "open" && currentCode === "") el.demoCode.value = "leftjoin(";
      if (button.dataset.demoToken === "key" && currentCode === "leftjoin(") el.demoCode.value = "leftjoin(practice_counts, practice_sheet, on=:key)";
      demoDraft = el.demoCode.value;
      persistDemoDraft(courseState, storage, attempt, demoDraft);
      state = cancelDemo(state); clearDemoResult();
      if (el.demoDraftNote) el.demoDraftNote.textContent = "Planned practice code, not run yet. It is separate from the case editor.";
      if (el.demoPlan) el.demoPlan.textContent = "Not run yet. The practice expression below will run only when you choose Run this practice.";
      updateControls();
    }));
    if (el.runDemo) el.runDemo.addEventListener("click", sendDemoRun);
    function focusShown(target) { if (!target || target.hidden) return; target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:"nearest"}); }
    // r5 (2026-09-27): a new hint is added above the button, so scroll both into view; the focused button stays on screen. It runs again after 100 ms because code-names.js marks up the hint's code names 50 ms later, which moves the button.
    function keepHintInView(hint, button) { const show = () => { if (hint) hint.scrollIntoView({block:"nearest"}); if (button && !button.disabled) button.scrollIntoView({block:"nearest"}); }; show(); setTimeout(show, 100); }
    function showHelpThrough(lastStage) {
      const wasDone = hintIndex >= helpStages(state.activeMove).length;
      let added = null;
      while (hintIndex <= lastStage) {
        const stage = helpStage(state.activeMove, hintIndex);
        if (!stage) break;
        if (stage.label === "Full answer" && el.answerReference) {
          const label = document.createElement("p"), code = document.createElement("pre");
          label.textContent = "Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns. It does not count as a saved answer until Julia checks it.";
          code.className = "complete-answer-code";
          code.textContent = stage.text;
          el.answerReference.replaceChildren(label, code);
          el.answerReference.hidden = false;
          // Round 7 (r7-r-struggling #6): say where the answer went, as C1, C2, C5 and C6 do.
          const pointer = document.createElement("p"); pointer.textContent = "The complete runnable answer is shown above your editor."; el.help.append(pointer); added = pointer;
          hintIndex += 1;
          if (el.nextHelp) el.nextHelp.textContent = stage.button;
          continue;
        }
        const item = document.createElement("p"); const strong = document.createElement("strong"); strong.textContent = stage.label + ": "; item.append(strong, document.createTextNode(stage.text)); el.help.append(item); added = item; hintIndex += 1;
        if (stage.note) { const note = document.createElement("p"); note.textContent = stage.note; el.help.append(note); }
        if (el.nextHelp) el.nextHelp.textContent = stage.button;
      }
      // All help shown: the ladder stops, and the full-answer button has nothing left to show.
      const done = hintIndex >= helpStages(state.activeMove).length;
      if (el.nextHelp) el.nextHelp.disabled = done;
      if (el.showAnswer) el.showAnswer.hidden = done;
      // r4 (2026-09-27): the button that had focus is now disabled or hidden, so focus moves to the answer.
      if (done && !wasDone) focusShown(el.answerReference); else keepHintInView(added, el.nextHelp);
    }
    if (el.nextHelp) el.nextHelp.addEventListener("click", () => showHelpThrough(helpLevelEnd(state.activeMove, hintIndex)));
    if (el.showAnswer) el.showAnswer.addEventListener("click", () => showHelpThrough(helpStages(state.activeMove).length - 1));
    if (el.nextMove) el.nextMove.addEventListener("click", () => {
      const destination = el.nextMove.dataset.destination;
      if (destination === "chapter4") { window.location.assign(nextChapterUrl(location.search)); return; }
      if (destination === "filter-disagreement") setMove(destination);
    });
    if (el.reconnect) el.reconnect.addEventListener("click", () => { reconnects = 0; connect(); });
    window.addEventListener("pagehide", () => { stopped = true; clearTimeout(timer); clearInfoTimer(); clearRunTimer(); clearDemoInfoTimer(); clearDemoRunTimer(); state = cancelDemo(cancelRun(state)); if (socket) socket.close(); });
    connect();
  }

  function nextDestination(move, result) {
    if (!isAcceptedChallengeResult(result) || result.move_id !== move) return null;
    if (move === "join-report-log") return "filter-disagreement";
    if (move === "filter-disagreement") return "chapter4";
    return null;
  }

  return {landsInInvestigation, helpLevelEnd, CASE_ID, CHAPTER, INFO_DEADLINE_MS, RUN_DEADLINE_MS, knownMove, tableIdentity, activeInputIds, lessonCopy, recoveryCopy, joinErrorCoaching, filterErrorCoaching, errorRecovery, finishedRecovery, needsRecoveryFocus, draftStatus, demoDraftStatus, demoPlanStatus, draftNotice, runOutcomeStatus, helpStage, caseBoardUrl, nextChapterUrl, nextDestination, requestedMove, createState, beginInfo, failCaseInfo, expireInfo, beginRun, expireRun, cancelRun, cancelDemo, disconnect, isRunPending, isDemoRunPending, applyRunStatus, applyDemoRunStatus, applyCaseInfo, applyCaseResult, beginDemoInfo, expireDemoInfo, applyDemoInfo, beginDemoRun, expireDemoRun, applyDemoResult, visualData, shouldRenderCaseVisual, shouldOfferCaseReturn, shouldShowDemoCaseBridge, acceptedMoveKeys, canOpenMove, initialMove, savedChallengeResume, persistChallengeDraft, persistDemoDraft, persistAcceptedCourseResult, infoMessage, runMessage, demoInfoMessage, demoRunMessage, init};
});

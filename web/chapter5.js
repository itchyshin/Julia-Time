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
      step: "Step 1 · Mark the rounds with 5 or more teal cards", title: "Mark the rounds with 5 or more teal cards",
      question: "In which of Toto's 1,000 rounds did luck alone give 5 or more teal cards?",
      why: "Ask every round the same question: did luck give at least the notebook's 5? Counting them comes next.",
      required: "One true or false for every round: true when that round's count is 5 or more.",
      concept: "Ask every round the same question: is its count at least observed_count? Coming from R or pandas? There a plain >= already compares every value; Julia needs a dot.",
      shape: "counts .>= threshold", solution: "sim_counts .>= observed_count",
      syntax: "The dot in .>= means compare every count, producing one true-or-false result per round.",
      visual: "The rounds with 5 or 6 teal cards are marked."
    },
    "event-frequency": {
      step: "Step 2 · How often did 5 or more happen?", title: "How often did 5 or more happen?",
      question: "Out of all 1,000 rounds, what share had 5 or more teal cards?",
      why: "Matches divided by all rounds is how often plain chance gives 5 or more. A tiny share would make 5 of 6 unusual; a common one would not.",
      required: "One number: the rounds that matched, divided by all rounds.",
      concept: "How often = rounds that matched divided by all rounds. The trues are the rounds that matched. Coming from R? In R you would use mean() on the true-or-false vector; here we write the division out.",
      shape: "events = counts .>= threshold, then on the next line sum(events) / length(events)",
      solution: "events = sim_counts .>= observed_count\nsum(events) / length(events)",
      syntax: "sum(events) counts the trues; length(events) counts every round. Each run starts fresh, so on the first line make the list of true-or-false values from Step 1 again (one per round) and call it events, then divide.",
      visual: "The highlighted bars are the matching rounds. Divide their number by all rounds."
    }
  });
  function helpStages(move) {
    const copy = COPY[move];
    if (!copy) return [];
    // B9 (simulated playtest, P21/P43): the shape was run as written. Name the placeholders and map them, as in C3.
    const shapeNote = "counts and threshold are placeholders, not names in this case. In this case, counts is sim_counts and threshold is observed_count.";
    return [
      {label:"Idea", text:copy.concept, button:"Show the code shape"},
      {label:"Code shape", text:copy.shape, note:shapeNote, button:"Show the whole line"},
      {label:"Full answer", text:copy.solution, button:"All help shown"}
    ];
  }
  function helpStage(move, index) { return helpStages(move)[index] || null; }
  // UI-11 (2026-09-24 audit): an opened hint stays on screen when the next one opens, as in C1-C4.
  // The full answer itself stays in its reference panel above the editor, never in this list.
  function visibleHints(move, hint) {
    const stages = helpStages(move), count = Math.max(0, Math.min(stages.length, Number.isInteger(hint) ? hint : 0));
    if (count === 0) return ["Open a small hint when you need it."];
    return stages.slice(0, count).flatMap(stage => stage.label === "Full answer" ? ["The complete runnable answer is shown in the code panel above your editor."] : [`${stage.label}: ${stage.text}`].concat(stage.note ? [stage.note] : []));
  }
  function preEditorBridge(move) {
    const copy = COPY[move];
    if (!copy) return {lead:"", shape:"", explanation:""};
    if (move !== "event-frequency") return {lead:copy.syntax, shape:"", explanation:""};
    return {
      lead:"Each run starts fresh, so on the first line make the list of true-or-false values from Step 1 again (one per round) and call it events. Then divide.",
      shape:copy.shape,
      explanation:"The line events = ... gives the true-or-false list a name. sum(events) counts the trues; length(events) counts every round. Replace the generic names with the named case inputs above."
    };
  }
  const FREQUENCY_COMPOSITION = Object.freeze([
    Object.freeze({id:"event", text:"events = counts .>= threshold"}),
    Object.freeze({id:"frequency", text:"sum(events) / length(events)"})
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
  // No step in the address: resume at the first unsolved step, or the last when both are solved (2026-09-25).
  function initialMove(courseState, storage, attempt, search) { const solved = acceptedMoveKeys(courseState, storage, attempt), resume = MOVES.find(item => !solved.includes(CHAPTER + "/" + item)) || MOVES[MOVES.length - 1], asked = new URLSearchParams(search || "").get("move"), move = knownMove(asked) ? asked : resume; return canOpenMove(courseState, storage, attempt, move) ? move : MOVES[0]; }
  function canOpenSocket(protocol) { return protocol !== "file:"; }
  function connectionMessageForProtocol(protocol) { return protocol === "file:" ? "This page was opened directly from a file. Start the game with run.jl, then open http://127.0.0.1:8000 in your browser." : ""; }
  function openingConnectionMessageForProtocol(protocol) { return connectionMessageForProtocol(protocol) || "Open Toto’s card table to load the cards."; }
  function initialEditorText() { return ""; }
  function isObsoleteDraft(move, draft) {
    return move === "event-frequency" && typeof draft === "string" &&
      /sim_counts\s*\.>=\s*observed_count/.test(draft) &&
      /\(events\s*=\s*events\s*,\s*frequency\s*=\s*sum\(events\)\s*\/\s*length\(events\)\s*\)/.test(draft) &&
      !/events\s*=\s*sim_counts\s*\.>=\s*observed_count/.test(draft);
  }
  // UI-12 (2026-09-24 audit): like C1's T4 recovery, an optional first line is keyed on Julia's
  // actual error text or actual returned value. The shared next step after it is unchanged and
  // neither line names the case answer.
  // repair6-3 (2026-09-24 browser check): Julia returned exactly the strict comparison (count greater
  // than observed_count). Judged only on the returned true count and preview against the case counts.
  function returnedStrictComparison(move, message, metadata) {
    const data = message && message.status === "ok" ? message.result_data : null;
    if (!data || !validMetadata(metadata)) return false;
    const trueCount = move === "event-mask" && data.kind === "boolean-vector" ? data.true_count : move === "event-frequency" && (data.kind === "event-frequency" || data.kind === "frequency-number") ? data.matching : null;
    const counts = metadata.inputs[0].rows.map(row => row.count), observed = metadata.observed_count;
    if (data.length !== counts.length || !counts.includes(observed) || !Array.isArray(data.preview) || !data.preview.length) return false;
    return trueCount === counts.filter(count => count > observed).length && data.preview.every((value, index) => value === counts[index] > observed);
  }
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
  function recoveryLead(move, message, metadata) {
    const guarded = protectedInputCoaching(message);
    if (guarded) return guarded;
    // Owner playtest (2026-09-26): a practice-only name typed into the case gets a plain pointer to the real inputs.
    const practice = String(message && message.message || "").match(/UndefVarError: `(practice_target|practice_counts)` not defined/);
    if (practice) return practice[1] + " is a name from the practice example, not this case. In the case, compare sim_counts with observed_count.";
    // Repair 7 (orchestrator browser check, 2026-09-26): `events` is made in move 1 (event-mask)
    // and does not carry over to move 2 (event-frequency), which runs fresh from sim_counts.
    // Audit 2026-09-27 (design rule 2): this used to print the finished step-2 code line
    // (events = sim_counts .>= observed_count); it now says what is missing in words only.
    const carriedEvents = move === "event-frequency" && String(message && message.message || "").match(/UndefVarError: `events` not defined/);
    if (carriedEvents) return "Nothing from Step 1 is kept between runs, so events is not defined here: each run starts fresh. On the first line, make the list of true-or-false values (one per round) again, as in Step 1, and call it events.";
    if (!message) return "";
    if (message.status === "error" && /no method matching isless\([^)]*Vector/.test(safeText(message.message))) return "Julia cannot compare a whole list of counts with one number using a comparison without a dot, such as >= or >. Put a dot before the comparison, as in .>=, so Julia compares every count.";
    const returned = message.status === "ok" ? safeText(message.value_repr) : "";
    // A plain number (the taught answer) and the older labelled pair are both valid shapes; only
    // something that is neither gets this shape hint.
    // Round 6 (r6-audit #3): Julia's exact fraction (107//1000) is one number too, so the server's
    // own message about it shows instead of this shape hint.
    const isPlainNumber = /^-?\d+(\.\d+)?$/.test(returned.trim()) || /^-?\d+\/\/\d+$/.test(returned.trim());
    const isNamedPair = /^\(events = [\s\S]*, frequency = /.test(returned);
    if (move === "event-frequency" && returned && !isPlainNumber && !isNamedPair) return "Julia returned a result, but this step needs one number: the rounds that matched, divided by all rounds.";
    // R1 (2026-09-24 re-test): a pair whose events field Julia printed as one number, one true or
    // false, or a vector of numbers ([0, 0, 1]). A true-or-false vector prints as Bool[...]; with
    // other values it still gets the shared step only, and the server's feedback is never passed on.
    if (move === "event-frequency" && isNamedPair && /^\(events = (?:-?\d|true,|false,|\[-?\d)/.test(returned)) return "Julia returned the labelled pair, but events is not a true-or-false list, one per round. events must be the Step 1 result: one true or false for every round, not a count or a list of numbers. frequency is the separate number.";
    if (returnedStrictComparison(move, message, metadata)) return "Julia marked true only the counts greater than the observed count. The event is “at least the observed count”, so a count equal to the observed count must be true as well. In Julia, .>= means at least and .> means greater than.";
    // Round 6 (r6-audit #3): for one number (0.107 or 107//1000) the server's checker line says what
    // is wrong with it, such as "You divided by all 1,000 rounds, but counted the wrong rounds".
    if (move === "event-frequency" && isPlainNumber && message.pass !== true && typeof message.feedback === "string" && message.feedback.trim()) return message.feedback.trim();
    return "";
  }
  // v0.2.5 night (fixer I1): the server's "coaching" line names the mistake it read from the code
  // (src/mystery_c2.jl .. mystery_c6.jl). It is "" when there is none, and never used on a passing run.
  function serverCoaching(message) {
    return message && message.pass !== true && typeof message.coaching === "string" ? message.coaching.trim() : "";
  }
  function challengeRecovery(move, message, metadata) {
    // With the server's line, the generic line and the page's own guess are dropped.
    const coaching = serverCoaching(message);
    if (coaching) return coaching + (message.status === "error" ? " Change your code, then run again, or open Stuck? Hints below." : " Your draft is still here. Change it and run again, or open Stuck? Hints below.");
    const currentMove = knownMove(move) ? move : MOVES[0];
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
    const lead = recoveryLead(currentMove, message, metadata);
    // Round 7 (r7-r-struggling #8): a specific line already says what is wrong, so a finished run
    // drops the fixed "did not meet the stated check" and ends as a coaching line does.
    if (lead && !(message && message.status === "error")) return `${lead} Your draft is still here. Change it and run again, or open Stuck? Hints below.`;
    return lead ? `${lead} ${shared}` : shared;
  }
  function requestId(prefix) { return (prefix || "c5") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
  function validAttempt(value) { return /^[a-z0-9-]{1,80}$/.test(value || ""); }
  function caseBoardUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "course/index.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : ""); }
  function nextChapterUrl(search) { const attempt = new URLSearchParams(search || "").get("attempt"); return "chapter6.html" + (validAttempt(attempt) ? "?attempt=" + encodeURIComponent(attempt) : ""); }
  function nextDestination(move, accepted) { if (!accepted) return null; return move === "event-mask" ? "event-frequency" : move === "event-frequency" ? "chapter6" : null; }
  function createState() { return {connection:"connecting", activeMove:MOVES[0], infoRequest:null, pending:null, expired:false, statusMessage:null, actionPending:null, actionFailure:null, metadata:null, metadataFailure:"", runFailure:null, result:null, demo:null, cardChoice:null, evidence:null, firstAccepted:false, secondAccepted:false}; }
  function identity(move, requestId, simulationId) { return {case_id:CASE_ID, chapter:CHAPTER, move_id:move, mode:"challenge", activity_id:null, simulation_id:simulationId == null ? null : simulationId, request_id:requestId}; }
  function sameIdentity(message, expected) { return Boolean(message && expected && message.contract_version === 1 && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id && message.request_id === expected.request_id); }
  function beginInfo(state, requestId, move) { move = knownMove(move) ? move : MOVES[0]; return Object.assign({}, state, {activeMove:move, infoRequest:identity(move,requestId,null), pending:null, expired:false, statusMessage:null, metadata:null, metadataFailure:"", runFailure:null, result:null}); }
  function beginRun(state, requestId, move) { move = knownMove(move) ? move : state.activeMove; if (!knownMove(move) || !validMetadata(state.metadata)) return state; return Object.assign({}, state, {activeMove:move, pending:identity(move,requestId,state.metadata.simulation_id), expired:false, statusMessage:null, runFailure:null, result:null}); }
  function validSimulationId(value) { return typeof value === "string" && value.length > 0 && value.length <= 200; }
  function expectedInputs(message) {
    const input = message && Array.isArray(message.inputs) && message.inputs.length === 1 ? message.inputs[0] : null;
    return Boolean(input && input.id === "sim_counts" && Array.isArray(input.columns) && input.columns.length === 2 && input.columns[0] === "simulation" && input.columns[1] === "count" && Array.isArray(input.rows) && input.rows.length === message.n_trials && input.rows.every((row,index) => row && row.simulation === index + 1 && Number.isInteger(row.count) && row.count >= 0 && row.count <= message.n_jars));
  }
  function validMetadata(message) { return Boolean(message && Number.isInteger(message.n_jars) && message.n_jars > 0 && Number.isFinite(message.p_ref) && message.p_ref >= 0 && message.p_ref <= 1 && Number.isInteger(message.observed_count) && message.observed_count >= 0 && message.observed_count <= message.n_jars && Number.isInteger(message.n_trials) && message.n_trials > 0 && validSimulationId(message.simulation_id) && expectedInputs(message)); }
  // repair5-4 (2026-09-24 walk-through): Move 2 gets its own reason; the Move 1 reason is unchanged.
  // Night round 1 (r1-audit.md): every chapter is playable from the Case Board, so "Part 1 done" is
  // said only once Chapter 3 is solved in this attempt. Otherwise the line says which chapter
  // settles it, the order-free wording of story bible v2.1 change 4.
  function caseStatus(metadata, move, part1Done) {
    if (!validMetadata(metadata)) return null;
    const current = knownMove(move) ? move : metadata.move_id;
    return {
      established:`${part1Done ? "Part 1 done: the report's 0 was a blank box, not an empty tray." : "Chapter 3 settles Part 1: whether the report's 0 is real."} Part 2 so far: a fair recheck of three jars is planned, but nobody has looked yet. Today's check: under a plain 50:50 guess, how often would ${metadata.observed_count} or more of ${metadata.n_jars} jars show springtails?`,
      unknown:"",
      why_now:current === "event-frequency"
        ? "Why this step: Step 1 gave every card round a true or a false. Now find how often it was true, across all the rounds."
        : "Why this step: Momo wants to see what plain chance gives before we believe any story. First mark each card round true or false: did it give at least as many jars with springtails as the notebook?"
    };
  }
  // repair6-1 (2026-09-24 browser check): once Move 2 is accepted, the move line says it is done.
  function moveLockText(state) {
    if (state && state.secondAccepted) return "Step 2 is done: you know how often luck gives at least the notebook’s count. Chapter 6 is next.";
    return state && state.firstAccepted ? "Step 1 is done: every round is marked. Step 2 is open." : "Complete and run Step 1 to unlock Step 2.";
  }
  // repair6-2 (2026-09-24 browser check): the distribution and yes-or-no notes fit the active move.
  function evidenceNotes(metadata, move) {
    if (move === "event-frequency") return {
      distribution:`Each bar is the number of rounds with that count. The bars for counts of at least ${metadata.observed_count} are the event you named in Step 1. Now find what fraction of all ${formatCount(metadata.n_trials)} rounds fall in those bars.`,
      comparison:"In Step 1 you made this comparison for every round. Your Step 2 code makes it again, then finds what fraction of all rounds fall in those bars. This is a preview, not a second dataset; it does not count for the case."
    };
    return {
      distribution:`Each bar is the number of rounds with that count. Your next Julia step will name the bars for counts of at least ${metadata.observed_count}.`,
      comparison:"Your Julia step will make this same comparison for every round, so it returns one true-or-false answer per round. This is a preview of the intended result, not a second dataset, and it does not count for the case."
    };
  }
  function simulationBins(metadata) {
    if (!validMetadata(metadata)) return null;
    const bins = Array.from({length:metadata.n_jars + 1}, (_, count) => ({count, frequency:0, tail:count >= metadata.observed_count}));
    metadata.inputs[0].rows.forEach(row => { bins[row.count].frequency += 1; });
    return bins;
  }
  function eventDecisionRows(metadata, limit) {
    if (!validMetadata(metadata)) return [];
    const requested = Number.isInteger(limit) ? limit : 4;
    const length = Math.max(1, Math.min(metadata.inputs[0].rows.length, requested));
    return metadata.inputs[0].rows.slice(0, length).map(row => ({
      simulation:row.simulation,
      count:row.count,
      meets_event:row.count >= metadata.observed_count
    }));
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
  // Kept (not nulled) on expiry (B1): `state.pending` still names the request a correct result
  // must match to be applied late. `expired` alone is what makes a challenge run retryable.
  function isRunPending(state) { return Boolean(state && state.pending) && !state.expired; }
  function challengeReady(state) {
    return Boolean(state && state.connection === "connected" && validMetadata(state.metadata) && !isRunPending(state));
  }
  function applyRunStatus(state, message) {
    if (!message || message.type !== "status" || !state.pending || state.expired || message.request_id !== state.pending.request_id) return state;
    return Object.assign({}, state, {statusMessage: message.status === "restarting" ? (message.message || "Restarting Julia after the stopped run…") : ""});
  }
  function runStatusText(state, saved) {
    return state && state.runFailure ? "Your code is ready to revise." : state && state.result ? runOutcomeStatus(state.result, saved) : state && state.metadataFailure ? state.metadataFailure : state && isRunPending(state) ? (state.statusMessage || "Checking your Julia result…") : state && state.connection === "connected" ? (validMetadata(state.metadata) ? "Julia is ready" : "Loading the round data…") : "Connect to the lab to run Julia";
  }
  function draftNotice(hasCode, restored) {
    if (!hasCode) return "This editor starts empty. Write your own Julia result.";
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
  function sameInfoIdentity(message, expected) { return Boolean(message && expected && message.contract_version === 1 && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.request_id === expected.request_id && typeof message.simulation_id === "string" && message.simulation_id.length > 0); }
  function applyCaseInfo(state, message) { if (!state.infoRequest || !message || message.type !== "case" || !sameInfoIdentity(message,state.infoRequest) || !validMetadata(message)) return state; return Object.assign({}, state, {infoRequest:null, metadata:message, activeMove:message.move_id}); }
  function metadataFailureText(message) { const detail = safeText(message && (message.message || message.feedback)); return /unknown mystery chapter|does not recognise|does not recognize/i.test(detail) ? "The local lab does not recognise this chapter. Restart Julia Time, then reload this page. Your draft is still here." : "The case data did not arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here."; }
  function failCaseInfo(state, message) { if (!state || !state.infoRequest) return state; return Object.assign({}, state, {infoRequest:null, metadata:null, pending:null, expired:false, statusMessage:null, metadataFailure:metadataFailureText(message), result:null}); }
  function expireInfo(state, requestId) { if (!state || !state.infoRequest || state.infoRequest.request_id !== requestId) return state; return Object.assign({}, state, {infoRequest:null, metadata:null, pending:null, expired:false, statusMessage:null, metadataFailure:"The case data took too long to arrive. Reconnect or restart Julia Time, then reload this page. Your draft is still here.", result:null}); }
  // Night round 2 (r2-bugs.md finding 1): a server timeout carries its own feedback naming the
  // cause (the code ran over the time limit; a loop that never ends is the usual cause). Show that
  // line. The client's own deadline (expireRun) keeps its "took too long" text.
  const TIMEOUT_FALLBACK = "Julia stopped your code because it ran too long. A loop that never ends is the usual cause.";
  function serverTimeoutText(message) {
    const feedback = message && typeof message.feedback === "string" ? message.feedback.trim() : "";
    return (feedback || TIMEOUT_FALLBACK) + " Change your code, then run again.";
  }
  function expireRun(state, requestId) { if (!state || !state.pending || state.pending.request_id !== requestId) return state; return Object.assign({}, state, {expired:true, statusMessage:null, runFailure:{status:"timeout", request_id:requestId, feedback:"This check took too long. Check your code, then run again."}, result:null}); }
  function histogramData(metadata, data) {
    // A plain number (the taught step 2 answer) and the older labelled pair both arrive with the
    // same server-computed facts; only the kind tag differs by which shape the learner returned.
    if (!validMetadata(metadata) || !data || (data.kind !== "event-frequency" && data.kind !== "frequency-number") || !Number.isInteger(data.matching) || !Number.isInteger(data.trials) || data.trials !== metadata.n_trials || data.matching < 0 || data.matching > data.trials || typeof data.frequency !== "number" || !Number.isFinite(data.frequency) || Math.abs(data.frequency - data.matching / data.trials) >= 1e-12) return null;
    const bins = simulationBins(metadata);
    return bins.reduce((total, bin) => total + (bin.tail ? bin.frequency : 0), 0) === data.matching ? bins : null;
  }
  function validVisual(metadata, move, result) {
    const data = result && result.result_data;
    if (!data || typeof data !== "object") return false;
    if (move === "event-mask") return data.kind === "boolean-vector" && Number.isInteger(data.length) && data.length === metadata.n_trials && Number.isInteger(data.true_count) && data.true_count >= 0 && data.true_count <= data.length && Array.isArray(data.preview) && data.preview.every(value => typeof value === "boolean");
    return histogramData(metadata,data) !== null;
  }
  // T4 (2026-09-12 panel finding): a server timeout that arrives as a normal case_result (rather
  // than via the client's own armRunDeadline expiry) used to be flattened into the same generic
  // "rejected" status as a wrong answer, so a genuinely-hanging run read as "did not meet the
  // stated check" instead of the honest timeout message. Preserve a reported "timeout" status.
  function applyCaseResult(state, message) { if (!state.pending || !message || message.type !== "case_result" || !sameIdentity(message,state.pending)) return state; const accepted = message.status === "ok" && message.pass === true && message.progress_eligible === true && validVisual(state.metadata,state.activeMove,message); if (accepted) return Object.assign({}, state, {pending:null, expired:false, statusMessage:null, result:message, evidence:{move_id:state.activeMove, result_data:message.result_data}, firstAccepted:true, secondAccepted:Boolean(state.secondAccepted) || state.activeMove === "event-frequency"}); const runFailure = message.status === "timeout" ? {status:"timeout", request_id:state.pending.request_id, feedback:serverTimeoutText(message)} : {status:"rejected", run_status:message.status, request_id:state.pending.request_id, feedback:challengeRecovery(state.activeMove, message, state.metadata), original_error:message.status === "error" ? safeText(message.message || message.feedback) : "", value_repr:message.status === "ok" ? safeText(message.value_repr) : ""}; return Object.assign({}, state, {pending:null, expired:false, statusMessage:null, result:null, runFailure}); }
  function isNewAcceptedResult(before, after, message) { return Boolean(before && after && before !== after && after.result === message && after.evidence && after.evidence.result_data === message.result_data); }
  function actionSimulationId(action) { return action === "draw-six" ? "c5-card-round-v1" : "c5-" + action + "-v1"; }
  function beginAction(state, requestId, action) { if (!validMetadata(state.metadata) || !["draw-six","replay-100","replay-1000"].includes(action)) return state; return Object.assign({}, state, {actionPending:{contract_version:1,case_id:CASE_ID,chapter:CHAPTER,move_id:"card-draw-demo",mode:"demonstration",activity_id:"card-round",simulation_id:actionSimulationId(action),request_id:requestId,action:action}, actionFailure:null, demo:null, cardChoice:action === "draw-six" ? null : state.cardChoice}); }
  function validDemo(message, expected) { const data = message && message.result_data; if (!data || typeof data !== "object") return false; if (expected.action === "draw-six") return data.kind === "card-draws" && Array.isArray(data.draws) && data.draws.length === 6 && data.draws.every(value => value === "teal" || value === "orange"); return data.kind === "simulation-counts" && Array.isArray(data.counts) && data.counts.length === (expected.action === "replay-100" ? 100 : 1000) && data.counts.every(Number.isInteger); }
  function sameActionIdentity(message, expected) { return Boolean(message && expected && message.contract_version === expected.contract_version && message.case_id === expected.case_id && message.chapter === expected.chapter && message.move_id === expected.move_id && message.mode === expected.mode && message.activity_id === expected.activity_id && message.simulation_id === expected.simulation_id && message.request_id === expected.request_id && message.action === expected.action); }
  function expireAction(state, requestId) { if (!state || !state.actionPending || state.actionPending.request_id !== requestId) return state; return Object.assign({}, state, {actionPending:null, actionFailure:{status:"timeout", request_id:requestId, message:"Toto’s card activity took too long. Nothing changed in the case; try it again or continue to the Julia step."}}); }
  function applyActionResult(state, message) { const expected = state.actionPending; if (!expected || !message || message.type !== "case_action_result" || !sameActionIdentity(message,expected)) return state; if (message.status === "error") return Object.assign({}, state, {actionPending:null, actionFailure:{status:"error", request_id:expected.request_id, message:"Toto’s card activity could not run. Nothing changed in the case; try it again or continue to the Julia step."}}); if (message.status !== "ok" || message.progress_eligible !== false || !validDemo(message,expected)) return state; return Object.assign({}, state, {actionPending:null, actionFailure:null, demo:message}); }
  function disconnect(state) { return Object.assign({}, state, {connection:"offline",infoRequest:null,pending:null,expired:false,statusMessage:null,actionPending:null}); }
  function infoMessage(move,id) { return Object.assign({type:"case_info",contract_version:1},identity(move,id,null)); }
  function runMessage(state,code,id) { return Object.assign({type:"case_run",contract_version:1,code:code},identity(state.activeMove,id,state.metadata && state.metadata.simulation_id)); }
  function actionMessage(action,id) { return {type:"case_action",contract_version:1,case_id:CASE_ID,chapter:CHAPTER,move_id:"card-draw-demo",mode:"demonstration",activity_id:"card-round",simulation_id:null,request_id:id,action:action}; }
  function safeText(value) { return value == null ? "" : String(value); }
  // Repair 7 (2026-09-26): learners read trial counts (1000, not 0.113) as a whole quantity, so give
  // those a thousands separator; a frequency itself stays as Julia printed it.
  function formatCount(n) { return typeof n === "number" && Number.isInteger(n) ? n.toLocaleString("en-US") : String(n); }
  // AGENTS.md rule 3 (never invent output): "frequency-number" is the learner's own plain number,
  // exactly as Julia returned it. "event-frequency" is the named tuple shape; only that shape shows
  // the fabricated-looking (events = ..., frequency = ...) text.
  // Repair 7 (2026-09-26): step 1's explanation has no limit line by design (bible C5: "No limit
  // line, step 2 carries it"), so omit "Limit:" entirely rather than showing it with nothing after.
  // r3 (2026-09-27): on a run that was not accepted the server's case and limit lines are generic
  // ("A failed run says nothing about causes..."), so only the Julia line shows.
  // Round 8 (r8-audit #1): one paragraph per line, with no "Julia:/Case:/Limit:" labels, as in C1-C4.
  function explanationText(explanation, accepted = true) {
    const parts = [safeText(explanation.julia)];
    if (!accepted) return parts.filter(Boolean);
    parts.push(safeText(explanation.case));
    if (explanation.limit) parts.push(safeText(explanation.limit));
    return parts.filter(Boolean);
  }
  function juliaReturnedText(data) {
    if (!data) return null;
    // Never invent output (AGENTS.md rule 3): Julia 1.10 prints a Bool vector as Bool[0, 0, 1, …], with 0 and 1.
    const shown = Array.isArray(data.preview) ? data.preview.map(value => value ? "1" : "0").join(", ") : "";
    const more = Array.isArray(data.preview) && data.length > data.preview.length ? ", …" : "";
    // Never invent output (AGENTS.md rule 3): show Julia's own display, e.g. 113//1000 or
    // Bool[0, 0, 1  …  0, 1], when the server sends it as "returned" (round 7, r7-bugs #4 and #5).
    // The page builds its own display only when an older server sends no "returned".
    const julia = typeof data.returned === "string" && data.returned ? data.returned : null;
    if (data.kind === "boolean-vector") return `${julia || `Bool[${shown}${more}]`}\n${formatCount(data.true_count)} of ${formatCount(data.length)} rounds had 5 or more`;
    if (data.kind === "frequency-number") return `${julia || data.frequency}\n${formatCount(data.matching)} matching rounds of ${formatCount(data.trials)} rounds`;
    if (data.kind === "event-frequency") return `${julia || `(events = Bool[${shown}${more}], frequency = ${data.frequency})`}\n${formatCount(data.matching)} matching rounds of ${formatCount(data.trials)} rounds`;
    return null;
  }
  // Nit 15 (adversary review 2026-09-26): juliaReturnedText's second line ("113 matching rounds of
  // 1,000 rounds") is the game's own count, not something Julia printed. Split it out so the page can
  // label it as the game's note rather than showing it under "Julia returned" as if Julia said it.
  function splitJuliaReturned(text) {
    if (typeof text !== "string") return {returned: null, note: null};
    const at = text.indexOf("\n");
    return at === -1 ? {returned: text, note: null} : {returned: text.slice(0, at), note: text.slice(at + 1)};
  }
  function table(parent, rows, limit) { const t=document.createElement("table"), head=document.createElement("thead"), body=document.createElement("tbody"), hr=document.createElement("tr"); ["round","count"].forEach(name=>{const th=document.createElement("th");th.textContent=name;hr.append(th);});head.append(hr);rows.slice(0,limit).forEach(row=>{const tr=document.createElement("tr");[row.simulation,row.count].forEach(value=>{const td=document.createElement("td");td.textContent=safeText(value);tr.append(td);});body.append(tr);});t.append(head,body);parent.append(t); }
  function eventDecisionTable(parent, rows) { const t=document.createElement("table"), head=document.createElement("thead"), body=document.createElement("tbody"), hr=document.createElement("tr"); ["round","count","at least the observed count?"].forEach(name=>{const th=document.createElement("th");th.textContent=name;hr.append(th);});head.append(hr);rows.forEach(row=>{const tr=document.createElement("tr");[row.simulation,row.count,row.meets_event ? "true" : "false"].forEach(value=>{const td=document.createElement("td");td.textContent=safeText(value);tr.append(td);});body.append(tr);});t.append(head,body);parent.append(t); }
  function renderDistribution(parent, bins, title, text, accepted) {
    if (!Array.isArray(bins) || !bins.length) return;
    const section=document.createElement("section"), heading=document.createElement("h3"), note=document.createElement("p"), list=document.createElement("ol");
    section.className="distribution"; heading.textContent=title; note.textContent=text; list.className="distribution-bars";
    const largest=Math.max(1,...bins.map(bin=>bin.frequency));
    bins.forEach(bin=>{const item=document.createElement("li"), bar=document.createElement("span"), label=document.createElement("span"); item.className=bin.tail ? "tail" : ""; if(accepted && bin.tail)item.classList.add("accepted"); bar.className="distribution-bar";bar.style.height=`${Math.max(8,Math.round(160*bin.frequency/largest))}px`;bar.style.setProperty("--share",String(Math.round(100*bin.frequency/largest)));label.className="distribution-label";label.textContent=`${bin.count}: ${bin.frequency}${bin.tail ? " (at least the observed count)" : ""}`;item.append(bar,label);list.append(item);});
    section.append(heading,note,list);parent.append(section);
  }
  function init() {
    const $ = id => document.getElementById(id); const el={sceneNext:$("scene-next"),scene:$("scene"),work:$("work"),start:$("start"),back:$("back"),board:$("case-board"),sceneBoard:$("case-board-scene"),sceneTitle:$("scene-title"),connection:$("connection"),reconnect:$("reconnect"),moves:document.querySelectorAll("[data-move]"),moveLock:$("move-lock"),step:$("move-step"),title:$("move-title"),stepWhy:$("step-why"),question:$("move-question"),required:$("required-result"),context:$("case-context"),data:$("simulation-data"),caseStatus:$("case-status"),answerReference:$("answer-before-editor"),showFullAnswer:$("show-full-answer"),namesFrequency:$("names-frequency"),code:$("code"),draftNote:$("draft-note"),run:$("run"),status:$("run-status"),syntax:$("syntax"),result:$("result"),visual:$("visual"),next:$("next"),hint:$("hint"),nextHint:$("next-hint"),bridgeCard:$("bridge-card"),actionButtons:document.querySelectorAll("[data-action]"),prediction:$("card-prediction"),demo:$("demo"),cardEvent:$("card-event"),frequencyComposition:$("frequency-composition"),frequencyCompositionCards:$("frequency-composition-cards"),frequencyCompositionFeedback:$("frequency-composition-feedback"),checkFrequencyComposition:$("check-frequency-composition"),resetFrequencyComposition:$("reset-frequency-composition")};
    if (!el.work) return; let storage=null; try {storage=localStorage;} catch (_) {} const course=window.JuliaTimeCourseState; const bridges=typeof window !== "undefined" ? window.JuliaTimeBridges : null; const attempt=new URLSearchParams(location.search).get("attempt") || ""; let state=createState(), socket=null, timer=null, infoTimer=null, runTimer=null, actionTimer=null, stopped=false, hint=0, drafts=Object.create(null), restoredDrafts=Object.create(null), submittedCode=Object.create(null), acceptedCode=Object.create(null), frequencyOrder=[], saveOk=true; state.activeMove=initialMove(course,storage,attempt,location.search); state.firstAccepted=canOpenMove(course,storage,attempt,"event-frequency"); state.secondAccepted=acceptedMoveKeys(course,storage,attempt).includes("C5/event-frequency"); if (location.protocol === "file:") state.connection="offline"; if (el.connection) el.connection.textContent=openingConnectionMessageForProtocol(location.protocol); if (el.board) el.board.href=caseBoardUrl(location.search); if (el.sceneBoard) el.sceneBoard.href=caseBoardUrl(location.search);
    const obsoleteDrafts=Object.create(null);
    // Night review r9 (2026-09-28): the move whose text the editor holds. It is null until the first
    // selectMove fills the editor, so connecting never copies the still-empty editor over a saved draft.
    let editorMove=null;
    let lastRun=null; // UI-03: the run Julia last checked for this editor text; cleared by any edit.
    try {const saved=course && course.readChallengeDrafts ? course.readChallengeDrafts(storage,attempt) : {}; Object.keys(saved || {}).forEach(key=>{if(key.startsWith("C5/") && typeof saved[key] === "string") { const move=key.slice(3), value=saved[key]; if(isObsoleteDraft(move,value)) { drafts[move]=""; restoredDrafts[move]=false; obsoleteDrafts[move]=true; if(course && course.writeChallengeDraft) course.writeChallengeDraft(storage,attempt,CHAPTER,move,""); } else { drafts[move]=value; restoredDrafts[move]=value.length > 0; } }});} catch (_) {}
    function moveCopy() { return COPY[state.activeMove]; }
    function draftCaption() { return lastRun ? draftStatus(lastRun) : obsoleteDrafts[state.activeMove] ? "An obsolete incomplete draft was cleared. Your valid drafts are safe; open Stuck? Hints below for the steps, or start your own." : draftNotice(Boolean(el.code.value),Boolean(restoredDrafts[state.activeMove])); }
    function renderHints(lines) { const shown=Array.from(el.hint.children,item=>item.textContent), grows=shown.length <= lines.length && shown.every((text,index)=>text===lines[index]); if(!grows) el.hint.replaceChildren(); lines.slice(grows ? shown.length : 0).forEach(line=>{const p=document.createElement("p");p.textContent=line;el.hint.append(p);}); }
    function clearResult() { el.result.replaceChildren(); el.visual.replaceChildren(); el.next.hidden=true; el.next.dataset.destination=""; showSolvedNext(); }
    // Round 6 (r6-rc #5): a chapter solved on an earlier run still offers the way on to Chapter 6.
    function showSolvedNext() { if (!acceptedMoveKeys(course, storage, attempt).includes("C5/event-frequency")) return; el.next.hidden=false; el.next.dataset.destination="chapter6"; el.next.textContent="Next: three stories →"; }
    function clearInfoTimer() { if(infoTimer) { clearTimeout(infoTimer); infoTimer=null; } }
    function clearRunTimer() { if(runTimer) { clearTimeout(runTimer); runTimer=null; } }
    function armRunDeadline(id) { clearRunTimer(); runTimer=setTimeout(()=>{const before=state;state=expireRun(state,id);if(state===before)return;lastRun=state.runFailure;resultMessage(state.runFailure);render();el.code.focus();},RUN_DEADLINE_MS); }
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
      label.textContent = "Simulated data made for this game: Toto's what-if rounds, not new jars.";
      const model = document.createElement("p");
      model.textContent = `Each round: ${state.metadata.n_jars} cards, each teal half the time (${state.metadata.p_ref}).`;
      const lead = document.createElement("p");
      lead.textContent = `Observed B09 count: ${state.metadata.observed_count}. Rounds played: ${formatCount(state.metadata.n_trials)}.`;
      const binding = document.createElement("p");
      binding.className = "practice-bridge";
      binding.textContent = `Julia inputs: sim_counts: all ${formatCount(state.metadata.n_trials)} round counts, one number per round; observed_count: the notebook’s B09 count (${state.metadata.observed_count}) to compare against.`;
      const previewHeading = document.createElement("h3");
      previewHeading.textContent = "First 12 supplied counts";
      const previewNote = document.createElement("p");
      previewNote.textContent = "You do not need to count these by hand. Use only the count values in Julia: sim_counts contains every round’s count; this is just a peek at what one count looks like, and the histogram below shows all rounds.";
      const columnDetails = document.createElement("details"), columnSummary = document.createElement("summary"), columnExplanation = document.createElement("p");
      columnSummary.textContent = "Why the table has two columns but Julia uses one list of counts";
      columnExplanation.textContent = "The round column is the row label. sim_counts contains the count column in that same order.";
      columnDetails.append(columnSummary, columnExplanation);
      const moreDetails = document.createElement("details"), moreSummary = document.createElement("summary"), moreTable = document.createElement("div");
      moreSummary.textContent = "Show 18 more supplied counts";
      moreDetails.append(moreSummary, moreTable);
      // 2026-09-25 layout pass: the first counts read as one line; the table views sit in one closed section.
      const strip = document.createElement("p"); strip.className = "count-strip";
      strip.textContent = "sim_counts begins: " + rows.slice(0, 12).map(row => row.count).join(", ") + ", …";
      const tableDetails = document.createElement("details"), tableSummary = document.createElement("summary"), tableBox = document.createElement("div");
      tableSummary.textContent = "See the first 30 counts as a table";
      tableDetails.append(tableSummary, previewHeading, tableBox);
      el.data.append(label, model, lead, binding, previewNote, strip, tableDetails);
      table(tableBox,state.metadata.inputs[0].rows,12);
      table(moreTable, rows.slice(12,30), 18);
      tableDetails.append(moreDetails, columnDetails);
      const bins = simulationBins(state.metadata);
      const notes = evidenceNotes(state.metadata, state.activeMove);
      if (bins) renderDistribution(el.data, bins, `Before you write: see how all ${Number(state.metadata.n_trials).toLocaleString("en-US")} rounds' counts spread out`, notes.distribution, false);
      const bridgeRows = eventDecisionRows(state.metadata, 4);
      if (bridgeRows.length) {
        const bridge = document.createElement("section"), heading = document.createElement("h3"), lead = document.createElement("p"), explanation = document.createElement("p");
        bridge.className = "practice-bridge";
        heading.textContent = "From one count to one yes-or-no result";
        lead.textContent = `For each round, ask: is its count at least ${state.metadata.observed_count}?`;
        explanation.textContent = notes.comparison;
        bridge.append(heading, lead);
        eventDecisionTable(bridge, bridgeRows);
        bridge.append(explanation);
        // A worked walkthrough, not what to type: it lives in the help panel (2026-09-25 layout pass).
        const helpSlot = document.getElementById("event-bridge-help");
        if (helpSlot) helpSlot.replaceChildren(bridge); else el.data.append(bridge);
      }
    }
    function renderVisual() { el.visual.replaceChildren(); if(!state.result || !state.evidence || state.result.result_data !== state.evidence.result_data) return; const data=state.evidence.result_data, panel=document.createElement("section"), heading=document.createElement("h2"); heading.textContent=state.activeMove === "event-mask" ? "Your marked rounds" : "How often it happened"; const p=document.createElement("p"); p.textContent=state.activeMove === "event-mask" ? `${data.true_count} of ${data.length} rounds had 5 or more.` : `${data.matching} of ${data.trials} rounds had 5 or more: ${(100*data.frequency).toFixed(1)}%.`; const bars=document.createElement("div");bars.className="tail-bar"; const fill=document.createElement("span");fill.style.width=`${100*(state.activeMove === "event-mask" ? data.true_count/data.length : data.frequency)}%`;bars.append(fill);const limit=document.createElement("p");limit.className="limit";limit.textContent="This is a frequency from Toto's coin-flip cards. It does not identify a cause or show that a coin flip is what really happens.";panel.append(heading,p,bars,limit);const bins=state.activeMove === "event-frequency" ? histogramData(state.metadata,data) : simulationBins(state.metadata);if(bins && (state.activeMove === "event-frequency" || bins.filter(bin=>bin.tail).reduce((total,bin)=>total+bin.frequency,0) === data.true_count)) renderDistribution(panel,bins,"The rounds your rule marked",`Counts at least ${state.metadata.observed_count} are the bars your code marked true.`,true);el.visual.append(panel); }
    function renderDemo() { el.demo.replaceChildren();el.cardEvent.replaceChildren(); if(!validMetadata(state.metadata)) return; if(state.actionFailure) {const recovery=document.createElement("p");recovery.className="recovery";recovery.textContent=state.actionFailure.message;el.demo.append(recovery);} if(!state.demo) return; const data=state.demo.result_data, p=document.createElement("p"); p.className="demo-result"; if(data.kind === "card-draws") {p.textContent="Toto’s recorded six-card draw: ";data.draws.forEach(value=>{const card=document.createElement("span");card.className=value === "teal" ? "teal-card":"orange-card";card.textContent=value;p.append(card);});p.append(". That count is one round of the card demonstration; the case task applies the same yes-or-no idea to sim_counts.");el.demo.append(p);const answer=cardEventFeedback(data.draws,state.metadata.observed_count,state.cardChoice);const question=document.createElement("p");question.className="card-question";question.textContent=`There are ${data.draws.filter(value=>value === "teal").length} teal cards. Is that at least the observed B09 count (${state.metadata.observed_count})?`;const choices=document.createElement("div");choices.className="controls";[["yes","Yes: it is at least that many"],["no","No: it is fewer"]].forEach(([choice,label])=>{const button=document.createElement("button");button.type="button";button.dataset.cardChoice=choice;button.textContent=label;button.disabled=Boolean(answer && answer.correct);button.addEventListener("click",()=>{state=answerCardEvent(state,choice);render();});choices.append(button);});el.cardEvent.append(question,choices);if(answer){const feedback=document.createElement("p");feedback.className=answer.correct ? "demo-result" : "recovery";feedback.textContent=answer.correct ? `${answer.feedback} That was practice data. Now apply the same at-least comparison to the named sim_counts below.` : answer.feedback;el.cardEvent.append(feedback);}} else {const atLeast=data.counts.filter(value=>value >= state.metadata.observed_count).length;p.textContent=`Recorded practice replay: ${atLeast} of ${data.n_trials} rounds were at least the observed count. It does not count for the case.`;el.demo.append(p);if(typeof state.demo.generated_code === "string" && state.demo.generated_code.trim()) {const note=document.createElement("p"), code=document.createElement("pre");note.className="limit";note.textContent="This demonstration code came from the server (shown as text only; it is not your code and does not count for the case).";code.textContent=state.demo.generated_code;el.demo.append(note,code);}} }
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
      el.frequencyCompositionFeedback.textContent=frequencyOrder.length === 0 ? "Choose the first piece." : "Your order: " + frequencyOrder.map(id=>cards.find(card=>card.id===id).text).join(" → ");
    }
    function renderCaseStatus() { if(!el.caseStatus) return; el.caseStatus.replaceChildren(); const status=caseStatus(state.metadata, state.activeMove, acceptedMoveKeys(course, storage, attempt).includes("C3/filter-disagreement")); if(!status) return; const eyebrow=document.createElement("p"), title=document.createElement("h2"), established=document.createElement("p"), why=document.createElement("p"); eyebrow.className="eyebrow";eyebrow.textContent="Case status before you write";title.textContent="Why this step now";established.textContent=status.established;why.textContent=status.why_now; const parts=[eyebrow,title,established]; if(status.unknown){const unknown=document.createElement("p");unknown.textContent=status.unknown;parts.push(unknown);} parts.push(why); el.caseStatus.append(...parts); }
    function renderAnswerReference(stage, copy) {
      if (!el.answerReference) return;
      if (!stage || stage.label !== "Full answer") { el.answerReference.replaceChildren(); el.answerReference.hidden = true; return; }
      const label=document.createElement("p"), code=document.createElement("pre");
      label.textContent="Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns. It does not count as a saved answer until Julia checks it.";
      code.className="complete-answer-code";
      code.textContent=copy.solution;
      el.answerReference.replaceChildren(label,code);
      el.answerReference.hidden=false;
    }
    function render() { if (el.namesFrequency) el.namesFrequency.hidden = state.activeMove !== "event-frequency"; const c=moveCopy(), stages=helpStages(state.activeMove), stage=hint > 0 ? stages[hint - 1] : null, bridge=preEditorBridge(state.activeMove); el.step.textContent=c.step;el.title.textContent=c.title;if(el.stepWhy)el.stepWhy.textContent=c.why||"";el.question.textContent=c.question;el.required.textContent=c.required;el.syntax.replaceChildren(document.createTextNode(bridge.lead));if(el.draftNote)el.draftNote.textContent=draftCaption();holdRun(el.run,state.connection !== "connected" || !validMetadata(state.metadata),isRunPending(state));el.status.textContent=runStatusText(state, saveOk);el.reconnect.hidden=(state.connection === "connected" && !state.metadataFailure) || state.connection === "connecting";el.moves.forEach(button=>{const current=button.dataset.move === state.activeMove;button.setAttribute("aria-current",String(current));button.disabled=button.dataset.move === "event-frequency" && !state.firstAccepted;});if(el.moveLock) el.moveLock.textContent=moveLockText(state);el.actionButtons.forEach(button=>{button.disabled=state.connection !== "connected" || !validMetadata(state.metadata)||Boolean(state.actionPending);});renderAnswerReference(stage,c);renderHints(visibleHints(state.activeMove,hint));el.nextHint.textContent=hint >= stages.length ? "All help shown" : hint === 0 ? "Show the idea" : stages[hint - 1].button;el.nextHint.disabled=hint >= stages.length;if(el.showFullAnswer)el.showFullAnswer.hidden=hint >= stages.length;if(bridges)bridges.renderCard(el.bridgeCard,"C5/"+state.activeMove,acceptedCode[state.activeMove] || "");renderFrequencyComposition();renderData();renderCaseStatus();renderVisual();renderDemo();}
    function persistDraft() { drafts[state.activeMove]=el.code.value;restoredDrafts[state.activeMove]=false;try{if(course && course.writeChallengeDraft) course.writeChallengeDraft(storage,attempt,CHAPTER,state.activeMove,el.code.value);}catch(_){} }
    function selectMove(move) { if(!knownMove(move) || (move === "event-frequency" && !state.firstAccepted)) return; clearInfoTimer();clearRunTimer();lastRun=null;if(editorMove) drafts[editorMove]=el.code.value;state=beginInfo(state,requestId("c5-info"),move);hint=0;frequencyOrder=[];el.code.value=drafts[move] || initialEditorText();editorMove=move;clearResult();send(infoMessage(move,state.infoRequest.request_id));const id=state.infoRequest.request_id;infoTimer=setTimeout(()=>{const before=state;state=expireInfo(state,id);if(state!==before)render();},INFO_DEADLINE_MS);render(); }
    function persistAccepted(result) { if(!course || !result || !state.evidence) return;try{course.recordHistoricalMoveIfMissing(storage,attempt,CHAPTER,result.move_id);course.writeEvidenceIfMissing(storage,attempt,{chapter:CHAPTER,move_id:result.move_id,title:result.move_id === "event-mask" ? "Marked the rounds" : "Worked out how often",row_count:result.result_data.trials || result.result_data.length,provenance:"historical-browser"});course.writeCursor(storage,attempt,{chapter:CHAPTER,move_id:result.move_id === "event-mask" ? "event-frequency" : "event-frequency",mode:"challenge"});}catch(_){}}
    function resultMessage(message) {
      el.result.replaceChildren();
      const outcome=document.createElement("p");outcome.className="run-outcome";outcome.textContent=runOutcomeStatus(message, saveOk);el.result.append(outcome);
      const p=document.createElement("p");p.textContent=safeText(message.message || message.feedback || "Julia returned a result.");el.result.append(p);
      if(message.original_error){const details=document.createElement("details"),summary=document.createElement("summary"),original=document.createElement("pre");summary.textContent="Original Julia error";original.textContent=safeText(message.original_error);details.append(summary,original);el.result.append(details);}
      if(message.status === "rejected" && message.value_repr){const details=document.createElement("details"),summary=document.createElement("summary"),returned=document.createElement("pre");summary.textContent="Actual Julia output";returned.textContent=safeText(message.value_repr);details.append(summary,returned);el.result.append(details);}
      if(message.explanation){explanationText(message.explanation,message.status === "ok" && message.pass === true).forEach(line=>{const e=document.createElement("p");e.textContent=line;el.result.append(e);});}
      const data=message && message.status === "ok" ? message.result_data : null;
      if (!data || (data.kind !== "frequency-number" && !Array.isArray(data.preview))) return;
      const text=juliaReturnedText(data);
      if (text === null) return;
      const {returned, note:noteLine}=splitJuliaReturned(text);
      const heading=document.createElement("h3"), output=document.createElement("pre");
      heading.textContent="Julia returned";
      output.textContent=returned;
      output.className="julia-output";
      el.result.append(heading,output);
      if (noteLine) { const note=document.createElement("p"); note.className="game-note"; note.textContent="What this means: "+noteLine; el.result.append(note); }
    }
    function focusResult() { if (el.result) el.result.focus(); }
    // r5 (2026-09-27): while Julia runs, Run stays focusable and reads as busy (aria-disabled), so keyboard focus is not dropped to the page.
    function holdRun(button, blocked, busy) { if (!button) return; button.disabled = blocked; if (busy && !blocked) button.setAttribute("aria-disabled", "true"); else button.removeAttribute("aria-disabled"); }
    function send(message) { if(socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
    function connect() { if(stopped) return; clearTimeout(timer); timer=null;clearInfoTimer();clearRunTimer(); if(!canOpenSocket(location.protocol)){const old=socket;socket=null;if(old)try{old.close();}catch(_){}state=disconnect(state);if(el.connection)el.connection.textContent=connectionMessageForProtocol(location.protocol);render();return;} const old=socket;socket=null;if(old)try{old.close();}catch(_){}state.connection="connecting";if(el.connection)el.connection.textContent="● Connecting to the lab…";render();try{socket=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/ws");}catch(_){return retry();}const ws=socket;ws.onopen=()=>{if(socket!==ws)return;state.connection="connected";if(el.connection)el.connection.textContent="● Julia is ready";selectMove(state.activeMove);};ws.onmessage=event=>{if(socket!==ws)return;let message;try{message=JSON.parse(event.data);}catch(_){return;} const before=state;state=applyCaseInfo(state,message);if(state!==before){clearInfoTimer();render();return;} if(message && message.type === "status"){state=applyRunStatus(state,message);if(state!==before){armRunDeadline(state.pending.request_id);render();}return;} if(message && message.type === "error"){state=failCaseInfo(state,message);if(state!==before){clearInfoTimer();render();return;}}state=applyCaseResult(state,message);if(state!==before){clearRunTimer();lastRun=state.result === message ? message : {status:message.status, pass:false};const destination=nextDestination(message.move_id,isNewAcceptedResult(before,state,message));if(destination){persistAccepted(message);saveOk=savedMove(course,storage,attempt,CHAPTER,message.move_id);acceptedCode[message.move_id]=submittedCode[message.move_id] || "";}resultMessage(state.runFailure || message);if(destination){el.next.hidden=false;el.next.dataset.destination=destination;el.next.textContent=destination==="chapter6"?"Next: three stories →":"Next: how often? →";}render();if(state.runFailure) el.code.focus(); else focusResult();return;}state=applyActionResult(state,message);if(state!==before)renderDemo();render();};ws.onclose=()=>{if(socket!==ws)return;clearInfoTimer();clearRunTimer();state=disconnect(state);if(el.connection)el.connection.textContent="● Connection to Julia interrupted, reconnecting…";render();retry();};ws.onerror=()=>{};}
    function retry() { if(stopped || !canOpenSocket(location.protocol) || timer) return; timer=setTimeout(()=>{timer=null;connect();},1500); }
    el.checkFrequencyComposition.addEventListener("click",()=>{
      const cards=frequencyCompositionCards();
      if(frequencyOrder.length !== cards.length) { el.frequencyCompositionFeedback.textContent="Choose every piece, then check the order."; return; }
      el.frequencyCompositionFeedback.textContent=frequencyCompositionIsCorrect(frequencyOrder) ? "Yes. That is the order. In your editor, use the case names above; this practice did not add evidence or write code for you." : "Not yet. The share needs the events first: make events on the first line, then divide. Start again.";
    });
    el.resetFrequencyComposition.addEventListener("click",()=>{frequencyOrder=[];renderFrequencyComposition();});
    function focusElement(element) { if (element) element.focus(); }
    // r5 (2026-09-27): on first load the skip link's target sits in the hidden work area; open it as the start button does.
    const skip = document.querySelector("a.skip"); if (skip) skip.addEventListener("click", event => { if (!el.work.hidden) return; event.preventDefault(); el.start.click(); });
    el.start.addEventListener("click",()=>{el.scene.hidden=true;el.work.hidden=false;connect();focusElement(el.title);});/* Round 8 (r8-rc #3): a solved chapter also offers Chapter 6 on its story scene. */if(el.sceneNext){el.sceneNext.hidden = !acceptedMoveKeys(course, storage, attempt).includes("C5/event-frequency");el.sceneNext.addEventListener("click",()=>window.location.assign(nextChapterUrl(location.search)));}el.back.addEventListener("click",()=>{el.work.hidden=true;el.scene.hidden=false;focusElement(el.sceneTitle);});el.reconnect.addEventListener("click",connect);el.moves.forEach(button=>button.addEventListener("click",()=>selectMove(button.dataset.move)));el.code.addEventListener("input",()=>{clearRunTimer();lastRun=null;persistDraft();if(el.draftNote)el.draftNote.textContent=draftCaption();});el.run.addEventListener("click",()=>{if(isRunPending(state))return;persistDraft();submittedCode[state.activeMove]=el.code.value;state=beginRun(state,requestId("c5-run"));if(state.pending){clearResult();send(runMessage(state,el.code.value,state.pending.request_id));armRunDeadline(state.pending.request_id);render();}});el.code.addEventListener("keydown",event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter"){event.preventDefault();el.run.click();}});el.next.addEventListener("click",()=>{const destination=el.next.dataset.destination;if(destination==="chapter6"){window.location.assign(nextChapterUrl(location.search));return;}if(destination==="event-frequency"){selectMove(destination);focusElement(el.title);}});el.nextHint.addEventListener("click",()=>{const total=helpStages(state.activeMove).length;hint=Math.min(total,hint+1);render();if(hint>=total)focusShown(el.answerReference);});
    // Owner playtest (2026-09-26): the full answer is one visible click away, as in Chapters 2-4; it reuses the
    // hint ladder's own reference display and never enters the editor.
    // r4 (2026-09-27): the ladder button (now disabled) or this button (now hidden) had focus, so focus moves to the answer.
    function focusShown(target) { if (!target || target.hidden) return; target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:"nearest"}); }
    if (el.showFullAnswer) el.showFullAnswer.addEventListener("click", () => { hint = helpStages(state.activeMove).length; render(); focusShown(el.answerReference); });
    el.actionButtons.forEach(button=>button.addEventListener("click",()=>{const action=button.dataset.action;if(!action || !validMetadata(state.metadata))return;state=beginAction(state,requestId("c5-card"),action);if(state.actionPending)send(actionMessage(action,state.actionPending.request_id));render();}));window.addEventListener("pagehide",()=>{stopped=true;clearTimeout(timer);clearInfoTimer();clearRunTimer();timer=null;const old=socket;socket=null;if(old)try{old.close();}catch(_){}});render();
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
  return {CASE_ID,CHAPTER,MOVES,INFO_DEADLINE_MS,RUN_DEADLINE_MS,COPY,helpStage,visibleHints,preEditorBridge,frequencyCompositionCards,frequencyCompositionIsCorrect,challengeRecovery,requestedMove,acceptedMoveKeys,canOpenMove,initialMove,canOpenSocket,connectionMessageForProtocol,openingConnectionMessageForProtocol,createState,initialEditorText,isObsoleteDraft,beginInfo,beginRun,applyCaseInfo,failCaseInfo,expireInfo,expireRun,isRunPending,applyRunStatus,applyCaseResult,isNewAcceptedResult,beginAction,expireAction,applyActionResult,simulationBins,eventDecisionRows,cardEventFeedback,answerCardEvent,hasAnsweredCard,challengeReady,runStatusText,runOutcomeStatus,draftNotice,draftStatus,histogramData,validMetadata,caseStatus,moveLockText,evidenceNotes,disconnect,infoMessage,runMessage,actionMessage,caseBoardUrl,nextChapterUrl,nextDestination,requestId,formatCount,juliaReturnedText,splitJuliaReturned,explanationText,recoveryLead,init};
});

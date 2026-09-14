/* Case Board model and route helpers. No DOM or network access. */
(function (root, factory) {
  const state = typeof module === "object" && module.exports ? require("./course-state.js") : root && root.JuliaTimeCourseState;
  const legacy = typeof module === "object" && module.exports ? require("./legacy-import.js") : root && root.JuliaTimeLegacyImport;
  const api = factory(state, legacy);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeCourseClient = api;
})(typeof window !== "undefined" ? window : null, function (courseState, legacyImport) {
  "use strict";

  const MOVE_COPY = Object.freeze({
    "C1/select-records":{chapter:"C1", move:"select-records", label:"select the disputed records", concepts:["Boolean row selection", "table columns", "filtering a table"]},
    "C2/group":{chapter:"C2", move:"group", label:"group the tray records", concepts:["grouping records by a label"]},
    "C2/counts":{chapter:"C2", move:"counts", label:"count recorded detections", concepts:["summarising groups", "naming results with = and =>"]},
    "C2/rates":{chapter:"C2", move:"rates", label:"compare tray rates", concepts:["proportions", "elementwise division with ./"]},
    "C3/join-report-log":{chapter:"C3", move:"join-report-log", label:"join the report and handling log", concepts:["matching records by a shared key", "one-to-one table joins"]},
    "C3/filter-disagreement":{chapter:"C3", move:"filter-disagreement", label:"filter the recording disagreement", concepts:["elementwise not-equal comparison with .!=", "filtering returned rows"]},
    "C4/plan-distinct-recheck":{chapter:"C4", move:"plan-distinct-recheck", label:"plan three distinct rechecks", concepts:["sampling without replacement", "no invented observations"]},
    "C5/event-mask":{chapter:"C5", move:"event-mask", label:"name a simulation event", concepts:["elementwise comparisons", "Boolean event masks"]},
    "C5/event-frequency":{chapter:"C5", move:"event-frequency", label:"calculate an event frequency", concepts:["simulation frequencies", "matching events divided by trials"]},
    "C6/compatible-models":{chapter:"C6", move:"compatible-models", label:"retain compatible model rows", concepts:["inclusive ranges", "compatibility is not proof"]}
  });
  const ORDERED_KEYS = Object.keys(MOVE_COPY);

  function importedSource(source) {
    if (!source || typeof source.source_key !== "string" || !source.source_key || typeof source.fingerprint !== "string" || !Array.isArray(source.destinations)) return null;
    const destinations = source.destinations.filter(key => Object.prototype.hasOwnProperty.call(MOVE_COPY, key));
    return destinations.length ? {source_key:source.source_key, fingerprint:source.fingerprint, destinations} : null;
  }

  function sourcePayload(imported, source) {
    const destinations = new Set(source.destinations);
    return {
      moves:(Array.isArray(imported.moves) ? imported.moves : []).filter(move => move && destinations.has(move.key)),
      evidence:(Array.isArray(imported.evidence) ? imported.evidence : []).filter(item => item && destinations.has(item.chapter + "/" + item.move_id))
    };
  }

  function hasEvidence(storage, attempt, item) {
    return courseState.readEvidence(storage, attempt).some(saved => saved.chapter === item.chapter && saved.move_id === item.move_id);
  }

  function saveImportRecord(storage, attempt, record, source) {
    const sources = Object.assign({}, record.sources);
    sources[source.source_key] = {fingerprint:source.fingerprint, destinations:[...source.destinations]};
    const next = {schema_version:1, sources};
    return courseState.writeImportRecord(storage, attempt, next) ? {record:next, saved:true} : {record, saved:false};
  }

  function courseView(progress, storage, attempt, historicalChanged) {
    return Object.assign({}, progress, {
      evidence:courseState.readEvidence(storage, attempt),
      drafts:courseState.readChallengeDrafts(storage, attempt),
      notes:courseState.readNotes(storage, attempt),
      cursor:courseState.readCursor(storage, attempt),
      historicalChanged
    });
  }

  function loadCourseState(storage, attempt, options) {
    let status = courseState.courseStateStatus(storage, attempt);
    if (status === "malformed") return courseView(courseState.emptyCourseState(), storage, attempt, []);
    let progress = status === "valid" ? courseState.readCourseState(storage, attempt) : courseState.emptyCourseState();
    const imported = legacyImport.importLegacy(storage, attempt);
    let receipt = courseState.readImportRecord(storage, attempt);
    const historicalChanged = [];
    const acceptChangedHistory = Boolean(options && options.acceptChangedHistory === true);

    for (const candidate of Array.isArray(imported.sources) ? imported.sources : []) {
      const source = importedSource(candidate);
      if (!source) continue;
      const recorded = receipt.sources[source.source_key];
      const changedSource = Boolean(recorded && recorded.fingerprint !== source.fingerprint);
      if (recorded && !changedSource) continue;
      if (changedSource) {
        // A move a chapter already wrote directly to the shared course state (C3-C6, and C2 going
        // forward) can never be "lost" by a stale legacy fingerprint: skip the changed-source guard
        // once every destination this legacy source targets is already accepted some other way, and
        // just resynchronise the receipt so a later, genuinely new change is still detected.
        const acceptedNow = new Set(courseState.acceptedMoves(progress).map(move => move.key));
        if (source.destinations.every(key => acceptedNow.has(key))) {
          const receiptWrite = saveImportRecord(storage, attempt, receipt, source);
          receipt = receiptWrite.record;
          continue;
        }
        if (!acceptChangedHistory) {
          historicalChanged.push(source.source_key);
          continue;
        }
      }

      const payload = sourcePayload(imported, source);
      const merged = courseState.mergeHistoricalImport(progress, payload);
      if (merged.changed) {
        const saved = status === "missing"
          ? courseState.writeInitialCourseState(storage, attempt, merged.state)
          : courseState.writeCourseState(storage, attempt, merged.state);
        if (!saved) {
          if (changedSource) historicalChanged.push(source.source_key);
          continue;
        }
        status = "valid";
        progress = merged.state;
      }

      let sourceSaved = true;
      for (const evidence of payload.evidence) {
        if (!hasEvidence(storage, attempt, evidence) && !courseState.writeEvidenceIfMissing(storage, attempt, evidence)) {
          sourceSaved = false;
          break;
        }
      }
      if (!sourceSaved) {
        if (changedSource) historicalChanged.push(source.source_key);
        continue;
      }
      const receiptWrite = saveImportRecord(storage, attempt, receipt, source);
      receipt = receiptWrite.record;
      if (changedSource && !receiptWrite.saved) historicalChanged.push(source.source_key);
    }
    return courseView(progress, storage, attempt, historicalChanged);
  }

  function acceptedKeys(state) { return new Set(courseState.acceptedMoves(state).map(move => move.key)); }
  function validMove(chapter, move) { return Object.values(MOVE_COPY).some(item => item.chapter === chapter && item.move === move); }
  function legacyDestination(chapter, attempt, move) {
    const file = chapter === "C1" ? "index.html" : chapter === "C2" ? "chapter2.html" : chapter === "C3" ? "chapter3.html" : chapter === "C4" ? "chapter4.html" : chapter === "C5" ? "chapter5.html" : chapter === "C6" ? "chapter6.html" : null;
    if (!file) return null;
    const query = [];
    if (courseState.attemptId(attempt)) query.push("attempt=" + encodeURIComponent(attempt));
    if (validMove(chapter, move)) query.push("move=" + encodeURIComponent(move));
    return "../" + file + (query.length ? "?" + query.join("&") : "");
  }
  function adapterDestination(chapter, attempt, move) {
    if (!legacyDestination(chapter, attempt, move)) return null;
    const query = ["chapter=" + encodeURIComponent(chapter)];
    if (courseState.attemptId(attempt)) query.push("attempt=" + encodeURIComponent(attempt));
    if (validMove(chapter, move)) query.push("move=" + encodeURIComponent(move));
    return "chapter.html?" + query.join("&");
  }
  function speedLabDestination(attempt) {
    return "speed-lab.html" + (courseState.attemptId(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function chapterStatus(keys, entries, fallback) {
    const complete = entries.every(key => keys.has(key));
    const started = entries.some(key => keys.has(key));
    if (complete) return "Historical browser progress saved — run the chapter again for a fresh check";
    if (started) return "Historical browser progress saved — continue the next move";
    return fallback;
  }
  function conceptsFor(keys) {
    const concepts = [];
    for (const key of ORDERED_KEYS) if (keys.has(key)) for (const concept of MOVE_COPY[key].concepts) if (!concepts.includes(concept)) concepts.push(concept);
    return concepts;
  }
  function nextMove(keys) {
    const key = ORDERED_KEYS.find(item => !keys.has(item)) || ORDERED_KEYS[ORDERED_KEYS.length - 1];
    return MOVE_COPY[key];
  }
  function moveFromCursor(cursor, fallback) {
    if (!cursor || cursor.mode !== "challenge" || typeof cursor.chapter !== "string" || typeof cursor.move_id !== "string") return null;
    const candidate = MOVE_COPY[cursor.chapter + "/" + cursor.move_id];
    return candidate && candidate.chapter === fallback.chapter && candidate.move === fallback.move ? candidate : null;
  }
  function caseThread(keys, next) {
    const question = "Why does the report for batch B09—the report’s label for this group of jar records—say fleas vanished while the lab notebook records detections?";
    let established = "No case result has been checked in this browser yet.";
    let unknown = "We do not yet know which records the report means, why records differ, or whether either record is biologically right.";
    const complete = ORDERED_KEYS.every(key => keys.has(key));
    if (complete) {
      established = "The report and handling log disagree for tray T-C, and compatible candidate ranges remain under the stated range check.";
      unknown = "The range result does not identify a cause, decide which model is correct, or explain why the records differ.";
    } else if (keys.has("C6/compatible-models")) {
      established = "Some displayed candidate ranges contain the observed count under the stated compatibility rule.";
      unknown = "A compatible range does not decide which model is correct or explain why the records differ.";
    } else if (keys.has("C5/event-frequency")) {
      established = "The event frequency describes how often the stated simulation model produces an event like the observed count.";
      unknown = "That simulation result does not explain why the report and log differ.";
    } else if (keys.has("C4/plan-distinct-recheck")) {
      established = "A three-jar recheck can be planned without replacement from the eligible records.";
      unknown = "A plan is not a new observation, and it does not explain the recording disagreement.";
    } else if (keys.has("C3/filter-disagreement")) {
      established = "The joined records contain a recording disagreement.";
      unknown = "A recording disagreement does not tell us why the entries differ or which record is biologically right.";
    } else if (keys.has("C3/join-report-log")) {
      established = "The report and handling log can be placed side by side using their shared tray label.";
      unknown = "We still need to inspect whether any matched records differ, and a difference would not identify its cause.";
    } else if (keys.has("C2/rates")) {
      established = "The supplied B09 records can be compared by tray as recorded counts and proportions.";
      unknown = "A pattern in recorded detections does not explain a biological cause or the reported absence.";
    } else if (keys.has("C1/select-records")) {
      established = "The disputed B09 records have been identified in the supplied case table.";
      unknown = "We do not yet know whether recorded detections differ by tray or why the report and notebook differ.";
    }
    const why = {
      "C1/select-records":"First identify the exact B09 records: the group of jar records carrying the batch label named by the report.",
      "C2/group":"Put those records into tray groups so the same kind of jar can be compared together.",
      "C2/counts":"Turn each tray group into clear record and detection counts.",
      "C2/rates":"Compare proportions as well as counts, so tray sizes cannot mislead the comparison.",
      "C3/join-report-log":"Place report and handling records side by side before interpreting a possible difference.",
      "C3/filter-disagreement":"Inspect only the matched rows whose recorded counts disagree.",
      "C4/plan-distinct-recheck":"Choose distinct planned rechecks without pretending their outcomes already exist.",
      "C5/event-mask":"State precisely which simulated counts count as an event like the observation.",
      "C5/event-frequency":"Count how often that stated event occurs in the supplied simulations.",
      "C6/compatible-models":"Check which displayed range models can still accommodate the observation."
    };
    const key = next.chapter + "/" + next.move;
    const whyNext = complete
      ? "Case closed for today: review the checked facts, then use the planned recheck to collect a new observation rather than assume one."
      : why[key] || "Review what the case established and what remains unknown.";
    return {question, established, unknown, whyNext, hasEstablishedFact: keys.size > 0};
  }

  const CASE_FILE_MILESTONES = Object.freeze([
    {chapter:"C1", key:"C1/select-records"},
    {chapter:"C2", key:"C2/rates"},
    {chapter:"C3", key:"C3/filter-disagreement"},
    {chapter:"C4", key:"C4/plan-distinct-recheck"},
    {chapter:"C5", key:"C5/event-frequency"},
    {chapter:"C6", key:"C6/compatible-models"}
  ]);
  function caseFile(keys) {
    const accepted = keys instanceof Set ? keys : new Set();
    const progressive = new Set();
    return CASE_FILE_MILESTONES.map(({chapter, key}) => {
      const move = MOVE_COPY[key];
      const beforeThread = caseThread(progressive, move);
      const reached = accepted.has(key);
      if (reached) progressive.add(key);
      const thread = reached ? caseThread(progressive, move) : beforeThread;
      const label = reached ? "ESTABLISHED" : "STILL UNKNOWN";
      const fact = reached ? thread.established : thread.unknown;
      return {chapter, label, fact, line: label + ": " + fact};
    });
  }
  function dashboardModel(state) {
    const keys = acceptedKeys(state);
    const fallback = nextMove(keys);
    const resumed = moveFromCursor(state && state.cursor, fallback);
    const next = resumed || fallback;
    const cards = [
      {chapter:"C1", title:"The disputed batch", playable:true, href:"C1", status:chapterStatus(keys, ["C1/select-records"], "Playable now — select the disputed records")},
      {chapter:"C2", title:"Locate the pattern", playable:true, href:"C2", status:chapterStatus(keys, ["C2/group", "C2/counts", "C2/rates"], "Playable now — group the tray records")},
      {chapter:"C3", title:"Check the report", playable:true, href:"C3", status:chapterStatus(keys, ["C3/join-report-log", "C3/filter-disagreement"], "Playable now — join the report to the handling log")},
      {chapter:"C4", title:"Plan a recheck", playable:true, href:"C4", status:chapterStatus(keys, ["C4/plan-distinct-recheck"], "Playable now — choose three distinct eligible jars for a recheck plan")},
      {chapter:"C5", title:"Test a suspicion", playable:true, href:"C5", status:chapterStatus(keys, ["C5/event-mask", "C5/event-frequency"], "Playable now — name a simulated event and its frequency")},
      {chapter:"C6", title:"Compare explanations", playable:true, href:"C6", status:chapterStatus(keys, ["C6/compatible-models"], "Playable now — retain compatible candidate ranges")}
    ];
    const evidence = Array.isArray(state && state.evidence) ? state.evidence.map(item => ({title:item.title, chapter:item.chapter, move_id:item.move_id, row_count:item.row_count, provenance:item.provenance})) : [];
    const draftKeys = state && state.drafts && typeof state.drafts === "object" ? Object.keys(state.drafts).sort() : [];
    const changedHistory = Boolean(state && Array.isArray(state.historicalChanged) && state.historicalChanged.length);
    return {
      continue:{chapter:next.chapter, move:next.move, label:(resumed || (keys.size > 0 && keys.size < ORDERED_KEYS.length) ? "Continue" : keys.size === ORDERED_KEYS.length ? "Review" : "Start") + " Chapter " + next.chapter.slice(1) + ": " + next.label},
      cards,
      caseThread:caseThread(keys, next),
      evidence,
      concepts:conceptsFor(keys),
      draftNotice:draftKeys.length ? "Saved browser draft available for " + draftKeys.join(", ") + "." : "",
      changedHistoryAction:changedHistory ? "Add changed browser history" : "",
      historicalNotice:changedHistory
        ? "Historical browser data changed. Your saved work was left unchanged; this board will not import the change automatically."
        : keys.size ? "Your earlier answers are saved in this browser; run a chapter again for a fresh check today." : "No historical browser progress is saved here yet."
    };
  }

  function acceptReply(pending, reply) {
    const keys = ["case_id", "chapter", "move_id", "mode", "request_id"];
    const knownMove = pending && courseState.KNOWN_MOVES.some(move => move.chapter === pending.chapter && move.move_id === pending.move_id);
    return Boolean(pending && reply && pending.case_id === courseState.CASE_ID && pending.mode === "challenge" && knownMove && reply.type === "case_result" && keys.every(key => typeof pending[key] === "string" && pending[key] && reply[key] === pending[key]));
  }

  return {loadCourseState, legacyDestination, adapterDestination, speedLabDestination, caseThread, caseFile, dashboardModel, acceptReply};
});

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
    "C1/select-records":{chapter:"C1", move:"select-records", label:"find the B09 jars", concepts:["picking rows with a true/false rule", "table columns"]},
    "C2/group":{chapter:"C2", move:"group", label:"group the jars by tray", concepts:["grouping rows by a label"]},
    "C2/counts":{chapter:"C2", move:"counts", label:"count the jars with fleas", concepts:["one summary row per group", "naming results with = and =>"]},
    "C2/rates":{chapter:"C2", move:"rates", label:"work out each tray's share", concepts:["shares", "dividing column by column with ./"]},
    "C3/join-report-log":{chapter:"C3", move:"join-report-log", label:"line up the notebook and the tally sheet", concepts:["matching rows by a shared label"]},
    "C3/filter-disagreement":{chapter:"C3", move:"filter-disagreement", label:"find the tray that disagrees", concepts:["not-equal, row by row, with .!="]},
    "C4/plan-distinct-recheck":{chapter:"C4", move:"plan-distinct-recheck", label:"pick three jars by chance", concepts:["random picks with no repeats"]},
    "C5/event-mask":{chapter:"C5", move:"event-mask", label:"mark the rounds with 5 or more", concepts:["comparing every value with .>="]},
    "C5/event-frequency":{chapter:"C5", move:"event-frequency", label:"work out how often", concepts:["how often = matches ÷ all rounds"]},
    "C6/compatible-models":{chapter:"C6", move:"compatible-models", label:"keep the stories that fit", concepts:["a range, both ends included", "fitting is not proof"]}
  });
  const ORDERED_KEYS = Object.keys(MOVE_COPY);
  // A returning player's saved evidence carries the title an older build wrote at save time
  // (e.g. "Compatible candidate models retained", "Recording disagreement"). The Case Board must
  // show today's wording, so it looks the title up by chapter/move_id here rather than trusting
  // what was saved (adversary review item 5).
  const EVIDENCE_TITLES = Object.freeze({
    "C1/select-records":"The B09 jars, found",
    "C2/rates":"Fleas in every tray",
    "C3/filter-disagreement":"The 0 was a blank box",
    "C4/plan-distinct-recheck":"Recheck tray: planned, not looked at yet",
    "C6/compatible-models":"Which stories still fit"
  });
  function evidenceTitle(item) { return EVIDENCE_TITLES[item.chapter + "/" + item.move_id] || item.title; }

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

  // Only drafts a chapter page will really put back in its editor: Chapters 3-6 read the shared record,
  // Chapters 1 and 2 their own keys (2026-09-25: the board promised a Chapter 2 draft that never appeared).
  function restorableDrafts(storage, attempt) {
    const drafts = {};
    const shared = courseState.readChallengeDrafts(storage, attempt) || {};
    for (const [key, value] of Object.entries(shared)) if (!/^C[12]\//.test(key) && typeof value === "string" && value.trim()) drafts[key] = value;
    return Object.assign(drafts, legacyImport && typeof legacyImport.chapterDrafts === "function" ? legacyImport.chapterDrafts(storage, attempt) : {});
  }
  function courseView(progress, storage, attempt, historicalChanged) {
    return Object.assign({}, progress, {
      evidence:courseState.readEvidence(storage, attempt),
      drafts:restorableDrafts(storage, attempt),
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
  function endingDestination(attempt) {
    return "ending.html" + (courseState.attemptId(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  function chapterStatus(keys, entries, fallback) {
    const complete = entries.every(key => keys.has(key));
    const started = entries.some(key => keys.has(key));
    if (complete) return "Done. Open it to run it again.";
    if (started) return "Started. Carry on with the next step.";
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
    const question = "Toto's report says the fleas in batch B09 are vanishing, and tray T-C has 0. The notebook records fleas. Which is right?";
    let established = "Nothing checked yet. Start with Chapter 1.";
    let unknown = "What the notebook says about batch B09.";
    const complete = ORDERED_KEYS.every(key => keys.has(key));
    if (complete) {
      established = "Case closed: the fleas were never shown to be missing. The report's 0 was a blank box, and a vanishing rate almost never gives 5 of 6.";
      unknown = "What the recheck of three jars will show.";
    } else if (keys.has("C6/compatible-models")) {
      established = "The 0 for T-C was a blank box, not an empty tray. And a vanishing rate almost never gives the 5 of 6 jars we saw.";
      unknown = "What the recheck of three jars will show.";
    } else if (keys.has("C5/event-frequency")) {
      established = "The 0 was a blank box. And 5 of 6 is not suspicious: coin-flip jars give 5 or more about 1 time in 9.";
      unknown = "Whether the fleas are really vanishing.";
    } else if (keys.has("C4/plan-distinct-recheck")) {
      established = "The 0 was a blank box. A fair recheck of three jars is planned.";
      unknown = "Whether 5 of 6 jars with fleas is suspiciously high, and whether the fleas are vanishing.";
    } else if (keys.has("C3/filter-disagreement")) {
      established = "The report's 0 for tray T-C was a blank box on the tally sheet, not an empty tray.";
      unknown = "Whether a second look at the jars agrees with the notebook.";
    } else if (keys.has("C3/join-report-log")) {
      established = "Each tray's notebook count and tally-sheet box are side by side.";
      unknown = "Whether any tray disagrees.";
    } else if (keys.has("C2/rates")) {
      established = "Every B09 tray has fleas in the notebook: T-A 2, T-B 2, T-C 1.";
      unknown = "Where the report's 0 for tray T-C came from.";
    } else if (keys.has("C1/select-records")) {
      established = "The notebook shows fleas in 5 of the 6 B09 jars.";
      unknown = "What each tray shows, and where the report's 0 for T-C came from.";
    }
    const why = {
      "C1/select-records":"The report is about batch B09. Find its jars in the notebook.",
      "C2/group":"The report blames tray T-C. Put each tray's jars together.",
      "C2/counts":"Count the jars, and the jars with fleas, on each tray.",
      "C2/rates":"Work out each tray's share, so trays of any size compare fairly.",
      "C3/join-report-log":"The report was typed from the tally sheet. Line it up with the notebook.",
      "C3/filter-disagreement":"Keep the tray where the two counts disagree.",
      "C4/plan-distinct-recheck":"Plan a recheck, choosing the jars by chance.",
      "C5/event-mask":"Is 5 of 6 too good to be true? Mark Toto's rounds with 5 or more.",
      "C5/event-frequency":"Work out how often 5 or more happened.",
      "C6/compatible-models":"The report says vanishing. See which stories could give 5 of 6."
    };
    const key = next.chapter + "/" + next.move;
    const whyNext = complete
      ? "Both claims are checked. The recheck of three jars is still to come."
      : why[key] || "See what the case has shown so far, and what is still to find out.";
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
      const label = reached ? "What we know so far" : "Still to find out";
      const fact = reached ? thread.established : thread.unknown;
      return {chapter, label, fact, line: label + ": " + fact};
    });
  }
  // Chapter 5 saves the number of simulations as row_count: its answer is one true-or-false value per
  // simulation (and, for event-frequency, their frequency), not a table of records.
  function evidenceLine(item) {
    const n = item.row_count;
    const results = n + " yes-or-no result" + (n === 1 ? "" : "s") + ", one per simulation";
    const saved = item.chapter === "C5" && item.move_id === "event-mask" ? results
      : item.chapter === "C5" && item.move_id === "event-frequency" ? "from " + results
      : n + " saved row" + (n === 1 ? "" : "s");
    return evidenceTitle(item) + ": " + saved + ".";
  }
  const CHAPTER_STEPS = Object.freeze({
    C1:["C1/select-records"], C2:["C2/group", "C2/counts", "C2/rates"], C3:["C3/join-report-log", "C3/filter-disagreement"],
    C4:["C4/plan-distinct-recheck"], C5:["C5/event-mask", "C5/event-frequency"], C6:["C6/compatible-models"]
  });
  const CASE_SOLVED = "Case closed: all 6 chapters complete.";
  // "Chapter 2", "Chapters 2 and 5", "Chapters 2, 3 and 5"
  function chapterList(chapters) {
    const numbers = chapters.map(chapter => chapter.slice(1));
    if (numbers.length === 1) return "Chapter " + numbers[0];
    return "Chapters " + numbers.slice(0, -1).join(", ") + " and " + numbers[numbers.length - 1];
  }
  // A chapter solved by an earlier build may have no saved result; say so rather than a bare "Solved"
  // above an empty editor (round-3 bot, 2026-09-25).
  function solvedLabel(keys, chapter, evidenceChapters) {
    const steps = CHAPTER_STEPS[chapter], saved = steps.filter(key => keys.has(key)).length;
    if (saved === steps.length) return evidenceChapters && !evidenceChapters.has(chapter) ? "✓ Done on an earlier visit" : "✓ Solved";
    return saved ? "Not solved yet: " + saved + " of " + steps.length + " steps saved" : "Not solved yet";
  }
  // What the Case Board says about the whole case: a chapter is solved only when every step is saved.
  function completion(keys) {
    const open = Object.keys(CHAPTER_STEPS).filter(chapter => !CHAPTER_STEPS[chapter].every(key => keys.has(key)));
    const solved = 6 - open.length;
    return {solved, complete:open.length === 0, open, headline:open.length ? "" : CASE_SOLVED,
      line:open.length ? solved + " of 6 chapters solved. Still open: " + chapterList(open) + "." : "Every step of all six chapters is saved on this computer."};
  }
  function dashboardModel(state) {
    const keys = acceptedKeys(state);
    const fallback = nextMove(keys);
    const resumed = moveFromCursor(state && state.cursor, fallback);
    const next = resumed || fallback;
    const cards = [
      {chapter:"C1", title:"1 · The report and the notebook", playable:true, href:"C1", status:chapterStatus(keys, ["C1/select-records"], "Ready: find the B09 jars")},
      {chapter:"C2", title:"2 · Count by tray", playable:true, href:"C2", status:chapterStatus(keys, ["C2/group", "C2/counts", "C2/rates"], "Ready: count the fleas in each tray")},
      {chapter:"C3", title:"3 · Where did the 0 come from?", playable:true, href:"C3", status:chapterStatus(keys, ["C3/join-report-log", "C3/filter-disagreement"], "Ready: line up the notebook and the tally sheet")},
      {chapter:"C4", title:"4 · Plan a fair recheck", playable:true, href:"C4", status:chapterStatus(keys, ["C4/plan-distinct-recheck"], "Ready: pick three jars to look at again")},
      {chapter:"C5", title:"5 · Too good to be true?", playable:true, href:"C5", status:chapterStatus(keys, ["C5/event-mask", "C5/event-frequency"], "Ready: play Toto's card game")},
      {chapter:"C6", title:"6 · Are the fleas vanishing?", playable:true, href:"C6", status:chapterStatus(keys, ["C6/compatible-models"], "Ready: test three stories about the fleas")}
    ];
    const evidenceChapters = new Set(Array.isArray(state && state.evidence) ? state.evidence.map(item => item.chapter) : []);
    for (const card of cards) card.solvedLabel = solvedLabel(keys, card.chapter, evidenceChapters);
    const evidence = Array.isArray(state && state.evidence) ? state.evidence.map(item => ({title:evidenceTitle(item), chapter:item.chapter, move_id:item.move_id, row_count:item.row_count, provenance:item.provenance, line:evidenceLine(item)})) : [];
    // A chapter solved by an earlier build may have no saved result table; say so rather than skip it (2026-09-25).
    for (const chapter of Object.keys(CHAPTER_STEPS)) {
      const solved = CHAPTER_STEPS[chapter].every(key => keys.has(key));
      if (solved && !evidence.some(item => item.chapter === chapter)) {
        const number = chapter.slice(1);
        evidence.push({title:"", chapter, move_id:"", row_count:0, provenance:"no-table", line:"Chapter " + number + ": solved on this computer, but its result table was not saved here. Run Chapter " + number + " again to see its evidence."});
      }
    }
    const draftKeys = state && state.drafts && typeof state.drafts === "object" ? ORDERED_KEYS.filter(key => Object.prototype.hasOwnProperty.call(state.drafts, key) && !keys.has(key)) : [];
    const draftNames = draftKeys.map(key => "Chapter " + MOVE_COPY[key].chapter.slice(1) + ": " + MOVE_COPY[key].label);
    const complete = ORDERED_KEYS.every(key => keys.has(key));
    const changedHistory = Boolean(state && Array.isArray(state.historicalChanged) && state.historicalChanged.length);
    return {
      continue:{chapter:next.chapter, move:next.move, label:(complete ? "Review" : resumed || keys.size > 0 ? "Continue" : "Start") + " Chapter " + next.chapter.slice(1) + ": " + next.label},
      cards,
      completion:completion(keys),
      caseThread:caseThread(keys, next),
      evidence,
      concepts:conceptsFor(keys),
      evidenceEmpty:keys.size ? "Your solved steps are saved, but this computer has no saved result tables for them. Run a chapter again to see its evidence here." : "No findings saved on this computer yet.",
      draftNotice:draftNames.length ? "Saved draft" + (draftNames.length === 1 ? "" : "s") + " available for " + draftNames.join("; ") + "." : "",
      changedHistoryAction:changedHistory ? "Use the changed save" : "",
      historicalNotice:changedHistory
        ? "Earlier saved data on this computer changed. Your saved work was left unchanged; this board will not import the change automatically."
        : keys.size ? "Your earlier answers are saved on this computer; run a chapter again for a fresh check today." : "Nothing saved on this computer yet."
    };
  }

  function acceptReply(pending, reply) {
    const keys = ["case_id", "chapter", "move_id", "mode", "request_id"];
    const knownMove = pending && courseState.KNOWN_MOVES.some(move => move.chapter === pending.chapter && move.move_id === pending.move_id);
    return Boolean(pending && reply && pending.case_id === courseState.CASE_ID && pending.mode === "challenge" && knownMove && reply.type === "case_result" && keys.every(key => typeof pending[key] === "string" && pending[key] && reply[key] === pending[key]));
  }

  return {CHAPTER_STEPS, CASE_SOLVED, chapterList, loadCourseState, legacyDestination, adapterDestination, speedLabDestination, endingDestination, caseThread, caseFile, dashboardModel, acceptReply};
});

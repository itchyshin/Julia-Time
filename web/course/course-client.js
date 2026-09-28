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
    "C1/select-records":{chapter:"C1", move:"select-records", label:"find the B09 jars", concepts:["picking rows with a true-or-false rule", "table columns"]},
    "C2/group":{chapter:"C2", move:"group", label:"group the jars by tray", concepts:["grouping rows by a label"]},
    "C2/counts":{chapter:"C2", move:"counts", label:"count the jars with springtails", concepts:["one summary row per group", "naming results with = and =>"]},
    "C2/rates":{chapter:"C2", move:"rates", label:"work out each tray's share", concepts:["shares", "dividing column by column with ./"]},
    "C3/join-report-log":{chapter:"C3", move:"join-report-log", label:"line up the notebook and Toto's typed table", concepts:["matching rows by a shared label"]},
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
    "C1/select-records":"The six B09 jars, found in the notebook",
    "C2/group":"Every B09 jar sorted by tray",
    "C2/counts":"Each tray's jars counted, and the jars with springtails",
    "C2/rates":"Springtails in every tray",
    "C3/join-report-log":"Notebook and Toto's typed table lined up",
    "C3/filter-disagreement":"The 0 was a blank box",
    "C4/plan-distinct-recheck":"Recheck jars: planned, not looked at yet",
    // S5 (2026-09-27 adversary review): a v0.2.3 save had these titled "Simulation event named" and
    // "Simulation event frequency calculated" (both banned insider phrases); C5 renamed them to
    // "Marked the rounds" and "Worked out how often" (web/chapter5.js persistAccepted), but this map
    // was never given the new keys, so a returning player still saw the old titles on the Case Board.
    "C5/event-mask":"Marked the rounds",
    "C5/event-frequency":"Worked out how often",
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
  // An idea that names a Julia operator is listed only when the step's saved accepted code uses it, so the
  // Case Board and the ending's "Ideas you used" agree with the code they show (r7-r-struggling #1). A
  // save from before accepted code was kept lists every idea, as before.
  const CONCEPT_OPERATOR = Object.freeze({"dividing column by column with ./":/\.\//, "not-equal, row by row, with .!=":/\.!=/, "comparing every value with .>=":/\.>=/});
  function codeUses(code, concept) {
    const pattern = CONCEPT_OPERATOR[concept];
    return !pattern || typeof code !== "string" || !code.trim() || pattern.test(code.replace(/#.*$/gm, ""));
  }
  function conceptsFor(keys, accepted) {
    const concepts = [], saved = accepted && typeof accepted === "object" ? accepted : {};
    for (const key of ORDERED_KEYS) if (keys.has(key)) {
      const code = saved[key] && typeof saved[key] === "object" ? saved[key].code : undefined;
      for (const concept of MOVE_COPY[key].concepts) if (codeUses(code, concept) && !concepts.includes(concept)) concepts.push(concept);
    }
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
    const question = "Toto's report says the springtails are dying out. Are they?";
    let established = "Nothing checked yet. Start with Chapter 1.";
    let unknown = "What the notebook says about batch B09.";
    const complete = ORDERED_KEYS.every(key => keys.has(key));
    if (complete) {
      established = "Case closed: the springtails were never shown to be dying out. The report's 0 was a blank box, and a dying-out rate almost never gives 5 of 6.";
      unknown = "What the recheck of three jars will show.";
    } else if (keys.has("C6/compatible-models")) {
      established = "The 0 for T-C was a blank box, not an empty tray. And a dying-out rate almost never gives the 5 of 6 jars we saw.";
      unknown = "What the recheck of three jars will show.";
    } else if (keys.has("C5/event-frequency")) {
      established = "The 0 was a blank box. And 5 of 6 is not unusual: under a plain 50:50 guess, 5 or more of 6 happens about 1 time in 9.";
      unknown = "Whether the springtails are really dying out.";
    } else if (keys.has("C4/plan-distinct-recheck")) {
      established = "The 0 was a blank box. A fair recheck of three jars is planned.";
      unknown = "What plain chance would give, and whether the springtails are dying out.";
    } else if (keys.has("C3/filter-disagreement")) {
      established = "T-C has springtails after all: the report's 0 was a blank box on the tally sheet, not an empty tray.";
      unknown = "Whether the notebook itself is right.";
    } else if (keys.has("C3/join-report-log")) {
      established = "Each tray's notebook count and Toto's typed count are side by side.";
      unknown = "Whether any tray disagrees.";
    } else if (keys.has("C2/rates")) {
      established = "Every B09 tray has springtails in the notebook: T-A 2 of 2 jars, T-B 2 of 2 jars, T-C 1 of 2 jars.";
      unknown = "Where the report's 0 for tray T-C came from.";
    } else if (keys.has("C1/select-records")) {
      established = "The notebook shows springtails in 5 of the 6 B09 jars.";
      unknown = "What each tray shows, and where the report's 0 for T-C came from.";
    }
    const why = {
      "C1/select-records":"The report is about batch B09. Find its jars in the notebook.",
      "C2/group":"The report says T-C has 0 jars with springtails. Put each tray's jars together.",
      "C2/counts":"Count the jars, and the jars with springtails, on each tray.",
      "C2/rates":"Write each tray as a share. The report's 0 really means 0 of 2 jars.",
      "C3/join-report-log":"Toto typed his report from his typed table. Line that table up with the notebook.",
      "C3/filter-disagreement":"Keep the tray where the two counts disagree.",
      "C4/plan-distinct-recheck":"Plan a recheck, choosing the jars by chance.",
      "C5/event-mask":"What would plain chance give? Mark Toto's rounds with 5 or more.",
      "C5/event-frequency":"Work out how often 5 or more happened.",
      "C6/compatible-models":"The report says dying out. See which stories could give 5 of 6."
    };
    const key = next.chapter + "/" + next.move;
    const whyNext = complete
      ? "All three parts are done. The recheck of three jars is still to come."
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
  // The three jar IDs chance picked in Chapter 4, when its saved result kept them (web/chapter4.js
  // jar_ids); otherwise null, and the board says only that a recheck is planned.
  function drawnJars(item) {
    const ids = item && Array.isArray(item.jar_ids) ? item.jar_ids : null;
    return ids && ids.length === 3 && ids.every(id => typeof id === "string" && /^J-\d{3}$/.test(id)) && new Set(ids).size === 3 ? ids.slice() : null;
  }
  // A plain finding per saved step (r2 story review C3, 2026-09-27): no "saved rows" or result counts.
  // Chapter 5 saves the number of rounds as row_count: its answer is one true-or-false value per round.
  function evidenceLine(item) {
    const key = item.chapter + "/" + item.move_id;
    const n = typeof item.row_count === "number" ? item.row_count.toLocaleString("en-US") : item.row_count;  // "1,000", as on every other screen
    if (key === "C5/event-mask") return evidenceTitle(item) + ": which of Toto's " + n + " rounds gave 5 or more.";
    if (key === "C5/event-frequency") return evidenceTitle(item) + ": from Toto's " + n + " rounds.";
    const jars = key === "C4/plan-distinct-recheck" ? drawnJars(item) : null;
    return evidenceTitle(item) + (jars ? ": " + jars.slice(0, -1).join(", ") + " and " + jars[2] : "") + ".";
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
      {chapter:"C1", part:"Part 1 · Check the report", title:"1 · The report and the notebook", playable:true, href:"C1", status:chapterStatus(keys, ["C1/select-records"], "Ready: find the B09 jars")},
      {chapter:"C2", part:"Part 1 · Check the report", title:"2 · Count by tray", playable:true, href:"C2", status:chapterStatus(keys, ["C2/group", "C2/counts", "C2/rates"], "Ready: count the jars with springtails on each tray")},
      {chapter:"C3", part:"Part 1 · Check the report", title:"3 · Where did the 0 come from?", playable:true, href:"C3", status:chapterStatus(keys, ["C3/join-report-log", "C3/filter-disagreement"], "Ready: line up the notebook and Toto's typed table")},
      {chapter:"C4", part:"Part 2 · Check the notebook", title:"4 · Plan a fair recheck", playable:true, href:"C4", status:chapterStatus(keys, ["C4/plan-distinct-recheck"], "Ready: pick three jars to look at again")},
      {chapter:"C5", part:"Part 2 · Check the notebook", title:"5 · What would plain chance give?", playable:true, href:"C5", status:chapterStatus(keys, ["C5/event-mask", "C5/event-frequency"], "Ready: play Toto's card game")},
      {chapter:"C6", part:"Part 3 · Test the claim", title:"6 · Are the springtails dying out?", playable:true, href:"C6", status:chapterStatus(keys, ["C6/compatible-models"], "Ready: test three stories about the springtails")}
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
    // A brand-new player (never resumed, nothing saved yet) sees the intro movie first.
    const startWithIntro = !(resumed || keys.size > 0);
    return {
      continue:{chapter:next.chapter, move:next.move, label:(complete ? "Review" : resumed || keys.size > 0 ? "Continue" : "Start") + " Chapter " + next.chapter.slice(1) + ": " + next.label},
      startWithIntro,
      cards,
      completion:completion(keys),
      caseThread:caseThread(keys, next),
      evidence,
      concepts:conceptsFor(keys, state && state.accepted),
      evidenceEmpty:keys.size ? "Your solved steps are saved, but this computer has no saved result tables for them. Run a chapter again to see its evidence here." : "No findings saved on this computer yet.",
      draftNotice:draftNames.length ? "Saved draft" + (draftNames.length === 1 ? "" : "s") + " available for " + draftNames.join("; ") + "." : "",
      changedHistoryAction:changedHistory ? "Use the changed save" : "",
      historicalNotice:changedHistory
        ? "Some older saved data on this computer has changed. Your current work was not touched, and this board will not import the change automatically."
        : keys.size ? "Your saved work is on this computer. Open any chapter to run it again." : "Nothing saved on this computer yet."
    };
  }

  function acceptReply(pending, reply) {
    const keys = ["case_id", "chapter", "move_id", "mode", "request_id"];
    const knownMove = pending && courseState.KNOWN_MOVES.some(move => move.chapter === pending.chapter && move.move_id === pending.move_id);
    return Boolean(pending && reply && pending.case_id === courseState.CASE_ID && pending.mode === "challenge" && knownMove && reply.type === "case_result" && keys.every(key => typeof pending[key] === "string" && pending[key] && reply[key] === pending[key]));
  }

  return {CHAPTER_STEPS, drawnJars, CASE_SOLVED, chapterList, loadCourseState, legacyDestination, adapterDestination, speedLabDestination, endingDestination, caseThread, caseFile, dashboardModel, acceptReply};
});

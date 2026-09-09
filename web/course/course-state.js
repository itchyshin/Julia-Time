/* Additive, browser-local Missing Fleas course state. No network or DOM access. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeCourseState = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const CASE_ID = "missing-fleas-v1";
  const BASE_PREFIX = "julia-time:missing-fleas:course:v1:";
  const ATTEMPT_PATTERN = /^[a-z0-9-]{1,80}$/;
  const ACTIVITY_PATTERN = /^[a-z0-9-]{1,80}$/;
  const KNOWN_MOVES = Object.freeze([
    {key:"C1/select-records", chapter:"C1", move_id:"select-records"},
    {key:"C2/group", chapter:"C2", move_id:"group"},
    {key:"C2/counts", chapter:"C2", move_id:"counts"},
    {key:"C2/rates", chapter:"C2", move_id:"rates"},
    {key:"C3/join-report-log", chapter:"C3", move_id:"join-report-log"},
    {key:"C3/filter-disagreement", chapter:"C3", move_id:"filter-disagreement"},
    {key:"C4/plan-distinct-recheck", chapter:"C4", move_id:"plan-distinct-recheck"},
    {key:"C5/event-mask", chapter:"C5", move_id:"event-mask"},
    {key:"C5/event-frequency", chapter:"C5", move_id:"event-frequency"},
    {key:"C6/compatible-models", chapter:"C6", move_id:"compatible-models"}
  ]);
  const MOVE_BY_KEY = Object.freeze(Object.fromEntries(KNOWN_MOVES.map(move => [move.key, move])));

  function attemptId(value) { return typeof value === "string" && ATTEMPT_PATTERN.test(value); }
  function coursePrefix(attempt) { return attemptId(attempt) ? BASE_PREFIX + "attempt:" + attempt + ":" : BASE_PREFIX; }
  function courseKey(attempt) { return coursePrefix(attempt) + "progress-v1"; }
  function cursorKey(attempt) { return coursePrefix(attempt) + "cursor-v1"; }
  function notesKey(attempt) { return coursePrefix(attempt) + "notes-v1"; }
  function importKey(attempt) { return coursePrefix(attempt) + "import-v1"; }
  function plainRecord(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
  function moveFor(chapter, moveId) { return KNOWN_MOVES.find(move => move.chapter === chapter && move.move_id === moveId) || null; }
  function evidenceKey(attempt, chapter, moveId) { const move = moveFor(chapter, moveId); return move ? coursePrefix(attempt) + "evidence:" + move.chapter + ":" + move.move_id : null; }
  function draftKey(attempt, chapter, moveId, mode, activityId) {
    const move = moveFor(chapter, moveId);
    if (!move || !["challenge", "demonstration", "extension"].includes(mode)) return null;
    if (mode === "challenge") return activityId === undefined || activityId === null || activityId === "" ? coursePrefix(attempt) + "draft:" + move.chapter + ":" + move.move_id + ":challenge" : null;
    return typeof activityId === "string" && ACTIVITY_PATTERN.test(activityId) ? coursePrefix(attempt) + "draft:" + move.chapter + ":" + move.move_id + ":" + mode + ":" + activityId : null;
  }
  function emptyCourseState() { return {schema_version:1, case_id:CASE_ID, accepted:{}}; }
  function emptyImportRecord() { return {schema_version:1, sources:{}}; }

  function jsonCopy(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; }
  }

  function moveSnapshot(entry) {
    if (!plainRecord(entry) || !MOVE_BY_KEY[entry.key] || entry.provenance !== "historical-browser") return null;
    const move = MOVE_BY_KEY[entry.key];
    return {case_id:CASE_ID, chapter:move.chapter, move_id:move.move_id, provenance:"historical-browser"};
  }

  function snapshotFor(key, value) {
    const move = MOVE_BY_KEY[key];
    if (!move || !plainRecord(value) || value.case_id !== CASE_ID || value.chapter !== move.chapter || value.move_id !== move.move_id || value.provenance !== "historical-browser") return null;
    const snapshot = jsonCopy(value);
    if (!plainRecord(snapshot)) return null;
    delete snapshot.fresh;
    delete snapshot.fresh_live;
    delete snapshot.current_verification;
    snapshot.case_id = CASE_ID;
    snapshot.chapter = move.chapter;
    snapshot.move_id = move.move_id;
    snapshot.provenance = "historical-browser";
    return snapshot;
  }

  function makeCourseState(input) {
    const candidate = plainRecord(input) ? input : {};
    const accepted = {};
    if (Array.isArray(candidate.moves)) {
      for (const entry of candidate.moves) {
        const snapshot = moveSnapshot(entry);
        if (snapshot) accepted[entry.key] = snapshot;
      }
    } else if (plainRecord(candidate.accepted)) {
      for (const [key, value] of Object.entries(candidate.accepted)) {
        const snapshot = snapshotFor(key, value);
        if (snapshot) accepted[key] = snapshot;
      }
    }
    return {schema_version:1, case_id:CASE_ID, accepted};
  }

  function parseCourseState(raw) {
    if (!plainRecord(raw) || raw.schema_version !== 1 || raw.case_id !== CASE_ID || !plainRecord(raw.accepted)) return null;
    if (Object.keys(raw).some(key => !["schema_version", "case_id", "accepted"].includes(key))) return null;
    const state = makeCourseState(raw);
    return Object.keys(state.accepted).length === Object.keys(raw.accepted).length ? state : null;
  }

  function rawValue(storage, key) {
    try { return storage && typeof storage.getItem === "function" && key ? storage.getItem(key) : null; } catch (_) { return null; }
  }
  function writeRaw(storage, key, value) { try { storage.setItem(key, value); return true; } catch (_) { return false; } }
  function readJson(storage, key) { const raw = rawValue(storage, key); if (raw === null) return null; try { return JSON.parse(raw); } catch (_) { return null; } }

  function courseStateStatus(storage, attempt) {
    const raw = rawValue(storage, courseKey(attempt));
    if (raw === null) return "missing";
    try { return parseCourseState(JSON.parse(raw)) ? "valid" : "malformed"; } catch (_) { return "malformed"; }
  }
  function readCourseState(storage, attempt) { return parseCourseState(readJson(storage, courseKey(attempt))) || emptyCourseState(); }
  function writeInitialCourseState(storage, attempt, state) {
    if (courseStateStatus(storage, attempt) !== "missing") return false;
    const valid = parseCourseState(makeCourseState(state));
    return Boolean(valid && writeRaw(storage, courseKey(attempt), JSON.stringify(valid)));
  }
  function writeCourseState(storage, attempt, state) {
    const valid = parseCourseState(makeCourseState(state));
    return Boolean(valid && writeRaw(storage, courseKey(attempt), JSON.stringify(valid)));
  }
  function recordHistoricalMoveIfMissing(storage, attempt, chapter, moveId) {
    const move = moveFor(chapter, moveId);
    const status = courseStateStatus(storage, attempt);
    if (!move || status === "malformed") return false;
    const current = status === "valid" ? readCourseState(storage, attempt) : emptyCourseState();
    if (Object.prototype.hasOwnProperty.call(current.accepted, move.key)) return false;
    const accepted = Object.assign({}, current.accepted, {
      [move.key]:{case_id:CASE_ID, chapter:move.chapter, move_id:move.move_id, provenance:"historical-browser"}
    });
    const next = makeCourseState({accepted});
    return status === "missing" ? writeInitialCourseState(storage, attempt, next) : writeCourseState(storage, attempt, next);
  }
  function acceptedMoves(state) {
    const accepted = state && plainRecord(state.accepted) ? state.accepted : {};
    return KNOWN_MOVES.filter(move => snapshotFor(move.key, accepted[move.key])).map(move => ({key:move.key, provenance:"historical-browser"}));
  }
  function hasCourseContent(state) { return acceptedMoves(state).length > 0; }
  function mergeHistoricalImport(existing, imported) {
    const base = parseCourseState(existing) || emptyCourseState();
    const incoming = makeCourseState(imported);
    const accepted = Object.assign({}, base.accepted);
    let changed = false;
    for (const move of KNOWN_MOVES) {
      if (!Object.prototype.hasOwnProperty.call(accepted, move.key) && Object.prototype.hasOwnProperty.call(incoming.accepted, move.key)) {
        accepted[move.key] = incoming.accepted[move.key];
        changed = true;
      }
    }
    return {state:makeCourseState({accepted}), changed};
  }

  function evidenceItem(value) {
    if (!plainRecord(value) || !moveFor(value.chapter, value.move_id) || value.provenance !== "historical-browser" || typeof value.title !== "string" || !value.title || value.title.length > 160 || !Number.isInteger(value.row_count) || value.row_count < 1 || value.row_count > 10000) return null;
    const evidence = jsonCopy(value);
    if (!plainRecord(evidence)) return null;
    evidence.provenance = "historical-browser";
    return evidence;
  }
  function readEvidence(storage, attempt) {
    const result = [];
    for (const move of KNOWN_MOVES) {
      const item = evidenceItem(readJson(storage, evidenceKey(attempt, move.chapter, move.move_id)));
      if (item) result.push(item);
    }
    return result;
  }
  function writeEvidenceIfMissing(storage, attempt, value) {
    const evidence = evidenceItem(value);
    const key = evidence && evidenceKey(attempt, evidence.chapter, evidence.move_id);
    if (!key || rawValue(storage, key) !== null) return false;
    return writeRaw(storage, key, JSON.stringify(evidence));
  }

  function copyNotes(value) {
    if (!plainRecord(value)) return null;
    const notes = {};
    for (const [key, item] of Object.entries(value)) {
      if (!key || key.length > 160 || typeof item !== "string" || item.length > 20000) return null;
      notes[key] = item;
    }
    return notes;
  }
  function readNotes(storage, attempt) { return copyNotes(readJson(storage, notesKey(attempt))) || {}; }
  function writeNotes(storage, attempt, notes) { const copy = copyNotes(notes); return Boolean(copy && writeRaw(storage, notesKey(attempt), JSON.stringify(copy))); }

  function readChallengeDrafts(storage, attempt) {
    const drafts = {};
    for (const move of KNOWN_MOVES) {
      const raw = readDraft(storage, attempt, move.chapter, move.move_id, "challenge");
      if (raw) drafts[move.key] = raw;
    }
    return drafts;
  }
  function readDraft(storage, attempt, chapter, moveId, mode, activityId) {
    const key = draftKey(attempt, chapter, moveId, mode, activityId);
    const raw = rawValue(storage, key);
    return typeof raw === "string" ? raw : "";
  }
  function writeDraft(storage, attempt, chapter, moveId, mode, activityId, code) {
    const key = draftKey(attempt, chapter, moveId, mode, activityId);
    return Boolean(key && typeof code === "string" && code.length <= 20000 && writeRaw(storage, key, code));
  }
  function writeChallengeDraft(storage, attempt, chapter, moveId, code) {
    return writeDraft(storage, attempt, chapter, moveId, "challenge", null, code);
  }

  function cursorValue(value) {
    if (!plainRecord(value) || !moveFor(value.chapter, value.move_id) || !["challenge", "demonstration", "extension"].includes(value.mode)) return null;
    if (value.mode === "challenge" && value.activity_id !== undefined && value.activity_id !== null) return null;
    if (value.mode !== "challenge" && !ACTIVITY_PATTERN.test(value.activity_id || "")) return null;
    const cursor = {chapter:value.chapter, move_id:value.move_id, mode:value.mode};
    if (value.mode !== "challenge") cursor.activity_id = value.activity_id;
    return cursor;
  }
  function readCursor(storage, attempt) { return cursorValue(readJson(storage, cursorKey(attempt))); }
  function writeCursor(storage, attempt, cursor) { const copy = cursorValue(cursor); return Boolean(copy && writeRaw(storage, cursorKey(attempt), JSON.stringify(copy))); }

  function importRecord(value) {
    if (!plainRecord(value) || value.schema_version !== 1 || !plainRecord(value.sources)) return null;
    const sources = {};
    for (const [sourceKey, item] of Object.entries(value.sources)) {
      if (!sourceKey || sourceKey.length > 500 || !plainRecord(item) || typeof item.fingerprint !== "string" || !/^fnv1a32-[0-9a-f]{8}-\d+$/.test(item.fingerprint) || !Array.isArray(item.destinations) || !item.destinations.every(key => MOVE_BY_KEY[key])) return null;
      sources[sourceKey] = {fingerprint:item.fingerprint, destinations:[...item.destinations]};
    }
    return {schema_version:1, sources};
  }
  function readImportRecord(storage, attempt) { return importRecord(readJson(storage, importKey(attempt))) || emptyImportRecord(); }
  function writeImportRecord(storage, attempt, record) { const copy = importRecord(record); return Boolean(copy && writeRaw(storage, importKey(attempt), JSON.stringify(copy))); }

  return {CASE_ID, BASE_PREFIX, KNOWN_MOVES, attemptId, coursePrefix, courseKey, cursorKey, notesKey, importKey, evidenceKey, draftKey, emptyCourseState, emptyImportRecord, makeCourseState, courseStateStatus, readCourseState, writeInitialCourseState, writeCourseState, recordHistoricalMoveIfMissing, acceptedMoves, hasCourseContent, mergeHistoricalImport, readEvidence, writeEvidenceIfMissing, readNotes, writeNotes, readDraft, writeDraft, readChallengeDrafts, writeChallengeDraft, readCursor, writeCursor, readImportRecord, writeImportRecord};
});

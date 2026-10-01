/* Julia Time: save a chapter exam pass (web/lesson.html, kind "exam") exactly as the Original chapter page saves the
   same move, so the Board ("Case ✓") and the ending count it. It only calls web/course/course-state.js; it writes the
   same move, evidence, draft and cursor keys the chapter pages write (web/mystery.js, web/chapter2.js ... chapter6.js).
   No network, no DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeLessonExamSave = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Per move: the evidence title the chapter page writes, and where its page sends the player next (its cursor).
  const MOVES = Object.freeze({
    "C1/select-records": {title: "The B09 jars, found", next: {chapter: "C2", move_id: "group"}},
    "C2/group": {title: "Tray records grouped", next: {chapter: "C2", move_id: "counts"}},
    "C2/counts": {title: "Tray record and detection counts", next: {chapter: "C2", move_id: "rates"}},
    "C2/rates": {title: "Tray detection rates compared", next: {chapter: "C3", move_id: "join-report-log"}},
    "C3/join-report-log": {title: "Notebook and Toto’s typed copy lined up", next: {chapter: "C3", move_id: "filter-disagreement"}},
    "C3/filter-disagreement": {title: "The 0 was a blank box", next: {chapter: "C3", move_id: "filter-disagreement"}},
    "C4/plan-distinct-recheck": {title: "Three distinct rechecks planned", next: {chapter: "C5", move_id: "event-mask"}},
    "C5/event-mask": {title: "Marked the rounds", next: {chapter: "C5", move_id: "event-frequency"}},
    "C5/event-frequency": {title: "Worked out how often", next: {chapter: "C5", move_id: "event-frequency"}},
    "C6/compatible-models": {title: "Kept the stories that fit", next: {chapter: "C6", move_id: "compatible-models"}}
  });
  // Chapters 1 and 2 keep their editor drafts under older names (web/course/legacy-import.js c1CodeKey, c2DraftKey);
  // course-state.js reads the accepted code from there. test/exam-ending.test.cjs pins these against legacy-import.js.
  const ATTEMPT_PATTERN = /^[a-z0-9-]{1,80}$/;
  const C1_BASE = "julia-time:missing-fleas:v1:";
  const C2_BASE = "julia-time:missing-fleas:v1:c2:";
  function legacyPrefix(base, attempt) { return ATTEMPT_PATTERN.test(attempt || "") ? base + "attempt:" + attempt + ":" : base; }
  function draftKey(attempt, chapter, moveId) {
    if (chapter === "C1") return legacyPrefix(C1_BASE, attempt) + "code";
    if (chapter === "C2") return legacyPrefix(C2_BASE, attempt) + "draft:" + moveId;
    return null;
  }

  // Keep the accepted code where the chapter page keeps its draft, so the saved move carries it (course-state.js).
  function writeDraft(courseState, storage, attempt, chapter, moveId, code) {
    if (typeof code !== "string" || !code.trim() || code.length > 20000) return;
    const legacy = draftKey(attempt, chapter, moveId);
    try {
      if (legacy) storage.setItem(legacy, code);
      else courseState.writeChallengeDraft(storage, attempt, chapter, moveId, code);
    } catch (_) { /* the move still saves; only its code copy is lost */ }
  }

  /* record: the `exam` object of a passing lesson_result ({chapter, move_id, row_count, jar_ids?}); code: the code
     that passed. Returns true only when the saved record really holds the move afterwards. */
  function saveExamPass(courseState, storage, attempt, record, code) {
    if (!courseState || !storage || !record || typeof record !== "object") return false;
    const chapter = record.chapter, moveId = record.move_id, move = MOVES[chapter + "/" + moveId];
    if (!move) return false;
    const rowCount = Number.isInteger(record.row_count) && record.row_count >= 1 ? Math.min(record.row_count, 10000) : 1;
    try {
      writeDraft(courseState, storage, attempt, chapter, moveId, code);
      courseState.recordHistoricalMoveIfMissing(storage, attempt, chapter, moveId);
      courseState.refreshAcceptedCode(storage, attempt, chapter, moveId);
      const evidence = {chapter, move_id: moveId, title: move.title, row_count: rowCount, provenance: "historical-browser"};
      const jarIds = Array.isArray(record.jar_ids) && record.jar_ids.length ? record.jar_ids.map(String) : null;
      if (jarIds) evidence.jar_ids = jarIds;
      courseState.writeEvidenceIfMissing(storage, attempt, evidence);
      // Chapter 4 draws new jars on every accepted run; the latest draw is the one the Board and the ending name.
      if (jarIds) courseState.updateEvidenceJarIds(storage, attempt, chapter, moveId, jarIds);
      courseState.writeCursor(storage, attempt, {chapter: move.next.chapter, move_id: move.next.move_id, mode: "challenge"});
      return courseState.hasSavedMove(storage, attempt, chapter, moveId) === true;
    } catch (_) { return false; }
  }

  return {MOVES, draftKey, saveExamPass};
});

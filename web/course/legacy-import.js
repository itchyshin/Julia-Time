/* Read-only adapter for C1 and C2 browser saves. */
(function (root, factory) {
  const state = typeof module === "object" && module.exports ? require("./course-state.js") : root && root.JuliaTimeCourseState;
  const api = factory(state);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeLegacyImport = api;
})(typeof window !== "undefined" ? window : null, function (courseState) {
  "use strict";

  const ATTEMPT_PATTERN = /^[a-z0-9-]{1,80}$/;
  const C1_BASE = "julia-time:missing-fleas:v1:";
  const C2_BASE = "julia-time:missing-fleas:v1:c2:";
  const C2_STEPS = ["group", "counts", "rates"];
  const C2_MOVES = {group:"C2/group", counts:"C2/counts", rates:"C2/rates"};

  function attemptId(value) { return typeof value === "string" && ATTEMPT_PATTERN.test(value); }
  function prefix(base, attempt) { return attemptId(attempt) ? base + "attempt:" + attempt + ":" : base; }
  function c1EvidenceKey(attempt) { return prefix(C1_BASE, attempt) + "evidence"; }
  function c2ProgressKey(attempt) { return prefix(C2_BASE, attempt) + "progress-v2"; }
  function plainRecord(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
  function readEntry(storage, key) {
    try {
      const raw = storage && storage.getItem(key);
      return raw === null || raw === undefined ? null : {raw:String(raw), value:JSON.parse(raw)};
    } catch (_) { return null; }
  }
  function fingerprint(raw) {
    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += 1) { hash ^= raw.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return "fnv1a32-" + (hash >>> 0).toString(16).padStart(8, "0") + "-" + raw.length;
  }

  function validC1Evidence(value) {
    return Boolean(plainRecord(value) && plainRecord(value.evidence) && Array.isArray(value.rows) && value.rows.length > 0 &&
      value.rows.every(row => plainRecord(row)) && (value.explanation === null || value.explanation === undefined || plainRecord(value.explanation)));
  }

  function validC2Progress(value) {
    return Boolean(plainRecord(value) && C2_STEPS.includes(value.step) && plainRecord(value.accepted));
  }

  function evidenceTitle(value) {
    const title = typeof value.evidence.title === "string" && value.evidence.title.trim() ? value.evidence.title.trim() : "Saved B09 records";
    return title.slice(0, 160);
  }

  function importLegacy(storage, attempt) {
    const moves = [];
    const evidence = [];
    const sources = [];
    const c1Key = c1EvidenceKey(attempt);
    const c1Entry = readEntry(storage, c1Key);
    const c1 = c1Entry && c1Entry.value;
    if (validC1Evidence(c1)) {
      moves.push({key:"C1/select-records", provenance:"historical-browser"});
      evidence.push({chapter:"C1", move_id:"select-records", title:evidenceTitle(c1), row_count:c1.rows.length, provenance:"historical-browser"});
      sources.push({source_key:c1Key, fingerprint:fingerprint(c1Entry.raw), destinations:["C1/select-records"]});
    }
    const c2Key = c2ProgressKey(attempt);
    const c2Entry = readEntry(storage, c2Key);
    const c2 = c2Entry && c2Entry.value;
    if (validC2Progress(c2)) {
      const destinations = [];
      for (const step of C2_STEPS) {
        if (typeof c2.accepted[step] === "string" && c2.accepted[step].trim()) { moves.push({key:C2_MOVES[step], provenance:"historical-browser"}); destinations.push(C2_MOVES[step]); }
      }
      if (destinations.length) sources.push({source_key:c2Key, fingerprint:fingerprint(c2Entry.raw), destinations});
    }
    return {moves, evidence, sources};
  }

  return {c1EvidenceKey, c2ProgressKey, validC1Evidence, validC2Progress, importLegacy, fingerprint, courseStateAvailable:Boolean(courseState)};
});

"use strict";

// Repair round 2, slice C56: the simulated-student placeholder stumble (B9) in Chapters 5 and 6.
// P21 and P43 ran the C5 code shape as written and got "UndefVarError: `counts` not defined":
// counts and threshold (C5) and table, lower_bound, target and upper_bound (C6) are placeholder
// names that do not exist in the case. Like the C3 round-1 fix, a short note under the code-shape
// hint names the placeholders and maps them to the case names. The note lives in the hint list
// only: the editor still starts empty and the reference answer stays behind its answer step.
const test = require("node:test");
const assert = require("node:assert/strict");
const c5 = require("../web/chapter5.js");
const c6 = require("../web/chapter6.js");

const EM_DASH = /—/;

test("B9: C5 code-shape hints name counts and threshold as placeholders and map them to the case names", () => {
  for (const move of c5.MOVES) {
    const copy = c5.COPY[move];
    const shape = c5.helpStage(move, 1);
    assert.equal(shape.label, "Code shape", `${move}: stage 1 is the code shape`);
    assert.equal(shape.text, copy.shape, `${move}: the code line itself stays a generic shape`);
    assert.ok(shape.note, `${move}: the code shape carries a placeholder note`);
    assert.match(shape.note, /counts and threshold are placeholders, not names in this case/);
    assert.match(shape.note, /counts is sim_counts/);
    assert.match(shape.note, /threshold is observed_count/);
    assert.doesNotMatch(shape.note, EM_DASH);
    assert.ok(!shape.note.includes(copy.solution), `${move}: the note does not write out the answer`);

    // The note is on screen with its code shape: one paragraph right after it, not before.
    const before = c5.visibleHints(move, 1);
    assert.ok(!before.includes(shape.note), `${move}: the note does not appear before its code shape`);
    const lines = c5.visibleHints(move, 2);
    const at = lines.indexOf(`Code shape: ${copy.shape}`);
    assert.ok(at >= 0, `${move}: the code shape line is shown`);
    assert.equal(lines[at + 1], shape.note, `${move}: the note follows its code shape`);

    // The reference answer never enters the hint list, at any help level.
    for (let hint = 0; hint <= 6; hint += 1) {
      assert.ok(!c5.visibleHints(move, hint).some(line => line.includes(copy.solution)), `${move} hint ${hint}: no full answer in the hint list`);
    }
  }
  // The pre-editor copy and the editor are unchanged: the editor starts empty.
  assert.equal(c5.initialEditorText(), "");
  for (const move of c5.MOVES) assert.doesNotMatch(c5.preEditorBridge(move).lead, /placeholder/);
});

test("B9: C6 code-shape hint maps table, lower_bound, target and upper_bound and says row_rule is the learner's own name", () => {
  const note = c6.COPY.shape_note;
  assert.ok(note, "C6 has a placeholder note for its code shape");
  assert.match(note, /table, lower_bound, target and upper_bound are placeholders, not names in this case/);
  assert.match(note, /table is candidate_models/);
  assert.match(note, /lower_bound is candidate_models\.lower/);
  assert.match(note, /target is observed_count/);
  assert.match(note, /upper_bound is candidate_models\.upper/);
  assert.match(note, /row_rule is a name you make yourself/);
  assert.doesNotMatch(note, EM_DASH);
  assert.ok(!note.includes(c6.COPY.solution), "the note does not write out the answer");

  assert.ok(!c6.visibleHints(1).includes(note), "the note does not appear before the code shape");
  const lines = c6.visibleHints(2);
  const at = lines.indexOf(`Code shape: ${c6.COPY.shape}`);
  assert.ok(at >= 0, "the code shape line is shown");
  assert.equal(lines[at + 1], note, "the note follows the code shape");
  // Later hints keep the note on screen, and the templates stay generic.
  assert.ok(c6.visibleHints(4).includes(note));
  assert.doesNotMatch(c6.COPY.range_rule, /candidate_models|observed_count/);
  assert.doesNotMatch(c6.COPY.selection, /candidate_models|observed_count/);

  for (let hint = 0; hint <= 6; hint += 1) {
    assert.ok(!c6.visibleHints(hint).some(line => line.includes(c6.COPY.solution)), `hint ${hint}: no full answer in the hint list`);
  }
  assert.equal(c6.initialEditorText(), "");
});

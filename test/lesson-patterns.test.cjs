'use strict';
// P11 (0.5 fix round 2): a pattern of code must be TAUGHT before any later line, twist or chapter step uses it.
// Gate I1 already checks single functions and operators for the exam solutions; this check also names PATTERNS
// (a rule inside a column's brackets, a bare groupby, a list built with `for`, the three-part pair, ...) and checks
// every lesson line, in course order, not only the chapter exams.
//
// Model. The course order is Lesson 1, Lesson 2, ... Lesson 6. A lesson is read round by round: the warm-up quiz
// code first (a USE), then the round's explain text (TEACHES), then its challenges in order. On a challenge:
//   teaches: a `see` line's starter and solution, its prompt, its labels, its look_closer (code and text)
//   uses:    every other kind's starter, solution and starter_hint (a `play` line's starter counts as a use)
// A pattern is taught once any teaching source shows it. The first USE of a pattern with no teaching source before
// it is a violation (used before taught). Each chapter exam N (its moves and its twists) may use only patterns that
// Lessons 1 to N taught.
//
// Names below are plain: they are what the content builders read in the to-do list.
//
// Mode. KNOWN_TODO lists today's violations (the content builders' to-do list). While it is not empty the test
// fails only on a violation NOT on the list, and prints the list. Remove an entry when its content is fixed. When
// KNOWN_TODO is empty, or PATTERNS_STRICT=1, every violation fails. PATTERNS-TAUGHT-OK prints when there are none.
const test = require('node:test');
const assert = require('node:assert');
const { PATTERNS, bare, sourcesOf, teaches, uses, violationsOf, loadCourse } = require('./lesson-rules.cjs');

// ---- the content to-do list (today's violations; keys are "<line id>|<pattern>") -------------------------------
const KNOWN_TODO = [
];

// ---- tests -----------------------------------------------------------------------------------------------------
const strict = process.env.PATTERNS_STRICT === '1' || KNOWN_TODO.length === 0;
const hit = (name, code) => PATTERNS.find(([n]) => n === name)[1](bare(code));

test('pattern matchers: each named pattern fires on its example and not on a near miss', () => {
  const P = {
    for: 'a list built with for: [... for _ in ...]', col: 'a rule inside a column\'s brackets: table.column[rule]',
    rows: 'rows picked by a rule, then all columns: table[rule, :]', bare: 'a bare groupby (not inside combine)',
    three: 'the three-part pair :a => f => :b', semi: 'a named input after a semicolon: f(x; name=value)',
    nest: 'one call inside another call: f(g(...))', range: 'a range a:b', colon: 'the all-columns colon: [rows, :]',
    notop: 'not: !', blank: 'a name on the left of = inside a blank line: ___ = ',
  };
  assert.ok(hit(P.for, '[sum(rand(Bool, 10)) for _ in 1:3]'));
  assert.ok(!hit(P.for, 'sum(rand(Bool, 10))'));
  assert.ok(hit(P.col, 'logbook.detected[rule]'));
  assert.ok(hit(P.col, 'batch5.detected[batch5.tray_id .== "T-E"]'));
  assert.ok(!hit(P.col, 'logbook.jar_id[1]'));
  assert.ok(!hit(P.col, 'logbook.jar_id[2:3]'));
  assert.ok(!hit(P.col, 'logbook.jar_id[___]'), 'a blank is not a rule');
  assert.ok(hit(P.rows, 'jars[jars.batch_id .== "B09", :]'));
  assert.ok(!hit(P.rows, 'logbook[1:3, :]'));
  assert.ok(hit(P.bare, 'groupby(jars, :tray_id)'));
  assert.ok(!hit(P.bare, 'combine(groupby(jars, :tray_id), nrow => :n)'));
  assert.ok(!hit(P.bare, 'combine(\n  groupby(jars, :tray_id), nrow => :n)'));
  assert.ok(hit(P.three, 'combine(groupby(t, :k), :detected => sum => :n)'));
  assert.ok(!hit(P.three, 'combine(groupby(t, :k), nrow => :n)'));
  assert.ok(hit(P.semi, 'sample(x, 3; replace=false)'));
  assert.ok(!hit(P.semi, 'sample(x, 3, replace=false)'));
  assert.ok(hit(P.nest, 'sum(rand(Bool, 8))'));
  assert.ok(!hit(P.nest, 'length(batch5.detected[batch5.tray_id .== "T-E"])'));
  assert.ok(hit(P.range, 'rand(1:6)') && hit(P.range, 'for _ in 1:3') && !hit(P.range, 'combine(g, nrow => :n)'));
  assert.ok(!hit(P.range, 'logbook[rule, :]'));
  assert.ok(hit(P.colon, 'logbook[1:3, :]') && !hit(P.colon, 'logbook[1:3]'));
  assert.ok(hit(P.notop, '!flag') && !hit(P.notop, 'a != b') && !hit(P.notop, 'Random.seed!(1)') && !hit(P.notop, 'a .!= b'));
  assert.ok(hit(P.blank, 'events = ___ .>= ___') === false && hit(P.blank, '___ = x .>= 3'));
});

test('patterns: a pattern used on a graded line before any see teaches it is reported; a see first is clean', () => {
  const bad = violationsOf({ exams: {}, lessons: { 1: { rounds: [{ id: 'r1', challenges: [
    { id: 'a', kind: 'change', starter: 'x[x .> 1]', solution: 'x[x .> 2]' }] }] } } });
  assert.ok(bad.length === 0, 'x[..] alone is not a column pattern');
  const bad2 = violationsOf({ exams: {}, lessons: { 1: { rounds: [{ id: 'r1', challenges: [
    { id: 'a', kind: 'change', starter: 'groupby(t, :k)', solution: 'groupby(t, :j)' },
    { id: 'b', kind: 'see', starter: 'groupby(t, :k)', solution: 'groupby(t, :k)' }] }] } } });
  assert.deepStrictEqual(bad2.map((v) => v.key).filter((k) => /bare/.test(k)), ['a|a bare groupby (not inside combine)']);
  const good = violationsOf({ exams: {}, lessons: { 1: { rounds: [{ id: 'r1', challenges: [
    { id: 'b', kind: 'see', starter: 'groupby(t, :k)', solution: 'groupby(t, :k)' },
    { id: 'a', kind: 'change', starter: 'groupby(t, :k)', solution: 'groupby(t, :j)' }] }] } } });
  assert.deepStrictEqual(good, []);
  const exam = violationsOf({ lessons: { 1: { rounds: [{ id: 'r1', challenges: [{ id: 'b', kind: 'see', starter: 'sum(x)', solution: 'sum(x)' }] }] } },
    exams: { 1: { rounds: [{ id: 'x', challenges: [{ id: 'x1', kind: 'checkpoint', starter: '', solution: 'first(x, 2)' }] }] } } });
  assert.deepStrictEqual(exam.map((v) => v.key), ['x1|first(']);
});

test('patterns: every pattern is taught before it is used (lessons 1 to 6 in order, then each chapter)', () => {
  const v = violationsOf(loadCourse());
  const todo = new Set(KNOWN_TODO);
  const fresh = v.filter((x) => !todo.has(x.key));
  const fixed = KNOWN_TODO.filter((k) => !v.some((x) => x.key === k));
  if (v.length === 0) console.log('PATTERNS-TAUGHT-OK');
  else {
    console.log(`# PATTERNS to-do (${v.length} used before taught; ${fresh.length} not on KNOWN_TODO):`);
    for (const x of v) console.log(`#   ${x.where} ${x.id}: ${x.pattern}${x.why ? ' (' + x.why + ')' : ''}${todo.has(x.key) ? '' : '   <-- NEW'}`);
  }
  if (fixed.length) console.log(`# KNOWN_TODO entries now fixed (delete them): ${fixed.join('; ')}`);
  if (strict) assert.deepStrictEqual(v.map((x) => `${x.where} ${x.id}: ${x.pattern}`), [], 'patterns used before they are taught');
  else assert.deepStrictEqual(fresh.map((x) => `${x.where} ${x.id}: ${x.pattern}`), [], 'a NEW pattern used before it is taught (not on KNOWN_TODO)');
});


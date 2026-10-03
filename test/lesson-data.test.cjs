'use strict';
// Data rules for every lessons/*.json and the engine fixture (docs/dev-log/course/lesson-format.md).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ALLOWED_CHECKERS = [
  'check_lesson4_case', 'check_lesson4_practice_2', 'check_lesson4_practice_3', 'check_lesson4_practice_4',
  'check_lesson5_flips4', 'check_lesson5_count10', 'check_lesson5_count8',
  // exam wrappers (src/lessons.jl LESSON_EXAM_CHECKS): one per chapter move, each calling that chapter's own checker
  'check_exam1_select_records', 'check_exam2_group', 'check_exam2_counts', 'check_exam2_rates',
  'check_exam3_join_report_log', 'check_exam3_filter_disagreement', 'check_exam4_plan_distinct_recheck',
  'check_exam5_event_mask', 'check_exam5_event_frequency', 'check_exam6_compatible_models',
];
// Chapter N's moves in order, and the checker each one names (docs/dev-log/course/lesson-format.md, "Exams").
const EXAM_MOVES = {
  C1: ['check_exam1_select_records'], C2: ['check_exam2_group', 'check_exam2_counts', 'check_exam2_rates'],
  C3: ['check_exam3_join_report_log', 'check_exam3_filter_disagreement'], C4: ['check_exam4_plan_distinct_recheck'],
  C5: ['check_exam5_event_mask', 'check_exam5_event_frequency'], C6: ['check_exam6_compatible_models'],
};
// The setup each exam checker runs in (a round's `setup`, else the exam's). C3's second move binds `joined` only.
const EXAM_SETUPS = {
  check_exam1_select_records: 'case1', check_exam2_group: 'case2', check_exam2_counts: 'case2', check_exam2_rates: 'case2',
  check_exam3_join_report_log: 'case3', check_exam3_filter_disagreement: 'case3_joined', check_exam4_plan_distinct_recheck: 'case4',
  check_exam5_event_mask: 'case5', check_exam5_event_frequency: 'case5', check_exam6_compatible_models: 'case6',
};
// An exam's close.finding gives the same facts as the chapter's payoff text (0.5 wording; test/test_exam_fit.jl compares
// the numbers, ids and story names), so it may be longer than a lesson's; C5's payoff is about 65 words.
const EXAM_FINDING_WORDS = 70;
const TYPED = ['change', 'complete', 'write'];
const KINDS = ['see', 'change', 'complete', 'write', 'fix', 'checkpoint', 'play'];
// fix is checked like change but does NOT count as a typed challenge (format rule).
const files = [path.join(root, 'test', 'fixtures', 'lesson-engine.json')];
const lessonsDir = path.join(root, 'lessons');
const realFiles = fs.existsSync(lessonsDir)
  ? fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(lessonsDir, f))
  : [];
files.push(...realFiles);
if (realFiles.length === 0) console.log('# note: lessons/ has no files yet; only the fixture is checked');

const { ideaViolations, leakViolations, nearCopyViolations, promptLeakViolations, warmupDictionaryViolations, recallViolations,
  glossaryViolations, rangeViolations, labelViolations, closeViolations, lookCloserViolations,
  glossaryCoverageViolations, checkpointLineViolations, dataNameViolations, taughtViolations,
  newFieldViolations, ideaCountViolations, twistViolations, isTwist, roundTwoLints, firstUseNoteLints } = require('./lesson-rules.cjs');
// The 12 case jars (the same notebook every lesson and the range use; the Julia test checks this list against mystery_jars()).
const CASE_JAR_IDS = ['J-081', 'J-082', 'J-083', 'J-084', 'J-085', 'J-086', 'J-091', 'J-092', 'J-093', 'J-094', 'J-095', 'J-096'];
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

// The engine's own dump of each lesson's data (see tools/lesson-dump-data.jl); the Julia test keeps it current.
const storedDataFile = path.join(root, 'test', 'fixtures', 'lesson-data-values.json');
const storedData = fs.existsSync(storedDataFile) ? JSON.parse(fs.readFileSync(storedDataFile, 'utf8')) : null;
// The range runs on practice1 (Lesson 1's practice logbook), so its jar ids are the logbook's, not the case's.
const RANGE_JAR_IDS = storedData ? storedData.lesson1.data_values.logbook.rows.map((row) => row[0]) : [];

const lessonRuleFiles = [], rangeRuleFiles = [], examRuleFiles = [];
for (const file of files) {
  const name = path.relative(root, file);
  const lesson = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rounds = lesson.rounds || [];
  const challenges = rounds.flatMap((r) => (r.challenges || []).map((c) => ({ r, c })));

  test(`${name}: no em dashes`, () => {
    assert.ok(!fs.readFileSync(file, 'utf8').includes('—'));
  });

  // The target range is not a lesson: lesson rules (ideas, see first, checkpoints) never run on it.
  if (lesson.kind === 'range') {
    rangeRuleFiles.push(name);
    test(`${name}: range rules (shape, ids exist, target at most 20 words, no em dashes)`, () => {
      assert.strictEqual(lesson.setup, 'practice1', 'the range uses the practice logbook, never the case jars');
      assert.ok(RANGE_JAR_IDS.length === 12 && RANGE_JAR_IDS.every((id) => /^Q-\d+$/.test(id)), 'the logbook fixture has the 12 practice ids');
      assert.deepStrictEqual(rangeViolations(lesson, RANGE_JAR_IDS), []);
    });
    continue;
  }

  lessonRuleFiles.push(name);
  // A chapter exam (kind "exam") is not a teaching lesson: the teaching-shape rules (one idea per round on a see, two
  // typed challenges before a checkpoint, remember from round 2, can_do and common_mistake, the idea test) do not
  // apply. Its own rules come instead, and every other rule (words, dashes, glossary, leaks, starters, hints) holds.
  const isExam = lesson.kind === 'exam';
  // "Your own data" (kind "own") is an optional last stage with one round of plays and a say step: like the range, it
  // has no see, no checkpoint and no new idea, so the teaching-shape rules (ideas, see first, typed-before-checkpoint,
  // play after checkpoint, last graded challenge) do not apply. Words, dashes, glossary, labels and the rest do.
  const isOwn = lesson.kind === 'own';
  if (isOwn) {
    test(`${name}: own-data rules (plays and one say, no check or solution, notes at most 25 words)`, () => {
      assert.strictEqual(lesson.setup, 'own_data');
      assert.ok(challenges.length > 0 && challenges.every(({ c }) => ['play', 'say'].includes(c.kind)), 'only plays and say steps');
      assert.strictEqual(challenges.filter(({ c }) => c.kind === 'say').length, 1, 'one say step');
      assert.strictEqual(challenges[challenges.length - 1].c.kind, 'say', 'the say step is last');
      for (const { c } of challenges) {
        assert.ok(!('solution' in c) && !('check' in c), `${c.id}: no solution or check`);
        for (const k of ['r_note', 'py_note']) if (c[k] !== undefined) assert.ok(words(c[k]) <= 25, `${c.id}: ${k} at most 25 words`);
      }
      const ids = challenges.map(({ c }) => c.id);
      assert.strictEqual(new Set(ids).size, ids.length, 'challenge ids unique');
      const names = JSON.stringify(lesson).match(/\{[a-z_]+\}/g) || [];
      names.forEach((n) => assert.ok(['{any_col}', '{num_col}', '{group_col}', '{group_value}', '{y_col}'].includes(n), 'unknown name ' + n));
      assert.ok(words(lesson.close && lesson.close.own_work && lesson.close.own_work.say) <= 40, 'own_work.say');
      assert.deepStrictEqual(newFieldViolations(lesson).filter((m) => /minutes/.test(m)), []);
    });
  }
  if (isExam) {
    examRuleFiles.push(name);
    test(`${name}: exam rules (chapter, moves in order, checkers, setups, checkpoints only, at most one hint)`, () => {
      const n = lesson.number;
      assert.ok(Number.isInteger(n) && n >= 1 && n <= 6, 'number is 1 to 6');
      assert.strictEqual(lesson.id, `exam${n}`, 'id is examN');
      assert.strictEqual(path.basename(file), `exam${n}.json`, 'file is lessons/examN.json');
      assert.strictEqual(lesson.chapter, `C${n}`, 'chapter is CN');
      assert.ok(lesson.title && lesson.goal, 'title and goal');
      assert.ok(lesson.close && lesson.close.finding, 'close.finding');
      // The chapter's moves, in order. A twist (0.5 fix, decision 11) has no checker and is judged by value: it may sit
      // anywhere among them and is not a move.
      const checkers = challenges.filter(({ c }) => !isTwist(c)).map(({ c }) => c.check && c.check.checker);
      assert.deepStrictEqual(checkers, EXAM_MOVES[lesson.chapter], 'one challenge per chapter move, in order');
      const chapterSetups = EXAM_MOVES[lesson.chapter].map((k) => EXAM_SETUPS[k]);
      assert.deepStrictEqual(twistViolations(lesson, chapterSetups), []);
      for (const { r, c } of challenges) {
        assert.strictEqual(c.kind, 'checkpoint', `${c.id}: an exam challenge is a checkpoint`);
        assert.strictEqual(c.starter, '', `${c.id}: starts empty`);
        assert.ok(typeof c.solution === 'string' && c.solution.trim(), `${c.id}: has a solution`);
        if (isTwist(c)) assert.ok(c.check && c.check.same_value === true, `${c.id}: a twist is judged by value`);
        else {
          assert.strictEqual(c.check.same_value, false, `${c.id}: judged by its checker, not by value`);
          assert.strictEqual(r.setup || lesson.setup, EXAM_SETUPS[c.check.checker], `${c.id}: runs in the setup its checker wants`);
        }
        assert.ok(!c.hints || (Array.isArray(c.hints) && c.hints.length <= 1), `${c.id}: at most one hint`);
        for (const k of ['labels', 'predict', 'look_closer', 'r_note', 'py_note', 'remember', 'new_ideas', 'new_facts', 'clue']) assert.ok(!(k in c), `${c.id}: no ${k} in an exam`);
      }
      for (const r of rounds) assert.ok(!r.remember, `${r.id}: no warm-up quiz in an exam`);
      // The chapter dictionary is Lessons 1 to N's, built by the server. Round 2: an exam file may add the chapter's own rows
      // (its real table names, shown first); each row needs julia, means, r and py.
      if ('dictionary' in lesson) {
        assert.ok(Array.isArray(lesson.dictionary) && lesson.dictionary.length > 0, 'an exam dictionary is a non-empty list of the chapter\'s own rows');
        for (const row of lesson.dictionary) for (const k of ['julia', 'means', 'r', 'py']) assert.ok(typeof row[k] === 'string' && row[k].trim(), `exam dictionary row ${JSON.stringify(row.julia)}: ${k}`);
      }
    });
  }
  test(`${name}: glossary is unique, short and plain`, () => {
    assert.deepStrictEqual(glossaryViolations(lesson), []);
  });

  // Round 6. The engine fixture has no course text, so can_do and common_mistake are required of real lessons only.
  test(`${name}: labels, can_do (2 or 3, at most 12 words), common_mistake (at most 25), look_closer`, () => {
    assert.deepStrictEqual(labelViolations(lesson), []);
    assert.deepStrictEqual(closeViolations(lesson, file !== files[0] && !isExam), []);
    assert.deepStrictEqual(lookCloserViolations(lesson), []);
  });

  test(`${name}: every glossary term appears in an underlined field`, () => {
    assert.deepStrictEqual(glossaryCoverageViolations(lesson), []);
  });

  test(`${name}: checkpoint requires and forbids lines name the goal, not the answer`, () => {
    assert.deepStrictEqual(checkpointLineViolations(lesson), []);
  });

  test(`${name}: check.taught items sit in the solution; feedback.taught is short`, () => {
    assert.deepStrictEqual(taughtViolations(lesson), []);
  });

  test(`${name}: every data name is bound by its setup`, () => {
    assert.deepStrictEqual(dataNameViolations(lesson, storedData), []);
  });

  test(`${name}: word limits`, () => {
    assert.ok(words(lesson.story) <= 40, 'story');
    assert.ok(words(lesson.close && lesson.close.finding) <= (isExam ? EXAM_FINDING_WORDS : 40), 'close.finding');
    for (const r of rounds) {
      assert.ok(words(r.explain) <= 40, `${r.id} explain`);
      assert.ok(words(r.story) <= 40, `${r.id} story`);
    }
    for (const { c } of challenges) assert.ok(words(c.prompt) <= 40, `${c.id} prompt`);
  });

  if (!isExam && !isOwn) test(`${name}: one idea per round, carried on a see`, () => {
    let total = 0;
    for (const r of rounds) {
      assert.ok(r.idea && typeof r.idea === 'string', `${r.id} has one idea`);
      const carriers = r.challenges.filter((c) => (c.new_ideas || []).length > 0);
      assert.strictEqual(carriers.length, 1, `${r.id}: exactly one challenge carries new_ideas`);
      assert.strictEqual(carriers[0].kind, 'see', `${r.id}: only a see carries new_ideas`);
      assert.deepStrictEqual(carriers[0].new_ideas, [r.idea], `${r.id}: new_ideas equals the round idea`);
      total += 1;
    }
    // At most three ideas per lesson, except Lesson 2: Shinichi's exception of 30 Sep 2026 (four rounds). See lesson-rules.cjs.
    assert.deepStrictEqual(ideaCountViolations(lesson), []);
    assert.ok(total <= (lesson.id === 'lesson2' ? 4 : 3), 'at most three new ideas per lesson (Lesson 2: four)');
  });

  if (!isOwn) test(`${name}: py_note, starter_hint and minutes rules`, () => {
    assert.deepStrictEqual(newFieldViolations(lesson), []);
  });

  if (!isExam && !isOwn) test(`${name}: two typed challenges before each checkpoint; remember from round 2`, () => {
    rounds.forEach((r, i) => {
      const cs = r.challenges;
      const see = cs.findIndex((c) => c.kind === 'see');
      assert.ok(see >= 0, `${r.id} has a see`);
      cs.forEach((c, j) => {
        if (c.kind !== 'checkpoint') return;
        const typed = cs.slice(see + 1, j).filter((x) => TYPED.includes(x.kind)).length;
        assert.ok(typed >= 2, `${r.id}: at least two typed challenges before ${c.id}`);
      });
      if (i >= 1) assert.ok(r.remember && r.remember.prompt && r.remember.code, `${r.id} has remember`);
    });
  });

  if (!isOwn) test(`${name}: kinds, play placement, clue and r_note rules`, () => {
    for (const r of rounds) {
      r.challenges.forEach((c, j) => {
        assert.ok(KINDS.includes(c.kind), `${c.id}: kind ${c.kind}`);
        if (c.kind === 'play') {
          assert.ok(j > 0 && r.challenges[j - 1].kind === 'checkpoint', `${c.id}: a play may only follow a checkpoint`);
          assert.ok(!('solution' in c) && !('check' in c), `${c.id}: play has no solution or check`);
        }
        if (c.clue !== undefined) {
          assert.strictEqual(c.kind, 'checkpoint', `${c.id}: clue only on a checkpoint`);
          assert.ok(words(c.clue) <= 25, `${c.id}: clue at most 25 words`);
        }
        if (c.r_note !== undefined) {
          assert.strictEqual(c.kind, 'see', `${c.id}: r_note only on a see`);
          assert.ok(words(c.r_note) <= 25, `${c.id}: r_note at most 25 words`);
        }
      });
      // No cap per round: an R and a Python note come on each first use of a function or operator (the P10 lint in
      // lesson-rules.cjs checks that).
    }
  });

  if (!isOwn) test(`${name}: last graded challenge is an empty checkpoint; ids unique; checkers allowed`, () => {
    const graded = challenges.filter(({ c }) => c.kind !== 'play');
    const last = graded[graded.length - 1].c;
    assert.strictEqual(last.kind, 'checkpoint');
    assert.strictEqual(last.starter, '');
    assert.ok(words(lesson.close && lesson.close.own_work && lesson.close.own_work.say) <= 40, 'own_work.say');
    const ids = challenges.map(({ c }) => c.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'challenge ids unique');
    for (const { c } of challenges) {
      const checker = c.check && c.check.checker;
      if (checker) assert.ok(ALLOWED_CHECKERS.includes(checker), `${c.id}: checker ${checker}`);
      if (c.kind === 'checkpoint') assert.strictEqual(c.starter, '', `${c.id} starts empty`);
    }
  });

  test(`${name}: remember is a quiz; checkpoints have two hints; errors have examples`, () => {
    rounds.forEach((r, i) => {
      if (i >= 1 && !isExam) assert.ok(r.remember, `${r.id} has remember`);
      if (!r.remember) return;
      const q = r.remember;
      assert.ok(q.prompt && q.code, `${r.id} remember prompt and code`);
      assert.ok(Array.isArray(q.choices) && q.choices.length >= 2, `${r.id} remember choices`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < (q.choices || []).length, `${r.id} remember answer`);
      assert.ok(q.why && typeof q.why === 'string', `${r.id} remember why`);
    });
    for (const { c } of challenges) {
      if (c.kind === 'checkpoint') {
        // an exam checkpoint has at most one hint (the exam rules above); a lesson checkpoint has two
        if (isExam) assert.ok(!c.hints || c.hints.every((h) => h && typeof h === 'string'), `${c.id}: hints are text`);
        else assert.ok(Array.isArray(c.hints) && c.hints.length === 2 && c.hints.every((h) => h && typeof h === 'string'), `${c.id}: two hints`);
      }
      for (const e of (c.feedback && c.feedback.errors) || []) {
        assert.ok(e.example && typeof e.example === 'string', `${c.id}: error "${e.match}" has an example`);
      }
    }
  });

  test(`${name}: no checkpoint answer on screen`, () => {
    assert.deepStrictEqual(leakViolations(lesson), []);
  });

  test(`${name}: no near-copy of a checkpoint answer (strings and numbers blanked)`, () => {
    assert.deepStrictEqual(nearCopyViolations(lesson), []);
  });

  test(`${name}: no checkpoint prompt contains its own solution or a 25-character run of it`, () => {
    assert.deepStrictEqual(promptLeakViolations(lesson), []);
  });

  test(`${name}: no dictionary row visible at a warm-up quiz contains the quiz code`, () => {
    assert.deepStrictEqual(warmupDictionaryViolations(lesson), []);
  });

  test(`${name}: a typed recall is a first write with no new idea, no remember quiz, and no dictionary leak`, () => {
    assert.deepStrictEqual(recallViolations(lesson), []);
  });

  if (!isExam) test(`${name}: mechanical idea test (every function, operator and macro is first used on a see that declares it)`, () => {
    assert.deepStrictEqual(ideaViolations(lesson), []);
  });
}

// Negative tests: each bad fixture must FAIL its rule, or the rule proves nothing.
const bad = (f) => JSON.parse(fs.readFileSync(path.join(root, 'test', 'fixtures', 'bad-lessons', f), 'utf8'));
const engine = () => JSON.parse(fs.readFileSync(files[0], 'utf8'));
const find = (lesson, id) => lesson.rounds.flatMap((r) => r.challenges).find((c) => c.id === id);

test('engine fixture passes every mechanical rule', () => {
  const l = engine();
  assert.deepStrictEqual([...ideaViolations(l), ...leakViolations(l), ...nearCopyViolations(l),
    ...promptLeakViolations(l), ...warmupDictionaryViolations(l)], []);
});

for (const [file, expect] of [
  ['bad-idea-filter.json', /filter\(|->/],
  ['bad-idea-count.json', /count\(/],
  ['bad-idea-assign.json', /=/],
  ['bad-idea-dotand.json', /\.&/],
]) {
  test(`negative: ${file} fails the idea test`, () => {
    const v = ideaViolations(bad(file));
    assert.ok(v.length > 0, 'expected violations');
    assert.ok(v.some((m) => expect.test(m)), `expected a violation naming ${expect}, got ${JSON.stringify(v)}`);
  });
}

test('negative: bad-nearcopy.json fails the near-copy test', () => {
  const v = nearCopyViolations(bad('bad-nearcopy.json'));
  assert.ok(v.length > 0);
});

test('negative: too many new_facts fail the idea test', () => {
  const l = engine();
  find(l, 'e-r2-c1').new_facts = ['one', 'two', 'three'];
  assert.ok(ideaViolations(l).some((m) => /more than two new_facts/.test(m)));
  const l2 = engine();
  find(l2, 'e-r1-c1').new_facts = ['a length fact', 'a second fact'];
  find(l2, 'e-r1-c2').new_facts = ['x', 'y'];
  find(l2, 'e-r1-c3').new_facts = ['z'];
  assert.ok(ideaViolations(l2).length > 0);
});

test('negative: an exact checkpoint answer in the dictionary fails the leak test', () => {
  const l = engine();
  l.dictionary.push({ julia: find(l, 'e-r1-cp').solution, means: 'x', r: 'x', from_round: 'r1', idea: 'function' });
  assert.ok(leakViolations(l).length > 0);
});

test('negative: a checkpoint answer in a hint or a feedback line fails the leak test', () => {
  const l = engine();
  find(l, 'e-r1-cp').hints[1] = `Write ${find(l, 'e-r1-cp').solution}`;
  assert.ok(leakViolations(l).length > 0);
  const l2 = engine();
  find(l2, 'e-r1-c3').feedback.wrong = `Try ${find(l2, 'e-r2-cp').solution}`;
  assert.ok(leakViolations(l2).length > 0);
});

test('negative: a checkpoint prompt with its solution, or 25 characters of it, fails the prompt rule', () => {
  const l = engine();
  const cp = find(l, 'e-r2-cp');
  cp.prompt = `Write ${cp.solution} now.`;
  assert.ok(promptLeakViolations(l).some((m) => /e-r2-cp/.test(m)));
  // spaces do not hide it
  cp.prompt = `Write ${cp.solution.replace(/ /g, '  ')} now.`;
  assert.ok(promptLeakViolations(l).length > 0);
  // a 25-character run of a longer solution is enough
  const l2 = engine();
  const cp2 = find(l2, 'e-r2-cp');
  cp2.solution = 'jars[jars.batch_id .== case_batch, :] # long enough to run past twenty-five';
  cp2.prompt = `Use ${cp2.solution.slice(0, 30)}`;
  assert.ok(promptLeakViolations(l2).length > 0);
  // a short shared word is fine
  const l3 = engine();
  assert.deepStrictEqual(promptLeakViolations(l3), []);
  find(l3, 'e-r2-cp').prompt = 'Keep the jars of the case batch with a rule on batch_id.';
  assert.deepStrictEqual(promptLeakViolations(l3), []);
});

test('negative: a dictionary row holding the warm-up quiz code fails the warm-up rule', () => {
  const l = engine();
  const quiz = l.rounds[1].remember.code;
  l.dictionary.push({ julia: quiz.replace('(', ' ( '), means: 'x', r: 'x', from_round: 'r1', idea: 'function' });
  assert.ok(warmupDictionaryViolations(l).some((m) => /r2/.test(m)));
  // a row that only appears in a later round is not visible yet
  const l2 = engine();
  l2.dictionary.push({ julia: 'x', means: `counts, as in ${quiz}`, r: 'x', from_round: 'r2', idea: 'function' });
  assert.ok(warmupDictionaryViolations(l2).length > 0, 'the round that asks the quiz still shows its own rows');
  const l3 = engine();
  l3.rounds[0].remember = { prompt: 'p', code: quiz, choices: ['a', 'b'], answer: 0, why: 'w' };
  l3.dictionary.push({ julia: quiz, means: 'x', r: 'x', from_round: 'r2', idea: 'function' });
  assert.deepStrictEqual(warmupDictionaryViolations(l3).filter((m) => /^r1/.test(m)), []);
  // the R column and the means column count too
  const l4 = engine();
  l4.dictionary.push({ julia: 'x', means: 'x', r: quiz, from_round: 'r1', idea: 'function' });
  assert.ok(warmupDictionaryViolations(l4).length > 0);
});

test('negative: a typed recall must be a first write with no idea and no remember quiz; it is exempt from the G3 first-use test', () => {
  const l = JSON.parse(fs.readFileSync(path.join(root, 'lessons', 'lesson2.json'), 'utf8'));
  const rc = l.rounds[0].challenges[0];
  assert.strictEqual(rc.recall, true);
  assert.deepStrictEqual(recallViolations(l), []);
  assert.deepStrictEqual(ideaViolations(l), [], 'the recall solution uses [ and .== before any see, and G3 skips it');
  const noFlag = JSON.parse(JSON.stringify(l)); delete noFlag.rounds[0].challenges[0].recall;
  assert.ok(ideaViolations(noFlag).some((m) => /l2-r1-c0/.test(m)), 'without the flag the same line is a G3 violation');
  const bad = (f) => { const x = JSON.parse(JSON.stringify(l)); f(x.rounds[0], x.rounds[0].challenges[0]); return recallViolations(x); };
  assert.ok(bad((r, c) => { c.kind = 'complete'; }).some((m) => /only on a write/.test(m)));
  assert.ok(bad((r, c) => { c.new_ideas = ['x']; }).some((m) => /no new idea/.test(m)));
  assert.ok(bad((r) => { r.challenges.unshift(r.challenges.splice(1, 1)[0]); }).some((m) => /first challenge/.test(m)));
  assert.ok(bad((r) => { r.remember = { prompt: 'p', code: 'c' }; }).some((m) => /no remember quiz/.test(m)));
  const leak = JSON.parse(JSON.stringify(l)); leak.dictionary.push({ julia: rc.solution, means: 'x', r: 'x', from_round: 'r1', idea: 'x' });
  assert.ok(recallViolations(leak).some((m) => /dictionary row/.test(m)));
});

// ---- Round 5: glossary and range rules, with negative tests ----
const gl = (glossary) => ({ ...engine(), glossary });

test('glossary: a lesson with no glossary is fine; a clean one passes', () => {
  assert.deepStrictEqual(glossaryViolations(engine()), []);
  assert.deepStrictEqual(glossaryViolations(gl([{ term: 'column', means: 'one kind of detail, running down the table' },
    { term: 'row', means: 'one whole record, running across the table' }])), []);
});

test('negative: a repeated term, a long meaning or an em dash fails the glossary rules', () => {
  assert.ok(glossaryViolations(gl([{ term: 'Column', means: 'a' }, { term: 'column', means: 'b' }])).some((m) => /twice/.test(m)));
  const twenty = Array(20).fill('word').join(' ');
  assert.deepStrictEqual(glossaryViolations(gl([{ term: 'a', means: twenty }])), []);
  assert.ok(glossaryViolations(gl([{ term: 'a', means: `${twenty} more` }])).some((m) => /21 words/.test(m)));
  assert.ok(glossaryViolations(gl([{ term: 'a', means: 'one \u2014 two' }])).some((m) => /em dash/.test(m)));
  assert.ok(glossaryViolations(gl([{ term: 'a', means: '' }])).length > 0);
  assert.ok(glossaryViolations(gl([{ means: 'no term' }])).length > 0);
  assert.ok(glossaryViolations({ ...engine(), glossary: 'column' }).length > 0);
});

const goodRange = () => ({
  id: 'range', kind: 'range', title: 'Target range', goal: 'g', setup: 'jars',
  waves: [
    { id: 'w1', unlocks_after: 'lesson1', target: 'Hit the first two jars of batch B08.', targets: ['J-081', 'J-082'], rule: null,
      hint: 'Pick by position.', example: 'jars.jar_id[1:2]', rings: 'before' },
    { id: 'w2', unlocks_after: 'lesson5', target: 'Pick any three different B09 jars.', targets: null,
      rule: { count: 3, distinct: true, from: ['J-091', 'J-092', 'J-093', 'J-094'] }, hint: 'Sample them.',
      example: 'sample(jars.jar_id[7:10], 3; replace=false)', rings: 'before' },
    { id: 'w3', unlocks_after: 'lesson5', target: 'Hit the last two jars.', targets: ['J-095', 'J-096'], rule: null,
      hint: 'Count from the end.', example: 'jars.jar_id[11:12]', rings: 'after' },
  ],
});

test('range: a clean range passes', () => {
  assert.deepStrictEqual(rangeViolations(goodRange(), CASE_JAR_IDS), []);
});

test('negative: range rules catch each fault', () => {
  const v = (edit) => { const r = goodRange(); edit(r); return rangeViolations(r, CASE_JAR_IDS); };
  assert.ok(v((r) => { r.waves[0].targets = ['J-081', 'J-999']; }).some((m) => /J-999/.test(m)), 'unknown target id');
  // a wave's own table (w.jars) replaces the shared one for that wave
  assert.deepStrictEqual(v((r) => { r.waves[0].jars = [{ jar_id: 'J-081' }, { jar_id: 'J-082' }]; }), [], 'targets found in the wave table');
  assert.ok(v((r) => { r.waves[0].jars = [{ jar_id: 'J-082' }]; }).some((m) => /J-081 is not a jar/.test(m)), 'a target missing from the wave table');
  assert.ok(v((r) => { r.waves[1].rule.from = ['J-091', 'J-777']; r.waves[1].rule.count = 1; }).some((m) => /J-777/.test(m)), 'unknown from id');
  assert.ok(v((r) => { r.waves[0].target = Array(21).fill('jar').join(' '); }).some((m) => /more than 20 words/.test(m)), 'long target');
  assert.deepStrictEqual(v((r) => { r.waves[0].target = Array(20).fill('jar').join(' '); }), [], 'twenty words is allowed');
  assert.ok(v((r) => { r.waves[0].target = 'Hit J-081 \u2014 now.'; }).some((m) => /em dash/.test(m)), 'em dash');
  assert.ok(v((r) => { r.waves[1].targets = ['J-081']; }).some((m) => /exactly one of targets or rule/.test(m)), 'both targets and rule');
  assert.ok(v((r) => { r.waves[0].targets = null; }).some((m) => /exactly one of targets or rule/.test(m)), 'neither');
  assert.ok(v((r) => { r.waves[1].rule.count = 9; }).some((m) => /larger than rule.from/.test(m)), 'count too big');
  assert.ok(v((r) => { r.waves[1].id = 'w1'; }).some((m) => /duplicate/.test(m)), 'duplicate wave id');
  assert.ok(v((r) => { r.waves[0].unlocks_after = 'lesson7'; }).some((m) => /unlocks_after/.test(m)), 'bad unlock');
  assert.ok(v((r) => { delete r.waves[0].example; }).some((m) => /example/.test(m)), 'no example');
  assert.ok(v((r) => { r.kind = 'lesson'; }).some((m) => /kind/.test(m)), 'wrong kind');
  assert.ok(v((r) => { r.waves = []; }).length > 0, 'no waves');
  // round 9: rings and par
  assert.ok(v((r) => { delete r.waves[0].rings; }).some((m) => /rings must be/.test(m)), 'no rings');
  assert.ok(v((r) => { r.waves[0].rings = 'always'; }).some((m) => /rings must be/.test(m)), 'unknown rings');
  assert.ok(v((r) => { r.waves[2].rings = 'before'; }).some((m) => /"after" from wave 3 on/.test(m)), 'rings before from wave 3');
  assert.deepStrictEqual(v((r) => { r.waves[1].rings = 'after'; }), [], 'after is allowed on wave 2');
  // round 10: par is retired; a wave's own rules are check + feedback lines
  assert.ok(v((r) => { r.waves[0].par = 16; }).some((m) => /par is retired/.test(m)), 'par is retired');
  assert.ok(v((r) => { r.waves[0].par = 0; }).some((m) => /par is retired/.test(m)), 'par zero is still retired');
});

test('range: requires, requires_any and forbids on a wave, with lines from data', () => {
  const withCheck = (edit) => { const r = goodRange(); Object.assign(r.waves[2], {
    example: 'jars.jar_id[jars.tray_id .== "T-C"][1:2]',
    check: { requires: ['jars.'], requires_any: ['==', '!='], forbids: ['"J-0', '[['] },
    feedback: { requires: 'Start from the jars table and ask a question.', forbids: 'Ask a question; do not type ids or positions.' } }); edit(r.waves[2]); return rangeViolations(r, CASE_JAR_IDS); };
  assert.deepStrictEqual(withCheck(() => {}), [], 'a wave with check and both lines passes');
  assert.deepStrictEqual(withCheck((w) => { delete w.check.requires_any; delete w.check.requires; delete w.feedback.requires; }), [], 'forbids alone with its line');
  assert.ok(withCheck((w) => { delete w.feedback.forbids; }).some((m) => /check\.forbids needs a feedback\.forbids line/.test(m)), 'forbids without a line');
  assert.ok(withCheck((w) => { delete w.feedback.requires; }).some((m) => /needs a feedback\.requires line/.test(m)), 'requires without a line');
  assert.ok(withCheck((w) => { delete w.check; }).some((m) => /feedback\.requires needs a check\.requires/.test(m)), 'a line without a check');
  assert.ok(withCheck((w) => { w.check.forbids = []; }).some((m) => /check\.forbids must be a list/.test(m)), 'empty list');
  assert.ok(withCheck((w) => { w.check.forbids = [3]; }).some((m) => /check\.forbids must be a list/.test(m)), 'not strings');
  assert.ok(withCheck((w) => { w.check.taught = ['x']; }).some((m) => /check\.taught is not a known key/.test(m)), 'unknown check key');
  assert.ok(withCheck((w) => { w.feedback.pass = 'x'; }).some((m) => /feedback\.pass is not a known key/.test(m)), 'unknown feedback key');
  assert.ok(withCheck((w) => { w.requires = ['jars.']; }).some((m) => /requires belongs inside check/.test(m)), 'requires on the wave itself');
  assert.ok(withCheck((w) => { w.feedback.forbids = Array(31).fill('word').join(' '); }).some((m) => /31 words, at most 30/.test(m)), 'long line');
  assert.ok(withCheck((w) => { w.feedback.forbids = 'no \u2014 dash'; }).some((m) => /em dash/.test(m)), 'em dash in a line');
  // the example must satisfy its own check
  assert.ok(withCheck((w) => { w.example = 'jars.jar_id[11:12]'; }).some((m) => /contains none of requires_any/.test(m)), 'example without requires_any');
  assert.ok(withCheck((w) => { w.check.requires = ['sample(']; }).some((m) => /does not contain required "sample\("/.test(m)), 'example without a required item');
  assert.ok(withCheck((w) => { w.example = 'jars.jar_id[[11, 12]] # jars. =='; }).some((m) => /forbidden "\[\["/.test(m)), 'example with a forbidden item');
  assert.deepStrictEqual(withCheck((w) => { w.example = 'jars.jar_id[jars.tray_id .== "T-C"] # "J-081"'; }), [], 'a forbidden word in a comment does not count');
  // the chance check of a rule wave
  const rule = (edit) => { const r = goodRange(); edit(r.waves[1]); return rangeViolations(r, CASE_JAR_IDS); };
  assert.deepStrictEqual(rule((w) => { w.rule.random = false; }), [], 'random false is allowed');
  assert.deepStrictEqual(rule((w) => { w.rule.random = true; }), [], 'random true is allowed');
  assert.ok(rule((w) => { w.rule.random = 'no'; }).some((m) => /rule\.random must be true or false/.test(m)), 'random must be a boolean');
});

test('range: a range file gets range rules only, never lesson rules', () => {
  // The lesson rules assume rounds. A real range file must have been routed to the range branch of the loop above.
  assert.ok(!lessonRuleFiles.some((f) => rangeRuleFiles.includes(f)), 'a file got both rule sets');
  const rangeFilesOnDisk = files.filter((f) => JSON.parse(fs.readFileSync(f, 'utf8')).kind === 'range').map((f) => path.relative(root, f));
  assert.deepStrictEqual(rangeRuleFiles, rangeFilesOnDisk);
  assert.ok(lessonRuleFiles.every((f) => !rangeFilesOnDisk.includes(f)));
  // a range has no rounds, so the lesson rules have nothing to stand on: the skip is what keeps them off it
  assert.ok(!(goodRange().rounds || []).length);
});

// ---- Round 6: labels, can_do, common_mistake, look_closer, glossary coverage, with negative tests ----
test('labels: result is allowed; an unknown label kind fails', () => {
  const l = engine();
  const see = l.rounds[0].challenges.find((c) => c.kind === 'see');
  see.labels = [{ part: 'length', is: 'function' }, { part: 'x', is: 'inputs' }, { part: 'length(x)', is: 'result' }];
  assert.deepStrictEqual(labelViolations(l), []);
  see.labels.push({ part: 'z', is: 'a list name' });
  assert.deepStrictEqual(labelViolations(l), [], 'a short phrase is shown as written');
  see.labels = [{ part: 'for _ in 1:3', is: 'repeat' }, { part: 'replace=false', is: 'named input' }];
  assert.deepStrictEqual(labelViolations(l), [], 'repeat and named input are fixed label kinds');
  see.labels.push({ part: 'y', is: 'results' });
  assert.ok(labelViolations(l).some((m) => /"y".*results/.test(m)));
  see.labels = [{ part: 'y', is: '' }];
  assert.ok(labelViolations(l).length > 0);
  see.labels = 'function';
  assert.ok(labelViolations(l).length > 0);
});

test('can_do and common_mistake: counts, word limits, required for real lessons only', () => {
  const l = engine();
  assert.deepStrictEqual(closeViolations(l, false), [], 'the fixture may leave them out');
  assert.ok(closeViolations(l, true).some((m) => /can_do is missing/.test(m)));
  assert.ok(closeViolations(l, true).some((m) => /common_mistake is missing/.test(m)));
  const twelve = Array(12).fill('word').join(' ');
  l.close.can_do = ['Pick rows with a rule.', twelve];
  l.close.common_mistake = Array(25).fill('word').join(' ');
  assert.deepStrictEqual(closeViolations(l, true), []);
  l.close.can_do = ['Pick rows with a rule.', twelve, 'A third one.'];
  assert.deepStrictEqual(closeViolations(l, true), [], 'three is allowed');
  l.close.can_do = ['Only one.'];
  assert.ok(closeViolations(l, true).some((m) => /2 or 3/.test(m)));
  l.close.can_do = ['a', 'b', 'c', 'd'];
  assert.ok(closeViolations(l, true).some((m) => /2 or 3/.test(m)));
  l.close.can_do = ['Pick rows with a rule.', `${twelve} more`];
  assert.ok(closeViolations(l, true).some((m) => /13 words, at most 12/.test(m)));
  l.close.can_do = ['Pick rows with a rule.', 'Count them \u2014 fast.'];
  assert.ok(closeViolations(l, true).some((m) => /em dash/.test(m)));
  l.close.can_do = ['Pick rows with a rule.', 'Count what you picked.'];
  l.close.common_mistake = `${Array(25).fill('word').join(' ')} more`;
  assert.ok(closeViolations(l, true).some((m) => /26 words, at most 25/.test(m)));
  l.close.common_mistake = '';
  assert.ok(closeViolations(l, true).some((m) => /common_mistake is empty/.test(m)));
});

test('look_closer: on a see, not a round\'s first challenge, text at most 40 words, code present, at most one per round', () => {
  const l = engine();
  const sees = l.rounds[0].challenges.filter((c) => c.kind === 'see');
  assert.ok(l.rounds[0].challenges[0] === sees[0] && sees.length >= 2, 'fixture: the first challenge is a see, and a second see follows');
  const second = sees[1];
  assert.deepStrictEqual(lookCloserViolations(l), [], 'no look_closer is fine');
  second.look_closer = { text: Array(40).fill('word').join(' '), code: 'length([1, 2])' };
  assert.deepStrictEqual(lookCloserViolations(l), []);
  second.look_closer.text = Array(41).fill('word').join(' ');
  assert.ok(lookCloserViolations(l).some((m) => /41 words, at most 40/.test(m)));
  second.look_closer = { text: 'Julia counts from 1.', code: '  ' };
  assert.ok(lookCloserViolations(l).some((m) => /needs code/.test(m)));
  second.look_closer = { code: 'length([1])' };
  assert.ok(lookCloserViolations(l).some((m) => /needs text/.test(m)));
  const typed = l.rounds[0].challenges.find((c) => c.kind !== 'see');
  typed.look_closer = { text: 'x', code: 'y' };
  second.look_closer = { text: 'x', code: 'y' };
  const v = lookCloserViolations(l);
  assert.ok(v.some((m) => new RegExp(`${typed.id}: look_closer only on a see`).test(m)));
  assert.ok(v.some((m) => /more than one look_closer/.test(m)));
});

test('negative: a look_closer on a round\'s first challenge fails (test-out owns that screen)', () => {
  const l = engine();
  l.rounds[1].challenges[0].look_closer = { text: 'Julia counts from 1.', code: 'length([1])' };
  const v = lookCloserViolations(l);
  assert.ok(v.some((m) => /e-r2-c1: look_closer never on a round's first challenge/.test(m)));
  // the same box on a later see is fine
  const l2 = engine();
  l2.rounds[0].challenges[1].look_closer = { text: 'Julia counts from 1.', code: 'length([1])' };
  assert.deepStrictEqual(lookCloserViolations(l2), []);
});

test('negative: a story word in the glossary fails (Julia, tray, jar, springtail, notebook, report, batch)', () => {
  for (const term of ['Julia', 'tray', 'Trays', 'jar', 'springtail', 'notebook', 'report', 'batch']) {
    assert.ok(glossaryViolations(gl([{ term, means: 'a thing' }])).some((m) => /story word/.test(m)), term);
  }
  // coding words, and story words inside a longer name, are fine
  assert.deepStrictEqual(glossaryViolations(gl([{ term: 'column', means: 'a thing' }, { term: 'tray_id', means: 'a thing' },
    { term: 'square bracket', means: 'a thing' }])), []);
});

const cpLine = (solution, feedback) => ({ ...engine(), rounds: [{ id: 'r1', challenges: [{ id: 'x-cp', kind: 'checkpoint', solution, feedback }] }] });

test('negative: a checkpoint requires or forbids line may not name its solution\'s function or column', () => {
  const sol = 'sum(jars.detected)';
  assert.deepStrictEqual(checkpointLineViolations(cpLine(sol, { requires: 'Add up the true values.', forbids: 'Count by hand, not by typing a number.' })), []);
  let v = checkpointLineViolations(cpLine(sol, { requires: 'Use sum on the column.' }));
  assert.ok(v.some((m) => /requires names "sum"/.test(m)));
  v = checkpointLineViolations(cpLine(sol, { forbids: 'Do not type jars.detected by hand.' }));
  assert.ok(v.some((m) => /forbids names "detected"/.test(m)));
  // a column reached by a symbol, and a broadcast call
  v = checkpointLineViolations(cpLine('select(jars, :tray_id)', { requires: 'Pick the tray_id part.' }));
  assert.ok(v.some((m) => /"tray_id"/.test(m)));
  v = checkpointLineViolations(cpLine('uppercase.(names)', { requires: 'Use uppercase for every name.' }));
  assert.ok(v.some((m) => /"uppercase"/.test(m)));
  // whole words only: "summary" is not "sum"; a decimal point is not a column
  assert.deepStrictEqual(checkpointLineViolations(cpLine(sol, { requires: 'Give a summary of the trays.' })), []);
  assert.deepStrictEqual(checkpointLineViolations(cpLine('round(3.14159; digits=2)', { requires: 'Show two decimal places.' })), []);
  // a line that claims the value is right can show for a wrong value
  v = checkpointLineViolations(cpLine(sol, { requires: 'Right number, but add them up.' }));
  assert.ok(v.some((m) => /says the value is right/.test(m)));
  // only checkpoints are checked
  const l = cpLine(sol, {});
  l.rounds[0].challenges.push({ id: 'x-c1', kind: 'write', solution: sol, feedback: { requires: 'Use sum on jars.detected.' } });
  assert.deepStrictEqual(checkpointLineViolations(l), []);
});

test('data names: a data name the setup does not bind is reported', () => {
  const l = engine();
  l.id = 'lesson2';
  const c = l.rounds[0].challenges[0];
  c.data = 'b09';
  const stored = { lesson2: { data_values: { b09: { columns: ['jar_id'], rows: [] }, practice_jars: {} } } };
  assert.deepStrictEqual(dataNameViolations(l, stored), []);
  c.data = 'form_records';
  const v = dataNameViolations(l, stored);
  assert.ok(v.some((m) => /"form_records"/.test(m)), 'a missing name is named');
  // a lesson with no stored entry (the engine fixture) and no stored file are skipped
  assert.deepStrictEqual(dataNameViolations(l, { lesson9: {} }), []);
  assert.deepStrictEqual(dataNameViolations(l, null), []);
});

test('glossary coverage: a term found in no underlined field is reported', () => {
  const l = engine();
  const c = l.rounds[0].challenges[0];
  c.prompt = 'Count the rows of the table.';
  l.glossary = [{ term: 'row', means: 'one whole record' }];
  assert.deepStrictEqual(glossaryCoverageViolations(l), [], 'a plural counts as the term');
  l.glossary.push({ term: 'seed', means: 'a starting number' });
  assert.ok(glossaryCoverageViolations(l).some((m) => /"seed"/.test(m)));
  // each underlined field counts: explain, hints, predict, remember, every feedback line
  l.rounds[0].explain = 'A seed makes a random pick repeat.';
  assert.deepStrictEqual(glossaryCoverageViolations(l), []);
  l.rounds[0].explain = 'Nothing here.';
  c.feedback = { ...(c.feedback || {}), errors: [{ match: 'x', say: 'Set the seed first.', example: 'x' }] };
  assert.deepStrictEqual(glossaryCoverageViolations(l), []);
  c.feedback.errors = [];
  c.predict = { question: 'What will the seed do?', choices: ['a', 'b'], answer: 0 };
  assert.deepStrictEqual(glossaryCoverageViolations(l), []);
  c.predict = undefined;
  l.rounds[1].remember = { ...l.rounds[1].remember, prompt: 'Remember the seed?' };
  assert.deepStrictEqual(glossaryCoverageViolations(l), []);
  // whole words only: "seeded" is not "seed"
  l.rounds[1].remember.prompt = 'Remember the seeded run?';
  assert.ok(glossaryCoverageViolations(l).some((m) => /"seed"/.test(m)));
  // the screen's own matcher: a sign term never matches inside a longer sign
  const sg = { ...engine(), glossary: [{ term: '=', means: 'gives a name' }, { term: '!=', means: 'not equal' }] };
  sg.rounds[0].explain = 'Use == or .!= here.';
  assert.strictEqual(glossaryCoverageViolations(sg).length, 2, '"=" is not inside "==" or ".!="');
  sg.rounds[0].explain = 'A single = gives a name; x != y asks a question.';
  assert.deepStrictEqual(glossaryCoverageViolations(sg), []);
  // fields the screen never underlines do not count: requires, unchanged and a third hint
  const sf = { ...engine(), glossary: [{ term: 'seed', means: 'a starting number' }] };
  const sc = sf.rounds[0].challenges[0];
  sf.rounds[0].explain = 'Nothing here.';
  sc.feedback = { requires: 'Set the seed.', unchanged: 'The seed is as given.' };
  sc.hints = ['one', 'two', 'Set the seed.'];
  assert.strictEqual(glossaryCoverageViolations(sf).length, 1, 'requires, unchanged and a third hint are never underlined');
  sc.hints = ['one', 'Set the seed.'];
  assert.deepStrictEqual(glossaryCoverageViolations(sf), []);
  // a lesson with no glossary has nothing to cover
  delete l.glossary;
  assert.deepStrictEqual(glossaryCoverageViolations(l), []);
});

// ---- Round 9: "That works too" (check.taught, feedback.taught) ----
test('taught: a clean taught list passes; the engine fixture and real lessons carry none they cannot meet', () => {
  const l = engine();
  const c = l.rounds[0].challenges.find((x) => x.solution && x.check);
  c.solution = 'sum(jars.detected)';
  c.check = { same_value: true, requires: ['jars'], taught: ['sum(', 'jars.detected'] };
  c.feedback = { ...(c.feedback || {}), taught: 'add up the trues of one column with sum' };
  assert.deepStrictEqual(taughtViolations(l), []);
  // whitespace never decides
  c.check.taught = ['sum( jars . detected )'];
  assert.deepStrictEqual(taughtViolations(l), []);
});

test('negative: taught rules catch each fault', () => {
  const v = (edit) => {
    const l = engine();
    const c = l.rounds[0].challenges.find((x) => x.solution && x.check);
    c.solution = 'sum(jars.detected)';
    c.check = { same_value: true, requires: ['jars'], taught: ['sum('] };
    c.feedback = { ...(c.feedback || {}), taught: 'add up one column' };
    edit(c);
    return taughtViolations(l);
  };
  assert.deepStrictEqual(v(() => {}), [], 'the base case is clean');
  assert.ok(v((c) => { c.check.taught = []; }).some((m) => /list of 1 to 6/.test(m)), 'empty list');
  assert.ok(v((c) => { c.check.taught = 'sum('; }).some((m) => /list of 1 to 6/.test(m)), 'not a list');
  assert.ok(v((c) => { c.check.taught = ['sum(', '  ']; }).some((m) => /list of 1 to 6/.test(m)), 'blank item');
  assert.ok(v((c) => { c.check.taught = Array(7).fill('sum('); }).some((m) => /list of 1 to 6/.test(m)), 'too many items');
  assert.ok(v((c) => { c.check.taught = ['count(']; }).some((m) => /not in the step's own solution/.test(m)), 'item the solution lacks');
  assert.deepStrictEqual(v((c) => { c.check.requires = ['sum(']; }), [], 'an item in requires too is redundant, not a fault');
  assert.ok(v((c) => { c.feedback.taught = Array(26).fill('word').join(' '); }).some((m) => /26 words/.test(m)), 'long way');
  assert.deepStrictEqual(v((c) => { c.feedback.taught = Array(25).fill('word').join(' '); }), [], 'twenty-five words is allowed');
  assert.ok(v((c) => { c.feedback.taught = 'add \u2014 up'; }).some((m) => /em dash/.test(m)), 'em dash');
  assert.ok(v((c) => { c.feedback.taught = ' '; }).some((m) => /empty/.test(m)), 'blank way');
  assert.ok(v((c) => { delete c.check.taught; }).some((m) => /feedback.taught needs a check.taught/.test(m)), 'words with no list');
  assert.deepStrictEqual(v((c) => { delete c.check.taught; delete c.feedback.taught; }), [], 'neither is fine');
  assert.ok(v((c) => { c.kind = 'play'; }).some((m) => /play has no check.taught/.test(m)), 'a play');
});

test('round 9 fix: a taught item with a newline keeps its line break; a stray feedback key is caught', () => {
  const v = (edit) => {
    const l = engine();
    const c = l.rounds[0].challenges.find((x) => x.solution && x.check);
    c.solution = 'tray = jars[1:2, :]\ntray';
    c.check = { same_value: true, requires: ['jars'], taught: ['\ntray'] };
    c.feedback = { ...(c.feedback || {}), taught: 'name the rows tray, then show tray' };
    edit(c);
    return taughtViolations(l);
  };
  assert.deepStrictEqual(v(() => {}), [], '"\\ntray" sits in a solution whose last line is tray');
  assert.deepStrictEqual(v((c) => { c.solution = 'tray = jars[1:2, :]\n  tray'; }), [], 'spaces before the name do not matter');
  assert.ok(v((c) => { c.solution = 'tray = jars[1:2, :]'; }).some((m) => /not in the step's own solution/.test(m)), 'no line of its own: the item is missing');
  assert.ok(v((c) => { c.feedback.taught_way = 'x'; }).some((m) => /feedback.taught_way is not a known key/.test(m)), 'taught_way is banned');
  assert.ok(v((c) => { c.feedback.also_works = 'x'; }).some((m) => /also_works is not a known key/.test(m)), 'also_works is banned');
});

// The plain-word gate scans glossary and range text, not only rounds: a banned phrase in either fails it.
test('plain words: check-plain.cjs reads glossary and range strings', () => {
  const { spawnSync } = require('node:child_process');
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-'));
  try {
    for (const d of ['web', 'src', 'lessons']) fs.mkdirSync(path.join(dir, d));
    const run = () => spawnSync('node', [path.join(root, 'tools', 'check-plain.cjs'), dir], { encoding: 'utf8' });
    fs.writeFileSync(path.join(dir, 'lessons', 'lesson1.json'), JSON.stringify({ id: 'lesson1', glossary: [{ term: 'column', means: 'one kind of detail' }] }));
    fs.writeFileSync(path.join(dir, 'lessons', 'range.json'), JSON.stringify({ id: 'range', kind: 'range', waves: [{ id: 'w', target: 'Hit two jars.' }] }));
    assert.strictEqual(run().status, 0, 'clean text passes');
    fs.writeFileSync(path.join(dir, 'lessons', 'lesson1.json'), JSON.stringify({ id: 'lesson1', glossary: [{ term: 'column', means: 'a boolean result of the table' }] }));
    let r = run();
    assert.strictEqual(r.status, 1, 'a banned phrase in a glossary meaning fails');
    assert.match(r.stdout, /boolean result/);
    fs.writeFileSync(path.join(dir, 'lessons', 'lesson1.json'), JSON.stringify({ id: 'lesson1', glossary: [] }));
    fs.writeFileSync(path.join(dir, 'lessons', 'range.json'), JSON.stringify({ id: 'range', kind: 'range', waves: [{ id: 'w', target: 'Make a clear move.' }] }));
    r = run();
    assert.strictEqual(r.status, 1, 'a banned phrase in a range target fails');
    assert.match(r.stdout, /range\.json/);
    // the lesson engine's own lines are scanned too
    fs.writeFileSync(path.join(dir, 'lessons', 'range.json'), JSON.stringify({ id: 'range', kind: 'range', waves: [] }));
    fs.writeFileSync(path.join(dir, 'src', 'lessons.jl'), 'const A = "Keep the boolean result of the table."\n');
    r = run();
    assert.strictEqual(r.status, 1, 'a banned phrase in src/lessons.jl fails');
    assert.match(r.stdout, /lessons\.jl/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- round 11: range rule waves accept every correct way to ask the question ----------------------------
test('range.json: comparison markers, no "detected" loophole, one shared aim line, w7 asks for chance', { skip: !fs.existsSync(path.join(lessonsDir, 'range.json')) }, () => {
  const range = JSON.parse(fs.readFileSync(path.join(lessonsDir, 'range.json'), 'utf8'));
  const AIM = 'Aim with a rule this time: ask each jar a question, do not name the jars or count rows.';
  const accepted = ['in.(', '≠', '≥', '≤', 'isequal', '.>', '.<', '==', '!='];
  const lines = {
    'logbook[in.(logbook.tray_id, Ref(["T-E"])), :]': 'in.(',
    'logbook[isequal.(logbook.tray_id, "T-E"), :]': 'isequal',
    'logbook[logbook.tray_id .≠ "T-D", :]': '≠',
    'logbook[logbook.tray_id .> "T-D", :]': '.>',
  };
  for (const w of range.waves.filter((x) => x.check)) {
    const any = w.check.requires_any;
    // Round 5: w9 (a batch minus one named jar) may name that one jar, so its forbids line says so; no level requires a column or sign it cannot prove.
    assert.strictEqual(w.feedback.requires, AIM, `${w.id}: shared requires line`);
    if (w.id === 'w9') assert.match(w.feedback.forbids, /only Q-053 may be named/);
    else assert.strictEqual(w.feedback.forbids, AIM, `${w.id}: shared forbids line`);
    if (['w7'].includes(w.id)) continue;
    if (w.id !== 'w5') for (const m of accepted) assert.ok(any.includes(m), `${w.id}: requires_any lists ${m}`);
    else assert.ok(any.includes('≠'), 'w5 lists ≠');
    if (['w8', 'w10', 'w11'].includes(w.id)) assert.ok(!any.includes('detected'), `${w.id}: no "detected" marker`);
  }
  const w4 = range.waves.find((x) => x.id === 'w4').check.requires_any;
  for (const [code, marker] of Object.entries(lines)) assert.ok(w4.some((m) => code.includes(m)), `w4 accepts ${marker}: ${code}`);
  const w7 = range.waves.find((x) => x.id === 'w7');
  assert.match(w7.target, /random/i, 'w7 says picked at random');
  assert.match(w7.hint, /chance/i, 'w7 hint nudges toward chance');
});

// ---- 0.5: the range names no case fact and its ids are the practice logbook's ----------------------------
test('range.json: practice1 only, Q- ids, no case names or ids, typed ids are blocked by the Q-0 prefix', { skip: !fs.existsSync(path.join(lessonsDir, 'range.json')) }, () => {
  const text = fs.readFileSync(path.join(lessonsDir, 'range.json'), 'utf8');
  const range = JSON.parse(text);
  assert.strictEqual(range.setup, 'practice1');
  assert.ok(!/J-0\d\d|\bB09\b|\bT-[ABC]\b|\bjars[.\[]|called jars|sim_counts|observed_count|stories|eligible|Dying out|Coin flip|Thriving/.test(text), 'no case fact or case name');
  for (const w of range.waves) {
    // w9 may name Q-053 (its task says so), so it forbids the other five ids of its batch instead of the whole prefix.
    if (w.check && w.id === 'w9') assert.ok(!w.check.forbids.includes('Q-053') && w.check.forbids.every((x) => /^Q-0\d\d$/.test(x)) && w.targets.every((id) => w.check.forbids.includes(id)), 'w9: forbids every id it must not name');
    else if (w.check) assert.deepStrictEqual(w.check.forbids, ['Q-0'], `${w.id}: forbids the practice id prefix`);
    const logbookIds = Array.isArray(w.jars) ? w.jars.map((j) => j.jar_id) : RANGE_JAR_IDS; // a wave's own table (the boss) wins when present
    for (const id of [...(w.targets || []), ...((w.rule && w.rule.from) || [])]) assert.ok(logbookIds.includes(id), `${w.id}: ${id} is in the logbook`);
  }
  assert.deepStrictEqual(range.waves.map((w) => w.unlocks_after), ['lesson1', 'lesson1', 'lesson1', 'lesson2', 'lesson2', 'lesson3', 'lesson4', 'lesson5', 'lesson6', 'lesson6', 'lesson6']);
});

// ---- Exams (kind "exam"): the exemptions reach exam files only ----
test('exams: only kind "exam" files skip the teaching-shape rules, and every exam file gets the exam rules', () => {
  const onDisk = files.filter((f) => JSON.parse(fs.readFileSync(f, 'utf8')).kind === 'exam').map((f) => path.relative(root, f));
  assert.deepStrictEqual(examRuleFiles, onDisk);
  for (const f of realFiles) {
    const l = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (/^lesson\d+\.json$/.test(path.basename(f))) assert.notStrictEqual(l.kind, 'exam', `${path.basename(f)} is a lesson, not an exam`);
    if (/^exam\d+\.json$/.test(path.basename(f))) assert.strictEqual(l.kind, 'exam', `${path.basename(f)} says kind "exam"`);
  }
  // every exam checker is allowed, and each chapter's moves name only its own checkers
  const all = Object.values(EXAM_MOVES).flat();
  assert.ok(all.every((c) => ALLOWED_CHECKERS.includes(c)));
  assert.strictEqual(new Set(all).size, 10);
  assert.deepStrictEqual(Object.keys(EXAM_SETUPS).sort(), all.slice().sort());
});

test('exams: the Julia engine names the same ten checkers and setups as these rules', () => {
  const src = fs.readFileSync(path.join(root, 'src', 'lessons.jl'), 'utf8');
  for (const [name, setup] of Object.entries(EXAM_SETUPS)) {
    const m = new RegExp('"' + name + '" => \\(chapter="C(\\d)", move_id="[a-z-]+", setup="([a-z0-9_]+)"').exec(src);
    assert.ok(m, `${name} is in LESSON_EXAM_CHECKS`);
    assert.strictEqual(m[2], setup, `${name} runs in ${setup}`);
    assert.ok(EXAM_MOVES['C' + m[1]].includes(name), `${name} belongs to chapter C${m[1]}`);
  }
});

test('lesson 3 join round shows both tables; lesson 6 round 2 wording points at the right lesson and line', () => {
  const l3 = JSON.parse(fs.readFileSync(path.join(root, 'lessons', 'lesson3.json'), 'utf8'));
  const join = l3.rounds[2].challenges.filter((c) => c.data === 'book_table' || c.data === 'key_table');
  assert.ok(join.length >= 5);
  for (const c of join) assert.strictEqual(c.data_also, c.data === 'book_table' ? 'key_table' : 'book_table', c.id);
  const l6 = JSON.parse(fs.readFileSync(path.join(root, 'lessons', 'lesson6.json'), 'utf8'));
  const r2 = l6.rounds[1];
  assert.match(r2.remember.prompt, /A quick look back\./);
  assert.match(r2.challenges.find((c) => c.id === 'l6-r2-c3').prompt, /Line 3 joins them/);
});

// ---- 0.5 first-look fixes: each new rule rejects a bad file, and a good one passes ----
for (const [file, expect] of [
  ['bad-py-note-long.json', /py_note is 41 words/],
  ['bad-py-note-emdash.json', /py_note has an em dash/],
  ['bad-py-note-on-checkpoint.json', /py_note only on a see/],
  ['bad-starter-hint-no-blank.json', /needs at least one ___/],
  ['bad-starter-hint-solution.json', /equals or contains the full solution/],
  ['bad-starter-hint-on-see.json', /starter_hint only on a checkpoint/],
  ['bad-minutes.json', /minutes must be an integer from 5 to 60/],
]) {
  test(`negative: ${file} fails the new-field rules`, () => {
    const v = newFieldViolations(bad(file));
    assert.ok(v.some((m) => expect.test(m)), `expected ${expect}, got ${JSON.stringify(v)}`);
  });
}

test('new fields: a clean py_note, starter_hint and minutes pass; every bound is inclusive', () => {
  const l = engine();
  find(l, 'e-r1-c1').py_note = Array(40).fill('word').join(' ');
  find(l, 'e-r2-cp').starter_hint = 'practice_jars[___, :]';
  l.minutes = 5;
  assert.deepStrictEqual(newFieldViolations(l), []);
  l.minutes = 60;
  assert.deepStrictEqual(newFieldViolations(l), []);
  for (const m of [4, 61, 30.5, '30', null]) { l.minutes = m; assert.ok(newFieldViolations(l).length > 0, `minutes ${m}`); }
  delete l.minutes;
  assert.deepStrictEqual(newFieldViolations(l), [], 'minutes is optional');
  find(l, 'e-r2-cp').starter_hint = '';
  assert.ok(newFieldViolations(l).length > 0, 'an empty hint is not a hint');
});

test('four ideas: only lesson2 may have four rounds; every other lesson stops at three', () => {
  const four = bad('bad-four-ideas.json');
  assert.ok(ideaCountViolations(four).some((m) => /4 ideas.*limit is 3.*lesson2/.test(m)));
  assert.deepStrictEqual(ideaCountViolations({ ...four, id: 'lesson2' }), [], 'Lesson 2: four is allowed (Shinichi, 30 Sep 2026)');
  assert.ok(ideaCountViolations({ ...four, id: 'lesson2', rounds: [...four.rounds, four.rounds[0]] }).length > 0, 'Lesson 2: five is not');
  assert.deepStrictEqual(ideaCountViolations({ ...four, id: 'lesson3', rounds: four.rounds.slice(0, 3) }), []);
  assert.ok(ideaCountViolations({ ...four, id: 'lesson3' }).length > 0, 'the exception is not for Lesson 3');
  assert.deepStrictEqual(ideaCountViolations({ ...four, kind: 'exam' }), [], 'an exam has no ideas');
});

test('exam twists: a twist needs value judging, a solution, an empty start and one of the chapter\'s setups', () => {
  const setups = ['case1'];
  const v = twistViolations(bad('bad-exam-twist.json'), setups);
  assert.ok(v.some((m) => /x-twist2: a twist runs in one of the chapter's setups/.test(m)), JSON.stringify(v));
  assert.ok(v.some((m) => /x-twist: a twist is judged by value/.test(m)), 'same_value false is not a twist');
  assert.ok(v.some((m) => /x-twist: a twist starts empty/.test(m)), 'a twist starts empty');
  assert.deepStrictEqual(twistViolations({ id: 'e', kind: 'exam', setup: 'case1', rounds: [{ id: 'r', challenges: [{ id: 't', kind: 'checkpoint', starter: '',
    solution: 'jars', check: { same_value: true } }] }] }, setups), [], 'a clean twist passes');
  assert.deepStrictEqual(twistViolations({ id: 'lesson1', rounds: [] }, setups), [], 'only exams have twists');
});

// ---- Round 2 lints (P03 exam minutes, P05 install line, P07 error and hint lines, P09 language columns and labels,
// P10 notes at first use). Today's violations are the content builders' to-do, listed in test/fixtures/content-todo.json
// ({ "<lint name>": ["<file>|<key>", ...] }). The test fails on a violation that is NOT listed; a listed entry that is
// fixed is ignored (delete it). When the list is empty, or ROUND2_STRICT=1, every violation fails.
const todoFile = path.join(root, 'test', 'fixtures', 'content-todo.json');
const contentTodo = fs.existsSync(todoFile) ? JSON.parse(fs.readFileSync(todoFile, 'utf8')) : {};
const todoKeys = new Set(Object.values(contentTodo).flat());

const cleanLesson = () => ({
  kind: 'lesson', minutes: 30,
  close: { own_work: { say: 's', code: 'using Random\nrand(3)' } },
  dictionary: [{ julia: 'length(x)', means: 'm', r: 'length(x)', py: 'len(x)' }],
  rounds: [{ id: 'r1', challenges: [{ id: 'c1', kind: 'see', prompt: 'Look at the list.', solution: 'length([1])',
    hints: ['Count the items.'], r_note: 'length(x)', py_note: 'len(x)',
    feedback: { errors: [{ match: 'x', say: 'Julia does not know the word.' }, { match: 'y', say: 'Put a comma between them.', code_lacks: ',' }] } }] }],
});
test('round 2 lints: a clean lesson passes; each fault is caught by its own lint', () => {
  const lints = (l, o = {}) => roundTwoLints(l, 'f.json', { isExam: !!o.isExam }).map((x) => x.lint);
  assert.deepStrictEqual(lints(cleanLesson()), []);
  let l = cleanLesson(); l.close.own_work.code = 'using CSV\nCSV.read("a.csv")';
  assert.deepStrictEqual(lints(l), ['P05 own_work install line']);
  l.close.own_work.code = 'using Pkg; Pkg.add("CSV")\nusing CSV';
  assert.deepStrictEqual(lints(l), []);
  l = cleanLesson(); l.rounds[0].challenges[0].feedback.errors[0].say = 'Julia does not know the word. Julia does not know one of the words.';
  assert.deepStrictEqual(lints(l), ['P07 doubled unknown-word sentence']);
  l = cleanLesson(); delete l.rounds[0].challenges[0].feedback.errors[1].code_lacks;
  assert.deepStrictEqual(lints(l), ['P07 comma entry needs a guard']);
  l = cleanLesson(); l.rounds[0].challenges[0].hints = ['Look at the list.'];
  assert.deepStrictEqual(lints(l), ['P07 hint repeats the prompt or an error line']);
  l = cleanLesson(); l.rounds[0].challenges[0].hints = ['Put a comma between them.'];
  assert.deepStrictEqual(lints(l), ['P07 hint repeats the prompt or an error line']);
  l = cleanLesson(); l.rounds[0].challenges[0].py_note = 'Python: len(x)'; l.rounds[0].challenges[0].r_note = 'In R: length(x)';
  assert.deepStrictEqual(lints(l), ['P09 note starts with a language label', 'P09 note starts with a language label']);
  l = cleanLesson(); delete l.dictionary[0].py;
  assert.deepStrictEqual(lints(l), ['P09 dictionary row has no py']);
  l = cleanLesson(); l.dictionary[0].py = 'pandas: len(x)';
  assert.deepStrictEqual(lints(l), ['P09 note starts with a language label']);
  assert.deepStrictEqual(lints({ kind: 'exam', rounds: [] }, { isExam: true }), ['P03 exam minutes']);
  assert.deepStrictEqual(lints({ kind: 'exam', minutes: 2, rounds: [] }, { isExam: true }), ['P03 exam minutes']);
  assert.deepStrictEqual(lints({ kind: 'exam', minutes: 8, rounds: [] }, { isExam: true }), []);
});
test('round 2 lints: a first use of a function or operator needs both an r_note and a py_note', () => {
  const l = cleanLesson();
  assert.deepStrictEqual(firstUseNoteLints([['f.json', l]]), []);
  delete l.rounds[0].challenges[0].py_note;
  assert.strictEqual(firstUseNoteLints([['f.json', l]]).length, 1);
  l.rounds[0].challenges.push({ id: 'c2', kind: 'change', solution: 'length([2])' });   // a second use needs no notes
  assert.strictEqual(firstUseNoteLints([['f.json', l]]).length, 1);
});
test('round 2 lints: real lessons and exams have no violation beyond the content to-do list', () => {
  const found = [], docs = [];
  for (const file of realFiles) {
    const lesson = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (lesson.kind === 'range') continue;
    const name = path.relative(root, file);
    found.push(...roundTwoLints(lesson, name, { isExam: lesson.kind === 'exam' }));
    if (lesson.kind !== 'exam') docs.push([name, lesson]);
  }
  found.push(...firstUseNoteLints(docs));
  const fresh = found.filter((x) => !todoKeys.has(x.key));
  const strict = process.env.ROUND2_STRICT === '1' || todoKeys.size === 0;
  if (found.length === 0) console.log('ROUND2-LINTS-OK');
  else {
    const by = {};
    for (const x of found) (by[x.lint] = by[x.lint] || []).push(x);
    for (const k of Object.keys(by)) console.log(`# ROUND2 to-do, ${k}: ${by[k].length}${by[k].some((x) => !todoKeys.has(x.key)) ? ' (includes NEW)' : ''}`);
  }
  assert.deepStrictEqual((strict ? found : fresh).map((x) => x.msg), [], 'a round 2 lint fails on content not on the to-do list');
});

// tools/notes-run.cjs (P10) decides which part of a note is code. Pin that rule here; the run itself needs Rscript and
// pandas, so it is a separate gate (node tools/notes-run.cjs prints NOTES-RUN-OK).
test('notes-run: the code spans of a note (backticks first, else the leading statement after a label)', () => {
  const { noteSpans } = require('../tools/notes-run.cjs');
  assert.deepStrictEqual(noteSpans('R: practice_jars %>% group_by(tray_id). Julia writes it differently.'), ['practice_jars %>% group_by(tray_id)']);
  assert.deepStrictEqual(noteSpans('desk.keyed.iloc[3] (pandas counts from 0)'), ['desk.keyed.iloc[3]']);
  assert.deepStrictEqual(noteSpans('sum(flags) / length(flags), or mean(flags)'), ['sum(flags) / length(flags)']);
  assert.deepStrictEqual(noteSpans('Python counts from 0; Julia counts from 1.'), []);
  assert.deepStrictEqual(noteSpans('Use `len(x)` and `x.sum()` here.'), ['len(x)', 'x.sum()']);
  assert.deepStrictEqual(noteSpans(undefined), []);
});

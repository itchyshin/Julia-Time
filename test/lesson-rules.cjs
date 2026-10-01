'use strict';
// Mechanical lesson rules, shared by lesson-data.test.cjs (real lessons, plus bad fixtures that must fail).
// Each function takes a parsed lesson and returns a list of violation messages (empty means clean).

const norm = (s) => String(s || '').replace(/\s+/g, '');
const flat = (lesson) => (lesson.rounds || []).flatMap((r) => (r.challenges || []).map((c) => ({ r, c })));
const declaredOf = (c) => [...(c.new_ideas || []), ...(c.new_facts || [])].map((x) => String(x).toLowerCase());

// Operators and their accepted declaring words (a declaring entry must contain the token or one of these words).
const OPERATORS = [
  ['.==', /\.==/, ['dot rule', '.==']],
  ['.!=', /\.!=/, ['dot rule', '.!=']],
  ['.>=', /\.>=/, ['dot rule', '.>=']],
  ['.<=', /\.<=/, ['dot rule', '.<=']],
  ['.&', /\.&/, ['.&', 'and']],
  ['.|', /\.\|/, ['.|', 'or']],
  ['.!', /\.!(?!=)/, ['.!', 'not']],
  ['->', /->/, ['->', 'anonymous']],
  ['|>', /\|>/, ['|>', 'pipe']],
  ['[', /\[/, ['indexing', 'square bracket', '[']],
  [': inside brackets', /\[[^\]]*:[^\]]*\]/, ['indexing', 'alone means all', ':']],
  ['=', /(^|[^=!<>.])=(?!=)/m, ['=', 'assign']],
  ['quoted string', /"[^"]*"/, ['text', 'quote', 'string']],
];

function ideaViolations(lesson) {
  const out = [];
  const seen = new Set();
  const need = (c, label, keywords) => {
    if (seen.has(label)) return;
    seen.add(label);
    if (c.kind !== 'see') { out.push(`${c.id}: first solution using ${label} is not on a see`); return; }
    if (!declaredOf(c).some((d) => keywords.some((w) => d.includes(w)))) out.push(`${c.id}: a see must declare ${label} in new_ideas or new_facts`);
  };
  for (const { c } of flat(lesson)) {
    if (!c.solution || c.kind === 'play') continue;
    if (c.recall) continue;   // typed recall of an earlier lesson's line: not a new idea, so the G3 first-use test skips it
    const sol = c.solution;
    for (const m of sol.matchAll(/(?<![.\w@])([A-Za-z_][A-Za-z0-9_!]*)\(/g)) need(c, `${m[1]}(`, [m[1].toLowerCase()]);
    for (const m of sol.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g)) need(c, `@${m[1]}`, [`@${m[1]}`.toLowerCase()]);
    for (const [tok, re, words] of OPERATORS) if (re.test(sol)) need(c, tok, words);
  }
  for (const r of lesson.rounds || []) {
    let total = 0;
    for (const c of r.challenges || []) {
      const n = (c.new_facts || []).length;
      total += n;
      if (n > 2) out.push(`${c.id}: more than two new_facts`);
      if (n > 0 && c.kind !== 'see') out.push(`${c.id}: new_facts only on a see`);
    }
    if (total > 4) out.push(`${r.id}: more than four new_facts in a round`);
  }
  return out;
}

// Exact leaks: no checkpoint solution (spaces ignored) in any dictionary row, see line, feedback line or hint.
function leakViolations(lesson) {
  const out = [];
  const cs = flat(lesson);
  const sols = cs.filter(({ c }) => c.kind === 'checkpoint' && c.solution).map(({ c }) => ({ id: c.id, sol: norm(c.solution) }));
  const seen = [];
  for (const row of lesson.dictionary || []) seen.push(['dictionary', row.julia, row.means, row.r]);
  for (const { c } of cs) {
    const f = c.feedback || {};
    if (c.kind === 'see') seen.push([`${c.id} see`, c.solution, c.starter, c.prompt]);
    seen.push([`${c.id} feedback`, f.pass, f.wrong, f.requires, f.unchanged, ...((f.errors || []).map((e) => e.say))]);
    if (c.hints && c.hints.length) seen.push([`${c.id} hints`, ...c.hints]);
  }
  for (const [where, ...texts] of seen) for (const t of texts) for (const { id, sol } of sols) {
    if (norm(t).includes(sol)) out.push(`${where} contains the solution of ${id}`);
  }
  return out;
}

// Near-copies: blank string literals and numbers, then compare. A bare name is exempt.
const blank = (s) => norm(String(s || '').replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\d+(\.\d+)?/g, '0'));
function nearCopyViolations(lesson) {
  const out = [];
  const rounds = lesson.rounds || [];
  const roundIndex = Object.fromEntries(rounds.map((r, i) => [r.id, i]));
  rounds.forEach((r, ri) => {
    (r.challenges || []).forEach((cp, ci) => {
      if (cp.kind !== 'checkpoint' || !cp.solution) return;
      const b = blank(cp.solution);
      if (/^[A-Za-z_]\w*$/.test(b)) return;
      const sources = [];
      for (const row of lesson.dictionary || []) {
        const from = roundIndex[row.from_round];
        if (from !== undefined && from <= ri) sources.push(['dictionary', row.julia, row.means, row.r]);
      }
      rounds.slice(0, ri + 1).forEach((rr, i) => (rr.challenges || []).forEach((c, j) => {
        if (i === ri && j > ci) return;
        const f = c.feedback || {};
        if (c.kind === 'see') sources.push([`${c.id} see`, c.solution, c.starter]);
        sources.push([`${c.id} feedback`, f.pass, f.wrong, f.requires, f.unchanged, ...((f.errors || []).map((e) => e.say))]);
        if (c.hints && c.hints.length) sources.push([`${c.id} hints`, ...c.hints]);
        if (c !== cp && c.kind === 'checkpoint') sources.push([`${c.id} solution`, c.solution]);
      }));
      for (const [where, ...texts] of sources) for (const t of texts) {
        if (blank(t).includes(b)) out.push(`${where} is a near-copy of the solution of ${cp.id}`);
      }
    });
  });
  return [...new Set(out)];
}

// Audit 4: a checkpoint prompt must not say its own answer. With spaces removed, the prompt may not contain the
// whole solution, nor any run of 25 characters of it (a solution shorter than 25 characters counts whole).
const RUN = 25;
function promptLeakViolations(lesson) {
  const out = [];
  for (const { c } of flat(lesson)) {
    if (c.kind !== 'checkpoint' || !c.solution) continue;
    const sol = norm(c.solution);
    const prompt = norm(c.prompt);
    if (!sol) continue;
    const width = Math.min(RUN, sol.length);
    for (let i = 0; i + width <= sol.length; i++) {
      if (prompt.includes(sol.slice(i, i + width))) {
        out.push(`${c.id}: the prompt contains ${width === sol.length ? 'the solution' : `a ${RUN}-character run of the solution`}`);
        break;
      }
    }
  }
  return out;
}

// Audit 1, at the data level: a warm-up quiz (round.remember) is answered from memory, so no dictionary row
// visible at that round (from_round reached, this round included) may contain the quiz code, spaces ignored.
function warmupDictionaryViolations(lesson) {
  const out = [];
  const rounds = lesson.rounds || [];
  const roundIndex = Object.fromEntries(rounds.map((r, i) => [r.id, i]));
  rounds.forEach((r, ri) => {
    const q = r.remember;
    if (!q || !q.code) return;
    const code = norm(q.code);
    if (!code) return;
    for (const row of lesson.dictionary || []) {
      const from = roundIndex[row.from_round];
      if (from === undefined || from > ri) continue;
      for (const [field, text] of [['julia', row.julia], ['means', row.means], ['r', row.r]]) {
        if (norm(text).includes(code)) out.push(`${r.id}: dictionary row "${row.julia}" (${field}) contains the warm-up quiz code`);
      }
    }
  });
  return out;
}

// Typed recall (0.5 round 3): a challenge with `recall: true` asks the player to type an earlier lesson's line on this
// lesson's practice data. It is a `write`, the first challenge of round 1, carries no new idea or fact, and no
// dictionary row visible at that round may contain its solution (it is answered from memory, like a warm-up quiz).
function recallViolations(lesson) {
  const out = [];
  const rounds = lesson.rounds || [];
  const roundIndex = Object.fromEntries(rounds.map((r, i) => [r.id, i]));
  rounds.forEach((r, ri) => (r.challenges || []).forEach((c, ci) => {
    if (!c.recall) return;
    if (c.recall !== true) out.push(`${c.id}: recall must be true`);
    if (c.kind !== 'write') out.push(`${c.id}: recall only on a write`);
    if (ci !== 0) out.push(`${c.id}: a recall is the first challenge of its round`);
    if (declaredOf(c).length) out.push(`${c.id}: a recall carries no new idea or fact`);
    if (r.remember) out.push(`${r.id}: a round with a typed recall has no remember quiz`);
    const code = norm(c.solution);
    for (const row of lesson.dictionary || []) {
      const from = roundIndex[row.from_round];
      if (from === undefined || from > ri) continue;
      for (const text of [row.julia, row.means, row.r]) if (code && norm(text).includes(code)) out.push(`${c.id}: dictionary row "${row.julia}" contains the recall line`);
    }
  }));
  return out;
}

// Glossary rules (round 5): optional array; each term unique (case-insensitive); each meaning at most 20 words
// with no em dash. Returns violation messages.
const GLOSSARY_WORDS = 20;
const STORY_WORDS = ['julia', 'tray', 'jar', 'springtail', 'notebook', 'report', 'batch'];
function glossaryViolations(lesson) {
  const out = [];
  if (lesson.glossary === undefined) return out;
  if (!Array.isArray(lesson.glossary)) return ['glossary must be an array'];
  const seen = new Set();
  lesson.glossary.forEach((g, i) => {
    const where = `glossary[${i}]`;
    if (!g || typeof g.term !== 'string' || !g.term.trim()) { out.push(`${where}: needs a term`); return; }
    if (typeof g.means !== 'string' || !g.means.trim()) out.push(`${where} (${g.term}): needs a meaning`);
    const key = g.term.trim().toLowerCase();
    if (seen.has(key)) out.push(`${where}: term "${g.term}" appears twice`);
    seen.add(key);
    const n = String(g.means || '').trim().split(/\s+/).filter(Boolean).length;
    if (n > GLOSSARY_WORDS) out.push(`${where} (${g.term}): meaning has ${n} words, at most ${GLOSSARY_WORDS}`);
    if (String(g.term).includes('\u2014') || String(g.means || '').includes('\u2014')) out.push(`${where} (${g.term}): em dash`);
    // Round 6b: the glossary holds coding words only. A story word (or its plain plural) is left out.
    const words = String(g.term).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
    const story = words.find((w) => STORY_WORDS.some((sw) => w === sw || w === sw + 's' || w === sw + 'es'));
    if (story) out.push(`${where} (${g.term}): "${story}" is a story word; the glossary holds coding words only`);
  });
  return out;
}

// Range rules (round 5), for lessons/range.json (kind "range"). `jarIds` is the list of the 12 case jar ids.
// The Julia test runs each `example` against its own wave; this checks the shape, ids, words and dashes.
const LESSON_IDS = ['lesson1', 'lesson2', 'lesson3', 'lesson4', 'lesson5', 'lesson6'];
const TARGET_WORDS = 20;
const RINGS = ['before', 'after'];
// Round 10: a wave may carry `check: { requires, requires_any, forbids }` like a challenge, with the lines shown on a
// failure in `feedback.requires` and `feedback.forbids` (at most 30 words each). The example must satisfy its own check
// (comments and whitespace are ignored as in the engine); the Julia test runs it for real. `rule.random` (optional
// boolean) switches the chance check of a rule wave off when false.
const WAVE_FEEDBACK_WORDS = 30;
const WAVE_FEEDBACK_KEYS = ['requires', 'forbids', 'errors'];
const WAVE_CHECK_KEYS = ['requires', 'requires_any', 'forbids'];
function waveCheckViolations(w, at) {
  const out = [];
  const strip = (code) => String(code || '').replace(/"(?:[^"\\\n]|\\.)*"|#[^\n]*/g, (m) => (m[0] === '#' ? '' : m));
  for (const key of Object.keys(w.feedback || {})) {
    if (!WAVE_FEEDBACK_KEYS.includes(key)) out.push(`${at}: feedback.${key} is not a known key (use ${WAVE_FEEDBACK_KEYS.join(', ')})`);
  }
  for (const key of ['requires', 'forbids', 'requires_any']) {
    if (w[key] !== undefined) out.push(`${at}: ${key} belongs inside check`);
  }
  if (w.rule && w.rule.random !== undefined && typeof w.rule.random !== 'boolean') out.push(`${at}: rule.random must be true or false`);
  const check = w.check;
  if (check === undefined) {
    for (const key of ['requires', 'forbids']) if (w.feedback && w.feedback[key] !== undefined) out.push(`${at}: feedback.${key} needs a check.${key}`);
    return out;
  }
  if (!check || typeof check !== 'object' || Array.isArray(check)) return [...out, `${at}: check must be an object`];
  for (const key of Object.keys(check)) if (!WAVE_CHECK_KEYS.includes(key)) out.push(`${at}: check.${key} is not a known key (use ${WAVE_CHECK_KEYS.join(', ')})`);
  for (const key of WAVE_CHECK_KEYS) {
    const list = check[key];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length === 0 || !list.every((t) => typeof t === 'string' && t.trim())) {
      out.push(`${at}: check.${key} must be a list of non-empty strings`);
    }
  }
  for (const key of ['requires', 'forbids']) {
    const line = w.feedback && w.feedback[key];
    if (Array.isArray(check[key]) && check[key].length && (typeof line !== 'string' || !line.trim())) out.push(`${at}: check.${key} needs a feedback.${key} line`);
    if (line !== undefined && check[key] === undefined && !(key === 'requires' && Array.isArray(check.requires_any))) out.push(`${at}: feedback.${key} needs a check.${key}`);
    if (typeof line === 'string' && wordCount(line) > WAVE_FEEDBACK_WORDS) out.push(`${at}: feedback.${key} has ${wordCount(line)} words, at most ${WAVE_FEEDBACK_WORDS}`);
  }
  if (Array.isArray(check.requires_any) && check.requires_any.length && !(w.feedback && typeof w.feedback.requires === 'string' && w.feedback.requires.trim())) {
    out.push(`${at}: check.requires_any needs a feedback.requires line`);
  }
  if (typeof w.example === 'string') {
    const bare = strip(w.example);
    const squeezed = bare.replace(/\s+/g, '');
    for (const t of check.requires || []) if (typeof t === 'string' && !bare.includes(t)) out.push(`${at}: the example does not contain required "${t}"`);
    if (Array.isArray(check.requires_any) && check.requires_any.length && !check.requires_any.some((t) => typeof t === 'string' && bare.includes(t))) {
      out.push(`${at}: the example contains none of requires_any`);
    }
    for (const t of check.forbids || []) if (typeof t === 'string' && t && squeezed.includes(t)) out.push(`${at}: the example contains forbidden "${t}"`);
  }
  return out;
}

function rangeViolations(range, jarIds) {
  const out = [];
  const baseJars = new Set(jarIds);
  if (range.kind !== 'range') out.push('kind must be "range"');
  if (!Array.isArray(range.waves) || range.waves.length === 0) return [...out, 'a range needs waves'];
  const ids = new Set();
  for (const w of range.waves) {
    const at = `wave ${w && w.id}`;
    if (!w || !w.id) { out.push('a wave needs an id'); continue; }
    if (ids.has(w.id)) out.push(`${at}: duplicate id`);
    ids.add(w.id);
    if (!LESSON_IDS.includes(w.unlocks_after)) out.push(`${at}: unlocks_after must be one of lesson1 to lesson6`);
    // A wave may carry its own table (w.jars, the boss); its targets and rule ids are checked against that table.
    let jars = baseJars;
    if (w.jars !== undefined) {
      if (!Array.isArray(w.jars) || w.jars.length === 0) out.push(`${at}: jars must be a non-empty list`);
      else {
        const own = w.jars.map((j) => j && j.jar_id);
        if (own.some((id) => typeof id !== 'string' || !id)) out.push(`${at}: every jar needs a jar_id`);
        if (new Set(own).size !== own.length) out.push(`${at}: a jar_id is listed twice`);
        jars = new Set(own);
      }
    }
    if (typeof w.target !== 'string' || !w.target.trim()) out.push(`${at}: needs a target sentence`);
    else if (w.target.trim().split(/\s+/).length > TARGET_WORDS) out.push(`${at}: target is more than ${TARGET_WORDS} words`);
    if (typeof w.hint !== 'string' || !w.hint.trim()) out.push(`${at}: needs a hint`);
    // Round 9: rings "before" or "after" (from wave 3 on the targets are in words only).
    // Round 10: par and sharpshooter scoring are retired; a wave's own rules are `check` (requires, requires_any, forbids).
    if (!RINGS.includes(w.rings)) out.push(`${at}: rings must be "before" or "after"`);
    else if (range.waves.indexOf(w) >= 2 && w.rings !== 'after') out.push(`${at}: rings must be "after" from wave 3 on`);
    if (w.par !== undefined) out.push(`${at}: par is retired (a clean wave earns one star; remove par)`);
    out.push(...waveCheckViolations(w, at));
    if (typeof w.example !== 'string' || !w.example.trim()) out.push(`${at}: needs an example`);
    const hasTargets = Array.isArray(w.targets), hasRule = !!w.rule && typeof w.rule === 'object';
    if (hasTargets === hasRule) out.push(`${at}: needs exactly one of targets or rule`);
    if (hasTargets) {
      if (w.targets.length === 0) out.push(`${at}: targets is empty`);
      for (const t of w.targets) if (!jars.has(t)) out.push(`${at}: target ${t} is not a jar in the notebook`);
      if (new Set(w.targets).size !== w.targets.length) out.push(`${at}: a target is listed twice`);
    }
    if (hasRule) {
      const { count, from } = w.rule;
      if (!Number.isInteger(count) || count < 1) out.push(`${at}: rule.count must be a whole number of at least 1`);
      if (!Array.isArray(from) || from.length === 0) out.push(`${at}: rule.from must list jar ids`);
      else {
        for (const t of from) if (!jars.has(t)) out.push(`${at}: rule.from id ${t} is not a jar in the notebook`);
        if (Number.isInteger(count) && count > new Set(from).size) out.push(`${at}: rule.count is larger than rule.from`);
      }
    }
  }
  if (JSON.stringify(range).includes('\u2014')) out.push('em dash in the range file');
  return out;
}

// Round 9: "That works too". `check.taught` lists substrings of the taught way; a right value that skips one still
// passes and the player is told so. So a taught item must sit in the step's own solution (or the solution itself would
// be told "that works too"), and `feedback.taught` (the way, in words, shown only
// after a pass) needs a `check.taught` to belong to. Whitespace never counts, as in the engine.
const TAUGHT_WORDS = 25, TAUGHT_MAX = 6;
const FEEDBACK_KEYS = ['pass', 'wrong', 'unchanged', 'requires', 'forbids', 'errors', 'taught'];
function taughtViolations(lesson) {
  const out = [];
  for (const { c } of flat(lesson)) {
    for (const key of Object.keys(c.feedback || {})) {
      if (!FEEDBACK_KEYS.includes(key)) out.push(`${c.id}: feedback.${key} is not a known key (use ${FEEDBACK_KEYS.join(', ')})`);
    }
    const taught = c.check && c.check.taught;
    const way = c.feedback && c.feedback.taught;
    if (taught === undefined) {
      if (way !== undefined) out.push(`${c.id}: feedback.taught needs a check.taught`);
      continue;
    }
    if (c.kind === 'play') { out.push(`${c.id}: a play has no check.taught`); continue; }
    if (!Array.isArray(taught) || taught.length === 0 || taught.length > TAUGHT_MAX || !taught.every((t) => typeof t === 'string' && norm(t))) {
      out.push(`${c.id}: check.taught must be a list of 1 to ${TAUGHT_MAX} non-empty strings`);
      continue;
    }
    for (const t of taught) {
      if (typeof c.solution !== 'string') continue;
      // an item with a newline keeps the line breaks (spaces and tabs go); any other item ignores all whitespace
      const keepLines = (x) => x.replace(/[ \t\r]+/g, '');
      const inSolution = t.includes('\n') ? keepLines(c.solution).includes(keepLines(t)) : norm(c.solution).includes(norm(t));
      if (!inSolution) out.push(`${c.id}: taught item "${t.trim()}" is not in the step's own solution`);
    }
    if (way !== undefined) {
      if (typeof way !== 'string' || !way.trim()) out.push(`${c.id}: feedback.taught is empty`);
      else {
        if (wordCount(way) > TAUGHT_WORDS) out.push(`${c.id}: feedback.taught has ${wordCount(way)} words, at most ${TAUGHT_WORDS}`);
        if (way.includes('\u2014')) out.push(`${c.id}: feedback.taught has an em dash`);
      }
    }
  }
  return out;
}

// Round 6 rules: labels, close.can_do, close.common_mistake, look_closer, glossary coverage.
const LABEL_KINDS = ['function', 'object', 'input', 'inputs', 'indexing', 'operator', 'result', 'repeat', 'named input'];
const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

function labelViolations(lesson) {
  const out = [];
  for (const { c } of flat(lesson)) {
    if (c.labels === undefined) continue;
    if (!Array.isArray(c.labels)) { out.push(`${c.id}: labels must be an array`); continue; }
    if (c.kind !== 'see') out.push(`${c.id}: labels only on a see`);
    c.labels.forEach((l, i) => {
      if (!l || typeof l.part !== 'string' || !l.part) out.push(`${c.id}: label ${i} needs a part`);
      else if (typeof l.is !== 'string' || !l.is.trim()) out.push(`${c.id}: label "${l.part}" needs an "is"`);
      // One word must be a known kind (a typo such as "funtion" or "results" fails). A plain phrase of two or more
      // words ("a list name", as Lesson 3 uses) is shown as written.
      else if (!/\s/.test(l.is.trim()) && !LABEL_KINDS.includes(l.is.trim())) out.push(`${c.id}: label "${l.part}" has is "${l.is}", one of ${LABEL_KINDS.join(', ')}, or a short phrase`);
    });
  }
  return out;
}

// close.can_do: two or three statements of at most 12 words. close.common_mistake: one sentence of at most 25 words.
// `required` is false only for the engine fixture, which has no course text.
const CAN_DO_WORDS = 12, MISTAKE_WORDS = 25;
function closeViolations(lesson, required = true) {
  const out = [];
  const close = lesson.close || {};
  if (close.can_do === undefined) { if (required) out.push('close.can_do is missing'); }
  else if (!Array.isArray(close.can_do) || close.can_do.length < 2 || close.can_do.length > 3) out.push('close.can_do needs 2 or 3 items');
  else close.can_do.forEach((t, i) => {
    if (typeof t !== 'string' || !t.trim()) out.push(`close.can_do[${i}] is empty`);
    else if (wordCount(t) > CAN_DO_WORDS) out.push(`close.can_do[${i}] has ${wordCount(t)} words, at most ${CAN_DO_WORDS}`);
    if (String(t).includes('—')) out.push(`close.can_do[${i}]: em dash`);
  });
  if (close.common_mistake === undefined) { if (required) out.push('close.common_mistake is missing'); }
  else if (typeof close.common_mistake !== 'string' || !close.common_mistake.trim()) out.push('close.common_mistake is empty');
  else {
    if (wordCount(close.common_mistake) > MISTAKE_WORDS) out.push(`close.common_mistake has ${wordCount(close.common_mistake)} words, at most ${MISTAKE_WORDS}`);
    if (close.common_mistake.includes('—')) out.push('close.common_mistake: em dash');
  }
  return out;
}

// look_closer: on a see, at most one per round, text at most 40 words, code present.
const LOOK_WORDS = 40;
function lookCloserViolations(lesson) {
  const out = [];
  for (const r of lesson.rounds || []) {
    let n = 0;
    (r.challenges || []).forEach((c, i) => {
      const lc = c.look_closer;
      if (lc === undefined) return;
      n += 1;
      if (i === 0) out.push(`${c.id}: look_closer never on a round's first challenge (test-out owns that screen)`);
      if (c.kind !== 'see') out.push(`${c.id}: look_closer only on a see`);
      if (!lc || typeof lc !== 'object') { out.push(`${c.id}: look_closer must be an object`); return; }
      if (typeof lc.text !== 'string' || !lc.text.trim()) out.push(`${c.id}: look_closer needs text`);
      else if (wordCount(lc.text) > LOOK_WORDS) out.push(`${c.id}: look_closer text has ${wordCount(lc.text)} words, at most ${LOOK_WORDS}`);
      if (typeof lc.code !== 'string' || !lc.code.trim()) out.push(`${c.id}: look_closer needs code`);
      if (String(lc.text || '').includes('\u2014')) out.push(`${c.id}: look_closer text has an em dash`);
    });
    if (n > 1) out.push(`${r.id}: more than one look_closer in a round`);
  }
  return out;
}

// Glossary coverage: the screen underlines a term only in explain, prompt, the first two hints, the predict question,
// the remember prompt and the feedback lines it shows (pass, wrong, forbids, errors). `requires`, `unchanged` and
// hints past the second are never underlined. A term that matches none of them is a dead entry. The matcher is the
// screen's own (web/lesson.js termRegex): whole words, case-insensitive, a plain plural counts, and a sign term
// (=, .==, !=) never matches inside a longer sign.
function termRegex(term, flags) {
  const t = String(term), esc = t.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const wordStart = /^[A-Za-z0-9_]/.test(t), wordEnd = /[A-Za-z0-9_]$/.test(t);
  const before = wordStart ? '(?<![A-Za-z0-9_])' : '(?<![.!=<>&|])';
  const after = wordEnd ? '(?:e?s)?(?![A-Za-z0-9_])' : '(?![=<>&|])';
  return new RegExp(before + esc + after, flags === undefined ? 'i' : flags);
}
function underlinedTexts(lesson) {
  const t = [];
  for (const r of lesson.rounds || []) {
    t.push(r.explain);
    if (r.remember) t.push(r.remember.prompt);
    for (const c of r.challenges || []) {
      t.push(c.prompt, ...(c.hints || []).slice(0, 2));
      if (c.predict) t.push(c.predict.question);
      const f = c.feedback || {};
      t.push(f.pass, f.wrong, f.forbids, ...((f.errors || []).map((e) => e.say)));
    }
  }
  return t.filter((x) => typeof x === 'string' && x);
}
function glossaryCoverageViolations(lesson) {
  if (!Array.isArray(lesson.glossary)) return [];
  const texts = underlinedTexts(lesson);
  return lesson.glossary.filter((g) => g && typeof g.term === 'string' && g.term)
    .filter((g) => !texts.some((x) => termRegex(g.term).test(x)))
    .map((g) => `glossary term "${g.term}" appears in no underlined field (explain, prompt, first two hints, predict, remember, pass, wrong, forbids, errors)`);
}

// Round 6b: a checkpoint's `requires` and `forbids` lines name the goal, not the code. They may not contain a function
// or a column that is in the checkpoint's own solution, and may not claim a right value ("Right number"), because the
// line can show for a wrong value.
function solutionNames(solution) {
  const fns = new Set(), cols = new Set();
  const code = String(solution || '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
  for (const m of code.matchAll(/(?<![A-Za-z0-9_.@])([A-Za-z_][A-Za-z0-9_!]*)\.?\(/g)) fns.add(m[1]);
  for (const m of code.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_]*\()/g)) cols.add(m[1]);
  for (const m of code.matchAll(/(?<![\w\]\)]):([A-Za-z_][A-Za-z0-9_]*)/g)) cols.add(m[1]);
  return { fns: [...fns], cols: [...cols] };
}
function checkpointLineViolations(lesson) {
  const out = [];
  for (const { c } of flat(lesson)) {
    if (c.kind !== 'checkpoint') continue;
    const f = c.feedback || {};
    const { fns, cols } = solutionNames(c.solution);
    for (const key of ['requires', 'forbids']) {
      const line = f[key];
      if (typeof line !== 'string' || !line) continue;
      for (const name of [...fns, ...cols]) {
        if (new RegExp('(?<![A-Za-z0-9_])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_])', 'i').test(line)) {
          out.push(`${c.id}: feedback.${key} names "${name}", which is in the checkpoint solution`);
        }
      }
      if (/\bright (number|answer|value)\b/i.test(line)) out.push(`${c.id}: feedback.${key} says the value is right; it can show for a wrong value`);
    }
  }
  return out;
}

// Every `data` name a challenge shows must be bound by the lesson's setup. `stored` is
// test/fixtures/lesson-data-values.json (the engine's own dump, which a Julia test keeps current): a name the setup
// does not bind is left out of `data_values`, so it is missing here. Pass `null` to skip (the engine fixture).
function dataNameViolations(lesson, stored) {
  const out = [];
  const entry = stored && stored[lesson.id];
  if (!entry) return out;
  for (const { c } of flat(lesson)) {
    if (c.data && !(entry.data_values && c.data in entry.data_values)) {
      out.push(`${c.id}: data "${c.data}" is not bound by setup "${lesson.setup}" (add it to lesson_env and run tools/lesson-dump-data.jl)`);
    }
  }
  return out;
}

// ---- 0.5 first-look fixes: py_note, starter_hint, minutes, the Lesson 2 four-idea exception, exam twists ----
const PY_NOTE_WORDS = 40, STARTER_HINT_WORDS = 40, MINUTES_MIN = 5, MINUTES_MAX = 60;
// Shinichi's exception (30 Sep 2026, decision 10 in docs/dev-log/course/0.5-fix-spec.md): Lesson 2 has four ideas
// (four rounds), because round 3 split into "count by group" and "add a rate column". Every other lesson keeps three.
const FOUR_IDEA_LESSON = 'lesson2';
const maxIdeas = (lesson) => (lesson.id === FOUR_IDEA_LESSON ? 4 : 3);
const isExamLesson = (lesson) => lesson.kind === 'exam';
const hasEmDash = (s) => String(s).includes('—');

// One idea per round, so at most maxIdeas(lesson) rounds.
function ideaCountViolations(lesson) {
  const out = [];
  const n = (lesson.rounds || []).length;
  if (isExamLesson(lesson) || lesson.kind === 'range') return out;
  if (n > maxIdeas(lesson)) {
    out.push(`${lesson.id}: ${n} ideas (rounds); the limit is ${maxIdeas(lesson)}` +
      (lesson.id === FOUR_IDEA_LESSON ? '' : ` (only ${FOUR_IDEA_LESSON} may have four: Shinichi's exception, 30 Sep 2026)`));
  }
  return out;
}

// py_note (a see, at most 40 words, no em dash, same places as r_note), starter_hint (a checkpoint: a partial line with
// at least one ___ and never the whole solution), minutes (an integer, 5 to 60, on the lesson).
function newFieldViolations(lesson) {
  const out = [];
  const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  if ('minutes' in lesson) {
    const m = lesson.minutes;
    if (!Number.isInteger(m) || m < MINUTES_MIN || m > MINUTES_MAX) out.push(`${lesson.id}: minutes must be an integer from ${MINUTES_MIN} to ${MINUTES_MAX}`);
  }
  for (const { c } of flat(lesson)) {
    if ('py_note' in c) {
      if (typeof c.py_note !== 'string' || !c.py_note.trim()) out.push(`${c.id}: py_note must be a non-empty string`);
      else {
        if (c.kind !== 'see') out.push(`${c.id}: py_note only on a see (where r_note may be)`);
        if (isExamLesson(lesson)) out.push(`${c.id}: no py_note in an exam`);
        if (words(c.py_note) > PY_NOTE_WORDS) out.push(`${c.id}: py_note is ${words(c.py_note)} words, at most ${PY_NOTE_WORDS}`);
        if (hasEmDash(c.py_note)) out.push(`${c.id}: py_note has an em dash`);
      }
    }
    if ('starter_hint' in c) {
      const h = c.starter_hint;
      if (typeof h !== 'string' || !h.trim()) { out.push(`${c.id}: starter_hint must be a non-empty string`); continue; }
      if (c.kind !== 'checkpoint') out.push(`${c.id}: starter_hint only on a checkpoint or a chapter step`);
      if (!h.includes('___')) out.push(`${c.id}: starter_hint needs at least one ___ blank`);
      if (words(h) > STARTER_HINT_WORDS) out.push(`${c.id}: starter_hint is ${words(h)} words, at most ${STARTER_HINT_WORDS}`);
      if (hasEmDash(h)) out.push(`${c.id}: starter_hint has an em dash`);
      const sol = norm(c.solution);
      if (sol && (norm(h) === sol || norm(h).includes(sol))) out.push(`${c.id}: starter_hint equals or contains the full solution`);
    }
  }
  return out;
}

// A chapter twist: an exam round whose check has no checker, "same_value": true, a solution, an empty start, and a setup
// that is one of the chapter's own (so it runs on the chapter's real data). `allowedSetups` is that list.
const isTwist = (c) => !(c.check && c.check.checker);
function twistViolations(lesson, allowedSetups) {
  const out = [];
  if (!isExamLesson(lesson)) return out;
  for (const { r, c } of flat(lesson)) {
    if (!isTwist(c)) continue;
    const at = c.id;
    if (c.kind !== 'checkpoint') out.push(`${at}: a twist is a checkpoint`);
    if (c.starter !== '') out.push(`${at}: a twist starts empty`);
    if (!(c.check && c.check.same_value === true)) out.push(`${at}: a twist is judged by value (same_value true)`);
    if (!(typeof c.solution === 'string' && c.solution.trim())) out.push(`${at}: a twist has a solution`);
    if (!allowedSetups.includes(r.setup || lesson.setup)) out.push(`${at}: a twist runs in one of the chapter's setups (${allowedSetups.join(', ')})`);
  }
  return out;
}


// ---- P11 pattern library (used by test/lesson-patterns.test.cjs and the P10 note lint) ----------------------------------
const fs = require('node:fs');
const path = require('node:path');
const lessonsDir = path.join(__dirname, '..', 'lessons');
// ---- code preparation ----------------------------------------------------------------------------------------
// Strings become "" (their text is not code) and comments go, like the exam-fit gate does.
function bare(code) {
  return String(code || '')
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/#[^\n]*/g, '');
}
// Each call `name(` with whether it sits inside another call's parentheses (a grouping paren is not a call).
function calls(code) {
  const out = [];
  const stack = [];
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '(') {
      const m = /([A-Za-z_][A-Za-z0-9_!]*)$/.exec(code.slice(0, i));
      if (m) out.push({ name: m[1], nestedInCall: stack.some(Boolean) });
      stack.push(!!m);
    } else if (ch === ')') stack.pop();
  }
  return out;
}

// ---- the patterns ---------------------------------------------------------------------------------------------
const SYMBOL = '[A-Za-z_][A-Za-z0-9_]*';
const PATTERNS = [
  ['a list built with for: [... for _ in ...]', (c) => /\[[^\]]*\bfor\s+\w+\s+in\b/.test(c), { prose: true }],
  ['a rule inside a column\'s brackets: table.column[rule]', (c) => (c.match(new RegExp(`\\b${SYMBOL}\\.${SYMBOL}\\[[^\\]]*\\]`, 'g')) || [])
    .some((t) => !/\[\s*(?:-?\d+|end|\d+\s*:\s*\d+|:|_{3})?\s*\]$/.test(t) && !/\[\s*\d+\s*:\s*(?:end|\d+)\s*\]$/.test(t))],
  ['rows picked by a rule, then all columns: table[rule, :]', (c) => /\b\w+\[[^\[\]]*\.(?:==|!=|>=|<=|>|<|&|\|)[^\[\]]*,\s*:\s*\]/.test(c) || /\b\w+\[\s*(?!\d|end|_{3})[A-Za-z_]\w*\s*,\s*:\s*\]/.test(c)],
  ['a column of the picked rows: table[rule, :].column', (c) => /\]\s*\.[A-Za-z_]\w*/.test(c) && /\[[^\]]*,\s*:\s*\]\s*\.[A-Za-z_]/.test(c)],
  ['a bare groupby (not inside combine)', (c) => {
    for (const m of c.matchAll(/(?<![\w.])groupby\(/g)) { if (!/combine\(\s*$/.test(c.slice(0, m.index))) return true; }
    return false;
  }],
  ['the three-part pair :a => f => :b', (c) => new RegExp(`:${SYMBOL}\\s*=>\\s*[A-Za-z_][\\w.]*\\s*=>\\s*:${SYMBOL}`).test(c)],
  ['a named input after a semicolon: f(x; name=value)', (c) => /\([^()]*;\s*[A-Za-z_]\w*\s*=(?!=)/.test(c)],
  ['a named input after a comma: f(x, name=value)', (c) => /,\s*[A-Za-z_]\w*\s*=(?![=>])/.test(c.replace(/\[[^\]]*\]/g, '[]')) && calls(c).length > 0 && /\([^()]*,\s*[A-Za-z_]\w*\s*=(?![=>])/.test(c)],
  ['a column name as a symbol: :name', (c) => /(?<![\w:\]}\)])\s*:[A-Za-z_]\w*/.test(c.replace(/\[\s*[^\]]*,\s*:\s*\]/g, '[]')) || /[(,=>]\s*:[A-Za-z_]/.test(c)],
  ['a two-part pair: what => :name', (c) => new RegExp(`\\b\\w+\\s*=>\\s*:${SYMBOL}`).test(c)],
  ['a pipe: |>', (c) => /\|>/.test(c)],
  ['an anonymous function: x -> ...', (c) => /->/.test(c)],
  ['one call inside another call: f(g(...))', (c) => calls(c).some((k) => k.nestedInCall)],
  ['dot and: .&', (c) => /\.&/.test(c), { prose: true }],
  ['dot or: .|', (c) => /\.\|/.test(c), { prose: true }],
  ['dot not: .!', (c) => /\.!(?!=)/.test(c), { prose: true }],
  ['not: !', (c) => /(?<![\w.!=<>])!(?!=)/.test(c), { prose: true }],
  ['dot not-equal: .!=', (c) => /\.!=/.test(c), { prose: true }],
  ['dot divide: ./', (c) => /\.\//.test(c), { prose: true }],
  ['a range a:b', (c) => /(?<![:\w])(?:\d+|[A-Za-z_]\w*)\s*:\s*(?:\d+|[A-Za-z_]\w*|end)\b/.test(c.replace(/,\s*:\s*\]/g, ']')), { prose: true }],
  ['the all-columns colon: [rows, :]', (c) => /,\s*:\s*\]/.test(c)],
  ['first(', (c) => calls(c).some((k) => k.name === 'first')],
  ['sample(', (c) => calls(c).some((k) => k.name === 'sample')],
  ['leftjoin(', (c) => calls(c).some((k) => k.name === 'leftjoin')],
  ['Random.seed!', (c) => /\bRandom\.seed!/.test(c) || /\bseed!\(/.test(c)],
  ['a name on the left of = inside a blank line: ___ = ', (c) => /___\s*=(?!=)/.test(c), { taughtBy: (c) => /^\s*[A-Za-z_]\w*\s*=(?!=)/m.test(c) }],
];

// ---- reading the course ----------------------------------------------------------------------------------------
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8'));
const exists = (f) => fs.existsSync(path.join(lessonsDir, f));

// Every code source in a lesson or exam as { id, role, code }. role "code": a see line's code or a look_closer code
// (teaches any pattern); "prose": explain text, a see's prompt, a look_closer text (teaches only the patterns marked
// prose, the small syntax pieces); "use": any other line's code (a starter, a solution, a warm-up quiz). A
// starter_hint has blanks for the answer, so it is not read as a use (its solution is).
function sourcesOf(doc) {
  const out = [];
  const add = (id, role, code) => { if (typeof code === 'string' && code.trim()) out.push({ id, role, code: bare(code) }); };
  for (const r of doc.rounds || []) {
    if (r.remember) add(`${r.id} (warm-up quiz)`, 'use', r.remember.code);
    add(`${r.id} (explain)`, 'prose', r.explain);
    for (const c of r.challenges || []) {
      if (c.kind === 'see') {
        add(c.id, 'code', c.starter); add(c.id, 'code', c.solution); add(c.id, 'prose', c.prompt);
        if (c.look_closer) { add(c.id, 'code', c.look_closer.code); add(c.id, 'prose', c.look_closer.text); }
      } else {
        add(c.id, 'use', c.starter); add(c.id, 'use', c.solution);
      }
    }
  }
  return out;
}
const teaches = (s, [, fn, opts]) => (s.role === 'code' && ((opts && opts.taughtBy) || fn)(s.code)) ||
  (s.role === 'prose' && !!(opts && opts.prose) && fn(s.code));
const uses = (s, [, fn]) => s.role === 'use' && fn(s.code);
// The violations over the whole course, in course order: a lesson line that uses a pattern no earlier line taught,
// then every chapter exam line against what Lessons 1 to N taught.
function violationsOf(docs) {
  const out = [];
  const reported = new Set();
  const taught = new Set();
  const taughtByLesson = {};
  for (let n = 1; n <= 6; n++) {
    const doc = docs.lessons[n];
    if (doc) for (const s of sourcesOf(doc)) {
      for (const pat of PATTERNS) {
        const name = pat[0];
        if (teaches(s, pat)) taught.add(name);
        else if (uses(s, pat) && !taught.has(name) && !reported.has(`${s.id}|${name}`)) {
          reported.add(`${s.id}|${name}`);
          out.push({ where: `lesson${n}`, id: s.id, pattern: name, key: `${s.id}|${name}` });
        }
      }
    }
    taughtByLesson[n] = new Set(taught);
  }
  for (let n = 1; n <= 6; n++) {
    const ex = docs.exams[n];
    if (!ex) continue;
    // Chapter N follows Lesson N at once: a pattern its lines use must be taught in Lessons 1 to N, and Lesson N
    // itself must show or practise it (a learner meets it again just before the chapter, not five lessons ago).
    const own = docs.lessons[n] ? sourcesOf(docs.lessons[n]) : [];
    for (const s of sourcesOf(ex)) for (const pat of PATTERNS) {
      const name = pat[0];
      if (!uses(s, pat) || reported.has(`${s.id}|${name}`)) continue;
      const gap = !taughtByLesson[n].has(name) ? 'not taught in Lessons 1 to ' + n : (own.some((o) => teaches(o, pat) || uses(o, pat)) ? null : `Lesson ${n} never shows or practises it`);
      if (!gap) continue;
      reported.add(`${s.id}|${name}`);
      out.push({ where: `exam${n}`, id: s.id, pattern: name, key: `${s.id}|${name}`, why: gap });
    }
  }
  return out;
}
function loadCourse() {
  const docs = { lessons: {}, exams: {} };
  for (let n = 1; n <= 6; n++) {
    if (exists(`lesson${n}.json`)) docs.lessons[n] = readJson(`lesson${n}.json`);
    if (exists(`exam${n}.json`)) docs.exams[n] = readJson(`exam${n}.json`);
  }
  return docs;
}



// ---- Round 2 lints (P03, P05, P07, P09, P10). Each returns { lint, key, msg } items; the data test compares the keys to
// test/fixtures/content-todo.json (today's violations, the content builders' to-do) and fails on any key not listed. ---
const LABEL_START = /^\s*(?:In\s+)?(?:R|Python|pandas|numpy)\s*:/i;
const STDLIB = new Set(['Base', 'Random', 'Statistics', 'Pkg', 'Printf', 'Dates', 'LinearAlgebra']);
const normText = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
function roundTwoLints(lesson, file, { isExam }) {
  const out = [];
  const add = (lint, key, msg) => out.push({ lint, key: `${file}|${key}`, msg: `${file}: ${msg}` });
  // P03: a chapter exam carries its minutes (integer 3 to 60) for the start card and the Board.
  if (isExam && !(Number.isInteger(lesson.minutes) && lesson.minutes >= 3 && lesson.minutes <= 60)) add('P03 exam minutes', 'minutes', 'an exam needs minutes (integer, 3 to 60)');
  // P05: own work that loads a package starts with the first-time install line.
  const code = lesson.close && lesson.close.own_work && lesson.close.own_work.code;
  if (typeof code === 'string') {
    const used = [...code.matchAll(/\busing\s+([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]).filter((x) => !STDLIB.has(x));
    if (used.length && !/Pkg\.add/.test(code)) add('P05 own_work install line', 'own_work', `close.own_work uses ${used.join(', ')} but has no Pkg.add line`);
  }
  for (const { c } of flat(lesson)) {
    const errs = (c.feedback && c.feedback.errors) || [];
    const says = errs.map((e) => e.say || '');
    // P07: one sentence about an unknown word per entry; no hint repeats the prompt or an error line; a comma entry is guarded.
    errs.forEach((e, i) => {
      const say = e.say || '';
      if (/does not know the word/i.test(say) && /does not know one of/i.test(say)) add('P07 doubled unknown-word sentence', `${c.id}|both-unknown|${i}`, `${c.id}: error entry ${i} says both "does not know the word" and "does not know one of"`);
      if (/comma/i.test(say) && !('code_lacks' in e) && !('code_has' in e)) add('P07 comma entry needs a guard', `${c.id}|comma|${i}`, `${c.id}: error entry ${i} mentions a comma with no code_has or code_lacks`);
    });
    (c.hints || []).forEach((h, i) => {
      const hh = normText(h);
      if (!hh) return;
      if (normText(c.prompt).includes(hh) || says.some((sy) => normText(sy).includes(hh))) add('P07 hint repeats the prompt or an error line', `${c.id}|hint${i}`, `${c.id}: hint ${i + 1} is already in the prompt or an error line`);
    });
    // P09: no note starts with a language label.
    for (const k of ['r_note', 'py_note']) if (typeof c[k] === 'string' && LABEL_START.test(c[k])) add('P09 note starts with a language label', `${c.id}|${k}-label`, `${c.id}: ${k} starts with a language label`);
  }
  // P09: every dictionary row has a py column, and no r or py cell starts with a language label.
  if (!isExam && Array.isArray(lesson.dictionary)) {
    const noPy = lesson.dictionary.filter((row) => typeof row.py !== 'string' || !row.py.trim()).map((row) => row.julia);
    if (noPy.length) add('P09 dictionary row has no py', 'dictionary-py', `${noPy.length} of ${lesson.dictionary.length} dictionary rows have no py (${noPy.slice(0, 4).join(' | ')}${noPy.length > 4 ? ' ...' : ''})`);
    for (const row of lesson.dictionary) for (const k of ['r', 'py']) if (typeof row[k] === 'string' && LABEL_START.test(row[k])) add('P09 note starts with a language label', `dict|${row.julia}|${k}-label`, `dictionary row ${row.julia}: ${k} starts with a language label`);
  }
  return out;
}

// P10 lint: across Lessons 1 to 6 in order, the first challenge that uses a function, an operator or a named pattern
// carries both an r_note and a py_note. Returns { lint, key, msg } items.
const NOTE_OPERATORS = [['.==', /\.==/], ['.!=', /\.!=/], ['.>=', /\.>=/], ['.<=', /\.<=/], ['.&', /\.&/], ['.|', /\.\|/], ['.!', /\.!(?!=)/], ['./', /\.\//], ['=>', /=>/], ['|>', /\|>/], ['->', /->/]];
function firstUseNoteLints(docsByFile) {
  const out = [];
  const seen = new Set();
  for (const [file, lesson] of docsByFile) {
    for (const { c } of flat(lesson)) {
      if (c.kind === 'play') continue;
      const code = bare([c.solution, c.kind === 'see' ? c.starter : ''].join('\n'));
      const toks = [];
      for (const m of code.matchAll(/(?<![\w.@])([A-Za-z_][A-Za-z0-9_!]*)\(/g)) toks.push(`${m[1]}(`);
      for (const [op, re] of NOTE_OPERATORS) if (re.test(code)) toks.push(op);
      for (const pat of PATTERNS) if (pat[1](code)) toks.push(pat[0]);
      const fresh = [...new Set(toks)].filter((t) => !seen.has(t));
      fresh.forEach((t) => seen.add(t));
      if (!fresh.length) continue;
      const missing = ['r_note', 'py_note'].filter((k) => typeof c[k] !== 'string' || !c[k].trim());
      if (missing.length) out.push({ lint: 'P10 first use has both notes', key: `${file}|${c.id}|notes`, msg: `${file}: ${c.id} first uses ${fresh.slice(0, 3).join(', ')}${fresh.length > 3 ? ' ...' : ''} but has no ${missing.join(' or ')}` });
    }
  }
  return out;
}

module.exports = { roundTwoLints, firstUseNoteLints, LABEL_START, PATTERNS, calls, bare, sourcesOf, teaches, uses, violationsOf, loadCourse, newFieldViolations, ideaCountViolations, twistViolations, isTwist, maxIdeas, dataNameViolations, ideaViolations, leakViolations, nearCopyViolations, promptLeakViolations, warmupDictionaryViolations, recallViolations,
  glossaryViolations, rangeViolations, labelViolations, closeViolations, lookCloserViolations, glossaryCoverageViolations, checkpointLineViolations, taughtViolations };

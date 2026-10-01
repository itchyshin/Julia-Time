'use strict';
// P03 / P05 / P09 / P27 and the round-2 decisions: words and phrases the game has RETIRED must not come back on a
// screen a player reads. A retired string is a phrase the vocabulary table or a round-2 decision removed.
//
// What is scanned (learner-facing text only):
//   lessons/*.json   every string VALUE (keys are not text). Ids and setup names have no space and are skipped for the
//                    single-word rules.
//   web/*.html, web/*.js, web/course/*.html, web/course/*.js, web/chapter files   text nodes and string literals.
//   src/lessons.jl   string literals (the engine's feedback lines).
// Never scanned: the Original chapter files that gate I7 protects (web/course/course-state.js, legacy-import.js,
// chapter.html, chapter-route.js, ending.js, and src/mystery*.jl), the vendor directories and test fixtures.
//
// CONTENT TO-DO. KNOWN_TODO lists the hits that exist today, as "file: phrase" keys. The test fails on any hit NOT on
// the list (so nothing new comes back), prints the list, and ignores a listed entry that is already fixed. When
// KNOWN_TODO is empty, or RETIRED_STRICT=1, every hit fails.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// [label, regex, why]. A regex runs over one string at a time. "spaced" rules skip a string with no whitespace
// (a class name, an id, a key), which is never a sentence a player reads.
const RETIRED = [
  ['Case closed', /\bCase closed\b/i, 'the Board says "All six chapters done" while the recheck is open (round 2 decision)'],
  ['Part N (a unit called Part)', /\bPart [1-6]\b/, 'one vocabulary: Step N, Lesson N, Chapter N, never Part (covers "Part 1 done", "Part 2 done", "Part 3 done")'],
  ['teal', /\bteal\b/i, 'chapter endings use the 0.5 wording (no "teal")'],
  ['Show the full answer', /Show the full answer/i, 'help is a hint or a starter line, not the full answer'],
  ['Stuck? Hints', /Stuck\?\s*Hints?/i, 'the help button wording is one piece of help'],
  ['Print cheat sheet', /Print cheat sheet/i, 'P05: "Print the pocket dictionary"'],
  ['Here site is', /Here site is/, 'P05: "Here, site is one column of your table"'],
  ['the answer to the case', /the answer to the case/i, 'P05: "Your chapter line"'],
  ['Clues: N', /\bClues?:\s*(\d|N\b)/, 'round 2 decision: no Clues counter; each clue is "Worth remembering:"'],
  ['saved for the end', /saved for the end/i, 'round 2 decision: no clue counter'],
  ['a language question', /Do you know R,? (or )?Python/i, 'P09: two switches, no language question'],
  ['Notes: label', /^Notes:\s*$/, 'P09: no "Notes:" label anywhere'],
  ['Continue: Step N', /Continue: Step \d/, 'round 2 decision: "Continue: Lesson 3" and "Continue: Chapter 3"'],
  ['Line N of M (a counter)', /\bLine \d+ of \d+\b/, 'round 2 decision: the counter is "Task 3 of 6"'],
  ['wave', /\bwaves?\b/i, 'target range units are levels'],
  ['challenge (on screen)', /(?<!Unknown )\bchallenges?\b/i, 'the small task is a task (vocabulary table); "challenge mode" is long gone'],
  ['a setup id (practiceN)', /\bpractice[1-6]\b/, 'the practice data has a plain name, not its setup id'],
];

// Files the Original chapters own (gate I7): their wording is frozen, so they are never scanned.
const PROTECTED = new Set([
  'web/course/course-state.js', 'web/course/legacy-import.js', 'web/course/chapter.html', 'web/course/chapter-route.js',
  'web/course/ending.js',
]);
// The Original chapter pages (the case as first built, frozen by gate I7): web/chapterN.html|js|css, index.html,
// mystery.js, app.js. They keep their own wording ("Part 1 of 3", "Stuck? Hints", "teal").
const isOriginal = (rel) => /^web\/(chapter\d\.(html|js)|index\.html|mystery\.js|app\.js)$/.test(rel);
const SKIP_DIRS = new Set(['vendor', 'assets', 'fixtures', 'node_modules', 'mystery']);

const jsonStrings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => jsonStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => jsonStrings(x, out));
  return out;
};

// The strings a player can read in one file, as an array of strings.
function stringsOf(file, text) {
  if (file.endsWith('.json')) return jsonStrings(JSON.parse(text));
  if (file.endsWith('.html')) {
    const body = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, (m) => (/^<script/.test(m) ? ' ' + scriptStrings(m.replace(/^<script[^>]*>|<\/script>$/g, '')).join('\n') + ' ' : ' '));
    return body.replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  }
  if (file.endsWith('.js')) return scriptStrings(text);
  return (text.replace(/"""[\s\S]*?"""/g, ' ').replace(/#[^\n"]*$/gm, '').match(/"(?:[^"\\\n]|\\.)*"/g) || []);   // .jl
}
function scriptStrings(text) {
  return (text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1')
    .match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) || []).map((s) => s.slice(1, -1));
}

function scanned() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(rel); continue; }
      if (PROTECTED.has(rel) || isOriginal(rel) || !/\.(html|js)$/.test(e.name) || /fixtures\.html$/.test(e.name)) continue;
      out.push(rel);
    }
  };
  walk('web');
  for (const f of fs.readdirSync(path.join(root, 'lessons'))) if (f.endsWith('.json')) out.push(path.join('lessons', f));
  out.push(path.join('src', 'lessons.jl'));
  return out;
}

// Hits as "file: label" keys, with one example string each.
function hitsIn(file, text) {
  const hits = new Map();
  for (const s of stringsOf(file, text)) {
    const spaced = /\s/.test(s);
    for (const [label, re] of RETIRED) {
      // a single word or an id is not a sentence; the phrase rules need the same space test as the plain-words gate
      if (!spaced && !/^Notes:/.test(s)) continue;
      if (re.test(s) && !hits.has(`${file}: ${label}`)) hits.set(`${file}: ${label}`, s.length > 90 ? s.slice(0, 90) + '...' : s);
    }
  }
  return hits;
}

// ---- the content to-do list (hits that exist today; fix the text, then delete the entry) -------------------------
const KNOWN_TODO = [
  'src/lessons.jl: wave',
];

test('retired strings: each rule fires on its phrase and leaves the new wording alone', () => {
  const fire = (s) => RETIRED.filter(([, re]) => re.test(s)).map(([l]) => l);
  assert.deepStrictEqual(fire('Case closed, Part 1 done, teal tray'), ['Case closed', 'Part N (a unit called Part)', 'teal']);
  assert.deepStrictEqual(fire('All six chapters done. Report checked · claim tested · recheck still to do'), []);
  assert.deepStrictEqual(fire('Your chapter line. Print the pocket dictionary. Task 3 of 6. Continue: Lesson 3'), []);
  assert.ok(fire('Show the full answer').length === 1 && fire('Stuck? Hints').length === 1);
  assert.ok(fire('Print cheat sheet').length >= 1 && fire('Here site is one column').length === 1);
  assert.ok(fire('Clues: 3').length === 1 && fire('saved for the end').length === 1 && fire('Line 3 of 6').length === 1);
  assert.ok(fire('level 4 of the range').length === 0 && fire('the wave 2 target').length === 1);
  assert.ok(fire('Worth remembering: a rule keeps the true rows').length === 0);
  const h = hitsIn('web/x.js', 'const a = "Case closed"; const b = "done"; const c = "Case closed today";');
  assert.deepStrictEqual([...h.keys()], ['web/x.js: Case closed'], 'a one-word string is not a sentence; the sentence is');
});

test('retired strings: the scan covers the lessons, the lesson screen, the Board and the engine lines', () => {
  const files = scanned();
  for (const f of ['lessons/lesson1.json', 'lessons/exam4.json', 'lessons/range.json', 'web/lesson.js', 'web/lesson.html', 'src/lessons.jl']) {
    assert.ok(files.includes(f), `${f} is scanned`);
  }
  assert.ok(files.some((f) => f.startsWith('web/course/')), 'the Board files are scanned');
  assert.ok(!files.some((f) => PROTECTED.has(f) || isOriginal(f)), 'the Original chapter files (gate I7) are not scanned');
});

test('retired strings: no retired word or phrase is on a screen (new hits fail; listed ones are the content to-do)', () => {
  const all = new Map();
  for (const f of scanned()) for (const [k, v] of hitsIn(f, fs.readFileSync(path.join(root, f), 'utf8'))) all.set(k, v);
  const todo = new Set(KNOWN_TODO);
  const fresh = [...all.keys()].filter((k) => !todo.has(k));
  const fixed = KNOWN_TODO.filter((k) => !all.has(k));
  if (all.size === 0) console.log('RETIRED-STRINGS-CLEAN');
  else {
    console.log(`# RETIRED to-do (${all.size} hits; ${fresh.length} not on KNOWN_TODO):`);
    for (const [k, v] of all) console.log(`#   ${k}   <- "${v}"${todo.has(k) ? '' : '   <-- NEW'}`);
  }
  if (fixed.length) console.log(`# KNOWN_TODO entries now fixed (delete them): ${fixed.join('; ')}`);
  const strict = process.env.RETIRED_STRICT === '1' || KNOWN_TODO.length === 0;
  assert.deepStrictEqual(strict ? [...all.keys()] : fresh, [], 'a retired string is on a screen');
});

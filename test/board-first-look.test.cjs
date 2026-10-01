"use strict";
// Julia Time 0.5 first-look fixes, package 12: the Board's state text comes from saved state.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const web = path.join(root, "web", "course");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");

const CHAPTER_MOVES = {
  C1: ["select-records"], C2: ["group", "counts", "rates"], C3: ["join-report-log", "filter-disagreement"],
  C4: ["plan-distinct-recheck"], C5: ["event-mask", "event-frequency"], C6: ["compatible-models"]
};

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); }
  };
}
const lessonKey = n => "julia-time:lesson:v1:lesson" + n;
function passLesson(storage, n) { storage.setItem(lessonKey(n), JSON.stringify({lastCheckpointDone: true})); }
function solveChapter(storage, n) {
  for (const move of CHAPTER_MOVES["C" + n]) courseState.recordHistoricalMoveIfMissing(storage, "", "C" + n, move);
}

// A small fake page that keeps children, so the cards can be read.
function fake(id) {
  const el = {id, href: "", textContent: "", hidden: false, dataset: {}, className: "", onclick: null, children: [],
    classList: {toggle() {}, add() {}, remove() {}}, setAttribute() {}};
  el.append = (...kids) => { el.children.push(...kids); };
  el.replaceChildren = (...kids) => { el.children = [...kids]; };
  return el;
}
function board(storage, search) {
  const elements = {}, listeners = {};
  const document = {
    getElementById(id) { return elements[id] || (elements[id] = fake(id)); },
    createElement() { return fake("new"); },
    addEventListener(name, fn) { listeners[name] = fn; }
  };
  const window = {location: {search: search || "", protocol: "http:", host: "127.0.0.1:9630"}, localStorage: storage, document};
  const context = vm.createContext({window, document, URLSearchParams, console});
  for (const file of ["course-state.js", "legacy-import.js", "course-client.js", "intro-script.js", "course-board.js"])
    vm.runInContext(fs.readFileSync(path.join(web, file), "utf8"), context, {filename: file});
  listeners.DOMContentLoaded();
  return elements;
}
const flat = el => [el.textContent, ...(el.children || []).map(flat)].join(" ");
const links = el => [el.href ? {href: el.href, text: el.textContent} : null, ...(el.children || []).flatMap(links)].filter(Boolean);


test("a fresh Board says nothing is saved; after Lesson 1 alone it does not", () => {
  const t = memoryStorage();
  assert.equal(board(t)["board-status"].textContent, "Nothing saved on this computer yet.");
  passLesson(t, 1);
  assert.match(board(t)["board-status"].textContent, /Your saved work is on this computer/);
});

test("r4: the Board's top line says Saved only once something is saved", () => {
  const t = memoryStorage();
  assert.equal(board(t)["topbar-status"].textContent, "Your progress saves on this computer");
  assert.doesNotMatch(board(t)["topbar-status"].textContent, /^Saved/);
  passLesson(t, 1);
  assert.equal(board(t)["topbar-status"].textContent, "Saved on this computer");
});

test("watching the intro marks it done; the main button is never the intro", () => {
  const t = memoryStorage();
  assert.equal(board(t)["watch-intro-link"].textContent, "New here? Watch the two-minute intro (optional)");
  t.setItem(client.INTRO_SEEN_KEY, "1");
  const p = board(t);
  assert.match(p["watch-intro-link"].textContent, /again ✓/);
  assert.equal(p["continue-action"].textContent, "Start Lesson 1");
});

test("all done: the Board says the recheck is the next real step", () => {
  const t = memoryStorage();
  for (let n = 1; n <= 6; n++) { passLesson(t, n); solveChapter(t, n); }
  const p = board(t);
  assert.equal(p["continue-action"].textContent, "See how the case ends");
  assert.match(p["case-why-next"].textContent, /All six chapters are done; the recheck of three jars is the next real step/);
  assert.match(p["case-unknown"].textContent, /next real step/);
  assert.doesNotMatch(p["case-why-next"].textContent, /three parts/);
});

test("the landing page says what, for whom, how long, and has one Start and a collapsed Julia check", () => {
  const html = fs.readFileSync(path.join(web, "index.html"), "utf8");
  assert.match(html, /Learn Julia by solving one lab mystery/);
  assert.match(html, /<strong>For:<\/strong>/);
  assert.match(html, /<strong>Time:<\/strong> about <span id="time-promise">/, "the time is filled in from the lesson and chapter minutes");
  assert.match(html, /<strong>Needs:<\/strong> Julia and the Julia Time launcher, set up once\./);
  assert.equal((html.match(/class="primary-action"/g) || []).length, 1);
  assert.match(html, /<details id="also-here"[\s\S]*id="setup-readiness"/);
  assert.doesNotMatch(html, /<details id="also-here"[^>]*\bopen\b/, "the fold starts closed on a fresh Board");
  assert.match(html, /Each step is a practice Lesson, then a Chapter on the real case\. In each one you read a short question, type a line of Julia and press Run\./);
  assert.equal(client.STEPS.length, 6);
  assert.equal(client.STEPS.reduce((a, s) => a + s.minutes, 0), client.STEPS.reduce((a, s) => a + s.lessonMinutes + s.chapterMinutes, 0));
});

test("one title on the landing page, and the Julia warning appears once", () => {
  const html = fs.readFileSync(path.join(web, "index.html"), "utf8");
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(html, /class="brand"/, "no second title in the header");
  assert.match(html, /<a id="header-how-to-play"[^>]*href="getting-started\.html"/);
  assert.doesNotMatch(html, /Before you play|julia-summary/);
  assert.equal((html.match(/id="julia-line"/g) || []).length, 1);
});

test("a fresh Board: the next row is marked, done links carry one tick, and the case rows follow the lessons", () => {
  const t = memoryStorage();
  const rowsOf = p => p["chapter-cards"].children;
  assert.deepEqual(rowsOf(board(t)).map(r => /step-row--next/.test(r.className)), [true, false, false, false, false, false]);
  passLesson(t, 1);
  const p = board(t);
  assert.deepEqual(rowsOf(p).map(r => /step-row--next/.test(r.className)), [true, false, false, false, false, false]);
  assert.equal(p["case-established"].textContent, "Lesson 1 done. Chapter 1 is next.");
  assert.doesNotMatch(flat(rowsOf(p)[0]), /✓ done|done ✓/);
  solveChapter(t, 1);
  assert.deepEqual(rowsOf(board(t)).map(r => /step-row--next/.test(r.className)), [false, true, false, false, false, false]);
});

test("every step row shows its lesson and chapter minutes, and they add up to the row's time", () => {
  const rows = board(memoryStorage())["chapter-cards"].children;
  rows.forEach((row, i) => {
    const step = client.STEPS[i], text = flat(row);
    assert.match(text, new RegExp("about " + step.lessonMinutes + " min"));
    assert.match(text, new RegExp("about " + step.chapterMinutes + " min"));
    assert.match(text, new RegExp(step.minutes + " min"));
  });
});

test("all done: 'All six chapters done', never 'Case closed'; the four case rows become end-state rows", () => {
  const t = memoryStorage();
  for (let n = 1; n <= 6; n++) { passLesson(t, n); solveChapter(t, n); }
  const p = board(t);
  const page = Object.values(p).map(el => el.textContent).join(" | ");
  assert.doesNotMatch(page, /Case closed/);
  assert.match(p["case-progress"].textContent, /^All six chapters done\./);
  assert.equal(p["board-title"], undefined, "the page title stays as written: Julia Time");
  assert.equal(p["case-unknown-label"].textContent, "What is still open");
  assert.equal(p["case-why-next-label"].textContent, "What to do now");
  assert.doesNotMatch(page, /Still to find out|Why this next step/);
});

test("Julia you have used: a plain phrase first, the symbol in a code span, and the lessons' own skills", () => {
  const t = memoryStorage();
  t.setItem(lessonKey(6), JSON.stringify({lastCheckpointDone: true, skill: {number: 6, title: "Test the claim", can_do: ["Join two true-or-false rules with .& and keep the rows.", "Put each rule in round brackets so Julia reads it right."]}}));
  solveChapter(t, 3);
  const list = board(t)["concept-list"].children;
  const text = list.map(flat).join(" | ");
  assert.match(text, /\.&/);
  assert.match(text, /brackets/);
  const notEqual = list.find(li => /Not equal, row by row/.test(flat(li)));
  assert.ok(notEqual, text);
  assert.ok(notEqual.children.some(c => c.textContent === ".!="), "the operator is its own code element");
});

test("no Part, Train, Solve, wave or Case Board wording on the Board and intro screens", () => {
  for (const f of ["index.html", "intro.html", "intro-script.js", "course-board.js"]) {
    const s = fs.readFileSync(path.join(web, f), "utf8");
    assert.doesNotMatch(s, /\bPart \d|Train:|Solve:|waves open|Case Board/i, f);
  }
});

test("the ending's concept list says card deals, never rounds of cards (queue 21)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "web", "course", "course-client.js"), "utf8");
  const lists = [...src.matchAll(/concepts:\[([^\]]*)\]/g)].map((m) => m[1]);
  assert.ok(lists.length >= 10);
  for (const list of lists) assert.doesNotMatch(list, /\brounds?\b/i, list);
  assert.match(src, /how often = matches ÷ all card deals/);
});

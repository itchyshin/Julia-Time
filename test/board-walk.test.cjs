"use strict";
// Julia Time 0.5, slice S1: one Board button walks intro, Lesson 1, Chapter 1, Lesson 2, ... Chapter 6, ending.
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

test("walk order and labels, from a fresh player to the ending", () => {
  const t = memoryStorage();
  const say = () => board(t)["continue-action"].textContent;
  const seen = [say()];
  t.setItem(lessonKey(1), JSON.stringify({done: {}}));   // started, not passed
  seen.push(say());
  for (let n = 1; n <= 6; n++) {
    passLesson(t, n); seen.push(say());
    solveChapter(t, n); seen.push(say());
  }
  // 0.5 fix: the intro is optional and never the main button; the first label is "Start Lesson 1".
  assert.deepEqual(seen, ["Start Lesson 1", "Continue: Lesson 1",
    "Continue: Chapter 1", "Continue: Lesson 2", "Continue: Chapter 2", "Continue: Lesson 3", "Continue: Chapter 3", "Continue: Lesson 4",
    "Continue: Chapter 4", "Continue: Lesson 5", "Continue: Chapter 5", "Continue: Lesson 6", "Continue: Chapter 6", "See how the case ends"]);
});

test("the next step is the first step on the path not yet done", () => {
  const t = memoryStorage();
  const say = () => { const p = board(t); return [p["continue-action"].textContent, p["continue-action"].href]; };
  assert.equal(say()[0], "Start Lesson 1");
  assert.equal(say()[1], "../lesson.html?lesson=lesson1", "a fresh player's one Start goes straight to Lesson 1");
  // A solved chapter counts for its lesson (nothing is locked).
  passLesson(t, 1);
  assert.deepEqual(say(), ["Continue: Chapter 1", say()[1]]);
  solveChapter(t, 1);
  assert.equal(say()[0], "Continue: Lesson 2");
  passLesson(t, 2);
  assert.deepEqual(say().slice(0, 1), ["Continue: Chapter 2"]);
  assert.equal(say()[1], "../lesson.html?lesson=exam2");
  solveChapter(t, 2);
  assert.equal(say()[0], "Continue: Lesson 3");
  for (let n = 3; n <= 6; n++) { passLesson(t, n); assert.equal(say()[0], "Continue: Chapter " + n); solveChapter(t, n); if (n < 6) assert.equal(say()[0], "Continue: Lesson " + (n + 1)); }
  assert.deepEqual(say(), ["See how the case ends", "ending.html"]);
});

test("a started but unfinished lesson does not count as done", () => {
  const t = memoryStorage();
  t.setItem(lessonKey(1), JSON.stringify({done: {}, lastCheckpointDone: false}));
  const p = board(t);
  assert.equal(p["continue-action"].textContent, "Continue: Lesson 1");
  assert.equal(p["continue-action"].href, "../lesson.html?lesson=lesson1");
});

test("the Board keeps the attempt on every lesson, chapter and range link (round 2, P17)", () => {
  const t = memoryStorage();
  passLesson(t, 1);
  const p = board(t, "?attempt=f3-check");
  assert.match(p["continue-action"].href, /attempt=f3-check/);
  assert.ok(links(p["chapter-cards"]).some(l => l.href === "../lesson.html?lesson=lesson1&attempt=f3-check"));
  for (const l of links(p["chapter-cards"])) assert.match(l.href, /attempt=f3-check/, l.href);
  assert.ok(links(p["range-panel"]).some(l => l.href === "../lesson.html?lesson=range&attempt=f3-check"));
  assert.equal(board(memoryStorage(), "?attempt=f3-check")["continue-action"].href, "../lesson.html?lesson=lesson1&attempt=f3-check");
});

test("each chapter card has a Lesson row and a Case row, both links, nothing locked", () => {
  const t = memoryStorage();
  passLesson(t, 1); passLesson(t, 3);
  solveChapter(t, 1);
  const p = board(t);
  const cards = p["chapter-cards"].children;
  assert.equal(cards.length, 6);
  cards.forEach((card, i) => {
    const n = i + 1, text = flat(card), ls = links(card);
    assert.doesNotMatch(card.className, /unavailable/);
    const lessonLink = ls.find(l => l.href === "../lesson.html?lesson=lesson" + n);
    const caseLink = ls.find(l => l.href === "../lesson.html?lesson=exam" + n);
    assert.ok(lessonLink, "lesson link for card " + n);
    assert.ok(caseLink, "case link for card " + n);
    const lessonDone = n === 1 || n === 3, caseDone = n === 1;
    assert.equal(lessonLink.text, "Lesson " + n + ": " + client.STEPS[i].lesson);   // round 4: the tick is drawn by the stylesheet, in a fixed place
    assert.equal(caseLink.text, "Chapter " + n + ": " + client.STEPS[i].chapter);
    assert.doesNotMatch(text, /locked/i);
  });
});

test("range panel counts open waves by the range.json rule", () => {
  const t = memoryStorage();
  assert.match(flat(board(t)["range-panel"]), /Practice levels open: 0 of 11/);
  passLesson(t, 1);
  assert.match(flat(board(t)["range-panel"]), /Practice levels open: 3 of 11/);
  const t2 = memoryStorage(); passLesson(t2, 3);   // a higher lesson opens lower waves too
  assert.match(flat(board(t2)["range-panel"]), /Practice levels open: 6 of 11/);
  const t3 = memoryStorage(); passLesson(t3, 6);
  assert.match(flat(board(t3)["range-panel"]), /Practice levels open: 11 of 11/);
  const link = links(board(t)["range-panel"]).find(l => l.href === "../lesson.html?lesson=range");
  assert.ok(link, "range link");
  assert.equal(link.text, "Target range (optional)");
});

test("embedded wave list matches lessons/range.json", () => {
  const range = JSON.parse(fs.readFileSync(path.join(root, "lessons", "range.json"), "utf8"));
  assert.deepEqual(client.RANGE_UNLOCKS.slice(), range.waves.map(w => Number(/(\d+)$/.exec(w.unlocks_after)[1])));
  assert.equal(client.RANGE_UNLOCKS.length, 11);
});

test("index.html: no course banner, one shared-progress line, range panel", () => {
  const html = fs.readFileSync(path.join(web, "index.html"), "utf8");
  assert.doesNotMatch(html, /course-banner/);
  assert.doesNotMatch(html, /Start the new course/);
  assert.match(html, /Progress is shared by everyone on this laptop\./);
  assert.match(html, /To start over, use Start again on a lesson\./);
  assert.match(html, /id="range-panel"/);
  // round 5: the Target range sits in view under the six steps, not inside the closed "Also on this computer" fold
  const fold = /<details id="also-here"[\s\S]*?<\/details>\s*<\/main>/.exec(html)[0];
  assert.doesNotMatch(fold.replace(/<details id="setup-details"[\s\S]*?<\/details>/, ""), /id="range-panel"/, "range panel is outside the fold");
  assert.ok(html.indexOf('id="range-panel"') > html.indexOf('id="steps-foot"') && html.indexOf('id="range-panel"') < html.indexOf('id="case-thread"'), "under the six steps");
  assert.doesNotMatch(/<summary>Also on this computer[^<]*<\/summary>/.exec(html)[0], /Target range/);
});

test("intro Start and Skip go to Lesson 1", () => {
  const intro = require("../web/course/intro.js");
  const script = require("../web/course/intro-script.js");
  assert.equal(intro.lessonOneDestination(), "../lesson.html?lesson=lesson1");
  assert.equal(intro.lessonOneDestination("f3-check"), "../lesson.html?lesson=lesson1&attempt=f3-check", "Start and Skip keep the attempt");
  assert.match(script.buttons.start, /Start Lesson 1/);
  const src = fs.readFileSync(path.join(web, "intro.js"), "utf8");
  assert.match(src, /\$\("intro-skip"\)\.href = startHref/);
  assert.match(src, /const startHref = lessonOneDestination\(attempt\)/);
});

test("the ending gate is unchanged: needs all six chapters, not lessons", () => {
  const t = memoryStorage();
  for (let n = 1; n <= 6; n++) solveChapter(t, n);
  assert.equal(client.dashboardModel(client.loadCourseState(t, "")).completion.complete, true);
});

test("experts skip training: a solved chapter counts for its lesson on the walk, and six solved chapters open the ending", () => {
  const s = memoryStorage();
  solveChapter(s, 1);
  let main = board(s)["continue-action"];
  assert.equal(main.textContent, "Continue: Lesson 2", "Chapter 1 solved without Lesson 1: the walk moves on");
  for (let n = 2; n <= 6; n++) solveChapter(s, n);
  main = board(s)["continue-action"];
  assert.equal(main.textContent, "See how the case ends", "six chapters solved, no lessons: the ending");
});

test("the walk's chapter step and every card Case link open the chapter exam on the lesson screen", () => {
  const t = memoryStorage();
  const cards = board(t)["chapter-cards"].children;
  cards.forEach((card, i) => assert.ok(links(card).some(l => l.href === "../lesson.html?lesson=exam" + (i + 1) && /^Chapter/.test(l.text)), "card " + (i + 1)));
  for (let n = 1; n <= 6; n++) {
    const s = memoryStorage();
    for (let k = 1; k <= n; k++) passLesson(s, k);
    for (let k = 1; k < n; k++) solveChapter(s, k);
    const main = board(s)["continue-action"];
    assert.equal(main.textContent, "Continue: Chapter " + n);
    assert.equal(main.href, "../lesson.html?lesson=exam" + n);
  }
  const pageless = links(board(t)["chapter-cards"]).filter(l => /chapter\.html|chapter\d?\.html|index\.html/.test(l.href));
  assert.deepEqual(pageless, []);
});

test("exam links keep the attempt, the namespace web/lesson-exam-save.js writes", () => {
  const p = board(memoryStorage(), "?attempt=f3-check");
  assert.ok(links(p["chapter-cards"]).some(l => l.href === "../lesson.html?lesson=exam2&attempt=f3-check"));
  const s = memoryStorage(); passLesson(s, 1);
  assert.equal(board(s, "?attempt=f3-check")["continue-action"].href, "../lesson.html?lesson=exam1&attempt=f3-check");
});

test("a chapter passed only through web/lesson-exam-save.js lights Case on its card", () => {
  const save = require("../web/lesson-exam-save.js");
  const EXAMS = {1: [{chapter: "C1", move_id: "select-records", row_count: 3, jar_ids: ["B09-1"]}],
    2: [{chapter: "C2", move_id: "group", row_count: 4}, {chapter: "C2", move_id: "counts", row_count: 4}, {chapter: "C2", move_id: "rates", row_count: 4}],
    3: [{chapter: "C3", move_id: "join-report-log", row_count: 4}, {chapter: "C3", move_id: "filter-disagreement", row_count: 4}],
    4: [{chapter: "C4", move_id: "plan-distinct-recheck", row_count: 3, jar_ids: ["B09-1", "B09-2", "B09-3"]}],
    5: [{chapter: "C5", move_id: "event-mask", row_count: 4}, {chapter: "C5", move_id: "event-frequency", row_count: 4}],
    6: [{chapter: "C6", move_id: "compatible-models", row_count: 2}]};
  for (const attempt of ["", "f3-check"]) for (let n = 1; n <= 6; n++) {
    const s = memoryStorage();
    for (const rec of EXAMS[n]) assert.equal(save.saveExamPass(courseState, s, attempt, rec, "x = 1"), true);
    const card = board(s, attempt ? "?attempt=" + attempt : "")["chapter-cards"].children[n - 1];
    const c = links(card).find(l => /^Chapter/.test(l.text));
    assert.equal(c.text, "Chapter " + n + ": " + client.STEPS[n - 1].chapter, "chapter " + n + " attempt '" + attempt + "'");
    assert.match(c.href, new RegExp("lesson=exam" + n + "(&|$)"));
  }
});

// ---- 0.5.2: the optional "Bonus: your own data" card ------------------------------------------------------------
test("the Board has an optional own-data card that links to lesson=own and keeps the attempt", () => {
  const p = board(memoryStorage());
  assert.match(flat(p["own-data-panel"]), /Bonus: your own data/);
  assert.match(flat(p["own-data-panel"]), /optional/i);
  assert.ok(links(p["own-data-panel"]).some(l => l.href === "../lesson.html?lesson=own"), "plain link");
  const q = board(memoryStorage(), "?attempt=f3-check");
  assert.ok(links(q["own-data-panel"]).some(l => l.href === "../lesson.html?lesson=own&attempt=f3-check"), "attempt kept");
  assert.equal(client.ownDataDestination(), "../lesson.html?lesson=own");
  assert.equal(client.ownDataDestination("f3-check"), "../lesson.html?lesson=own&attempt=f3-check");
});

test("the own-data card sits outside the closed fold, and never locks or replaces the ending", () => {
  const html = fs.readFileSync(path.join(web, "index.html"), "utf8");
  assert.match(html, /id="own-data-panel"/);
  const fold = /<details id="also-here"[\s\S]*?<\/details>\s*<\/main>/.exec(html)[0];
  assert.doesNotMatch(fold, /own-data-panel/);
  assert.equal(client.STEPS.length, 6, "the six-level scope is unchanged");
  const t = memoryStorage();
  for (let n = 1; n <= 6; n++) { passLesson(t, n); solveChapter(t, n); }
  const p = board(t);                       // the lesson "own" was never opened
  assert.equal(p["continue-action"].textContent, "See how the case ends");
  assert.doesNotMatch(flat(p["own-data-panel"]), /locked|unavailable/i);
  assert.doesNotMatch(flat(p["continue-action"]), /own/i);
});

test("the ending page has an optional link to the own-data lesson", () => {
  const html = fs.readFileSync(path.join(web, "ending.html"), "utf8");
  assert.match(html, /id="ending-own-data"/);
  assert.match(fs.readFileSync(path.join(web, "ending.js"), "utf8"), /ownDataDestination/);
});

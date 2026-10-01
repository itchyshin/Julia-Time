"use strict";
// Target range, fix round 2 (P19): the ladder and the boss, physical hits, the rule sweep, and the clarity fixes.
// Nothing here needs Julia: the page code runs on a tiny fake page with a fake socket, and the sound is a fake AudioContext.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lesson = require("../web/lesson.js");
const Range = require("../web/lesson-range.js");

const root = path.join(__dirname, "..");
const rangeFile = JSON.parse(fs.readFileSync(path.join(root, "lessons/range.json"), "utf8"));
const rangeCss = fs.readFileSync(path.join(root, "web/lesson-range.css"), "utf8");
const rangeSrc = fs.readFileSync(path.join(root, "web/lesson-range.js"), "utf8");

// ---- what the server sends: the range file without examples and checks, plus the practice logbook's twelve jars ----
const PRACTICE_JARS = [];
["B04", "B05"].forEach((batch, b) => ["T-D", "T-E", "T-F"].forEach((tray) => { for (let k = 0; k < 2; k++) PRACTICE_JARS.push({ jar_id: "Q-0" + (4 + b) + (PRACTICE_JARS.length % 6 + 1), batch_id: batch, tray_id: tray }); }));
function served() {
  const copy = JSON.parse(JSON.stringify(rangeFile));
  copy.waves.forEach((w) => { delete w.example; delete w.check; });
  copy.jars = PRACTICE_JARS;
  copy.columns = copy.columns.map((c) => c.name);   // the real server sends plain column names (src/lessons.jl lesson_public)
  copy.data_label = "Practice data, made up for training. Not the case, so nothing here answers the case.";
  return copy;
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    get length() { return m.size; }, key: (i) => Array.from(m.keys())[i] };
}
const passedLessons = (ids) => { const st = memoryStorage(); ids.forEach((id) => st.setItem(lesson.STORE_PREFIX + id, JSON.stringify({ started: true, lastCheckpointDone: true }))); return st; };
const ALL = ["lesson1", "lesson2", "lesson3", "lesson4", "lesson5", "lesson6"];

// ---- a tiny fake page (the same shape as the one in lesson-screen.test.cjs) ----------------------------
class FNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.hidden = false; this.value = ""; this.disabled = false; this.open = true; this.className = ""; this.parentNode = null; this.scrollHeight = 0; this.clientHeight = 0; this.scrollTop = 0; this._text = ""; }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() { const p = this.parentNode; return p ? p.children[p.children.indexOf(this) + 1] || null : null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); c.parentNode = null; return c; }
  insertBefore(n, ref) { n.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(n); else this.children.splice(i, 0, n); return n; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this.className = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  click() { (this.listeners.click || []).forEach((f) => f({})); }
  fire(t, e) { (this.listeners[t] || []).forEach((f) => f(e || {})); }
  focus() {}
  get textContent() { return this.tag === "#text" ? this._text : this._text + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = String(v); }
  all() { return this.children.reduce((a, c) => a.concat(c, c.all()), []); }
}
const hasClass = (n, c) => (" " + n.className + " ").includes(" " + c + " ");
const byClass = (root, c) => root.all().filter((n) => hasClass(n, c));

// hooks.reply(out, msg) may change the server's answer. The fake server picks the jars named in the code (Q-0nn).
function fakePage(storage, hooks) {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const byId = {};
  [...html.matchAll(/\sid="([^"]+)"/g)].forEach((m) => { byId[m[1]] = new FNode("div"); });
  Object.keys(byId).forEach((id) => { if (/hidden/.test(html.match(new RegExp('<[^>]*id="' + id + '"[^>]*>'))[0])) byId[id].hidden = true; });
  const sent = [];
  class WS {
    constructor() { this.readyState = 0; this.l = {}; Promise.resolve().then(() => { this.readyState = 1; (this.l.open || []).forEach((f) => f({})); }); }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    close() {}
    send(text) {
      const m = JSON.parse(text); let out = null; sent.push(m);
      if (m.type === "lesson_list") out = { type: "lessons", lessons: [{ id: "range", kind: "range", number: null, title: "Target range" }] };
      if (m.type === "lesson_info") out = { type: "lesson", request_id: m.request_id, lesson: served() };
      if (m.type === "lesson_run") {
        const ids = m.code.match(/Q-\d+/g);
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: ids ? "ok" : "error", value_repr: "", pass: false, feedback: ids ? "Ran." : "Julia could not run this. Read your line again.", message: ids ? "" : "MethodError: no method matching &(::BitVector, ::BitVector)" };
        if (ids) out.picked_ids = ids;
        if (hooks && hooks.reply) hooks.reply(out, m);
      }
      const deliver = () => (this.l.message || []).forEach((f) => f({ data: JSON.stringify(out) }));
      if (out && hooks && hooks.delay && m.type === "lesson_run") setTimeout(deliver, hooks.delay);
      else if (out) deliver();
    }
  }
  const win = { localStorage: storage, location: { search: "?lesson=range", host: "x" }, WebSocket: WS, addEventListener() {}, innerWidth: 1366, confirm: () => true, print() {}, navigator: {} };
  const doc = { defaultView: win, getElementById: (id) => byId[id], createElement: (t) => new FNode(t), createTextNode: (t) => { const n = new FNode("#text"); n._text = t; return n; } };
  return { doc, byId, sent };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// A fake speaker: every oscillator that is started is recorded with its type.
class FakeAudio {
  constructor() { FakeAudio.made.push(this); this.state = "running"; this.currentTime = 0; this.destination = {}; this.started = []; }
  createGain() { const g = { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; return g; }
  createOscillator() { const self = this; return { type: "sine", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start(t) { self.started.push(this.type); }, stop() {} }; }
  resume() { return Promise.resolve(); }
}
FakeAudio.made = [];
const speaker = () => FakeAudio.made.reduce((a, c) => a.concat(c.started), []);

// Run a test with the browser globals the renderer reads (matchMedia, localStorage, AudioContext), then put them back.
async function withBrowser(opts, fn) {
  const saved = { matchMedia: globalThis.matchMedia, localStorage: globalThis.localStorage, AudioContext: globalThis.AudioContext };
  FakeAudio.made.length = 0;
  globalThis.matchMedia = () => ({ matches: !!opts.reduced });
  globalThis.localStorage = opts.storage || memoryStorage();
  globalThis.AudioContext = FakeAudio;
  try { return await fn(); } finally {
    Object.keys(saved).forEach((k) => { if (saved[k] === undefined) delete globalThis[k]; else globalThis[k] = saved[k]; });
  }
}
async function start(opts) {
  const o = opts || {};
  const page = fakePage(o.lessons || passedLessons(ALL), o.hooks);
  lesson.init(page.doc);
  await tick();
  const $ = (id) => page.byId[id];
  const levelButton = (n) => byClass($("wave-list"), "wave").find((b) => b.children[0].textContent === "Level " + n);
  const run = async (code) => { $("code").value = code; $("run").click(); await tick(); };
  // nodes the range script adds to the page are not in the page's own id list: find them in the tree
  const dyn = (id) => ["left", "right", "screen-range-end"].map((r) => page.byId[r].all().find((n) => n.attrs.id === id)).find(Boolean);
  const board = () => $("board");
  const jars = () => byClass(board(), "jar");
  return { page, $, dyn, levelButton, run, board, jars };
}

// ---- the ladder and the boss ---------------------------------------------------------------------------------
test("range.json: named groups cover the eleven levels once, in order, and the boss is last", () => {
  const ids = rangeFile.waves.map((w) => w.id);
  assert.deepEqual(rangeFile.groups.map((g) => g.title), ["Aim by position", "Aim by rule", "Flip it", "Chance", "Combine rules", "Boss"]);
  assert.deepEqual(rangeFile.groups.reduce((a, g) => a.concat(g.levels), []), ids, "every level is in exactly one group, in level order");
  const w11 = rangeFile.waves[10];
  assert.equal(w11.boss, true);
  assert.equal(rangeFile.groups[rangeFile.groups.length - 1].boss, true);
  assert.deepEqual(rangeFile.groups[rangeFile.groups.length - 1].levels, ["w11"]);
  rangeFile.waves.forEach((w) => assert.ok(typeof w.title === "string" && w.title.length > 0 && w.title.split(/\s+/).length <= 5, w.id + " has a short title"));
});

test("range.json: the boss carries its own table of at least 24 jars, a story line and targets inside that table", () => {
  const w11 = rangeFile.waves[10];
  assert.ok(Array.isArray(w11.jars) && w11.jars.length >= 24, "about thirty jars");
  assert.equal(w11.jars.length, 30);
  const ids = w11.jars.map((j) => j.jar_id);
  assert.equal(new Set(ids).size, ids.length);
  w11.jars.forEach((j) => { assert.match(j.jar_id, /^Q-0\d\d$/); assert.equal(typeof j.detected, "boolean"); assert.ok(j.batch_id && j.tray_id); });
  w11.targets.forEach((t) => assert.ok(ids.includes(t), t + " is in the boss table"));
  // the targets are exactly what the boss sentence asks: seen, not T-E, not T-F, not batch B06
  const want = w11.jars.filter((j) => j.detected && j.tray_id !== "T-E" && j.tray_id !== "T-F" && j.batch_id !== "B06").map((j) => j.jar_id);
  assert.deepEqual(w11.targets, want);
  assert.ok(w11.story && w11.story.length > 20);
  assert.ok(w11.targets.length >= 3 && w11.targets.length <= 8, "a few targets among many jars");
  // levels 1 to 10 keep the twelve-jar logbook
  rangeFile.waves.slice(0, 10).forEach((w) => assert.equal(w.jars, undefined, w.id));
});

test("the page draws the ladder: a heading per group, a button per open level, the boss in its own style", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    const titles = byClass(t.$("wave-list"), "group-title").map((n) => n.textContent);
    assert.deepEqual(titles, ["Aim by position", "Aim by rule", "Flip it", "Chance", "Combine rules", "Boss"]);
    assert.equal(byClass(t.$("wave-list"), "wave").length, 11);
    assert.ok(hasClass(t.levelButton(11), "boss"));
    assert.ok(byClass(t.$("wave-list"), "group").at(-1).className.includes("boss"));
    assert.equal(t.$("kind-label").textContent, "Aim by position · The ninth jar", "the level's group and name sit above the heading");
  });
});

test("locked levels stay on the ladder as dim rungs that cannot be pressed", async () => {
  await withBrowser({}, async () => {
    const t = await start({ lessons: passedLessons(["lesson1", "lesson2"]) });
    assert.equal(byClass(t.$("wave-list"), "wave").length, 5, "only the open levels are buttons");
    const dim = byClass(t.$("wave-list"), "rung");
    assert.equal(dim.length, 6);
    dim.forEach((n) => assert.ok(hasClass(n, "locked") && n.tag !== "button"));
    assert.match(t.$("locked-line").textContent, /6 more levels open as you finish Lessons 3 to 6/);
  });
});

test("level 11 is the boss: its own colour hook, a story line, and a thirty-jar table", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    assert.equal(t.$("screen-lesson").attrs["data-boss"], "0");
    t.levelButton(11).click(); await tick();
    assert.equal(t.$("screen-lesson").attrs["data-boss"], "1");
    assert.equal(t.jars().length, 30);
    assert.equal(t.dyn("range-boss").hidden, false);
    assert.match(t.dyn("range-boss").textContent, /Boss level/);
    assert.match(t.dyn("range-boss").textContent, /The last shelf/);
    assert.ok(byClass(t.board(), "rack")[0].className.includes("dense"), "the thirty jars are drawn denser");
    assert.match(t.$("kind-label").textContent, /^Boss · The last shelf$/);
    t.levelButton(1).click(); await tick();
    assert.equal(t.$("screen-lesson").attrs["data-boss"], "0");
    assert.equal(t.dyn("range-boss").hidden, true);
    assert.equal(t.jars().length, 12);
  });
});

test("the columns strip above the editor names every column of the table (RG1)", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    const strip = t.dyn("range-cols");
    assert.ok(strip && !strip.hidden);
    assert.equal(strip.parentNode, t.$("right"), "in the editor's column");
    ["jar_id", "tray_id", "batch_id", "detected"].forEach((w) => assert.match(strip.textContent, new RegExp(w)));
    assert.match(strip.textContent, /^Columns:/, "the strip says what it is");
    // an error that names a missing column points at the strip, not at a table that is not shown
    const page = await start({ hooks: { reply: (out) => { out.status = "error"; delete out.picked_ids; out.feedback = "The table has no column called tray. Check the column names in the table shown."; } } });
    await page.run("logbook.tray");
    assert.match(page.$("feedback").textContent, /strip above the editor/);
  });
});

// ---- beat 1: the rule sweep --------------------------------------------------------------------------------------
test("the rule sweep runs after every run that picks jars: the line appears, kept jars light up, the rest fade, in order", async () => {
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (out, m) => { if (/refused/.test(m.code)) out.range = { hits: 1, misses: 0, wrong_picks: 0, missed_targets: [], clean: false, rule_broken: "forbids" }; } } });
    t.levelButton(1).click(); await tick();
    const runs = [["logbook.jar_id[8] Q-052", "a miss"], ["logbook.jar_id[9] Q-053", "a hit"], ["refused Q-053", "a refused hit"]];
    for (const [code, what] of runs) {
      await t.run(code);
      const rack = byClass(t.board(), "rack")[0];
      assert.ok(hasClass(rack, "go"), what + ": the rack animates");
      const sweeper = byClass(t.board(), "sweeper")[0];
      assert.ok(sweeper, what + ": a sweeper");
      assert.equal(byClass(sweeper, "sweeper-line")[0].textContent, code, what + ": it carries the player's line");
      const pass = t.jars().filter((j) => hasClass(j, "sw-pass")), fail = t.jars().filter((j) => hasClass(j, "sw-fail"));
      assert.equal(pass.length, 1, what + ": the jar the line picked lights up");
      assert.equal(fail.length, 11, what + ": the others fade");
      const delays = t.jars().map((j) => Number(/--sw:(\d+)ms/.exec(j.attrs.style)[1]));
      assert.deepEqual(delays, delays.slice().sort((a, b) => a - b), what + ": the sweep moves left to right");
      assert.ok(delays[delays.length - 1] + 420 <= Range.SWEEP_MS + 5, what + ": it is over before the fills start");
      assert.match(byClass(t.board(), "sweep-note")[0].textContent, /Your line kept 1 of 12 jars/);
    }
  });
});

test("a run that picks no jars has nothing to sweep", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(1).click(); await tick();
    await t.run("nothing here");
    assert.equal(byClass(t.board(), "sweeper").length, 0);
    assert.equal(byClass(t.board(), "rack").length, 1);
  });
});

test("a redraw that is not a new run (the hint) never starts the animation again", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(1).click(); await tick();
    await t.run("Q-052");
    const rackBefore = byClass(t.board(), "rack")[0];
    t.$("wave-hint").click(); await tick();
    assert.equal(byClass(t.board(), "rack")[0], rackBefore, "the same rack node is kept");
  });
});

// ---- beat 2: physical hits ---------------------------------------------------------------------------------------
test("runPlan: right jars cascade left to right with a clink each, wrong picks get a thud, refused jars stay silent", () => {
  const tiles = [
    { id: "a", state: "", picked: false }, { id: "b", state: "hit", picked: true }, { id: "c", state: "miss", picked: true },
    { id: "d", state: "hit", picked: true }, { id: "e", state: "hit", picked: true, refused: true }, { id: "f", state: "target", picked: false },
  ];
  const p = Range.runPlan(tiles, { motion: true });
  assert.equal(p.animate, true);
  assert.deepEqual(p.audio.map((a) => a.kind), ["clink", "thud", "clink"], "in jar order: b, c, d");
  const starts = p.tiles.filter((t) => t.cascadeAt !== null && t.keep).map((t) => t.cascadeAt);
  assert.ok(p.audio[0].at >= Range.SWEEP_MS, "the fills wait for the sweep");
  assert.ok(p.audio[0].at < p.audio[1].at && p.audio[1].at < p.audio[2].at, "one after another");
  assert.equal(p.tiles[0].cascadeAt, null, "a jar that was not picked does not fill");
  assert.ok(starts.length === 4);
  // a long cascade is quickened to about a second and a half
  const many = Array.from({ length: 21 }, (_, i) => ({ id: "j" + i, state: "hit", picked: true }));
  const q = Range.runPlan(many, { motion: true });
  assert.ok(q.audio[20].at - q.audio[0].at <= 1600, "thirty jars never drag");
});

test("runPlan with reduced motion animates nothing", () => {
  const p = Range.runPlan([{ id: "b", state: "hit", picked: true }, { id: "c", state: "miss", picked: true }], { motion: false });
  assert.equal(p.animate, false);
  assert.equal(p.sweepMs, 0);
  p.tiles.forEach((t) => assert.equal(t.sweepAt, 0));
});

test("sound: a clink per right jar and a thud per wrong pick, made in code, on by default", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(6).click(); await tick();
    await t.run("Q-043 Q-044 Q-041");            // two right, one wrong
    const made = speaker();
    assert.equal(made.filter((x) => x === "triangle").length, 1, "one thud");
    assert.equal(made.filter((x) => x === "sine").length, 4, "two clinks, two partials each");
    const jars = t.jars();
    assert.equal(jars.filter((j) => hasClass(j, "hit")).length, 2);
    assert.equal(jars.filter((j) => hasClass(j, "miss")).length, 1);
    assert.equal(jars.find((j) => hasClass(j, "miss")).children[0].textContent, "✗");
    assert.ok(!/\.(mp3|wav|ogg)\b|new Audio\(/.test(rangeSrc), "no audio files");
  });
});

test("the mute button: one button, off stays off after a reload, and a muted page makes no sound", async () => {
  const storage = memoryStorage();
  await withBrowser({ storage }, async () => {
    const t = await start();
    const btn = t.dyn("range-sound");
    assert.ok(btn, "one visible mute button");
    assert.equal(btn.textContent, "Sound: on");
    assert.equal(btn.attrs["aria-pressed"], "true");
    btn.click();
    assert.equal(btn.textContent, "Sound: off");
    assert.equal(btn.attrs["aria-pressed"], "false");
    assert.equal(storage.getItem(Range.SOUND_KEY), "off");
    t.levelButton(6).click(); await tick();
    await t.run("Q-043 Q-041");
    assert.equal(speaker().length, 0, "muted: nothing is played");
    assert.equal(byClass(t.board(), "rack")[0].className.includes("go"), true, "the picture still moves");
  });
  await withBrowser({ storage }, async () => {
    const again = await start();
    const btn = again.dyn("range-sound");
    assert.equal(btn.textContent, "Sound: off", "remembered");
    btn.click();
    assert.equal(storage.getItem(Range.SOUND_KEY), "on");
  });
});

test("createSound: on by default, saved in storage, and its log keeps the order asked", () => {
  const storage = memoryStorage();
  const s = Range.createSound({ storage, AudioContext: FakeAudio });
  assert.equal(s.isOn(), true);
  assert.equal(s.play([{ kind: "clink", at: 0, k: 0 }, { kind: "thud", at: 100, k: 1 }]), true);
  assert.deepEqual(s.log.map((e) => e.kind), ["clink", "thud"]);
  s.setOn(false);
  assert.equal(storage.getItem(Range.SOUND_KEY), "off");
  assert.equal(s.play([{ kind: "clink", at: 0, k: 0 }]), false);
  assert.equal(Range.createSound({ storage, AudioContext: FakeAudio }).isOn(), false);
  assert.equal(Range.createSound({ storage: null, AudioContext: null }).play([{ kind: "clink", at: 0 }]), false, "no speaker, no error");
});

test("reduced motion: no sweep, no wobble, no shake, no timeline; the result is simply shown", async () => {
  await withBrowser({ reduced: true }, async () => {
    const t = await start();
    t.levelButton(6).click(); await tick();
    await t.run("Q-043 Q-044 Q-041");
    const rack = byClass(t.board(), "rack")[0];
    assert.ok(!hasClass(rack, "go"), "no animation class");
    assert.equal(byClass(t.board(), "sweeper").length, 0, "no sweeping label");
    t.jars().forEach((j) => { assert.equal(j.attrs.style, undefined, "no per-jar timeline"); assert.ok(!/sw-(pass|fail)/.test(j.className)); });
    assert.equal(t.board().all().filter((n) => n.attrs["data-late"]).length + (t.$("feedback").attrs["data-late"] ? 1 : 0), 0, "the words do not wait");
    assert.equal(t.jars().filter((j) => hasClass(j, "hit")).length, 2, "the fills are still shown");
    assert.equal(t.jars().filter((j) => hasClass(j, "miss")).length, 1);
    assert.match(byClass(t.board(), "board-summary")[0].textContent, /Right jars: 2 of 8/);
    assert.match(byClass(t.board(), "sweep-note")[0].textContent, /Your line kept 3 of 12 jars/, "what the line asked is still said in words");
  });
});

test("CSS: every animation belongs to a run (.go, the sweeper, [data-late], the finale); nothing loops; 16px text or more", () => {
  const css = rangeCss;
  (css.match(/animation:[^;}]*/g) || []).forEach((a) => assert.ok(!/infinite/.test(a), a));
  const rules = css.split("}").map((r) => r.trim()).filter((r) => /animation:/.test(r));
  rules.filter((r) => !/\{\s*animation: none;\s*$/.test(r)).forEach((r) => assert.match(r.split("{")[0], /\.go\b|\.sweeper|\[data-late\]|\.rise|\.finale|\.boss-flash|\[data-waiting\]/, "an animation outside a run: " + r.slice(0, 80)));
  (css.match(/font(-size)?:[^;}]*/g) || []).forEach((d) => {
    const m = /(\d+(?:\.\d+)?)px/.exec(d);
    if (m) assert.ok(Number(m[1]) >= 16, "range text under 16px: " + d);
  });
  assert.match(css, /prefers-reduced-motion|reduced motion/i);
});

// ---- beat 3 and the clarity fixes ---------------------------------------------------------------------------------
test("RG2: a right line the level refuses says so first, and its jars are outline ticks, not a win", async () => {
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (out) => { out.feedback = "Aim with a rule this time: ask each jar a question, do not name the jars or count rows."; out.range = { hits: 1, misses: 0, wrong_picks: 0, targets_missed: 0, missed_targets: [], clean: false, rule_broken: "forbids" }; } } });
    t.levelButton(1).click(); await tick();
    await t.run("Q-053");
    assert.match(t.$("feedback").textContent, /^Right jars, but this run does not count yet\. Aim with a rule this time/);
    const hit = t.jars().find((j) => hasClass(j, "hit"));
    assert.ok(hasClass(hit, "refused"), "an outline tick");
    assert.equal(t.$("next").hidden, true, "no way on yet");
    assert.equal(byClass(t.$("wave-list"), "wave")[0].children[1].textContent, "", "the level is not marked done");
    assert.equal(t.$("feedback").className.includes("notyet"), true);
    assert.equal(speaker().length, 0, "a refused run is silent");
  });
});

test("RG4: the R habits for and (& and &&) get a coaching line, and .&& is named", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(9).click(); await tick();
    await t.run('logbook[(logbook.batch_id .== "B05") & (logbook.tray_id .!= "T-F"), :]');
    assert.match(t.$("feedback").textContent, /Julia wants a dot here too: \.& combines/);
    assert.equal(t.$("feedback").className.includes("alert"), true, "the lesson error style");
    await t.run('logbook[(logbook.batch_id .== "B05") && (logbook.tray_id .!= "T-F"), :]');
    assert.match(t.$("feedback").textContent, /Julia wants a dot here too/);
    await t.run('logbook[(logbook.batch_id .== "B05") .&& (logbook.tray_id .!= "T-F"), :]');
    assert.match(t.$("feedback").textContent, /no \.&& or \.\|\|/);
    await t.run("undefined_name_in_a_line");
    assert.doesNotMatch(t.$("feedback").textContent, /dot here too/, "other errors keep their own line");
  });
});

test("RG5: a jar picked twice is drawn as a repeat, and the count line says which", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(7).click(); await tick();
    await t.run("Q-041 Q-041 Q-043 Q-044");
    const again = t.jars().find((j) => hasClass(j, "again"));
    assert.ok(again && again.all().some((n) => n.textContent === "twice"));
    assert.match(byClass(t.board(), "board-summary")[0].textContent, /Q-041 came twice/);
  });
});

test("RG6: the subtitle fits the level and does not change after the first run", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    const first = t.$("then-line").textContent;
    assert.equal(first, "Hit every ringed jar and nothing else.");
    t.levelButton(3).click(); await tick();
    const after = t.$("then-line").textContent;
    assert.match(after, /^Aim from the words\. A right jar turns green and an extra one red\. After 3 tries, the jars you missed get a ring\.$/);
    await t.run("Q-041 Q-042");
    assert.equal(t.$("then-line").textContent, after, "no layout jump");
    assert.equal(byClass(t.board(), "jar").some((j) => hasClass(j, "missed")), false, "round 4: one wrong run does not paint the answer");
  });
});

test("RG7: a clean line the lesson did not teach still passes, with a nudge", async () => {
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (out, m) => { out.picked_ids = ["Q-053"]; out.range = { hits: 1, misses: 0, wrong_picks: 0, targets_missed: 0, missed_targets: [], clean: true, shot_number: m.shot_number }; } } });
    await t.run("logbook[9,:]");
    assert.match(t.$("feedback").textContent, /Level done/);
    assert.equal(t.$("works-too").hidden, false);
    assert.match(t.$("works-too").textContent, /That also works\. The lesson picked from a column, logbook\.jar_id\[9\]\./);
    await t.run("logbook.jar_id[9]");
    assert.equal(t.$("works-too").hidden, true, "the taught line gets no nudge");
  });
});

test("RG8: a small editor and a big hit: jars at least 60px wide, editor no taller than three lines", () => {
  assert.match(rangeCss, /\.jar \{ width: (6\d|7\d|8\d)px; \}/);
  assert.match(rangeCss, /#code \{[^}]*height: 4\.6em/);
  assert.match(rangeCss, /button\.wave \{[^}]*min-height: 40px/, "a level button is a real target");
});

test("RG9: the finish: clearing every level, the boss beaten, and each line beside a picture of its jars", async () => {
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (out, m) => {
      const w = rangeFile.waves.find((x) => x.id === m.challenge);
      const ids = w.targets || w.rule.from.slice(0, w.rule.count);
      out.picked_ids = ids; out.range = { hits: ids.length, misses: 0, wrong_picks: 0, targets_missed: 0, missed_targets: [], clean: true, shot_number: m.shot_number };
    } } });
    for (let n = 1; n <= 11; n++) {
      await t.run("line " + n);
      assert.match(t.$("feedback").textContent, /Level done/, "level " + n);
      if (n === 11) assert.match(t.$("feedback").textContent, /^Boss beaten\./);
      assert.equal(t.$("next").textContent, n === 11 ? "Finish" : "Next level");
      t.$("next").click(); await tick();
    }
    assert.equal(t.$("screen-range-end").hidden, false);
    const finale = t.dyn("range-finale");
    assert.equal(finale.hidden, false);
    assert.match(finale.textContent, /Boss beaten/);
    assert.match(finale.textContent, /The last shelf/);
    const lines = t.$("range-end-lines").children;
    assert.equal(lines.length, 11);
    const minis = byClass(t.$("range-end-lines"), "mini");
    assert.equal(minis.length, 11);
    assert.equal(minis[0].children.length, 12);
    assert.equal(minis[10].children.length, 30, "the boss picture has thirty jars");
    assert.equal(minis[10].children.filter((m) => hasClass(m, "on")).length, rangeFile.waves[10].targets.length);
    assert.equal(minis[1].children.filter((m) => hasClass(m, "on")).length, 3, "level 2 picked three jars");
    assert.ok(hasClass(lines[10], "boss"));
    assert.ok(speaker().length > 0, "the finish has its own fanfare");
    assert.match(fs.readFileSync(path.join(root, "web/lesson.html"), "utf8"), /<h1>Range cleared<\/h1>/);
  });
});

test("no range text says Hits, points, stars or score: not in the file, not on the screen in any state", async () => {
  const strings = [];
  (function walk(v, key) { if (typeof v === "string" && key !== "example" && key !== "when_code") strings.push(v); else if (v && typeof v === "object") Object.keys(v).forEach((k) => walk(v[k], k)); })(rangeFile);
  strings.forEach((s) => assert.doesNotMatch(s, /\bHits\b|points|stars|score/i, s));
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (out, m) => { if (/refused/.test(m.code)) out.range = { hits: 1, misses: 0, wrong_picks: 0, missed_targets: [], clean: false, rule_broken: "forbids" }; } } });
    const seen = [];
    const snap = () => seen.push(Object.keys(t.page.byId).map((id) => t.page.byId[id].textContent).join(" | ") + " " + t.$("board").attrs["aria-label"]);
    snap();
    for (const [n, code] of [[1, "Q-052"], [1, "Q-053"], [1, "refused Q-053"], [6, "Q-043 Q-041"], [7, "Q-041 Q-041 Q-043 Q-044"], [11, "Q-076 Q-061"], [9, "logbook[a & b]"]]) {
      t.levelButton(n).click(); await tick(); await t.run(code); snap();
    }
    seen.forEach((s) => assert.doesNotMatch(s, /\bHits\b|\bpoints?\b|\bstars?\b|\bscores?\b/i));
    assert.ok(seen.some((s) => /Right jars: /.test(s)));
  });
});

test("the range code keeps the old rules: no timer, no countdown, no leaderboard", () => {
  const js = rangeSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(js, /setInterval|requestAnimationFrame|Date\.now|performance\.now|countdown|leaderboard|high score/i);
});

// ---- "Julia's own message" holds Julia's real text only (never invent output) ----
const FOLD_OPEN = "Something went wrong running this line.\n\n";
async function rangeErrorRun(message, status = "error", feedback = "Julia could not run this. Read your line again.") {
  let out;
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (o) => { o.status = status; o.message = message; o.feedback = feedback; delete o.picked_ids; } } });
    t.levelButton(1).click(); await tick();
    await t.run("logbook.jar_id[Q-1]");
    const fold = t.$("julia-msg");
    const find = (n, tag) => (n.tag === tag ? [n] : n.children.flatMap((c) => find(c, tag)));
    out = { hidden: fold.hidden, text: fold.hidden ? "" : find(fold, "pre").map((n) => n.textContent).join(""), feedback: t.$("feedback").textContent };
  });
  return out;
}
test("range: a stand-in line alone never fills the fold named Julia's own message", async () => {
  for (const m of ["Something went wrong running this line.", "A function was called with the wrong kind of argument.",
    "Julia couldn't parse this line. Look for a missing bracket, a missing comma, or a missing end keyword."]) {
    const r = await rangeErrorRun(m);
    assert.equal(r.hidden, true, m);
  }
});
test("range: the stand-in head is dropped and Julia's real text stays", async () => {
  const r = await rangeErrorRun(FOLD_OPEN + "UndefVarError: `zz` not defined");
  assert.equal(r.text, "UndefVarError: `zz` not defined");
});
test("range: the game's protected-input note is the feedback line, not Julia's message", async () => {
  const note = "The supplied logbook records changed. Keep the source table unchanged; create a separate summary or copy, then try again.";
  const r = await rangeErrorRun(FOLD_OPEN + note);
  assert.equal(r.hidden, true);
  assert.equal(r.feedback, note);
});
test("range: a timeout note or a shown-as-text note is not Julia's message", async () => {
  assert.equal((await rangeErrorRun("Your code ran for more than 5.0 seconds and was stopped. Loops that never finish are the usual cause.", "timeout", "Julia took too long.")).hidden, true);
  assert.equal((await rangeErrorRun("This result is a function or a type you just defined, so the game shows it as text: f. To use it, call it on the same line (for example f(3)).", "ok", "Ran.")).hidden, true);
});

// ---- fix round 4 -------------------------------------------------------------------------------------------------
test("R5 data: level 4 is a batch then a tray, level 9 is a batch minus one named jar, level 10 pays off with three jars", () => {
  const w4 = rangeFile.waves[3], w9 = rangeFile.waves[8], w10 = rangeFile.waves[9];
  // The practice twelve, as src/lessons.jl builds them (Lesson 1's data): B04 and B05, two jars on each of T-D, T-E, T-F.
  const trays = ["T-D", "T-D", "T-E", "T-E", "T-F", "T-F"];
  const seenB04 = [true, false, true, true, false, false], seenB05 = [true, true, false, true, true, false];
  const jars = [];
  trays.forEach((t, i) => jars.push({ id: "Q-04" + (i + 1), b: "B04", t, d: seenB04[i] }));
  trays.forEach((t, i) => jars.push({ id: "Q-05" + (i + 1), b: "B05", t, d: seenB05[i] }));
  const pick = (f) => jars.filter(f).map((j) => j.id);
  assert.deepEqual(w4.targets, pick((j) => j.b === "B05" && j.t === "T-E"));
  assert.deepEqual(w9.targets, pick((j) => j.b === "B05" && j.id !== "Q-053"));
  assert.deepEqual(w10.targets, pick((j) => !j.d && j.t !== "T-E" && j.b !== "B05"));
  assert.ok(w10.targets.length >= 3, "level 10 picks at least three jars");
  // No level is a format rule: neither level asks for a column, and neither claims a requires it does not need.
  [w4, w9].forEach((w) => { assert.ok(!/jar_id column|ids only/i.test(w.target + w.title), w.id + " is not an output-shape rule"); assert.equal(w.check.requires, undefined, w.id + " requires nothing it cannot prove"); });
  // Level 9 may name Q-053 and no other jar; every other jar id is still forbidden.
  assert.ok(!w9.check.forbids.includes("Q-053"));
  assert.ok(w9.targets.every((id) => w9.check.forbids.includes(id)), "the five target ids cannot be typed");
  assert.match(w9.example, /jar_id\.!="Q-053"/);
  assert.equal(rangeFile.missed_rings_after, 3);
  assert.equal(rangeFile.waves[6].group_words, "jars where springtails were seen");
});

test("R5 room: Next stays inside 768 px because the two lines under the jars share a row and the editor is 4.6em", () => {
  // Cause of the round 4 regression (Next ended at 785 px on w2, w4, w8, w9, w10): the summary and the "kept n of m jars" note stacked.
  assert.match(rangeCss, /#app\[data-screen="range"\] \.board-summary, #app\[data-screen="range"\] \.sweep-note \{ display: inline-block;/);
  assert.match(rangeCss, /\.nw \{ white-space: nowrap; \}/);
});

test("R5 dot: a plain != or == on a column gets the dot line, not the generic one", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(6).click(); await tick();
    await t.run('logbook[logbook.tray_id != "T-D", :]');
    assert.equal(t.$("feedback").textContent, "Add a dot: write .!= instead of !=, so Julia compares every value, one at a time.");
    await t.run('logbook[logbook.tray_id == "T-D", :]');
    assert.match(t.$("feedback").textContent, /^Add a dot: write \.== instead of ==/);
    await t.run('logbook[logbook.tray_id .!= "T-D", :]');
    assert.doesNotMatch(t.$("feedback").textContent, /Add a dot/, "a dotted sign is left alone");
  });
});

test("R5 wrap: tray, batch and jar names in the target and quoted values in the finale lines never break at the hyphen", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(10).click(); await tick();
    const nw = byClass(t.$("prompt"), "nw").map((n) => n.textContent);
    assert.deepEqual(nw, ["T-E"]);
    assert.equal(t.$("prompt").textContent, "Level 10: " + rangeFile.waves[9].target);
  });
});

test("R4 columns: the server sends plain names; the strip says Columns: and shows every name from level 5 on", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(5).click(); await tick();
    const strip = t.dyn("range-cols");
    assert.equal(strip.hidden, false);
    assert.equal(strip.textContent, "Columns:jar_idtray_idbatch_iddetected");
  });
});

test("R4 peek: names(logbook) is not scored, not counted, and says what it showed", async () => {
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (out, m) => { if (/names\(/.test(m.code)) { out.status = "ok"; out.picked_ids = ["jar_id", "tray_id", "batch_id", "detected"]; out.feedback = "You picked 4 jars that are not targets."; } } } });
    t.levelButton(5).click(); await tick();
    await t.run("names(logbook)");
    assert.match(t.$("feedback").textContent, /^That shows the column names, not jars\./);
    assert.equal(t.jars().filter((j) => hasClass(j, "miss")).length, 0, "no red crosses");
    assert.equal(byClass(t.board(), "board-summary").every((n) => !/Right jars/.test(n.textContent)), true);
    await t.run("Q-041");
    assert.match(byClass(t.board(), "board-summary")[0].textContent, /Right jars: 1 of 7/, "the next real run is the first run");
  });
});

test("R4 logbook[9]: a table given one index gets a friendly line, with the table's name", async () => {
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (o) => { o.status = "error"; delete o.picked_ids; o.feedback = "Julia could not run this. Read your line again and check each name and bracket.";
      o.message = "ArgumentError: syntax df[column] is not supported use df[!, column] instead"; } } });
    t.levelButton(1).click(); await tick();
    await t.run("logbook[9]");
    assert.equal(t.$("feedback").textContent, "A table needs rows, a comma, then columns, as in logbook[9,:]. To pick from one column, use logbook.jar_id[9].");
    assert.equal(t.$("julia-msg").hidden, false, "Julia's own message is still there to open");
  });
});

test("R4 rings: on 'aim from the words' levels one wrong run shows only the player's own picks; the missed jars get a ring on the third try or when the level is done", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(5).click(); await tick();
    const states = () => ({ missed: t.jars().filter((j) => hasClass(j, "missed")).length, target: t.jars().filter((j) => hasClass(j, "target")).length });
    assert.deepEqual(states(), { missed: 0, target: 0 }, "no rings before a run");
    await t.run("Q-041 Q-042");
    assert.equal(t.jars().filter((j) => hasClass(j, "hit")).length, 1);
    assert.equal(t.jars().filter((j) => hasClass(j, "miss")).length, 1);
    assert.deepEqual(states(), { missed: 0, target: 0 }, "the answer is not painted");
    assert.match(byClass(t.board(), "board-summary")[0].textContent, /Right jars: 1 of 7\. Extra jars: 1/, "the counts still say how close it is");
    await t.run("Q-041");
    assert.equal(states().missed, 0, "second try: still none");
    await t.run("Q-041");
    assert.equal(states().missed, 6, "third try: the six jars still missed get a ring");
    t.levelButton(1).click(); await tick();
    assert.equal(t.jars().filter((j) => hasClass(j, "target")).length, 1, "a 'before' level still shows its ring at once");
  });
});

test("R4 level 7: the group is named in words, not 'the jars named in the target'", async () => {
  await withBrowser({}, async () => {
    const t = await start({ hooks: { reply: (o) => { o.feedback = "Some picks are not in the right group. Pick only from the jars named in the target."; } } });
    t.levelButton(7).click(); await tick();
    await t.run("Q-042 Q-045 Q-046 Q-053");
    assert.equal(t.$("feedback").textContent, "Some picks are not in the right group. Pick only from the jars where springtails were seen.");
  });
});

test("R4 hint: it opens straight under the buttons, in the editor's column, not under the ladder", async () => {
  await withBrowser({}, async () => {
    const t = await start();
    t.levelButton(3).click(); await tick();
    assert.doesNotMatch(rangeSrc, /\$\("waves"\)[^;]*appendChild\(\$\("wave-hint-text"\)\)/);
    t.$("wave-hint").click(); await tick();
    assert.equal(t.$("wave-hint-text").hidden, false);
    assert.ok(!t.$("waves").all().includes(t.$("wave-hint-text")), "not inside the ladder column");
  });
});

test("R4 wait cue: a Run that waits over a second says so and the jars pulse; both stop with the answer", async () => {
  await withBrowser({}, async () => {
    const t = await start({ hooks: { delay: 1300 } });
    t.$("code").value = "Q-053"; t.$("run").click();
    assert.equal(t.$("feedback").textContent, "Running...");
    await new Promise((r) => setTimeout(r, 1100));
    assert.match(t.$("feedback").textContent, /^Still running\./);
    assert.equal(t.$("board").attrs["data-waiting"], "1");
    await new Promise((r) => setTimeout(r, 450));
    assert.doesNotMatch(t.$("feedback").textContent, /Running|Still running/);
    assert.equal(t.$("board").attrs["data-waiting"], undefined);
  });
});

test("R4 the boss win: a gold board, a warmer banner, and Finish waits for the fanfare (same mute button; reduced motion has no flash)", async () => {
  const win = { hooks: { reply: (out, m) => {
    const w = rangeFile.waves.find((x) => x.id === m.challenge);
    const ids = w.targets || w.rule.from.slice(0, w.rule.count);
    out.picked_ids = ids; out.range = { hits: ids.length, misses: 0, wrong_picks: 0, targets_missed: 0, missed_targets: [], clean: true, shot_number: m.shot_number };
  } } };
  for (const reduced of [false, true]) {
    await withBrowser({ reduced }, async () => {
      const t = await start(win);
      for (let n = 1; n <= 10; n++) { await t.run("line " + n); t.$("next").click(); await tick(); }
      await t.run("boss line");
      assert.match(t.$("feedback").textContent, /^Boss beaten\. The last shelf is yours\./);
      assert.ok(hasClass(t.$("feedback"), "boss-win"));
      // round 6: the kicker, the serif line, the gold "5 of 5", and no footer line on the boss win
      assert.ok(t.$("feedback").all().some((n) => hasClass(n, "boss-kicker") && /^Boss beaten/.test(n.textContent)), "BOSS BEATEN kicker");
      assert.ok(t.$("board").all().some((n) => hasClass(n, "win-num") && /^\d+ of \d+$/.test(n.textContent)), "the gold N of N");
      assert.equal(t.$("data-label").hidden, true);
      assert.ok(hasClass(t.$("board"), "boss-won"));
      assert.equal(hasClass(t.$("board"), "boss-flash"), !reduced, reduced ? "calm under reduced motion: no flash" : "the flash runs");
      assert.equal(t.$("next").attrs["data-held"], "1", "Finish is not shown while the fanfare is still to play (it keeps its place, hidden by visibility)");
      assert.ok(speaker().length > 0, "the fanfare is asked for at once");
      await new Promise((r) => setTimeout(r, reduced ? 1100 : 3200));
      assert.equal(t.$("next").attrs["data-held"], undefined, "Finish appears after the fanfare");
      assert.equal(t.$("next").hidden, false);
      assert.equal(t.$("next").textContent, "Finish");
    });
  }
  // a muted player gets the same moment, silent, and the way on appears a little sooner
  const st = memoryStorage(); st.setItem(Range.SOUND_KEY, "off");
  await withBrowser({ reduced: true, storage: st }, async () => {
    const t = await start(win);
    for (let n = 1; n <= 10; n++) { await t.run("line " + n); t.$("next").click(); await tick(); }
    await t.run("boss line");
    assert.equal(speaker().length, 0);
    assert.equal(t.$("next").attrs["data-held"], "1");
    await new Promise((r) => setTimeout(r, 750));
    assert.equal(t.$("next").attrs["data-held"], undefined);
  });
  // an ordinary level win is not held back
  await withBrowser({}, async () => {
    const t = await start(win);
    await t.run("line");
    assert.equal(t.$("next").hidden, false);
    assert.equal(t.$("next").attrs["data-held"], undefined);
    assert.ok(!hasClass(t.$("feedback"), "boss-win"));
  });
});

test("R4 a player who has done only Lesson 1 gets 'Levels 1 to 3 done', what opens next, and a link", async () => {
  await withBrowser({}, async () => {
    const t = await start({ lessons: passedLessons(["lesson1"]), hooks: { reply: (out, m) => {
      const w = rangeFile.waves.find((x) => x.id === m.challenge); const ids = w.targets;
      out.picked_ids = ids; out.range = { hits: ids.length, misses: 0, wrong_picks: 0, targets_missed: 0, missed_targets: [], clean: true, shot_number: m.shot_number };
    } } });
    t.$("screen-range-end").appendChild(new FNode("h1"));   // the fake page does not parse lesson.html's heading
    for (let n = 1; n <= 3; n++) { await t.run("line " + n); t.$("next").click(); await tick(); }
    assert.equal(t.$("screen-range-end").hidden, false);
    const h1 = t.$("screen-range-end").children.find((c) => c.tag === "h1");
    assert.equal(h1 ? h1.textContent : "", "Levels 1 to 3 done");
    assert.equal(t.$("range-end-say").textContent, "Every open level is done. Here is the line that cleared each one.");
    assert.match(t.$("range-end-more").textContent, /^Lesson 2 opens the next levels \(Levels 4 and 5\)\. In all, 8 more levels open as you finish more lessons\./);
    const link = t.$("range-end-more").all().find((n) => n.tag === "a");
    assert.equal(link.attrs.href, "lesson.html?lesson=lesson2");
    assert.equal(link.textContent, "Go to Lesson 2");
    assert.ok(t.$("range-end-back"), "a way back to the levels stays");
  });
});

test("R4 finale: every strip has a caption and sits on one row (the CSS keeps the boss strip off a second row)", () => {
  assert.match(rangeCss, /\.mini \.m \{[^}]*flex: 0 1 26px/);
  assert.match(rangeCss, /li\.cleared \.mini \{[^}]*flex-wrap: nowrap/);
});

test("R4: the boss win banner leaves room for the pass card's check badge (the badge sits in the left 56 px)", () => {
  const css = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "web", "lesson-range.css"), "utf8");
  const rule = (css.match(/#feedback\.ok\.boss-win\s*\{([^}]*)\}/) || [])[1] || "";
  const pad = rule.match(/padding:\s*([^;]+);/);
  const left = pad ? pad[1].trim().split(/\s+/) : [];
  const leftPx = parseInt(left.length === 4 ? left[3] : left.length >= 2 ? left[1] : left[0], 10);
  assert.ok(leftPx >= 56, "boss-win padding-left is " + leftPx + "px; the check badge needs 56px");
});

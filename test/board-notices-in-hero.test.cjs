"use strict";
// Round 5 (Board): every save notice sits in the hero, above Start, so it is in the first 768 px.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const web = path.join(__dirname, "..", "web", "course");
const courseState = require("../web/course/course-state.js");
const legacy = require("../web/course/legacy-import.js");

function memoryStorage(failWrites) {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (failWrites) throw new Error("blocked"); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); }
  };
}
function fake(id) {
  const el = {id, href: "", textContent: "", hidden: false, dataset: {}, className: "", onclick: null, children: [], parent: null,
    classList: {toggle() {}, add() {}, remove() {}}, setAttribute(k, v) { el.attrs = el.attrs || {}; el.attrs[k] = v; }};
  el.append = (...kids) => { for (const k of kids) { if (k.parent) k.parent.children = k.parent.children.filter(c => c !== k); k.parent = el; el.children.push(k); } };
  el.replaceChildren = (...kids) => { el.children = []; el.append(...kids); };
  return el;
}
function board(storage) {
  const elements = {}, listeners = {};
  const document = {
    getElementById(id) { return elements[id] || (elements[id] = fake(id)); },
    createElement() { return fake("new"); },
    addEventListener(name, fn) { listeners[name] = fn; }
  };
  const window = {location: {search: "", protocol: "http:", host: "127.0.0.1:9630"}, localStorage: storage, document};
  const context = vm.createContext({window, document, URLSearchParams, console});
  for (const file of ["course-state.js", "legacy-import.js", "course-client.js", "intro-script.js", "course-board.js"])
    vm.runInContext(fs.readFileSync(path.join(web, file), "utf8"), context, {filename: file});
  listeners.DOMContentLoaded();
  return elements;
}

test("index.html: the notice slot is inside the hero, before Start; the quiet status home is outside it", () => {
  const html = fs.readFileSync(path.join(web, "index.html"), "utf8");
  const heroStart = html.indexOf('<section class="hero"'), heroEnd = html.indexOf("</section>", heroStart);
  const slot = html.indexOf('id="save-notice-slot"'), start = html.indexOf('id="continue-action"'), home = html.indexOf('id="board-status-home"');
  assert.ok(slot > heroStart && slot < start && start < heroEnd, "slot is in the hero above Start");
  assert.ok(home > heroEnd, "the quiet home of the status line is below the hero");
  assert.match(html, /id="hero-save-sentence"/);
});

test("cannot save: the notice moves into the hero and the hero no longer says the place is saved", () => {
  const p = board(memoryStorage(true));
  assert.equal(p["board-status"].parent.id, "save-notice-slot");
  assert.match(p["board-status"].textContent, /not letting Julia Time save/);
  assert.doesNotMatch(p["hero-save-sentence"].textContent, /saved/i);
  assert.equal(p["board-hero"].dataset.notice, "on");
});

test("unreadable save: the notice moves into the hero and the hero does not claim a save", () => {
  const t = memoryStorage();
  t.setItem("julia-time:missing-fleas:course:v1:progress-v1", "{not json");
  const p = board(t);
  assert.equal(p["board-status"].parent.id, "save-notice-slot");
  assert.match(p["board-status"].textContent, /could not be read/);
  assert.doesNotMatch(p["hero-save-sentence"].textContent, /saved/i);
});

test("a normal Board keeps the status line below the hero and the hero sentence whole", () => {
  const p = board(memoryStorage());
  assert.equal(p["board-status"].parent && p["board-status"].parent.id, "board-status-home");
  assert.match(p["hero-save-sentence"].textContent, /your place is saved here/);
  assert.notEqual(p["board-hero"].dataset.notice, "on");
});

test("changed save: the notice and its button render in the hero when a source grew after it was imported", () => {
  const t = memoryStorage();
  t.setItem(legacy.c2ProgressKey(""), JSON.stringify({step: "group", accepted: {group: "groupby(jars, :tray_id)"}}));
  board(t); // first visit imports it and records the receipt
  t.setItem(legacy.c2ProgressKey(""), JSON.stringify({step: "counts", accepted: {group: "groupby(jars, :tray_id)", counts: "combine(groups, nrow => :n)"}}));
  const p = board(t);
  assert.equal(p["changed-history-action"].hidden, false);
  assert.equal(p["changed-history-action"].textContent, "Use the changed save");
  assert.equal(p["board-status"].parent.id, "save-notice-slot");
  assert.equal(p["changed-history-action"].parent.id, "save-notice-slot");
  assert.match(p["board-status"].textContent, /Some older saved data on this computer has changed/);
  assert.equal(p["board-hero"].dataset.notice, "on");
});

test("the Julia-problem text names the button that is there: Reconnect, never Check Julia again", () => {
  const src = fs.readFileSync(path.join(web, "setup-status-board.js"), "utf8");
  const heroSide = src.slice(src.indexOf("function plainProblem"), src.indexOf("const panel"));
  assert.doesNotMatch(heroSide, /Check Julia again/);
  assert.match(heroSide, /press Reconnect/);
  assert.doesNotMatch(src.slice(src.indexOf("const message"), src.indexOf("const message") + 400), /Check Julia again/);
});

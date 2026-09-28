"use strict";
// r1 bug 4 (2026-09-27): "Watch the intro" and "How to play" dropped ?attempt=, so coming back to the
// Case Board showed "0 of 6" to a student who had finished. Run course-board.js against a small fake page.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const web = path.join(__dirname, "..", "web", "course");

function fakeElement(id) {
  return {id, href:"", textContent:"", hidden:false, dataset:{}, className:"", onclick:null,
    classList:{toggle() {}, add() {}, remove() {}}, append() {}, replaceChildren() {}, setAttribute() {}};
}
function boardAt(search) {
  const elements = {}, listeners = {};
  const document = {
    getElementById(id) { return elements[id] || (elements[id] = fakeElement(id)); },
    createElement(tag) { return fakeElement(tag); },
    addEventListener(name, fn) { listeners[name] = fn; }
  };
  const window = {location:{search, protocol:"http:", host:"127.0.0.1:8003"}, localStorage:null, document};
  const context = vm.createContext({window, document, URLSearchParams, console});
  for (const file of ["course-state.js", "legacy-import.js", "course-client.js", "intro-script.js", "course-board.js"])
    vm.runInContext(fs.readFileSync(path.join(web, file), "utf8"), context, {filename:file});
  listeners.DOMContentLoaded();
  return elements;
}

test("the Case Board's intro and How to play links keep the attempt", () => {
  const page = boardAt("?attempt=f3-check");
  assert.equal(page["watch-intro-link"].href, "intro.html?attempt=f3-check");
  assert.equal(page["how-to-play-link"].href, "getting-started.html?attempt=f3-check");
});

test("without an attempt the links stay plain", () => {
  const page = boardAt("");
  assert.equal(page["watch-intro-link"].href, "intro.html");
  assert.equal(page["how-to-play-link"].href, "getting-started.html");
});

test("the Case Board page names both links so the script can find them", () => {
  const html = fs.readFileSync(path.join(web, "index.html"), "utf8");
  assert.match(html, /id="watch-intro-link"[^>]*href="intro\.html"[^>]*>Watch the intro/);
  assert.match(html, /id="how-to-play-link"[^>]*href="getting-started\.html"[^>]*>How to play/);
});

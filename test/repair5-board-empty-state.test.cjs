"use strict";

// Real-browser capture CB-01-start (2026-09-24): a FRESH Case Board, with nothing saved, still said
// "No historical browser progress is saved here yet." and "No historical browser evidence is saved here yet."
// The finished board already says "Completed in this browser" and "Your earlier answers are saved in this
// browser"; "historical" confuses learners. The internal provenance tag "historical-browser" stays as data.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

function read(file) { return fs.readFileSync(path.join(__dirname, "../web/course", file), "utf8"); }

function learnerStrings(source) {
  return (source.match(/"(?:[^"\\]|\\.)*"/g) || []).map(literal => literal.slice(1, -1));
}

test("a fresh board says plainly that no progress is saved in this browser", () => {
  for (const attempt of ["", "field-7"]) {
    const fresh = client.dashboardModel(client.loadCourseState(memoryStorage(), attempt));
    assert.equal(fresh.historicalNotice, "No progress is saved in this browser yet.");
  }
  assert.equal(client.dashboardModel(courseState.emptyCourseState()).historicalNotice, "No progress is saved in this browser yet.");
});

test("a fresh board's evidence panel says plainly that no evidence is saved in this browser", () => {
  const board = read("course-board.js");
  assert.match(board, /"No evidence is saved in this browser yet\."/);
  assert.doesNotMatch(board, /No historical browser evidence/);
});

test("the changed-data notice does not call saved work historical", () => {
  const notice = client.dashboardModel(Object.assign(courseState.emptyCourseState(), {historicalChanged: ["legacy-key"]})).historicalNotice;
  assert.doesNotMatch(notice, /historical/i);
  assert.match(notice, /in this browser changed\./);
  assert.match(notice, /Your saved work was left unchanged/);
});

test("no learner-visible Case Board text says historical; only the provenance tag keeps the word", () => {
  for (const file of ["course-client.js", "course-board.js"]) {
    const visible = learnerStrings(read(file)).filter(text => /historical/i.test(text) && text !== "historical-browser");
    assert.deepEqual(visible, [], file);
  }
  assert.doesNotMatch(read("index.html"), /historical/i);
});

test("the new empty-state lines use no em dash", () => {
  const fresh = client.dashboardModel(courseState.emptyCourseState());
  assert.doesNotMatch(fresh.historicalNotice, /—/);
  const board = read("course-board.js");
  const emptyEvidence = learnerStrings(board).find(text => /^No evidence/.test(text));
  assert.ok(emptyEvidence);
  assert.doesNotMatch(emptyEvidence, /—/);
});

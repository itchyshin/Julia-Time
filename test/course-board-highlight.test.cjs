"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");

test("the Case Board's established fact carries no highlight before any move is accepted", () => {
  const model = client.dashboardModel(courseState.emptyCourseState());
  assert.equal(model.caseThread.hasEstablishedFact, false);
});

test("the Case Board's established fact is flagged for a highlight once a move is accepted", () => {
  const model = client.dashboardModel(courseState.makeCourseState({
    moves:[{key:"C1/select-records", provenance:"historical-browser"}]
  }));
  assert.equal(model.caseThread.hasEstablishedFact, true);
});

test("course-board.js toggles a highlight class on the established line from that flag", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/course/course-board.js"), "utf8");
  assert.match(source, /case-established/);
  assert.match(source, /hasEstablishedFact/);
  assert.match(source, /classList\.toggle/);
});

test("the highlight animation is a bounded fade, not a longer effect, and respects reduced motion", () => {
  const css = fs.readFileSync(path.join(__dirname, "../web/course/course.css"), "utf8");
  const match = css.match(/animation\s*:\s*[^;]*?([\d.]+)s/);
  assert.ok(match, "the highlight rule should declare a bounded animation duration");
  assert.ok(Number(match[1]) <= 1, "the highlight fade should not run longer than about a second");
  assert.match(css, /prefers-reduced-motion:reduce/);
});

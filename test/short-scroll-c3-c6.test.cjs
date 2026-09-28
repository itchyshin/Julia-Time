"use strict";

// short-scroll (2026-09-25): Chapter 3 move 1 and Chapter 6 stacked a move brief, full evidence
// tables/legend/candidate table, and a case-status card before the code box, pushing it about
// 1,660-1,580 px below the step title at 1280x900. These tests pin the new structure the layout
// fix relies on: C3's side-by-side table layout and shared data-label, and C6's shortened legend,
// shortened observed line, and closed case-status detail. The real-browser distance measurement
// (getBoundingClientRect from the step title to #code) lives in the handover, not here — jsdom
// has no layout engine to assert pixel distances against.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const web = file => fs.readFileSync(path.join(__dirname, "..", "web", file), "utf8");

test("C3 move 1's two evidence tables sit side by side on wide screens and share one data-label line", () => {
  const js = web("chapter3.js");
  const css = web("chapter3.css");
  assert.match(js, /el\.inputs\.classList\.toggle\("two-up",\s*metadata\.inputs\.length > 1\)/,
    "renderInputs marks the panel two-up only when there is more than one visible table");
  assert.match(js, /sharedLabel/, "a shared data-label is computed instead of repeating it per table");
  assert.match(css, /#visible-inputs\.two-up\s*\{\s*display:grid/,
    "the two-up class switches #visible-inputs to a grid layout");
  assert.match(css, /@media \(min-width:760px\)/, "the side-by-side layout only applies above 760px");
});

test("C3 move 1 does not repeat the required-result sentence a second time under the tables", () => {
  const html = web("chapter3.html");
  const js = web("chapter3.js");
  assert.doesNotMatch(html, /Your task: One row per report tray/);
  assert.doesNotMatch(js, /"Your task: " \+ copy\.returnSpec/);
});

test("C6 evidence-board legend names each model once per line, without the repeated per-card sentence", () => {
  const js = web("chapter6.js");
  assert.doesNotMatch(js, /assumed recorded-detection chance for one jar in this candidate model/,
    "that sentence is already stated once in the model-context intro paragraph");
  assert.match(js, /cardProbabilityLabel\(card\)/, "a card still shows p when its name does not already state it");
});

test("C6 case-status keeps the established fact and the limit visible; only why-now is behind a click", () => {
  // 2026-09-25 review: every step says what it does not establish (project spec), so status.unknown
  // stays visible; only the why-now reasoning sits in the closed details.
  const js = web("chapter6.js");
  const drawStart = js.indexOf("function drawCaseStatus()");
  const drawEnd = js.indexOf("function acceptedMoveKeys()");
  const body = js.slice(drawStart, drawEnd);
  assert.match(body, /established\.textContent = status\.established/);
  assert.match(body, /unknown\.textContent = status\.unknown/);
  assert.match(body, /why\.textContent = status\.why_now/);
  assert.match(body, /details\.append\(summary, why\)/);
  assert.match(body, /el\.caseStatus\.append\(eyebrow, established, unknown, details\)/,
    "the established fact and the limit stay outside the closed details, visible without a click");
});

test("C6 keeps the case-status id and aria-label position that repair6-c56 already protects", () => {
  const html = web("chapter6.html");
  assert.ok(html.indexOf('id="case-status"') < html.indexOf('id="editor-title"'));
  assert.match(html, /aria-label="Case status before you write"/);
});

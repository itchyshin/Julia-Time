"use strict";

// Repair 5 (2026-09-24 real-browser walk-through, captures screens-022 C2-19 to C2-21, C3-10,
// C3-15, C3-19): learners saw internal chapter ids ("the requested C2 result", "No C3 case
// finding", "Your earlier C3 work", "C1's .==") and, after an accepted rates run, the tray rack
// twice: once in "Your returned evidence" and again in the Descriptive summary's "The tray rack".
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const chapter2 = require("../web/chapter2.js");
const chapter3 = require("../web/chapter3.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const CHAPTER_ID = /\bC[1-6]\b/;
const visibleText = html => html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ");
const strings = value => typeof value === "string" ? [value]
  : Array.isArray(value) ? value.flatMap(strings)
  : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];

test("Chapter 2 and 3 pages show no internal chapter id in their static text", () => {
  for (const file of ["web/chapter2.html", "web/chapter3.html"]) {
    assert.doesNotMatch(visibleText(read(file)), CHAPTER_ID, file);
  }
});

test("C3 resume note names this chapter in plain words, in the page and the script alike", () => {
  const html = read("web/chapter3.html").match(/<p id="resume-saved-note">([^<]*)<\/p>/)[1];
  const js = read("web/chapter3.js").match(/resumeSavedNote\.textContent = "([^"]*)"/)[1];
  assert.equal(js, html, "the script sets the same note the page ships");
  assert.doesNotMatch(html, CHAPTER_ID);
  assert.match(html, /in this chapter/);
  assert.doesNotMatch(html, /—/, "no em dash in new learner-facing text");
});

test("C3 lesson copy refers to an earlier chapter by its learner-facing name", () => {
  for (const move of ["join-report-log", "filter-disagreement"]) {
    for (const text of strings(chapter3.lessonCopy(move))) assert.doesNotMatch(text, CHAPTER_ID, move + ": " + text);
  }
  assert.match(chapter3.lessonCopy("filter-disagreement").syntax, /^Chapter 1’s \.== compared/);
});

test("C2 and C3 server prose for a failed run names no internal chapter id", () => {
  const c2 = read("src/mystery_c2.jl").match(/\(false, "(Julia did not produce the requested[^"]*)"\)/)[1];
  assert.equal(c2, "Julia did not produce the requested result for this move.");
  const c3 = read("src/mystery_c3.jl").match(/"case" => "(No [^"]*case finding[^"]*)"/)[1];
  assert.doesNotMatch(c3, CHAPTER_ID);
  assert.match(c3, /^No case finding from this chapter is established/);
});

const RATE_ROWS = [{tray_id:"T-A", n:2, detected_n:2, rate:1}, {tray_id:"T-B", n:2, detected_n:2, rate:1}, {tray_id:"T-C", n:2, detected_n:1, rate:0.5}];
const RATE_COLUMNS = ["tray_id", "n", "detected_n", "rate"];
function applied(step, reply) {
  const before = chapter2.beginRun(chapter2.createState(), "r1", step);
  const after = chapter2.applyCaseResult(before, Object.assign({type:"case_result", chapter:"C2", request_id:"r1", step, status:"ok", pass:true}, reply));
  return {result:after.result, fresh:after.evidence !== before.evidence};
}

test("An accepted rates run draws its tray rack once, in the Descriptive summary", () => {
  const rates = applied("rates", {rows:RATE_ROWS, columns:RATE_COLUMNS});
  assert.equal(rates.fresh, true, "accepted rates fill the Descriptive summary's tray rack");
  assert.equal(chapter2.showsLiveRack(rates.result, rates.fresh), false, "so the returned-evidence panel does not repeat it");
  const counts = applied("counts", {rows:RATE_ROWS.map(({rate, ...row}) => row), columns:RATE_COLUMNS.slice(0, 3)});
  assert.equal(chapter2.showsLiveRack(counts.result, counts.fresh), true, "counts keep their returned rack");
  const group = applied("group", {rows:[{jar_id:"J-091", batch_id:"B09", tray_id:"T-A", detected:true}], columns:["jar_id", "batch_id", "tray_id", "detected"]});
  assert.equal(chapter2.showsLiveRack(group.result, group.fresh), true, "grouping keeps its returned rack");
  const unshowable = applied("rates", {rows:[{tray_id:"T-A", n:2, detected_n:2, rate:0.5}], columns:RATE_COLUMNS});
  assert.equal(unshowable.fresh, false);
  assert.equal(chapter2.showsLiveRack(unshowable.result, unshowable.fresh), true, "a rack is still drawn when no summary rack is");
  assert.equal(chapter2.showsLiveRack(Object.assign({}, rates.result, {pass:false}), false), false, "a rejected run draws no rack");
  const source = read("web/chapter2.js");
  assert.match(source, /if\(showsLiveRack\(result,freshEvidence\)\) renderRack\(result\.step,result\.rows,el\.liveRack,result\.row_text\)/, "the page asks before drawing the returned rack");
  assert.match(source, /renderEvidence\(state\.evidence,!freshEvidence\)/, "the summary rack uses the same freshness");
});

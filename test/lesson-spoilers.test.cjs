"use strict";
// Julia Time 0.5, gate I2: the lessons, the target range and the tutor guides train on practice data and name no
// case fact, so each chapter exam is the first place its answer appears. The facts come from the story canon
// (docs/dev-log/2026-09-28-story-canon.md) and the chapter data (src/mystery*.jl): the case jar ids J-081 to J-096,
// batch B09, tray T-C, the blank box on the paper form, 113 of 1,000 (about 1 in 9), 5 of 6, the story names and
// the 965 rounds of Lesson 6's old look-closer box.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

const CASE_FACTS = [
  {fact: "case jar ids J-081 to J-096", pattern: /J-0(8[1-6]|9[1-6])/},
  {fact: "case batch B09", pattern: /\bB09\b/},
  {fact: "case tray T-C", pattern: /\bT-C\b/},
  {fact: "the blank box on the paper form", pattern: /left blank|blank box|box was empty|was left empty|a blank became|form.{0,40}\b(blank|empty)\b/i},
  {fact: "113 of 1,000 rounds (about 1 in 9)", pattern: /\b113\b|0\.113|\b1 in 9\b|1 round in 9|1 time in 9|one in nine/i},
  {fact: "the notebook's 5 of 6", pattern: /\b5 of (the )?6\b|five of (the )?six/i},
  {fact: "the story names", pattern: /dying out|coin flip|thriving/i},
  {fact: "965 rounds", pattern: /\b965\b/},
];

function scannedFiles() {
  const lessons = fs.readdirSync(path.join(root, "lessons"))
    .filter(f => /^(lesson\d+|range)\.json$/.test(f)).map(f => path.join("lessons", f));
  const guides = fs.readdirSync(path.join(root, "docs", "course"))
    .filter(f => /^tutor-guide-\d+\.md$/.test(f)).map(f => path.join("docs", "course", f));
  return [...lessons, ...guides];
}

function leaks(text) {
  return CASE_FACTS.flatMap(({fact, pattern}) => {
    const found = text.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"));
    return found ? [`${fact}: ${[...new Set(found)].slice(0, 3).join(", ")}`] : [];
  });
}

test("the scan catches every case fact (positive control)", () => {
  const sample = "J-091 and J-083 of batch B09 on tray T-C. The box on the paper form was left blank. " +
    "113 of 1,000, about 1 in 9. The notebook shows 5 of 6. Dying out, Coin flip, Thriving. 965 rounds.";
  assert.equal(leaks(sample).length, CASE_FACTS.length);
  assert.deepEqual(leaks("Type your line in the empty box on the right. Practice batch B05 on tray T-F."), []);
});

test("the lessons, the range and the tutor guides are the files scanned", () => {
  const files = scannedFiles();
  for (let n = 1; n <= 6; n++) {
    assert.ok(files.includes(path.join("lessons", `lesson${n}.json`)), `lesson${n}.json is scanned`);
    assert.ok(files.includes(path.join("docs", "course", `tutor-guide-${n}.md`)), `tutor-guide-${n}.md is scanned`);
  }
  assert.ok(files.includes(path.join("lessons", "range.json")), "range.json is scanned");
});

for (const file of scannedFiles()) {
  test(`${file} names no case fact`, () => {
    assert.deepEqual(leaks(fs.readFileSync(path.join(root, file), "utf8")), [], `${file} gives away the case`);
  });
}

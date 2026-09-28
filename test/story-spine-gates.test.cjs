// Story spine gates (docs/design/06-story-spine.md, approved by Shinichi 2026-09-27; .unlazy ledger
// leaf-story). The case is one question in three parts; no learner text says "Claim 1/2"; the C5 names
// card and the C5/C6 coaching do not hand over a finished answer line.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const CASE_QUESTION = "Toto's report says the springtails are dying out. Are they?";
const PARTS = [
  ["web/index.html", "Part 1 of 3 · Check the report"],
  ["web/chapter2.html", "Part 1 of 3 · Check the report"],
  ["web/chapter3.html", "Part 1 of 3 · Check the report"],
  ["web/chapter4.html", "Part 2 of 3 · Check the notebook"],
  ["web/chapter5.html", "Part 2 of 3 · Check the notebook"],
  ["web/chapter6.html", "Part 3 of 3 · Test the claim"],
];

for (const [file, label] of PARTS) {
  test(`part label: ${file} opens with "${label}"`, () => {
    assert.ok(read(file).includes(label), `${file} is missing its part label`);
  });
}

test("case question is on the Chapter 1 opening and the Case Board", () => {
  const norm = s => s.replace(/&#39;|&rsquo;|’/g, "'");
  assert.ok(norm(read("web/index.html")).includes(CASE_QUESTION), "C1 opening");
  const board = ["web/course/index.html", "web/course/course-board.js", "web/course/course-client.js"].map(read).map(norm).join("\n");
  assert.ok(board.includes(CASE_QUESTION), "Case Board");
});

test("claim wording: no learner-facing Claim 1 / Claim 2", () => {
  const out = execFileSync("node", ["tools/check-plain.cjs", "."], { cwd: ROOT, env: Object.assign({}, process.env, { BANNED: "Claim 1|Claim 2" }), encoding: "utf8" });
  assert.match(out, /PLAIN-WORDS-CLEAN/);
});

test("leak: the C5 step 2 names card shows names, not the finished lines", () => {
  const html = read("web/chapter5.html");
  const card = html.slice(html.indexOf('id="names-frequency"'), html.indexOf("</dl>", html.indexOf('id="names-frequency"')));
  assert.ok(card.length > 0, "names card still exists");
  assert.doesNotMatch(card, /events = sim_counts \.&gt;= observed_count|events = sim_counts \.>= observed_count/);
  assert.doesNotMatch(card, /sum\(events\) \/ length\(events\)/);
});

test("leak: C6 and/& coaching names the brackets idea without the finished row rule", () => {
  const c6 = require(path.join(ROOT, "web/chapter6.js"));
  const full = /\(stories\.lower \.<= observed_count\) \.& \(observed_count \.<= stories\.upper\)/;
  const andErr = c6.challengeRecovery({ status: "error", message: "ParseError:\nstories[(stories.lower .<= observed_count) and (observed_count .<= stories.upper), :]\n#  unexpected comma in array expression" });
  const ampErr = c6.challengeRecovery({ status: "error", message: "MethodError: no method matching &(::Int64, ::Vector{Int64})" });
  for (const text of [andErr, ampErr]) {
    assert.match(text, /\.&/);
    assert.match(text, /bracket/i);
    assert.doesNotMatch(text, full);
  }
});

// G3: every typing step says why its code answers the story's question (a step-why line under its title).
test("step-why: every typing step in all six chapters has its why-this-code line", () => {
  const staticWhy = file => (read(file).match(/class="step-why">([\s\S]*?)<\/p>/g) || []).filter(m => m.replace(/<[^>]+>/g, "").replace(/class="step-why">/, "").trim()).length;
  assert.ok(staticWhy("web/index.html") >= 2, "C1 practice and C1 case");
  assert.ok(staticWhy("web/chapter3.html") >= 1, "C3 practice");
  assert.ok(staticWhy("web/chapter4.html") >= 1, "C4 step");
  assert.ok(staticWhy("web/chapter6.html") >= 1, "C6 step");
  for (const [file, id] of [["web/chapter2.html","step-why"],["web/chapter3.html","step-why"],["web/chapter5.html","step-why"]])
    assert.ok(read(file).includes(`id="${id}"`), `${file} has the dynamic step-why element`);
  const c2 = require(path.join(ROOT, "web/chapter2.js"));
  for (const step of ["group", "counts", "rates"]) assert.ok((c2.lessonCopy(step).why || "").trim(), `C2 ${step}`);
  const c3src = read("web/chapter3.js"), c5src = read("web/chapter5.js");
  assert.ok((c3src.match(/\bwhy: "[^"]+"/g) || []).length >= 2, "C3 two case steps");
  assert.ok((c5src.match(/\bwhy: "[^"]+"/g) || []).length >= 2, "C5 two steps");
});

test("part label: every Case Board chapter card names its part", () => {
  const client = require(path.join(ROOT, "web/course/course-client.js"));
  const courseState = require(path.join(ROOT, "web/course/course-state.js"));
  const model = client.dashboardModel(courseState.emptyCourseState());
  const want = {C1:"Part 1 · Check the report", C2:"Part 1 · Check the report", C3:"Part 1 · Check the report",
    C4:"Part 2 · Check the notebook", C5:"Part 2 · Check the notebook", C6:"Part 3 · Test the claim"};
  for (const card of model.cards) assert.equal(card.part, want[card.chapter], card.chapter);
  assert.match(read("web/course/course-board.js"), /card\.part/);
});

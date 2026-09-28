"use strict";
// Round-3 fixes (H3, 2026-09-27): C1 hint ladder and practice coaching, the ending's Chapter 3 card,
// the C4 drawn jars on the Case Board and ending, the "what to load" bridge lines, and Momo's zero.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mystery = require("../web/mystery.js");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");
const ending = require("../web/course/ending.js");
const endingScript = require("../web/course/ending-script.js");
const bridges = require("../web/course/bridges.js");
const c4 = require("../web/chapter4.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
function memoryStorage() {
  const values = new Map();
  return {getItem:key => values.has(key) ? values.get(key) : null, setItem:(key, value) => values.set(key, String(value)), removeItem:key => values.delete(key)};
}

// ---- Fix 1: C1 hint ladder follows the shared spec ----
test("C1 ladder: one Stuck? Hints section below the editor, the full-answer button after the hint button", () => {
  const html = read("web/index.html");
  assert.equal((html.match(/Show the full answer/g) || []).length, 1, "exactly one full-answer button");
  assert.equal((html.match(/Stuck\? Hints <span/g) || []).length, 1, "one Stuck? Hints section");
  assert.ok(html.indexOf('class="editor-panel"') < html.indexOf('class="help-drawer'), "hints sit below the editor");
  assert.ok(html.indexOf('id="next-hint"') < html.indexOf('id="show-answer"'), "the full answer comes after the hints");
  assert.deepEqual([0, 1, 2, 3].map(n => mystery.hintButtonLabel(n, 3)), ["Show the idea", "Show the code shape", "Show the whole line", "All help shown"]);
});

// ---- Fix 2: the practice box shares the case editor's R-habit coaching ----
test("C1 practice: a plain == on the whole column says why one false came back", () => {
  const line = mystery.practiceFeedback('jars.batch_id == "B08"', {status:"ok", value_repr:"false"});
  assert.match(line, /one true-or-false answer/);
  assert.match(line, /\.==/);
  assert.match(line, /Practice does not count for the case\./);
  // The dotted rule keeps its BitVector explanation.
  assert.match(mystery.practiceFeedback('jars.batch_id .== "B08"', {status:"ok", value_repr:"12-element BitVector:\n 1"}), /BitVector/);
  // A lone value from other code is not blamed on ==.
  assert.equal(mystery.practiceFeedback("42", {status:"ok", value_repr:"42"}), "Julia returned this. Practice does not count for the case.");
});

test("C1 practice: R's $ and head get the Julia spelling, not 'define it first'", () => {
  const dollar = mystery.practiceFeedback('jars$batch_id == "B08"', {status:"error", message:"$ is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `$` not defined"});
  assert.match(dollar, /R's \$ does not exist in Julia: write jars\.batch_id, not jars\$batch_id\./);
  const head = mystery.practiceFeedback("head(jars, 3)", {status:"error", message:"head is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `head` not defined"});
  assert.match(head, /first\(jars, 3\)/);
  assert.match(head, /jars\[1:3, :\]/);
  for (const line of [dollar, head]) assert.doesNotMatch(line, /define it first/);
});

// ---- Fix 3: the ending's Chapter 3 card, one line per record ----
test("ending C3 card: four separate lines, and the 0 is never next to the paper", () => {
  assert.deepEqual(Object.keys(endingScript.aha), ["report", "paper", "log", "copied"]);
  const js = read("web/course/ending.js");
  assert.doesNotMatch(js, /doc\.createElement\("s"\)/, "no struck 0 glued to the paper line");
  // Rendered text, with the case facts the server sends.
  const lines = ending.ahaLines(endingScript, {reported:1, logged:0, status:"left blank"});
  assert.deepEqual(lines, ["Notebook: 1", "Tally sheet: box left blank", "Toto's typed table: 0, typed where the box was blank", "Report: used that 0 as a count"]);
  assert.doesNotMatch(JSON.stringify(endingScript.aha), /\d/, "no digits in the card words; the numbers come from the server");
  assert.match(read("web/course/ending.css"), /\.aha \{[^}]*flex-direction:column/);
});

// ---- Fix 4: an accepted C4 run updates the drawn jars ----
function acceptedC4(ids) {
  return {type:"case_result", contract_version:1, case_id:"missing-fleas-v1", chapter:"C4", move_id:"plan-distinct-recheck", mode:"challenge", activity_id:null, simulation_id:null,
    status:"ok", pass:true, progress_eligible:true, columns:["jar_id"], rows:ids.map(jar_id => ({jar_id}))};
}
test("C4: a second accepted run replaces the saved jar_ids; the rest of the record stays as first written", () => {
  const storage = memoryStorage();
  assert.equal(c4.persistAcceptedCourseResult(courseState, storage, "", acceptedC4(["J-091", "J-094", "J-096"])), true);
  const key = courseState.evidenceKey("", "C4", "plan-distinct-recheck");
  const first = JSON.parse(storage.getItem(key));
  assert.equal(c4.persistAcceptedCourseResult(courseState, storage, "", acceptedC4(["J-091", "J-096", "J-092"])), true);
  const second = JSON.parse(storage.getItem(key));
  assert.deepEqual(second.jar_ids, ["J-091", "J-096", "J-092"]);
  assert.deepEqual(Object.assign({}, second, {jar_ids:first.jar_ids}), first);
  const lines = client.dashboardModel(client.loadCourseState(storage, "")).evidence.map(item => item.line);
  assert.ok(lines.includes("Recheck jars: planned, not looked at yet: J-091, J-096 and J-092."), lines.join(" | "));
  assert.deepEqual(ending.pickedJars(storage, ""), ["J-091", "J-096", "J-092"]);
});

test("C4: an old save without jar_ids gains them on the next accepted run", () => {
  const storage = memoryStorage();
  courseState.recordHistoricalMoveIfMissing(storage, "", "C4", "plan-distinct-recheck");
  courseState.writeEvidenceIfMissing(storage, "", {chapter:"C4", move_id:"plan-distinct-recheck", title:"Three distinct rechecks planned", row_count:3, provenance:"historical-browser"});
  c4.persistAcceptedCourseResult(courseState, storage, "", acceptedC4(["J-092", "J-094", "J-096"]));
  assert.deepEqual(JSON.parse(storage.getItem(courseState.evidenceKey("", "C4", "plan-distinct-recheck"))).jar_ids, ["J-092", "J-094", "J-096"]);
});

test("C4: the accepted code on the ending follows the latest accepted run", () => {
  const storage = memoryStorage();
  const draft = courseState.draftKey("", "C4", "plan-distinct-recheck", "challenge");
  storage.setItem(draft, "Random.seed!(1)\nsample(eligible.jar_id, 3; replace=false)");
  c4.persistAcceptedCourseResult(courseState, storage, "", acceptedC4(["J-091", "J-094", "J-096"]));
  storage.setItem(draft, "Random.seed!(7)\nsample(eligible.jar_id, 3; replace=false)");
  c4.persistAcceptedCourseResult(courseState, storage, "", acceptedC4(["J-091", "J-096", "J-092"]));
  assert.equal(courseState.readAcceptedCode(storage, "")["C4/plan-distinct-recheck"], "Random.seed!(7)\nsample(eligible.jar_id, 3; replace=false)");
});

test("updateEvidenceJarIds only touches jar_ids of a valid saved record", () => {
  const storage = memoryStorage();
  assert.equal(courseState.updateEvidenceJarIds(storage, "", "C4", "plan-distinct-recheck", ["J-091", "J-092", "J-094"]), false, "nothing saved yet");
  assert.equal(courseState.updateEvidenceJarIds(storage, "", "C9", "nope", ["J-091"]), false);
  courseState.writeEvidenceIfMissing(storage, "", {chapter:"C4", move_id:"plan-distinct-recheck", title:"Three distinct rechecks planned", row_count:3, provenance:"historical-browser"});
  assert.equal(courseState.updateEvidenceJarIds(storage, "", "C4", "plan-distinct-recheck", [1, 2, 3]), false, "ids must be strings");
  assert.equal(courseState.updateEvidenceJarIds(storage, "", "C4", "plan-distinct-recheck", ["J-091", "J-092", "J-094"]), true);
});

// ---- Fix 5: bridges say what really loads the accepted answers ----
test("C4 bridge: Random and StatsBase, so seed!, MersenneTwister, shuffle and sample all run", () => {
  const setup = bridges.buildCard("C4/plan-distinct-recheck", "Random.seed!(1)\nsample(eligible.jar_id, 3; replace=false)").setup;
  assert.match(setup, /^In your own Julia, run using Random, Distributions first/);
});

test("C2 bridge: an answer with mean also loads Statistics; one without does not mention it", () => {
  const withMean = bridges.buildCard("C2/rates", "counts = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n, :detected => mean => :rate)\ncounts").setup;
  assert.match(withMean, /using DataFrames, Statistics first/);
  const without = bridges.buildCard("C2/rates", "counts.rate = counts.detected_n ./ counts.n\ncounts").setup;
  assert.match(without, /using DataFrames first/);
  assert.doesNotMatch(without, /Statistics/);
});

test("C2 rates bridge: the no-dot division is described as it really behaves", () => {
  const lead = bridges.BRIDGES["C2/rates"].lead;
  assert.doesNotMatch(lead, /does not give an error/);
  assert.match(lead, /3 by 3 table/);
  assert.match(lead, /error/);
});

// ---- Fix 6: Momo never says the paper shows 0 ----
test("C1: Momo's line and cast card talk about a report, not the paper", () => {
  const html = read("web/index.html");
  assert.doesNotMatch(html, /on paper/);
  assert.match(html, /“One zero in a report is a weak reason to believe that\.”/);
  assert.match(html, /“A zero in a report is not always an empty tray\.”/);
});

// ---- Seen while checking fix 2: R's jars$batch_id is marked as one name, not "jars$" plus a chip ----
test("code names: jars$batch_id is one code name", () => {
  const names = require("../web/course/code-names.js");
  assert.deepEqual(names.findNames("write jars.batch_id, not jars$batch_id.").map(m => m.text), ["jars.batch_id", "jars$batch_id"]);
  assert.deepEqual(names.findNames("counts$rate <- x").map(m => m.text), ["counts$rate"]);
});

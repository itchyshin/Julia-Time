"use strict";
// Round-2 fixes (G3, 2026-09-27) for the Case Board, intro, ending, bridges and Chapter 1.
// Canon for the 0 (docs/design/06-story-spine.md "Why Toto said vanishing"): on the paper, T-C's box was
// blank; Toto typed the tally sheet into the lab's table, typing 0 for the blank, then typed his report
// from that table. No line may say the paper shows 0; the blank stays Chapter 3's discovery.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const intro = require("../web/course/intro-script.js");
const ending = require("../web/course/ending.js");
const endingScript = require("../web/course/ending-script.js");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");
const bridges = require("../web/course/bridges.js");
const progress = require("../web/course/progress-banner.js");
const mystery = require("../web/mystery.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
function memoryStorage() {
  const values = new Map();
  return {getItem:key => values.has(key) ? values.get(key) : null, setItem:(key, value) => values.set(key, String(value)), removeItem:key => values.delete(key)};
}
const FACTS = Object.freeze({batch_id:"B09", n_jars:6, n_detected:5,
  trays:[{tray_id:"T-A", detected_n:2}, {tray_id:"T-B", detected_n:2}, {tray_id:"T-C", detected_n:1}],
  disagreement:{tray_id:"T-C", notebook_detected:1, sheet_detected:0, entry_status:"left blank"},
  eligible_jars:["J-091", "J-092", "J-094", "J-096"], recheck_size:3,
  observed_count:5, n_per_simulation:6, n_simulations:1000, matching_events:113,
  models:[{model:"Dying out", p:0.1, lower:0, upper:2, compatible:false},
          {model:"Coin flip", p:0.5, lower:1, upper:5, compatible:true},
          {model:"Thriving", p:0.8, lower:4, upper:6, compatible:true}]});

// ---- Fix 1: one mechanism for the 0 ----
test("intro scene 4: Toto typed the tally sheet into the lab's table and typed his report from that table", () => {
  const scene = intro.scenes[4];
  assert.match(scene.caption, /typed the tally sheet into the lab's table/);
  assert.match(scene.caption, /types his report from that table/);
  assert.doesNotMatch(scene.caption, /from the sheet alone/);
  assert.equal(scene.line, "Both jars, both jars, then none. They are dying out!");
});

test("intro scene 5 no longer says Toto only had the tally sheet, and Julia is named as a computer language", () => {
  const scene = intro.scenes[5];
  assert.doesNotMatch(scene.caption, /only had the tally sheet/);
  assert.match(scene.caption, /Toto had only his typed table/);
  assert.doesNotMatch(scene.caption, /find out with Julia,/);
  assert.match(scene.caption, /Julia, a computer language/);
});

test("intro scene 1: the player is the fifth person, not one of the four", () => {
  assert.match(intro.scenes[1].caption, /You are the fifth, and the newest\./);
});

test("the intro never says the paper shows 0 and never reveals the blank", () => {
  const words = JSON.stringify(intro).toLowerCase();
  for (const phrase of ["blank", "copied", "sheet shows 0", "sheet reads 0", "sheet says 0"]) assert.ok(!words.includes(phrase), phrase);
});

test("C1 opening: Toto read his typed table, not the paper sheet, as 2, 2, then 0", () => {
  const html = read("web/index.html");
  assert.doesNotMatch(html, /read the tally sheet as/);
  assert.match(html, /Toto typed the tally sheet into the lab’s table, then read that table as T-A: 2 of 2 jars, T-B: 2 of 2 jars, then T-C: 0 jars\./);
});

test("Case Board: the C3 reason names Toto's typed table, not the paper sheet", () => {
  const src = read("web/course/course-client.js");
  assert.doesNotMatch(src, /The report was typed from the tally sheet\./);
  assert.match(src, /Toto typed his report from his typed table\. Line that table up with the notebook\./);
});

test("ending C3: caption and aha label say the typed table shows 0 and the paper box was blank", () => {
  const scene = ending.buildScenes(FACTS, endingScript, {})[2];
  assert.equal(scene.caption, "Tray T-C: the notebook counts 1, and Toto's typed table shows 0. On the paper, the box was left blank.");
  assert.equal(endingScript.aha.log, "Toto's typed table: {logged}, typed where the box was blank");
  assert.doesNotMatch(JSON.stringify(endingScript), /Tally sheet: 0|"Tally sheet"/);
  assert.equal(endingScript.aha.paper, "Tally sheet: box {status}");
  const reveal = ending.buildFinal(FACTS, endingScript, {}, [], "").reveal;
  assert.match(reveal, /Tray T-C's 0 was typed in for a box left blank on the paper tally sheet, not an empty tray\./);
});

test("ending page: the aha card reads 'Tally sheet: box left blank' on its own line (r3 story F6)", () => {
  assert.equal(ending.ahaLines(endingScript, {reported:1, logged:0, status:"left blank"})[1], "Tally sheet: box left blank");
});

// ---- Fix 2: the three jars the student drew ----
function withC4(storage, jarIds) {
  courseState.recordHistoricalMoveIfMissing(storage, "", "C4", "plan-distinct-recheck");
  const item = {chapter:"C4", move_id:"plan-distinct-recheck", title:"Three distinct rechecks planned", row_count:3, provenance:"historical-browser"};
  if (jarIds !== undefined) item.jar_ids = jarIds;
  courseState.writeEvidenceIfMissing(storage, "", item);
  return storage;
}

test("the ending names the three jars chance picked, read from the saved C4 result", () => {
  const storage = withC4(memoryStorage(), ["J-096", "J-094", "J-091"]);
  const facts = ending.withPickedJars(FACTS, ending.pickedJars(storage, ""));
  const scene = ending.buildScenes(facts, endingScript, {})[3];
  assert.equal(scene.caption, "You let chance pick J-096, J-094 and J-091 from the 4 jars that can still be opened. Nobody has looked yet.");
  const finale = ending.buildFinal(facts, endingScript, {}, [], "");
  assert.equal(finale.stillOpen, "Still to do: the recheck of J-096, J-094 and J-091, the jars chance picked. It is the one check only the jars can give.");
});

test("the ending falls back to the eligible list when the drawn jars are unknown or not valid", () => {
  const cases = [undefined, [], ["J-096", "J-094"], ["J-096", "J-096", "J-091"], ["J-096", "J-094", "J-093"], "J-096", [1, 2, 3]];
  for (const jarIds of cases) {
    const facts = ending.withPickedJars(FACTS, ending.pickedJars(withC4(memoryStorage(), jarIds), ""));
    assert.equal(ending.buildScenes(facts, endingScript, {})[3].caption,
      "You planned a recheck of 3 jars from J-091, J-092, J-094 and J-096. Nobody has looked yet.", JSON.stringify(jarIds));
    assert.equal(ending.buildFinal(facts, endingScript, {}, [], "").stillOpen,
      "Still to do: the recheck of 3 jars from J-091, J-092, J-094 and J-096. It is the one check only the jars can give.");
  }
  assert.deepEqual(ending.pickedJars(memoryStorage(), ""), null);
});

// ---- Fix 3: plain findings on the Case Board ----
test("Case Board findings are plain: no 'saved rows', and the recheck is of jars, not a tray", () => {
  const storage = withC4(memoryStorage());
  courseState.recordHistoricalMoveIfMissing(storage, "", "C1", "select-records");
  courseState.writeEvidenceIfMissing(storage, "", {chapter:"C1", move_id:"select-records", title:"old", row_count:6, provenance:"historical-browser"});
  const lines = client.dashboardModel(client.loadCourseState(storage, "")).evidence.map(item => item.line);
  assert.ok(lines.includes("The six B09 jars, found in the notebook."), lines.join(" | "));
  assert.ok(lines.includes("Recheck jars: planned, not looked at yet."), lines.join(" | "));
  for (const line of lines) assert.doesNotMatch(line, /saved row|Recheck tray/);
});

test("Case Board names the drawn jars when the saved C4 result has them", () => {
  const storage = withC4(memoryStorage(), ["J-096", "J-094", "J-091"]);
  const lines = client.dashboardModel(client.loadCourseState(storage, "")).evidence.map(item => item.line);
  assert.ok(lines.includes("Recheck jars: planned, not looked at yet: J-096, J-094 and J-091."), lines.join(" | "));
});

// ---- Fix 4: bridges ----
test("C3 bridge: Julia usually writes on = :tray_id, and a quoted string also works", () => {
  const lead = bridges.BRIDGES["C3/join-report-log"].lead;
  assert.doesNotMatch(lead, /not a quoted string/);
  assert.match(lead, /usually writes on = :tray_id/);
  assert.match(lead, /on = "tray_id", also works/);
});

test("every bridge says what to load so a pasted line runs in your own Julia", () => {
  const want = {"C1/select-records":/using DataFrames/, "C2/group":/using DataFrames/, "C2/counts":/using DataFrames/, "C2/rates":/using DataFrames/,
    "C3/join-report-log":/using DataFrames/, "C3/filter-disagreement":/using DataFrames/, "C4/plan-distinct-recheck":/using Random, Distributions/,
    "C5/event-mask":/Nothing to load/, "C5/event-frequency":/using Statistics/, "C6/compatible-models":/using DataFrames/};
  for (const [key, pattern] of Object.entries(want)) {
    const model = bridges.buildCard(key, "x");
    assert.match(model.setup, pattern, key);
    assert.match(model.setup, /^In your own Julia/, key);
  }
});

// ---- Fix 5: pandas in the == coaching ----
test("C1 == coaching names pandas as well as R", () => {
  const line = mystery.challengeRecovery({status:"error", message:"ArgumentError: invalid row index of type Bool"});
  assert.match(line, /^In R, == already compares every row, and so does pandas' == on a column\. /);
});

// ---- Fix 6: C1 skip link hidden above the page, not floating mid-page ----
test("C1 skip link sits above the page (absolute), so a scrolled page never shows it", () => {
  const css = read("web/mystery.css");
  assert.match(css, /\.skip-link\{position:absolute;/);
  assert.doesNotMatch(css, /\.skip-link\{position:fixed/);
});

// ---- Bug hunter r2: one full-answer control in C1; banner names the next step ----
test("C1 hint ladder: level 3 is 'Show the whole line', and the separate answer button hides once all help is shown", () => {
  assert.deepEqual([0, 1, 2, 3].map(n => mystery.hintButtonLabel(n, 3)), ["Show the idea", "Show the code shape", "Show the whole line", "All help shown"]);
  assert.match(read("web/mystery.js"), /el\["show-answer"\]\.hidden = hintsShown >= hints\.length;/);
});

test("progress banner: 'to finish this chapter' only when one step is left", () => {
  const storage = memoryStorage();
  courseState.recordHistoricalMoveIfMissing(storage, "", "C2", "group");
  assert.equal(progress.bannerModel(storage, "", "C2").status, "Chapter 2: step 1 of 3 saved. Solve step 2 next.");
  courseState.recordHistoricalMoveIfMissing(storage, "", "C2", "counts");
  assert.equal(progress.bannerModel(storage, "", "C2").status, "Chapter 2: steps 1 and 2 of 3 saved. Solve step 3 to finish this chapter.");
});

// ---- r2 story review C2: Chapter 1 result cards in plain words ----
test("C1 jar cards say 'tray T-A · springtails seen', and other rows keep their column names", () => {
  assert.equal(mystery.jarCardText({jar_id:"J-091", batch_id:"B09", tray_id:"T-A", detected:true}), "tray T-A · springtails seen");
  assert.equal(mystery.jarCardText({jar_id:"J-096", batch_id:"B09", tray_id:"T-C", detected:{display:"false", type:"Bool"}}), "tray T-C · no springtails seen");
  assert.equal(mystery.jarCardText({jar_id:"J-091", batch_id:"B09"}), "jar_id: J-091 · batch_id: B09");
  assert.doesNotMatch(read("web/mystery.js"), /Evidence recovered/);
});

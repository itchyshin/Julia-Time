"use strict";

// Night round 1 fixes (2026-09-27, scratchpad night/r1-bugs.md, r1-novice.md, r1-audit.md) for
// chapters 2 to 6: correct code that rebinds a named input gets an accurate reason, C4's timeout
// line names the real cause, C2's closing panel uses the story's words, C2 step 1 names groupby,
// C3's limit line shows once, "Part 1 done" only after Chapter 3 is solved, and one wording for
// the connection status.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "../web", file), "utf8");

const c2 = require("../web/chapter2.js");
const c3 = require("../web/chapter3.js");
const c4 = require("../web/chapter4.js");
const c5 = require("../web/chapter5.js");
const c6 = require("../web/chapter6.js");

// The sandbox's own replies (src/mystery_c3.jl, c4, c5, c6 guarded code; src/sandbox.jl
// protected_bindings), as _format_error prints them.
const rebound = name => ({type:"case_result", status:"error", pass:false,
  message:"Something went wrong running this line.\n\nThe supplied " + name + " binding changed. Keep the source table unchanged; create a separate result, then try again."});
const changed = name => ({type:"case_result", status:"error", pass:false,
  message:"Something went wrong running this line.\n\nThe supplied " + name + " records changed. Keep the source table unchanged; create a separate summary or copy, then try again."});

function assertRebindLine(text, name) {
  assert.match(text, new RegExp(name + " kept exactly as it was supplied"));
  assert.match(text, /leave \w+ as it is/);
  assert.doesNotMatch(text, /\.!= has the dot|replace=false|Check the names/);
}

test("C2 to C6: rebinding a named input gets the real reason, not unrelated advice", () => {
  const c2Text = c2.resultText(Object.assign(changed("jars"), {step:"group", feedback:"Julia did not produce the requested result for this move."}));
  assertRebindLine(c2Text, "jars");
  const c3Text = c3.errorRecovery("filter-disagreement", rebound("joined"));
  assertRebindLine(c3Text, "joined");
  assert.match(c3Text, /joined = /);
  assertRebindLine(c3.errorRecovery("join-report-log", changed("tray_counts")), "tray_counts");
  assertRebindLine(c4.recoveryCopy(rebound("eligible")), "eligible");
  assertRebindLine(c5.challengeRecovery("event-mask", rebound("sim_counts")), "sim_counts");
  assertRebindLine(c5.challengeRecovery("event-mask", changed("observed_count")), "observed_count");
  assertRebindLine(c6.challengeRecovery(rebound("stories")), "stories");
  // C6's own guard (src/mystery_c6.jl) runs a value check first, with its own wording.
  assertRebindLine(c6.challengeRecovery({type:"case_result", status:"error", pass:false,
    message:"Something went wrong running this line.\n\nThe supplied stories values changed. Keep the inputs unchanged and create a separate result."}), "stories");
});

test("C2 to C6: the rebinding line never shows a finished answer line", () => {
  for (const text of [c3.errorRecovery("filter-disagreement", rebound("joined")), c6.challengeRecovery(rebound("stories")), c4.recoveryCopy(rebound("eligible"))]) {
    assert.doesNotMatch(text, /notebook_detected|sample\(|\.<=/);
  }
});

test("C2 step 1: R's group_by gets Julia's name", () => {
  const text = c2.resultText({type:"case_result", step:"group", status:"error", pass:false,
    message:"group_by is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `group_by` not defined"});
  assert.match(text, /group_by is R's \(dplyr\) name/);
  assert.match(text, /groupby/);
  assert.doesNotMatch(text, /groupby\(jars, :tray_id\)/);
});

test("C4: a timeout says the run took too long, not to check the names", () => {
  const source = read("chapter4.js");
  assert.doesNotMatch(source, /Julia stopped before the end\. Check the names/);
  assert.match(source, /A loop that never ends is the usual cause/);
});

test("C2 closing panel uses the story's words", () => {
  const html = read("chapter2.html"), source = read("chapter2.js");
  for (const phrase of [/recorded detections/, /checked returned summaries/, /proportions/, /saved separately for grouping, counts, and rates in this browser/]) {
    assert.doesNotMatch(html.replace(/<meta[^>]*>/g, ""), phrase);
    assert.doesNotMatch(source.match(/function renderEvidence[\s\S]*?\n/)[0], phrase);
  }
  assert.match(source, /jars with springtails/);
});

test("C2 names groupby in the always-visible names box, without the finished line", () => {
  const html = read("chapter2.html");
  const box = html.match(/<section id="named-inputs"[\s\S]*?<\/section>/)[0];
  assert.match(box, /<dt><code>groupby<\/code><\/dt>/);
  assert.doesNotMatch(box, /groupby\(jars/);
});

test("C3: the step 2 limit line appears once, not twice in two wordings", () => {
  const source = read("chapter3.js");
  const render = source.match(/function renderResult\(message\)[\s\S]*?\n    }\n/)[0];
  assert.match(render, /accepted && !cardCarriesLimit \? explanation\.limit : ""/);
  assert.match(source, /"We know the box was left blank, not why\. Next: plan a fair recheck of the jars\."/);
});

test("C4 to C6: Part 1 is called done only when Chapter 3 is solved", () => {
  const counts = [0, 1, 2, 3, 4, 5];
  const c5Info = {type:"case", contract_version:1, case_id:"missing-fleas-v1", chapter:"C5", move_id:"event-mask", mode:"challenge", activity_id:null,
    simulation_id:"s-1", request_id:"r", n_jars:6, p_ref:0.5, observed_count:3, n_trials:counts.length,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:counts.map((count, index) => ({simulation:index + 1, count}))}]};
  assert.match(c5.caseStatus(c5Info, "event-mask", true).established, /^Part 1 done/);
  assert.doesNotMatch(c5.caseStatus(c5Info, "event-mask", false).established, /Part 1 done/);
  assert.match(c5.caseStatus(c5Info, "event-mask", false).established, /Chapter 3 settles Part 1/);
  const c6Info = {type:"case", contract_version:1, case_id:"missing-fleas-v1", chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null,
    request_id:"r", observed_count:5, n_trials:6, inputs:[{id:"stories", columns:["story", "p", "lower", "upper"], rows:[{story:"Vanishing", p:0.1, lower:0, upper:2}, {story:"Coin flip", p:0.5, lower:1, upper:5}, {story:"Thriving", p:0.8, lower:4, upper:6}]}]};
  assert.match(c6.caseStatus(c6Info, true).established, /^Part 1 done/);
  assert.doesNotMatch(c6.caseStatus(c6Info, false).established, /Part 1 done/);
  assert.match(c6.caseStatus(c6Info, false).established, /Chapter 3 settles Part 1/);
  const c4Source = read("chapter4.js");
  assert.match(c4Source, /C3\/filter-disagreement|"C3", "filter-disagreement"/);
});

test("C2 to C6: one wording for the same connection state, matching Chapter 1 and the Case Board", () => {
  for (const file of ["chapter2.js", "chapter3.js", "chapter4.js", "chapter5.js", "chapter6.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /"(?:● )?Connected"|Ready when you are|Connection offline\.|Connection interrupted\. Reconnecting|Connect to the lab to load/, file);
  }
  assert.match(read("chapter4.js"), /"Julia is ready"/);
  assert.match(read("chapter5.js"), /"● Julia is ready"/);
  assert.equal(c5.openingConnectionMessageForProtocol("http:"), "Open Toto’s card table to load the cards.");
});

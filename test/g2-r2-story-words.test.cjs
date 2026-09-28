"use strict";

// Night round 2 (2026-09-27, fixer G2): story words in Chapters 2 to 6.
// Canon: docs/design/06-story-spine.md "Why Toto said vanishing": on the paper tally sheet T-C's
// box was blank; Toto copied the sheet into the lab's table, typing 0 for the blank, and typed his
// report from that table. No line may say the paper sheet reads or shows 0, and the blank stays
// Chapter 3's discovery.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = name => fs.readFileSync(path.join(__dirname, "..", "web", name), "utf8");

function c3Opening() {
  const html = read("chapter3.html");
  const start = html.indexOf('<section id="scene"');
  const end = html.indexOf('<section id="investigation"');
  return html.slice(start, end);
}

test("C3 opening: Toto copied the paper sheet into a table and typed the report from that table", () => {
  const opening = c3Opening();
  assert.match(opening, /<h1 id="chapter-title" tabindex="-1">Toto typed his report from a copy of the tally sheet<\/h1>/);
  assert.match(opening, /Toto copied it into the lab’s table, box by box, and typed his report from that table\./);
  // The report was not typed from the paper itself.
  assert.doesNotMatch(opening, /report was typed from a tally sheet/i);
  assert.doesNotMatch(opening, /Toto typed the report from it/);
  // The blank stays the chapter's discovery: no line names T-C's box as blank before the step.
  assert.doesNotMatch(opening, /either filled in or left blank/);
  assert.doesNotMatch(opening, /T-C[^<]*blank/);
});

test("C3 names the right-hand table as Toto's typed copy, and the blank note says the copy shows 0", () => {
  const c3 = require("../web/chapter3.js");
  assert.equal(c3.tableIdentity("tally_sheet").title, "Toto’s typed copy of the tally sheet");
  const source = read("chapter3.js");
  assert.doesNotMatch(source, /the report was typed from/i);
  assert.match(source, /On the paper tally sheet, T-C\\u2019s box was left blank, yet Toto\\u2019s typed copy shows 0\./);
});

test("Chapters 2 to 6: no line says the paper sheet reads or shows 0", () => {
  for (const name of ["chapter2", "chapter3", "chapter4", "chapter5", "chapter6"]) {
    for (const ext of [".html", ".js"]) {
      const text = read(name + ext);
      assert.doesNotMatch(text, /sheet (says|shows|reads) 0/i, name + ext);
      assert.doesNotMatch(text, /typed from (a|the) tally sheet/i, name + ext);
    }
  }
});

test("C5 step lines use the story's words, not the program's", () => {
  const c5 = require("../web/chapter5.js");
  assert.equal(c5.moveLockText({firstAccepted:true}), "Step 1 is done: every round is marked. Step 2 is open.");
  assert.equal(c5.moveLockText({firstAccepted:true, secondAccepted:true}), "Step 2 is done: you know how often luck gives at least the notebook’s count. Chapter 6 is next.");
  const source = read("chapter5.js");
  assert.doesNotMatch(source, /Event saved|Frequency saved/);
});

test("C4 recheck label talks about jars, not a tray", () => {
  const c4 = require("../web/chapter4.js");
  assert.equal(c4.lessonCopy("plan-distinct-recheck").visualTitle, "Recheck jars: planned, not looked at yet");
  assert.doesNotMatch(read("chapter4.js"), /Recheck tray/);
});

test("C2 rack note ends with a plain next step, not a question with nowhere to answer", () => {
  const source = read("chapter2.js");
  assert.doesNotMatch(source, /What would you want to check on the tally sheet next\?/);
  assert.match(source, /Next: check these counts against the tally sheet\./);
});

test("Dot coaching names pandas as well as R (C5 concept, C6 plain & trap)", () => {
  const c5 = require("../web/chapter5.js");
  assert.match(c5.COPY["event-mask"].concept, /Coming from R or pandas\? There a plain >= already compares every value; Julia needs a dot\./);
  const c6 = require("../web/chapter6.js");
  const recovery = c6.challengeRecovery({status:"error", message:"MethodError: no method matching &(::Int64, ::Vector{Int64})"});
  assert.match(recovery, /In R, & works row by row\. In Julia, as in pandas, a plain & is done before a comparison/);
});

test("C4 saves the three drawn jar IDs with its evidence, so the ending can name them", () => {
  const c4 = require("../web/chapter4.js");
  const rows = [{jar_id:"J-096"}, {jar_id:"J-094"}, {jar_id:"J-091"}];
  const result = {
    type:"case_result", contract_version:1, case_id:"missing-fleas-v1", chapter:"C4", move_id:"plan-distinct-recheck",
    mode:"challenge", activity_id:null, simulation_id:null, request_id:"run-1",
    status:"ok", pass:true, progress_eligible:true, columns:["jar_id"], rows
  };
  const calls = [];
  const courseState = {
    recordHistoricalMoveIfMissing: () => true,
    writeEvidenceIfMissing: (storage, attempt, value) => { calls.push(value); return true; },
    writeCursor: () => true
  };
  assert.equal(c4.persistAcceptedCourseResult(courseState, {}, "try-1", result), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].jar_ids, ["J-096", "J-094", "J-091"]);
  assert.equal(calls[0].row_count, 3);

  // The real course store keeps the field.
  const store = require("../web/course/course-state.js");
  const map = new Map();
  const storage = {getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k)};
  assert.equal(c4.persistAcceptedCourseResult(store, storage, "try-1", result), true);
  const saved = store.readEvidence(storage, "try-1").find(item => item.chapter === "C4");
  assert.deepEqual(saved.jar_ids, ["J-096", "J-094", "J-091"]);
});

// Night round 2 (r2-bugs.md finding 1): a server timeout shows the server's own line, which names
// the cause, in C3, C5 and C6, as C1, C2 and C4 already do.
test("C5 and C6 show the server's timeout line, not a vague 'took too long'", () => {
  const feedback = "Your code ran for more than 5 seconds, so Julia stopped it. A loop that never ends is the usual cause.";
  const pending = {case_id:"missing-fleas-v1", request_id:"run-t", contract_version:1};
  for (const [name, key] of [["chapter5", "feedback"], ["chapter6", "message"]]) {
    const client = require("../web/" + name + ".js");
    const chapter = client.CHAPTER;
    const envelope = Object.assign({}, pending, {chapter, move_id:name === "chapter5" ? "event-mask" : client.MOVE, mode:"challenge", activity_id:null, simulation_id:null});
    const state = Object.assign(client.createState(), {pending:envelope, activeMove:envelope.move_id});
    const after = client.applyCaseResult(state, Object.assign({type:"case_result", status:"timeout", pass:false, feedback}, envelope));
    assert.ok(after.runFailure, name + " records the timeout");
    assert.equal(after.runFailure[key], feedback + " Change your code, then run again.", name);
  }
  const c3 = read("chapter3.js");
  assert.doesNotMatch(c3, /keep the session responsive/);
  assert.match(c3, /message\.status === "timeout"\) p\.textContent = message\.feedback \? serverTimeoutText\(message\)/);
});

// Night round 2 (r2-bugs.md finding 2): one full-answer button per step, labelled "Show the full
// answer"; the hint ladder's last level reads "Show the whole line"; the used-up ladder reads
// "All help shown".
test("C3 to C6: one full-answer button, and the ladder says Show the whole line then All help shown", () => {
  for (const name of ["chapter3", "chapter4", "chapter5", "chapter6"]) {
    const html = read(name + ".html");
    const buttons = html.match(/<button[^>]*>[^<]*full answer[^<]*<\/button>/gi) || [];
    assert.equal(buttons.length, 1, name + ": " + buttons.join(" | "));
    assert.match(buttons[0], />Show the full answer</);
    assert.doesNotMatch(html, /Skip to the full answer/);
    const source = read(name + ".js");
    assert.match(source, /Show the whole line/, name);
    assert.match(source, /All help shown/, name);
    assert.doesNotMatch(source, /"All shown"/, name);
    assert.doesNotMatch(source, /button: ?"Show the full answer"/, name);
  }
});

// Night round 2 (r2-bugs.md finding 7): with Chapter 3 unsolved, C5 and C6 must not state its answer.
test("C5 and C6 status lines do not give away Chapter 3's answer when it is unsolved", () => {
  const c5 = require("../web/chapter5.js");
  const c6 = require("../web/chapter6.js");
  const counts = [0, 1, 2, 3, 4, 5];
  const c5Info = {type:"case", contract_version:1, case_id:"missing-fleas-v1", chapter:"C5", move_id:"event-mask", mode:"challenge", activity_id:null,
    simulation_id:"s-1", request_id:"r", n_jars:6, p_ref:0.5, observed_count:3, n_trials:counts.length,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:counts.map((count, index) => ({simulation:index + 1, count}))}]};
  const c6Info = {type:"case", contract_version:1, case_id:"missing-fleas-v1", chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null,
    request_id:"r", observed_count:5, n_trials:6, inputs:[{id:"stories", columns:["story", "p", "lower", "upper"], rows:[{story:"Vanishing", p:0.1, lower:0, upper:2}, {story:"Coin flip", p:0.5, lower:1, upper:5}, {story:"Thriving", p:0.8, lower:4, upper:6}]}]};
  for (const line of [c5.caseStatus(c5Info, "event-mask", false).established, c6.caseStatus(c6Info, false).established]) {
    assert.match(line, /^Chapter 3 settles Part 1: whether the report's 0 is real\./);
    assert.doesNotMatch(line, /blank/);
  }
  assert.match(c5.caseStatus(c5Info, "event-mask", true).established, /^Part 1 done: the report's 0 was a blank box, not an empty tray\./);
  assert.match(c6.caseStatus(c6Info, true).established, /^Part 1 done: the report's 0 was a blank box, not an empty tray\./);
});

"use strict";

// Repairs from the 2026-09-24 real-browser check of Chapter 3 (UI-04, UI-08, UI-12) and the
// simulated-student placeholder stumble (B9). Each test reproduces the reported screen state.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter3.js");

const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
const EM_DASH = /—/;

function functionBody(name) {
  const start = source.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " exists");
  const next = source.indexOf("\n    function ", start + 1);
  return source.slice(start, next > start ? next : undefined);
}

// UI-04: C2 writes {chapter:"C3", move_id:"join-report-log", mode:"challenge"} when its rates
// move is accepted. On a first C3 visit that hand-off alone used to show "Your earlier C3 work is
// saved only in this browser" and a second button that repeated the main one.
test("UI-04: a C3 cursor handed over by C2 alone is not shown as earlier C3 work", () => {
  const handoff = {
    readCursor(){ return {chapter:"C3", move_id:"join-report-log", mode:"challenge"}; },
    readCourseState(){ return {}; },
    acceptedMoves(){ return [{key:"C1/select-records", provenance:"historical-browser"}, {key:"C2/rates", provenance:"historical-browser"}]; },
    readChallengeDrafts(){ return {}; }
  };
  assert.equal(client.savedChallengeResume(handoff, {}, "try-1"), null);
  assert.equal(client.savedChallengeResume(Object.assign({}, handoff, {readChallengeDrafts(){ return {"C3/join-report-log":"  \n "}; }}), {}, "try-1"), null, "a blank draft is not C3 work");
  assert.equal(client.savedChallengeResume(Object.assign({}, handoff, {readChallengeDrafts(){ return {"C2/rates":"jars"}; }}), {}, "try-1"), null, "another chapter's draft is not C3 work");
  assert.equal(client.savedChallengeResume(Object.assign({}, handoff, {readChallengeDrafts(){ throw new Error("storage blocked"); }}), {}, "try-1"), null);
});

test("UI-04: the learner's own C3 draft or an accepted C3 move still offers the resume", () => {
  const drafted = {
    readCursor(){ return {chapter:"C3", move_id:"join-report-log", mode:"challenge"}; },
    readCourseState(){ return {}; },
    acceptedMoves(){ return [{key:"C2/rates", provenance:"historical-browser"}]; },
    readChallengeDrafts(){ return {"C3/join-report-log":"leftjoin("}; }
  };
  assert.equal(client.savedChallengeResume(drafted, {}, "try-1"), "join-report-log");
  const joined = {
    readCursor(){ return {chapter:"C3", move_id:"filter-disagreement", mode:"challenge"}; },
    readCourseState(){ return {}; },
    acceptedMoves(){ return [{key:"C3/join-report-log", provenance:"historical-browser"}]; }
  };
  assert.equal(client.savedChallengeResume(joined, {}, "try-1"), "filter-disagreement");
});

// UI-08: after "Run demonstration" returned a real table, the practice panel still read "Not run
// yet. The practice expression above will run only when you choose Run demonstration." and
// "Planned practice code — not run yet." above Julia's actual output.
test("UI-08: a practice run is never called unrun once it has started or settled", () => {
  assert.equal(typeof client.demoDraftStatus, "function");
  assert.equal(typeof client.demoPlanStatus, "function");
  for (const message of [null, {status:"ok", practice_pass:true}, {status:"ok", practice_pass:false}, {status:"error"}, {status:"timeout"}]) {
    for (const text of [client.demoDraftStatus(message), client.demoPlanStatus(message)]) {
      assert.ok(text.length > 0);
      assert.doesNotMatch(text, /not run yet|unrun/i);
      assert.doesNotMatch(text, EM_DASH);
    }
  }
  assert.match(client.demoDraftStatus(null), /is running/i);
  assert.match(client.demoDraftStatus({status:"ok", practice_pass:true}), /Julia ran this practice code/);
  assert.match(client.demoPlanStatus({status:"ok", practice_pass:true}), /compare/i);
  assert.match(client.demoDraftStatus({status:"error"}), /could not run/i);
  assert.match(client.demoDraftStatus({status:"timeout"}), /did not finish/i);
});

test("UI-08: every practice run path updates both status lines, and a table timeout does not", () => {
  const status = functionBody("renderDemoRunStatus");
  assert.match(status, /el\.demoDraftNote\.textContent = demoDraftStatus\(message\)/);
  assert.match(status, /el\.demoPlan\.textContent = demoPlanStatus\(message\)/);
  assert.match(functionBody("sendDemoRun"), /renderDemoRunStatus\(null\)/, "a started run is described as running");
  assert.match(functionBody("armDemoRunDeadline"), /renderDemoRunStatus\(state\.demoResult\)/, "a run past its deadline is described");
  assert.match(functionBody("handle"), /renderDemoResult\(state\.demoResult\); renderDemoRunStatus\(state\.demoResult\);/, "a settled run is described");
  // A practice-table request that timed out ran no code, so its "not run yet" lines stay true.
  assert.doesNotMatch(functionBody("requestDemoInfo"), /renderDemoRunStatus/);
  assert.doesNotMatch(functionBody("renderDemoResult"), /renderDemoRunStatus/);
  // #demo-plan sits above the practice editor, so it must not point "above" at that editor.
  assert.ok(html.indexOf('id="demo-plan"') < html.indexOf('id="demo-code"'));
  assert.doesNotMatch(source, /practice expression above/);
});

// UI-12 (Chapter 3 part): `left_join(report, handling_log, by = "tray_id")` showed only the comma
// advice; the cause sat inside the collapsed "Original Julia error". Error text below is the real
// sandbox text (screen C3-10) and Julia 1.10.0 / DataFrames output measured 2026-09-24.
const LEFT_JOIN_ERROR = {status:"error", message:"left_join is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `left_join` not defined"};
const BY_ERROR = {status:"error", message:"A function was called with the wrong kind of argument.\n\nMethodError: no method matching leftjoin(::DataFrame, ::DataFrame; by::String)\n\nClosest candidates are:\n  leftjoin(::AbstractDataFrame, ::AbstractDataFrame; on, makeunique, source, indicator, validate, renamecols, matchmissing, order) got unsupported keyword argument \"by\"\n   @ DataFrames ~/.julia/packages/DataFrames/0Y1g5/src/join/composer.jl:920"};

test("UI-12: an R (dplyr) join name gets a line keyed on Julia's error, before the existing recovery", () => {
  assert.equal(typeof client.errorRecovery, "function");
  const recovery = client.recoveryCopy("join-report-log");
  const leftJoin = client.errorRecovery("join-report-log", LEFT_JOIN_ERROR);
  assert.match(leftJoin, /^left_join is an R \(dplyr\) name/);
  assert.match(leftJoin, /leftjoin/);
  assert.match(leftJoin, /on=/);
  assert.ok(leftJoin.endsWith(" " + recovery), "the existing recovery copy follows the new line");
  const byKeyword = client.errorRecovery("join-report-log", BY_ERROR);
  assert.match(byKeyword, /^by= is how R \(dplyr\) names the join column/);
  assert.match(byKeyword, /on=/);
  assert.ok(byKeyword.endsWith(" " + recovery));
  const newer = client.errorRecovery("join-report-log", {status:"error", message:"UndefVarError: `left_join` not defined in `Main`\nSuggestion: check for spelling errors or missing imports."});
  assert.match(newer, /^left_join is an R \(dplyr\) name/, "Julia 1.11+ wording is recognised too");
  for (const text of [leftJoin, byKeyword]) {
    assert.doesNotMatch(text, /leftjoin\(report, handling_log, on=:tray_id\)/, "no reference answer");
    assert.doesNotMatch(text.slice(0, text.length - recovery.length), EM_DASH);
  }
});

test("UI-12: other errors and the second move keep their existing recovery copy", () => {
  // Repair 4: the fresh-start line is kept to the case's table names (test/repair4-c3-name-leads.test.cjs),
  // so a misspelt name and an R name on the other move keep the existing recovery copy.
  assert.equal(client.errorRecovery("join-report-log", {status:"error", message:"reprot is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `reprot` not defined"}), client.recoveryCopy("join-report-log"));
  assert.equal(client.errorRecovery("join-report-log", {status:"error", message:""}), client.recoveryCopy("join-report-log"));
  assert.equal(client.errorRecovery("filter-disagreement", LEFT_JOIN_ERROR), client.recoveryCopy("filter-disagreement"));
  assert.match(source, /if \(message\.status === "error"\) p\.textContent = errorRecovery\(state\.activeMove, message\);/);
  // The separate practice editor gets the same keyed line before its own advice.
  assert.match(functionBody("renderDemoResult"), /joinErrorCoaching\(message\)/);
  assert.equal(client.joinErrorCoaching({status:"ok", message:"UndefVarError: `left_join` not defined"}), "");
});

// B9 (simulated students P21, P43): "row_rule = table.left_count .!= table.right_count" was typed
// as written; table, left_count and right_count are placeholders that do not exist in the case.
test("B9: C3 code-shape hints name their placeholders and map them to the case names", () => {
  const rowRule = client.helpStage("filter-disagreement", 1);
  assert.equal(rowRule.text, "row_rule = table.left_count .!= table.right_count", "the code line itself stays a generic shape");
  assert.match(rowRule.note, /placeholder/i);
  assert.match(rowRule.note, /table is joined/);
  assert.match(rowRule.note, /left_count is reported_detected_n/);
  assert.match(rowRule.note, /right_count is logged_detected_n/);
  const joinShape = client.helpStage("join-report-log", 1);
  assert.equal(joinShape.label, "Code shape");
  assert.match(joinShape.note, /left_table, right_table and shared_column are placeholders/);
  assert.match(joinShape.note, /Use these exact Julia names in your editor/, "points at the names card by its visible heading");
  for (const move of ["join-report-log", "filter-disagreement"]) {
    const solution = client.lessonCopy(move).solution;
    for (let index = 0; client.helpStage(move, index); index += 1) {
      const stage = client.helpStage(move, index);
      if (stage.label === "Full answer") continue;
      assert.ok(!(stage.text + " " + (stage.note || "")).includes(solution), "the reference answer stays behind the answer button");
      assert.doesNotMatch(stage.note || "", EM_DASH);
    }
  }
  assert.match(source, /if \(stage\.note\) \{/, "a stage note is rendered in the help list");
});

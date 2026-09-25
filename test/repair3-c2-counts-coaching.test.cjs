"use strict";

// Repair 3 C2 (R5, 2026-09-24 re-test): common counts and group shapes got only the generic
// "Julia did not produce the requested C2 result." line. Each reply below is the sandbox's actual
// reply, captured on Julia 1.10.0 with JuliaTime.handle_message (type case_run, chapter C2);
// test/test_mystery_c2.jl pins the same error keys and returned shapes.
const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter2.js");

const GENERIC = "Julia did not produce the requested result for this move.";
const EXPLANATION = {julia:"Return the requested grouped value or DataFrame for this step.", case:"No tray comparison is established until the returned result matches all recorded B09 trays."};
const errorResult = (step, message) => ({type:"case_result", chapter:"C2", step, status:"error", pass:false, message, feedback:GENERIC, explanation:EXPLANATION, rows:[], columns:[], value_repr:""});

// groups = groupby(jars, :tray_id); combine(groups, nrow => n, :detected => sum => detected_n)
const BARE_N = "n is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `n` not defined";
// groups = groupby(jars, :tray_id); combine(groups, nrow => :n, :detected => sum => detected_n)
const BARE_DETECTED_N = "detected_n is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `detected_n` not defined";
// combine(groupby(jars, :tray_id), :n => nrow, :detected_n => sum => :detected)
const REVERSED_N = "Something went wrong running this line.\n\nArgumentError: column name :n not found in the data frame";
// combine(groupby(jars, :tray_id), nrow => :n, :detected_n => sum => :detected)
const REVERSED_DETECTED_N = "Something went wrong running this line.\n\nArgumentError: column name \"detected_n\" not found in the data frame; existing most similar names are: \"detected\"";
// groupby(practice_jars, :tray_id), copied from the page's tiny worked example
const PRACTICE_JARS = "practice_jars is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `practice_jars` not defined";

// combine(jars, nrow => :n, :detected => sum => :detected_n): runs, returns one ungrouped row.
const UNGROUPED_COUNTS = {type:"case_result", chapter:"C2", step:"counts", status:"ok", pass:false, message:"",
  feedback:"Return exactly these columns: tray_id, n, detected_n.", explanation:EXPLANATION,
  columns:["n", "detected_n"], rows:[{n:6, detected_n:5}], row_text:[{n:"6", detected_n:"5"}],
  value_repr:"1×2 DataFrame\n Row │ n      detected_n\n     │ Int64  Int64\n─────┼───────────────────\n   1 │     6           5"};
// summary = combine(jars, nrow => :n, :detected => sum => :detected_n); summary.rate = ...; summary
const UNGROUPED_RATES = {type:"case_result", chapter:"C2", step:"rates", status:"ok", pass:false, message:"",
  feedback:"Return exactly these columns: tray_id, n, detected_n, rate.", explanation:EXPLANATION,
  columns:["n", "detected_n", "rate"], rows:[{n:6, detected_n:5, rate:0.8333333333333334}],
  row_text:[{n:"6", detected_n:"5", rate:"0.8333333333333334"}],
  value_repr:"1×3 DataFrame\n Row │ n      detected_n  rate\n     │ Int64  Int64       Float64\n─────┼─────────────────────────────\n   1 │     6           5  0.833333"};

const ANSWER_LINES = ["groupby(jars, :tray_id)", "combine(groups, nrow => :n, :detected => sum => :detected_n)", "summary.rate = summary.detected_n ./ summary.n"];
const assertNoAnswerLine = text => { for (const line of ANSWER_LINES) assert.ok(!text.includes(line), "coaching must not print the reference line " + line); };

test("R5a: in counts, a new column name without its colon is coached toward :n and :detected_n", () => {
  const n = client.c2ErrorNextStep(errorResult("counts", BARE_N));
  assert.match(n, /new column/i);
  assert.match(n, /colon/i);
  assert.match(n, /nrow => :n\b/);
  assert.doesNotMatch(n, /summary\.n/, "counts has no summary table to read from yet");
  assertNoAnswerLine(n);
  const detected = client.c2ErrorNextStep(errorResult("counts", BARE_DETECTED_N));
  assert.match(detected, /colon/i);
  assert.match(detected, /:detected => sum => :detected_n/);
  assertNoAnswerLine(detected);
  // The rates wording from 5cef86f stays as it was.
  assert.match(client.c2ErrorNextStep(errorResult("rates", BARE_N)), /summary\.n\b/);
});

test("R5b: a reversed pair (:n => nrow) is coached: the source goes first and the new name last", () => {
  // Rates has its own line for the same text (test/repair4-c2-rates-missing-column.test.cjs): there a
  // plain dot read of a column combine never made gives this text too.
  for (const step of ["counts"]) {
    const n = client.c2ErrorNextStep(errorResult(step, REVERSED_N));
    assert.match(n, /new name last|new name goes last|goes last/i, step);
    assert.match(n, /nrow => :n\b/, step);
    assertNoAnswerLine(n);
    const detected = client.c2ErrorNextStep(errorResult(step, REVERSED_DETECTED_N));
    assert.match(detected, /goes last/i, step);
    assert.match(detected, /:detected => sum => :detected_n/, step);
    assertNoAnswerLine(detected);
  }
  assert.equal(client.c2ErrorNextStep(errorResult("group", REVERSED_N)), "", "the group move makes no new columns");
});

test("R5 (practice_jars): the page's example table name is coached toward the case table jars", () => {
  for (const step of ["group", "counts"]) {
    const line = client.c2ErrorNextStep(errorResult(step, PRACTICE_JARS));
    assert.match(line, /practice_jars/, step);
    assert.match(line, /example/i, step);
    assert.match(line, /\bjars\b.*supplied|supplied.*\bjars\b/, step);
    assert.doesNotMatch(line, /template word/i, step);
    assertNoAnswerLine(line);
  }
});

test("R5c: an ungrouped one-row summary is coached from the returned value: group by tray first", () => {
  for (const result of [UNGROUPED_COUNTS, UNGROUPED_RATES]) {
    const text = client.resultText(Object.assign({}, result, {value_repr:""}));
    assert.match(text, /one row/i, result.step);
    assert.match(text, /per tray|each tray/i, result.step);
    assert.match(text, /groupby/, result.step);
    assert.ok(text.includes(result.feedback), "the server's own feedback still follows");
    assertNoAnswerLine(text);
  }
});

test("R5c: the returned-value line is keyed on the actual result, not added to other results", () => {
  const perTray = Object.assign({}, UNGROUPED_COUNTS, {columns:["tray_id", "n", "detected_n"],
    rows:[{tray_id:"T-A", n:2, detected_n:1}, {tray_id:"T-B", n:2, detected_n:2}, {tray_id:"T-C", n:2, detected_n:1}],
    feedback:"Each tray's detected_n must equal its recorded detections."});
  assert.ok(client.resultText(perTray).startsWith(perTray.feedback), "a per-tray table gets no groupby line");
  const accepted = Object.assign({}, perTray, {pass:true, feedback:"The counts match the recorded B09 tray summaries."});
  assert.ok(client.resultText(accepted).startsWith(accepted.feedback));
  const group = Object.assign({}, UNGROUPED_COUNTS, {step:"group", feedback:"Use groupby(..., :tray_id) and return the grouped result."});
  assert.ok(client.resultText(group).startsWith(group.feedback), "the group move has its own checker line");
  assert.equal(client.c2ErrorNextStep(UNGROUPED_COUNTS), "", "c2ErrorNextStep still coaches errors only");
});

test("R5: every new line leads the existing recovery copy, keeps Julia's error, and uses no em dash", () => {
  const cases = [["counts", BARE_N], ["counts", BARE_DETECTED_N], ["counts", REVERSED_N], ["counts", REVERSED_DETECTED_N], ["rates", REVERSED_N], ["group", PRACTICE_JARS]];
  for (const [step, message] of cases) {
    const result = errorResult(step, message);
    const coaching = client.c2ErrorNextStep(result);
    const text = client.resultText(result);
    assert.ok(coaching && text.startsWith(coaching), "coaching comes first: " + text);
    assert.ok(text.includes(GENERIC), "the chapter's recovery copy still follows");
    assert.equal(client.displayError(result), message, "Julia's own error text is untouched");
    assert.doesNotMatch(coaching, /—/, "no em dash in new learner-facing text");
  }
  for (const result of [UNGROUPED_COUNTS, UNGROUPED_RATES]) assert.doesNotMatch(client.resultText(result).split(result.feedback)[0], /—/);
});

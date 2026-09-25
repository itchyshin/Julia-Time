"use strict";

// Repair 2 C2 (2026-09-24 playtest): B12 (R's $ and pandas brackets were not coached in C2),
// B14 (the accepted rates table drew Julia's Float64 1.0 as 1), and the rates copy that said
// trays hold different numbers of jars while every B09 tray holds the same number.
// Each error message below is the sandbox's actual reply text, captured on Julia 1.10.0 with
// JuliaTime.handle_message (type case_run, chapter C2); test/test_mystery_c2.jl pins the same keys.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter2.js");

const GENERIC = "Julia did not produce the requested result for this move.";
const EXPLANATION = {julia:"Return the requested grouped value or DataFrame for this step.", case:"No tray comparison is established until the returned result matches all recorded B09 trays."};
const errorResult = (step, message) => ({type:"case_result", chapter:"C2", step, status:"error", pass:false, message, feedback:GENERIC, explanation:EXPLANATION});

// summary.rate = (summary$detected_n) ./ (summary$n), summary$detected_n, groupby(jars, jars$tray_id)
const DOLLAR = "$ is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `$` not defined";
// summary.rate = summary$detected_n ./ summary$n  (Julia reads $ around the whole division)
const DETECTED_N = "detected_n is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `detected_n` not defined";
// summary["rate"] = summary["detected_n"] ./ summary["n"]
const PANDAS = "Something went wrong running this line.\n\nArgumentError: syntax df[column] is not supported use df[!, column] instead";

const ANSWER_LINES = ["groupby(jars, :tray_id)", "combine(groups, nrow => :n, :detected => sum => :detected_n)", "summary.rate = summary.detected_n ./ summary.n"];
const assertNoAnswerLine = text => { for (const line of ANSWER_LINES) assert.ok(!text.includes(line), "coaching must not print the reference line " + line); };

test("B12: an R-style $ in C2 is named, with the Julia way to reach a column for that move", () => {
  const rates = client.c2ErrorNextStep(errorResult("rates", DOLLAR));
  assert.match(rates, /R's \$ does not exist in Julia/);
  assert.match(rates, /with a dot/);
  assert.match(rates, /summary\.detected_n/);
  assertNoAnswerLine(rates);
  for (const step of ["group", "counts"]) {
    const line = client.c2ErrorNextStep(errorResult(step, DOLLAR));
    assert.match(line, /R's \$ does not exist in Julia/, step);
    assert.match(line, /colon/, step);
    assert.match(line, /:tray_id/, step);
    assertNoAnswerLine(line);
  }
});

test("B12: a $ that Julia reads around the division is coached from its detected_n error", () => {
  const line = client.c2ErrorNextStep(errorResult("rates", DETECTED_N));
  assert.match(line, /:detected_n/, "the colon form for making the column in combine");
  assert.match(line, /summary\.detected_n/, "the dot form for reading it from the summary");
  // The same UndefVarError also comes from `summary.rate = detected_n ./ n` with no $ typed, so the line
  // names the dotted form without blaming R's $ (review note, 2026-09-24).
  assert.doesNotMatch(line, /\$/, "the error text cannot show that $ was typed");
  assertNoAnswerLine(line);
  const n = client.c2ErrorNextStep(errorResult("rates", DETECTED_N.replace(/detected_n/g, "n")));
  assert.match(n, /:n\b/);
  assert.match(n, /summary\.n\b/);
});

test("B12: pandas-style summary[\"rate\"] is coached toward the Julia form", () => {
  const rates = client.c2ErrorNextStep(errorResult("rates", PANDAS));
  assert.match(rates, /pandas/);
  assert.match(rates, /summary\.detected_n/);
  assertNoAnswerLine(rates);
  assert.match(client.c2ErrorNextStep(errorResult("group", PANDAS)), /:tray_id/);
});

test("B12: the new lines lead the existing recovery copy and Julia's error stays unchanged", () => {
  for (const [step, message] of [["rates", DOLLAR], ["rates", DETECTED_N], ["rates", PANDAS], ["group", DOLLAR]]) {
    const result = errorResult(step, message);
    const coaching = client.c2ErrorNextStep(result);
    const text = client.resultText(result);
    assert.ok(coaching && text.startsWith(coaching), "coaching comes first: " + text);
    assert.ok(text.includes(GENERIC), "the chapter's recovery copy still follows");
    assert.equal(client.displayError(result), message, "Julia's own error text is untouched");
    assert.doesNotMatch(coaching, /—/, "no em dash in new learner-facing text");
  }
});

// Captured accepted rates reply: every number arrives as a JSON number, so Julia's 1.0 is 1 here.
const ACCEPTED_ROWS = [{detected_n:2, n:2, rate:1, tray_id:"T-A"}, {detected_n:2, n:2, rate:1, tray_id:"T-B"}, {detected_n:1, n:2, rate:0.5, tray_id:"T-C"}];

test("B14: a table cell shows the text Julia printed for it, and falls back to the value without it", () => {
  const rowText = {detected_n:"2", n:"2", rate:"1.0"};
  assert.equal(client.juliaCell(ACCEPTED_ROWS[0], rowText, "rate"), "1.0");
  assert.equal(client.juliaCell(ACCEPTED_ROWS[0], rowText, "n"), "2");
  assert.equal(client.juliaCell(ACCEPTED_ROWS[0], rowText, "tray_id"), "T-A");
  assert.equal(client.juliaCell(ACCEPTED_ROWS[0], {rate:"1//1"}, "rate"), "1//1", "a Rational stays as Julia printed it");
  assert.equal(client.juliaCell(ACCEPTED_ROWS[0], null, "rate"), "1", "old saved evidence without Julia's text keeps the old display");
  assert.equal(client.juliaCell({x:{type:"Missing", display:"missing"}}, null, "x"), "missing");
  assert.equal(client.juliaCell({x:null}, null, "x"), "");
});

test("B14: accepted rates evidence keeps Julia's printed text for the rack", () => {
  const rowText = ACCEPTED_ROWS.map(row => ({detected_n:String(row.detected_n), n:"2", rate:row.rate === 1 ? "1.0" : "0.5"}));
  let state = client.beginRun(client.createState(), "r1", "rates");
  state = client.applyCaseResult(state, {type:"case_result", chapter:"C2", request_id:"r1", step:"rates", status:"ok", pass:true, rows:ACCEPTED_ROWS, columns:["tray_id", "n", "detected_n", "rate"], row_text:rowText});
  assert.deepEqual(state.evidence.row_text, rowText);
});

test("B14: the page draws tables, the rack and the rate parts with Julia's text, not String(number)", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "web", "chapter2.js"), "utf8");
  assert.match(source, /td\.textContent=juliaCell\(/, "returned tables use juliaCell");
  assert.match(source, /" = "\+juliaCell\(row,/, "the rack's rate uses juliaCell");
  assert.match(source, /renderTable\(result\.rows,result\.columns,el\.rows,result\.row_text\)/, "the returned table receives row_text");
  assert.match(source, /renderRack\(result\.step,result\.rows,el\.liveRack,result\.row_text\)/, "the live rack receives row_text");
  assert.match(source, /renderRack\("rates",evidence\.rows,el\.rack,evidence\.row_text\)/, "the evidence rack receives row_text");
  assert.match(source, /= \$\{juliaDivision\(example\.rate\)\}/, "the rate parts line prints the division as Julia would");
  assert.equal(client.juliaDivision(1), "1.0", "Julia's 2 / 2 is 1.0");
  assert.equal(client.juliaDivision(0.5), "0.5");
  assert.equal(client.juliaDivision(1 / 3), "0.3333333333333333");
  assert.equal(client.juliaDivision(0), "0.0");
});

test("Rates copy agrees with the B09 data: every tray holds the same number of jars", () => {
  const purpose = client.casePurpose("rates");
  assert.doesNotMatch(purpose, /can hold different numbers|hold different numbers of jars/i, "the purpose line does not claim these trays differ in size");
  assert.match(purpose, /fairly compare trays/i);
  assert.match(client.lessonCopy("rates").teaching, /every tray has the same number of jars/);
  assert.doesNotMatch(purpose, /—/, "no em dash in new learner-facing text");
});

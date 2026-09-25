"use strict";

// Repair C2 (2026-09-24): common C2 mistakes got only the generic "Julia did not produce the
// requested C2 result" line, with the real cause hidden in the collapsed "Original Julia error".
// Each message below is the sandbox's actual text for the mistake, captured from
// JuliaTime.mystery_c2_case_run on Julia 1.10.0 (test/test_mystery_c2.jl pins the same keys).
const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter2.js");

const GENERIC = "Julia did not produce the requested result for this move.";
const EXPLANATION = {julia:"Return the requested grouped value or DataFrame for this step.", case:"No tray comparison is established until the returned result matches all recorded B09 trays."};

function errorResult(step, message) {
  return {type:"case_result", chapter:"C2", step, status:"error", pass:false, message, feedback:GENERIC, explanation:EXPLANATION};
}

const MISSING_COLON = errorResult("group", "tray_id is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `tray_id` not defined");
const MISSING_COLON_DETECTED = errorResult("counts", "detected is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `detected` not defined");
const DPLYR_COMBINE = errorResult("counts", "A function was called with the wrong kind of argument.\n\nMethodError: no method matching iterate(::Symbol)\n\nClosest candidates are:\n  iterate(!Matched::Pkg.Resolve.NodePerm, Any...)\n   @ Pkg ~/.julia/juliaup/julia-1.10.0+0.aarch64.apple.darwin14/share/julia/stdlib/v1.10/Pkg/src/Resolve/maxsum.jl:240\n  iterate(!Matched::Base.EnvDict)\n   @ Base env.jl:207\n  ...\n");
const KEYWORD_COMBINE = errorResult("counts", "A function was called with the wrong kind of argument.\n\nMethodError: no method matching combine(::DataFrames.GroupedDataFrame{DataFrames.DataFrame}; n::typeof(DataAPI.nrow))\n\nClosest candidates are:\n  combine(::DataFrames.GroupedDataFrame, Union{Regex, AbstractString, Function, Signed, Symbol, Unsigned, Pair, Type, DataAPI.All, DataAPI.Between, DataAPI.Cols, InvertedIndices.InvertedIndex, AbstractVecOrMat}...; keepkeys, ungroup, renamecols, threads) got unsupported keyword argument \"n\"\n");
const PAIRS_WITHOUT_GROUPS = errorResult("counts", "A function was called with the wrong kind of argument.\n\nMethodError: no method matching combine(::Pair{typeof(DataAPI.nrow), Symbol}, ::Pair{Symbol, Pair{typeof(sum), Symbol}})\n\nClosest candidates are:\n  combine(!Matched::DataFrames.GroupedDataFrame, ...)\n");
const PLAIN_SLASH = errorResult("rates", "Something went wrong running this line.\n\nArgumentError: It is only allowed to pass a vector as a column of a DataFrame. Instead use `df[!, col_ind] .= v` if you want to use broadcasting.");
const FOLLOWED_DOT_EQUALS = errorResult("rates", "Something went wrong running this line.\n\nDimensionMismatch: cannot broadcast array to have fewer non-singleton dimensions");

const ANSWER_LINES = ["groupby(jars, :tray_id)", "combine(groups, nrow => :n, :detected => sum => :detected_n)", "summary.rate = summary.detected_n ./ summary.n"];

function assertNoAnswerLine(text) {
  for (const line of ANSWER_LINES) assert.ok(!text.includes(line), "coaching must not print the reference line " + line);
}

test("C2 names the missing colon when Julia reports a bare column name", () => {
  const line = client.c2ErrorNextStep(MISSING_COLON);
  assert.match(line, /colon/i);
  assert.match(line, /:tray_id/);
  assertNoAnswerLine(line);
  const detected = client.c2ErrorNextStep(MISSING_COLON_DETECTED);
  assert.match(detected, /colon/i);
  assert.match(detected, /:detected\b/);
});

test("C2 rates: a plain / between two columns is coached toward ./, not DataFrames' .= advice", () => {
  for (const result of [PLAIN_SLASH, FOLLOWED_DOT_EQUALS]) {
    const line = client.c2ErrorNextStep(result);
    assert.match(line, /dot/i);
    assert.match(line, /detected_n \.\/ n/);
    assert.match(line, /\.= suggestion/i, "the line says the error's own .= advice is not the fix");
    assertNoAnswerLine(line);
  }
  // The same DataFrames error outside the rates move is not about dividing, so it gets no rates line.
  assert.equal(client.c2ErrorNextStep({...PLAIN_SLASH, step:"counts"}), "");
});

test("C2 counts: dplyr-style name = value and sum(:detected) are coached toward combine's pairs", () => {
  for (const result of [DPLYR_COMBINE, KEYWORD_COMBINE]) {
    const line = client.c2ErrorNextStep(result);
    assert.match(line, /combine takes pairs/i);
    assert.match(line, /nrow => :n/);
    assert.match(line, /:detected => sum => :detected_n/);
    assertNoAnswerLine(line);
  }
  assert.match(client.c2ErrorNextStep(DPLYR_COMBINE), /sum\(:detected\)/, "the iterate(::Symbol) line names the sum(:detected) habit");
  assert.match(client.c2ErrorNextStep(KEYWORD_COMBINE), /n = nrow/, "the keyword line names the n = nrow habit");
  const groupsFirst = client.c2ErrorNextStep(PAIRS_WITHOUT_GROUPS);
  assert.match(groupsFirst, /grouped table first/i);
  assertNoAnswerLine(groupsFirst);
});

test("C2 puts the error-specific line in front of the existing recovery copy, which stays", () => {
  for (const result of [MISSING_COLON, DPLYR_COMBINE, PLAIN_SLASH]) {
    const text = client.resultText(result);
    const coaching = client.c2ErrorNextStep(result);
    assert.ok(coaching, "a coaching line exists for " + result.step);
    assert.ok(text.startsWith(coaching), "coaching comes first: " + text);
    assert.ok(text.includes(GENERIC), "the chapter's existing recovery copy still follows");
    assert.ok(text.includes(EXPLANATION.julia));
  }
});

test("C2 coaching is keyed on actual error text only; other errors and passing runs add nothing", () => {
  assert.equal(client.c2ErrorNextStep(errorResult("counts", "MethodError: no method matching length(::Symbol)")), "");
  assert.equal(client.c2ErrorNextStep(errorResult("rates", "summary is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `summary` not defined")), "");
  assert.equal(client.c2ErrorNextStep({status:"ok", pass:false, step:"rates", message:"", feedback:"Return exactly these columns: tray_id, n, detected_n, rate."}), "");
  const accepted = client.resultText({status:"ok", pass:true, step:"group", feedback:"The records match.", explanation:{julia:"In the taught approach, groupby(jars, :tray_id) keeps the B09 records."}});
  assert.ok(accepted.startsWith("The records match."));
});

"use strict";

// Repair C2 (2026-09-24): common C2 mistakes got only the generic "Julia did not produce the
// requested C2 result" line, with the real cause hidden in the collapsed "Original Julia error".
// Each message below is the sandbox's actual text for the mistake, captured from
// JuliaTime.mystery_c2_case_run on Julia 1.10.0 (test/test_mystery_c2.jl pins the same keys).
const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter2.js");

const GENERIC = "Julia did not produce the requested result for this move.";
const EXPLANATION = {julia:"Return the requested result for this step.", case:"No tray comparison is established until the returned result matches all recorded B09 trays."};

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

const ANSWER_LINES = ["groupby(jars, :tray_id)", "combine(groups, nrow => :n, :detected => sum => :detected_n)", "counts.rate = counts.detected_n ./ counts.n"];

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

// Replay notes (2026-09-27): the error-specific line used to be followed by the chapter's generic
// recovery copy and explanation, reading as one wrong message after the right one. resultText now
// shows the specific coaching alone, the same rule C1's challengeRecovery already applies.
test("C2 shows the error-specific line alone, not followed by the generic recovery copy", () => {
  for (const result of [MISSING_COLON, DPLYR_COMBINE, PLAIN_SLASH]) {
    const text = client.resultText(result);
    const coaching = client.c2ErrorNextStep(result);
    assert.ok(coaching, "a coaching line exists for " + result.step);
    // Round 7 (r7-bugs #9): the line is followed only by the shared coaching ending.
    assert.equal(text, coaching + " Change your code, then run again, or open Stuck? Hints below.", "coaching stands alone: " + text);
    assert.doesNotMatch(text, new RegExp(GENERIC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the generic recovery copy does not follow");
  }
});

test("C2 coaching is keyed on actual error text only; other errors and passing runs add nothing", () => {
  assert.equal(client.c2ErrorNextStep(errorResult("counts", "MethodError: no method matching length(::Symbol)")), "");
  assert.equal(client.c2ErrorNextStep({status:"ok", pass:false, step:"rates", message:"", feedback:"Return exactly these columns: tray_id, n, detected_n, rate."}), "");
  const accepted = client.resultText({status:"ok", pass:true, step:"group", feedback:"The records match.", explanation:{julia:"In the taught approach, groupby(jars, :tray_id) keeps the B09 records."}});
  assert.ok(accepted.startsWith("The records match."));
});

test("a returning player's draft using the old name summary is coached to the renamed counts table", () => {
  const undefSummary = errorResult("rates", "summary is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `summary` not defined");
  const line = client.c2ErrorNextStep(undefSummary);
  assert.match(line, /This name changed: use counts instead of summary/);
});

test("C2 counts: nrow called directly on the groups is coached toward combine's nrow => :n pair", () => {
  const message = errorResult("counts", "A function was called with the wrong kind of argument.\n\nMethodError: no method matching nrow(::DataFrames.GroupedDataFrame{DataFrames.DataFrame})");
  const line = client.c2ErrorNextStep(message);
  assert.match(line, /nrow => :n/);
  assert.match(line, /combine/i);
});

// Night playtest 2026-09-26 (docs/dev-log/playtest/2026-09-26-night/README.md item 4): R's %>%
// reaches the sandbox as a raw parse error with no word about the pipe, and a pandas-style method
// call after a dot (jars.groupby(...)) reads as a missing column named after the method, which
// looks like a typo rather than a habit.
const PIPE_PARSE_ERROR = errorResult("group", "Julia couldn't parse this line. Look for a missing bracket, a missing comma, or a missing end keyword.\n\nParseError:\n# Error @ none:1:7\njars %>% group_by(tray_id)\n#     ╙ ── not a unary operator\n");
const GROUPBY_METHOD_CALL = errorResult("group", "Something went wrong running this line.\n\nArgumentError: column name :groupby not found in the data frame");

test("C2 names Julia's pipe when a learner writes R's %>%", () => {
  const line = client.c2ErrorNextStep(PIPE_PARSE_ERROR);
  assert.match(line, /%>%/);
  assert.match(line, /\|>/);
  assert.match(line, /groupby\(jars, :tray_id\)/);
});

test("C2 explains a pandas-style dot-call (jars.groupby(...)) as a function, not a missing column", () => {
  const line = client.c2ErrorNextStep(GROUPBY_METHOD_CALL);
  assert.match(line, /groupby is a function in Julia/);
  assert.doesNotMatch(line, /typo/i);
});

// B1 (2026-09-27 adversary review): the coaching for a pandas-style jars.sample(...) call named
// sample(jars, 3), which raises MethodError: no method matching sample(::DataFrame, ::Int64) in the
// real sandbox (StatsBase's sample needs an AbstractArray). Fixed to sample(jars.jar_id, 3;
// replace=false), verified to run on the game's own B09 fixture (six jar_id rows) with
// `julia --startup-file=no --project=. -e 'using DataFrames, StatsBase; ...'`.
const SAMPLE_METHOD_CALL = errorResult("group", "Something went wrong running this line.\n\nArgumentError: column name :sample not found in the data frame");
const MEAN_METHOD_CALL = errorResult("group", "Something went wrong running this line.\n\nArgumentError: column name :mean not found in the data frame");

test("C2 names a working sample(...) call, not the pandas-shaped one that errors", () => {
  const line = client.c2ErrorNextStep(SAMPLE_METHOD_CALL);
  assert.match(line, /sample is a function in Julia/);
  assert.match(line, /sample\(jars\.jar_id, 3; replace=false\)/);
  assert.doesNotMatch(line, /sample\(jars, 3\)/);
});

test("C2 names a working mean(...) call for the pandas-style jars.mean()", () => {
  const line = client.c2ErrorNextStep(MEAN_METHOD_CALL);
  assert.match(line, /mean is a function in Julia/);
  assert.match(line, /mean\(jars\.detected\)/);
});

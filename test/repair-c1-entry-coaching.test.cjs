"use strict";

// Stopping point C1/select-records (2026-09-24 agent-proxy playtest, reproduced here before fixing):
// entry mistakes other than R's $ and a plain == fell through to the shared next step only, so a
// pandas user heard the same line after two different mistakes and a MATLAB-style jars(...) was told
// only that "a function was called with the wrong kind of argument". Each message below is the exact
// text the real C1 sandbox returned on 2026-09-24 (Julia 1.10.0) for the code in its comment.

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/mystery.js");

const SHARED = "Next step: read the batch_id column as a vector, make a true-or-false row rule from it, then use the first nudge under “Need the full answer?” below if you need to place that rule in the table. Your draft is unchanged.";

// jars[jars["batch_id"] == "B09"], jars[jars["batch_id"] .== "B09", :] and, after following
// DataFrames' own advice, jars[jars[!, "batch_id"] == "B09"] all return this text.
const PANDAS = "Something went wrong running this line.\n\nArgumentError: syntax df[column] is not supported use df[!, column] instead";
// jars(jars.batch_id .== case_batch, :)
const PARENS = "A function was called with the wrong kind of argument.\n\nMethodError: objects of type DataFrames.DataFrame are not callable";
// jars[jars.batch_id .== case_batch] and jars[jars.batch_id .== case_batch, ]
const NO_COLUMNS = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching getindex(::DataFrames.DataFrame, ::BitVector)\n\nClosest candidates are:\n  getindex(::DataFrames.DataFrame, ::AbstractVector, !Matched::Union{AbstractString, Signed, Symbol, Unsigned})\n   @ DataFrames ~/.julia/packages/DataFrames/0Y1g5/src/dataframe/dataframe.jl:532\n  getindex(::DataFrames.DataFrame, ::AbstractVector{T}, !Matched::Colon) where T\n   @ DataFrames ~/.julia/packages/DataFrames/0Y1g5/src/dataframe/dataframe.jl:607\n  ...\n";
// jars[jars$batch_id == "B09", ] and jars[jars.batch_id == case_batch, :]: already coached (T4).
const DOLLAR = "$ is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `$` not defined";
const PLAIN_EQ = "Something went wrong running this line.\n\nArgumentError: invalid row index of type Bool";

function firstLine(message) {
  const recovery = client.challengeRecovery({status:"error", pass:false, message});
  assert.ok(recovery.endsWith(SHARED), "the coaching line sits in front of the existing recovery copy");
  return recovery.slice(0, recovery.length - SHARED.length).trim();
}

test("pandas-style one-position indexing gets its own line about jars[rows, columns] and jars.batch_id", () => {
  const line = firstLine(PANDAS);
  assert.match(line, /two positions/);
  assert.match(line, /jars\[rows, columns\]/);
  assert.match(line, /jars\.batch_id/);
  assert.match(line, /pandas/);
  assert.doesNotMatch(line, /df\[!, column\]/, "DataFrames' own advice is not repeated as the headline");
});

test("round-bracket indexing gets a square-bracket line", () => {
  const line = firstLine(PARENS);
  assert.match(line, /Round brackets/);
  assert.match(line, /square brackets/);
  assert.match(line, /jars\[rows, columns\]/);
});

test("a missing columns position gets a line about putting : there", () => {
  const line = firstLine(NO_COLUMNS);
  assert.match(line, /columns position/);
  assert.match(line, /put : in the columns position/);
  // The practice error for jars[1:3] has the same shape and gets the same line.
  assert.equal(firstLine("A function was called with the wrong kind of argument.\n\nMethodError: no method matching getindex(::DataFrames.DataFrame, ::UnitRange{Int64})"), line);
});

test("each C1 entry mistake now gets a different first line, and other errors keep only the shared step", () => {
  const lines = [PANDAS, PARENS, NO_COLUMNS, DOLLAR, PLAIN_EQ].map(firstLine);
  assert.equal(new Set(lines).size, lines.length);
  for (const line of lines.slice(0, 3)) {
    assert.ok(line.length > 0);
    assert.doesNotMatch(line, /—/, "no em dash in new learner-facing copy");
    assert.doesNotMatch(line, /jars\.batch_id\s*\.==\s*case_batch/, "no case answer in the coaching line");
  }
  // Keyed on the actual error text: a different getindex or MethodError does not borrow these lines.
  assert.equal(firstLine("A function was called with the wrong kind of argument.\n\nMethodError: no method matching getindex(::DataFrames.DataFrame, ::BitVector, ::Float64)"), "");
  assert.equal(firstLine("A function was called with the wrong kind of argument.\n\nMethodError: no method matching +(::String, ::Int64)"), "");
  assert.equal(firstLine("Something went wrong running this line.\n\nArgumentError: column name :loc not found in the data frame"), "");
});

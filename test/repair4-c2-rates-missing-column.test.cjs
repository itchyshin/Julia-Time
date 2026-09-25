"use strict";

// Repair 4 (review of repair3/c2): in rates, DataFrames gives the same "column name ... not found"
// text for a reversed combine pair and for a plain dot read of a column that combine never made.
// The counts line ("Julia looked for a column named n before combine made it...") is false for the
// dot reads, so rates gets a line that is true for every captured cause. Each message below is the
// sandbox's actual reply, captured with JuliaTime.handle_message on Julia 1.10.0 on 2026-09-24
// (test/test_mystery_c2.jl pins the same texts).
const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter2.js");

const errorResult = (step, message) => ({type:"case_result", chapter:"C2", step, status:"error", pass:false, message, feedback:"Julia did not produce the requested result for this move.", rows:[], columns:[], value_repr:""});
// summary = combine(groupby(jars, :tray_id), nrow, :detected => sum); summary.rate = summary.detected_n ./ summary.nrow
const DOT_DETECTED_N = "Something went wrong running this line.\n\nArgumentError: column name :detected_n not found in the data frame";
// summary = combine(groupby(jars, :tray_id), nrow => :count, ...); summary.rate = summary.detected_n ./ summary.n
// (also the reversed pair summary = combine(groupby(jars, :tray_id), :n => nrow, ...) in rates)
const DOT_N = "Something went wrong running this line.\n\nArgumentError: column name :n not found in the data frame";
// jars.rate = jars.detected_n ./ jars.n
const JARS_DETECTED_N = "Something went wrong running this line.\n\nArgumentError: column name \"detected_n\" not found in the data frame; existing most similar names are: \"detected\"";

const RATES_N = "Julia looked for a column named n, and the table has no column with that name. In combine, the new column's name comes last in each pair, like nrow => :n.";
const RATES_DETECTED_N = "Julia looked for a column named detected_n, and the table has no column with that name. In combine, the new column's name comes last in each pair, like :detected => sum => :detected_n.";

test("rates: a missing n or detected_n column gets a line that is true for dot reads and reversed pairs", () => {
  assert.equal(client.c2ErrorNextStep(errorResult("rates", DOT_N)), RATES_N);
  assert.equal(client.c2ErrorNextStep(errorResult("rates", DOT_DETECTED_N)), RATES_DETECTED_N);
  assert.equal(client.c2ErrorNextStep(errorResult("rates", JARS_DETECTED_N)), RATES_DETECTED_N);
  for (const message of [DOT_N, DOT_DETECTED_N, JARS_DETECTED_N]) {
    const result = errorResult("rates", message);
    const text = client.resultText(result);
    assert.ok(text.startsWith(client.c2ErrorNextStep(result)), "the line comes first");
    assert.doesNotMatch(text, /before combine made it|source comes first/, "no cause the learner may not have written");
    assert.doesNotMatch(text, /—/);
    assert.equal(client.displayError(result), message, "Julia's own error text is untouched");
  }
});

test("counts keeps the reversed-pair wording for the same text", () => {
  assert.equal(client.c2ErrorNextStep(errorResult("counts", DOT_N)), "Julia looked for a column named n before combine made it. In a combine pair the source comes first and the new name goes last: nrow => :n.");
  assert.equal(client.c2ErrorNextStep(errorResult("group", DOT_N)), "");
});

"use strict";

// UI-12 (Chapter 3, filter part), 2026-09-24 browser check: in move 2 a missing dot
// (`!=` instead of `.!=`) got only the generic recovery copy; the cause sat in the collapsed
// "Original Julia error". The fixtures below are the real sandbox messages, captured with
// JuliaTime.handle_message on Julia 1.10 / DataFrames on 2026-09-24.

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter3.js");

const EM_DASH = /—/;
// joined[joined.reported_detected_n != joined.logged_detected_n, :]
// (also row_rule = ... != ...; joined[row_rule, :], joined[!(... == ...), :] and view(...))
const NO_DOT_INDEX = {status:"error", message:"Something went wrong running this line.\n\nArgumentError: invalid row index of type Bool"};
// subset(joined, [:reported_detected_n, :logged_detected_n] => (a, b) -> a != b)
const NO_DOT_SUBSET = {status:"error", message:"Something went wrong running this line.\n\nArgumentError: function passed to `subset`/`subset!` returned value of type `Bool` while it must return an `AbstractVector` when subsetting a data frame to ensure common mistakes in code are caught. Please report an issue if you find this restriction inconvenient."};

test("UI-12: a missing dot in the filter move gets a line keyed on Julia's error, before the existing recovery", () => {
  const recovery = client.recoveryCopy("filter-disagreement");
  for (const message of [NO_DOT_INDEX, NO_DOT_SUBSET]) {
    const text = client.errorRecovery("filter-disagreement", message);
    assert.notEqual(text, recovery, "the missing-dot error gets its own line");
    assert.ok(text.endsWith(" " + recovery), "the existing recovery copy follows the new line");
    const lead = text.slice(0, text.length - recovery.length - 1);
    assert.match(lead, /one true or false/i, "says what Julia actually received");
    assert.match(lead, /each row/i);
    assert.match(lead, /\.!=/, "names the dotted operator");
    assert.doesNotMatch(lead, EM_DASH);
    assert.ok(!lead.includes(client.lessonCopy("filter-disagreement").solution), "no reference answer");
  }
});

test("UI-12: the missing-dot line stays on its own move and on its own error", () => {
  assert.equal(typeof client.filterErrorCoaching, "function");
  assert.equal(client.filterErrorCoaching({status:"ok", message:NO_DOT_INDEX.message}), "");
  assert.equal(client.filterErrorCoaching(null), "");
  assert.equal(client.errorRecovery("join-report-log", NO_DOT_INDEX), client.recoveryCopy("join-report-log"));
  const unrelated = {status:"error", message:"row_rule is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `row_rule` not defined"};
  assert.equal(client.errorRecovery("filter-disagreement", unrelated), client.recoveryCopy("filter-disagreement"));
  // table is this move's own code-shape placeholder, so it gets the placeholder line (Repair 4,
  // test/repair4-c3-name-leads.test.cjs), not the missing-dot line.
  const placeholder = {status:"error", message:"table is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `table` not defined"};
  assert.equal(client.errorRecovery("filter-disagreement", placeholder), "table is a placeholder from the code shape, not a name in this case. Here table is joined, left_count is reported_detected_n, and right_count is logged_detected_n. Your draft is still here; change that line and run again.");
});

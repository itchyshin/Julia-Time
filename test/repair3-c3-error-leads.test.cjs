"use strict";

// Repair 3 (simulated re-test, 2026-09-24), Chapter 3 error leads.
// R2: move 2 supplies only `joined`; learners who rebuilt the join from report, handling_log or
//     jars got UndefVarError and then the dot-and-comma recovery, a mistake they had not made.
// R6: the join shape's placeholders (left_table, right_table, shared_column) typed as written got
//     the comma recovery although the commas were right.
// Also: the move 2 missing-dot line no longer assumes an R background.
// Every fixture below is the real sandbox message, captured with JuliaTime.handle_message on
// Julia 1.10 / DataFrames on 2026-09-24 (the texts are pinned in test/test_mystery_c3.jl).

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter3.js");

const EM_DASH = /—/;
const undefinedName = name => ({status:"error", message:name + " is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `" + name + "` not defined"});
const NO_DOT_INDEX = {status:"error", message:"Something went wrong running this line.\n\nArgumentError: invalid row index of type Bool"};
const SHARED_COLUMN_NOT_FOUND = {status:"error", message:"Something went wrong running this line.\n\nArgumentError: column :shared_column not found in the left data frame"};

// Repair 4 (review of repair 3): a name-level line is followed by a short neutral line, not by the
// move's dot/comma checklist, which names a mistake the learner did not make.
const NEXT = "Your draft is still here; change that line and run again.";
function leadOf(move, message) {
  const recovery = client.recoveryCopy(move);
  const text = client.errorRecovery(move, message);
  assert.notEqual(text, recovery, "this error gets its own line");
  assert.ok(text.endsWith(" " + NEXT), "the neutral line follows the new line");
  assert.ok(!text.includes(recovery), "the move's checklist is not shown after a name-level line");
  const lead = text.slice(0, text.length - NEXT.length - 1);
  assert.doesNotMatch(lead, EM_DASH);
  assert.ok(!lead.includes(client.lessonCopy(move).solution), "no reference answer");
  return lead;
}

test("R2: a name from an earlier move or chapter in move 2 says each run starts fresh with only joined", () => {
  for (const name of ["report", "handling_log", "jars"]) {
    const lead = leadOf("filter-disagreement", undefinedName(name));
    assert.ok(lead.startsWith(name + " "), "names the missing name first: " + lead);
    assert.match(lead, /starts fresh/);
    assert.match(lead, /supplies only joined/);
    assert.doesNotMatch(lead, /\.!=|comma/, "does not name a mistake the learner did not make");
  }
  // Julia 1.11+ adds "in `Main`" to the same error.
  assert.match(client.errorRecovery("filter-disagreement", {status:"error", message:"UndefVarError: `report` not defined in `Main`"}), /^report .*starts fresh/);
});

test("R2: the fresh-start line is keyed on names that are not active inputs of the current move", () => {
  // report and handling_log are the join move's own inputs, so no fresh-start line there.
  assert.equal(client.errorRecovery("join-report-log", undefinedName("report")), client.recoveryCopy("join-report-log"));
  const lead = leadOf("join-report-log", undefinedName("jars"));
  assert.match(lead, /starts fresh/);
  assert.match(lead, /supplies only report and handling_log/);
  // Other errors, and non-error results, keep their existing copy.
  assert.equal(client.errorRecovery("filter-disagreement", {status:"error", message:""}), client.recoveryCopy("filter-disagreement"));
  assert.equal(client.errorRecovery("filter-disagreement", {status:"ok", message:"UndefVarError: `report` not defined"}), client.recoveryCopy("filter-disagreement"));
  // The missing-dot line still wins for its own error.
  assert.match(client.errorRecovery("filter-disagreement", NO_DOT_INDEX), /one true or false/i);
});

test("R6: the join shape's placeholders typed as written are named as placeholders and mapped", () => {
  for (const [name, message] of [["left_table", undefinedName("left_table")], ["right_table", undefinedName("right_table")], ["shared_column", undefinedName("shared_column")], ["shared_column", SHARED_COLUMN_NOT_FOUND]]) {
    const lead = leadOf("join-report-log", message);
    assert.ok(lead.startsWith(name + " is a placeholder"), lead);
    assert.match(lead, /\breport\b/);
    assert.match(lead, /\bhandling_log\b/);
    assert.match(lead, /:tray_id/);
    assert.doesNotMatch(lead, /starts fresh|comma/, "the placeholder line is the one shown, not the fresh-start line");
  }
  // The R (dplyr) lines stay first on their own errors.
  assert.match(client.errorRecovery("join-report-log", undefinedName("left_join")), /^left_join is an R \(dplyr\) name/);
});

test("R6: the practice editor never gets the case-table mapping", () => {
  // renderDemoResult uses joinErrorCoaching; practice tables are practice_report and practice_log.
  for (const message of [undefinedName("left_table"), SHARED_COLUMN_NOT_FOUND]) {
    assert.doesNotMatch(client.joinErrorCoaching(message), /handling_log|:tray_id/);
  }
});

test("the move 2 missing-dot line does not assume an R background", () => {
  const lead = client.filterErrorCoaching(NO_DOT_INDEX);
  assert.match(lead, /\.!=/);
  assert.doesNotMatch(lead, /\bR\b|Python|pandas|dplyr/);
});

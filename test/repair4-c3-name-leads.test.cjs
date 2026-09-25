"use strict";

// Repair 4 (review of repair 3, Chapter 3): the fresh-start line ("<name> is not defined in this
// run. Each run starts fresh...") fired for every unknown name, so a bare column name or R's $ got
// a wrong cause. It is now kept to the case's table names. A bare column name, R's $, and move 2's
// own code-shape placeholders get their own lines, and a name-level line is followed by a short
// neutral line, not by a checklist that names a different mistake.
// Every fixture below is the real sandbox message, captured with JuliaTime.handle_message on
// Julia 1.10 / DataFrames on 2026-09-24 (the texts are pinned in test/test_mystery_c3.jl).

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter3.js");

const EM_DASH = /—/;
const NEXT = "Your draft is still here; change that line and run again.";
const undefinedName = name => ({status:"error", message:name + " is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `" + name + "` not defined"});
// joined[joined.left_count .!= joined.right_count, :]
const LEFT_COUNT_COLUMN = {status:"error", message:"Something went wrong running this line.\n\nArgumentError: column name :left_count not found in the data frame"};
const MOVE2_MAP = "Here table is joined, left_count is reported_detected_n, and right_count is logged_detected_n.";

// A name-level line ends with the neutral line and never with the move's checklist.
function nameLead(move, message) {
  const text = client.errorRecovery(move, message);
  assert.ok(text.endsWith(" " + NEXT), "the neutral line follows: " + text);
  assert.ok(!text.includes(client.recoveryCopy(move)), "no checklist that names a different mistake: " + text);
  assert.doesNotMatch(text, EM_DASH);
  assert.ok(!text.includes(client.lessonCopy(move).solution), "no reference answer");
  return text.slice(0, text.length - NEXT.length - 1);
}

test("move 1: a bare column name (on=tray_id) is coached toward a colon, not a fresh start", () => {
  // leftjoin(report, handling_log, on=tray_id) and leftjoin(report, handling_log, tray_id)
  const lead = nameLead("join-report-log", undefinedName("tray_id"));
  assert.equal(lead, "tray_id is a column name, not a name Julia knows on its own. Name a column with a colon, as in on=:tray_id.");
  for (const column of ["reported_detected_n", "logged_detected_n", "log_status"]) {
    assert.match(nameLead("join-report-log", undefinedName(column)), new RegExp("^" + column + " is a column name.*on=:tray_id\\.$"));
  }
});

test("move 2: a bare column name is coached toward reading it from joined with a dot", () => {
  // joined[reported_detected_n .!= logged_detected_n, :] and filter(joined, reported_detected_n != logged_detected_n)
  assert.equal(nameLead("filter-disagreement", undefinedName("reported_detected_n")),
    "reported_detected_n is a column of joined, not a name Julia knows on its own. Read a column from joined with a dot, as in joined.reported_detected_n.");
  assert.equal(nameLead("filter-disagreement", undefinedName("logged_detected_n")),
    "logged_detected_n is a column of joined, not a name Julia knows on its own. Read a column from joined with a dot, as in joined.logged_detected_n.");
  assert.doesNotMatch(nameLead("filter-disagreement", undefinedName("tray_id")), /starts fresh|\.!=|comma/);
});

test("R's $ is coached toward Julia's dot on both moves", () => {
  // joined$reported_detected_n, joined[joined$reported_detected_n .!= joined$logged_detected_n, :]
  assert.equal(nameLead("filter-disagreement", undefinedName("$")),
    "R's $ does not exist in Julia: Julia reads a column with a dot, as in joined.reported_detected_n.");
  // leftjoin(report, handling_log, on=report$tray_id)
  assert.equal(nameLead("join-report-log", undefinedName("$")),
    "R's $ does not exist in Julia: Julia reads a column with a dot, as in report.tray_id. In leftjoin, name the shared column with a colon: on=:tray_id.");
});

test("move 2's own placeholders are named as placeholders and mapped to joined's names", () => {
  // table[table.left_count .!= table.right_count, :], row_rule = table.left_count .!= ..., joined[left_count .!= right_count, :]
  for (const [name, message] of [["table", undefinedName("table")], ["left_count", undefinedName("left_count")], ["right_count", undefinedName("right_count")], ["left_count", LEFT_COUNT_COLUMN]]) {
    assert.equal(nameLead("filter-disagreement", message), name + " is a placeholder from the code shape, not a name in this case. " + MOVE2_MAP);
  }
  // Move 1 has its own placeholders; move 2's are not coached there.
  assert.equal(client.errorRecovery("join-report-log", undefinedName("table")), client.recoveryCopy("join-report-log"));
});

test("the fresh-start line is kept to the case's table names that this move does not supply", () => {
  for (const name of ["report", "handling_log", "jars", "practice_report", "practice_log"]) {
    assert.equal(nameLead("filter-disagreement", undefinedName(name)),
      name + " is not defined in this run. Each run starts fresh, and this move supplies only joined, so start from joined.");
  }
  for (const name of ["joined", "jars", "practice_report", "practice_log"]) {
    assert.equal(nameLead("join-report-log", undefinedName(name)),
      name + " is not defined in this run. Each run starts fresh, and this move supplies only report and handling_log, so start from those.");
  }
  // Any other unknown name keeps the move's existing recovery copy, with no invented cause.
  for (const [move, name] of [["join-report-log", "reprot"], ["join-report-log", "leftJoin"], ["filter-disagreement", "row_rule"], ["filter-disagreement", "left_join"], ["filter-disagreement", "n"]]) {
    assert.equal(client.errorRecovery(move, undefinedName(name)), client.recoveryCopy(move), move + " " + name);
  }
});

test("move 1's placeholder line is followed by the neutral line, not the comma checklist", () => {
  const lead = nameLead("join-report-log", undefinedName("left_table"));
  assert.equal(lead, "left_table is a placeholder from the code shape, not a name in this case. Here the left table is report, the right table is handling_log, and the shared column is :tray_id.");
});

test("lines that name the move's own mistake still lead the move's recovery copy", () => {
  const leftJoin = client.errorRecovery("join-report-log", undefinedName("left_join"));
  assert.match(leftJoin, /^left_join is an R \(dplyr\) name/);
  assert.ok(leftJoin.endsWith(" " + client.recoveryCopy("join-report-log")));
  const noDot = client.errorRecovery("filter-disagreement", {status:"error", message:"Something went wrong running this line.\n\nArgumentError: invalid row index of type Bool"});
  assert.match(noDot, /one true or false/);
  assert.ok(noDot.endsWith(" " + client.recoveryCopy("filter-disagreement")));
  // Non-error results and unknown moves get no name-level line.
  assert.equal(client.errorRecovery("filter-disagreement", Object.assign(undefinedName("tray_id"), {status:"ok"})), client.recoveryCopy("filter-disagreement"));
  assert.equal(client.errorRecovery("no-such-move", undefinedName("tray_id")), client.recoveryCopy("no-such-move"));
});

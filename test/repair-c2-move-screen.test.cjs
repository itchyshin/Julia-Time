"use strict";

// Repair C2 (2026-09-24): UI-16 (move buttons stayed disabled after acceptance until Next was
// clicked), UI-17 (teaching copy pointed at a "build plan below" and a "named-input card" that
// do not exist), and the playtest C2-flow finding (the move screen did not say that each run
// starts fresh from jars and must end with the table to return).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter2.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", "web", file), "utf8");
const STEPS = ["group", "counts", "rates"];

test("UI-16: an accepted C2 move refreshes the move buttons at once, not only after Next", () => {
  const source = read("chapter2.js");
  const start = source.indexOf("if(result.status === \"ok\" && result.pass === true) {");
  const end = source.indexOf("if(state.evidence) {", start);
  assert.ok(start > -1 && end > start, "the accepted branch of handle() is present");
  const accepted = source.slice(start, end);
  const save = accepted.indexOf("saveProgress(storage,progress)");
  const refresh = accepted.indexOf("refreshMoveNav()");
  assert.ok(save > -1 && refresh > save, "the nav is refreshed after the accepted move is saved");
  assert.match(source, /function refreshMoveNav\(\)\s*\{[\s\S]*?b\.disabled\s*=\s*!canEnterStep\(progress,\s*b\.dataset\.step\)/);
  const setStep = source.slice(source.indexOf("function setStep("), source.indexOf("function updateControls("));
  assert.match(setStep, /refreshMoveNav\(\)/, "setStep still refreshes the nav through the same function");
  // The gating rule itself is unchanged: the saved acceptance is what opens the next move.
  assert.equal(client.canEnterStep({accepted:{group:"groupby(jars, :tray_id)"}}, "counts"), true);
  assert.equal(client.canEnterStep({accepted:{group:"groupby(jars, :tray_id)"}}, "rates"), false);
});

test("UI-17: C2 teaching copy only points at things that are on the page", () => {
  const html = read("chapter2.html");
  for (const step of STEPS) {
    const teaching = client.lessonCopy(step).teaching;
    assert.doesNotMatch(teaching, /build plan|named-input card|code shape/i, step);
  }
  const group = client.lessonCopy("group").teaching;
  assert.match(group, /Use these real names/);
  assert.match(html, /<p class="eyebrow">Use these real names<\/p>/);
});

test("C2 flow: the move screen says each run starts fresh from jars and must end with the table", () => {
  assert.equal(typeof client.freshRunNote, "function");
  for (const step of STEPS) {
    const note = client.freshRunNote(step);
    assert.match(note, /starts fresh from jars/i, step);
    assert.match(note, /last line/i, step);
    assert.match(note, /end with/i, step);
    assert.doesNotMatch(note, /—/, step + ": no em dash in new learner copy");
  }
  assert.match(client.freshRunNote("counts"), /groups again/i);
  assert.match(client.freshRunNote("rates"), /summary again/i);
  const html = read("chapter2.html");
  const returnBox = html.slice(html.indexOf('<p class="return"><strong>Return:</strong>'), html.indexOf('<details class="source-notebook"'));
  assert.match(returnBox, /id="fresh-run"/, "the note sits in the visible Return box, not in a closed panel");
  assert.doesNotMatch(returnBox, /<details/);
  assert.ok(returnBox.includes('<span id="fresh-run">' + client.freshRunNote("group") + "</span>"), "the first paint matches the group move's note");
  assert.match(read("chapter2.js"), /\$\("fresh-run"\)\.textContent\s*=\s*freshRunNote\(step\)/);
});

test("new C2 learner copy uses plain punctuation (no em dashes)", () => {
  // Only copy this repair wrote or rewrote; older rates teaching copy is left as it was.
  const copy = [client.groupingPreviewMessage(), client.lessonCopy("group").teaching, ...STEPS.flatMap(step => client.allHints(step))];
  const coaching = [
    {status:"error", step:"group", message:"UndefVarError: `tray_id` not defined"},
    {status:"error", step:"counts", message:"MethodError: no method matching iterate(::Symbol)"},
    {status:"error", step:"counts", message:"MethodError: no method matching combine(::DataFrames.GroupedDataFrame{DataFrames.DataFrame}; n::typeof(DataAPI.nrow))"},
    {status:"error", step:"counts", message:"MethodError: no method matching combine(::Pair{typeof(DataAPI.nrow), Symbol})"},
    {status:"error", step:"rates", message:"ArgumentError: It is only allowed to pass a vector as a column of a DataFrame."}
  ].map(client.c2ErrorNextStep);
  for (const text of [...copy, ...coaching, ...STEPS.map(step => client.hintButtonLabel(0, 3))]) {
    assert.doesNotMatch(text, /—/, text);
  }
});

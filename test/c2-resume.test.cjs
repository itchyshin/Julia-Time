"use strict";

// AI-student playtest (2026-09-25): after solving C2 step 1 (group) and reloading chapter2.html,
// the page (a) reopened on the story/intro screen instead of the investigation, and (b) opened on
// step 1 (already solved) rather than step 2 (the first unsolved step) even though the top
// progress bar correctly said "step 1 of 3 saved". Chapters 3 and 5 already resume at the first
// unsolved step (or the last step once all are solved); C2's `initialStep` did not, because with
// no step in the address it fell back to `progress.step` (the last step *visited*, not the first
// step still *unsolved*). This mirrors test/resume-unsolved-step.test.cjs for C3/C5.
const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter2.js");

test("C2 resumes at the first unsolved step, or the last when all are solved", () => {
  const empty = {step: "group", accepted: {}};
  assert.equal(client.initialStep(empty, ""), "group");

  const afterGroup = {step: "group", accepted: {group: "groupby(jars, :tray_id)"}};
  assert.equal(client.initialStep(afterGroup, ""), "counts");

  const afterCounts = {step: "group", accepted: {group: "groups", counts: "summary"}};
  assert.equal(client.initialStep(afterCounts, ""), "rates");

  const afterRates = {step: "group", accepted: {group: "groups", counts: "summary", rates: "summary.rate = ..."}};
  assert.equal(client.initialStep(afterRates, ""), "rates");
});

test("C2 initialStep: an explicit, reachable step in the address still wins", () => {
  const afterGroup = {step: "group", accepted: {group: "groupby(jars, :tray_id)"}};
  assert.equal(client.initialStep(afterGroup, "counts"), "counts");
  assert.equal(client.initialStep(afterGroup, "group"), "group");
});

test("C2 initialStep: rates never opens before counts is saved", () => {
  const empty = {step: "group", accepted: {}};
  assert.equal(client.initialStep(empty, "rates"), "group");
  const afterGroup = {step: "group", accepted: {group: "groupby(jars, :tray_id)"}};
  assert.equal(client.initialStep(afterGroup, "rates"), "counts");
});

test("C2 with saved progress in this browser is chapter work worth resuming", () => {
  assert.equal(typeof client.hasOwnChapterWork, "function");
  assert.equal(client.hasOwnChapterWork({step: "group", accepted: {}}), false);
  assert.equal(client.hasOwnChapterWork({step: "group", accepted: {group: "groupby(jars, :tray_id)"}}), true);
  assert.equal(client.hasOwnChapterWork(null), false);
});

test("C2's R/Python bridge card is only shown alongside a visible accepted result for that step", () => {
  assert.equal(typeof client.bridgeCardCode, "function");
  const progress = {step: "group", accepted: {group: "groupby(jars, :tray_id)"}};
  // Revisiting an already-solved step (no fresh run this session, no restored evidence for it):
  // C2 has no restore display for group/counts, so the card must not show unpaired.
  assert.equal(client.bridgeCardCode("group", progress, null, false), "");
  // Just after this step's own run is accepted, the result is visible on the page: card shows.
  assert.equal(client.bridgeCardCode("group", progress, null, true), "groupby(jars, :tray_id)");
  // rates is the one step whose accepted evidence is restored (labelled) after a reload, so its
  // card may pair with that restored evidence even without a fresh run this session.
  const allDone = {step: "rates", accepted: {group: "g", counts: "c", rates: "summary"}};
  assert.equal(client.bridgeCardCode("rates", allDone, {rows: []}, false), "summary");
  assert.equal(client.bridgeCardCode("rates", allDone, null, false), "");
});

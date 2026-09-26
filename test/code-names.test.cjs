"use strict";

// Owner playtest (2026-09-26): "make it bold all the objects ... these Julia objects to be typed in". Names a
// learner types (case_batch, sim_counts, :tray_id, jars.batch_id, .>=) are marked as code in the explanations.
// Only unmistakable code is marked, so ordinary words ("jars", "report") in sentences are left alone.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const names = require("../web/course/code-names.js");

test("finds the names a learner types, and nothing in plain prose", () => {
  const found = text => names.findNames(text).map(match => match.text);
  assert.deepEqual(found("Julia inputs: sim_counts and observed_count."), ["sim_counts", "observed_count"]);
  assert.deepEqual(found("Group by :tray_id, then read jars.batch_id."), [":tray_id", "jars.batch_id"]);
  assert.deepEqual(found("The dot in .>= compares; .& keeps both; .== and .!= too."), [".>=", ".&", ".==", ".!="]);
  assert.deepEqual(found("Read stories.lower and counts.detected_n."), ["stories.lower", "counts.detected_n"]);
  assert.deepEqual(found("Six jars in the report, e.g. tray T-A, 5 p.m."), []);
});

test("every chapter page loads the marker", () => {
  for (const page of ["index.html", "chapter2.html", "chapter3.html", "chapter4.html", "chapter5.html", "chapter6.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "../web", page), "utf8");
    assert.match(html, /<script defer src="course\/code-names\.js"><\/script>/, page);
  }
});

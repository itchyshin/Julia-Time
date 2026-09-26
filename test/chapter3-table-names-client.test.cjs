"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter3.js");

test("C3 puts each friendly table title beside the Julia name and join role", () => {
  assert.deepEqual(client.tableIdentity("tray_counts"), {
    name: "tray_counts",
    title: "Your counts from the notebook (Chapter 2)",
    role: "Left table: keep every tray"
  });
  assert.deepEqual(client.tableIdentity("tally_sheet"), {
    name: "tally_sheet",
    title: "The tally sheet the report was typed from",
    role: "Right table: add its matching sheet columns"
  });
});

test("C3 explains that move 2 starts from the lab's fresh copy of the joined table", () => {
  assert.deepEqual(client.tableIdentity("joined"), {
    name: "joined",
    title: "A fresh copy of the lined-up table",
    role: "The same as your step 1 result"
  });

  const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.match(source, /A fresh copy of the lined-up table, the same as your step 1 result/i);
  assert.doesNotMatch(source, /not your earlier output/i);
  assert.doesNotMatch(source, /Fresh joined table from the lab/);
});

test("C3 calls the optional exact expression an answer in the visible help control", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
  // 2026-09-26: every chapter's small hints sit inside the shared help panel, labelled
  // like Chapter 1's: small hints first, the full answer last.
  assert.match(html, /Stuck\? Hints <span>Small hints first, the full answer last\./);
  assert.match(html, /Show the full answer/);
});

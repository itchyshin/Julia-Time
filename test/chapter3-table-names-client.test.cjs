"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter3.js");

test("C3 puts each friendly table title beside the Julia name and join role", () => {
  assert.deepEqual(client.tableIdentity("report"), {
    name: "report",
    title: "Tray summary from Chapter 2",
    role: "Left table — keep every tray summary row"
  });
  assert.deepEqual(client.tableIdentity("handling_log"), {
    name: "handling_log",
    title: "Simulated handling log",
    role: "Right table — add its matching log fields"
  });
});

test("C3 explains that move 2 starts from the lab's fresh copy of the joined table", () => {
  assert.deepEqual(client.tableIdentity("joined"), {
    name: "joined",
    title: "Joined table for this move",
    role: "A fresh copy made by the lab; it matches the join you made in move 1"
  });

  const source = fs.readFileSync(path.join(__dirname, "../web/chapter3.js"), "utf8");
  assert.match(source, /starts from a fresh copy of the joined table, made by the lab/i);
  assert.doesNotMatch(source, /not your earlier output/i);
  assert.doesNotMatch(source, /Fresh joined table from the lab/);
});

test("C3 calls the optional exact expression an answer in the visible help control", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter3.html"), "utf8");
  assert.match(html, /Need the full answer\?/);
  assert.match(html, /Show the complete answer/);
});

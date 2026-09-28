"use strict";
// 2026-09-26 browser play: Momo said "The notebook says 6 jars with springtails" beside "5 of 6 B09 jars have
// springtails". Her count must be the jars WITH springtails in the learner's own result, not the rows returned.
const test = require("node:test");
const assert = require("node:assert/strict");
const c1 = require("../web/mystery.js");

test("Momo counts the jars with springtails, not the rows returned", () => {
  const trays = ["T-A", "T-A", "T-B", "T-B", "T-C", "T-C"];
  const rows = [true, true, true, true, true, false].map((detected, i) => ({jar_id:"J-09" + (i + 1), tray_id:trays[i], detected}));
  // 2026-09-27 consistency pass: the report only says T-C has 0, so Momo compares T-C with T-C.
  assert.equal(c1.momoReaction(rows), "Momo: “The report says T-C has 0 jars with springtails. The notebook shows springtails in 1 of T-C's 2 jars. One of them is wrong.”");
  assert.match(c1.momoReaction([{detected:true}]), /says 1 jar with springtails\./);
});

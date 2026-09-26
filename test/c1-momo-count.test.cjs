"use strict";
// 2026-09-26 browser play: Momo said "The notebook says 6 jars with fleas" beside "5 of 6 B09 jars have
// fleas". Her count must be the jars WITH fleas in the learner's own result, not the rows returned.
const test = require("node:test");
const assert = require("node:assert/strict");
const c1 = require("../web/mystery.js");

test("Momo counts the jars with fleas, not the rows returned", () => {
  const rows = [true, true, true, true, true, false].map((detected, i) => ({jar_id:"J-09" + (i + 1), detected}));
  assert.equal(c1.momoReaction(rows), "Momo: “The report says vanishing. The notebook says 5 jars with fleas. One of them is wrong.”");
  assert.match(c1.momoReaction([{detected:true}]), /says 1 jar with fleas\./);
});

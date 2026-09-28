// Rule 7: wording is never confusing. Runs tools/check-plain.cjs over everything a player reads
// (web/ text and learner-facing strings in src/mystery*.jl); a banned insider phrase fails the suite.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("no banned insider phrase in learner-facing text", () => {
  const root = path.join(__dirname, "..");
  const r = spawnSync(process.execPath, [path.join(root, "tools", "check-plain.cjs"), root], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

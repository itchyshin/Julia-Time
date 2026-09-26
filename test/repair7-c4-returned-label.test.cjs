"use strict";

// Repair 7 (orchestrator browser check, 2026-09-26): the returned-result table in C4 read "Julia
// name: returned: returned by Julia.", a garbled concatenation. Other chapters (e.g. C3,
// web/chapter3.js:655) label a returned result plainly: "Returned by Julia from your code."
const test = require("node:test");
const assert = require("node:assert/strict");

test("the returned-result table's label reads plainly, not 'Julia name: returned: returned by Julia.'", () => {
  const source = require("fs").readFileSync(require.resolve("../web/chapter4.js"), "utf8");
  assert.doesNotMatch(source, /Julia name: .*returned by Julia/s);
  assert.match(source, /Returned by Julia from your code\./);
});

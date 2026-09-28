// Replay notes and re-review (2026-09-27): a timed-out run shows the outcome line "Not yet. Your code
// took too long, so the lab stopped it. Your code is still here." (runOutcomeStatus) and then the
// timeout message in the same result block. That message used to say "Your code/draft is still here"
// a second time. It now says it once, in the outcome line only, on all six chapters.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const FILES = ["web/mystery.js", "web/chapter2.js", "web/chapter3.js", "web/chapter4.js", "web/chapter5.js", "web/chapter6.js"];

for (const file of FILES) {
  test(`${file}: the timeout message does not repeat "still here" after the outcome line`, () => {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /This check took too long\. Your (code|draft) is still here/);
    assert.match(source, /This check took too long\. Check your code, then run again\./);
    assert.match(source, /Your code took too long, so the lab stopped it\. Your code is still here\./);
  });
}

"use strict";

// Repair C2 (2026-09-24), UI-09 and the playtest hint-ladder finding: the first C2 hint button
// said "Show the code shape" but revealed a prose plan, "Show a first nudge" came second, the
// exhausted button stayed clickable, and the first hints for counts and rates did not name the
// operator behind the move's most common error (=> pairs; ./).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter2.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", "web", file), "utf8");
const STEPS = ["group", "counts", "rates"];

test("C2 hint labels start with the smallest help, never promise a code shape, and end plainly", () => {
  assert.equal(typeof client.hintButtonLabel, "function");
  for (const step of STEPS) {
    const total = client.allHints(step).length;
    assert.equal(total, 3, step + " keeps three staged hints");
    const labels = Array.from({length: total + 1}, (_, shown) => client.hintButtonLabel(shown, total));
    assert.deepEqual(labels, ["Show a first nudge", "Show the next hint", "Show the last hint", "All hints shown"]);
    assert.ok(labels.every(label => !/code shape/i.test(label)), step + ": no label calls a prose plan a code shape");
  }
  assert.match(read("chapter2.html"), /<button id="show-hint" type="button">Show a first nudge<\/button>/, "the static first paint matches the script's first label");
});

test("C2 disables the hint button once every hint is shown and re-enables it on a new move", () => {
  const source = read("chapter2.js");
  assert.match(source, /el\.hint\.disabled\s*=\s*hints\s*>=\s*list\.length/);
  assert.match(source, /el\.hint\.textContent\s*=\s*hintButtonLabel\(hints,\s*list\.length\)/);
  assert.match(source, /el\.hint\.textContent\s*=\s*hintButtonLabel\(0,\s*allHints\(step\)\.length\);\s*el\.hint\.disabled\s*=\s*false/);
  assert.doesNotMatch(source, /"Show the code shape"/);
  assert.match(read("chapter2.css"), /#show-hint:disabled\s*\{[^}]*cursor:\s*not-allowed/, "an exhausted hint button looks unavailable");
});

test("C2's first hint names the operator behind each summary move's common error", () => {
  const countsFirst = client.allHints("counts")[0];
  assert.match(countsFirst, /combine/);
  assert.match(countsFirst, /pairs/i);
  assert.match(countsFirst, /nrow => :n/);
  assert.match(countsFirst, /:detected => sum => :detected_n/);
  const ratesFirst = client.allHints("rates")[0];
  assert.match(ratesFirst, /\.\//);
  assert.match(ratesFirst, /dot/i);
  assert.equal(client.allHints("group")[0], client.lessonCopy("group").shape, "the plan stays the first staged hint");
});

test("C2 rates hints no longer diagnose a stale-summary mistake the learner has not made", () => {
  assert.ok(client.allHints("rates").every(hint => !/not with a previously named summary/i.test(hint)));
});

test("C2 hints never print a reference-answer line; the full script stays behind the answer button", () => {
  for (const step of STEPS) {
    const answerLines = client.lessonCopy(step).answerCode.split("\n").map(line => line.trim()).filter(line => line.length > 12);
    for (const hint of client.allHints(step)) {
      for (const line of answerLines) assert.ok(!hint.includes(line), step + " hint prints the answer line " + line);
    }
  }
});

test("C2's rehearsal message points at help that exists on the page, not a code shape", () => {
  const message = client.groupingPreviewMessage();
  assert.doesNotMatch(message, /code shape/i);
  assert.match(message, /example/i);
  assert.match(read("chapter2.html"), /id="groupby-worked-example"/);
});

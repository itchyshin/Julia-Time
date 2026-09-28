// Round 7 fixes (M2, 2026-09-28) for Chapters 2 to 6. Reports: night/r7-bugs.md #2-#9 and
// night/r7-r-struggling.md #6 and #8.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", "web", file), "utf8");
const c2 = require("../web/chapter2.js");
const c3 = require("../web/chapter3.js");
const c5 = require("../web/chapter5.js");

const STOPPED_END = " Change your code, then run again, or open Stuck? Hints below.";
const FINISHED_END = " Your draft is still here. Change it and run again, or open Stuck? Hints below.";

test("C6: the ending link beside Run stays once the case can close, after a run too (r7-bugs #2)", () => {
  const js = read("chapter6.js");
  assert.match(js, /el\.solvedEnding\.hidden = !endingUrl;/);
  assert.doesNotMatch(js, /el\.solvedEnding\.hidden = [^;]*querySelector/);
});

test("C4 and C5: the next-chapter button sits beside Run (r7-bugs #3)", () => {
  assert.match(read("chapter4.html"), /<div class="controls"><button id="run" class="run" type="button" disabled>Run this step →<\/button><button id="next-move" class="quiet next" type="button" hidden>Chapter 5: what would plain chance give\? →<\/button><\/div>/);
  assert.match(read("chapter5.html"), /<div class="controls run-row"><button id="run" class="run" type="button" disabled>Run this step →<\/button><button id="next" class="quiet next" type="button" hidden><\/button><\/div>/);
  for (const file of ["chapter4.html", "chapter5.html"]) assert.equal((read(file).match(/id="next(?:-move)?"/g) || []).length, 1, file);
});

test("C5: 'Julia returned' shows Julia's own display when the server sends it (r7-bugs #4, #5)", () => {
  const pair = {kind:"event-frequency", length:1000, matching:113, trials:1000, frequency:0.113, preview:[false, true],
    returned:"(events = Bool[0, 0, 1, 1, 0, 0, 0, 0, 0, 0  …  0, 1], frequency = 113//1000)"};
  assert.equal(c5.splitJuliaReturned(c5.juliaReturnedText(pair)).returned, pair.returned);
  const mask = {kind:"boolean-vector", length:1000, true_count:113, preview:[false, true], returned:"Bool[0, 0, 1  …  0, 1]"};
  assert.equal(c5.splitJuliaReturned(c5.juliaReturnedText(mask)).returned, "Bool[0, 0, 1  …  0, 1]");
  const number = {kind:"frequency-number", matching:113, trials:1000, frequency:0.113, returned:"113//1000"};
  assert.equal(c5.splitJuliaReturned(c5.juliaReturnedText(number)).returned, "113//1000");
  // An older server without "returned": the page's own display, as before.
  const older = Object.assign({}, pair); delete older.returned;
  assert.match(c5.juliaReturnedText(older), /^\(events = Bool\[0, 1, …\], frequency = 0\.113\)/);
  const olderMask = Object.assign({}, mask); delete olderMask.returned;
  assert.equal(c5.splitJuliaReturned(c5.juliaReturnedText(olderMask)).returned, "Bool[0, 1, …]");
});

test("C3: 'Not yet … Your code is still here' is said once, not also under the editor (r7-bugs #6)", () => {
  for (const message of [{status:"error", pass:false}, {status:"ok", pass:false}]) {
    const draft = c3.draftStatus(message), outcome = c3.runOutcomeStatus(message);
    assert.match(outcome, /^Not yet\./);
    assert.doesNotMatch(draft, /Not yet/);
    assert.equal(draft, "This is your code from the last run.");
  }
  assert.doesNotMatch(c3.draftStatus({status:"timeout"}), /Not yet/);
});

test("C2: the restored-draft note goes on the first edit and on Run (r7-bugs #7)", () => {
  const js = read("chapter2.js");
  assert.match(js, /el\.code\.addEventListener\("input", \(\) => \{ clearRunTimer\(\); clearRestoredDraftNote\(\);/);
  assert.match(js, /el\.run\.addEventListener\("click", \(\) => \{ if\(el\.run\.disabled \|\| isRunPending\(state\)\) return; clearRestoredDraftNote\(\);/);
});

test("C3 phone: the returned table's cells take less side padding (r7-bugs #8)", () => {
  assert.match(read("chapter3.css"), /@media \(max-width: 520px\) \{ \.result \.table-wrap th, \.result \.table-wrap td \{ padding: \.25rem \.2rem; \} \}/);
});

test("C2: coaching lines end the way C1 and C3 to C6 do (r7-bugs #9)", () => {
  const len = {status:"error", pass:false, step:"group", message:"x", coaching:"Julia has no len: use length for a list or nrow for a table."};
  assert.equal(c2.resultText(len), len.coaching + STOPPED_END);
  const finished = {status:"ok", pass:false, step:"counts", coaching:"Return exactly these columns: tray_id, n, detected_n."};
  assert.equal(c2.resultText(finished), finished.coaching + FINISHED_END);
  const groupBy = {status:"error", pass:false, step:"group", message:"UndefVarError: `group_by` not defined"};
  assert.ok(c2.resultText(groupBy).endsWith(STOPPED_END));
  assert.equal((c2.resultText(groupBy).match(/Hints below/g) || []).length, 1);
});

test("C3: 'Show the whole line' says the answer is above the editor (r7-r-struggling #6)", () => {
  assert.match(read("chapter3.js"), /pointer\.textContent = "The complete runnable answer is shown above your editor\."; el\.help\.append\(pointer\);/);
});

test("C3 and C5 drop fixed advice when a specific line is present (r7-r-struggling #8)", () => {
  const leftJoin = {status:"error", pass:false, message:"UndefVarError: `left_join` not defined"};
  const text = c3.errorRecovery("join-report-log", leftJoin);
  assert.match(text, /^left_join is an R \(dplyr\) name/);
  assert.doesNotMatch(text, /comma/);
  assert.ok(text.endsWith(STOPPED_END));
  // With nothing specific, the move's own recovery copy still shows.
  assert.equal(c3.errorRecovery("join-report-log", {status:"error", message:"something else"}), c3.recoveryCopy("join-report-log"));
  // C5: a server line for one number replaces the fixed "did not meet the stated check".
  const number = {status:"ok", pass:false, value_repr:"0.5", feedback:"Divide the rounds that matched by all 1,000 rounds."};
  const c5text = c5.challengeRecovery("event-frequency", number, null);
  assert.equal(c5text, number.feedback + FINISHED_END);
  // With nothing specific, the stated-check line still shows.
  assert.match(c5.challengeRecovery("event-frequency", {status:"ok", pass:false, value_repr:"0.5"}, null), /did not meet the stated check/);
});

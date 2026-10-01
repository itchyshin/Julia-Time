"use strict";

// Round 8 fixer N3 (2026-09-28): C1 and Case Board leftovers from the rc8 test and the round-8 audit.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mystery = require("../web/mystery.js");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("C1 solved: a Chapter 2 link sits beside Run, as in C2 to C6", () => {
  const html = read("web/index.html");
  const controls = html.slice(html.indexOf('<button id="run"'), html.indexOf('id="result-area"'));
  assert.match(controls, /<a id="next-chapter"[^>]*hidden[^>]*>Chapter 2: count by tray →<\/a>/);
  const js = read("web/mystery.js");
  const evidence = js.slice(js.indexOf("function renderEvidence("), js.indexOf("el.code.addEventListener(\"input\""));
  assert.match(evidence, /\$\("next-chapter"\)\.hidden = false/);
  assert.match(evidence, /chapter-two-link/, "the evidence board keeps its own link too");
});

test("C1 accepted table: headers break after underscores and shrink on a phone", () => {
  const js = read("web/mystery.js");
  assert.match(js, /createElement\("wbr"\)/);
  assert.match(read("web/mystery.css"), /@media \(max-width: 520px\) \{[^}]*\.returned-table-wrap/);
});

test("C1 full-answer label and practice button use the round-8 wording", () => {
  const js = read("web/mystery.js");
  assert.match(js, /Reference code answer: type or paste it into your editor and press Run this step to see what Julia returns\. It does not count as a saved answer until Julia checks it\./);
  assert.match(read("web/index.html"), /<button id="practice-run" class="run-button" disabled>Run this practice<\/button>/);
  assert.doesNotMatch(read("web/index.html"), /Run this experiment/);
});

// Live server replies on 2026-09-28 (http://127.0.0.1:9620, Julia 1.10.0).
const B08_LINE = "These are the B08 jars. Keep each row whose batch_id matches case_batch, which is B09.";
const RUN_LINE = "Pick the rows by their batch label, not by where they sit: keep each row whose batch_id matches case_batch.";
const rows = (batches, start) => batches.map((batch_id, i) => ({jar_id:"J-" + (start + i), batch_id}));
const INFO = {case_batch:"B09", worked_example:{batch_id:"B08"}, rows:rows(["B08","B08","B08","B08","B08","B08","B09","B09","B09","B09","B09","B09"], 1)};

test("C1 wrong batch: the page does not repeat what the server's line already says", () => {
  const b08 = {status:"ok", pass:false, feedback:B08_LINE, rows:INFO.rows.slice(0, 6)};
  assert.equal(mystery.returnedRowsLead(b08, INFO), "");
  const slice = {status:"ok", pass:false, feedback:RUN_LINE, rows:INFO.rows.slice(3, 9)};
  const lead = mystery.returnedRowsLead(slice, INFO);
  assert.match(lead, /rows 4 to 9/);
  assert.doesNotMatch(lead, /not by where they sit/);
  // A reply without that server line (three B08 rows: a row-count line) keeps the page's full lead.
  const three = {status:"ok", pass:false, feedback:"We need all 6 B09 jars, each once; you returned 3 rows.", rows:INFO.rows.slice(0, 3)};
  assert.match(mystery.returnedRowsLead(three, INFO), /practice batch/);
});

test("the optional speed lab has one name on the course pages and the finale", () => {
  for (const file of ["web/course/index.html", "web/course/ending.html", "web/course/getting-started.html", "web/course/speed-lab.html"]) {
    assert.doesNotMatch(read(file), /laboratory|Bootstrap comparison/, file);
  }
  assert.match(read("web/course/index.html"), />Open the speed lab</);
  assert.match(read("web/course/ending.html"), />Optional: open the speed lab →</);
});

test("closed case: no 'Before you play:' reminder, and one C5 'true counts as 1' bullet", () => {
  // Round 2 (P01): the "Before you play" aside repeated the Julia warning; the one status line under the main button replaces it.
  assert.doesNotMatch(read("web/course/index.html"), /Before you play/);
  assert.doesNotMatch(read("web/course/course-board.js"), /setup-reminder/);
  const bridges = require("../web/course/bridges.js");
  const card = (bridges.BRIDGES || bridges.bridges || bridges)["C5/event-frequency"];
  const same = card.differences.filter(line => /true counts as 1/i.test(line));
  assert.equal(same.length, 1, card.differences.join(" | "));
});

test("phone layout: the speed-lab link keeps one border when it wraps; credits lines do not start with a dot", () => {
  assert.match(read("web/course/course.css"), /#speed-lab-link \{[^}]*display:inline-block/);
  assert.match(read("web/course/ending.css"), /@media \(max-width: 520px\) \{[^}]*\.credits li \{ display:block; \}[^}]*\.credits li \+ li::before \{ content:none; \}/);
});

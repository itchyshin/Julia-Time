"use strict";

// Repair 6 (2026-09-24 real-browser check): in Chapter 2 the "Your returned evidence" placeholder
// ("... appear here when you run a move.") stayed on screen beside an accepted result, and in
// Chapter 3 move 2 the learner read developer words: "the same canonical comparison table",
// "so the browser never becomes checker truth", "The lab’s regenerated copy of the table your
// accepted join matched".
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const chapter3 = require("../web/chapter3.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Chapter 2 hides the returned-evidence placeholder once a result is drawn, and shows it again on a fresh move", () => {
  const html = read("web/chapter2.html");
  assert.match(html, /<p id="returned-empty">Your Julia result and tray rack appear here when you run a move\.<\/p>/,
    "the placeholder has an id the script can hide");
  const source = read("web/chapter2.js");
  assert.match(source, /returnedEmpty:\$\("returned-empty"\)/, "the script holds the placeholder element");
  const handle = source.slice(source.indexOf("function handle(message)"), source.indexOf("function focusResult()"));
  const sync = handle.indexOf("el.returnedEmpty.hidden = el.rows.childElementCount > 0 || el.liveRack.childElementCount > 0;");
  assert.ok(sync > -1, "handle() hides the placeholder whenever a returned table or rack is on screen");
  assert.ok(sync > handle.indexOf("renderTable(result.rows,result.columns,el.rows,result.row_text)"), "after the returned table is drawn");
  assert.ok(sync > handle.indexOf("renderRack(result.step,result.rows,el.liveRack,result.row_text)"), "after the returned rack is drawn");
  const setStep = source.slice(source.indexOf("function setStep("), source.indexOf("function updateControls("));
  assert.match(setStep, /el\.rows\.replaceChildren\(\); el\.liveRack\.replaceChildren\(\); el\.returnedEmpty\.hidden = false;/,
    "a new move clears the returned panel and brings the placeholder back");
});

const JARGON = /canonical|checker|truth|regenerat|browser never|independently/i;

function moveTwoNote() {
  const source = read("web/chapter3.js");
  const match = source.match(/"tray_id names the same tray in both tables; every tray ID occurs once in each table\." : "([^"]*)"/);
  assert.ok(match, "the move 2 note under 'Evidence in hand' is present");
  return match[1];
}

test("Chapter 3 move 2 explains the fresh joined table in plain words", () => {
  const identity = chapter3.tableIdentity("joined");
  const bridge = chapter3.lessonCopy("filter-disagreement").bridge;
  const note = moveTwoNote();
  for (const text of [identity.title, identity.role, bridge, note]) {
    assert.doesNotMatch(text, JARGON, text);
    assert.doesNotMatch(text, /—/, "no em dash in new learner-facing text: " + text);
  }
  assert.equal(identity.title, "Joined table for this move");
  assert.equal(identity.role, "A fresh copy made by the lab; it matches the join you made in move 1");
  for (const text of [bridge, note]) {
    assert.match(text, /fresh copy/, text);
    assert.match(text, /move 1/, text);
    assert.match(text, /does not use your earlier result to check this move/, text);
  }
  assert.match(bridge, /use a Boolean rule to keep the row where the two count columns are not equal\.$/i,
    "the instruction for the move is unchanged");
  assert.match(note, /It has the columns you need for the next rule\.$/, "the pointer to the columns is unchanged");
});

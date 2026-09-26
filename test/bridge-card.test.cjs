"use strict";

// "The same move in R and Python" (2026-09-25): unit tests for the shared bridges module
// (web/course/bridges.js) and for each chapter's wiring of the post-acceptance bridge card.
// See test/bridge-parity.test.cjs for the R/Python line-by-line correctness check against the
// live Julia reference, and test/move-first-c1..c4.test.cjs for the removal of the old scattered
// R/Python blocks this card replaces.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const bridges = require(path.join(root, "web", "course", "bridges.js"));
const courseState = require(path.join(root, "web", "course", "course-state.js"));

const MOVE_KEYS = [
  "C1/select-records", "C2/group", "C2/counts", "C2/rates",
  "C3/join-report-log", "C3/filter-disagreement", "C4/plan-distinct-recheck",
  "C5/event-mask", "C5/event-frequency", "C6/compatible-models"
];

test("bridges.js has exactly the ten case moves, keyed the same way as course-state.js's KNOWN_MOVES", () => {
  assert.deepEqual(Object.keys(bridges.BRIDGES).sort(), MOVE_KEYS.sort());
  assert.deepEqual(Object.keys(bridges.BRIDGES).sort(), courseState.KNOWN_MOVES.map(move => move.key).sort());
  MOVE_KEYS.forEach(key => assert.equal(bridges.knownMove(key), true, key + " is known"));
  assert.equal(bridges.knownMove("C4/select-eligible"), false, "a retired move key is not a bridge");
  assert.equal(bridges.knownMove("C7/does-not-exist"), false);
});

test("every bridge has a non-empty R line, Python line, a lead line, and at least two differences", () => {
  MOVE_KEYS.forEach(key => {
    const entry = bridges.bridgeFor(key);
    assert.ok(entry, key);
    assert.equal(typeof entry.r, "string");
    assert.ok(entry.r.length > 0, key + " has an R line");
    assert.equal(typeof entry.python, "string");
    assert.ok(entry.python.length > 0, key + " has a Python line");
    assert.equal(typeof entry.lead, "string");
    assert.ok(entry.lead.length > 0, key + " has a lead line");
    assert.match(entry.lead, /trips R users/, key + " lead names the R trap");
    assert.ok(Array.isArray(entry.differences) && entry.differences.length >= 2, key + " has at least two differences");
  });
});

test("bridges.js uses the case's real variable names, not generic placeholders", () => {
  const realNames = {
    "C1/select-records": ["jars", "case_batch"],
    "C2/group": ["jars", "tray_id"],
    "C2/counts": ["jars", "detected", "tray_id"],
    "C2/rates": ["jars", "detected_n"],
    "C3/join-report-log": ["tray_counts", "tally_sheet", "tray_id"],
    "C3/filter-disagreement": ["joined", "notebook_detected", "sheet_detected"],
    "C4/plan-distinct-recheck": ["eligible"],
    "C5/event-mask": ["sim_counts", "observed_count"],
    "C5/event-frequency": ["sim_counts", "observed_count"],
    "C6/compatible-models": ["stories", "observed_count"]
  };
  Object.entries(realNames).forEach(([key, names]) => {
    const entry = bridges.bridgeFor(key);
    names.forEach(name => {
      assert.ok(entry.r.includes(name) || entry.python.includes(name), key + " should name " + name + " somewhere in its R or Python line");
    });
  });
  // Placeholders used by the old scattered blocks must not leak into the shared bridges.
  const placeholders = ["left_table", "right_table", "shared_column", "left_count", "right_count", "table.batch_id"];
  MOVE_KEYS.forEach(key => {
    const entry = bridges.bridgeFor(key);
    placeholders.forEach(placeholder => {
      assert.doesNotMatch(entry.r, new RegExp(placeholder.replace(".", "\\.")), key + " r line has no placeholder " + placeholder);
      assert.doesNotMatch(entry.python, new RegExp(placeholder.replace(".", "\\.")), key + " python line has no placeholder " + placeholder);
    });
  });
});

test("buildCard returns null for an unknown move or missing/blank learner code (no fabricated card)", () => {
  assert.equal(bridges.buildCard("C1/select-records", ""), null);
  assert.equal(bridges.buildCard("C1/select-records", "   "), null);
  assert.equal(bridges.buildCard("C1/select-records", undefined), null);
  assert.equal(bridges.buildCard("C1/select-records", null), null);
  assert.equal(bridges.buildCard("not-a-real-move", "jars[jars.batch_id .== case_batch, :]"), null);
});

test("buildCard shows the learner's own accepted code, never the reference solution", () => {
  const learner = "jars[jars.batch_id .== case_batch, :]"; // deliberately not identical to any reference text
  const card = bridges.buildCard("C1/select-records", learner);
  assert.ok(card);
  assert.equal(card.julia, learner);
  const entry = bridges.bridgeFor("C1/select-records");
  assert.equal(card.r, entry.r);
  assert.equal(card.python, entry.python);
  assert.deepEqual(card.differences, entry.differences);
});

// ---- renderCard: a tiny fake DOM, since this repo has no jsdom dependency (see chapter*.js's own
// document-guarded pattern). MockElement implements only what renderCard actually uses.
class MockElement {
  constructor(tag) { this.tagName = tag; this.children = []; this.hidden = false; this._text = ""; }
  set textContent(value) { this._text = value; this.children = []; }
  get textContent() { return this._text; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this._text = ""; }
}
const fakeDocument = { createElement: tag => new MockElement(tag) };

function flatten(node, out) {
  out.push(node);
  (node.children || []).forEach(child => flatten(child, out));
  return out;
}

test("renderCard hides and empties the container when no accepted code is supplied", () => {
  const container = new MockElement("section");
  container.hidden = false;
  container.append(new MockElement("p"));
  const rendered = bridges.renderCard(container, "C2/rates", "", fakeDocument);
  assert.equal(rendered, false);
  assert.equal(container.hidden, true);
  assert.deepEqual(container.children, []);
});

test("renderCard hides the container for an unknown move even with code present", () => {
  const container = new MockElement("section");
  const rendered = bridges.renderCard(container, "C9/not-a-move", "some code", fakeDocument);
  assert.equal(rendered, false);
  assert.equal(container.hidden, true);
});

test("renderCard shows exactly the learner's own code plus the R and Python lines and differences", () => {
  const container = new MockElement("section");
  const learner = "combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)";
  const rendered = bridges.renderCard(container, "C2/counts", learner, fakeDocument);
  assert.equal(rendered, true);
  assert.equal(container.hidden, false);
  const all = flatten(container, []);
  const preTexts = all.filter(node => node.tagName === "pre").map(node => node.textContent);
  const entry = bridges.bridgeFor("C2/counts");
  assert.deepEqual(preTexts, [learner, entry.r, entry.python], "Your Julia, then R, then Python, in that order");
  const listItems = all.filter(node => node.tagName === "li").map(node => node.textContent);
  assert.deepEqual(listItems, entry.differences);
  const heading = all.find(node => node.tagName === "h2");
  assert.equal(heading.textContent, "The same step in R and Python");
  const leadPara = all.find(node => node.tagName === "p");
  assert.equal(leadPara.textContent, entry.lead, "the lead line is the first thing shown, before Your Julia");
});

test("renderCard replaces a previous card rather than appending a second one", () => {
  const container = new MockElement("section");
  bridges.renderCard(container, "C6/compatible-models", "stories[stories.lower .<= observed_count, :]", fakeDocument);
  bridges.renderCard(container, "C6/compatible-models", "stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]", fakeDocument);
  const preTexts = flatten(container, []).filter(node => node.tagName === "pre").map(node => node.textContent);
  assert.equal(preTexts[0], "stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]");
  assert.equal(preTexts.filter(text => text.startsWith("stories[")).length, 1, "only the latest learner code is shown, not a history");
});

test("bridges.js never touches the DOM itself: it only builds nodes for the container it is given", () => {
  const source = fs.readFileSync(path.join(root, "web", "course", "bridges.js"), "utf8");
  assert.doesNotMatch(source, /getElementById/);
  assert.doesNotMatch(source, /querySelector/);
});

// ---- Per-chapter wiring: exactly one comparison place per chapter, and the card is driven by a
// captured "accepted code" value (never the reference solution) inside an accepted-only branch.
const CHAPTERS = [
  {html: "index.html", js: "mystery.js"},
  {html: "chapter2.html", js: "chapter2.js"},
  {html: "chapter3.html", js: "chapter3.js"},
  {html: "chapter4.html", js: "chapter4.js"},
  {html: "chapter5.html", js: "chapter5.js"},
  {html: "chapter6.html", js: "chapter6.js"}
];

test("every chapter's HTML has exactly one #bridge-card, and loads course/bridges.js", () => {
  CHAPTERS.forEach(({html, js}) => {
    const text = fs.readFileSync(path.join(root, "web", html), "utf8");
    assert.equal((text.match(/id="bridge-card"/g) || []).length, 1, html + " has exactly one bridge card");
    assert.match(text, /src="course\/bridges\.js"/, html + " loads the shared bridges module");
  });
});

test("every chapter's JS calls bridges.renderCard, and never with a literal reference/solution string", () => {
  CHAPTERS.forEach(({js}) => {
    const source = fs.readFileSync(path.join(root, "web", js), "utf8");
    assert.match(source, /bridges\.renderCard\(/, js + " calls renderCard");
    // A reference/solution constant would show the taught answer, not the learner's own code
    // (AGENTS.md: reference answers never enter the learner's editor; by the same principle they
    // must never masquerade as "Your Julia" in this card either).
    assert.doesNotMatch(source, /renderCard\([^;]*\.solution/s, js + " never renders COPY.solution as the learner's code");
    assert.doesNotMatch(source, /renderCard\([^;]*el\.code\.value/s, js + " never renders the live (possibly since-edited) editor value directly; it must use a captured accepted-code value");
  });
});

test("C1 (mystery.js) only shows the bridge card from inside renderEvidence, which fires only on an accepted result", () => {
  const source = fs.readFileSync(path.join(root, "web", "mystery.js"), "utf8");
  assert.match(source, /function renderEvidence\(evidence, rows, explanation, restored = false, submittedCode = ""\) \{\s*acceptedRows = rows; highlightSource\(\);\s*if \(bridges\) bridges\.renderCard\(el\["bridge-card"\], "C1\/select-records", restored \? "" : submittedCode\);/);
});

test("C2 (chapter2.js) keys the bridge card by the accepted step and reads only progress.accepted, never a run in progress", () => {
  const source = fs.readFileSync(path.join(root, "web", "chapter2.js"), "utf8");
  assert.match(source, /function renderBridgeCard\(step\) \{ if \(bridges\) bridges\.renderCard\(el\.bridgeCard, "C2\/"\+step, typeof progress\.accepted\[step\] === "string" \? progress\.accepted\[step\] : ""\); \}/);
});

test("C3 (chapter3.js) tracks acceptedCode separately from the ephemeral submittedCode, so a later failed resubmit can't leak into the card", () => {
  const source = fs.readFileSync(path.join(root, "web", "chapter3.js"), "utf8");
  assert.match(source, /const acceptedCode = Object\.create\(null\);/);
  assert.match(source, /acceptedCode\[state\.result\.move_id\] = submittedCode\[state\.result\.move_id\] \|\| "";/);
  assert.match(source, /bridges\.renderCard\(el\.bridgeCard, "C3\/"\+state\.activeMove, acceptedCode\[state\.activeMove\] \|\| ""\);/);
});

test("C4 (chapter4.js) shows the card only inside the accepted case_result branch", () => {
  const source = fs.readFileSync(path.join(root, "web", "chapter4.js"), "utf8");
  assert.match(source, /isAcceptedChallengeResult\(state\.result\)\) \{ persistAcceptedCourseResult\(courseState, storage, attempt, state\.result\); saveOk = savedMove\(courseState, storage, attempt, CHAPTER, MOVE\); if \(bridges\) bridges\.renderCard\(el\.bridgeCard, "C4\/"\+MOVE, submittedCode\); \}/);
});

test("C5 (chapter5.js) tracks acceptedCode separately from submittedCode, gated on a genuinely new accepted destination", () => {
  const source = fs.readFileSync(path.join(root, "web", "chapter5.js"), "utf8");
  assert.match(source, /acceptedCode=Object\.create\(null\)/);
  assert.match(source, /if\(destination\)\{persistAccepted\(message\);saveOk=savedMove\(course,storage,attempt,CHAPTER,message\.move_id\);acceptedCode\[message\.move_id\]=submittedCode\[message\.move_id\] \|\| "";\}/);
  assert.match(source, /bridges\.renderCard\(el\.bridgeCard,"C5\/"\+state\.activeMove,acceptedCode\[state\.activeMove\] \|\| ""\)/);
});

test("C6 (chapter6.js) gates the card on state.evidence, which chapter6's own applyCaseResult clears on any non-accepted rerun", () => {
  const source = fs.readFileSync(path.join(root, "web", "chapter6.js"), "utf8");
  assert.match(source, /evidence: accepted \? \{ move_id: MOVE, result_data: message\.result_data \} : null/);
  assert.match(source, /bridges\.renderCard\(el\.bridgeCard, "C6\/"\+MOVE, state\.evidence \? submittedCode : ""\);/);
});

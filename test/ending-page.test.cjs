"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

test("ending.html loads its scripts in order and has every element ending.js fills", () => {
  const html = read("web/course/ending.html");
  const order = ["course-state.js", "legacy-import.js", "course-client.js", "ending-script.js", "ending.js"].map(file => html.indexOf('src="' + file + '"'));
  assert.ok(order.every(at => at > 0), "all five scripts are loaded");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  for (const id of ["ending-status", "ending-locked", "ending-open", "ending-movie", "ending-stage", "ending-back", "ending-toggle",
    "ending-next", "ending-skip", "ending-progress", "ending-all", "ending-all-list", "ending-finale", "ending-stamp", "ending-headline",
    "ending-reveal", "ending-final-line", "ending-pun", "ending-still-open", "ending-well-done", "ending-final-image", "ending-credits",
    "credits-investigators", "credits-featuring-label", "credits-featuring", "credits-concepts", "credits-data", "ending-print",
    "ending-replay", "ending-speed-lab"]) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(html, /href="ending\.css"/);
});

test("every picture the ending uses is shipped", () => {
  const ending = require("../web/course/ending.js");
  for (const src of Object.values(ending.IMAGES)) assert.ok(fs.existsSync(path.join(root, "web", "course", src)), src);
});

// "chapter" holds structural identifiers (C1..C6, used to key scenes to images and saved code), not
// learner-facing prose; the digit rule (docs/design/03-ending.md) is about dialogue and captions.
function withoutChapterKeys(value) {
  if (Array.isArray(value)) return value.map(withoutChapterKeys);
  if (value && typeof value === "object") {
    const copy = {};
    for (const [key, item] of Object.entries(value)) if (key !== "chapter") copy[key] = withoutChapterKeys(item);
    return copy;
  }
  return value;
}

test("the words carry no digits and no em dashes: numbers come only from the server", () => {
  const words = JSON.stringify(withoutChapterKeys(require("../web/course/ending-script.js")));
  assert.doesNotMatch(words, /[0-9]/);
  assert.doesNotMatch(words, /—/);
  for (const file of ["web/course/ending.html", "web/course/ending.js"]) assert.doesNotMatch(read(file), /—/, file);
});

test("ending.js writes no case fact by hand", () => {
  const src = read("web/course/ending.js");
  for (const literal of ["B09", "T-A", "T-B", "T-C", "J-09", "113", "1,000", "0.1", "0.5", "0.8", "left blank", "filled in"]) assert.ok(!src.includes(literal), literal);
});

test("reduced motion and print both show every scene and the finale without animation", () => {
  const css = read("web/course/ending.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print/);
  const src = read("web/course/ending.js");
  assert.match(src, /prefers-reduced-motion: reduce/);
});

const MILESTONES = ["C1/select-records", "C2/rates", "C3/filter-disagreement", "C4/plan-distinct-recheck", "C5/event-frequency", "C6/compatible-models"];

test("the Case Board's main action opens the ending once the case is complete, keeping the attempt", () => {
  const client = require("../web/course/course-client.js");
  assert.equal(client.endingDestination("fresh-1"), "ending.html?attempt=fresh-1");
  assert.equal(client.endingDestination(""), "ending.html");
  assert.equal(client.endingDestination("Bad Id!"), "ending.html");
  // 0.5: the walk in course-client.js ends at the ending once every lesson and chapter is done.
  const clientSrc = read("web/course/course-client.js");
  assert.match(clientSrc, /kind:"ending", label:"See how the case ends", href:endingDestination\(attempt\)/);
});

test("Chapter 6 links to the ending only when all six chapters are solved", () => {
  const c6 = require("../web/chapter6.js");
  // caseFileRows takes an array of accepted keys (its real caller, acceptedMoveKeys(), returns one).
  assert.equal(c6.endingHref(c6.caseFileRows(MILESTONES), "fresh-1"), "course/ending.html?attempt=fresh-1");
  assert.equal(c6.endingHref(c6.caseFileRows(MILESTONES), ""), "course/ending.html");
  assert.equal(c6.endingHref(c6.caseFileRows(MILESTONES.slice(0, 5)), "fresh-1"), null);
  assert.match(read("web/chapter6.js"), /See how the case ends →/);
});


// Review 2026-09-26: screen readers hear a short scene line, not the whole scene every 7 seconds;
// an older running game gets restart advice; one h1; the simulated-data label is on screen.
test("the page announces only a short scene line and has one h1", () => {
  const html = read("web/course/ending.html");
  assert.doesNotMatch(html, /id="ending-stage"[^>]*aria-live/);
  assert.match(html, /id="ending-progress"[^>]*aria-live="polite"/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /id="ending-data-label"/);
  assert.match(html, /id="ending-headline"[^>]*tabindex="-1"/);
});

test("an older game that does not know the ending gets restart advice", () => {
  assert.match(read("web/course/ending.js"), /OLD_GAME = "This copy of Julia Time was started before the ending existed/);
});

// r1 novice note 2 (2026-09-27): right after the last Next the dark credits box looked empty; the
// staged fade started at 1.4 s and finished at 5.6 s. Keep the roll, but every line is in by about 2.5 s.
test("the credits show at once: no staggered fade left the dark box empty (round 2, P18)", () => {
  const css = require("node:fs").readFileSync(require("node:path").join(__dirname, "../web/course/ending.css"), "utf8");
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "../web/course/ending.html"), "utf8");
  assert.doesNotMatch(css, /\.finale-play \.credits/, "no credits rule may hide the block while it fades in");
  assert.doesNotMatch(html, /id="credits[^"]*"[^>]*style="--i/, "no credits line carries a stagger delay");
  assert.match(html, /<p id="credits-featuring-label"[^>]*>Featuring the Julia you typed<\/p>/);
});

test("the ending stamp is visible at once, not after a delay (Pat, screenshot taken at the moment of arrival)", () => {
  const css = read("web/course/ending.css");
  const rule = css.match(/\.finale-play \.stamp \{([^}]*)\}/);
  assert.ok(rule, "the stamp animation rule exists");
  assert.doesNotMatch(rule[1], /\)\s+\.\d+s\s+both/, "no start delay on the stamp");
  const keyframe = css.match(/@keyframes stamp-in \{ from \{([^}]*)\}/);
  assert.match(keyframe[1], /opacity:\s*1/, "the stamp starts fully visible and only settles into place");
});

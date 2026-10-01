"use strict";
// Round 6, "Screen": the capped Result snaps to whole lines, "Show me the line" shows where the line went, the boss win has a peak,
// the pass keeps one ring, and the R / Python switches always say what they did. Layout is read live (docs/dev-log/course/review-0.5-r6/screen).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lesson = require("../web/lesson.js");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const css = read("web/lesson.css"), html = read("web/lesson.html"), delightCss = read("web/lesson-delight.css"), delightJs = read("web/lesson-delight.js");
const rangeCss = read("web/lesson-range.css"), rangeJs = read("web/lesson-range.js"), lessonJs = read("web/lesson.js");
const dummyFull = JSON.parse(read("test/fixtures/lesson-dummy.json"));
const answers = {};
dummyFull.rounds.forEach((r) => r.challenges.forEach((c) => { answers[c.id] = c.solution; }));
function served(full) {
  const copy = JSON.parse(JSON.stringify(full));
  copy.rounds.forEach((r) => r.challenges.forEach((c) => { delete c.check; if (c.kind === "checkpoint") delete c.solution; }));
  return copy;
}
function setup() {
  let ctrl;
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), get length() { return store.size; }, key: (i) => Array.from(store.keys())[i] };
  ctrl = lesson.createController({ storage, lessonId: "dummy", send: (msg) => {
    if (msg.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: msg.request_id, lesson: served(dummyFull) });
    else if (msg.type === "lesson_run") {
      const pass = msg.code.trim() === answers[msg.challenge];
      ctrl.handle({ type: "lesson_result", request_id: msg.request_id, challenge: msg.challenge, status: "ok", value_repr: pass ? "5" : "0", value_table: null, stdout: "", pass, feedback: pass ? "Good." : "Not yet." });
    }
  } });
  ctrl.open();
  return ctrl;
}

test("r6 item 1: the Result box snaps to whole lines (pure helper)", () => {
  assert.equal(lesson.snapCap([24, 48, 72, 96, 120, 144], 108), 96, "four 24 px lines");
  assert.equal(lesson.snapCap([31, 62, 93, 124], 108), 93, "three 31 px rows");
  assert.equal(lesson.snapCap([120, 240], 108), null, "no whole line fits: the CSS fallback stays");
  assert.equal(lesson.snapCap([], 108), null);
  assert.equal(lesson.snapCap([24, 24.4, 48, 72.2], 108), 72.2, "the largest boundary that fits");
});
test("r6 item 1: the CSS fallback is four whole 24 px lines and an 18 px fade strip; a soft bottom fade shows while there is more; focus and label stay", () => {
  assert.match(css, /#result \{[^}]*max-height: calc\(4 \* 24px \+ 30px\)/);
  assert.doesNotMatch(css, /#result \{[^}]*max-height: 8em/);
  assert.match(css, /#result\[data-more\]::after \{[^}]*position: sticky[^}]*linear-gradient\(/);
  assert.match(css, /#result\[data-more\]::after \{[^}]*height: 18px/);
  assert.match(html, /<div id="result" tabindex="0" role="region" aria-label="Result \(scrolls if long\)" hidden>/);
  assert.match(lessonJs, /snapResult\(/);
  assert.match(lessonJs, /data-more/);
});

test("r6 item 2: Show me the line flashes the editor border once and the note says where the line is", () => {
  assert.match(lessonJs, /const LINE_NOTE = "Here is the line, in the editor\. Press Run to see what Julia does with it\.";/);
  assert.match(delightCss, /textarea\.line-flash \{[^}]*border-color: #1f6f6b/);
  assert.match(delightCss, /textarea\.line-flash \{[^}]*0 0 0 3px/);
  assert.match(delightCss, /@keyframes jt-lineflash/);
  assert.match(lessonJs, /classList\.add\("line-flash"\)/);
  // reduced motion: the global rule stops the animation; the class still shows a steady border for a moment
  assert.match(delightCss, /prefers-reduced-motion: reduce\) \{ \* \{ animation: none !important/);
});

test("r6 item 3: the boss win has a kicker (16 px, not Tufte's 14 px: the 16 px text gate wins), a 22 px serif line, a held gold glow on the hit jars, and a gold 5 of 5", () => {
  assert.match(rangeCss, /#feedback\.ok\.boss-win \{[^}]*font: 700 22px\/1\.25 var\(--serif\)/);
  assert.match(rangeCss, /\.boss-kicker \{[^}]*font: 700 16px[^}]*letter-spacing: \.08em[^}]*text-transform: uppercase[^}]*color: #ffd166/);
  assert.match(rangeCss, /\.boss-won \.jar\.hit \.jar-body \{[^}]*box-shadow: 0 0 10px 2px rgba\(255, 209, 102, \.7\)/);
  assert.match(rangeCss, /#board\.boss-won \.win-num \{[^}]*font: 700 18px[^}]*color: #ffd166/);
  assert.match(rangeJs, /boss-kicker/);
  assert.match(rangeJs, /win-num/);
  assert.match(rangeJs, /\$\("data-label"\)\.hidden = !v\.dataLabel \|\| bossWin/);
  // no new sound: the one fanfare is the existing one, which the mute stops
  const before = require("node:child_process").execFileSync("git", ["show", "HEAD:web/lesson-range.js"], { cwd: root, encoding: "utf8" });
  const sounds = (t) => (t.match(/sound\.play\(/g) || []).length;
  assert.equal(sounds(rangeJs), sounds(before), "round 6 adds no sound of its own");
});

test("r6 item 4: a pass leaves one ring, on Next, in #2E7D32 at 35%; Result gets none", () => {
  assert.doesNotMatch(delightJs, /jt-ring/);
  assert.doesNotMatch(delightCss, /#result\.jt-ring/);
  assert.doesNotMatch(delightCss, /@keyframes jt-ring/);
  assert.match(delightCss, /--jt-ring: rgba\(46, 125, 50, 0\.35\)/);
  assert.match(delightCss, /@keyframes jt-nudge \{[^}]*0 0 0 4px var\(--jt-ring\)/);
});

test("r6 item 5: every switch toggle says what it did (a step with no note; one language missing; gone on the next step)", () => {
  const ctrl = setup();
  ctrl.start();
  assert.equal(ctrl.view().nav.switchNote, "");
  const raw = () => ctrl.state.flat[ctrl.state.index].challenge;
  delete raw().r_note; delete raw().py_note;
  ctrl.toggleShow("r");
  assert.match(ctrl.view().nav.switchNote, /no R or Python note/);
  assert.match(ctrl.view().nav.switchNote, /Cheat sheet and Pocket dictionary/);
  ctrl.toggleShow("r");
  assert.match(ctrl.view().nav.switchNote, /no R or Python note/, "said on every toggle, not once only");
  // a step that has an R note only: the Python switch changes nothing here, and says so; the R switch shows or hides the note itself
  raw().r_note = "In R, this is c(1, 2).";
  ctrl.toggleShow("py");
  assert.match(ctrl.view().nav.switchNote, /no Python note/);
  ctrl.toggleShow("r"); ctrl.toggleShow("r");
  const v = ctrl.view();
  if (v.ch.notes || (v.ch.pinned && v.ch.pinned.notes.r)) assert.equal(v.nav.switchNote, "", "the note appearing is the change");
  else assert.match(v.nav.switchNote, /under the result, after you press Run/);
  const ch = ctrl.view().ch;
  ctrl.run(answers[ch.id]);
  ctrl.next();
  assert.equal(ctrl.view().nav.switchNote, "", "the line goes away on the next step");
});
test("r6 item 5: the pills carry a title", () => {
  assert.equal((html.match(/<label class="switch" title="[^"]+"><input id="show-(r|py)"/g) || []).length, 2);
});

test("r6 item 6: no cheat-sheet code cell wraps", () => {
  assert.match(css, /#sheet-table td:not\(:nth-child\(2\)\) \{[^}]*white-space: nowrap/);
});

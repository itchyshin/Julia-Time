"use strict";
// The delight layer (web/lesson-delight.js): who speaks, the lines, sound follows the range's saved setting, reduced motion.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const D = require("../web/lesson-delight.js");
const RANGE = fs.readFileSync(path.join(__dirname, "../web/lesson-range.js"), "utf8");

test("it uses the same sound key as the target range", () => {
  assert.match(RANGE, new RegExp('SOUND_KEY = "' + D.SOUND_KEY + '"'));
});
test("sound is on by default and off only when the range saved off", () => {
  const store = (v) => ({ getItem: () => v });
  assert.equal(D.soundOn(null), true);
  assert.equal(D.soundOn(store(null)), true);
  assert.equal(D.soundOn(store("on")), true);
  assert.equal(D.soundOn(store("off")), false);
  assert.equal(D.soundOn({ getItem() { throw new Error("blocked"); } }), true);
  const mem = {}; const w = { setItem: (k, v) => { mem[k] = v; }, getItem: (k) => mem[k] };
  D.setSound(w, false); assert.equal(D.soundOn(w), false); assert.equal(mem[D.SOUND_KEY], "off");
  D.setSound(w, true); assert.equal(D.soundOn(w), true);
});
test("reduced motion switches motion off", () => {
  const win = (m) => ({ matchMedia: () => ({ matches: m }) });
  assert.equal(D.motionOk(win(true)), false);
  assert.equal(D.motionOk(win(false)), true);
  assert.equal(D.motionOk({}), true);
});
test("a pass is celebrated only after Run, only when the line says ok", () => {
  assert.equal(D.shouldCelebrate(true, "ok", "That worked."), true);
  assert.equal(D.shouldCelebrate(true, "ok jt-win", "That worked."), true);
  assert.equal(D.shouldCelebrate(false, "ok", "That worked."), false);   // a restored page, no Run
  assert.equal(D.shouldCelebrate(true, "notyet", "Not yet."), false);
  assert.equal(D.shouldCelebrate(true, "alert", "Julia could not read this."), false);
  assert.equal(D.shouldCelebrate(true, "ok", "  "), false);
});
test("the chime is for checkpoints only", () => {
  assert.equal(D.isCheckpoint("Checkpoint"), true);
  ["Watch", "Change", "Write", "Fill the blank", "Fix", "Try anything", ""].forEach((l) => assert.equal(D.isCheckpoint(l), false));
});
test("each lesson and exam has a speaker, the right one, with a short line", () => {
  assert.deepEqual(["lesson1", "lesson2", "lesson3", "lesson4", "lesson5", "lesson6"].map((i) => D.speakerFor(i).name), ["Itchy", "Eddie", "Eddie", "Itchy", "Toto", "Momo"]);
  for (let n = 1; n <= 6; n++) assert.equal(D.speakerFor("exam" + n).name, D.speakerFor("lesson" + n).name);
  assert.equal(D.speakerFor("range"), null);
  assert.equal(D.speakerFor(""), null);
  Object.keys(D.LINES).forEach((who) => D.LINES[who].forEach((l) => assert.ok(D.wordCount(l) < 15, l)));
  for (let n = 1; n <= 6; n++) { const s = D.speakerFor("exam" + n); assert.ok(D.wordCount(s.line) < 15); assert.ok(D.FACES[s.name]); }
});
test("the lines are lines the story bible already gives (no new fact)", () => {
  const bible = fs.readFileSync(path.join(__dirname, "../docs/design/05-story-bible.md"), "utf8") + fs.readFileSync(path.join(__dirname, "../docs/design/06-story-spine.md"), "utf8")
    + fs.readdirSync(path.join(__dirname, "../web")).filter((f) => /^chapter\d\.html$/.test(f)).map((f) => fs.readFileSync(path.join(__dirname, "../web", f), "utf8")).join("");
  Object.keys(D.LINES).forEach((who) => D.LINES[who].forEach((l) => assert.ok(bible.replace(/[“”*]/g, "").includes(l.replace(/\.$/, "")), "not found: " + l)));
});
test("only chapter exams get a picture, and every picture file exists", () => {
  assert.equal(D.artFor("lesson3"), null);
  assert.equal(D.artFor("range"), null);
  for (let n = 1; n <= 6; n++) {
    const a = D.artFor("exam" + n); assert.ok(a);
    assert.ok(fs.existsSync(path.join(__dirname, "../web", a.src)), a.src);
  }
});
test("the files are wired into lesson.html and no em dash is used", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/lesson.html"), "utf8");
  assert.match(html, /lesson-delight\.css/); assert.match(html, /lesson-delight\.js/);
  ["lesson-delight.js", "lesson-delight.css"].forEach((f) => assert.ok(!fs.readFileSync(path.join(__dirname, "../web", f), "utf8").includes("—")));
});
test("every animation here is 900 ms or less (the result ring fades over 900, Tufte round 3), and reduced motion switches them all off", () => {
  const css = fs.readFileSync(path.join(__dirname, "../web/lesson-delight.css"), "utf8");
  const anim = css.match(/animation:[^;]+/g) || [];
  anim.forEach((a) => (a.match(/(\d+)ms/g) || []).forEach((m) => assert.ok(parseInt(m, 10) <= 900, a)));
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \* \{ animation: none !important/);
});

// Round 4 (Rose): on an exam end page the finding and the character line come before Continue.
test("r4: placeGoAfterReveal puts the Continue button after the finding and the character line", () => {
  const order = [];
  const parent = { children: order, insertBefore(node, ref) { const i = order.indexOf(node); if (i >= 0) order.splice(i, 1); const at = ref ? order.indexOf(ref) : order.length; order.splice(at, 0, node); } };
  const mk = (id) => ({ id, parentNode: parent, get nextSibling() { const i = order.indexOf(this); return order[i + 1] || null; } });
  const [title, art, go, finding, say, next] = ["title", "art", "go", "finding", "say", "next"].map(mk);
  order.push(title, art, go, finding, say, next);
  assert.equal(D.placeGoAfterReveal(go, finding, say), true);
  assert.deepEqual(order.map((n) => n.id), ["title", "art", "finding", "say", "go", "next"]);
  // without a character line it goes after the finding
  order.length = 0; order.push(title, go, finding, next);
  D.placeGoAfterReveal(go, finding, null);
  assert.deepEqual(order.map((n) => n.id), ["title", "finding", "go", "next"]);
  assert.equal(D.placeGoAfterReveal(null, finding, null), false);
});
test("r4: the page code moves the button only for an exam", () => {
  const src = fs.readFileSync(path.join(__dirname, "../web/lesson-delight.js"), "utf8");
  assert.match(src, /kind === "exam"\) \{[\s\S]*placeGoAfterReveal\(go, \$\("end-finding"\), row\)/);
  assert.match(src, /if \(had && btn && btn\.focus\) btn\.focus\(\)/, "round 5: the keyboard keeps its place on Continue");
});

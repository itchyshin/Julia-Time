// Round 5 fixes (K2, 2026-09-27) for Chapters 2 to 6: keyboard focus, skip links, phone width,
// hints kept in view, Run keeps focus while Julia runs, tap targets, headings, one "still here",
// and story words. Reports: night/r5-a11y.md, r5-bugs.md, r5-story.md.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", "web", file), "utf8");
const c3 = require("../web/chapter3.js");

test("C5 'Next: how often?' moves focus to the new step's title", () => {
  assert.match(read("chapter5.js"), /if\(destination==="event-frequency"\)\{selectMove\(destination\);focusElement\(el\.title\);\}/);
});

test("C5 and C6 skip links open the work area when it is hidden, then land on the step title", () => {
  for (const file of ["chapter5", "chapter6"]) {
    assert.match(read(file + ".html"), /<a class="skip" href="#move-title">Skip to your Julia step<\/a>/, file);
    assert.match(read(file + ".js"), /skip\.addEventListener\("click", event => \{ if \(!el\.work\.hidden\) return; event\.preventDefault\(\); el\.start\.click\(\); \}\)/, file);
  }
});

test("phone width: button rows wrap, and the bridge card's long code lines break", () => {
  assert.match(read("chapter3.css"), /\.controls \{ display:flex; flex-wrap:wrap; gap:\.75rem; align-items:center; \}/);
  assert.match(read("style.css"), /\.controls \{ display: flex; flex-wrap: wrap;/);
  const pre = read("answer-reference.css").match(/\.bridge-card pre \{[^}]*\}/)[0];
  assert.match(pre, /overflow-wrap: anywhere;/);
});

test("C3 and C4 keep the new hint and the focused hint button in view", () => {
  for (const file of ["chapter3.js", "chapter4.js"]) {
    const source = read(file);
    assert.match(source, /function keepHintInView\(hint, button\) \{ const show = \(\) => \{ if \(hint\) hint\.scrollIntoView\(\{block:"nearest"\}\); if \(button && !button\.disabled\) button\.scrollIntoView\(\{block:"nearest"\}\); \}; show\(\); setTimeout\(show, 100\); \}/, file);
    assert.match(source, /keepHintInView\(added, el\.nextHelp\)/, file);
  }
});

test("C2 to C6: Run stays focusable while Julia runs (aria-disabled), and a second press does nothing", () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const source = read(`chapter${n}.js`), css = read(`chapter${n === 6 ? 5 : n}.css`);
    assert.match(source, /function holdRun\(button, blocked, busy\) \{ if \(!button\) return; button\.disabled = blocked; if \(busy && !blocked\) button\.setAttribute\("aria-disabled", "true"\); else button\.removeAttribute\("aria-disabled"\); \}/, `chapter${n}.js`);
    assert.match(source, /holdRun\(el\.run,\s*/, `chapter${n}.js`);
    assert.doesNotMatch(source, /el\.run\.disabled\s*=[^;]*isRunPending|el\.run\.disabled\s*=\s*!challengeReady/, `chapter${n}.js: Run is no longer disabled just for being busy`);
    assert.match(css, /\.run\[aria-disabled="true"\]/, `chapter${n}: a busy Run button still looks unavailable`);
  }
  assert.match(read("chapter2.js"), /if\(el\.run\.disabled \|\| isRunPending\(state\)\) return;/);
  assert.match(read("chapter5.js"), /el\.run\.addEventListener\("click",\(\)=>\{if\(isRunPending\(state\)\)return;/);
  assert.match(read("chapter6.js"), /el\.run\.addEventListener\("click", \(\) => \{ if \(isRunPending\(state\)\) return;/);
});

test("phone tap targets: stand-alone links, help buttons and summaries are at least 44 px tall", () => {
  for (const file of ["chapter2.css", "chapter3.css", "chapter4.css", "chapter5.css"]) {
    const css = read(file);
    const phone = css.slice(css.lastIndexOf("/* r5 tap targets"));
    assert.match(phone, /@media \(max-width: 720px\)\{[^\n]*summary\{min-height:44px/, file);
    assert.match(phone, /button\{min-height:44px\}/, file);
  }
  assert.match(read("chapter2.css").slice(read("chapter2.css").lastIndexOf("/* r5 tap targets")), /#back-c1\{display:inline-flex;align-items:center;min-height:44px\}/);
  const c6 = read("chapter6.js");
  assert.match(c6, /review\.className = "quiet finale-link"/);
  assert.match(c6, /speed\.className = "quiet finale-link"/);
  assert.match(c6, /links\.className = "controls finale-links"; links\.append\(review, speed\)/);
  assert.doesNotMatch(c6, /review, document\.createTextNode\(" "\), speed/);
});

test("C2 has no empty tab stop, and each view has exactly one h1", () => {
  const c2html = read("chapter2.html");
  assert.match(c2html, /<div id="returned-rows" class="table-wrap"><\/div>/);
  assert.match(read("chapter2.js"), /if \(el\.rows\.childElementCount > 0\) el\.rows\.tabIndex = 0; else el\.rows\.removeAttribute\("tabindex"\);/);
  assert.match(c2html, /<h1 id="step-title">/);
  for (const file of ["chapter5.html", "chapter6.html"]) {
    const html = read(file);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, file + ": the case name is the only h1");
    assert.match(html, /<h2 id="move-title" tabindex="-1">/, file);
  }
});

test("C3 says 'still here' once after a coaching line", () => {
  const failure = {status:"error", pass:false, coaching:"In Julia, text goes in double quotes: \"tray_id\".", message:"syntax"};
  const text = c3.runOutcomeStatus(failure) + " " + c3.draftStatus(failure) + " " + c3.errorRecovery("join-report-log", failure);
  assert.equal((text.match(/still here/g) || []).length, 1, text);
  assert.match(text, /Change your code, then run again, or open Stuck\? Hints below\.$/);
});

test("story words: Toto typed the copy, C4 does not tease Momo's doubt, C5 prose has no 'vector'", () => {
  const c3html = read("chapter3.html");
  assert.doesNotMatch(c3html, /I wrote it down/);
  assert.match(c3html, /“I typed it up\. I may not have typed it right\.”/);
  assert.doesNotMatch(read("chapter4.html") + read("chapter4.js"), /bothers me/);
  const c5html = read("chapter5.html"), c5js = read("chapter5.js");
  assert.doesNotMatch(c5html, /vector/);
  assert.match(c5js, /sim_counts: all \$\{formatCount\(state\.metadata\.n_trials\)\} round counts, one number per round/);
  for (const phrase of [/true-or-false vector again/, /whole vector with one number/, /events is not a true-or-false vector/, /Julia uses one vector/, /gives the true-or-false vector a name/, /make the true-or-false vector from step 1 again and call it events\. Then divide/]) {
    assert.doesNotMatch(c5js, phrase);
  }
});

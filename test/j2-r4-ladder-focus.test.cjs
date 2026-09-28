// Round 4 fixes (J2, 2026-09-27): C2 gets the third ladder rung and shows its answer in view;
// C2-C6 move keyboard focus to the shown answer when the ladder ends; audit wording in C2-C6.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", "web", file), "utf8");
const c2 = require("../web/chapter2.js");
const c5 = require("../web/chapter5.js");

test("C2's ladder has the same four labels as the other chapters, ending with the whole line", () => {
  for (const step of ["group", "counts", "rates"]) {
    const total = c2.ladderTotal(step);
    assert.equal(total, c2.allHints(step).length + 1, step + ": idea, code shape, then the whole line");
    assert.deepEqual(Array.from({length: total + 1}, (_, shown) => c2.hintButtonLabel(shown, total)),
      ["Show the idea", "Show the code shape", "Show the whole line", "All help shown"], step);
  }
});

test("C2's whole-line rung and full-answer button share one path that lands the answer in view", () => {
  const source = read("chapter2.js");
  const reveal = source.slice(source.indexOf("function revealCompleteAnswer"), source.indexOf("el.hint.addEventListener"));
  assert.match(reveal, /The complete runnable answer is shown above your editor\./);
  assert.match(source, /el\.answer\.addEventListener\("click", \(\) => revealHints\(ladderTotal\(state\.activeStep\) - 1\)\)/);
  assert.match(source, /el\.answer\.hidden\s*=\s*done/);
});

test("when a ladder ends, keyboard focus moves to the shown answer, not to the page body", () => {
  // C2 (answer above the editor), C3 and C4 (answer-before-editor), C5 and C6 (render-based).
  assert.match(read("chapter2.js"), /if \(done\) focusShown\(el\.answerOutput\)/);
  assert.match(read("chapter3.js"), /if \(done && !wasDone\) focusShown\(el\.answerReference\)/);
  assert.match(read("chapter4.js"), /if \(done && !wasDone\) focusShown\(el\.answerReference\)/);
  for (const file of ["chapter5.js", "chapter6.js"]) {
    const source = read(file);
    assert.match(source, /function focusShown\(target\) \{ if \(!target \|\| target\.hidden\) return; target\.tabIndex = -1; target\.focus\(\{preventScroll:true\}\); target\.scrollIntoView\(\{block:"nearest"\}\); \}/, file);
    assert.ok((source.match(/focusShown\(el\.answerReference\)/g) || []).length >= 2, file + ": both the ladder and the full-answer button move focus");
  }
  for (const file of ["chapter2.js", "chapter3.js", "chapter4.js"]) assert.match(read(file), /function focusShown\(target\)/, file);
});

test("round 4 audit wording in C2 to C6", () => {
  const c3 = read("chapter3.js"), c3html = read("chapter3.html");
  assert.match(c3, /"Notebook: " \+ row\.notebook \+ " · Toto typed: " \+ row\.sheet \+ " · paper box: " \+ row\.entry_status/);
  assert.match(c3, /"Notebook and Toto’s typed copy lined up"/);
  for (const text of [c3, c3html]) {
    assert.doesNotMatch(text, /tally-sheet box|tally-sheet columns|Notebook and tally sheet lined up|· Sheet: /);
  }
  assert.doesNotMatch(read("chapter2.html") + read("chapter2.js"), /Rate parts:/);
  assert.match(read("chapter2.html"), /<strong>Share parts:<\/strong>/);
  assert.doesNotMatch(read("chapter4.js"), /to see the code shape/);
  assert.doesNotMatch(read("chapter5.js"), /as many springtails as the notebook/);
  assert.match(read("chapter5.js"), /as many jars with springtails as the notebook/);
  assert.doesNotMatch(read("chapter6.js"), /In R and pandas, & works row by row/);
  assert.match(read("chapter6.js"), /In R, & works row by row\. In Julia, as in pandas, a plain & is done before a comparison/);
});

test("C5 step 2 never assumes the learner named the step-1 vector events", () => {
  const c5js = read("chapter5.js"), html = read("chapter5.html");
  for (const text of [c5js, html]) {
    assert.doesNotMatch(text, /make events again|the same way you did in step 1|Not kept from step 1/);
  }
  assert.doesNotMatch(c5.preEditorBridge("event-frequency").lead, /make events again/);
});

test("C5's distribution chart fits a phone screen: one row per count below 720 px", () => {
  const css = read("chapter5.css");
  const phone = css.slice(css.lastIndexOf("@media (max-width:720px)"));
  assert.match(phone, /\.distribution-bars\{grid-template-columns:1fr/);
  assert.match(read("chapter5.js"), /bar\.style\.setProperty\("--share"/);
});

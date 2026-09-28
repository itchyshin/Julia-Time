"use strict";

// Owner playtest (2026-09-26, Firefox): Chapter 5 was "almost impossible to solve, not enough info, no full answers
// are given". Chapters 2-4 put a "Use these real names" card and a visible "Need the full answer?" box right above
// the editor; Chapters 5 and 6 had neither (their answer sat at the end of the hint ladder inside the closed help
// panel). Both chapters now match Chapters 2-4.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "../web", file), "utf8");

for (const [page, names] of [["chapter5.html", ["sim_counts", "observed_count"]], ["chapter6.html", ["stories", "observed_count", ".lower", ".upper"]]]) {
  // Owner play-through (2026-09-27): the button sat right above an empty editor and tempted a click
  // before any try. It now sits below Run and the result; the answer still opens above the editor.
  // r3 (2026-09-27): one hint-ladder layout in every chapter. The button now sits in Stuck? Hints,
  // right after the ladder button, so the full answer comes after the small hints.
  test(`${page}: a real-names card sits above the editor; the full-answer button below Run, after the hint button`, () => {
    const html = read(page);
    const code = html.indexOf('id="code"'), run = html.indexOf('id="run"'), help = html.indexOf('class="jt-help"');
    const card = html.indexOf('class="named-inputs"'), answer = html.indexOf('id="show-full-answer"');
    const shown = html.indexOf('id="answer-before-editor"');
    assert.ok(card > -1 && card < code, "names card before the editor");
    assert.ok(shown > -1 && shown < code, "the revealed answer opens above the editor");
    assert.ok(answer > run, "answer button after Run");
    assert.ok(card < help, "names card outside the help panel");
    assert.ok(answer > html.indexOf('id="next-hint"'), "the full-answer button comes after the hint button");
    assert.doesNotMatch(html, /Need the full answer\?/);
    assert.match(read(page.replace(".html", ".js")), /type or paste it into your editor/);
    const cardHtml = html.slice(card, html.indexOf("</section>", card));
    for (const name of names) assert.ok(cardHtml.includes("<code>" + name + "</code>"), page + " names " + name);
  });
}

test("the full-answer button jumps the existing hint ladder to its end", () => {
  assert.match(read("chapter5.js"), /el\.showFullAnswer\.addEventListener\("click", \(\) => \{ hint = helpStages\(state\.activeMove\)\.length; render\(\);/);
  assert.match(read("chapter6.js"), /el\.showFullAnswer\.addEventListener\("click", \(\) => \{ hint = HINT_LEVELS; render\(\);/);
});

// Reviewer's own beginner playthrough (2026-09-26): Chapter 5 step 2 needs sum and length, and nothing visible
// named them. The names card gains a step-2 list (events, sum(events), length(events)), shown only on that step.
// Night playtest (2026-09-26, sam.md / claude-eyes.md): the list used to offer "events" as ready to use, then
// running mean(events)-style code failed with "events was made in step 1. Each run starts fresh", contradicting
// the list; the list also printed the full taught answer (sum(events) / length(events)) as one of its "names".
// The list now says events must be made again, and stops short of the full answer.
test("Chapter 5's names card shows the step-2 tools only on step 2, without contradicting the fresh-start rule or printing the full answer", () => {
  const html = read("chapter5.html");
  const extra = html.slice(html.indexOf('id="names-frequency"'), html.indexOf("</dl>", html.indexOf('id="names-frequency"')));
  assert.match(html, /<dl id="names-frequency" hidden>/);
  for (const name of ["events", "sum(events)", "length(events)"]) assert.ok(extra.includes("<code>" + name + "</code>"), name);
  assert.ok(!extra.includes("<code>sum(events) / length(events)</code>"), "the full taught answer is not printed in the names list");
  // Audit 2026-09-27 (design rule 2): the events entry used to spell out the finished step-1 code
  // line inside its own <code>; it now says only what is missing, in words.
  assert.ok(!extra.includes("events = sim_counts"), "the finished step-1 code line is not printed in the names card");
  assert.match(extra, /each run starts fresh/i);
  assert.match(extra, /make it again/i);
  assert.match(read("chapter5.js"), /el\.namesFrequency\.hidden = state\.activeMove !== "event-frequency"/);
});

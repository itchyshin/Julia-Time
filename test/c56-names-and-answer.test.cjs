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
  test(`${page}: a real-names card and a full-answer box sit above the editor, outside the help panel`, () => {
    const html = read(page);
    const code = html.indexOf('id="code"'), help = html.indexOf('class="jt-help"');
    const card = html.indexOf('class="named-inputs"'), answer = html.indexOf('id="show-full-answer"');
    assert.ok(card > -1 && card < code, "names card before the editor");
    assert.ok(answer > -1 && answer < code, "answer button before the editor");
    assert.ok(help === -1 || (card < help && answer < help), "both outside the help panel");
    assert.match(html, /Need the full answer\?/);
    assert.match(html, /does not enter your editor/);
    const cardHtml = html.slice(card, html.indexOf("</section>", card));
    for (const name of names) assert.ok(cardHtml.includes("<code>" + name + "</code>"), page + " names " + name);
  });
}

test("the full-answer button jumps the existing hint ladder to its end", () => {
  assert.match(read("chapter5.js"), /el\.showFullAnswer\.addEventListener\("click", \(\) => \{ hint = helpStages\(state\.activeMove\)\.length; render\(\);/);
  assert.match(read("chapter6.js"), /el\.showFullAnswer\.addEventListener\("click", \(\) => \{ hint = 5; render\(\);/);
});

// Reviewer's own beginner playthrough (2026-09-26): Chapter 5 step 2 needs sum and length, and nothing visible
// named them. The names card gains a step-2 list (events, sum(events), length(events), the result shape), shown
// only on that step.
test("Chapter 5's names card shows the step-2 tools only on step 2", () => {
  const html = read("chapter5.html");
  const extra = html.slice(html.indexOf('id="names-frequency"'), html.indexOf("</dl>", html.indexOf('id="names-frequency"')));
  assert.match(html, /<dl id="names-frequency" hidden>/);
  for (const name of ["events", "sum(events)", "length(events)", "sum(events) / length(events)"]) assert.ok(extra.includes("<code>" + name + "</code>"), name);
  assert.match(read("chapter5.js"), /el\.namesFrequency\.hidden = state\.activeMove !== "event-frequency"/);
});

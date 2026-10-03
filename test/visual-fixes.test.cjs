"use strict";
// 0.5.2 visual round: the contracts the three visual reviewers' fixes rest on (phone widths, the cheat sheet, labels, Grammarly).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const css = read("web/lesson.css"), rangeCss = read("web/lesson-range.css"), mystery = read("web/mystery.css");
const rule = (text, selector) => { const m = new RegExp("(?:^|\\n)" + selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}").exec(text); return m ? m[1] : ""; };

test("every code textarea in web/ opts out of Grammarly and keeps spellcheck off", () => {
  const files = fs.readdirSync(path.join(root, "web")).filter((f) => f.endsWith(".html"));
  let seen = 0;
  files.forEach((f) => {
    for (const m of read("web/" + f).matchAll(/<textarea[^>]*>/g)) {
      if (!/spellcheck="false"/.test(m[0])) continue;                   // prose boxes keep spellcheck
      seen += 1;
      ["data-gramm=\"false\"", "data-gramm_editor=\"false\"", "data-enable-grammarly=\"false\""].forEach((a) => assert.ok(m[0].includes(a), f + ": " + a + " in " + m[0].slice(0, 60)));
    }
  });
  assert.ok(seen >= 8, "found the code boxes (" + seen + ")");
});

test("cheat sheet code cells wrap inside their column; the result and the range strip fit a phone", () => {
  assert.doesNotMatch(css, /#sheet-table td:not\(:nth-child\(2\)\) \{[^}]*white-space: nowrap/);
  assert.match(rule(css, ".dict td:not(:nth-child(2)), .sheet td:not(:nth-child(2))"), /overflow-wrap: anywhere/);
  assert.match(rule(css, "#result"), /max-width: 100%/);
  assert.match(rule(css, "#result"), /min-width: 0/);
  assert.match(css, /#result pre\.shown[^{]*\{[^}]*overflow-x: auto/);
  const phone = css.slice(css.lastIndexOf("@media (max-width: 799px)"));
  assert.match(phone.split("}")[0] + phone, /\.cue/, "the Scroll for more cue has an order on a phone");
  assert.match(/order: 2;/.test(phone) ? phone : "", /\.cue[^{]*\{ order: 2/, "and it is in the order 2 group");
  assert.match(phone, /#range-cols[^{]*\{ order: 1/, "the range columns strip sits on top on a phone");
  assert.match(rangeCss, /@media \(max-width: 799px\) \{[^}]*\.range-cols[^}]*flex-wrap: wrap/);
  assert.match(phone, /#result \{ max-height: calc\(8 \* 24px/, "a taller result box on a phone");
});

test("own-data styles: the column table scrolls inside its card, selects and the sentence fit", () => {
  assert.match(rule(css, ".own-cols-wrap"), /overflow-x: auto/);
  assert.match(rule(css, ".own-pick select"), /max-width: 100%/);
  assert.match(rule(css, ".own-pick select"), /font: inherit/);
  assert.match(rule(css, ".own-say-line"), /overflow-wrap: anywhere/);
  assert.match(rule(css, ".own-cols td:first-child"), /overflow-wrap: anywhere/);
  assert.match(rule(css, ".own-cols th, .own-cols td"), /white-space: nowrap/, "Type and Missing never break letter by letter");
});

test("cast role labels are at least 12px", () => {
  const sizes = [...mystery.matchAll(/\.role\{([^}]*)\}/g)].map((m) => /font-size:([\d.]+)rem/.exec(m[1])).filter(Boolean).map((m) => Number(m[1]) * 16);
  assert.ok(sizes.length > 0 && sizes.every((px) => px >= 12), "role sizes " + sizes.join(","));
  const first = /\.eyebrow,\.panel-label,\.chapter-kicker,\.role\{[^}]*font-size:([\d.]+)rem/.exec(mystery);
  assert.ok(Number(first[1]) * 16 >= 12);
});

test("round 2 of the visual fixes: long names and values wrap, notes and the data table fit a phone", () => {
  assert.match(rule(css, ".prompt"), /overflow-wrap: anywhere/, "a long column name in a prompt breaks");
  assert.match(rule(css, ".strip .val"), /overflow-wrap: anywhere/, "0.6666666666666666 stays in its cell");
  assert.match(rule(css, ".notes code, .note code"), /max-width: 100%/);
  assert.match(css.slice(css.lastIndexOf("@media (max-width: 799px)")), /:where\(\.lesson > #left, \.lesson > #right\) > \* \{[^}]*min-width: 0/, "a wide data table cannot widen the column");
});

test("a data table wider than a phone scrolls in its own box instead of poking out of the card", () => {
  assert.match(css.slice(css.lastIndexOf("@media (max-width: 799px)")), /#data \.tbl \{[^}]*overflow-x: auto/);
});

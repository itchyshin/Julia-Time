"use strict";

// Round-4 screen-bot (2026-09-26): the Chapter 4 card labelled base R's sample() "R (dplyr)" and Python's
// random.sample() "Python (pandas)", suggesting those packages have their own sampling verb. Chapter 5's
// lines are base R vectors and NumPy too. Each card names the tools its lines actually use.
const test = require("node:test");
const assert = require("node:assert/strict");
const bridges = require("../web/course/bridges.js");

test("each move's labels match the library its lines use", () => {
  // C4's Python line reads eligible["jar_id"] (pandas) via random.sample (2026-09-26: the line now
  // includes its own `import random`, so it names both libraries rather than "standard library").
  const MIXED_LABELS = {"C4/plan-distinct-recheck": "Python (pandas + random)"};
  for (const [key, entry] of Object.entries(bridges.BRIDGES)) {
    const card = bridges.buildCard(key, "x");
    const usesDplyr = /dplyr::/.test(entry.r), usesPandas = /\.loc\[|\.groupby\(|\.merge\(|\.agg\(/.test(entry.python);
    const usesNumpy = /numpy|np\./.test(entry.python), usesStdlib = /\brandom\./.test(entry.python);
    assert.equal(card.rLabel, usesDplyr ? "R (dplyr)" : "R (base R)", key + " R label");
    const expectedPy = MIXED_LABELS[key] || (usesPandas ? "Python (pandas)" : usesNumpy ? "Python (NumPy)" : usesStdlib ? "Python (standard library)" : null);
    assert.ok(expectedPy, key + ": a Python line with no recognised library");
    assert.equal(card.pythonLabel, expectedPy, key + " Python label");
  }
  assert.equal(bridges.buildCard("C4/plan-distinct-recheck", "x").rLabel, "R (base R)");
  assert.equal(bridges.buildCard("C4/plan-distinct-recheck", "x").pythonLabel, "Python (pandas + random)");
  assert.equal(bridges.buildCard("C5/event-mask", "x").pythonLabel, "Python (NumPy)");
});

test("the rendered card uses the move's own labels", () => {
  const made = [];
  const doc = {createElement: tag => { const node = {tag, textContent: "", children: [], append(...xs) { this.children.push(...xs); }}; made.push(node); return node; }};
  const container = {hidden: true, children: [], replaceChildren() { this.children = []; }, append(...xs) { this.children.push(...xs); }};
  bridges.renderCard(container, "C4/plan-distinct-recheck", "sample(eligible.jar_id, 3; replace=false)", doc);
  const labels = made.filter(node => node.tag === "h3").map(node => node.textContent);
  assert.ok(labels.includes("R (base R)") && labels.includes("Python (pandas + random)"), labels.join(" | "));
  assert.ok(!labels.includes("R (dplyr)") && !labels.includes("Python (pandas)"));
});

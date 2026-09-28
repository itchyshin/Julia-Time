"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../web/chapter5.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "../web/chapter5.js"), "utf8");

test("C5 explains how Toto's card game works before the supplied case inputs", () => {
  const recipe = html.indexOf('id="model-recipe"');
  const data = html.indexOf('id="simulation-data"');

  assert.ok(recipe >= 0, "the card-game recipe is present");
  // move-first (2026-09-25): optional model context now lives in the collapsed "Stuck? Hints"
  // details after the editor, so it follows the essential case data instead of preceding it.
  assert.ok(recipe > data, "the recipe now follows the case inputs, inside the optional help details");
  const recipeEnd = html.indexOf('</details>', recipe);
  const recipeCopy = html.slice(recipe, recipeEnd);
  assert.match(recipeCopy, /six cards, one for each jar/i);
  assert.match(recipeCopy, /teal means springtails/i);
  assert.match(recipeCopy, /1,?000 rounds/i);
  assert.match(recipeCopy, /what-if, not new jars/i);
});

test("C5 puts the supplied simulation and an optional different-data rehearsal before case code", () => {
  const practice = html.indexOf('id="practice-event"');
  const data = html.indexOf('id="simulation-data"');
  const editor = html.indexOf('id="editor-title"');

  assert.ok(practice >= 0, "the different-data example is present");
  assert.ok(editor > data, "the independent editor follows the named case inputs");
  // move-first (2026-09-25): the different-data rehearsal is optional, so it now lives in the
  // collapsed "Stuck? Hints" details after the editor, not before the case data.
  assert.ok(practice > editor, "the different-data example now follows the editor, inside optional help");
  assert.match(html, /practice_counts\s*\.>=\s*practice_target/);
  assert.match(html, /different from the Missing Fleas case/i);
  assert.match(html, /does not count for the case/i);
});

test("C5 keeps its legacy card controls out of the required route", () => {
  assert.match(html, /<section id="cards" class="cards"[^>]*\bhidden\b/i);
  assert.doesNotMatch(html.slice(0, html.indexOf('id="cards"')), /Show Toto’s six cards/i);
  assert.match(html, /5 or more teal/i);
  assert.match(script, /Use only the count values in Julia/i);
  assert.match(html, /Complete and run Step 1 to unlock Step 2/i);
});

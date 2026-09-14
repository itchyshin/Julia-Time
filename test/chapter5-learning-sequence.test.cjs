"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../web/chapter5.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "../web/chapter5.js"), "utf8");

test("C5 explains Toto's deliberately simple model before the supplied case inputs", () => {
  const recipe = html.indexOf('id="model-recipe"');
  const data = html.indexOf('id="simulation-data"');

  assert.ok(recipe >= 0, "the model recipe is present");
  assert.ok(recipe < data, "the recipe precedes the case inputs");
  const recipeEnd = html.indexOf('</section>', recipe);
  const recipeCopy = html.slice(recipe, recipeEnd);
  assert.match(recipeCopy, /deliberately simple/i);
  assert.match(recipeCopy, /six jars/i);
  assert.match(recipeCopy, /detected.*not detected/i);
  assert.match(recipeCopy, /fixed.*0\.5.*teaching probability/i);
  assert.match(recipeCopy, /repeat.*1,?000/i);
  assert.match(recipeCopy, /at least the observed B09 count/i);
  assert.match(recipeCopy, /not evidence.*cause|not.*cause.*evidence/i);
});

test("C5 puts the supplied simulation and an optional different-data rehearsal before case code", () => {
  const practice = html.indexOf('id="practice-event"');
  const data = html.indexOf('id="simulation-data"');
  const editor = html.indexOf('id="editor-title"');

  assert.ok(practice >= 0, "the different-data example is present");
  assert.ok(data > practice, "named case inputs follow the different-data example");
  assert.ok(editor > data, "the independent editor follows the named case inputs");
  assert.match(html, /practice_counts\s*\.>=\s*practice_target/);
  assert.match(html, /different from the Missing Fleas case/i);
  assert.match(html, /not case evidence/i);
});

test("C5 keeps its legacy card controls out of the required route", () => {
  assert.match(html, /<section id="cards" class="cards"[^>]*\bhidden\b/i);
  assert.doesNotMatch(html.slice(0, html.indexOf('id="cards"')), /Show Toto’s six cards/i);
  assert.match(html, /at least the observed B09 count/i);
  assert.match(script, /Use only the count values in Julia/i);
  assert.match(html, /Complete and run Move 1 to unlock Move 2/i);
});

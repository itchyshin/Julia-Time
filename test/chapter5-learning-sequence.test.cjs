"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../web/chapter5.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "../web/chapter5.js"), "utf8");

test("C5 explains Toto's deliberately simple model before case inputs and optional cards", () => {
  const recipe = html.indexOf('id="model-recipe"');
  const data = html.indexOf('id="simulation-data"');
  const cards = html.indexOf('id="cards"');

  assert.ok(recipe >= 0, "the model recipe is present");
  assert.ok(recipe < data, "the recipe precedes the case inputs");
  assert.ok(recipe < cards, "the recipe precedes the optional cards");
  const recipeEnd = html.indexOf('</section>', recipe);
  const recipeCopy = html.slice(recipe, recipeEnd);
  assert.match(recipeCopy, /deliberately simple/i);
  assert.match(recipeCopy, /six jars/i);
  assert.match(recipeCopy, /detected.*not detected/i);
  assert.match(recipeCopy, /fixed.*0\.5.*teaching probability/i);
  assert.match(recipeCopy, /repeat.*1,?000/i);
  assert.match(recipeCopy, /at least the observed B09 count/i);
  assert.match(recipeCopy, /not evidence.*cause|not.*cause.*evidence/i);
  assert.match(recipeCopy, /cards.*optional|optional.*cards/i);
});

test("C5 shows its named case inputs before an optional card rehearsal and before case code", () => {
  const cards = html.indexOf('id="cards-title"');
  const practice = html.indexOf('id="practice-event"');
  const data = html.indexOf('id="simulation-data"');
  const editor = html.indexOf('id="editor-title"');

  assert.ok(cards >= 0, "Toto's card activity is present");
  assert.ok(practice >= 0, "the different-data example is present");
  assert.ok(data > practice, "named case inputs follow the different-data example");
  assert.ok(cards > data, "the optional card rehearsal follows the named case inputs");
  assert.ok(editor > cards, "the independent editor follows the optional rehearsal");
  assert.match(html, /practice_counts\s*\.>=\s*practice_target/);
  assert.match(html, /different from the Missing Fleas case/i);
  assert.match(html, /not case evidence/i);
});

test("C5 says what the optional card demonstration models without blocking the event move", () => {
  assert.match(html, /One fixed six-card draw stands in for the six jars in this small teaching model/i);
  assert.match(html, /If you want a tangible rehearsal, decide whether that draw meets the event/i);
  assert.match(html, /You may go straight to your Julia move below/i);
  assert.match(html, /at least the observed B09 count/i);
  assert.match(script, /Use only the count values in Julia/i);
  assert.match(html, /Complete and run Move 1 to unlock Move 2/i);
  assert.match(script, /out of every 100 model runs/i);
  assert.doesNotMatch(html, /This small fixed activity is a chance model/i);
});

test("C5 makes one non-credit card decision the visible teaching step, while replays remain optional", () => {
  assert.match(html, /<section id="cards" class="cards"[\s\S]*?Show Toto’s six cards/i);
  assert.match(html, /<details class="extension">[\s\S]*?Optional: replay more model draws/i);
  assert.match(html, /no case evidence/i);
});

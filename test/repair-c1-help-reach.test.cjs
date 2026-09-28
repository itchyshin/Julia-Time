"use strict";

// UI-10 and the "hints below" leftover copy (2026-09-24 real-browser pass and agent-proxy playtest):
// after a wrong C1 run the feedback said "use the first nudge", but the help drawer holding that
// nudge was hidden in the result stage; and the editor copy pointed at "the code shape and hints
// below", which sit inside a closed panel labelled "Stuck? Help and practice". Chapters 2 to 6 keep
// their help visible after a wrong run.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/mystery.js");

const html = fs.readFileSync(path.join(__dirname, "../web/index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "../web/mystery.js"), "utf8");
const DOLLAR_ERROR = "$ is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `$` not defined";

test("C1 keeps the help drawer on screen after a run that was not accepted", () => {
  assert.equal(typeof client.helpDrawerVisible, "function");
  const rejected = {status:"error", pass:false, message:DOLLAR_ERROR};
  assert.match(client.challengeRecovery(rejected), /Show the idea/);
  assert.equal(client.helpDrawerVisible("result", rejected), true, "the nudge must be on screen where the feedback names it");
  assert.equal(client.helpDrawerVisible("result", {status:"ok", pass:false}), true);
  assert.equal(client.helpDrawerVisible("result", {type:"case_result", status:"timeout", pass:false}), true);
  assert.equal(client.helpDrawerVisible("code", null), true);
  // After an accepted run the evidence board stays uncluttered, as before.
  assert.equal(client.helpDrawerVisible("result", {status:"ok", pass:true}), false);
  assert.equal(client.helpDrawerVisible("result", {pass:true, restored:true}), false);
  for (const stage of ["intro", "notebook", "practice"]) assert.equal(client.helpDrawerVisible(stage, null), false, stage);
  assert.match(source, /\.help-drawer"\)\.hidden = !helpDrawerVisible\(stage, state\.result\)/);
});

test("C1 copy names the closed help panel instead of pointing at hints 'below'", () => {
  for (const visitedPractice of [true, false]) {
    const text = client.bridgeText(visitedPractice);
    assert.doesNotMatch(text, /code shape and hints below/i);
    assert.match(text, /Stuck\? Hints/);
    assert.match(text, /below the editor/);
    assert.doesNotMatch(text, /—/, "no em dash in new learner-facing copy");
  }
  const bridge = html.slice(html.indexOf('id="practice-to-case-bridge"'), html.indexOf('id="answer-before-editor"'));
  assert.doesNotMatch(bridge, /code shape and hints below/i);
  assert.match(bridge, /Stuck\? Hints/);
  // The opening scene named a "Help me start" control that C1 no longer has.
  assert.doesNotMatch(html, /Help me start/);
  const intro = html.slice(html.indexOf('class="intro-help"'), html.indexOf('class="start-link"'));
  assert.match(intro, /Stuck\? Hints/);
  assert.doesNotMatch(intro, /—/);
  // 2026-09-25: the panel uses the label every chapter shares; the pointers above name it.
  assert.match(html, /<summary>Stuck\? Hints <span>Small hints first, the full answer last\. Your editor stays as you left it\.<\/span><\/summary>/);
});

test("C1 recovery says where the first nudge is", () => {
  const recovery = client.challengeRecovery({status:"error", pass:false, message:DOLLAR_ERROR});
  assert.match(recovery, /“Show the idea” under “Stuck\? Hints” below/);
  assert.doesNotMatch(recovery.replace("R's $ does not exist in Julia —", ""), /—/);
});

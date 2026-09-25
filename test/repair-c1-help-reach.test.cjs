"use strict";

// UI-10 and the "hints below" leftover copy (2026-09-24 real-browser pass and agent-proxy playtest):
// after a wrong C1 run the feedback said "use the first nudge", but the help drawer holding that
// nudge was hidden in the result stage; and the editor copy pointed at "the code shape and hints
// below", which sit inside a closed panel labelled "Need the full answer?". Chapters 2 to 6 keep
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
  assert.match(client.challengeRecovery(rejected), /first nudge/i);
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
    assert.match(text, /Need the full answer\?/);
    assert.match(text, /below the editor/);
    assert.doesNotMatch(text, /—/, "no em dash in new learner-facing copy");
  }
  const bridge = html.slice(html.indexOf('id="practice-to-case-bridge"'), html.indexOf('id="answer-before-editor"'));
  assert.doesNotMatch(bridge, /code shape and hints below/i);
  assert.match(bridge, /Need the full answer\?/);
  // The opening scene named a "Help me start" control that C1 no longer has.
  assert.doesNotMatch(html, /Help me start/);
  const intro = html.slice(html.indexOf('class="intro-help"'), html.indexOf('class="start-link"'));
  assert.match(intro, /Need the full answer\?/);
  assert.doesNotMatch(intro, /—/);
  // The panel label itself is unchanged (pinned elsewhere and chosen deliberately).
  assert.match(html, /<summary>Need the full answer\? <span>or take small hints first; your editor stays empty<\/span><\/summary>/);
});

test("C1 recovery says where the first nudge is", () => {
  const recovery = client.challengeRecovery({status:"error", pass:false, message:DOLLAR_ERROR});
  assert.match(recovery, /first nudge under “Need the full answer\?” below/);
  assert.doesNotMatch(recovery.replace("R's $ does not exist in Julia —", ""), /—/);
});

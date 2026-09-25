"use strict";

// Repairs from the 2026-09-24 real-browser audit (UI-07, UI-12 C4 part) and the simulated
// playtest (C4/plan-distinct-recheck stopping point). Each test failed before its fix.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter4.js");

const MOVE = "plan-distinct-recheck";
const html = fs.readFileSync(path.join(__dirname, "../web/chapter4.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "../web/chapter4.js"), "utf8");

// Julia 1.10's own text for R-style constants, as the sandbox forwards it.
function undefinedName(name) {
  return {
    type:"case_result", status:"error", pass:false,
    message:name+" is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `"+name+"` not defined"
  };
}

test("UI-07: C4 never calls an unseeded random draw reproducible, and says re-runs may differ", () => {
  const copy = client.lessonCopy(MOVE);
  for (const text of [copy.bridge, copy.planningProtocol, html]) assert.doesNotMatch(text, /reproduc/i);
  assert.match(copy.bridge, /at random/i);
  assert.match(copy.planningProtocol, /random/i);
  assert.match(copy.planningProtocol, /fair/i);
  assert.match(copy.planningProtocol, /each run may choose a different three/i);
  assert.match(copy.planningProtocol, /any three different eligible IDs are accepted/i);
  assert.match(html, /fair, random three-jar plan/);
});

test("UI-12: C4 names R's FALSE and TRUE from Julia's own error, before the existing recovery copy", () => {
  const shared = client.lessonCopy(MOVE).recovery;
  const falseLine = client.recoveryCopy(undefinedName("FALSE"));
  assert.match(falseLine, /^FALSE is R's spelling\. Julia writes false in lower case\. /);
  assert.ok(falseLine.endsWith(shared), "the chapter's existing recovery copy still follows");
  const trueLine = client.recoveryCopy(undefinedName("TRUE"));
  assert.match(trueLine, /^TRUE is R's spelling\. Julia writes true in lower case\. /);
  assert.ok(trueLine.endsWith(shared));
  const newerJulia = {status:"error", message:"UndefVarError: `FALSE` not defined in `Main`"};
  assert.match(client.recoveryCopy(newerJulia), /^FALSE is R's spelling\./);
});

test("UI-12: the R-spelling line is keyed on the actual error, never guessed", () => {
  const shared = client.lessonCopy(MOVE).recovery;
  assert.equal(client.recoveryCopy(), shared);
  assert.equal(client.recoveryCopy(undefinedName("jar_ids")), shared);
  assert.equal(client.recoveryCopy({status:"ok", pass:false, message:"UndefVarError: `FALSE` not defined"}), shared);
  assert.equal(client.recoveryCopy({status:"error", message:"MethodError: no method matching sample(::Int64)"}), shared);
  assert.doesNotMatch(client.recoveryCopy(undefinedName("FALSE")), /sample\(eligible\.jar_id/);
});

test("UI-12: the rendered error result passes Julia's message to the recovery copy", () => {
  assert.match(script, /message\.status === "error"\) p\.textContent = recoveryCopy\(message\)/);
});

test("stopping point: the item bridge points at the Help me start panel that holds the code shape", () => {
  const copy = client.lessonCopy(MOVE);
  assert.match(copy.itemBridge, /eligible\.jar_id/);
  assert.match(copy.itemBridge, /Open Help me start below the editor/);
  assert.doesNotMatch(copy.itemBridge, /sample\(eligible\.jar_id/);
  const help = html.match(/<details class="help"><summary>([\s\S]*?)<\/summary>/);
  assert.ok(help, "C4 keeps one help panel");
  assert.match(help[1], /^Help me start </, "the label the bridge names exists on the page");
  assert.ok(html.indexOf('id="case-bindings"') < html.indexOf('id="code"'));
  assert.ok(html.indexOf('id="code"') < html.indexOf('<details class="help">'), "the help panel is below the editor");
});

test("stopping point: the page says plainly that Julia's sample repeats unless replace=false is given", () => {
  assert.match(client.lessonCopy(MOVE).itemBridge, /Julia's sample can pick the same ID twice unless you add replace=false\./);
});

test("new C4 learner copy uses no em dashes", () => {
  const copy = client.lessonCopy(MOVE);
  for (const text of [copy.bridge, copy.planningProtocol, copy.itemBridge, client.recoveryCopy(undefinedName("FALSE"))]) {
    assert.doesNotMatch(text, /—/);
  }
});

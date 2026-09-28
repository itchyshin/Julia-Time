"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter2.js");

test("C2 opens the optional exact runnable answer before the learner editor, from a button below Run", () => {
  assert.equal(client.lessonCopy("group").answerCode, "groupby(jars, :tray_id)");
  assert.match(client.lessonCopy("counts").answerCode, /^counts = combine\(groupby\(jars, :tray_id\)/);
  assert.match(client.lessonCopy("rates").answerCode, /^counts = combine\(groupby\(jars, :tray_id\)/);

  const html = fs.readFileSync(path.join(__dirname, "../web/chapter2.html"), "utf8");
  const answer = html.indexOf('id="complete-answer"');
  const editor = html.indexOf('<textarea id="code"');
  assert.ok(answer > -1 && answer < editor);
  // Owner play-through (2026-09-27): the answer opens above the editor, but its button sits below Run.
  assert.ok(html.indexOf('id="show-answer"') > html.indexOf('id="run"'));
  assert.match(html, /id="show-answer"[^>]*>Show the full answer/);
  assert.match(fs.readFileSync(path.join(__dirname, "../web/chapter2.js"), "utf8"), /type or paste it into your editor/i);
});

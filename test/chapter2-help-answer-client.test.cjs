"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter2.js");

test("C2 puts the optional exact runnable answer directly before the learner editor", () => {
  assert.equal(client.lessonCopy("group").answerCode, "groupby(jars, :tray_id)");
  assert.match(client.lessonCopy("counts").answerCode, /^groups = groupby\(jars, :tray_id\)/);
  assert.match(client.lessonCopy("rates").answerCode, /^summary = combine\(groupby\(jars, :tray_id\)/);

  const html = fs.readFileSync(path.join(__dirname, "../web/chapter2.html"), "utf8");
  const answer = html.indexOf('id="complete-answer"');
  const editor = html.indexOf('<textarea id="code"');
  assert.ok(answer > -1 && answer < editor);
  assert.match(html, /id="show-answer"[^>]*>Show the complete answer/);
  assert.match(html, /does not enter your editor/i);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/chapter2.js");

test("C2 makes the optional exact answer a visible route without changing the editor", () => {
  assert.match(client.allHints("group").at(-1), /^Answer reveal: groupby\(jars, :tray_id\)/);
  assert.match(client.allHints("counts").at(-1), /^Answer reveal: combine\(groupby\(jars/);

  const html = fs.readFileSync(path.join(__dirname, "../web/chapter2.html"), "utf8");
  assert.match(html, /Need the full answer\?/);
  assert.match(html, /id="show-answer"[^>]*>Show the complete answer/);
  assert.match(html, /your editor stays empty/i);
});

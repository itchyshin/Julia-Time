"use strict";

// Round-3 screen-bot (2026-09-25): typing chapter1.html gave "Not found" because Chapter 1 lives at index.html.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("chapter1.html forwards to index.html and keeps the attempt in the address", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/chapter1.html"), "utf8");
  assert.match(html, /location\.replace\("index\.html" \+ location\.search \+ location\.hash\)/);
  assert.match(html, /<meta http-equiv="refresh" content="0; url=index\.html">/);
  assert.match(html, /<a href="index\.html">Open Chapter 1 →<\/a>/, "a plain link works without scripts");
});

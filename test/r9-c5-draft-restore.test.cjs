"use strict";
// Night review r9 (2026-09-28): on reload, connecting to Julia called selectMove, which copied the
// still-empty editor over the saved draft it had just loaded, so C5 came back blank. selectMove now
// saves the editor only into the move the editor actually holds.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "web", "chapter5.js"), "utf8");

test("C5 selectMove never copies the editor into a draft before the editor holds a move", () => {
  assert.match(src, /let editorMove=null;/);
  assert.match(src, /if\(editorMove\) drafts\[editorMove\]=el\.code\.value;/);
  assert.match(src, /el\.code\.value=drafts\[move\] \|\| initialEditorText\(\);editorMove=move;/);
  assert.doesNotMatch(src, /lastRun=null;drafts\[state\.activeMove\]=el\.code\.value;/);
});

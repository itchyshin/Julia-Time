"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

// GitHub's heading anchor: lower case, punctuation dropped, each space a hyphen.
const slug = heading => heading.trim().toLowerCase().replace(/[^\w\- ]/g, "").replace(/ /g, "-");

test("every README anchor the Start here page links to is a real README heading", () => {
  const guide = read("web/course/getting-started.html");
  const anchors = new Set(read("README.md").split("\n").filter(l => /^#{1,6} /.test(l)).map(l => slug(l.replace(/^#+ /, ""))));
  const links = [...guide.matchAll(/href="[^"]*Julia-Time(?:\/blob\/main\/README\.md)?#([^"]+)"/g)].map(m => m[1]);
  assert.ok(links.length > 0, "the page should link to the README");
  for (const a of links) assert.ok(anchors.has(a), `README has no heading for #${a}`);
});

test("the public data README names no private repository paths", () => {
  assert.doesNotMatch(read("data/README.md"), /stats-hours/);
});

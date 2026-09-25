"use strict";
// 2026-09-25: the public README linked the printable observer sheet at output/pdf/, a folder the curated
// export strips, so GitHub showed "404 - page not found". Every relative link in the public-facing Markdown
// must point at a file that exists AND survives tools/release/export.sh.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const exportScript = fs.readFileSync(path.join(root, "tools", "release", "export.sh"), "utf8");
const excluded = [...exportScript.slice(exportScript.indexOf("EXCLUDE_PATHS=("), exportScript.indexOf(")", exportScript.indexOf("EXCLUDE_PATHS=(")))
  .matchAll(/"([^"]+)"/g)].map(match => match[1]);

test("export.sh still lists what it strips", () => {
  assert.ok(excluded.includes("output/"), "the list was parsed");
  assert.ok(excluded.includes("docs/dev-log/"));
});

for (const file of ["README.md", "docs/install.md", "docs/playtest-observer-sheet.md"]) {
  test(`${file}: every relative link exists in the public export`, () => {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    const broken = [];
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const relative = path.relative(root, path.resolve(path.dirname(path.join(root, file)), target.split("#")[0]));
      const stripped = excluded.some(prefix => prefix.endsWith("/") ? relative.startsWith(prefix) : relative === prefix);
      if (stripped || !fs.existsSync(path.join(root, relative))) broken.push(`${target}${stripped ? " (stripped by export.sh)" : " (missing)"}`);
    }
    assert.deepEqual(broken, [], `${file} links to files a public reader cannot open`);
  });
}

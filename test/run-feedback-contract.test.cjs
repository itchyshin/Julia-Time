const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const chapters = [
  ["index.html", "mystery.js", "result-area"],
  ["chapter2.html", "chapter2.js", "result"],
  ["chapter3.html", "chapter3.js", "result"],
  ["chapter4.html", "chapter4.js", "result"],
  ["chapter5.html", "chapter5.js", "result"],
  ["chapter6.html", "chapter6.js", "result"],
];

test("each chapter moves focus to a completed Julia result", () => {
  for (const [htmlFile, scriptFile, resultId] of chapters) {
    const html = fs.readFileSync(path.join(root, "web", htmlFile), "utf8");
    const script = fs.readFileSync(path.join(root, "web", scriptFile), "utf8");
    const resultTarget = new RegExp(`id=["']${resultId}["'][^>]*tabindex=["']-1["']`);

    assert.match(html, resultTarget, `${htmlFile} makes the returned result a keyboard target`);
      const resultFocusCall = scriptFile === "mystery.js" ? /focusResult\(outcome\)/ : /focusResult\(\)/;
      assert.match(script, resultFocusCall, `${scriptFile} focuses a settled result after rendering it`);
  }
});

test("Chapter 1 keeps its accepted evidence board as the focus target", () => {
  const script = fs.readFileSync(path.join(root, "web", "mystery.js"), "utf8");

  assert.match(script, /focusResult\(outcome\)/, "accepted Chapter 1 evidence receives focus");
  assert.match(script, /function focusResult\(target\)/, "Chapter 1 can focus its actual returned panel");
});

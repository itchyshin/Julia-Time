"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const chapters = [
  ["C1", "web/index.html", "web/mystery.css"],
  ["C2", "web/chapter2.html", "web/chapter2.css"],
  ["C3", "web/chapter3.html", "web/chapter3.css"],
  ["C4", "web/chapter4.html", "web/chapter4.css"],
  ["C5", "web/chapter5.html", "web/chapter5.css"],
  ["C6", "web/chapter6.html", "web/chapter5.css"],
];

test("every mystery chapter keeps an accessible route to its learning move", () => {
  for (const [chapter, htmlFile, cssFile] of chapters) {
    const html = read(htmlFile);
    const css = read(cssFile);
    assert.match(html, /<meta[^>]+name="viewport"/i, `${chapter} has a narrow-screen viewport`);
    assert.match(html, /<a class="skip(?:-link)?"[^>]+href="#[^"]+"/i, `${chapter} has a skip link`);
    assert.match(html, />Case Board(?:\s*—[^<]+)?</i, `${chapter} offers the persistent case navigation`);
    assert.match(css, /@media\s*\(max-width/i, `${chapter} reflows on a narrow screen`);
    assert.match(css, /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/i, `${chapter} respects reduced motion`);
  }
});

test("the C5/C6 shared controls show keyboard focus", () => {
  const css = read("web/chapter5.css");
  assert.match(css, /button:focus-visible/i);
  assert.match(css, /textarea:focus-visible/i);
  assert.match(css, /summary:focus-visible/i);
});

test("every mystery chapter keeps a visible keyboard-focus treatment", () => {
  for (const [chapter, , cssFile] of chapters) {
    const css = read(cssFile);
    assert.match(css, /button:focus-visible/i, `${chapter} keeps button focus visible`);
    assert.match(css, /a:focus-visible/i, `${chapter} keeps link focus visible`);
    assert.match(css, /textarea:focus(?:-visible)?/i, `${chapter} keeps editor focus visible`);
  }
});

test("C4 through C6 put keyboard focus in the workspace opened from a scene", () => {
  assert.match(read("web/chapter4.html"), /<h1 id="move-title" tabindex="-1">/);

  for (const chapter of ["chapter5", "chapter6"]) {
    const html = read(`web/${chapter}.html`);
    const source = read(`web/${chapter}.js`);
    assert.match(html, /id="scene-title" tabindex="-1"/i, `${chapter} has a focusable scene title`);
    assert.match(html, /id="move-title" tabindex="-1"/i, `${chapter} has a focusable workspace title`);
    assert.match(source, /focusElement\(el\.title\)/, `${chapter} moves focus into its workspace`);
    assert.match(source, /focusElement\(el\.sceneTitle\)/, `${chapter} restores focus to its scene`);
  }
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const webRoot = path.join(root, "web");

function htmlFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".html") ? [absolute] : [];
  });
}

function localTarget(value, sourceFile) {
  if (!value || value.startsWith("#") || /^(?:data|mailto|tel|javascript):/i.test(value)) return null;
  let pathname = value;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return null;
    pathname = url.pathname;
  }
  pathname = pathname.split(/[?#]/, 1)[0];
  if (!pathname) return null;
  const target = pathname.startsWith("/")
    ? path.join(webRoot, pathname === "/" ? "index.html" : pathname)
    : path.resolve(path.dirname(sourceFile), pathname);
  assert.ok(target.startsWith(webRoot + path.sep) || target === webRoot,
    `${path.relative(root, sourceFile)} must not link outside web/`);
  return target.endsWith(path.sep) ? path.join(target, "index.html") : target;
}

test("every local HTML href and source resolves inside the distributed web folder", () => {
  const unresolved = [];
  for (const sourceFile of htmlFiles(webRoot)) {
    const html = fs.readFileSync(sourceFile, "utf8");
    for (const match of html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
      const target = localTarget(match[2], sourceFile);
      if (target && !fs.existsSync(target)) {
        unresolved.push(`${path.relative(root, sourceFile)} → ${match[2]}`);
      }
    }
  }
  assert.deepEqual(unresolved, [], "a learner must never meet a dead local link or asset");
});

test("no 0.5 course page links to the Original's pages or to port 8000 (round 2, P17)", () => {
  const courseDir = path.join(webRoot, "course");
  const strays = [];
  for (const name of fs.readdirSync(courseDir).filter(f => f.endsWith(".html") && f !== "chapter.html")) {   // chapter.html is the protected legacy adapter
    const html = fs.readFileSync(path.join(courseDir, name), "utf8");
    for (const match of html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)) {
      if (/^\/?$|^\.\.\/?$|\.\.\/index\.html|(?:^|\/)chapter[1-6]\.html|:8000/.test(match[2])) strays.push(name + " → " + match[2]);
    }
  }
  assert.deepEqual(strays, []);
  for (const name of ["setup-status-board.js", "intro.js", "course-board.js", "getting-started.js"]) {
    const source = fs.readFileSync(path.join(courseDir, name), "utf8");
    assert.doesNotMatch(source, /open http:\/\/127\.0\.0\.1:8000\/["'.]|"\.\.\/index\.html"/, name);
  }
});

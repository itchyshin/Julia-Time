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

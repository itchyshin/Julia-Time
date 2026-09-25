"use strict";

// Repair 6 (real-browser check, 2026-09-24), Chapter 1.
//
// 1. At a 509 CSS px window the collapsed "Original Julia error" block in #result-area ran past
//    its panel (722 px of text in a 385 px box): its <pre> kept the browser's white-space: pre, so
//    one long line such as "ArgumentError: syntax df[column] is not supported use df[!, column]
//    instead" pushed the whole page sideways and was cut off. Every <pre> that Chapter 1 writes
//    into a result box must wrap (keeping Julia's text and spacing verbatim) or scroll inside its
//    own box. This test resolves the cascade for the real ancestor chain read from web/index.html,
//    the way the repair 5 contrast test does.
// 2. The evidence board read "6 retained records from disputed batch B09. B09 report records
//    recovered": the second sentence had no full stop, so it read like two labels run together.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/mystery.js");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("web/index.html");
const source = read("web/mystery.js");

// ---- the ancestor chain of an element in the real page markup ----------------------------------
const VOID = new Set(["meta", "link", "br", "img", "input", "hr", "source", "wbr"]);
function element(tag, attrs = {}) {
  return { tag, id: attrs.id || "", classes: (attrs.class || "").split(/\s+/).filter(Boolean), attrs };
}
function chainTo(id) {
  const stack = [];
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<!doctype[^>]*>/i, "");
  for (const [, close, tag, rest] of markup.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const name = tag.toLowerCase();
    if (close) { const at = stack.map(e => e.tag).lastIndexOf(name); if (at >= 0) stack.length = at; continue; }
    const attrs = {};
    for (const [, key, value] of rest.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[key] = value === undefined ? "" : value;
    const node = element(name, attrs);
    if (attrs.id === id) return stack.concat(node);
    if (!VOID.has(name) && !/\/\s*$/.test(rest)) stack.push(node);
  }
  throw new Error("web/index.html has no element with id " + id);
}

// ---- the stylesheets the page links, as ordered rules for one window width ---------------------
function parseRules(css, width) {
  const rules = [];
  function mediaMatches(query) {
    const min = query.match(/min-width\s*:\s*(\d+)px/), max = query.match(/max-width\s*:\s*(\d+)px/);
    if (!min && !max) return false;
    return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
  }
  function walk(chunk) {
    let k = 0;
    while (k < chunk.length) {
      const open = chunk.indexOf("{", k);
      if (open < 0) break;
      const prelude = chunk.slice(k, open).trim();
      let depth = 0, end = open;
      for (; end < chunk.length; end++) { if (chunk[end] === "{") depth++; else if (chunk[end] === "}" && --depth === 0) break; }
      const body = chunk.slice(open + 1, end);
      if (/^@media/i.test(prelude)) { if (mediaMatches(prelude)) walk(body); }
      else if (!/^@/.test(prelude)) {
        const declarations = body.split(";").map(d => d.trim()).filter(Boolean).map(d => {
          const colon = d.indexOf(":");
          const value = d.slice(colon + 1).trim();
          return { prop: d.slice(0, colon).trim().toLowerCase(), value: value.replace(/\s*!important$/i, ""), important: /!important$/i.test(value) };
        });
        for (const selector of splitTop(prelude, ",")) rules.push({ selector: selector.trim(), declarations });
      }
      k = end + 1;
    }
  }
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  return rules;
}
function splitTop(s, sep) {
  const out = []; let depth = 0, from = 0;
  for (let j = 0; j < s.length; j++) {
    if ("([".includes(s[j])) depth++; else if (")]".includes(s[j])) depth--;
    else if (s[j] === sep && depth === 0) { out.push(s.slice(from, j)); from = j + 1; }
  }
  return out.concat(s.slice(from));
}
function stylesheets(width) {
  const files = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => "web/" + m[1]);
  return files.flatMap(file => parseRules(read(file), width)).map((rule, order) => Object.assign(rule, { order }));
}

// ---- selector matching, specificity and the winning declaration --------------------------------
const DYNAMIC = new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "empty", "checked"]);
function compounds(selector) {
  const parts = []; let buf = "", depth = 0, pending = null;
  const flush = () => { if (buf.trim()) { if (parts.length) parts.push(pending || " "); parts.push(buf.trim()); } buf = ""; pending = null; };
  for (const ch of selector) {
    if ("([".includes(ch)) depth++; else if (")]".includes(ch)) depth--;
    if (depth === 0 && (ch === " " || ch === ">")) { if (buf.trim()) flush(); if (ch === ">") pending = ">"; continue; }
    buf += ch;
  }
  flush();
  return parts;
}
function simpleParts(compound) {
  return compound.match(/^\*|^[a-zA-Z][\w-]*|#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?/g) || [];
}
function specificity(selector) {
  let a = 0, b = 0, c = 0;
  for (const part of compounds(selector).filter((_, k) => k % 2 === 0)) {
    for (const p of simpleParts(part)) {
      if (p[0] === "#") a++;
      else if (p[0] === "." || p[0] === "[") b++;
      else if (p.startsWith("::") || /^:(before|after)$/.test(p)) c++;
      else if (p.startsWith(":not(")) { const [x, y, z] = specificity(p.slice(5, -1)); a += x; b += y; c += z; }
      else if (p[0] === ":") b++;
      else if (p !== "*") c++;
    }
  }
  return [a, b, c];
}
function matchesCompound(compound, node) {
  for (const p of simpleParts(compound)) {
    if (p === "*") continue;
    if (/^[a-zA-Z]/.test(p)) { if (node.tag !== p.toLowerCase()) return false; }
    else if (p[0] === "#") { if (node.id !== p.slice(1)) return false; }
    else if (p[0] === ".") { if (!node.classes.includes(p.slice(1))) return false; }
    else if (p[0] === "[") {
      const [, key, value] = p.match(/^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/);
      if (!(key in node.attrs) || (value !== undefined && node.attrs[key] !== value)) return false;
    }
    else if (p.startsWith("::") || /^:(before|after)$/.test(p)) return false;
    else if (p === ":root") { if (node.tag !== "html") return false; }
    else if (p.startsWith(":not(")) { if (matchesCompound(p.slice(5, -1), node)) return false; }
    else if (DYNAMIC.has(p.slice(1))) return false;
  }
  return true;
}
function matches(selector, chain) {
  const parts = compounds(selector);
  const at = (k, index) => {
    if (!matchesCompound(parts[k], chain[index])) return false;
    if (k === 0) return true;
    if (parts[k - 1] === ">") return index > 0 && at(k - 2, index - 1);
    for (let j = index - 1; j >= 0; j--) if (at(k - 2, j)) return true;
    return false;
  };
  return at(parts.length - 1, chain.length - 1);
}
function winner(rules, chain, props) {
  let best = null;
  const beats = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] > b[k]; return true; };
  for (const rule of rules) {
    if (!matches(rule.selector, chain)) continue;
    const spec = specificity(rule.selector);
    for (const d of rule.declarations) {
      if (!props.includes(d.prop)) continue;
      const key = [d.important ? 1 : 0, ...spec, rule.order];
      if (!best || beats(key, best.key)) best = { key, value: d.value.toLowerCase(), rule: rule.selector };
    }
  }
  return best;
}
// white-space: the browser's own pre style (white-space: pre) beats anything inherited, so only
// rules on the <pre> itself count. overflow-wrap is inherited (the browser sets none on <pre>).
// overflow is not inherited: it counts on the <pre> or on the box that holds it.
function preLayout(rules, chain) {
  const ws = winner(rules, chain, ["white-space"]);
  let wrap = { value: "normal", rule: "browser default" };
  for (let k = 1; k <= chain.length; k++) { const w = winner(rules, chain.slice(0, k), ["overflow-wrap", "word-wrap"]); if (w) wrap = w; }
  const scrolls = [chain, chain.slice(0, -1)].some(c => { const o = winner(rules, c, ["overflow", "overflow-x"]); return o && /^(auto|scroll)\b/.test(o.value); });
  return { whiteSpace: ws ? ws.value : "pre", wrap: wrap.value, scrolls };
}
function containedLongLine({ whiteSpace, wrap, scrolls }) {
  // pre, pre-wrap and break-spaces keep Julia's spaces and line breaks exactly; pre-line or normal
  // would collapse them and change how the error reads, so they do not count.
  const verbatim = /^(pre|pre-wrap|break-spaces)$/.test(whiteSpace);
  const wraps = /^(pre-wrap|break-spaces)$/.test(whiteSpace) && /^(anywhere|break-word)$/.test(wrap);
  return verbatim && (wraps || scrolls);
}

// Every <pre> Chapter 1 writes into a result box, by its real container, tag and class.
const resultArea = () => chainTo("result-area").map(node => node.tag === "body" ? element("body", { "data-stage": "result", "data-connection": "connected" }) : node);
const practiceOutput = () => chainTo("practice-output").map(node => node.tag === "body" ? element("body", { "data-stage": "practice", "data-connection": "connected" }) : node);
const PRE_WRITES = [
  ["the collapsed Original Julia error (case run)", resultArea, [element("details", { class: "original-error" }), element("pre")], 'appendText(original, "pre", "", result.message)'],
  ["printed output (case run)", resultArea, [element("pre", { class: "stdout" })], '"pre", "stdout", result.stdout'],
  ["a returned value (case run)", resultArea, [element("pre", { class: "value-repr" })], '"pre", "value-repr",'],
  ["the collapsed Original Julia error (practice)", practiceOutput, [element("details"), element("pre")], 'appendText(details,"pre","",message.message)'],
  ["a returned value (practice)", practiceOutput, [element("pre")], 'appendText(output,"pre","",message.value_repr)'],
];

test("Chapter 1 still writes Julia's error and printed text verbatim, as text, into these boxes", () => {
  for (const [label, , , marker] of PRE_WRITES) assert.ok(source.includes(marker), "web/mystery.js still writes " + label + " as: " + marker);
});

for (const width of [509, 375, 1280]) {
  test(`every Chapter 1 result <pre> wraps or scrolls inside its own box at ${width} px, so the page never scrolls sideways`, () => {
    const rules = stylesheets(width);
    const failures = [];
    for (const [label, container, pathTo] of PRE_WRITES) {
      const layout = preLayout(rules, container().concat(pathTo));
      if (!containedLongLine(layout)) failures.push(`${label}: white-space ${layout.whiteSpace}, overflow-wrap ${layout.wrap}, scrolls in its box: ${layout.scrolls}`);
    }
    assert.deepEqual(failures, [], "a long Julia line would push the page sideways:\n" + failures.join("\n"));
  });
}

test("the evidence board summary reads as two punctuated sentences", () => {
  const six = Array.from({ length: 6 }, (_, k) => ({ jar_id: "J-08" + k, batch_id: "B09" }));
  const title = { id: "c1-b09-records", title: "B09 report records recovered" };
  assert.equal(typeof client.evidenceSummary, "function");
  assert.equal(client.evidenceSummary(title, six), "6 retained records from disputed batch B09. B09 report records recovered.");
  assert.equal(client.evidenceSummary(title, six.slice(0, 1)), "1 retained record from disputed batch B09. B09 report records recovered.");
  assert.equal(client.evidenceSummary(title, []), "Saved evidence: B09 report records recovered.");
  // A saved title that already ends a sentence is not given a second full stop.
  assert.equal(client.evidenceSummary({ title: "Saved B09 records." }, six), "6 retained records from disputed batch B09. Saved B09 records.");
  assert.match(source, /el\["evidence-summary"\]\.textContent = evidenceSummary\(evidence, rows\)/, "the board renders this summary");
});

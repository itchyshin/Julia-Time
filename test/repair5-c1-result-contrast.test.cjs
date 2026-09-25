"use strict";

// Repair 5 (real-browser check, 2026-09-24): since the 2026-09-10 route repair (9488867, shipped in
// v0.2.0) Chapter 1's result box #result-area sits inside the dark editor panel. The box paints a
// paper background but set no text colour, so everything renderResult writes without its own
// colour (the explanation, the next-step line, the collapsed "Original Julia error" label, the
// returned table) inherited the panel's cream text: cream on paper, 1.09:1, almost invisible.
//
// This test resolves colours the way a browser does, for the real ancestor chain read from
// web/index.html and the stylesheets that page links, and requires WCAG AA body-text contrast.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const AA_BODY_TEXT = 4.5;
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

// ---- the stylesheets the page links, as ordered rules ------------------------------------------
function parseRules(css, width) {
  const rules = [];
  function mediaMatches(query) {
    const min = query.match(/min-width\s*:\s*(\d+)px/), max = query.match(/max-width\s*:\s*(\d+)px/);
    if (!min && !max) return false; // prefers-reduced-motion and the like: not the case being checked
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
        for (const selector of splitTop(prelude, ",")) rules.push({ selector: selector.trim(), declarations, order: rules.length });
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

// ---- selector matching and specificity (the subset these stylesheets use) ----------------------
const DYNAMIC = new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "empty", "checked"]);
function compounds(selector) { // [compound, combinator, compound, ...]
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
    else if (p.startsWith("::") || /^:(before|after)$/.test(p)) return false; // pseudo-element, not the text itself
    else if (p === ":root") { if (node.tag !== "html") return false; }
    else if (p.startsWith(":not(")) { if (matchesCompound(p.slice(5, -1), node)) return false; }
    else if (DYNAMIC.has(p.slice(1))) return false; // resting state
    // structural pseudo-classes (:first-child, :last-child) are kept as matching: over-inclusive on purpose
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

// ---- cascade, inheritance and contrast ----------------------------------------------------------
function stylesheets(width) {
  const files = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => "web/" + m[1]);
  return files.flatMap(file => parseRules(read(file), width)).map((rule, order) => Object.assign(rule, { order }));
}
// The declaration that wins for props on the last element of chain: !important, then specificity,
// then source order (later wins; declarations later in one rule win too).
function winner(rules, chain, props) {
  let best = null;
  const beats = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] > b[k]; return true; };
  for (const rule of rules) {
    if (!matches(rule.selector, chain)) continue;
    const spec = specificity(rule.selector);
    for (const d of rule.declarations) {
      if (!props.includes(d.prop)) continue;
      const key = [d.important ? 1 : 0, ...spec, rule.order];
      if (!best || beats(key, best.key)) best = { key, value: d.value, rule: rule.selector };
    }
  }
  return best;
}
const NAMED = { white: "#ffffff", black: "#000000" };
function resolveVars(value, rules) {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
    const found = winner(rules, [element("html")], [name]);
    if (found) return found.value;
    if (fallback) return fallback.trim();
    throw new Error("undefined custom property " + name);
  });
}
function rgb(value) {
  const v = (NAMED[value] || value).trim();
  let m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return m[1].split("").map(h => parseInt(h + h, 16));
  m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map(k => parseInt(m[1].slice(k, k + 2), 16));
  m = v.match(/^rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*\)$/i);
  if (m) return m.slice(1, 4).map(Number);
  return null;
}
function computed(rules, chain) {
  let color = [0, 0, 0], background = [255, 255, 255], colorFrom = "browser default", backgroundFrom = "canvas";
  for (let k = 1; k <= chain.length; k++) {
    const prefix = chain.slice(0, k);
    const c = winner(rules, prefix, ["color"]);
    if (c && !/^(inherit|currentcolor)$/i.test(c.value)) {
      const value = resolveVars(c.value, rules);
      color = rgb(value); colorFrom = c.rule;
      assert.ok(color, "an opaque text colour this test can read: " + value + " from " + c.rule);
    }
    const b = winner(rules, prefix, ["background", "background-color"]);
    if (b) {
      const value = resolveVars(b.value, rules);
      if (!/^(transparent|none)$/i.test(value)) {
        background = rgb(value); backgroundFrom = b.rule;
        assert.ok(background, "a solid background this test can read: " + value + " from " + b.rule);
      }
    }
  }
  return { color, background, colorFrom, backgroundFrom };
}
function contrast(a, b) {
  const lum = ([r, g, bl]) => [r, g, bl].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
    .reduce((sum, v, k) => sum + v * [0.2126, 0.7152, 0.0722][k], 0);
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Everything renderResult (and the saved-evidence path) writes into #result-area, by its real tag
// and class. Each class is checked against web/mystery.js so the list cannot drift from the page.
const details = element("details", { class: "original-error" });
const table = element("table", { class: "returned-table" });
const RESULT_WRITES = [
  ["the failed-run title", [element("h2", { class: "result-title fail" })], "result-title fail"],
  ["the accepted-run title", [element("h2", { class: "result-title pass" })], "result-title pass"],
  ["the accepted-run message", [element("p", { class: "result-message" })], "result-message"],
  ["the collapsed Original Julia error label", [details, element("summary")], "original-error"],
  ["the original Julia error text", [details, element("pre")], "original-error"],
  ["printed output", [element("pre", { class: "stdout" })], "stdout"],
  ["a returned value", [element("pre", { class: "value-repr" })], "value-repr"],
  ["the checker's explanation", [element("p", { class: "feedback" })], "feedback"],
  ["the next-step line", [element("p", { class: "recovery-next-step" })], "recovery-next-step"],
  ["the returned-table title", [element("h3", { class: "returned-table-title" })], "returned-table-title"],
  ["the rows-returned label", [element("p", { class: "wrong-rows-label" })], "wrong-rows-label"],
  ["a returned-table column name", [table, element("thead"), element("tr"), element("th")], "returned-table"],
  ["a returned-table cell", [table, element("tbody"), element("tr"), element("td")], "returned-table"],
  ["the saved-evidence note", [element("p")], "Run your code again"],
  ["the Return to your code button", [element("button", { class: "quiet-button" })], "Return to your code"],
];

test("the C1 result box still lives inside the dark editor panel (the container this test checks)", () => {
  const chain = chainTo("result-area");
  assert.ok(chain.some(node => node.classes.includes("editor-panel")), "#result-area is inside .editor-panel");
  const panel = chain.slice(0, chain.findIndex(node => node.classes.includes("editor-panel")) + 1);
  const { color, background } = computed(stylesheets(1280), panel);
  assert.deepEqual(background, [14, 43, 59], "the editor panel is navy");
  assert.deepEqual(color, [247, 240, 223], "the editor panel's own text is cream, which the result box must not inherit");
  for (const [, , marker] of RESULT_WRITES) assert.ok(source.includes(marker), "web/mystery.js still writes " + marker);
});

for (const [viewport, width] of [["desktop", 1280], ["phone", 375]]) {
  test(`every line written into the C1 result box is readable, ${viewport} layout (WCAG AA 4.5:1)`, () => {
    const rules = stylesheets(width);
    // mystery.js sets these on <body> at run time; the result box is only shown in the result stage.
    const area = chainTo("result-area").map(node => node.tag === "body" ? element("body", { "data-stage": "result", "data-connection": "connected" }) : node);
    const failures = [];
    for (const [label, path] of RESULT_WRITES) {
      const { color, background, colorFrom, backgroundFrom } = computed(rules, area.concat(path));
      const ratio = contrast(color, background);
      if (ratio < AA_BODY_TEXT) failures.push(`${label}: rgb(${color}) from "${colorFrom}" on rgb(${background}) from "${backgroundFrom}" = ${ratio.toFixed(2)}:1`);
    }
    assert.deepEqual(failures, [], "unreadable result text:\n" + failures.join("\n"));
  });
}

// The same fault in two more places, found by a whole-page contrast sweep in the same browser
// session: two styles written for navy surfaces are reused on paper. Both date from the first
// prototype (43988da) and ship in v0.1.0 to v0.2.0. Each is also checked where it was designed to
// sit, so a fix cannot trade one surface for the other.
const OTHER_LINES = [
  ["the Chapter 2 link on the accepted evidence board (paper)", "evidence-board", [element("a", { id: "chapter-two-link", class: "start-link" })], "chapter-two-link"],
  ["the restored practice-draft note (paper practice panel)", "indexing-practice", [element("p", { class: "saved-code-note" })], "Restored your practice draft"],
  ["the hero's Open the lab notebook link (navy hero)", "chapter-title", null, "start-link"],
  ["the restored case-code note (navy editor panel)", "code", null, "Restored your saved code"],
];

test("C1 dark-panel link and note styles stay readable on every surface they reach (WCAG AA 4.5:1)", () => {
  const rules = stylesheets(1280);
  const failures = [];
  for (const [label, anchorId, path, marker] of OTHER_LINES) {
    assert.ok(source.includes(marker), "web/mystery.js still writes " + marker);
    let chain = chainTo(anchorId);
    if (anchorId === "chapter-title") chain = chain.slice(0, -1).concat(element("a", { class: "start-link", href: "#goal-heading" }));
    else if (anchorId === "code") chain = chain.slice(0, -1).concat(element("p", { class: "saved-code-note" }));
    else chain = chain.concat(path);
    const { color, background, colorFrom, backgroundFrom } = computed(rules, chain);
    const ratio = contrast(color, background);
    if (ratio < AA_BODY_TEXT) failures.push(`${label}: rgb(${color}) from "${colorFrom}" on rgb(${background}) from "${backgroundFrom}" = ${ratio.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, [], "unreadable C1 text:\n" + failures.join("\n"));
});

#!/usr/bin/env node
// Readable-text gate (gate I12, fix round 2 package P15). In a real browser (Playwright, from tools/playtest-eyes), it
// measures every visible piece of text on the page as it stands:
//   (1) size: the computed font size is at least 16px (at least 18px inside any selector in `min18`, for prompts and
//       explanations); the code editor's own text counts too;
//   (2) contrast: the text colour against the background it really sits on (ancestors' backgrounds composited, each
//       element's opacity applied, disabled controls included) is at least 4.5:1;
//   (3) clipping: no text is cut by an ellipsis, a line clamp, or an ancestor with overflow hidden or clip.
// Text that is not seen is skipped: [hidden], display none, visibility hidden, zero size, the inside of a closed
// <details>, and screen-reader-only text (a 1px clipped box).
//
// Used two ways:
//   require("./readable-measure.cjs").measureReadable(page, { min18: "#prompt, #explain" }) -> { checked, offenders }
//     (tools/lesson-noscroll.cjs calls it on every step; tools/frame-readable.cjs on the Board, intro, ending, How to play)
//   node tools/readable-measure.cjs --url http://127.0.0.1:9690/lesson.html?lesson=lesson1 [--url ...] [--width 1366 --height 768]
//     prints READABLE-OK (N texts on M pages) or one line per offender, and exits 1 on any offender.
"use strict";
const path = require("path");

// Runs inside the page. Returns { checked, offenders: [{ where, text, why }] }.
function inPage(opts) {
  const MIN = 16, MIN18 = 18, RATIO = 4.5;
  const min18 = opts && opts.min18 ? String(opts.min18) : "";
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter((x) => x).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, under) => {                       // top (with alpha) drawn over an opaque colour
    const a = top.a;
    return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  // The background a text really sits on: every ancestor's background colour, from the page down, composited in order,
  // each faded by its own opacity. The page itself is white behind everything.
  const chain = (el) => { const out = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) out.push(n); return out.reverse(); };
  function background(el) {
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    let opacity = 1;
    for (const n of chain(el)) {
      const cs = getComputedStyle(n);
      opacity *= Number(cs.opacity);
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) bg = over({ r: c.r, g: c.g, b: c.b, a: c.a * opacity }, bg);
    }
    return { bg, opacity };
  }
  const describe = (el) => {
    let n = el, bits = [];
    while (n && n.nodeType === 1 && bits.length < 3) {
      const cls = typeof n.className === "string" && n.className.trim() ? "." + n.className.trim().split(/\s+/).join(".") : "";
      bits.unshift(n.id ? "#" + n.id : n.tagName.toLowerCase() + cls);
      if (n.id) break;
      n = n.parentElement;
    }
    return bits.join(" > ");
  };
  const hiddenEl = (el) => {
    if (el.closest("[hidden]")) return true;
    if (el.closest("details:not([open]) > :not(summary)")) return true;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse" || Number(cs.opacity) === 0) return true;
      // screen-reader-only text: a clipped box of a pixel or so
      if ((cs.clip && cs.clip !== "auto" && /rect\(0/.test(cs.clip)) || (cs.position === "absolute" && n.getBoundingClientRect().width <= 1)) return true;
    }
    return false;
  };
  // An ancestor that cuts what spills out of it: overflow hidden or clip (a scroll box can be scrolled, so it is not a cut).
  function clippedBy(el, rect) {
    for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.textOverflow === "ellipsis" && n.scrollWidth > n.clientWidth + 1 && /hidden|clip/.test(cs.overflowX + cs.overflow)) return describe(n) + " (ellipsis)";
      if (cs.webkitLineClamp && cs.webkitLineClamp !== "none" && n.scrollHeight > n.clientHeight + 1) return describe(n) + " (line clamp)";
      if (/hidden|clip/.test(cs.overflowX) || /hidden|clip/.test(cs.overflowY)) {
        const b = n.getBoundingClientRect();
        if (rect.left < b.left - 1 || rect.right > b.right + 1 || rect.top < b.top - 1 || rect.bottom > b.bottom + 1) return describe(n) + " (overflow " + cs.overflowX + "/" + cs.overflowY + ")";
      }
    }
    return "";
  }
  // A short fade in progress would be measured half-drawn: finish every running animation first.
  if (document.getAnimations) document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* an endless one */ } });
  const offenders = [];
  let checked = 0;
  const seen = new Set();
  const flag = (el, text, why) => {
    const key = describe(el) + "|" + why;
    if (seen.has(key)) return;
    seen.add(key);
    offenders.push({ where: describe(el), text: String(text).replace(/\s+/g, " ").trim().slice(0, 50), why });
  };
  function check(el, text, rect) {
    checked += 1;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const need = min18 && el.closest(min18) ? MIN18 : MIN;
    if (size + 0.01 < need) flag(el, text, size + "px < " + need + "px");
    const fg = parse(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
    const { bg, opacity } = background(el);
    const shown = over({ r: fg.r, g: fg.g, b: fg.b, a: fg.a * opacity }, bg);
    const r = ratio(shown, bg);
    if (r + 1e-6 < RATIO) flag(el, text, "contrast " + r.toFixed(2) + " < " + RATIO + " (" + hex(shown) + " on " + hex(bg) + ")");
    const cut = clippedBy(el, rect);
    if (cut) flag(el, text, "clipped by " + cut);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.nodeValue || !t.nodeValue.trim()) continue;
    const el = t.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TITLE|OPTION)$/.test(el.tagName) || hiddenEl(el)) continue;
    range.selectNodeContents(t);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    const box = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), right: Math.max(a.right, r.right), top: Math.min(a.top, r.top), bottom: Math.max(a.bottom, r.bottom) }),
      { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    check(el, t.nodeValue, box);
  }
  // Typed text: the editor and any text box the player writes in.
  document.querySelectorAll("textarea, input[type=text], input:not([type])").forEach((el) => {
    if (hiddenEl(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return;
    check(el, el.value || el.getAttribute("aria-label") || "(editor)", { left: r.left + 1, right: r.left + 2, top: r.top + 1, bottom: r.top + 2 });
  });
  return { checked, offenders };
}

async function measureReadable(page, opts) {
  return page.evaluate(inPage, opts || {});
}
module.exports = { measureReadable, inPage };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const urls = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--url") urls.push(argv[i + 1]);
  const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
  if (!urls.length || urls.some((u) => /:(8000|9620|9630)\b/.test(u))) { console.error("usage: readable-measure.cjs --url <page> [--url <page> ...] (never ports 8000, 9620, 9630)"); process.exit(2); }
  const { chromium } = require(path.join(__dirname, "playtest-eyes/node_modules/playwright"));
  (async () => {
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: Number(arg("width", "1366")), height: Number(arg("height", "768")) } })).newPage();
    let checked = 0; const bad = [];
    try {
      for (const u of urls) {
        await page.goto(u); await page.waitForTimeout(Number(arg("wait", "600")));
        const r = await measureReadable(page, { min18: arg("min18", "") });
        checked += r.checked;
        r.offenders.forEach((o) => bad.push(u + " " + o.where + ' "' + o.text + '": ' + o.why));
      }
    } finally { await browser.close(); }
    if (bad.length) { console.log("READABLE-FAIL " + bad.length + " offender(s)"); bad.forEach((b) => console.log("  " + b)); process.exit(1); }
    console.log(`READABLE-OK (${checked} texts on ${urls.length} page(s))`);
  })().catch((e) => { console.error(e); process.exit(2); });
}

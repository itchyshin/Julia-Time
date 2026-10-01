#!/usr/bin/env node
// Readable-text gate for the frame around the lessons (gate I12, fix round 2 package P15): the Board (fresh, mid-way,
// all six chapters done), How to play (every fold open), the intro (scenes 1 to 6), the ending (scenes 1 to 6 and the
// finale) and the speed lab. Each state is measured with tools/readable-measure.cjs (at least 16px, contrast at least
// 4.5:1, nothing clipped) at 1366x768, with reduced motion so every reveal has settled.
// It serves web/ itself on a static port (--port, default 9695; never 8000, 9620 or 9630) with no Julia behind it, so
// the Board shows its "not running" state; the saved progress for each Board state is written the way the lesson
// screen writes it (web/lesson-exam-save.js through web/course/course-state.js).
// The ending asks the game for its case facts, so without a server it stops at "The game did not answer". Pass
// --base with a running Julia Time server (for example http://127.0.0.1:9699) to measure the ending's scenes, the
// finale and a Board whose Julia check is ready.
//   node tools/frame-readable.cjs [--port 9695 | --base http://127.0.0.1:96xx] [--only board|howto|intro|ending|speed]
// Prints READABLE-OK or READABLE-FAIL with every offender once (page, state, element, text, why); exit 1 on a fail.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const port = Number(arg("port", "9695")), only = arg("only", ""), given = arg("base", "");
if ([8000, 9620, 9630].includes(port) || /:(8000|9620|9630)\b/.test(given)) { console.error("never ports 8000, 9620 or 9630"); process.exit(2); }
const { chromium } = require(path.join(__dirname, "playtest-eyes/node_modules/playwright"));
const { measureReadable } = require("./readable-measure.cjs");
const courseState = require(path.join(root, "web/course/course-state.js"));
const examSave = require(path.join(root, "web/lesson-exam-save.js"));

// The ten chapter passes, as the engine's pass record carries them (test/exam-ending.test.cjs uses the same ones).
const PASSES = [
  { chapter: "C1", move_id: "select-records", row_count: 6, code: "jars[jars.batch_id .== case_batch, :]" },
  { chapter: "C2", move_id: "group", row_count: 6, code: "groupby(jars, :tray_id)" },
  { chapter: "C2", move_id: "counts", row_count: 3, code: "combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)" },
  { chapter: "C2", move_id: "rates", row_count: 3, code: "c = combine(groupby(jars, :tray_id), nrow => :n, :detected => sum => :detected_n)\nc.rate = c.detected_n ./ c.n\nc" },
  { chapter: "C3", move_id: "join-report-log", row_count: 3, code: "leftjoin(tray_counts, tally_sheet, on=:tray_id)" },
  { chapter: "C3", move_id: "filter-disagreement", row_count: 1, code: "joined[joined.notebook_detected .!= joined.sheet_detected, :]" },
  { chapter: "C4", move_id: "plan-distinct-recheck", row_count: 3, jar_ids: ["J-091", "J-092", "J-094"], code: "sample(eligible.jar_id, 3; replace=false)" },
  { chapter: "C5", move_id: "event-mask", row_count: 1000, code: "sim_counts .>= observed_count" },
  { chapter: "C5", move_id: "event-frequency", row_count: 1000, code: "e = sim_counts .>= observed_count\nsum(e) / length(e)" },
  { chapter: "C6", move_id: "compatible-models", row_count: 2, code: "stories[(stories.lower .<= observed_count) .& (observed_count .<= stories.upper), :]" },
];
function memoryStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => Array.from(m.keys())[i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), dump: () => Object.fromEntries(m) };
}
// Saved progress for a Board state: `chapters` chapter moves passed, `lessons` lessons finished.
function progress(chapters, lessons) {
  const st = memoryStorage();
  PASSES.filter((p) => Number(p.chapter.slice(1)) <= chapters).forEach((p) => examSave.saveExamPass(courseState, st, "", p, p.code));
  for (let n = 1; n <= lessons; n++) st.setItem("julia-time:lesson:v1:lesson" + n, JSON.stringify({ started: true, done: {}, lastCheckpointDone: true }));
  return st.dump();
}
const STATES = { fresh: {}, mid: progress(2, 3), done: progress(6, 6) };

(async () => {
  const web = path.join(root, "web");
  const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json", ".pdf": "application/pdf" };
  const srv = http.createServer((q, r) => {
    const f = path.join(web, decodeURIComponent(q.url.split("?")[0]));
    try { r.setHeader("content-type", types[path.extname(f)] || "text/plain"); r.end(fs.readFileSync(f)); } catch (e) { r.statusCode = 404; r.end(); }
  });
  if (!given) await new Promise((res) => srv.listen(port, res));
  const base = given ? given.replace(/\/$/, "") + "/course/" : `http://127.0.0.1:${port}/course/`;
  const browser = await chromium.launch();
  const found = new Map();
  let checked = 0, states = 0;
  const measure = async (page, label) => {
    states += 1;
    const r = await measureReadable(page);
    checked += r.checked;
    r.offenders.forEach((o) => { const k = label.split(",")[0] + " " + o.where + ": " + o.why; if (!found.has(k)) found.set(k, `${label} ${o.where} "${o.text}": ${o.why}`); });
  };
  const open = async (store, url) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
    await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); Object.keys(s).forEach((k) => localStorage.setItem(k, s[k])); sessionStorage.setItem("seeded", "1"); } } catch (e) { /* ignore */ } }, store);
    const page = await ctx.newPage();
    await page.goto(url); await page.waitForTimeout(700);
    return { page, ctx };
  };
  try {
    if (!only || only === "board") for (const name of Object.keys(STATES)) {
      const { page, ctx } = await open(STATES[name], base + "index.html");
      await page.waitForTimeout(5500);                    // the Julia check gives up after 5 s with no server
      await measure(page, `Board (${name})`);
      for (const d of await page.locator("details:visible").all()) { try { await d.evaluate((n) => { n.open = true; }); } catch (e) { /* gone */ } }
      await measure(page, `Board (${name}), folds open`);
      await ctx.close();
    }
    if (!only || only === "howto") {
      const { page, ctx } = await open({}, base + "getting-started.html");
      await measure(page, "How to play");
      await page.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; }));
      await measure(page, "How to play, every fold open");
      await ctx.close();
    }
    if (!only || only === "intro") {
      const { page, ctx } = await open({}, base + "intro.html");
      for (let n = 1; n <= 6; n++) {
        await measure(page, `Intro scene ${n}`);
        const next = page.locator("#intro-next");
        if (!(await next.isVisible())) break;
        await next.click(); await page.waitForTimeout(250);
      }
      await ctx.close();
    }
    if (!only || only === "ending") {
      const { page, ctx } = await open(STATES.done, base + "ending.html");
      await page.waitForTimeout(1500);                    // the case facts come back from the game
      for (let n = 1; n <= 7; n++) {
        const finale = await page.locator("#ending-finale").isVisible(), all = await page.locator("#ending-all").isVisible();
        // with reduced motion the ending shows its six scenes on one page, above the finale
        await measure(page, all ? "Ending, all six scenes and the finale" : finale ? "Ending finale" : `Ending scene ${n}`);
        if (finale) break;
        const next = page.locator("#ending-next");
        if (!(await next.isVisible())) break;
        await next.click(); await page.waitForTimeout(400);
      }
      if (!(await page.locator("#ending-finale").isVisible())) {
        if (await page.locator("#ending-skip").isVisible()) { await page.click("#ending-skip"); await page.waitForTimeout(500); }
        await measure(page, "Ending finale");
      }
      await ctx.close();
    }
    if (!only || only === "speed") {
      const { page, ctx } = await open({}, base + "speed-lab.html");
      await measure(page, "Speed lab");
      await ctx.close();
    }
  } finally { await browser.close(); if (!given) srv.close(); }
  if (found.size) {
    console.log(`READABLE-FAIL ${found.size} offender(s) on the frame pages (${states} states):`);
    Array.from(found.values()).forEach((l) => console.log("  " + l));
    process.exit(1);
  }
  console.log(`READABLE-OK (${checked} texts on ${states} frame states: at least 16px, contrast 4.5:1, nothing clipped)`);
})().catch((e) => { console.error(e); process.exit(2); });

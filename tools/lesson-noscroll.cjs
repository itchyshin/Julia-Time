#!/usr/bin/env node
// Calm-screen gate for the lesson screen: loads the page at 1366x768, plays every challenge, and
//   (1) the first-screen rule (Shinichi's decision D2, 30 Sep; gates I3 and I5 as reworded): the page may scroll for
//       reference material (the dictionary, notes, full tables), but on every step the task, the editor, Run, the
//       verdict and Next sit inside the first 1366x768 screen, and the page is never wider than the window. The start
//       card's Start, a warm-up card and the end page's main button must be in the first screen too. It also fails
//       (P14) when any box scrolls inside the page other than the Result block (and the editor itself), when a data
//       table of 12 rows or fewer is cut, and when the starter line shows twice (in the editor and beside it);
//   (2) counts the calm-screen budget at every step (plan section "Calm screen budget") and fails on
//       the first step that breaks it:
//         filled buttons visible ................ at most 1  (Run, Fire, Next or Start: the one main action)
//         secondary links and buttons visible ... at most 3  (inside <main>; not Run/Fire/Next, which are the one
//                                                  main action and its partner; not Reset, not the dictionary
//                                                  toggle, not answer choices, not glossary underlines, not Try it
//                                                  inside an open Look closer, not the per-line Copy buttons or wave
//                                                  buttons; the bar at the top (Julia Time, Board, Notes, Cheat sheet)
//                                                  is page chrome and is not counted; since the 0.5 fixes neither are
//                                                  the two drawer toggles that belong to the dictionary and the rule:
//                                                  the round's rule pinned as one collapsed line, and the fold that
//                                                  holds a chapter's earlier dictionary rows; nor, since fix round 2, the
//                                                  tools inside the end page's lines-and-notes fold once it is opened)
//         underlined glossary words visible ..... at most 4  (and none on a warm-up quiz; a word is underlined only the
//                                                  first time in the lesson, so a word seen underlined on an earlier
//                                                  screen must be plain now)
//         open optional boxes ................... 0 unless the player opened one (Look closer, a glossary meaning,
//                                                  a hint, Julia's own message). This tool opens them on purpose,
//                                                  every visible Look closer and glossary term, to prove that the
//                                                  page still fits and the budget still holds with each open.
//   Since the 0.5 fixes the pocket dictionary (and a chapter's earlier-rows fold) is opened on every step and measured.
//   Every `see` that carries a look_closer is opened on its own screen and measured open and after Try it; a
//   look_closer that never shows on its screen is reported (LOOK-UNSEEN) and fails the run.
//   (3) readable text (gate I12, P15): tools/readable-measure.cjs on every measured state, with the optional boxes open:
//       at least 16px (prompts and explanations 18px), contrast at least 4.5:1, nothing clipped.
//   It prints one NOSCROLL line, one BUDGET line, one READABLE line and one LOOK line: -OK, or the first breaking step
//   (and how many more; READABLE lists every offender once).
//   node tools/lesson-noscroll.cjs --lesson lessons/lesson1.json            (static web/ + fake socket)
//   node tools/lesson-noscroll.cjs --lesson lessons/lesson1.json --url http://localhost:9601/lesson.html?lesson=lesson1
// --lesson gives the solutions; --url uses a real server instead of the fake socket.
// A file with kind "range" plays the target range instead (fake socket only): every wave is opened with all lessons
// marked passed, shot once wrong and then clean, with the hint open, then Next wave, and the range end screen (which may scroll).
// Uses the Playwright in tools/playtest-eyes. Static port: --port (default 9660, never 8000).
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const lessonFile = arg("lesson"), url = arg("url"), port = Number(arg("port", "9660"));
const W = Number(arg("width", "1366")), H = Number(arg("height", "768"));
if (!lessonFile || port === 8000) { console.error("usage: lesson-noscroll.cjs --lesson <file> [--url <page>] [--port 96xx]"); process.exit(2); }
const { chromium } = require(path.join(__dirname, "playtest-eyes/node_modules/playwright"));
const { measureReadable } = require("./readable-measure.cjs");
// Prompts and explanations are read at 18px (P15); every other text at 16px or more.
const MIN18 = "#prompt, #explain, #rule-text";
// The footer line the real server adds to every lesson (src/mystery.jl MYSTERY_DATA_LABEL). Keep the two in step.
const SERVER_DATA_LABEL = "Simulated data made for this game: no real jars, no real springtails.";
const lesson = JSON.parse(fs.readFileSync(path.resolve(lessonFile), "utf8"));
// The target range (kind "range") has waves, not rounds: it has its own screen and is played by playRange() below.
const isRange = lesson.kind === "range";
if (isRange && url) { console.log("NOSCROLL-SKIP (range: the real-server run is not supported; use the fake socket)"); process.exit(0); }
const byId = {};
if (!isRange) lesson.rounds.forEach((r) => r.challenges.forEach((c) => { byId[c.id] = c; }));

// A 12-jar table shaped like the case notebook, used when the lesson names data without values.
const jars = [];
["B08", "B09"].forEach((b) => ["T-A", "T-B", "T-C"].forEach((t) => { for (let k = 0; k < 2; k++) jars.push([`J${String(jars.length + 1).padStart(2, "0")}`, b, t, k === 0]); }));
const jarTable = { columns: ["jar_id", "batch_id", "tray_id", "detected"], rows: jars };

// Real-size data for the fake mode: each `data` name and the jars rack come from the engine's own setups
// (tools/lesson-dump-data.jl writes test/fixtures/lesson-data-values.json). Without it, the 12-row table is used.
const dataFile = arg("data", path.join(root, "test", "fixtures", "lesson-data-values.json"));
let realRuns = null;
try { realRuns = JSON.parse(fs.readFileSync(path.join(root, "test", "fixtures", "lesson-solution-runs.json"), "utf8"))[lesson.id] || null; } catch (e) { /* fall back to stand-ins */ }
let realData = null;
try { realData = JSON.parse(fs.readFileSync(dataFile, "utf8"))[lesson.id] || null; } catch (e) { /* fall back */ }
if (!url && !realData && lesson.kind !== "range") console.error(`note: no real data for ${lesson.id} in ${dataFile}; using the 12-row table for every data name`);

// The case notebook's twelve jars, as the range page draws them (ids as in the range file).
const rangeJars = [];
["B08", "B09"].forEach((b, bi) => ["T-A", "T-B", "T-C"].forEach((t) => { for (let k = 0; k < 2; k++) rangeJars.push({ jar_id: `J-0${8 + bi}${rangeJars.length % 6 + 1}`, batch_id: b, tray_id: t }); }));

// The range's fake server: a shot picks the wave's own targets, or one wrong jar when the code says "wrong".
function fakeRangeInit(RANGE, JARS, SERVER_DATA_LABEL) {
  try { for (let n = 1; n <= 9; n++) localStorage.setItem("julia-time:lesson:v1:lesson" + n, JSON.stringify({ lastCheckpointDone: true })); } catch (e) { /* ignore */ }
  window.WebSocket = class {
    constructor() { this.readyState = 0; this.l = {}; setTimeout(() => { this.readyState = 1; (this.l.open || []).forEach((f) => f({})); }, 10); }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    close() {}
    send(text) {
      const m = JSON.parse(text); let out = null;
      if (m.type === "lesson_info") {
        const L = JSON.parse(JSON.stringify(RANGE));
        L.data_label = SERVER_DATA_LABEL; L.jars = JARS;
        L.waves.forEach((w) => { delete w.example; });
        out = { type: "lesson", request_id: m.request_id, lesson: L };
      } else if (m.type === "lesson_run") {
        const w = RANGE.waves.find((x) => x.id === m.challenge);
        const good = w.targets ? w.targets.slice() : w.rule.from.slice(0, w.rule.count);
        const wrong = m.code.indexOf("wrong") >= 0;
        const picked = wrong ? good.slice(0, Math.max(0, good.length - 1)).concat(JARS.map((j) => j.jar_id).filter((id) => good.indexOf(id) < 0).slice(0, 1)) : good;
        const hits = picked.filter((id) => good.indexOf(id) >= 0).length, misses = picked.length - hits;
        const missed = w.targets ? good.filter((id) => picked.indexOf(id) < 0) : [];
        const clean = !misses && hits === good.length;
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", pass: clean, value_repr: "", value_table: null, stdout: "",
          feedback: clean ? "Every target jar is picked, and no other jar." : "You picked " + misses + " jar that is not a target.", picked_ids: picked,
          range: { hits, misses, missed_targets: missed, score: hits - misses, clean, picked_ids: picked } };
      }
      setTimeout(() => (this.l.message || []).forEach((f) => f({ data: JSON.stringify(out) })), 5);
    }
  };
}

function fakeInit(LESSON, JARTABLE, REAL, SERVER_DATA_LABEL, RUNS) {
  window.WebSocket = class {
    constructor() { this.readyState = 0; this.l = {}; setTimeout(() => { this.readyState = 1; (this.l.open || []).forEach((f) => f({})); }, 10); }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    close() {}
    send(text) {
      const m = JSON.parse(text); let out = null;
      const find = (id) => { let f = null; LESSON.rounds.forEach((r) => r.challenges.forEach((c) => { if (c.id === id) f = c; })); return f; };
      if (m.type === "lesson_info") {
        const L = JSON.parse(JSON.stringify(LESSON));
        L.data_label = SERVER_DATA_LABEL;   // the real server always sets this footer line (MYSTERY_DATA_LABEL); the fake must too
        L.data_values = (REAL && REAL.data_values) || L.data_values || {};
        L.jars = (REAL ? REAL.jars : null) || L.jars || (REAL ? null : JARTABLE.rows.map((r) => ({ jar_id: r[0], batch_id: r[1], tray_id: r[2] })));
        if (!L.jars) delete L.jars;
        L.rounds.forEach((r) => r.challenges.forEach((c) => { if (c.data && !L.data_values[c.data]) L.data_values[c.data] = JARTABLE; if (c.kind === "checkpoint") delete c.solution; delete c.check; }));
        out = { type: "lesson", request_id: m.request_id, lesson: L };
      } else if (m.type === "lesson_run" && m.look) {
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", pass: false, value_repr: "42", value_table: null, stdout: "", feedback: "" };
      } else if (m.type === "lesson_run" && m.code === "(") {
        // a line Julia cannot read: the alert box and the folded "Julia's own message"
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "error", pass: false, value_repr: "", value_table: null, stdout: "",
          feedback: "Julia could not read this line. Check that every ( has its ).", message: "ParseError:\n# Error @ none:1:2\n(\n└ ── premature end of input" };
      } else if (m.type === "lesson_run") {
        const c = find(m.challenge);
        const graded = c.kind !== "play";
        const pass = graded && m.code.trim() === String(c.solution).trim();
        const big = c.board || c.data;
        const table = big ? ((REAL && c.data && REAL.data_values[c.data]) || JARTABLE) : null;
        // Round 6 (result fix): when the engine's own run of this task's solution is on file (test/fixtures/lesson-solution-runs.json,
        // written by tools/lesson-dump-runs.jl), the passing run shows the REAL result (its real print), not a stand-in.
        const real = RUNS && RUNS[m.challenge] && (m.code.trim() === String(c.solution).trim() || m.code.trim() === String(c.starter).trim()) ? RUNS[m.challenge] : null;
        if (real) {
          out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: real.status, pass,
            value_repr: real.value_repr || "", value_table: real.value_table || null, stdout: real.stdout || "", shown: real.shown, shown_caption: real.shown_caption, shown_keys: real.shown_keys,
            feedback: pass ? ((c.feedback && c.feedback.pass) || "That worked.") : ((c.feedback && c.feedback.wrong) || "Not yet.") };
          if (c.board) out.picked_ids = (REAL && REAL.jars ? REAL.jars.slice(0, 3).map((j) => j.jar_id) : JARTABLE.rows.slice(0, 3).map((r) => r[0]));
          return setTimeout(() => (this.l.message || []).forEach((f) => f({ data: JSON.stringify(out) })), 5);
        }
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", pass,
          value_repr: big ? "" : "42", value_table: table, stdout: "",
          feedback: pass ? ((c.feedback && c.feedback.pass) || "That worked.") : (graded ? ((c.feedback && c.feedback.wrong) || "Not yet. Compare your line with the goal.") : "Julia ran it.") };
        // the first three jars of the rack the screen will draw (the engine's real jars when we have them)
        if (c.board) out.picked_ids = (REAL && REAL.jars ? REAL.jars.slice(0, 3).map((j) => j.jar_id) : JARTABLE.rows.slice(0, 3).map((r) => r[0]));
      }
      setTimeout(() => (this.l.message || []).forEach((f) => f({ data: JSON.stringify(out) })), 5);
    }
  };
}

(async () => {
  let srv = null, target = url;
  if (!url) {
    const web = path.join(root, "web");
    srv = http.createServer((q, r) => {
      const f = path.join(web, q.url.split("?")[0]);
      try { r.setHeader("content-type", f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "text/html"); r.end(fs.readFileSync(f)); } catch (e) { r.statusCode = 404; r.end(); }
    });
    await new Promise((res) => srv.listen(port, res));
    target = `http://localhost:${port}/lesson.html?lesson=${lesson.id}`;
  }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  page.setDefaultTimeout(8000);
  if (!url && isRange) await page.addInitScript(`(${fakeRangeInit.toString()})(${JSON.stringify(lesson)}, ${JSON.stringify(rangeJars)}, ${JSON.stringify(SERVER_DATA_LABEL)})`);
  else if (!url) await page.addInitScript(`(${fakeInit.toString()})(${JSON.stringify(lesson)}, ${JSON.stringify(jarTable)}, ${JSON.stringify(realData)}, ${JSON.stringify(SERVER_DATA_LABEL)}, ${JSON.stringify(realRuns)})`);
  let bad = null, badBudget = null, checked = 0, readChecked = 0;
  const scrollAt = new Map(), budgetAt = new Map();     // every breaking step, by challenge (the first is the headline)
  const seenTerms = new Map();                          // underlined word -> the challenge where it first showed
  const lookOpened = new Set();                         // challenges whose Look closer was opened and measured
  let allow = 0;                    // optional boxes the tool itself has opened on this step (hints, Look closer, a meaning)
  // What is on screen now: filled buttons, secondary links and buttons, open optional boxes.
  const budgetNow = () => page.evaluate(() => {
    // Inside a closed <details> only its summary is seen (Chrome still gives the hidden content a box, so ask directly).
    const shown = (n) => { if (!n || n.hidden || n.closest("details:not([open]) > :not(summary)")) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== "hidden"; };
    const name = (n) => (n.id ? "#" + n.id : (n.tagName.toLowerCase() + (n.textContent ? " '" + n.textContent.trim().slice(0, 24) + "'" : "")));
    const filled = Array.from(document.querySelectorAll("#app button.primary")).filter(shown).map(name);
    const secondary = Array.from(document.querySelectorAll("main button, main a[href], main summary"))
      .filter((n) => shown(n) && !n.matches("button.primary, button.choice, button.term, #run, #next, #look-try, #reset, #dict > summary, #rule > summary, #dict-earlier > summary, #end-lines button, #wave-list button, #end-more[open] button"))
      .map(name);
    const boxes = [];
    ["#look-box", "#gloss-explain", "#gloss-prompt", "#gloss-feedback", ".gloss", "#julia-msg details[open]", "#hints .hint"].forEach((sel) => {
      document.querySelectorAll(sel).forEach((n) => { if (shown(n) && !boxes.includes(n)) boxes.push(n); });
    });
    // hints share one box: however many are shown, the player opened one place
    const hintBoxes = boxes.filter((n) => n.matches("#hints .hint"));
    const others = boxes.filter((n) => !n.matches("#hints .hint"));
    const open = others.length + (hintBoxes.length ? 1 : 0);
    const terms = Array.from(document.querySelectorAll("#app button.term")).filter(shown).map((n) => (n.getAttribute("data-term") || "").toLowerCase());
    const warmTerms = Array.from(document.querySelectorAll("#remember button.term")).filter(shown).length;
    return { filled, secondary, open, openNames: others.map(name).concat(hintBoxes.length ? ["hints"] : []), terms, warmTerms };
  });
  // The first-screen rule (D2) and the P14 checks, measured in the page as it stands. [] when all hold.
  const firstScreen = () => page.evaluate(() => {
    const H = innerHeight, W = innerWidth, de = document.documentElement, out = [];
    const shown = (n) => { if (!n || n.closest("[hidden]") || n.closest("details:not([open]) > :not(summary)")) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== "hidden"; };
    const name = (n) => (n.id ? "#" + n.id : n.tagName.toLowerCase() + (typeof n.className === "string" && n.className ? "." + n.className.trim().split(/\s+/).join(".") : "") + (n.parentElement && n.parentElement.id ? " in #" + n.parentElement.id : ""));
    if (de.scrollWidth > W + 1) out.push(`page ${de.scrollWidth}px wide in a ${W}px window`);
    const app = document.getElementById("app"), scr = app.getAttribute("data-screen");
    const lesson = document.getElementById("screen-lesson");
    let must = [];
    if (scr === "challenge" || scr === "range") must = lesson.getAttribute("data-warm") === "1" ? ["#remember"] : ["#prompt", "#code", "#run", "#feedback", "#next"];
    else if (scr === "start") must = ["#start"];
    else if (scr === "end") must = ["#end-go"];
    must.forEach((sel) => {
      const n = document.querySelector(sel);
      if (!shown(n) || (sel === "#feedback" && !n.textContent.trim())) return;
      const bottom = n.getBoundingClientRect().bottom + scrollY;
      if (bottom > H + 1) out.push(`${sel} ends at ${Math.round(bottom)}px, below the first ${H}px`);
    });
    // P14: no box scrolls inside the page, except the Result block (and a Look closer result), and the editor itself
    document.querySelectorAll("#app *").forEach((n) => {
      if (!shown(n) || n.matches("textarea") || n.closest("#result, #look-result")) return;
      const cs = getComputedStyle(n);
      const y = /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 2;
      const x = /(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 2;
      if (x || y) out.push(`a box scrolls inside the page: ${name(n)} (${x ? "sideways" : ""}${x && y ? ", " : ""}${y ? "up and down" : ""})`);
    });
    const box = document.getElementById("starter-box"), code = document.getElementById("code"), sc = document.getElementById("starter-code");
    if (box && shown(box) && sc.textContent.trim() && code.value.includes(sc.textContent.trim())) out.push("the starter line shows twice (in the editor and beside it)");
    document.querySelectorAll("#data .more").forEach((m) => {
      if (!shown(m)) return;
      const k = /and (\d+) more/.exec(m.textContent), rows = m.parentNode.querySelectorAll("tr").length - 1;
      if (k && rows + Number(k[1]) <= 12) out.push(`a table of ${rows + Number(k[1])} rows is cut to ${rows}`);
    });
    return out;
  });
  const resultCut = [], resultSeen = [];            // tasks whose passing run left the Result box scrolling / was looked at
  const readableAt = new Map();                       // offender -> the first step and stage it showed at
  const measure = async (cid, stage) => {
    checked += 1;
    const problems = await firstScreen();
    const rd = await measureReadable(page, { min18: MIN18 });
    rd.offenders.forEach((o) => { const k = o.where + ": " + o.why; if (!readableAt.has(k)) readableAt.set(k, `${k} "${o.text}" (first at ${cid}, ${stage})`); });
    readChecked += rd.checked;
    if (problems.length) {
      const line = `SCROLL ${cid} (${stage}): ${problems.join("; ")}`;
      if (!scrollAt.has(cid)) scrollAt.set(cid, line);
      if (!bad) {
        bad = line;
        if (arg("shot")) await page.screenshot({ path: arg("shot"), fullPage: true });
      }
    }
    const b = await budgetNow();
    const repeats = b.terms.filter((t) => seenTerms.has(t) && seenTerms.get(t) !== cid);
    b.terms.forEach((t) => { if (!seenTerms.has(t)) seenTerms.set(t, cid); });
    if (b.filled.length > 1 || b.secondary.length > 3 || b.open > allow || b.terms.length > 4 || b.warmTerms > 0 || repeats.length) {
      const line = `BUDGET ${cid} (${stage}): filled ${b.filled.length} [${b.filled.join(", ")}], secondary ${b.secondary.length} [${b.secondary.join(", ")}], open optional boxes ${b.open} [${b.openNames.join(", ")}] (allowed ${allow}), underlines ${b.terms.length} [${b.terms.join(", ")}]` +
        (b.warmTerms ? `, ${b.warmTerms} underlined on the warm-up quiz` : "") + (repeats.length ? `, already underlined earlier: ${repeats.join(", ")}` : "");
      if (!budgetAt.has(cid)) budgetAt.set(cid, line);
      if (!badBudget) {
        badBudget = line;
        if (arg("shot")) await page.screenshot({ path: arg("shot") + ".budget.png", fullPage: true });
      }
    }
  };
  // Open every visible Look closer and glossary meaning in turn, one at a time, and measure with it open.
  const exploreExtras = async (cid, stage) => {
    if (await page.locator("#look-link").isVisible()) {
      lookOpened.add(cid);
      await page.click("#look-link"); allow += 1; await measure(cid, stage + ", Look closer open");
      await page.click("#look-try"); await page.waitForFunction(() => !document.getElementById("look-try").disabled); await page.waitForTimeout(30);
      await measure(cid, stage + ", Look closer after Try it");
      await page.click("#look-link"); allow -= 1;
      await measure(cid, stage + ", Look closer closed again");
    }
    const terms = page.locator("#app button.term:visible");
    const n = await terms.count();
    for (let i = 0; i < n; i++) {
      const at = await terms.nth(i).getAttribute("data-term");
      await terms.nth(i).click(); allow += 1;
      await measure(cid, `${stage}, meaning of "${at}" open`);
      await page.locator("#app button.term:visible").nth(i).click(); allow -= 1;
      await measure(cid, `${stage}, meaning of "${at}" closed again`);
    }
  };
  const visible = (sel) => page.evaluate((s) => { const n = document.querySelector(s); return !!n && !n.hidden; }, sel);
  const run = async (code) => { await page.fill("#code", code); await page.click("#run"); await page.waitForFunction(() => !document.getElementById("run").disabled); await page.waitForTimeout(30); };
  // The target range: every wave, shot wrong then clean, then Next wave, and the end screen.
  const playRange = async () => {
    await page.goto(target);
    await page.waitForSelector("#screen-lesson:not([hidden])");
    await measure("range", "range start");
    for (let guard = 0; guard < lesson.waves.length + 3; guard++) {
      if (await visible("#screen-range-end")) break;
      const cid = await page.getAttribute("#screen-lesson", "data-cid");
      allow = 0;
      await measure(cid, "wave start");
      if (await visible("#wave-hint")) { await page.click("#wave-hint"); await measure(cid, "hint open"); await page.click("#wave-hint"); }
      await run("wrong");
      await measure(cid, "after a wrong shot");
      await run("right");
      await measure(cid, "after a clean shot");
      if (!(await visible("#next"))) { bad = bad || `${cid}: no Next wave button after a clean shot`; break; }
      await page.click("#next");
    }
    if (!(await visible("#screen-range-end"))) bad = bad || "range end screen never reached";
    else { allow = 0; await measure("range-end", "range end screen (may scroll)"); }
  };
  try {
    if (isRange) await playRange(); else {
    await page.goto(target);
    await page.waitForSelector("#start");
    await measure("start", "start screen");
    // Round 10: the story opens as short paragraphs (with a Hide toggle); fix round 2: the Show R switch off and on.
    if (await visible("#story-link")) {
      await page.click("#story-link"); await measure("start", "start screen, story open");
      await page.click("#story-link");
    }
    if (await visible("#switches")) {
      await page.click("#show-r"); await measure("start", "start screen, Show R off");
      await page.click("#show-r");
    }
    await page.click("#start");
    for (let guard = 0; guard < 200; guard++) {
      if (await visible("#screen-end")) break;
      await page.waitForSelector("#screen-lesson:not([hidden])");
      const cid = await page.getAttribute("#screen-lesson", "data-cid");
      const c = byId[cid];
      allow = 0;
      await measure(cid, "on arrival");
      if (await page.evaluate(() => document.querySelectorAll("#remember .choice").length)) {
        await measure(cid, "warm-up alone");
        await exploreExtras(cid, "warm-up alone");
        await page.click("#remember .choice"); await measure(cid, "after the quiz");
        await page.click("#remember .primary");
      }
      await measure(cid, "round start");
      // fix round 2: the round's idea, folded on later tasks, opened again must still read well
      if (await page.locator("#rule > summary").isVisible()) {
        await page.click("#rule > summary"); await measure(cid, "the round's idea opened again"); await page.click("#rule > summary");
      }
      // 0.5: the pocket dictionary opened by the player (and a chapter's earlier-rows fold) must still fit.
      if (await page.locator("#dict > summary").isVisible()) {
        const wasOpen = await page.evaluate(() => document.getElementById("dict").open);
        if (!wasOpen) { await page.click("#dict > summary"); await page.waitForTimeout(40); await measure(cid, "dictionary open"); }
        if (await page.locator("#dict-earlier > summary").isVisible()) {
          await page.click("#dict-earlier > summary"); await page.waitForTimeout(40); await measure(cid, "dictionary and its earlier rows open");
          await page.click("#dict-earlier > summary");
        }
        if (!wasOpen) await page.click("#dict > summary");
      }
      await exploreExtras(cid, "round start");
      if (await visible("#predict")) { await page.click("#predict .choice"); await measure(cid, "after a guess"); }
      if (c.kind === "play") { await run(c.starter || "1"); await measure(cid, "after run"); }
      else {
        if (c.kind !== "see") {
          await run("x"); await run("x");
          await measure(cid, "after two failed runs");
          await exploreExtras(cid, "after two failed runs");
          // a line Julia cannot read: the alert box, then Julia's own message opened
          await run("(");
          await measure(cid, "after an error");
          if (await page.locator("#julia-msg summary").isVisible()) {
            await page.click("#julia-msg summary"); allow += 1; await measure(cid, "Julia's own message open");
            await page.click("#julia-msg summary"); allow -= 1;
          }
          for (let i = 0; i < 2 && (await page.evaluate(() => !!document.querySelector("#hints button.quiet:not([disabled])"))); i++) { await page.click("#hints button.quiet:not([disabled])"); allow = 1; await measure(cid, "with a hint"); await exploreExtras(cid, "with a hint"); }
          if (await page.evaluate(() => { const b = document.getElementById("starter"); return !!b && !b.hidden && !b.disabled; })) {
            await page.click("#starter"); await measure(cid, "with the starter line");
          }
        }
        await run(c.kind === "see" ? c.starter : c.solution);
        await measure(cid, "after a passing run");
        if (arg("snap") && arg("snap").split(",").includes(cid)) await page.screenshot({ path: path.join(arg("snapdir", "."), cid + "-after-run.png") });
        // Round 6: does the Result box cut the result (an inner scroll)? Recorded for every task; a task the player is told to READ must not.
        const cut = await page.evaluate(() => { const b = document.getElementById("result"); return !!b && !b.hidden && b.scrollHeight > b.clientHeight + 2; });
        if (cut) resultCut.push(cid);
        resultSeen.push(cid);
        await exploreExtras(cid, "after a passing run");
      }
      if (await page.evaluate(() => document.getElementById("next").disabled)) { bad = bad || `${cid}: Next is still off after the solution ran`; break; }
      await page.click("#next");
    }
    if (!(await visible("#screen-end"))) bad = bad || "END screen never reached";
    else {
      allow = 0; await measure("end", "end screen (may scroll)");
      // every optional box open: the fold of lines and notes
      if (await page.locator("#end-more > summary").isVisible()) { await page.click("#end-more > summary"); await measure("end", "end screen, lines and notes open"); }
    }
    }
  } finally { await browser.close(); if (srv) srv.close(); }
  const more = (map) => (map.size > 1 ? `\n  ${map.size - 1} more screen(s): ${Array.from(map.keys()).slice(1).join(", ")}` : "");
  const looks = [];
  const rounds = lesson.rounds || [];
  rounds.forEach((r) => r.challenges.forEach((c) => { if (c.kind === "see" && c.look_closer && !lookOpened.has(c.id)) looks.push(c.id); }));
  const nLook = rounds.reduce((n, r) => n + r.challenges.filter((c) => c.kind === "see" && c.look_closer).length, 0);
  console.log(bad ? bad + more(scrollAt) : `NOSCROLL-OK (${checked} screens at ${W}x${H}: task, editor, Run, verdict and Next in the first screen; no inner scroll but the result)`);
  console.log(badBudget ? badBudget + more(budgetAt) : `BUDGET-OK (${checked} steps: at most 1 filled button, 3 secondary links, 4 underlines, no unasked open box)`);
  // The tasks that tell the player to read the result (test/fixtures/read-the-result-tasks.json): the whole result must show, no inner scroll.
  let readList = [];
  try { readList = JSON.parse(fs.readFileSync(path.join(root, "test", "fixtures", "read-the-result-tasks.json"), "utf8")).tasks.map((t) => t.id); } catch (e) { /* no list */ }
  const mine = readList.filter((id) => byId[id]), cutMine = mine.filter((id) => resultCut.includes(id));
  console.log(cutMine.length ? `RESULT-CUT ${cutMine.join(", ")}: the Result box scrolls inside a task that tells the player to read it` : `RESULT-WHOLE-OK (${mine.length} read-the-result task(s) here; the whole result shows with no inner scroll. Other tasks with a capped result: ${resultCut.filter((id) => !mine.includes(id)).join(", ") || "none"})`);
  const unreadable = readableAt.size > 0 || cutMine.length > 0;
  if (unreadable) { console.log(`READABLE-FAIL ${readableAt.size} offender(s):`); Array.from(readableAt.values()).forEach((l) => console.log("  " + l)); }
  else console.log(`READABLE-OK (${readChecked} texts on ${checked} states: at least 16px, prompts and explanations 18px, contrast 4.5:1, nothing clipped)`);
  if (isRange) { process.exit(bad || badBudget || unreadable ? 1 : 0); }
  console.log(looks.length ? `LOOK-UNSEEN ${looks.join(", ")}: the look_closer never shows on its own screen (a see on a round's first screen loses it to test-out)` : `LOOK-OK (${nLook} Look closer box(es) opened on their own screen and measured open)`);
  process.exit(bad || badBudget || unreadable || looks.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

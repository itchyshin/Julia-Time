#!/usr/bin/env node
// Review capture for Julia Time 0.5 (review round 4). Driven by the coverage inventory
// (docs/dev-log/course/0.5-inventory.md, gate I13): every inventory item is either captured (a PNG),
// played (a result text is recorded), or listed as NOT CAPTURED with a reason, in DIR/MANIFEST.md.
//
//   node tools/review-capture.cjs --base http://127.0.0.1:9668 --out /tmp/shots --group Board
//   node tools/review-capture.cjs --base ... --out DIR --group all
//   node tools/review-capture.cjs --dry-run                      (no server needed)
//
// Options: --group NAME[,NAME]|all   (base names; a group that outgrows ~75 images gets parts NAME, NAME-b, ...)
//          --lessons DIR   lessons/*.json the server was started from (default: ../lessons of this tool)
//          --inventory FILE   (default: docs/dev-log/course/0.5-inventory.md next to this tool)
//          --webroot DIR   web/ folder, used only for the "opened from a file" Board state (default ../web)
//          --no-errors     do not play every feedback.errors example (faster; fewer "played" records)
//          --rebuild-cache rebuild the saved-progress snapshots (OUT/.cache) instead of reusing them
//          --ids A,B       run only steps that cover one of these inventory ids (debugging)
// Uses the Playwright in tools/playtest-eyes. Never use port 8000. See docs/dev-log/course/review-capture.md.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const flag = (n) => argv.includes("--" + n);
const BASE = (arg("base", "") || "").replace(/\/+$/, "");
const OUT = arg("out", "");
const GROUPSEL = (arg("group", "all") || "all").split(",").map((s) => s.trim()).filter(Boolean);
const LESSONS = path.resolve(arg("lessons", path.join(ROOT, "lessons")));
const INVENTORY = path.resolve(arg("inventory", path.join(ROOT, "docs/dev-log/course/0.5-inventory.md")));
const WEBROOT = path.resolve(arg("webroot", path.join(path.dirname(LESSONS), "web")));
const DRY = flag("dry-run"), NOERR = flag("no-errors"), REBUILD = flag("rebuild-cache");
const ONLYIDS = (arg("ids", "") || "").split(",").filter(Boolean);
const MAXPART = 66;                    // a new part starts at the first task boundary after this many images (parts end near 75)
if (/:8000(\/|$)/.test(BASE)) { console.error("refusing port 8000"); process.exit(2); }

// ------------------------------------------------------------------------------------------------ inventory
function parseInventory(file) {
  const items = []; let sec = "";
  for (const ln of fs.readFileSync(file, "utf8").split("\n")) {
    let m = /^## ([A-Z]\d?)\./.exec(ln); if (m) { sec = m[1]; continue; }
    m = /^- \[ \] ([A-Za-z0-9-]+): (.*)$/.exec(ln); if (m) items.push({ id: m[1], text: m[2], sec });
  }
  return items;
}
const INV = parseInventory(INVENTORY);
const INVIDS = new Set(INV.map((x) => x.id));
function itemGroup(it) {
  const id = it.id, s = it.sec;
  if (s === "A") {
    if (/^PG-N/.test(id)) return "Other";
    if (id === "PG-01") return "Board";
    if (/^PG-(02|03|GH|JL)$/.test(id)) return "Guide";
    let m = /^PG-L(\d)$/.exec(id); if (m) return "Lesson" + m[1];
    if (/^PG-X/.test(id)) return "Chapters";
    if (id === "PG-R") return "Range";
    return "Ending";
  }
  if (s === "B") return "Board";
  if (s === "C" || s === "D") return "Guide";
  if (s === "E") return /^LS-(7[2-9]|11[0-4])$/.test(id) ? "Range" : "Screen";
  if (/^F\d$/.test(s)) return "Lesson" + s[1];
  if (/^G\d$/.test(s)) return "Chapters";
  if (s === "H") return "Range";
  if (s === "I" || s === "J") return "Ending";
  if (s === "L") return "Other";
  return "States";
}

// ------------------------------------------------------------------------------------------------ small helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Skip extends Error {}
const J = (f) => JSON.parse(fs.readFileSync(path.join(LESSONS, f + ".json"), "utf8"));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const OLD_KEYS = { uses: "julia-time:uses-r:v1", lang: "julia-time:notes-lang:v1", intro: "julia-time:intro-seen:v1" };

// A realistic wrong line per task. Each feedback.errors entry carries an `example`; classify it as one of the four
// mistakes a novice makes (dropped dot, misspelt name, R syntax, wrong bracket), then pick by round so the four show up.
const CATS = ["dot", "name", "r", "bracket"];
function balanced(s) { let a = 0, b = 0, c = 0; for (const ch of s) { if (ch === "(") a++; if (ch === ")") a--; if (ch === "[") b++; if (ch === "]") b--; if (ch === "{") c++; if (ch === "}") c--; } return a === 0 && b === 0 && c === 0; }
function catOf(ex, err) {
  const say = String((err && err.say) || "") + " " + String((err && err.match) || "");
  if (/\$|<-|\bc\(/.test(ex)) return "r";
  if (!balanced(ex) || /Expected|bracket|unbalanced/i.test(say)) return "bracket";
  if (/\bdot\b|broadcast|\.==|\.!=|\.&/i.test(say)) return "dot";
  return "name";
}
function mutate(sol, cat) {
  const s = String(sol);
  const fn = {
    dot: () => s.replace(/([A-Za-z_0-9)\]])\.([A-Za-z_]|==|!=|&|\|)/, (m, a, b) => a + b),
    name: () => { const m = (s.match(/[A-Za-z_][A-Za-z_0-9]{3,}/g) || []).find((x) => !/^(true|false|nothing|using|function|return|rand|first|last)$/.test(x)); return m ? s.replace(m, m.slice(0, 2) + m.slice(3)) : s; },
    r: () => (/\./.test(s) ? s.replace(/([A-Za-z_]+)\.([A-Za-z_]+)/, "$1$$$2") : "x <- " + s),
    bracket: () => s.replace(/[\]\)]\s*$/, ""),
  }[cat];
  const out = fn ? fn() : s;
  return out !== s && out.trim() ? out : s.slice(0, Math.max(1, s.length - 2)) + "x";
}
function pickWrongOuter(c, ri) { return pickWrong(c, ri); }
function pickWrong(c, ri) {
  const errs = (c.feedback && c.feedback.errors || []).filter((e) => e && typeof e.example === "string" && e.example.trim() && e.example.trim() !== String(c.solution || "").trim());
  const tagged = errs.map((e) => ({ code: e.example, cat: catOf(e.example, e), say: e.say }));
  for (let k = 0; k < 4; k++) {
    const cat = CATS[(ri + k) % 4], hit = tagged.find((t) => t.cat === cat);
    if (hit) return { pick: hit, all: tagged };
  }
  if (tagged.length) return { pick: tagged[0], all: tagged };
  const cat = CATS[ri % 4];
  return { pick: { code: mutate(c.solution || c.starter || "x", cat), cat: cat + "-generated" }, all: [] };
}

// ------------------------------------------------------------------------------------------------ plan
// A scenario owns a browser context; its steps run in order. A step covers inventory ids with one picture (or none: noshot).
const NO_PATH = {
  "LS-06": "the 'Connecting to Julia...' text is shown for a split second; captured as 'Not connected' only",
};
const PLAN = [];
function scenario(name, group, opts) { const sc = { name, group, opts: opts || {}, steps: [] }; PLAN.push(sc); return sc; }
function step(sc, ids, state, fn, o) {
  ids = (ids || []).filter((x) => { if (INVIDS.has(x)) return true; if (!step.warned[x]) { step.warned[x] = 1; console.error(`note: step names unknown inventory id ${x}`); } return false; });
  const st = Object.assign({ ids, state, fn, full: false, noshot: false, start: false, est: 1, optional: false }, o || {});
  sc.steps.push(st); return st;
}
step.warned = {};
const imagesOf = (st) => (st.noshot || st.est === 0 ? 0 : st.est + (st.full ? 0.5 : 0));

// ------------------------------------------------------------------------------------------------ page helpers
const vis = (cx, sel) => cx.page.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; }, sel);
const txt = (cx, sel) => cx.page.evaluate((s) => { const e = document.querySelector(s); return e ? (e.innerText || e.textContent || "").trim() : ""; }, sel);
async function goto(cx, p) { await cx.page.goto(BASE + "/" + p.replace(/^\//, "")); await cx.page.waitForLoadState("load"); await sleep(450); }
async function seed(cx, kv) {           // put localStorage keys in this origin, then the caller navigates
  await goto(cx, "course/getting-started.html");
  await cx.page.evaluate((o) => { Object.keys(o).forEach((k) => localStorage.setItem(k, typeof o[k] === "string" ? o[k] : JSON.stringify(o[k]))); }, kv);
}
async function screenOf(cx) { return cx.page.getAttribute("#app", "data-screen"); }
async function curCid(cx) { return (await screenOf(cx)) === "challenge" ? cx.page.getAttribute("#screen-lesson", "data-cid") : null; }
async function openLesson(cx, id, q) {
  await goto(cx, `lesson.html?lesson=${id}${q || ""}`);
  await cx.page.waitForFunction(() => { const a = document.getElementById("app"); return a && a.dataset.screen && a.dataset.screen !== "loading"; }, null, { timeout: 30000 });
  await sleep(250);
}
async function runCode(cx, code) {
  await cx.page.fill("#code", code);
  await cx.page.click("#run");
  await cx.page.waitForFunction(() => !document.getElementById("run").disabled, null, { timeout: 75000 });
  await sleep(250);
  if (await cx.page.$("#wave-list")) await sleep(1700);   // range: let the sweep settle before the shot
  return { fb: await txt(cx, "#feedback"), res: await txt(cx, "#result"), pass: !(await cx.page.$eval("#next", (e) => e.disabled).catch(() => true)) };
}
async function passWarm(cx) {
  if ((await cx.page.getAttribute("#screen-lesson", "data-warm").catch(() => "0")) !== "1") return;
  if (await vis(cx, "#skip-warm")) { await cx.page.click("#skip-warm"); await sleep(200); return; }
  if (await vis(cx, "#remember .choice")) { await cx.page.click("#remember .choice"); await sleep(200); }
  if (await vis(cx, "#start-round")) { await cx.page.click("#start-round"); await sleep(200); }
}
// Get to task `cid` by solving whatever stands in the way (screens before it are not photographed here).
async function ensureTask(cx, L, cid, keepWarm) {
  const order = []; L.rounds.forEach((r) => r.challenges.forEach((c) => order.push(c)));
  const want = order.findIndex((c) => c.id === cid);
  for (let g = 0; g < 80; g++) {
    const scr = await screenOf(cx);
    if (scr === "start") { await cx.page.click("#start"); await sleep(250); continue; }
    if (scr === "end") throw new Skip(`end page reached before ${cid}`);
    if (scr !== "challenge") throw new Skip(`screen is ${scr}, not a task`);
    const cur = await curCid(cx), at = order.findIndex((c) => c.id === cur);
    if (cur === cid && keepWarm) return;
    await passWarm(cx);
    if (cur === cid) return;
    if (at < 0 || at > want) throw new Skip(`cannot reach ${cid} from ${cur}`);
    const c = order[at];
    if (c.kind !== "play" && !(await cx.page.$eval("#next", (e) => !e.disabled))) await runCode(cx, c.solution || c.starter || "1");
    await cx.page.click("#next"); await sleep(250);
  }
  throw new Skip(`gave up reaching ${cid}`);
}
async function solveAll(cx, L, q) {            // fast: play a whole lesson or chapter with the solutions, no pictures
  await openLesson(cx, L.id, q);
  const order = []; L.rounds.forEach((r) => r.challenges.forEach((c) => order.push(c)));
  for (let g = 0; g < order.length * 2 + 20; g++) {
    const scr = await screenOf(cx);
    if (scr === "end") return;
    if (scr === "start") { await cx.page.click("#start"); await sleep(200); continue; }
    const cur = await curCid(cx), c = order.find((x) => x.id === cur);
    if (!c) throw new Error("unknown task " + cur);
    await passWarm(cx);
    if (c.kind !== "play" && !(await cx.page.$eval("#next", (e) => !e.disabled))) {
      const r = await runCode(cx, c.solution || c.starter || "1");
      if (!r.pass) throw new Error(`solution of ${cur} did not pass: ${clip(r.fb, 120)}`);
    }
    await cx.page.click("#next"); await sleep(200);
  }
  throw new Error("solveAll did not reach the end of " + L.id);
}
async function boardReady(cx, ms) {
  await cx.page.waitForFunction(() => { const t = (document.getElementById("julia-line") || {}).textContent || ""; return /ready|not ready|did not answer|from a file|needs|Reconnect/i.test(t) && !/connecting|starting/i.test(t); }, null, { timeout: ms || 40000 }).catch(() => {});
  await cx.page.waitForFunction(() => !/^Loading/.test((document.getElementById("board-status") || {}).textContent || "Loading"), null, { timeout: 8000 }).catch(() => {});
  await sleep(400);
}
async function openBoard(cx, q, opts) { await goto(cx, "course/index.html" + (q || "")); if (!(opts && opts.quick)) await boardReady(cx); }

// Mocks over the page's WebSocket (Playwright routeWebSocket).
async function mockSetup(page, mode, reason) {
  await page.routeWebSocket(/.*/, (ws) => {
    const srv = ws.connectToServer();
    ws.onMessage((m) => {
      let j = null; try { j = JSON.parse(String(m)); } catch (e) { /* not json */ }
      if (j && j.type === "setup_status") {
        if (mode === "silent") return;
        const bad = mode === "bad";
        ws.send(JSON.stringify({ contract_version: "setup-v1", host: "127.0.0.1", laboratory: { state: "not_checked" }, request_id: j.request_id, server_version: "0.2.5", type: "setup_status",
          story: { checked_at: "2026-09-30T12:00:00", component: "julia", contract_version: "setup-v1", reason: bad ? reason : "JULIA_READY", state: bad ? "needs_attention" : "ready", version: reason === "JULIA_UNSUPPORTED" ? "1.11.2" : "1.10.0",
            next_action: reason === "JULIA_UNSUPPORTED" ? "Julia Time needs Julia 1.10.x. Select Julia 1.10, then restart the supplied launcher." : "Julia Time's sandbox did not respond. Close and restart the supplied launcher, then use Check Julia again. If it still fails, show the facilitator this message." } }));
        return;
      }
      srv.send(m);
    });
    srv.onMessage((m) => ws.send(m));
    ws.onClose(() => { try { srv.close(); } catch (e) { /* closed */ } });
  });
}
async function hookWS(cx) {                      // pass-through socket we can cut: cx.hook.dropRun, cx.hook.refuse, cx.hook.cut()
  const hook = cx.hook = { dropRun: false, refuse: false, sockets: [], cut() { hook.sockets.forEach((w) => { try { w.close(); } catch (e) { /* gone */ } }); hook.sockets = []; } };
  await cx.page.routeWebSocket(/.*/, (ws) => {
    if (hook.refuse) { ws.close(); return; }
    const srv = ws.connectToServer(); hook.sockets.push(ws);
    ws.onMessage((m) => { if (hook.dropRun && /"lesson_run"/.test(String(m))) { ws.close(); return; } srv.send(m); });
    srv.onMessage((m) => ws.send(m));
    ws.onClose(() => { try { srv.close(); } catch (e) { /* closed */ } });
  });
}
async function mkPage(ctx) { const p = await ctx.newPage(); p.setDefaultTimeout(40000); p.on("dialog", (d) => d.accept().catch(() => {})); return p; }
const lsKeys = (cx) => cx.page.evaluate(() => Object.keys(localStorage).sort());

// The starter line is offered only after two runs that missed: make those misses (never more than three runs).
async function needStarter(cx, c) {
  for (let g = 0; g < 3 && !(await vis(cx, "#starter")); g++) await runCode(cx, mutate(c.solution || "x", CATS[(g + 1) % 4]));
  if (!(await vis(cx, "#starter"))) throw new Skip("Show a starter line not offered after two misses");
}
// ------------------------------------------------------------------------------------------------ lesson / chapter walker
// One lesson or chapter: start card, every task (before, one realistic wrong run, helps, after a correct run), the end page.
function lessonSteps(sc, f) {
  const L = J(f), isExam = L.kind === "exam", n = L.number || Number(/\d+/.exec(f)[0]);
  const P = (isExam ? "X" : "L") + n, pg = "PG-" + (isExam ? "X" : "L") + n;
  const tasks = []; L.rounds.forEach((r, ri) => r.challenges.forEach((c, ci) => tasks.push({ r, ri, c, ci })));
  const S = (ids, state, fn, o) => step(sc, ids, state, fn, o);
  const here = async (cx, cid) => { if ((await curCid(cx)) !== cid) throw new Skip(`task ${cid} not on screen`); };
  S([`${P}-start`, pg, ...(n === 1 && !isExam ? ["ST-02"] : [])], "start-card", async (cx) => { await openLesson(cx, L.id); if ((await screenOf(cx)) !== "start") throw new Skip("not on the start card (saved progress?)"); }, { full: true, start: true });
  if (!isExam) S([`${P}-start`], "start-story-open", async (cx) => { if (!(await vis(cx, "#story-link"))) throw new Skip("no story_more on this lesson"); await cx.page.click("#story-link"); await sleep(250); }, { full: true });
  S([], "begin", async (cx) => { if (await vis(cx, "#story-link")) { const open = await cx.page.getAttribute("#story-link", "aria-expanded"); if (open === "true") await cx.page.click("#story-link"); } await cx.page.click("#start"); await sleep(300); }, { noshot: true });
  let round = -1, ckN = 0, glossDone = false, lineShownInRound = {}, resetDone = false;
  tasks.forEach((t) => {
    const { r, ri, c, ci } = t, cid = c.id, rid = `${P}-r${ri + 1}`, graded = !["see", "play"].includes(c.kind);
    const roundIds = ci === 0 ? [rid] : [];
    if (ci === 0 && r.remember && r.remember.choices) {
      S([rid, ...(n === 1 && !isExam && ri === 1 ? ["LS-85"] : [])], `warm-up`, async (cx) => { await ensureTaskTo(cx, L, cid, true); if ((await cx.page.getAttribute("#screen-lesson", "data-warm")) !== "1") throw new Skip("no warm-up gate on screen"); }, { start: true, full: "auto" });
      S([rid], `warm-up-answered`, async (cx) => { await cx.page.click("#remember .choice"); await sleep(250); }, { full: "auto" });
      S([], "warm-up-start", async (cx) => { if (await vis(cx, "#start-round")) { await cx.page.click("#start-round"); await sleep(250); } }, { noshot: true });
    }
    S([cid, ...(c.recall ? ["LS-92"] : []), ...(roundIds.length && !(r.remember && r.remember.choices) ? roundIds : [])], "before", async (cx) => { await ensureTask(cx, L, cid); await passWarm(cx); await sleep(200); cx.cur = cid; }, { full: "auto", start: !(ci === 0 && r.remember && r.remember.choices) });
    const R = async (cx, code) => { await here(cx, cid); return runCode(cx, code); };
    if (isExam && ri === 0 && ci === 0) {
      S([`${P}-dict`], "chapter-dictionary-open", async (cx) => { await here(cx, cid); if (!(await vis(cx, "#dict"))) throw new Skip("no pocket dictionary on this chapter step"); await cx.page.evaluate(() => { document.getElementById("dict").open = true; const e = document.getElementById("dict-earlier"); if (e && !e.hidden) e.open = true; }); await sleep(250); }, { full: "auto" });
    }
    if (c.look_closer) {
      S([cid], "look-closer", async (cx) => { await here(cx, cid); if (!(await vis(cx, "#look-link"))) throw new Skip("Look closer not shown"); await cx.page.click("#look-link"); await sleep(250); }, { full: "auto" });
      S([cid], "look-closer-tried", async (cx) => { await here(cx, cid); await cx.page.click("#look-try"); await cx.page.waitForFunction(() => { const e = document.getElementById("look-result"); return e && !e.hidden && e.textContent.trim(); }, null, { timeout: 40000 }).catch(() => {}); await sleep(250); cx.note = await txt(cx, "#look-result"); }, { full: "auto" });
      S([], "look-close", async (cx) => { if ((await vis(cx, "#look-box"))) await cx.page.click("#look-link"); }, { noshot: true });
    }
    if (!glossDone && !isExam) {   // a chapter has no glossary; the walk would otherwise run the whole chapter to its end page
      glossDone = true;
      S(isExam ? [] : [`${P}-gloss`, ...(n === 1 ? ["LS-51"] : [])], "glossary-word-open", async (cx) => {
        for (let g = 0; g < 12; g++) { await ensureTaskAny(cx, L); if (await vis(cx, "#screen-lesson .term")) { await cx.page.click("#screen-lesson .term"); await sleep(250); return; } await advanceOne(cx, L); }
        throw new Skip("no underlined glossary word found in the first screens");
      }, { optional: true });
    }
    if (c.kind === "see") {
      if (c.predict) S([cid], "predicted", async (cx) => { await here(cx, cid); if (!(await vis(cx, "#predict .choice"))) throw new Skip("no prediction box"); await cx.page.click(`#predict .choice >> nth=${(ri + ci) % 3}`); await sleep(250); }, { full: "auto" });
      S([cid], "after-run", async (cx) => { const r0 = await R(cx, c.solution || c.starter || "1"); cx.note = clip(r0.fb + " | " + r0.res, 160); }, { full: "auto" });
    } else if (c.kind === "play") {
      S([cid], "after-run", async (cx) => { const r0 = await R(cx, c.starter || c.solution || "1 + 1"); cx.note = clip(r0.res, 120); }, { full: "auto" });
    } else {
      const { pick, all } = pickWrong(c, ri);
      S([cid], `wrong-${pick.cat}`, async (cx) => { const r0 = await R(cx, pick.code); cx.note = `ran ${clip(pick.code, 70)} -> ${clip(r0.fb, 140)}`; if (r0.pass) throw new Skip("the chosen wrong line passed"); if (await vis(cx, "#julia-msg summary")) { await cx.page.click("#julia-msg summary").catch(() => {}); await sleep(200); } }, { full: "auto" });
      if (!NOERR && all.length > 1) S([cid], "errors-played", async (cx) => {
        await here(cx, cid); const out = [];
        for (const e of all) { if (e.code === pick.code) continue; const r0 = await runCode(cx, e.code); out.push(`${clip(e.code, 50)} => ${clip(r0.fb, 90)}`); if (r0.pass) { out.push("(passed; stopped)"); break; } }
        cx.note = out.join(" || ");
      }, { noshot: true });
      if (!isExam && ["change", "fix", "complete", "write"].includes(c.kind) && !lineShownInRound[ri]) {
        lineShownInRound[ri] = true;
        S([cid], "show-me-the-line", async (cx) => {
          await here(cx, cid);
          for (let g = 0; g < 3 && !(await vis(cx, "#show-line")); g++) await runCode(cx, mutate(c.solution || "x", CATS[(g + 1) % 4]));
          if (!(await vis(cx, "#show-line"))) throw new Skip("Show me the line never offered");
          if (ri === 0) { await cx.page.screenshot({ path: path.join(cx.dir(), `${cid}--show-me-the-line-offered.png`) }); cx.extra.push(`${cid}--show-me-the-line-offered.png`); }
          await cx.page.click("#show-line"); await sleep(300);
        }, { full: "auto" });
        if (ri === 0 && !resetDone) { resetDone = true; S([cid], "reset", async (cx) => { await here(cx, cid); await cx.page.click("#reset"); await sleep(300); }, { full: "auto" }); }
      }
      if (c.kind === "checkpoint") {
        const useStarter = isExam ? ckN % 2 === 0 : true, useHints = isExam ? ckN % 2 === 1 : true;
        ckN++;
        if (useHints && Array.isArray(c.hints) && c.hints.length) {
          S([cid], "hint-1", async (cx) => {
            await here(cx, cid);
            for (let g = 0; g < 3 && !(await vis(cx, "#hints button.quiet")); g++) await runCode(cx, mutate(c.solution || "x", CATS[(g + 2) % 4]));
            if (!(await vis(cx, "#hints button.quiet"))) throw new Skip("hint button never appeared");
            await cx.page.click("#hints button.quiet"); await sleep(300);
          }, { full: "auto" });
          if (!isExam && ri === 0 && c.hints.length > 1) S([cid], "hint-2", async (cx) => { await here(cx, cid); if (!(await vis(cx, "#hints button.quiet"))) throw new Skip("no second hint"); await cx.page.click("#hints button.quiet"); await sleep(300); }, { full: "auto" });
        }
        if (useStarter && c.starter_hint) S([cid], "starter-line", async (cx) => { await here(cx, cid); await needStarter(cx, c); await cx.page.fill("#code", ""); await cx.page.dispatchEvent("#code", "input"); if (!(await vis(cx, "#starter"))) throw new Skip("Show a starter line not offered"); await cx.page.click("#starter"); await sleep(300); cx.note = "offered after two misses"; }, { full: "auto" });
      }
      S([cid, ...(c.recall ? ["LS-92"] : [])], "after-correct", async (cx) => { const r0 = await R(cx, c.solution); if (!r0.pass) throw new Skip(`solution did not pass: ${clip(r0.fb, 100)}`); cx.note = clip(r0.fb, 160); }, { full: "auto" });
      if (c.kind === "checkpoint" && !isExam) S([`${P}-dict`], `dictionary-round-${ri + 1}`, async (cx) => { await here(cx, cid); if (!(await vis(cx, "#dict"))) throw new Skip("no pocket dictionary on screen"); await cx.page.evaluate(() => { document.getElementById("dict").open = true; }); await sleep(250); }, { full: "auto" });
    }
    S([], "next", async (cx) => { await here(cx, cid); if (await cx.page.$eval("#next", (e) => !e.disabled)) { await cx.page.click("#next"); await sleep(300); } }, { noshot: true });
  });
  S([`${P}-end`, "LS-96", ...(isExam ? ["LS-97"] : [])], "end-page", async (cx) => { await ensureEnd(cx, L); await sleep(900); const who = await cx.page.evaluate(() => { const e = document.getElementById("delight-say"); return e ? e.textContent.trim() : "no character line"; }); cx.note = "character line: " + clip(who, 140) + (isExam ? " | picture: " + (await vis(cx, ".delight-art img")) : ""); }, { full: true, start: true });
  if (isExam) S([`${P}-endbtn`], "end-page-main-button", async (cx) => {
    if ((await screenOf(cx)) !== "end") throw new Error("not on the end page");
    await cx.page.waitForSelector("#end-go a, #end-go button", { state: "visible", timeout: 8000 }).catch(() => {});
    const t = await txt(cx, "#end-go"), want = n >= 6 ? "See how the case ends" : "Continue: Lesson " + (n + 1);
    cx.note = `main button text: "${t}"; expected "${want}"`;
    if (t !== want) throw new Error(`MISSING OR WRONG main button on the end page: "${t}" (expected "${want}")`);
  }, { full: "auto" });
  S([`${P}-end`], "end-fold-open", async (cx) => { if (!(await vis(cx, "#end-more > summary"))) throw new Skip("no end fold"); await cx.page.evaluate(() => { document.getElementById("end-more").open = true; }); await sleep(300); }, { full: true });
  return { L, P };
}
async function ensureTaskTo(cx, L, cid, keepWarm) { try { await ensureTask(cx, L, cid, keepWarm); } catch (e) { if (!(e instanceof Skip)) throw e; if (!/not a task|gave up/.test(e.message) && (await curCid(cx)) !== cid) throw e; } }
async function ensureTaskAny(cx, L) { if ((await screenOf(cx)) === "start") { await cx.page.click("#start"); await sleep(250); } if ((await screenOf(cx)) !== "challenge") throw new Skip("not on a task"); }
async function advanceOne(cx, L) {
  const order = []; L.rounds.forEach((r) => r.challenges.forEach((c) => order.push(c)));
  const cur = await curCid(cx), c = order.find((x) => x.id === cur); if (!c) return;
  await passWarm(cx);
  if (c.kind !== "play" && !(await cx.page.$eval("#next", (e) => !e.disabled))) await runCode(cx, c.solution || c.starter || "1");
  await cx.page.click("#next"); await sleep(250);
}
async function ensureEnd(cx, L) {
  for (let g = 0; g < 60 && (await screenOf(cx)) !== "end"; g++) { if ((await screenOf(cx)) === "start") { await cx.page.click("#start"); await sleep(250); continue; } if ((await screenOf(cx)) !== "challenge") throw new Skip("not on a task or the end page"); await advanceOne(cx, L); }
  if ((await screenOf(cx)) !== "end") throw new Skip("end page not reached");
  await sleep(400);
}

// ------------------------------------------------------------------------------------------------ scenarios
const LESSON_FILES = ["lesson1", "lesson2", "lesson3", "lesson4", "lesson5", "lesson6"];
const EXAM_FILES = ["exam1", "exam2", "exam3", "exam4", "exam5", "exam6"];

// ---- Lessons F1..F6, Chapters G1..G6
LESSON_FILES.forEach((f, i) => { const sc = scenario(`${f} walk`, "Lesson" + (i + 1), {}); lessonSteps(sc, f); });
EXAM_FILES.forEach((f, i) => { const sc = scenario(`${f} walk`, "Chapters", {}); lessonSteps(sc, f); });

// ---- Range H
(function rangeScenarios() {
  const RG = J("range"), W = RG.waves;
  const ALLOPEN = { "julia-time:lesson:v1:lesson6": { lastCheckpointDone: true, started: true } };
  const sc = scenario("range all open", "Range", { seed: ALLOPEN });
  const S = (ids, state, fn, o) => step(sc, ids, state, fn, o);
  const lvl = async (cx, k) => { const btns = cx.page.locator("#wave-list button"); const nb = await btns.count(); if (nb < k) throw new Skip(`only ${nb} level buttons`); await btns.nth(k - 1).click(); await sleep(300); };
  S(["R-start", "PG-R", "LS-72", "LS-73", "LS-03", "R-ladder", "R-cols", "R-w1", "R-open", "R-ctl", "LS-74", "LS-76", "LS-110"], "level1-before", async (cx) => { await openLesson(cx, "range"); if ((await screenOf(cx)) !== "range") throw new Skip("not the range screen"); }, { full: true });
  S(["R-w1", "LS-75"], "level1-hint", async (cx) => { await cx.page.click("#wave-hint"); await sleep(250); }, { full: "auto" });
  S(["R-nobar"], "lesson-bar-sound-button-hidden", async (cx) => { cx.note = "bar Sound button hidden: " + (await cx.page.evaluate(() => { const e = document.getElementById("delight-sound"); return e ? String(e.hidden || getComputedStyle(e).display === "none") : "not in the page"; })) + " | range button: " + (await txt(cx, "#range-sound")); }, { full: "auto" });
  S(["R-note", "LS-77"], "protected-input-line-on-the-range", async (cx) => { const r0 = await runCode(cx, "logbook.detected .= true; logbook.jar_id[1:1]"); cx.note = `no protected-input note appeared (the range protects no input): ${clip(r0.fb, 120)}`; }, { full: "auto" });
  S(["R-note", "LS-77"], "real-julia-error-shows-its-own-message", async (cx) => { await runCode(cx, "logbook[3:4"); if (await vis(cx, "#julia-msg summary")) { await cx.page.click("#julia-msg summary").catch(() => {}); await sleep(200); } cx.note = "Julia's own message fold shown: " + (await vis(cx, "#julia-msg")); }, { full: "auto" });
  W.forEach((w, k) => {
    const id = `R-w${k + 1}`, n = k + 1;
    if (k > 0) S([id, "LS-73"], `level${n}-before`, async (cx) => { const cur = await cx.page.evaluate(() => (document.querySelector("#wave-list [aria-current],#wave-list .on,#wave-list [aria-pressed=true]") || {}).textContent || ""); if (!new RegExp("Level " + n + "\\b").test(cur)) await lvl(cx, n); }, { full: "auto" });
    if ([0, 3, 6, 10].includes(k) && k > 0) S([id, "LS-75"], `level${n}-hint`, async (cx) => { if (!(await vis(cx, "#wave-hint"))) throw new Skip("no hint button"); if ((await txt(cx, "#wave-hint")) !== "Hide the hint") await cx.page.click("#wave-hint"); await sleep(250); }, { full: "auto" });
    const ex = w.example || "";
    const wrong = k === 0 ? "logbook.jar_id[8]" : k === 1 ? "logbook[3:4,:]" : k === 2 ? "logbook[logbook.batch_id==\"B04\",:]" : k === 6 ? "first(shuffle(logbook.jar_id),4)" : mutate(ex, CATS[k % 4]);
    S([id, "LS-77", "LS-76"], `level${n}-miss`, async (cx) => { const r0 = await runCode(cx, wrong); cx.note = `ran ${clip(wrong, 70)} -> ${clip(await txt(cx, "#feedback"), 140)}`; if (await vis(cx, "#julia-msg summary")) { await cx.page.click("#julia-msg summary").catch(() => {}); await sleep(200); } }, { full: "auto" });
    if (k === 3) S([id, "LS-77"], "level4-rows-not-the-id-column-refused", async (cx) => { await runCode(cx, "logbook[logbook.tray_id .== \"T-E\", :]"); cx.note = clip(await txt(cx, "#feedback"), 200); }, { full: "auto" });
    if (k === 8) S([id, "LS-77"], "level9-without-and-refused", async (cx) => { await runCode(cx, "filter(r -> r.batch_id == \"B05\" && r.detected, logbook)"); cx.note = "right jars without .& -> " + clip(await txt(cx, "#feedback"), 200); }, { full: "auto" });
    if (k === 6) S([id, "LS-77"], "level7-wrong-group-names-the-group-in-words", async (cx) => { await runCode(cx, "first(shuffle(logbook.jar_id[logbook.detected .== false]), 4)"); cx.note = clip(await txt(cx, "#feedback"), 200); }, { full: "auto" });
    S([id, "LS-77", "LS-76", "LS-78", ...(k === 0 ? ["R-anim"] : []), ...(k === W.length - 1 ? ["R-win", "LS-112"] : [])], `level${n}-hit`, async (cx) => {
      await runCode(cx, ex); cx.note = clip(await txt(cx, "#feedback"), 140);
      if (k === W.length - 1) {          // the boss win: gold board, warmer banner, Finish held back until the fanfare has played
        const st = () => cx.page.evaluate(() => ({ board: document.getElementById("board").className, fb: document.getElementById("feedback").className, held: document.getElementById("next").getAttribute("data-held"), nextText: document.getElementById("next").textContent }));
        const a = await st(); await sleep(3500); const b = await st();
        cx.note += ` | right after the run: board "${a.board}", banner "${a.fb}", Finish held=${a.held}; 3.5 s later: held=${b.held}, button "${b.nextText}"`;
      }
    }, { full: "auto" });
    if (k === 0) S(["R-state", "LS-74"], "reset-and-nothing-picked", async (cx) => { await cx.page.click("#reset"); await sleep(200); await cx.page.fill("#code", ""); await cx.page.click("#run"); await sleep(1500); cx.note = clip(await txt(cx, "#feedback"), 140); }, { full: "auto" });
    if (k === 0) S(["R-one", "LS-77"], "table-with-one-index-gets-a-friendly-line", async (cx) => { await runCode(cx, "logbook[9]"); cx.note = "feedback: " + clip(await txt(cx, "#feedback"), 220) + " | Julia's own message fold shown: " + (await vis(cx, "#julia-msg")); }, { full: "auto" });
    if (k === 0) S(["R-nudge", "R-w1"], "level1-nudge-row-number-line", async (cx) => { await runCode(cx, "logbook[9,:]"); cx.note = "nudge: " + clip(await txt(cx, "#works-too"), 160) + " | feedback: " + clip(await txt(cx, "#feedback"), 100); }, { full: "auto" });
    if (k === 0) S(["R-sound", "ST-K19"], "sound-button-muted", async (cx) => { await cx.page.click("#range-sound"); await sleep(250); cx.note = "button: " + (await txt(cx, "#range-sound")) + " | key: " + (await cx.page.evaluate(() => localStorage.getItem("julia-time:range:sound:v1"))); }, { full: "auto" });
    if (k === 0) S([], "sound-button-back-on", async (cx) => { await cx.page.click("#range-sound"); await sleep(150); }, { noshot: true });
    if (k === 6) S(["R-refused", id], "level7-right-jars-typed-ids-refused", async (cx) => { const code = JSON.stringify((w.rule && w.rule.from || []).slice(0, w.rule ? w.rule.count : 4)); await runCode(cx, code); const refused = await cx.page.evaluate(() => document.querySelectorAll("#board .jar.refused").length); cx.note = `ran ${clip(code, 60)} -> ${clip(await txt(cx, "#feedback"), 140)} | refused jars drawn: ${refused}`; }, { full: "auto" });
    if (k === 1) S(["R-state"], "julia-error", async (cx) => { await runCode(cx, "logbook[3:4"); cx.note = clip(await txt(cx, "#feedback"), 160); if (await vis(cx, "#julia-msg summary")) { await cx.page.click("#julia-msg summary").catch(() => {}); await sleep(200); } }, { full: "auto" });
    if (k === 2) S(["R-state"], "timeout", async (cx) => { await runCode(cx, "while true end"); cx.note = clip(await txt(cx, "#feedback"), 160); }, { full: "auto" });
    if (k < W.length - 1) S([], "next-level", async (cx) => { if (await vis(cx, "#next") && !(await cx.page.$eval("#next", (e) => e.disabled))) { await cx.page.click("#next"); await sleep(400); } }, { noshot: true });
  });
  S(["LS-79", "R-state", "LS-78"], "range-cleared", async (cx) => { if (await vis(cx, "#next") && !(await cx.page.$eval("#next", (e) => e.disabled))) { await cx.page.click("#next"); await sleep(400); } if (!(await vis(cx, "#screen-range-end"))) throw new Skip("range end screen not reached: the last level's own example did not pass on this server (see the level 11 hit picture)"); }, { full: "auto" });
  S(["LS-79"], "back-to-levels", async (cx) => { if (!(await vis(cx, "#range-end-back"))) throw new Skip("range end screen not on screen, so no Back to the levels button"); await cx.page.click("#range-end-back"); await sleep(350); }, { full: "auto" });
  // own-picks rings (missed_rings_after), the names() peek and the wait cue: level 5 ("aim from the words"), fresh scenario
  const sr = scenario("range own picks and peek", "Range", { seed: ALLOPEN });
  const SR = (ids, state, fn, o) => step(sr, ids, state, fn, o);
  const w5 = W[4], later = Number(RG.missed_rings_after) || 0;
  const countOf = (cx, cls) => cx.page.evaluate((c) => document.querySelectorAll("#board .jar." + c).length, cls);
  const wrongRuns = ["logbook.jar_id[logbook.detected .== false]", "logbook.jar_id[logbook.batch_id .== \"B04\"]", "logbook.jar_id[logbook.tray_id .== \"T-D\"]", "logbook.jar_id[logbook.tray_id .== \"T-F\"]"];
  SR(["R-late", "LS-114", "LS-72", "LS-76"], "level5-before-any-run", async (cx) => { await openLesson(cx, "range"); if ((await screenOf(cx)) !== "range") throw new Skip("not the range screen"); await cx.page.locator("#wave-list button").nth(4).click(); await sleep(350); cx.note = "rule line: " + clip(await txt(cx, "#then-line") || (await txt(cx, "#subtitle")), 160) + " | missed rings " + (await countOf(cx, "missed")) + ", target rings " + (await countOf(cx, "target")); }, { full: "auto" });
  SR(["R-late", "LS-114", "LS-76"], "level5-first-wrong-run-shows-only-own-picks", async (cx) => { await runCode(cx, wrongRuns[0]); cx.note = `ran ${clip(wrongRuns[0], 60)} -> ${clip(await txt(cx, "#feedback"), 120)} | missed rings ${await countOf(cx, "missed")} (want 0), wrong picks drawn ${await countOf(cx, "miss")}, right picks ${await countOf(cx, "hit")} | summary: ${clip(await txt(cx, ".board-summary"), 80)}`; }, { full: "auto" });
  SR(["R-late", "LS-114"], "level5-second-wrong-run-still-no-rings", async (cx) => { await runCode(cx, wrongRuns[1]); cx.note = `ran ${clip(wrongRuns[1], 60)} | missed rings ${await countOf(cx, "missed")} (want 0)`; }, { noshot: true });
  SR(["R-late", "LS-114", "LS-76"], `level5-after-${later || 3}-tries-the-missed-jars-get-a-ring`, async (cx) => { await runCode(cx, wrongRuns[2]); const m = await countOf(cx, "missed"); cx.note = `ran ${clip(wrongRuns[2], 60)} | missed rings ${m} (want more than 0 from try ${later || 3}) | feedback: ${clip(await txt(cx, "#feedback"), 120)}`; if (!m) throw new Error("no missed-jar ring after three counted tries (check the range file's missed_rings_after and that the three runs were counted)"); }, { full: "auto" });
  SR(["R-peek", "LS-111", "LS-77"], "names-of-the-table-is-a-peek-not-a-pick", async (cx) => { await cx.page.locator("#wave-list button").nth(5).click().catch(() => {}); await cx.page.locator("#wave-list button").nth(4).click(); await sleep(300); await runCode(cx, "names(logbook)"); const fb = await txt(cx, "#feedback"); cx.note = `ran names(logbook) -> ${clip(fb, 140)} | red crosses ${await countOf(cx, "miss")} | summary: ${clip(await txt(cx, ".board-summary"), 80)}`; if (!/column names, not jars/.test(fb)) throw new Error("names(logbook) was not treated as a peek: " + clip(fb, 120)); }, { full: "auto" });
  SR(["R-wait", "LS-113"], "run-that-waits-says-still-running", async (cx) => { await cx.page.fill("#code", "sleep(2.4); logbook.jar_id[9]"); await cx.page.click("#run"); await sleep(1450); cx.note = `1.45 s into the run: feedback "${clip(await txt(cx, "#feedback"), 80)}", board data-waiting=${await cx.page.getAttribute("#board", "data-waiting")}`; if (!/Still running/.test(await txt(cx, "#feedback"))) throw new Error("no 'Still running' cue after a second (did sleep() finish early or is it blocked?)"); }, { full: "auto" });
  SR([], "wait-for-the-run-to-end", async (cx) => { await cx.page.waitForFunction(() => !document.getElementById("run").disabled, null, { timeout: 30000 }).catch(() => {}); await sleep(300); }, { noshot: true });

  // nothing open, and only lesson 1 passed (locked line)
  const s2 = scenario("range fresh", "Range", {});
  step(s2, ["R-state", "R-start", "LS-72"], "nothing-open", async (cx) => { await openLesson(cx, "range"); }, { full: true });
  const s3 = scenario("range lesson1 only", "Range", { seed: { "julia-time:lesson:v1:lesson1": { lastCheckpointDone: true, started: true } } });
  step(s3, ["R-open", "LS-72", "LS-73"], "lesson1-only-locked-line", async (cx) => { await openLesson(cx, "range"); }, { full: true });
  // clear the three open levels with their own examples: the end page is a stopping place with a way on, not "Range cleared"
  for (let k = 0; k < 3; k++) step(s3, [], `lesson1-only-clear-level-${k + 1}`, async (cx) => { await runCode(cx, W[k].example); if (!(await cx.page.$eval("#next", (e) => !e.disabled && !e.hidden).catch(() => false))) throw new Skip(`level ${k + 1}'s own example did not clear it on this server`); await cx.page.click("#next"); await sleep(500); }, { noshot: true });
  step(s3, ["R-lone", "LS-79", "R-open"], "lesson1-only-range-end-page", async (cx) => {
    if (!(await vis(cx, "#screen-range-end"))) throw new Skip("range end screen not reached (a level's own example did not clear it)");
    const h = await cx.page.evaluate(() => { const e = document.querySelector("#screen-range-end h1"); return e ? e.textContent : ""; });
    const more = await txt(cx, "#range-end-more"), link = await cx.page.evaluate(() => { const a = document.querySelector("#range-end-more a"); return a ? a.getAttribute("href") + " (" + a.textContent + ")" : "no link"; });
    cx.note = `heading "${h}" | sentence: ${clip(await txt(cx, "#range-end-say"), 100)} | more: ${clip(more, 200)} | link: ${link}`;
    if (/Range cleared/.test(h)) throw new Error("heading says 'Range cleared' although levels are still locked");
  }, { full: true });
  // reduced motion
  const s4 = scenario("range reduced motion", "Range", { seed: ALLOPEN, reducedMotion: true });
  step(s4, ["R-ctl", "R-anim"], "reduced-motion-level1-hit", async (cx) => { await openLesson(cx, "range"); await runCode(cx, W[0].example); }, { full: "auto" });
})();

// ---- Board B and the board-side states of K
(function boardScenarios() {
  const sc = scenario("board fresh", "Board", {});
  const S = (ids, state, fn, o) => step(sc, ids, state, fn, o);
  S(["PG-01", "BD-02", "BD-03", "BD-04", "BD-05", "BD-06", "BD-11", "BD-12", "BD-13", "BD-14", "BD-15", "BD-S1", "BD-S2", "BD-S3", "BD-S4", "BD-S5", "BD-S6", "BD-16", "BD-17", "BD-19", "ST-01", "ST-11"], "fresh", async (cx) => { await openBoard(cx); }, { full: true });
  S(["BD-20", "BD-21", "BD-22", "BD-24", "BD-25", "BD-26", "BD-27", "BD-28"], "fold-open", async (cx) => { await cx.page.evaluate(() => { const d = document.getElementById("also-here"); if (d) d.open = true; const s = document.getElementById("setup-details"); if (s) s.open = true; }); await sleep(300); }, { full: true });
  S(["BD-22"], "check-julia-again-clicked-ready", async (cx) => { await openBoard(cx); await cx.page.evaluate(() => { const s = document.getElementById("setup-details"); if (s) s.open = true; }); const dis = await cx.page.$eval("#setup-recheck", (e) => e.disabled); if (!dis) { await cx.page.click("#setup-recheck", { timeout: 4000 }).catch(() => {}); await sleep(1500); } cx.note = dis ? "button disabled" : "clicked, Julia ready"; }, { full: "auto" });
  S(["BD-01"], "skip-link-focus", async (cx) => { await openBoard(cx, "", { quick: true }); await cx.page.keyboard.press("Tab"); await sleep(250); }, {});
  S(["BD-12", "ST-11", "IN-07"], "intro-seen", async (cx) => { await seed(cx, { [OLD_KEYS.intro]: "1" }); await openBoard(cx); cx.note = "intro link: " + (await txt(cx, "#watch-intro-link")); }, { full: "auto" });

  const nr = scenario("board julia not ready", "Board", {});
  const N = (ids, state, fn, o) => step(nr, ids, state, fn, o);
  const freshPage = async (cx) => { await cx.page.close(); cx.page = await mkPage(cx.ctx); };
  N(["ST-12", "BD-11", "BD-10", "BD-20", "BD-21", "BD-31", "BD-23"], "not-ready-JULIA_UNSUPPORTED", async (cx) => { await freshPage(cx); await mockSetup(cx.page, "bad", "JULIA_UNSUPPORTED"); await openBoard(cx); }, { full: true });
  N(["BD-31", "BD-10", "BD-23"], "julia-problem-notice-above-greyed-start", async (cx) => {
    const d = await cx.page.evaluate(() => {
      const row = document.querySelector(".julia-row"), btn = document.getElementById("continue-action"), help = document.getElementById("julia-help"), rec = document.getElementById("setup-reconnect");
      const before = !!(row && btn && (row.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING));
      return { before, state: row && row.dataset.state, dis: btn && btn.getAttribute("aria-disabled"), bg: btn && getComputedStyle(btn).backgroundColor, helpShown: !!help && !help.hidden, helpHref: help && help.getAttribute("href"), reconnectShown: !!rec && !rec.hidden, text: (document.getElementById("julia-line") || {}).textContent };
    });
    cx.note = `notice above the Start button: ${d.before}; row state ${d.state}; Start aria-disabled=${d.dis} (background ${d.bg}); help link shown ${d.helpShown} -> ${d.helpHref}; Reconnect shown ${d.reconnectShown}; text: ${clip(d.text, 200)}`;
  }, { full: "auto" });
  N(["BD-10"], "main-button-blocked-click", async (cx) => { const dis = await cx.page.evaluate(() => { const e = document.getElementById("continue-action"); return e.getAttribute("aria-disabled"); }); await cx.page.click("#continue-action", { timeout: 4000, force: true }).catch(() => {}); await sleep(400); cx.note = "aria-disabled=" + dis + "; url after click: " + cx.page.url().replace(BASE, "") + "; focus: " + (await cx.page.evaluate(() => (document.activeElement || {}).id || document.activeElement.tagName)); }, { full: "auto" });
  N(["BD-22"], "check-julia-again-click", async (cx) => { const dis = await cx.page.$eval("#setup-recheck", (e) => e.disabled); if (!dis) await cx.page.click("#setup-recheck", { timeout: 4000 }).catch(() => {}); await sleep(1500); cx.note = dis ? "button is disabled in this state (cannot be clicked)" : "clicked"; }, { full: "auto" });
  N(["ST-13", "BD-11", "BD-24", "BD-31"], "not-ready-JULIA_SANDBOX_FAILED", async (cx) => { await freshPage(cx); await mockSetup(cx.page, "bad", "JULIA_SANDBOX_FAILED"); await openBoard(cx); await cx.page.evaluate(() => { const s = document.getElementById("setup-details"); if (s) s.open = true; }); await sleep(300); }, { full: true });
  N(["BD-11", "ST-15"], "connecting", async (cx) => { await freshPage(cx); await mockSetup(cx.page, "silent"); await goto(cx, "course/index.html"); await sleep(800); }, { full: "auto" });
  N(["BD-23", "ST-15", "BD-11", "BD-31"], "lab-did-not-answer-reconnect", async (cx) => { await sleep(6500); await cx.page.evaluate(() => { const d = document.getElementById("also-here"); if (d) d.open = true; }); await sleep(300); }, { full: true });
  N(["ST-14", "BD-22", "BD-31"], "opened-from-a-file", async (cx) => {
    const f = path.join(WEBROOT, "course/index.html"); if (!fs.existsSync(f)) throw new Skip("web root not found: " + f + " (pass --webroot)");
    await freshPage(cx); await cx.page.goto("file://" + f); await sleep(1200); await cx.page.evaluate(() => { const d = document.getElementById("also-here"); if (d) d.open = true; }); await sleep(300);
  }, { full: true });

  // this browser will not store anything (a private window, blocked site data): the Board says so in its top bar and in a boxed notice
  const cs = scenario("board cannot save", "Board", { init: async (cx) => { await cx.ctx.addInitScript(() => { try { Storage.prototype.setItem = function () { throw new Error("QuotaExceededError"); }; } catch (e) { /* */ } }); } });
  step(cs, ["BD-32", "BD-02", "BD-17", "ST-08"], "cannot-save-notice", async (cx) => {
    await openBoard(cx);
    cx.note = "top bar: " + clip(await txt(cx, "#topbar-status"), 60) + " | status (data-kind " + (await cx.page.getAttribute("#board-status", "data-kind")) + "): " + clip(await txt(cx, "#board-status"), 260);
    if (!/Cannot save here/.test(await txt(cx, "#topbar-status"))) throw new Error("the top bar does not say 'Cannot save here' with storage blocked");
  }, { full: "auto" });

  // the whole course, step by step: the Board after each lesson and each chapter
  const pr = scenario("board progress", "Board", {});
  const P = (ids, state, fn, o) => step(pr, ids, state, fn, o);
  const after = async (cx, stateName) => { await saveState(cx, stateName); await openBoard(cx); };
  for (let k = 1; k <= 6; k++) {
    P([], `solve-lesson${k}`, async (cx) => { await solveAll(cx, J("lesson" + k)); }, { noshot: true });
    P([`ST-A${k}`, ...(k === 1 ? ["BD-07", "BD-08", "BD-S1", "BD-25", "ST-K01", "ST-K03"] : k === 2 ? ["BD-S2"] : [])], `after-lesson${k}`, async (cx) => { await after(cx, "L" + k); cx.note = "button: " + (await txt(cx, "#continue-action")) + " | " + (await txt(cx, "#case-progress")) + " | " + (await txt(cx, "#range-panel")).slice(0, 80); }, { full: true });
    P([], `solve-chapter${k}`, async (cx) => { await solveAll(cx, J("exam" + k)); }, { noshot: true });
    P([`ST-C${k}`, ...(k === 1 ? ["BD-27", "BD-28", "BD-19", "ST-K07", "ST-K08", "ST-K09", "ST-K10", "BD-05"] : k === 3 ? ["BD-19"] : k === 6 ? ["BD-09", "ST-10", "BD-03", "BD-30"] : [])], k === 6 ? "all-done" : `after-chapter${k}`, async (cx) => { await after(cx, k === 3 ? "mid" : k === 6 ? "all" : "C" + k); if (k === 3 || k === 6) await cx.page.evaluate(() => { const d = document.getElementById("also-here"); if (d) d.open = true; }); cx.note = "button: " + (await txt(cx, "#continue-action")) + " | " + (await txt(cx, "#case-progress")); }, { full: true });
  }
  P(["ST-K07"], "storage-keys", async (cx) => { const ks = (await lsKeys(cx)).filter((k) => /missing-fleas|julia-time/.test(k)); cx.note = `${ks.length} keys: ` + ks.map((k) => k.replace("julia-time:", "")).join(", "); }, { noshot: true });

  // a chapter solved without its lesson
  const w = scenario("board chapter without lesson", "Board", {});
  step(w, [], "solve-chapter3-only", async (cx) => { await solveAll(cx, J("exam3")); }, { noshot: true });
  step(w, ["ST-09"], "chapter3-without-lesson3", async (cx) => { await openBoard(cx); cx.note = "button: " + (await txt(cx, "#continue-action")); }, { full: true });

  // returning browsers: 0.4 saves, changed save, no result table, malformed record, second attempt, invalid attempt
  const rt = scenario("board returning", "Board", {});
  const R4 = (ids, state, fn, o) => step(rt, ids, state, fn, o);
  const c1 = { evidence: { title: "Saved B09 records" }, rows: [{ jar_id: "J09-1", batch_id: "B09", tray_id: "T-A", detected: true }, { jar_id: "J09-2", batch_id: "B09", tray_id: "T-B", detected: false }], explanation: null };
  const c2 = { step: "rates", accepted: { group: "groupby(jars, :tray_id)", counts: "combine(g, nrow)", rates: "combine(g, :detected => mean)" } };
  const OLD04 = { "julia-time:missing-fleas:v1:evidence": c1, "julia-time:missing-fleas:v1:code": "jars[jars.batch_id .== \"B09\", :]", "julia-time:missing-fleas:v1:c2:progress-v2": c2, "julia-time:missing-fleas:v1:c2:draft:group": "groupby(jars, :tray_id)", "juliatime.progress": "3", "juliatime.lastLevel": "2", "julia-time:missing-fleas:v1:stage": "2", [OLD_KEYS.uses]: "yes", [OLD_KEYS.lang]: "R" };
  R4(["ST-04", "ST-K12", "ST-K13", "ST-K14", "ST-K15", "ST-K16", "ST-K17", "BD-07", "BD-08", "BD-17", "BD-27"], "only-0.4-saves-imported", async (cx) => { await seed(cx, OLD04); await openBoard(cx); cx.note = "status: " + clip(await txt(cx, "#board-status"), 140) + " | button: " + (await txt(cx, "#continue-action")) + " | " + (await txt(cx, "#case-progress")); }, { full: true });
  // The notice appears only when an older save GREW after the Board imported it and has moves not yet accepted (a changed Chapter 1 save
  // is already accepted, so it resyncs silently by design). So: import Chapter 2 with one move, then add a second move to the old save.
  R4(["ST-05", "BD-18", "ST-K11"], "changed-save-notice", async (cx) => {
    const C2K = "julia-time:missing-fleas:v1:c2:progress-v2";
    await goto(cx, "course/getting-started.html"); await cx.page.evaluate(() => localStorage.clear());
    await seed(cx, { [C2K]: { step: "group", accepted: { group: "groupby(jars, :tray_id)" } } });
    await openBoard(cx);
    await cx.page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ step: "counts", accepted: { group: "groupby(jars, :tray_id)", counts: "combine(groups, nrow => :n)" } })), C2K);
    await openBoard(cx); cx.note = "status: " + clip(await txt(cx, "#board-status"), 160) + " | changed button visible: " + (await vis(cx, "#changed-history-action"));
  }, { full: true });
  R4(["ST-06"], "solved-without-result-table", async (cx) => {
    await cx.page.evaluate(() => { localStorage.clear(); localStorage.setItem("julia-time:missing-fleas:course:v1:progress-v1", JSON.stringify({ schema_version: 1, case_id: "missing-fleas-v1", accepted: { "C1/select-records": { case_id: "missing-fleas-v1", chapter: "C1", move_id: "select-records", provenance: "historical-browser" } } })); });
    await openBoard(cx); await cx.page.evaluate(() => { const d = document.getElementById("also-here"); if (d) d.open = true; }); await sleep(250);
  }, { full: true });
  R4(["ST-26", "BD-33", "BD-17"], "malformed-course-record", async (cx) => { if (cx.page.url() === "about:blank") await goto(cx, "course/getting-started.html"); await cx.page.evaluate(() => { localStorage.clear(); localStorage.setItem("julia-time:missing-fleas:course:v1:progress-v1", "{not json"); }); await openBoard(cx); cx.note = "top bar: " + clip(await txt(cx, "#topbar-status"), 60) + " | status (data-kind " + (await cx.page.getAttribute("#board-status", "data-kind")) + "): " + clip(await txt(cx, "#board-status"), 200); }, { full: "auto" });
  R4(["ST-19", "BD-26", "BD-13", "BD-12"], "attempt-x", async (cx) => {
    await cx.page.evaluate(() => localStorage.clear()); await openBoard(cx, "?attempt=x");
    const links = await cx.page.evaluate(() => ["watch-intro-link", "how-to-play-link", "speed-lab-link"].map((i) => { const e = document.getElementById(i); return i + "=" + (e ? e.getAttribute("href") : "missing"); }).concat([...document.querySelectorAll("#chapter-cards a")].map((a) => a.getAttribute("href")).filter((h) => /exam/.test(h))));
    cx.note = links.join(" ; ");
  }, { full: true });
  R4(["ST-25"], "invalid-attempt-dropped", async (cx) => { await openBoard(cx, "?attempt=BAD%20TEXT"); cx.note = "speed lab link: " + (await cx.page.getAttribute("#speed-lab-link", "href").catch(() => "?")); }, { full: "auto" });
})();

// ---- Guide: How to play (C) and the intro (D)
(function guideScenarios() {
  const sc = scenario("how to play", "Guide", {});
  const S = (ids, state, fn, o) => step(sc, ids, state, fn, o);
  S(["PG-02", "HP-01", "HP-02", "HP-03", "HP-04", "HP-06", "HP-07", "HP-08", "HP-09", "HP-25"], "closed-default", async (cx) => { await goto(cx, "course/getting-started.html"); }, { full: true });
  S(["HP-01"], "skip-link-focus", async (cx) => { await goto(cx, "course/getting-started.html"); await cx.page.keyboard.press("Tab"); await sleep(200); }, {});
  S(["HP-04"], "open-the-board-button-clicked", async (cx) => { await goto(cx, "course/getting-started.html"); const h = await cx.page.getAttribute("#local-case-board", "href").catch(() => null); await cx.page.click("#local-case-board"); await sleep(800); cx.note = `href ${h}; landed on ${cx.page.url().replace(BASE, "")}`; }, { noshot: true });
  S(["HP-09", "HP-10", "HP-11", "HP-12"], "setup-fold-open", async (cx) => { await goto(cx, "course/getting-started.html"); await cx.page.evaluate(() => { document.getElementById("setup-wrap").open = true; }); await sleep(300); }, { full: true });
  S(["HP-13", "HP-14", "HP-15", "HP-16", "HP-17", "HP-18", "HP-19", "HP-20", "HP-21", "HP-22", "HP-23"], "every-fold-open", async (cx) => { await goto(cx, "course/getting-started.html"); await cx.page.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; })); await sleep(400); }, { full: true });
  const hrefs = async (cx) => { await goto(cx, "course/getting-started.html"); return cx.page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ t: (a.textContent || "").trim().slice(0, 60), h: a.getAttribute("href") }))); };
  const linkStep = (id, re) => S([id], "link-href", async (cx) => { const l = (await hrefs(cx)).filter((x) => re.test(x.h)); if (!l.length) throw new Skip("no link matching " + re); cx.note = l.map((x) => `"${x.t}" -> ${x.h}`).join(" ; "); }, { noshot: true });
  linkStep("HP-13", /win64\.exe/); linkStep("HP-14", /macaarch64\.dmg/); linkStep("HP-15", /mac64\.dmg/); linkStep("HP-16", /julialang\.org\/downloads/);
  linkStep("HP-06", /github\.com/); linkStep("PG-GH", /github\.com/); linkStep("PG-JL", /julia-1\.10|julialang\.org/);
  S(["HP-25", "HP-02"], "back-to-the-board-click", async (cx) => { await goto(cx, "course/getting-started.html"); const h = await cx.page.getAttribute("#local-case-board", "href").catch(() => null); await cx.page.click("a[data-board-link]"); await sleep(800); cx.note = `href ${h}; landed on ${cx.page.url().replace(BASE, "")}`; }, { noshot: true });

  const it = scenario("intro", "Guide", {});
  const I = (ids, state, fn, o) => step(it, ids, state, fn, o);
  const nextScene = async (cx) => { await cx.page.click("#intro-next"); await sleep(500); };
  for (let k = 1; k <= 6; k++) {
    const ids = [`IN-SC${k}`, ...(k === 1 ? ["PG-03", "IN-01", "IN-02", "IN-03", "IN-04", "IN-05", "IN-06"] : []), ...(k === 6 ? ["IN-07"] : [])];
    I(ids, `scene-${k}`, async (cx) => { if (k === 1) { await goto(cx, "course/intro.html"); await cx.page.waitForSelector("#intro-next"); } else await nextScene(cx); cx.note = (await txt(cx, "#intro-progress")) + (k === 6 ? " | start href " + (await cx.page.getAttribute("#intro-start", "href").catch(() => "?")) : k === 1 ? " | skip href " + (await cx.page.getAttribute("#intro-skip", "href").catch(() => "?")) : ""); }, { full: "auto" });
  }
  I(["IN-07", "ST-K06"], "intro-seen-key", async (cx) => { cx.note = "intro-seen key: " + (await cx.page.evaluate(() => localStorage.getItem("julia-time:intro-seen:v1"))); }, { noshot: true });
  const fo = scenario("intro focus", "Guide", {});
  step(fo, ["IN-01"], "skip-link-focus", async (cx) => { await goto(cx, "course/intro.html"); await cx.page.keyboard.press("Tab"); await sleep(200); }, {});
  step(fo, ["IN-09"], "focus-on-start-after-next-hides", async (cx) => { await goto(cx, "course/intro.html"); await cx.page.focus("#intro-next"); for (let i = 0; i < 5; i++) { await cx.page.keyboard.press("Enter"); await sleep(400); } cx.note = "focused element: " + (await cx.page.evaluate(() => document.activeElement.id)); }, {});
  step(fo, ["IN-09"], "focus-on-next-after-back-disables", async (cx) => { await goto(cx, "course/intro.html"); await cx.page.click("#intro-next"); await sleep(400); await cx.page.focus("#intro-back"); await cx.page.keyboard.press("Enter"); await sleep(400); cx.note = "focused element: " + (await cx.page.evaluate(() => document.activeElement.id)); }, {});
  const rm = scenario("intro reduced motion", "Guide", { reducedMotion: true });
  step(rm, ["IN-08"], "reduced-motion-scene-2", async (cx) => { await goto(cx, "course/intro.html"); await cx.page.click("#intro-next"); await sleep(300); cx.note = "transition: " + (await cx.page.evaluate(() => { const e = document.querySelector("#intro-stage *"); return e ? getComputedStyle(e).transitionDuration + " / " + getComputedStyle(e).animationName : "?"; })); }, {});
})();

// ---- Screen: shared parts of the lesson screen (E). Lesson 1 tour, chapter 1, lesson 4 jar board, the help paths.
(function screenScenarios() {
  const L1 = J("lesson1"), X1 = J("exam1");
  const tasksOf = (L) => { const a = []; L.rounds.forEach((r, ri) => r.challenges.forEach((c, ci) => a.push({ r, ri, c, ci }))); return a; };
  const T1 = tasksOf(L1);
  const find = (T, p) => { const t = T.find(p); return t ? t.c.id : null; };
  const idLook = find(T1, (t) => t.c.look_closer), idFix = find(T1, (t) => t.c.kind === "fix"), idChange = find(T1, (t) => t.c.kind === "change"), idCk = find(T1, (t) => t.c.kind === "checkpoint"), idPlay = find(T1, (t) => t.c.kind === "play");
  const idNotes = find(T1, (t) => t.c.r_note && t.c.py_note), idSee = find(T1, (t) => t.c.kind === "see" && t.c.predict), idRule = find(T1, (t) => t.ci === 1 && t.ri === 0);
  const idR2 = T1.find((t) => t.ri === 1 && t.ci === 0) && T1.find((t) => t.ri === 1 && t.ci === 0).c.id;
  const sc = scenario("screen tour lesson 1", "Screen", {});
  const S = (ids, state, fn, o) => step(sc, ids, state, fn, o);
  const to = async (cx, cid) => { if (!cid) throw new Skip("no such task in this lesson"); { const ord = []; L1.rounds.forEach((r) => r.challenges.forEach((c) => ord.push(c.id))); const scr0 = await screenOf(cx); const cur0 = scr0 === "challenge" ? await curCid(cx) : null; if (scr0 === "end") await openLesson(cx, "lesson1"); else if (cur0 && ord.indexOf(cur0) > ord.indexOf(cid)) { await cx.page.evaluate(() => { try { Object.keys(localStorage).filter((k) => /:lesson1$/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) {} }); await openLesson(cx, "lesson1"); } } await ensureTask(cx, L1, cid); await passWarm(cx); await sleep(150); };
  const fill = async (cx, code) => runCode(cx, code);
  // What the pass card looks like on screen, and where Result, the verdict and Next sit in the right column.
  const cardNote = (cx) => cx.page.evaluate(() => {
    const f = document.getElementById("feedback"), cs = getComputedStyle(f), b = getComputedStyle(f, "::before");
    const y = (id) => { const e = document.getElementById(id); return e && !e.hidden ? Math.round(e.getBoundingClientRect().top) : null; };
    return `pass card: class "${f.className}", rule ${cs.borderLeftWidth}, font ${cs.fontSize}/${cs.fontWeight}, check ${b.width} x ${b.height}; tops: result ${y("result-wrap")}, verdict ${y("feedback")}, Next ${y("next")}; result-wrap data-tall=${(document.getElementById("result-wrap") || {}).dataset.tall}`;
  });
  const byId = (id) => { const t = T1.find((x) => x.c.id === id); return t ? t.c : {}; };
  S(["LS-01", "LS-02", "LS-80", "LS-81", "LS-09", "LS-13", "LS-14", "LS-16", "LS-21", "LS-83", "LS-52", "ST-03"], "start-card-fresh", async (cx) => { await openLesson(cx, "lesson1"); }, { full: true, start: true });
  S(["LS-15"], "story-open", async (cx) => { if (!(await vis(cx, "#story-link"))) throw new Skip("no story link"); await cx.page.click("#story-link"); await sleep(250); }, { full: true });
  S(["LS-10", "LS-11"], "cheat-sheet-open-start", async (cx) => { if (await vis(cx, "#story-link") && (await cx.page.getAttribute("#story-link", "aria-expanded")) === "true") await cx.page.click("#story-link"); if (!(await vis(cx, "#cheat"))) throw new Skip("no cheat sheet button on the start card"); await cx.page.click("#cheat"); await sleep(300); }, { full: true });
  [["both", true, true], ["R-only", true, false], ["Python-only", false, true], ["neither", false, false]].forEach(([nm, r, p]) => {
    S(["LS-11", "LS-80", "LS-81", ...(nm === "neither" ? ["LS-82"] : [])], `cheat-sheet-switches-${nm}`, async (cx) => { if (!(await vis(cx, "#sheet"))) await cx.page.click("#cheat"); await setSwitches(cx, r, p); await sleep(250); cx.note = `R ${r} Python ${p}`; }, { full: "auto" });
  });
  S([], "close-sheet", async (cx) => { if (await vis(cx, "#sheet")) await cx.page.click("#cheat"); await setSwitches(cx, true, true); }, { noshot: true });
  // test-out and the fast lane (fresh context below)
  S(["LS-02", "LS-04", "LS-28", "LS-29", "LS-31", "LS-37", "LS-38", "LS-86", "LS-87", "LS-89", "LS-39", "LS-40", "LS-50", "LS-44", "LS-102"], "line-see-before", async (cx) => { await to(cx, idSee); cx.note = "editor label: " + clip(await txt(cx, "#code-label"), 40) + " | hint line: " + clip(await txt(cx, "#run-hint"), 60) + " | label visible " + (await vis(cx, "#code-label")); }, { full: true });
  if (idLook) {
    S(["LS-32"], "look-closer-open", async (cx) => { await to(cx, idLook); await cx.page.click("#look-link"); await sleep(250); }, { full: "auto" });
    S(["LS-33", "LS-44"], "look-closer-try-it", async (cx) => { await cx.page.click("#look-try"); await cx.page.waitForFunction(() => { const e = document.getElementById("look-result"); return e && !e.hidden && e.textContent.trim(); }, null, { timeout: 40000 }).catch(() => {}); await sleep(250); cx.note = await txt(cx, "#look-result"); }, { full: "auto" });
  }
  S(["LS-37", "LS-47", "LS-44", "LS-103", "LS-104"], "prediction-and-run", async (cx) => { await to(cx, idSee); await cx.page.click("#predict .choice >> nth=0"); await sleep(200); const r0 = await fill(cx, byId(idSee).solution || byId(idSee).starter || "1"); await sleep(900); cx.note = clip(r0.fb, 160) + " | " + (await cardNote(cx)); }, { full: "auto" });
  S(["LS-30"], "r-and-python-notes", async (cx) => { await to(cx, idNotes); }, { full: "auto" });
  [["both", true, true], ["R-only", true, false], ["Python-only", false, true], ["neither", false, false]].forEach(([nm, r, p]) => {
    S(["LS-30", "LS-35", ...(nm === "neither" ? ["LS-82"] : [])], `switches-${nm}-with-dictionary`, async (cx) => { await to(cx, idNotes); await cx.page.evaluate(() => { const d = document.getElementById("dict"); if (d && !d.hidden) d.open = true; }); await setSwitches(cx, r, p); await sleep(250); cx.note = `R ${r} Python ${p}`; }, { full: "auto" });
  });
  S([], "switches-reset", async (cx) => { await setSwitches(cx, true, true); }, { noshot: true });
  S(["LS-26", "LS-35"], "rule-fold-and-dictionary", async (cx) => { await to(cx, idRule); await cx.page.evaluate(() => { const d = document.getElementById("dict"); if (d && !d.hidden) d.open = true; }); await sleep(200); }, { full: "auto" });
  S(["LS-28", "LS-47", "LS-48", "LS-44"], "fix-line-wrong-run-julia-message", async (cx) => { await to(cx, idFix); const w = pickWrong(byId(idFix), 0).pick.code; const r0 = await fill(cx, w); cx.note = clip(r0.fb, 160); if (await vis(cx, "#julia-msg summary")) { await cx.page.click("#julia-msg summary").catch(() => {}); await sleep(200); } }, { full: "auto" });
  S(["LS-48", "LS-105", "LS-47"], "julia-message-card-open-after-wrong-run", async (cx) => {
    await to(cx, idFix);
    const r0 = await fill(cx, "undefined_name_for_the_capture + 1");
    if (!(await vis(cx, "#julia-msg summary"))) throw new Skip("no Julia message fold after a run that names an unknown word (the server gave no real Julia error)");
    const closed = await txt(cx, "#julia-msg summary");
    await cx.page.click("#julia-msg summary"); await sleep(300);
    const d = await cx.page.evaluate(() => { const det = document.querySelector("#julia-msg details"), pre = document.querySelector("#julia-msg pre"); return { open: !!det && det.open, bg: pre ? getComputedStyle(pre).backgroundColor : "", text: pre ? pre.textContent : "" }; });
    cx.note = `closed label "${clip(closed, 90)}"; open ${d.open}; card background ${d.bg}; file locations left in the text: ${/\.jl:\d+|Stacktrace/.test(d.text)}; text: ${clip(d.text, 160)}; verdict: ${clip(r0.fb, 100)}`;
  }, { full: "auto" });
  S(["LS-41", "LS-47"], "show-me-the-line", async (cx) => { await to(cx, idChange); for (let g = 0; g < 3 && !(await vis(cx, "#show-line")); g++) await fill(cx, mutate(byId(idChange).solution, CATS[g])); if (!(await vis(cx, "#show-line"))) throw new Skip("not offered"); await cx.page.click("#show-line"); await sleep(250); }, { full: "auto" });
  S(["LS-40"], "reset", async (cx) => { await cx.page.click("#reset"); await sleep(250); }, { full: "auto" });
  S(["LS-39", "LS-47", "LS-44", "LS-104"], "run-again-label-after-pass", async (cx) => { const r0 = await fill(cx, byId(idChange).solution); await sleep(900); cx.note = `run button: ${await txt(cx, "#run")}; ${clip(r0.fb, 120)} | ${await cardNote(cx)}`; }, { full: "auto" });
  S(["LS-106"], "edit-after-pass-clears-verdict-and-steps-next-back", async (cx) => {
    const sol = byId(idChange).solution;
    await cx.page.fill("#code", sol + "\n# edited"); await cx.page.dispatchEvent("#code", "input"); await sleep(400);
    cx.note = "after an edit of the passing line: verdict \"" + clip(await txt(cx, "#feedback"), 60) + "\"; Next class \"" + (await cx.page.getAttribute("#next", "class")) + "\", Run class \"" + (await cx.page.getAttribute("#run", "class")) + "\", Next enabled " + (await cx.page.$eval("#next", (e) => !e.disabled));
  }, { full: "auto" });
  S([], "restore-passing-line", async (cx) => { await cx.page.fill("#code", byId(idChange).solution); await cx.page.dispatchEvent("#code", "input"); await sleep(250); }, { noshot: true });
  S(["LS-42", "LS-43", "LS-34"], "checkpoint-no-starter-before-two-misses", async (cx) => { await to(cx, idCk); cx.note = "starter button visible before any miss: " + (await vis(cx, "#starter")); }, { full: "auto" });
  S(["LS-42"], "checkpoint-starter-line-after-two-misses", async (cx) => { const c = byId(idCk); await fill(cx, mutate(c.solution, CATS[0])); cx.note = "after 1 miss, starter visible: " + (await vis(cx, "#starter")); await needStarter(cx, c); await cx.page.fill("#code", ""); await cx.page.dispatchEvent("#code", "input"); await cx.page.click("#starter"); await sleep(250); }, { full: "auto" });
  S(["LS-43"], "checkpoint-hints", async (cx) => { const c = byId(idCk); for (let g = 0; g < 3 && !(await vis(cx, "#hints button.quiet")); g++) await fill(cx, mutate(c.solution, CATS[g])); if (!(await vis(cx, "#hints button.quiet"))) throw new Skip("no hint"); await cx.page.click("#hints button.quiet"); await sleep(200); if (await vis(cx, "#hints button.quiet")) { await cx.page.click("#hints button.quiet"); await sleep(200); } }, { full: "auto" });
  S(["LS-49", "LS-47", "LS-50"], "checkpoint-pass-clue", async (cx) => { const r0 = await fill(cx, byId(idCk).solution); cx.note = `clue: ${clip(await txt(cx, "#clue"), 100)}`; }, { full: "auto" });
  S(["LS-45", "LS-28", "LS-44"], "play-box", async (cx) => { await to(cx, idPlay); await fill(cx, byId(idPlay).starter || "1 + 1"); }, { full: "auto" });
  S(["LS-103", "LS-44"], "tall-result-drops-below-next", async (cx) => { await fill(cx, "logbook"); await sleep(400); cx.note = await cardNote(cx); }, { full: "auto" });
  S(["LS-50", "LS-55", "LS-56", "LS-57", "LS-58", "LS-90", "LS-60", "LS-61", "LS-62", "LS-70"], "end-page", async (cx) => { await ensureEnd(cx, L1); }, { full: true });
  S(["LS-62", "LS-63", "LS-66", "LS-67", "LS-68", "LS-69"], "end-fold-open", async (cx) => { await cx.page.evaluate(() => { document.getElementById("end-more").open = true; }); await sleep(300); }, { full: true });
  S(["LS-10", "LS-11"], "cheat-sheet-open-end", async (cx) => { if (!(await vis(cx, "#cheat"))) throw new Skip("no cheat button on the end page"); await cx.page.click("#cheat"); await sleep(250); }, { full: true });
  S(["LS-71", "LS-68"], "print-view-dictionary", async (cx) => { await cx.page.emulateMedia({ media: "print" }); await sleep(250); }, { full: true });
  S([], "screen-media-back", async (cx) => { await cx.page.emulateMedia({ media: "screen" }); }, { noshot: true });
  S(["LS-67"], "copy-all-clicked", async (cx) => { await cx.page.evaluate(() => { document.getElementById("end-more").open = true; }); await cx.page.click("#copy-all"); await sleep(250); cx.note = "button text: " + (await txt(cx, "#copy-all")); }, { full: "auto" });
  S(["LS-22", "LS-69"], "start-again-confirm", async (cx) => { let asked = ""; cx.page.once("dialog", (d) => { asked = d.message(); d.accept().catch(() => {}); }); await cx.page.click("#end-restart"); await sleep(600); cx.note = `confirm said: "${asked}"; screen now ${await screenOf(cx)}`; }, { full: "auto" });

  // a fresh lesson start, partly done: Continue, resume line, Start again
  const rs = scenario("screen resume", "Screen", {});
  const R = (ids, state, fn, o) => step(rs, ids, state, fn, o);
  R(["LS-20", "LS-21", "LS-22", "ST-28"], "resume-card", async (cx) => { await openLesson(cx, "lesson1"); await ensureTask(cx, L1, idChange); await openLesson(cx, "lesson1"); if ((await screenOf(cx)) !== "start") throw new Skip("not on start card"); cx.note = "resume: " + (await txt(cx, "#start-resume")) + "; button: " + (await txt(cx, "#start")); }, { full: "auto" });
  R(["LS-22"], "start-again-click", async (cx) => { let asked = ""; cx.page.once("dialog", (d) => { asked = d.message(); d.accept().catch(() => {}); }); await cx.page.click("#restart"); await sleep(600); cx.note = `confirm: "${asked}"; button now ${await txt(cx, "#start")}`; }, { full: "auto" });
  // test-out from the round 2 warm-up (lesson 1), two misses, then a pass, then the skipped-lines list on the end page
  const to2 = scenario("screen test-out", "Screen", {});
  const Tt = (ids, state, fn, o) => step(to2, ids, state, fn, o);
  const ckOfR2 = T1.filter((t) => t.ri === 1 && t.c.kind === "checkpoint").map((t) => t.c)[0];
  Tt(["LS-23", "LS-24", "LS-25", "LS-27"], "round2-warm-up-with-test-out-button", async (cx) => { await openLesson(cx, "lesson1"); await ensureTask(cx, L1, idR2, true); if (!(await vis(cx, "#testout-btn"))) throw new Skip("test-out button not offered"); }, { full: "auto" });
  Tt(["LS-23"], "warm-up-answered", async (cx) => { await cx.page.click("#remember .choice"); await sleep(250); }, { full: "auto" });
  Tt(["LS-27"], "test-out-started", async (cx) => { await cx.page.click("#testout-btn"); await sleep(400); cx.note = await txt(cx, "#testout-note"); }, { full: "auto" });
  Tt(["LS-27"], "test-out-one-miss", async (cx) => { await runCode(cx, mutate(ckOfR2.solution, "name")); cx.note = await txt(cx, "#testout-note"); }, { full: "auto" });
  Tt(["LS-27"], "test-out-two-misses-back-to-round", async (cx) => { await runCode(cx, mutate(ckOfR2.solution, "bracket")); await sleep(300); cx.note = (await txt(cx, "#help-note")) + " " + (await txt(cx, "#feedback")); }, { full: "auto" });
  Tt([], "test-out-again", async (cx) => { if (await vis(cx, "#testout-btn")) await cx.page.click("#testout-btn"); await sleep(300); }, { noshot: true });
  Tt(["LS-27"], "test-out-passed", async (cx) => { const r0 = await runCode(cx, ckOfR2.solution); if (!r0.pass) throw new Skip("checkpoint did not pass"); cx.note = await txt(cx, "#testout-note"); }, { full: "auto" });
  Tt(["LS-64"], "end-page-lines-tested-out-of", async (cx) => { await cx.page.click("#next"); await sleep(300); await ensureEnd(cx, L1); await cx.page.evaluate(() => { document.getElementById("end-more").open = true; }); await sleep(300); }, { full: true });
  // the fast lane
  const fl = scenario("screen fast lane", "Screen", {});
  step(fl, ["LS-83"], "fast-lane-button-on-start-card", async (cx) => { await openLesson(cx, "lesson1"); if (!(await vis(cx, "#fast-lane"))) throw new Skip("fast lane button not shown"); }, { full: "auto" });
  step(fl, ["LS-84"], "fast-lane-checkpoint", async (cx) => { await cx.page.click("#fast-lane"); await sleep(400); cx.note = await txt(cx, "#testout-note"); }, { full: "auto" });
  step(fl, ["LS-84"], "fast-lane-wrong", async (cx) => { const cid = await curCid(cx); const c = T1.find((t) => t.c.id === cid); await runCode(cx, mutate(c.c.solution, "name")); cx.note = await txt(cx, "#testout-note"); }, { full: "auto" });
  step(fl, ["LS-84"], "fast-lane-pass-next-round", async (cx) => { const cid = await curCid(cx); const c = T1.find((t) => t.c.id === cid); const r0 = await runCode(cx, c.c.solution); cx.note = await txt(cx, "#testout-note"); if (r0.pass) { await cx.page.click("#next"); await sleep(400); cx.note += " | next: " + (await txt(cx, "#testout-note")); } }, { full: "auto" });
  // a chapter: start line, starter XOR hint, earlier-lessons dictionary fold, end page skills
  const ch = scenario("screen chapter 2", "Screen", {});
  const X2 = J("exam2"), XT = tasksOf(X2);
  step(ch, ["LS-19", "LS-13", "LS-02"], "chapter-start-card", async (cx) => { await openLesson(cx, "exam2"); }, { full: true });
  step(ch, ["LS-36", "LS-35", "LS-04"], "chapter-step-dictionary-earlier-open", async (cx) => { await ensureTask(cx, X2, XT[0].c.id); await cx.page.evaluate(() => { const d = document.getElementById("dict"); if (d) d.open = true; const e = document.getElementById("dict-earlier"); if (e) e.open = true; }); await sleep(250); }, { full: true });
  step(ch, ["LS-91", "LS-48"], "chapter-protected-input-note", async (cx) => { await ensureTask(cx, X2, XT[0].c.id); const r0 = await runCode(cx, "jars.detected .= true; jars"); cx.note = "feedback: " + clip(r0.fb, 170) + " | Julia's own message fold shown: " + (await vis(cx, "#julia-msg")); }, { full: "auto" });
  step(ch, ["LS-42", "LS-88"], "chapter-starter-line-after-two-misses", async (cx) => { await cx.page.fill("#code", ""); await runCode(cx, mutate(XT[0].c.solution, "name")); cx.note = "starter visible after misses so far: " + (await vis(cx, "#starter")); await needStarter(cx, XT[0].c); await cx.page.fill("#code", ""); await cx.page.dispatchEvent("#code", "input"); await cx.page.click("#starter"); await sleep(250); }, { full: "auto" });
  step(ch, ["LS-43", "LS-88"], "chapter-hint-not-offered-after-starter", async (cx) => { await runCode(cx, mutate(XT[0].c.solution, "name")); cx.note = "help note: " + (await txt(cx, "#help-note")) + "; hint button enabled: " + (await cx.page.evaluate(() => { const b = document.querySelector("#hints button.quiet"); return !!b && !b.disabled; })); }, { full: "auto" });
  step(ch, ["LS-43"], "chapter-second-step-one-hint", async (cx) => { await runCode(cx, XT[0].c.solution); await cx.page.click("#next"); await sleep(300); await ensureTask(cx, X2, XT[1].c.id); await runCode(cx, mutate(XT[1].c.solution, "dot")); if (!(await vis(cx, "#hints button.quiet"))) throw new Skip("hint not offered"); await cx.page.click("#hints button.quiet"); await sleep(250); cx.note = "starter visible after hint: " + (await vis(cx, "#starter")); }, { full: "auto" });
  step(ch, ["LS-63", "LS-55", "LS-56"], "chapter-end-page", async (cx) => { await ensureEnd(cx, X2); await cx.page.evaluate(() => { document.getElementById("end-more").open = true; }); await sleep(300); }, { full: true });
  // Lesson 6 end page: the own-work card with the three first-time steps (real-played progress up to Lesson 6, cached)
  const ow = scenario("screen lesson 6 own work", "Screen", { state: "L6" });
  step(ow, ["LS-109", "LS-66", "ST-28"], "lesson6-end-page-own-work-card", async (cx) => {
    await openLesson(cx, "lesson6");
    if ((await screenOf(cx)) !== "end") throw new Skip("lesson 6 did not open on its end page (saved progress L6 missing or not finished)");
    const steps = await cx.page.evaluate(() => [...document.querySelectorAll("#end-own .own-steps li")].map((li) => li.textContent.trim()));
    cx.note = "own-work card visible " + (await vis(cx, "#end-own")) + " (outside the closed fold: " + (await cx.page.evaluate(() => !document.getElementById("end-more").contains(document.getElementById("end-own")))) + "); first-time steps: " + steps.join(" | ");
    if (steps.length !== 3) throw new Error("expected three first-time steps on Lesson 6's end page, found " + steps.length);
  }, { full: true });
  // lesson 4: the jar board
  const L4 = J("lesson4"), T4 = tasksOf(L4), idBoard = T4.find((t) => t.c.board) && T4.find((t) => t.c.board).c.id;
  const jb = scenario("screen jar board", "Screen", {});
  step(jb, ["LS-46"], "jar-board-before", async (cx) => { if (!idBoard) throw new Skip("no board task in lesson 4"); await openLesson(cx, "lesson4"); await ensureTask(cx, L4, idBoard); }, { full: "auto" });
  step(jb, ["LS-46"], "jar-board-after-run", async (cx) => { const c = T4.find((t) => t.c.id === idBoard).c; await runCode(cx, c.solution || c.starter); cx.note = clip(await txt(cx, "#board"), 160); }, { full: "auto" });
  // narrow window and 200 percent zoom
  const nz = scenario("screen narrow window", "Screen", { viewport: { width: 700, height: 900 } });
  step(nz, ["LS-54"], "narrow-700px-task", async (cx) => { await openLesson(cx, "lesson1"); await ensureTask(cx, L1, idNotes); await cx.page.evaluate(() => window.scrollTo(0, 0)); }, { full: true });
  const z2 = scenario("screen zoom 200", "Screen", { viewport: { width: 683, height: 384 }, deviceScaleFactor: 2 });
  step(z2, ["LS-54", "LS-21"], "zoom200-start-card", async (cx) => { await openLesson(cx, "lesson1"); }, { full: true });
  step(z2, ["LS-54", "LS-38", "LS-50"], "zoom200-task", async (cx) => { await ensureTask(cx, L1, idNotes); await cx.page.evaluate(() => window.scrollTo(0, 0)); }, { full: true });
  step(z2, ["LS-54", "LS-47"], "zoom200-after-run", async (cx) => { const c = byId(idNotes); await runCode(cx, c.solution || c.starter || "1"); }, { full: true });
  // keyboard only
  const kb = scenario("screen keyboard only", "Screen", {});
  const K = (ids, state, fn, o) => step(kb, ids, state, fn, o);
  const focusNote = async (cx) => cx.page.evaluate(() => { const e = document.activeElement; return e ? (e.id ? "#" + e.id : e.tagName) + " " + (e.textContent || "").trim().slice(0, 30) : "none"; });
  K(["LS-107"], "keyboard-skip-link-is-the-first-stop", async (cx) => { await openLesson(cx, "lesson1"); await cx.page.keyboard.press("Tab"); await sleep(250); cx.note = "first Tab: " + (await focusNote(cx)) + " | skip link visible " + (await cx.page.evaluate(() => { const e = document.querySelector("a.skip"); if (!e) return "none"; const r = e.getBoundingClientRect(); return r.left >= 0 && r.width > 0; })); }, { full: "auto" });
  K(["LS-21"], "keyboard-start-card-focus", async (cx) => { await openLesson(cx, "lesson1"); for (let i = 0; i < 12; i++) { await cx.page.keyboard.press("Tab"); if ((await cx.page.evaluate(() => document.activeElement.id)) === "start") break; } cx.note = "focus: " + (await focusNote(cx)); }, { full: "auto" });
  K(["LS-38"], "keyboard-task-editor-focus", async (cx) => { await cx.page.keyboard.press("Enter"); await sleep(400); for (let i = 0; i < 20; i++) { await cx.page.keyboard.press("Tab"); if ((await cx.page.evaluate(() => document.activeElement.id)) === "code") break; } cx.note = "focus: " + (await focusNote(cx)); }, { full: "auto" });
  K(["LS-39", "LS-47", "LS-107"], "keyboard-ctrl-enter-run", async (cx) => { const cid = await curCid(cx); const c = T1.find((t) => t.c.id === cid).c; await cx.page.keyboard.type(c.solution || c.starter || "1"); await cx.page.keyboard.press("Control+Enter"); await cx.page.waitForFunction(() => !document.getElementById("run").disabled); await sleep(400); cx.note = clip(await txt(cx, "#feedback"), 120) + " | focus after the run: " + (await focusNote(cx)); }, { full: "auto" });
  K(["LS-50"], "keyboard-next-focus", async (cx) => { for (let i = 0; i < 20; i++) { await cx.page.keyboard.press("Tab"); if ((await cx.page.evaluate(() => document.activeElement.id)) === "next") break; } cx.note = "focus: " + (await focusNote(cx)); }, { full: "auto" });
  K(["LS-50"], "keyboard-enter-on-next", async (cx) => { await cx.page.keyboard.press("Enter"); await sleep(400); cx.note = "after Enter: screen " + (await screenOf(cx)) + ", focus " + (await focusNote(cx)); }, { full: "auto" });
  // delight: Sound button, pass moment, chime (counted through a wrapped AudioContext), fades
  const dl = scenario("screen delight", "Screen", { init: async (cx) => { await cx.ctx.addInitScript(() => { try { const O = window.AudioContext || window.webkitAudioContext; if (O) { const W = function () { window.__chimes = (window.__chimes || 0) + 1; return new O(); }; W.prototype = O.prototype; window.AudioContext = W; } } catch (e) { /* */ } }); } });
  const D = (ids, state, fn, o) => step(dl, ids, state, fn, o);
  const chimes = (cx) => cx.page.evaluate(() => window.__chimes || 0);
  const idCk2 = (T1.filter((t) => t.c.kind === "checkpoint")[1] || {}).c ? T1.filter((t) => t.c.kind === "checkpoint")[1].c.id : null;
  const toD = async (cx, cid) => { if (!cid) throw new Skip("no such task"); await ensureTask(cx, L1, cid); await passWarm(cx); await sleep(150); };
  const runAndSnap = async (cx, code) => { await cx.page.fill("#code", code); await cx.page.evaluate(() => { window.__chimes = 0; }); await cx.page.click("#run"); await cx.page.waitForFunction(() => { const f = document.getElementById("feedback"); return f && /(^|\s)ok(\s|$)/.test(f.className); }, null, { timeout: 75000 }).catch(() => {}); await sleep(120); };
  D(["LS-95", "LS-94"], "no-chime-on-a-change-task", async (cx) => { await openLesson(cx, "lesson1"); await toD(cx, idChange); await runAndSnap(cx, byId(idChange).solution); cx.note = `change task passed: chimes started ${await chimes(cx)} (should be 0, quiet pop only)`; }, { full: "auto" });
  D(["LS-93", "LS-98"], "sound-button-on-in-the-bar", async (cx) => { await toD(cx, idCk); cx.note = "bar button: " + (await txt(cx, "#delight-sound")) + " | aria-pressed " + (await cx.page.getAttribute("#delight-sound", "aria-pressed")); }, { full: "auto" });
  D(["LS-94", "LS-95", "LS-47"], "pass-moment-checkpoint-sound-on", async (cx) => { await runAndSnap(cx, byId(idCk).solution); cx.note = `120 ms after the pass: feedback class "${await cx.page.getAttribute("#feedback", "class")}", chimes started ${await chimes(cx)}`; }, { full: "auto" });
  D(["LS-93"], "sound-button-turned-off", async (cx) => { await cx.page.click("#delight-sound"); await sleep(200); cx.note = "bar button: " + (await txt(cx, "#delight-sound")) + " | saved: " + (await cx.page.evaluate(() => localStorage.getItem("julia-time:range:sound:v1"))); }, { full: "auto" });
  D(["LS-95"], "no-chime-with-sound-off", async (cx) => { if (!idCk2) throw new Skip("no second checkpoint"); await cx.page.click("#next").catch(() => {}); await sleep(300); await toD(cx, idCk2); await runAndSnap(cx, byId(idCk2).solution); cx.note = `Sound off: chimes started ${await chimes(cx)} (should be 0)`; }, { noshot: true });
  D([], "sound-back-on", async (cx) => { await cx.page.click("#delight-sound"); await sleep(150); }, { noshot: true });
  D(["LS-98"], "step-fades-in", async (cx) => { await cx.page.click("#next"); const cls = await cx.page.evaluate(() => document.getElementById("screen-lesson").className); cx.note = `right after Next, screen-lesson class: "${cls}"`; }, { noshot: true });

  // connection
  const cn = scenario("screen connection", "Screen", {});
  const C = (ids, state, fn, o) => step(cn, ids, state, fn, o);
  C(["LS-53", "LS-06"], "connection-lost-during-run", async (cx) => { await hookWS(cx); await openLesson(cx, "lesson1"); await ensureTask(cx, L1, T1[0].c.id); cx.hook.dropRun = true; await cx.page.fill("#code", T1[0].c.solution || "1"); await cx.page.click("#run"); await sleep(1500); cx.note = "notice: " + clip(await txt(cx, "#feedback"), 120) + " | bar: " + (await txt(cx, "#conn")); }, { full: "auto" });
  C(["LS-06", "ST-17"], "not-connected-trying-again", async (cx) => { cx.hook.refuse = true; cx.hook.cut(); await sleep(3500); cx.note = "bar: " + (await txt(cx, "#conn")); }, { full: "auto" });
  C(["ST-17", "LS-53"], "run-while-disconnected", async (cx) => { await cx.page.fill("#code", T1[0].c.solution || "1"); await cx.page.click("#run").catch(() => {}); await sleep(1000); cx.note = "feedback: " + clip(await txt(cx, "#feedback"), 120) + " | bar: " + (await txt(cx, "#conn")); }, { full: "auto" });
  C(["ST-29"], "reconnected-same-line", async (cx) => { cx.hook.refuse = false; await sleep(5000); cx.note = `screen ${await screenOf(cx)}, task ${await curCid(cx)}, expected ${T1[0].c.id}`; }, { full: "auto" });
  // errors
  const er = scenario("screen unknown lesson", "Screen", {});
  step(er, ["LS-12", "PG-N11"], "unknown-lesson", async (cx) => { await goto(cx, "lesson.html?lesson=zzz-unknown"); await sleep(2500); cx.note = await txt(cx, "#note"); }, { full: "auto" });
  async function setSwitches(cx, r, p) { const cur = await cx.page.evaluate(() => ({ r: document.getElementById("show-r").checked, p: document.getElementById("show-py").checked })); if (cur.r !== r) await cx.page.click("#show-r"); if (cur.p !== p) await cx.page.click("#show-py"); await sleep(150); }
  function pickWrong(c, ri) { return pickWrongOuter(c, ri); }
})();

// ---- Ending I and Speed lab J
(function endingScenarios() {
  const gate = scenario("ending locked", "Ending", {});
  const G = (ids, state, fn, o) => step(gate, ids, state, fn, o);
  G(["PG-E", "EN-01", "EN-02", "EN-03", "EN-04"], "locked-fresh", async (cx) => { await goto(cx, "course/ending.html"); await sleep(1500); cx.note = (await txt(cx, "#ending-status")) + " | " + clip(await txt(cx, "#ending-locked"), 160); }, { full: "auto" });
  G(["ST-23", "EN-03"], "locked-attempt-x", async (cx) => { await goto(cx, "course/ending.html?attempt=x"); await sleep(1500); cx.note = clip(await txt(cx, "#ending-locked"), 200); }, { full: "auto" });
  const mid = scenario("ending locked mid", "Ending", { state: "mid" });
  step(mid, ["EN-03"], "locked-chapters-4-to-6-open", async (cx) => { await goto(cx, "course/ending.html"); await sleep(1500); cx.note = clip(await txt(cx, "#ending-locked"), 200); }, { full: "auto" });
  const old = scenario("ending old game", "Ending", { state: "all" });
  step(old, ["ST-18", "EN-02"], "older-server-message", async (cx) => { await cx.page.routeWebSocket(/.*/, (ws) => { ws.onMessage((m) => { let j = null; try { j = JSON.parse(String(m)); } catch (e) { /* */ } if (j && j.type === "case_epilogue") ws.send(JSON.stringify({ type: "error", message: "unknown message type" })); else if (j && j.type === "ping") ws.send(JSON.stringify({ type: "pong" })); }); }); await goto(cx, "course/ending.html"); await sleep(2500); cx.note = await txt(cx, "#ending-status"); }, { full: "auto" });
  step(old, ["EN-02"], "game-did-not-answer-8s", async (cx) => { await cx.page.close(); cx.page = await mkPage(cx.ctx); await cx.page.routeWebSocket(/.*/, () => { /* never answers */ }); await goto(cx, "course/ending.html"); await sleep(9500); cx.note = await txt(cx, "#ending-status"); }, { full: "auto" });
  step(old, ["EN-02"], "opened-from-a-file", async (cx) => { const f = path.join(WEBROOT, "course/ending.html"); if (!fs.existsSync(f)) throw new Skip("web root not found (pass --webroot)"); await cx.page.close(); cx.page = await mkPage(cx.ctx); await cx.page.goto("file://" + f); await sleep(1500); cx.note = await txt(cx, "#ending-status"); }, { full: "auto" });
  const all = scenario("ending movie", "Ending", { state: "all" });
  const E = (ids, state, fn, o) => step(all, ids, state, fn, o);
  E(["EN-01", "EN-04", "EN-SC1", "EN-05", "EN-06", "EN-07", "EN-08", "EN-09"], "scene-1", async (cx) => { await goto(cx, "course/ending.html"); await cx.page.waitForSelector("#ending-movie:not([hidden])", { timeout: 25000 }).catch(() => { throw new Skip("movie did not open"); }); if (/^Pause/.test(await txt(cx, "#ending-toggle"))) await cx.page.click("#ending-toggle"); await sleep(400); cx.note = await txt(cx, "#ending-progress"); }, { full: "auto" });
  for (let k = 2; k <= 6; k++) E([`EN-SC${k}`, "EN-09"], `scene-${k}`, async (cx) => { await cx.page.click("#ending-next"); await sleep(700); cx.note = await txt(cx, "#ending-progress"); }, { full: "auto" });
  E(["EN-06"], "play-button-state", async (cx) => { await cx.page.click("#ending-back"); await sleep(400); cx.note = "toggle label: " + (await txt(cx, "#ending-toggle")); }, {});
  E(["EN-11", "EN-12", "EN-13", "EN-14", "EN-15", "EN-16"], "finale-and-credits", async (cx) => { await cx.page.click("#ending-skip"); await sleep(1000); }, { full: true });
  E(["EN-14"], "replay-clicked", async (cx) => { await cx.page.click("#ending-replay"); await sleep(700); cx.note = await txt(cx, "#ending-progress"); }, { full: "auto" });
  const rm = scenario("ending reduced motion", "Ending", { state: "all", reducedMotion: true });
  step(rm, ["EN-10", "EN-11", "EN-12"], "reduced-motion-all-scenes-and-finale", async (cx) => { await goto(cx, "course/ending.html"); await sleep(2500); }, { full: true });
  // speed lab
  const sl = scenario("speed lab", "Ending", {});
  const L = (ids, state, fn, o) => step(sl, ids, state, fn, o);
  L(["PG-S", "SL-01", "SL-02", "SL-03", "SL-04", "SL-05", "SL-06", "SL-07", "SL-08"], "initial", async (cx) => { await goto(cx, "course/speed-lab.html"); await sleep(2500); cx.note = await txt(cx, "#speed-status"); }, { full: true });
  L(["SL-04", "SL-05"], "step-1-running", async (cx) => { await cx.page.click("#check-speed-lab"); await sleep(1200); cx.note = await txt(cx, "#speed-status"); }, { full: "auto" });
  L(["SL-04", "SL-05", "SL-06", "SL-09"], "step-1-result", async (cx) => { await cx.page.waitForFunction(() => { const b = document.getElementById("check-speed-lab"); return b && !b.disabled; }, null, { timeout: 100000 }).catch(() => {}); await sleep(500); cx.note = await txt(cx, "#speed-status"); }, { full: "auto" });
  L(["SL-06", "SL-04"], "step-2-running", async (cx) => { if (await cx.page.$eval("#run-speed-lab", (e) => e.disabled)) throw new Skip("Step 2 stays disabled after Step 1: " + (await txt(cx, "#speed-status"))); await cx.page.click("#run-speed-lab"); await sleep(1500); cx.note = await txt(cx, "#speed-status"); }, { full: "auto" });
  L(["SL-07", "SL-04"], "step-2-report", async (cx) => { await cx.page.waitForFunction(() => { const b = document.getElementById("run-speed-lab"); return b && !b.disabled; }, null, { timeout: 200000 }).catch(() => {}); await sleep(500); cx.note = await txt(cx, "#speed-status"); }, { full: true });
  const sx = scenario("speed lab unavailable", "Ending", {});
  step(sx, ["SL-09", "SL-04"], "connection-failed", async (cx) => { await hookWS(cx); cx.hook.refuse = true; await goto(cx, "course/speed-lab.html"); await sleep(3000); cx.note = await txt(cx, "#speed-status"); }, { full: "auto" });
  step(sx, ["ST-24", "SL-01"], "attempt-x-board-link", async (cx) => { cx.hook.refuse = false; await goto(cx, "course/speed-lab.html?attempt=x"); cx.note = "Board link: " + (await cx.page.getAttribute("#return-case-board", "href").catch(() => "?")); }, { noshot: true });
  step(sx, ["SL-01"], "skip-link-focus", async (cx) => { await goto(cx, "course/speed-lab.html"); await cx.page.keyboard.press("Tab"); await sleep(200); }, {});
})();

// ---- States K (the ones not shown on the Board), and the pages nothing on the Board links to (A/L)
(function stateScenarios() {
  const L1 = J("lesson1");
  const old = scenario("states old language and progress", "States", {});
  const O = (ids, state, fn, o) => step(old, ids, state, fn, o);
  const order = []; L1.rounds.forEach((r) => r.challenges.forEach((c) => order.push(c.id)));
  const oldLesson = { started: true, done: { [order[0]]: { code: "1" }, [order[1]]: { code: "2" }, "gone-task-id": { code: "x" } }, drafts: { [order[2]]: "partial" } };   // no fails/skipped/testedOut: fields are filled in
  O(["ST-07", "ST-K01", "ST-K04", "ST-K05", "ST-K03", "LS-20", "LS-21"], "old-keys-start-card-continue", async (cx) => {
    await seed(cx, { [OLD_KEYS.uses]: "yes", [OLD_KEYS.lang]: "R", "julia-time:lesson:v1:lesson1": oldLesson, "julia-time:lesson:v1:range": { stars: { w1: true }, best: {}, drafts: {} }, [OLD_KEYS.intro]: "1" });
    await openLesson(cx, "lesson1");
    cx.note = "start button: " + (await txt(cx, "#start")) + "; resume: " + (await txt(cx, "#start-resume")) + "; old keys left: " + JSON.stringify(await cx.page.evaluate((k) => Object.values(k).map((x) => localStorage.getItem(x)), OLD_KEYS)) + "; switches R/Py: " + (await cx.page.evaluate(() => [document.getElementById("show-r").checked, document.getElementById("show-py").checked]));
  }, { full: "auto" });
  O(["ST-K18", "ST-31"], "switch-off-saved-and-kept", async (cx) => { await cx.page.click("#show-r"); await sleep(250); await cx.page.reload(); await cx.page.waitForFunction(() => document.getElementById("app").dataset.screen !== "loading"); await sleep(400); cx.note = "key: " + (await cx.page.evaluate(() => localStorage.getItem("julia-time:notes-show:v2"))) + " | Show R checked after reload: " + (await cx.page.evaluate(() => document.getElementById("show-r").checked)); }, { full: "auto" });
  O(["ST-31"], "switch-off-kept-on-the-next-lesson", async (cx) => { await openLesson(cx, "lesson2"); cx.note = "lesson2 Show R checked: " + (await cx.page.evaluate(() => document.getElementById("show-r").checked)) + " | In R column shown: " + (await cx.page.evaluate(() => document.getElementById("sheet-table").getAttribute("data-r"))); }, { full: "auto" });
  O(["ST-07"], "continue-lands-on-first-unfinished", async (cx) => { await cx.page.click("#start"); await sleep(500); cx.note = "task " + (await curCid(cx)) + " (old ids ignored, no crash)"; }, { full: "auto" });
  O(["ST-K03", "R-state"], "range-with-old-progress", async (cx) => { await openLesson(cx, "range"); cx.note = "range screen: " + (await screenOf(cx)); }, { full: "auto" });
  const rl = scenario("states reload", "States", {});
  const R = (ids, state, fn, o) => step(rl, ids, state, fn, o);
  const idCh = L1.rounds[0].challenges.find((c) => c.kind === "change").id;
  R(["ST-27"], "reload-mid-line-draft-restored", async (cx) => { await openLesson(cx, "lesson1"); await ensureTask(cx, L1, idCh); await cx.page.fill("#code", "sum([4, 7"); await cx.page.dispatchEvent("#code", "input"); await sleep(200); await cx.page.reload(); await cx.page.waitForFunction(() => document.getElementById("app").dataset.screen !== "loading"); await sleep(400); cx.note = "screen " + (await screenOf(cx)) + ", editor: " + (await cx.page.inputValue("#code").catch(() => "(none)")); if ((await screenOf(cx)) === "start") { await cx.page.click("#start"); await sleep(400); cx.note += " | after Continue, task " + (await curCid(cx)) + ", editor: " + (await cx.page.inputValue("#code")); } }, { full: "auto" });
  R(["ST-28"], "reload-begun-lesson-start-card", async (cx) => { await cx.page.reload(); await sleep(800); cx.note = "screen " + (await screenOf(cx)) + ", button " + (await txt(cx, "#start")); }, { full: "auto" });
  R(["ST-28"], "reload-finished-lesson-end-page", async (cx) => { await solveAll(cx, L1); await cx.page.reload(); await cx.page.waitForFunction(() => document.getElementById("app").dataset.screen !== "loading"); await sleep(400); cx.note = "screen " + (await screenOf(cx)); }, { full: "auto" });
  R(["ST-30"], "back-forward-board-lesson", async (cx) => { await openBoard(cx, "", { quick: true }); await goto(cx, "lesson.html?lesson=lesson1"); await cx.page.goBack(); await sleep(800); const a = cx.page.url().replace(BASE, ""); await cx.page.goForward(); await sleep(1200); cx.note = `back -> ${a}; forward -> ${cx.page.url().replace(BASE, "")}; screen ${await screenOf(cx)}`; }, { full: "auto" });
  const sb = scenario("states storage blocked", "States", { init: async (cx) => { await cx.ctx.addInitScript(() => { try { Storage.prototype.setItem = function () { throw new Error("QuotaExceededError"); }; } catch (e) { /* */ } }); } });
  const X1 = J("exam1"), x1 = X1.rounds[0].challenges[0];
  step(sb, ["ST-08"], "board-renders-storage-blocked", async (cx) => { await openBoard(cx); }, { full: "auto" });
  step(sb, ["ST-08", "LS-108", "LS-47"], "chapter-pass-could-not-save", async (cx) => { await openLesson(cx, "exam1"); await cx.page.click("#start"); await sleep(400); const r0 = await runCode(cx, x1.solution); cx.note = clip(r0.fb + " | " + (await txt(cx, "#works-too")), 240) + " | notice class \"" + (await cx.page.getAttribute("#works-too", "class")) + "\""; }, { full: "auto" });
  const at = scenario("states second attempt", "States", {});
  const A = (ids, state, fn, o) => step(at, ids, state, fn, o);
  A([], "solve-exam1-attempt-x", async (cx) => { await solveAll(cx, J("exam1"), "&attempt=x"); }, { noshot: true });
  A(["ST-20", "ST-19", "ST-K02"], "board-attempt-x-shows-chapter-1-done", async (cx) => { await openBoard(cx, "?attempt=x"); cx.note = "attempt x: " + (await txt(cx, "#case-progress")) + " | keys: " + (await lsKeys(cx)).filter((k) => /attempt|exam1/.test(k)).join(", "); }, { full: true });
  A(["ST-20", "ST-19"], "default-board-unchanged", async (cx) => { await openBoard(cx); cx.note = "default: " + (await txt(cx, "#case-progress")) + " | status: " + clip(await txt(cx, "#board-status"), 80); }, { full: "auto" });
  A(["ST-21"], "lesson-page-opened-with-attempt", async (cx) => { await openLesson(cx, "lesson1", "&attempt=x"); cx.note = "board link " + (await cx.page.getAttribute("#board-link", "href")); }, { noshot: true });
  A(["ST-22"], "board-lesson-links-carry-the-attempt", async (cx) => { await openBoard(cx, "?attempt=x", { quick: true }); await sleep(1500); cx.note = (await cx.page.evaluate(() => [...document.querySelectorAll("#chapter-cards a, #continue-action")].map((a) => a.getAttribute("href")).join(" ; "))); }, { noshot: true });

  // pages nothing on the 0.5 Board links to
  const ot = scenario("other pages", "Other", {});
  const Pg = (ids, state, p, o) => step(ot, ids, state, async (cx) => { await goto(cx, p); await sleep((o && o.wait) || 600); cx.note = clip((await txt(cx, "h1")) || (await txt(cx, "body")), 140) + " | url " + cx.page.url().replace(BASE, ""); }, { full: "auto" });
  Pg(["PG-N1", "NR-01"], "old-chapter-1-page", "index.html");
  Pg(["PG-N2", "NR-03"], "chapter1-forwarder", "chapter1.html", { wait: 1800 });
  Pg(["PG-N3", "NR-02"], "old-chapter-2", "chapter2.html"); Pg(["PG-N4", "NR-02"], "old-chapter-3", "chapter3.html"); Pg(["PG-N5", "NR-02", "NR-07"], "old-chapter-4", "chapter4.html");
  Pg(["PG-N6", "NR-02"], "old-chapter-5", "chapter5.html"); Pg(["PG-N7", "NR-02"], "old-chapter-6", "chapter6.html");
  Pg(["PG-N8", "NR-04"], "chapter-route-adapter", "course/chapter.html?chapter=C1", { wait: 50 });
  Pg(["PG-N9", "NR-05"], "level-visuals-fixtures", "fixtures.html", { wait: 1200 });
  Pg(["PG-N10", "NR-06"], "choose-a-lesson-list", "lesson.html", { wait: 1500 });
})();

// ------------------------------------------------------------------------------------------------ part assignment (dry and real agree)
const baseOf = (g) => g.replace(/-[b-z]$/, "");
function assignParts() {
  const counts = {}, part = {}, total = {};
  PLAN.forEach((sc) => sc.steps.forEach((st) => { total[sc.group] = (total[sc.group] || 0) + imagesOf(st); }));
  PLAN.forEach((sc) => {
    const b = sc.group;
    sc.steps.forEach((st, i) => {
      if (counts[b] === undefined) { counts[b] = 0; part[b] = 0; }
      if ((st.start || i === 0) && counts[b] >= Math.min(MAXPART, total[b] / Math.ceil(total[b] / (MAXPART + 8))) && total[b] > MAXPART + 14) { part[b]++; counts[b] = 0; }
      st.group = part[b] === 0 ? b : `${b}-${String.fromCharCode(97 + part[b])}`;
      counts[b] += imagesOf(st);
    });
  });
}
assignParts();
const selected = (g) => GROUPSEL.includes("all") || GROUPSEL.includes(baseOf(g)) || GROUPSEL.includes(g);

// ------------------------------------------------------------------------------------------------ dry run
function dryRun() {
  const per = {}, covered = new Set();
  PLAN.forEach((sc) => sc.steps.forEach((st) => {
    per[st.group] = per[st.group] || { max: 0, steps: 0 };
    per[st.group].max += st.noshot || st.est === 0 ? 0 : 1 + (st.full ? 1 : 0); per[st.group].steps += st.noshot || st.est === 0 ? 0 : 1;
    st.ids.forEach((id) => covered.add(id));
  }));
  const unc = INV.filter((it) => !covered.has(it.id));
  const uncBy = {};
  unc.forEach((it) => { (uncBy[itemGroup(it)] = uncBy[itemGroup(it)] || []).push(it.id); });
  console.log(`inventory: ${INV.length} items from ${INVIDS.size ? path.relative(ROOT, INVENTORY) : "?"}`);
  console.log("group | pictures (steps; max with full-page twins) | inventory items with no capture path");
  let tot = 0, totMax = 0;
  Object.keys(per).sort().forEach((g) => { const u = uncBy[baseOf(g)]; tot += per[g].steps; totMax += per[g].max; console.log(`${g} | ${per[g].steps} (max ${per[g].max}) | ${g === baseOf(g) && u ? u.length + ": " + u.join(" ") : (g === baseOf(g) ? "0" : "")}`); });
  Object.keys(uncBy).filter((g) => !per[g]).forEach((g) => console.log(`${g} | 0 | ${uncBy[g].length}: ${uncBy[g].join(" ")}`));
  console.log(`total pictures ${tot} (max ${totMax}); items with a path ${covered.size}/${INV.length}; without ${unc.length}`);
  const reasons = NO_PATH;
  unc.forEach((it) => { if (reasons[it.id]) console.log(`  no path ${it.id}: ${reasons[it.id]}`); });
}

// ------------------------------------------------------------------------------------------------ saved-progress snapshots
let BROWSER = null;
const CACHE = () => path.join(OUT, ".cache");
async function saveState(cx, name) { fs.mkdirSync(CACHE(), { recursive: true }); fs.writeFileSync(path.join(CACHE(), `state-${name}.json`), JSON.stringify(await cx.ctx.storageState())); }
const STATE_CHAIN = ["L1", "C1", "L2", "C2", "L3", "C3", "L4", "C4", "L5", "C5", "L6", "C6"];
const STATE_NAME = { C3: "mid", C6: "all" };
async function getState(name) {             // "L1" | "C1" | "mid" | "all" | "fresh": real-played progress, cached on disk
  if (name === "fresh") return null;
  const file = (n) => path.join(CACHE(), `state-${n}.json`);
  if (!REBUILD && fs.existsSync(file(name))) return JSON.parse(fs.readFileSync(file(name), "utf8"));
  const last = name === "mid" ? "C3" : name === "all" ? "C6" : name;
  const ctx = await BROWSER.newContext({ viewport: { width: 1366, height: 768 } }); const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  const cx = { ctx, page };
  console.log(`building saved progress up to ${last} (real play, no pictures)...`);
  for (const s of STATE_CHAIN) {
    const k = Number(s[1]); await solveAll(cx, J((s[0] === "L" ? "lesson" : "exam") + k));
    await saveState(cx, STATE_NAME[s] || s); if (s === last) break;
  }
  const st = await ctx.storageState(); await ctx.close(); return st;
}

// ------------------------------------------------------------------------------------------------ run
async function main() {
  if (DRY) { dryRun(); return; }
  if (!BASE || !OUT) { console.error("usage: review-capture.cjs --base http://127.0.0.1:PORT --out DIR [--group NAME|all] | --dry-run"); process.exit(2); }
  const { chromium } = require(path.join(__dirname, "playtest-eyes/node_modules/playwright"));
  fs.mkdirSync(OUT, { recursive: true });
  BROWSER = await chromium.launch();
  const mfile = path.join(OUT, "manifest.json");
  let manifest = { records: [] };
  try { manifest = JSON.parse(fs.readFileSync(mfile, "utf8")); } catch (e) { /* first run */ }
  const runGroups = new Set(); PLAN.forEach((sc) => sc.steps.forEach((st) => { if (selected(st.group)) runGroups.add(baseOf(st.group)); }));
  manifest.records = manifest.records.filter((r) => !runGroups.has(baseOf(r.group)));
  const indexes = {}; const counts = {};
  for (const g of runGroups) { PLAN.forEach((sc) => sc.steps.forEach((st) => { if (baseOf(st.group) === g) { indexes[st.group] = indexes[st.group] || []; } })); }
  Object.keys(indexes).forEach((g) => { fs.rmSync(path.join(OUT, g), { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, g), { recursive: true }); });
  for (const sc of PLAN) {
    const steps = sc.steps.filter((st) => selected(st.group) && (!ONLYIDS.length || st.ids.some((x) => ONLYIDS.includes(x)) || st.noshot));
    if (!steps.some((st) => !st.noshot || st.ids.length === 0) || !sc.steps.some((st) => selected(st.group))) continue;
    console.log(`scenario: ${sc.name} (${sc.group})`);
    const o = sc.opts || {};
    const ctxOpts = { viewport: o.viewport || { width: 1366, height: 768 }, reducedMotion: o.reducedMotion ? "reduce" : "no-preference" };
    if (o.deviceScaleFactor) ctxOpts.deviceScaleFactor = o.deviceScaleFactor;
    if (o.state) ctxOpts.storageState = await getState(o.state) || undefined;
    const ctx = await BROWSER.newContext(ctxOpts); const page = await mkPage(ctx);
    const cx = { ctx, page, extra: [], note: "", cur: null, dir: () => path.join(OUT, cx.group) };
    if (o.seed) { try { await seed(cx, o.seed); } catch (e) { console.error("seed failed", e.message); } }
    if (o.init) { try { await o.init(cx); } catch (e) { console.error("init failed", e.message); } }
    for (const st of steps) {
      cx.group = st.group; cx.note = ""; cx.extra = [];
      const rec = (kind, extra) => st.ids.forEach((id) => manifest.records.push(Object.assign({ id, group: st.group, scenario: sc.name, state: st.state, kind }, extra)));
      try {
        // a dialog or a crashed page from an earlier step must not sink the rest
        if (cx.page.isClosed()) { cx.page = await mkPage(ctx); }
        await st.fn(cx);
      } catch (e) {
        const reason = e instanceof Skip ? e.message : "error: " + clip(e.message.split("\n")[0], 160);
        if (!st.optional || !(e instanceof Skip)) { if (st.ids.length) rec("miss", { reason: `${st.state}: ${reason}` }); console.log(`  - ${st.state} [${st.ids[0] || ""}]: ${reason}`); }
        continue;
      }
      if (st.noshot) { if (st.ids.length) rec("played", { text: cx.note || "(no text)" }); continue; }
      if (!st.ids.length) continue;
      const dir = path.join(OUT, st.group); fs.mkdirSync(dir, { recursive: true });
      const primary = st.ids[0]; let base = `${primary}--${slug(st.state)}`; let n = 1, file = base + ".png";
      while (fs.existsSync(path.join(dir, file))) file = `${base}-${++n}.png`;
      const files = [file];
      try {
        await sleep(120);
        await cx.page.screenshot({ path: path.join(dir, file) });
        if (st.full) {
          const dims = await cx.page.evaluate(() => ({ h: document.documentElement.scrollHeight, ih: window.innerHeight }));
          if (st.full === true ? dims.h > dims.ih + 8 : dims.h > dims.ih + 8) { const ff = file.replace(/\.png$/, "-full.png"); await cx.page.screenshot({ path: path.join(dir, ff), fullPage: true }); files.push(ff); }
        }
      } catch (e) { rec("miss", { reason: `${st.state}: screenshot failed: ${clip(e.message, 100)}` }); continue; }
      cx.extra.forEach((x) => files.push(x));
      const pics = files.map((x) => `${st.group}/${x}`);
      rec("captured", { files: pics, note: cx.note || "" });
      (indexes[st.group] = indexes[st.group] || []).push({ files, ids: st.ids, state: st.state, note: cx.note });
      counts[st.group] = (counts[st.group] || 0) + files.length;
      console.log(`  + ${st.group}/${file}${files.length > 1 ? " (+full)" : ""}`);
    }
    await ctx.close().catch(() => {});
  }
  await BROWSER.close();
  fs.writeFileSync(mfile, JSON.stringify(manifest));
  Object.keys(indexes).forEach((g) => {
    let md = `# Review capture: ${g}\n\nBase ${BASE}; viewport 1366x768 unless the state says otherwise. One line per picture: file, inventory items it shows, state, note.\n\n`;
    indexes[g].forEach((x) => { md += `- ${x.files.join(", ")}: ${x.ids.join(" ")} | ${x.state}${x.note ? " | " + x.note : ""}\n`; });
    fs.writeFileSync(path.join(OUT, g, "INDEX.md"), md);
  });
  writeManifest(manifest, runGroups);
  console.log("pictures per group: " + JSON.stringify(counts));
}
function writeManifest(manifest, runGroups) {
  const by = {}; manifest.records.forEach((r) => { (by[r.id] = by[r.id] || []).push(r); });
  const reasons = NO_PATH;
  let cap = 0, pl = 0, miss = 0;
  let md = `# Julia Time 0.5 review capture: MANIFEST (gate I13)\n\nBase ${BASE}. Inventory: ${path.relative(ROOT, INVENTORY)} (${INV.length} items). Groups in this manifest: ${[...new Set(manifest.records.map((r) => baseOf(r.group)))].sort().join(", ")}. An item is ticked when it has a picture (captured) or a recorded run (played). Everything else says why not.\n\n`;
  let sec = "";
  INV.forEach((it) => {
    if (it.sec !== sec) { sec = it.sec; md += `\n## ${sec}\n`; }
    const rs = by[it.id] || [], pics = rs.filter((r) => r.kind === "captured"), plays = rs.filter((r) => r.kind === "played");
    const g = itemGroup(it);
    if (pics.length || plays.length) {
      const parts = [];
      if (pics.length) { cap++; parts.push("captured: " + [...new Set(pics.flatMap((r) => r.files))].join(", ")); }
      if (plays.length) { pl++; parts.push("played: " + plays.map((r) => `${r.state}: ${clip(r.text, 300)}`).join(" || ")); }
      const notes = pics.map((r) => r.note).filter(Boolean); if (notes.length) parts.push("result: " + clip(notes.join(" || "), 400));
      md += `- [x] ${it.id}: ${parts.join(" | ")}\n`;
    } else {
      miss++;
      const why = rs.filter((r) => r.kind === "miss").map((r) => r.reason);
      const ran = runGroups.has(g) || runGroups.has(baseOf(g));
      md += `- [ ] ${it.id}: NOT CAPTURED: ${why.length ? why.join("; ") : reasons[it.id] ? reasons[it.id] : ran ? "no capture path in the tool yet" : `group ${g} not in this manifest (run --group ${g})`}\n`;
    }
  });
  md = md.replace("\n\n## ", `\n\nTotals: ${cap} captured, ${pl} played (an item can be both), ${miss} not captured.\n\n## `);
  fs.writeFileSync(path.join(OUT, "MANIFEST.md"), md);
  console.log(`MANIFEST.md: ${cap} items captured, ${pl} with a played record, ${miss} not captured`);
}
main().catch((e) => { console.error(e); try { if (BROWSER) BROWSER.close(); } catch (x) { /* */ } process.exit(1); });

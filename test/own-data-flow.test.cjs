"use strict";
// Bring your own data (lesson "own"): the whole page flow on a tiny fake page with a fake socket, a fake FileReader,
// a fake Blob and a fake download link. Nothing here needs Julia or the real server.
//
// The server contract this page is coded against (assumed, see the report):
//   own_data_load {name, text, request_id}  -> own_data_info {request_id, status "ok"|"refused", name, rows, cols,
//                                              columns [{name, type, missing, distinct?}], notes [], message}
//   own_data_starter / own_data_status / own_data_clear -> the same shape; status "cleared" or "none" when no table.
//
// 0.5.2b additions (assumed, see the report). The button/starter reply (own_data_info) carries `read_line`, the exact line that
// reproduces that read. A lesson_result for a step flagged "loads_table" (d3) may carry `own_data`: an own_data_info-shaped object
// (status "ok", name, rows, cols, columns, notes, message) plus `read_line`.
//
// TOKEN RULE under test (the page fills {any_col}, {num_col}, {x_col}, {group_col} in every starter and prompt):
//   any_col   = the first column.
//   num_col   = a NUMBER column WITH missing cells when one exists (the one with the most), else the first number column.
//   x_col     = the first number column that is not num_col ("" when there is none).
//   group_col = the first TEXT column with 2 to 12 distinct values. If no column reports a distinct count, or none is
//               in range, the first text column. If the table has no text column, the first column, and the step says so.
// For starter_ponds (pond, site, treatment, water_temp, frogs): any = pond, group = site, num = water_temp (it has two missing
// cells), x = frogs.
const nodeTest = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lesson = require("../web/lesson.js");
const Own = require("../web/lesson-own.js");

// OWN-FLOW-OK is printed only when every test below passed.
let failed = false;
const test = (name, fn) => nodeTest(name, async () => { try { await fn(); } catch (e) { failed = true; throw e; } });
nodeTest.after(() => { if (!failed) console.log("OWN-FLOW-OK"); });

const root = path.join(__dirname, "..");
const ownFile = JSON.parse(fs.readFileSync(path.join(root, "lessons/own.json"), "utf8"));

const PONDS_COLUMNS = [
  // The type words the server really sends (src/own_data.jl _own_type_word), not Julia type names.
  { name: "pond", type: "text", missing: 0, distinct: 60 },
  { name: "site", type: "text", missing: 0, distinct: 2, examples: ['"north"', '"south"'] },
  { name: "treatment", type: "text", missing: 0, distinct: 2 },
  { name: "water_temp", type: "number", missing: 2, distinct: 55, examples: ["15.8", "19.7", "17.2"] },
  { name: "frogs", type: "whole number", missing: 0, distinct: 14, examples: ["11", "7", "9"] },
];
const PONDS_CSV = "pond,site,treatment,water_temp,frogs\nP01,north,shaded,15.8,11\nP02,north,open,19.7,7\n";
const infoFor = (m, columns, extra) => Object.assign({ type: "own_data_info", request_id: m.request_id, status: "ok", name: m.name || "starter_ponds.csv",
  rows: 60, cols: columns.length, columns, notes: ["2 cells in water_temp are empty. Julia calls them missing."], message: "",
  starter: (m.name || "starter_ponds.csv") === "starter_ponds.csv",
  read_line: 'data = CSV.read("' + (m.name || "starter_ponds.csv") + '", DataFrame; missingstring=["", "NA"])' }, extra || {});
const D3_LINE = 'data = CSV.read("data/starter_ponds.csv", DataFrame)';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    get length() { return m.size; }, key: (i) => Array.from(m.keys())[i] };
}

class FNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.hidden = false; this.value = ""; this.disabled = false; this.open = true; this.className = ""; this.parentNode = null; this.scrollHeight = 0; this.clientHeight = 0; this.scrollTop = 0; this._text = ""; this.files = []; this.clicks = 0; }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() { const p = this.parentNode; return p ? p.children[p.children.indexOf(this) + 1] || null : null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); c.parentNode = null; return c; }
  insertBefore(n, ref) { n.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(n); else this.children.splice(i, 0, n); return n; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this.className = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  click() { this.clicks += 1; (this.listeners.click || []).forEach((f) => f({})); }
  fire(t, e) { (this.listeners[t] || []).forEach((f) => f(e || {})); }
  focus() {}
  get textContent() { return this.tag === "#text" ? this._text : this._text + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = String(v); }
  all() { return this.children.reduce((a, c) => a.concat(c, c.all()), []); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n) => { for (let i = 0; i < (n || 3); i++) await tick(); };

function fakePage(hooks) {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  const byId = {};
  [...html.matchAll(/\sid="([^"]+)"/g)].forEach((m) => { byId[m[1]] = new FNode("div"); });
  Object.keys(byId).forEach((id) => { if (/hidden/.test(html.match(new RegExp('<[^>]*id="' + id + '"[^>]*>'))[0])) byId[id].hidden = true; });
  const sent = [], blobs = {}, anchors = [], handle = {};
  class WS {
    constructor() { handle.ws = this; this.readyState = 0; this.l = {}; Promise.resolve().then(() => { this.readyState = 1; (this.l.open || []).forEach((f) => f({})); }); }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    close() {}
    send(text) {
      const m = JSON.parse(text); let out = null; sent.push(m);
      if (m.type === "lesson_list") out = { type: "lessons", lessons: [{ id: "own", kind: "own", number: 7, title: ownFile.title }] };
      if (m.type === "lesson_info") out = { type: "lesson", request_id: m.request_id, lesson: JSON.parse(JSON.stringify(ownFile)) };
      if (m.type === "own_data_status") out = { type: "own_data_info", request_id: m.request_id, status: "none" };
      if (m.type === "own_data_clear") out = { type: "own_data_info", request_id: m.request_id, status: "cleared" };
      if (m.type === "own_data_starter") out = infoFor({ request_id: m.request_id }, PONDS_COLUMNS, { notes: ["SIMULATED: made-up pond surveys, not real counts.", "2 cells in water_temp are empty. Julia calls them missing."] });
      if (m.type === "own_data_load") {
        out = /REFUSE/.test(m.text) ? { type: "own_data_info", request_id: m.request_id, status: "refused", message: "That file has no header row, so there are no column names." } : infoFor(m, PONDS_COLUMNS);
      }
      if (m.type === "lesson_run") {
        const bad = /boom/.test(m.code);
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: bad ? "error" : "ok", value_repr: bad ? "" : "60x5 DataFrame", pass: false,
          feedback: "", message: bad ? "UndefVarError: boom not defined" : "" };
        if (!bad) { out.value_table = { columns: ["pond", "site"], rows: Array.from({ length: 20 }, (_, i) => ["P" + i, "north"]) }; out.more_rows = 40; }
        if (!bad && m.challenge === "own-r1-d3" && /CSV\.read/.test(m.code)) {
          const rl = (m.code.match(/^\s*data\s*=\s*CSV\.read\(.*\)\s*$/m) || [D3_LINE])[0].trim();
          const nm = ((rl.match(/"([^"]+)"/) || [])[1] || "starter_ponds.csv").split("/").pop();
          out.own_table = infoFor({ request_id: m.request_id, name: nm }, PONDS_COLUMNS, { read_line: rl });
        }
        if (hooks && hooks.reply) hooks.reply(out, m);
      }
      if (out) (this.l.message || []).forEach((f) => f({ data: JSON.stringify(out) }));
    }
  }
  class FileReader {
    readAsText(file) { Promise.resolve().then(() => { this.result = file.text; if (this.onload) this.onload({ target: this }); }); }
  }
  class Blob { constructor(parts, opts) { this.text = parts.join(""); this.type = (opts || {}).type; } }
  const URLfake = { createObjectURL(b) { const u = "blob:fake/" + Object.keys(blobs).length; blobs[u] = b; return u; }, revokeObjectURL() {} };
  const win = { localStorage: hooks && hooks.storage || memoryStorage(), location: { search: "?lesson=own", host: "x" }, WebSocket: WS, FileReader, Blob, URL: URLfake,
    addEventListener() {}, innerWidth: 1366, confirm: () => true, print() {}, navigator: {} };
  const doc = { defaultView: win, body: new FNode("body"), getElementById: (id) => byId[id],
    createTextNode: (t) => { const n = new FNode("#text"); n._text = t; return n; },
    createElement: (t) => { const n = new FNode(t); if (t === "a") anchors.push(n); return n; } };
  return { doc, byId, sent, blobs, anchors, handle };
}

async function open(hooks) {
  const page = fakePage(hooks);
  lesson.init(page.doc);
  await ticks();
  const $ = (id) => page.byId[id];
  const sentOf = (type) => page.sent.filter((m) => m.type === type);
  const selects = (id) => $(id).all().filter((n) => n.tag === "select");
  const choose = async (name, text, size) => {
    $("own-file").files = [{ name, size: size === undefined ? text.length : size, text }];
    $("own-file").fire("change");
    await ticks();
  };
  const run = async (code) => { $("code").value = code; $("run").click(); await ticks(); };
  const next = async () => { $("next").click(); await ticks(); };
  return { page, $, sentOf, selects, choose, run, next };
}

const RULE = 'Put my-analysis.jl and your data file in the same folder, open Julia there, and run include("my-analysis.jl").';
const atD3 = async (t) => { t.$("start").click(); await ticks(); await t.next(); await t.next(); };

test("start card: Start is enabled with no table, and the choose controls wait on the read step", async () => {
  const t = await open();
  assert.equal(t.$("screen-start").hidden, false);
  assert.ok(t.sentOf("own_data_status").length >= 1, "asks the server whether a table is already loaded");
  assert.equal(t.$("own-panel").hidden, false);
  assert.match(t.$("own-privacy").textContent, /Your file stays on this computer: the page hands it to the game running here, and nothing is sent anywhere\./);
  assert.match(fs.readFileSync(path.join(root, "web/lesson.html"), "utf8"), /<input id="own-file"[^>]*type="file"[^>]*accept="\.csv,\.txt"/);
  assert.equal(t.$("start").disabled, false, "Start no longer waits for a table");
  assert.equal(t.$("own-check").hidden, true, "no table check before a table");
  t.$("start").click(); await ticks();
  assert.equal(t.$("screen-lesson").hidden, false);
  assert.equal(t.$("code").value, 'println(pwd())\nreaddir("data")', "d1 runs without a table");
  assert.equal(t.$("own-load").hidden, true, "the file button is not on d1");
  await t.next(); await t.next();                                  // d3
  assert.equal(t.$("code").value, 'data = CSV.read("data/starter_ponds.csv", DataFrame)');
  assert.equal(t.$("own-load").hidden, false);
  assert.match(t.$("own-stuck").textContent, /Stuck\? Choose the file with the button/);
  assert.equal(t.$("own-file-label").textContent, "Choose your CSV");
  assert.equal(t.$("own-starter").textContent, "Use the starter table");
  assert.equal(t.$("own-table").hidden, true, "the table panel waits for a table");
});

test("typing the read line on d3 loads the table: check, four picks, then the steps carry the names", async () => {
  const t = await open();
  t.$("start").click(); await ticks();
  await t.next(); await t.next();
  assert.equal(t.sentOf("own_data_load").length, 0);
  await t.run('data = CSV.read("data/starter_ponds.csv", DataFrame)');
  assert.equal(t.$("own-table").hidden, false);
  const check = t.$("own-check").textContent;
  assert.match(check, /starter_ponds\.csv/);
  assert.match(check, /60 rows x 5 columns/);
  ["pond", "site", "treatment", "water_temp", "frogs", "number", "whole number"].forEach((w) => assert.ok(check.includes(w), w));
  const picks = t.selects("own-picks");
  assert.equal(picks.length, 4);
  assert.deepEqual(picks.map((s) => s.value), ["pond", "water_temp", "frogs", "site"], "any, number, number to explain, group");
  assert.match(t.$("own-picks").textContent, /Number to explain \(y\)/);
  await t.next();
  assert.equal(t.$("code").value, "size(data)\nfirst(data, 5)");
  await t.next();
  assert.equal(t.$("code").value, "data.pond");
  assert.match(t.$("prompt").textContent, /first\(data\.pond, 5\)/);
  assert.doesNotMatch(t.$("prompt").textContent, /\{/);
  await t.next();
  assert.match(t.$("code").value, /data\.site \.== ".+"/);
  await t.next();
  assert.match(t.$("code").value, /sum\(data\.water_temp \.> limit\)/, "the number column with missing cells");
  assert.equal(t.$("own-table").hidden, false, "and the table panel stays reachable on later steps");
  for (let i = 0; i < 3; i++) await t.next();
  assert.equal(t.$("code").value, "model = lm(@formula(frogs ~ water_temp), data)");
});

test("a file chosen with the button on d3 is sent as own_data_load and fills the picks", async () => {
  const t = await open();
  t.$("start").click(); await ticks();
  await t.next(); await t.next();
  await t.choose("ponds.csv", PONDS_CSV);
  const load = t.sentOf("own_data_load");
  assert.equal(load.length, 1);
  assert.equal(load[0].name, "ponds.csv");
  assert.equal(load[0].text, PONDS_CSV);
  assert.equal(typeof load[0].request_id, "string");
  assert.equal(t.$("own-table").hidden, false);
  assert.match(t.$("own-check").textContent, /ponds\.csv/);
  assert.doesNotMatch(t.$("own-check").textContent, /SIMULATED/, "a file of your own is never called simulated");
  assert.equal(t.selects("own-picks").length, 4);
});

test("the learner can change a pick, and later starters and prompts follow", async () => {
  const t = await open();
  t.$("start").click(); await ticks();
  await t.next(); await t.next();
  await t.run(D3_LINE);
  await t.next(); await t.next(); await t.next();          // p3
  const picks = t.selects("own-picks");
  assert.equal(picks.length, 4);
  const group = picks[3];
  assert.equal(group.value, "site");
  group.value = "treatment"; group.fire("change");
  const num = picks[1]; num.value = "frogs"; num.fire("change");
  await ticks();
  await t.next();                                          // p4
  assert.match(t.$("code").value, /data\.frogs \.> limit/, "the step on screen follows the new pick");
  await t.next(); await t.next();                          // p6
  assert.match(t.$("code").value, /groupby\(data, :treatment\)/);
  assert.match(t.$("code").value, /:frogs => /);
  assert.match(t.$("prompt").textContent, /splits the table by treatment/);
});

test("with no number column or no text column, the steps say so plainly", async () => {
  const cols = [{ name: "a", type: "String", missing: 0, distinct: 40 }, { name: "b", type: "String", missing: 0, distinct: 50 }];
  const ctrl = lesson.createController({ send() {}, onChange() {}, storage: memoryStorage(), lessonId: "own" });
  ctrl.handle({ type: "lesson", lesson: JSON.parse(JSON.stringify(ownFile)) });
  ctrl.start();
  ctrl.handle({ type: "own_data_info", request_id: ctrl.state.own.pending || "x", status: "ok", name: "t.csv", rows: 5, cols: 2, columns: cols, notes: [], message: "" });
  for (let i = 0; i < 6; i++) ctrl.next();                 // p4
  const v = ctrl.view();
  assert.match(v.ch.prompt, /no column of numbers/i, "p4 says the table has no number column");
  ctrl.next();
  assert.match(ctrl.view().ch.prompt, /no column of numbers/i, "p5 too");
  ctrl.next(); ctrl.next();                                // m1
  assert.match(ctrl.view().ch.prompt, /fewer than two columns of numbers/i);
  assert.match(ctrl.view().ch.code, /^#/, "the starter is a comment");
});

test("a step runs, the 20-row cap says how many more rows", async () => {
  const t = await open();
  t.$("start").click(); await ticks();
  await t.run("size(data)\nfirst(data, 5)");
  const res = t.$("result");
  assert.equal(res.hidden, false);
  assert.match(res.textContent, /and 40 more rows/);
  assert.equal(res.all().filter((n) => n.tag === "tr").length, 21, "header plus 20 rows");
});

test("the say step is a textarea saved in localStorage; no marking, no score", async () => {
  const storage = memoryStorage();
  const t = await open({ storage });
  t.$("start").click(); await ticks();
  for (let i = 0; i < 11; i++) await t.next();
  assert.equal(t.$("own-say").hidden, false);
  assert.equal(t.$("code").hidden, true, "no editor on the say step");
  t.$("own-say-text").value = "Shaded ponds had 11 frogs and open ponds 7; I would check the dates.";
  t.$("own-say-text").fire("input");
  const saved = Array.from({ length: storage.length }, (_, i) => storage.getItem(storage.key(i))).join("\n");
  assert.match(saved, /Shaded ponds had 11 frogs/);
  assert.doesNotMatch(t.$("screen-lesson").textContent, /score|correct|wrong/i);
});

test("end screen: lines that ran without error (not d1, d2, d3), the sentence, the data-folder note, and the saved script", async () => {
  const t = await open();
  t.$("start").click(); await ticks();
  await t.run("pwd()");                                       // d1 ok: never listed
  await t.next();
  await t.run("using CSV, DataFrames, GLM");                  // d2 ok: never listed
  await t.next();
  await t.run(D3_LINE);                                       // d3 ok: its line is the script's read line
  await t.next();
  await t.run("size(data)");                                  // p1 ok
  await t.next();
  await t.run("boom(data)");                                  // p2 errors: never listed
  await t.next(); await t.next(); await t.next(); await t.next();
  const grp = 'combine(groupby(data, :site), :frogs => (x -> mean(skipmissing(x))) => :mean_value)';
  await t.run(grp);                                           // p6 ok
  await t.next();
  await t.run("model = lm(@formula(frogs ~ water_temp), data)");   // m1 ok
  await t.next(); await t.next();
  t.$("own-say-text").value = "Shaded ponds had more frogs.\nCheck the dates next.";
  t.$("own-say-text").fire("input");
  await t.next();
  assert.equal(t.$("screen-end").hidden, false);
  const end = t.$("own-end");
  assert.equal(end.hidden, false);
  assert.equal(t.$("own-end-h").textContent, "Lines you ran");
  const shown = t.$("own-end-lines").textContent;
  assert.match(shown, /size\(data\)/);
  assert.match(shown, /groupby\(data, :site\)/);
  assert.doesNotMatch(shown, /boom|pwd\(\)|using CSV|CSV\.read/, "d1, d2, d3 and errors are left out");
  assert.match(t.$("own-end-file").textContent, /starter_ponds\.csv.*game's data folder, for the game/);
  assert.ok(t.$("own-end-file").textContent.includes(RULE), "the one rule for the saved script");
  assert.match(t.$("own-end-say").textContent, /Shaded ponds had more frogs\./);
  const save = t.$("own-save");
  assert.match(save.textContent, /Save my lines as a script/);
  save.click();
  const a = t.page.anchors.find((n) => n.attrs.download);
  assert.ok(a, "a temporary download link was made");
  assert.equal(a.attrs.download, "my-analysis.jl");
  assert.equal(a.clicks, 1);
  const text = t.page.blobs[a.attrs.href].text;
  const BARE = 'data = CSV.read("starter_ponds.csv", DataFrame)';
  assert.ok(text.startsWith("using CSV, DataFrames, Statistics, GLM\n\n" + BARE + "\n"), "header with GLM (a model ran), then the typed read line with its folder dropped");
  assert.equal(text.split(BARE).length, 2, "the read line once");
  assert.ok(!text.includes("data/starter_ponds.csv"), "no data/ path in the script");
  assert.ok(text.includes("display(size(data))"), "first line, shown");
  assert.ok(text.includes("display(" + grp + ")"), "the run line, shown");
  assert.ok(text.includes("model = lm(@formula(frogs ~ water_temp), data)"), "an assignment stays as typed");
  assert.ok(!text.includes("boom") && !text.includes("pwd()"), "an erroring line and d1 are left out");
  assert.ok(text.includes("# Shaded ponds had more frogs.\n# Check the dates next."), "sentence as comments");
  assert.ok(text.indexOf("size(data)") < text.indexOf(grp) && text.indexOf(grp) < text.indexOf("# Shaded"), "order");
  assert.equal(t.$("copy-all").hidden, false, "Copy all stays");
});

test("saved script, button path with NA: the script reads the file exactly as the game did (the read_line, missingstring and all)", async () => {
  const t = await open();
  const air = (m) => Object.assign(infoFor(m, AIR, { name: "airquality.csv", rows: 153, notes: [] }),
    { read_line: 'data = CSV.read("airquality.csv", DataFrame; missingstring=["", "NA"])' });
  const ws = t.page.handle.ws, send = ws.send.bind(ws);
  ws.send = (text) => { const m = JSON.parse(text); if (m.type === "own_data_load") { t.page.sent.push(m); (ws.l.message || []).forEach((f) => f({ data: JSON.stringify(air(m)) })); } else send(text); };
  t.$("start").click(); await ticks();
  await t.next(); await t.next();
  await t.choose("airquality.csv", "Ozone,Solar.R\n41,190\nNA,118\n");
  await t.next();
  await t.run("size(data)");
  for (let i = 0; i < 11; i++) await t.next();
  t.$("own-save").click();
  const text = t.page.blobs[t.page.anchors.find((n) => n.attrs.download).attrs.href].text;
  const lines = text.split("\n");
  assert.equal(lines[0], "using CSV, DataFrames, Statistics", "no GLM when no model ran");
  assert.equal(lines[2], 'data = CSV.read("airquality.csv", DataFrame; missingstring=["", "NA"])');
  assert.ok(lines.includes("display(size(data))"));
});

test("saved script: a typed read keeps its own keywords; the starter button's read line is used as given", () => {
  const typed = 'data = CSV.read("data/a.csv", DataFrame; missingstring="NA", delim=\';\', decimal=\',\')';
  const text = Own.buildScript(typed, ["first(data)"], "", false);
  const bare = typed.replace("data/a.csv", "a.csv");
  assert.ok(text.startsWith("using CSV, DataFrames, Statistics\n\n" + bare + "\n\ndisplay(first(data))\n"), "folder dropped, every keyword kept");
  assert.ok(Own.buildScript('data = CSV.read("data/iris.csv", DataFrame)', [], "", false).includes('CSV.read("iris.csv", DataFrame)'));
  assert.ok(Own.buildScript(typed, [], "", true).startsWith("using CSV, DataFrames, Statistics, GLM\n"));
  const fallback = Own.buildScript("", [], "", false, "mine.csv");
  assert.ok(fallback.includes('data = CSV.read("mine.csv", DataFrame)'), "no read_line from the game: the file name alone, with a note");
});

test("formulas: plain names fill as they are; any other name makes the whole formula Term(Symbol(...)) with no @formula", () => {
  const cols = IRIS;
  const plain = fillOne(PONDS_COLUMNS.map((c) => Object.assign({ rows: 60 }, c)), "model = lm(@formula({y_col} ~ {num_col}), data)\nglm(@formula({y_col} ~ {num_col}), data, Poisson())");
  assert.equal(plain.starter, "model = lm(@formula(frogs ~ water_temp), data)\nglm(@formula(frogs ~ water_temp), data, Poisson())");
  const picks = Own.settlePicks({ y: "Sepal.Length", num: "Petal.Length" }, cols);
  assert.equal(picks.y, "Sepal.Length");
  const iris = Own.fillLesson({ rounds: [{ challenges: [{ id: "c", kind: "play", prompt: "p", starter: "lm(@formula({y_col} ~ {num_col}), data)", r_note: "`lm({y_col} ~ {num_col}, data = data)`." }] }] }, picks, cols).rounds[0].challenges[0];
  assert.equal(iris.starter, 'lm(Term(Symbol("Sepal.Length")) ~ Term(Symbol("Petal.Length")), data)');
  assert.equal(iris.r_note, "`lm(Sepal.Length ~ Petal.Length, data = data)`.", "prose keeps the bare names");
  const mixed = Own.fillLesson({ rounds: [{ challenges: [{ id: "c", kind: "play", prompt: "p", starter: "lm(@formula({y_col} ~ {num_col}), data)" }] }] }, { any: "a", num: "x 2", y: "y" }, [{ name: "a" }]).rounds[0].challenges[0];
  assert.equal(mixed.starter, 'lm(Term(Symbol("y")) ~ Term(Symbol("x 2")), data)');
});

test("default picks: a number column with missing cells for {num_col}, a different (count-like) number column for {y_col}", () => {
  assert.deepEqual(Own.pickColumns(PONDS_COLUMNS), { any: "pond", num: "water_temp", y: "frogs", group: "site" });
  assert.deepEqual(Own.pickColumns(IRIS), { any: "Sepal.Length", num: "Sepal.Length", y: "Sepal.Width", group: "Species" });
  assert.equal(Own.pickColumns(AIR).num, "Ozone", "the most missing cells");
  assert.equal(Own.pickColumns(AIR).y, "Solar.R", "a whole-number column, gaps allowed, not Temp, Month or Day");
  const flt = [{ name: "a", type: "Float64", missing: 3, rows: 9 }, { name: "b", type: "Float64", missing: 0, rows: 9 }, { name: "n", type: "Int64", missing: 0, rows: 9, examples: ["-1", "2"] }, { name: "k", type: "Int64", missing: 0, rows: 9, examples: ["0", "4"] }];
  assert.equal(Own.pickColumns(flt).y, "k", "not a negative whole-number column");
  const one = [{ name: "a", type: "String", rows: 5, distinct: 3 }, { name: "n", type: "Int64", rows: 5, distinct: 5 }];
  assert.equal(Own.pickColumns(one).num, "n");
  assert.equal(Own.pickColumns(one).y, "", "fewer than two number columns: no y");
  assert.deepEqual(Own.pickOptions(AIR).y, ["Ozone", "Solar.R", "Wind", "Temp", "Month", "Day"]);
});

test("a refused file shows the server's message plainly", async () => {
  const t = await open();
  await atD3(t);
  await t.choose("bad.csv", "REFUSE me");
  assert.match(t.$("own-error").textContent, /That file has no header row, so there are no column names\./);
  assert.equal(t.$("own-error").hidden, false);
  assert.equal(t.$("own-table").hidden, true);
});

test("a 6 MB file is refused in the browser before anything is sent", async () => {
  const t = await open();
  await atD3(t);
  await t.choose("big.csv", "a,b\n1,2\n", 6 * 1024 * 1024);
  assert.equal(t.sentOf("own_data_load").length, 0);
  assert.match(t.$("own-error").textContent, /5 MB/);
  assert.equal(t.$("own-error").hidden, false);
});

test("the starter table shows its SIMULATED note prominently", async () => {
  const t = await open();
  await atD3(t);
  t.$("own-starter").click(); await ticks();
  assert.equal(t.sentOf("own_data_starter").length, 1);
  assert.equal(t.$("own-sim").hidden, false);
  assert.match(t.$("own-sim").textContent, /SIMULATED/);
  assert.match(t.$("own-check").textContent, /60 rows x 5 columns/);
});


// ---- 0.5.2 follow-up: names that are not plain identifiers, the group fallback, {group_value}, display(), queued loads ----
const IRIS = [
  { name: "Sepal.Length", type: "number", missing: 0, rows: 150, distinct: 35 }, { name: "Sepal.Width", type: "number", missing: 0, rows: 150, distinct: 23 },
  { name: "Petal.Length", type: "number", missing: 0, rows: 150, distinct: 43 }, { name: "Petal.Width", type: "number", missing: 0, rows: 150, distinct: 22 },
  { name: "Species", type: "text", missing: 0, rows: 150, distinct: 3, examples: ['"setosa"', '"versicolor"', '"virginica"'] },
];
const AIR = [
  { name: "Ozone", type: "whole number", missing: 37, rows: 153, distinct: 68 }, { name: "Solar.R", type: "whole number", missing: 7, rows: 153, distinct: 117 },
  { name: "Wind", type: "number", missing: 0, rows: 153, distinct: 31 }, { name: "Temp", type: "whole number", missing: 0, rows: 153, distinct: 40 },
  { name: "Month", type: "whole number", missing: 0, rows: 153, distinct: 5, examples: ["5", "6"] }, { name: "Day", type: "whole number", missing: 0, rows: 153, distinct: 31 },
];
const mini = (starter) => ({ rounds: [{ challenges: [{ id: "c", kind: "play", prompt: "Use {group_col} and {num_col}.", starter }] }] });
const fillOne = (cols, starter, saved) => Own.fillLesson(mini(starter), Own.settlePicks(saved, cols), cols).rounds[0].challenges[0];

test("names that are not plain Julia identifiers are quoted; plain names keep the dot and the colon", () => {
  const picks = Own.settlePicks(null, IRIS);
  assert.deepEqual(picks, { any: "Sepal.Length", num: "Sepal.Length", y: "Sepal.Width", group: "Species" });
  const ch = fillOne(IRIS, 'data.{num_col}\ncombine(groupby(data, :{group_col}), :{num_col} => mean)\ndata[data.{group_col} .== {group_value}, :]');
  assert.equal(ch.starter, 'data[!, "Sepal.Length"]\ncombine(groupby(data, :Species), "Sepal.Length" => mean)\ndata[data.Species .== "setosa", :]');
  assert.equal(ch.prompt, "Use Species and Sepal.Length.", "prose keeps the plain name");
  const plain = fillOne(PONDS_COLUMNS.map((c) => Object.assign({ rows: 60 }, c)), 'data.{num_col} :{group_col} {group_value}');
  assert.equal(plain.starter, 'data.water_temp :site "north"');
  const odd = [{ name: "water temp", type: "Float64", missing: 0, rows: 3 }, { name: "2nd-try", type: "String", missing: 0, rows: 3, distinct: 2 }];
  assert.equal(fillOne(odd, "data.{any_col} :{group_col}").starter, 'data[!, "water temp"] "2nd-try"');
  assert.equal(Own.pickColumns([{ name: 'say "hi"', type: "String", rows: 1 }]).any, 'say "hi"');
  assert.equal(fillOne([{ name: 'say "hi"', type: "String", rows: 1 }], "data.{any_col}").starter, 'data[!, "say \\"hi\\""]');
});

test("group pick: a text column of 2 to 12 values, else any column of 2 to 12 values, else none and the step says so", () => {
  assert.equal(Own.pickColumns(AIR).group, "Month", "airquality has no text column: Month");
  assert.equal(Own.pickColumns(AIR).num, "Ozone", "a number column with missing cells");
  assert.deepEqual(Own.pickOptions(AIR).group, ["Month"], "only columns that can split");
  const none = AIR.filter((c) => c.name !== "Month");
  assert.equal(Own.pickColumns(none).group, "");
  const ch = fillOne(none, "data.{group_col}");
  assert.match(ch.prompt, /no column to split by/i);
  assert.equal(fillOne(AIR, "{group_value}").starter, "5", "the example literal of the group column");
  assert.equal(fillOne(none, "{group_value}").starter, '"a value from this column"', "placeholder when there is no example");
  assert.equal(Own.pickColumns([{ name: "a", type: "String", rows: 5, distinct: 40 }, { name: "n", type: "Int64", rows: 5, distinct: 5 }]).group, "n", "a text column with too many values loses to a number column with few");
});

test("the saved script shows results: lines that are not assignments go in display(...)", () => {
  const text = Own.buildScript('data = CSV.read("a.csv", DataFrame)', ["limit = 15\nsum(data.x .> limit)\nsum(data.x .== 2) / 3", "first(data,\n  5)", 'combine(groupby(data, :s), :n => mean => :m)', "x = size(data)", "data[!, :y] = 1", "a == b", "f(k = 1)", "z .= 2"], "", false);
  const lines = text.split("\n");
  assert.ok(lines.includes("limit = 15"));
  assert.ok(lines.includes("display(sum(data.x .> limit))"));
  assert.ok(lines.includes("display(sum(data.x .== 2) / 3)"));
  assert.ok(text.includes("display(first(data,\n  5))"), "a statement over two lines is wrapped whole");
  assert.ok(lines.includes("display(combine(groupby(data, :s), :n => mean => :m))"), "=> is not an assignment");
  assert.ok(lines.includes("x = size(data)") && lines.includes("data[!, :y] = 1") && lines.includes("z .= 2"));
  assert.ok(lines.includes("display(a == b)") && lines.includes("display(f(k = 1))"), "== and a keyword argument are not assignments");
});

test("a file picked while the connection is down is sent when it returns, and the table is still taken", async () => {
  const t = await open();
  await atD3(t);
  t.page.handle.ws.readyState = 0;                       // the connection drops
  t.page.sent.length = 0;
  await t.choose("ponds.csv", PONDS_CSV);
  assert.equal(t.sentOf("own_data_load").length, 0, "nothing went out yet");
  t.page.handle.ws.readyState = 1;
  (t.page.handle.ws.l.open || []).forEach((f) => f({}));   // it comes back: the page reloads the lesson and flushes the queue
  await ticks();
  assert.equal(t.sentOf("own_data_load").length, 1, "the queued load went out");
  t.$("start").click(); await ticks();                    // the reload put the player on the start card
  assert.equal(t.$("own-table").hidden, false, "its answer was not lost to the lesson reload");
  assert.match(t.$("own-check").textContent, /ponds\.csv/);
});

// ---- 0.5.2 round 2: Pat's play ----------------------------------------------------------------------------------
function ctl() {
  const sent = [];
  const c = lesson.createController({ send: (m) => sent.push(m), onChange() {}, storage: memoryStorage(), lessonId: "own" });
  c.handle({ type: "lesson", lesson: JSON.parse(JSON.stringify(ownFile)) });
  const lastId = () => sent.filter((m) => /^own_/.test(m.type)).pop().request_id;
  const info = (name) => c.handle({ type: "own_data_info", request_id: lastId(), status: "ok", name, rows: 60, cols: 5, columns: PONDS_COLUMNS, notes: [], message: "", starter: name === "starter_ponds.csv" });
  const run = (code, extra) => { c.run(code); const id = sent.filter((m) => m.type === "lesson_run").pop().request_id; c.handle(Object.assign({ type: "lesson_result", request_id: id, challenge: "x", status: "ok", value_repr: "v", pass: false, feedback: "", message: "" }, extra || {})); };
  const toEnd = () => { for (let i = 0; i < 12; i++) c.next(); return c.view(); };
  return { c, sent, info, run, toEnd, lastId };
}

const own3 = (name, line) => ({ own_table: { type: "own_data_info", status: "ok", name, rows: 60, cols: 5, columns: PONDS_COLUMNS, notes: [], message: "", starter: name === "starter_ponds.csv", read_line: line || 'data = CSV.read("data/' + name + '", DataFrame)' } });
const p1 = (t) => { t.c.start(); for (let i = 0; i < 3; i++) t.c.next(); };   // d1, d2, d3, then the first step that needs the table

test("a different table starts a fresh lines list and says so; the same name keeps it (button path)", () => {
  const t = ctl();
  p1(t); t.info("starter_ponds.csv");
  t.run("size(data)"); t.run("data.pond");
  t.c.ownLoad("other.csv", "a,b\n1,2\n"); t.info("other.csv");
  assert.equal(t.c.view().own.notice, "New table: your lines start again.");
  assert.deepEqual(t.toEnd().end.ownRun.lines, [], "the starter's lines are gone");
  const same = ctl();
  p1(same); same.info("ponds.csv"); same.run("size(data)");
  same.c.ownLoad("ponds.csv", "x"); same.info("ponds.csv");
  assert.equal(same.c.view().own.notice, "");
  assert.deepEqual(same.toEnd().end.ownRun.lines, ["size(data)"], "the same table keeps its lines");
});

test("a typed read of another file also starts the lines again; the same file keeps them", () => {
  const t = ctl();
  t.c.start(); t.c.next(); t.c.next();
  t.run(D3_LINE, own3("starter_ponds.csv"));
  t.c.next(); t.run("size(data)");
  t.c.state.index = 2;
  t.run('data = CSV.read("data/other.csv", DataFrame)', own3("other.csv"));
  assert.equal(t.c.view().own.notice, "New table: your lines start again.");
  assert.deepEqual(t.toEnd().end.ownRun.lines, []);
  const same = ctl();
  same.c.start(); same.c.next(); same.c.next();
  same.run(D3_LINE, own3("starter_ponds.csv"));
  same.c.next(); same.run("size(data)");
  same.c.state.index = 2;
  same.run(D3_LINE, own3("starter_ponds.csv"));
  assert.deepEqual(same.toEnd().end.ownRun.lines, ["size(data)"]);
});

test("an unedited placeholder line is not kept for the script", () => {
  const t = ctl();
  p1(t); t.info("ponds.csv");
  t.run('data[data.site .== "a value from this column", :]'); t.run("size(data)");
  assert.deepEqual(t.toEnd().end.ownRun.lines, ["size(data)"]);
});

test("the footer calls the table SIMULATED only for the starter", () => {
  const a = ctl(); a.c.ownStarter(); a.info("starter_ponds.csv");
  assert.match(a.c.view().dataLabel, /SIMULATED/);
  const b = ctl(); b.c.ownLoad("mine.csv", "a\n1\n"); b.info("mine.csv");
  assert.doesNotMatch(b.c.view().dataLabel, /SIMULATED/);
  assert.match(b.c.view().dataLabel, /stays on this laptop/);
});

test("a refused file keeps the previous table and says 'Still using'", async () => {
  const t = await open();
  await atD3(t);
  await t.choose("bad.csv", "REFUSE me");
  assert.equal(t.$("own-still").hidden, true, "nothing to still use");
  await t.choose("ponds.csv", PONDS_CSV);
  await t.choose("bad2.csv", "REFUSE me");
  assert.match(t.$("own-error").textContent, /no header row/);
  assert.equal(t.$("own-still").textContent, "Still using: ponds.csv");
  assert.equal(t.$("own-still").hidden, false);
  assert.equal(t.$("own-table").hidden, false);
  await t.choose("ponds.csv", PONDS_CSV);
  assert.equal(t.$("own-still").hidden, true, "a good load ends it");
});

test("Forget this table clears the table, picks, lines and sentence, and returns to the start card", async () => {
  const storage = memoryStorage();
  const t = await open({ storage });
  await atD3(t);
  await t.choose("ponds.csv", PONDS_CSV);
  assert.equal(t.$("own-forget").hidden, false);
  await t.next();
  await t.run("size(data)");
  for (let i = 0; i < 8; i++) await t.next();
  t.$("own-say-text").value = "My secret finding."; t.$("own-say-text").fire("input");
  await t.next();
  assert.equal(t.$("screen-end").hidden, false);
  assert.equal(t.$("own-end-forget").hidden, false);
  t.$("own-end-forget").click(); await ticks();
  assert.equal(t.sentOf("own_data_clear").length, 2, "one from Start, one from Forget");
  assert.equal(t.$("screen-start").hidden, false);
  assert.equal(t.$("own-check").hidden, true);
  assert.equal(t.$("own-picks").hidden, true);
  assert.equal(t.$("start").disabled, false, "Start never waits for a table now");
  const saved = Array.from({ length: storage.length }, (_, i) => storage.getItem(storage.key(i))).join("\n");
  assert.doesNotMatch(saved, /My secret finding|size\(data\)|ponds\.csv/);
  // and from a step with a table loaded
  t.$("start").click(); await ticks();
  await t.next(); await t.next();
  await t.choose("ponds.csv", PONDS_CSV);
  t.$("own-forget").click(); await ticks();
  assert.equal(t.sentOf("own_data_clear").length, 4);
  assert.equal(t.$("own-check").hidden, true);
});

test("a wide table check shows 12 columns, says how many more, and Show all columns lists the rest", async () => {
  const wide = Array.from({ length: 25 }, (_, i) => ({ name: "column_" + (i + 1), type: i === 0 ? "String" : "Float64", missing: 0, distinct: i === 0 ? 3 : 50 }));
  const t = await open({ reply: undefined });
  const ws = t.page.handle.ws, send = ws.send.bind(ws);
  ws.send = (text) => { const m = JSON.parse(text); if (m.type === "own_data_load") { t.page.sent.push(m); (ws.l.message || []).forEach((f) => f({ data: JSON.stringify(infoFor(m, wide, { cols: 25 })) })); } else send(text); };
  await atD3(t);
  await t.choose("wide.csv", "a\n1\n");
  const rows = () => t.$("own-check").all().filter((n) => n.tag === "tr").length;
  assert.equal(rows(), 13, "header plus 12");
  assert.match(t.$("own-check").textContent, /and 13 more columns/);
  const toggle = t.$("own-check").all().find((n) => n.tag === "button");
  assert.equal(toggle.textContent, "Show all columns");
  toggle.click(); await ticks();
  assert.equal(rows(), 26);
  assert.ok(t.$("own-check").all().some((n) => n.tag === "button" && n.textContent === "Show fewer columns"));
  assert.ok(t.$("own-check").all().some((n) => n.attrs.class === "own-cols-wrap"), "the table sits in a scroll box");
});

test("the code boxes keep their Grammarly opt-out and the page has no sideways scroll rules removed", () => {
  const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
  assert.match(html, /<textarea id="code"[^>]*data-gramm="false"[^>]*data-enable-grammarly="false"/);
  const css = fs.readFileSync(path.join(root, "web/lesson.css"), "utf8");
  assert.match(css, /\.own-pick select \{ width: 100%; max-width: 100%/);
  assert.match(css, /\.own-cols-wrap \{ max-width: 100%; overflow-x: auto/);
  assert.match(css, /#own-table[^{]*\{[^}]*max-width: 100%/, "the table panel is capped to the page width");
});

test("SIMULATED follows the server's starter flag, whichever way the table arrived", () => {
  const t = ctl();
  t.c.ownStarter(); t.info("starter_ponds.csv");
  assert.match(t.c.view().dataLabel, /SIMULATED/);
  assert.match(t.c.view().own.sim, /SIMULATED/);
  t.c.start(); t.c.next(); t.c.next();
  t.run('data = CSV.read("data/iris.csv", DataFrame)', own3("iris.csv"));
  assert.equal(t.c.view().own.sim, "", "a typed read of another file after the starter button: not simulated");
  assert.doesNotMatch(t.c.view().dataLabel, /SIMULATED/);
  const u = ctl();
  u.c.start(); u.c.next(); u.c.next();
  u.run(D3_LINE, own3("starter_ponds.csv"));
  assert.match(u.c.view().own.sim, /SIMULATED/, "a typed read of the starter file is labelled");
  assert.match(u.c.view().dataLabel, /SIMULATED/);
});

test("m2: a y that is not a count gets one plain line and a comment, never a Poisson formula", () => {
  const t = ctl();
  p1(t); t.info("ponds.csv");
  for (let i = 0; i < 6; i++) t.c.next();                  // m1
  assert.equal(t.c.view().ch.code, "model = lm(@formula(frogs ~ water_temp), data)");
  t.c.next();                                              // m2
  assert.equal(t.c.view().ch.code, "glm(@formula(frogs ~ water_temp), data, Poisson())");
  t.c.ownPick("y", "water_temp"); t.c.ownPick("num", "frogs");
  const v = t.c.view().ch;
  assert.match(v.prompt, /water_temp is not a count, so a Poisson model does not fit it\. Pick a count column as y\./);
  assert.match(v.code, /^#/);
  assert.doesNotMatch(v.code, /glm\(/);
});

test("before any table: steps after the read step say so in one plain line, with no raw tokens", () => {
  const t = ctl();
  t.c.start();
  for (let i = 0; i < 4; i++) t.c.next();                  // p2: data.{any_col}
  const v = t.c.view().ch;
  assert.equal(v.prompt, "Read a table in step 3 first.");
  assert.match(v.code, /^#/);
  assert.doesNotMatch(JSON.stringify([v.prompt, v.code, v.notes]), /\{[a-z_]+\}/);
  for (let i = 0; i < 7; i++) { t.c.next(); assert.doesNotMatch(JSON.stringify(t.c.view().ch), /\{(any|num|y|group)_col\}|\{group_value\}/); }
});

test("round 3: a button load on d3 puts three comment lines in the editor, with the game's read line in the third", async () => {
  const t = await open();
  await atD3(t);
  assert.match(t.$("code").value, /starter_ponds/);
  await t.choose("mine.csv", PONDS_CSV);
  const note = (line) => "# Your table is loaded (you chose it with the button). Press Next.\n# Your saved script reads it with this line:\n# " + line;
  assert.equal(t.$("code").value, note('data = CSV.read("mine.csv", DataFrame; missingstring=["", "NA"])'), "comments only: the bare-name line would fail if run in the game");
  t.$("own-starter").click(); await ticks();
  assert.equal(t.$("code").value, note('data = CSV.read("starter_ponds.csv", DataFrame; missingstring=["", "NA"])'));
});

test("round 3: picks re-default when a new table arrives, even under the same name; y is never num", () => {
  const t = ctl();
  t.c.start(); t.c.next(); t.c.next();
  t.run(D3_LINE, own3("starter_ponds.csv"));
  t.c.ownPick("num", "frogs"); t.c.ownPick("y", "frogs");
  const v = t.c.view().own.picks;
  assert.notEqual(v.find((p) => p.key === "y").value, v.find((p) => p.key === "num").value, "y is moved off num");
  t.run(D3_LINE, own3("starter_ponds.csv"));
  const w = t.c.view().own.picks;
  assert.equal(w.find((p) => p.key === "num").value, "water_temp", "back to the defaults");
  assert.equal(w.find((p) => p.key === "y").value, "frogs");
  assert.deepEqual(Own.settlePicks({ num: "frogs", y: "frogs" }, PONDS_COLUMNS).y, "water_temp");
});

test("round 3: Start with no saved progress asks the game to forget any table from an earlier session", async () => {
  const t = await open();
  t.$("start").click(); await ticks();
  assert.equal(t.sentOf("own_data_clear").length, 1);
  assert.equal(t.$("own-table").hidden, true);
});

test("round 3: the saved script shows a fitted model (display(model)) right after its assignment", () => {
  const text = Own.buildScript('data = CSV.read("a.csv", DataFrame)', ["model = lm(@formula(y ~ x), data)", "fit2 = glm(@formula(y ~ x), data, Poisson())", "size(data)"], "", true);
  assert.ok(text.includes("model = lm(@formula(y ~ x), data)\ndisplay(model)\n"));
  assert.ok(text.includes("fit2 = glm(@formula(y ~ x), data, Poisson())\ndisplay(fit2)\n"));
  assert.ok(!text.includes("display(size(data))\ndisplay"));
});

test("round 3: the p4 starter sets limit from the data, so it works on any table", () => {
  const p4 = ownFile.rounds[0].challenges.find((c) => c.id === "own-r1-p4");
  assert.match(p4.starter, /^limit = median\(skipmissing\(data\.\{num_col\}\)\)\n/);
  assert.doesNotMatch(p4.prompt, /Change 15/);
});

test("round 3: the read step has no canned file-not-found feedback (the server's line names the real folder)", () => {
  const d3 = ownFile.rounds[0].challenges.find((c) => c.id === "own-r1-d3");
  assert.equal(d3.feedback, undefined);
});

test("server type words: frogs (a whole number column) is a count, so m2 offers the Poisson fit on the starter", () => {
  const t = ctl();
  t.c.start(); t.c.next(); t.c.next();
  t.run(D3_LINE, own3("starter_ponds.csv"));
  for (let i = 0; i < 20 && t.c.view().ch.id !== "own-r1-m2"; i++) t.c.next();
  assert.equal(t.c.view().ch.id, "own-r1-m2");
  assert.match(t.c.view().ch.code, /^glm\(@formula\(frogs ~ water_temp\), data, Poisson\(\)\)/);
});

test("a button load while on the read step bumps codeStamp, so the open editor shows the read line", () => {
  const t = ctl();
  t.c.start(); t.c.next(); t.c.next();
  const before = t.c.view().ch.codeStamp;
  t.c.ownLoad("airquality.csv", "Ozone,Temp\n41,67\n");
  t.c.handle({ type: "own_data_info", request_id: t.lastId(), status: "ok", name: "airquality.csv", rows: 153, cols: 5, columns: PONDS_COLUMNS,
    notes: [], message: "", starter: false, read_line: 'data = CSV.read("airquality.csv", DataFrame; missingstring=["", "NA"])' });
  const v = t.c.view().ch;
  assert.match(v.code, /CSV\.read\("airquality\.csv"/);
  assert.notEqual(v.codeStamp, before, "the renderer must rewrite the editor");
});

const real = (name, type, extra) => Object.assign({ name, type, missing: 0, rows: 20, distinct: 10 }, extra || {});

test("round 4: the read step's starter shows pwd with println, and no step number in the lesson is stale", () => {
  const d1 = ownFile.rounds[0].challenges[0];
  assert.equal(d1.starter, 'println(pwd())\nreaddir("data")');
  const text = JSON.stringify(ownFile);
  assert.match(ownFile.rounds[0].challenges.find((c) => c.id === "own-r1-p4").prompt, /step 8 explains/);
  assert.doesNotMatch(text, /step 5 explains/);
});

test("round 4: before a table, the plain line has a button that goes to the read step", async () => {
  const t = await open();
  t.$("start").click(); await ticks();
  for (let i = 0; i < 4; i++) await t.next();
  assert.equal(t.$("prompt").textContent, "Read a table in step 3 first.");
  assert.equal(t.$("own-go-read").hidden, false);
  t.$("own-go-read").click(); await ticks();
  assert.match(t.$("code").value, /CSV\.read/);
  assert.equal(t.$("own-go-read").hidden, true);
  assert.equal(t.$("own-load").hidden, false);
});

test("round 4: y prefers whole-number columns even with gaps, and skips percent, temperature, date and id names", () => {
  const cols = [real("a", "number", { missing: 3 }), real("pct_cover", "whole number"), real("total", "whole number", { missing: 2 }), real("year", "whole number")];
  assert.equal(Own.pickColumns(cols).y, "total", "gaps are fine; pct and year names lose");
  const only = [real("a", "number", { missing: 3 }), real("pct_cover", "whole number")];
  assert.equal(Own.pickColumns(only).y, "pct_cover", "a bad name still wins when it is the only whole number");
  const ids = [real("a", "number", { missing: 1 }), real("pond_id", "whole number"), real("n", "whole number")];
  assert.equal(Own.pickColumns(ids).y, "n");
});

test("round 4: no count column at all says the Poisson step does not apply; a non-count y with counts elsewhere says to pick one", () => {
  const iris = IRIS;
  const none = Own.fillLesson({ rounds: [{ challenges: [{ id: "m2", kind: "play", prompt: "p {y_col}", starter: "glm(@formula({y_col} ~ {num_col}), data, Poisson())" }] }] }, Own.settlePicks(null, iris), iris).rounds[0].challenges[0];
  assert.equal(none.prompt, "No column in this table holds counts, so the Poisson step does not apply here. Skip it.");
  assert.match(none.starter, /^#/);
  const some = Own.fillLesson({ rounds: [{ challenges: [{ id: "m2", kind: "play", prompt: "p {y_col}", starter: "glm(@formula({y_col} ~ {num_col}), data, Poisson())" }] }] }, { any: "pond", num: "frogs", y: "water_temp" }, PONDS_COLUMNS).rounds[0].challenges[0];
  assert.match(some.prompt, /Pick a count column as y\./);
});

test("polish: with no table, every step that needs the table (step 4 too) says read a table first and offers the button", () => {
  const t = ctl();
  t.c.start(); for (let i = 0; i < 3; i++) t.c.next();   // skip d1, d2, d3: now on p1, size(data), which names no column
  const v = t.c.view();
  assert.equal(v.ch.id, "own-r1-p1");
  assert.equal(v.ch.needTable, true, "step 4 offers Go to step 3");
  assert.match(v.ch.code, /^# Read a table in step 3 first\./);
});

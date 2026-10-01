#!/usr/bin/env node
// P10: run every R note, Python note and dictionary R/Python line of Lessons 1 to 6 on the lesson's practice data.
//
//   node tools/notes-run.cjs            prints NOTES-RUN-OK, or each failing span (exit 1)
//                                        or NOTES-SKIPPED (exit 2) when Rscript or pandas is missing: that is a failure
//                                        for the gate, never a pass.
//   JT_PYTHON=/path/to/python3 node tools/notes-run.cjs    pick the Python that has pandas and numpy.
//
// What is run.
//   Dictionary rows:  the whole `r` cell in R, the whole `py` cell in Python (they are code).
//   r_note / py_note: (1) every `backtick span` in the note; if there are none, (2) the LEADING code statement of the
//                     note, after an optional language label. The leading statement is the run of code-looking words
//                     at the start ("practice_jars %>% group_by(tray_id) ..."); the first plain prose word ends it.
//                     A note that starts with prose and has no backticks has no span: write code in backticks to have
//                     it run. Code for the other language (Julia syntax in an R note) belongs outside backticks.
// Data. Each lesson's tables (test/fixtures/lesson-data-values.json, the engine's own dump; regenerate with
//   tools/lesson-dump-data.jl) are written to CSV and loaded by name: R data frames (dplyr and magrittr attached),
//   pandas DataFrames (with numpy as np, pandas as pd, random). Every span runs in a fresh copy of that setup.
// A failure that only says a name is missing which the lesson itself makes (`counts = ...` on an earlier line, a
// simulation list) is CONTEXT: counted, listed, not a failure, because a note cannot see the learner's earlier lines.
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");

const root = path.join(__dirname, "..");
const LABEL = /^\s*(?:In\s+)?(?:R|Python|pandas|numpy|base R|dplyr)\s*:\s*/i;

// ---- spans -----------------------------------------------------------------------------------------------------
function backtickSpans(note) {
  return [...String(note).matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
}
const CODEY = /[()\[\]$<>=%.,:"'_0-9*+\/\\|&!-]/;
const OPEN = /[([{]/g, CLOSE = /[)\]}]/g;
const ENDS_OP = /(?:%>%|<-|=|,|\+|-|\*|\/|\||&|\(|\[|:|>|<)$/;
const STARTS_OP = /^(?:%>%|<-|=|,|\+|\*|\/|\||&|\)|\]|\[|\(|\.|:|>|<|\$)/;
/** The leading code statement of a note (after a label), or "". */
function leadingStatement(note) {
  const text = String(note).replace(LABEL, "").trim();
  const toks = text.split(/\s+/);
  const run = [];
  let depth = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const codey = CODEY.test(t);
    const prev = run.length ? run[run.length - 1] : "";
    const glue = depth > 0 || (prev && ENDS_OP.test(prev)) || STARTS_OP.test(t);
    if (!codey && !glue) break;
    // a bracket group set apart by a space after a finished piece of code is an aside in prose: "x.iloc[3] (counts from 0)"
    if (run.length && depth === 0 && /^\(/.test(t) && !ENDS_OP.test(prev)) break;
    // a token that is prose with a trailing full stop ends the run, and so does a capitalised sentence start
    if (run.length && /[.?!]$/.test(prev) && /^[A-Z]/.test(t)) break;
    run.push(t);
    depth += (t.match(OPEN) || []).length - (t.match(CLOSE) || []).length;
    // a comma outside every bracket ends the statement: "sum(x) / length(x), or mean(x)"
    if (depth <= 0 && /,$/.test(t)) break;
  }
  let s = run.join(" ").trim();
  s = s.replace(/[.,;:]+$/, "").trim();
  // a single bare word is not a statement worth running
  if (!/[()\[\]$<>=%.:"'|&]/.test(s) || s.length < 3) return "";
  // one unbalanced trailing bracket from prose such as "(a Symbol)" is cut off
  let d = 0; for (const ch of s) { if (/[([{]/.test(ch)) d++; else if (/[)\]}]/.test(ch)) d--; }
  if (d < 0) s = s.replace(/[)\]}]+$/, "").trim();
  return s;
}
function noteSpans(note) {
  if (typeof note !== "string" || !note.trim()) return [];
  const bt = backtickSpans(note);
  if (bt.length) return bt;
  const lead = leadingStatement(note);
  return lead ? [lead] : [];
}

// ---- collect --------------------------------------------------------------------------------------------------
function collect() {
  const lessons = [];
  for (let n = 1; n <= 6; n++) {
    const f = path.join(root, "lessons", `lesson${n}.json`);
    if (!fs.existsSync(f)) continue;
    const l = JSON.parse(fs.readFileSync(f, "utf8"));
    const spans = { r: [], py: [] };
    const add = (lang, where, code) => { if (typeof code === "string" && code.trim()) spans[lang].push({ where, code: code.trim() }); };
    for (const r of l.rounds || []) for (const c of r.challenges || []) {
      for (const code of noteSpans(c.r_note)) add("r", `${c.id} r_note`, code);
      for (const code of noteSpans(c.py_note)) add("py", `${c.id} py_note`, code);
    }
    for (const row of l.dictionary || []) {
      add("r", `dictionary ${JSON.stringify(row.julia)} r`, row.r);
      add("py", `dictionary ${JSON.stringify(row.julia)} py`, row.py);
    }
    // names the lesson makes itself: a missing one is CONTEXT, not a failure
    const made = new Set();
    for (const r of l.rounds || []) for (const c of r.challenges || []) {
      for (const t of [c.solution, c.starter]) for (const m of String(t || "").matchAll(/^\s*([A-Za-z_]\w*)\s*=(?!=)/gm)) made.add(m[1]);
    }
    for (const row of l.dictionary || []) { const m = /^\s*([A-Za-z_]\w*)\s*=(?!=)/.exec(row.julia || ""); if (m) made.add(m[1]); }
    lessons.push({ n, id: `lesson${n}`, spans, made });
  }
  return lessons;
}

// ---- data -----------------------------------------------------------------------------------------------------
function writeCsvs(dir, lessonId) {
  const fx = path.join(root, "test", "fixtures", "lesson-data-values.json");
  const data = fs.existsSync(fx) ? JSON.parse(fs.readFileSync(fx, "utf8")) : {};
  const tables = { ...((data[lessonId] && data[lessonId].data_values) || {}) };
  // the small warm-up table is the same in every lesson; a lesson whose dump lacks it borrows Lesson 1's copy
  const warm = data.lesson1 && data.lesson1.data_values && data.lesson1.data_values.practice_jars;
  if (warm && !tables.practice_jars) tables.practice_jars = warm;
  const files = [];
  const cell = (v) => (typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v === null ? "" : String(v));
  for (const [name, t] of Object.entries(tables)) {
    if (!t || !t.columns) continue;
    const f = path.join(dir, `${lessonId}-${name}.csv`);
    fs.writeFileSync(f, [t.columns.join(","), ...t.rows.map((row) => row.map(cell).join(","))].join("\n") + "\n");
    files.push({ name, file: f });
  }
  return files;
}

// Names the game's simulation setups provide (Lessons 5 and 6 read them as given lists): fixed, so a run repeats.
function extras(dir) {
  let x = 12345;
  const next = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const counts = Array.from({ length: 1000 }, () => { let k = 0; for (let i = 0; i < 8; i++) if (next() < 0.5) k++; return k; });
  const f = path.join(dir, "extras.json");
  fs.writeFileSync(f, JSON.stringify({ pretend_counts: counts, sim_counts: counts, seen_count: 5 }));
  return f;
}

// ---- runners --------------------------------------------------------------------------------------------------
function runR(lesson, dir, tables) {
  const items = lesson.spans.r;
  if (!items.length) return [];
  const jsonFile = path.join(dir, `${lesson.id}-r-spans.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(items.map((x) => x.code)));
  const script = path.join(dir, `${lesson.id}-run.R`);
  fs.writeFileSync(script, `
suppressPackageStartupMessages({ library(jsonlite); library(dplyr); library(magrittr) })
spans <- fromJSON(${JSON.stringify(jsonFile)})
extras <- fromJSON(${JSON.stringify(path.join(dir, "extras.json"))}, simplifyVector = TRUE)
tabs <- list(${tables.map((t) => `${JSON.stringify(t.name)} = ${JSON.stringify(t.file)}`).join(", ")})
for (i in seq_along(spans)) {
  env <- new.env(parent = globalenv())
  for (nm in names(tabs)) assign(nm, read.csv(tabs[[nm]], stringsAsFactors = FALSE), envir = env)
  for (nm in names(extras)) assign(nm, extras[[nm]], envir = env)
  res <- tryCatch({ invisible(capture.output(eval(parse(text = spans[[i]]), envir = env))); "OK" },
                  error = function(e) paste0("ERR: ", gsub("\\n", " ", conditionMessage(e))))
  cat(i, "\\t", res, "\\n", sep = "")
}
`);
  const out = cp.spawnSync("Rscript", ["--vanilla", script], { encoding: "utf8", timeout: 120000 });
  if (out.error) return items.map((x) => ({ ...x, status: "TOOL", msg: String(out.error) }));
  const byIdx = new Map();
  for (const line of out.stdout.split("\n")) { const m = /^(\d+)\t(.*)$/.exec(line); if (m) byIdx.set(+m[1], m[2]); }
  return items.map((x, i) => {
    const r = byIdx.get(i + 1);
    if (r === undefined) return { ...x, status: "TOOL", msg: (out.stderr || "no result").split("\n").slice(-3).join(" ") };
    return r === "OK" ? { ...x, status: "OK" } : { ...x, status: "FAIL", msg: r.slice(5) };
  });
}
const PY_DRIVER = `
import json, sys, copy, random
spec = json.load(open(sys.argv[1]))
full = spec["full"]
ns0 = {"random": random}
extras = json.load(open(spec["extras"]))
if full:
    import pandas as pd, numpy as np
    ns0.update(pd=pd, np=np, pandas=pd, numpy=np)
    for nm, f in spec["tables"].items():
        ns0[nm] = pd.read_csv(f)
    for nm, v in extras.items():
        ns0[nm] = np.array(v) if isinstance(v, list) else v
for i, code in enumerate(spec["spans"]):
    try:
        if full:
            ns = dict(ns0)
            for k in spec["tables"]:
                ns[k] = ns0[k].copy()
            try:
                exec(compile(code, "<note>", "eval"), ns)
            except SyntaxError:
                exec(compile(code, "<note>", "exec"), ns)
        else:
            try:
                compile(code, "<note>", "eval")
            except SyntaxError:
                compile(code, "<note>", "exec")
        print(f"{i+1}\\tOK")
    except BaseException as e:
        print(f"{i+1}\\tERR: {type(e).__name__}: " + str(e).replace("\\n", " "))
`;
function pythonWithPandas() {
  const cands = [process.env.JT_PYTHON, "python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"].filter(Boolean);
  const pyenv = path.join(os.homedir(), ".pyenv", "versions");
  if (fs.existsSync(pyenv)) for (const v of fs.readdirSync(pyenv)) cands.push(path.join(pyenv, v, "bin", "python3"));
  for (const c of cands) {
    const t = cp.spawnSync(c, ["-c", "import pandas, numpy"], { encoding: "utf8" });
    if (t.status === 0) return c;
  }
  return null;
}
function runPy(lesson, dir, tables, py) {
  const items = lesson.spans.py;
  if (!items.length) return [];
  const spec = path.join(dir, `${lesson.id}-py-spec.json`);
  fs.writeFileSync(spec, JSON.stringify({ full: !!py.full, extras: path.join(dir, "extras.json"), spans: items.map((x) => x.code), tables: Object.fromEntries(tables.map((t) => [t.name, t.file])) }));
  const drv = path.join(dir, "py-driver.py");
  fs.writeFileSync(drv, PY_DRIVER);
  const out = cp.spawnSync(py.exe, [drv, spec], { encoding: "utf8", timeout: 120000 });
  const byIdx = new Map();
  for (const line of (out.stdout || "").split("\n")) { const m = /^(\d+)\t(.*)$/.exec(line); if (m) byIdx.set(+m[1], m[2]); }
  return items.map((x, i) => {
    const r = byIdx.get(i + 1);
    if (r === undefined) return { ...x, status: "TOOL", msg: (out.stderr || "no result").split("\n").slice(-3).join(" ") };
    return r === "OK" ? { ...x, status: py.full ? "OK" : "SYNTAX" } : { ...x, status: "FAIL", msg: r.slice(5) };
  });
}

// ---- main -----------------------------------------------------------------------------------------------------
function main() {
  const lessons = collect();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-notes-"));
  extras(dir);
  const rOk = cp.spawnSync("Rscript", ["--version"], { encoding: "utf8" }).status === 0 &&
    cp.spawnSync("Rscript", ["--vanilla", "-e", "library(dplyr);library(jsonlite);library(magrittr)"], { encoding: "utf8" }).status === 0;
  const pyExe = pythonWithPandas();
  const py = pyExe ? { exe: pyExe, full: true } : { exe: process.env.JT_PYTHON || "python3", full: false };
  const failures = [], contexts = [];
  let nR = 0, nPy = 0, nSyntax = 0;
  for (const lesson of lessons) {
    const tables = writeCsvs(dir, lesson.id);
    const results = [];
    if (rOk) for (const r of runR(lesson, dir, tables)) results.push({ lang: "R", ...r });
    for (const r of runPy(lesson, dir, tables, py)) results.push({ lang: "Python", ...r });
    for (const r of results) {
      if (r.status === "OK" || r.status === "SYNTAX") {
        if (r.lang === "R") nR++; else if (r.status === "OK") nPy++; else nSyntax++;
        continue;
      }
      const miss = /object '(\w+)' not found/.exec(r.msg || "") || /name '(\w+)' is not defined/.exec(r.msg || "");
      if (miss && lesson.made.has(miss[1])) { contexts.push(`${lesson.id} ${r.lang} ${r.where}: needs ${miss[1]}, which an earlier line of the lesson makes`); continue; }
      failures.push(`${lesson.id} ${r.lang} ${r.where}: ${r.code}\n      -> ${r.msg}`);
    }
  }
  const spans = lessons.reduce((a, l) => a + l.spans.r.length + l.spans.py.length, 0);
  console.log(`notes-run: ${spans} spans in ${lessons.length} lessons; R ran ${nR}, Python ran ${nPy}${nSyntax ? `, Python syntax-checked only ${nSyntax}` : ""}, context-dependent ${contexts.length}, failed ${failures.length}`);
  if (contexts.length) console.log("CONTEXT (not failures):\n  " + contexts.join("\n  "));
  if (failures.length) { console.log("FAILURES:\n  " + failures.join("\n  ")); }
  const skipped = [];
  if (!rOk) skipped.push("Rscript (with dplyr, jsonlite, magrittr) is missing or not working, so no R span ran");
  if (!pyExe) skipped.push("no python3 with pandas and numpy was found (set JT_PYTHON), so Python spans were only syntax-checked");
  if (failures.length) { console.log(`NOTES-RUN-FAILED: ${failures.length} failing spans`); if (skipped.length) console.log("NOTES-SKIPPED (also): " + skipped.join("; ")); process.exit(1); }
  if (skipped.length) { console.log("NOTES-SKIPPED: " + skipped.join("; ") + ". A skipped run is a failure for the gate, not a pass."); process.exit(2); }
  console.log("NOTES-RUN-OK");
}
// node tools/notes-run.cjs --selftest: a wrong span must fail, a right one must pass, in both languages.
function selftest() {
  const assert = require("assert");
  assert.deepStrictEqual(noteSpans("R: practice_jars %>% group_by(tray_id). Julia writes it differently."), ["practice_jars %>% group_by(tray_id)"]);
  assert.deepStrictEqual(noteSpans("desk.keyed.iloc[3] (pandas counts from 0)"), ["desk.keyed.iloc[3]"]);
  assert.deepStrictEqual(noteSpans("sum(flags) / length(flags), or mean(flags)"), ["sum(flags) / length(flags)"]);
  assert.deepStrictEqual(noteSpans("Python counts from 0; Julia counts from 1."), []);
  assert.deepStrictEqual(noteSpans("Use `len(x)` and `x.sum()` here."), ["len(x)", "x.sum()"]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-notes-self-"));
  extras(dir);
  const tables = writeCsvs(dir, "lesson1");
  const lesson = { id: "lesson1", spans: { r: [{ where: "a", code: "nrow(practice_jars)" }, { where: "b", code: "stop('boom')" }], py: [{ where: "c", code: "len(practice_jars)" }, { where: "d", code: "practice_jars.nope" }, { where: "e", code: "1 +" }] } };
  const r = runR(lesson, dir, tables).map((x) => x.status);
  assert.deepStrictEqual(r, ["OK", "FAIL"], "R: " + r);
  const pyExe = pythonWithPandas();
  const p = runPy(lesson, dir, tables, pyExe ? { exe: pyExe, full: true } : { exe: "python3", full: false }).map((x) => x.status);
  assert.deepStrictEqual(p, pyExe ? ["OK", "FAIL", "FAIL"] : ["SYNTAX", "SYNTAX", "FAIL"], "Python: " + p);
  console.log("NOTES-RUN-SELFTEST-OK" + (pyExe ? "" : " (Python syntax-only: no pandas)"));
}
if (require.main === module) { if (process.argv.includes("--selftest")) selftest(); else main(); }
module.exports = { noteSpans, leadingStatement, backtickSpans, LABEL };

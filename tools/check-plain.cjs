// Plain-words gate (plan D8): banned insider phrases must not appear in anything a player reads.
// Scans HTML text and string literals in learner-facing JS and Julia files; comments are skipped.
"use strict";
const fs = require("fs"), path = require("path");
const root = process.argv[2] || ".";
const BANNED = (process.env.BANNED || [
  "compatible candidate ranges", "stated range check", "established in this browser", "retained",
  "provenance", "evidence saved", "challenge mode", "fixture", "teaching model",
  "replace a fresh Julia check", "recording disagreement", "separate teaching exercise",
  "cannot identify what happened", "not explanations for",
  // Panel adversary review, item 11 (2026-09-26): insider/developer-register words swept from
  // visible learner text; kept here so they cannot silently come back.
  "evidence board", "evidence secured", "your saved evidence", "descriptive summary",
  "not case evidence", "add case evidence", "your returned evidence", "resume saved move",
  "keep the question in view", "compare a fixed bootstrap calculation", "establishes no cause",
  "does not enter your editor or add evidence", "filtering the B09 records",
  "add changed browser history",
  // Night playtest 2026-09-26 (docs/dev-log/playtest/2026-09-26-night/README.md item 2): phrases the
  // first list missed; a player saw each of them.
  "visible server input", "clear move", "this move", "julia move", "model inputs",
  "supplied simulations", "comparison threshold", "event mask", "meet your event", "marks this tail",
  "boolean result", "lab file", "lab link", "event frequency", "tail frequency", "the game's note",
  "passed the check", "supplied list", "eligible simulated", "already available in this exercise",
  "small window", "saved rows", "simulation event", "connected tray records",
  "local julia lab connection", "fixed julia readiness", "fixed local calculation",
  "sampling function", "nothing found yet", "left/right tags", "meet the return",
  "simulation table to load", "a shared tray label is not a cause", "point at any person",
  // Adversary review S3 (2026-09-27) and replay notes: insider words the previous list missed.
  "checking your move", "your move", "non-credit replay", "non-credit", "case credit",
  "model outcome", "model counts", "meet the event", "meets the event", "server-supplied",
  "simulated count", "one number per simulation", "simulated distribution", "sandbox worker",
  "grouped value or DataFrame",
  // Resumed fix round (2026-09-27): two S3 leftovers the list above still missed.
  "final move", "simulated trial", "one per simulation",
  // Shinichi's play-through 2026-09-27 (story spine): C1 practice jargon.
  "indexing expression", "boolean rule", "know indexing", "new to indexing"
].join("|")).split("|");
const files = [];
const walk = dir => { for (const e of fs.readdirSync(dir, {withFileTypes:true})) { const p = path.join(dir, e.name);
  if (e.isDirectory()) { if (!["vendor", "assets", "fixtures"].includes(e.name)) walk(p); }
  else if (/\.(html|js)$/.test(e.name) && !/fixtures\.html$/.test(e.name)) files.push(p); } };
walk(path.join(root, "web"));
for (const f of fs.readdirSync(path.join(root, "src"))) if (/^mystery.*\.jl$/.test(f)) files.push(path.join(root, "src", f));
const hits = [];
for (const f of files) {
  let text = fs.readFileSync(f, "utf8");
  if (f.endsWith(".html")) text = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ");
  else if (f.endsWith(".js")) text = (text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1").match(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || []).join("\n");
  else text = (text.replace(/"""[\s\S]*?"""/g, " ").replace(/#[^\n"]*$/gm, "").match(/"(?:[^"\\\n]|\\.)*"/g) || []).join("\n");
  // A string with no space is a class name, key or identifier, never a sentence a player reads.
  if (!f.endsWith(".html")) text = text.split("\n").filter(line => /\s/.test(line.slice(1, -1))).join("\n");
  for (const phrase of BANNED) { const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); const n = (text.match(re) || []).length; if (n) hits.push(`${path.relative(root, f)}: "${phrase}" x${n}`); }
}
if (hits.length) { console.log(hits.join("\n")); console.log(`PLAIN-WORDS: ${hits.length} file/phrase hits`); process.exit(1); }
console.log("PLAIN-WORDS-CLEAN");

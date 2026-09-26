#!/usr/bin/env node
// eyes.cjs — headless-browser "eyes" for an AI student playing Julia Time in a REAL browser.
//
// Unlike the text-only persona harness (docs/dev-log/playtest/2026-09-24-persona-harness/jt.cjs),
// this drives an actual Chromium page with Playwright, so the student SEES layout, button state,
// pre-filled editor boxes and leftover saved progress via screenshots — not a re-implementation of
// the page's rendering logic.
//
// One persona = one background daemon holding one persistent headless Chromium page. Commands are
// short-lived CLI invocations that talk to that daemon over a local HTTP port recorded in
// $EYES_HOME/<persona>/daemon.json, so browser + page state (typed code, WebSocket connection)
// survive across separate `node eyes.cjs ...` calls.
//
// Usage: see README.md in this directory for the full command list and a student-brief template.
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const EYES_HOME = process.env.EYES_HOME || path.join(__dirname, "personas");

const PROGRESS_KEY = "julia-time:missing-fleas:course:v1:progress-v1";
const PROGRESS_VALUE = {
  schema_version: 1,
  case_id: "missing-fleas-v1",
  accepted: {
    "C1/select-records": { case_id: "missing-fleas-v1", chapter: "C1", move_id: "select-records", provenance: "historical-browser" },
    "C4/select-eligible": { case_id: "missing-fleas-v1", chapter: "C4", move_id: "select-eligible", provenance: "historical-browser" },
  },
};
const DRAFT_KEY = "julia-time:missing-fleas:course:v1:draft:C2:group:challenge";
const DRAFT_VALUE = "groupby(jars, :tray)";
const SEED_MARKER_KEY = "playtest-eyes:seeded-v1";

function personaDir(persona) {
  const d = path.join(EYES_HOME, persona);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function daemonFile(persona) { return path.join(personaDir(persona), "daemon.json"); }
function logFile(persona) { return path.join(personaDir(persona), "log.jsonl"); }

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "cmd";
}

function readDaemonInfo(persona) {
  const f = daemonFile(persona);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (_) { return null; }
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

function nextSeq(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  let max = 0;
  for (const f of files) {
    const m = /^(\d+)-/.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

// ---------------------------------------------------------------------------
// Daemon (child) side: owns the Playwright page.
// ---------------------------------------------------------------------------
async function runDaemon(persona, gamePort, seedMode) {
  const { chromium } = require("playwright");
  const dir = personaDir(persona);
  const profileDir = path.join(dir, "profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const df = daemonFile(persona);

  const server = http.createServer((req, res) => { handleHttp(req, res); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const controlPort = server.address().port;

  const info = { pid: process.pid, controlPort, gamePort, persona, seed: seedMode, ready: false, startedAt: new Date().toISOString() };
  fs.writeFileSync(df, JSON.stringify(info, null, 1));

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1280, height: 900 },
  });

  if (seedMode === "old-progress") {
    await context.addInitScript(
      ([pk, pv, dk, dv, marker]) => {
        try {
          if (!window.localStorage.getItem(marker)) {
            window.localStorage.setItem(pk, pv);
            window.localStorage.setItem(dk, dv);
            window.localStorage.setItem(marker, "1");
          }
        } catch (_) {}
      },
      [PROGRESS_KEY, JSON.stringify(PROGRESS_VALUE), DRAFT_KEY, DRAFT_VALUE, SEED_MARKER_KEY]
    );
  }

  const page = context.pages()[0] || (await context.newPage());
  const ctx = { page, context, gamePort, dir, persona, seq: nextSeq(dir) - 1 };

  info.ready = true;
  fs.writeFileSync(df, JSON.stringify(info, null, 1));

  async function handleHttp(req, res) {
    if (req.method !== "POST" || req.url !== "/cmd") { res.writeHead(404); res.end("not found"); return; }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let parsed;
      try { parsed = JSON.parse(body || "{}"); } catch (_) { res.writeHead(400); res.end("bad json"); return; }
      if (parsed.command === "shutdown") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        try { await context.close(); } catch (_) {}
        try { fs.unlinkSync(df); } catch (_) {}
        setTimeout(() => process.exit(0), 50);
        return;
      }
      try {
        const result = await handleCommand(ctx, parsed);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String((e && e.message) || e) }));
      }
    });
  }

  // Keep the process alive; the HTTP server + persistent context do that on their own.
}

async function gotoTarget(page, gamePort, target) {
  let url = target;
  if (!/^https?:\/\//i.test(target)) {
    url = `http://127.0.0.1:${gamePort}` + (target.startsWith("/") ? target : "/" + target);
  }
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
}

async function clickTarget(page, target) {
  if (target.startsWith("#")) { await page.click(target, { timeout: 8000 }); return; }
  const attempts = [
    () => page.getByRole("button", { name: target, exact: true }),
    () => page.getByRole("link", { name: target, exact: true }),
    () => page.getByRole("button", { name: target, exact: false }),
    () => page.getByRole("link", { name: target, exact: false }),
    () => page.getByText(target, { exact: false }),
  ];
  for (const make of attempts) {
    const loc = make();
    if ((await loc.count()) > 0) { await loc.first().click({ timeout: 8000 }); return; }
  }
  throw new Error(`No clickable element found for: "${target}"`);
}

async function typeInto(page, target, text) {
  let loc;
  if (target.startsWith("#")) {
    loc = page.locator(target);
  } else {
    loc = page.getByLabel(target, { exact: false });
    if ((await loc.count()) === 0) loc = page.getByPlaceholder(target, { exact: false });
    if ((await loc.count()) === 0) throw new Error(`No input/textarea found for label: "${target}"`);
  }
  await loc.first().fill(text, { timeout: 8000 });
}

async function scrollPage(page, direction) {
  const dy = direction === "up" ? -700 : 700;
  await page.mouse.wheel(0, dy);
}

async function snapshot(page, seq, cmdLabel, dir) {
  const url = page.url();
  const shotPath = path.join(dir, `${String(seq).padStart(3, "0")}-${cmdLabel}.png`);
  try { await page.screenshot({ path: shotPath, fullPage: true }); } catch (_) {}

  let elements = [];
  try {
    elements = await page.evaluate(() => {
      function accessibleName(el) {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria.trim();
        const labelledby = el.getAttribute("aria-labelledby");
        if (labelledby) {
          const t = labelledby.split(/\s+/).map((id) => { const n = document.getElementById(id); return n ? n.textContent.trim() : ""; }).filter(Boolean).join(" ");
          if (t) return t;
        }
        if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.id) {
          const lab = document.querySelector(`label[for="${el.id}"]`);
          if (lab) return lab.textContent.trim();
        }
        const txt = (el.textContent || "").trim();
        if (txt) return txt.replace(/\s+/g, " ").slice(0, 200);
        if (el.value) return String(el.value).slice(0, 200);
        if (el.placeholder) return el.placeholder;
        return "";
      }
      function visible(el) {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      }
      const nodes = Array.from(document.querySelectorAll('button, a[href], textarea, input, select, [role="button"]'));
      return nodes.filter(visible).map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || "",
        id: el.id || "",
        name: accessibleName(el),
        disabled: !!el.disabled,
      }));
    });
  } catch (_) {}

  let textareas = [];
  try {
    textareas = await page.evaluate(() =>
      Array.from(document.querySelectorAll("textarea")).map((t) => ({ id: t.id || "(no id)", value: t.value }))
    );
  } catch (_) {}

  let text = "";
  try {
    const bodyText = await page.evaluate(() => document.body.innerText || "");
    text = bodyText.replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
  } catch (_) {}

  return { url, screenshot: shotPath, elements, textareas, text };
}

async function handleCommand(ctx, body) {
  const { command, args = [] } = body;
  let error = null;
  try {
    switch (command) {
      case "goto": await gotoTarget(ctx.page, ctx.gamePort, args[0]); break;
      case "click": await clickTarget(ctx.page, args[0]); break;
      case "type": await typeInto(ctx.page, args[0], args[1]); break;
      case "scroll": await scrollPage(ctx.page, args[0]); break;
      case "look": break;
      case "back": await ctx.page.goBack({ timeout: 15000 }); break;
      case "wait": await ctx.page.waitForTimeout(Math.min(Math.max(Number(args[0]) || 0, 0), 120) * 1000); break;
      default: throw new Error("unknown command: " + command);
    }
  } catch (e) {
    error = String((e && e.message) || e);
  }
  try { await ctx.page.waitForTimeout(300); } catch (_) {}
  ctx.seq += 1;
  const cmdLabel = slug(command + (args && args[0] !== undefined ? "-" + String(args[0]) : ""));
  const snap = await snapshot(ctx.page, ctx.seq, cmdLabel, ctx.dir);
  const result = { ...snap, error, command, args };

  try {
    fs.appendFileSync(
      logFile(ctx.persona),
      JSON.stringify({
        t: new Date().toISOString(),
        command,
        args,
        url: result.url,
        screenshot: result.screenshot,
        error: result.error,
        textareas: result.textareas,
      }) + "\n"
    );
  } catch (_) {}

  return result;
}

// ---------------------------------------------------------------------------
// CLI (client) side: short-lived process per command.
// ---------------------------------------------------------------------------
function callDaemon(persona, cmd) {
  return new Promise((resolve, reject) => {
    const info = readDaemonInfo(persona);
    if (!info || !isAlive(info.pid)) {
      reject(new Error(`No running eyes daemon for persona "${persona}". Run: node eyes.cjs start ${persona}`));
      return;
    }
    const data = JSON.stringify(cmd);
    const req = http.request(
      { host: "127.0.0.1", port: info.controlPort, path: "/cmd", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          try { resolve(JSON.parse(out)); } catch (e) { reject(new Error("Bad response from daemon: " + out)); }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function printResult(persona, result) {
  console.log(`=== ${persona} — ${result.command || "start"} ===`);
  if (result.error) console.log(`ERROR: ${result.error}`);
  console.log(`URL: ${result.url || "(none)"}`);
  console.log(`Screenshot: ${result.screenshot || "(none)"}`);
  console.log("");
  console.log("Visible interactive elements:");
  const els = result.elements || [];
  if (!els.length) console.log("  (none found)");
  els.forEach((el, i) => {
    const idPart = el.id ? ` #${el.id}` : "";
    const disabledPart = el.disabled ? " [disabled]" : "";
    console.log(`  ${i + 1}. [${el.tag}${el.type ? ":" + el.type : ""}]${idPart} "${el.name}"${disabledPart}`);
  });
  console.log("");
  console.log("Textarea contents:");
  const tas = result.textareas || [];
  if (!tas.length) console.log("  (none on this page)");
  tas.forEach((t) => {
    console.log(`  #${t.id}:`);
    console.log(t.value ? "    " + t.value.replace(/\n/g, "\n    ") : "    (empty)");
  });
  console.log("");
  console.log("Page text (visible, trimmed to ~3000 chars):");
  console.log(result.text || "(empty)");
}

async function waitForDaemonReady(persona, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = readDaemonInfo(persona);
    if (info && info.ready) return info;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Daemon for "${persona}" did not become ready within ${timeoutMs}ms. Check ${path.join(personaDir(persona), "daemon.log")}`);
}

async function cmdStart(persona, rest) {
  const existing = readDaemonInfo(persona);
  if (existing && isAlive(existing.pid)) {
    throw new Error(`Persona "${persona}" already has a running daemon (pid ${existing.pid}). Run: node eyes.cjs stop ${persona}`);
  }
  if (existing) { try { fs.unlinkSync(daemonFile(persona)); } catch (_) {} }

  let port = null, seed = "empty";
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--port") port = Number(rest[++i]);
    else if (rest[i] === "--seed") seed = rest[++i];
  }
  if (!port) throw new Error("start requires --port <9600-9699>");
  if (port < 9600 || port > 9699) throw new Error("Port must be in the range 9600-9699.");
  if (!["old-progress", "empty"].includes(seed)) throw new Error('--seed must be "old-progress" or "empty"');

  const dir = personaDir(persona);
  const logFd = fs.openSync(path.join(dir, "daemon.log"), "a");
  const child = spawn(process.execPath, [__filename, "__daemon", persona, String(port), seed], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    cwd: __dirname,
  });
  child.unref();

  await waitForDaemonReady(persona, 30000);
  const result = await callDaemon(persona, { command: "look" });
  result.command = "start";
  printResult(persona, result);
}

async function cmdStop(persona) {
  const info = readDaemonInfo(persona);
  if (!info) { console.log(`No running eyes daemon for persona "${persona}".`); return; }
  try {
    await callDaemon(persona, { command: "shutdown" });
    console.log(`Stopped persona "${persona}" (was pid ${info.pid}, port ${info.controlPort}).`);
  } catch (e) {
    console.log(`Could not reach daemon cleanly (${e.message}); killing pid ${info.pid} directly.`);
    try { process.kill(info.pid, "SIGKILL"); } catch (_) {}
  }
  try { fs.unlinkSync(daemonFile(persona)); } catch (_) {}
}

async function main() {
  const [cmd, persona, ...rest] = process.argv.slice(2);

  if (cmd === "__daemon") {
    // internal: node eyes.cjs __daemon <persona> <gamePort> <seedMode>
    const [p, portStr, seedMode] = process.argv.slice(3);
    await runDaemon(p, Number(portStr), seedMode);
    return;
  }

  if (!cmd || cmd === "help" || !persona) {
    console.log([
      "Usage: node eyes.cjs <command> <persona> [args...]",
      "",
      "  start <persona> --port <9600-9699> [--seed old-progress|empty]",
      "  stop <persona>",
      "  goto <persona> <url-or-path>",
      '  click <persona> "<visible text>" | click <persona> #id',
      '  type <persona> "#id-or-label" "<text>"',
      "  scroll <persona> down|up",
      "  look <persona>",
      "  back <persona>",
      "  wait <persona> <seconds>",
    ].join("\n"));
    return;
  }

  if (cmd === "start") { await cmdStart(persona, rest); return; }
  if (cmd === "stop") { await cmdStop(persona); return; }

  const commandsWithOneArg = ["goto", "click", "scroll", "wait"];
  const commandsWithNoArg = ["look", "back"];
  let result;
  if (cmd === "type") {
    result = await callDaemon(persona, { command: "type", args: [rest[0], rest[1]] });
  } else if (commandsWithOneArg.includes(cmd)) {
    result = await callDaemon(persona, { command: cmd, args: [rest[0]] });
  } else if (commandsWithNoArg.includes(cmd)) {
    result = await callDaemon(persona, { command: cmd, args: [] });
  } else {
    throw new Error(`Unknown command "${cmd}". Run: node eyes.cjs help`);
  }
  printResult(persona, result);
}

main().catch((e) => {
  console.error(`eyes: ${e.message}`);
  process.exit(1);
});

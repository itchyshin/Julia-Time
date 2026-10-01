"use strict";
// Julia Time 0.5 fix round 2, package P01 (blocker): the Board's Julia check.
//   (a) the socket goes to the page's own host, so localhost and 127.0.0.1 both reach the running game;
//   (b) while Julia warms up, the page says "starting" (never "not connected") and Start keeps its normal look;
//   (c) after a real failure exactly one visible line says so, with a Reconnect button beside it.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const web = path.join(__dirname, "..", "web", "course");
const html = fs.readFileSync(path.join(web, "index.html"), "utf8");

function fakeElement(id) {
  const listeners = {};
  return {id, textContent: "", hidden: false, disabled: false, dataset: {}, attributes: {}, open: false, listeners,
    setAttribute(k, v) { this.attributes[k] = String(v); }, focus() { this.focused = true; },
    addEventListener(name, fn) { listeners[name] = fn; }};
}
// A Board page with a fake WebSocket and timer queue, so the readiness controller can be driven by hand.
function page(loc, extra) {
  const elements = {}, sockets = [], timers = [];
  const document = {
    getElementById(id) { return elements[id] || (elements[id] = fakeElement(id)); },
    addEventListener(name, fn) { this.ready = fn; }
  };
  class FakeSocket {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; this.l = {}; sockets.push(this); }
    addEventListener(name, fn) { this.l[name] = fn; }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; }
    emit(name, event) { if (this.l[name]) this.l[name](event || {}); }
  }
  FakeSocket.OPEN = 1;
  const window = Object.assign({location: loc, WebSocket: FakeSocket, document,
    setTimeout(fn, ms) { timers.push({fn, ms, live: true}); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].live = false; },
    addEventListener() {}}, extra || {});
  const context = vm.createContext({window, document, console});
  for (const file of ["setup-status-client.js", "setup-status-board.js"])
    vm.runInContext(fs.readFileSync(path.join(web, file), "utf8"), context, {filename: file});
  for (const id of ["setup-readiness", "setup-status", "setup-recheck", "setup-reconnect", "setup-version", "setup-checked-at", "setup-reason", "continue-action", "julia-line"]) document.getElementById(id);
  elements["continue-action"].dataset.readyLabel = "Start Lesson 1";
  document.ready();
  return {elements, sockets, timers, line: () => elements["julia-line"].textContent,
    fire(maxMs) { for (const t of timers) if (t.live && t.ms <= maxMs) { t.live = false; t.fn(); } },
    open(i = 0) { sockets[i].readyState = 1; sockets[i].emit("open"); },
    pong(i = 0) { sockets[i].emit("message", {data: JSON.stringify({type: "pong"})}); },
    ready(i = 0) {
      const ask = sockets[i].sent.find(m => m.type === "setup_status");
      sockets[i].emit("message", {data: JSON.stringify({type: "setup_status", request_id: ask.request_id, contract_version: "setup-v1", server_version: "0.5.0", host: "127.0.0.1",
        story: {contract_version: "setup-v1", component: "julia", state: "ready", reason: "ready", version: "1.10.12", checked_at: "2026-09-30T10:00:00", next_action: "Start the case."},
        laboratory: {state: "not_checked"}})});
    }};
}

test("(a) the socket uses the page's own host: localhost and 127.0.0.1 both work, and https gives wss", () => {
  for (const host of ["localhost:9661", "127.0.0.1:9661", "localhost:8003"]) {
    const p = page({protocol: "http:", host, port: host.split(":")[1], search: ""});
    assert.equal(p.sockets.length, 1);
    assert.equal(p.sockets[0].url, "ws://" + host + "/ws");
  }
  assert.equal(page({protocol: "https:", host: "example.org", port: "", search: ""}).sockets[0].url, "wss://example.org/ws");
  assert.doesNotMatch(fs.readFileSync(path.join(web, "setup-status-board.js"), "utf8"), /ws:\/\/127\.0\.0\.1/, "no fixed 127.0.0.1 socket address");
});

test("(b) before any socket event, and while Julia warms up, the line says starting and Start keeps its normal look", () => {
  const p = page({protocol: "http:", host: "localhost:9661", search: ""});
  assert.match(p.line(), /^Julia is starting/);
  assert.doesNotMatch(p.line(), /not (connected|ready|running)/i);
  assert.equal(p.elements["continue-action"].attributes["aria-disabled"], "false");
  assert.equal(p.elements["setup-reconnect"].hidden, true);
  p.open(); p.pong();   // connected, the readiness check is now waiting for the warm-up
  assert.match(p.line(), /^Julia is starting/);
  p.fire(5000);         // the 5 s connect timer has no say once the game has answered
  assert.match(p.line(), /^Julia is starting/, "a slow first launch is not a failure");
  assert.equal(p.elements["continue-action"].attributes["aria-disabled"], "false");
  p.ready();
  assert.equal(p.line(), "Julia is ready.");
  assert.equal(p.elements["setup-reconnect"].hidden, true);
  assert.equal(p.elements["continue-action"].textContent, "Start Lesson 1");
});

test("(c) after a real failure one line says so in plain words, with a Reconnect button and the Start link held", () => {
  const p = page({protocol: "http:", host: "localhost:9661", search: ""});
  p.sockets[0].emit("error");
  assert.equal(p.line(), "Julia is not running yet. In the folder you downloaded, double-click Play-Julia-Time-Mac.command (Mac) or Play-Julia-Time-Windows (Windows). Wait until its window says Julia Time is running, then press Reconnect.");
  assert.equal(p.elements["setup-reconnect"].hidden, false);
  assert.equal(p.elements["continue-action"].attributes["aria-disabled"], "true");
  assert.equal(p.elements["continue-action"].textContent, "Start Lesson 1", "the button keeps its name");
  // Only #julia-line sits outside the closed fold; the fold holds the technical detail.
  const fold = html.slice(html.indexOf('<details id="also-here"'), html.indexOf("</details>\n</main>"));
  const outside = Object.keys(p.elements).filter(id => /not (ready|running)/i.test(p.elements[id].textContent) && !fold.includes('id="' + id + '"'));
  assert.deepEqual(outside, ["julia-line"]);
  // Reconnect tries again, and the wait reads as starting.
  p.elements["setup-reconnect"].listeners.click();
  assert.equal(p.sockets.length, 2);
  assert.match(p.line(), /^Julia is starting/);
});

test("(c2) the 5 s timer ends a silent connection; all-done Board says the saved work is safe", () => {
  const p = page({protocol: "http:", host: "127.0.0.1:9661", search: ""});
  p.elements["continue-action"].dataset.kind = "ending";
  p.fire(5000);
  assert.equal(p.line(), "Your saved work is safe on this computer. Start Julia Time to play again, then press Reconnect.");
  assert.doesNotMatch(p.line(), /^not ready/i);
});

test("(d) the Board says Julia once: no 'Before you play' aside, no Julia clause in the fold summary, no fixed port-8000 text", () => {
  assert.doesNotMatch(html, /Before you play|julia-summary/);
  const summary = /<summary>(Also on this computer[^<]*)<\/summary>/.exec(html)[1];
  assert.doesNotMatch(summary, /Julia check: (ready|connecting|not ready)/);
  assert.doesNotMatch(fs.readFileSync(path.join(web, "setup-status-board.js"), "utf8"), /8000\/"|open http:/);
  assert.match(html, /<strong>Needs:<\/strong> Julia and the Julia Time launcher, set up once\./);
  assert.match(html, /id="setup-reconnect"[^>]*>Reconnect<\/button>/);
  assert.ok(html.indexOf('id="setup-reconnect"') < html.indexOf('<details id="also-here"'), "Reconnect is beside the line, not inside the fold");
});

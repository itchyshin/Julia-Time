"use strict";
// Keyboard only (the bar's "nobody left behind" persona; fix round 2): the whole dummy lesson is played in a real
// browser with the keyboard alone. Every control a player needs is reached with Tab, used with Enter or Space, shows a
// visible focus ring, and has a name a screen reader can say. The code runs with Ctrl+Enter from the editor.
// It uses the Playwright in tools/playtest-eyes and skips (with a note) when that is not installed. Port 9698.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
let chromium = null;
try { ({ chromium } = require(path.join(root, "tools/playtest-eyes/node_modules/playwright"))); } catch (e) { chromium = null; }
const dummy = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/lesson-dummy.json"), "utf8"));

// The server's side of the dummy: a run passes when it is the task's own solution.
function fakeSocket(LESSON) {
  window.WebSocket = class {
    constructor() { this.readyState = 0; this.l = {}; setTimeout(() => { this.readyState = 1; (this.l.open || []).forEach((f) => f({})); }, 5); }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    close() {}
    send(text) {
      const m = JSON.parse(text); let out = null;
      const all = []; LESSON.rounds.forEach((r) => r.challenges.forEach((c) => all.push(c)));
      if (m.type === "lesson_info") {
        const L = JSON.parse(JSON.stringify(LESSON));
        L.rounds.forEach((r) => r.challenges.forEach((c) => { delete c.check; if (c.kind === "checkpoint") delete c.solution; }));
        out = { type: "lesson", request_id: m.request_id, lesson: L };
      } else if (m.type === "lesson_list") out = { type: "lessons", lessons: [{ id: LESSON.id, number: LESSON.number, title: LESSON.title }] };
      else if (m.type === "lesson_run") {
        const c = all.find((x) => x.id === m.challenge);
        const pass = c.kind !== "play" && m.code.trim() === String(c.solution).trim();
        out = { type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", pass, value_repr: pass ? "5" : "0", shown: pass ? "5" : "0", stdout: "",
          feedback: pass ? "Good." : (c.kind === "play" ? "" : "Not yet.") };
      }
      if (out) setTimeout(() => (this.l.message || []).forEach((f) => f({ data: JSON.stringify(out) })), 5);
    }
  };
}

test("keyboard only: the whole lesson is played with Tab, Enter, Space and Ctrl+Enter; focus is always visible and named", { skip: chromium ? false : "Playwright is not installed in tools/playtest-eyes" }, async () => {
  const web = path.join(root, "web");
  const srv = http.createServer((q, r) => {
    const f = path.join(web, q.url.split("?")[0]);
    try { r.setHeader("content-type", f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "text/html"); r.end(fs.readFileSync(f)); } catch (e) { r.statusCode = 404; r.end(); }
  });
  await new Promise((res) => srv.listen(9698, res));
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
    await page.addInitScript(`(${fakeSocket.toString()})(${JSON.stringify(dummy)})`);
    await page.goto("http://127.0.0.1:9698/lesson.html?lesson=dummy");
    await page.waitForSelector("#start:visible");
    // What has focus now: its id or text, whether its focus ring shows, and the name a screen reader says.
    const focused = () => page.evaluate(() => {
      const n = document.activeElement;
      const cs = getComputedStyle(n);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== "none";
      const label = n.getAttribute("aria-label") || (n.labels && n.labels[0] && n.labels[0].textContent) || n.textContent;
      return { id: n.id, tag: n.tagName.toLowerCase(), text: (n.textContent || "").trim(), name: String(label || "").trim(), ring, disabled: !!n.disabled };
    });
    // Tab until `match` has focus; every stop on the way must show its ring and have a name.
    const tabTo = async (match, most) => {
      for (let i = 0; i < (most || 40); i++) {
        await page.keyboard.press("Tab");
        const f = await focused();
        if (f.tag !== "body") {
          assert.ok(f.ring, "a visible focus ring on " + (f.id || f.tag + " " + f.text));
          assert.ok(f.name, "a name for " + (f.id || f.tag));
        }
        if (match(f)) return f;
      }
      throw new Error("never reached by Tab");
    };
    const byId = (id) => (f) => f.id === id;
    // the two switches in the bar: Space flips one, and the page follows
    await tabTo(byId("show-py"));
    await page.keyboard.press("Space");
    assert.equal(await page.isChecked("#show-py"), false, "Space switches Show Python off");
    await page.keyboard.press("Space");
    assert.equal(await page.isChecked("#show-py"), true);
    // the start card: the story opens with Enter, then Start
    await tabTo(byId("story-link"));
    await page.keyboard.press("Enter");
    assert.equal(await page.getAttribute("#story-link", "aria-expanded"), "true");
    await tabTo(byId("start"));
    await page.keyboard.press("Enter");
    await page.waitForSelector("#screen-lesson:not([hidden])");
    for (let guard = 0; guard < 30; guard++) {
      if (await page.isVisible("#screen-end")) break;
      const cid = await page.getAttribute("#screen-lesson", "data-cid");
      const c = dummy.rounds.flatMap((r) => r.challenges).find((x) => x.id === cid);
      // a warm-up: pick an answer, then Start the round
      if (await page.isVisible("#remember .choice")) {
        await tabTo((f) => f.tag === "button" && /^\d|error/.test(f.text));
        await page.keyboard.press("Enter");
        assert.equal((await focused()).id, "start-round", "after the pick, focus waits on Start the round");
        await page.keyboard.press("Enter");
        assert.equal((await focused()).id, "prompt", "and then on the task");
        continue;
      }
      if (await page.isVisible("#predict .choice")) {
        await tabTo((f) => f.tag === "button" && f.text === "5"); await page.keyboard.press("Space");
        assert.equal((await focused()).text, "5", "the pick keeps its focus after the redraw");
      }
      // into the editor, write the line, run it with Ctrl+Enter
      await tabTo(byId("code"));
      if (c.kind !== "play") {
        await page.keyboard.press("ControlOrMeta+A");
        await page.keyboard.type(c.kind === "see" ? c.starter : c.solution);
      }
      await page.keyboard.press("Control+Enter");
      await page.waitForFunction(() => !document.getElementById("run").disabled);
      if (c.kind !== "play") assert.equal(await page.textContent("#feedback"), "Good.", cid + " ran from the keyboard");
      // on to Next with Tab, press it with Enter; focus lands on the next task
      await tabTo(byId("next"));
      await page.keyboard.press("Enter");
      await page.waitForTimeout(30);
      if (!(await page.isVisible("#screen-end"))) {
        const want = (await page.isVisible("#remember .choice")) ? "remember" : "prompt";
        assert.equal((await focused()).id, want, "after Next, focus is on the new task (or the warm-up that stands before it)");
      }
    }
    assert.ok(await page.isVisible("#screen-end"), "the end page is reached by keyboard alone");
    // the end page: the lines-and-notes fold opens with Enter, and the main button is reachable
    await tabTo((f) => f.tag === "summary" && /Your lines and notes/.test(f.text));
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.getElementById("end-more").open), true);
    const html = fs.readFileSync(path.join(root, "web/lesson.html"), "utf8");
    assert.ok(/<label for="code" id="code-label" class="field-label">Your line of Julia<\/label>/.test(html), "the editor has a label");
  } finally { await browser.close(); srv.close(); }
});

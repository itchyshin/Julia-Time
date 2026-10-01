"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

test("the participant Start Here page explains the local game before asking for setup or code", () => {
  const guidePath = path.join(root, "web", "course", "getting-started.html");
  assert.equal(fs.existsSync(guidePath), true, "the Case Board needs a participant-facing Start Here page");
  const guide = read("web/course/getting-started.html");
  const readme = read("README.md");
  const install = read("docs/install.md");

  assert.match(guide, /<title>Julia Time.*How to play/i);
  assert.match(guide, /<h1[^>]*>[^<]*How to play/i);
  assert.match(guide, /id="local-case-board" class="primary-action" href="index\.html">Open the Board/);
  assert.match(guide, /Julia is the programming language/i);
  assert.match(guide, /Julia Time is a game that runs on your own computer/i);
  assert.match(guide, /You do not need.*R.*Python/i);
  assert.match(guide, /Julia 1\.10\.x/i);
  assert.match(guide, /Open a terminal in the Julia Time folder/i);
  assert.match(guide, /Open in Terminal/i);
  assert.match(guide, /launch-macos\.command/i);
  assert.match(guide, /launch-windows\.cmd/i);
  assert.match(guide, /do not need Julia on PATH/i);
  assert.match(guide, /Only call the game ready when the Board says Julia is ready/i);
  assert.match(guide, /Internet is needed to download Julia and for the first course setup/i);
  assert.match(guide, /check_setup\.jl/);
  assert.match(guide, /OK: Julia Time is ready/);
  assert.match(guide, /run\.jl/);
  assert.match(guide, /Windows Command Prompt: start the local lab/i);
  assert.match(guide, /set JULIA_NUM_THREADS=4[\s\S]*set OPENBLAS_NUM_THREADS=1[\s\S]*run\.jl/i);
  assert.match(guide, /Windows PowerShell: start the local lab/i);
  assert.match(guide, /\$env:JULIA_NUM_THREADS = "4"[\s\S]*\$env:OPENBLAS_NUM_THREADS = "1"[\s\S]*run\.jl/i);
  assert.match(guide, /127\.0\.0\.1:8000\/course\/index\.html/);
  assert.match(guide, /id="how-to-play"/);
  assert.match(guide, /Hint 1: the idea/);
  assert.doesNotMatch(guide, /Help me start/i);  // round 3: that fold no longer exists
  assert.match(guide, /final 10 terminal lines/i);
  assert.match(guide, /Pick the block whose title exactly matches your terminal/i);
  assert.doesNotMatch(guide, /<details[^>]*\bopen\b/i, "a platform-specific command must never be the default visible command");
  assert.doesNotMatch(guide, /What is playable now|all six chapters are on the Board/i, "the status note is gone");
  assert.match(guide, /static page.*mystery.*own laptop/i);
  assert.match(readme, /\[Start here\]\(web\/course\/getting-started\.html\)/i);
  assert.match(install, /\[Start here\]\(\.\.\/web\/course\/getting-started\.html\)/i);
  // The guide stays a safe static page, not a second game client: its one script only fixes one link.
  const scripts = guide.match(/<script\b[^>]*>/gi) || [];
  assert.deepEqual(scripts, ['<script defer src="getting-started.js">'], "the guide may load only its link script");
  const linkScript = read("web/course/getting-started.js");
  assert.doesNotMatch(linkScript, /WebSocket|localStorage|sessionStorage|fetch\(|XMLHttpRequest|innerHTML/, "the link script must not talk to the game or store anything");
});

test("Open the local Case Board stays on the port the game is running on and keeps the attempt", () => {
  const {boardHref} = require("../web/course/getting-started.js");
  const at = (href) => { const url = new URL(href); return {protocol:url.protocol, hostname:url.hostname, search:url.search}; };
  // Served by the game on a fallback port: same address, so the link cannot open another program on 8000.
  assert.equal(boardHref(at("http://127.0.0.1:8003/course/getting-started.html")), "index.html");
  assert.equal(boardHref(at("http://localhost:8000/course/getting-started.html?attempt=f3-check")), "index.html?attempt=f3-check");
  assert.equal(boardHref(at("http://127.0.0.1:8001/course/getting-started.html?attempt=Bad Id")), "index.html");
  // Opened from the folder, or shared as a static page elsewhere: keep the usual local address in the HTML.
  assert.equal(boardHref(at("file:///Users/me/julia-time/web/course/getting-started.html")), null);
  assert.equal(boardHref(at("https://example.org/course/getting-started.html")), null);
});

test("the Case Board offers instructions without moving its primary game action", () => {
  const board = read("web/course/index.html");
  assert.match(board, /href="getting-started\.html"[^>]*>How to play/i);
  assert.match(board, /id="continue-action"[^>]*href="\.\.\/lesson\.html\?lesson=lesson1"/);
});

test("How to play describes only features that exist, in player words, with a way home (round 2, P16)", () => {
  const guide = read("web/course/getting-started.html");
  const lessonSource = read("web/lesson.html") + read("web/lesson.js");
  // Every button name the page quotes (in <em>) is a real label in the lesson screen.
  const quoted = [...guide.matchAll(/<em>([^<]+)<\/em>/g)].map(m => m[1]);
  for (const name of ["Hint 1: the idea", "Hint 2: the shape of the line", "Show me the line", "Hint: the idea", "Show a starter line"]) {
    assert.ok(quoted.includes(name), "the page should name " + name);
  }
  for (const name of quoted.filter(q => !/^Reconnect$/.test(q))) assert.ok(lessonSource.includes(name), "the lesson screen has no control named '" + name + "'");
  assert.doesNotMatch(guide, /Show the full answer|Stuck\? Hints|five steps|Help me start/i);
  assert.doesNotMatch(guide, /<em>Show a hint<\/em>/, "a chapter has no button named Show a hint");
  assert.match(guide, /five moves/i);
  assert.match(guide, /Some tasks start with a line for you to change\. Others start empty\./);
  assert.match(guide, /<header[^>]*>\s*<a id="header-board"[^>]*href="index\.html"/, "a Board link in the header");
  assert.equal((guide.match(/class="primary-action"/g) || []).length, 1, "one primary button, at the top");
  assert.doesNotMatch(guide, /href="https?:\/\/(?:127\.0\.0\.1|localhost)/);
  assert.doesNotMatch(guide, /before the meeting/i);
  // The setup, download and GitHub text sits inside the closed setup fold.
  const fold = guide.slice(guide.indexOf('id="setup-wrap"'), guide.indexOf('class="guide-section guide-help"'));
  assert.match(fold, /github\.com/);
  assert.match(fold, /julia-1\.10\.12/);
  assert.doesNotMatch(guide.slice(0, guide.indexOf('id="setup-wrap"')), /github\.com|README|download/i);
});

test("the repository landing page is a public first door before the learner has Julia Time", () => {
  const readme = read("README.md");
  const firstInstallSection = readme.slice(0, readme.indexOf("## What happens when you play"));

  assert.match(firstInstallSection, /You are in the right place before you download anything/i);
  assert.match(firstInstallSection, /\[\*\*Download Julia Time\*\*\]\(https:\/\/github\.com\/itchyshin\/Julia-Time\/releases\/latest\)/i);
  assert.match(firstInstallSection, /web\/assets\/lab-cast\.png/i, "the public doorway should retain the course's visual welcome");
  assert.match(firstInstallSection, /## Start here/i);
  assert.match(firstInstallSection, /Julia Time archive/i);
  assert.match(firstInstallSection, /Julia 1\.10\.x/i);
  assert.match(firstInstallSection, /internet connection.*first setup/i);
  assert.match(firstInstallSection, /Do \*\*not\*\* install R, Python, NumPy/i);
  assert.match(firstInstallSection, /docs\/install\.md/i);
  assert.match(firstInstallSection, /setup-windows\.cmd/i);
  assert.match(firstInstallSection, /launch-macos\.command/i);
  assert.doesNotMatch(firstInstallSection, /127\.0\.0\.1/i, "a public reader should not be sent to a local address before downloading and launching the game");
});

test("the no-rescue playtest material has a printable observer sheet", () => {
  const readme = read("README.md");
  const pdfPath = path.join(root, "docs", "playtest-observer-sheet.pdf");

  assert.match(readme, /\[one-page observer sheet \(PDF\)\]\(docs\/playtest-observer-sheet\.pdf\)/i);
  assert.equal(fs.existsSync(pdfPath), true, "observers need a printable sheet without reconstructing one from the Markdown guide");
  assert.ok(fs.statSync(pdfPath).size > 0, "the printable observer sheet must not be empty");
});

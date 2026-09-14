"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const observerSheetPath = path.join(root, "output", "pdf", "playtest-observer-sheet.pdf");
const observerSheetSkip = fs.existsSync(observerSheetPath)
  ? false
  : "dev-only material not present in the curated export: output/pdf/playtest-observer-sheet.pdf";

test("the participant Start Here page explains the local game before asking for setup or code", () => {
  const guidePath = path.join(root, "web", "course", "getting-started.html");
  assert.equal(fs.existsSync(guidePath), true, "the Case Board needs a participant-facing Start Here page");
  const guide = read("web/course/getting-started.html");
  const readme = read("README.md");
  const install = read("docs/install.md");

  assert.match(guide, /<title>Julia Time.*Start Here/i);
  assert.match(guide, /<h1[^>]*>[^<]*Start here/i);
  assert.match(guide, /class="primary-action" href="#setup-heading">Set up Julia Time/i);
  assert.match(guide, /Julia is the programming language/i);
  assert.match(guide, /Julia Time is a local/i);
  assert.match(guide, /You do not need.*R.*Python/i);
  assert.match(guide, /Julia 1\.10\.x/i);
  assert.match(guide, /Open a terminal in the Julia Time folder/i);
  assert.match(guide, /Open in Terminal/i);
  assert.match(guide, /launch-macos\.command/i);
  assert.match(guide, /launch-windows\.cmd/i);
  assert.match(guide, /do not need Julia on PATH/i);
  assert.match(guide, /Only call the game ready when the Case Board says Julia is ready/i);
  assert.match(guide, /Internet is needed to download Julia and for the first course setup/i);
  assert.match(guide, /check_setup\.jl/);
  assert.match(guide, /OK — Julia Time is ready/);
  assert.match(guide, /run\.jl/);
  assert.match(guide, /Windows Command Prompt: start the local lab/i);
  assert.match(guide, /set JULIA_NUM_THREADS=4[\s\S]*set OPENBLAS_NUM_THREADS=1[\s\S]*run\.jl/i);
  assert.match(guide, /Windows PowerShell: start the local lab/i);
  assert.match(guide, /\$env:JULIA_NUM_THREADS = "4"[\s\S]*\$env:OPENBLAS_NUM_THREADS = "1"[\s\S]*run\.jl/i);
  assert.match(guide, /127\.0\.0\.1:8000\/course\/index\.html/);
  assert.match(guide, /id="how-to-play"/);
  assert.match(guide, /Help me start/i);
  assert.match(guide, /final 10 terminal lines/i);
  assert.match(guide, /Choose the block whose title exactly matches your terminal/i);
  assert.doesNotMatch(guide, /<details[^>]*\bopen\b/i, "a platform-specific command must never be the default visible command");
  assert.match(guide, /all six case chapters are on the Case Board/i);
  assert.match(guide, /href="http:\/\/127\.0\.0\.1:8000\/course\/index\.html"[^>]*>Open the local Case Board/i);
  assert.match(guide, /static page.*mystery.*own laptop/i);
  assert.match(readme, /\[Start here\]\(web\/course\/getting-started\.html\)/i);
  assert.match(install, /\[Start here\]\(\.\.\/web\/course\/getting-started\.html\)/i);
  assert.doesNotMatch(guide, /<script\b/i, "the guide must remain a safe static page, not a second game client");
});

test("the Case Board offers instructions without moving its primary game action", () => {
  const board = read("web/course/index.html");
  assert.match(board, /href="getting-started\.html"[^>]*>How to play/i);
  assert.match(board, /id="continue-action"[^>]*href="chapter\.html"/);
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

test("the no-rescue playtest material has a printable observer sheet", {skip:observerSheetSkip}, () => {
  const readme = read("README.md");
  const pdfPath = path.join(root, "output", "pdf", "playtest-observer-sheet.pdf");

  assert.match(readme, /\[one-page observer sheet \(PDF\)\]\(output\/pdf\/playtest-observer-sheet\.pdf\)/i);
  assert.equal(fs.existsSync(pdfPath), true, "observers need a printable sheet without reconstructing one from the Markdown guide");
  assert.ok(fs.statSync(pdfPath).size > 0, "the printable observer sheet must not be empty");
});

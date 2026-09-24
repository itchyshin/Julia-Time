"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const humanKitPath = path.join(root, "docs", "dev-log", "playtest", "missing-fleas-six-chapter-human-kit.md");
const humanKitSkip = fs.existsSync(humanKitPath)
  ? false
  : "dev-only material not present in the curated export: docs/dev-log/playtest/missing-fleas-six-chapter-human-kit.md";

test("learner-facing launcher configuration directs the story to the Case Board with capped threads", () => {
  const server = read("src/server.jl");
  const runner = read("run.jl");
  const macLauncher = read("tools/setup/launch-macos.command");
  const windowsLauncher = read("tools/setup/launch-windows.cmd");
  const install = read("docs/install.md");
  const readme = read("README.md");

  assert.match(server, /if\s*open_browser[\s\S]*?_browser_url\(host,\s*port\)/s);
  assert.match(server, /course\/index\.html/);
  assert.match(runner, /JuliaTime\.run_server\(; host="127\.0\.0\.1", port=8000\)/);
  assert.match(macLauncher, /JULIA_NUM_THREADS=4/);
  assert.match(macLauncher, /OPENBLAS_NUM_THREADS=1/);
  assert.match(windowsLauncher, /set "JULIA_NUM_THREADS=4"/);
  assert.match(windowsLauncher, /set "OPENBLAS_NUM_THREADS=1"/);
  assert.match(install, /http:\/\/127\.0\.0\.1:8000\/course\/index\.html/);
  assert.match(install, /JULIA_NUM_THREADS/);
  assert.match(install, /R and Python are not needed to play the mystery/i);
  assert.match(install, /optional\s+bootstrap comparison[\s\S]*R,\s+Python, and NumPy/i);
  assert.doesNotMatch(install, /comparisons are\s+reading-only/i);
  assert.match(readme, /http:\/\/127\.0\.0\.1:8000\/course\/index\.html/);
});

test("Windows has a double-clickable one-time setup helper with the same bounded local contract", () => {
  const setupPath = path.join(root, "tools", "setup", "setup-windows.cmd");
  assert.equal(fs.existsSync(setupPath), true, "Windows learners need a visible one-time setup helper");

  const setup = read("tools/setup/setup-windows.cmd");
  assert.match(setup, /setlocal/i);
  assert.match(setup, /set "JULIA_NUM_THREADS=4"/);
  assert.match(setup, /set "OPENBLAS_NUM_THREADS=1"/);
  assert.match(setup, /check_setup\.jl/);
  assert.match(setup, /JULIA_MISSING/);
  assert.match(setup, /JULIA_UNSUPPORTED/);
  assert.doesNotMatch(setup, /winget|powershell.*executionpolicy|reg\.exe|juliaup/i);

  assert.match(read("docs/install.md"), /setup-windows\.cmd/);
  assert.match(read("web/course/getting-started.html"), /setup-windows\.cmd/);
});

test("Windows launch helpers find a normal Julia 1.10 installation when PATH is absent", () => {
  const resolverPath = path.join(root, "tools", "setup", "windows-julia.cmd");
  assert.equal(fs.existsSync(resolverPath), true,
    "a learner should not have to edit PATH when the normal Julia installer already worked");

  const resolver = read("tools/setup/windows-julia.cmd");
  for (const script of [
    read("tools/setup/setup-windows.cmd"),
    read("tools/setup/launch-windows.cmd"),
  ]) {
    assert.match(script, /call\s+"%~dp0windows-julia\.cmd"/i);
    assert.match(script, /"%JULIA_EXE%"\s+--version/i);
  }
  assert.match(resolver, /where julia\.exe/i);
  assert.match(resolver, /%LOCALAPPDATA%\\Programs\\Julia-1\.10\*/i);
  assert.doesNotMatch(resolver, /setx|reg\.exe|winget|powershell/i);
});

test("the human-launch card asks Windows observers to verify the learner setup route", {skip:humanKitSkip}, () => {
  const kit = read("docs/dev-log/playtest/missing-fleas-six-chapter-human-kit.md");

  assert.match(kit, /where julia/i);
  assert.match(kit, /setup-windows\.cmd/);
  assert.match(kit, /launch-windows\.cmd/);
  assert.match(kit, /actual Windows computer/i);
});

test("every Julia download link lands on the live 1.10 LTS section, not the newest release", () => {
  // julialang.org renamed its section anchors (2026-09 check: id="long_term_support_release");
  // a dead anchor drops the learner at the top of the page, where the newest (unsupported) Julia is offered first.
  const learnerFiles = [
    "README.md",
    "docs/install.md",
    "web/course/getting-started.html",
    "tools/setup/launch-macos.command",
    "tools/setup/launch-windows.cmd",
    "tools/setup/setup-windows.cmd",
    "tools/setup/launch-linux.sh",
  ];
  for (const file of learnerFiles) {
    const text = read(file);
    assert.doesNotMatch(text, /#long-term-support-release/, `${file} still uses the dead download-page anchor`);
    const links = text.match(/https:\/\/julialang\.org\/downloads\/manual-downloads\/[^\s"')<]*/g) || [];
    assert.ok(links.length > 0, `${file} should name the official Julia download page`);
    for (const link of links) {
      assert.equal(link, "https://julialang.org/downloads/manual-downloads/#long_term_support_release",
        `${file} links ${link}; it must land on the 1.10 LTS section`);
    }
  }
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("learner-facing launcher configuration directs the story to the Case Board with capped threads", () => {
  const server = read("src/server.jl");
  const runner = read("run.jl");
  const macLauncher = read("tools/setup/launch-macos.command");
  const windowsLauncher = read("tools/setup/launch-windows.cmd");
  const install = read("docs/install.md");
  const readme = read("README.md");

  assert.match(server, /if\s*open_browser\s*url\s*=\s*_browser_url\(host,\s*port\)/s);
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

test("the human-launch card asks Windows observers to verify the learner setup route", () => {
  const kit = read("docs/dev-log/playtest/missing-fleas-six-chapter-human-kit.md");

  assert.match(kit, /where julia/i);
  assert.match(kit, /setup-windows\.cmd/);
  assert.match(kit, /launch-windows\.cmd/);
  assert.match(kit, /actual Windows computer/i);
});

"use strict";
// 2026-09-25: the learner-facing helpers (the Play launchers and setup-windows.cmd) run check_setup.jl for the
// learner and then say what happens next themselves. check_setup.jl's own closing line, "Next: open the Case
// Board with the matching command in docs/install.md.", is right for a person who typed the setup command by
// hand, but it sent a first-time learner to the install guide at the moment the game was about to open by
// itself (flagged while checking the v0.2.2 email to a Windows tester). The helpers now tell check_setup.jl so
// through JULIATIME_SETUP_FROM_HELPER=1, scoped to that one call.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const FLAG = "JULIATIME_SETUP_FROM_HELPER";

// A stand-in for Julia 1.10 that reports which setting each step received and touches nothing else:
// the launcher's readiness check fails (a fresh folder), so it runs check_setup.jl, then run.jl.
function fakeJulia(dir, logFile) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "julia");
  fs.writeFileSync(
    file,
    [
      "#!/bin/sh",
      'case "$*" in',
      '  --version) echo "julia version 1.10.12"; exit 0 ;;',
      '  *"using JuliaTime"*) exit 1 ;;',
      `  *check_setup.jl*) echo "check_setup ${FLAG}=\${${FLAG}:-unset}" >> "${logFile}"; exit 0 ;;`,
      `  *run.jl*) echo "run ${FLAG}=\${${FLAG}:-unset}" >> "${logFile}"; exit 0 ;;`,
      "esac",
      "exit 3",
      "",
    ].join("\n"),
  );
  fs.chmodSync(file, 0o755);
  return file;
}

for (const [shell, launcher] of [
  ["/bin/zsh", "tools/setup/launch-macos.command"],
  ["/bin/bash", "tools/setup/launch-linux.sh"],
]) {
  const skip = process.platform === "win32" || !fs.existsSync(shell) ? `${shell} not available here` : false;
  test(`${path.basename(launcher)} tells check_setup.jl that it owns the next step, and only for that call`, { skip }, () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "jt-next-"));
    const log = path.join(home, "calls.log");
    const bin = path.join(home, "bin");
    fakeJulia(bin, log);
    const env = { HOME: home, PATH: `${bin}:/usr/bin:/bin` };
    const result = spawnSync(shell, [path.join(root, launcher)], { env, encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, `${launcher} failed: ${result.stdout}\n${result.stderr}`);
    const calls = fs.readFileSync(log, "utf8").trim().split("\n");
    assert.deepEqual(calls, [`check_setup ${FLAG}=1`, `run ${FLAG}=unset`], "the setting reaches the setup and not the game server");
    assert.match(result.stdout, /Starting Julia Time/, "like Windows, the launcher says the game is starting once the setup is done");
  });
}

test("the Windows helpers tell check_setup.jl that they own the next step", () => {
  for (const file of ["tools/setup/launch-windows.cmd", "tools/setup/setup-windows.cmd"]) {
    const lines = read(file).split(/\r?\n/);
    const setup = lines.findIndex((line) => /check_setup\.jl\s*$/.test(line) && /^"%JULIA_EXE%"/.test(line));
    assert.ok(setup > 0, `${file} runs check_setup.jl`);
    const setFlag = lines.findIndex((line) => line.trim() === `set "${FLAG}=1"`);
    assert.ok(setFlag >= 0 && setFlag < setup, `${file} sets ${FLAG}=1 before it runs check_setup.jl`);
    assert.ok(lines.findIndex((line) => /^setlocal\b/i.test(line)) < setFlag, `${file} keeps the setting inside setlocal`);
  }
  const launcher = read("tools/setup/launch-windows.cmd").split(/\r?\n/);
  const cleared = launcher.findIndex((line) => line.trim() === `set "${FLAG}="`);
  const play = launcher.findIndex((line) => /^:play\b/.test(line));
  const setup = launcher.findIndex((line) => /check_setup\.jl\s*$/.test(line) && /^"%JULIA_EXE%"/.test(line));
  assert.ok(cleared > setup && cleared < play, "launch-windows.cmd clears the setting again before it starts the game");
});

test("check_setup.jl keeps its docs/install.md line for a person who runs it by hand", () => {
  const checkSetup = read("check_setup.jl");
  assert.match(checkSetup, /setup_next_action\(ENV\)/, "the closing line comes from setup_next_action");
  assert.doesNotMatch(checkSetup, /^println\(SETUP_NEXT_ACTION\)\s*$/m, "no unconditional closing line");
  assert.match(read("tools/setup/common.jl"), new RegExp(FLAG), "the rule lives with the other setup helpers");
  assert.match(read("docs/install.md"), /Next: open the Case Board with the matching command in docs\/install\.md\./, "the manual route still shows it");
});

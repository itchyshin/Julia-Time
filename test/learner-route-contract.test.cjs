"use strict";
// Learner install route on Windows and Mac: the defects found by the 2026-09-24 audit and the fresh-runner CI
// (a newer Julia first on PATH hid the installed 1.10; the Windows launcher window closed before any error could
// be read; the Mac route needed Terminal typing; garbled em dashes in cmd.exe; no word about security prompts).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const WINDOWS_SCRIPTS = [
  "tools/setup/setup-windows.cmd",
  "tools/setup/launch-windows.cmd",
  "tools/setup/windows-julia.cmd",
  "Play-Julia-Time-Windows.cmd",
];

test("Windows helper scripts are plain ASCII, so cmd.exe never shows garbled punctuation", () => {
  for (const file of WINDOWS_SCRIPTS) {
    const text = read(file);
    assert.match(text, /^[\x00-\x7F]*$/, `${file} contains non-ASCII characters (cmd.exe prints them as mojibake)`);
  }
});

test("the Windows Julia finder checks each candidate's version, so a newer Julia on PATH cannot hide 1.10", () => {
  const finder = read("tools/setup/windows-julia.cmd");
  assert.match(finder, /where julia\.exe/i, "PATH candidates are still considered");
  assert.match(finder, /%LOCALAPPDATA%\\Programs\\Julia-1\.10\*/i, "the official per-user installer folder");
  assert.match(finder, /%ProgramFiles%\\Julia-1\.10\*/i, "an all-users install folder");
  assert.match(finder, /%USERPROFILE%\\\.julia\\juliaup\\julia-1\.10\*/i, "a juliaup-managed 1.10 already on disk");
  assert.match(finder, /VERSION\.major == 1 && VERSION\.minor == 10/, "each candidate proves it is 1.10 by running it");
  assert.match(finder, /JULIA_OTHER/, "remembers a wrong-version Julia so the message can name it");
  assert.doesNotMatch(finder, /setx|reg\.exe|winget|powershell|juliaup (add|default|update)/i, "the finder never installs or changes settings");
  for (const file of ["tools/setup/setup-windows.cmd", "tools/setup/launch-windows.cmd"]) {
    const script = read(file);
    assert.doesNotMatch(script, /for \/f "tokens=3"/i, `${file} must not parse the version with for /f (breaks on & ( ) in paths)`);
    assert.match(script, /JULIA_OTHER/, `${file} explains which other Julia it found`);
  }
});

test("the Windows launcher keeps its window open when it stops with a problem", () => {
  const launcher = read("tools/setup/launch-windows.cmd");
  assert.match(launcher, /^:finish\b/m, "one shared exit");
  const finish = launcher.slice(launcher.search(/^:finish\b/m));
  assert.match(finish, /if not "%EXIT_CODE%"=="0"/, "pauses only after a failure");
  assert.match(finish, /pause/i);
  const exits = launcher.match(/exit \/b/gi) || [];
  assert.equal(exits.length, 1, "every path leaves through :finish, so no error can flash past");
});

test("the Windows launcher runs the one-time setup itself the first time", () => {
  const launcher = read("tools/setup/launch-windows.cmd");
  assert.match(launcher, /-e "using JuliaTime"/, "the same readiness signal run.jl uses");
  assert.match(launcher, /check_setup\.jl/);
  assert.match(launcher, /run\.jl/);
});

test("top-level Play launchers are the one thing a learner double-clicks", () => {
  assert.ok(exists("Play-Julia-Time-Windows.cmd"), "Windows learners see it as soon as they open the folder");
  assert.ok(exists("Play-Julia-Time-Mac.command"), "Mac learners see it as soon as they open the folder");
  assert.match(read("Play-Julia-Time-Windows.cmd"), /call "%~dp0tools\\setup\\launch-windows\.cmd"/i);
  assert.match(read("Play-Julia-Time-Mac.command"), /tools\/setup\/launch-macos\.command/);
  if (process.platform !== "win32") {
    for (const file of ["Play-Julia-Time-Mac.command", "tools/setup/launch-macos.command"]) {
      assert.ok(fs.statSync(path.join(root, file)).mode & 0o111, `${file} must be executable for a double-click`);
    }
  }
});

test("the Mac launcher runs the one-time setup itself and uses the shared version-checked finder", () => {
  const launcher = read("tools/setup/launch-macos.command");
  assert.match(launcher, /find-julia\.sh/);
  assert.match(launcher, /-e 'using JuliaTime'/);
  assert.match(launcher, /check_setup\.jl/);
  assert.match(launcher, /JULIATIME_OTHER_JULIA/);
  assert.match(read("tools/setup/launch-linux.sh"), /find-julia\.sh/, "Linux shares the same finder");
});

function fakeJulia(dir, version) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "julia");
  fs.writeFileSync(file, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "julia version ${version}"; exit 0; fi\nexit 3\n`);
  fs.chmodSync(file, 0o755);
  return file;
}
function findWith(shell, env) {
  const script = `. "${path.join(root, "tools", "setup", "find-julia.sh")}"; juliatime_find_julia; printf '%s|%s' "$JULIATIME_JULIA" "$JULIATIME_OTHER_JULIA"`;
  const result = spawnSync(shell, ["-c", script], { env: { ...env }, encoding: "utf8" });
  assert.equal(result.status, 0, `${shell} failed: ${result.stderr}`);
  const [julia, other] = result.stdout.split("|");
  return { julia, other };
}

for (const shell of ["/bin/zsh", "/bin/bash"]) {
  const skip = process.platform === "win32" || !fs.existsSync(shell) ? `${shell} not available here` : false;
  test(`find-julia.sh (${path.basename(shell)}) prefers an installed 1.10 over a newer Julia first on PATH`, { skip }, () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "jt-find-"));
    const newer = path.join(home, "newer-bin");
    fakeJulia(newer, "1.13.0");
    const managed = fakeJulia(path.join(home, ".julia", "juliaup", "julia-1.10.12+0.test", "bin"), "1.10.12");
    const both = findWith(shell, { HOME: home, PATH: `${newer}:/usr/bin:/bin` });
    assert.equal(both.julia, managed, "the 1.10 install is chosen");
    assert.match(both.other, /1\.13\.0/, "the newer Julia is remembered for the message");

    const onlyNewer = fs.mkdtempSync(path.join(os.tmpdir(), "jt-find-"));
    fakeJulia(path.join(onlyNewer, "bin"), "1.13.0");
    const none = findWith(shell, { HOME: onlyNewer, PATH: `${path.join(onlyNewer, "bin")}:/usr/bin:/bin` });
    assert.equal(none.julia, "", "no 1.10 anywhere means no Julia is chosen");
    assert.match(none.other, /1\.13\.0/);

    const good = fs.mkdtempSync(path.join(os.tmpdir(), "jt-find-"));
    const onPath = fakeJulia(path.join(good, "bin"), "1.10.12");
    assert.equal(findWith(shell, { HOME: good, PATH: `${path.join(good, "bin")}:/usr/bin:/bin` }).julia, onPath, "a 1.10 on PATH still wins first");
  });
}

test("the learner docs lead with one double-click and name the security prompts and the right Julia download", () => {
  const readme = read("README.md");
  const firstInstallSection = readme.slice(0, readme.indexOf("## What happens when you play"));
  const guide = read("web/course/getting-started.html");
  const install = read("docs/install.md");
  for (const [name, text] of [["README", firstInstallSection], ["getting-started", guide], ["install.md", install]]) {
    assert.match(text, /Play-Julia-Time-Windows/, `${name}: Windows double-click launcher`);
    assert.match(text, /Play-Julia-Time-Mac\.command/, `${name}: Mac double-click launcher`);
    assert.match(text, /Run anyway/, `${name}: Windows SmartScreen / unknown-publisher prompt`);
    assert.match(text, /Open Anyway/, `${name}: macOS Gatekeeper prompt`);
    assert.match(text, /julia-1\.10\.\d+-win64\.exe/, `${name}: direct Windows installer`);
    assert.match(text, /julia-1\.10\.\d+-macaarch64\.dmg/, `${name}: direct Apple Silicon installer`);
    assert.match(text, /julia-1\.10\.\d+-mac64\.dmg/, `${name}: direct Intel Mac installer`);
  }
  assert.match(firstInstallSection, /Extract All/, "Windows extraction step is named");
  assert.match(firstInstallSection, /About This Mac/, "how to tell Apple Silicon from Intel");
});

test("a busy port 8000 names other programs as a possible cause, not only an earlier Julia Time window", () => {
  const runner = read("run.jl");
  assert.match(runner, /close a previous Julia Time launcher/);
  assert.match(runner, /another program/i);
});

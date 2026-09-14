"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Linux has a double-clickable launcher with the same bounded local contract as Mac", () => {
  const launcherPath = path.join(root, "tools", "setup", "launch-linux.sh");
  assert.equal(fs.existsSync(launcherPath), true, "Linux learners need a launcher script");

  // Windows checkouts carry no POSIX executable bit (T2) — the mode check only means anything
  // on a POSIX filesystem, so it is skipped there and kept on Mac/Linux.
  if (process.platform === "win32") {
    console.log("skipping executable-bit check on win32: no POSIX file mode");
  } else {
    const stat = fs.statSync(launcherPath);
    // eslint-disable-next-line no-bitwise
    assert.ok(stat.mode & 0o111, "the Linux launcher must be executable");
  }

  const launcher = read("tools/setup/launch-linux.sh");
  assert.match(launcher, /JULIA_NUM_THREADS=4/);
  assert.match(launcher, /OPENBLAS_NUM_THREADS=1/);
  assert.match(launcher, /COURSE_FOLDER_INVALID/);
  assert.match(launcher, /JULIA_MISSING/);
  assert.match(launcher, /JULIA_UNSUPPORTED/);
  assert.match(launcher, /\.juliaup\/bin\/julia/);
  assert.match(launcher, /check_setup\.jl/);
  assert.match(launcher, /run\.jl/);

  execSync(`bash -n "${launcherPath}"`);
});

test("install and readme docs name the Linux launcher next to Mac and Windows", () => {
  const install = read("docs/install.md");
  const readme = read("README.md");

  assert.match(install, /launch-linux\.sh/);
  assert.match(install, /chmod \+x/);
  assert.match(readme, /launch-linux\.sh/);
});

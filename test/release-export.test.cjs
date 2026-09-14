"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const scriptPath = path.join(root, "tools", "release", "export.sh");

function gitAvailable() {
  const result = spawnSync("git", ["--version"]);
  return result.status === 0;
}

function insideGitWorkTree() {
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, encoding: "utf8" });
  return result.status === 0;
}

function exportDryRunSkipReason() {
  if (!gitAvailable()) {
    return "git is not available";
  }
  if (!insideGitWorkTree()) {
    return "dev-only material not present in the curated export: .git (export.sh --dry-run needs a git working tree)";
  }
  return false;
}

test("release export dry run reports the source commit, planned zip, and exclusion list", { skip: exportDryRunSkipReason() }, () => {
  const result = spawnSync("bash", [scriptPath, "--dry-run"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /source_sha/);
  assert.match(result.stdout, /sha256/);
  assert.match(result.stdout, /exclude/);
});

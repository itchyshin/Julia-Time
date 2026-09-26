"use strict";

// Chapter 3's "How each language stores a blank" note makes four claims about Julia, R and pandas.
// AGENTS.md rule 3: never invent output, so each claim is run for real here, like bridge-parity.
// Skips cleanly (with a reason) when julia, Rscript+dplyr or python3+pandas are not on PATH.

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "web", "chapter3.js"), "utf8");
const run = (command, args) => childProcess.spawnSync(command, args, {encoding: "utf8", cwd: root});
const ok = (command, args) => run(command, args).status === 0;
const hasJulia = ok("julia", ["--version"]);
const hasDplyr = ok("Rscript", ["-e", "suppressMessages(library(dplyr))"]);
const hasPandas = ok("python3", ["-c", "import pandas"]);

test("the note still makes the four claims this test checks", () => {
  assert.match(page, /dplyr::filter\(joined, notebook_detected != sheet_detected\) would quietly drop T-C/);
  assert.match(page, /The same row rule stops with an error, so you notice\. sum\(\[1, missing\]\) gives missing\./);
  assert.match(page, /sum\(c\(1, NA\)\) gives NA; na\.rm = TRUE gives 1\./);
  assert.match(page, /pd\.Series\(\[1, None\]\)\.sum\(\) gives 1\.0: it quietly skips the blank\./);
});

test("R: dplyr filter quietly drops the NA row; sum gives NA, or 1 with na.rm", {skip: hasDplyr ? false : "Rscript with dplyr not found"}, () => {
  const r = run("Rscript", ["-e", [
    "suppressMessages(library(dplyr))",
    "joined <- data.frame(tray_id = c('T-A', 'T-B', 'T-C'), notebook_detected = c(2, 2, 1), sheet_detected = c(2, 2, NA))",
    "cat(nrow(dplyr::filter(joined, notebook_detected != sheet_detected)), sum(c(1, NA)), sum(c(1, NA), na.rm = TRUE))"
  ].join("; ")]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "0 NA 1");
});

test("Julia: the row rule stops with an error on missing; sum gives missing", {skip: hasJulia ? false : "julia not found"}, () => {
  const j = run("julia", ["--startup-file=no", "--project=.", "-e", [
    "using DataFrames",
    "joined = DataFrame(tray_id = [\"T-A\", \"T-B\", \"T-C\"], notebook_detected = [2, 2, 1], sheet_detected = [2, 2, missing])",
    "errored = try; joined[joined.notebook_detected .!= joined.sheet_detected, :]; false; catch; true; end",
    "print(errored, \" \", sum([1, missing]))"
  ].join("; ")]);
  assert.equal(j.status, 0, j.stderr);
  assert.equal(j.stdout.trim(), "true missing");
});

test("pandas: sum quietly skips the blank", {skip: hasPandas ? false : "python3 with pandas not found"}, () => {
  const p = run("python3", ["-c", "import pandas as pd; print(pd.Series([1, None]).sum())"]);
  assert.equal(p.status, 0, p.stderr);
  assert.equal(p.stdout.trim(), "1.0");
});

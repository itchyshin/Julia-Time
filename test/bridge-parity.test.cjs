"use strict";

// "The same move in R and Python" (2026-09-25) parity check: for every one of the ten bridge
// entries in web/course/bridges.js, actually run the pinned R line (Rscript + dplyr) and Python
// line (python3 + pandas/numpy) against the live Julia reference data and result, and check they
// agree. This is the required evidence for AGENTS.md rule 3 ("Never invent output. Bridge lines
// (R, Python) must be valid") — a hand check is not enough, this test runs them for real every time.
//
// Gated like test/bootstrap-parity.test.cjs: skip cleanly, with a printed reason, when julia,
// Rscript+dplyr, or python3+pandas/numpy are not on PATH, so CI without them stays green. Locally
// (R 4 + dplyr, python3 + pandas 2.3) this suite runs for real, not skipped.

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const bridges = require(path.join(repositoryRoot, "web", "course", "bridges.js"));

function commandAvailable(command, args) {
  const result = childProcess.spawnSync(command, args || ["--version"], {encoding: "utf8"});
  return result.status === 0;
}

const juliaAvailable = commandAvailable("julia", ["--version"]);
const rscriptAvailable = commandAvailable("Rscript", ["--version"]);
const dplyrAvailable = rscriptAvailable && commandAvailable("Rscript", ["-e", "suppressMessages(library(dplyr))"]);
const pythonAvailable = commandAvailable("python3", ["--version"]);
const pandasAvailable = pythonAvailable && commandAvailable("python3", ["-c", "import pandas, numpy"]);

let skipReason = false;
if (!juliaAvailable) skipReason = "julia is not on PATH in this environment";
else if (!rscriptAvailable) skipReason = "Rscript is not on PATH in this environment (dev-only R toolchain)";
else if (!dplyrAvailable) skipReason = "the dplyr R package is not installed (dev-only R toolchain)";
else if (!pythonAvailable) skipReason = "python3 is not on PATH in this environment";
else if (!pandasAvailable) skipReason = "pandas/numpy are not installed for python3 (dev-only Python toolchain)";

function runJuliaFixtures() {
  const script = path.join(__dirname, "bridge_fixtures.jl");
  const result = childProcess.spawnSync("julia", ["--project=.", script], {cwd: repositoryRoot, encoding: "utf8"});
  assert.equal(result.status, 0, "test/bridge_fixtures.jl failed:\n" + (result.stderr || result.stdout));
  const lines = result.stdout.trim().split(/\r?\n/);
  return JSON.parse(lines[lines.length - 1]);
}

function runR(scriptBody, cwd) {
  const result = childProcess.spawnSync("Rscript", ["-e", scriptBody], {cwd, encoding: "utf8"});
  assert.equal(result.status, 0, "Rscript failed:\n" + scriptBody + "\n---\n" + (result.stderr || result.stdout));
  return result.stdout;
}

function runPython(scriptBody, cwd) {
  const result = childProcess.spawnSync("python3", ["-c", scriptBody], {cwd, encoding: "utf8"});
  assert.equal(result.status, 0, "python3 failed:\n" + scriptBody + "\n---\n" + (result.stderr || result.stdout));
  return result.stdout;
}

function csvCell(value) {
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function writeCsv(filePath, columns, rows) {
  const lines = [columns.join(",")];
  rows.forEach(row => lines.push(columns.map(c => csvCell(row[c])).join(",")));
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

// A minimal CSV parser: enough for R's write.csv and pandas' to_csv output (quoted strings with
// "" escaping only; no embedded newlines in any column this test produces).
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(line => line.length > 0);
  if (lines.length === 0) return {columns: [], rows: []};
  const parseLine = line => {
    const cells = [];
    let i = 0;
    while (i <= line.length) {
      let cell;
      if (line[i] === '"') {
        let j = i + 1, buf = "";
        while (j < line.length) {
          if (line[j] === '"' && line[j + 1] === '"') { buf += '"'; j += 2; continue; }
          if (line[j] === '"') { j += 1; break; }
          buf += line[j]; j += 1;
        }
        cell = buf;
        i = j + 1; // skip the comma (or end of line)
      } else {
        const next = line.indexOf(",", i);
        if (next === -1) { cell = line.slice(i); i = line.length + 1; }
        else { cell = line.slice(i, next); i = next + 1; }
      }
      cells.push(cell);
      if (i > line.length) break;
    }
    return cells;
  };
  const columns = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cells = parseLine(line);
    const row = {};
    columns.forEach((c, index) => { row[c] = cells[index]; });
    return row;
  });
  return {columns, rows};
}

// bridges.js's Python lines are sometimes two statements ("import numpy as np\n<expression>"):
// turn the last line into "result = <expression>" so the caller can assign and print it, without
// altering the pinned line itself.
function pyResultLines(pythonCode) {
  const lines = pythonCode.split("\n");
  const last = lines.pop();
  return lines.concat(`result = ${last}`);
}

function cellsMatch(expected, actualRaw) {
  if (typeof expected === "boolean") {
    const truthy = ["TRUE", "True", "true", "1"].includes(actualRaw);
    const falsy = ["FALSE", "False", "false", "0"].includes(actualRaw);
    if (truthy) return expected === true;
    if (falsy) return expected === false;
    return false;
  }
  if (typeof expected === "number") {
    const actual = Number(actualRaw);
    if (!Number.isFinite(actual)) return false;
    return Math.abs(actual - expected) <= 1e-6;
  }
  return String(expected) === actualRaw;
}

// Unordered multiset comparison over `columns`: every expected row must match exactly one actual
// row (each used once), and vice versa (same row count).
function assertSameRows(actual, expectedColumns, expectedRows, label) {
  assert.deepEqual(actual.columns.slice().sort(), expectedColumns.slice().sort(), label + ": same columns");
  assert.equal(actual.rows.length, expectedRows.length, label + ": same row count");
  const used = new Array(actual.rows.length).fill(false);
  expectedRows.forEach((expectedRow, expectedIndex) => {
    const matchIndex = actual.rows.findIndex((actualRow, index) =>
      !used[index] && expectedColumns.every(column => cellsMatch(expectedRow[column], actualRow[column])));
    assert.ok(matchIndex !== -1, label + `: expected row ${expectedIndex} (${JSON.stringify(expectedRow)}) has no matching actual row`);
    used[matchIndex] = true;
  });
}

test("all ten bridge-card R and Python lines run for real against the live Julia reference and agree with it", {skip: skipReason}, () => {
  const fixtures = runJuliaFixtures();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "julia-time-bridge-parity-"));
  const checked = [];
  try {
    // --- C1/select-records ---------------------------------------------------------------
    {
      const key = "C1/select-records";
      writeCsv(path.join(tmp, "jars.csv"), fixtures.b09.columns, fixtures.b09.rows);
      const rOut = runR(
        `suppressMessages(library(dplyr)); jars <- read.csv("jars.csv", stringsAsFactors=FALSE); jars$detected <- as.logical(jars$detected); case_batch <- "B09"; result <- ${bridges.BRIDGES[key].r}; write.csv(result, stdout(), row.names=FALSE)`,
        tmp
      );
      assertSameRows(parseCsv(rOut), fixtures.b09.columns, fixtures.b09.rows, key + " (R)");
      const pyOut = runPython(
        `import pandas as pd\njars = pd.read_csv("jars.csv")\njars["detected"] = jars["detected"].astype(bool)\ncase_batch = "B09"\nresult = ${bridges.BRIDGES[key].python}\nprint(result.to_csv(index=False))`,
        tmp
      );
      assertSameRows(parseCsv(pyOut), fixtures.b09.columns, fixtures.b09.rows, key + " (Python)");
      checked.push(key);
    }

    // --- C2/group: grouping must not drop, add, or change any B09 row --------------------
    {
      const key = "C2/group";
      writeCsv(path.join(tmp, "jars.csv"), fixtures.b09.columns, fixtures.b09.rows);
      const rOut = runR(
        `suppressMessages(library(dplyr)); jars <- read.csv("jars.csv", stringsAsFactors=FALSE); jars$detected <- as.logical(jars$detected); result <- ${bridges.BRIDGES[key].r}; write.csv(as.data.frame(dplyr::ungroup(result)), stdout(), row.names=FALSE)`,
        tmp
      );
      assertSameRows(parseCsv(rOut), fixtures.b09.columns, fixtures.b09.rows, key + " (R, ungrouped)");
      const pyOut = runPython(
        `import pandas as pd\njars = pd.read_csv("jars.csv")\njars["detected"] = jars["detected"].astype(bool)\nresult = ${bridges.BRIDGES[key].python}\nprint(pd.concat([group for _, group in result], ignore_index=True).to_csv(index=False))`,
        tmp
      );
      assertSameRows(parseCsv(pyOut), fixtures.b09.columns, fixtures.b09.rows, key + " (Python, concatenated groups)");
      checked.push(key);
    }

    // --- C2/counts -------------------------------------------------------------------------
    {
      const key = "C2/counts";
      writeCsv(path.join(tmp, "jars.csv"), fixtures.b09.columns, fixtures.b09.rows);
      const rOut = runR(
        `suppressMessages(library(dplyr)); jars <- read.csv("jars.csv", stringsAsFactors=FALSE); jars$detected <- as.logical(jars$detected); result <- ${bridges.BRIDGES[key].r}; write.csv(result, stdout(), row.names=FALSE)`,
        tmp
      );
      assertSameRows(parseCsv(rOut), fixtures.c2_counts.columns, fixtures.c2_counts.rows, key + " (R)");
      const pyOut = runPython(
        `import pandas as pd\njars = pd.read_csv("jars.csv")\njars["detected"] = jars["detected"].astype(bool)\nresult = ${bridges.BRIDGES[key].python}\nprint(result.to_csv(index=False))`,
        tmp
      );
      assertSameRows(parseCsv(pyOut), fixtures.c2_counts.columns, fixtures.c2_counts.rows, key + " (Python)");
      checked.push(key);
    }

    // --- C2/rates ----------------------------------------------------------------------------
    {
      const key = "C2/rates";
      writeCsv(path.join(tmp, "jars.csv"), fixtures.b09.columns, fixtures.b09.rows);
      const rOut = runR(
        `suppressMessages(library(dplyr)); jars <- read.csv("jars.csv", stringsAsFactors=FALSE); jars$detected <- as.logical(jars$detected); result <- ${bridges.BRIDGES[key].r}; write.csv(result, stdout(), row.names=FALSE)`,
        tmp
      );
      assertSameRows(parseCsv(rOut), fixtures.c2_rates.columns, fixtures.c2_rates.rows, key + " (R)");
      const pyOut = runPython(
        `import pandas as pd\njars = pd.read_csv("jars.csv")\njars["detected"] = jars["detected"].astype(bool)\nresult = ${bridges.BRIDGES[key].python}\nprint(result.to_csv(index=False))`,
        tmp
      );
      assertSameRows(parseCsv(pyOut), fixtures.c2_rates.columns, fixtures.c2_rates.rows, key + " (Python)");
      checked.push(key);
    }

    // --- C3/join-report-log ------------------------------------------------------------------
    {
      const key = "C3/join-report-log";
      writeCsv(path.join(tmp, "tray_counts.csv"), fixtures.c3_tray_counts.columns, fixtures.c3_tray_counts.rows);
      writeCsv(path.join(tmp, "tally_sheet.csv"), fixtures.c3_tally_sheet.columns, fixtures.c3_tally_sheet.rows);
      const rOut = runR(
        `suppressMessages(library(dplyr)); tray_counts <- read.csv("tray_counts.csv", stringsAsFactors=FALSE); tally_sheet <- read.csv("tally_sheet.csv", stringsAsFactors=FALSE); result <- ${bridges.BRIDGES[key].r}; write.csv(result, stdout(), row.names=FALSE)`,
        tmp
      );
      assertSameRows(parseCsv(rOut), fixtures.c3_joined.columns, fixtures.c3_joined.rows, key + " (R)");
      const pyOut = runPython(
        `import pandas as pd\ntray_counts = pd.read_csv("tray_counts.csv")\ntally_sheet = pd.read_csv("tally_sheet.csv")\nresult = ${bridges.BRIDGES[key].python}\nprint(result.to_csv(index=False))`,
        tmp
      );
      assertSameRows(parseCsv(pyOut), fixtures.c3_joined.columns, fixtures.c3_joined.rows, key + " (Python)");
      checked.push(key);
    }

    // --- C3/filter-disagreement --------------------------------------------------------------
    {
      const key = "C3/filter-disagreement";
      writeCsv(path.join(tmp, "joined.csv"), fixtures.c3_joined.columns, fixtures.c3_joined.rows);
      const rOut = runR(
        `suppressMessages(library(dplyr)); joined <- read.csv("joined.csv", stringsAsFactors=FALSE); result <- ${bridges.BRIDGES[key].r}; write.csv(result, stdout(), row.names=FALSE)`,
        tmp
      );
      assertSameRows(parseCsv(rOut), fixtures.c3_disagreement.columns, fixtures.c3_disagreement.rows, key + " (R)");
      const pyOut = runPython(
        `import pandas as pd\njoined = pd.read_csv("joined.csv")\nresult = ${bridges.BRIDGES[key].python}\nprint(result.to_csv(index=False))`,
        tmp
      );
      assertSameRows(parseCsv(pyOut), fixtures.c3_disagreement.columns, fixtures.c3_disagreement.rows, key + " (Python)");
      checked.push(key);
    }

    // --- C4/plan-distinct-recheck: a random move, so validate the property instead of an exact
    // value: exactly three distinct IDs, all drawn from the supplied eligible list.
    {
      const key = "C4/plan-distinct-recheck";
      const eligibleIds = fixtures.c4_eligible.rows.map(row => row.jar_id);
      writeCsv(path.join(tmp, "eligible.csv"), fixtures.c4_eligible.columns, fixtures.c4_eligible.rows);
      const rOut = runR(
        `eligible <- read.csv("eligible.csv", stringsAsFactors=FALSE); set.seed(20260925); ids <- ${bridges.BRIDGES[key].r}; cat(paste(ids, collapse=","))`,
        tmp
      );
      const rIds = rOut.trim().split(",");
      assert.equal(rIds.length, 3, key + " (R): plans exactly three jars");
      assert.equal(new Set(rIds).size, 3, key + " (R): three distinct jars");
      assert.ok(rIds.every(id => eligibleIds.includes(id)), key + " (R): every planned jar is eligible");
      // The bridge line itself now includes `import random` (adversary review item 8: it must run
      // as shown, with nothing invented). Its last line is the expression; the lines before it
      // (the import) run first, ahead of the scaffold's own random.seed call.
      const pythonLines = bridges.BRIDGES[key].python.split("\n");
      const pythonExpr = pythonLines[pythonLines.length - 1];
      const pythonPreamble = pythonLines.slice(0, -1).join("\n");
      const pyOut = runPython(
        `import pandas as pd\neligible = pd.read_csv("eligible.csv")\n${pythonPreamble}\nrandom.seed(20260925)\nids = ${pythonExpr}\nprint(",".join(ids))`,
        tmp
      );
      const pyIds = pyOut.trim().split(",");
      assert.equal(pyIds.length, 3, key + " (Python): plans exactly three jars");
      assert.equal(new Set(pyIds).size, 3, key + " (Python): three distinct jars");
      assert.ok(pyIds.every(id => eligibleIds.includes(id)), key + " (Python): every planned jar is eligible");
      checked.push(key);
    }

    // --- C5/event-mask -------------------------------------------------------------------------
    {
      const key = "C5/event-mask";
      writeCsv(path.join(tmp, "sim_counts.csv"), ["count"], fixtures.c5_sim_counts.map(count => ({count})));
      const rOut = runR(
        `sim_counts <- read.csv("sim_counts.csv")$count; observed_count <- ${fixtures.c5_observed_count}; result <- ${bridges.BRIDGES[key].r}; cat(paste(as.integer(result), collapse=","))`,
        tmp
      );
      const rEvents = rOut.trim().split(",").map(v => v === "1");
      assert.deepEqual(rEvents, fixtures.c5_expected_events, key + " (R)");
      const pyScript = [
        'import pandas as pd',
        'sim_counts = pd.read_csv("sim_counts.csv")["count"].tolist()',
        `observed_count = ${fixtures.c5_observed_count}`,
        ...pyResultLines(bridges.BRIDGES[key].python),
        'print(",".join("1" if v else "0" for v in result))'
      ].join("\n");
      const pyOut = runPython(pyScript, tmp);
      const pyEvents = pyOut.trim().split(",").map(v => v === "1");
      assert.deepEqual(pyEvents, fixtures.c5_expected_events, key + " (Python)");
      checked.push(key);
    }

    // --- C5/event-frequency --------------------------------------------------------------------
    {
      const key = "C5/event-frequency";
      const rOut = runR(
        `sim_counts <- read.csv("sim_counts.csv")$count; observed_count <- ${fixtures.c5_observed_count}\n${bridges.BRIDGES[key].r}`,
        tmp
      );
      const rFrequency = Number(rOut.trim().split(/\s+/).pop());
      assert.ok(Math.abs(rFrequency - fixtures.c5_expected_frequency) <= 1e-9, key + ` (R): ${rFrequency} vs ${fixtures.c5_expected_frequency}`);
      const pyScript = [
        'import pandas as pd',
        'sim_counts = pd.read_csv("sim_counts.csv")["count"].tolist()',
        `observed_count = ${fixtures.c5_observed_count}`,
        ...pyResultLines(bridges.BRIDGES[key].python),
        'print(result)'
      ].join("\n");
      const pyOut = runPython(pyScript, tmp);
      const pyFrequency = Number(pyOut.trim());
      assert.ok(Math.abs(pyFrequency - fixtures.c5_expected_frequency) <= 1e-9, key + ` (Python): ${pyFrequency} vs ${fixtures.c5_expected_frequency}`);
      checked.push(key);
    }

    // --- C6/compatible-models --------------------------------------------------------------
    {
      const key = "C6/compatible-models";
      writeCsv(path.join(tmp, "stories.csv"), fixtures.c6_stories.columns, fixtures.c6_stories.rows);
      const rOut = runR(
        `suppressMessages(library(dplyr)); stories <- read.csv("stories.csv", stringsAsFactors=FALSE); observed_count <- ${fixtures.c6_observed_count}; result <- ${bridges.BRIDGES[key].r}; write.csv(result, stdout(), row.names=FALSE)`,
        tmp
      );
      assertSameRows(parseCsv(rOut), fixtures.c6_compatible.columns, fixtures.c6_compatible.rows, key + " (R)");
      const pyOut = runPython(
        `import pandas as pd\nstories = pd.read_csv("stories.csv")\nobserved_count = ${fixtures.c6_observed_count}\nresult = ${bridges.BRIDGES[key].python}\nprint(result.to_csv(index=False))`,
        tmp
      );
      assertSameRows(parseCsv(pyOut), fixtures.c6_compatible.columns, fixtures.c6_compatible.rows, key + " (Python)");
      checked.push(key);
    }
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }

  assert.deepEqual(checked.sort(), Object.keys(bridges.BRIDGES).sort(), "every bridge-card move was actually checked");
  console.log("BRIDGE_PARITY_OK: " + checked.length + " moves checked against the live Julia reference (R and Python each)");
});

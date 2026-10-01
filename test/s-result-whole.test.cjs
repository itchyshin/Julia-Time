"use strict";
// Round 6, "Result": a task that tells the player to READ the result must show the whole result, with no inner scroll, at 1366x768.
// The short list (12 items or fewer) is re-laid out as one row of cells; Julia's exact print stays one tap away. Nothing is invented:
// the cells are the printed lines, trimmed. The fixture lists every task whose real result is such a list (test/fixtures/read-the-result-tasks.json,
// made from the engine's own run of each solution: tools/lesson-dump-runs.jl). The browser half is tools/lesson-noscroll.cjs (RESULT-WHOLE line).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const lesson = require("../web/lesson.js");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const fixture = JSON.parse(read("test/fixtures/read-the-result-tasks.json"));
const runs = JSON.parse(read("test/fixtures/lesson-solution-runs.json"));
const lessonFiles = fs.readdirSync(path.join(root, "lessons")).filter((f) => /^(lesson\d|exam\d)\.json$/.test(f)).sort();
const allTasks = {};
lessonFiles.forEach((f) => { const d = JSON.parse(read("lessons/" + f)); d.rounds.forEach((r) => r.challenges.forEach((c) => { allTasks[c.id] = { lesson: d.id, c }; })); });
const isShortList = (shown) => { const m = /^(\d+)-element /.exec(String(shown || "").split("\n")[0]); return !!m && Number(m[1]) <= 12; };

test("result fix: the read-the-result list names real tasks whose real result is a list of 12 or fewer", () => {
  assert.ok(fixture.tasks.length >= 40, "found " + fixture.tasks.length);
  fixture.tasks.forEach((t) => {
    assert.ok(allTasks[t.id], t.id + " is a task");
    const run = runs[t.lesson] && runs[t.lesson][t.id];
    assert.ok(run, t.id + " has a recorded run of its solution");
    assert.ok(isShortList(run.shown), t.id + " prints a list of 12 or fewer: " + (run.shown || "").split("\n")[0]);
  });
});
test("result fix: no task with a short-list result is missing from the list (Rose principle: one means ten)", () => {
  const listed = new Set(fixture.tasks.map((t) => t.id));
  const missing = [];
  Object.keys(runs).forEach((lid) => Object.keys(runs[lid]).forEach((id) => { if (allTasks[id] && isShortList(runs[lid][id].shown) && !listed.has(id)) missing.push(id); }));
  assert.deepEqual(missing, [], "add these to test/fixtures/read-the-result-tasks.json (rerun tools/lesson-dump-runs.jl first)");
});
test("result fix: the tasks the report named are in the list, and the deferred tables carry a reason", () => {
  const ids = fixture.tasks.map((t) => t.id);
  ["l1-r3-c1", "l1-r3-c2"].forEach((id) => assert.ok(ids.includes(id), id));
  assert.ok(fixture.deferred.length > 0 && fixture.deferred.every((d) => allTasks[d.id] && d.print));
  assert.ok(typeof fixture.deferred_reason === "string" && fixture.deferred_reason.length > 40);
});

// ---- the strip is a faithful re-layout (pure: through the controller's view) ----------------------------------------
function view(shown, rows, col) {
  const def = { id: "t", title: "t", rounds: [{ id: "r1", title: "R", idea: "i", challenges: [{ id: "t-1", kind: "write", prompt: "p", starter: "", solution: "x", data: rows ? "tiny" : undefined, check: { same_value: true }, feedback: { pass: "ok", wrong: "no" } }] }], data_values: rows ? { tiny: { columns: [col || "jar_id", "n"], rows } } : {} };
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), get length() { return store.size; }, key: (i) => Array.from(store.keys())[i] };
  const ctrl = lesson.createController({ storage, lessonId: "t", send: (m) => { if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: def }); } });
  ctrl.open(); ctrl.start();
  ctrl.state.pending = "rq"; ctrl.state.lastCode = "x";
  ctrl.handle({ type: "lesson_result", request_id: "rq", status: "ok", pass: false, value_repr: "", feedback: "Not yet.", shown });
  return ctrl.view().ch.result.shown;
}
const bits = (n, f) => n + "-element BitVector:\n" + Array.from({ length: n }, (x, i) => " " + f(i)).join("\n");
test("result fix: 12 true/false answers become one row of 12 cells with the exact values and the row names under them", () => {
  const rows = Array.from({ length: 12 }, (x, i) => ["Q-" + String(41 + i).padStart(3, "0"), i]);
  const v = view(bits(12, (i) => (i < 6 ? 1 : 0)), rows);
  assert.deepEqual(v.strip.values, ["1", "1", "1", "1", "1", "1", "0", "0", "0", "0", "0", "0"]);
  assert.equal(v.strip.per, 12, "one row");
  assert.equal(v.strip.names, null, "twelve ids do not fit one row: the names stay beside Julia's print in the fold, not in the strip");
  assert.equal(v.text, bits(12, (i) => (i < 6 ? 1 : 0)), "Julia's text is carried unchanged");
  assert.ok(v.keys && v.keys.values.length === 12, "the row names are kept for the fold");
});
test("result fix: short names fit under the cells; a 13th item, a cut list or a mismatch never becomes a strip", () => {
  const few = Array.from({ length: 5 }, (x, i) => ["S-" + (i + 1), i]);
  const v = view(bits(5, (i) => i % 2), few, "shelf_id");
  assert.deepEqual(v.strip.names, ["S-1", "S-2", "S-3", "S-4", "S-5"]);
  assert.match(v.caption, /Under each: the shelf_id, added by Julia Time\.$/);
  assert.equal(view(bits(13, () => 1)).strip, null, "13 items: not a strip");
  assert.equal(view("12-element Vector{Int64}:\n 1\n 2\n ⋮\n 12").strip, null, "a list with a cut line is not re-laid out");
  assert.equal(view("3-element Vector{Int64}:\n 1\n 2").strip, null, "fewer lines than the count: leave Julia's print alone");
});
test("result fix: 12 text items wrap into two even rows of six; numbers keep their printed text", () => {
  const strs = "12-element Vector{String}:\n" + Array.from({ length: 12 }, (x, i) => ' "Q-' + String(41 + i).padStart(3, "0") + '"').join("\n");
  const v = view(strs);
  assert.equal(v.strip.per, 6);
  assert.equal(v.strip.values[0], '"Q-041"', "the quotes Julia prints are kept");
  const f = view("3-element Vector{Float64}:\n 0.666667\n 0.333333\n 1.0");
  assert.deepEqual(f.strip.values, ["0.666667", "0.333333", "1.0"]);
});

// ---- the page source ------------------------------------------------------------------------------------------------
const js = read("web/lesson.js"), css = read("web/lesson.css");
test("result fix: the Result takes the room Next leaves (measured on the page, not the scrolled view) and snaps to whole rows", () => {
  assert.match(js, /function roomBelow\(box\)/);
  assert.match(js, /bottom \+ \(win\.scrollY \|\| win\.pageYOffset \|\| 0\)/);
  assert.match(js, /if \(cap \+ slack >= full - 1\) \{ box\.style\.maxHeight = "none"; return; \}/);
  assert.match(css, /#result \{[^}]*max-height: calc\(4 \* 24px \+ 30px\)/, "the CSS fallback cap stays");
});
test("result fix: the exact print is in a closed fold that holds nothing until it is opened", () => {
  assert.match(js, /fold\.addEventListener\("toggle"/);
  assert.match(css, /\.strip \{ display: grid;/);
  assert.match(css, /\.strip \.cell \{[^}]*font: 16px/, "cells stay at 16 px");
});
test("result fix: an id or a quoted value in the verdict line never breaks across lines", () => {
  assert.match(js, /fillParts\(\$\("feedback"\), c\.feedback, c\.feedbackParts, true\)/);
  assert.match(css, /\.nw \{ white-space: nowrap; \}/);
  const re = /\b[A-Z]{1,2}-[A-Z0-9]{1,4}\b|"[^"\n]*"/g;
  const hits = (t) => Array.from(t.matchAll(re), (m) => m[0]);
  assert.deepEqual(hits("Rows 7 to 12 came back: Q-056 and T-C, and \"B05\"."), ["Q-056", "T-C", "\"B05\""]);
  assert.deepEqual(hits("Three pairs: 2 of 3, no ids here."), []);
});

// ---- the browser half: the Result never scrolls in a read-the-result task at 1366x768 (opt in: JULIATIME_BROWSER=1) ----
const browser = process.env.JULIATIME_BROWSER === "1" && fs.existsSync(path.join(root, "tools/playtest-eyes/node_modules"));
test("result fix (browser): RESULT-WHOLE-OK and NOSCROLL-OK for every lesson", { skip: !browser && "set JULIATIME_BROWSER=1 (needs tools/playtest-eyes/node_modules)", timeout: 600000 }, () => {
  ["lesson1", "lesson2", "lesson3", "lesson4", "lesson5", "lesson6"].forEach((f, i) => {
    const r = spawnSync("node", [path.join(root, "tools/lesson-noscroll.cjs"), "--lesson", path.join(root, "lessons", f + ".json"), "--port", String(9690 + i)], { encoding: "utf8" });
    assert.match(r.stdout, /^NOSCROLL-OK/m, f + ": " + r.stdout.slice(0, 300));
    assert.match(r.stdout, /^RESULT-WHOLE-OK/m, f + ": " + r.stdout.slice(0, 600));
  });
});

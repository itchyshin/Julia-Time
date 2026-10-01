"use strict";
// Round 4, "Screen next" (R3-10, 19, 20, 27, 28, 29, 30, 33 to 35, 37, 52): the lesson screen as a place, not a form.
// These read the page source (html, css, js), the shared Julia-text filter and the controller's view.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const html = read("web/lesson.html"), css = read("web/lesson.css"), delightCss = read("web/lesson-delight.css");
const D = require("../web/lesson-delight.js"), JT = require("../web/julia-text.js");
const at = (id) => html.indexOf('id="' + id + '"');

test("R3-27: the right column runs editor, buttons, Result, verdict, then Next; Julia's message sits under the verdict", () => {
  const order = ["code", "run", "result-wrap", "feedback", "julia-msg", "clue", "next"].map(at);
  order.forEach((n, i) => assert.ok(n > 0, "missing " + i));
  assert.deepEqual(order, order.slice().sort((a, b) => a - b), "document order");
  assert.ok(at("result") > at("result-label") && at("result") < at("feedback"));
});
test("R3-27 (round 5): a tall result is capped and scrolls inside its box, so it never drops below Next", () => {
  assert.doesNotMatch(css, /data-tall/);
  assert.doesNotMatch(read("web/lesson.js"), /data-tall/);
  assert.match(css, /#result \{[^}]*max-height: calc\(4 \* 24px \+ 30px\); overflow: auto/);  // round 6: four whole lines (was 8em, which cut a line)
  assert.match(html, /<div id="result" tabindex="0" role="region" aria-label="Result \(scrolls if long\)" hidden>/);
});
test("R3-35: the editor has a visible label and a stronger border than the other boxes", () => {
  assert.match(html, /<label for="code" id="code-label" class="field-label">Your line of Julia<\/label>/);
  assert.match(css, /textarea \{[^}]*border: 2px solid #5f7f7c/);
  assert.doesNotMatch(css, /\.field-label[^}]*sr-only/);
});
test("R3-20 (round 5): the pass card follows Tufte's spec: 8 px rule, 36 px check, 20 px bold line, #DDEFD9, 450 ms pop, 900 ms ring", () => {
  assert.match(delightCss, /#feedback\.ok \{[^}]*min-height: 56px[^}]*border-left: 8px solid #2e7d32[^}]*background: #ddefd9/s);
  assert.match(delightCss, /#feedback\.ok \{[^}]*font-size: 20px[^}]*font-weight: 700/s);
  assert.match(delightCss, /#feedback\.ok::before \{[^}]*width: 36px; height: 36px/s);
  assert.match(delightCss, /#feedback\.jt-win \{ animation: jt-card 450ms[^;]*, jt-cardring 900ms/);
  assert.match(delightCss, /@keyframes jt-cardring \{ 0% \{ box-shadow: 0 0 0 4px rgba\(46, 125, 50, 0\.35\)/);
  assert.match(delightCss, /@keyframes jt-card \{ from \{ opacity: 0; transform: scale\(0\.96\)/);
  assert.doesNotMatch(delightCss, /@keyframes jt-ring/, "round 6: the Result box gets no ring at a pass; Next keeps the one");
  assert.match(delightCss, /@keyframes jt-nudge[\s\S]*scale\(1\.04\)/);
  assert.match(delightCss, /prefers-reduced-motion: reduce\) \{ \* \{ animation: none !important/);
});
test("R3-19: Julia's message is trimmed of file locations and machine details, and nothing else", () => {
  const msg = "MethodError: no method matching length(::Int64, ::Int64, ::Int64)\n\nClosest candidates are:\n  length(!Matched::String, ::Int64, ::Int64)\n   @ Base strings/string.jl:483\n  length(!Matched::DataStructures.DefaultOrderedDict, ::Any...)\n   @ DataStructures ~/.julia/packages/DataStructures/IwRP2/src/delegate.jl:21\n  ...";
  assert.equal(JT.trimLocations(msg), "MethodError: no method matching length(::Int64, ::Int64, ::Int64)\n\nClosest candidates are:\n  length(!Matched::String, ::Int64, ::Int64)\n  length(!Matched::DataStructures.DefaultOrderedDict, ::Any...)\n  ...");
  assert.equal(JT.trimLocations("BoundsError: attempt to access 3-element Vector{Int64} at index [5]\nStacktrace:\n [1] getindex(a::Vector{Int64}, i::Int64)\n   @ Base ./essentials.jl:13"), "BoundsError: attempt to access 3-element Vector{Int64} at index [5]");
  assert.equal(JT.trimLocations("UndefVarError: `lenght` not defined"), "UndefVarError: `lenght` not defined");
  assert.equal(JT.trimLocations("ParseError:\n# Error @ none:1:9\nsum(1,2\n#       └ ── premature end of input"), "ParseError:\n# Error @ none:1:9\nsum(1,2\n#       └ ── premature end of input");
  assert.equal(JT.trimLocations("Error in x86_64-apple-darwin14 build"), "");
});
test("R3-19: the fold is Julia's own message; the first line beside the label hides while it is open, so the text shows once", () => {
  const js = read("web/lesson.js");
  assert.match(js, /el\("summary", null, "Julia's own message"\)/);
  assert.match(js, /class: "peek"/);
  assert.match(css, /\.julia-msg details\[open\] \.peek \{ display: none; \}/);
  assert.match(css, /\.julia-msg pre \{[^}]*background: #1e2a30/);
});
test("R3-28: the bar's status shares the progress label's slot, so the bar never gains an item", () => {
  assert.match(html, /<div id="strip-mid">\s*<div id="strip-info">[\s\S]*<\/div>\s*<span id="conn" aria-live="polite"><\/span>\s*<\/div>/);
  assert.match(css, /#strip-info, #conn \{ grid-area: 1 \/ 1;/);
  assert.match(css, /#strip-mid\[data-status="wait"\] #strip-info, #strip-mid\[data-status="lost"\] #strip-info \{ visibility: hidden; \}/);
  assert.match(read("web/lesson.js"), /setAttribute\("data-status", st === "connected" \? "0" : st === "connecting" \? "wait" : "lost"\)/);
});
test("R3-28: Show R, Show Python and Sound are pills; Board and Cheat sheet stay plain links", () => {
  assert.match(css, /\.switches \{[^}]*border: 1px solid #a89a76; border-radius: 999px/);
  assert.match(css, /\.switch\.on \{/);
  assert.match(css, /button\.navlink\.pill \{[^}]*border-radius: 999px/);
  assert.match(read("web/lesson-delight.js"), /sb\.className = "navlink pill"/);
  assert.match(read("web/lesson.js"), /lab\.classList\.toggle\("on"/);
});
test("R3-29: a waiting Next has a solid 2 px outline and dark words; the soft grey is darker than before", () => {
  assert.match(css, /button:disabled \{[^}]*border: 2px solid #8a7d5f/);
  assert.match(css, /--ink-soft: #3c4a52;/);
});
test("R3-10: the pocket dictionary starts closed, with a column width set for each switch state", () => {
  assert.doesNotMatch(html, /<details id="dict"[^>]* open/);
  for (const both of ['[data-r="1"][data-py="1"]', '[data-r="0"][data-py="0"]', '[data-r="1"][data-py="0"]', '[data-r="0"][data-py="1"]']) assert.ok(css.includes(both), both);
  assert.match(css, /\.dict table, \.sheet table \{ table-layout: fixed; width: 100%; \}/);
  // narrow window: cards, each naming "In R:" and "In Python:"
  assert.match(css, /\.dict td:nth-child\(3\)::before, \.sheet td:nth-child\(3\)::before \{ content: "In R: "/);
});
test("R3-30: a quoted value in a worked line never breaks across two lines", () => {
  const js = read("web/lesson.js");
  assert.match(js, /function fillCode\(node, text\)/);
  for (const id of ["starter-code", "pinned-code", "look-code"]) assert.ok(js.includes('fillCode($("' + id + '")'), id);
  assert.match(css, /\.nb \{ white-space: nowrap; \}/);
  assert.match(css, /\.dict td:not\(:nth-child\(2\)\), \.sheet td:not\(:nth-child\(2\)\) \{ font-family: var\(--mono\); overflow-wrap: break-word; \}/);
});
test("R3-34: Eddie and Momo are cropped closer, on the face; the disc is 64 px; Eddie is lifted", () => {
  assert.deepEqual(D.FACES.Eddie, [0.795, 0.405, 8.5]);
  assert.deepEqual(D.FACES.Momo, [0.595, 0.39, 7.5]);
  assert.equal(D.FACES.Itchy[2], 6);
  assert.match(delightCss, /--face: 64px/);
  assert.match(delightCss, /\.delight-face\.lift \{ filter: brightness\(1\.15\) contrast\(1\.05\)/);
});

// ---- R3-33: "In your own work" is a visible card; the last lesson says the three plain steps first -----------------------
const lesson = require("../web/lesson.js");
function endView(file) {
  const def = JSON.parse(read("lessons/" + file));
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  let ctrl;
  const served = JSON.parse(JSON.stringify(def));
  ctrl = lesson.createController({ lessonId: def.id, storage, send: (m) => {
    if (m.type === "lesson_info") ctrl.handle({ type: "lesson", request_id: m.request_id, lesson: served });
    if (m.type === "lesson_run") { const c = def.rounds.flatMap((r) => r.challenges).find((x) => x.id === m.challenge); ctrl.handle({ type: "lesson_result", request_id: m.request_id, challenge: m.challenge, status: "ok", pass: true, value_repr: "1", feedback: "ok" }); }
  } });
  ctrl.open(); ctrl.start();
  for (let g = 0; g < 400 && ctrl.view().screen === "challenge"; g++) { const ch = ctrl.view().ch; if (ch.kind !== "play") { if (ch.predict && ch.predict.guess === null) ctrl.predict(0); ctrl.run("x"); } ctrl.next(); }
  return ctrl.view();
}
test("R3-33: the end page's own-work card is in view, and Lesson 6 carries the three plain first-time steps", () => {
  const v6 = endView("lesson6.json");
  assert.equal(v6.screen, "end");
  assert.ok(v6.end.own && v6.end.own.code.includes("julia>"), "the julia> transcript is the card's code");
  assert.equal(v6.end.own.first.length, 3);
  assert.match(v6.end.own.first[0], /julialang\.org/);
  assert.match(v6.end.own.first[1], /`julia`/);
  assert.match(v6.end.own.first[2], /`pwd\(\)`/);
  const v1 = endView("lesson1.json");
  assert.equal(v1.end.own.first, null, "only the lesson that sends you to your own laptop adds the steps");
  assert.match(html, /<section id="end-own" class="own-card" aria-labelledby="end-own-h" hidden><\/section>/);
  assert.ok(at("end-own") < at("end-more"));
});

test("R3-38: the speed lab never claims the mystery is complete (the server does not check it)", () => {
  assert.doesNotMatch(read("src/speed_lab.jl"), /The mystery is complete/);
});
test("R3-21/22: a Julia problem is a notice above a greyed Start; a save problem is its own warm notice", () => {
  const board = read("web/course/setup-status-board.js"), bcss = read("web/course/course.css"), bjs = read("web/course/course-board.js");
  assert.match(board, /Play-Julia-Time-Mac\.command \(Mac\) or Play-Julia-Time-Windows \(Windows\)/);
  assert.doesNotMatch(board, /sandbox/);
  assert.match(board, /insertBefore\(row, continueAction\)/);
  assert.match(bcss, /\.primary-action\[aria-disabled="true"\], \.primary-action\[aria-disabled="true"\]:hover \{ background:#c9bda1/);
  assert.match(bjs, /Cannot save here/);
  assert.match(bjs, /could not be read, so the Board starts empty/);
  assert.match(bcss, /\.board-status\[data-kind="warn"\]/);
  assert.match(read("web/lesson.js"), /Press Run once more, or press Next and carry on/);
  assert.match(read("web/lesson.css"), /\.works-too\.warn/);
});

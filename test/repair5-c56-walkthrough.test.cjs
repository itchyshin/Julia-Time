"use strict";

// Repair slice 5 (2026-09-24 real-browser walk-through of Chapters 5 and 6): eight confirmed
// learner-facing problems. Pure-function and structural guards in the repo's usual style; they
// protect what the learner sees, not a claim that a human has learned.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c5 = require("../web/chapter5.js");
const c6 = require("../web/chapter6.js");

const web = name => fs.readFileSync(path.join(__dirname, "../web", name), "utf8");
const EM_DASH = /—/;
const MILESTONES = ["C1/select-records", "C2/rates", "C3/filter-disagreement", "C4/plan-distinct-recheck", "C5/event-frequency", "C6/compatible-models"];

// ---- fixtures (same shapes as chapter5-client / chapter6-client tests) ----
const CASE_ID = "missing-fleas-v1";
const COUNTS = [0, 2, 3, 3, 5, 6];
function c5Info(move) {
  return {
    type:"case", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:move,
    mode:"challenge", activity_id:null, simulation_id:"opaque-server-simulation-42", request_id:"c5-info",
    n_jars:6, p_ref:0.5, observed_count:3, n_trials:COUNTS.length,
    inputs:[{id:"sim_counts", columns:["simulation", "count"], rows:COUNTS.map((count, index) => ({simulation:index + 1, count}))}]
  };
}
function c5Pending(move) {
  let state = c5.beginInfo(c5.createState(), "c5-info", move);
  state = c5.applyCaseInfo(state, c5Info(move));
  return c5.beginRun(state, "c5-run", move);
}
function c5Result(move, overrides) {
  return Object.assign({
    type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C5", move_id:move,
    mode:"challenge", activity_id:null, simulation_id:"opaque-server-simulation-42", request_id:"c5-run",
    status:"ok", pass:false, progress_eligible:false, value_repr:"", result_data:null
  }, overrides || {});
}
const C6_COLUMNS = ["model", "p", "lower", "upper"];
const C6_ROWS = [
  {model:"Candidate p = 0.1", p:0.1, lower:0, upper:2},
  {model:"Candidate p = 0.5", p:0.5, lower:1, upper:5},
  {model:"Candidate p = 0.8", p:0.8, lower:4, upper:6}
];
function c6Info() {
  return {type:"case", contract_version:1, case_id:CASE_ID, chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null, request_id:"c6-info", observed_count:5, n_trials:6, inputs:[{id:"candidate_models", columns:C6_COLUMNS, rows:C6_ROWS}]};
}
function c6Pending(request_id) {
  let state = c6.beginInfo(c6.createState(), "c6-info");
  state = c6.applyCaseInfo(state, c6Info());
  return c6.beginRun(state, request_id);
}
function c6Reply(request_id, overrides) {
  return Object.assign({type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null, request_id, status:"error", pass:false, progress_eligible:false, result_data:null}, overrides || {});
}

// WCAG relative-luminance contrast ratio for two #rrggbb colours.
function contrast(a, b) {
  const lum = hex => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// ---- 1. C6 pre-editor bridge lists both checks and is valid markup ----
test("repair5-1: the C6 bridge lists both yes-or-no checks, as the hint's placeholders, without the case answer", () => {
  const bridge = c6.preEditorBridge();
  assert.match(bridge.lead, /two yes-or-no checks/i);
  assert.equal(bridge.checks.length, 2, "the lead promises two checks, so two are listed");
  const [lower, upper] = bridge.checks;
  assert.match(lower.label, /lower/i);
  assert.equal(lower.template, "lower_bound .<= target");
  assert.match(upper.label, /upper/i);
  assert.equal(upper.template, "target .<= upper_bound");
  for (const check of bridge.checks) {
    assert.ok(c6.COPY.range_rule.includes(check.template), `${check.template} uses the same placeholders as the row-rule hint`);
    const shown = [check.label, check.template, check.inCase, check.note].join(" ");
    assert.doesNotMatch(shown, EM_DASH, "new learner-facing text has no em dash");
    assert.doesNotMatch(shown, /candidate_models\.upper/, "the named upper check stays with the learner");
    assert.ok(!shown.includes(c6.COPY.solution), "never the full case answer before the answer step");
    assert.match(check.note, /one true-or-false value per candidate model/i);
  }
  // The named lower-bound translation (2026-09-09, "reduce translation burden") stays.
  assert.equal(lower.inCase, "candidate_models.lower .<= observed_count");
  assert.equal(upper.inCase, "");
});

test("repair5-1: the C6 bridge container can hold a list and a code block (no <pre> inside a <p>)", () => {
  const html = web("chapter6.html");
  assert.match(html, /<div id="pre-editor-bridge" class="bridge"><\/div>/);
  assert.doesNotMatch(html, /<p id="pre-editor-bridge"/);
  const source = web("chapter6.js");
  const start = source.indexOf("if (el.preEditorBridge)");
  const block = source.slice(start, source.indexOf("if (el.draft)", start));
  assert.match(block, /bridge\.checks\.forEach/, "the page renders the listed checks from preEditorBridge()");
  assert.match(block, /createElement\("ol"\)/);
  assert.doesNotMatch(block, /candidate_models\.lower \.<= observed_count/, "no hard-coded check text that can drift from preEditorBridge()");
});

// ---- 2. C6 conclusion does not call a random recheck reproducible ----
test("repair5-2: the C6 conclusion names a fair recheck of new observations, not a reproducible one", () => {
  const closure = c6.caseClosure(c6Info(), {kind:"table", columns:C6_COLUMNS, rows:[C6_ROWS[1], C6_ROWS[2]]});
  assert.match(closure.conclusion, /fair recheck of new observations/i);
  assert.doesNotMatch(web("chapter6.js"), /reproduc/i);
});

// ---- 3. C5 Next buttons are readable on the navy editor ----
test("repair5-3: quiet buttons on the navy editor panel (Next, help steps) reach at least 4.5:1", () => {
  const css = web("chapter5.css");
  const ink = css.match(/--ink:\s*(#[0-9a-f]{6})/i)[1];
  assert.match(css, /\.editor\{background:var\(--ink\)/, "the editor panel is navy ink");
  const rule = css.match(/\.editor \.quiet\{([^}]*)\}/);
  assert.ok(rule, "an editor-scoped quiet-button colour exists");
  const color = rule[1].match(/(?:^|;)color:\s*(#[0-9a-f]{6})/i)[1];
  const border = rule[1].match(/border-color:\s*(#[0-9a-f]{6})/i)[1];
  assert.ok(contrast(color, ink) >= 4.5, `text ${color} on ${ink} is ${contrast(color, ink).toFixed(2)}:1`);
  assert.ok(contrast(border, ink) >= 3, `border ${border} on ${ink} is ${contrast(border, ink).toFixed(2)}:1`);
  const html = web("chapter5.html");
  const editor = html.indexOf('<section class="editor"');
  const next = html.indexOf('<button id="next" class="quiet next"');
  assert.ok(editor >= 0 && next > editor, "the Next button sits inside the navy editor panel");
});

// ---- 4. C5 Move 2 shows case status that fits Move 2 ----
test("repair5-4: C5 Move 2 case status talks about the frequency, not about naming the event", () => {
  const first = c5.caseStatus(c5Info("event-mask"), "event-mask");
  const second = c5.caseStatus(c5Info("event-frequency"), "event-frequency");
  assert.match(first.why_now, /need a yes-or-no event/i, "Move 1 keeps its reason");
  assert.notEqual(second.why_now, first.why_now);
  assert.doesNotMatch(second.why_now, /we need a yes-or-no event/i);
  assert.match(second.why_now, /Move 1/);
  assert.match(second.why_now, /how often/i);
  assert.doesNotMatch(second.why_now, EM_DASH);
  assert.doesNotMatch(second.why_now, /sim_counts|sum\(|length\(|\.>=/, "no code, so no answer leak");
  assert.equal(c5.caseStatus(c5Info("event-frequency")).why_now, second.why_now, "without a move argument the metadata's move decides");
  assert.match(web("chapter5.js"), /caseStatus\(state\.metadata,\s*state\.activeMove\)/, "the page passes the active move");
});

// ---- 5. Rejection text names things that exist on the page ----
test("repair5-5: C5 and C6 rejection text names the Required result line and Help me start, not a missing cue", () => {
  const texts = [c5.challengeRecovery("event-mask"), c5.challengeRecovery("event-frequency"), c6.challengeRecovery()];
  for (const text of texts) {
    assert.doesNotMatch(text, /cue/i);
    assert.match(text, /Required result line/);
    assert.match(text, /Help me start/);
    assert.match(text, /draft is still here/i);
    assert.match(text, /run again/i);
    assert.doesNotMatch(text, EM_DASH);
  }
  // Same kind (Rose sweep): the obsolete-draft caption appears at hint 0, when no answer panel is shown.
  const c5source = web("chapter5.js");
  assert.doesNotMatch(c5source, /use the runnable answer above/);
  assert.match(c5source, /An obsolete incomplete draft was cleared\. Your valid drafts are safe; open Help me start below for the steps, or start your own\./);
  for (const page of ["chapter5.html", "chapter6.html"]) {
    const html = web(page);
    assert.match(html, /<span>Required result<\/span>/, `${page} labels a Required result line`);
    assert.match(html, /<summary>Help me start /, `${page} has a Help me start control`);
    assert.ok(html.indexOf("Required result") < html.indexOf('id="result"'), `${page}: Required result is above the run result`);
    assert.ok(html.indexOf('id="result"') < html.indexOf("<summary>Help me start"), `${page}: Help me start is below the run result`);
  }
});

// ---- 6. A run Julia could not execute gets the matching error title ----
test("repair5-6: C6 and C5 title a Julia error run as one Julia could not run", () => {
  const ERROR_TITLE = "Not accepted — Julia could not run this code. No evidence was saved.";
  const failed6 = c6.applyCaseResult(c6Pending("c6-err"), c6Reply("c6-err", {message:"TypeError: non-boolean (BitVector) used in boolean context"}));
  assert.equal(failed6.runFailure.status, "rejected", "the client classification is unchanged");
  assert.equal(c6.runOutcomeStatus(failed6.runFailure), ERROR_TITLE);
  assert.equal(c6.draftStatus({status:"error", pass:false}), "Julia could not run this code; your draft is still here to revise and run again.");
  const wrong6 = c6.applyCaseResult(c6Pending("c6-wrong"), c6Reply("c6-wrong", {status:"ok"}));
  assert.equal(c6.runOutcomeStatus(wrong6.runFailure), "Not accepted — no evidence was saved.", "a wrong result that ran keeps the plain title");

  const failed5 = c5.applyCaseResult(c5Pending("event-mask"), c5Result("event-mask", {status:"error", message:"UndefVarError: `x` not defined"}));
  assert.equal(c5.runOutcomeStatus(failed5.runFailure), ERROR_TITLE);
  const wrong5 = c5.applyCaseResult(c5Pending("event-mask"), c5Result("event-mask", {value_repr:"0.5"}));
  assert.equal(c5.runOutcomeStatus(wrong5.runFailure), "Not accepted — no evidence was saved.");
});

// ---- 7. C5 keeps internal ids off the visible page ----
test("repair5-7: C5 does not show the simulation fixture ID but still sends it with each run", () => {
  const source = web("chapter5.js");
  assert.doesNotMatch(source, /fixture ID/i);
  assert.doesNotMatch(source, /textContent\s*=\s*`[^`]*\$\{state\.metadata\.simulation_id\}/);
  let state = c5.beginInfo(c5.createState(), "c5-info", "event-mask");
  state = c5.applyCaseInfo(state, c5Info("event-mask"));
  assert.equal(c5.runMessage(state, "x", "c5-run").simulation_id, "opaque-server-simulation-42", "the id stays in the data flow");
});

// ---- 8. C6 shows the Chapter 6 Case file line once ----
test("repair5-8: the C6 Case Board update line points at the Case file instead of repeating its Chapter 6 line", () => {
  const rows = c6.caseFileRows(MILESTONES);
  const c6Row = rows.find(row => row.chapter === "C6");
  assert.equal(c6Row.label, "ESTABLISHED");
  const line = c6.boardUpdateLine(rows);
  assert.match(line, /^Case Board updated: /);
  assert.match(line, /Case file below/);
  assert.ok(!line.includes(c6Row.fact), "the Chapter 6 fact appears once, in the Case file");
  assert.doesNotMatch(line, EM_DASH);
  assert.equal(c6.boardUpdateLine(c6.caseFileRows(MILESTONES.slice(0, 5))), "", "no update claim when Chapter 6 is not saved");
  assert.equal(c6.boardUpdateLine([]), "");
  assert.match(web("chapter6.js"), /boardUpdateLine\(rows\)/);
});

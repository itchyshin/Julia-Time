"use strict";

// Repair slice C56 (2026-09-24 real-browser UI audit of Chapters 5 and 6): UI-01, UI-02, UI-03,
// UI-11, UI-12, UI-14, UI-15 and UI-17. Pure-function and structural guards in the repo's usual
// style; they protect what the learner sees, not a claim that a human has learned.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c5 = require("../web/chapter5.js");
const c6 = require("../web/chapter6.js");

const web = name => fs.readFileSync(path.join(__dirname, "../web", name), "utf8");
const EM_DASH = /—/;

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
function c6Pending(request_id) {
  let state = c6.beginInfo(c6.createState(), "c6-info");
  state = c6.applyCaseInfo(state, {type:"case", contract_version:1, case_id:CASE_ID, chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null, request_id:"c6-info", observed_count:5, n_trials:6, inputs:[{id:"candidate_models", columns:C6_COLUMNS, rows:C6_ROWS}]});
  assert.ok(state.metadata);
  return c6.beginRun(state, request_id);
}
function c6Reply(request_id, overrides) {
  return Object.assign({type:"case_result", contract_version:1, case_id:CASE_ID, chapter:"C6", move_id:"compatible-models", mode:"challenge", activity_id:null, simulation_id:null, request_id, status:"error", pass:false, progress_eligible:false, result_data:null}, overrides || {});
}

// Julia's own text for these mistakes, measured on this machine's Julia (2026-09-24) and passed
// through the sandbox's _format_error (novice line, blank line, showerror).
const PLAIN_COMPARISON_C5 = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching isless(::Int64, ::Vector{Int64})\n\nClosest candidates are:\n  isless(!Matched::Missing, ::Any)\n   @ Base missing.jl:87";
const PLAIN_COMPARISON_C6 = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching isless(::Vector{Int64}, ::Int64)\n\nClosest candidates are:\n  isless(!Matched::Missing, ::Any)\n   @ Base missing.jl:87";
const SHORT_CIRCUIT_AND = "Something went wrong running this line.\n\nTypeError: non-boolean (BitVector) used in boolean context";
const PLAIN_AMPERSAND = "A function was called with the wrong kind of argument.\n\nMethodError: no method matching &(::BitVector, ::BitVector)\n\nClosest candidates are:\n  &(::Any, ::Any, !Matched::Any, !Matched::Any...)\n   @ Base operators.jl:587";

// ---- UI-01 ----
test("UI-01: the C5/C6 stylesheet lets the hidden attribute hide the author-styled opening scene", () => {
  const css = web("chapter5.css");
  assert.match(css, /\.scene\{display:grid/, "precondition: .scene is author-styled as a grid");
  assert.match(css, /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/, "chapter5.css restores [hidden] like C1-C4 do");
  assert.match(web("chapter6.html"), /href="chapter5\.css"/, "C6 reuses chapter5.css, so the one rule covers both chapters");
  assert.match(web("chapter5.js"), /el\.scene\.hidden=true/);
  assert.match(web("chapter6.js"), /el\.scene\.hidden = true/);
});

// Found while verifying UI-01 in a real browser: an unbalanced parenthesis on chapter5.css line 2
// made the browser drop every later rule (the [hidden] fix, focus-visible, reduced motion), while
// text-matching tests still passed. Guard that both C5/C6 stylesheets parse to their last rule.
test("UI-01: the C5/C6 stylesheets have balanced parentheses and braces, so every rule reaches the browser", () => {
  for (const file of ["chapter5.css", "chapter6.css"]) {
    const css = web(file).replace(/\/\*[\s\S]*?\*\//g, "");
    let parens = 0, braces = 0;
    for (const [index, char] of [...css].entries()) {
      if (char === "(") parens++;
      if (char === ")") parens--;
      if (char === "{" || char === "}") {
        assert.equal(parens, 0, `${file}: a parenthesis is still open at character ${index}`);
        braces += char === "{" ? 1 : -1;
        assert.ok(braces >= 0, `${file}: an extra closing brace at character ${index}`);
      }
      assert.ok(parens >= 0, `${file}: an extra closing parenthesis at character ${index}`);
    }
    assert.equal(parens, 0, `${file}: parentheses balance`);
    assert.equal(braces, 0, `${file}: braces balance`);
  }
});

// ---- UI-02 ----
test("UI-02: every C5 pre-editor cue is a complete sentence and never shows the Move 2 code shape", () => {
  for (const move of c5.MOVES) {
    const lead = c5.preEditorBridge(move).lead.trim();
    assert.ok(lead.length > 0, `${move} has a cue`);
    assert.doesNotMatch(lead, /:$/, `${move} cue must not end in a colon that introduces hidden code`);
    assert.match(lead, /[.?!]$/, `${move} cue ends as a sentence`);
    assert.doesNotMatch(lead, EM_DASH);
    assert.doesNotMatch(lead, /counts \.>= threshold|frequency=sum\(events\)|sim_counts\s*\.>=/, `${move} cue keeps the shape behind the hints`);
  }
  const source = web("chapter5.js");
  const start = source.indexOf("function render()");
  const render = source.slice(start, source.indexOf("function persistDraft()", start));
  assert.doesNotMatch(render, /bridge\.(shape|explanation)/, "T2 holds: render writes only the lead");
});

// ---- UI-03 ----
test("UI-03: C5 and C6 never call a checked result an unrun draft", () => {
  for (const [name, client, file] of [["C5", c5, "chapter5.js"], ["C6", c6, "chapter6.js"]]) {
    assert.equal(typeof client.draftStatus, "function", `${name} exports draftStatus`);
    assert.match(client.draftStatus({status:"ok", pass:true, progress_eligible:true}), /checked this code just now/i);
    assert.match(client.draftStatus({status:"ok", pass:false, progress_eligible:false}), /ran this code/i);
    assert.match(client.draftStatus({status:"error", pass:false}), /could not run this code/i);
    for (const message of [
      {status:"ok", pass:true, progress_eligible:true}, {status:"ok", pass:false}, {status:"ok", pass:true, progress_eligible:false},
      {status:"error"}, {status:"timeout"}, {status:"rejected"}
    ]) {
      const caption = client.draftStatus(message);
      assert.doesNotMatch(caption, /unrun/i, `${name} ${JSON.stringify(message)}`);
      assert.doesNotMatch(caption, EM_DASH);
    }
    assert.doesNotMatch(client.draftStatus({status:"ok", pass:true, progress_eligible:false}), /checked this code just now/i, `${name} accepted wording needs progress eligibility`);
    const source = web(file);
    assert.match(source, /draftStatus\(lastRun\)/, `${name} render picks the caption from the last checked run`);
    assert.match(source, /addEventListener\("input",\s*\(\)\s*=>\s*\{[^}]*lastRun\s*=\s*null/, `${name} typing turns the caption back into an unrun draft`);
    assert.match(source, /applyCaseResult\(state,\s*message\)[\s\S]{0,400}?lastRun\s*=/, `${name} records the run that Julia just checked`);
  }
});

// ---- UI-11 ----
test("UI-11: the C5/C6 full-answer button never shares its label with a hint-ladder step", () => {
  const answerLabel = html => html.match(/id="answer"[^>]*>([^<]+)</)[1].trim();
  const a5 = answerLabel(web("chapter5.html"));
  const a6 = answerLabel(web("chapter6.html"));
  assert.equal(a5, "Show the complete answer", "C5 matches the C1-C4 answer button");
  assert.equal(a6, "Show the complete answer", "C6 matches the C1-C4 answer button");
  for (const move of c5.MOVES) {
    for (let index = 0; c5.helpStage(move, index); index++) assert.notEqual(c5.helpStage(move, index).button, a5, `${move} stage ${index}`);
  }
  const nextHintLine = web("chapter6.js").match(/el\.nextHint\.textContent = [^;]+;/)[0];
  assert.ok(!nextHintLine.includes(`"${a6}"`), "C6 next-hint label must not duplicate #answer");
});

test("UI-11: C5 and C6 keep earlier hints on screen when the next hint opens", () => {
  const mask = c5.COPY["event-mask"];
  assert.deepEqual(c5.visibleHints("event-mask", 0), ["Open a small hint when you need it."]);
  // Round 2 (B9): the code shape is followed by its placeholder note, one more paragraph.
  const three = c5.visibleHints("event-mask", 3);
  assert.equal(three.length, 4);
  assert.ok(three[0].includes(mask.concept));
  assert.ok(three[1].includes(mask.shape));
  assert.match(three[2], /placeholders/);
  assert.match(three[3], /will not write/);
  const all = c5.visibleHints("event-frequency", 5);
  assert.equal(all.length, 6);
  assert.ok(all[0].includes(c5.COPY["event-frequency"].concept));
  assert.match(all[5], /Complete runnable answer is shown/);
  assert.ok(!all.some(line => line.includes(c5.COPY["event-frequency"].solution)), "the full answer stays in its reference panel");

  assert.deepEqual(c6.visibleHints(0), ["Open a small hint only if you need it."]);
  const c6All = c6.visibleHints(5);
  assert.equal(c6All.length, 6);
  assert.ok(c6All[0].includes(c6.COPY.concept));
  assert.ok(c6All[1].includes(c6.COPY.shape));
  assert.equal(c6All[2], c6.COPY.shape_note);
  assert.ok(c6All[3].includes(c6.COPY.range_rule));
  assert.ok(c6All[4].includes(c6.COPY.selection));
  assert.match(c6All[5], /Complete runnable answer is shown/);
  assert.ok(!c6All.some(line => line.includes(c6.COPY.solution)));

  assert.match(web("chapter5.js"), /visibleHints\(state\.activeMove,\s*hint\)/, "C5 renders the accumulated list");
  assert.match(web("chapter6.js"), /visibleHints\(hint\)/, "C6 renders the accumulated list");
  for (const page of ["chapter5.html", "chapter6.html"]) {
    assert.match(web(page), /<div id="hint" aria-live="polite"><\/div>/, `${page} holds one paragraph per shown hint`);
  }
});

// ---- UI-12 ----
test("UI-12: C5 names a comparison without its dot from Julia's actual error, then gives the shared step", () => {
  for (const move of c5.MOVES) {
    // repair6-4: an error run ends with the shared error step.
    const shared = c5.challengeRecovery(move, {status:"error"});
    const text = c5.challengeRecovery(move, {status:"error", message:PLAIN_COMPARISON_C5});
    assert.notEqual(text, shared);
    assert.match(text, /without a dot/i);
    assert.match(text, /\.>=/);
    assert.ok(text.endsWith(shared), "the specific line leads into the unchanged shared step");
    assert.doesNotMatch(text, /sim_counts\s*\.>=\s*observed_count/);
    assert.doesNotMatch(text, EM_DASH);
  }
  assert.equal(c5.challengeRecovery("event-mask", {status:"error", message:"UndefVarError: `foo` not defined"}), c5.challengeRecovery("event-mask", {status:"error"}), "other errors keep the shared error step");

  const failed = c5.applyCaseResult(c5Pending("event-mask"), c5Result("event-mask", {status:"error", message:PLAIN_COMPARISON_C5}));
  assert.equal(failed.runFailure.feedback, c5.challengeRecovery("event-mask", {status:"error", message:PLAIN_COMPARISON_C5}));
  assert.equal(failed.runFailure.original_error, PLAIN_COMPARISON_C5, "Julia's own error text stays verbatim");
});

test("UI-12: C5 keeps Julia's actual returned value and says when it is not the labelled pair", () => {
  const shared = c5.challengeRecovery("event-frequency");
  const scalar = c5.applyCaseResult(c5Pending("event-frequency"), c5Result("event-frequency", {value_repr:"0.343"}));
  assert.equal(scalar.runFailure.status, "rejected");
  assert.equal(scalar.runFailure.value_repr, "0.343", "the actual returned value reaches the page");
  assert.match(scalar.runFailure.feedback, /labelled pair/i);
  assert.match(scalar.runFailure.feedback, /\(events=\.\.\., frequency=\.\.\.\)/);
  assert.ok(scalar.runFailure.feedback.endsWith(shared));
  assert.doesNotMatch(scalar.runFailure.feedback, /sim_counts\s*\.>=|sum\(events\)\s*\/\s*length\(events\)/, "no answer leak");
  assert.doesNotMatch(scalar.runFailure.feedback, EM_DASH);

  for (const repr of ["(frequency = 0.5, events = Bool[0, 0, 1])", "(Bool[0, 0, 1], 0.5)", "6-element BitVector:\n 0\n 0\n 1"]) {
    const other = c5.applyCaseResult(c5Pending("event-frequency"), c5Result("event-frequency", {value_repr:repr}));
    assert.match(other.runFailure.feedback, /labelled pair/i, repr);
  }
  const pair = c5.applyCaseResult(c5Pending("event-frequency"), c5Result("event-frequency", {value_repr:"(events = Bool[0, 0, 1, 1, 1, 1], frequency = 0.5)"}));
  assert.equal(pair.runFailure.feedback, shared, "a labelled pair with other values gets the shared step only");
  assert.equal(pair.runFailure.value_repr, "(events = Bool[0, 0, 1, 1, 1, 1], frequency = 0.5)");
  const mask = c5.applyCaseResult(c5Pending("event-mask"), c5Result("event-mask", {value_repr:"0.5"}));
  assert.equal(mask.runFailure.feedback, c5.challengeRecovery("event-mask"), "Move 1 does not ask for the pair");
  const error = c5.applyCaseResult(c5Pending("event-frequency"), c5Result("event-frequency", {status:"error", message:"UndefVarError: `x` not defined"}));
  assert.equal(error.runFailure.feedback, c5.challengeRecovery("event-frequency", {status:"error"}), "an error has no returned value to judge");

  const source = web("chapter5.js");
  assert.match(source, /Actual Julia output/, "C5 renders the returned value like C2 and C3");
});

test("UI-12: C6 names && versus .& from Julia's actual error, then gives the shared step", () => {
  // repair6-4: an error run ends with the shared error step; a returned wrong result keeps its own.
  const shared = c6.challengeRecovery({status:"error"});
  const text = c6.challengeRecovery({status:"error", message:SHORT_CIRCUIT_AND});
  assert.notEqual(text, shared);
  assert.match(text, /&&/);
  assert.match(text, /\.&/);
  assert.ok(text.endsWith(shared));
  assert.doesNotMatch(text, /candidate_models|observed_count/);
  assert.doesNotMatch(text, EM_DASH);

  let state = c6.applyCaseResult(c6Pending("c6-andand"), c6Reply("c6-andand", {message:SHORT_CIRCUIT_AND}));
  assert.equal(state.runFailure.message, text);
  assert.equal(state.runFailure.original_error, SHORT_CIRCUIT_AND, "Julia's own error text stays verbatim");

  // Same family (a missing broadcast dot), keyed on Julia's own text.
  const plain = c6.challengeRecovery({status:"error", message:PLAIN_COMPARISON_C6});
  assert.match(plain, /without a dot/i);
  assert.match(plain, /\.<=/);
  assert.ok(plain.endsWith(shared));
  const amp = c6.challengeRecovery({status:"error", message:PLAIN_AMPERSAND});
  assert.match(amp, /\.&/);
  assert.ok(amp.endsWith(shared));
  for (const line of [plain, amp]) {
    assert.doesNotMatch(line, /candidate_models|observed_count/);
    assert.doesNotMatch(line, EM_DASH);
  }
  assert.equal(c6.challengeRecovery({status:"error", message:"UndefVarError: `lower` not defined"}), shared);
  assert.equal(c6.challengeRecovery({status:"ok", pass:false}), c6.challengeRecovery());
});

// ---- UI-14 ----
test("UI-14: C5 learner copy carries no literal Markdown backticks", () => {
  for (const move of c5.MOVES) {
    for (const [key, value] of Object.entries(c5.COPY[move])) {
      if (typeof value === "string") assert.doesNotMatch(value, /`/, `${move}.${key}`);
    }
  }
  assert.doesNotMatch(c5.COPY["event-frequency"].required, /`/);
  assert.match(c5.COPY["event-frequency"].required, /\(events=\.\.\., frequency=\.\.\.\)/, "the required pair is still named");
});

// ---- UI-15 ----
test("UI-15: C6 shows the recheck sentence once, in the closing, not again in the Case file", () => {
  const source = web("chapter6.js");
  const start = source.indexOf("function buildCaseFileSection");
  const end = source.indexOf("\n    function drawVisual", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(source.slice(start, end), /closure\.next/);
  assert.equal((source.match(/\.textContent\s*=\s*closure\.next/g) || []).length, 1);
});

// ---- UI-17 ----
test("UI-17: the C5 scene offers the Case Board and its Case 5 of 6 location, like C6", () => {
  const html = web("chapter5.html");
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  assert.match(header, /<nav class="course-location" aria-label="Course location"><a id="case-board-scene" href="course\/index\.html">Case Board<\/a><p>Case 5 of 6 · A small probability model<\/p><\/nav>/);
  assert.ok(html.indexOf('id="case-board-scene"') < html.indexOf('id="scene"'), "visible before and after the scene");
  const source = web("chapter5.js");
  assert.match(source, /sceneBoard:\$\("case-board-scene"\)/);
  assert.match(source, /if \(el\.sceneBoard\) el\.sceneBoard\.href=caseBoardUrl\(location\.search\)/, "the attempt query survives");
  assert.match(web("chapter5.css"), /\.course-location\{display:flex/);
});

test("UI-17: C6 labels its candidate table with the Julia name the learner types", () => {
  const source = web("chapter6.js");
  const start = source.indexOf("function drawTable()");
  const body = source.slice(start, source.indexOf("function drawScaffold()", start));
  assert.match(body, /"Julia name: "/);
  assert.match(body, /name\.textContent = state\.metadata\.inputs\[0\]\.id/, "the label shows the server's own input name");
  assert.match(body, /label\.className = "data-label"/);
});

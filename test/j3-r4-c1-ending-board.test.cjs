"use strict";
// Round-4 fixes (J3, 2026-09-27): C1 leads with the server's coaching line, the C1 practice
// whole-column line fires only on a whole-column ==, the ending's scene 3 fade order and stamp,
// the Case Board's C3 wording and empty draft bar, and the C2/C4/C6 bridge lines.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mystery = require("../web/mystery.js");
const endingScript = require("../web/course/ending-script.js");
const ending = require("../web/course/ending.js");
const bridges = require("../web/course/bridges.js");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const ARROW = "Julia assigns with =, not <-. Julia read your <- as \"is less than minus\", a comparison, so nothing was stored. Write = where you wrote <-.";
const undefName = name => name + " is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `" + name + "` not defined";

// ---- Fix 1: C1 leads with the server's coaching line ----
test("C1 case: an error with coaching leads with it and hides the server's generic feedback", () => {
  const message = {type:"case_result", status:"error", pass:false, message:undefName("jars"), feedback:"Julia stopped before the end. Check the names, then run again.", coaching:ARROW};
  const text = mystery.challengeRecovery(message);
  assert.ok(text.startsWith(ARROW), text);
  assert.doesNotMatch(text, /read the batch_id column as a list/);
  assert.equal(mystery.hidesServerFeedback(text), true);
});

test("C1 case: coaching beats the page's own guess keyed on Julia's error text", () => {
  const pythonLine = "Julia counts from 1, not 0: the first row is jars[1, :].";
  const message = {status:"error", pass:false, message:"BoundsError: attempt to access 12-element Vector at index [0]\ninvalid row index of type Bool", coaching:pythonLine};
  const text = mystery.challengeRecovery(message);
  assert.ok(text.startsWith(pythonLine), text);
  assert.doesNotMatch(text, /add a dot/);
});

test("C1 case: a rejected run that ran leads with coaching and drops the page's rows guess", () => {
  const coaching = "print is Python's; in Julia the last line's value is shown for you.";
  const message = {status:"ok", pass:false, coaching, rows:[{jar_id:"J-001", batch_id:"B08"}], columns:["jar_id", "batch_id"]};
  assert.ok(mystery.challengeRecovery(message).startsWith(coaching));
  const info = {case_batch:"B09", worked_example:{batch_id:"B08"}, rows:[{jar_id:"J-001"}]};
  assert.equal(mystery.returnedRowsLead(message, info), "");
});

test("C1 case: empty or missing coaching keeps the old lines", () => {
  assert.equal(mystery.challengeRecovery({status:"error", message:undefName("x"), coaching:""}), mystery.challengeRecovery({status:"error", message:undefName("x")}));
  assert.match(mystery.challengeRecovery({status:"error", message:"UndefVarError: `$` not defined"}), /R's \$ does not exist/);
  assert.equal(mystery.challengeRecovery({status:"ok", pass:false}), "");
});

test("C1: coaching never shows on an accepted run, in the case or the practice box", () => {
  const accepted = {status:"ok", pass:true, coaching:ARROW, value_repr:"true"};
  assert.ok(!mystery.challengeRecovery(accepted).includes(ARROW));
  assert.ok(!mystery.practiceFeedback("jars[1:3, :]", Object.assign({}, accepted, {value_repr:""})).includes(ARROW));
});

test("C1 practice: a coached error leads with the server's line", () => {
  const text = mystery.practiceFeedback("x <- jars[1:3, :]", {status:"error", pass:false, message:undefName("x"), coaching:ARROW});
  assert.ok(text.startsWith(ARROW), text);
  assert.match(text, /Practice does not count/);
});

// ---- Fix 2: whole-column coaching only on a whole-column == ----
test("C1 practice: the whole-column line needs a whole column compared with ==", () => {
  const scalar = ["nrow(jars) == 12", 'jars.batch_id[1] == "B08"', 'jars[1, :batch_id] == "B08"', "length(jars.batch_id) == 12", 'any(jars.batch_id .== "B08") == true'];
  for (const code of scalar) {
    const text = mystery.practiceFeedback(code, {status:"ok", value_repr:"true"});
    assert.doesNotMatch(text, /whole column/, code);
    assert.equal(text, "Julia returned this. Practice does not count for the case.", code);
  }
  for (const code of ['jars.batch_id == "B08"', '"B08" == jars.batch_id', 'jars[:, :batch_id] == "B08"', 'jars[!, :batch_id] == "B08"']) {
    assert.match(mystery.practiceFeedback(code, {status:"ok", value_repr:"false"}), /one false for the whole column/, code);
  }
});

// ---- Fix 3: focus moves to the shown hint or answer when the ladder ends ----
test("C1 ladder: focus moves to the new hint or answer before the controls are disabled or hidden", () => {
  const src = read("web/mystery.js");
  assert.match(src, /next\.shown >= hints\.length[^\n]*\.focus\(/);
  assert.match(src, /tabIndex = -1/);
});

// ---- Fix 4: ending ----
test("Ending scene 3: the two red lines fade in one after the other", () => {
  const css = read("web/course/ending.css");
  assert.match(css, /\.aha-play \.aha-note ~ \.aha-note \{[^}]*animation-delay/);
  assert.doesNotMatch(css, /\.aha-note \+ \.aha-note/);
});

test("Ending: the C3 scene says 0, as every other screen does, and the 0 comes from the server", () => {
  const c3 = endingScript.scenes.find(scene => scene.chapter === "C3");
  assert.equal(c3.title, "Where did the {logged} come from?");
  const facts = {batch_id:"B09", n_jars:6, n_detected:5,
    trays:[{tray_id:"T-A", detected_n:2}, {tray_id:"T-B", detected_n:2}, {tray_id:"T-C", detected_n:1}],
    disagreement:{tray_id:"T-C", notebook_detected:1, sheet_detected:0, entry_status:"left blank"},
    eligible_jars:["J-091", "J-092", "J-094", "J-096"], recheck_size:3,
    observed_count:5, n_per_simulation:6, n_simulations:1000, matching_events:113,
    models:[{model:"Vanishing", p:0.1, lower:0, upper:2, compatible:false}, {model:"Coin flip", p:0.5, lower:1, upper:5, compatible:true}]};
  assert.equal(ending.buildScenes(facts, endingScript, {})[2].title, "Where did the 0 come from?");
});

test("Ending: the stamp leaves room for the headline", () => {
  const css = read("web/course/ending.css");
  const rule = css.match(/\.stamp \{([^}]*)\}/)[1];
  assert.match(rule, /max-width:100%/);
  assert.match(rule, /rotate\(-2deg\)/);
});

// ---- Fix 5: Case Board ----
test("Case Board: C3 names Toto's typed table", () => {
  const src = read("web/course/course-client.js");
  assert.doesNotMatch(src, /line up the notebook and the tally sheet/);
  const model = client.dashboardModel(courseState.makeCourseState({moves:["C1/select-records", "C2/group", "C2/counts", "C2/rates"].map(key => ({key, provenance:"historical-browser"}))}));
  assert.equal(model.continue.label, "Continue Chapter 3: line up the notebook and Toto's typed table");
});

test("Case Board: an empty draft notice takes no space", () => {
  assert.match(read("web/course/course.css"), /\.draft-notice:empty \{ display:none; \}/);
});

// ---- Fix 6: bridges ----
test("Bridges: C6 chain line is true for columns, and C2/C4 name the pandas twin", () => {
  const c6 = bridges.BRIDGES["C6/compatible-models"].differences.join(" ");
  assert.doesNotMatch(c6, /Julia also reads lower <= x <= upper/);
  assert.match(c6, /stories\.lower \.<= observed_count \.<= stories\.upper/);
  assert.match(bridges.BRIDGES["C4/plan-distinct-recheck"].lead, /random\.sample/);
  assert.match(bridges.BRIDGES["C2/counts"].lead, /\.agg/);
});

// ---- Fix 7: Start Here at 375 px ----
test("Start Here: the long Mac path can wrap", () => {
  assert.match(read("web/course/course.css"), /\.guide-recovery dd \{[^}]*overflow-wrap:anywhere/);
});

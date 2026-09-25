"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/chapter2.js");

test("chapter two starts with its tray-bench scene, not a crowded coding desk", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../web/chapter2.html"),"utf8");
  assert.match(html,/assets\/course\/scene-c2-tray-bench\.png/);
  assert.match(html,/Eddie aligns several unlabelled specimen trays/);
  assert.match(html,/id="investigation" hidden/);
  assert.match(html,/id="start-investigation"/);
  assert.match(html,/id="back-to-scene"/);
  assert.match(html,/<details class="source-notebook" open>/);
});

test("C2 exposes one named Case Board route and a plain-language location", () => {
  assert.equal(typeof client.caseBoardUrl,"function");
  assert.equal(client.caseBoardUrl("?attempt=field-7"), "course/index.html?attempt=field-7");
  assert.equal(client.caseBoardUrl("?attempt=../../bad"), "course/index.html");
  assert.equal(client.caseLocation("group"), "Case 2 of 6 · Group by tray");
  assert.equal(client.caseLocation("counts"), "Case 2 of 6 · Count records and detections");
  assert.equal(client.caseLocation("rates"), "Case 2 of 6 · Calculate rates");
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../web/chapter2.html"),"utf8");
  assert.match(html,/id="case-board"/);
  assert.match(html,/Case 2 of 6/);
});

test("C2 keeps Reconnect out of the ready screen and exposes it only for recovery", () => {
  assert.equal(typeof client.shouldShowReconnect, "function");
  assert.equal(client.shouldShowReconnect(client.createState()), false);
  assert.equal(client.shouldShowReconnect(client.disconnect(client.createState())), true);
  assert.equal(client.shouldShowReconnect({...client.createState(), metadataFailure:"The case file is unavailable."}), true);

  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../web/chapter2.html"),"utf8");
  assert.match(html, /<button id="reconnect" type="button" hidden>Reconnect<\/button>/);
});

test("C2 accepts a valid Case Board Continue move without bypassing saved progress", () => {
  assert.equal(client.requestedMove("?move=counts"), "counts");
  assert.equal(client.requestedMove("?move=../../bad"), "");
  const afterGroup = {step:"rates", accepted:{group:"groupby(jars, :tray_id)"}};
  assert.equal(client.initialStep(afterGroup, "counts"), "counts");
  assert.equal(client.initialStep(afterGroup, "rates"), "counts");
  const afterCounts = {step:"group", accepted:{group:"groups", counts:"summary"}};
  assert.equal(client.initialStep(afterCounts, "rates"), "rates");
  assert.equal(client.initialStep(afterCounts, "not-a-move"), "group");
});

test("an intentionally empty saved draft is different from a missing draft", () => {
  assert.equal(typeof client.hasDraft,"function");
  const storage=memoryStorage();
  assert.equal(client.hasDraft(storage,"counts"),false);
  client.persistDraft(storage,"counts","");
  assert.equal(client.hasDraft(storage,"counts"),true);
});

test("C2 gives a plain accepted-or-not-accepted status after each case run", () => {
  assert.equal(typeof client.runOutcomeStatus, "function");
  assert.equal(client.runOutcomeStatus({status:"ok", pass:true}), "✓ Accepted — evidence saved.");
  assert.match(client.runOutcomeStatus({status:"ok", pass:false}), /Not accepted.*no evidence was saved/i);
  assert.match(client.runOutcomeStatus({status:"timeout", pass:false}), /Not accepted.*timed out/i);
});

test("summary jar marks use returned counts without assigning specimen identities", () => {
  assert.equal(typeof client.jarMarks,"function");
  assert.deepEqual(client.jarMarks({n:3,detected_n:1}),[true,false,false]);
  assert.deepEqual(client.jarMarks({n:2,detected_n:3}),[]);
  assert.deepEqual(client.jarMarks({n:1000000,detected_n:1}),[]);
});

test("C2 derives one visible rate example from supplied rows", () => {
  assert.deepEqual(client.rateExample([{tray_id:"T-A",detected:true},{tray_id:"T-A",detected:false}]), {tray_id:"T-A",detected_n:1,n:2,rate:0.5});
  assert.equal(client.rateExample([{tray_id:"T-A",detected:"true"}]), null);
});

test("C2's tangible grouping preview derives tray cards only from the supplied records", () => {
  assert.equal(typeof client.groupingPreview, "function");
  assert.deepEqual(client.groupingPreview([
    {jar_id:"J-091", tray_id:"T-A"},
    {jar_id:"J-092", tray_id:"T-B"},
    {jar_id:"J-093", tray_id:"T-A"}
  ]), [
    {tray_id:"T-A", jar_ids:["J-091", "J-093"]},
    {tray_id:"T-B", jar_ids:["J-092"]}
  ]);
  assert.deepEqual(client.groupingPreview([{jar_id:"J-091"}]), []);
});

test("C2's tangible grouping bridge names ingredients without printing a finished line", () => {
  assert.equal(typeof client.groupingPreviewMessage, "function");
  const message = client.groupingPreviewMessage();
  assert.match(message, /table jars/i);
  assert.match(message, /:tray_id/);
  assert.doesNotMatch(message, /groupby\(jars, :tray_id\)/);
});

test("C2 offers a closed worked groupby example on separate data before the empty case editor", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../web/chapter2.html"),"utf8");
  const example = html.indexOf('id="groupby-worked-example"');
  const editor = html.indexOf('<textarea id="code"');
  assert.ok(example > -1 && example < editor);
  const copy = html.slice(example, editor);
  assert.match(copy, /different jars/i);
  assert.match(copy, /groupby\(practice_jars, :tray_id\)/);
  assert.match(copy, /table first.*column/i);
  assert.doesNotMatch(copy, /groupby\(jars, :tray_id\)/);
});

test("C2 separates a plain build plan from real named inputs and runnable answers", () => {
  assert.equal(typeof client.lessonCopy,"function");
  assert.match(client.lessonCopy("group").teaching, /groupby is the Julia function/i);
  assert.match(client.lessonCopy("counts").teaching,/Make groups in this same editor/i);
  assert.match(client.lessonCopy("rates").teaching,/complete little script/i);
  assert.doesNotMatch(client.lessonCopy("rates").shape,/\b(?:group_column|count_rows|boolean_column)\b/);
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../web/chapter2.html"),"utf8");
  assert.match(html,/id="named-inputs"/);
  assert.match(html,/<code>jars<\/code>.*visible B09 notebook table/i);
  assert.match(html,/<code>:tray_id<\/code>.*column that says which tray/i);
  assert.doesNotMatch(html,/<pre id="code-shape"/);
});

test("C2 states the investigative reason for each coding move without supplying case code", () => {
  assert.equal(typeof client.casePurpose, "function");
  assert.match(client.casePurpose("group"), /same tray/i);
  assert.match(client.casePurpose("counts"), /how many jars.*how many recorded detections/i);
  assert.match(client.casePurpose("rates"), /fairly compare trays/i);
  assert.doesNotMatch(client.casePurpose("rates"), /summary\.detected_n|jars\[/);
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../web/chapter2.html"),"utf8");
  const purpose = html.indexOf('id="case-purpose"');
  const editor = html.indexOf('<textarea id="code"');
  assert.ok(purpose > -1 && purpose < editor);
});

test("C2 gives its compound summary moves an optional named-code rehearsal", () => {
  const counts = client.compositionCards("counts");
  const rates = client.compositionCards("rates");
  assert.deepEqual(counts.map(card => card.id), ["group", "summary", "return"]);
  assert.deepEqual(rates.map(card => card.id), ["group", "summary", "rate", "return"]);
  assert.ok(counts.every(card => !/\btable\b|group_column|count_rows|boolean_column/.test(card.text)));
  assert.ok(rates.every(card => !/\btable\b|group_column|count_rows|boolean_column/.test(card.text)));
  assert.match(counts[0].text,/groupby\(jars, :tray_id\)/);
  assert.equal(client.compositionIsCorrect("rates", ["group", "summary", "rate", "return"]), true);
  assert.equal(client.compositionIsCorrect("rates", ["summary", "group", "rate", "return"]), false);
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../web/chapter2.html"),"utf8");
  const scaffold = html.indexOf('id="composition-scaffold"');
  const editor = html.indexOf('<textarea id="code"');
  assert.ok(scaffold > -1 && scaffold < editor);
  assert.match(html, /practice only[\s\S]*does not run Julia[\s\S]*write into your editor/i);
});

test("saved summaries reject empty duplicate impossible and inconsistent rows", () => {
  const columns=["tray_id","n","detected_n","rate"];
  for (const rows of [[], [validRows()[0],validRows()[0]], [{tray_id:"X",n:0,detected_n:0,rate:0}], [{tray_id:"X",n:2,detected_n:3,rate:1.5}], [{tray_id:"X",n:2,detected_n:1,rate:1}]]) {
    assert.equal(client.validEvidenceDisplay({rows,columns}),false);
  }
});

test("progress snapshots preserve accepted code separately from a later draft", () => {
  assert.equal(typeof client.saveProgress,"function");
  const storage=memoryStorage();
  client.saveProgress(storage,{step:"rates",accepted:{group:"groupby(jars, :tray_id)",counts:"my counts"}});
  client.persistDraft(storage,"counts","a later wrong draft");
  assert.equal(client.loadProgress(storage).accepted.counts,"my counts");
  assert.equal(client.loadProgress(storage).step,"rates");
  assert.deepEqual(client.loadProgress({getItem(){throw Error("blocked");}}),{step:"group",accepted:{}});
});

test("C2 saves use their own attempt-aware namespace", () => {
  assert.equal(client.storagePrefix(""), "julia-time:missing-fleas:v1:c2:");
  assert.equal(client.storagePrefix("field-7"), "julia-time:missing-fleas:v1:c2:attempt:field-7:");
  assert.equal(client.storagePrefix("../../no"), "julia-time:missing-fleas:v1:c2:");
  assert.notEqual(client.storagePrefix("field-7"), "julia-time:missing-fleas:v1:attempt:field-7:");
});

test("each teaching move keeps an independent draft", () => {
  const storage = memoryStorage();
  client.persistDraft(storage, "group", "groupby(jars, :tray_id)");
  client.persistDraft(storage, "counts", "combine(grouped, nrow => :n)");
  assert.equal(client.loadDraft(storage, "group"), "groupby(jars, :tray_id)");
  assert.equal(client.loadDraft(storage, "counts"), "combine(grouped, nrow => :n)");
  assert.equal(client.loadDraft(storage, "rates"), "");
});

test("a response only settles the current C2 request and current step", () => {
  const waiting = client.beginRun(client.createState(), "new", "counts");
  assert.equal(client.applyCaseResult(waiting, {type:"case_result", chapter:"C2", request_id:"old", step:"counts"}), waiting);
  assert.equal(client.applyCaseResult(waiting, {type:"case_result", chapter:"C1", request_id:"new", step:"counts"}), waiting);
  assert.equal(client.applyCaseResult(waiting, {type:"case_result", chapter:"C2", request_id:"new", step:"rates"}), waiting);
  const done = client.applyCaseResult(waiting, {type:"case_result", chapter:"C2", request_id:"new", step:"counts", status:"ok", pass:true, rows:[], columns:[]});
  assert.equal(done.outstandingRequestId, null);
  assert.equal(done.result.step, "counts");
});

test("only a passing rates response with valid returned rows becomes evidence", () => {
  let state = client.beginRun(client.createState(), "r1", "rates");
  state = client.applyCaseResult(state, validRatesResult({pass:false}));
  assert.equal(state.evidence, null);
  state = client.beginRun(state, "r2", "rates");
  state = client.applyCaseResult(state, validRatesResult({request_id:"r2", pass:true}));
  assert.deepEqual(state.evidence.rows, validRows());
  assert.equal(client.validEvidenceDisplay({rows:validRows(), columns:["tray_id", "n", "detected_n", "rate"]}), true);
  assert.equal(client.validEvidenceDisplay({rows:[{tray_id:"T1", n:2, detected_n:1}], columns:["tray_id", "n", "detected_n", "rate"]}), false);
});

test("rack labels are derived from the server rows, not a prewritten conclusion", () => {
  const labels = client.rackLabels(validRows());
  assert.deepEqual(labels, ["T1: 1 / 2 = 0.5", "T2: 0 / 3 = 0"]);
  assert.deepEqual(client.rackLabels([{tray_id:"T9", n:4, detected_n:3, rate:0.75}]), ["T9: 3 / 4 = 0.75"]);
});

test("switching steps and disconnecting fence old work", () => {
  const waiting = client.beginRun(client.createState(), "r1", "group");
  assert.equal(client.cancelRun(waiting).outstandingRequestId, null);
  assert.equal(client.disconnect(waiting).connection, "offline");
});

test("returning to the C2 story invalidates a hidden in-flight move", () => {
  const waiting = client.beginRun(client.createState(), "r1", "group");
  const hidden = client.leaveInvestigation(waiting);
  assert.equal(hidden.outstandingRequestId, null);
  assert.equal(client.applyCaseResult(hidden, validRatesResult({request_id:"r1", step:"group", rows:[], columns:[], pass:true})), hidden);
});

test("the next move is unlocked only by the matching accepted step", () => {
  assert.equal(client.nextStep("group", {step:"group", status:"ok", pass:true}), "counts");
  assert.equal(client.nextStep("counts", {step:"counts", status:"ok", pass:true}), "rates");
  assert.equal(client.nextStep("rates", {step:"rates", status:"ok", pass:true}), "chapter3");
  assert.equal(client.nextStep("group", {step:"rates", status:"ok", pass:true}), null);
  assert.equal(client.nextStep("group", {step:"group", status:"ok", pass:false}), null);
});

test("C2 gives its final accepted move a named Chapter 3 route", () => {
  assert.equal(client.nextChapterUrl("?attempt=c2-reader"), "chapter3.html?attempt=c2-reader");
  assert.equal(client.nextChapterUrl("?attempt=not/valid"), "chapter3.html");
});

test("a newly unlocked move begins empty unless its own draft was saved", () => {
  const storage = memoryStorage();
  assert.equal(client.starterDraft(storage, "counts"), "");
  client.persistDraft(storage, "counts", "groups = groupby(jars, :tray_id)");
  assert.equal(client.starterDraft(storage, "counts"), "groups = groupby(jars, :tray_id)");
});

test("a fresh learner cannot jump into a C2 move whose earlier lines are absent", () => {
  assert.equal(typeof client.canEnterStep, "function");
  const fresh = {accepted:{}};
  assert.equal(client.canEnterStep(fresh, "group"), true);
  assert.equal(client.canEnterStep(fresh, "counts"), false);
  assert.equal(client.canEnterStep(fresh, "rates"), false);

  const afterGroup = {accepted:{group:"groupby(jars, :tray_id)"}};
  assert.equal(client.canEnterStep(afterGroup, "counts"), true);
  assert.equal(client.canEnterStep(afterGroup, "rates"), false);

  const afterCounts = {accepted:{group:"groupby(jars, :tray_id)", counts:"summary = combine(groups, nrow => :n)"}};
  assert.equal(client.canEnterStep(afterCounts, "rates"), true);
  assert.equal(client.canEnterStep(afterCounts, "not-a-step"), false);
});

test("server explanation and raw output stay available without inventing a conclusion", () => {
  assert.match(client.resultText({status:"ok", value_repr:"3", explanation:{julia:"A scalar is not a summary table.", case:"No tray comparison yet."}}), /scalar/);
  assert.match(client.resultText({status:"error", message:"MethodError", value_repr:"bad"}), /MethodError/);
  assert.equal(client.displayError({status:"error", message:"MethodError"}), "MethodError");
});

test("a copied C2 template word gets a direct correction beside its Julia error", () => {
  assert.match(client.c2ErrorNextStep({status:"error", message:"UndefVarError: table not defined"}), /template word/i);
  assert.match(client.c2ErrorNextStep({status:"error", message:"UndefVarError: table not defined"}), /jars.*:tray_id.*nrow.*:detected/i);
  assert.equal(client.c2ErrorNextStep({status:"error", message:"MethodError: no method"}), "");
});

test("the template-word line still fires on the sandbox's plain first line, keyed on Julia's own text", () => {
  // src/sandbox.jl's first line no longer says "doesn't exist"; Julia's "not defined" carries the match.
  for (const word of ["table", "group_column", "count_rows"]) {
    const message = word + " is a name Julia does not know yet. Check the spelling, or define it first.\n\nUndefVarError: `" + word + "` not defined";
    assert.match(client.c2ErrorNextStep({status:"error", message}), /template word/i, word);
  }
});

function validRows() { return [{tray_id:"T1", n:2, detected_n:1, rate:0.5}, {tray_id:"T2", n:3, detected_n:0, rate:0}]; }
function validRatesResult(overrides = {}) { return Object.assign({type:"case_result", chapter:"C2", request_id:"r1", step:"rates", status:"ok", pass:true, rows:validRows(), columns:["tray_id", "n", "detected_n", "rate"]}, overrides); }
function memoryStorage() { const values = new Map(); return {getItem:key => values.has(key) ? values.get(key) : null, setItem:(key, value) => values.set(key, String(value))}; }

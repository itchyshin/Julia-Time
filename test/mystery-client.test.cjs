"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const client = require("../web/mystery.js");

test("chapter navigation preserves a valid attempt without transferring saved evidence", () => {
  assert.equal(typeof client.chapter2Url, "function");
  if (typeof client.chapter2Url !== "function") return;
  assert.equal(client.chapter2Url("?attempt=c1-abc"), "chapter2.html?attempt=c1-abc");
  assert.equal(client.chapter2Url("?attempt=../../bad&code=answer"), "chapter2.html");
  assert.equal(client.chapter2Url(""), "chapter2.html");
});

test("C1 exposes one named Case Board route and a plain-language location", () => {
  assert.equal(typeof client.caseBoardUrl, "function");
  assert.equal(client.caseBoardUrl("?attempt=c1-abc"), "course/index.html?attempt=c1-abc");
  assert.equal(client.caseBoardUrl("?attempt=../../bad"), "course/index.html");
  assert.equal(client.caseLocation("intro"), "Case 1 of 6 · Meet the case");
  assert.equal(client.caseLocation("notebook"), "Case 1 of 6 · Inspect the notebook");
  assert.equal(client.caseLocation("code"), "Case 1 of 6 · Make your move");
  assert.equal(client.caseLocation("result"), "Case 1 of 6 · Inspect your evidence");
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../web/index.html"),"utf8");
  assert.match(html, /id="case-board"/);
  assert.match(html, /Case 1 of 6/);
});

test("case discovery is computed from returned detections, not a scripted count", () => {
  assert.match(client.discoveryText([{detected:true}, {detected:false}]), /1 of 2/);
  assert.match(client.discoveryText([{detected:true}, {detected:true}]), /2 of 2/);
  assert.match(client.discoveryText([{detected:false}]), /0 of 1/);
  assert.equal(client.discoveryText([{detected:"false"}]), "");
  assert.equal(client.discoveryText([]), "");
});

test("new attempts have isolated saves and invalid identifiers cannot select a namespace", () => {
  assert.equal(client.storagePrefix(""), "julia-time:missing-fleas:v1:");
  assert.notEqual(client.storagePrefix("a123"), client.storagePrefix("b123"));
  assert.equal(client.storagePrefix("../../old"), client.storagePrefix(""));
  assert.equal(client.storagePrefix("a123"), "julia-time:missing-fleas:v1:attempt:a123:");
});

test("boolean practice output explains Julia's representation without inventing a result", () => {
  const message = {status:"ok", value_repr:"12-element BitVector:\n 1\n 0"};
  assert.match(client.practiceFeedback('jars.batch_id .== "B08"', message), /1 means true/);
  assert.match(client.practiceFeedback('jars.batch_id .== "B08"', message), /not the selected records/);
  assert.doesNotMatch(client.practiceFeedback("42", {status:"ok", value_repr:"42"}), /1 means true/);
});

test("C1 names the practiced Boolean-row-selection path beside the independent editor without supplying the case expression", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "../web/index.html"), "utf8");
  const editor = html.indexOf('id="editor-heading"');
  const bridge = html.indexOf('id="practice-to-case-bridge"');
  assert.ok(bridge > editor, "the transfer bridge should occur in the independent-editor panel");
  const bridgeCopy = html.slice(bridge, bridge + 700);
  assert.match(bridgeCopy, /The practice used a true-or-false row rule\. Now use that same rule on the case table/);
  assert.match(bridgeCopy, /rows position/i);
  assert.match(bridgeCopy, /all columns/i);
  assert.doesNotMatch(bridgeCopy, /jars\.batch_id\s*\.==\s*case_batch/);
  assert.doesNotMatch(bridgeCopy, /jars\[rows,\s*:\]/);
  assert.doesNotMatch(bridgeCopy, /filter\(row/);
});

test("T3: the direct-entry bridge line names no practice screen the player never saw", () => {
  assert.match(client.bridgeText(true), /the practice/i);
  assert.match(client.bridgeText(true), /rows position/i);
  assert.match(client.bridgeText(true), /all columns/i);
  assert.doesNotMatch(client.bridgeText(false), /the practice/i);
  assert.match(client.bridgeText(false), /rows position/i);
  assert.match(client.bridgeText(false), /all columns/i);
});

test("practice restores lesson and code together and rejects malformed saves", () => {
  assert.deepEqual(client.readPractice('{"lesson":"rule","code":"jars.batch_id"}'), {lesson:"rule",code:"jars.batch_id"});
  assert.deepEqual(client.readPractice('{"lesson":"wrong","code":3}'), {lesson:"rows",code:""});
  assert.deepEqual(client.readPractice('broken'), {lesson:"rows",code:""});
});

test("C1 clears the indexing practice before teaching the separate Boolean-rule exercise", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../web/mystery.js"), "utf8");
  assert.match(source, /Replace the earlier indexing expression with the rule shown above/i);
  assert.match(source, /function showRuleLesson\(\)[\s\S]*?\$\("practice-code"\)\.value = ""/);
});

test("C1 tells the learner that the earlier indexing expression was cleared before the Boolean-rule task", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../web/mystery.js"), "utf8");
  assert.match(source, /function beginRuleLesson\(\)[\s\S]*?earlier indexing expression has been cleared[\s\S]*?Type the Boolean rule shown above from scratch/i);
  assert.match(source, /\$\("practice-next"\)\.addEventListener\("click", beginRuleLesson\)/);
});

test("restored evidence uses current display copy without rewriting saved work", () => {
  const saved = {evidence:{id:"c1"}, rows:[{jar_id:"J-091"}], explanation:{julia:"The taught filter approach", case:"old"}};
  const original = JSON.stringify(saved);
  const display = client.restoredEvidenceDisplay(saved);
  assert.equal(JSON.stringify(saved), original);
  assert.deepEqual(display.rows, saved.rows);
  assert.match(display.explanation.julia, /previous visit/);
  assert.doesNotMatch(display.explanation.julia, /taught filter/);
  assert.match(display.explanation.case, /why/);
});

test("practice explains a missing column selector only for the matching indexing error", () => {
  const error = {status:"error", message:"MethodError: no method matching getindex(::DataFrame, ::UnitRange{Int64})"};
  assert.match(client.practiceFeedback("jars[1:3, ]", error), /columns/);
  assert.match(client.practiceFeedback("jars[1:3, ]", error), /:/);
  assert.doesNotMatch(client.practiceFeedback("jars[1:3, :]", error), /missing column/);
  assert.match(client.practiceFeedback("jars[1:3, ]", {status:"ok"}), /returned/);
});

test("C1 challenge errors name the missing row-rule decision without supplying a case answer", () => {
  const recovery = client.challengeRecovery({
    status: "error",
    pass: false,
    message: "ArgumentError: syntax df[column] is not supported",
  });
  assert.match(recovery, /batch_id column as a vector/i);
  assert.match(recovery, /true-or-false row rule/i);
  assert.match(recovery, /first nudge/i);
  assert.doesNotMatch(recovery, /jars\.batch_id\s*\.==\s*case_batch/);
  assert.equal(client.challengeRecovery({status:"ok", pass:true}), "");
});

test("T4: the R-$ habit and the missing-broadcast-dot error get different first lines, then the shared step", () => {
  const dollarError = client.challengeRecovery({
    status: "error",
    message: "`$` is a name that doesn't exist yet — check the spelling, or define it first.\n\nUndefVarError: `$` not defined",
  });
  const boolError = client.challengeRecovery({
    status: "error",
    message: "Something went wrong running this line.\n\nArgumentError: invalid row index of type Bool",
  });
  assert.notEqual(dollarError, boolError);
  assert.match(dollarError, /\$ does not exist in Julia/);
  assert.match(boolError, /not one per row/);
  // Both still end in the same shared next step, so the recovery reads as one continuous path.
  const shared = "Next step: read the batch_id column as a vector, make a true-or-false row rule from it, then use the first nudge if you need to place that rule in the table. Your draft is unchanged.";
  assert.ok(dollarError.endsWith(shared));
  assert.ok(boolError.endsWith(shared));
});

test("C1 gives a plain accepted-or-not-accepted status after each case run", () => {
  assert.equal(typeof client.runOutcomeStatus, "function");
  assert.equal(client.runOutcomeStatus({status:"ok", pass:true}), "✓ Accepted — evidence saved.");
  assert.match(client.runOutcomeStatus({status:"ok", pass:false}), /Not accepted.*no evidence was saved/i);
  assert.match(client.runOutcomeStatus({status:"timeout", pass:false}), /Not accepted.*timed out/i);
});

test("source highlighting uses returned jar identifiers", () => {
  assert.deepEqual(client.retainedJarIds([{jar_id: "J-091"}, {jar_id: "J-096"}]), ["J-091", "J-096"]);
});

test("saved evidence rejects null rows before rendering", () => {
  assert.equal(client.validEvidenceDisplay({ evidence: { id: "c1-b09-records" }, rows: [null], explanation: null }), false);
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function failingStorage() {
  return { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
}

test("stale case results cannot replace the current run", () => {
  let state = client.beginRun(client.createState(), "new-request");
  state = client.applyCaseResult(state, {
    type: "case_result", chapter: "C1", request_id: "old-request", status: "ok", pass: true,
    evidence: { id: "wrong", title: "Wrong", text: "Wrong" },
  });

  assert.equal(state.outstandingRequestId, "new-request");
  assert.equal(state.evidence, null);
  assert.equal(state.result, null);
});

test("only the evidence display is persisted and can be restored", () => {
  const storage = memoryStorage();
  const evidence = { id: "b09", title: "B09 retained", text: "Three records" };

  const display = { evidence, rows: [["B09", "flea"]], explanation: { julia: "filtered", case: "kept" } };
  assert.equal(client.persistEvidence(storage, display), true);
  assert.deepEqual(client.loadEvidence(storage), display);
  assert.equal(client.persistCode(storage, "records[records.batch .== \"B09\", :]"), true);
  assert.equal(client.loadCode(storage), "records[records.batch .== \"B09\", :]");
});

test("a failed run never creates evidence", () => {
  let state = client.beginRun(client.createState(), "request-1");
  state = client.applyCaseResult(state, {
    type: "case_result", chapter: "C1", request_id: "request-1", status: "ok", pass: false,
    message: "That kept an unrelated batch.",
    evidence: { id: "fabricated", title: "No", text: "Never show me" },
  });

  assert.equal(state.outstandingRequestId, null);
  assert.equal(state.evidence, null);
  assert.equal(state.result.pass, false);
});

test("disconnect invalidates an outstanding request", () => {
  const state = client.disconnect(client.beginRun(client.createState(), "request-1"));
  assert.equal(state.connection, "offline");
  assert.equal(state.outstandingRequestId, null);
});

test("wrong chapter or missing request identity cannot settle a run", () => {
  const waiting = client.beginRun(client.createState(), "request-1");
  const wrongChapter = client.applyCaseResult(waiting, { type: "case_result", chapter: "C2", request_id: "request-1", pass: true, status: "ok" });
  const noIdentity = client.applyCaseResult(waiting, { type: "case_result", chapter: "C1", request_id: null, pass: true, status: "ok" });
  assert.equal(wrongChapter, waiting);
  assert.equal(noIdentity, waiting);
});

test("an old WebSocket callback is fenced from the active connection", () => {
  const oldSocket = {};
  const currentSocket = {};
  assert.equal(client.isCurrentSocket(currentSocket, oldSocket), false);
  assert.equal(client.isCurrentSocket(currentSocket, currentSocket), true);
});

test("editing or resetting code invalidates the run it was sent with", () => {
  const waiting = client.beginRun(client.createState(), "request-1");
  const changed = client.cancelRun(waiting);
  assert.equal(changed.outstandingRequestId, null);
  assert.equal(client.applyCaseResult(changed, { type: "case_result", chapter: "C1", request_id: "request-1", status: "ok", pass: true }), changed);
});

test("malformed saved evidence and storage failures degrade without a crash", () => {
  const malformed = { evidence: { title: "Missing rows" } };
  const storage = memoryStorage();
  storage.setItem(client.EVIDENCE_KEY, JSON.stringify(malformed));
  assert.equal(client.loadEvidence(storage), null);
  assert.equal(client.loadEvidence(failingStorage()), null);
  assert.equal(client.persistCode(failingStorage(), "jars"), false);
});

test("typed server cells use their safe display label", () => {
  assert.equal(client.displayCell({ type: "Rational", display: "1//3" }), "1//3 (Rational)");
  assert.equal(client.displayCell("B09"), "B09");
});
test('hint controls warn before revealing the complete solution', () => {
  assert.equal(client.hintButtonLabel(0, 3), 'Show a first nudge');
  assert.equal(client.hintButtonLabel(1, 3), 'Show the code shape');
  assert.equal(client.hintButtonLabel(2, 3), 'Show the complete Julia line');
  assert.equal(client.hintButtonLabel(3, 3), 'All help shown');
});

test('guided navigation has one next move and cannot award evidence', () => {
  assert.equal(client.nextStage('intro'), 'notebook');
  assert.equal(client.nextStage('notebook'), 'code');
  assert.equal(client.nextStage('code'), 'code');
  assert.equal(client.previousStage('result'), 'code');
  assert.equal(client.previousStage('code'), 'notebook');
  assert.equal(client.previousStage('notebook'), 'intro');
});

test('the Chapter 1 notebook remains visible beside the first independent Julia move', () => {
  const script = require("node:fs").readFileSync(require("node:path").join(__dirname, "../web/mystery.js"), "utf8");
  assert.match(script, /data-panel"\)\.hidden = stage !== "notebook" && stage !== "code"/);
});

test('saved guided stage validates values and requires saved evidence for result', () => {
  assert.equal(client.restoreStage('code', false), 'code');
  assert.equal(client.restoreStage('result', false), 'code');
  assert.equal(client.restoreStage('result', true), 'result');
  assert.equal(client.restoreStage('unknown', true), 'intro');
  assert.equal(client.restoreStage('practice', false), 'practice');
});

test('practice results never award case evidence even if their values match', () => {
  const state = client.beginRun(client.createState(), 'practice-1', 'practice');
  const settled = client.applyCaseResult(state, {type:'case_result', chapter:'C1', request_id:'practice-1', status:'ok', pass:true, evidence:{id:'case-card'}});
  assert.equal(settled.evidence, null);
  assert.equal(settled.outstandingRequestId, null);
});

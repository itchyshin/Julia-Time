"use strict";

// Re-test issue C1/select-records (2026-09-24): a learner who copied the practice batch
// (jars[jars.batch_id .== "B08", :]) or the glossary shape jars[1:6, :] into the case editor got
// only the generic "wrong value, type, or duplicate multiplicity" line, which never names the
// value that was off. The lead below is keyed on the rows Julia actually returned, never on the
// code. Every reply here is what JuliaTime.handle_message returned on 2026-09-24 (Julia 1.10.0):
// CASE_ROWS is the case_info table, and each reply's rows are exactly the case rows at the listed
// positions (checked against the capture), so they are written as slices of CASE_ROWS.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const client = require("../web/mystery.js");

const CASE_ROWS = [
  {batch_id:"B08", detected:true, jar_id:"J-081", tray_id:"T-A"},
  {batch_id:"B08", detected:false, jar_id:"J-082", tray_id:"T-A"},
  {batch_id:"B08", detected:false, jar_id:"J-083", tray_id:"T-B"},
  {batch_id:"B08", detected:false, jar_id:"J-084", tray_id:"T-B"},
  {batch_id:"B08", detected:true, jar_id:"J-085", tray_id:"T-C"},
  {batch_id:"B08", detected:false, jar_id:"J-086", tray_id:"T-C"},
  {batch_id:"B09", detected:true, jar_id:"J-091", tray_id:"T-A"},
  {batch_id:"B09", detected:true, jar_id:"J-092", tray_id:"T-A"},
  {batch_id:"B09", detected:true, jar_id:"J-093", tray_id:"T-B"},
  {batch_id:"B09", detected:true, jar_id:"J-094", tray_id:"T-B"},
  {batch_id:"B09", detected:true, jar_id:"J-095", tray_id:"T-C"},
  {batch_id:"B09", detected:false, jar_id:"J-096", tray_id:"T-C"},
];
const INFO = {case_batch:"B09", worked_example:{batch_id:"B08"}, rows:CASE_ROWS};
const COLUMNS = ["jar_id", "batch_id", "tray_id", "detected"];
const WRONG = "At least one returned record has the wrong value, type, or duplicate multiplicity.";
const at = (positions) => positions.map(index => CASE_ROWS[index]);
const reply = (positions, feedback, extra = {}) => Object.assign({type:"case_result", chapter:"C1", status:"ok", pass:false, message:"", columns:COLUMNS, rows:at(positions), feedback}, extra);

const REPLIES = {
  // jars[jars.batch_id .== "B08", :]
  practiceRule: reply([0, 1, 2, 3, 4, 5], WRONG),
  // jars[1:6, :], the glossary shape
  glossarySix: reply([0, 1, 2, 3, 4, 5], WRONG),
  // jars[1:3, :]
  glossaryThree: reply([0, 1, 2], "The report needs all 6 B09 records exactly once; got 3 rows."),
  // jars[jars.batch_id .== "B08", [:jar_id, :batch_id]]
  practiceTwoColumns: reply([0, 1, 2, 3, 4, 5], "Return exactly these columns: jar_id, batch_id, tray_id, detected.",
    {columns:["jar_id", "batch_id"], rows:at([0, 1, 2, 3, 4, 5]).map(row => ({batch_id:row.batch_id, jar_id:row.jar_id}))}),
  // jars[4:9, :]
  sliceFourNine: reply([3, 4, 5, 6, 7, 8], WRONG),
  // jars[5:10, :]
  sliceFiveTen: reply([4, 5, 6, 7, 8, 9], WRONG),
  // jars[7:12, :] is accepted by the checker.
  sliceSevenTwelve: reply([6, 7, 8, 9, 10, 11], "All six B09 records are present exactly once.", {pass:true}),
  // jars and jars[:, :]
  whole: reply([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], "The report needs all 6 B09 records exactly once; got 12 rows."),
  // jars[jars.tray_id .== "T-A", :]
  trayRule: reply([0, 1, 6, 7], "The report needs all 6 B09 records exactly once; got 4 rows."),
  // jars[[1, 2, 7, 8, 9, 10], :]
  pickedRows: reply([0, 1, 6, 7, 8, 9], WRONG),
  // view(jars, jars.batch_id .== "B08", :)
  subTable: reply([], "Return a DataFrame of jar records; the case board cannot check a scalar or vector.", {columns:[]}),
};

test("every returned row from the practice batch gets a lead naming B08 and case_batch", () => {
  const lead = client.returnedRowsLead(REPLIES.practiceRule, INFO);
  assert.match(lead, /B08/);
  assert.match(lead, /practice batch/);
  assert.match(lead, /case_batch/);
  assert.match(lead, /B09/);
  // Keyed on the rows, not the code: the glossary shape returns the same six B08 rows and gets the
  // same lead, as do the shorter look-first slice and a B08 selection with too few columns.
  assert.equal(client.returnedRowsLead(REPLIES.glossarySix, INFO), lead);
  assert.equal(client.returnedRowsLead(REPLIES.glossaryThree, INFO), lead);
  assert.equal(client.returnedRowsLead(REPLIES.practiceTwoColumns, INFO), lead);
});

test("a run of table rows that mixes batches gets a lead about choosing rows by the batch label", () => {
  const lead = client.returnedRowsLead(REPLIES.sliceFourNine, INFO);
  assert.match(lead, /rows 4 to 9/);
  assert.match(lead, /B08 and B09/);
  assert.match(lead, /batch label/);
  assert.match(lead, /not by where they sit/);
  assert.match(lead, /case_batch/);
  assert.match(client.returnedRowsLead(REPLIES.sliceFiveTen, INFO), /rows 5 to 10/);
});

test("other returned values keep only the existing feedback", () => {
  for (const name of ["sliceSevenTwelve", "whole", "trayRule", "pickedRows", "subTable"]) {
    assert.equal(client.returnedRowsLead(REPLIES[name], INFO), "", name);
  }
  // Rows without a batch_id column say nothing about the batch.
  const noBatch = reply([0, 1, 2, 3, 4, 5], "Return exactly these columns: jar_id, batch_id, tray_id, detected.",
    {columns:["jar_id"], rows:at([0, 1, 2, 3, 4, 5]).map(row => ({jar_id:row.jar_id}))});
  assert.equal(client.returnedRowsLead(noBatch, INFO), "");
  // Errors and timeouts keep their own recovery copy.
  assert.equal(client.returnedRowsLead({status:"error", pass:false, rows:[], message:"UndefVarError: `x` not defined"}, INFO), "");
  assert.equal(client.returnedRowsLead({type:"case_result", status:"timeout", pass:false, feedback:"This check took too long."}, INFO), "");
  assert.equal(client.returnedRowsLead(REPLIES.practiceRule, null), "");
});

test("the new leads use plain words, no em dash, and never give the case answer", () => {
  for (const lead of [client.returnedRowsLead(REPLIES.practiceRule, INFO), client.returnedRowsLead(REPLIES.sliceFourNine, INFO)]) {
    assert.ok(lead.length > 0);
    assert.doesNotMatch(lead, /—/);
    assert.doesNotMatch(lead, /\.==/);
    assert.doesNotMatch(lead, /jars\[/);
  }
});

test("the result panel shows the lead in front of the server's feedback line", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "web", "mystery.js"), "utf8");
  const render = source.slice(source.indexOf("function renderResult("), source.indexOf("function focusResult("));
  const lead = render.indexOf("returnedRowsLead(result, caseInfo)");
  const feedback = render.indexOf('"feedback", result.feedback');
  assert.ok(lead > 0, "renderResult asks for the returned-rows lead");
  assert.ok(feedback > lead, "the lead sits in front of the existing feedback");
});

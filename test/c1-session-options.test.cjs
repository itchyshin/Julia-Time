"use strict";

// Round-3 screen-bots (2026-09-25): Chapter 1 showed "New attempt or saved work" in a brand-new browser right
// after the Case Board said nothing was saved ("did I already play this?"), and "Return to original saved
// investigation" did nothing outside an attempt (it reloaded the same page). The section appears only when it
// means something; the return link only inside an attempt.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c1 = require("../web/mystery.js");

test("attempt controls follow what this browser actually has", () => {
  assert.deepEqual(c1.sessionOptions(false, ""), {section:false, newAttempt:false, returnLink:false});
  assert.deepEqual(c1.sessionOptions(true, ""), {section:true, newAttempt:true, returnLink:false});
  assert.deepEqual(c1.sessionOptions(false, "field-7"), {section:true, newAttempt:true, returnLink:true});
  assert.deepEqual(c1.sessionOptions(true, "field-7"), {section:true, newAttempt:true, returnLink:true});
  assert.deepEqual(c1.sessionOptions(false, "../bad"), {section:false, newAttempt:false, returnLink:false}, "an invalid attempt id is no attempt");
});

test("the section starts hidden and is wired to sessionOptions", () => {
  const html = fs.readFileSync(path.join(__dirname, "../web/index.html"), "utf8");
  assert.match(html, /<details id="session-options" class="session-options" hidden>/);
  const js = fs.readFileSync(path.join(__dirname, "../web/mystery.js"), "utf8");
  assert.match(js, /sessionOptions\(/);
});

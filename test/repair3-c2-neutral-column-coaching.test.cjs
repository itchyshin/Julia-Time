"use strict";
// Review note on repair2/c2 (2026-09-24): `summary.rate = detected_n ./ n` (no $ typed) and
// `summary.rate = summary$detected_n ./ summary$n` both end in the same UndefVarError, so the coaching
// cannot know whether `$` was typed. It must not blame R's `$`; it names the dotted form instead.
const test = require("node:test");
const assert = require("node:assert/strict");
const c2 = require("../web/chapter2.js");

for (const name of ["detected_n", "n"]) {
  test(`rates coaching for an unknown ${name} names the dotted form without blaming R's $`, () => {
    const message = { status: "error", step: "rates", message: `Something went wrong running this line.\n\nUndefVarError: \`${name}\` not defined` };
    const line = c2.c2ErrorNextStep(message);
    assert.match(line, new RegExp(`summary\\.${name}\\b`), "names the dotted column form");
    assert.doesNotMatch(line, /\$/, "the error text cannot show that $ was typed, so the line must not mention it");
  });
}

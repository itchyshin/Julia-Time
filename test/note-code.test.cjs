// A note reads as code only when the whole note is code. A note that marks code with backticks, or that has a
// sentence in it, is prose with inline code (round 3 review: l5-r2-c2's Python note showed as one code block).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { noteIsCode } = require("../web/lesson.js");

test("whole-code notes stay code", () => {
  for (const t of ["df$col", "filter(df, x == 1)", "x <- c(1, 2)", "df |> head()"]) assert.equal(noteIsCode(t), true, t);
});

test("prose with inline code is never one code block", () => {
  assert.equal(noteIsCode("`np.array(pretend_counts) >= 4` works on every item with no dot. A plain Python list fails there. Julia needs the dot for any list: .>="), false);
  assert.equal(noteIsCode("Same in R: sum(x) counts the TRUEs. Julia: sum(x)"), false);
});

test("no note with backticks in any lesson file renders as a code block", () => {
  const dir = path.join(__dirname, "..", "lessons");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const walk = (o) => {
      if (!o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o)) {
        if ((k === "r_note" || k === "py_note") && typeof v === "string" && v.includes("`")) assert.equal(noteIsCode(v), false, f + ": " + v);
        else walk(v);
      }
    };
    walk(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
});

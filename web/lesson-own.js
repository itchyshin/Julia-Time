/* Julia Time: "Your own data" helpers (lesson kind "own"). Pure functions, no DOM, so Node tests can run them.
   The table check comes from the server (own_data_info); this file only decides which columns fill the three
   names in the lesson's steps, fills them, and builds the script the learner can save. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeLessonOwn = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const MAX_BYTES = 5 * 1024 * 1024;
  const TOKENS = { any_col: "any", num_col: "num", y_col: "y", group_col: "group" };
  const TOO_BIG = "That file is bigger than 5 MB, so the game will not read it. Try a smaller file, or the starter table.";
  const SAVE_NAME = "my-analysis.jl";

  const isNumber = (t) => /int|float|real|number|numeric|decimal/i.test(String(t || "")) && !/string|char|text/i.test(String(t || ""));
  const isText = (t) => /string|text|char|symbol|categor/i.test(String(t || ""));

  const distinctOf = (c) => (c && c.distinct !== null && c.distinct !== undefined && Number.isFinite(Number(c.distinct)) ? Number(c.distinct) : null);
  const splits = (c) => { const d = distinctOf(c); return d !== null && d >= 2 && d <= 12; };
  const colsOf = (columns) => (Array.isArray(columns) ? columns : []).filter((c) => c && typeof c.name === "string");

  // A count: whole numbers of 0 or more. The table check gives the type and up to three example values to go on.
  // The server sends plain type words ("whole number", "number", "text"); Julia type names are accepted too.
  const countLike = (c) => !!c && /^(?:whole number$|(?:Union\{Missing,\s*)?U?Int)/.test(String(c.type || "")) &&
    (!Array.isArray(c.examples) || c.examples.every((e) => { const n = Number(String(e)); return Number.isInteger(n) && n >= 0; }));
  // Which column fills each name. any: the first column. num: a number column WITH missing cells when one exists (the one with
  // the most; the missing-value steps then have something to show), else the first number column. x: the first number column
  // that is not num, or none. group: the first text column with 2 to 12 distinct values; else the first column of any type with 2 to 12; else none
  // (when the server gave no distinct counts at all, the first text column).
  function pickColumns(columns) {
    const cols = colsOf(columns);
    const out = { any: cols.length ? cols[0].name : "", num: "", y: "", group: "" };
    const nums = cols.filter((c) => isNumber(c.type));
    let most = 0;
    nums.forEach((c) => { const m = Number(c.missing) || 0; if (m > most) { most = m; out.num = c.name; } });
    if (!out.num && nums.length) out.num = nums[0].name;
    // y, the number to explain: a different number column, a count with no missing cells first, then any count, then any.
    const others = nums.filter((c) => c.name !== out.num);
    // Counts first (gaps are fine: glm drops those rows), and not a name that looks like a percentage, temperature, date or id.
    const badName = (c) => /pct|percent|prop|temp|year|month|day|date|(?:^|[^a-z])id(?:$|[^a-z])/i.test(c.name);
    const y = others.find((c) => countLike(c) && !badName(c)) || others.find(countLike) || others[0];
    if (y) out.y = y.name;
    const texts = cols.filter((c) => isText(c.type));
    const ranged = texts.find(splits) || cols.find(splits);
    if (ranged) out.group = ranged.name;
    else if (!cols.some((c) => distinctOf(c) !== null) && texts.length) out.group = texts[0].name;
    return out;
  }

  // The names a pick may take, for the three selects.
  function pickOptions(columns) {
    const cols = colsOf(columns);
    return { any: cols.map((c) => c.name), num: cols.filter((c) => isNumber(c.type)).map((c) => c.name), y: cols.filter((c) => isNumber(c.type)).map((c) => c.name),
      group: cols.filter((c) => splits(c) || (distinctOf(c) === null && isText(c.type))).map((c) => c.name) };
  }

  // Keep a saved pick only if that column is still in the table.
  function settlePicks(saved, columns) {
    const base = pickColumns(columns), names = pickOptions(columns);
    const out = {};
    Object.keys(base).forEach((k) => { out[k] = saved && names[k].indexOf(saved[k]) >= 0 ? saved[k] : base[k]; });
    // y is the number to explain: never the same column as num.
    if (out.y && out.y === out.num) out.y = names.y.find((n) => n !== out.num) || "";
    return out;
  }

  const usesToken = (text, token) => String(text || "").indexOf("{" + token + "}") >= 0;
  const PLAIN = /^[\p{L}_][\p{L}\p{N}_!]*$/u;
  const quoteJulia = (t) => String(t).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$");
  const PLACEHOLDER = '"a value from this column"';
  // Fill one text. data.{x} becomes data.x for a plain name and data[!, "x"] for any other; :{x} becomes :x or "x".
  function fillString(text, picks, first, columns) {
    const names = { any_col: picks.any || first, num_col: picks.num || picks.any || first, y_col: picks.y || picks.num || picks.any || first, group_col: picks.group || picks.any || first };
    let out = String(text);
    // A model formula: plain names stay inside @formula(...). If any name is not plain, the whole formula is written
    // Term(Symbol("y")) ~ Term(Symbol("x")), with no @formula (a name like Sepal.Length cannot be typed in @formula).
    out = out.replace(/@formula\(([^()]*)\)/g, (all, body) => {
      const toks = [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((t) => names[t] !== undefined);
      if (!toks.length || toks.every((t) => PLAIN.test(names[t]))) return all;
      const term = (side) => { const m = /^\s*\{(\w+)\}\s*$/.exec(side); return m && names[m[1]] !== undefined ? 'Term(Symbol("' + quoteJulia(names[m[1]]) + '"))' : side.trim(); };
      return body.split("~").map(term).join(" ~ ");
    });
    Object.keys(names).forEach((tok) => {
      const n = names[tok];
      if (!PLAIN.test(n)) out = out.split("data.{" + tok + "}").join('data[!, "' + quoteJulia(n) + '"]').split(":{" + tok + "}").join('"' + quoteJulia(n) + '"');
      out = out.split("{" + tok + "}").join(n);
    });
    if (out.indexOf("{group_value}") >= 0) {
      const g = colsOf(columns).find((c) => c.name === picks.group);
      const ex = g && Array.isArray(g.examples) && g.examples.length ? String(g.examples[0]) : PLACEHOLDER;
      out = out.split("{group_value}").join(ex);
    }
    return out;
  }
  // A step that needs a number or a group column the table does not have says so, in its own prompt.
  const NO_Y_LINE = "Fitting a line needs two columns of numbers, and your table has fewer than two columns of numbers, so there is nothing to fit here. Read on, or choose another table.";
  const NO_Y_STARTER = "# Your table has fewer than two columns of numbers, so there is nothing to fit.";
  const NEED_TABLE = "Read a table in step 3 first.";
  const NEED_TABLE_STARTER = "# Read a table in step 3 first.";
  const NO_COUNTS = "No column in this table holds counts, so the Poisson step does not apply here. Skip it.";
  const NOT_COUNT = (n) => n + " is not a count, so a Poisson model does not fit it. Pick a count column as y.";
  function missingNote(ch, picks) {
    const text = JSON.stringify(ch);
    const notes = [];
    if (usesToken(text, "num_col") && !picks.num) notes.push("Your table has no column of numbers, so this step uses " + (picks.any || "the first column") + " instead. It works best with a number column.");
    if (usesToken(text, "group_col") && !picks.group) notes.push("Your table has no column to split by (one with 2 to 12 different values), so this step uses " + (picks.any || "the first column") + " instead. It works best with such a column.");
    return notes.join(" ");
  }
  function fillDeep(v, picks, first, columns) {
    if (typeof v === "string") return fillString(v, picks, first, columns);
    if (Array.isArray(v)) return v.map((x) => fillDeep(x, picks, first, columns));
    if (v && typeof v === "object") { const o = {}; Object.keys(v).forEach((k) => { o[k] = fillDeep(v[k], picks, first, columns); }); return o; }
    return v;
  }
  // A copy of the lesson with every {any_col} {num_col} {group_col} {group_value} filled, in starters, prompts, feedback examples and notes.
  function fillLesson(lesson, picks, columns) {
    const first = columns && columns[0] ? columns[0].name : "";
    const copy = JSON.parse(JSON.stringify(lesson));
    (copy.rounds || []).forEach((round) => {
      round.challenges = (round.challenges || []).map((ch) => {
        // A model step with no second number column shows one plain line and a comment, not a broken formula.
        if (usesToken(JSON.stringify(ch), "y_col") && !picks.y) {
          const o = fillDeep(ch, picks, first, columns);
          o.prompt = NO_Y_LINE; o.starter = NO_Y_STARTER;
          return o;
        }
        // A Poisson step needs a count as y.
        if (usesToken(JSON.stringify(ch), "y_col") && /Poisson/.test(String(ch.starter || ""))) {
          const yc = colsOf(columns).find((c) => c.name === picks.y);
          if (!countLike(yc)) {
            const o = fillDeep(ch, picks, first, columns);
            const line = colsOf(columns).some((c) => isNumber(c.type) && countLike(c)) ? NOT_COUNT(picks.y) : NO_COUNTS;
            o.prompt = line; o.starter = "# " + line;
            return o;
          }
        }
        const note = missingNote(ch, picks);
        const out = fillDeep(ch, picks, first, columns);
        if (note && typeof out.prompt === "string") out.prompt += " " + note;
        return out;
      });
    });
    return copy;
  }

  // The lesson before any table is held: a step that names a column says to read a table first, and shows no raw name.
  function blankLesson(lesson) {
    const copy = JSON.parse(JSON.stringify(lesson));
    (copy.rounds || []).forEach((round) => {
      round.challenges = (round.challenges || []).map((ch) => {
        // Every play step that needs the table (all but the "table": "none" steps), named columns or not (step 4's size(data) too).
        if (ch.kind !== "play" || ch.table === "none") return ch;
        const out = Object.assign({}, ch, { prompt: NEED_TABLE, starter: NEED_TABLE_STARTER, need_table: true });
        ["r_note", "py_note", "feedback"].forEach((k) => { delete out[k]; });
        return out;
      });
    });
    return copy;
  }

  // Split a run of lines into statements: a statement ends when every bracket and quote opened in it is closed.
  // Each statement also says whether it is an assignment (a top-level = that is not ==, >=, <=, !=, =>).
  function statements(code) {
    const out = [];
    let cur = [], depth = 0, inStr = false, assign = false;
    String(code).split("\n").forEach((line) => {
      if (!cur.length && !line.trim()) { out.push({ text: line, plain: true }); return; }
      cur.push(line);
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inStr) { if (ch === "\\") i++; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true;
        else if (ch === "#") break;
        else if ("([{".includes(ch)) depth++;
        else if (")]}".includes(ch)) depth--;
        else if (ch === "=" && depth === 0) {
          const prev = line[i - 1] || "", next = line[i + 1] || "";
          if (next === "=" || next === ">") { if (next === "=") i++; continue; }
          if (prev === "!" || prev === "<" || prev === ">") continue;
          assign = true;
        }
      }
      if (depth <= 0 && !inStr) {
        const text = cur.join("\n");
        const plain = assign || /^\s*(#|using\b|import\b)/.test(text);
        out.push({ text, plain });
        cur = []; depth = 0; assign = false;
      }
    });
    if (cur.length) out.push({ text: cur.join("\n"), plain: true });
    return out;
  }
  // A line that gives a value is shown with display(), because a script prints nothing by itself (the game shows the last value).
  function showResults(code) {
    const text = String(code).replace(/\s+$/, "");
    if (/^\s*(for|while|if|function|begin|let|struct|try|do)\b|\bend\s*$/m.test(text)) return text;   // a block: leave it as typed
    return statements(text).map((st) => (st.plain || !st.text.trim() ? st.text : "display(" + st.text.trim() + ")")).join("\n");
  }
  // The script the learner can keep: header (GLM too when a model ran), the exact line that read the file (the game's read_line,
  // typed or from the button), the lines that ran, then their sentence as comments. Without a read_line, the file name alone.
  function buildScript(readLine, lines, sentence, glm, fileName) {
    // The script lives beside the data file: the read line keeps every keyword but loses its folder.
    const bare = String(readLine || "").trim().replace(/CSV\.read\(\s*"((?:[^"\\]|\\.)*)"/, (m, p) => 'CSV.read("' + p.split(/[\\/]/).pop() + '"');
    const read = bare || 'data = CSV.read("' + quoteJulia(fileName || "mydata.csv") + '", DataFrame)   # put the file in the folder pwd() shows';
    const parts = ["using CSV, DataFrames, Statistics" + (glm ? ", GLM" : ""), "", read];
    (lines || []).forEach((l) => {
      let text = showResults(l);
      // a fitted model is shown too: an assignment prints nothing in a script
      const models = [...String(l).matchAll(/^\s*([A-Za-z_]\w*)\s*=\s*g?lm\(/gm)].map((m) => m[1]);
      models.forEach((n) => { text += "\ndisplay(" + n + ")"; });
      parts.push("", text);
    });
    const said = String(sentence || "").trim();
    if (said) parts.push("", said.split(/\r?\n/).map((l) => "# " + l).join("\n"));
    return parts.join("\n") + "\n";
  }

  return { MAX_BYTES, TOO_BIG, SAVE_NAME, TOKENS, pickColumns, pickOptions, settlePicks, fillLesson, buildScript, blankLesson, isNumber, isText };
});

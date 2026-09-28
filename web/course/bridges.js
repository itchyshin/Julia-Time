/* Julia Time: "The same step in R and Python" — one shared card of case-real R/Python bridges.
 * This module holds only data plus DOM-building helpers; it never runs R or Python and never
 * invents a result (see AGENTS.md rule 3). Each entry's r/python line is hand-checked against
 * this case's real fixture with Rscript (dplyr) and python3 (pandas); test/bridge-parity.test.cjs
 * re-checks all ten lines against the live Julia reference on every run.
 * Names match docs/design/05-story-bible.md v2: tray_counts/tally_sheet (was report/handling_log),
 * notebook_detected/sheet_detected/entry_status (was reported_detected_n/logged_detected_n/log_status),
 * counts (was summary), stories (was candidate_models). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeBridges = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Keys match course-state.js's KNOWN_MOVES keys exactly ("C1/select-records", "C2/group", ...).
  const BRIDGES = Object.freeze({
    "C1/select-records": Object.freeze({
      lead: "The one thing that trips up R users: jars[rule, ] with an empty columns position works in R, but Julia needs : there: jars[rule, :].",
      r: "dplyr::filter(jars, batch_id == case_batch)",
      python: "jars.loc[jars[\"batch_id\"] == case_batch]",
      differences: Object.freeze([
        "The dot in .== compares jars.batch_id with case_batch for every row; R and pandas already compare whole columns, so they write == without a dot.",
        "jars.batch_id is R's jars$batch_id and pandas' jars[\"batch_id\"]."
      ])
    }),
    "C2/group": Object.freeze({
      lead: "The one thing that trips up R users: the column needs a colon, :tray_id. Bare tray_id, as in dplyr, is a name Julia does not know.",
      r: "dplyr::group_by(jars, tray_id)",
      python: "jars.groupby(\"tray_id\")",
      differences: Object.freeze([
        "groupby(jars, :tray_id) is dplyr's group_by(jars, tray_id) and pandas' jars.groupby(\"tray_id\").",
        "None of the three change or drop a row by grouping alone: grouping only labels rows for the next summary step."
      ])
    }),
    "C2/counts": Object.freeze({
      lead: "The one thing that trips up R users: the new column's name comes last, nrow => :n. In dplyr and in pandas' .agg(n=...) it comes first: n = n().",
      r: "dplyr::summarise(dplyr::group_by(jars, tray_id), n = dplyr::n(), detected_n = sum(detected))",
      python: "jars.groupby(\"tray_id\", as_index=False).agg(n=(\"detected\", \"size\"), detected_n=(\"detected\", \"sum\"))",
      differences: Object.freeze([
        "Julia's sum on a true-or-false column counts true values exactly as R and pandas do: true contributes 1, false contributes 0.",
        "combine needs the grouped result from groupby first, the same order dplyr's summarise and pandas' agg use after their own group_by/groupby."
      ])
    }),
    "C2/rates": Object.freeze({
      lead: "The one thing that trips up R users: without the dot, counts.detected_n / counts.n on its own gives a 3 by 3 table of numbers, not one rate per tray, so storing it as counts.rate stops with an error. Always write ./ to divide column by column.",
      r: "dplyr::summarise(dplyr::group_by(jars, tray_id), n = dplyr::n(), detected_n = sum(detected), rate = detected_n / n)",
      python: "jars.groupby(\"tray_id\", as_index=False).agg(n=(\"detected\", \"size\"), detected_n=(\"detected\", \"sum\")).assign(rate=lambda x: x.detected_n / x.n)",
      differences: Object.freeze([
        "counts.detected_n ./ counts.n divides tray by tray, one at a time; dplyr and pandas divide two whole columns directly with a plain /.",
        "counts.rate = ... adds a column in place, the same idea as dplyr::mutate or pandas' assign / df[\"rate\"] = ...."
      ])
    }),
    "C3/join-report-log": Object.freeze({
      lead: "The one thing that trips up R users: Julia names the key with on =, not by =. Julia usually writes on = :tray_id, a Symbol (a column name with a colon in front); a quoted string, on = \"tray_id\", also works.",
      r: "dplyr::left_join(tray_counts, tally_sheet, by = \"tray_id\")",
      python: "tray_counts.merge(tally_sheet, on=\"tray_id\", how=\"left\")",
      differences: Object.freeze([
        "leftjoin(tray_counts, tally_sheet, on=:tray_id) is dplyr's left_join(tray_counts, tally_sheet, by = \"tray_id\") and pandas' tray_counts.merge(tally_sheet, on=\"tray_id\", how=\"left\").",
        "All three keep every row of the left table (tray_counts) and add the matching tally_sheet columns."
      ])
    }),
    "C3/filter-disagreement": Object.freeze({
      lead: "The one thing that trips up R users: a blank. If T-C's box were NA, dplyr's filter would drop it silently; Julia's missing value stops with an error. See \"How each language stores a blank\" below.",
      r: "dplyr::filter(joined, notebook_detected != sheet_detected)",
      python: "joined.loc[joined[\"notebook_detected\"] != joined[\"sheet_detected\"]]",
      differences: Object.freeze([
        "joined.notebook_detected is R's joined$notebook_detected and pandas' joined[\"notebook_detected\"].",
        "The dot: .!= compares row by row; a plain != compares the two whole columns and gives one answer."
      ])
    }),
    "C4/plan-distinct-recheck": Object.freeze({
      rLabel: "R (base R)", pythonLabel: "Python (pandas + random)",
      lead: "The one thing that trips up R users: R's sample() never repeats by default, and neither does Python's random.sample; Julia's sample repeats unless you say replace=false. Forget it, and the same jar can be planned twice.",
      r: "sample(eligible$jar_id, 3)",
      python: "import random\nrandom.sample(list(eligible[\"jar_id\"]), 3)",
      differences: Object.freeze([
        "eligible.jar_id is R's eligible$jar_id and pandas' eligible[\"jar_id\"].",
        "Julia counts rows and positions from 1, like R; pandas' own positional indexing (.iloc) counts from 0. Sampling three IDs is unaffected either way."
      ])
    }),
    "C5/event-mask": Object.freeze({
      rLabel: "R (base R)", pythonLabel: "Python (NumPy)",
      lead: "The one thing that trips up R users: the dot. sim_counts >= observed_count works in R; Julia needs .>= to compare each round.",
      r: "sim_counts >= observed_count",
      python: "import numpy as np\nnp.asarray(sim_counts) >= observed_count",
      differences: Object.freeze([
        "Plain Python lists do not compare value by value, so the line needs NumPy's asarray first; R has no such extra step because its vectors already work this way.",
        "All three return one true-or-false value per round, in sim_counts's own order."
      ])
    }),
    "C5/event-frequency": Object.freeze({
      rLabel: "R (base R)", pythonLabel: "Python (NumPy)",
      lead: "The one thing that trips up R users: mean(events) works here because the game loads Statistics for you. In your own Julia, run using Statistics first, or mean is not defined. This step writes sum(events) / length(events) so you can see it is matches divided by all rounds.",
      r: "events <- sim_counts >= observed_count\nmean(events)",
      python: "import numpy as np\nevents = np.asarray(sim_counts) >= observed_count\nevents.mean()",
      differences: Object.freeze([
        "sum(events) / length(events) is what R's mean() and numpy's .mean() compute in one step on a true-or-false list.",
        "True counts as 1 and false as 0 in all three, so the share of trues is the same as their average."
      ])
    }),
    "C6/compatible-models": Object.freeze({
      lead: "The one thing that trips up R users: to combine two true-or-false lists, Julia needs .& with a dot. A plain & gives an error; in R, & already works row by row.",
      r: "dplyr::filter(stories, lower <= observed_count, observed_count <= upper)",
      python: "stories.loc[(stories[\"lower\"] <= observed_count) & (observed_count <= stories[\"upper\"])]",
      differences: Object.freeze([
        "stories.lower and stories.upper are R's $ and pandas' [\"...\"] column access.",
        "stories[rows, :] keeps every column, the same default dplyr::filter and pandas' .loc use.",
        "Julia can also chain the two comparisons the way maths does, with a dot on each for columns: stories.lower .<= observed_count .<= stories.upper. R refuses a chain with a syntax error, so in R keep two conditions."
      ])
    })
  });

  // What to load so a pasted line runs in your own Julia (r2 teacher review, 2026-09-27). The game's
  // sandbox loads Random, Distributions, DataFrames and Statistics for you (src/sandbox.jl); sample
  // comes from StatsBase, which Distributions brings with it (checked in Julia 1.10). The tables
  // themselves (jars, eligible, ...) are the game's own, so your Julia needs its own copy of them.
  // r3 bug hunt #4 (2026-09-27): the card shows the learner's own code, so the line must hold for every
  // answer the game accepts: C4's seed!, MersenneTwister and shuffle need Random, and mean needs Statistics.
  const TABLES = "using DataFrames first. The game does this for you, and gives you the tables.";
  const TABLES_MEAN = "using DataFrames, Statistics first (Statistics gives mean). The game does this for you, and gives you the tables.";
  const SETUP = Object.freeze({
    "C1/select-records": TABLES, "C2/group": TABLES, "C2/counts": TABLES, "C2/rates": TABLES,
    "C3/join-report-log": TABLES, "C3/filter-disagreement": TABLES,
    "C4/plan-distinct-recheck": "using Random, Distributions first (Distributions brings sample with it; Random gives seed!, MersenneTwister and shuffle). The game does this for you.",
    "C5/event-mask": "Nothing to load: .>= is plain Julia. The game gives you sim_counts and observed_count.",
    "C5/event-frequency": "using Statistics first if you write mean. The game does this for you.",
    "C6/compatible-models": TABLES
  });
  function setupLine(key, juliaCode) { const rest = SETUP[key] === TABLES && /\bmean\b/.test(juliaCode || "") ? TABLES_MEAN : SETUP[key]; return /^Nothing/.test(rest) ? "In your own Julia: " + rest : "In your own Julia, run " + rest; }

  function knownMove(key) { return Object.prototype.hasOwnProperty.call(BRIDGES, key); }
  function bridgeFor(key) { return knownMove(key) ? BRIDGES[key] : null; }

  // Pure data model for a card: {key, julia, r, python, differences}. Returns null when the move
  // is unknown or the learner's own accepted code is missing — the card must never show a
  // reference answer in place of the learner's code (AGENTS.md: reference answers never enter the
  // learner's editor, and by the same principle they never masquerade as "Your Julia" here).
  function buildCard(key, juliaCode) {
    const bridge = bridgeFor(key);
    if (!bridge || typeof juliaCode !== "string" || !juliaCode.trim()) return null;
    return Object.freeze({
      key: key,
      julia: juliaCode,
      lead: bridge.lead,
      setup: setupLine(key, juliaCode),
      r: bridge.r,
      python: bridge.python,
      // The tools each line really uses (round-4 bot, 2026-09-26): Chapter 4 is base R and the Python standard
      // library, Chapter 5 is base R and NumPy; every other move is dplyr and pandas.
      rLabel: bridge.rLabel || "R (dplyr)",
      pythonLabel: bridge.pythonLabel || "Python (pandas)",
      differences: bridge.differences.slice()
    });
  }

  const CARD_TITLE = "The same step in R and Python";

  // Build (or clear) the card inside `container`. Returns true when a card was rendered. This
  // never touches #code or any other element outside `container`.
  function renderCard(container, key, juliaCode, doc) {
    if (!container) return false;
    const document_ = doc || (typeof document !== "undefined" ? document : null);
    if (!document_) return false;
    const model = buildCard(key, juliaCode);
    container.replaceChildren();
    if (!model) { container.hidden = true; return false; }
    container.hidden = false;
    const heading = document_.createElement("h2");
    heading.textContent = CARD_TITLE;
    const lead = document_.createElement("p");
    lead.className = "bridge-lead";
    lead.textContent = model.lead;
    container.append(heading, lead);
    [["Your Julia", model.julia], [model.rLabel, model.r], [model.pythonLabel, model.python]].forEach(pair => {
      const label = document_.createElement("h3");
      label.textContent = pair[0];
      const code = document_.createElement("pre");
      code.textContent = pair[1];
      container.append(label, code);
      if (pair[0] === "Your Julia") {
        const setup = document_.createElement("p");
        setup.className = "bridge-setup";
        setup.textContent = model.setup;
        container.append(setup);
      }
    });
    const diffHeading = document_.createElement("h3");
    diffHeading.textContent = "Other differences";
    const list = document_.createElement("ul");
    model.differences.forEach(text => {
      const item = document_.createElement("li");
      item.textContent = text;
      list.append(item);
    });
    container.append(diffHeading, list);
    return true;
  }

  return {BRIDGES, CARD_TITLE, knownMove, bridgeFor, buildCard, renderCard};
});

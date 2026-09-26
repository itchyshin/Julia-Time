"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ending = require("../web/course/ending.js");
const script = require("../web/course/ending-script.js");
const courseState = require("../web/course/course-state.js");

// Today's fixture values (docs/design/03-ending.md). The page never writes these itself.
const FACTS = Object.freeze({batch_id:"B09", n_jars:6, n_detected:5,
  trays:[{tray_id:"T-A", detected_n:2}, {tray_id:"T-B", detected_n:2}, {tray_id:"T-C", detected_n:1}],
  disagreement:{tray_id:"T-C", notebook_detected:1, sheet_detected:0, entry_status:"left blank"},
  eligible_jars:["J-091", "J-092", "J-094", "J-096"], recheck_size:3,
  observed_count:5, n_per_simulation:6, n_simulations:1000, matching_events:113,
  models:[{model:"Vanishing", p:0.1, lower:0, upper:2, compatible:false},
          {model:"Coin flip", p:0.5, lower:1, upper:5, compatible:true},
          {model:"Thriving", p:0.8, lower:4, upper:6, compatible:true}]});
const reply = over => Object.assign({type:"case_epilogue", contract_version:1, case_id:"missing-fleas-v1",
  request_id:"r1", data_label:"Simulated teaching case", facts:FACTS}, over || {});
function memoryStorage() {
  const values = new Map();
  return {getItem:key => values.has(key) ? values.get(key) : null, setItem:(key, value) => values.set(key, String(value)), removeItem:key => values.delete(key)};
}
function solve(storage, keys) {
  for (const key of keys) {
    const [chapter, move] = key.split("/");
    courseState.recordHistoricalMoveIfMissing(storage, "", chapter, move);
    courseState.writeEvidenceIfMissing(storage, "", {chapter, move_id:move, title:"Saved result", row_count:1, provenance:"historical-browser"});
  }
}
const ALL = courseState.KNOWN_MOVES.map(move => move.key);

test("epilogueFacts accepts the matching reply and keeps its data label", () => {
  const parsed = ending.epilogueFacts(reply(), "r1");
  assert.deepEqual(parsed.facts, FACTS);
  assert.equal(parsed.dataLabel, "Simulated teaching case");
});

test("epilogueFacts rejects another request, case, version or type, and malformed facts", () => {
  assert.equal(ending.epilogueFacts(reply(), "other"), null);
  assert.equal(ending.epilogueFacts(reply({case_id:"x"}), "r1"), null);
  assert.equal(ending.epilogueFacts(reply({contract_version:2}), "r1"), null);
  assert.equal(ending.epilogueFacts(reply({type:"error"}), "r1"), null);
  assert.equal(ending.epilogueFacts(reply({facts:Object.assign({}, FACTS, {n_detected:9})}), "r1"), null);
  assert.equal(ending.epilogueFacts(reply({facts:Object.assign({}, FACTS, {models:[]})}), "r1"), null);
  assert.equal(ending.epilogueFacts(reply({facts:Object.assign({}, FACTS, {disagreement:null})}), "r1"), null);
  assert.equal(ending.epilogueFacts(null, "r1"), null);
});

test("the gate stays shut until every step of all six chapters is saved, and names what is open", () => {
  const storage = memoryStorage();
  let gate = ending.endingGate(storage, "");
  assert.equal(gate.complete, false);
  assert.equal(gate.line, "The case closes when all six chapters are done. Still to do: Chapters 1, 2, 3, 4, 5 and 6.");
  solve(storage, ALL.filter(key => key !== "C5/event-frequency"));
  gate = ending.endingGate(storage, "");
  assert.equal(gate.complete, false);
  assert.match(gate.line, /Still to do: Chapter 5\.$/);
  solve(storage, ["C5/event-frequency"]);
  gate = ending.endingGate(storage, "");
  assert.equal(gate.complete, true);
  assert.equal(gate.line, "");
  assert.ok(Array.isArray(gate.concepts) && gate.concepts.length > 0);
});

test("six scenes in chapter order, each caption built from the facts", () => {
  const scenes = ending.buildScenes(FACTS, script, {});
  assert.deepEqual(scenes.map(scene => scene.chapter), ["C1", "C2", "C3", "C4", "C5", "C6"]);
  assert.deepEqual(scenes.map(scene => scene.number), [1, 2, 3, 4, 5, 6]);
  assert.equal(scenes[0].caption, "You found the 6 B09 jars in the notebook. 5 of them have fleas.");
  assert.equal(scenes[1].caption, "Jars with fleas, by tray: T-A 2, T-B 2 and T-C 1.");
  assert.equal(scenes[2].caption, "Tray T-C: the notebook counts 1, but the tally sheet shows 0, and its box was left blank.");
  assert.deepEqual(scenes[2].aha, {tray_id:"T-C", reported:1, logged:0, status:"left blank"});
  assert.equal(scenes[3].caption, "You planned a recheck of 3 jars from J-091, J-092, J-094 and J-096. Nobody has looked yet.");
  assert.equal(scenes[4].caption, "5 of 6 jars had fleas. In 1,000 rounds of Toto's coin-flip cards, 5 or more came up 113 times.");
  assert.equal(scenes[5].caption, "Outside its usual range: Vanishing. Still fits: Coin flip and Thriving.");
  for (const scene of scenes) {
    assert.equal(scene.code, null);
    assert.ok(scene.image.startsWith("../assets/"));
    assert.ok(scene.alt.length > 10 && scene.speaker && scene.line && scene.title);
    if (scene.chapter !== "C3") assert.equal(scene.aha, null);
  }
});

test("captions follow whatever the facts say, not today's fixture", () => {
  const other = Object.assign({}, FACTS, {n_jars:8, n_detected:3, matching_events:1,
    models:FACTS.models.map(model => Object.assign({}, model, {compatible:true}))});
  const scenes = ending.buildScenes(other, script, {});
  assert.equal(scenes[0].caption, "You found the 8 B09 jars in the notebook. 3 of them have fleas.");
  assert.match(scenes[4].caption, /came up 1 time\.$/);
  assert.equal(scenes[5].caption, "Every story still fits. Still fits: Vanishing, Coin flip and Thriving.");
});

test("a scene shows the saved code for its chapter's last step, at most eight lines", () => {
  const long = Array.from({length:12}, (_, i) => "x" + i + " = " + i).join("\n");
  const scenes = ending.buildScenes(FACTS, script, {
    "C3/filter-disagreement":"  filter(row -> row.notebook_detected != row.sheet_detected, joined)\n",
    "C2/rates":long, "C2/group":"not shown"});
  assert.equal(scenes[2].code, "filter(row -> row.notebook_detected != row.sheet_detected, joined)");
  assert.equal(scenes[1].code.split("\n").length, 9);
  assert.ok(scenes[1].code.endsWith("…"));
  assert.equal(scenes[0].code, null);
});

test("the finale: honest reveal, the recheck, and credits from the learner's own code", () => {
  const drafts = {"C1/select-records":"jars[jars.batch_id .== case_batch, :]",
    "C2/group":"groupby(b09, :tray_id)",
    "C3/join-report-log":"leftjoin(tray_counts, tally_sheet, on=:tray_id)",
    "C4/plan-distinct-recheck":"sample(eligible.jar_id, 3; replace=false)"};
  const finale = ending.buildFinal(FACTS, script, drafts, ["grouping rows by a label"], "Simulated teaching case");
  assert.equal(finale.stamp, script.final.stamp);
  assert.equal(finale.headline, script.final.headline);
  assert.equal(finale.reveal, "The notebook shows fleas in 5 of 6 B09 jars. Tray T-C's 0 was a box left blank on the tally sheet, not an empty tray. And the Vanishing story almost never gives 5 of 6.");
  assert.equal(finale.stillOpen, "Still open: what the recheck of 3 jars from J-091, J-092, J-094 and J-096 will find.");
  assert.deepEqual(finale.featuring, [".==", "groupby", "leftjoin", "sample"]);
  assert.deepEqual(finale.investigators, ["Itchy", "Toto", "Momo", "Eddie", "and you"]);
  assert.deepEqual(finale.concepts, ["grouping rows by a label"]);
  assert.equal(finale.dataLabel, "Simulated teaching case");
  assert.equal(finale.image, "../assets/lab-cast.png");
  assert.equal(finale.punSpeaker, "Toto");
  assert.equal(finale.punSignOff, "No fleas were lost in the making of this case. Well, one box was.");
});

test("featuring ignores comments and look-alike names", () => {
  assert.deepEqual(ending.featuring({"C1/select-records":"# groupby( is only a comment\nsample_size = 3\nmy_filter = 1"}), []);
  assert.deepEqual(ending.featuring({}), []);
});

test("the player advances, pauses, goes back, skips to the finale and replays", () => {
  let player = ending.createPlayer(6, false);
  assert.deepEqual([player.index, player.playing], [0, true]);
  player = ending.playerStep(player, "tick"); assert.equal(player.index, 1);
  player = ending.playerStep(player, "toggle"); assert.equal(player.playing, false);
  player = ending.playerStep(player, "tick"); assert.equal(player.index, 1);
  player = ending.playerStep(player, "back"); player = ending.playerStep(player, "back"); assert.equal(player.index, 0);
  player = ending.playerStep(player, "skip"); assert.deepEqual([player.index, player.playing], [6, false]);
  player = ending.playerStep(player, "next"); assert.equal(player.index, 6);
  player = ending.playerStep(player, "replay"); assert.deepEqual([player.index, player.playing], [0, true]);
  for (let i = 0; i < 10; i += 1) player = ending.playerStep(player, "tick");
  assert.deepEqual([player.index, player.playing], [6, false]);
  assert.equal(ending.createPlayer(6, true).playing, false);
});

// Chapters 1 and 2 are older pages that keep their code under their own storage names; the movie must
// still show it (2026-09-26 browser play: their scenes had no "Your code" and credits missed groupby).
test("the learner's code comes from every chapter, including the older Chapter 1 and 2 pages", () => {
  const legacy = require("../web/course/legacy-import.js");
  const storage = memoryStorage();
  storage.setItem(legacy.c1CodeKey("demo"), "jars[jars.batch_id .== case_batch, :]");
  storage.setItem(legacy.c2DraftKey("demo", "rates"), "counts = combine(groupby(jars, :tray_id), nrow => :n)");
  courseState.writeChallengeDraft(storage, "demo", "C3", "join-report-log", "leftjoin(tray_counts, tally_sheet, on=:tray_id)");
  const drafts = ending.learnerDrafts(storage, "demo");
  assert.equal(drafts["C1/select-records"], "jars[jars.batch_id .== case_batch, :]");
  assert.equal(drafts["C2/rates"], "counts = combine(groupby(jars, :tray_id), nrow => :n)");
  assert.equal(drafts["C3/join-report-log"], "leftjoin(tray_counts, tally_sheet, on=:tray_id)");
  assert.deepEqual(ending.featuring(drafts), [".==", "combine", "groupby", "leftjoin"]);
  assert.deepEqual(ending.learnerDrafts(memoryStorage(), "demo"), {});
});

// 2026-09-26 browser play: jar names and "p = 0.8" broke across lines ("J-" / "092").
test("keepTogether stops names and p values from breaking across lines, changing nothing else", () => {
  assert.equal(ending.keepTogether("from J-091 and T-C, p = 0.8 and coin-flip"), "from J‑091 and T‑C, p = 0.8 and coin-flip");
});


// Review 2026-09-26 (independent pass on the feat/ending diff).
test("epilogueFacts requires the server's simulated-data label", () => {
  assert.equal(ending.epilogueFacts(reply({data_label:undefined}), "r1"), null);
  assert.equal(ending.epilogueFacts(reply({data_label:""}), "r1"), null);
});

test("Chapters 1 and 2 show their own saved code, never a stale shared draft", () => {
  const legacy = require("../web/course/legacy-import.js");
  const storage = memoryStorage();
  courseState.writeChallengeDraft(storage, "demo", "C2", "rates", "stale shared draft");
  storage.setItem(legacy.c2DraftKey("demo", "rates"), "real chapter 2 draft");
  assert.equal(ending.learnerDrafts(storage, "demo")["C2/rates"], "real chapter 2 draft");
  const onlyStale = memoryStorage();
  courseState.writeChallengeDraft(onlyStale, "demo", "C2", "rates", "stale shared draft");
  assert.equal(ending.learnerDrafts(onlyStale, "demo")["C2/rates"], undefined);
});

test("featuring counts qualified calls and does not mistake .&& for .&", () => {
  assert.deepEqual(ending.featuring({"C2/group":"DataFrames.groupby(jars, :tray_id)"}), ["groupby"]);
  assert.deepEqual(ending.featuring({"C6/compatible-models":"a .&& b"}), []);
});

test("saved code keeps its relative indentation and a character cap", () => {
  const scenes = ending.buildScenes(FACTS, script, {"C2/rates":"\n    counts = combine(g,\n        nrow => :n)\n", "C3/filter-disagreement":"x".repeat(900)});
  assert.equal(scenes[1].code, "counts = combine(g,\n    nrow => :n)");
  assert.ok(scenes[2].code.length <= 601 && scenes[2].code.endsWith("…"));
});

test("large simulation counts are written with thousands separators", () => {
  const scenes = ending.buildScenes(Object.assign({}, FACTS, {n_simulations:20000, matching_events:2260}), script, {});
  assert.match(scenes[4].caption, /In 20,000 rounds .* came up 2,260 times\.$/);
});

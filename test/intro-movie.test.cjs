"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const script = require("../web/course/intro-script.js");
const intro = require("../web/course/intro.js");
const courseState = require("../web/course/course-state.js");
const client = require("../web/course/course-client.js");

test("scenes: intro-script.js has exactly 6 scenes (the road map first) with the required fields", () => {
  assert.equal(script.scenes.length, 6);
  for (const scene of script.scenes) {
    assert.ok(scene.title && scene.title.trim(), "title");
    assert.ok(scene.caption && scene.caption.trim(), "caption");
    assert.ok(scene.alt && scene.alt.trim(), "alt");
    assert.ok(scene.image && scene.image.trim(), "image");
    const resolved = path.join(root, "web", "course", scene.image);
    assert.ok(fs.existsSync(resolved), scene.image + " must exist on disk");
  }
});

test("scenes: player next/back/skip respect the bounds of the 6 scenes", () => {
  let player = intro.createPlayer(script.scenes.length);
  assert.deepEqual(player, {index:0, count:6});
  player = intro.playerStep(player, "back");
  assert.equal(player.index, 0, "back does not go below 0");
  for (let i = 0; i < 10; i++) player = intro.playerStep(player, "next");
  assert.equal(player.index, 5, "next stops at the last scene (index count - 1)");
  player = intro.playerStep(player, "back");
  assert.equal(player.index, 4);
  player = intro.playerStep(player, "skip");
  assert.equal(player.index, 5, "skip jumps straight to the last scene");
});

test("scenes: intro.js never auto-advances with a timer", () => {
  const src = read("web/course/intro.js");
  assert.doesNotMatch(src, /setInterval/);
  assert.doesNotMatch(src, /setTimeout/);
});

test("fixture: batch B09 in src/mystery.jl has 6 jars on 3 trays, 2 per tray, named T-A, T-B, T-C", () => {
  const mystery = read("src/mystery.jl");
  const jarIdMatch = mystery.match(/jar_id\s*=\s*\[([^\]]*)\]/);
  const batchMatch = mystery.match(/batch_id\s*=\s*\[([^\]]*)\]/);
  const trayMatch = mystery.match(/tray_id\s*=\s*\[([^\]]*)\]/);
  assert.ok(jarIdMatch && batchMatch && trayMatch, "mystery_jars fixture arrays found");
  const parseList = raw => raw.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
  const jarIds = parseList(jarIdMatch[1]);
  const batches = parseList(batchMatch[1]);
  const trays = parseList(trayMatch[1]);
  const b09Trays = jarIds.map((_, i) => [batches[i], trays[i]]).filter(([b]) => b === "B09").map(([, t]) => t);
  assert.equal(b09Trays.length, 6, "6 B09 jars");
  const distinctTrays = [...new Set(b09Trays)];
  assert.equal(distinctTrays.length, 3, "3 distinct trays");
  assert.deepEqual(distinctTrays.sort(), ["T-A", "T-B", "T-C"]);
  for (const tray of distinctTrays) assert.equal(b09Trays.filter(t => t === tray).length, 2, tray + " has 2 jars");
});

test("fixture: scene 3's caption states the batch facts in words, matching the game's data", () => {
  const scene2 = script.scenes[2];
  assert.match(scene2.caption, /six jars/i);
  assert.match(scene2.caption, /three trays/);
  assert.match(scene2.caption, /T-A, T-B and T-C/);
});

test("spoiler: none of the intro's words give away the case's later reveals", () => {
  const words = JSON.stringify(script).toLowerCase();
  for (const phrase of ["blank", "5 of 6", "1 of 2", "not a count", "copied", "left empty"]) {
    assert.ok(!words.includes(phrase), 'must not contain "' + phrase + '"');
  }
});

test("spoiler: no em dashes in any learner-facing intro text", () => {
  const words = JSON.stringify(script);
  assert.doesNotMatch(words, /—/);
  for (const file of ["web/course/intro.html", "web/course/intro.js"]) assert.doesNotMatch(read(file), /—/, file);
});

test("entry: dashboardModel(emptyCourseState()).startWithIntro is true for a brand-new player", () => {
  const model = client.dashboardModel(courseState.emptyCourseState());
  assert.equal(model.startWithIntro, true);
});

test("entry: dashboardModel().startWithIntro is false once a move is saved", () => {
  const model = client.dashboardModel(courseState.makeCourseState({moves:[{key:"C1/select-records", provenance:"historical-browser"}]}));
  assert.equal(model.startWithIntro, false);
});

test("entry: dashboardModel().startWithIntro is false once the whole case is complete", () => {
  const MILESTONES = ["C1/select-records", "C2/group", "C2/counts", "C2/rates", "C3/join-report-log", "C3/filter-disagreement",
    "C4/plan-distinct-recheck", "C5/event-mask", "C5/event-frequency", "C6/compatible-models"];
  const model = client.dashboardModel(courseState.makeCourseState({moves:MILESTONES.map(key => ({key, provenance:"historical-browser"}))}));
  assert.equal(model.startWithIntro, false);
});

test("entry: the intro is optional; the Board's one Start goes to Lesson 1 and the intro is marked seen", () => {
  const board = read("web/course/course-board.js");
  assert.match(read("web/course/course-client.js"), /startWithIntro/);
  assert.doesNotMatch(board, /next\.kind === "intro"/);
  assert.doesNotMatch(read("web/course/index.html"), /id="skip-intro"/);
  assert.match(read("web/course/intro.js"), /INTRO_SEEN_KEY/);
});

test("0.5 fix: the road map is scene 1, every scene is under 45 words, and the last button says Start Lesson 1", () => {
  assert.match(script.scenes[0].title, /road map/i);
  assert.match(script.scenes[0].caption, /six steps/i);
  for (const scene of script.scenes) {
    const count = (scene.caption + " " + (scene.speaker || "") + " " + (scene.line || "")).split(/\s+/).length;
    assert.ok(count < 45, scene.title + " has " + count + " words");
  }
  assert.equal(script.buttons.start, "Start Lesson 1 →");
  assert.doesNotMatch(JSON.stringify(script), /Part [123]/);
  assert.doesNotMatch(read("web/course/intro.css"), /ending-caption[^}]*font-weight:\s*[5-9]00|ending-caption[^}]*font-weight:\s*bold/, "intro captions are regular weight");
});

test("0.5 fix: reaching the last scene marks the intro seen, and the Board then counts it done", () => {
  const store = new Map();
  const storage = {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), key: i => [...store.keys()][i], get length() { return store.size; }};
  assert.equal(client.lessonProgress(storage).introSeen, false);
  storage.setItem(client.INTRO_SEEN_KEY, "1");
  assert.equal(client.lessonProgress(storage).introSeen, true);
  const model = client.dashboardModel(courseState.emptyCourseState());
  assert.equal(client.courseWalk(model, client.lessonProgress(storage), "").introDone, true);
});

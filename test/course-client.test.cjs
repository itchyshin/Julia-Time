"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const courseState = require("../web/course/course-state.js");
const legacy = require("../web/course/legacy-import.js");
const client = require("../web/course/course-client.js");

test("Case Board recognises and routes the one C4 recheck-planning move plus C5-C6 moves", () => {
  const storage = memoryStorage();
  for (const [chapter, move] of [["C4","plan-distinct-recheck"],["C5","event-mask"],["C5","event-frequency"],["C6","compatible-models"]]) {
    assert.equal(courseState.recordHistoricalMoveIfMissing(storage, "field-7", chapter, move), true);
    assert.match(client.legacyDestination(chapter, "field-7", move), new RegExp("chapter" + chapter.slice(1) + "\\.html"));
    assert.match(client.adapterDestination(chapter, "field-7", move), new RegExp("chapter=" + chapter));
  }
  const model = client.dashboardModel(client.loadCourseState(storage, "field-7"));
  assert.deepEqual(model.cards.slice(3).map(card => card.playable), [true, true, true]);
  assert.match(model.cards[5].status, /in this browser|playable/i);
});

test("attempt identifiers create isolated additive course namespaces", () => {
  assert.equal(courseState.attemptId("field-7"), true);
  assert.equal(courseState.attemptId(""), false);
  assert.equal(courseState.attemptId("../../old"), false);
  assert.equal(courseState.coursePrefix("field-7"), "julia-time:missing-fleas:course:v1:attempt:field-7:");
  assert.equal(courseState.coursePrefix("../../old"), "julia-time:missing-fleas:course:v1:");
  assert.notEqual(courseState.coursePrefix("field-7"), courseState.coursePrefix("field-8"));
});

test("malformed course or legacy storage creates no progress", () => {
  const storage = memoryStorage();
  storage.setItem(courseState.courseKey("field-7"), "not json");
  storage.setItem(legacy.c1EvidenceKey("field-7"), "not json");
  storage.setItem(legacy.c2ProgressKey("field-7"), JSON.stringify({step:"rates", accepted:{rates:42}}));

  assert.deepEqual(courseState.readCourseState(storage, "field-7"), courseState.emptyCourseState());
  assert.deepEqual(legacy.importLegacy(storage, "field-7").moves, []);
  assert.deepEqual(courseState.acceptedMoves(client.loadCourseState(storage, "field-7")), []);
  assert.equal(storage.getItem(courseState.courseKey("field-7")), "not json");
});

test("C1 evidence imports only as historical select-records progress", () => {
  const storage = memoryStorage();
  storage.setItem(legacy.c1EvidenceKey("field-7"), JSON.stringify(validC1Evidence()));

  const imported = legacy.importLegacy(storage, "field-7");
  assert.deepEqual(imported.moves, [{key:"C1/select-records", provenance:"historical-browser"}]);
  assert.equal(imported.evidence.length, 1);
  assert.equal(imported.evidence[0].provenance, "historical-browser");
  assert.equal(imported.evidence[0].chapter, "C1");
});

test("C2 imports only valid accepted strings for its known moves", () => {
  const storage = memoryStorage();
  storage.setItem(legacy.c2ProgressKey("field-7"), JSON.stringify({
    step:"rates",
    accepted:{group:"groupby(jars, :tray_id)", counts:"combine(groups, nrow => :n)", rates:"summary.rate = summary.detected_n ./ summary.n", invented:"no"}
  }));

  assert.deepEqual(legacy.importLegacy(storage, "field-7").moves, [
    {key:"C2/group", provenance:"historical-browser"},
    {key:"C2/counts", provenance:"historical-browser"},
    {key:"C2/rates", provenance:"historical-browser"}
  ]);
});

test("an unchanged import preserves a course snapshot and all legacy bytes", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  const evidence = JSON.stringify(validC1Evidence());
  const progress = JSON.stringify({step:"group", accepted:{group:"groupby(jars, :tray_id)"}});
  storage.setItem(legacy.c1EvidenceKey(attempt), evidence);
  storage.setItem(legacy.c2ProgressKey(attempt), progress);
  const saved = courseState.makeCourseState({
    moves:[{key:"C1/select-records", provenance:"historical-browser"}, {key:"C2/group", provenance:"historical-browser"}]
  });
  storage.setItem(courseState.courseKey(attempt), JSON.stringify(saved));
  courseState.writeEvidenceIfMissing(storage, attempt, {chapter:"C1", move_id:"select-records", title:"The B09 records", row_count:1, provenance:"historical-browser"});
  courseState.writeChallengeDraft(storage, attempt, "C2", "group", "my unfinished draft");
  courseState.writeNotes(storage, attempt, {case:"check the labels"});
  const imported = legacy.importLegacy(storage, attempt);
  courseState.writeImportRecord(storage, attempt, {schema_version:1, sources:Object.fromEntries(imported.sources.map(source => [source.source_key, {fingerprint:source.fingerprint, destinations:source.destinations}]))});
  const beforeWrites = storage.writes.length;

  const state = client.loadCourseState(storage, attempt);
  assert.deepEqual(courseState.readCourseState(storage, attempt), saved);
  assert.equal(state.drafts["C2/group"], "my unfinished draft");
  assert.equal(state.notes.case, "check the labels");
  assert.equal(storage.getItem(legacy.c1EvidenceKey(attempt)), evidence);
  assert.equal(storage.getItem(legacy.c2ProgressKey(attempt)), progress);
  assert.equal(storage.writes.length, beforeWrites);
});

test("legacy import fills an absent move without replacing saved browser work", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  const saved = courseState.makeCourseState({
    moves:[{key:"C1/select-records", provenance:"historical-browser"}]
  });
  saved.accepted["C1/select-records"].code = "my selected rows";
  storage.setItem(courseState.courseKey(attempt), JSON.stringify(saved));
  courseState.writeChallengeDraft(storage, attempt, "C2", "counts", "my unfinished calculation");
  courseState.writeNotes(storage, attempt, {case:"check the labels"});
  const progress = JSON.stringify({step:"group", accepted:{group:"groupby(jars, :tray_id)"}});
  storage.setItem(legacy.c2ProgressKey(attempt), progress);

  const merged = client.loadCourseState(storage, attempt);
  assert.deepEqual(courseState.acceptedMoves(merged), [
    {key:"C1/select-records", provenance:"historical-browser"},
    {key:"C2/group", provenance:"historical-browser"}
  ]);
  assert.equal(merged.drafts["C2/counts"], "my unfinished calculation");
  assert.equal(merged.notes.case, "check the labels");
  assert.equal(merged.accepted["C1/select-records"].code, "my selected rows");
  assert.equal(storage.getItem(legacy.c2ProgressKey(attempt)), progress);
});

test("progress-v1 contains accepted snapshots only and companion data uses separate v1 keys", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  const progress = courseState.makeCourseState({moves:[{key:"C1/select-records", provenance:"historical-browser"}]});
  assert.equal(courseState.writeInitialCourseState(storage, attempt, progress), true);
  assert.equal(courseState.writeChallengeDraft(storage, attempt, "C2", "counts", "draft only"), true);
  assert.equal(courseState.writeEvidenceIfMissing(storage, attempt, {chapter:"C1", move_id:"select-records", title:"Saved B09 records", row_count:6, provenance:"historical-browser"}), true);
  assert.equal(courseState.writeNotes(storage, attempt, {case:"check the labels"}), true);
  assert.equal(courseState.writeImportRecord(storage, attempt, {schema_version:1, sources:{"legacy-key":{fingerprint:"fnv1a32-deadbeef-2", destinations:["C1/select-records"]}}}), true);

  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(courseState.courseKey(attempt)))).sort(), ["accepted", "case_id", "schema_version"]);
  assert.equal(storage.getItem(courseState.draftKey(attempt, "C2", "counts", "challenge")), "draft only");
  assert.match(storage.getItem(courseState.evidenceKey(attempt, "C1", "select-records")), /Saved B09 records/);
  assert.deepEqual(courseState.readNotes(storage, attempt), {case:"check the labels"});
  assert.deepEqual(courseState.readImportRecord(storage, attempt).sources["legacy-key"].destinations, ["C1/select-records"]);
});

test("a current C3 acceptance can add only a historical browser marker without replacing a draft", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  assert.equal(courseState.writeChallengeDraft(storage, attempt, "C3", "join-report-log", "my own unfinished join"), true);

  assert.equal(courseState.recordHistoricalMoveIfMissing(storage, attempt, "C3", "join-report-log"), true);
  assert.deepEqual(courseState.readCourseState(storage, attempt).accepted["C3/join-report-log"], {
    case_id:"missing-fleas-v1", chapter:"C3", move_id:"join-report-log", provenance:"historical-browser"
  });
  assert.equal(courseState.readChallengeDrafts(storage, attempt)["C3/join-report-log"], "my own unfinished join");
  assert.equal(courseState.recordHistoricalMoveIfMissing(storage, attempt, "C3", "join-report-log"), false);
  assert.equal(courseState.recordHistoricalMoveIfMissing(storage, attempt, "C3", "invented"), false);

  const malformed = memoryStorage();
  malformed.setItem(courseState.courseKey(attempt), "not json");
  assert.equal(courseState.recordHistoricalMoveIfMissing(malformed, attempt, "C3", "join-report-log"), false);
  assert.equal(malformed.getItem(courseState.courseKey(attempt)), "not json");
});

test("a C3 demonstration draft has its own safe key and cannot overwrite challenge code", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  assert.equal(courseState.writeChallengeDraft(storage, attempt, "C3", "join-report-log", "my case join"), true);
  assert.equal(courseState.writeDraft(storage, attempt, "C3", "join-report-log", "demonstration", "practice-join-v1", "my practice join"), true);
  assert.equal(courseState.readDraft(storage, attempt, "C3", "join-report-log", "challenge"), "my case join");
  assert.equal(courseState.readDraft(storage, attempt, "C3", "join-report-log", "demonstration", "practice-join-v1"), "my practice join");
  assert.notEqual(courseState.draftKey(attempt, "C3", "join-report-log", "challenge"), courseState.draftKey(attempt, "C3", "join-report-log", "demonstration", "practice-join-v1"));
  assert.equal(courseState.writeDraft(storage, attempt, "C3", "join-report-log", "demonstration", "bad activity", "bad"), false);
  assert.equal(courseState.readDraft(storage, attempt, "C3", "join-report-log", "demonstration", "bad activity"), "");
});

test("a saved cursor cannot turn Continue into a move bypass", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  assert.equal(courseState.writeCursor(storage, attempt, {chapter:"C2", move_id:"rates", mode:"challenge"}), true);

  const loaded = client.loadCourseState(storage, attempt);
  const model = client.dashboardModel(loaded);
  assert.deepEqual(loaded.cursor, {chapter:"C2", move_id:"rates", mode:"challenge"});
  assert.deepEqual(courseState.acceptedMoves(loaded), []);
  assert.deepEqual(model.continue, {chapter:"C1", move:"select-records", label:"Start Chapter 1: select the disputed records"});
  assert.equal(storage.getItem(courseState.courseKey(attempt)), null);
});

test("a reachable saved cursor labels the current Continue move", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  const progress = courseState.makeCourseState({moves:[
    {key:"C1/select-records", provenance:"historical-browser"},
    {key:"C2/group", provenance:"historical-browser"},
    {key:"C2/counts", provenance:"historical-browser"}
  ]});
  courseState.writeInitialCourseState(storage, attempt, progress);
  courseState.writeCursor(storage, attempt, {chapter:"C2", move_id:"rates", mode:"challenge"});

  const model = client.dashboardModel(client.loadCourseState(storage, attempt));
  assert.deepEqual(model.continue, {chapter:"C2", move:"rates", label:"Continue Chapter 2: compare tray rates"});
});

test("changed legacy data is reported and does not silently fill a destination", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  const original = JSON.stringify({step:"group", accepted:{group:"groupby(jars, :tray_id)"}});
  storage.setItem(legacy.c2ProgressKey(attempt), original);
  const originalSource = legacy.importLegacy(storage, attempt).sources[0];
  courseState.writeImportRecord(storage, attempt, {schema_version:1, sources:{[originalSource.source_key]:{fingerprint:originalSource.fingerprint, destinations:originalSource.destinations}}});
  storage.setItem(legacy.c2ProgressKey(attempt), JSON.stringify({step:"counts", accepted:{group:"groupby(jars, :tray_id)", counts:"combine(groups, nrow => :n)"}}));
  const beforeWrites = storage.writes.length;

  const loaded = client.loadCourseState(storage, attempt);
  assert.deepEqual(courseState.acceptedMoves(loaded), []);
  assert.deepEqual(loaded.historicalChanged, [legacy.c2ProgressKey(attempt)]);
  assert.match(client.dashboardModel(loaded).historicalNotice, /^Earlier saved data in this browser changed\./);
  assert.equal(storage.writes.length, beforeWrites);
});

test("a learner can explicitly add changed browser history without replacing saved work", () => {
  const storage = memoryStorage();
  const attempt = "field-7";
  const prior = courseState.makeCourseState({moves:[{key:"C2/group", provenance:"historical-browser"}]});
  prior.accepted["C2/group"].code = "my saved grouping";
  storage.setItem(courseState.courseKey(attempt), JSON.stringify(prior));
  courseState.writeChallengeDraft(storage, attempt, "C2", "counts", "my unfinished count");
  const original = JSON.stringify({step:"group", accepted:{group:"groupby(jars, :tray_id)"}});
  storage.setItem(legacy.c2ProgressKey(attempt), original);
  const originalSource = legacy.importLegacy(storage, attempt).sources[0];
  courseState.writeImportRecord(storage, attempt, {schema_version:1, sources:{[originalSource.source_key]:{fingerprint:originalSource.fingerprint, destinations:originalSource.destinations}}});
  storage.setItem(legacy.c2ProgressKey(attempt), JSON.stringify({step:"counts", accepted:{group:"groupby(jars, :tray_id)", counts:"combine(groups, nrow => :n)"}}));

  const beforeChoice = client.loadCourseState(storage, attempt);
  assert.deepEqual(courseState.acceptedMoves(beforeChoice), [{key:"C2/group", provenance:"historical-browser"}]);
  assert.equal(client.dashboardModel(beforeChoice).changedHistoryAction, "Add changed browser history");

  const afterChoice = client.loadCourseState(storage, attempt, {acceptChangedHistory:true});
  assert.deepEqual(courseState.acceptedMoves(afterChoice), [
    {key:"C2/group", provenance:"historical-browser"},
    {key:"C2/counts", provenance:"historical-browser"}
  ]);
  assert.equal(afterChoice.accepted["C2/group"].code, "my saved grouping");
  assert.equal(afterChoice.drafts["C2/counts"], "my unfinished count");
  assert.equal(afterChoice.historicalChanged.length, 0);
  assert.equal(client.dashboardModel(afterChoice).changedHistoryAction, "");
});

test("the Case Board continues with the earliest playable missing move", () => {
  const first = client.dashboardModel(courseState.emptyCourseState());
  assert.deepEqual(first.continue, {chapter:"C1", move:"select-records", label:"Start Chapter 1: select the disputed records"});

  const afterC1 = client.dashboardModel(courseState.makeCourseState({moves:[{key:"C1/select-records", provenance:"historical-browser"}]}));
  assert.deepEqual(afterC1.continue, {chapter:"C2", move:"group", label:"Continue Chapter 2: group the tray records"});

  const afterGroup = client.dashboardModel(courseState.makeCourseState({moves:[
    {key:"C1/select-records", provenance:"historical-browser"},
    {key:"C2/group", provenance:"historical-browser"}
  ]}));
  assert.deepEqual(afterGroup.continue, {chapter:"C2", move:"counts", label:"Continue Chapter 2: count recorded detections"});
});

test("the Case Board keeps one modest mystery thread: question, fact, unknown, and why now", () => {
  const first = client.dashboardModel(courseState.emptyCourseState()).caseThread;
  assert.match(first.question, /why.*report.*B09.*notebook/i);
  assert.match(first.question, /B09.*group of jar records/i);
  assert.match(first.established, /no case result.*checked/i);
  assert.match(first.unknown, /why.*differ/i);
  assert.match(first.whyNext, /identify.*B09 records.*group of jar records/i);

  const afterC3 = client.dashboardModel(courseState.makeCourseState({moves:[
    {key:"C1/select-records", provenance:"historical-browser"},
    {key:"C2/group", provenance:"historical-browser"},
    {key:"C2/counts", provenance:"historical-browser"},
    {key:"C2/rates", provenance:"historical-browser"},
    {key:"C3/join-report-log", provenance:"historical-browser"},
    {key:"C3/filter-disagreement", provenance:"historical-browser"}
  ]})).caseThread;
  assert.match(afterC3.established, /recording disagreement/i);
  assert.match(afterC3.unknown, /does not tell us.*why/i);
  assert.match(afterC3.whyNext, /recheck/i);

  const afterC5 = client.dashboardModel(courseState.makeCourseState({moves:[
    ...["C1/select-records", "C2/group", "C2/counts", "C2/rates", "C3/join-report-log", "C3/filter-disagreement", "C4/plan-distinct-recheck", "C5/event-mask", "C5/event-frequency"].map(key => ({key, provenance:"historical-browser"}))
  ]})).caseThread;
  assert.match(afterC5.established, /stated simulation model/i);
  assert.match(afterC5.whyNext, /range models/i);
  assert.doesNotMatch(JSON.stringify(afterC5), /culprit|prove/i);

  const afterC6 = client.dashboardModel(courseState.makeCourseState({moves:[
    ...["C1/select-records", "C2/group", "C2/counts", "C2/rates", "C3/join-report-log", "C3/filter-disagreement", "C4/plan-distinct-recheck", "C5/event-mask", "C5/event-frequency", "C6/compatible-models"].map(key => ({key, provenance:"historical-browser"}))
  ]})).caseThread;
  assert.match(afterC6.established, /report and handling log disagree.*T-C/i);
  assert.match(afterC6.established, /compatible candidate ranges/i);
  assert.match(afterC6.unknown, /does not identify a cause/i);
  assert.match(afterC6.whyNext, /case closed for today/i);
  assert.match(afterC6.whyNext, /recheck.*new observation/i);

  const onlyC6 = client.dashboardModel(courseState.makeCourseState({moves:[
    {key:"C6/compatible-models", provenance:"historical-browser"}
  ]})).caseThread;
  assert.match(onlyC6.established, /candidate ranges contain the observed count/i);
  assert.doesNotMatch(onlyC6.whyNext, /case closed for today/i);
  assert.match(onlyC6.whyNext, /identify.*B09 records/i);
});

test("C3 becomes the next playable investigation only after its real route exists", () => {
  const beforeC3 = courseState.makeCourseState({moves:[
    {key:"C1/select-records", provenance:"historical-browser"},
    {key:"C2/group", provenance:"historical-browser"},
    {key:"C2/counts", provenance:"historical-browser"},
    {key:"C2/rates", provenance:"historical-browser"}
  ]});
  const afterJoin = courseState.makeCourseState({moves:[
    {key:"C1/select-records", provenance:"historical-browser"},
    {key:"C2/group", provenance:"historical-browser"},
    {key:"C2/counts", provenance:"historical-browser"},
    {key:"C2/rates", provenance:"historical-browser"},
    {key:"C3/join-report-log", provenance:"historical-browser"}
  ]});

  const firstC3 = client.dashboardModel(beforeC3);
  const joinedC3 = client.dashboardModel(afterJoin);
  assert.deepEqual(firstC3.continue, {chapter:"C3", move:"join-report-log", label:"Continue Chapter 3: join the report and handling log"});
  assert.deepEqual(joinedC3.continue, {chapter:"C3", move:"filter-disagreement", label:"Continue Chapter 3: filter the recording disagreement"});
  assert.equal(firstC3.cards[2].playable, true);
  assert.match(firstC3.cards[2].status, /Playable now/i);
  assert.match(joinedC3.cards[2].status, /Started in this browser/i);
  assert.equal(client.legacyDestination("C3", "field-7", "join-report-log"), "../chapter3.html?attempt=field-7&move=join-report-log");
  assert.equal(client.adapterDestination("C3", "field-7", "filter-disagreement"), "chapter.html?chapter=C3&attempt=field-7&move=filter-disagreement");
});

test("six chapter cards expose all six playable mystery chapters without grading language", () => {
  const model = client.dashboardModel(courseState.emptyCourseState());
  assert.equal(model.cards.length, 6);
  assert.equal(model.cards[2].playable, true);
  for (const card of model.cards.slice(3)) {
    assert.equal(card.playable, true);
    assert.match(card.status, /Playable now/i);
    assert.equal(card.href, card.chapter);
  }
  assert.doesNotMatch(JSON.stringify(model), /percent|accuracy|streak|rank|timer|grade|run count/i);
});

test("Case Board gives every playable chapter card its own labelled safe entry route", () => {
  const boardSource = fs.readFileSync(path.join(__dirname, "../web/course/course-board.js"), "utf8");
  assert.match(boardSource, /if \(card\.playable\) \{/);
  assert.match(boardSource, /document\.createElement\("a"\)/);
  assert.match(boardSource, /chapterAction\.href = client\.adapterDestination\(card\.chapter, attempt\) \|\| "chapter\.html"/);
  assert.match(boardSource, /text\(chapterAction, "Open Chapter " \+ card\.chapter\.slice\(1\) \+ " →"\)/);
  assert.match(boardSource, /article\.append\(label, title, status, chapterAction\)/);
});

test("the optional speed laboratory is outside the six chapters and preserves only valid attempt IDs", () => {
  assert.equal(client.speedLabDestination("field-7"), "speed-lab.html?attempt=field-7");
  assert.equal(client.speedLabDestination("../../bad"), "speed-lab.html");
  const board = fs.readFileSync(path.join(__dirname, "../web/course/index.html"), "utf8");
  assert.match(board, /id="speed-lab-entry"/);
  assert.match(board, /not a seventh chapter/i);
  assert.match(board, /does not affect case progress/i);
  assert.match(board, /same answers.*before.*timing/i);
  assert.match(board, /id="speed-lab-link"[^>]*href="speed-lab\.html"/);
  assert.match(board, /speedLabDestination\(attempt\)/);
});

test("chapter routes preserve a valid attempt across all six playable chapters", () => {
  assert.equal(client.legacyDestination("C1", "field-7"), "../index.html?attempt=field-7");
  assert.equal(client.legacyDestination("C2", "field-7"), "../chapter2.html?attempt=field-7");
  assert.equal(client.legacyDestination("C2", "field-7", "counts"), "../chapter2.html?attempt=field-7&move=counts");
  assert.equal(client.adapterDestination("C2", "field-7", "counts"), "chapter.html?chapter=C2&attempt=field-7&move=counts");
  assert.equal(client.legacyDestination("C1", "../../bad"), "../index.html");
  assert.equal(client.legacyDestination("C2", "field-7", "invented"), "../chapter2.html?attempt=field-7");
  assert.equal(client.legacyDestination("C3", "field-7", "invented"), "../chapter3.html?attempt=field-7");
  assert.equal(client.adapterDestination("C3", "field-7", "join-report-log"), "chapter.html?chapter=C3&attempt=field-7&move=join-report-log");
  assert.equal(client.legacyDestination("C4", "field-7", "plan-distinct-recheck"), "../chapter4.html?attempt=field-7&move=plan-distinct-recheck");
  assert.equal(client.legacyDestination("C5", "field-7", "event-mask"), "../chapter5.html?attempt=field-7&move=event-mask");
  assert.equal(client.legacyDestination("C6", "field-7", "compatible-models"), "../chapter6.html?attempt=field-7&move=compatible-models");
  assert.equal(client.adapterDestination("C4", "field-7", "plan-distinct-recheck"), "chapter.html?chapter=C4&attempt=field-7&move=plan-distinct-recheck");
  const boardSource = fs.readFileSync(path.join(__dirname, "../web/course/course-board.js"), "utf8");
  const routeSource = fs.readFileSync(path.join(__dirname, "../web/course/chapter-route.js"), "utf8");
  assert.match(boardSource, /adapterDestination\(model\.continue\.chapter, attempt, model\.continue\.move\)/);
  assert.match(routeSource, /params\.get\("move"\)/);
});

test("an unavailable chapter route names the Case Board without denying the other five chapters", () => {
  const routeSource = fs.readFileSync(path.join(__dirname, "../web/course/chapter-route.js"), "utf8");
  assert.match(routeSource, /Choose one of the six playable chapters from the Case Board\./);
  assert.match(routeSource, /text\(link, "Return to Case Board →"\)/);
  assert.doesNotMatch(routeSource, /Only Chapters 1 and 2 have a playable destination/i);
});

test("reply fencing rejects stale or mismatched case identities", () => {
  const pending = {case_id:"missing-fleas-v1", chapter:"C2", move_id:"counts", mode:"challenge", request_id:"request-now"};
  const reply = Object.assign({type:"case_result"}, pending);
  assert.equal(client.acceptReply(pending, reply), true);
  for (const wrong of [
    {request_id:"request-old"}, {case_id:"other-case"}, {chapter:"C1"}, {move_id:"rates"}, {mode:"practice"}, {mode:"case"}
  ]) assert.equal(client.acceptReply(pending, Object.assign({}, reply, wrong)), false);
  const incomplete = Object.assign({}, reply);
  delete incomplete.request_id;
  assert.equal(client.acceptReply(pending, incomplete), false);
  const invalidPending = {case_id:"not-missing-fleas", chapter:"C2", move_id:"invented", mode:"practice", request_id:"request-now"};
  assert.equal(client.acceptReply(invalidPending, Object.assign({type:"case_result"}, invalidPending)), false);
});

test("legacy importer is read-only and the static adapters do not run code", () => {
  const storage = memoryStorage();
  storage.setItem(legacy.c1EvidenceKey("field-7"), JSON.stringify(validC1Evidence()));
  const writes = storage.writes.length;
  legacy.importLegacy(storage, "field-7");
  assert.equal(storage.writes.length, writes);

  const importerSource = fs.readFileSync(path.join(__dirname, "../web/course/legacy-import.js"), "utf8");
  const board = fs.readFileSync(path.join(__dirname, "../web/course/index.html"), "utf8");
  const boardClient = fs.readFileSync(path.join(__dirname, "../web/course/course-board.js"), "utf8");
  const adapter = fs.readFileSync(path.join(__dirname, "../web/course/chapter.html"), "utf8");
  const setupBoardPath = path.join(__dirname, "../web/course/setup-status-board.js");
  assert.doesNotMatch(importerSource, /\.setItem\s*\(/);
  assert.match(board, /id="continue-action"/);
  assert.match(board, /id="changed-history-action"/);
  assert.match(boardClient, /acceptChangedHistory:true/);
  assert.match(boardClient, /Concepts will appear here after this browser has saved progress\./);
  assert.doesNotMatch(boardClient, /after you make a checked move/);
  assert.match(board, /aria-live="polite"/);
  assert.match(board, /id="setup-readiness"/);
  assert.match(board, /id="setup-status"/);
  assert.match(board, /id="setup-recheck"/);
  assert.match(board, /id="setup-details"/);
  assert.match(board, /setup-status-client\.js/);
  assert.match(board, /setup-status-board\.js/);
  assert.equal(fs.existsSync(setupBoardPath), true, "the Case Board readiness controller must exist");
  const setupBoard = fs.readFileSync(setupBoardPath, "utf8");
  assert.match(setupBoard, /WebSocket/);
  assert.match(setupBoard, /canStartStory/);
  assert.doesNotMatch(board + adapter, /WebSocket|case_run|Run this/i);
});

test("legacy chapters retain their Case Board context, data panels, and separate save namespaces", () => {
  const c1Html = fs.readFileSync(path.join(__dirname, "../web/index.html"), "utf8");
  const c2Html = fs.readFileSync(path.join(__dirname, "../web/chapter2.html"), "utf8");
  const c1Client = fs.readFileSync(path.join(__dirname, "../web/mystery.js"), "utf8");
  const c2Client = fs.readFileSync(path.join(__dirname, "../web/chapter2.js"), "utf8");
  assert.match(c1Html, /id="case-board"/);
  assert.match(c1Html, /Case 1 of 6/);
  assert.match(c1Html, /id="case-table"/);
  assert.match(c2Html, /id="case-board"/);
  assert.match(c2Html, /Case 2 of 6/);
  assert.match(c2Html, /class="source-notebook"/);
  assert.match(c2Html, /id="source-rows"/);
  assert.match(c1Client, /julia-time:missing-fleas:v1:/);
  assert.match(c2Client, /julia-time:missing-fleas:v1:c2:/);
});

test("every chapter gives a plainly named route back to the whole Case Board", () => {
  const webRoot = path.join(__dirname, "../web");
  for (const chapter of ["index.html", "chapter2.html", "chapter3.html", "chapter4.html", "chapter5.html", "chapter6.html"]) {
    const html = fs.readFileSync(path.join(webRoot, chapter), "utf8");
    const match = html.match(/<a\s+id="case-board"[^>]*>([^<]+)<\/a>/i);
    assert.ok(match, `${chapter} must keep a named route to the Case Board`);
    assert.match(match[1], /Case Board/i, `${chapter} must call the route “Case Board”, not make learners infer it from saved evidence`);
  }
});

test("each investigation chapter uses its reviewed local scene asset", () => {
  const webRoot = path.join(__dirname, "../web");
  const c1Html = fs.readFileSync(path.join(webRoot, "index.html"), "utf8");
  const c2Html = fs.readFileSync(path.join(webRoot, "chapter2.html"), "utf8");
  const c3Html = fs.readFileSync(path.join(webRoot, "chapter3.html"), "utf8");

  assert.match(c1Html, /src="assets\/lab-cast\.png"/);
  assert.match(c2Html, /src="assets\/course\/scene-c2-tray-bench\.png"/);
  assert.match(c3Html, /src="assets\/course\/scene-c3-handling-desk\.png"/);
  assert.match(c2Html, /alt="At a lab bench, Eddie aligns several unlabelled specimen trays while Itchy, Toto and Momo watch\."/);
  assert.match(c3Html, /alt="Eddie holds two blank sheets side by side at a lab desk while Itchy, Toto and Momo examine the investigation materials\."/);
  for (const asset of [
    "assets/lab-cast.png",
    "assets/course/scene-c2-tray-bench.png",
    "assets/course/scene-c3-handling-desk.png"
  ]) assert.equal(fs.existsSync(path.join(webRoot, asset)), true, `${asset} must ship locally`);

  // These pin the visual-review baseline. Update them only after reviewing the
  // replacement asset and its entry in the art manifest.
  const assetHashes = Object.fromEntries([
    "assets/lab-cast.png",
    "assets/course/scene-c2-tray-bench.png",
    "assets/course/scene-c3-handling-desk.png"
  ].map((asset) => [
    asset,
    crypto.createHash("sha256").update(fs.readFileSync(path.join(webRoot, asset))).digest("hex")
  ]));
  assert.deepEqual(assetHashes, {
    "assets/lab-cast.png": "d35df645b4222c7d5a64cc457465202da16de2f2e5906722e66e721b307c7f5a",
    "assets/course/scene-c2-tray-bench.png": "057f0b58146f6364e31ce6b45ac1b05fe204f32dab4e5e9d11255619cd58f56d",
    "assets/course/scene-c3-handling-desk.png": "c54b92a126dd9269ecad6850858d81ce7836fec74325e62f28ecf529805131ba"
  });
});

function validC1Evidence() {
  return {
    evidence:{id:"c1-b09-records", title:"The B09 records"},
    rows:[{jar_id:"J-091", batch_id:"B09", tray_id:"T-A", detected:true}],
    explanation:{julia:"Julia kept the B09 rows.", case:"The records match the report."}
  };
}

function memoryStorage() {
  const values = new Map();
  const writes = [];
  return {
    writes,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes.push({key, value:String(value)}); values.set(key, String(value)); }
  };
}

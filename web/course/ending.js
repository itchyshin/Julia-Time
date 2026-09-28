/* Julia Time: the "Case closed" ending movie (docs/design/03-ending.md).
   Every number on this page comes from the game server's case_epilogue reply, and every word from
   ending-script.js. The pure functions are exported for the node tests. */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const words = node ? require("./ending-script.js") : root && root.JuliaTimeEndingScript;
  const client = node ? require("./course-client.js") : root && root.JuliaTimeCourseClient;
  const state = node ? require("./course-state.js") : root && root.JuliaTimeCourseState;
  const legacy = node ? require("./legacy-import.js") : root && root.JuliaTimeLegacyImport;
  const api = factory(words, client, state, legacy);
  if (node) module.exports = api;
  if (root) root.JuliaTimeEnding = api;
})(typeof window !== "undefined" ? window : null, function (words, client, courseState, legacyImport) {
  "use strict";

  const CASE_ID = "missing-fleas-v1";
  const SCENE_MS = 12000; // Shinichi, 2026-09-27: 7 s was too fast to read a scene's line and the player's code
  const REPLY_MS = 8000;
  const CODE_LINES = 8;
  const CODE_CHARS = 600;
  const IMAGES = Object.freeze({
    C1:"../assets/course/detail-c1-field-notebook.png", C2:"../assets/course/scene-c2-tray-bench.png",
    C3:"../assets/course/scene-c3-handling-desk.png", C4:"../assets/course/scene-c4-recheck-station.png",
    C5:"../assets/course/scene-c5-toto-card-table.png", C6:"../assets/course/scene-c6-evidence-board.png",
    final:"../assets/lab-cast.png"
  });
  // Each scene shows the accepted code of its chapter's last step.
  const CODE_STEP = Object.freeze({C1:"C1/select-records", C2:"C2/rates", C3:"C3/filter-disagreement",
    C4:"C4/plan-distinct-recheck", C5:"C5/event-frequency", C6:"C6/compatible-models"});
  const KNOWN_FUNCTIONS = Object.freeze(["filter", "subset", "groupby", "combine", "nrow", "sum", "length",
    "mean", "count", "leftjoin", "innerjoin", "sample", "sort", "select", "transform", "unique"]);
  const KNOWN_OPERATORS = Object.freeze([[".==", /\.==/], [".!=", /\.!=/], [".>=", /\.>=/], [".<=", /\.<=/], [".&", /\.&(?!&)/], ["./", /\.\//]]);

  function isCount(value) { return Number.isInteger(value) && value >= 0; }
  function isText(value) { return typeof value === "string" && value.length > 0 && value.length <= 80; }
  function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
  // "a", "a and b", "a, b and c": the same list style as the Case Board.
  function listText(items) {
    return items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }
  function plural(count, one, many) { return count.toLocaleString("en-US") + " " + (count === 1 ? one : many); }

  function validFacts(f) {
    if (!plain(f) || !plain(f.disagreement)) return false;
    const d = f.disagreement;
    return isText(f.batch_id) && isCount(f.n_jars) && isCount(f.n_detected) && f.n_detected <= f.n_jars
      && Array.isArray(f.trays) && f.trays.length > 0 && f.trays.every(t => plain(t) && isText(t.tray_id) && isCount(t.detected_n))
      && isText(d.tray_id) && isCount(d.notebook_detected) && isCount(d.sheet_detected) && isText(d.entry_status)
      && Array.isArray(f.eligible_jars) && f.eligible_jars.length > 0 && f.eligible_jars.every(isText) && isCount(f.recheck_size)
      && isCount(f.observed_count) && isCount(f.n_per_simulation) && isCount(f.n_simulations) && f.n_simulations > 0
      && isCount(f.matching_events) && f.matching_events <= f.n_simulations
      && Array.isArray(f.models) && f.models.length > 0
      && f.models.every(m => plain(m) && isText(m.model) && typeof m.p === "number" && isCount(m.lower) && isCount(m.upper) && typeof m.compatible === "boolean");
  }
  function epilogueRequest(requestId) {
    return {type:"case_epilogue", contract_version:1, case_id:CASE_ID, request_id:requestId};
  }
  function epilogueFacts(reply, requestId) {
    if (!plain(reply) || reply.type !== "case_epilogue" || reply.contract_version !== 1 || reply.case_id !== CASE_ID
      || typeof requestId !== "string" || reply.request_id !== requestId || !validFacts(reply.facts)
      || typeof reply.data_label !== "string" || !reply.data_label.trim()) return null;
    return {facts:reply.facts, dataLabel:reply.data_label};
  }

  function endingGate(storage, attempt) {
    const model = client.dashboardModel(client.loadCourseState(storage, attempt));
    const done = model.completion.complete;
    return {complete:done, open:model.completion.open, concepts:model.concepts,
      line:done ? "" : "The case closes when all six chapters are done. Still to do: " + client.chapterList(model.completion.open) + "."};
  }

  // The saved code as typed, without blank edges or shared indentation, at most eight lines.
  function codeFor(drafts, chapter) {
    const raw = plain(drafts) && typeof drafts[CODE_STEP[chapter]] === "string" ? drafts[CODE_STEP[chapter]] : "";
    const lines = raw.replace(/\s+$/, "").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    if (!lines.length) return null;
    const indent = Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^[ \t]*/)[0].length));
    const code = lines.slice(0, CODE_LINES).map(line => line.slice(indent)).join("\n");
    if (code.length > CODE_CHARS) return code.slice(0, CODE_CHARS) + "…";
    return lines.length > CODE_LINES ? code + "\n…" : code;
  }
  function captionFor(chapter, f) {
    const d = f.disagreement;
    if (chapter === "C1") return "You found the " + f.n_jars + " " + f.batch_id + " jars in the notebook. " + f.n_detected + " of them have springtails.";
    if (chapter === "C2") return "Jars with springtails, by tray: " + listText(f.trays.map(t => t.tray_id + " " + t.detected_n + (t.detected_n === 1 ? " jar" : " jars"))) + ".";
    if (chapter === "C3") return "Tray " + d.tray_id + ": the notebook counts " + d.notebook_detected + ", and Toto's typed table shows " + d.sheet_detected + ". On the paper, the box was " + d.entry_status + ".";
    if (chapter === "C4") return f.picked_jars
      ? "You let chance pick " + listText(f.picked_jars) + " from the " + f.eligible_jars.length + " jars that can still be opened. Nobody has looked yet."
      : "You planned a recheck of " + f.recheck_size + " jars from " + listText(f.eligible_jars) + ". Nobody has looked yet.";
    if (chapter === "C5") return f.observed_count + " of " + f.n_per_simulation + " jars had springtails. In " + f.n_simulations.toLocaleString("en-US")
      + " rounds of Toto's coin-flip cards, " + f.observed_count + " or more came up " + plural(f.matching_events, "time", "times") + ".";
    if (chapter === "C6") {
      const out = f.models.filter(m => !m.compatible).map(m => m.model), keep = f.models.filter(m => m.compatible).map(m => m.model);
      return (out.length ? "Outside its usual range: " + listText(out) + ". " : "Every story still fits. ")
        + (keep.length ? "Still fits: " + listText(keep) + "." : "No story fits.");
    }
    return "";
  }
  function buildScenes(facts, script, drafts) {
    return script.scenes.map((scene, index) => ({
      chapter:scene.chapter, number:index + 1, title:String(scene.title).replace("{logged}", String(facts.disagreement.sheet_detected)), image:IMAGES[scene.chapter], alt:scene.alt,
      caption:captionFor(scene.chapter, facts), speaker:scene.speaker, line:scene.line, code:codeFor(drafts, scene.chapter),
      aha:scene.chapter === "C3" ? {tray_id:facts.disagreement.tray_id, reported:facts.disagreement.notebook_detected,
        logged:facts.disagreement.sheet_detected, status:facts.disagreement.entry_status} : null
    }));
  }

  // The Julia functions and dot operators the learner actually typed, in the order they first appear.
  function featuring(drafts) {
    const found = [];
    for (const move of courseState.KNOWN_MOVES) {
      const code = plain(drafts) && typeof drafts[move.key] === "string" ? drafts[move.key].replace(/#.*$/gm, "") : "";
      const hits = [];
      for (const name of KNOWN_FUNCTIONS) { const at = code.search(new RegExp("(^|[^A-Za-z0-9_])" + name + "\\s*\\(")); if (at >= 0) hits.push([at, name]); }
      for (const [label, pattern] of KNOWN_OPERATORS) { const at = code.search(pattern); if (at >= 0) hits.push([at, label]); }
      hits.sort((a, b) => a[0] - b[0]).forEach(([, name]) => { if (!found.includes(name)) found.push(name); });
    }
    return found;
  }
  function buildFinal(facts, script, drafts, concepts, dataLabel) {
    const d = facts.disagreement;
    const notFitting = facts.models.filter(m => !m.compatible).map(m => m.model);
    return {
      stamp:script.final.stamp, headline:script.final.headline, answer:String(script.final.answer).replace("{logged}", String(d.sheet_detected)),
      reveal:"The notebook shows springtails in " + facts.n_detected + " of " + facts.n_jars + " " + facts.batch_id + " jars. Tray "
        + d.tray_id + "'s 0 was typed in for a box " + d.entry_status + " on the paper tally sheet, not an empty tray. The notebook's " + facts.n_detected + " of " + facts.n_jars + " is not unusual under a plain 50:50 guess. And the "
        + (notFitting.length ? listText(notFitting) : "no") + " story almost never gives " + facts.observed_count + " of " + facts.n_per_simulation + ".",
      stillOpen:"Still to do: the recheck of " + (facts.picked_jars ? listText(facts.picked_jars) + ", the jars chance picked"
        : facts.recheck_size + " jars from " + listText(facts.eligible_jars)) + ". It is the one check only the jars can give.",
      speaker:script.final.speaker, line:script.final.line, punSpeaker:script.final.punSpeaker, punSignOff:script.final.punSignOff, wellDone:script.final.wellDone,
      image:IMAGES.final, alt:script.final.alt, investigators:script.final.investigators.slice(),
      featuring:featuring(drafts), concepts:Array.isArray(concepts) ? concepts.slice() : [], dataLabel:dataLabel || ""
    };
  }

  // Chapters 1 and 2 are older pages that keep their code under their own storage names
  // (legacy-import.js chapterDrafts); every later chapter saves challenge drafts in course-state.
  function learnerDrafts(storage, attempt) {
    // Same rule as course-client.js restorableDrafts: a shared-record C1/C2 draft is never what those pages restore.
    const drafts = {};
    for (const [key, value] of Object.entries(courseState.readChallengeDrafts(storage, attempt) || {})) if (!/^C[12]\//.test(key)) drafts[key] = value;
    return Object.assign(drafts, legacyImport ? legacyImport.chapterDrafts(storage, attempt) : {});
  }
  // The code Julia accepted for each step. A save from before accepted code was kept falls back to its draft.
  function learnerCode(storage, attempt) {
    const accepted = typeof courseState.readAcceptedCode === "function" ? courseState.readAcceptedCode(storage, attempt) : {};
    return Object.assign(learnerDrafts(storage, attempt), accepted);
  }

  // The three jars chance picked in Chapter 4, from its saved result (null when that save has none).
  function pickedJars(storage, attempt) {
    let saved = [];
    try { saved = courseState.readEvidence(storage, attempt); } catch (_) { saved = []; }
    const item = saved.find(entry => entry.chapter === "C4" && entry.move_id === "plan-distinct-recheck");
    return item ? client.drawnJars(item) : null;
  }
  // The facts plus the drawn jars, only when they are the recheck's size and all on the server's eligible list;
  // otherwise the facts unchanged, and the ending names the whole eligible list as before.
  function withPickedJars(facts, picked) {
    const fits = Array.isArray(picked) && picked.length === facts.recheck_size && new Set(picked).size === picked.length
      && picked.every(id => facts.eligible_jars.includes(id));
    return fits ? Object.assign({}, facts, {picked_jars:picked.slice()}) : facts;
  }

  // index === count is the finale.
  function createPlayer(count, reducedMotion) { return {index:0, count, playing:!reducedMotion}; }
  function playerStep(player, action) {
    const last = player.count, at = Math.max(0, Math.min(player.index, last));
    if (action === "tick") return player.playing && at < last ? Object.assign({}, player, {index:at + 1, playing:at + 1 < last}) : player;
    if (action === "next") return Object.assign({}, player, {index:Math.min(at + 1, last), playing:at + 1 < last && player.playing});
    if (action === "back") return Object.assign({}, player, {index:Math.max(at - 1, 0)});
    if (action === "skip") return Object.assign({}, player, {index:last, playing:false});
    if (action === "toggle") return at >= last ? player : Object.assign({}, player, {playing:!player.playing});
    if (action === "replay") return Object.assign({}, player, {index:0, playing:true});
    return player;
  }

  const FILE_MESSAGE = "Open this page from the Julia Time launcher: the ending needs the local game running.";
  const NO_REPLY = "The game did not answer. Keep the Julia Time window open, then reload this page.";
  const OLD_GAME = "This copy of Julia Time was started before the ending existed. Close the Julia Time window, start the game again, then reload this page.";

  function text(node, value) { if (node) node.textContent = value || ""; }
  // Display only: keep a record name (letter, hyphen, code) and "p = value" on one line.
  function keepTogether(value) { return String(value).replace(/([A-Z])-(?=[A-Z0-9])/g, "$1\u2011").replace(/\bp = /g, "p\u00a0=\u00a0"); }
  // The Chapter 3 card: notebook, paper sheet, Toto's typed table, report, one line each (r3 story F6).
  function ahaLines(script, aha) {
    const fill = value => String(value).replace(/\{(reported|status|logged)\}/g, (_, name) => String(aha[name]));
    return [script.aha.report, script.aha.paper, script.aha.log, script.aha.copied].map(fill);
  }
  function sceneNode(doc, scene, animate, script) {
    const figure = doc.createElement("figure"), image = doc.createElement("img"), body = doc.createElement("figcaption");
    const eyebrow = doc.createElement("p"), title = doc.createElement("h3"), caption = doc.createElement("p"), line = doc.createElement("blockquote");
    figure.className = "ending-scene" + (animate ? " ending-in" : "");
    image.src = scene.image; image.alt = scene.alt;
    eyebrow.className = "eyebrow"; text(eyebrow, "Chapter " + scene.number);
    text(title, scene.title);
    caption.className = "ending-caption"; text(caption, keepTogether(scene.caption));
    body.append(eyebrow, title, caption);
    if (scene.aha) {
      const aha = doc.createElement("div");
      aha.className = "aha" + (animate ? " aha-play" : "");
      ahaLines(script, scene.aha).forEach((value, index) => {
        const item = doc.createElement("span");
        if (index === 1 || index === 3) item.className = "aha-note";
        text(item, value); aha.append(item);
      });
      body.append(aha);
    }
    line.className = "ending-line"; text(line, scene.speaker + ": “" + scene.line + "”");
    body.append(line);
    if (scene.code) {
      const box = doc.createElement("div"), label = doc.createElement("p"), pre = doc.createElement("pre"), code = doc.createElement("code");
      box.className = "ending-code"; label.className = "eyebrow"; text(label, "Your code"); text(code, scene.code);
      pre.append(code); box.append(label, pre); body.append(box);
    }
    figure.append(image, body);
    return figure;
  }
  function fillFinale(doc, finale, animate) {
    const $ = id => doc.getElementById(id);
    const root = $("ending-finale");
    root.classList.remove("finale-play");
    if (animate) { void root.offsetWidth; root.classList.add("finale-play"); }
    text($("ending-stamp"), finale.stamp); text($("ending-headline"), finale.headline); text($("ending-answer"), finale.answer || ""); text($("ending-reveal"), keepTogether(finale.reveal));
    text($("ending-final-line"), finale.speaker + ": “" + finale.line + "”");
    const pun = $("ending-pun");
    if (pun) text(pun, finale.punSignOff ? finale.punSpeaker + ": “" + finale.punSignOff + "”" : "");
    text($("ending-still-open"), keepTogether(finale.stillOpen));
    text($("ending-well-done"), finale.wellDone);
    const image = $("ending-final-image"); image.src = finale.image; image.alt = finale.alt;
    text($("credits-investigators"), finale.investigators.join(" · "));
    const featuring = $("credits-featuring"); featuring.replaceChildren();
    for (const name of finale.featuring) { const item = doc.createElement("li"), code = doc.createElement("code"); text(code, name); item.append(code); featuring.append(item); }
    featuring.hidden = $("credits-featuring-label").hidden = finale.featuring.length === 0;
    const concepts = $("credits-concepts"); concepts.replaceChildren();
    for (const idea of finale.concepts) { const item = doc.createElement("li"); text(item, idea); concepts.append(item); }
    text($("credits-data"), finale.dataLabel);
  }
  function render(doc, win, parsed, drafts, concepts, reduced) {
    const $ = id => doc.getElementById(id);
    const scenes = buildScenes(parsed.facts, words, drafts);
    const finale = buildFinal(parsed.facts, words, drafts, concepts, parsed.dataLabel);
    const list = $("ending-all-list"); list.replaceChildren(...scenes.map(scene => sceneNode(doc, scene, false, words)));
    $("ending-print").onclick = () => win.print();
    const note = $("ending-data-label"); text(note, parsed.dataLabel); note.hidden = false;
    fillFinale(doc, finale, false);  // filled now so printing mid-movie still prints the ending
    if (reduced) { fillFinale(doc, finale, false); $("ending-all").hidden = false; $("ending-finale").hidden = false; $("ending-replay").hidden = true; return; }
    let player = createPlayer(scenes.length, false), timer = null, shown = -1;
    function stop() { if (timer) { win.clearInterval(timer); timer = null; } }
    function draw() {
      const atEnd = player.index >= scenes.length;
      $("ending-movie").hidden = atEnd; $("ending-finale").hidden = !atEnd;
      if (atEnd) { stop(); shown = -1; fillFinale(doc, finale, true); win.scrollTo(0, 0); $("ending-headline").focus({preventScroll:true}); return; }
      // Pause and Play only change the button; a new scene fades in only when the scene changes.
      if (player.index !== shown) { $("ending-stage").replaceChildren(sceneNode(doc, scenes[player.index], true, words)); shown = player.index; }
      text($("ending-progress"), "Scene " + (player.index + 1) + " of " + scenes.length + ": " + scenes[player.index].title);
      text($("ending-toggle"), player.playing ? "Pause" : "Play");
      $("ending-back").disabled = player.index === 0;
    }
    function act(action) { player = playerStep(player, action); draw(); stop(); if (player.playing) timer = win.setInterval(() => act("tick"), SCENE_MS); }
    $("ending-back").onclick = () => act("back"); $("ending-next").onclick = () => act("next");
    $("ending-toggle").onclick = () => act("toggle"); $("ending-skip").onclick = () => act("skip");
    $("ending-replay").onclick = () => { act("replay"); $("ending-toggle").focus(); };
    act("start");
  }
  function init() {
    const doc = document, win = window, $ = id => doc.getElementById(id);
    const raw = new URLSearchParams(win.location.search).get("attempt") || "";
    const attempt = courseState.attemptId(raw) ? raw : "";
    for (const link of doc.querySelectorAll("[data-board-link]")) link.href = "index.html" + (attempt ? "?attempt=" + encodeURIComponent(attempt) : "");
    $("ending-speed-lab").href = client.speedLabDestination(attempt);
    let storage = null; try { storage = win.localStorage; } catch (_) { storage = null; }
    const gate = endingGate(storage, attempt);
    const status = $("ending-status");
    if (!gate.complete) { status.hidden = true; $("ending-locked").hidden = false; text($("ending-open"), gate.line); return; }
    if (win.location.protocol === "file:" || !win.WebSocket) { text(status, FILE_MESSAGE); return; }
    const drafts = learnerCode(storage, attempt), picked = pickedJars(storage, attempt);
    const reduced = Boolean(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const requestId = "ending-" + Date.now().toString(36);
    let socket = null, done = false;
    const fail = () => { if (!done) { done = true; text(status, NO_REPLY); try { socket.close(); } catch (_) {} } };
    const timer = win.setTimeout(fail, REPLY_MS);
    try { socket = new win.WebSocket((win.location.protocol === "https:" ? "wss://" : "ws://") + win.location.host + "/ws"); } catch (_) { fail(); return; }
    socket.addEventListener("open", () => socket.send(JSON.stringify(epilogueRequest(requestId))));
    socket.addEventListener("error", () => { win.clearTimeout(timer); fail(); });
    socket.addEventListener("message", event => {
      if (done) return;
      let reply = null; try { reply = JSON.parse(event.data); } catch (_) { return; }
      const parsed = epilogueFacts(reply, requestId);
      if (parsed) parsed.facts = withPickedJars(parsed.facts, picked);
      if (!parsed) { if (reply && reply.type === "error") { win.clearTimeout(timer); done = true; text(status, OLD_GAME); try { socket.close(); } catch (_) {} } return; }
      done = true; win.clearTimeout(timer); try { socket.close(); } catch (_) {}
      status.hidden = true;
      render(doc, win, parsed, drafts, gate.concepts, reduced);
    });
  }

  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
  return {CASE_ID, SCENE_MS, REPLY_MS, IMAGES, ahaLines, epilogueRequest, epilogueFacts, endingGate, pickedJars, withPickedJars, buildScenes, buildFinal, learnerDrafts, learnerCode, keepTogether,
    featuring, listText, createPlayer, playerStep, init};
});

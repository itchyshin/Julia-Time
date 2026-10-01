/* Julia Time lesson screen: a little delight, never in the way (0.5 round 3).
   It only watches the page lesson.js draws (a MutationObserver on the feedback line, the screen and the step), so it can
   be removed and the lesson still works. Nothing here waits for anything: no click is blocked, no step is held back.
     1. A passed run: a short pop on the verdict, a ring on the result, a soft chime. The chime obeys the SAME saved
        setting as the target range (SOUND_KEY), on by default, and the bar has one Sound button for it.
     2. The lesson end page: one of the four characters says one short line, using the cast picture.
     3. A chapter exam's end page: the chapter's picture arrives above the finding, like a moment in a story.
     4. A step or screen change fades in, under 250 ms.
   Under prefers-reduced-motion there is no motion at all: the classes are never added. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JuliaTimeDelight = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // The same key the target range uses (web/lesson-range.js): "off" when muted.
  const SOUND_KEY = "julia-time:range:sound:v1";
  // Each chapter's picture (the same files the chapter openings use), cropped to a wide band: where to centre it (x, y in
  // percent) and how far to zoom in (z), so the faces and not the empty wall fill the band.
  const ART = {
    1: { src: "assets/course/detail-c1-field-notebook.png", x: 100, y: 60, z: 1.3 },
    2: { src: "assets/course/scene-c2-tray-bench.png", x: 100, y: 22, z: 1.3 },
    3: { src: "assets/course/scene-c3-handling-desk.png", x: 100, y: 22, z: 1.3 },
    4: { src: "assets/course/scene-c4-recheck-station.png", x: 100, y: 22, z: 1.3 },
    5: { src: "assets/course/scene-c5-toto-card-table.png", x: 100, y: 22, z: 1.3 },
    6: { src: "assets/course/scene-c6-evidence-board.png", x: 100, y: 22, z: 1.3 }
  };
  // Where each character's face centre sits in assets/lab-cast.png (1662 x 946), as a fraction of its width and height,
  // and how far to zoom in (round 4, R3-34: Eddie's and Momo's hair and collar had filled the disc; a closer crop on the
  // face, and a lift in Eddie's brightness, makes him as clear as Itchy). The third number is the zoom.
  const FACES = { Itchy: [0.265, 0.35, 6], Toto: [0.43, 0.32, 6], Momo: [0.595, 0.39, 7.5], Eddie: [0.795, 0.405, 8.5] };
  // Lines the story bible already gives these four. They state no new fact and no case fact.
  const LINES = {
    Itchy: ["A claim is only as good as the check behind it.", "Let chance pick, and pick fairly."],
    Eddie: ["What did we keep, and what did we leave out?", "Line up the same tray on both, then look for the odd one out."],
    Toto: ["My cards can answer that. Draw, write it down, shuffle, repeat."],
    Momo: ["That is a pattern, not a culprit."]
  };
  // Who speaks at the end of lesson N or exam N (the chapter's own voice).
  const SPEAKER = { 1: ["Itchy", 0], 2: ["Eddie", 0], 3: ["Eddie", 1], 4: ["Itchy", 1], 5: ["Toto", 0], 6: ["Momo", 0] };

  // "lesson3" or "exam3" -> {kind, n}; anything else (the range, a missing id) -> null.
  function parseId(id) {
    const m = /^(lesson|exam)([1-6])$/.exec(String(id || ""));
    return m ? { kind: m[1], n: Number(m[2]) } : null;
  }
  function speakerFor(id) {
    const p = parseId(id); if (!p) return null;
    const s = SPEAKER[p.n];
    return { name: s[0], line: LINES[s[0]][s[1]], face: FACES[s[0]] };
  }
  // On a chapter exam's end page the Continue button waits until the finding and the character's line have been read:
  // it moves to just after the last of them. A lesson's end page keeps the button right under the title.
  function placeGoAfterReveal(go, finding, row) {
    const anchor = row || finding;
    if (!go || !anchor || !anchor.parentNode) return false;
    anchor.parentNode.insertBefore(go, anchor.nextSibling);
    return true;
  }
  function artFor(id) { const p = parseId(id); return p && p.kind === "exam" ? ART[p.n] : null; }
  function wordCount(s) { return String(s).trim().split(/\s+/).length; }
  // Motion is allowed unless the player asked for less.
  function motionOk(win) {
    try { return !(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return true; }
  }
  // Sound is on unless the saved range setting says "off". A broken store counts as on.
  function soundOn(storage) {
    try { return !(storage && storage.getItem(SOUND_KEY) === "off"); } catch (e) { return true; }
  }
  function setSound(storage, on) { try { if (storage) storage.setItem(SOUND_KEY, on ? "on" : "off"); } catch (e) { /* not saved */ } }
  // A pass is celebrated once per run: it needs the player to have pressed Run (armed), a feedback line that now says ok,
  // and no celebration yet for this arming.
  function shouldCelebrate(armed, feedbackClass, text) {
    return !!armed && /(^|\s)ok(\s|$)/.test(String(feedbackClass || "")) && !!String(text || "").trim();
  }

  // The chime is for a checkpoint (the label above the task says so); the other steps get the quiet pop only.
  function isCheckpoint(label) { return String(label || "").trim().toLowerCase() === "checkpoint"; }

  // A soft two-note chime made with Web Audio (no files); a browser that blocks audio stays silent.
  function chime(Ctor) {
    if (!Ctor) return false;
    try {
      const ac = new Ctor();
      if (ac.state === "suspended" && ac.resume) { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
      const t0 = ac.currentTime + 0.02;
      [[784, 0], [1174.7, 0.09]].forEach((n) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(n[0], t0 + n[1]);
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(0.05, t0 + n[1] + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + 0.32);
        o.connect(g); g.connect(ac.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + 0.36);
      });
      setTimeout(() => { try { ac.close(); } catch (e) { /* done */ } }, 900);
      return true;
    } catch (e) { return false; }
  }

  function init(win) {
    const doc = win.document;
    const $ = (id) => doc.getElementById(id);
    const app = $("app"), fb = $("feedback");
    if (!app || !fb || !win.MutationObserver) return;
    let storage = null; try { storage = win.localStorage; } catch (e) { storage = null; }
    const Ctor = win.AudioContext || win.webkitAudioContext || null;
    const lessonId = new URLSearchParams(win.location.search || "").get("lesson") || "";
    let armed = false;

    // Replay a CSS animation class: take it off, force a layout, put it on, take it off when it is done.
    function play(node, cls, ms) {
      if (!node || !motionOk(win)) return;
      node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
      win.setTimeout(() => node.classList.remove(cls), ms);
    }

    // ---- the Sound button in the bar (one setting, shared with the range) ----
    const sb = doc.createElement("button");
    sb.type = "button"; sb.id = "delight-sound"; sb.className = "navlink pill";
    function paintSound() {
      const on = soundOn(storage);
      sb.textContent = on ? "Sound: on" : "Sound: off";
      sb.setAttribute("aria-pressed", String(on));
      sb.setAttribute("aria-label", on ? "Sound is on. Press to mute." : "Sound is off. Press to turn it on.");
    }
    sb.addEventListener("click", () => { setSound(storage, !soundOn(storage)); paintSound(); });
    const navRight = doc.querySelector(".nav-right");
    if (navRight) navRight.insertBefore(sb, navRight.firstChild);
    paintSound();
    // The range draws its own Sound button under its editor; one is enough on that screen.
    function syncSoundButton() { sb.hidden = app.getAttribute("data-screen") === "range" || lessonId === "range"; if (!sb.hidden) paintSound(); }

    // ---- 1. a pass ----
    if ($("run")) $("run").addEventListener("click", () => { armed = true; });
    const code = $("code");
    if (code) code.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") armed = true; });
    new win.MutationObserver(() => {
      if (!shouldCelebrate(armed, fb.className, fb.textContent)) return;
      armed = false;
      play(fb, "jt-win", 520);
      play($("next"), "jt-nudge", 700);
      const kl = $("kind-label");
      if (soundOn(storage) && kl && !kl.hidden && isCheckpoint(kl.textContent)) chime(Ctor);
    }).observe(fb, { attributes: true, attributeFilter: ["class"], childList: true, characterData: true, subtree: true });

    // ---- 4. a step or screen change fades in; a new step also forgets an old run ----
    function fade(node) { play(node, "jt-in", 240); }
    const lessonSec = $("screen-lesson");
    let lastCid = lessonSec ? lessonSec.getAttribute("data-cid") : null;
    if (lessonSec) new win.MutationObserver(() => {
      const cid = lessonSec.getAttribute("data-cid");
      if (cid !== lastCid) { lastCid = cid; armed = false; fade(lessonSec); }
    }).observe(lessonSec, { attributes: true, attributeFilter: ["data-cid"] });

    // ---- 2 and 3. the end page ----
    const endSec = $("screen-end");
    function dress() {
      if (!endSec || endSec.querySelector("#delight-end")) return;
      const box = doc.createElement("div"); box.id = "delight-end";
      const art = artFor(lessonId), who = speakerFor(lessonId);
      if (art) {
        const fig = doc.createElement("div"); fig.className = "delight-art";
        const img = doc.createElement("img");
        img.src = art.src; img.alt = "";
        img.style.objectPosition = art.x + "% " + art.y + "%"; img.style.transformOrigin = art.x + "% " + art.y + "%";
        img.style.setProperty("--z", art.z);
        fig.appendChild(img); box.appendChild(fig);
      }
      let row = null;
      if (who) {
        row = doc.createElement("div"); row.className = "delight-say";
        const face = doc.createElement("span"); face.className = "delight-face"; face.setAttribute("aria-hidden", "true");
        face.style.setProperty("--fx", who.face[0]); face.style.setProperty("--fy", who.face[1]); face.style.setProperty("--zoom", who.face[2] || 6);
        if (who.name === "Eddie") face.className += " lift";
        const q = doc.createElement("p");
        const nm = doc.createElement("strong"); nm.textContent = who.name + ": ";
        q.appendChild(nm); q.appendChild(doc.createTextNode("“" + who.line + "”"));
        row.appendChild(face); row.appendChild(q);
      }
      if (!box.childNodes.length && !row) return;
      const title = $("end-title");
      title.parentNode.insertBefore(box, title.nextSibling);
      if (row) { row.id = "delight-say"; const fnd = $("end-finding"); fnd.parentNode.insertBefore(row, fnd.nextSibling); }
      if (parseId(lessonId) && parseId(lessonId).kind === "exam") {
        // Moving the Continue button drops the keyboard's place: put it back when the button had it.
        const go = $("end-go"), had = !!(go && doc.activeElement && go.contains && go.contains(doc.activeElement));
        placeGoAfterReveal(go, $("end-finding"), row);
        const btn = $("end-go-btn");
        if (had && btn && btn.focus) btn.focus();
      }
      if (art) endSec.setAttribute("data-reveal", "1");
      if (motionOk(win)) { endSec.classList.add("jt-reveal"); win.setTimeout(() => endSec.classList.remove("jt-reveal"), 700); }
    }
    new win.MutationObserver(() => {
      syncSoundButton();
      const s = app.getAttribute("data-screen");
      if (s === "end") { dress(); fade(endSec); }
      else if (s === "start") fade($("screen-start"));
      else if (s === "list") fade($("screen-list"));
    }).observe(app, { attributes: true, attributeFilter: ["data-screen"] });
    syncSoundButton();
    if (app.getAttribute("data-screen") === "end") dress();
  }

  if (typeof window !== "undefined" && window.document && !(typeof module === "object" && module.exports)) {
    const go = () => init(window);
    if (window.document.readyState === "loading") window.document.addEventListener("DOMContentLoaded", go); else go();
  }
  return { SOUND_KEY, ART, FACES, LINES, SPEAKER, parseId, speakerFor, placeGoAfterReveal, artFor, wordCount, motionOk, soundOn, setSound, shouldCelebrate, isCheckpoint, chime, init };
});

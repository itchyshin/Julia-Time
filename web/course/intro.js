/* Julia Time: the short reader-paced intro movie shown to a brand-new player before Chapter 1.
   Every word comes from intro-script.js. No timer, no auto-advance: the reader controls the pace.
   The pure functions (createPlayer, playerStep) are exported for the node tests. */
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const words = node ? require("./intro-script.js") : root && root.JuliaTimeIntroScript;
  const client = node ? require("./course-client.js") : root && root.JuliaTimeCourseClient;
  const state = node ? require("./course-state.js") : root && root.JuliaTimeCourseState;
  const api = factory(words, client, state);
  if (node) module.exports = api;
  if (root) root.JuliaTimeIntro = api;
})(typeof window !== "undefined" ? window : null, function (words, client, courseState) {
  "use strict";

  // index runs 0..count-1: the currently shown scene. There is no separate finale step; the last
  // scene itself carries the "Start Chapter 1" button.
  function createPlayer(count) { return {index:0, count}; }
  function playerStep(player, action) {
    const last = player.count - 1;
    if (action === "next") return Object.assign({}, player, {index:Math.min(player.index + 1, last)});
    if (action === "back") return Object.assign({}, player, {index:Math.max(player.index - 1, 0)});
    if (action === "skip") return Object.assign({}, player, {index:last});
    return player;
  }

  // Said by the polite live line each time the scene changes, as the ending does.
  function sceneAnnouncement(number, count, title) { return "Scene " + number + " of " + count + ": " + title; }
  // A focused Next hides itself on the last scene, and a focused Back is disabled on scene 1; either
  // would drop focus to the page. Returns the id that should take focus instead, or null.
  function focusHandoff(focusedId, index, count) {
    if (focusedId === "intro-next" && index === count - 1) return "intro-start";
    if (focusedId === "intro-back" && index === 0) return "intro-next";
    return null;
  }

  function chapter1Destination(attempt) {
    const dest = client && typeof client.adapterDestination === "function" ? client.adapterDestination("C1", attempt) : null;
    return dest || "../index.html";
  }

  function text(node, value) { if (node) node.textContent = value || ""; }
  function sceneNode(doc, scene, number, animate) {
    const figure = doc.createElement("figure"), image = doc.createElement("img"), body = doc.createElement("figcaption");
    const eyebrow = doc.createElement("p"), title = doc.createElement("h3"), caption = doc.createElement("p");
    figure.className = "ending-scene" + (animate ? " ending-in" : "");
    image.src = scene.image; image.alt = scene.alt;
    eyebrow.className = "eyebrow"; text(eyebrow, "Scene " + number + " of " + words.scenes.length);
    text(title, scene.title);
    caption.className = "ending-caption"; text(caption, scene.caption);
    body.append(eyebrow, title, caption);
    if (scene.line) {
      const line = doc.createElement("blockquote");
      line.className = "ending-line"; text(line, scene.speaker + ": “" + scene.line + "”");
      body.append(line);
    }
    figure.append(image, body);
    return figure;
  }

  function render(doc, win, attempt) {
    const $ = id => doc.getElementById(id);
    const reduced = Boolean(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
    text($("intro-heading"), words.heading);
    text($("intro-back"), words.buttons.back);
    text($("intro-skip"), words.buttons.skip);
    const startHref = chapter1Destination(attempt);
    $("intro-skip").href = startHref;
    let player = createPlayer(words.scenes.length), shown = -1;
    function draw(animate) {
      const scene = words.scenes[player.index];
      if (player.index !== shown || !animate) {
        $("intro-stage").replaceChildren(sceneNode(doc, scene, player.index + 1, animate)); shown = player.index;
        text($("intro-progress"), sceneAnnouncement(player.index + 1, player.count, scene.title));
      }
      const focused = doc.activeElement && doc.activeElement.id;
      $("intro-back").disabled = player.index === 0;
      const atLast = player.index === player.count - 1;
      $("intro-next").hidden = atLast;
      $("intro-start").hidden = !atLast;
      $("intro-skip").hidden = atLast; // on the last scene Start and Skip go to the same place
      if (atLast) $("intro-start").href = startHref;
      const handoff = focusHandoff(focused, player.index, player.count);
      if (handoff) $(handoff).focus();
      // A taller or shorter scene can push the focused control off a phone screen; bring it back,
      // again once the new picture has loaded and taken its height.
      keepControlInView();
      const picture = $("intro-stage").querySelector("img");
      if (picture && !picture.complete) picture.addEventListener("load", keepControlInView, {once:true});
    }
    function keepControlInView() {
      const now = doc.activeElement;
      if (now && now.closest && now.closest(".ending-controls") && now.scrollIntoView) now.scrollIntoView({block:"nearest"});
    }
    function act(action, animate) { player = playerStep(player, action); draw(!reduced && animate !== false); }
    $("intro-back").onclick = () => act("back");
    $("intro-next").onclick = () => act("next");
    draw(false);
  }

  function init() {
    const doc = document, win = window;
    const raw = new URLSearchParams(win.location.search).get("attempt") || "";
    const attempt = courseState.attemptId(raw) ? raw : "";
    for (const link of doc.querySelectorAll("[data-board-link]")) link.href = "index.html" + (attempt ? "?attempt=" + encodeURIComponent(attempt) : "");
    render(doc, win, attempt);
  }

  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
  return {createPlayer, playerStep, sceneAnnouncement, focusHandoff, chapter1Destination, init};
});

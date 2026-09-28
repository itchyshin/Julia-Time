(function (root) {
  "use strict";
  function init() {
    const client = root.JuliaTimeCourseClient;
    if (!client) return;
    const params = new URLSearchParams(root.location.search);
    const chapter = params.get("chapter") || "";
    const attempt = params.get("attempt") || "";
    const move = params.get("move") || "";
    const destination = client.legacyDestination(chapter, attempt, move);
    const title = document.getElementById("route-title");
    const status = document.getElementById("route-status");
    const link = document.getElementById("legacy-link");
    if (!destination) {
      text(title, "Choose a chapter from the Case Board");
      text(status, "Choose one of the six playable chapters from the Case Board.");
      link.href = "index.html";
      text(link, "Return to Case Board →");
      link.hidden = false;
      return;
    }
    const name = chapter === "C1" ? "Chapter 1: the report and the notebook" : chapter === "C2" ? "Chapter 2: count by tray" : chapter === "C3" ? "Chapter 3: where did the 0 come from?" : chapter === "C4" ? "Chapter 4: plan a fair recheck" : chapter === "C5" ? "Chapter 5: what would plain chance give?" : "Chapter 6: are the springtails dying out?";
    text(title, "Opening " + name);
    text(status, "Your chapter is opening. If it does not appear in a moment, use the link below.");
    link.href = destination;
    text(link, "Open " + name + " →");
    root.setTimeout(function () { root.location.replace(destination); }, 60);
  }
  function text(node, value) { node.textContent = value || ""; }
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : null);

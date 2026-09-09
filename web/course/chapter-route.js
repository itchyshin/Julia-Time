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
    const name = chapter === "C1" ? "Chapter 1: the disputed batch" : chapter === "C2" ? "Chapter 2: locate the pattern" : chapter === "C3" ? "Chapter 3: check the report" : chapter === "C4" ? "Chapter 4: plan a recheck" : chapter === "C5" ? "Chapter 5: test a suspicion" : "Chapter 6: compare explanations";
    text(title, "Opening " + name);
    text(status, "This keeps the established chapter page authoritative. If it does not open automatically, use the link below.");
    link.href = destination;
    text(link, "Open " + name + " →");
    root.setTimeout(function () { root.location.replace(destination); }, 60);
  }
  function text(node, value) { node.textContent = value || ""; }
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : null);

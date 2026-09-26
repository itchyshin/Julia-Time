/* Chapter progress bar: says whether this chapter is solved and names earlier chapters that are not.
 * Every chapter stays open; this only makes the state visible (2026-09-25 playtest: "not clear why we can
 * progress to the next one without getting evidence"). Include after course-state.js with
 * <script defer src="course/progress-banner.js" data-chapter="C3"></script>. No network access. */
(function (root, factory) {
  const state = typeof module === "object" && module.exports ? require("./course-state.js") : root && root.JuliaTimeCourseState;
  const api = factory(state);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeProgressBanner = api;
  if (typeof document !== "undefined") {
    const script = document.currentScript;
    document.addEventListener("DOMContentLoaded", () => api.init(script && script.dataset ? script.dataset.chapter : ""));
  }
})(typeof window !== "undefined" ? window : null, function (courseState) {
  "use strict";

  const CHAPTERS = ["C1", "C2", "C3", "C4", "C5", "C6"];
  const CASE_SOLVED = "Case closed: all 6 chapters complete.";

  function savedKeys(storage, attempt) {
    try { return new Set(courseState.acceptedMoves(courseState.readCourseState(storage, attempt)).map(move => move.key)); } catch (_) { return new Set(); }
  }
  function chapterSolved(keys, chapter) {
    const steps = courseState.KNOWN_MOVES.filter(move => move.chapter === chapter);
    return steps.length > 0 && steps.every(move => keys.has(move.key));
  }
  function chapterList(chapters) {
    const numbers = chapters.map(chapter => chapter.slice(1));
    if (numbers.length === 1) return "Chapter " + numbers[0];
    return "Chapters " + numbers.slice(0, -1).join(", ") + " and " + numbers[numbers.length - 1];
  }
  function chapterHref(chapter, attempt) {
    const file = chapter === "C1" ? "index.html" : "chapter" + chapter.slice(1) + ".html";
    return file + (courseState.attemptId(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }

  function bannerModel(storage, attempt, chapter) {
    const keys = savedKeys(storage, attempt);
    const number = chapter.slice(1);
    const solved = chapterSolved(keys, chapter);
    const all = CHAPTERS.every(item => chapterSolved(keys, item));
    const openEarlier = CHAPTERS.slice(0, CHAPTERS.indexOf(chapter)).filter(item => !chapterSolved(keys, item));
    // A multi-step chapter counts its saved steps, so the bar never says "not solved yet" right under an
    // accepted step (round-2 screen-bot, 2026-09-25).
    const steps = courseState.KNOWN_MOVES.filter(move => move.chapter === chapter);
    const saved = steps.map((move, index) => keys.has(move.key) ? index + 1 : 0).filter(Boolean);
    const next = steps.findIndex(move => !keys.has(move.key)) + 1;
    const savedList = saved.length === 1 ? "step " + saved[0] : "steps " + saved.slice(0, -1).join(", ") + " and " + saved[saved.length - 1];
    let hasEvidence = true;
    try { hasEvidence = courseState.readEvidence(storage, attempt).some(item => item.chapter === chapter); } catch (_) {}
    const status = all ? CASE_SOLVED
      : solved && !hasEvidence ? "Chapter " + number + ": ✓ solved on an earlier visit. Run it again to see its evidence here."
      : solved ? "Chapter " + number + ": ✓ solved in this browser."
      : saved.length ? "Chapter " + number + ": " + savedList + " of " + steps.length + " saved. Solve step " + next + " to finish this chapter."
      : "Chapter " + number + ": not solved yet. It counts once Julia accepts your answer and it is saved.";
    const earlier = openEarlier.length
      ? chapterList(openEarlier) + (openEarlier.length === 1 ? " is" : " are") + " not solved yet. You can explore here, but the case needs that evidence too."
      : "";
    const earlierLink = openEarlier.length ? {chapter:openEarlier[0], href:chapterHref(openEarlier[0], attempt), label:"Go to Chapter " + openEarlier[0].slice(1) + " →"} : null;
    return {solved, complete:all, status, earlier, earlierLink};
  }

  const STYLE = ".jt-progress{margin:0;padding:.55rem 1rem;border-bottom:2px solid #cdbf9e;background:#fffaf0;color:#143242;font:16px/1.45 system-ui,-apple-system,\"Segoe UI\",sans-serif}" +
    ".jt-progress p{margin:.1rem 0}.jt-progress strong{font-weight:700}.jt-progress--solved{background:#e3f1ef;border-color:#18777a}" +
    ".jt-progress a{color:#143242;font-weight:600;margin-left:.4rem}";

  function init(chapter) {
    if (!CHAPTERS.includes(chapter) || typeof document === "undefined") return;
    let storage = null;
    try { storage = root.localStorage; } catch (_) {}
    const attempt = new URLSearchParams(location.search).get("attempt") || "";
    const style = document.createElement("style"); style.textContent = STYLE; document.head.append(style);
    const bar = document.createElement("section");
    bar.className = "jt-progress"; bar.setAttribute("aria-label", "Case progress"); bar.setAttribute("role", "status");
    document.body.prepend(bar);
    let shown = "";
    function draw() {
      const model = bannerModel(storage, attempt, chapter);
      const signature = JSON.stringify(model);
      if (signature === shown) return;
      shown = signature;
      bar.classList.toggle("jt-progress--solved", model.solved);
      const status = document.createElement("p"), strong = document.createElement("strong");
      strong.textContent = model.status; status.append(strong);
      bar.replaceChildren(status);
      if (model.earlier) {
        const earlier = document.createElement("p"); earlier.textContent = model.earlier;
        const link = document.createElement("a"); link.href = model.earlierLink.href; link.textContent = model.earlierLink.label;
        earlier.append(link); bar.append(earlier);
      }
    }
    draw();
    // course-state.js announces every saved write, so the bar changes the moment a chapter is solved; the
    // storage event covers other tabs, and a slow poll covers anything else.
    window.addEventListener("juliatime:saved", draw);
    window.addEventListener("storage", draw);
    setInterval(draw, 5000);
  }

  const root = typeof window !== "undefined" ? window : null;
  return {CASE_SOLVED, bannerModel, init};
});

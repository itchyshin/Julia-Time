(function (root) {
  "use strict";
  function storage() { try { return root.localStorage; } catch (_) { return null; } }
  function text(node, value) { node.textContent = value || ""; }
  function init() {
    const client = root.JuliaTimeCourseClient;
    if (!client) return;
    const params = new URLSearchParams(root.location.search);
    const attempt = params.get("attempt") || "";
    const continueAction = document.getElementById("continue-action");
    const skipIntroAction = document.getElementById("skip-intro");
    const changedHistoryAction = document.getElementById("changed-history-action");
    const introScript = root.JuliaTimeIntroScript;
    // Every link off the board keeps the attempt, or coming back shows another attempt's progress.
    const withAttempt = page => page + (attempt ? "?attempt=" + encodeURIComponent(attempt) : "");
    const introDestination = withAttempt("intro.html");
    for (const [id, page] of [["watch-intro-link", "intro.html"], ["how-to-play-link", "getting-started.html"]]) {
      const link = document.getElementById(id);
      if (link) link.href = withAttempt(page);
    }
    function render(options) {
      const model = client.dashboardModel(client.loadCourseState(storage(), attempt, options));
      const destination = client.adapterDestination(model.continue.chapter, attempt, model.continue.move);
      const c1Destination = client.adapterDestination("C1", attempt) || destination || "chapter.html";
      if (model.startWithIntro) {
        continueAction.href = introDestination;
        const introLabel = (introScript ? introScript.boardStart : "Start with the intro") + " →";
        continueAction.dataset.readyLabel = introLabel;
        text(continueAction, introLabel);
        skipIntroAction.href = c1Destination;
        text(skipIntroAction, introScript ? introScript.boardSkip : "Skip the intro: go to Chapter 1");
        skipIntroAction.hidden = false;
      } else {
        continueAction.href = model.completion.complete ? client.endingDestination(attempt) : destination || "chapter.html";
        const readyLabel = (model.completion.complete ? "See how the case ends" : model.continue.label) + " →";
        continueAction.dataset.readyLabel = readyLabel;
        text(continueAction, readyLabel);
        skipIntroAction.hidden = true;
      }
      text(document.getElementById("board-status"), model.historicalNotice);
      const progressLine = document.getElementById("case-progress");
      if (progressLine) { text(progressLine, model.completion.line); progressLine.classList.toggle("case-progress--solved", model.completion.complete); }
      if (model.completion.complete) text(document.getElementById("board-title"), model.completion.headline);
      // r8-rc (2026-09-28): "Before you play:" is setup advice; once the case is closed it is not needed.
      const setupReminder = document.getElementById("setup-reminder"); if (setupReminder) setupReminder.hidden = model.completion.complete;
      text(document.getElementById("case-question"), model.caseThread.question);
      const established = document.getElementById("case-established");
      text(established, model.caseThread.established);
      established.classList.toggle("case-established--updated", Boolean(model.caseThread.hasEstablishedFact));
      text(document.getElementById("case-unknown"), model.caseThread.unknown);
      text(document.getElementById("case-why-next"), model.caseThread.whyNext);
      changedHistoryAction.hidden = !model.changedHistoryAction;
      text(changedHistoryAction, model.changedHistoryAction);
      changedHistoryAction.onclick = model.changedHistoryAction ? function () { render({acceptChangedHistory:true}); } : null;
      const cards = document.getElementById("chapter-cards");
      cards.replaceChildren();
      for (const card of model.cards) {
        const article = document.createElement("article");
        const label = document.createElement("p");
        const title = document.createElement("h2");
        const status = document.createElement("p");
        const solved = document.createElement("p");
        solved.className = "chapter-solved" + (card.solvedLabel.startsWith("✓") ? " chapter-solved--yes" : "");
        text(solved, card.solvedLabel);
        article.className = "chapter-card" + (card.playable ? "" : " unavailable");
        label.className = "eyebrow";
        text(label, (card.part ? card.part + " · " : "") + "Chapter " + card.chapter.slice(1));
        text(title, card.title);
        text(status, card.status);
        if (card.playable) {
          const chapterAction = document.createElement("a");
          chapterAction.className = "secondary-action";
          chapterAction.href = client.adapterDestination(card.chapter, attempt) || "chapter.html";
          text(chapterAction, "Open Chapter " + card.chapter.slice(1) + " →");
          article.append(label, title, solved, status, chapterAction);
        } else article.append(label, title, solved, status);
        cards.append(article);
      }
      const evidence = document.getElementById("saved-evidence");
      evidence.replaceChildren();
      if (!model.evidence.length) text(evidence, model.evidenceEmpty);
      for (const item of model.evidence) {
        const line = document.createElement("p");
        // r6-rc #7: a jar ID such as J-092 stays on one line (its hyphen would otherwise break).
        for (const part of String(item.line).split(/(J-\d{3})/)) {
          if (!/^J-\d{3}$/.test(part)) { if (part) line.append(part); continue; }
          const id = document.createElement("span"); id.className = "jar-id"; id.textContent = part; line.append(id);
        }
        evidence.append(line);
      }
      const concepts = document.getElementById("concept-list");
      concepts.replaceChildren();
      if (!model.concepts.length) text(concepts, "The Julia you use will appear here as you solve steps.");
      for (const concept of model.concepts) { const item = document.createElement("li"); text(item, concept); concepts.append(item); }
      text(document.getElementById("draft-notice"), model.draftNotice);
    }
    render();
  }
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : null);

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
    const changedHistoryAction = document.getElementById("changed-history-action");
    function render(options) {
      const model = client.dashboardModel(client.loadCourseState(storage(), attempt, options));
      const destination = client.adapterDestination(model.continue.chapter, attempt, model.continue.move);
      continueAction.href = destination || "chapter.html";
      const readyLabel = model.continue.label + " →";
      continueAction.dataset.readyLabel = readyLabel;
      text(continueAction, readyLabel);
      text(document.getElementById("board-status"), model.historicalNotice);
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
        article.className = "chapter-card" + (card.playable ? "" : " unavailable");
        label.className = "eyebrow";
        text(label, "Chapter " + card.chapter.slice(1));
        text(title, card.title);
        text(status, card.status);
        if (card.playable) {
          const chapterAction = document.createElement("a");
          chapterAction.className = "secondary-action";
          chapterAction.href = client.adapterDestination(card.chapter, attempt) || "chapter.html";
          text(chapterAction, "Open Chapter " + card.chapter.slice(1) + " →");
          article.append(label, title, status, chapterAction);
        } else article.append(label, title, status);
        cards.append(article);
      }
      const evidence = document.getElementById("saved-evidence");
      evidence.replaceChildren();
      if (!model.evidence.length) text(evidence, "No evidence is saved in this browser yet.");
      for (const item of model.evidence) {
        const line = document.createElement("p");
        text(line, item.line);
        evidence.append(line);
      }
      const concepts = document.getElementById("concept-list");
      concepts.replaceChildren();
      if (!model.concepts.length) text(concepts, "Concepts will appear here after this browser has saved progress.");
      for (const concept of model.concepts) { const item = document.createElement("li"); text(item, concept); concepts.append(item); }
      text(document.getElementById("draft-notice"), model.draftNotice);
    }
    render();
  }
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : null);

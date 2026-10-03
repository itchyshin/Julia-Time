(function (root) {
  "use strict";
  function storage() { try { return root.localStorage; } catch (_) { return null; } }
  function text(node, value) { node.textContent = value || ""; }
  // "not-equal, row by row, with .!=" reads "Not equal, row by row (" + code ".!=" + ")"; dot operators and => or = on their own are code.
  function conceptPieces(line) {
    const moved = /^(.*?),? with (\.[^\s]+)$/.exec(line);
    const words = moved ? moved[1].replace(/^not-equal/, "not equal") : "";
    const plain = moved ? words.charAt(0).toUpperCase() + words.slice(1) + " (" + moved[2] + ")" : line;
    const pieces = [];
    let last = 0;
    const operator = /(?<=^|[\s(])(\.[!<>=&|\/]+|=>|=)(?=[\s.,;:)]|$)/g;
    for (let m = operator.exec(plain); m; m = operator.exec(plain)) {
      if (m.index > last) pieces.push({text:plain.slice(last, m.index), code:false});
      pieces.push({text:m[0], code:true});
      last = m.index + m[0].length;
    }
    if (last < plain.length) pieces.push({text:plain.slice(last), code:false});
    return pieces;
  }
  // Round 4 (R3-22): the three ways saving can go wrong, each said once, in plain words, with the way out.
  const SAVE_BLOCKED = "This computer is not letting Julia Time save your place, so your progress will be lost when you close this page. You can still play. To keep your place, open the game in a normal window (not a private one) and allow this site to store data.";
  const SAVE_UNREADABLE = "Your saved progress on this computer could not be read, so the Board starts empty. Nothing was deleted, and every lesson still opens from the table below.";
  // "blocked" when the page may not store anything, "unreadable" when the Board's record is there but broken, else "".
  function saveTrouble(attempt) {
    const store = storage();
    if (!store) return "blocked";
    try { const probe = "julia-time:save-probe"; store.setItem(probe, "1"); store.removeItem(probe); } catch (_) { return "blocked"; }
    const state = root.JuliaTimeCourseState;
    try { if (state && state.courseStateStatus && state.courseStateStatus(store, attempt) === "malformed") return "unreadable"; } catch (_) { /* counts as readable */ }
    return "";
  }
  function init() {
    const client = root.JuliaTimeCourseClient;
    if (!client) return;
    const params = new URLSearchParams(root.location.search);
    const attempt = params.get("attempt") || "";
    const continueAction = document.getElementById("continue-action");
    const changedHistoryAction = document.getElementById("changed-history-action");
    // Every link off the board keeps the attempt, or coming back shows another attempt's progress.
    const withAttempt = page => page + (attempt ? "?attempt=" + encodeURIComponent(attempt) : "");
    for (const [id, page] of [["watch-intro-link", "intro.html"], ["how-to-play-link", "getting-started.html"], ["header-how-to-play", "getting-started.html"], ["julia-help", "getting-started.html#setup-wrap"]]) {
      const link = document.getElementById(id);
      if (link) { const at = page.indexOf("#"); link.href = at < 0 ? withAttempt(page) : withAttempt(page.slice(0, at)) + page.slice(at); }
    }
    function render(options) {
      const model = client.dashboardModel(client.loadCourseState(storage(), attempt, options));
      const walk = client.courseWalk(model, client.lessonProgress(storage()), attempt);
      const next = walk.next;
      const readyLabel = next.label;
      continueAction.href = next.href;
      continueAction.dataset.readyLabel = readyLabel;
      continueAction.dataset.kind = next.kind;
      // One time promise, added up from the lesson and chapter minutes in course-client.js.
      const promise = client.timePromise();
      text(document.getElementById("time-promise"), promise.text);
      text(document.getElementById("ending-minutes"), String(client.ENDING_MINUTES));
      text(continueAction, readyLabel);
      // The saved-work line reads the lesson progress too, so "Lesson done" never sits over "Nothing saved".
      const anySaved = walk.rows.some(row => row.lessonDone || row.caseDone) || model.cards.some(card => card.done) || client.lessonProgress(storage()).started;
      // The top line says "Saved" only once something is saved; the body line below says the same thing in full.
      // Round 4 (R3-22): each way saving can go wrong is its own boxed notice in plain words, with what to do. Otherwise the
      // line is a quiet note. "Cannot save here" also reaches the top bar, so the bar never says "saved" when it is not.
      const trouble = saveTrouble(attempt);
      text(document.getElementById("topbar-status"), trouble === "blocked" ? "Cannot save here" : anySaved ? "Saved on this computer" : "Your progress saves on this computer");
      const statusNode = document.getElementById("board-status");
      text(statusNode, trouble === "blocked" ? SAVE_BLOCKED : trouble === "unreadable" ? SAVE_UNREADABLE : model.changedHistoryAction ? model.historicalNotice : anySaved ? "Your saved work is on this computer. Open any lesson or chapter to run it again." : "Nothing saved on this computer yet.");
      if (statusNode.setAttribute) statusNode.setAttribute("data-kind", trouble ? "warn" : model.changedHistoryAction ? "warn" : "info");
      // Round 5: a save notice sits in the hero, directly above Start, so it is in the first screen; the quiet line stays below.
      // While one shows, the hero must not also say the place is saved.
      const heroNotice = Boolean(trouble || model.changedHistoryAction);
      const slot = document.getElementById("save-notice-slot"), home = document.getElementById("board-status-home");
      const destination = heroNotice ? slot : home;
      if (destination && destination.append && (statusNode.parentNode || statusNode.parent) !== destination) destination.append(statusNode, changedHistoryAction);
      const heroNode = document.getElementById("board-hero");
      if (heroNode && heroNode.dataset) { if (heroNotice) heroNode.dataset.notice = "on"; else delete heroNode.dataset.notice; }
      text(document.getElementById("hero-save-sentence"), trouble ? "Stop any time." : "Stop any time; your place is saved here.");
      const lesson = client.lessonProgress(storage());
      const introLink = document.getElementById("watch-intro-link");
      if (introLink) text(introLink, walk.introDone && lesson.introSeen ? "Watch the two-minute intro again ✓" : model.startWithIntro && !lesson.started ? "New here? Watch the two-minute intro (optional)" : "Watch the two-minute intro (optional)");
      const progressLine = document.getElementById("case-progress");
      if (progressLine) { text(progressLine, model.completion.solved || anySaved ? model.completion.line : ""); progressLine.classList.toggle("case-progress--solved", model.completion.complete); }
      const done = model.completion.complete;
      // The first-visit facts make way for the end state.
      for (const node of document.querySelectorAll ? document.querySelectorAll(".hero-facts, .hero-how") : []) node.hidden = done;
      // Once all six chapters are saved, the four case rows say where the case ends up, not what is still to find.
      text(document.getElementById("case-established-label"), done ? "What we found" : "What we know so far");
      text(document.getElementById("case-unknown-label"), done ? "What is still open" : "Still to find out");
      text(document.getElementById("case-why-next-label"), done ? "What to do now" : "Why this next step");
      text(document.getElementById("case-question"), model.caseThread.question);
      const established = document.getElementById("case-established");
      // A lesson done before any chapter: say so, instead of "Nothing checked yet".
      const lessonsDone = [...lesson.done].sort((a, b) => a - b);
      const lessonOnly = !model.caseThread.hasEstablishedFact && lessonsDone.length && next.kind === "chapter";
      text(established, lessonOnly ? (lessonsDone.length === 1 ? "Lesson " + lessonsDone[0] + " done." : "Lessons " + lessonsDone.join(", ") + " done.") + " Chapter " + next.n + " is next." : model.caseThread.established);
      established.classList.toggle("case-established--updated", Boolean(model.caseThread.hasEstablishedFact));
      text(document.getElementById("case-unknown"), model.caseThread.unknown);
      text(document.getElementById("case-why-next"), model.caseThread.whyNext);
      changedHistoryAction.hidden = !model.changedHistoryAction;
      text(changedHistoryAction, model.changedHistoryAction);
      changedHistoryAction.onclick = model.changedHistoryAction ? function () { render({acceptChangedHistory:true}); } : null;
      const cards = document.getElementById("chapter-cards");
      cards.replaceChildren();
      model.cards.forEach((card, i) => {
        const row = walk.rows[i], step = client.STEPS[i];
        const article = document.createElement("article");
        article.className = "chapter-card step-row" + (next.n === row.n && next.kind !== "ending" ? " step-row--next" : "");
        const head = document.createElement("h3");
        head.className = "step-num";
        text(head, "Step " + row.n);
        const cells = [head];
        for (const [done, label, name, href, minutes] of [[row.lessonDone, "Lesson " + row.n, step.lesson, row.lessonHref, step.lessonMinutes], [row.caseDone, "Chapter " + row.n, step.chapter, row.caseHref, step.chapterMinutes]]) {
          const cell = document.createElement("p");
          cell.className = "step-cell";
          const link = document.createElement("a");
          link.className = "chapter-row" + (done ? " chapter-row--done" : "");
          link.href = href;
          // The tick is drawn by the stylesheet in a fixed-width place at the start of the line (round 4, R3-52), so it never
          // wraps onto a line by itself and the titles line up whether or not a row is done; "(done)" is said below.
          text(link, label + ": " + name);
          if (done) { const said = document.createElement("span"); said.className = "sr-only"; text(said, " (done)"); link.append(said); }
          const length = document.createElement("span");
          length.className = "step-min";
          text(length, "about " + minutes + " min");
          cell.append(link, length);
          cells.push(cell);
        }
        const time = document.createElement("p");
        time.className = "step-time";
        text(time, step.minutes + " min");
        cells.push(time);
        article.append(...cells);
        cards.append(article);
      });
      const range = document.getElementById("range-panel");
      if (range) {
        range.replaceChildren();
        const line = document.createElement("a");
        line.href = client.rangeDestination(attempt);
        text(line, "Target range (optional)");
        const levels = document.createElement("span");
        text(levels, ": short puzzles that use what you learned. Practice levels open: " + walk.waves.open + " of " + walk.waves.total + ". Nothing is scored.");
        range.append(line, levels);
      }
      const ownData = document.getElementById("own-data-panel");
      if (ownData) {
        ownData.replaceChildren();
        const link = document.createElement("a");
        link.href = client.ownDataDestination(attempt);
        text(link, "Bonus: your own data");
        const about = document.createElement("span");
        text(about, " (optional): run the same moves on a CSV file of your own, or on a starter table. It stays on this computer and nothing is marked. The case does not wait for it.");
        ownData.append(link, about);
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
      const skillLines = lesson.skills.flatMap(skill => skill.can_do);
      const conceptLines = [...skillLines, ...model.concepts.filter(line => !skillLines.includes(line))];
      if (!conceptLines.length) text(concepts, "The Julia you use will appear here as you solve steps.");
      for (const concept of conceptLines) {
        const item = document.createElement("li");
        // A plain phrase first, then the symbol in a code span: "Not equal, row by row (.!=)".
        const pieces = conceptPieces(concept);
        if (pieces.length === 1 && !pieces[0].code) text(item, pieces[0].text);
        else for (const piece of pieces) {
          const node = document.createElement(piece.code ? "code" : "span");
          text(node, piece.text);
          item.append(node);
        }
        concepts.append(item);
      }
      text(document.getElementById("draft-notice"), model.draftNotice);
    }
    render();
  }
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : null);

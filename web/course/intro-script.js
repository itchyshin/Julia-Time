/* Every word of the Missing Fleas intro movie, in one file so it is easy to edit.
   Shown once, before Chapter 1, to a brand-new player: the lab, the team, batch B09, and the case ahead. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeIntroScript = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  return Object.freeze({
    heading: "How it began",
    buttons: Object.freeze({
      back: "← Back", next: "Next →", skip: "Skip the intro", start: "Start Lesson 1 →"
    }),
    scenes: Object.freeze([
      Object.freeze({
        title: "The road map",
        heading: "Before you start",
        image: "../assets/lab-cast.png",
        alt: "Itchy, Toto, Momo and Eddie gathered around jars and the Missing Fleas notebook.",
        caption: "Six steps, about {time} in all. Each step is a lesson on practice data, then a chapter of the real case. You type short lines of Julia, a computer language, and read what comes back. Nothing is scored. Your place is saved."
      }),
      Object.freeze({
        title: "Itchy's lab",
        image: "../assets/course/scene-c3-handling-desk.png",
        alt: "Itchy, Momo, Toto and Eddie at a desk with jars.",
        caption: "Itchy's lab rears springtails, tiny relatives of snow fleas, in closed jars. Itchy runs the lab, Toto is eager, Momo doubts things, Eddie keeps the records. You are the fifth, and the newest.",
        speaker: "Itchy",
        line: "A claim needs a check behind it."
      }),
      Object.freeze({
        title: "Batch B09",
        image: "../assets/course/scene-c2-tray-bench.png",
        alt: "Trays laid out on the lab bench.",
        caption: "Batch B09 began six weeks ago, about twenty springtails to a jar. Six jars sit two to a tray, on three trays: T-A, T-B and T-C. A look only asks whether any live ones are there.",
        speaker: "Eddie",
        line: "B09 is the batch in the report."
      }),
      Object.freeze({
        title: "One tray each day",
        image: "../assets/course/detail-c1-field-notebook.png",
        alt: "An open notebook beside jars in a wooden tray.",
        caption: "One tray was checked each evening: T-A, then T-B, then T-C. Each jar got a two-minute look and one notebook row: seen, or not seen. The tray's count went on the paper tally sheet.",
        speaker: "Eddie",
        line: "Each row was written at the jar."
      }),
      Object.freeze({
        title: "The tally sheet and the report",
        image: "../assets/lab-cast.png",
        alt: "Toto holds his report while the team looks on.",
        caption: "Toto typed the tally sheet into the lab's table, in checking order: T-A 2 jars, T-B 2, then T-C, the last tray, 0. He types his report from that table.",
        speaker: "Toto",
        line: "Both jars, both jars, then none. They are dying out!"
      }),
      Object.freeze({
        title: "Your case",
        image: "../assets/course/scene-c6-evidence-board.png",
        alt: "The team at the story board.",
        caption: "Toto had only his typed table. Nobody has checked his report against the notebook. You will check it with short lines of Julia, a computer language. Nothing is decided yet.",
        speaker: "Itchy",
        line: "Start with a claim you can check."
      })
    ])
  });
});

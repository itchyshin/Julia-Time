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
      back: "← Back", next: "Next →", skip: "Skip the intro", start: "Start Part 1 · Check the report →"
    }),
    boardStart: "Start with the intro (about one minute)",
    boardSkip: "Skip the intro: go to Chapter 1",
    scenes: Object.freeze([
      Object.freeze({
        title: "Itchy's lab",
        image: "../assets/course/scene-c3-handling-desk.png",
        alt: "Itchy, Momo, Toto and Eddie at a desk with jars.",
        caption: "Itchy's lab rears springtails, tiny relatives of the snow fleas seen on winter snow. They are smaller than a grain of rice, live in leaf litter and jump when touched. Each closed jar holds damp leaves and, if all is well, a living group of springtails. The lab needs these jars for its experiments. Four people work here. Itchy runs the lab. Toto is eager. Momo doubts things. Eddie keeps the records straight. You are the fifth, and the newest.",
        speaker: "Itchy",
        line: "Welcome. Here, a claim is only as good as the check behind it."
      }),
      Object.freeze({
        title: "Batch B09",
        image: "../assets/course/scene-c2-tray-bench.png",
        alt: "Trays laid out on the lab bench.",
        caption: "A batch is a set of jars started on the same day. Batch B09 was started six weeks ago: about twenty springtails went into each jar, on fresh damp leaves, and the lids went on. Each lid has a fine mesh for air; springtails cannot get in or out. After six weeks the live ones have bred and the dead ones have rotted away, so nobody knows how many are in a jar; the look only asks whether any live ones are there. Six jars sit two to a tray, on three trays: T-A, T-B and T-C. The question for any batch is simple: is each jar still alive?",
        speaker: "Eddie",
        line: "Remember the batch name: B09. Six jars, two per tray. That is the one the report is about."
      }),
      Object.freeze({
        title: "One tray each day",
        image: "../assets/course/detail-c1-field-notebook.png",
        alt: "An open notebook beside jars in a wooden tray.",
        caption: "Six weeks after the start, the trays were checked, one tray each evening, when the room is still: T-A first, then T-B, then T-C. Springtails are too small and too quick to count in litter, so each jar gets a fixed two-minute look and one row in the notebook: springtails seen, or not seen. Seen means at least one live, moving springtail turned up during the look; nobody counts them. Then the tray's count, how many of its two jars had springtails, is written in a box on the paper tally sheet.",
        speaker: "Eddie",
        line: "Each row was written while someone looked at the jar."
      }),
      Object.freeze({
        title: "The tally sheet and the report",
        image: "../assets/lab-cast.png",
        alt: "Toto holds his report while the team looks on.",
        caption: "Toto has typed the tally sheet into the lab's table, box by box. He goes down that table in the order the trays were checked: T-A 2 of 2 jars, T-B 2 of 2 jars, then T-C, the last tray checked, 0 jars. To him the springtails are dying out, tray after tray. He types his report from that table: “Report, batch B09. Tray T-C: 0 jars with springtails. Conclusion: the springtails are dying out.”",
        speaker: "Toto",
        line: "Both jars, both jars, then none. They are dying out!"
      }),
      Object.freeze({
        title: "Your case",
        image: "../assets/course/scene-c6-evidence-board.png",
        alt: "The team at the story board.",
        caption: "Toto's report says the springtails are dying out. Are they? Toto had only his typed table. Nobody has checked his report against the notebook yet. You will find out by writing short lines of Julia, a computer language, in three parts. Part 1 · Check the report. Part 2 · Check the notebook. Part 3 · Test the claim. Nothing is decided yet. Start with Part 1.",
        speaker: "Itchy",
        line: "Start with a claim you can check."
      })
    ])
  });
});

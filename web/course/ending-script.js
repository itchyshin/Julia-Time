/* Every word of the Missing Fleas ending, in one file so it is easy to edit.
   No digits here: every number on the ending comes from the game server (docs/design/05-story-bible.md §7).
   Aha labels changed 2026-09-26 (story bible v2): "Notebook", never "Report"/"Handling log"; 2026-09-27 (spine,
   one mechanism for the 0): "Toto's typed table", never "Tally sheet: 0", because the paper box was blank. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeEndingScript = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  return Object.freeze({
    scenes: Object.freeze([
      Object.freeze({chapter:"C1", title:"The report and the notebook", speaker:"Itchy",
        line:"First, find the right jars: the batch the report names, not just the first rows in the table.",
        alt:"The Missing Fleas field notebook open on the lab bench."}),
      Object.freeze({chapter:"C2", title:"Count by tray", speaker:"Toto",
        line:"Grouping by tray turned a pile of jars into three trays I could count.",
        alt:"Eddie lays out empty trays on the lab bench while the team watches."}),
      Object.freeze({chapter:"C3", title:"Where did the {logged} come from?", speaker:"Eddie",
        line:"Put the two records side by side, and the one that does not match is easy to see.",
        alt:"Eddie holds two sheets side by side while the team looks on."}),
      Object.freeze({chapter:"C4", title:"Plan a fair recheck", speaker:"Momo",
        line:"A plan is not a result. Nothing new gets written down until we look again.",
        alt:"Eddie points to a rack of jars while the team plans the recheck."}),
      Object.freeze({chapter:"C5", title:"What would plain chance give?", speaker:"Toto",
        line:"My cards showed me what plain chance gives.",
        alt:"Toto at the card table with a two-colour deck."}),
      Object.freeze({chapter:"C6", title:"Are the springtails dying out?", speaker:"Momo",
        line:"A story that fits is still a guess, not the answer.",
        alt:"The four investigators at the story board."})
    ]),
    // One line per record (r3 story F6): the 0 sits only on Toto's typed table, never next to the paper.
    // {reported}, {status} and {logged} are filled in from the game server's facts (also {logged} in final.answer).
    aha: Object.freeze({report:"Notebook: {reported}", paper:"Tally sheet: box {status}", log:"Toto's typed table: {logged}, typed where the box was blank", copied:"Report: used that {logged} as a count"}),
    final: Object.freeze({
      stamp:"Closed · report checked · notebook checked · claim tested · recheck planned",
      headline:"Case closed: the springtails were never shown to be dying out",
      answer:"Are the springtails dying out? Nothing we found says so. The report's {logged} was a blank box, and the notebook does not look like springtails dying out. Only the recheck can say more.",
      speaker:"Itchy",
      line:"Good science is knowing what the data say, and what they do not say yet.",
      punSignOff:"Case closed. One box stays blank, and the recheck is still to come.",
      punSpeaker:"Toto",
      wellDone:"Well done. You took a messy question and worked through it with Julia, one step at a time.",
      alt:"Itchy, Toto, Momo and Eddie together around the jars and the Missing Fleas notebook.",
      investigators:Object.freeze(["Itchy", "Toto", "Momo", "Eddie", "and you"])
    })
  });
});

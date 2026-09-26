/* Every word of the Missing Fleas ending, in one file so it is easy to edit.
   No digits here: every number on the ending comes from the game server (docs/design/05-story-bible.md §7).
   Aha labels changed 2026-09-26 (story bible v2): "Notebook"/"Tally sheet", never "Report"/"Handling log". */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeEndingScript = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  return Object.freeze({
    scenes: Object.freeze([
      Object.freeze({chapter:"C1", title:"The report and the notebook", speaker:"Itchy",
        line:"First, the right jars: the batch the report names, not just the rows on top.",
        alt:"The Missing Fleas field notebook open on the lab bench."}),
      Object.freeze({chapter:"C2", title:"Count by tray", speaker:"Toto",
        line:"Grouping by tray turned a pile of jars into three trays I could count.",
        alt:"Toto lays out the tray records on the lab bench."}),
      Object.freeze({chapter:"C3", title:"Where did the zero come from?", speaker:"Eddie",
        line:"Put the two records side by side and the odd one out shows itself.",
        alt:"Eddie holds two sheets side by side while the team looks on."}),
      Object.freeze({chapter:"C4", title:"Plan a fair recheck", speaker:"Momo",
        line:"A plan is not a result. Nothing new gets written down until we look again.",
        alt:"Momo places closed jars into an empty recheck rack."}),
      Object.freeze({chapter:"C5", title:"Too good to be true?", speaker:"Toto",
        line:"My cards showed me what luck alone can do.",
        alt:"Toto at the card table with a two-colour deck."}),
      Object.freeze({chapter:"C6", title:"Are the fleas vanishing?", speaker:"Momo",
        line:"A story that fits is still a guess, not the answer.",
        alt:"The four investigators at the story board."})
    ]),
    aha: Object.freeze({report:"Notebook", log:"Tally sheet", note:"not a count", copied:"Report: copied the blank as a zero"}),
    final: Object.freeze({
      stamp:"Closed · both claims checked · recheck planned",
      headline:"Case closed: the fleas were never shown to be missing",
      speaker:"Itchy",
      line:"Good science is knowing what the data say, and what they do not say yet.",
      punSignOff:"No fleas were lost in the making of this case. Well, one box was.",
      punSpeaker:"Toto",
      wellDone:"Well done. You took a messy question and worked through it with Julia, one step at a time.",
      alt:"Itchy, Toto, Momo and Eddie together around the jars and the Missing Fleas notebook.",
      investigators:Object.freeze(["Itchy", "Toto", "Momo", "Eddie", "and you"])
    })
  });
});

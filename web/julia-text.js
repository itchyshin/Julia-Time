/* Julia Time: what may sit under the label "Julia's own message". Never invent output: that fold holds Julia's real
   error text only. The game's own words (the sandbox's generic first line, the server's fallbacks, and the notes the
   sandbox writes itself) never go there. Shared by web/lesson.js and web/lesson-range.js (both lesson screens).
   Server twin: `_lesson_julia_text` in src/lessons.jl. No DOM, no network. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeJuliaText = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // The first line the sandbox puts above Julia's text, and the server's fallbacks: stand-ins, not Julia's words.
  const STAND_IN_LINES = ["Something went wrong running this line.", "Something went wrong handling that message.",
    "A function was called with the wrong kind of argument.", "An index was outside the range of the collection.",
    "Integer division by zero."];
  const STAND_IN_PATTERNS = [/^Julia couldn't parse this line\./, /^That line stopped Julia itself/,
    /is a name Julia does not know yet\. Check the spelling, or define it first\.$/];
  // Notes the game writes itself (src/sandbox.jl, src/mystery_c3.jl to c6.jl). "The supplied ... changed" is the
  // protected-input note; it is shown as the game's note, in the normal feedback line.
  const PROTECTED_NOTE = /^The supplied [^\n]*\bchanged\./;
  const GAME_NOTES = [PROTECTED_NOTE, /^Your code ran for more than [\d.]+ seconds and was stopped\./,
    /^No sandbox worker is available\./, /^This result is a function or a type you just defined/,
    /^The result was too large to show/];

  const parts = (message) => String(message || "").trim().split(/\n\n/);
  function isStandIn(line) {
    const x = String(line || "").trim();
    return !x || STAND_IN_LINES.indexOf(x) >= 0 || STAND_IN_PATTERNS.some((re) => re.test(x));
  }
  const isGameNote = (line) => GAME_NOTES.some((re) => re.test(String(line || "").trim()));

  // Julia's own text only: stand-in head lines are stripped, and a message that is only a game note gives "".
  function juliaText(message) {
    const p = parts(message);
    while (p.length && isStandIn(p[0])) p.shift();
    const text = p.join("\n\n").trim();
    return isGameNote(text) ? "" : text;
  }
  // The game's protected-input note found in a message, or "" (the screen shows it as feedback, not under Julia's label).
  function protectedNote(message) {
    const found = parts(message).map((x) => x.trim()).find((x) => PROTECTED_NOTE.test(x));
    return found || "";
  }

  // Round 4 (R3-19): Julia's own text, read on a learner's screen, without the file locations and machine details that
  // Julia adds ("@ Base strings/string.jl:483", "[1] f(x) at ./file.jl:12", "aarch64-apple-darwin"). Every line left is
  // Julia's own line, word for word; only whole location lines are dropped. A trimmed message ends in "..." as Julia's
  // own candidate list already does, never in anything the game wrote.
  function trimLocations(message) {
    const out = [];
    for (const line of String(message || "").split("\n")) {
      if (/^\s*Stacktrace:/.test(line)) break;                       // everything after is call-chain detail
      if (/^\s*@\s/.test(line) || /^\s*\[\d+\]\s/.test(line)) continue;  // "@ Base file.jl:1" and "[1] f(x) at file.jl:1"
      if (/\.jl:\d+/.test(line) || /(aarch64|x86_64)[-.\w]*(darwin|linux|mingw|w64)/i.test(line) || /~\/\.julia\//.test(line)) continue;
      out.push(line);
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  return { isStandIn, isGameNote, juliaText, protectedNote, trimLocations };
});

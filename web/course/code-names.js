/* Marks the names a learner types as code in a chapter's explanations (owner playtest, 2026-09-26: "make it
 * bold ... these Julia objects to be typed in"). Only unmistakable code is marked: names with an underscore
 * (sim_counts, :tray_id), dotted names that contain one or start with a case table (jars.batch_id,
 * candidate_models.lower), and the dotted operators (.==, .>=, .<=, .!=, .&). Code boxes, tables, the editor,
 * buttons and existing <code> are left alone. Text is wrapped, never changed, so what a learner reads is the same. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeCodeNames = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => api.init(document));
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const TABLES = "jars|joined|eligible|counts|groups|events|stories|tray_counts|tally_sheet|sim_counts";
  const PATTERN = new RegExp(
    "(?<![\\w.:])(?:" +
      "(?:" + TABLES + ")[.$][a-z][a-z0-9_]*" +              // jars.batch_id, candidate_models.lower, R's jars$batch_id
      "|[a-z][a-z0-9]*_[a-z0-9_]*\\.[a-z][a-z0-9_]*" +       // summary_x.y (underscore before the dot)
      "|:?[a-z][a-z0-9]*(?:_[a-z0-9]+)+" +                   // sim_counts, :tray_id, case_batch
    ")(?![\\w])|\\.(?:==|>=|<=|!=|&)", "g");
  const SKIP = new Set(["PRE", "CODE", "TEXTAREA", "SCRIPT", "STYLE", "BUTTON", "TABLE", "INPUT", "SELECT", "KBD"]);
  // Every inline code name gets the same look, whether this script wrapped it or the page wrote it as <code>;
  // code blocks (<pre>), the editor and keyboard keys keep their own styling.
  const STYLE = "code.jt-name,main :not(pre)>code{font-family:\"SFMono-Regular\",Consolas,monospace;font-weight:700;" +
    "font-size:.92em;background:#e8f0ed;color:#0f4c4d;padding:0 .22em;border-radius:3px}";

  function findNames(text) {
    const out = []; let match;
    PATTERN.lastIndex = 0;
    while ((match = PATTERN.exec(text))) out.push({text: match[0], index: match.index});
    return out;
  }

  function skipped(node) {
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (SKIP.has(el.tagName) || el.isContentEditable || el.classList.contains("jt-progress")) return true;
    }
    return false;
  }

  function markTextNode(doc, node) {
    const text = node.nodeValue, found = findNames(text);
    if (!found.length) return;
    const frag = doc.createDocumentFragment(); let at = 0;
    for (const match of found) {
      if (match.index > at) frag.append(doc.createTextNode(text.slice(at, match.index)));
      const code = doc.createElement("code"); code.className = "jt-name"; code.textContent = match.text;
      frag.append(code); at = match.index + match.text.length;
    }
    if (at < text.length) frag.append(doc.createTextNode(text.slice(at)));
    node.replaceWith(frag);
  }

  function markTree(doc, rootNode) {
    const walker = doc.createTreeWalker(rootNode, 4 /* NodeFilter.SHOW_TEXT */);
    const nodes = []; let node;
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.trim() && !skipped(node)) nodes.push(node);
    nodes.forEach(textNode => markTextNode(doc, textNode));
  }

  function init(doc) {
    const main = doc.querySelector("main") || doc.body;
    if (!main) return;
    const style = doc.createElement("style"); style.textContent = STYLE; doc.head.append(style);
    markTree(doc, main);
    // Chapter scripts write their explanations after load; mark new text as it arrives.
    let queued = false;
    new MutationObserver(() => {
      if (queued) return; queued = true;
      setTimeout(() => { queued = false; markTree(doc, main); }, 50);
    }).observe(main, {childList: true, subtree: true, characterData: true});
  }

  return {findNames, init};
});

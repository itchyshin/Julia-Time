/* Julia Time: the one script on the How to play page. It only adds the attempt to its Board links.
   Served by the running game, the links stay on this same address (they are relative); opened from the
   folder or shared as a static page, they keep the plain relative address in the HTML. */
(function (root) {
  "use strict";
  function boardHref(loc) {
    if (!loc || !/^https?:$/.test(loc.protocol) || !/^(127\.0\.0\.1|localhost|\[::1\])$/.test(loc.hostname)) return null;
    const attempt = new URLSearchParams(loc.search || "").get("attempt") || "";
    return "index.html" + (/^[a-z0-9-]{1,80}$/.test(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  if (typeof module === "object" && module.exports) module.exports = {boardHref};
  if (root && root.document) root.document.addEventListener("DOMContentLoaded", function () {
    const href = boardHref(root.location);
    if (!href) return;
    // Every Board link on this page (header, top button, foot button) keeps the attempt.
    for (const link of root.document.querySelectorAll("#header-board, #local-case-board, [data-board-link]")) link.href = href;
  });
})(typeof window !== "undefined" ? window : null);

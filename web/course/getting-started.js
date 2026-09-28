/* Julia Time: the one script on the Start Here page. It only fixes the "Open the local Case Board" link.
   Served by the running game (any port 8000-8009), the link stays on this same address and keeps the
   attempt; opened from the folder or shared as a static page, it keeps the usual address in the HTML. */
(function (root) {
  "use strict";
  function boardHref(loc) {
    if (!loc || !/^https?:$/.test(loc.protocol) || !/^(127\.0\.0\.1|localhost|\[::1\])$/.test(loc.hostname)) return null;
    const attempt = new URLSearchParams(loc.search || "").get("attempt") || "";
    return "index.html" + (/^[a-z0-9-]{1,80}$/.test(attempt) ? "?attempt=" + encodeURIComponent(attempt) : "");
  }
  if (typeof module === "object" && module.exports) module.exports = {boardHref};
  if (root && root.document) root.document.addEventListener("DOMContentLoaded", function () {
    const link = root.document.getElementById("local-case-board"), href = boardHref(root.location);
    if (link && href) link.href = href;
  });
})(typeof window !== "undefined" ? window : null);

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const client = require(path.join(root, "web", "chapter2.js"));

test("a newly unlocked C2 move stays learner-owned rather than copying prior code", () => {
  const storage = { getItem: () => "" };

  assert.equal(client.starterDraft(storage, "rates"), "");
});

test("an obsolete placeholder draft is cleared instead of being presented as runnable Julia", () => {
  const saved = "groups = groupby(table, group_column)\nsummary = combine(groups, count_rows => :n, boolean_column => sum => :detected_n)";
  const removed = [];
  const storage = {
    getItem: () => saved,
    removeItem: key => removed.push(key)
  };

  assert.equal(client.starterDraft(storage, "rates"), "");
  assert.deepEqual(removed, [client.storagePrefix() + "draft:rates"]);
});

test("the C2 rate answer is a labelled, standalone code block", () => {
  const script = fs.readFileSync(path.join(root, "web", "chapter2.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "web", "chapter2.html"), "utf8");

  assert.match(script, /answerCode:/, "C2 stores a complete answer separately from prose hints");
  assert.match(script, /Reference code answer — runnable Julia/, "C2 labels the full answer honestly as runnable code");
  assert.match(script, /summary = combine\(groupby\(jars, :tray_id\)/, "the rate answer rebuilds summary in its fresh run");
  assert.doesNotMatch(script, /draft = carryDraft\(/, "C2 does not imply that an earlier sandbox binding still exists");
  assert.ok(html.indexOf('id="result"') < html.indexOf('<details class="help">'), "a run result appears before optional help");
});

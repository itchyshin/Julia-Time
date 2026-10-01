/* Julia Time: lesson screen. Renders any lesson from data (docs/dev-log/course/lesson-format.md).
   No lesson text and no ids live here. The controller is pure (socket and storage are injected),
   so Node tests can drive it without a browser. */
(function (root, factory) {
  // The target range's code sits in web/lesson-range.js, and the "Julia's own message" filter in web/julia-text.js
  // (both loaded first by lesson.html; required in Node).
  const api = factory(typeof module === "object" && module.exports ? require("./lesson-range.js") : root && root.JuliaTimeLessonRange,
    typeof module === "object" && module.exports ? require("./julia-text.js") : root && root.JuliaTimeJuliaText);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeLesson = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => api.init(document));
})(typeof window !== "undefined" ? window : null, function (Range, JuliaText) {
  "use strict";

  const STORE_PREFIX = "julia-time:lesson:v1:";
  // Two independent switches in the bar, "Show R" and "Show Python", both on by default (Shinichi, 30 Sep). Saved as
  // {"r": true, "py": true} under a prefix that is never read as a lesson.
  const SHOW_KEY = "julia-time:notes-show:v2";
  // The old one-question answers ("Do you know R?", "R, Python or neither?"). They never hide a language: both keys are
  // deleted on the first load of any lesson page.
  const OLD_LANG_KEYS = ["julia-time:uses-r:v1", "julia-time:notes-lang:v1"];
  const FAILS_BEFORE_LINE = 2;
  const FAILS_BEFORE_STARTER = 2;               // the fill-in starter line waits for two runs that missed (CS-education review)
  const FAILS_BEFORE_HINT = 1;                  // a checkpoint offers its first hint after one run that missed
  // The three plain steps shown above the last lesson's own-work card (round 4, R3-33). `like this` is code.
  // The end fold's default title, when a lesson sets none (close.own_work.title). Split so no lesson text is held here (propagation test).
  const OWN_TITLE = ["In your own", "work (not run here)"].join(" ");
  const OWN_FIRST_TIME = ["Install Julia from `julialang.org`.", "Open it: type `julia` in a terminal (or open the Julia app). You will see the `julia>` prompt.",
    "Type `pwd()` to see the folder Julia reads files from. Put your file (for example `mydata.csv`) in that folder."];
  // A result block taller than this (px) drops below Next, so the verdict and Next stay in the first screen.
  const LINE_NOTE = "Here is the line, in the editor. Press Run to see what Julia does with it.";
  // Round 6 (Tufte r5, C): every toggle on a step says what it did. When the notes themselves appear or go, that is the answer and no line is
  // needed; otherwise one short line says where the notes are (or that this step has none).
  const SWITCH_NONE = "This step has no R or Python note. They show in the Cheat sheet and Pocket dictionary.";
  const SWITCH_NONE_ONE = (name) => "This step has no " + name + " note. " + name + " notes for other lines show in the Cheat sheet and Pocket dictionary.";
  const SWITCH_WAITS = "R and Python notes for this step show under the result, after you press Run.";
  const STARTER_NOTE = "Here is a starter line. Fill each blank (___), then press Run.";
  const OWN_KINDS = ["change", "fix", "complete", "write", "checkpoint"];
  const LINE_KINDS = ["change", "fix", "complete", "write"];
  // Every task says what kind it is (fix round 2, P12), in the plain words of How to play.
  const KIND_LABELS = { see: "Watch", change: "Change", complete: "Fill the blank", write: "Write", checkpoint: "Checkpoint", fix: "Fix", play: "Try anything" };
  const RANGE_ID = "range";
  const TEST_OUT_RUNS = 2;
  const MAX_UNDERLINES = 4;                    // underlined words on one screen, at most
  // A chapter exam (kind "exam", lessons/examN.json) runs on this screen in exam mode: no worked example, no "Show me
  // the line", no test-out, the whole pocket dictionary of Lessons 1 to N in view, and at most EXAM_HINTS hint.
  const EXAM_KIND = "exam";
  const FAST_LABEL = "I know R or Python: try this lesson's checkpoints";
  const TEST_OUT_LABEL = "I know this: try the checkpoint (you can come back)";
  const EXAM_HINTS = 1;
  const LESSON_HINTS = 2;
  const CHAPTERS = 6;                          // the course has six steps: Step N is Lesson N, then Chapter N
  const NOT_SAVED = "Your line is right, but this computer could not save it, so the Board will show this step as not done. Press Run once more, or press Next and carry on. If this keeps happening, your browser may be blocking saved data (a private window does).";
  // The one fixed sentence above Start on every chapter card (docs/dev-log/course/0.5-fix-spec.md, screen contracts).
  const CHAPTER_START = "This is the case notebook (made up for this game). You write the lines yourself. You can ask for one piece of help: a hint or a starter line.";
  const BOARD_HREF = "course/index.html";
  const ATTEMPT_PATTERN = /^[a-z0-9-]{1,80}$/;

  function lessonIdFromSearch(search) {
    const id = new URLSearchParams(search || "").get("lesson");
    return /^[a-z0-9-]{1,40}$/.test(id || "") ? id : "";
  }

  function safeStorage(storage) {
    return {
      get(key) { try { return storage ? storage.getItem(key) : null; } catch (e) { return null; } },
      set(key, value) { try { if (storage) storage.setItem(key, value); } catch (e) { /* ignore */ } },
      remove(key) { try { if (storage) storage.removeItem(key); } catch (e) { /* ignore */ } },
      keys(prefix) {
        const out = [];
        try { if (storage && typeof storage.key === "function") for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (typeof k === "string" && k.startsWith(prefix)) out.push(k); } } catch (e) { /* ignore */ }
        return out;
      },
    };
  }

  // A stable shuffle: the same seed text always gives the same order (so a reload keeps the buttons put).
  function seededOrder(n, seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rand = () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    return order;
  }

  // Julia prints a vector as "12-element Vector{String}:" then one item per line. The player should
  // see the items, never that type line.
  // A long vector is printed with a "⋮" line in the middle; then fewer items than the count are shown.
  function listInfo(repr) {
    const m = /^\s*(\d+)-element [^\n]*:\s*\n([\s\S]*)$/.exec(String(repr || ""));
    if (!m) return null;
    const lines = m[2].split("\n").map((x) => x.trim()).filter((x) => x.length);
    const items = lines.filter((x) => x !== "\u22ee");
    return { n: Number(m[1]), items, cut: items.length !== lines.length || items.length !== Number(m[1]) };
  }
  function listItems(repr) {
    const info = listInfo(repr);
    return info && !info.cut ? info.items : null;
  }
  // A Matrix or DataFrame value: its first line is a type line ("1x1 Matrix{String}:"), never shown.
  function tableInfo(repr) {
    const lines = String(repr || "").split("\n");
    const m = /^\s*(\d+)\s*[\u00d7x]\s*(\d+) .*(?:Matrix|DataFrame)/.exec(lines[0]);
    const one = !m && /^\s*DataFrameRow\s*$/.test(lines[0]);       // one row of a table: the type line is never shown
    if (!m && !one) return null;
    const body = lines.slice(1).map((x) => x.replace(/^ /, "").replace(/\s+$/, "")).join("\n").replace(/^\n+|\n+$/g, "");
    return { rows: one ? 1 : Number(m[1]), cols: one ? null : Number(m[2]), matrix: !one && /Matrix/.test(lines[0]), body };
  }
  // What to call a table-shaped value in words. A Matrix is not a table: one column of values is "a column", else "a grid".
  function tableWords(info) {
    if (!info) return "";
    if (info.matrix) return info.cols === 1 ? "a column of " + plural(info.rows, "value", "values") : "a grid of " + plural(info.rows, "row", "rows") + " by " + plural(info.cols, "column", "columns");
    return "a table with " + plural(info.rows, "row", "rows");
  }
  const upFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  // One row of a table, as Julia prints it (" Row | a  b", a type line, a rule, then the values), read back as a
  // one-row table. null when the text does not split cleanly, so the plain text is shown instead.
  function rowTable(repr) {
    const lines = String(repr || "").split("\n");
    if (!/^\s*DataFrameRow\s*$/.test(lines[0])) return null;
    const cell = (x) => { const at = x.indexOf("\u2502"); return at < 0 ? null : x.slice(at + 1).trim().split(/\s+/).filter((y) => y.length); };
    const head = lines.findIndex((x, i) => i > 0 && /^\s*Row\s*\u2502/.test(x));
    const rule = lines.findIndex((x, i) => i > head && head > 0 && x.indexOf("\u253c") >= 0);
    if (head < 0 || rule < 0) return null;
    const columns = cell(lines[head]), values = cell(lines[rule + 1] || "");
    if (!columns || !values || !columns.length || columns.length !== values.length) return null;
    return { columns, rows: [values] };
  }
  function tableRows(repr) {
    const info = tableInfo(repr);
    return info ? info.rows : null;
  }
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

  function emptyProgress() { return { started: false, done: {}, lineUsed: {}, fails: {}, drafts: {}, skipped: {}, testedOut: {} }; }

  // ---- glossary: which words to underline, once per round ------------------------------------
  // A word term matches whole words, ignoring case; a plain plural (-s, -es) counts as the same word. A sign term
  // (=, .==, !=) never matches inside a longer sign: the "=" of ".!=" or "==" is not the term "=".
  const regexCache = new Map();
  function termRegex(term, flags) {
    const ck = flags + "|" + term;
    if (regexCache.has(ck)) return regexCache.get(ck);
    const t = String(term), esc = t.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
    const wordStart = /^[A-Za-z0-9_]/.test(t), wordEnd = /[A-Za-z0-9_]$/.test(t);
    const before = wordStart ? "(?<![A-Za-z0-9_])" : "(?<![.!=<>&|])";
    const after = wordEnd ? "(?:e?s)?(?![A-Za-z0-9_])" : "(?![=<>&|])";
    const re = new RegExp(before + esc + after, flags);
    regexCache.set(ck, re);
    return re;
  }
  // A term and its plain plural ("deal", "deals") are one word: once one is underlined, the other is not.
  function termGroups(terms) {
    const has = new Set(terms.map((g) => g.term.toLowerCase())), key = {};
    terms.forEach((g) => {
      const t = g.term.toLowerCase();
      let k = t;
      ["es", "s"].forEach((suf) => { if (k === t && t.endsWith(suf) && has.has(t.slice(0, -suf.length))) k = t.slice(0, -suf.length); });
      key[t] = k;
    });
    return key;
  }
  // sources: [{ key, text, late? }] in reading order. Returns { key: [{ start, end, term }] }: each term once, in the
  // first source that holds it; overlapping matches keep the longer term. A `late` source (a hint or a feedback line,
  // which the player sees only after acting) is read after every other source, so it never takes a word away from
  // text the player always meets first.
  // `seen` (optional) is a { word: true } record shared across calls: a word in it is never marked again, and the words
  // this call marks are added to it, so "the first time in the lesson" can run across screens. `limit` (optional) is the
  // most marks this call may make in all; later words in reading order are left plain and stay unseen.
  // A note shows as one code block only when the whole note is code: no backtick-marked code and no sentence break
  // (". " then a capital). Otherwise it is prose, and appendRich shows its `code` inline.
  // The largest row or line boundary (px from the top of the content) that fits in `avail`, or null when not even one does.
  function snapCap(bounds, avail) {
    let best = null;
    (bounds || []).forEach((b) => { if (b > 0 && b <= avail + 0.5 && (best === null || b > best)) best = b; });
    return best;
  }
  function noteIsCode(t) {
    const s = String(t || "").trim();
    if (!s || s.includes("`") || /[.!?]\s+[A-Z]/.test(s) || /[.!?]$/.test(s)) return false;
    return /[()[\]$]|<-|%>%|\|>|==/.test(s);
  }

  function glossaryMarks(sources, glossary, seen, limit) {
    const marks = {}, used = seen && typeof seen === "object" ? seen : {};
    let room = typeof limit === "number" ? limit : Infinity;
    const terms = (Array.isArray(glossary) ? glossary : []).filter((g) => g && typeof g.term === "string" && g.term && typeof g.means === "string");
    const group = termGroups(terms), gk = (g) => group[g.term.toLowerCase()];
    sources.forEach((src) => { marks[src.key] = []; });
    sources.filter((x) => !x.late).concat(sources.filter((x) => x.late)).forEach((src) => {
      const found = [];
      terms.forEach((g) => {
        if (used[gk(g)]) return;
        const m = termRegex(g.term, "i").exec(src.text || "");
        if (m) found.push({ start: m.index, end: m.index + m[0].length, term: g.term });
      });
      found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
      const chosen = [];
      const taken = {};
      found.forEach((f) => {
        const g = group[f.term.toLowerCase()];
        if (taken[g] || (chosen.length && f.start < chosen[chosen.length - 1].end)) return;
        taken[g] = true; chosen.push(f);
      });
      const kept = chosen.slice(0, Math.max(0, room));
      room -= kept.length;
      kept.forEach((f) => { used[group[f.term.toLowerCase()]] = true; });
      marks[src.key] = kept;
    });
    return marks;
  }
  // Split one text into plain pieces and glossary terms: [{ text }, { text, term, means }].
  function glossaryParts(text, marks, glossary) {
    const parts = [];
    let at = 0;
    (marks || []).forEach((m) => {
      if (m.start > at) parts.push({ text: text.slice(at, m.start) });
      const g = glossary.find((x) => x.term === m.term);
      parts.push({ text: text.slice(m.start, m.end), term: m.term, means: g ? g.means : "" });
      at = m.end;
    });
    if (at < text.length) parts.push({ text: text.slice(at) });
    return parts.length ? parts : [{ text }];
  }

  // The target range (scoring, levels, its screen) lives in web/lesson-range.js.
  const scoreShot = Range.scoreShot;

  function flatten(lesson) {
    const list = [];
    (lesson.rounds || []).forEach((round, ri) => {
      (round.challenges || []).forEach((challenge, ci) => list.push({ round, ri, ci, challenge }));
    });
    return list;
  }

  function createController(options) {
    const store = safeStorage(options.storage);
    const send = options.send;
    const onChange = options.onChange || (() => {});
    let seq = 0;
    const s = {
      screen: "loading", lessonId: options.lessonId || "", lessons: [], lesson: null, flat: [],
      progress: emptyProgress(), index: 0, pending: null, result: null, guess: null,
      hints: 0, quiz: null, warmDone: false, notice: "", story: false, error: "",
      openTerm: null, testing: null, range: null, look: { open: false, pending: null, result: null },
    };

    // A chapter exam saves to the course record per attempt, so its screen progress is per attempt too: a second
    // attempt on this browser starts the exam fresh instead of opening it already solved. Lessons stay shared.
    const key = () => STORE_PREFIX + s.lessonId + (/^exam\d+$/.test(s.lessonId) && ATTEMPT_PATTERN.test(options.attempt || "") ? ":attempt:" + options.attempt : "");
    // "Show R" and "Show Python": each on unless the player turned it off. An old saved answer is dropped, never read.
    OLD_LANG_KEYS.forEach((k) => store.remove(k));
    s.show = (() => {
      try {
        const raw = JSON.parse(store.get(SHOW_KEY) || "null");
        if (raw && typeof raw === "object") return { r: raw.r !== false, py: raw.py !== false };
      } catch (e) { /* both on */ }
      return { r: true, py: true };
    })();
    // Does this step carry a note for R (which "r"), for Python ("py"), or either (no argument)?
    function stepHasNote(which) {
      const c = cur(), see = pinnedSee();
      if (!c) return false;
      const has = (k) => !!(c.challenge[k + "_note"] || (see && see[k + "_note"]));
      return which ? has(which === "py" ? "py" : "r") : has("r") || has("py");
    }
    function toggleShow(which) {
      if (which !== "r" && which !== "py") return;
      // A switch that changes nothing on this step says why, once (round 5, Tufte C).
      if (s.screen === "challenge") s.switchNote = which;
      s.show = Object.assign({}, s.show, { [which]: !s.show[which] });
      store.set(SHOW_KEY, JSON.stringify(s.show));
      change();
    }
    function loadProgress() {
      let p = emptyProgress();
      try {
        const raw = JSON.parse(store.get(key()) || "null");
        if (raw && typeof raw === "object") p = Object.assign(p, raw);
      } catch (e) { /* start clean */ }
      ["done", "lineUsed", "fails", "drafts", "skipped", "testedOut"].forEach((k) => { if (!p[k] || typeof p[k] !== "object") p[k] = {}; });
      return p;
    }
    const save = () => store.set(key(), JSON.stringify(s.progress));
    const cur = () => s.flat[s.index];
    const finished = (cid) => !!(s.progress.done[cid] || s.progress.lineUsed[cid] || s.progress.skipped[cid]);

    // The target range unlocks a wave when its lesson's last checkpoint has passed on this browser.
    // That is one flag in the lesson's own saved progress, set here and read by the range page.
    function syncLastCheckpoint() {
      let last = -1;
      s.flat.forEach((f, i) => { if (f.challenge.kind === "checkpoint") last = i; });
      if (last >= 0 && s.progress.done[s.flat[last].challenge.id] && !s.progress.lastCheckpointDone) {
        s.progress.lastCheckpointDone = true;
        return true;
      }
      return false;
    }
    const isPlay = (c) => !!c && c.challenge.kind === "play";
    const isExam = () => !!s.lesson && s.lesson.kind === EXAM_KIND;
    const hintCap = () => (isExam() ? EXAM_HINTS : LESSON_HINTS);
    const attempt = ATTEMPT_PATTERN.test(options.attempt || "") ? options.attempt : "";
    const withAttempt = (href) => (attempt ? href + (href.indexOf("?") >= 0 ? "&" : "?") + "attempt=" + encodeURIComponent(attempt) : href);
    const change = () => onChange();

    function resetTransient() { s.pending = null; s.result = null; s.guess = null; s.hints = 0; s.starter = false; s.quiz = null; s.warmDone = false; s.notice = ""; s.switchNote = false; s.dirty = false; s.dirtyDrawn = false; s.openTerm = null; s.look = { open: false, pending: null, result: null }; }

    // ---- skills: what each finished lesson says you can now do, kept in that lesson's own stored progress --------
    // A lesson counts as finished when its end screen is reached. The words are the lesson's own `close.can_do`.
    function recordSkill() {
      const L = s.lesson, canDo = L && L.close && Array.isArray(L.close.can_do) ? L.close.can_do.filter((x) => typeof x === "string" && x) : [];
      if (!canDo.length) return;
      s.progress.skill = { number: L.number, title: L.title || "", can_do: canDo };
      save();
    }
    function skillsSoFar() {
      const found = {};
      const add = (raw) => {
        const k = raw && typeof raw === "object" ? raw.skill : null;
        if (k && typeof k.number === "number" && Array.isArray(k.can_do) && k.can_do.length) found[k.number] = { number: k.number, title: String(k.title || ""), canDo: k.can_do.map(String) };
      };
      const read = (id) => { try { add(JSON.parse(store.get(STORE_PREFIX + id) || "null")); } catch (e) { /* skip */ } };
      store.keys(STORE_PREFIX).forEach((k) => read(k.slice(STORE_PREFIX.length)));
      (s.lessons || []).forEach((l) => { if (l && l.id) read(l.id); });
      add(s.progress);
      return Object.keys(found).map(Number).sort((a, b) => a - b).map((n) => found[n]);
    }

    // The end screen links to the next lesson, so it needs the lesson list (asked for once).
    function askList() { if (!s.lessons.length) send({ type: "lesson_list" }); }
    function goToFirstUnfinished() {
      const i = s.flat.findIndex((f) => !finished(f.challenge.id));
      if (i < 0) { s.screen = "end"; s.index = Math.max(0, s.flat.length - 1); recordSkill(); askList(); } else { s.screen = "challenge"; s.index = i; }
      resetTransient();
    }

    function open() {
      if (!s.lessonId) { send({ type: "lesson_list" }); return; }
      s.screen = "loading";
      send({ type: "lesson_info", lesson: s.lessonId, request_id: "info-" + (++seq) });
    }

    function handle(msg) {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "lessons") {
        s.lessons = Array.isArray(msg.lessons) ? msg.lessons : [];
        if (s.screen === "loading" || s.screen === "list") s.screen = "list";     // the end screen asks for the list too, and must stay
      } else if (msg.type === "lesson" && msg.lesson && msg.lesson.kind === "range") {
        s.lesson = msg.lesson;
        s.lessonId = s.lessonId || msg.lesson.id;
        s.flat = [];
        s.range = loadRange();
        s.screen = "range";
      } else if (msg.type === "lesson" && msg.lesson) {
        // A reconnect sends the lesson again: a player already on a line goes straight back to it.
        const playing = !!s.lesson && s.lesson.id === msg.lesson.id && s.screen === "challenge";
        s.lesson = msg.lesson;
        s.lessonId = s.lessonId || msg.lesson.id;
        s.flat = flatten(msg.lesson);
        s.progress = loadProgress();
        if (syncLastCheckpoint()) save();
        // A lesson already begun opens on its start card too, with Continue and Start again; a finished one opens on its end page.
        if (s.progress.started && (playing || s.flat.every((f) => finished(f.challenge.id)))) goToFirstUnfinished();
        else { s.screen = "start"; s.index = 0; }
      } else if (msg.type === "lesson_result" && s.look.pending && msg.request_id === s.look.pending) {
        s.look.pending = null;                       // a Look closer run is never graded and never touches the main result
        s.look.result = msg;
      } else if (msg.type === "lesson_result" && s.screen === "range") {
        if (!s.pending || msg.request_id !== s.pending) return;
        s.pending = null;
        rangeResult(msg);
      } else if (msg.type === "lesson_result") {
        if (!s.pending || msg.request_id !== s.pending) return;
        s.pending = null;
        s.result = msg;
        const c = cur();
        if (c) {
          const testing = s.testing && c.challenge.kind === "checkpoint" && s.testing.round === c.round.id;
          if (c.challenge.kind === "play") { /* ungraded */ }
          else if (msg.pass) {
            s.progress.done[c.challenge.id] = isExam() && msg.exam ? { code: s.lastCode, saved: true } : { code: s.lastCode };
            syncLastCheckpoint();
            if (testing) passTestOut(c);
            // An exam pass is saved as the chapter page would save it, so the Board and the ending count it. The
            // save is checked, never assumed: a failed write says so under the pass line.
            if (isExam() && msg.exam && options.onExamPass && options.onExamPass(msg.exam, s.lastCode) === false) s.result = Object.assign({}, msg, { works_too: NOT_SAVED });
          } else if (testing) {
            s.testing.runs += 1;                       // a test-out run costs nothing: no fail count, no hint
            if (s.testing.runs >= TEST_OUT_RUNS) returnToRound(c);
          } else s.progress.fails[c.challenge.id] = (s.progress.fails[c.challenge.id] || 0) + 1;
          save();
        }
      } else if (msg.type === "error") {
        s.pending = null;
        s.error = String(msg.message || "");
        // The very first lesson message can arrive before the server has read the lessons (the "Unknown lesson" of a first
        // load). One quiet second try, then the error and a way back to the list.
        if (s.screen === "loading" && /^Unknown lesson/.test(s.error) && !s.retried && s.lessonId) {
          s.retried = true;
          (options.retry || ((f) => setTimeout(f, 700)))(() => { if (s.screen === "loading") open(); });
          return;
        }
        if (s.screen === "loading") s.screen = "error";
        else s.notice = s.error;
      }
      change();
    }

    function start() { s.progress.started = true; save(); goToFirstUnfinished(); change(); }
    function toggleStory() { s.story = !s.story; change(); }

    function run(code) {
      const c = cur();
      if (!c || s.pending) return;
      // A guess is optional: Run always works, and the guess line then says "No guess this time" in plain ink.
      s.lastCode = code;
      s.progress.drafts[c.challenge.id] = code;
      save();
      s.pending = "run-" + (++seq);
      s.result = null;
      s.notice = ""; s.noticeFor = null;
      s.dirty = false; s.dirtyDrawn = false;
      change();
      send({ type: "lesson_run", lesson: s.lessonId, challenge: c.challenge.id, code, request_id: s.pending });
    }

    // The line the step was passed with (or the line Show me the line gave): the one Next belongs to.
    function passedLine(c) {
      const id = c.challenge.id, d = s.progress.done[id];
      if (d && typeof d.code === "string") return d.code;
      return s.progress.lineUsed[id] && typeof c.challenge.solution === "string" ? c.challenge.solution : null;
    }
    const sameCode = (a, b) => String(a || "").trim() === String(b || "").trim();
    // The verdict on screen must belong to the code now in the editor: an edit drops it.
    function staleVerdict() {
      if (!s.result && !s.notice) return false;
      s.result = null; s.notice = "";
      return true;
    }

    function draft(code) {
      const c = cur();
      if (!c) return;
      s.progress.drafts[c.challenge.id] = code;
      const ref = passedLine(c);
      s.dirty = ref !== null && !sameCode(code, ref);
      let redraw = !!s.result && !sameCode(code, s.lastCode) && staleVerdict();
      // A note about a line the game put in the editor (the shown line, a starter) is about that line only.
      if ((s.notice === LINE_NOTE || s.notice === STARTER_NOTE) && !sameCode(code, s.noticeFor)) { s.notice = ""; s.noticeFor = null; redraw = true; }
      save();
      if (redraw || s.dirty !== !!s.dirtyDrawn) { s.dirtyDrawn = s.dirty; change(); }
    }

    function editorCode() {
      const c = cur();
      if (!c) return "";
      const id = c.challenge.id;
      if (s.progress.done[id] && typeof s.progress.done[id].code === "string") return s.progress.done[id].code;
      if (typeof s.progress.drafts[id] === "string") return s.progress.drafts[id];
      return c.challenge.starter || "";
    }

    function reset() {
      const c = cur();
      if (!c) return "";
      delete s.progress.drafts[c.challenge.id];
      s.result = null; s.guess = null; s.notice = "";
      s.dirty = passedLine(c) !== null; s.dirtyDrawn = s.dirty;
      save(); change();
      return c.challenge.starter || "";
    }

    // Both take the position on screen; the stored value is the original index in the data.
    function predict(pos) {
      const c = cur();
      if (!c || !c.challenge.predict) return;
      s.guess = seededOrder(c.challenge.predict.choices.length, c.challenge.id)[pos];
      change();
    }
    function startRound() { if (s.quiz !== null) { s.warmDone = true; change(); } }
    // "Skip the warm-up" sits inside the warm-up card and goes once the question is answered (P13).
    function skipWarm() { if (warmGate() && s.quiz === null) { s.warmDone = true; change(); } }
    function warmGate() {
      const c = cur();
      return !!c && c.ci === 0 && !!c.round.remember && Array.isArray(c.round.remember.choices) && !s.warmDone;
    }
    function quiz(pos) {
      const c = cur();
      if (!c || !c.round.remember || !c.round.remember.choices || s.quiz !== null) return;
      s.quiz = seededOrder(c.round.remember.choices.length, "warm-up " + c.round.id)[pos];
      change();
    }

    function canShowLine() {
      const c = cur();
      if (!c) return false;
      const k = c.challenge.kind;
      return !isExam() && LINE_KINDS.includes(k) && !finished(c.challenge.id) &&
        (s.progress.fails[c.challenge.id] || 0) >= FAILS_BEFORE_LINE && typeof c.challenge.solution === "string";
    }

    function showLine() {
      if (!canShowLine()) return "";
      const c = cur();
      s.progress.lineUsed[c.challenge.id] = true;
      s.progress.drafts[c.challenge.id] = c.challenge.solution;
      s.result = null; s.notice = LINE_NOTE; s.noticeFor = c.challenge.solution; s.dirty = false; s.dirtyDrawn = false;
      save(); change();
      return c.challenge.solution;
    }

    // On a chapter the starter line is the one hint: once it is shown, no hint button; once a hint is shown, no starter.
    function canHint() {
      const c = cur();
      return !!c && (c.challenge.kind === "checkpoint" || c.challenge.kind === "write") && !finished(c.challenge.id) &&
        Array.isArray(c.challenge.hints) && c.challenge.hints.length > 0 &&
        (s.progress.fails[c.challenge.id] || 0) >= FAILS_BEFORE_HINT && !(isExam() && s.starter);
    }
    function hint() { if (canHint() && s.hints < Math.min(hintCap(), cur().challenge.hints.length)) { s.hints += 1; change(); } }
    // "Show a starter line": a checkpoint or chapter step may carry `starter_hint`, a partial line with ___ blanks.
    const starterOf = (c) => (c && typeof c.challenge.starter_hint === "string" && c.challenge.starter_hint.trim() ? c.challenge.starter_hint : "");
    function canStarter() {
      const c = cur();
      return !!starterOf(c) && !finished(c.challenge.id) && !s.starter && !(isExam() && s.hints > 0) &&
        (s.progress.fails[c.challenge.id] || 0) >= FAILS_BEFORE_STARTER;
    }
    // The page calls this once it has put the starter line in the editor: the screen then says what to do with it.
    function starterFilled(line) { s.notice = STARTER_NOTE; s.noticeFor = line; change(); }
    // Returns the starter line, so the page can put it in an empty editor; "" when it cannot be shown.
    function showStarter() {
      if (!canStarter()) return "";
      s.starter = true;
      change();
      return starterOf(cur());
    }

    function pinnedSee() {
      for (let i = s.index; i >= 0; i--) if (s.flat[i] && s.flat[i].challenge.kind === "see") return s.flat[i].challenge;
      return null;
    }

    // ---- test-out: a round's first screen offers its checkpoint; two runs, no penalty ----------
    const roundFirst = (c) => s.flat.findIndex((f) => f.ri === c.ri);
    const roundCheckpoint = (c) => {
      let at = -1;
      s.flat.forEach((f, i) => { if (f.ri === c.ri && f.challenge.kind === "checkpoint") at = i; });
      return at;
    };
    function canTestOut() {
      const c = cur();
      if (!c || s.screen !== "challenge" || c.ci !== 0 || s.testing || isExam()) return false;
      const at = roundCheckpoint(c);
      return at > s.index && !finished(s.flat[at].challenge.id);
    }
    function testOut() {
      if (!canTestOut()) return;
      const c = cur();
      s.testing = { round: c.round.id, runs: 0, passed: false, warm: s.warmDone };
      s.index = roundCheckpoint(c);
      resetTransient();
      change();
    }
    function passTestOut(c) {
      s.testing.passed = true;
      s.progress.testedOut[c.round.id] = true;
      s.flat.forEach((f) => {
        if (f.ri === c.ri && f.challenge.id !== c.challenge.id && !finished(f.challenge.id)) s.progress.skipped[f.challenge.id] = true;
      });
    }
    function returnToRound(c) {
      const warm = s.testing.warm;
      s.testing = null;
      s.index = roundFirst(c);
      resetTransient();
      s.warmDone = warm;                          // a warm-up already answered is not asked again
      s.notice = "That was two runs. Back to the start of this round. Nothing is counted against you.";
    }

    // ---- the fast lane (fix round 2, D8): "I know R or Python: try this lesson's checkpoints" -----------
    // From the start card it runs each round's checkpoint as a test-out, one round after another. A pass skips the
    // round's other tasks (the lesson is done when every checkpoint has passed); two misses drop the player into that
    // round from its start, as any test-out does. Nothing is locked and nothing is scored.
    function canFastLane() {
      return !isExam() && s.flat.some((f) => f.challenge.kind === "checkpoint" && !finished(f.challenge.id));
    }
    function fastLane() {
      if (s.screen !== "start" || !canFastLane()) return;
      s.progress.started = true; save();
      fastStep(0);
      change();
    }
    // The next round from index `from` with work left: its checkpoint as a fast-lane test-out, or (a round with no
    // checkpoint left) its first unfinished task, where the fast lane ends. No work left: the end page.
    function fastStep(from) {
      resetTransient();
      s.testing = null;
      const f = s.flat.findIndex((x, i) => i >= from && !finished(x.challenge.id));
      if (f < 0) { s.screen = "end"; s.index = Math.max(0, s.flat.length - 1); recordSkill(); askList(); return; }
      const at = roundCheckpoint(s.flat[f]);
      s.screen = "challenge";
      if (at >= 0 && !finished(s.flat[at].challenge.id)) {
        s.index = at;
        s.testing = { round: s.flat[at].round.id, runs: 0, passed: false, warm: false, fast: true };
      } else s.index = f;
    }
    function leaveTestOut() {
      if (!s.testing || s.testing.passed) return;
      const c = cur(), warm = s.testing.warm;
      s.testing = null;
      s.index = roundFirst(c);
      resetTransient();
      s.warmDone = warm;
      change();
    }
    function nextIndex(c) {
      if (s.progress.testedOut[c.round.id]) {
        const at = s.flat.findIndex((f) => f.ri > c.ri);
        return at < 0 ? s.flat.length : at;
      }
      return s.index + 1;
    }

    function next() {
      const c = cur();
      if (!c || !(finished(c.challenge.id) || isPlay(c))) return;
      if (isPlay(c) && !finished(c.challenge.id)) { s.progress.done[c.challenge.id] = { code: "", play: true }; save(); }
      const to = nextIndex(c);
      if (s.testing && s.testing.fast && s.testing.passed) { fastStep(to); change(); return; }
      s.testing = null;
      if (to >= s.flat.length) { s.screen = "end"; recordSkill(); askList(); } else s.index = to;
      resetTransient();
      change();
    }

    // ---- glossary ------------------------------------------------------------------------------
    // A word is underlined only the first time it appears in the lesson, on at most MAX_UNDERLINES words per screen, and
    // never on the warm-up quiz. The texts of one screen, in reading order: the round's explain (its first screen only),
    // the prompt and the predict question (always met), then hints and feedback lines (met only after acting, read last).
    // The marks depend on the lesson's text alone (and on which rounds are tested out), so a reload or a jump never moves
    // them. A round tested out (or being tested out) is met only at its checkpoint, so only that screen counts.
    function screenSources(f) {
      const c = f.challenge, early = [], hints = [], fb = [];
      if (f.ci === 0) early.push({ key: "explain", text: f.round.explain || "" });
      early.push({ key: c.id + "|prompt", text: c.prompt || "" });
      if (c.kind === "see" && c.predict && typeof c.predict.question === "string") early.push({ key: c.id + "|predict", text: c.predict.question });
      if (c.kind === "checkpoint") (Array.isArray(c.hints) ? c.hints.slice(0, hintCap()) : []).forEach((h, i) => hints.push({ key: c.id + "|hint" + i, text: String(h), late: true }));
      const fd = c.feedback || {};
      ["pass", "wrong", "forbids"].forEach((k) => { if (typeof fd[k] === "string") fb.push({ key: c.id + "|" + k, text: fd[k], late: true }); });
      (Array.isArray(fd.errors) ? fd.errors : []).forEach((e, i) => { if (e && typeof e.say === "string") fb.push({ key: c.id + "|err" + i, text: e.say, late: true }); });
      return { early, hints, fb };
    }
    // Two passes over the whole lesson, in reading order. Pass 1 gives each word to the first screen whose explain, prompt
    // or predict question holds it (four words at most per screen; the words over the limit wait for a later screen).
    // Pass 2 lets a hint or feedback line underline a word that no explain, prompt or question anywhere in the lesson
    // holds, in the room the screen has left. So a hint or a line the player may never open never takes a word away
    // from text the player always meets, and every word is underlined at most once.
    function lessonMarks(gl) {
      const testedOut = s.progress.testedOut || {};
      const away = (f) => f.challenge.kind !== "checkpoint" && (testedOut[f.round.id] || (s.testing && s.testing.round === f.round.id));
      const seen = {}, src = s.flat.map(screenSources), plan = s.flat.map(() => ({ marks: {}, room: MAX_UNDERLINES }));
      const take = (i, list, limit) => {
        const m = glossaryMarks(list, gl, seen, limit);
        let n = 0;
        list.forEach((x) => { plan[i].marks[x.key] = m[x.key] || []; n += plan[i].marks[x.key].length; });
        return n;
      };
      s.flat.forEach((f, i) => { if (!away(f)) plan[i].room -= take(i, src[i].early, plan[i].room); });
      s.flat.forEach((f, i) => {
        if (away(f)) return;
        plan[i].room -= take(i, src[i].hints, plan[i].room);
        src[i].fb.forEach((x) => take(i, [x], plan[i].room));       // one feedback line shows at a time, so each has the same room
      });
      return plan.map((x) => x.marks);
    }
    let markMemo = { sig: "", plan: null };
    function screenMarks(gl) {
      const sig = [s.lessonId, JSON.stringify(s.progress.testedOut || {}), s.testing ? s.testing.round : ""].join("|");
      if (markMemo.sig !== sig || markMemo.lesson !== s.lesson) markMemo = { sig, lesson: s.lesson, plan: lessonMarks(gl) };
      return markMemo.plan[s.index] || {};
    }
    // A feedback line on screen is one of the lesson's own lines when its text matches one exactly.
    function feedbackKey(ch, text) {
      const f = ch.feedback || {};
      for (const k of ["pass", "wrong", "forbids"]) if (typeof f[k] === "string" && f[k] === text) return ch.id + "|" + k;
      const errs = Array.isArray(f.errors) ? f.errors : [];
      for (let i = 0; i < errs.length; i++) if (errs[i] && errs[i].say === text) return ch.id + "|err" + i;
      return "";
    }
    function glossaryFor() {
      const gl = s.lesson && Array.isArray(s.lesson.glossary) ? s.lesson.glossary : [];
      if (!gl.length) return null;
      const marks = screenMarks(gl);
      return { gl, marks, parts: (key, text) => (key && marks[key] ? glossaryParts(text, marks[key], gl) : null) };
    }
    // "Words with a dotted line...": said once in a lesson, on the first screen that underlines a word (P12).
    function glossTipHere(gloss) {
      if (!gloss || warmGate() || !markMemo.plan) return false;
      const marked = (m) => Object.keys(m || {}).some((k) => (m[k] || []).length && !/\|(hint|pass|wrong|forbids|err)\d*$/.test(k));
      return markMemo.plan.findIndex(marked) === s.index;
    }
    function toggleTerm(term) { s.openTerm = s.openTerm === term ? null : term; change(); }
    // places: { name: parts }, in reading order; the open term shows under the first place that holds it.
    function glossView(places) {
      const names = Object.keys(places);
      for (const name of names) {
        const hit = (places[name] || []).find((p) => p.term && p.term === s.openTerm);
        if (hit) return { term: hit.term, means: hit.means, under: name };
      }
      return null;
    }
    function termOpen(parts) { return (parts || []).map((p) => (p.term ? Object.assign({}, p, { open: p.term === s.openTerm }) : p)); }

    // ---- Look closer: an optional run under the worked line, never graded ------------------------------
    // It shows only on the screen of the `see` that carries it (never on the challenges after it, never at a
    // checkpoint; since fix round 2 also beside a test-out, which Lesson 1 round 1 now offers), and while it is open it takes the
    // pocket dictionary's place in the left column, so opening it adds no height.
    function lookOf(see) {
      const l = see && see.look_closer;
      return l && typeof l.text === "string" && typeof l.code === "string" && l.code ? l : null;
    }
    function lookHere() {
      const c = cur();
      if (s.screen !== "challenge" || !c || c.challenge.kind !== "see" || warmGate()) return null;
      return lookOf(c.challenge);
    }
    function toggleLook() {
      if (!lookHere()) return;
      s.look.open = !s.look.open;
      change();
    }
    function tryLook() {
      const l = lookHere();
      if (!l || !s.look.open || s.look.pending) return;
      s.look.result = null;
      s.look.pending = "look-" + (++seq);
      change();
      send({ type: "lesson_run", lesson: s.lessonId, challenge: cur().challenge.id, code: l.code, look: true, request_id: s.look.pending });
    }

    // ---- when a lesson row is reached ------------------------------------------------------------
    // A row names the idea it teaches by its named inputs (replace=) or, failing those, its functions (sample(). The row waits
    // for the first task of its round whose prompt, hints, starter or solution uses them; none found means the round's start.
    // A row can still say so itself with `from_challenge`.
    const rowTokens = (row) => {
      const j = String(row.julia || "");
      const named = Array.from(j.matchAll(/[;,(]\s*([A-Za-z_]\w*)\s*=(?![=>])/g), (m) => new RegExp("\\b" + m[1] + "\\s*="));
      if (named.length) return named;
      return Array.from(new Set(Array.from(j.matchAll(/([A-Za-z_]\w*)\(/g), (m) => m[1]))).map((f) => new RegExp("\\b" + f + "\\("));
    };
    const taskText = (ch) => [ch.prompt, ch.starter, ch.solution, ch.starter_hint].concat(Array.isArray(ch.hints) ? ch.hints.map((h) => (h && h.text) || h) : []).filter((x) => typeof x === "string").join("\n");
    function firstTaskOf(row, r) {
      const tokens = rowTokens(row);
      if (!tokens.length) return -1;
      return s.flat.findIndex((f) => f.ri === r && tokens.every((re) => re.test(taskText(f.challenge))));
    }

    // ---- a chapter's pocket dictionary -----------------------------------------------------------
    // The server gives a chapter the rows of Lessons 1 to N, written on each lesson's practice table. Here a practice
    // table name becomes the name of the table this chapter step works on (practice.col becomes case.col), but only
    // when every column the rows take from it is a column of that table; a name the rows
    // assign (tray = ...) is never renamed. So the rows show the chapter's own table, and nothing is invented.
    let renameMemo = { key: "", map: null };
    function examRenames() {
      if (!isExam()) return {};
      const L = s.lesson, values = L.data_values || {};
      const c = cur() || s.flat[0];
      let target = c && c.challenge.data && values[c.challenge.data] ? c.challenge.data : "";
      if (!target) target = (s.flat.map((f) => f.challenge.data).find((d) => d && values[d] && Array.isArray(values[d].columns))) || "";
      const key = (L.id || "") + "|" + target;
      if (renameMemo.key === key && renameMemo.lesson === L) return renameMemo.map;
      const map = {};
      const cols = target && values[target] && Array.isArray(values[target].columns) ? values[target].columns.map(String) : null;
      if (cols) {
        const rows = (L.dictionary || []).map((r) => String(r.julia || ""));
        const all = rows.join("\n");
        const assigned = new Set();
        rows.forEach((t) => { for (const m of t.matchAll(/(?:^|[\n;])\s*([A-Za-z_]\w*)\s*=(?!=)/g)) assigned.add(m[1]); });
        const names = new Set();
        for (const m of all.matchAll(/(?<![\w.:$])([A-Za-z_]\w*)(?=\.[A-Za-z_]|\[)/g)) names.add(m[1]);
        names.forEach((x) => {
          if (x === target || values[x] || assigned.has(x)) return;
          const used = new Set();
          rows.forEach((t) => {
            if (!new RegExp("(?<![\\w.:$])" + x + "(?!\\w)").test(t)) return;
            for (const m of t.matchAll(new RegExp("(?<![\\w.:$])" + x + "\\.([A-Za-z_]\\w*)", "g"))) used.add(m[1]);
            for (const m of t.matchAll(/(?<!=>\s*)(?<!\w):([A-Za-z_]\w*)/g)) used.add(m[1]);     // :col, never a new name after =>
          });
          if (used.size && Array.from(used).every((u) => cols.includes(u))) map[x] = target;
        });
      }
      renameMemo = { key, lesson: L, map };
      return map;
    }
    function renameText(text, map) {
      let t = String(text || "");
      Object.keys(map).forEach((x) => { t = t.replace(new RegExp("(?<![\\w.:$\"])" + x + "(?![\\w\"])", "g"), map[x]); });
      return t;
    }
    // A sentence is renamed only inside its backtick spans; the julia, R and Python columns are all code.
    function renameInCode(text, map) { return String(text || "").replace(/\x60[^\x60]*\x60/g, (span) => renameText(span, map)); }
    // A chapter's own table-name row (a bare name, marked `chapter`) shows only on a task whose data, second table, text or
    // starter names that table, so Task 2 never lists Task 1's tables. Every other row is shown, as before.
    function examRowHere(row) {
      const j = String(row.julia || "");
      if (typeof row.chapter !== "number" || !/^[A-Za-z_]\w*$/.test(j)) return true;
      const c = cur();
      if (!c) return true;
      const ch = c.challenge;
      if (ch.data === j || ch.data_also === j) return true;
      return new RegExp("(?<![\\w.:$])" + j + "(?!\\w)").test([ch.prompt, ch.starter].filter(Boolean).join("\n"));
    }
    function renameRow(row, map) {
      if (!Object.keys(map).length) return row;
      return Object.assign({}, row, { julia: renameText(row.julia, map), means: renameInCode(row.means, map), r: renameText(row.r, map), py: renameText(row.py, map) });
    }

    // ---- notes for R and Python users ---------------------------------------------------------------
    // A note that reads as code (no sentence end, and brackets, a $, an arrow or a pipe in it) is shown as code.
    // The screen says "In R:" or "In Python:" once, so a label the note itself starts with is dropped (never "In R: R:").
    const NOTE_LABEL = { r: /^\s*(?:In\s+)?R\s*:\s*/i, py: /^\s*(?:In\s+)?Python\s*:\s*/i };
    function noteView(text, lang) {
      const t = String(text || "").replace(NOTE_LABEL[lang] || /^$/, "").trim();
      if (!t) return null;
      const code = noteIsCode(t);
      return { text: t, code };
    }

    // ---- target range: web/lesson-range.js (the range builder owns it) --------------------------
    const range = Range.createRangeController({ s, store, key, send, change, nextSeq: () => ++seq, unknownWordLine, STORE_PREFIX });
    const { loadRange, rangeResult, rangeView, selectWave, nextWave, leaveRangeEnd, toggleHint, fire, rangeDraft, rangeCode } = range;

    // Start again clears the steps, not what the player has already earned: the range flag and the skill stay.
    function restart() {
      const keep = { lastCheckpointDone: s.progress.lastCheckpointDone, skill: s.progress.skill };
      store.remove(key());
      s.progress = emptyProgress();
      Object.keys(keep).forEach((k) => { if (keep[k]) s.progress[k] = keep[k]; });
      if (Object.keys(keep).some((k) => keep[k])) save();
      s.screen = "start"; s.index = 0; s.testing = null; resetTransient();
      change();
    }

    // Long story text reads as short paragraphs: two sentences each, never one dense block.
    function shortParas(text) {
      // A quotation is never cut in the middle: a piece with an odd number of quote marks joins the one after it.
      const sentences = [];
      String(text || "").trim().split(/(?<=[.!?])\s+/).filter((x) => x).forEach((x) => {
        const last = sentences.length - 1;
        if (last >= 0 && (sentences[last].match(/"/g) || []).length % 2 === 1) sentences[last] += " " + x; else sentences.push(x);
      });
      const paras = [];
      for (let i = 0; i < sentences.length; i += 2) paras.push(sentences.slice(i, i + 2).join(" "));
      return paras;
    }

    function view() {
      // Notes and dictionary columns: R while "Show R" is on, Python while "Show Python" is on (both on by default).
      const out = { screen: s.screen, error: s.error, notice: s.notice, lessons: s.lessons, show: Object.assign({}, s.show),
        usesR: s.show.r, usesPy: s.show.py };
      // The bar on every screen: "Julia Time" and "Board" go to the Board; the middle says where the player is. The two
      // switches show where there are notes or a dictionary to follow them: a lesson or chapter, not the list or the range.
      out.nav = { text: "", board: withAttempt(BOARD_HREF), switches: false, cheat: false };
      if (s.screen === "list") { out.skills = skillsSoFar(); out.nav.text = "All lessons"; }
      const L = s.lesson;
      if (!L) return out;
      if (s.screen === "range" && s.range) { out.range = rangeView(); out.dataLabel = out.range.dataLabel; out.nav.text = "Target range (optional)"; return out; }
      const canDo = L.close && Array.isArray(L.close.can_do) ? L.close.can_do.filter((x) => typeof x === "string" && x) : [];
      const exam = isExam();
      const roundsN = (L.rounds || []).length;
      const stepOf = typeof L.number === "number" && L.number >= 1 && L.number <= CHAPTERS ? "Step " + L.number + " of " + CHAPTERS + " · " : "";
      const unit = (exam ? "Chapter " : "Lesson ") + L.number;
      out.nav.text = stepOf + unit;
      out.nav.switches = true;
      out.nav.switchNote = "";
      out.nav.cheat = Array.isArray(L.dictionary) && L.dictionary.length > 0;
      // The cheat sheet on a lesson's start card shows only rows from rounds reached (P12, D1-11); the end page and a
      // chapter show them all.
      const reached = s.screen === "end" ? Infinity : Math.max(0, ...s.flat.filter((f) => finished(f.challenge.id)).map((f) => f.ri), s.screen === "challenge" && cur() ? cur().ri : 0);
      const roundAt = (row) => (L.rounds || []).findIndex((x) => x.id === row.from_round);
      out.sheet = out.nav.cheat ? L.dictionary.filter((r) => isExam() || roundAt(r) < 0 || roundAt(r) <= reached).map((r) => renameRow(r, examRenames())) : [];
      // An exam is named for its chapter, never as a lesson: "Chapter N: <its title>".
      // The start card says what it is and how long it takes: "Lesson 2 · 4 rounds · about 30 min" (the bar already says
      // "Step 2 of 6"), and a chapter counts tasks: "Chapter 2 · 3 tasks · about 8 min".
      const place = [unit, exam ? plural(s.flat.length, "task", "tasks") : plural(roundsN, "round", "rounds")];
      if (Number.isInteger(L.minutes) && L.minutes > 0) place.push("about " + L.minutes + " min");
      const at = s.flat.findIndex((f) => !finished(f.challenge.id));
      const resume = s.progress.started && at >= 0 ? (exam ? "You stopped at task " + (at + 1) + " of " + s.flat.length + "."
        : "You stopped at Round " + (s.flat[at].ri + 1) + (s.flat[at].challenge.kind === "play" ? ", the Try anything step." : ", task " + (taskNumber(s.flat[at]) || 1) + ".")) : "";
      out.lesson = { title: L.title, goal: L.goal, story: L.story || "", storyMore: L.story_more || "", storyParas: shortParas(L.story_more || ""), storyOpen: s.story, number: L.number, canDo,
        exam, heading: exam ? "Chapter " + L.number + ": " + L.title : L.title, name: unit, place: place.join(" · "),
        chapterLine: exam ? (L.banner || CHAPTER_START) : "", resume, startLabel: s.progress.started ? "Continue" : "Start", canRestart: !!s.progress.started,
        fastLane: canFastLane() ? FAST_LABEL : "" };
      out.hasProgress = s.progress.started;
      out.dataLabel = L.data_label || "";
      if (s.screen === "end") {
        out.end = {
          finding: (L.close && L.close.finding) || "", next: (L.close && L.close.next) || "",
          canDo, mistake: (L.close && typeof L.close.common_mistake === "string" && L.close.common_mistake) || "",
          // A chapter's end no longer repeats its lesson's skills (P05): the lesson's end page said them.
          skills: [], number: L.number,
          // One forward route (P04): the main button. The Board still lets a player skip, since nothing is locked.
          go: endGo(L, exam),
          lines: endLines(),
          clues: clues(),
          own: L.close && L.close.own_work && L.close.own_work.code ? { title: L.close.own_work.title || OWN_TITLE, say: L.close.own_work.say || "", code: L.close.own_work.code, first: !exam && L.number === 6 ? OWN_FIRST_TIME : null } : null,
          dictionary: L.dictionary || [],
          skipped: skippedGroups(),
        };
      }
      const c = cur();
      if (s.screen === "challenge" && c) {
        const ch = c.challenge, id = ch.id;
        const inRound = c.round.challenges || [];
        const roundsN = (L.rounds || []).length;
        const first = c.ci === 0;
        const see = pinnedSee();
        const fails = s.progress.fails[id] || 0;
        const gloss = glossaryFor();
        const gp = (k, text) => { const parts = gloss ? gloss.parts(k, text) : null; return parts ? termOpen(parts) : null; };
        // A try-anything box that names no table shows the table of the challenge before it in the round, so the numbers to play with are on screen.
        let dataName = ch.data || "";
        if (!dataName && ch.kind === "play") for (let k = c.ci - 1; k >= 0 && !dataName; k--) dataName = inRound[k].data || "";
        const data = dataName && L.data_values ? L.data_values[dataName] : null;
        // The bar: "Step 3 of 6 · Lesson 3 · Round 2 of 3" (a chapter: "Step 3 of 6 · Chapter 3"), then the dots and
        // "Line 3 of 6". A chapter counts its lines across the whole chapter, never as rounds of a lesson. The try-anything
        // box is not a line, so it has no dot and no number.
        if (!exam) out.nav.text += " · Round " + (c.ri + 1) + " of " + roundsN;
        const lines = exam ? s.flat : s.flat.filter((f) => f.ri === c.ri && f.challenge.kind !== "play");
        const lineAt = lines.findIndex((f) => f.challenge.id === id);
        // "Task 3 of 6" (fix round 2, D3b): "line" now means a line of code only. No dots and no clue counter.
        out.strip = {
          text: out.nav.text,
          line: ch.kind === "play" ? "Try anything" : "Task " + (lineAt + 1) + " of " + lines.length,
        };
        const remember = first && (warmGate() || !(c.round.remember && c.round.remember.choices)) ? rememberView(c.round.remember) : null;
        // A new round opens with one line that says the last one is done, so the warm-up does not arrive from nowhere.
        // It says the last round is done, names what it covered, and looks ahead.
        // The done line is its own heading, apart from the warm-up (P13): "Round 1 done: Names", then "Next: Round 2 of 3, ...".
        if (remember && warmGate() && c.ri > 0) {
          const before = (L.rounds[c.ri - 1] || {}).title;
          remember.roundLine = "Round " + c.ri + " done" + (before ? ": " + before : "");
          remember.nextLine = "Next: Round " + (c.ri + 1) + " of " + roundsN + (c.round.title ? ", " + c.round.title : "") + ".";
        }
        // the warm-up quiz is met before anything is taught, so it carries no underlined words
        const predict = ch.predict && ch.kind === "see" ? predictView(ch) : null;
        if (predict) predict.questionParts = gp(id + "|predict", predict.question);
        const hints = hintTexts(c).map((h, i) => Object.assign(h, { parts: gp(id + "|hint" + i, h.text) }));
        const fbText = s.pending ? "" : (s.result ? feedbackLine(ch, s.result) : s.notice);
        const explainParts = first ? gp("explain", c.round.explain || "") : null, promptParts = gp(id + "|prompt", ch.prompt || ""), feedbackParts = fbText ? gp(feedbackKey(ch, fbText), fbText) : null;
        const places = { explain: explainParts, prompt: promptParts, predict: predict && predict.questionParts, feedback: feedbackParts };
        hints.forEach((h, i) => { places["hint" + i] = h.parts; });
        const look = lookHere();
        const nextEnabled = finished(id) || isPlay(c);
        const lineShown = !!s.progress.lineUsed[id] && !s.progress.done[id];
        const ran = !!s.result || finished(id);                      // has this screen's line been run yet?
        const ownSee = ch.kind === "see";
        const seeTask = see && !exam ? lines.findIndex((f) => f.challenge.id === see.id) + 1 : 0;
        // No answer before the guess: on a worked line that asks for a guess, what it gives back stays out of sight until it has run.
        const hideAnswer = ownSee && !!ch.predict && !ran;
        // "a different table" only when both name a table and the two differ.
        const sameTable = !see || !see.data || !ch.data || see.data === ch.data;
        // The worked example is hidden when it is the very line the editor starts with: the same line twice is a puzzle.
        const sameAsEditor = !!see && !ownSee && String(ch.starter || "").trim() !== "" && String(ch.starter || "").trim() === String(see.starter || "").trim();
        // Notes for R and Python users: the chosen language's note, or both for neither. On a worked line they sit in its card.
        // On a line that asks for a pick, the notes wait for the run, so a note never answers the pick (P10, D4-5).
        const notes = hideAnswer ? { r: null, py: null } : { r: s.show.r ? noteView(ch.r_note, "r") : null, py: s.show.py ? noteView(ch.py_note, "py") : null };
        const hasNotes = !!(notes.r || notes.py);
        const renames = examRenames();
        const dictRows = warmGate() || (look && s.look.open) ? [] : exam ? (L.dictionary || []).filter(examRowHere).map((row) => renameRow(row, renames)) : (L.dictionary || []).filter((row) => {
          const r = (L.rounds || []).findIndex((x) => x.id === row.from_round);
          if (r < 0 || r > c.ri) return false;
          if (hideAnswer && row.from_challenge === id) return false;
          if (r < c.ri) return true;
          const at = row.from_challenge ? s.flat.findIndex((f) => f.challenge.id === row.from_challenge && f.ri === r) : firstTaskOf(row, r);
          return at < 0 || at <= s.index;
        });
        // A chapter shows its own lesson's rows first; the rows of earlier lessons wait under a fold.
        const earlierRow = (row) => exam && typeof row.lesson === "number" && row.lesson < L.number;
        const guessed = ch.kind === "see" && !!ch.predict && s.guess !== null && !!s.result && s.result.status === "ok" && typeof ch.predict.answer === "number";
        const guessWrong = guessed && s.guess !== ch.predict.answer;
        const examHelp = exam ? { used: s.hints > 0 || !!s.starter,
          hintOffered: Array.isArray(ch.hints) && ch.hints.length > 0 && fails >= FAILS_BEFORE_HINT && !finished(id),
          starterOffered: !!starterOf(c) && !finished(id) && (s.starter || fails >= FAILS_BEFORE_STARTER) } : null;
        out.ch = {
          id, kind: ch.kind, kindLabel: KIND_LABELS[ch.kind] || "", roundTitle: c.round.title || "",
          // the round's one-line story, above its first task (P14, D3-6)
          roundStory: first && !warmGate() && typeof c.round.story === "string" ? c.round.story : "", explain: first ? (c.round.explain || "") : "",
          remember,
          warmGate: warmGate(),
          prompt: ch.prompt || "",
          // The round's rule stays in view on every line after its first, as one collapsed line.
          rule: !first && !warmGate() ? String(c.round.explain || "") : "",
          explainParts, promptParts, feedbackParts,
          gloss: warmGate() ? null : glossView(places),
          testOut: testOutView(c),
          // A fix comes after other work, so its pinned line says it is an earlier one and drops the R note that went with it.
          // The worked line stays as a card on later screens, captioned as an example, without its From R note.
          pinned: see && !exam && ch.kind !== "checkpoint" && ch.kind !== "play" && !sameAsEditor ? { code: see.starter || "",
            labels: (see.labels || []).filter((l) => !(hideAnswer && l.is === "result")),
            notes: ownSee ? notes : { r: null, py: null },
            // It names the task it came from ("task 2"), so an earlier worked line is never read as the current job (D6-10).
            label: ownSee ? "" : (!sameTable ? "Worked example, a different table" : "Worked example") + (seeTask ? " (task " + seeTask + ")" : "") } : null,
          // Notes on a line that has no worked-example card of its own sit under the instruction.
          notes: hasNotes && !(ownSee && see && !exam) ? notes : null,
          look: look ? { text: look.text, code: look.code, open: s.look.open, pending: !!s.look.pending, result: s.look.result ? lookResultView(s.look.result) : null } : null,
          // A row shows from its round; with `from_challenge` (a challenge id in that round) it waits for that screen.
          // An exam shows every row it has (the server gives it Lessons 1 to N's), open from the start.
          dictionary: dictRows.filter((row) => !earlierRow(row)),
          dictEarlier: dictRows.filter(earlierRow),
          dictEarlierFrom: exam && L.number > 1 ? (L.number === 2 ? "Lesson 1" : "Lessons 1 to " + (L.number - 1)) : "",
          // The drawer starts closed on a round's first screen and on a checkpoint; the player can open it.
          dictClosed: true,
          code: editorCode(),
          predict,
          // A table shown for a task about positions is numbered by row, so positions are read, not counted by eye.
          rowNumbers: !exam && !!data && /\bpositions?\b|\w\[\s*(?:\d|end\b|[a-z_]\w*\s*:)/i.test([ch.prompt, ch.starter, ch.solution].filter(Boolean).join("\n")),
          data: data || null, dataName: data ? dataName : "",
          dataAlso: (ch.data_also && L.data_values && L.data_values[ch.data_also]) || null, dataAlsoName: ch.data_also || "",
          pending: !!s.pending,
          result: s.result ? foldedResult(s.result, ch, fbText, data, dataName) : null,
          // Before a run the play box says it is optional; after a run of several lines, that only the last line shows.
          playNote: ch.kind !== "play" ? "" : (!s.result ? (s.pending ? "" : "Optional. Press " + (nextIndex(c) >= s.flat.length ? "Finish" : "Next") + " whenever you like.") : (codeLines(s.lastCode) > 1 ? "Only the last line's value is shown." : "")),
          feedback: fbText, worksToo: s.pending || !s.result ? "" : worksTooLine(s.result), worksTooWarn: !s.pending && !!s.result && s.result.works_too === NOT_SAVED,
          guessLine: guessLine(ch), guessWrong,
          // A line shown with "Show me the line" has not run yet: Run says "Run" and stays the main button until it passes.
          lineShown, noteLine: !s.result && (s.notice === LINE_NOTE || s.notice === STARTER_NOTE),
          runLabel: nextEnabled && !isPlay(c) && !lineShown ? "Run again" : "Run",
          showLine: canShowLine(), hintsAvailable: canHint() || (exam && examHelp.hintOffered), hints, hintsTotal: Array.isArray(ch.hints) ? Math.min(hintCap(), ch.hints.length) : 0,
          starter: { available: canStarter() || (exam && examHelp.starterOffered), shown: s.starter && !!starterOf(c) ? starterOf(c) : "" },
          // A chapter's one piece of help (P26): after a wrong run the hint and the starter line are offered until one is
          // used; then both buttons stay where they were, switched off, with one line that says why.
          helpUsed: exam && examHelp.used,
          helpNote: exam && examHelp.used && !finished(id) ? "You have used this task's one piece of help." : "",
          // A switched-off Next says why (P12).
          nextWhy: nextEnabled || s.pending ? "" : (s.result ? "Next opens when your line gives the right answer." : "Run your line to go on."),
          glossTip: glossTipHere(gloss) ? "Words with a dotted line have a meaning: press one to read it." : "",
          // Julia's error is an alert; a line that ran but gave the wrong answer is a quieter "not yet".
          feedbackTone: s.pending || !s.result || isPlay(c) ? "" : (s.result.pass ? "ok" : (s.result.status === "ok" ? "notyet" : "alert")),
          board: boardTiles(ch), clue: clueLine(c),
          nextEnabled, nextPrimary: nextEnabled && !isPlay(c) && !s.dirty && !lineShown, lineUsed: !!s.progress.lineUsed[id], fails,
          isLast: nextIndex(c) >= s.flat.length,
        };
        // Every toggle on a step says what it did (round 6): the notes appearing or going is the answer; otherwise one short line.
        if (s.switchNote) {
          const w = s.switchNote === "py" ? "py" : "r", name = w === "py" ? "Python" : "R";
          const visible = !!((out.ch.notes && out.ch.notes[w]) || (out.ch.pinned && out.ch.pinned.notes[w]));
          out.nav.switchNote = !stepHasNote(w) ? (stepHasNote() ? SWITCH_NONE_ONE(name) : SWITCH_NONE) : (hideAnswer && !visible) ? SWITCH_WAITS : "";
        }
      }
      return out;
    }

    // The end screen's one main action. After Lesson N (N at most 6): solve Chapter N, the exam. After Chapter N's exam:
    // the next lesson, or the ending after the last chapter. null when there is nowhere to go.
    function endGo(L, exam) {
      const n = L.number;
      if (typeof n !== "number") return null;
      if (!exam) return n >= 1 && n <= CHAPTERS ? { label: "Continue: Chapter " + n, href: withAttempt("lesson.html?lesson=" + EXAM_KIND + n) } : null;
      if (n >= CHAPTERS) return { label: "See how the case ends", href: withAttempt("course/ending.html") };
      const next = (s.lessons || []).find((l) => l && l.number === n + 1 && l.id && l.kind !== EXAM_KIND && l.kind !== "range");
      return next ? { label: "Continue: Lesson " + next.number, href: withAttempt("lesson.html?lesson=" + encodeURIComponent(next.id)) } : null;
    }

    // Tested-out lines, one entry per round: "Round title · lines 1 to 5", never each prompt in full.
    function skippedGroups() {
      const groups = [];
      s.flat.filter((f) => s.progress.skipped[f.challenge.id] && f.challenge.kind !== "play").forEach((f) => {
        let g = groups.find((x) => x.ri === f.ri);
        if (!g) { g = { ri: f.ri, round: f.round.title || "", ns: [] }; groups.push(g); }
        g.ns.push(f.ci + 1);
      });
      return groups.map((g) => {
        const run = g.ns.every((n, i) => i === 0 || n === g.ns[i - 1] + 1);
        const label = g.ns.length === 1 ? "task " + g.ns[0] : "tasks " + (run ? g.ns[0] + " to " + g.ns[g.ns.length - 1] : g.ns.join(", "));
        return { round: g.round, n: g.ns[0], ns: g.ns, label, note: "skipped (tested out)" };
      });
    }

    function testOutView(c) {
      const t = s.testing && s.testing.round === c.round.id ? s.testing : null;
      const left = t ? TEST_OUT_RUNS - t.runs : 0;
      let note = "";
      const last = t && nextIndex(c) >= s.flat.length;
      if (t && t.passed) note = "You got the checkpoint right, so this round is done. Press " + (last ? "Finish" : "Next") + " to go on.";
      else if (t && t.fast) note = "Fast lane: the checkpoint of Round " + (c.ri + 1) + " of " + ((s.lesson.rounds || []).length) + ". " + plural(left, "run", "runs") + " left.";
      else if (t) note = "Test-out: " + plural(left, "run", "runs") + " left.";
      return { available: canTestOut(), active: !!t, passed: !!(t && t.passed), note };
    }

    // A task's number in its round ("Task 3 of 6"); the try-anything box has none.
    function taskNumber(f) {
      if (!f || f.challenge.kind === "play") return 0;
      return s.flat.filter((g) => g.ri === f.ri && g.challenge.kind !== "play").findIndex((g) => g.challenge.id === f.challenge.id) + 1;
    }
    // A checkpoint's `clue` is shown as "Worth remembering: ..." (fix round 2, D6) and listed on the end page. The lesson
    // text may still start with "Clue 1:"; that is dropped. No counter in the bar, and no promise of a later list.
    const clueText = (clue) => upFirst(String(clue).replace(/^\s*clue\s*\d*\s*[:.\-]\s*/i, "").trim());
    function clues() {
      return s.flat.filter((f) => f.challenge.kind === "checkpoint" && f.challenge.clue && s.progress.done[f.challenge.id]).map((f) => clueText(f.challenge.clue));
    }
    // It shows only on the run that passes its checkpoint, never on a play box, a failed run or a reload.
    function clueLine(c) {
      const ch = c.challenge;
      if (ch.kind !== "checkpoint" || !ch.clue || !s.result || !s.result.pass || !s.progress.done[ch.id]) return "";
      return "Worth remembering: " + clueText(ch.clue);
    }

    // A Look closer run: the same value view, plus whether Julia could run it. Never graded.
    function lookResultView(r) {
      const v = resultView(r);
      v.failed = r.status !== "ok";
      return v;
    }

    // The value view for the main result. Julia's own message is folded, and shown only when it says something the
    // friendly line does not: never blank, never a repeat, never the raw error of a blank (___) the player has not filled.
    // A fix screen shows the message's first line beside the fold's name, so "read the error" is possible without opening it.
    function foldedResult(r, ch, friendly, data, dataName) {
      const v = resultView(r, data, dataName);
      const blank = /___/.test(String(s.lastCode || ""));
      if (blank || r.status !== "error" || v.message === String(friendly || "").trim()) v.message = "";
      v.peek = ch.kind === "fix" && v.message ? peekLine(v.message) : "";
      return v;
    }
    function peekLine(message) {
      const line = String(message).split("\n").map((x) => x.trim()).find((x) => x && !/^(ParseError|LoadError):?$/.test(x)) || "";
      return line.length > 90 ? line.slice(0, 87) + "..." : line;
    }

    // ---- Julia's exact print (fix round 2, P08, decision D1) -----------------------------------------------------
    // The engine's `shown` is Julia's own text/plain print of the value. The screen shows it verbatim, never rewritten,
    // with a short plain caption where the print could surprise, and, for a true/false answer per row of the table on
    // screen, that row's name beside each answer, outside Julia's text.
    const KEY_COLUMN = /(^|_)id$|^story$|^name$|^shelf/;
    // Round 6 (result fix): a short list (12 items or fewer, one item per printed line) is also laid out as ONE ROW of cells, position above, value below
    // (and the row's name under it when the screen added one), so a player told to read it sees every item without an inner scroll. It is a re-layout
    // of the same printed lines, trimmed of padding and nothing else; Julia's exact print stays one tap away (drawValue).
    const STRIP_MAX = 12, STRIP_ROW_PX = 560, STRIP_CHAR_PX = 9.7, STRIP_PAD_PX = 10;
    function stripOf(lines, n, keys) {
      if (!(n >= 1 && n <= STRIP_MAX) || lines.length !== n + 1) return null;
      const values = lines.slice(1).map((x) => x.trim());
      if (values.some((x) => !x || x === "\u22ee")) return null;
      const fitFor = (items) => Math.max(1, Math.floor(STRIP_ROW_PX / (Math.max.apply(null, items.map((x) => x.length).concat([2])) * STRIP_CHAR_PX + STRIP_PAD_PX)));
      // The row names (jar ids) go under the cells only when they still fit ONE row; else the strip is position and value only, and the names
      // stay beside Julia's print in the fold. (Two rows of names would be taller than the Result can be, which is what this strip avoids.)
      const names = keys && keys.values && keys.values.length === n && fitFor(values.concat(keys.values.map(String))) >= n ? keys.values.map(String) : null;
      const fit = fitFor(values.concat(names || []));
      // one row when it fits; else the fewest even rows that fit (12 wide texts: two rows of six)
      const per = fit >= n ? n : Math.min(n, Math.ceil(n / Math.ceil(n / fit)));
      return { values, names, nameColumn: names ? keys.column : "", per };
    }
    function shownView(shown, data, dataName) {
      const text = String(shown);
      const lines = text.split("\n");
      const head = lines[0] || "";
      let m = /^(\d+)-element (BitVector|Vector\{Bool\}):$/.exec(head);
      if (m) {
        const n = Number(m[1]);
        const perRow = !!(data && Array.isArray(data.rows) && data.rows.length === n && lines.length === n + 1);
        let keys = null;
        if (perRow && Array.isArray(data.columns)) {
          const cols = data.columns.map(String);
          let at = cols.findIndex((c) => KEY_COLUMN.test(c));
          if (at < 0) at = cols.findIndex((c, i) => new Set(data.rows.map((r) => String(r[i]))).size === n);
          if (at >= 0) keys = { column: cols[at], values: data.rows.map((r) => (r[at] === null ? "missing" : String(r[at]))) };
        }
        const bool = /^\s*[01]\s*$/.test(lines[1] || "") ? " Julia shows true as 1 and false as 0." : "";
        const strip = stripOf(lines, n, keys);
        return { text, keys, strip, caption: plural(n, "answer", "answers") + (perRow && dataName ? ", one per row of " + dataName : "") + "." + bool +
          (strip && strip.names ? " Under each: the " + strip.nameColumn + ", added by Julia Time." : !strip && keys ? " The " + keys.column + " on the left " + (pluralName(keys.column) ? "are" : "is") + " added by Julia Time, to help you read it." : "") };
      }
      if ((m = /^(\d+)-element Vector\{[^}]*\}:$/.exec(head))) {
        const strip = stripOf(lines, Number(m[1]), null);
        return { text, keys: null, strip, caption: "A list of " + plural(Number(m[1]), "item", "items") + "." };
      }
      if ((m = /^(\d+)\u00d7(\d+) DataFrame/.exec(head))) return { text, keys: null, caption: "A table: " + plural(Number(m[1]), "row", "rows") + ", " + plural(Number(m[2]), "column", "columns") + "." };
      if (/^GroupedDataFrame with (\d+) groups?/.test(head)) return { text, keys: null, caption: "The table split into groups." };
      return { text, keys: null, caption: "" };
    }
    // Julia's own text only (web/julia-text.js, shared with the range screen): the game's stand-in lines and notes
    // are not Julia's message and never sit under that label.
    const juliaText = JuliaText.juliaText, trimLocations = JuliaText.trimLocations;
    function resultView(r, data, dataName) {
      const list = listInfo(r.value_repr), tbl = tableInfo(r.value_repr);
      return {
        shown: typeof r.shown === "string" && r.status === "ok" ? shownView(r.shown, data, dataName) : null,
        status: r.status, repr: r.value_repr || "", items: list ? list.items : null, itemsTotal: list ? list.n : 0, itemsCut: !!(list && list.cut),
        tableRows: tbl ? tbl.rows : null, tableBody: tbl ? tbl.body : "", tableLabel: tbl ? upFirst(tableWords(tbl)) : "",
        table: r.value_table || rowTable(r.value_repr), stdout: r.stdout || "", message: trimLocations(juliaText(r.message)), pass: !!r.pass,
      };
    }

    function boardTiles(ch) {
      if (ch.board !== "jars" || !s.result || !Array.isArray(s.result.picked_ids)) return null;
      const picked = s.result.picked_ids.map(String);
      const table = ch.data && s.lesson.data_values ? s.lesson.data_values[ch.data] : null;
      const cols = table && table.columns ? table.columns : [];
      let jars = [];
      if (cols.indexOf("jar_id") >= 0) {
        jars = table.rows.map((r) => { const o = {}; cols.forEach((c, i) => { o[c] = r[i]; }); return o; });
      } else if (Array.isArray(s.lesson.jars)) jars = s.lesson.jars.slice();
      const known = {};
      (s.lesson.jars || []).forEach((j) => { known[String(j.jar_id)] = j; });
      jars = jars.map((j) => Object.assign({}, known[String(j.jar_id)] || {}, j));
      picked.forEach((id) => { if (!jars.some((j) => String(j.jar_id) === id)) jars.push({ jar_id: id }); });
      const tiles = jars.map((j) => ({ id: String(j.jar_id), hit: picked.includes(String(j.jar_id)), tray: j.tray_id, batch: j.batch_id }));
      const hasTray = tiles.some((t) => t.tray), hasBatch = tiles.some((t) => t.batch);
      const groups = [];
      tiles.forEach((t) => {
        const label = [hasTray ? t.tray : null, hasBatch ? t.batch : null].filter(Boolean).join(" \u00b7 ");
        let g = groups.find((x) => x.label === label);
        if (!g) { g = { label, tiles: [] }; groups.push(g); }
        g.tiles.push(t);
      });
      const hits = tiles.filter((t) => t.hit).length;
      return { tiles, groups, summary: "Your line picked " + hits + " of " + tiles.length + " jars (ticked)." };
    }

    function hintTexts(c) {
      // One naming scheme (P12): the shown hint carries its button's name.
      const labels = ["Hint 1: the idea", "Hint 2: the shape of the line"];
      return (c.challenge.hints || []).slice(0, Math.min(hintCap(), s.hints)).map((t, i) => ({ label: isExam() ? "Hint: the idea" : labels[i], text: String(t) }));
    }

    function rememberView(r) {
      if (!r) return null;
      const has = Array.isArray(r.choices);
      const order = has ? seededOrder(r.choices.length, "warm-up " + cur().round.id) : [];
      const out = { prompt: r.prompt || "", code: r.code || "", choices: has ? order.map((i) => r.choices[i]) : null, why: r.why || "" };
      out.answered = has && s.quiz !== null;
      out.pick = out.answered ? order.indexOf(s.quiz) : null;
      out.correct = out.answered && s.quiz === r.answer;
      out.answerText = has ? r.choices[r.answer] : "";
      // After a pick the right choice gets a tick and a wrong pick a cross (P13); before it, no marks.
      out.marks = has ? order.map((i) => (!out.answered ? "" : i === r.answer ? "right" : i === s.quiz ? "wrong" : "")) : [];
      out.say = !out.answered ? "" : (out.correct ? "Yes. " : "Not quite. The answer is " + out.answerText + ". ") + out.why;
      out.canSkip = has && !out.answered && warmGate();
      return out;
    }

    // Only lines the player typed and passed: case lines (the checkpoints) first, then practice lines.
    // A see run, a line shown with "Show me the line" and a play-box run are never listed.
    // Each line carries its round's title as a caption (P05).
    // On a lesson the main line is its last checkpoint. On a chapter every line the player typed and passed is a chapter
    // line (round 4, R3-37: the second task of a chapter was filed under "Practice lines", which read as not case work).
    function endLines() {
      const seen = [], out = [];
      let lastCp = -1;
      s.flat.forEach((f, i) => { if (f.challenge.kind === "checkpoint") lastCp = i; });
      const exam = isExam();
      s.flat.forEach((f, fi) => {
        const id = f.challenge.id, d = s.progress.done[id];
        if (!d || s.progress.lineUsed[id] || !OWN_KINDS.includes(f.challenge.kind)) return;
        const code = String(d.code || "").trim();
        if (!code) return;
        const isCase = exam ? true : fi === lastCp, at = seen.indexOf(code);
        if (at >= 0) { if (isCase) out[at].caseLine = true; return; }
        seen.push(code); out.push({ code: d.code, caseLine: isCase, round: f.round.title || "" });
      });
      return out.filter((l) => l.caseLine).concat(out.filter((l) => !l.caseLine));
    }

    function predictView(ch) {
      const order = seededOrder(ch.predict.choices.length, ch.id);
      // The marks wait for the run, so they never give the answer away before Julia has shown it.
      const shown = !!s.result && s.result.status === "ok" && typeof ch.predict.answer === "number";
      const marks = order.map((i) => (!shown ? "" : i === ch.predict.answer ? "right" : i === s.guess ? "wrong" : ""));
      return { question: ch.predict.question, choices: order.map((i) => ch.predict.choices[i]), guess: s.guess === null ? null : order.indexOf(s.guess), marks };
    }

    // The server's fallback line names nothing. When Julia's own message names the word it did not know, say that word.
    function unknownWordLine(message, withDict) {
      const m = String(message || "");
      const where = withDict ? "the table names and the pocket dictionary" : "the names in the task and the table";
      let x = /Error: `?([A-Za-z_][\w!]*)`? not defined/.exec(m);        // Julia: "...Error: `x` not defined"
      if (x) return "Julia does not know the name " + x[1] + ". Check its spelling against " + where + ".";
      x = /column name :?"?([A-Za-z_]\w*)"? not found/.exec(m) || /has no field `?([A-Za-z_]\w*)`?/.exec(m);
      if (x) return "The table has no column called " + x[1] + ". Check the column names in the table shown.";
      return "";
    }
    function failLine(r, ch) {
      if (ch && ch.kind === "checkpoint") return r.status === "timeout" ? "Julia took too long. Try a shorter line." : "Julia could not run this. Read your line again, or ask for a hint.";
      if (r.status === "timeout") return "Julia took too long. Try a shorter line.";
      if (r.status === "error") return "Julia could not run this. Compare your line with the example on the left.";
      return "";
    }

    // "That works too. The way this lesson teaches: ..." is a second line under the pass line, never part of it.
    const WORKS = "That works too";
    function worksTooLine(r) {
      if (!r || !r.pass) return "";
      if (typeof r.works_too === "string" && r.works_too.trim()) return r.works_too.trim();
      const at = String(r.feedback || "").indexOf(WORKS);
      return at > 0 ? String(r.feedback).slice(at).trim() : "";
    }
    const codeLines = (code) => String(code || "").split("\n").filter((x) => x.trim() && !x.trim().startsWith("#")).length;
    function feedbackLine(ch, r) {
      // A try-anything run of an empty editor, or of a line that gives `nothing`, still says something.
      if (ch.kind === "play" && r.status === "ok" && !r.feedback && ["", "nothing"].includes(String(r.value_repr || "").trim())) return "Nothing to show: type a line, then press Run.";
      // The server ends the pass line with the "That works too" sentence too; that sentence has its own line.
      const at = r.pass ? String(r.feedback || "").indexOf(WORKS) : -1;
      let text = (at > 0 ? String(r.feedback).slice(0, at).trim() : r.feedback) || failLine(r, ch);
      if (ch.kind === "checkpoint" && /example on the left/i.test(text)) text = failLine({ status: "error" }, ch);
      if (r.status === "error" && /^Julia could not run this\b/.test(text)) text = unknownWordLine(r.message, true) || text;
      // The protected-input note is the game's own note: it is the feedback line, not Julia's message.
      if (r.status === "error") text = JuliaText.protectedNote(r.message) || text;
      return text;
    }

    function isTrueFalseList(t) {
      return !!t && Array.isArray(t.columns) && t.columns.length === 1 && t.columns[0] === "value" && Array.isArray(t.rows) &&
        t.rows.length > 0 && t.rows.every((r) => ["true", "false"].includes(String(r[0])));
    }

    // "The shelves are added", "the batch is added": a plural column name (shelves, jars) takes "are".
    const pluralName = (name) => /[^su\W]s$/i.test(String(name).trim().split(/[\s_]+/).pop());
    // A choice label is spliced between sentences, never into one: it keeps its own capitals, so it stands after a colon
    // as its own sentence, and a full stop it already carries is not doubled.
    const bare = (x) => String(x).replace(/[\s.!?;:,]+$/, "");
    // Plain words: a wrong guess is not a fault, and this line can sit beside a passing run.
    function guessLine(ch) {
      if (!s.result || s.result.status !== "ok" || !ch.predict || !ch.predict.choices) return "";
      if (s.guess === null) return "";                  // nothing was picked: no leftover line (round 5, Tufte E)
      const guess = ch.predict.choices[s.guess];
      if (guess === undefined) return "";
      const t = s.result.value_table;
      const repr = typeof s.result.shown === "string" ? s.result.shown : s.result.value_repr;
      const list = listInfo(repr), rows = tableRows(repr);
      let shown;
      if (isTrueFalseList(t) || /^\d+-element (BitVector|Vector\{Bool\}):/.test(String(repr || ""))) shown = "a list of true and false";
      else if (t && t.rows) shown = "a table with " + plural(t.rows.length, "row", "rows");
      else if (list) shown = "a list of " + plural(list.n, "item", "items");
      else if (rows !== null) shown = tableWords(tableInfo(repr));
      else {
        const first = String(repr || "").split("\n")[0];
        shown = /:\s*$/.test(first) || /\{.*\}/.test(first) ? "a result (see below)" : first;
      }
      // The answer index in the data decides right or wrong, not a comparison of text. A wrong pick is stated plainly with
      // the answer beside it; it is never a fault. It is "your pick", never "your guess": Lesson 6 uses "guess" for its table.
      const answer = ch.predict.choices[ch.predict.answer];
      if (typeof ch.predict.answer !== "number" || answer === undefined) return "You picked: " + bare(guess) + ". Julia showed " + bare(shown) + ".";
      return s.guess === ch.predict.answer ? "Yes. You picked: " + bare(guess) + ". Julia showed " + bare(shown) + "." : "Good try. You picked: " + bare(guess) + ". The answer is: " + bare(answer) + ".";
    }

    return { handle, open, start, fastLane, skipWarm, toggleStory, toggleLook, tryLook, run, draft, editorCode, reset, predict, quiz, startRound, showLine, hint, showStarter, starterFilled, next, restart, view, state: s,
      toggleTerm, toggleShow, testOut, leaveTestOut, selectWave, nextWave, leaveRangeEnd, toggleHint, fire, rangeDraft, rangeCode };
  }

  // WebSocket client, same pattern as web/app.js (connect, reconnect every 2 s, send when open).
  function createSocket(onMessage, onStatus, WS, loc) {
    let ws = null, timer = null, stopped = false;
    const queue = [];
    function connect() {
      onStatus("connecting");
      ws = new WS("ws://" + loc.host + "/ws");
      ws.addEventListener("open", () => { onStatus("connected"); while (queue.length) ws.send(JSON.stringify(queue.shift())); });
      ws.addEventListener("message", (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMessage(m); });
      ws.addEventListener("close", () => { onStatus("disconnected"); if (!stopped) timer = setTimeout(connect, 2000); });
      ws.addEventListener("error", () => {});
    }
    function send(obj) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
      else if (obj.type !== "lesson_run") queue.push(obj);
      else onStatus("disconnected");
    }
    connect();
    return { send, stop() { stopped = true; if (timer) clearTimeout(timer); if (ws) ws.close(); } };
  }

  // ---- DOM layer -------------------------------------------------------------------------
  function init(doc) {
    const $ = (id) => doc.getElementById(id);
    const win = doc.defaultView || window;
    const el = (tag, attrs, text) => {
      const n = doc.createElement(tag);
      if (attrs) Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
      if (text !== undefined) n.textContent = text;
      return n;
    };
    const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };
    let storage = null;
    try { storage = win.localStorage; } catch (e) { storage = null; }
    let afterRun = false, afterLook = false, endFocus = false, socket = null, lastKey = "", ctrl = null, dictSeen = false, dictClosedLast = null, refocus = null, testBox = null, lastRule = null;

    const DATA_ROWS = 20;
    function tableNode(t, cap, numbered) {
      const wrap = el("div", { class: "tbl", tabindex: "0", role: "region", "aria-label": "Table" });
      const table = el("table");
      const head = el("tr");
      if (numbered) head.appendChild(el("th", { scope: "col", class: "rownum" }, "row"));
      (t.columns || []).forEach((c) => head.appendChild(el("th", { scope: "col" }, String(c))));
      table.appendChild(head);
      (t.rows || []).slice(0, cap || 8).forEach((r, i) => {
        const tr = el("tr");
        if (numbered) tr.appendChild(el("td", { class: "rownum" }, String(i + 1)));
        r.forEach((v) => tr.appendChild(el("td", null, v === null ? "missing" : String(v))));
        table.appendChild(tr);
      });
      wrap.appendChild(table);
      if ((t.rows || []).length > (cap || 8)) wrap.appendChild(el("p", { class: "more" }, "and " + (t.rows.length - (cap || 8)) + " more rows"));
      return wrap;
    }

    function showOnly(name) {
      ["screen-list", "screen-start", "screen-lesson", "screen-end", "screen-note", "screen-range-end"].forEach((id) => { $(id).hidden = id !== name; });
    }

    // The dictionary tables whose "In R" and "In Python" columns follow the two switches.
    const LANG_TABLES = ["dict", "dict-earlier", "sheet-table", "end-dict"];
    // The bar on every screen: title and Board to the Board, where the player is, the two switches, and the cheat sheet.
    function drawNav(v) {
      $("brand").setAttribute("href", v.nav.board);
      $("board-link").setAttribute("href", v.nav.board);
      $("strip-text").textContent = v.nav.text;
      $("switches").hidden = !v.nav.switches;
      setText("switch-note", v.nav.switchNote || "");
      $("show-r").checked = !!v.show.r; $("show-py").checked = !!v.show.py;
      [["show-r", v.show.r], ["show-py", v.show.py]].forEach((x) => { const lab = $(x[0]).parentNode; if (lab && lab.classList) lab.classList.toggle("on", !!x[1]); });
      LANG_TABLES.forEach((id) => { $(id).setAttribute("data-r", v.usesR ? "1" : "0"); $(id).setAttribute("data-py", v.usesPy ? "1" : "0"); });
      $("cheat").hidden = !v.nav.cheat;
      if (!v.nav.cheat) sheetOpen = false;
      const sheet = $("sheet"); sheet.hidden = !sheetOpen || v.screen === "challenge";
      $("cheat").setAttribute("aria-expanded", String(sheetOpen && v.screen !== "challenge"));
      const body = $("sheet-body"); clear(body);
      if (!sheet.hidden) (v.sheet || []).forEach((r) => body.appendChild(dictRow(r)));
      if (v.screen !== "challenge") { clear($("line-count")); }
    }
    let sheetOpen = false;
    // One dictionary row. Code cells may break after a dot, a $, a comma or a bracket, never inside a word.
    function dictRow(r) {
      const tr = el("tr");
      tr.appendChild(codeCell(r.julia));
      tr.appendChild(el("td", null, r.means));
      tr.appendChild(codeCell(r.r || ""));
      tr.appendChild(codeCell(r.py || ""));
      return tr;
    }
    // A short line with `code` pieces in backticks: the pieces become <code>, the backticks are dropped.
    function fillInlineCode(node, text) {
      String(text).split("`").forEach((piece, i) => { if (!piece) return; node.appendChild(i % 2 ? el("code", null, piece) : doc.createTextNode(piece)); });
    }
    // Code in a <pre>: a quoted value ("T-A") never breaks across two lines; the text itself is unchanged.
    function fillCode(node, text) {
      clear(node);
      const str = String(text || ""); let at = 0;
      for (const m of str.matchAll(/"[^"\n]*"/g)) {
        if (m.index > at) node.appendChild(doc.createTextNode(str.slice(at, m.index)));
        node.appendChild(el("span", { class: "nb" }, m[0]));
        at = m.index + m[0].length;
      }
      if (at < str.length) node.appendChild(doc.createTextNode(str.slice(at)));
    }
    function codeCell(text) {
      const td = el("td", { class: "mono" });
      String(text || "").split(/(?<=[$,(\[]|\.(?=[A-Za-z_]))/).forEach((piece, i) => {
        if (i > 0 && doc.createElement) td.appendChild(el("wbr"));
        // an id such as "T-A" or J-081 never breaks at its hyphen (P14)
        let at = 0;
        for (const m of piece.matchAll(/"?[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)+"?/g)) {
          if (m.index > at) td.appendChild(doc.createTextNode(piece.slice(at, m.index)));
          td.appendChild(el("span", { class: "nb" }, m[0]));
          at = m.index + m[0].length;
        }
        if (at < piece.length) td.appendChild(doc.createTextNode(piece.slice(at)));
      });
      return td;
    }
    // A note for R or Python users: "In R:" or "In Python:", then the note, as code when it reads as code.
    function fillNotes(box, notes) {
      clear(box);
      const list = notes ? [["In R: ", notes.r], ["In Python: ", notes.py]].filter((x) => x[1]) : [];
      box.hidden = !list.length;
      list.forEach((x) => {
        const p = el("p", { class: "note" });
        p.appendChild(el("strong", null, x[0]));
        if (x[1].code) p.appendChild(el("code", null, x[1].text)); else appendRich(p, x[1].text);
        box.appendChild(p);
      });
    }

    function renderList(v) {
      showOnly("screen-list");
      const ul = $("lesson-list"); clear(ul);
      v.lessons.filter((l) => l.kind !== "range" && typeof l.number === "number").forEach((l) => {
        const li = el("li"); li.appendChild(el("a", { href: "lesson.html?lesson=" + encodeURIComponent(l.id) }, (l.kind === EXAM_KIND ? "Chapter " : "Lesson ") + l.number + ": " + l.title));
        ul.appendChild(li);
      });
      fillSkills($("list-skills"), v.skills || []);
      clear($("dots"));
    }

    // A short heading and one small group per finished lesson: "Lesson 2" over its can_do statements.
    function fillSkills(box, skills) {
      clear(box); box.hidden = !skills.length;
      if (!skills.length) return;
      box.appendChild(el("h2", null, "Your skills so far"));
      skills.forEach((k) => {
        box.appendChild(el("h3", null, "Lesson " + k.number + (k.title ? ": " + k.title : "")));
        const ul = el("ul"); k.canDo.forEach((t) => ul.appendChild(el("li", null, t))); box.appendChild(ul);
      });
    }
    function fillCanDo(box, heading, items) {
      clear(box); box.hidden = !items.length;
      if (!items.length) return;
      box.appendChild(el("h2", null, heading));
      const ul = el("ul"); items.forEach((t) => ul.appendChild(el("li", null, t))); box.appendChild(ul);
    }

    function renderStart(v) {
      showOnly("screen-start");
      $("start-title").textContent = v.lesson.heading;
      $("start-goal").textContent = v.lesson.goal;
      $("start-story").textContent = v.lesson.story;
      $("start-story").hidden = !v.lesson.story;
      const more = v.lesson.storyMore, box = $("story-more");
      clear(box); (v.lesson.storyParas || []).forEach((t) => box.appendChild(el("p", null, t)));
      box.hidden = !(more && v.lesson.storyOpen);
      $("story-link").hidden = !more; $("story-link").setAttribute("aria-expanded", String(!!v.lesson.storyOpen));
      $("story-link").textContent = v.lesson.storyOpen ? "Hide the story" : "Read the story";
      fillCanDo($("start-promise"), "By the end you will be able to:", v.lesson.canDo || []);
      $("start-place").textContent = v.lesson.place;
      setText("start-chapter", v.lesson.chapterLine);
      setText("start-resume", v.lesson.resume);
      $("start").textContent = v.lesson.startLabel;
      $("restart").hidden = !v.lesson.canRestart;
      $("fast-row").hidden = !v.lesson.fastLane; $("fast-lane").textContent = v.lesson.fastLane;
      clear($("dots"));
    }

    // The end page: "Lesson done", the one main button right under it, what was found, then one fold that holds the
    // lines, the clues and the own-work note, with one "Copy all".
    function renderEnd(v) {
      showOnly("screen-end");
      $("end-title").textContent = v.lesson.name + " done";
      $("end-finding").textContent = v.end.finding;
      fillCanDo($("end-can-do"), "You can now:", v.end.canDo);
      // "Worth remembering" (D6): what each passed checkpoint said, listed in view, not in the fold.
      fillCanDo($("end-clues"), "Worth remembering:", v.end.clues);
      const mist = $("end-mistake"); clear(mist); mist.hidden = !v.end.mistake;
      if (v.end.mistake) { mist.appendChild(el("h2", null, "The mistake everyone makes here")); mist.appendChild(el("p", null, v.end.mistake)); }
      const sk0 = $("end-skills"); clear(sk0); sk0.hidden = true;
      // The lines, numbered in one run across both groups, each captioned with its round's title (P05).
      const box = $("end-lines"); clear(box);
      const all = [];
      const mainName = v.lesson.exam ? (v.end.lines.filter((l) => l.caseLine).length > 1 ? "Your chapter lines" : "Your chapter line") : "Your last checkpoint line";
      [[mainName, true], ["Practice lines", false]].forEach((g) => {
        const group = v.end.lines.filter((l) => l.caseLine === g[1]);
        if (!group.length) return;
        box.appendChild(el("h3", null, g[0]));
        const ol = el("ol", all.length ? { start: String(all.length + 1) } : null);
        group.forEach((line) => {
          all.push(line.code);
          const li = el("li");
          if (line.round) li.appendChild(el("p", { class: "line-cap" }, line.round));
          li.appendChild(el("pre", null, line.code)); ol.appendChild(li);
        });
        box.appendChild(ol);
      });
      $("end-more-sum").textContent = "Your lines and notes" + (all.length ? " (" + plural(all.length, "saved line", "saved lines") + ")" : "");
      const copy = $("copy-all"); copy.hidden = !all.length; copy.textContent = "Copy all";
      copy._lines = all.join("\n");
      // The one main action, right under the title, and the only forward route (P04).
      const go = $("end-go"); clear(go); go.hidden = !v.end.go;
      if (v.end.go) {
        const href = v.end.go.href;
        const b = el("button", { id: "end-go-btn", type: "button", class: "primary", "data-href": href }, v.end.go.label);
        b.addEventListener("click", () => { win.location.href = href; });
        go.appendChild(b);
      }
      const nx = $("end-next"); clear(nx);
      // A next line that only repeats the main button, word for word, is left out.
      const repeats = v.end.go && String(v.end.next).trim().replace(/\.$/, "") === v.end.go.label;
      setText("end-next", repeats ? "" : v.end.next);
      const sk = $("end-skipped"); clear(sk); sk.hidden = !v.end.skipped.length;
      if (v.end.skipped.length) {
        sk.appendChild(el("h3", null, "Tasks you tested out of"));
        const ul = el("ul");
        v.end.skipped.forEach((x) => ul.appendChild(el("li", null, x.round + " · " + x.label + " (" + x.note + ")")));
        sk.appendChild(ul);
      }
      const own = $("end-own"); clear(own); own.hidden = !v.end.own;
      if (v.end.own) {
        // A visible card on the end page, not a line in the closed fold (round 4, R3-33). The last lesson sends the player to
        // their own laptop, so it first says the three plain steps: install, open, and where files must sit.
        own.appendChild(el("h2", { id: "end-own-h" }, v.end.own.title || OWN_TITLE));
        if (v.end.own.first) {
          own.appendChild(el("p", { class: "own-first" }, "The first time on your own computer:"));
          const ol = el("ol", { class: "own-steps" });
          v.end.own.first.forEach((t) => { const li = el("li"); fillInlineCode(li, t); ol.appendChild(li); });
          own.appendChild(ol);
        }
        if (v.end.own.say) own.appendChild(el("p", null, v.end.own.say));
        own.appendChild(el("pre", null, v.end.own.code));
      }
      const db = $("end-dict-body"); clear(db);
      v.end.dictionary.forEach((r) => { const tr = el("tr"); [r.julia, r.means, r.r || "", r.py || ""].forEach((t) => tr.appendChild(el("td", null, t))); db.appendChild(tr); });
      clear($("dots")); $("clues").hidden = true;
    }

    function renderChallenge(v) {
      showOnly("screen-lesson");
      const c = v.ch;
      clear($("dots"));                                  // "Task 3 of 6" says it in words; no dots (P12)
      $("line-count").textContent = v.strip.line;
      $("round-title").textContent = c.roundTitle;
      setText("round-story", c.roundStory);
      // On every task after a round's first, the round's idea waits in one closed fold that can be opened again (P14);
      // its name is short and whole, and the text inside wraps in full: nothing is cut off.
      const rule = $("rule"); rule.hidden = !c.rule;
      if (lastRule !== c.rule) { lastRule = c.rule; rule.open = false; }
      $("rule-sum").textContent = c.rule ? "This round's idea (read it again)" : "";
      $("rule-text").hidden = false; $("rule-text").textContent = c.rule;
      fillNotes($("notes"), c.notes);
      $("starter").hidden = !c.starter.available;
      $("starter-box").hidden = !c.starter.shown;
      fillCode($("starter-code"), c.starter.shown || "");
      setText("kind-label", c.kindLabel);
      $("clues").hidden = true;
      setText("gloss-tip", c.glossTip);
      setText("explain", c.explain);
      fillParts($("explain"), c.explain, c.explainParts); paragraphs($("explain"));
      const rem = $("remember"); clear(rem); rem.hidden = !c.remember;
      setText("then-line", "");
      if (c.remember) {
        const r = c.remember;
        // The round that ended is its own heading, above the warm-up card, never run into it (P13).
        if (r.roundLine) { rem.appendChild(el("h2", { class: "round-done" }, r.roundLine)); rem.appendChild(el("p", { class: "round-next" }, r.nextLine)); }
        rem.appendChild(el("strong", { class: "warm" }, "Warm-up: remember this?"));
        const rp = el("span");
        fillParts(rp, r.prompt, r.promptParts);
        rem.appendChild(rp);
        // the code sits on its own lines, so a comment and the code are not run into the question
        if (r.code) rem.appendChild(el("pre", { class: "warm-code" }, r.code));
        if (r.choices) {
          const row = el("div", { role: "group", "aria-label": "Your answer", class: "choices" });
          // A redraw replaces these buttons, so the keyboard's place is put back: on Start the round once answered.
          r.choices.forEach((ch, i) => row.appendChild(choiceButton(ch, r.pick === i, r.marks[i], () => { ctrl.quiz(i); focusFirst(["start-round"], "#remember .choice[data-pos=\"" + i + "\"]"); }, i)));
          rem.appendChild(row);
          if (r.answered) rem.appendChild(el("p", { class: "quiz-say", role: "status" }, r.say));
          if (r.canSkip) {
            const sk = el("button", { type: "button", class: "linkish", id: "skip-warm" }, "Skip the warm-up");
            sk.addEventListener("click", () => { ctrl.skipWarm(); if ($("prompt").focus) $("prompt").focus(); });
            rem.appendChild(sk);
          }
          if (r.answered && c.warmGate) {
            const go = el("button", { id: "start-round", type: "button", class: "primary", "aria-label": "Start the round" }, "Start the round");
            go.addEventListener("click", () => { ctrl.startRound(); focusFirst(["prompt"]); });
            rem.appendChild(go);
          }
        }
      }
      fillParts($("prompt"), c.prompt, c.promptParts);
      ["explain", "prompt", "feedback"].forEach((where) => {
        const g = $("gloss-" + where), on = !!c.gloss && c.gloss.under === where;
        clear(g); g.hidden = !on;
        if (on) { g.appendChild(el("strong", null, c.gloss.term + ": ")); g.appendChild(doc.createTextNode(c.gloss.means)); }
      });
      const to = c.testOut;
      // Under Next on the editor side; while the warm-up stands alone (that side is hidden) it sits inside the warm-up
      // card, at its foot (P13, S35), so it plainly belongs to this round.
      const home = c.warmGate ? $("remember") : $("right");
      if (!testBox) testBox = $("testout");             // a box lifted out of the page is not found by id, so keep it
      if (testBox.parentNode !== home) home.appendChild(testBox);
      testBox.hidden = !(to.available || to.active);
      $("testout-btn").hidden = !to.available;
      setText("testout-note", to.note);
      $("testout-leave").hidden = !(to.active && !to.passed);
      $("screen-lesson").setAttribute("data-mode", "lesson");
      $("waves").hidden = true; $("next").hidden = false;
      $("wave-hint").hidden = true; $("wave-hint-text").hidden = true;      // the range's hint sits by the editor and is the range's alone
      $("run").textContent = "Run"; $("run").setAttribute("aria-label", "Run the code");
      $("code").removeAttribute("placeholder");
      const pin = $("pinned"); pin.hidden = !c.pinned;
      setText("pinned-cap", c.pinned ? c.pinned.label : "");
      if (c.pinned) {
        fillCode($("pinned-code"), c.pinned.code);
        fillNotes($("pinned-note"), c.pinned.notes);
        const lab = $("pinned-labels"); clear(lab);
        // A one-word line with one label says only what it is, never the word twice (P12).
        const whole = c.pinned.labels.length === 1 && String(c.pinned.labels[0].part).trim() === String(c.pinned.code).trim();
        c.pinned.labels.forEach((l) => {
          const s = el("span", { class: "chip" + (l.is === "result" ? " result" : "") });
          if (whole) s.appendChild(doc.createTextNode("This line is " + l.is + "."));
          else { s.appendChild(el("code", null, l.part)); s.appendChild(doc.createTextNode(" " + l.is)); }
          lab.appendChild(s);
        });
      }
      drawLook(c.look);
      const body = $("dict-body"); clear(body);
      c.dictionary.forEach((r) => body.appendChild(dictRow(r)));
      const early = $("dict-earlier"); early.hidden = !c.dictEarlier.length;
      $("dict-earlier-sum").textContent = "From " + (c.dictEarlierFrom || "earlier lessons") + " (" + plural(c.dictEarlier.length, "row", "rows") + ")";
      const eb = $("dict-earlier-body"); clear(eb);
      c.dictEarlier.forEach((r) => eb.appendChild(dictRow(r)));
      $("dict").hidden = !(c.dictionary.length || c.dictEarlier.length);
      // Closed on a round's first screen and on a checkpoint; open on the others. The player's own open or close
      // stays until the default changes, and on a narrow screen the drawer starts closed once.
      if (!dictSeen) { dictSeen = true; $("dict").open = false; }
      if (dictClosedLast !== c.dictClosed) { dictClosedLast = c.dictClosed; if (c.dictClosed) $("dict").open = false; }
      // editor: only rewrite when the challenge changes, so typing is never overwritten
      if (lastKey !== c.id) $("code").value = c.code;
      lastKey = c.id;
      $("run").disabled = c.pending;
      // predict
      const pr = $("predict"); pr.hidden = !c.predict; clear(pr);
      if (c.predict) {
        const q = el("p", { id: "predict-q" });
        fillParts(q, c.predict.question, c.predict.questionParts);
        pr.appendChild(q);
        if (c.gloss && c.gloss.under === "predict") pr.appendChild(glossNode(c.gloss));
        const row = el("div", { role: "group", "aria-labelledby": "predict-q", class: "choices" });
        c.predict.choices.forEach((ch, i) => row.appendChild(choiceButton(ch, c.predict.guess === i, c.predict.marks[i], () => { ctrl.predict(i); focusFirst([], "#predict .choice[data-pos=\"" + i + "\"]"); }, i)));
        pr.appendChild(row);
      }
      setText("guess-line", c.guessLine);
      const res = $("result"); clear(res);
      if (c.result) drawValue(res, c.result);
      res.hidden = !res.firstChild;
      $("result-label").hidden = res.hidden;
      setText("play-note", c.playNote);
      const fold = $("julia-msg"); clear(fold); fold.hidden = !(c.result && c.result.message);
      if (!fold.hidden) {
        const d = el("details");                     // closed by default everywhere, so every error looks the same
        const sum = el("summary", null, "Julia's own message");
        // The first line beside the label is only for a closed fold: open, the text shows once, below.
        if (c.result.peek) sum.appendChild(el("span", { class: "peek" }, ": " + c.result.peek));
        d.appendChild(sum);
        d.appendChild(el("pre", null, c.result.message));
        fold.appendChild(d);
      }
      const board = $("board"); clear(board); board.hidden = !c.board;
      if (c.board) {
        const hitIds = c.board.tiles.filter((t) => t.hit).map((t) => t.id);
        board.setAttribute("aria-label", c.board.summary + " Picked: " + (hitIds.join(", ") || "none"));
        const rack = el("div", { class: "rack", "aria-hidden": "true" });
        c.board.groups.forEach((g) => {
          const grp = el("div", { class: "grp" });
          if (g.label) grp.appendChild(el("p", { class: "grp-label" }, g.label));
          const row = el("div", { class: "grp-jars" });
          g.tiles.forEach((t) => {
            const jar = el("div", { class: "jar" + (t.hit ? " hit" : "") });
            jar.appendChild(el("span", { class: "jar-body" }, t.hit ? "\u2713" : ""));
            jar.appendChild(el("span", { class: "jar-id" }, t.id));
            row.appendChild(jar);
          });
          grp.appendChild(row); rack.appendChild(grp);
        });
        board.appendChild(rack);
        board.appendChild(el("p", { class: "board-summary" }, c.board.summary));
      }
      setText("clue", c.clue);
      setText("works-too", c.worksToo); $("works-too").className = "works-too" + (c.worksTooWarn ? " warn" : "");
      if (c.pending) $("feedback").textContent = "Running..."; else fillParts($("feedback"), c.feedback, c.feedbackParts, true);
      // A wrong guess is not a success: the line that says what the code did is then plain ink, not green. Julia's error
      // is an alert (a tinted box with a mark); a wrong answer is a quieter "not yet".
      const tone = c.feedback && !c.pending ? c.feedbackTone : "";
      $("feedback").className = tone === "ok" ? (c.guessWrong ? "" : "ok") : (c.noteLine && !c.pending ? "note" : tone);
      if (tone === "alert") $("feedback").setAttribute("role", "alert"); else $("feedback").removeAttribute("role");
      $("show-line").hidden = !c.showLine;
      const hints = $("hints"); clear(hints); hints.hidden = !c.hintsAvailable;
      if (c.hintsAvailable) {
        c.hints.forEach((h, i) => {
          const p = el("p", { class: "hint" }); p.appendChild(el("strong", null, h.label + ": "));
          const t = el("span"); fillParts(t, h.text, h.parts); p.appendChild(t); hints.appendChild(p);
          if (c.gloss && c.gloss.under === "hint" + i) hints.appendChild(glossNode(c.gloss));
        });
        if (c.hints.length < c.hintsTotal) {
          const hb = hintButton(v.lesson.exam ? "Hint: the idea" : c.hints.length < 1 ? "Hint 1: the idea" : "Hint 2: the shape of the line");
          hb.disabled = !!c.helpUsed;
          hints.appendChild(hb);
        }
      }
      $("starter").disabled = !!c.helpUsed;
      setText("help-note", c.helpNote);
      setText("next-why", c.nextWhy);
      $("next").disabled = !c.nextEnabled;
      $("next").className = c.nextPrimary ? "primary" : "";
      $("run").className = c.nextPrimary ? "quiet" : "primary";
      // After the step is done Run stays usable and says so: it steps back in colour, never looks switched off.
      $("run").textContent = c.runLabel; $("run").setAttribute("aria-label", c.runLabel === "Run" ? "Run the code" : "Run the code again");
      $("next").textContent = c.isLast ? "Finish" : "Next";
      $("next").setAttribute("aria-label", c.isLast ? "Finish" : "Go to the next task");
      const data = $("data"); clear(data); data.hidden = !c.data;
      $("data-label").hidden = !v.dataLabel; $("data-label").textContent = v.dataLabel;
      $("screen-lesson").setAttribute("data-cid", c.id);
      // the warm-up stands alone first, centred: nothing of the task shows until the round starts
      ["right", "round-title", "prompt", "dict", "kind-label"].forEach((id) => { if (c.warmGate) $(id).hidden = true; else if (id === "right" || id === "round-title" || id === "prompt") $(id).hidden = false; });
      if (c.warmGate) ["explain", "pinned", "data", "notes", "rule", "starter-box"].forEach((id) => { $(id).hidden = true; });
      $("screen-lesson").setAttribute("data-warm", c.warmGate ? "1" : "0");
      // Tables show in full up to DATA_ROWS rows (P14 asks for 12; the practice tables go to 15), with no box that
      // scrolls inside the page; the page itself may scroll below the first screen for them (decision D2).
      if (c.data) {
        // A list is named a list, never a table (D5-6).
        const kindOf = (d) => (Array.isArray(d.columns) && d.columns.length === 1 && d.columns[0] === "value" ? "List: " : "Table: ");
        data.appendChild(el("p", { class: "cap" }, kindOf(c.data) + c.dataName)); data.appendChild(tableNode(c.data, DATA_ROWS, c.rowNumbers));
        if (c.dataAlso) { data.appendChild(el("p", { class: "cap" }, kindOf(c.dataAlso) + c.dataAlsoName)); data.appendChild(tableNode(c.dataAlso, DATA_ROWS)); }
      }
      // The starter line goes into the editor; it shows beside it only when the editor already held other code.
      const sc = String(c.starter.shown || "").trim();
      $("starter-box").hidden = !sc || $("code").value.indexOf(sc) >= 0;
      updateCues([$("result")]);
      restoreFocus();
      if (afterLook && !(c.look && c.look.pending)) { afterLook = false; focusFirst(["look-try"]); }
      if (afterRun && !c.pending) { afterRun = false; focusFirst(c.nextPrimary && c.feedbackTone === "ok" ? ["next"] : ["run"]); }
    }

    // The value a run gave back: a table, a list, a short table text or plain text.
    function drawValue(node, r) {
      if (r.shown) {
        if (r.shown.caption) node.appendChild(el("p", { class: "cap shown-cap" }, r.shown.caption));
        const julia = el("pre", { class: "shown", "aria-label": "What Julia printed" }, r.shown.text);
        if (r.shown.strip) {
          const st = r.shown.strip;
          const row = el("div", { class: "strip", role: "list", "aria-label": "The " + st.values.length + " values, in order", style: "grid-template-columns: repeat(" + st.per + ", minmax(0, 1fr))" });
          st.values.forEach((v, i) => {
            const cell = el("div", { class: "cell", role: "listitem", "aria-label": "Position " + (i + 1) + ": " + v + (st.names ? ", " + st.nameColumn + " " + st.names[i] : "") });
            cell.appendChild(el("span", { class: "pos", "aria-hidden": "true" }, String(i + 1)));
            cell.appendChild(el("span", { class: "val", "aria-hidden": "true" }, v));
            if (st.names) cell.appendChild(el("span", { class: "key", "aria-hidden": "true" }, st.names[i]));
            row.appendChild(cell);
          });
          node.appendChild(row);
          const fold = el("details", { class: "exact" });
          fold.appendChild(el("summary", null, "Julia's exact print (these same values, in a column" + (r.shown.keys && !st.names ? ", with " + r.shown.keys.column : "") + ")"));
          // The print is put in only while the fold is open, so a closed fold takes no room and cannot make the Result box scroll.
          const exact = r.shown.keys && !st.names ? el("div", { class: "shown-row" }) : julia;
          if (exact !== julia) {
            exact.appendChild(el("pre", { class: "shown-keys", "aria-label": "Row names, added by Julia Time" }, [r.shown.keys.column].concat(r.shown.keys.values).join("\n")));
            exact.appendChild(julia);
          }
          fold.addEventListener("toggle", () => { if (fold.open) fold.appendChild(exact); else if (exact.parentNode === fold) fold.removeChild(exact); drawCues(cueBoxes); });
          node.appendChild(fold);
        } else if (r.shown.keys) {
          const row = el("div", { class: "shown-row" });
          row.appendChild(el("pre", { class: "shown-keys", "aria-label": "Row names, added by Julia Time" }, [r.shown.keys.column].concat(r.shown.keys.values).join("\n")));
          row.appendChild(julia);
          node.appendChild(row);
        } else node.appendChild(julia);
      } else if (r.table) node.appendChild(tableNode(r.table, 12));
      else if (r.items) {
        node.appendChild(el("p", { class: "cap" }, "A list of " + plural(r.itemsTotal, "item", "items")));
        node.appendChild(el("pre", { class: "items" }, r.items.join("   ") + (r.itemsCut ? "   ..." : "")));
      } else if (r.tableRows !== null) {
        node.appendChild(el("p", { class: "cap" }, r.tableLabel || "A table with " + plural(r.tableRows, "row", "rows")));
        if (r.tableBody) node.appendChild(el("pre", null, r.tableBody));
      } else if (r.repr) node.appendChild(el("pre", null, r.repr));
      if (r.stdout) node.appendChild(el("pre", { class: "stdout" }, r.stdout));
    }

    function glossNode(g) {
      const n = el("p", { class: "gloss", "aria-live": "polite" });
      n.appendChild(el("strong", null, g.term + ": ")); n.appendChild(doc.createTextNode(g.means));
      return n;
    }

    // Look closer: a small closed link under the pinned line; open, it shows the text, the code and Try it.
    function drawLook(look) {
      const box = $("look"); box.hidden = !look;
      if (!look) return;
      $("look-link").setAttribute("aria-expanded", String(look.open));
      const body = $("look-box"); body.hidden = !look.open;
      $("look-text").textContent = look.text;
      fillCode($("look-code"), look.code);
      $("look-try").disabled = look.pending;
      const out = $("look-result"); clear(out);
      if (look.open && look.result) {
        if (look.pending) { /* the old value is dropped while a new run is on its way */ }
        else if (look.result.failed) out.appendChild(el("p", { class: "cap" }, look.result.message || "Julia could not run this line."));
        else {
          // a bare value (a number, a word) gets a short caption, so it is not a mystery box
          if (!(look.result.shown && look.result.shown.caption) && !look.result.table && !look.result.items && look.result.tableRows === null && (look.result.repr || look.result.shown)) out.appendChild(el("p", { class: "cap" }, "Julia shows:"));
          drawValue(out, look.result);
        }
      }
      out.hidden = !out.firstChild;
    }

    // After a redraw, focus goes back to the glossary term that was just tapped, wherever it sits.
    function restoreFocus() {
      if (!refocus) return;
      const term = refocus; refocus = null;
      const find = (node) => {
        const kids = Array.from((node && node.children) || []);
        for (const k of kids) {
          if (k.getAttribute && k.getAttribute("data-term") === term) return k;
          const f = find(k); if (f) return f;
        }
        return null;
      };
      let b = null;
      ["explain", "prompt", "remember", "predict", "hints", "feedback"].forEach((id) => { if (!b) b = find($(id)); });
      if (b && b.focus) b.focus();
    }

    // Scroll cue: a "Scroll for more" line under the one box that may scroll (a result longer than 20 lines), hidden at
    // its end. Since fix round 2 (D2) nothing else scrolls inside the page.
    let cues = [];
    function refreshCue(box, cue) {
      const more = overflows(box) && box.scrollTop + box.clientHeight < box.scrollHeight - 2;
      cue.hidden = !more;
      // Round 6: the same fact draws the soft fade on the box's bottom edge (web/lesson.css, #result[data-more]).
      if (more) box.setAttribute("data-more", "1"); else box.removeAttribute("data-more");
    }
    // Round 6 (LS-103, LS-27): the capped Result shows whole rows and lines, never half of one. The CSS cap is four 24 px lines; when the real
    // rows are taller (a table row is 31 px) the height is moved down to the last row boundary that fits. Only a box that really overflows.
    const FADE_PX = 18;   // the height of the fade strip under the last whole row (web/lesson.css, #result[data-more]::after)
    function snapResult(box) {
      if (!box || box.hidden || !box.getBoundingClientRect || !win.getComputedStyle) return;
      box.style.maxHeight = "";
      if (!(box.scrollHeight > box.clientHeight + 2)) return;
      const cs = win.getComputedStyle(box), px = (v) => parseFloat(v) || 0;
      const top = px(cs.paddingTop), border = px(cs.borderTopWidth) + px(cs.borderBottomWidth);
      const cap = px(cs.maxHeight);
      if (!cap) return;
      const origin = box.getBoundingClientRect().top + px(cs.borderTopWidth) + top - box.scrollTop;
      const bounds = [];
      Array.from(box.querySelectorAll("tr, pre, p")).forEach((n) => {
        const r = n.getBoundingClientRect();
        if (n.tagName === "PRE") {
          const lh = px(win.getComputedStyle(n).lineHeight);
          if (lh > 0) for (let k = 1; k * lh <= r.height + 1; k++) bounds.push(r.top - origin + k * lh);
        } else bounds.push(r.bottom - origin);
      });
      // Round 6 (result fix): the box may use the room the page has left. The cap is only there to keep Next in the first screen, so when Next
      // sits higher than the window's bottom, the Result takes that slack first: a short result then shows whole, with no inner scroll.
      const slack = Math.max(0, roomBelow(box));
      const full = box.scrollHeight + border;                       // the whole content, with no cap
      if (cap + slack >= full - 1) { box.style.maxHeight = "none"; return; }
      const best = snapCap(bounds, cap + slack - top - FADE_PX - border);
      if (best) box.style.maxHeight = (top + best + FADE_PX + border) + "px";   // whole rows, then the strip the fade lies in
    }
    // Pixels between the bottom of the Next button (or, before Next shows, where it will sit under the verdict) and the window's bottom edge.
    const NEXT_ROOM = 4;   // a little air under Next
    function roomBelow(box) {
      const next = $("next"), fb = $("feedback");
      let bottom = null;
      if (next && !next.hidden && next.getBoundingClientRect) { const r = next.getBoundingClientRect(); if (r.height > 0) bottom = r.bottom; }
      if (bottom === null && fb && !fb.hidden && fb.getBoundingClientRect) bottom = fb.getBoundingClientRect().bottom + 56;
      if (bottom === null) return 0;
      return (win.innerHeight || 0) - NEXT_ROOM - (bottom + (win.scrollY || win.pageYOffset || 0));   // where Next sits on the page, not in the scrolled view
    }
    // A box overflows only when its content is really taller than the box, measured after layout (not guessed by kind).
    const overflows = (box) => !!box && !box.hidden && box.scrollHeight > box.clientHeight + 2;
    let cueBoxes = [];
    function updateCues(boxes) { cueBoxes = boxes; drawCues(boxes); }
    function drawCues(boxes) {
      cues.forEach((c) => { if (c.parentNode) c.parentNode.removeChild(c); });
      cues = [];
      boxes.forEach((box) => {
        if (box && box.id === "result") snapResult(box);
        if (!overflows(box) || !box.parentNode) { if (box && box.removeAttribute) box.removeAttribute("data-more"); return; }
        const cue = el("p", { class: "cue", "aria-hidden": "true" }, "Scroll for more");
        box.parentNode.insertBefore(cue, box.nextSibling);
        cues.push(cue);
        box._cue = cue;
        if (!box._cueBound) { box._cueBound = true; box.addEventListener("scroll", () => { if (box._cue) refreshCue(box, box._cue); }); }
        refreshCue(box, cue);
      });
    }

    // Text with `code` in backticks: the backticks go, and the code shows as code (P06 screen part, G9). A lone
    // backtick stays as it is.
    // `nobreak` (the verdict line): an id (Q-056, T-C) or a quoted value ("B04") rides in a span that does not wrap, so a line never ends inside one.
    const NOBREAK = /\b[A-Z]{1,2}-[A-Z0-9]{1,4}\b|"[^"\n]*"/g;
    function appendPlain(node, text, nobreak) {
      if (!nobreak) { if (text) node.appendChild(doc.createTextNode(text)); return; }
      let at = 0;
      for (const m of text.matchAll(NOBREAK)) {
        if (m.index > at) node.appendChild(doc.createTextNode(text.slice(at, m.index)));
        node.appendChild(el("span", { class: "nw" }, m[0]));
        at = m.index + m[0].length;
      }
      if (at < text.length) node.appendChild(doc.createTextNode(text.slice(at)));
    }
    function appendRich(node, text, nobreak) {
      const s = String(text || "");
      let at = 0;
      for (const m of s.matchAll(/`([^`\n]+)`/g)) {
        if (m.index > at) appendPlain(node, s.slice(at, m.index), nobreak);
        node.appendChild(el("code", null, m[1]));
        at = m.index + m[0].length;
      }
      if (at < s.length) appendPlain(node, s.slice(at), nobreak);
    }
    // Each line of a round's explanation is its own short paragraph, with a gap between (round 5, Tufte D): a newline in
    // the text becomes a small block gap, so three sentences never read as one block.
    function paragraphs(node) {
      let n = node.firstChild;
      while (n) {
        const next = n.nextSibling;
        if ((n.tag === "#text" || n.nodeType === 3) && String(n.textContent).indexOf("\n") >= 0) {
          String(n.textContent).split("\n").forEach((piece, i) => {
            if (i > 0) node.insertBefore(el("span", { class: "para-gap", "aria-hidden": "true" }), n);
            if (piece) node.insertBefore(doc.createTextNode(piece), n);
          });
          node.removeChild(n);
        }
        n = next;
      }
    }
    // Plain text, or text with its glossary terms as small buttons that open the meaning underneath.
    function fillParts(node, text, parts, nobreak) {
      node.textContent = "";
      if (!parts) { appendRich(node, text, nobreak); return; }
      // A term is a button, and a line may break either side of a button. Punctuation stuck to a term ("stories[", ",")
      // is kept with it in one no-break span, so a comma or a bracket never starts a line on its own.
      const items = parts.map((p) => Object.assign({}, p));
      items.forEach((p, i) => {
        if (!p.term) return;
        const prev = items[i - 1], next = items[i + 1];
        p.pre = ""; p.post = "";
        if (prev && !prev.term) { const m = /\S+$/.exec(prev.text); if (m) { p.pre = m[0]; prev.text = prev.text.slice(0, m.index); } }
        if (next && !next.term) { const m = /^\S+/.exec(next.text); if (m) { p.post = m[0]; next.text = next.text.slice(m[0].length); } }
      });
      items.forEach((p) => {
        if (!p.term) { if (p.text) appendRich(node, p.text, nobreak); return; }
        const b = el("button", { type: "button", class: "term", "aria-expanded": String(!!p.open), "data-term": p.term }, p.text);
        b.addEventListener("click", () => { refocus = p.term; ctrl.toggleTerm(p.term); });
        if (!p.pre && !p.post) { node.appendChild(b); return; }
        const glue = el("span", { class: "nb" });
        if (p.pre) glue.appendChild(doc.createTextNode(p.pre));
        glue.appendChild(b);
        if (p.post) glue.appendChild(doc.createTextNode(p.post));
        node.appendChild(glue);
      });
    }

    const rangeUi = Range.createRangeRenderer({ $, el, clear, setText, showOnly, updateCues, ctrl: () => ctrl,
      getLastKey: () => lastKey, setLastKey: (k) => { lastKey = k; } });
    const renderRange = (v) => rangeUi.renderRange(v);

    // An answer choice: pressed when picked; after the answer is known, a tick on the right one and a cross on a wrong
    // pick (P13). The mark is said in words for a screen reader, not only drawn.
    function choiceButton(text, pressed, mark, onClick, pos) {
      const b = el("button", { type: "button", class: "choice" + (mark ? " " + mark : ""), "aria-pressed": String(!!pressed), "data-pos": String(pos) });
      if (mark) b.appendChild(el("span", { class: "mark", "aria-hidden": "true" }, mark === "right" ? "\u2713 " : "\u2717 "));
      b.appendChild(doc.createTextNode(String(text)));
      if (mark) b.appendChild(el("span", { class: "sr-only" }, mark === "right" ? " (the right answer)" : " (your pick, not right)"));
      b.addEventListener("click", onClick);
      return b;
    }
    function hintButton(label) {
      const b = el("button", { type: "button", class: "quiet", "aria-label": label }, label);
      // the next hint button, or else the hint just shown, keeps the keyboard's place after the redraw
      b.addEventListener("click", () => { ctrl.hint(); focusFirst([], "#hints button.quiet:not([disabled])", "#hints .hint:last-of-type"); });
      return b;
    }
    // Focus the first of these that is on screen: ids, then selectors. A redraw that replaces a pressed button would
    // otherwise drop a keyboard player back at the top of the page.
    function focusFirst(ids) {
      const sels = Array.prototype.slice.call(arguments, 1);
      for (const id of ids) { const n = $(id); if (n && !n.hidden && n.focus) { n.focus(); return; } }
      if (!doc.querySelector) return;
      for (const s of sels) { const n = doc.querySelector(s); if (n && n.focus) { if (!n.hasAttribute("tabindex") && !/^(BUTTON|A|TEXTAREA|INPUT|SUMMARY)$/.test(n.tagName)) n.setAttribute("tabindex", "-1"); n.focus(); return; } }
    }
    // Round 6 (LS-41): when "Show me the line" fills the editor, its border lights once, so the eye finds where the line went. Under reduced
    // motion the stylesheet drops the animation and the border simply stays lit for a moment (calm, still visible).
    let flashTimer = null;
    function flashEditor() {
      const box = $("code");
      if (!box || !box.classList) return;
      box.classList.remove("line-flash"); void box.offsetWidth; box.classList.add("line-flash");
      if (flashTimer) win.clearTimeout(flashTimer);
      flashTimer = win.setTimeout(() => { flashTimer = null; box.classList.remove("line-flash"); }, 1100);
    }
    function setText(id, text) { const n = $(id); n.textContent = text; n.hidden = !text; }

    function render() {
      const v = ctrl.view();
      $("app").setAttribute("data-screen", v.screen);
      drawNav(v);
      if (v.screen === "list") return renderList(v);
      if (v.screen === "start") return renderStart(v);
      if (v.screen !== "end") endFocus = false;
      // The end page can be drawn twice (the lesson list arrives, the sound button syncs): each draw replaces the Continue
      // button, so while the player has not touched anything the new one takes the focus.
      if (v.screen === "end") { renderEnd(v); if (endFocus) focusFirst(["end-go-btn", "end-finding"]); return; }
      if (v.screen === "challenge") return renderChallenge(v);
      if (v.screen === "range") return renderRange(v);
      showOnly("screen-note");
      $("note").textContent = v.screen === "error" ? (v.error || "This lesson is not available.") : "Loading...";
      clear($("dots"));
    }

    // An exam pass is saved through web/course/course-state.js by web/lesson-exam-save.js, both loaded by lesson.html.
    const attempt = new URLSearchParams(win.location.search || "").get("attempt") || "";
    const saver = win.JuliaTimeLessonExamSave, courseState = win.JuliaTimeCourseState;
    ctrl = createController({
      lessonId: lessonIdFromSearch(win.location.search), storage, attempt,
      onExamPass: (record, code) => (saver && courseState ? saver.saveExamPass(courseState, storage, attempt, record, code) : false),
      send: (m) => { if (socket) socket.send(m); }, onChange: render,
    });
    // Focus never falls to the page body: Start goes to the editor (or the warm-up card that stands before the task).
    $("start").addEventListener("click", () => { ctrl.start(); if (ctrl.state.screen === "challenge") focusFirst(ctrl.view().ch.warmGate ? ["remember"] : ["code"]); });
    $("fast-lane").addEventListener("click", () => { lastKey = ""; ctrl.fastLane(); if ($("prompt").focus) $("prompt").focus(); });
    $("story-link").addEventListener("click", () => ctrl.toggleStory());
    // A click (or Space on the focused box) flips the switch; the redraw sets each box from the saved state.
    $("show-r").addEventListener("click", () => ctrl.toggleShow("r"));
    $("show-py").addEventListener("click", () => ctrl.toggleShow("py"));
    // Cheat sheet: on a line it opens the pocket dictionary beside the work; elsewhere it opens the whole sheet.
    $("cheat").addEventListener("click", () => {
      const onLine = ctrl.state.screen === "challenge" && !$("dict").hidden;
      if (onLine) {
        $("dict").open = true;
        const sum = $("dict").querySelector ? $("dict").querySelector("summary") : null;
        if (sum && sum.focus) sum.focus();
        if ($("dict").scrollIntoView) $("dict").scrollIntoView({ block: "nearest" });
        return;
      }
      sheetOpen = !sheetOpen; render();
    });
    $("copy-all").addEventListener("click", () => {
      const b = $("copy-all");
      try { win.navigator.clipboard.writeText(b._lines || ""); b.textContent = "Copied"; } catch (e) { b.textContent = "Select the lines and copy them"; }
    });
    $("starter").addEventListener("click", () => {
      const line = ctrl.showStarter();
      // into an empty editor only, and then never a second time beside it (P14)
      if (line && !$("code").value.trim()) { $("code").value = line; ctrl.draft(line); ctrl.starterFilled(line); $("starter-box").hidden = true; }
      $("code").focus();
    });
    $("end-restart").addEventListener("click", () => { if (win.confirm("Start this lesson again? Your saved lines will be cleared.")) { lastKey = ""; ctrl.restart(); } });
    $("look-link").addEventListener("click", () => ctrl.toggleLook());
    $("look-try").addEventListener("click", () => { afterLook = true; ctrl.tryLook(); });
    $("restart").addEventListener("click", () => { if (win.confirm("Start this lesson again? Your saved lines will be cleared.")) { lastKey = ""; ctrl.restart(); } });
    const inRange = () => ctrl.state.screen === "range";
    // Run disables itself while Julia works, which drops the keyboard's place: once the answer is drawn, a pass moves
    // focus to Next, anything else back to Run.
    const runIt = () => { if (!inRange()) afterRun = true; return inRange() ? ctrl.fire($("code").value) : ctrl.run($("code").value); };
    $("run").addEventListener("click", runIt);
    $("reset").addEventListener("click", () => {
      if (inRange()) { $("code").value = ""; ctrl.rangeDraft(""); } else $("code").value = ctrl.reset();
      $("code").focus();
    });
    $("code").addEventListener("input", () => (inRange() ? ctrl.rangeDraft($("code").value) : ctrl.draft($("code").value)));
    $("code").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (!$("run").disabled) runIt(); } });
    $("testout-btn").addEventListener("click", () => { lastKey = ""; ctrl.testOut(); if ($("prompt").focus) $("prompt").focus(); });
    $("testout-leave").addEventListener("click", () => { lastKey = ""; ctrl.leaveTestOut(); if ($("prompt").focus) $("prompt").focus(); });
    $("wave-hint").addEventListener("click", () => ctrl.toggleHint());
    $("print").addEventListener("click", () => win.print());
    $("show-line").addEventListener("click", () => { $("code").value = ctrl.showLine(); flashEditor(); focusFirst(["run"]); });
    $("range-end-back").addEventListener("click", () => { lastKey = ""; ctrl.leaveRangeEnd(); });
    $("next").addEventListener("click", () => {
      if (inRange()) { lastKey = ""; ctrl.nextWave(); const e = $(ctrl.view().range && ctrl.view().range.end ? "range-end-say" : "prompt"); if (e && e.focus) e.focus(); if (win.scrollTo) win.scrollTo(0, 0); return; }
      // focus goes to the new task, or to the warm-up card that stands before it
      lastKey = ""; ctrl.next(); const scr = ctrl.view().screen; endFocus = scr === "end"; focusFirst(scr === "end" ? ["end-go-btn", "end-finding"] : ["prompt", "remember"]); if (win.scrollTo) win.scrollTo(0, 0); });
    ["keydown", "mousedown", "touchstart"].forEach((t) => { if (win.addEventListener) win.addEventListener(t, () => { endFocus = false; }, true); });
    socket = createSocket((m) => ctrl.handle(m), (st) => {
      const c = $("conn"); c.textContent = st === "connected" ? "" : (st === "connecting" ? "Connecting to Julia..." : "Not connected. Trying again...");
      // The status sits in the same slot as the progress label (never an extra item), so the bar never wraps or jumps.
      const mid = $("strip-mid"); if (mid) mid.setAttribute("data-status", st === "connected" ? "0" : st === "connecting" ? "wait" : "lost");
      if (st === "connected") ctrl.open();
      else if (ctrl.state.pending || ctrl.state.look.pending) { ctrl.state.pending = null; ctrl.state.look.pending = null; ctrl.state.notice = "Connection lost. Press Run to try again."; render(); }
    }, win.WebSocket, win.location);
    win.addEventListener("pagehide", () => socket.stop());
    render();
  }

  return { createController, createSocket, snapCap, noteIsCode, seededOrder, listItems, listInfo, tableInfo, rowTable, lessonIdFromSearch, flatten, glossaryMarks, glossaryParts, scoreShot, STORE_PREFIX, RANGE_ID, init };
});

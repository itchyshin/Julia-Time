/* Julia Time: the target range (lessons/range.json, kind "range"), on the lesson screen. The range builder owns this file
   (fix round 2, 30 Sep). lesson.js calls it in two places: createRangeController (inside the lesson controller, sharing
   its state) and createRangeRenderer (inside the page layer, sharing its DOM helpers). No lesson text lives here; the
   level names, groups, columns and the boss story come from lessons/range.json.

   Fun, without a score. The range is a ladder of named groups and a boss. A run is shown in three beats, all driven by
   what the player's line picked: a sweep of the line over the jars (jars it keeps light up, the rest fade), then a
   left-to-right cascade in which each right jar wobbles and fills with a soft clink and each wrong pick gets a dull thud
   and a small shake. The sounds are made with Web Audio in code (no files), on by default, one mute button, remembered.
   Under prefers-reduced-motion nothing wobbles, shakes or sweeps: the jars simply show the result. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./julia-text.js") : root && root.JuliaTimeJuliaText);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeLessonRange = api;
})(typeof window !== "undefined" ? window : null, function (JuliaText) {
  "use strict";

  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  // The saved record keeps its old key names ("stars" means done) so a range saved earlier still opens.
  function emptyRangeProgress() { return { stars: {}, best: {}, drafts: {}, sharp: {}, lines: {}, revealed: {}, shots: {}, picks: {} }; }

  const SOUND_KEY = "julia-time:range:sound:v1";
  const SWEEP_MS = 1000;        // the line sweeps over every jar in this time, however many jars there are
  const JAR_SWEEP_MS = 420;     // one jar's own light-up or fade inside the sweep (lesson-range.css uses the same 420ms)
  const SETTLE_GAP_MS = 140;    // a short beat between the sweep and the first fill
  const CASCADE_STEP_MS = 120;  // one picked jar after another, left to right
  const FANFARE_MS = 950;       // the boss fanfare's length: Finish waits for it, so the sound is heard before the way on appears
  const WAIT_CUE_MS = 1000;     // a Run that waits longer than this says so, calmly

  // ---- target range: how one shot is judged ----------------------------------------------------
  // targets: the ids to hit exactly. rule: any `count` distinct ids from `from`. A level is clean when every target is
  // hit and there are no wrong picks. (hits and misses are counts for the picture; nothing is added up into a score.)
  function scoreShot(wave, picked) {
    const ids = [];
    (Array.isArray(picked) ? picked : []).forEach((x) => { const id = String(x); if (!ids.includes(id)) ids.push(id); });
    let pool = [], need = 0, hitIds = [], missIds = [];
    if (wave && Array.isArray(wave.targets)) {
      pool = wave.targets.map(String); need = pool.length;
      hitIds = ids.filter((id) => pool.includes(id));
      missIds = ids.filter((id) => !pool.includes(id));
    } else if (wave && wave.rule) {
      pool = (wave.rule.from || []).map(String); need = Number(wave.rule.count) || 0;
      const inPool = ids.filter((id) => pool.includes(id));
      hitIds = inPool.slice(0, need);
      missIds = ids.filter((id) => !pool.includes(id)).concat(inPool.slice(need));
    }
    // A rule wave takes any jars from the group, so no one jar is "the missed target".
    const missedIds = hitIds.length < need && !(wave && wave.rule && !Array.isArray(wave.targets)) ? pool.filter((id) => !hitIds.includes(id)) : [];
    return { hitIds, missIds, missedIds, hits: hitIds.length, misses: missIds.length, score: hitIds.length - missIds.length,
      need, missedCount: Math.max(0, need - hitIds.length),
      clean: need > 0 && hitIds.length === need && missIds.length === 0 };
  }
  // A lesson reference ends in its number; the screen names lessons by number.
  const lessonNumberOf = (ref) => { const m = /(\d+)$/.exec(String(ref || "")); return m ? m[1] : String(ref || ""); };

  // ---- the timeline of one run (pure) ------------------------------------------------------------
  // tiles: [{id, state, picked, refused}] in drawing order. Returns, in ms from the moment the board is drawn:
  //   tiles[i]  {id, sweepAt, keep, cascadeAt}  the sweep reaches jar i at sweepAt; keep = the line picked it;
  //             cascadeAt = when its fill (and wobble or shake) starts, or null for a jar that is not picked
  //   audio     [{kind "clink"|"thud", at, k}]  the sounds, in the same order as the cascade
  // With motion off (prefers-reduced-motion) nothing is animated: `animate` is false and every `at` on a tile is 0; the
  // sounds keep their order.
  function runPlan(tiles, opts) {
    const motion = !(opts && opts.motion === false);
    const n = tiles.length;
    const step = n ? (SWEEP_MS - JAR_SWEEP_MS) / n : 0;
    const settle = SWEEP_MS + SETTLE_GAP_MS;
    let k = 0;
    const audio = [];
    // A long cascade is quickened so that it never takes more than about a second and a half.
    const count = tiles.filter((t) => t.picked && ((t.state === "hit" && !t.refused) || t.state === "miss")).length;
    const gap = Math.max(40, Math.min(CASCADE_STEP_MS, Math.floor(1500 / Math.max(1, count))));
    const out = tiles.map((t, i) => {
      const keep = !!t.picked;
      let cascadeAt = null;
      if (keep) {
        const right = t.state === "hit" && !t.refused;
        if (right || t.state === "miss") {
          cascadeAt = motion ? settle + k * gap : 0;
          audio.push({ kind: right ? "clink" : "thud", at: (motion ? settle : 0) + k * gap, k });
          k += 1;
        } else cascadeAt = motion ? settle : 0;   // a picked jar that does not count yet: a calm outline, no sound
      }
      return { id: t.id, sweepAt: motion ? Math.round(i * step) : 0, keep, cascadeAt };
    });
    const endMs = motion ? settle + Math.max(k, 1) * gap + 260 : 0;
    return { animate: motion && n > 0, motion, sweepMs: motion ? SWEEP_MS : 0, settleMs: motion ? settle : 0, ringAt: motion ? endMs - 160 : 0, endMs, tiles: out, audio };
  }

  // ---- sound: Web Audio, generated, no files -------------------------------------------------------
  // On by default. The choice is saved under SOUND_KEY ("off" when muted). A browser that blocks audio until the page has
  // been touched simply stays silent until the first click or key. opts: {storage, AudioContext} for tests.
  function createSound(opts) {
    const o = opts || {};
    const g = typeof globalThis !== "undefined" ? globalThis : {};
    let storage = null;
    if (o.storage !== undefined) storage = o.storage;
    else { try { storage = g.localStorage || null; } catch (e) { storage = null; } }
    const Ctor = o.AudioContext !== undefined ? o.AudioContext : (g.AudioContext || g.webkitAudioContext || null);
    let on = true;
    try { on = !(storage && storage.getItem(SOUND_KEY) === "off"); } catch (e) { on = true; }
    let ac = null, batch = null;
    const log = [];   // what was asked of the speaker, in order (kept for tests)
    function ensure() {
      if (!Ctor) return null;
      if (!ac) { try { ac = new Ctor(); } catch (e) { ac = null; return null; } }
      if (ac.state === "suspended" && typeof ac.resume === "function") { try { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* stays silent */ } }
      return ac;
    }
    function tone(out, type, f0, f1, at, dur, peak) {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, at);
      if (f1) osc.frequency.exponentialRampToValueAtTime(f1, at + dur);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain); gain.connect(out);
      osc.start(at); osc.stop(at + dur + 0.03);
    }
    const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];   // a rising pentatonic, so a long cascade climbs
    function clink(out, at, k) {
      const f = 880 * Math.pow(2, SCALE[Math.min(k, SCALE.length - 1)] / 12);
      tone(out, "sine", f, 0, at, 0.34, 0.085);
      tone(out, "sine", f * 2.76, 0, at, 0.16, 0.03);
    }
    function thud(out, at) { tone(out, "triangle", 130, 52, at, 0.24, 0.2); }
    // events: [{kind "clink"|"thud"|"chime"|"fanfare", at (ms), k}]. Returns true when the speaker was asked.
    function play(events) {
      if (!on || !events || !events.length) return false;
      events.forEach((e) => log.push({ kind: e.kind, at: e.at, k: e.k || 0 }));
      const ctx = ensure();
      if (!ctx) return false;
      try {
        if (batch) { try { batch.disconnect(); } catch (e) { /* already gone */ } }
        batch = ctx.createGain(); batch.gain.value = 1; batch.connect(ctx.destination);
        const t0 = ctx.currentTime + 0.03;
        events.forEach((e) => {
          const at = t0 + (e.at || 0) / 1000;
          if (e.kind === "thud") thud(batch, at);
          else if (e.kind === "chime") [1318.5, 1760].forEach((f, i) => { tone(batch, "sine", f, 0, at + i * 0.11, 0.42, 0.06); });
          else if (e.kind === "fanfare") [1046.5, 1318.5, 1568, 2093].forEach((f, i) => { tone(batch, "sine", f, 0, at + i * 0.13, 0.5, 0.09); tone(batch, "sine", f * 2.76, 0, at + i * 0.13, 0.2, 0.025); });
          else clink(batch, at, e.k || 0);
        });
        return true;
      } catch (e) { return false; }
    }
    return {
      isOn: () => on,
      setOn(v) {
        on = !!v;
        try { if (storage) storage.setItem(SOUND_KEY, on ? "on" : "off"); } catch (e) { /* not remembered */ }
        if (!on && batch) { try { batch.disconnect(); } catch (e) { /* already gone */ } }
      },
      unlock: () => ensure(), play, log,
    };
  }

  // The player's line, shortened to sit on the sweep.
  function sweepLine(code) {
    const one = String(code || "").replace(/\s+/g, " ").trim();
    return one.length > 46 ? one.slice(0, 45) + "…" : one;
  }

  // The range's part of the lesson controller. ctx: { s, store, key, send, change, nextSeq, unknownWordLine, STORE_PREFIX }.
  // `s` is the lesson controller's own state object; the range keeps its record in s.range.
  function createRangeController(ctx) {
    const { s, store, key, send, change, nextSeq, unknownWordLine, STORE_PREFIX } = ctx;
    let resultSeq = 0;   // counts results, so the page animates each run once and never re-runs an animation on a redraw
    function lessonPassed(ref) {
      const done = (id) => {
        try {
          const raw = JSON.parse(store.get(STORE_PREFIX + id) || "null");
          return !!(raw && typeof raw === "object" && raw.lastCheckpointDone);
        } catch (e) { return false; }
      };
      if (done(ref)) return true;
      // Passing a later lesson also opens an earlier lesson's waves: its skills are in that later lesson too.
      const n = Number(lessonNumberOf(ref));
      if (!Number.isFinite(n)) return false;
      return store.keys(STORE_PREFIX).some((k) => {
        const id = k.slice(STORE_PREFIX.length), m = /^lesson(\d+)$/.exec(id);   // a chapter exam is not a lesson
        return !!m && Number(m[1]) >= n && done(id);
      });
    }

    // ---- target range --------------------------------------------------------------------------
    function loadRange() {
      let p = emptyRangeProgress();
      try {
        const raw = JSON.parse(store.get(key()) || "null");
        if (raw && typeof raw === "object") p = Object.assign(p, raw);
      } catch (e) { /* start clean */ }
      ["stars", "best", "drafts", "sharp", "lines", "revealed", "shots", "picks"].forEach((k) => { if (!p[k] || typeof p[k] !== "object") p[k] = {}; });
      const r = { progress: p, wave: null, result: null, hint: false, end: false, lastCode: "" };
      const first = waveList().find((w) => !w.locked && !p.stars[w.id]) || waveList().find((w) => !w.locked);
      r.wave = first ? first.id : null;
      return r;
    }
    const saveRange = () => store.set(key(), JSON.stringify(s.range.progress));
    function waveList() {
      return ((s.lesson && s.lesson.waves) || []).map((w, i) => {
        const locked = !lessonPassed(w.unlocks_after);
        return Object.assign({}, w, { n: i + 1, locked, unlockNumber: Number(lessonNumberOf(w.unlocks_after)), unlockText: locked ? "Unlocks after Lesson " + lessonNumberOf(w.unlocks_after) : "",
          rings: w.rings === "after" ? "after" : "before" });
      });
    }
    const currentWave = () => waveList().find((w) => w.id === (s.range && s.range.wave) && !w.locked) || null;
    function selectWave(id) {
      if (!s.range) return;
      const w = waveList().find((x) => x.id === id);
      if (!w || w.locked || s.pending) return;
      s.range.wave = id; s.range.result = null; s.range.hint = false; s.range.end = false; s.notice = "";
      change();
    }
    // After a clean wave: the next open wave that is not done (after this one first). When every open wave is done (a
    // replay of a finished wave), the next open wave in order. null only after the last open wave.
    function nextWaveTarget() {
      const list = waveList(), at = list.findIndex((w) => w.id === s.range.wave);
      const open = (w) => !w.locked && !s.range.progress.stars[w.id];
      return list.slice(at + 1).find(open) || list.find(open) || list.slice(at + 1).find((w) => !w.locked) || null;
    }
    function nextWave() {
      const res = s.range && s.range.result;
      if (!res || !res.shot || !res.shot.clean || s.pending) return;
      const t = nextWaveTarget();
      if (t) selectWave(t.id); else { s.range.end = true; s.range.hint = false; change(); }
    }
    function leaveRangeEnd() {
      if (!s.range) return;
      const first = waveList().find((w) => !w.locked);
      s.range.end = false; s.range.result = null;
      if (first) s.range.wave = first.id;
      change();
    }
    function toggleHint() { if (s.range && currentWave()) { s.range.hint = !s.range.hint; change(); } }
    function fire(code) {
      const w = currentWave();
      if (!w || s.pending) return;
      s.range.progress.drafts[w.id] = code;
      s.range.lastCode = code;
      saveRange();
      s.pending = "fire-" + nextSeq();
      s.range.result = null; s.notice = "";
      change();
      const shotNumber = (s.range.progress.shots[w.id] || 0) + 1;   // which run of this wave this is; the engine judges the first-shot flag
      send({ type: "lesson_run", lesson: s.lesson.id || s.lessonId, challenge: w.id, code, shot_number: shotNumber, request_id: s.pending });
    }

    // Coaching the server does not give: the R habit for "and" (& and &&), and where the column names are.
    function coach(r, code) {
      if (r.feedback) r.feedback = r.feedback.replace("Check the column names in the table shown.", "Check the column names in the strip above the editor.").replace(/\bThis wave\b/g, "This level").replace(/\bthis wave\b/g, "this level");
      if (r.status !== "error") return;
      if (r.feedback && !/^Julia could not run this\b/.test(r.feedback)) return;
      const src = String(code || "");
      // A table given one index (logbook[9]): Julia's own message is true but hidden in a fold, so the line says it plainly.
      if (/syntax df\[column\] is not supported/.test(String(r.message || ""))) {
        const t = rangeTable() || "logbook";
        r.feedback = "A table needs rows, a comma, then columns, as in " + t + "[9,:]. To pick from one column, use " + t + ".jar_id[9].";
        return;
      }
      // A comparison written without its dot (logbook.tray_id != "T-D"): Julia's own message is about a single true, so the line says it plainly.
      const bare = src.replace(/"[^"\n]*"/g, '""');
      const undotted = /(?<![.=!<>])(==|!=)(?![=(])/.exec(bare);
      if (undotted) { r.feedback = "Add a dot: write ." + undotted[1] + " instead of " + undotted[1] + ", so Julia compares every value, one at a time."; return; }
      if (/\.(&&|\|\|)/.test(src)) r.feedback = "Julia has no .&& or .||. To combine two yes or no answers one jar at a time, use .& (and) or .| (or) with one symbol, and put each question in round brackets.";
      else if (/(^|[^.&])&&?(?!=)/.test(src) || /(^|[^.|])\|\|?/.test(src)) r.feedback = "Julia wants a dot here too: .& combines two yes or no answers one jar at a time (.| for or). Put each question in round brackets.";
    }
    function rangeResult(msg) {
      const w = currentWave();
      if (!w) return;
      const r = { status: msg.status, feedback: String(msg.feedback || ""), message: String(msg.message || "").trim(), shot: null, seq: ++resultSeq, refused: false };
      if (r.status === "error" && /^Julia could not run this\b/.test(r.feedback)) r.feedback = unknownWordLine(r.message, false) || r.feedback;
      coach(r, s.range.lastCode);
      // A level that names its group in words says so where the server says "named in the target" (level 7 names no jars).
      if (w.group_words) r.feedback = r.feedback.replace(/Pick only from the jars named in the target\./, "Pick only from the " + w.group_words + ".");
      // The server reads jar ids from a list or a table. One jar id on its own (a single quoted string) is read here.
      let picked = Array.isArray(msg.picked_ids) ? msg.picked_ids : null;
      const one = /^"([^"\n]+)"$/.exec(String(msg.value_repr || "").trim());
      if (!picked && msg.status === "ok" && one) picked = [one[1]];
      // names(logbook) is a peek, not a pick: a list made only of the table's column names is not scored and not counted.
      const colNames = columnNames();
      if (picked && picked.length && colNames.length && picked.every((x) => colNames.includes(String(x)))) {
        r.feedback = "That shows the column names, not jars. Pick jars by their ids.";
        r.peek = true;
        picked = null;
      }
      if (picked) {
        r.shot = scoreShot(w, picked);
        const raw = picked.map(String);
        r.shot.repeatIds = raw.filter((id, i) => raw.indexOf(id) !== i).filter((id, i, a) => a.indexOf(id) === i);
        const srv = msg.range;                              // when the server judged the shot, its numbers win
        if (srv && typeof srv.hits === "number" && typeof srv.misses === "number") {
          r.shot.hits = srv.hits; r.shot.misses = srv.misses; r.shot.score = srv.hits - srv.misses;
          r.shot.clean = !!srv.clean;
          if (Array.isArray(srv.missed_targets) && Array.isArray(w.targets)) r.shot.missedIds = srv.missed_targets.map(String);
        }
        // The right jars, but the level's own rule refuses the way (typed ids, row numbers, the same jars every time).
        // The picture must not say "win" while the words say "not yet": the jars stay as outline ticks.
        r.refused = !!(srv && srv.rule_broken);
        if (r.refused) { r.shot.clean = false; r.shot.refused = true; }
        const best = s.range.progress.best[w.id];
        if (best === undefined || r.shot.score > best) s.range.progress.best[w.id] = r.shot.score;
        s.range.progress.revealed[w.id] = true;         // "after" rings show once the first run has picked jars
        // The first-run flag (kept for old saves) is whether this was the first run of the level that picked jars.
        const srvShot = msg.range && typeof msg.range.shot_number === "number" ? msg.range.shot_number : null;
        const first = srvShot !== null ? srvShot === 1 : !(s.range.progress.shots[w.id] > 0);
        s.range.progress.shots[w.id] = (s.range.progress.shots[w.id] || 0) + 1;
        r.first = first;
        if (r.shot.clean) {
          s.range.progress.stars[w.id] = true;
          const code = String(s.range.lastCode || "").trim();
          if (first) { s.range.progress.sharp[w.id] = true; r.sharp = true; }
          const old = s.range.progress.lines[w.id];
          if (code && (first || typeof old !== "string")) s.range.progress.lines[w.id] = code;
          s.range.progress.picks[w.id] = r.shot.hitIds.slice();
          // A clean way the lesson did not teach gets a nudge, never a refusal (level 1 accepts `logbook[9,:]`).
          const nudge = w.nudge;
          if (nudge && nudge.when_code && nudge.say) { try { if (new RegExp(nudge.when_code).test(code)) r.nudge = String(nudge.say); } catch (e) { /* a bad pattern says nothing */ } }
        }
        saveRange();
      }
      s.range.result = r;
    }
    // The table's column names, whether the server sends them as plain names or as {name, example} objects.
    function columnNames() {
      const L = s.lesson || {};
      return (Array.isArray(L.columns) ? L.columns : []).map((c) => String(c && typeof c === "object" ? c.name : c || "")).filter(Boolean);
    }
    function rangeDraft(code) {
      const w = currentWave();
      if (!w) return;
      s.range.progress.drafts[w.id] = code;
      saveRange();
    }
    function rangeCode() {
      const w = currentWave();
      return w && typeof s.range.progress.drafts[w.id] === "string" ? s.range.progress.drafts[w.id] : "";
    }
    // The jars of a level: the level's own table when it carries one (the boss has thirty), else the range's rack.
    function jarsOf(w) {
      const own = w && Array.isArray(w.jars) && w.jars.length ? w.jars : ((s.lesson && s.lesson.jars) || []);
      return own.map((j) => ({ jar_id: String(j.jar_id), batch_id: j.batch_id, tray_id: j.tray_id }));
    }
    // The ladder: named groups of levels, in the order the file lists them. A level the file does not group goes in a last group.
    function ladderOf(waves) {
      const L = s.lesson || {};
      const byId = new Map(waves.map((w) => [w.id, w]));
      const groups = (Array.isArray(L.groups) ? L.groups : []).map((g) => ({ title: String(g.title || ""), boss: !!g.boss,
        levels: (g.levels || []).map((id) => byId.get(id)).filter(Boolean) })).filter((g) => g.levels.length);
      const used = new Set(groups.reduce((a, g) => a.concat(g.levels.map((l) => l.id)), []));
      const rest = waves.filter((w) => !used.has(w.id));
      if (rest.length) groups.push({ title: groups.length ? "More levels" : "", boss: false, levels: rest });
      groups.forEach((g) => { g.done = g.levels.every((l) => l.done); g.open = g.levels.some((l) => !l.locked); });
      return groups;
    }
    // The line under the level name. It does not change after a run, so the layout never jumps.
    // How many counted runs of a level before the jars it still needs get a ring (the range file's `missed_rings_after`).
    // A file without it keeps the older way: the rings come with the first run that picks jars.
    function missedAfter() { const n = Number((s.lesson || {}).missed_rings_after); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }
    function subtitleOf(w) {
      if (!w) return "";
      if (w.rings === "after" && missedAfter()) return "Aim from the words. A right jar turns green and an extra one red. After " + missedAfter() + " tries, the jars you missed get a ring.";
      return w.rings === "after" ? "Aim from the words. Rings show after your first run that picks jars." : "Hit every ringed jar and nothing else.";
    }
    // The range keeps no score and gives no stars (Shinichi's decision, 30 Sep): a level is done when a run hits every
    // target and nothing else.
    function rangeView() {
      const waves = waveList().map((w) => ({
        id: w.id, n: w.n, label: "Level " + w.n, title: w.title || "", boss: !!w.boss, locked: w.locked, unlockText: w.unlockText, unlockNumber: w.unlockNumber,
        done: !!s.range.progress.stars[w.id], selected: w.id === s.range.wave && !w.locked,
      }));
      const w = currentWave();
      const res = s.range.result;
      const shot = res && res.shot;
      const pool = w ? (Array.isArray(w.targets) ? w.targets.map(String) : (w.rule ? (w.rule.from || []).map(String) : [])) : [];
      const refused = !!(res && res.refused);
      // rings "after": the player aims from the words. The older way shows every ring after the first run that picks jars,
      // which turns "work it out" into "match the picture". With `missed_rings_after` the player sees only their own picks
      // (green right, red extra) and counts, and the jars still missed get a ring from that try on, or once the level is done.
      const lateRings = !!(w && w.rings === "after" && missedAfter());
      const tries = w ? (s.range.progress.shots[w.id] || 0) : 0;
      const ringsShown = !lateRings || !!(w && s.range.progress.stars[w.id]) || tries >= missedAfter();
      const state = (id) => {
        if (shot) {
          if (shot.hitIds.includes(id)) return "hit";
          if (shot.missIds.includes(id)) return "miss";
          return shot.missedIds.includes(id) && ringsShown ? "missed" : "";
        }
        const ringsOn = !w || w.rings !== "after" || (lateRings ? ringsShown : !!s.range.progress.revealed[w.id]);
        return ringsOn && pool.includes(id) ? "target" : "";
      };
      const jars = jarsOf(w);
      pool.concat(shot ? shot.missIds : []).forEach((id) => { if (!jars.some((j) => j.jar_id === id)) jars.push({ jar_id: id }); });
      const tiles = jars.map((j) => {
        const st = state(j.jar_id);
        return { id: j.jar_id, state: st, tray: j.tray_id, batch: j.batch_id, picked: st === "hit" || st === "miss",
          refused: refused && st === "hit", again: !!(shot && shot.repeatIds && shot.repeatIds.includes(j.jar_id)) };
      });
      const hasTray = tiles.some((t) => t.tray), hasBatch = tiles.some((t) => t.batch);
      const groups = [];
      tiles.forEach((t) => {
        const label = [hasTray ? t.tray : null, hasBatch ? t.batch : null].filter(Boolean).join(" · ");
        let g = groups.find((x) => x.label === label);
        if (!g) { g = { label, tiles: [] }; groups.push(g); }
        g.tiles.push(t);
      });
      const first = waves[0];
      const ringsAfter = !!(w && w.rings === "after" && !s.range.progress.revealed[w.id]);
      const clean = !!(shot && shot.clean);
      const boss = !!(w && w.boss);
      const nextT = clean ? nextWaveTarget() : null;
      const table = rangeTable();
      const locked = waves.filter((x) => x.locked);
      const lessonsLeft = Array.from(new Set(locked.map((x) => x.unlockNumber).filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);
      const L = s.lesson || {};
      const ladder = ladderOf(waves);
      const repeats = shot && shot.repeatIds ? shot.repeatIds : [];
      const summary = shot ? "Right jars: " + shot.hits + " of " + shot.need + ". Extra jars: " + shot.misses +
        (repeats.length ? " (" + repeats.join(", ") + (repeats.length === 1 ? " came twice" : " came twice each") + ")" : "") + "." : "";
      let feedback = s.notice;
      if (s.pending) feedback = "";
      else if (res) {
        if (clean) feedback = (boss ? "Boss beaten. The last shelf is yours. " : "") + "Every target hit, and nothing else. Level done.";
        else if (shot && res.refused) feedback = "Right jars, but this run does not count yet. " + (res.feedback || "Try the level again the way it asks.");
        else if (shot) feedback = res.feedback || "Not yet. Hit every target jar and nothing else.";
        else feedback = res.feedback || rangeFailLine(res);
        // The protected-input note is the game's own note: it is the feedback line, not Julia's message.
        const note = res.status === "error" ? JuliaText.protectedNote(res.message) : "";
        if (note && !clean) feedback = note;
      }
      return {
        end: s.range.end ? rangeEnd(waves) : null,
        rule: subtitleOf(w),
        next: clean ? { label: nextT ? "Next level" : "Finish", last: !nextT } : null,
        preShot: (table ? "Your table is called " + table + ". " : "") + (ringsAfter ? "Aim from the words: rings show after your first run that picks jars." : "Ring: a jar to hit."),
        table, tableLine: table ? "Your table is called " + table + "." : "",
        columns: Array.isArray(L.columns) ? L.columns.map((c) => (c && typeof c === "object" ? { name: String(c.name || ""), example: String(c.example || "") } : { name: String(c || ""), example: "" })).filter((c) => c.name) : [],
        ladder,
        lockedLeft: locked.length > 0,
        // Locked levels stay on the ladder as dim rungs, and one line says what opens them.
        lockedLine: !locked.length ? "" : plural(locked.length, "more level opens", "more levels open") + " as you finish " +
          (lessonsLeft.length === 1 ? "Lesson " + lessonsLeft[0] : "Lessons " + lessonsLeft[0] + " to " + lessonsLeft[lessonsLeft.length - 1]) + ".",
        title: L.title || "", goal: L.goal || "", waves,
        wave: w ? { id: w.id, n: w.n, label: "Level " + w.n, title: w.title || "", target: w.target || "", hint: w.hint || "", hintOpen: s.range.hint, rings: w.rings, boss,
          story: boss ? (w.story || "") : "", group: (ladder.find((g) => g.levels.some((l) => l.id === w.id)) || {}).title || "" } : null,
        idle: w ? "" : (first ? first.unlockText : ""),
        groups, tiles, code: rangeCode(), pending: !!s.pending,
        summary, seq: res ? res.seq : 0,
        sweep: shot ? { line: sweepLine(s.range.lastCode), kept: tiles.filter((t) => t.picked).length, total: tiles.length } : null,
        refused, nudge: res && res.nudge && clean ? res.nudge : "",
        tone: s.pending || !res ? "" : (clean ? "ok" : (res.status === "ok" ? "notyet" : "alert")),
        clean, done: !!(w && s.range.progress.stars[w.id]),
        feedback,
        // Julia's own text only (web/julia-text.js, shared with the lesson screen), and only for a real error.
        message: res && res.status === "error" ? JuliaText.juliaText(res.message) : "",
        dataLabel: L.data_label || "",
      };
    }
    // The table the range's line works on: the file's own `table`, else the name its level texts give ("the table called x").
    function rangeTable() {
      const L = s.lesson || {};
      if (typeof L.table === "string" && /^[A-Za-z_]\w*$/.test(L.table)) return L.table;
      for (const w of L.waves || []) { const m = /table called ([A-Za-z_]\w*)/.exec(String(w.target || "")); if (m) return m[1]; }
      return "";
    }
    // The end screen once every open level is done: the line that cleared each level, and a small picture of the jars it picked.
    function rangeEnd(waves) {
      const open = waves.filter((w) => !w.locked), P = s.range.progress;
      const all = waveList();
      const bossWave = all.find((w) => w.boss);
      // What the next lesson opens: the locked levels with the lowest lesson number (the ladder opens in lesson order).
      const waiting = waves.filter((w) => w.locked && Number.isFinite(w.unlockNumber));
      const nextLesson = waiting.length ? Math.min.apply(null, waiting.map((w) => w.unlockNumber)) : null;
      const nextLevels = waiting.filter((w) => w.unlockNumber === nextLesson).map((w) => w.n);
      return {
        cleared: open.length, locked: waves.length - open.length, all: waves.length === open.length,
        lastOpen: open.length ? open[open.length - 1].n : 0, nextLesson, nextLevels,
        boss: bossWave ? { title: bossWave.title || "", beaten: !!P.stars[bossWave.id] } : null,
        waves: open.map((w) => {
          const full = all.find((x) => x.id === w.id);
          const picked = Array.isArray(P.picks[w.id]) ? P.picks[w.id].map(String) : [];
          return { label: w.label, title: w.title, boss: w.boss, done: !!P.stars[w.id], line: typeof P.lines[w.id] === "string" ? P.lines[w.id] : "",
            jarIds: jarsOf(full).map((j) => j.jar_id), picked };
        }),
      };
    }
    function rangeFailLine(res) {
      if (res.status === "timeout") return "Julia took too long. Try a shorter line.";
      if (res.status === "error") return unknownWordLine(res.message) || "Julia could not run this. Read your line again.";
      return "Your line did not pick any jars. Pick jars by their ids.";
    }

    return { loadRange, rangeResult, rangeView, selectWave, nextWave, leaveRangeEnd, toggleHint, fire, rangeDraft, rangeCode };
  }

  // The range's part of the page layer. ctx: { $, el, clear, setText, showOnly, updateCues, ctrl, getLastKey, setLastKey }.
  // Optional ctx.sound replaces the generated sounds (tests).
  function createRangeRenderer(ctx) {
    const { $, el, clear, setText, showOnly, updateCues } = ctx;
    const sound = ctx.sound || createSound();
    const ui = { mounted: false, sig: "", animSeq: 0, endSig: "", lateMs: 0, lateSeq: 0, hold: null, waitTimer: null };
    const later = (fn, ms) => (typeof globalThis !== "undefined" && globalThis.setTimeout ? globalThis.setTimeout(fn, ms) : null);
    const cancel = (t) => { if (t !== null && typeof globalThis !== "undefined" && globalThis.clearTimeout) globalThis.clearTimeout(t); };
    const reduced = () => {
      try { return !!(typeof globalThis !== "undefined" && globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
    };
    // The range's own style sheet. lesson.html may link it; if it does not, it is added here, once.
    (function addStyles() {
      if (typeof document === "undefined" || !document.head || !document.createElement || !document.querySelector) return;
      if (document.querySelector('link[href$="lesson-range.css"]')) return;
      const link = document.createElement("link");
      link.setAttribute("rel", "stylesheet"); link.setAttribute("href", "lesson-range.css");
      document.head.appendChild(link);
    })();
    // A browser lets a page make sound only after the player has touched it: wake the speaker on the first touch or key.
    (function wakeOnTouch() {
      if (typeof document === "undefined" || !document.addEventListener) return;
      ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, () => { if (sound.isOn()) sound.unlock(); }, { passive: true }));
    })();

    function mount() {
      if (ui.mounted) return;
      ui.mounted = true;
      const right = $("right"), left = $("left");
      ui.cols = el("div", { id: "range-cols", class: "range-cols" });
      right.insertBefore(ui.cols, $("predict"));
      // The one mute button sits with the other buttons, under the editor.
      ui.soundBtn = el("button", { type: "button", id: "range-sound", class: "quiet" });
      ui.soundBtn.addEventListener("click", () => { sound.setOn(!sound.isOn()); paintSound(); });
      (($("wave-hint").parentNode) || right).appendChild(ui.soundBtn);
      // The hint opens where the page puts it, straight under the buttons, so it sits next to the button that opened it.
      ui.boss = el("div", { id: "range-boss", class: "boss-banner" });
      left.insertBefore(ui.boss, $("kind-label"));
      ui.finale = el("div", { id: "range-finale", class: "finale" });
      $("screen-range-end").insertBefore(ui.finale, $("range-end-say"));
    }
    function paintSound() {
      const on = sound.isOn();
      ui.soundBtn.textContent = on ? "Sound: on" : "Sound: off";
      ui.soundBtn.setAttribute("aria-pressed", String(on));
      ui.soundBtn.setAttribute("aria-label", on ? "Sound is on. Press to mute." : "Sound is off. Press to turn it on.");
    }

    // A tray, batch or jar name must not break at its hyphen ("T-" / "E"): each one rides in a span that does not wrap.
    function fillNoBreak(node, text, re) {
      node.textContent = "";
      const t = String(text);
      let i = 0;
      const plain = (x) => { if (x) node.appendChild(el("span", null, x)); };
      for (const m of t.matchAll(re)) { plain(t.slice(i, m.index)); node.appendChild(el("span", { class: "nw" }, m[0])); i = m.index + m[0].length; }
      plain(t.slice(i));
    }

    // "Level 4", "Levels 4 and 5", "Levels 4 to 6".
    function levelsText(ns) {
      const a = (ns || []).slice().sort((x, y) => x - y);
      if (a.length <= 1) return "Level " + (a[0] || "");
      const run = a.every((n, i) => i === 0 || n === a[i - 1] + 1);
      return "Levels " + (a.length === 2 ? a[0] + " and " + a[1] : run ? a[0] + " to " + a[a.length - 1] : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
    }

    // The end screen: the finish. The boss is beaten, and each level's line sits beside a small picture of its jars.
    function renderRangeEnd(R, v) {
      showOnly("screen-range-end");
      const E = R.end;
      $("range-end-home").setAttribute("href", v.nav.board);
      clear($("dots")); $("clues").hidden = true;
      const beaten = !!(E.boss && E.boss.beaten);
      clear(ui.finale); ui.finale.hidden = !beaten;
      if (beaten) {
        ui.finale.appendChild(el("p", { class: "finale-kicker" }, "Boss beaten. The last shelf is yours."));
        ui.finale.appendChild(el("p", { class: "finale-line" }, (E.boss.title ? E.boss.title + ": cleared." : "The last level is cleared.") + " Every rung of the ladder is done."));
      }
      // Only some levels are open (a player who has done the first lesson): say what is done and what opens the rest,
      // so the page is a stopping place with a way on, not a dead end called "Range cleared".
      const heading = Array.from($("screen-range-end").children || []).find((c) => /^h1$/i.test(c.tagName || c.tag || ""));
      if (heading) heading.textContent = E.locked ? (E.lastOpen > 1 ? "Levels 1 to " + E.lastOpen + " done" : "Level 1 done") : "Range cleared";
      $("range-end-say").textContent = (E.all ? "Every level is done. " : "Every open level is done. ") + "Here is the line that cleared each one.";
      const ul = $("range-end-lines"); clear(ul);
      const motion = !reduced();
      E.waves.forEach((w, i) => {
        const li = el("li", { class: "cleared" + (w.boss ? " boss" : ""), style: "--i:" + i });
        li.appendChild(el("strong", null, w.label + (w.title ? " · " + w.title : "") + (w.line ? ":" : "")));
        const mini = el("div", { class: "mini", role: "img", "aria-label": w.picked.length ? "Jars picked: " + w.picked.join(", ") : "No picture saved for this level" });
        w.jarIds.forEach((id) => mini.appendChild(el("span", { class: "m" + (w.picked.includes(id) ? " on" : "") })));
        li.appendChild(el("span", { class: "mini-cap" }, w.picked.length ? "picked " + w.picked.length + " of " + w.jarIds.length + " jars" : ""));
        li.appendChild(mini);
        if (w.line) { const pre = el("pre", null, ""); fillNoBreak(pre, w.line, /"[^"\n]*"/g); li.appendChild(pre); }
        ul.appendChild(li);
      });
      ul.setAttribute("class", motion ? "rise" : "");
      const more = $("range-end-more");
      setText("range-end-more", E.locked ? (E.nextLesson ? "Lesson " + E.nextLesson + " opens the next levels (" + levelsText(E.nextLevels) + "). In all, " : "") +
        plural(E.locked, "more level opens", "more levels open") + " as you finish more lessons." : "");
      if (E.locked && E.nextLesson && more.appendChild && el) {
        more.appendChild(el("span", null, " "));
        more.appendChild(el("a", { href: "lesson.html?lesson=lesson" + E.nextLesson }, "Go to Lesson " + E.nextLesson));
      }
      $("data-label").hidden = true;
      if (ui.endSig !== "end") {
        ui.endSig = "end";
        if (beaten) sound.play([{ kind: "fanfare", at: 0, k: 0 }]);
      }
    }

    function renderRange(v) {
      mount();
      const R = v.range;
      if (R.end) return renderRangeEnd(R, v);
      ui.endSig = "";
      showOnly("screen-lesson");
      const screen = $("screen-lesson");
      screen.setAttribute("data-mode", "range");
      const boss = !!(R.wave && R.wave.boss);
      screen.setAttribute("data-boss", boss ? "1" : "0");
      const dots = $("dots"); clear(dots);
      R.waves.filter((w) => !w.locked).forEach((w) => dots.appendChild(el("span", { class: "dot" + (w.done ? " on" : ""), role: "img", "aria-label": w.label + (w.done ? ": done" : ": not done yet") })));
      $("line-count").textContent = R.wave ? R.wave.label : "";
      $("clues").hidden = true;
      ["remember", "gloss-explain", "gloss-prompt", "gloss-feedback", "data", "pinned", "dict", "testout", "predict", "guess-line",
        "result-label", "result", "play-note", "clue", "hints", "show-line", "rule", "notes", "starter", "starter-box"].forEach((id) => { $(id).hidden = true; });
      screen.setAttribute("data-warm", "0");
      // The level name: its group and its title, above the big heading.
      const kind = $("kind-label");
      kind.textContent = R.wave ? [R.wave.boss ? "Boss" : R.wave.group, R.wave.title].filter(Boolean).join(" · ") : "";
      kind.hidden = !kind.textContent;
      // The boss has its own banner with its story line.
      clear(ui.boss); ui.boss.hidden = !(boss && R.wave.story);
      if (boss && R.wave.story) {
        ui.boss.appendChild(el("p", { class: "boss-tag" }, "Boss level"));
        ui.boss.appendChild(el("p", { class: "boss-story" }, R.wave.story));
      }
      setText("then-line", R.rule);
      // After a clean level the one filled button is the way on; Run steps back.
      const nx = $("next"); nx.hidden = !R.next; nx.disabled = false; nx.className = "primary";
      if (R.next) { nx.textContent = R.next.label; nx.setAttribute("aria-label", R.next.last ? "Finish the range" : "Go to the next level"); }
      $("right").hidden = false; $("round-title").hidden = false; $("prompt").hidden = false; $("waves").hidden = false;
      $("round-title").textContent = R.title;
      setText("explain", R.goal);
      fillNoBreak($("prompt"), R.wave ? R.wave.label + ": " + R.wave.target : R.idle, /\b[BQT]-\w+/g);
      drawLadder(R);
      setText("locked-line", R.lockedLine);
      const hb = $("wave-hint"); hb.hidden = !(R.wave && R.wave.hint) || !!R.clean;
      // After a clean run the hint has done its work and steps aside, so the win has the room (the boss page stays on one screen).
      const hintOn = !!(R.wave && R.wave.hintOpen && !R.clean);
      hb.setAttribute("aria-expanded", String(hintOn));
      hb.textContent = hintOn ? "Hide the hint" : "Show a hint";
      setText("wave-hint-text", hintOn ? R.wave.hint : "");
      const key = "range:" + (R.wave ? R.wave.id : "");
      if (ctx.getLastKey() !== key) $("code").value = R.code;
      ctx.setLastKey(key);
      $("code").setAttribute("placeholder", "Write a line here.");
      $("code").setAttribute("rows", "2");
      $("run").textContent = "Run"; $("run").setAttribute("aria-label", "Run the code"); $("run").className = R.next ? "quiet" : "primary";
      $("run").disabled = R.pending || !R.wave;
      drawColumns(R);
      paintSound();
      drawBoard(R, boss);
      // A boss win is a bigger moment than a level win: a gold flash on the shelf, a warmer banner, and the fanfare is
      // heard before Finish appears (the page shows Finish when the fanfare has played).
      const bossWin = !!(boss && R.clean && !R.pending);
      const board = $("board");
      if (!bossWin) board.removeAttribute("style");
      board.className = (board.className || "").replace(/\s*\bboss-won\b/g, "").replace(/\s*\bboss-flash\b/g, "") + (bossWin ? " boss-won" + (ui.flashSeq === R.seq ? " boss-flash" : "") : "");
      const held = !!(bossWin && ui.hold && ui.hold.seq === R.seq && !ui.hold.done);
      // Held back with visibility, not `hidden`: the button keeps its place, so nothing jumps when it shows.
      nx.hidden = !R.next;
      if (held) nx.setAttribute("data-held", "1"); else nx.removeAttribute("data-held");
      // A Run that waits more than a second says so, and the jars rest in a slow pulse. It stops with the answer.
      cancel(ui.waitTimer); ui.waitTimer = null;
      if (R.pending) {
        ui.waitTimer = later(() => { ui.waitTimer = null; if (ui.pending) { $("feedback").textContent = "Still running. Julia is working on your line."; $("board").setAttribute("data-waiting", "1"); } }, WAIT_CUE_MS);
      } else $("board").removeAttribute("data-waiting");
      ui.pending = R.pending;
      const fb = $("feedback");
      fb.textContent = R.pending ? "Running..." : R.feedback;
      // Round 6: a boss win opens with a "BOSS BEATEN" kicker above the serif line. The text is the same sentence; the full stop
      // after "Boss beaten" stays for a screen reader and is not drawn.
      if (bossWin && !R.pending && /^Boss beaten\. /.test(R.feedback)) {
        clear(fb);
        const k = el("span", { class: "boss-kicker" }, "Boss beaten");
        k.appendChild(el("span", { class: "boss-dot" }, "."));
        fb.appendChild(k);
        fb.appendChild(el("span", { class: "boss-line" }, R.feedback.slice("Boss beaten.".length)));
      }
      const isLate = !!(R.seq && R.seq === ui.lateSeq && ui.lateMs);
      fb.className = R.tone + (bossWin ? " boss-win" : "");
      if (isLate) { fb.setAttribute("data-late", "1"); fb.setAttribute("style", "--late:" + ui.lateMs + "ms"); } else { fb.removeAttribute("data-late"); fb.removeAttribute("style"); }
      if (R.tone === "alert") fb.setAttribute("role", "alert"); else fb.removeAttribute("role");
      const wt = $("works-too"); wt.textContent = R.nudge; wt.hidden = !R.nudge;
      if (isLate) { wt.setAttribute("data-late", "1"); wt.setAttribute("style", "--late:" + ui.lateMs + "ms"); } else { wt.removeAttribute("data-late"); wt.removeAttribute("style"); }
      const fold = $("julia-msg"); clear(fold); fold.hidden = !R.message;
      if (R.message) {
        const d = el("details");
        d.appendChild(el("summary", null, "Julia's own message")); d.appendChild(el("pre", null, R.message));
        fold.appendChild(d);
      }
      $("data-label").hidden = !v.dataLabel || bossWin; $("data-label").textContent = v.dataLabel;   // the boss win drops the footer line (round 6): Finish stays in the screen
      screen.setAttribute("data-cid", key);
      updateCues([]);
    }

    // The strip above the editor: the table's name and its columns, so a player never has to guess a column name.
    function drawColumns(R) {
      clear(ui.cols);
      ui.cols.hidden = !R.columns.length;
      if (!R.columns.length) return;
      ui.cols.appendChild(el("span", { class: "cols-lead" }, "Columns:"));
      R.columns.forEach((c) => {
        const item = el("span", { class: "col" });
        item.appendChild(el("code", null, c.name));
        if (c.example) item.appendChild(el("span", { class: "col-eg" }, "(" + c.example + ")"));
        ui.cols.appendChild(item);
      });
    }

    // The ladder: each named group in a row, its levels beside it. Open levels are buttons, the rest are dim rungs.
    function drawLadder(R) {
      const list = $("wave-list"); clear(list);
      R.ladder.forEach((g) => {
        const li = el("li", { class: "group" + (g.boss ? " boss" : "") + (g.done ? " done" : "") });
        if (g.title) li.appendChild(el("p", { class: "group-title" }, g.title));
        const rungs = el("div", { class: "rungs" });
        g.levels.forEach((w) => {
          if (w.locked) {
            rungs.appendChild(el("span", { class: "rung locked", "aria-label": w.label + ", " + w.unlockText.toLowerCase() }, w.label));
            return;
          }
          const b = el("button", { type: "button", class: "wave" + (w.boss ? " boss" : "") });
          if (w.selected) b.setAttribute("aria-current", "true");
          b.appendChild(el("span", null, w.label));
          const side = el("span", { class: "wave-side" }, w.done ? "✓" : "");
          if (w.done) side.appendChild(el("span", { class: "sr-only" }, " done"));
          b.appendChild(side);
          b.addEventListener("click", () => ctx.ctrl().selectWave(w.id));
          rungs.appendChild(b);
        });
        li.appendChild(rungs);
        list.appendChild(li);
      });
    }

    // The jars. A run is drawn once, with its timeline; a redraw for any other reason (the hint, the sound button) leaves it alone.
    function drawBoard(R, boss) {
      const board = $("board"); board.hidden = false;
      const ids = (state) => R.tiles.filter((t) => t.state === state).map((t) => t.id);
      const say = (label, list) => (list.length ? label + ": " + list.join(", ") + ". " : "");
      board.setAttribute("aria-label", (R.summary ? R.summary + " " : "") + (R.refused ? "These are the right jars, but the run does not count yet. " : "") +
        say("Ringed jars", ids("target").concat(ids("missed"))) + say("Right jars", ids("hit")) + say("Extra jars", ids("miss")));
      const sig = JSON.stringify([R.wave && R.wave.id, R.seq, R.refused, R.tiles.map((t) => [t.id, t.state, t.again]), R.summary, R.sweep && R.sweep.kept]);
      if (sig === ui.sig && board.firstChild) return;
      ui.sig = sig;
      clear(board);
      const fresh = !!R.sweep && R.seq > ui.animSeq;
      if (R.seq) ui.animSeq = R.seq;
      const flat = [].concat.apply([], R.groups.map((g) => g.tiles));   // the order the jars are drawn in, left to right
      const plan = runPlan(flat, { motion: !reduced() });
      const animate = fresh && plan.animate;
      const wrap = el("div", { class: "rack-wrap" });
      // The legend is the rack's first line and the sweep chip lies over it, so the chip never covers a group label (round 5).
      if (R.groups.some((g) => g.label)) wrap.appendChild(el("p", { class: "range-legend" }, "Jars are grouped by tray \u00b7 batch."));
      const rack = el("div", { class: "rack" + (flat.length > 16 ? " dense" : "") + (animate ? " go" : ""), "aria-hidden": "true" });
      let at = 0;
      R.groups.forEach((g) => {
        const grp = el("div", { class: "grp" });
        if (g.label) grp.appendChild(el("p", { class: "grp-label" }, g.label));
        const row = el("div", { class: "grp-jars" });
        g.tiles.forEach((t) => {
          const p = plan.tiles[at]; at += 1;
          const cls = ["jar"];
          if (t.state) cls.push(t.state);
          if (t.refused) cls.push("refused");
          if (t.again) cls.push("again");
          let css = "";
          if (animate) {
            cls.push(p.keep ? "sw-pass" : "sw-fail");
            css = "--sw:" + p.sweepAt + "ms;--cs:" + (p.cascadeAt === null ? plan.ringAt : p.cascadeAt) + "ms";
          }
          const jar = el("div", css ? { class: cls.join(" "), style: css } : { class: cls.join(" ") });
          jar.appendChild(el("span", { class: "jar-body" }, t.state === "hit" ? "✓" : (t.state === "miss" ? "✗" : "")));
          jar.appendChild(el("span", { class: "jar-id" }, t.id));
          if (t.again) jar.appendChild(el("span", { class: "jar-again" }, "twice"));
          row.appendChild(jar);
        });
        grp.appendChild(row); rack.appendChild(grp);
      });
      wrap.appendChild(rack);
      if (animate) {
        const sw = el("div", { class: "sweeper", "aria-hidden": "true", style: "--sweep:" + plan.sweepMs + "ms" });
        const pill = el("span", { class: "sweeper-line" }, R.sweep.line);
        // The sweep is over when its label has faded; take it out of the page so nothing invisible is left behind.
        pill.addEventListener("animationend", (e) => { if (e && e.animationName && e.animationName !== "jt-label") return; if (sw.parentNode) sw.parentNode.removeChild(sw); });
        sw.appendChild(pill);
        wrap.appendChild(sw);
      }
      board.appendChild(wrap);
      // The words wait for the picture: they fade in as the fills begin.
      const lateAttrs = (cls) => (animate ? { class: cls, "data-late": "1", style: "--late:" + plan.settleMs + "ms" } : { class: cls });
      if (R.summary || R.tableLine) {
        const line = R.summary ? R.summary + (R.clean ? " \u2713" : "") : R.tableLine;
        const p = el("p", lateAttrs("board-summary"));
        // Round 6: on a boss win "5 of 5" is the peak of the line (18 px bold gold, in the stylesheet). The words are the same.
        const m = R.clean && boss ? /^(Right jars: )(\d+ of \d+)([\s\S]*)$/.exec(line) : null;
        if (m) { p.appendChild(el("span", null, m[1])); p.appendChild(el("span", { class: "win-num" }, m[2])); p.appendChild(el("span", null, m[3])); }
        else p.textContent = line;
        board.appendChild(p);
      }
      if (R.sweep) board.appendChild(el("p", lateAttrs("sweep-note"), "Your line kept " + R.sweep.kept + " of " + R.sweep.total + " jars."));
      ui.lateMs = animate ? plan.settleMs : 0; ui.lateSeq = animate ? R.seq : ui.lateSeq;
      if (fresh) {
        const events = plan.audio.slice();
        if (R.clean) events.push({ kind: boss ? "fanfare" : "chime", at: plan.endMs, k: 0 });
        sound.play(events);
        if (R.clean && boss) {
          // Finish waits for the fanfare. The flash starts as the last jar fills.
          ui.hold = { seq: R.seq, done: false };
          ui.flashSeq = animate ? R.seq : null;
          if (animate) board.setAttribute("style", "--flash:" + Math.max(0, plan.endMs - 260) + "ms");
          const hold = ui.hold;
          later(() => { hold.done = true; if (ui.hold === hold) { const nx = $("next"); if (nx) nx.removeAttribute("data-held"); } }, plan.endMs + (sound.isOn() ? FANFARE_MS : 600));
        }
      }
    }

    return { renderRange, sound };
  }

  return { createRangeController, createRangeRenderer, createSound, runPlan, sweepLine, scoreShot, emptyRangeProgress, lessonNumberOf, SOUND_KEY, SWEEP_MS };
});

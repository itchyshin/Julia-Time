// Julia Time — app.js
//
// Plain JS, no build step, no framework. Sections:
//   1. Storage helpers (localStorage)
//   2. WebSocket client
//   3. Page state + DOM wiring (levels list, task stepper, output pane)
//   4. Renderers — window.JuliaTime.render.{bar,rows,deck,gallery,race,none}
//
// Contributors: the renderers in section 4 are the only part levels touch. Everything above is
// plumbing. A renderer is `(canvas, payload, state) => void`; `state` is a plain object you may
// stash per-level data on (e.g. accumulated draws for the bar visual) — the caller keeps one
// `state` object alive per level and hands it back on every call. Set `state.instant = true` to
// skip animation and draw one complete static frame (used by fixtures.html for screenshots).

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. Storage helpers
  // ---------------------------------------------------------------------

  const STORE_KEY = "juliatime.progress";   // {"L1": {"tasks":[true,false,...]}}
  const LAST_LEVEL_KEY = "juliatime.lastLevel";
  const PREDICT_KEY_PREFIX = "juliatime.predict.";  // + level + "." + taskIndex

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(progress));
    } catch (e) {
      // storage unavailable (private browsing, quota) — progress just won't persist
    }
  }

  function markTaskPassed(levelId, taskIndex, numTasks) {
    const progress = loadProgress();
    if (!progress[levelId]) progress[levelId] = { tasks: new Array(numTasks).fill(false) };
    while (progress[levelId].tasks.length < numTasks) progress[levelId].tasks.push(false);
    progress[levelId].tasks[taskIndex] = true;
    saveProgress(progress);
  }

  function levelDone(levelId) {
    const entry = loadProgress()[levelId];
    return !!entry && entry.tasks.length > 0 && entry.tasks.every(Boolean);
  }

  function getLastLevel() {
    try {
      return localStorage.getItem(LAST_LEVEL_KEY) || "L0";
    } catch (e) {
      return "L0";
    }
  }

  function setLastLevel(id) {
    try {
      localStorage.setItem(LAST_LEVEL_KEY, id);
    } catch (e) { /* ignore */ }
  }

  function predictKey(levelId, taskIndex) {
    return PREDICT_KEY_PREFIX + levelId + "." + taskIndex;
  }

  function loadPredict(levelId, taskIndex) {
    try {
      return localStorage.getItem(predictKey(levelId, taskIndex)) || "";
    } catch (e) {
      return "";
    }
  }

  function savePredict(levelId, taskIndex, text) {
    try {
      localStorage.setItem(predictKey(levelId, taskIndex), text);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------
  // 2. WebSocket client
  // ---------------------------------------------------------------------

  // Only wired up when index.html is loaded (fixtures.html does not open a socket).
  function createClient(onMessage, onStatusChange) {
    let ws = null;
    let status = "connecting";
    let retryTimer = null;

    function setStatus(s) {
      status = s;
      onStatusChange(s);
    }

    function connect() {
      setStatus("connecting");
      ws = new WebSocket("ws://" + location.host + "/ws");
      ws.addEventListener("open", () => {
        setStatus("connected");
        send({ type: "levels" });
      });
      ws.addEventListener("message", (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        onMessage(msg);
      });
      ws.addEventListener("close", () => {
        setStatus("disconnected");
        retryTimer = setTimeout(connect, 2000);
      });
      ws.addEventListener("error", () => {
        // "close" fires right after in browsers; nothing extra to do here
      });
    }

    function send(obj) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
      }
    }

    connect();

    return {
      send,
      isConnected: () => status === "connected",
      stop: () => { if (retryTimer) clearTimeout(retryTimer); if (ws) ws.close(); },
    };
  }

  // ---------------------------------------------------------------------
  // 3. Page state + DOM wiring — only runs when index.html's #app is present
  // ---------------------------------------------------------------------

  function initApp() {
    const el = {
      status: document.getElementById("status"),
      statusDot: document.getElementById("status-dot"),
      statusText: document.getElementById("status-text"),
      levels: document.getElementById("levels-list"),
      title: document.getElementById("level-title"),
      castLine: document.getElementById("cast-line"),
      bridge: document.getElementById("bridge-table"),
      preamble: document.getElementById("preamble"),
      taskHeader: document.getElementById("task-header"),
      taskPrompt: document.getElementById("task-prompt"),
      predict: document.getElementById("predict"),
      code: document.getElementById("code"),
      run: document.getElementById("run"),
      prevTask: document.getElementById("prev-task"),
      nextTask: document.getElementById("next-task"),
      runningNote: document.getElementById("running-note"),
      output: document.getElementById("output"),
      canvas: document.getElementById("visual"),
      dataLabel: document.getElementById("data-label"),
      ungradedNext: document.getElementById("ungraded-next"),
    };

    const app = {
      levels: [],             // [{id,title,ungraded}]
      currentLevelId: getLastLevel(),
      currentLevel: null,     // full level payload from server
      currentTask: 0,
      running: false,
      visualState: {},        // per-level accumulated state, keyed by level id
    };

    function setStatus(s) {
      el.statusDot.className = "dot " + s;
      el.statusText.textContent = s;
      el.run.disabled = s !== "connected" || app.running;
    }

    const client = createClient(handleServerMessage, setStatus);

    function handleServerMessage(msg) {
      if (msg.type === "levels") {
        app.levels = msg.levels || [];
        renderLevelList();
        client.send({ type: "level_info", level: app.currentLevelId });
      } else if (msg.type === "level") {
        app.currentLevel = msg;
        app.currentTask = 0;
        if (!app.visualState[msg.id]) app.visualState[msg.id] = {};
        setLastLevel(msg.id);
        renderLevelList();
        renderLevel();
      } else if (msg.type === "result") {
        app.running = false;
        el.run.disabled = !client.isConnected();
        el.runningNote.textContent = "";
        renderResult(msg);
      } else if (msg.type === "error") {
        app.running = false;
        el.run.disabled = !client.isConnected();
        el.runningNote.textContent = "";
        renderError(msg.message || "The server reported an error.");
      } else if (msg.type === "pong") {
        // no-op
      }
    }

    function renderError(text) {
      el.output.innerHTML = "";
      const msgDiv = document.createElement("div");
      msgDiv.className = "message error";
      msgDiv.textContent = text;
      el.output.appendChild(msgDiv);
    }

    function renderLevelList() {
      el.levels.innerHTML = "";
      app.levels.forEach((lvl) => {
        const item = document.createElement("div");
        item.className = "level-item" + (lvl.id === app.currentLevelId ? " current" : "");
        const idSpan = document.createElement("span");
        idSpan.className = "id";
        idSpan.textContent = lvl.id;
        const titleSpan = document.createElement("span");
        titleSpan.textContent = lvl.title;
        item.appendChild(idSpan);
        item.appendChild(titleSpan);
        if (levelDone(lvl.id)) {
          const mark = document.createElement("span");
          mark.className = "done-mark";
          mark.textContent = "done";
          item.appendChild(mark);
        }
        item.addEventListener("click", () => {
          app.currentLevelId = lvl.id;
          client.send({ type: "level_info", level: lvl.id });
        });
        el.levels.appendChild(item);
      });
    }

    function renderLevel() {
      const lvl = app.currentLevel;
      el.title.textContent = lvl.title || lvl.id;
      el.castLine.textContent = lvl.cast_line || "";
      el.castLine.style.display = lvl.cast_line ? "" : "none";

      el.bridge.innerHTML = "";
      if (lvl.bridge) {
        [["julia", "Julia"], ["r", "R"], ["python", "Python"]].forEach(([key, label]) => {
          const tr = document.createElement("tr");
          if (key === "julia") tr.className = "julia";
          const td1 = document.createElement("td");
          td1.className = "lang";
          td1.textContent = label;
          const td2 = document.createElement("td");
          td2.textContent = lvl.bridge[key] || "";
          tr.appendChild(td1);
          tr.appendChild(td2);
          el.bridge.appendChild(tr);
        });
      }

      if (lvl.preamble) {
        el.preamble.textContent = lvl.preamble;
        el.preamble.style.display = "";
      } else {
        el.preamble.style.display = "none";
      }

      el.output.innerHTML = "";
      clearCanvas();

      if (!lvl.tasks || lvl.tasks.length === 0) {
        // ungraded screen
        el.taskHeader.style.display = "none";
        el.taskPrompt.style.display = "none";
        document.getElementById("predict-field").style.display = "none";
        document.getElementById("code-field").style.display = "none";
        document.getElementById("task-controls").style.display = "none";
        el.ungradedNext.style.display = "";
      } else {
        el.taskHeader.style.display = "";
        el.taskPrompt.style.display = "";
        document.getElementById("predict-field").style.display = "";
        document.getElementById("code-field").style.display = "";
        document.getElementById("task-controls").style.display = "";
        el.ungradedNext.style.display = "none";
        renderTask();
      }

      if (lvl.data_label && lvl.visual === "rows") {
        el.dataLabel.textContent = lvl.data_label;
        el.dataLabel.style.display = "";
      } else {
        el.dataLabel.style.display = "none";
      }
    }

    function renderTask() {
      const lvl = app.currentLevel;
      const task = lvl.tasks[app.currentTask];
      if (!task) return;
      el.taskHeader.textContent = "Task " + (app.currentTask + 1) + " of " + lvl.tasks.length + " · " + task.kind;
      el.taskPrompt.textContent = task.prompt || "";
      el.predict.value = loadPredict(lvl.id, app.currentTask);
      el.code.value = task.starter || "";
      el.prevTask.disabled = app.currentTask === 0;
      el.nextTask.disabled = app.currentTask >= lvl.tasks.length - 1;
      el.output.innerHTML = "";
    }

    function renderResult(msg) {
      el.output.innerHTML = "";
      if (msg.value_repr) {
        const v = document.createElement("div");
        v.className = "value-repr";
        v.textContent = msg.value_repr;
        el.output.appendChild(v);
      }
      if (msg.stdout) {
        const s = document.createElement("div");
        s.className = "stdout";
        s.textContent = msg.stdout;
        el.output.appendChild(s);
      }
      if (msg.message) {
        const m = document.createElement("div");
        m.className = "message" + (msg.status === "error" || msg.status === "timeout" ? " error" : "");
        m.textContent = msg.message;
        el.output.appendChild(m);
      }
      if (msg.feedback) {
        const f = document.createElement("div");
        f.className = "feedback " + (msg.pass ? "pass" : "fail");
        f.textContent = msg.feedback;
        el.output.appendChild(f);
      }

      if (msg.pass === true && app.currentLevel && app.currentLevel.tasks) {
        markTaskPassed(app.currentLevel.id, app.currentTask, app.currentLevel.tasks.length);
        el.nextTask.disabled = app.currentTask >= app.currentLevel.tasks.length - 1;
        renderLevelList();
      }

      if (msg.payload && app.currentLevel) {
        const state = app.visualState[app.currentLevel.id] || (app.visualState[app.currentLevel.id] = {});
        const renderer = window.JuliaTime.render[app.currentLevel.visual || "none"];
        if (renderer) renderer(el.canvas, msg.payload, state);
      }
    }

    function clearCanvas() {
      const ctx = el.canvas.getContext("2d");
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    }

    function runCode() {
      if (!client.isConnected() || app.running) return;
      if (!app.currentLevel || !app.currentLevel.tasks || app.currentLevel.tasks.length === 0) return;
      app.running = true;
      el.run.disabled = true;
      el.runningNote.textContent = "Running…";
      client.send({
        type: "run",
        level: app.currentLevel.id,
        task: app.currentTask + 1,
        code: el.code.value,
      });
    }

    el.run.addEventListener("click", runCode);
    el.code.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.ctrlKey) runCode();
    });
    el.predict.addEventListener("input", () => {
      if (app.currentLevel) savePredict(app.currentLevel.id, app.currentTask, el.predict.value);
    });
    el.prevTask.addEventListener("click", () => {
      if (app.currentTask > 0) { app.currentTask -= 1; renderTask(); }
    });
    el.nextTask.addEventListener("click", () => {
      if (app.currentLevel && app.currentTask < app.currentLevel.tasks.length - 1) {
        app.currentTask += 1;
        renderTask();
      }
    });
    el.ungradedNext.addEventListener("click", () => {
      const idx = app.levels.findIndex((l) => l.id === app.currentLevelId);
      if (idx >= 0 && idx < app.levels.length - 1) {
        const next = app.levels[idx + 1];
        app.currentLevelId = next.id;
        client.send({ type: "level_info", level: next.id });
      }
    });

    setStatus("connecting");
  }

  // ---------------------------------------------------------------------
  // 4. Renderers
  // ---------------------------------------------------------------------

  function ctx2d(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  }

  const COLOR_INK = "#1f2a2e";
  const COLOR_ACCENT = "#2b6e6e";
  const COLOR_SOFT = "#d9ecec";
  const COLOR_LINE = "#d8dcd8";

  // -- bar: balls dropping into a tank that fills; running count + mean --
  function renderBar(canvas, payload, state) {
    if (!state.draws) state.draws = [];
    state.draws = state.draws.concat(payload.draws || []);
    const draws = state.draws;
    const ctx = ctx2d(canvas);
    const w = canvas.width, h = canvas.height;

    const tankX = 40, tankY = 20, tankW = w - 80, tankH = h - 80;
    ctx.strokeStyle = COLOR_LINE;
    ctx.strokeRect(tankX, tankY, tankW, tankH);

    const n = draws.length;
    const fillH = Math.min(1, n / 40) * tankH; // fills up over ~40 draws
    ctx.fillStyle = COLOR_SOFT;
    ctx.fillRect(tankX, tankY + tankH - fillH, tankW, fillH);

    // balls: place each draw's value as x-position inside the tank width, stacked by arrival
    ctx.fillStyle = COLOR_ACCENT;
    draws.forEach((v, i) => {
      const bx = tankX + v * tankW;
      const by = tankY + tankH - (fillH * (i + 1)) / Math.max(n, 1);
      ctx.beginPath();
      ctx.arc(bx, Math.max(tankY + 6, by), 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const mean = n > 0 ? draws.reduce((a, b) => a + b, 0) / n : 0;
    ctx.fillStyle = COLOR_INK;
    ctx.font = "13px sans-serif";
    ctx.fillText("count: " + n + "   mean: " + mean.toFixed(3), tankX, h - 20);
  }

  // -- rows: rows rain down; kept land in a tray; summary bars + door if present --
  function renderRows(canvas, payload, state) {
    const ctx = ctx2d(canvas);
    const w = canvas.width, h = canvas.height;
    const rows = payload.rows || [];
    const kept = rows.filter((r) => r.kept);
    const dropped = rows.filter((r) => !r.kept);

    const trayY = payload.summary ? h - 160 : h - 40;
    ctx.strokeStyle = COLOR_LINE;
    ctx.strokeRect(20, trayY - 4, w - 40, 24);

    // kept rows as small chips in the tray
    ctx.fillStyle = COLOR_ACCENT;
    kept.slice(0, 60).forEach((r, i) => {
      const x = 24 + (i % 40) * ((w - 48) / 40);
      ctx.fillRect(x, trayY, 6, 14);
    });

    // dropped rows shown faded above, falling off the bottom edge (static snapshot)
    ctx.fillStyle = "#c7cfd0";
    dropped.slice(0, 60).forEach((r, i) => {
      const x = 24 + (i % 40) * ((w - 48) / 40);
      ctx.fillRect(x, 20 + (i % 6) * 8, 6, 6);
    });

    ctx.fillStyle = COLOR_INK;
    ctx.font = "12px sans-serif";
    ctx.fillText("kept: " + kept.length + " / " + rows.length, 20, trayY + 40);

    if (payload.summary) {
      const baseY = h - 30;
      const barW = 50;
      const maxVal = Math.max(1, ...payload.summary.map((s) => s.value));
      payload.summary.forEach((s, i) => {
        const x = 30 + i * (barW + 20);
        const bh = (s.value / maxVal) * 80;
        ctx.fillStyle = COLOR_SOFT;
        ctx.fillRect(x, baseY - bh, barW, bh);
        ctx.strokeStyle = COLOR_ACCENT;
        ctx.strokeRect(x, baseY - bh, barW, bh);
        ctx.fillStyle = COLOR_INK;
        ctx.fillText(s.pond, x, baseY + 14);
        ctx.fillText(String(s.value), x, baseY - bh - 4);
      });

      // door indicator
      const doorState = payload.door || "closed";
      const doorX = w - 70, doorY = h - 110, doorW = 40, doorH = 70;
      ctx.strokeStyle = COLOR_INK;
      ctx.strokeRect(doorX, doorY, doorW, doorH);
      ctx.fillStyle = COLOR_ACCENT;
      const openFrac = doorState === "open" ? 1 : doorState === "ajar" ? 0.4 : 0;
      ctx.fillRect(doorX, doorY, doorW * openFrac, doorH);
      ctx.fillStyle = COLOR_INK;
      ctx.font = "11px sans-serif";
      ctx.fillText(doorState, doorX - 6, doorY + doorH + 14);
    }
  }

  // -- deck: hands dealt face up as text cards; optional dial with estimate vs truth --
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = ["♠", "♥", "♦", "♣"]; // spade heart diamond club

  function cardLabel(id) {
    const zero = id - 1;
    const rank = RANKS[zero % 13];
    const suit = SUITS[Math.floor(zero / 13)];
    return rank + suit;
  }

  function renderDeck(canvas, payload, state) {
    const ctx = ctx2d(canvas);
    const w = canvas.width;
    const hands = payload.hands || [];
    const cardW = 34, cardH = 48, gap = 6;

    hands.forEach((hand, row) => {
      hand.forEach((id, col) => {
        const x = 20 + col * (cardW + gap);
        const y = 20 + row * (cardH + 10);
        ctx.strokeStyle = COLOR_LINE;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeRect(x, y, cardW, cardH);
        const label = cardLabel(id);
        const isRed = label.indexOf("♥") >= 0 || label.indexOf("♦") >= 0;
        ctx.fillStyle = isRed ? "#a3352b" : COLOR_INK;
        ctx.font = "12px sans-serif";
        ctx.fillText(label, x + 4, y + 18);
      });
    });

    if (payload.estimate !== null && payload.estimate !== undefined) {
      const dialX = w - 90, dialY = 30, r = 40;
      ctx.strokeStyle = COLOR_LINE;
      ctx.beginPath();
      ctx.arc(dialX, dialY, r, Math.PI, 0);
      ctx.stroke();

      function needle(value, color) {
        const angle = Math.PI + value * Math.PI; // 0..1 across the semicircle
        const nx = dialX + r * Math.cos(angle);
        const ny = dialY + r * Math.sin(angle);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(dialX, dialY);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
      needle(payload.truth, "#c9c9c9");
      needle(payload.estimate, COLOR_ACCENT);

      ctx.fillStyle = COLOR_INK;
      ctx.font = "11px sans-serif";
      ctx.fillText("estimate " + payload.estimate.toFixed(2), dialX - 40, dialY + 24);
    }
  }

  // -- gallery: target shape (translucent) + shots histogram (solid) on the same axes --
  function normalPdf(x, mu, sigma) {
    return Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI));
  }
  function factorial(k) {
    let r = 1;
    for (let i = 2; i <= k; i++) r *= i;
    return r;
  }
  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  }
  function binomialPmf(k, n, p) {
    return choose(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  }
  function poissonPmf(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
  }

  function renderGallery(canvas, payload, state) {
    const ctx = ctx2d(canvas);
    const w = canvas.width, h = canvas.height;
    const shots = payload.shots || [];
    const target = payload.target || { kind: "Normal", params: [0, 1] };
    const plotX = 30, plotW = w - 60, plotY = 20, plotH = h - 60;

    const isDiscrete = target.kind === "Binomial" || target.kind === "Poisson";
    const lo = Math.min(0, ...shots, isDiscrete ? 0 : -4);
    const hi = Math.max(...shots, isDiscrete ? (target.params[0] || 10) : 4, 1);

    const bins = isDiscrete ? Math.max(1, Math.ceil(hi) - Math.floor(lo) + 1) : 30;
    const binW = plotW / bins;

    function xToPix(x) {
      return plotX + ((x - lo) / (hi - lo || 1)) * plotW;
    }

    // target shape (translucent fill)
    ctx.fillStyle = "rgba(43,110,110,0.18)";
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    const steps = 100;
    let maxTargetY = 0;
    const targetVals = [];
    for (let i = 0; i <= steps; i++) {
      const x = lo + ((hi - lo) * i) / steps;
      let y;
      if (target.kind === "Normal") {
        y = normalPdf(x, target.params[0], target.params[1]);
      } else if (target.kind === "Binomial") {
        y = binomialPmf(Math.round(x), target.params[0], target.params[1]);
      } else if (target.kind === "Poisson") {
        y = poissonPmf(Math.round(x), target.params[0]);
      } else {
        y = 0;
      }
      targetVals.push(y);
      maxTargetY = Math.max(maxTargetY, y);
    }
    for (let i = 0; i <= steps; i++) {
      const x = lo + ((hi - lo) * i) / steps;
      const py = plotY + plotH - (targetVals[i] / (maxTargetY || 1)) * plotH * 0.9;
      ctx.lineTo(xToPix(x), py);
    }
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.closePath();
    ctx.fill();

    // shots histogram (solid bars)
    const counts = new Array(bins).fill(0);
    shots.forEach((v) => {
      let idx = Math.floor(((v - lo) / (hi - lo || 1)) * bins);
      idx = Math.max(0, Math.min(bins - 1, idx));
      counts[idx] += 1;
    });
    const maxCount = Math.max(1, ...counts);
    ctx.fillStyle = COLOR_ACCENT;
    counts.forEach((c, i) => {
      const barH = (c / maxCount) * plotH * 0.9;
      ctx.fillRect(plotX + i * binW + 1, plotY + plotH - barH, Math.max(1, binW - 2), barH);
    });

    ctx.strokeStyle = COLOR_LINE;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    ctx.fillStyle = COLOR_INK;
    ctx.font = "13px sans-serif";
    ctx.fillText("overlap " + Math.round((payload.overlap || 0) * 100) + "%", plotX, h - 8);
  }

  // -- race: a stopwatch-style bar per language; null shows "not measured yet" --
  function renderRace(canvas, payload, state) {
    const ctx = ctx2d(canvas);
    const w = canvas.width, h = canvas.height;
    const rows = [
      ["Julia", payload.julia_ms],
      ["R", payload.r_ms],
      ["Python", payload.python_ms],
    ];
    const values = rows.map((r) => r[1]).filter((v) => v !== null && v !== undefined);
    const maxMs = Math.max(1, ...values);
    const barX = 90, barMaxW = w - 130, rowH = 40;

    rows.forEach(([label, ms], i) => {
      const y = 20 + i * rowH;
      ctx.fillStyle = COLOR_INK;
      ctx.font = "13px sans-serif";
      ctx.fillText(label, 10, y + 16);
      ctx.strokeStyle = COLOR_LINE;
      ctx.strokeRect(barX, y, barMaxW, 20);
      if (ms === null || ms === undefined) {
        ctx.fillStyle = "#9aa5a5";
        ctx.font = "12px sans-serif";
        ctx.fillText("not measured yet", barX + 6, y + 15);
      } else {
        // scale to 80% of the track so the longest bar still leaves room for its own label
        const bw = (ms / maxMs) * barMaxW * 0.8;
        ctx.fillStyle = COLOR_ACCENT;
        ctx.fillRect(barX, y, bw, 20);
        ctx.fillStyle = COLOR_INK;
        ctx.fillText(ms.toFixed(1) + " ms", barX + bw + 6, y + 15);
      }
    });

    if (payload.note) {
      ctx.fillStyle = "#5b6a70";
      ctx.font = "11px sans-serif";
      ctx.fillText(payload.note, 10, h - 10);
    }
  }

  function renderNone(canvas, payload, state) {
    ctx2d(canvas); // just clears
  }

  window.JuliaTime = {
    render: {
      bar: renderBar,
      rows: renderRows,
      deck: renderDeck,
      gallery: renderGallery,
      race: renderRace,
      none: renderNone,
    },
  };

  // Only wire the full app when index.html's markup is present (fixtures.html has no #app).
  if (document.getElementById("app")) {
    document.addEventListener("DOMContentLoaded", initApp);
  }
})();

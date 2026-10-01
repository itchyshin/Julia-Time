/* Board controller for a fresh, story-only Julia readiness check. */
(function (root) {
  "use strict";

  function text(node, value) {
    if (node) node.textContent = value || "";
  }

  function init() {
    const client = root.JuliaTimeSetupStatusClient;
    if (!client || !root.document) return;
    const CONNECT_TIMEOUT_MS = 5000;
    // Julia answers the readiness check only once its first-launch warm-up is over; that can take longer
    // than reaching the socket, and it must read "starting", never "not connected".
    const STATUS_TIMEOUT_MS = 30000;
    // Round 4 (R3-21): plain words that name the two launcher files and say what to click, no technical words.
    const LAUNCHERS = "Play-Julia-Time-Mac.command (Mac) or Play-Julia-Time-Windows (Windows)";
    const NOT_RUNNING = "Julia is not running yet. In the folder you downloaded, double-click " + LAUNCHERS + ". Wait until its window says Julia Time is running, then press Reconnect.";
    const FROM_FILE = "This page was opened as a file, so Julia cannot answer it. Close this page, then in the folder you downloaded double-click " + LAUNCHERS + "; it opens the game in your browser for you.";
    // What to do for each reason Julia gives, in plain words. An unknown reason keeps the server's own sentence.
    function plainProblem(story) {
      if (!story) return "";
      if (story.reason === "JULIA_UNSUPPORTED") return "Julia Time needs Julia version 1.10, and this computer has version " + story.version + ". Install Julia 1.10 from julialang.org, close the Julia Time window, double-click " + LAUNCHERS + " again, then press Reconnect.";
      if (story.reason === "JULIA_SANDBOX_FAILED") return "Julia started but did not answer a test question. Close the Julia Time window, double-click " + LAUNCHERS + " again, then press Reconnect. If it still fails, tell whoever gave you Julia Time the code JULIA_SANDBOX_FAILED.";
      return story.next_action;
    }
    const SAFE_WORK = "Your saved work is safe on this computer. Start Julia Time to play again, then press Reconnect.";

    const panel = document.getElementById("setup-readiness");
    const status = document.getElementById("setup-status");
    const recheck = document.getElementById("setup-recheck");
    const reconnect = document.getElementById("setup-reconnect");
    const version = document.getElementById("setup-version");
    const checkedAt = document.getElementById("setup-checked-at");
    const reason = document.getElementById("setup-reason");
    const continueAction = document.getElementById("continue-action");
    if (!panel || !status || !recheck || !reconnect || !version || !checkedAt || !reason || !continueAction) return;

    const openedFromFile = root.location && root.location.protocol === "file:";
    let state = client.createState();
    let socket = null;
    // True from the first paint: until the socket opens, answers, or fails, Julia is "starting", never "not ready".
    let awaitingPong = !openedFromFile;
    let transportNotice = "";
    let requestSequence = 0;
    let connectionTimer = null;
    let failed = false;

    function nextRequestId() {
      requestSequence += 1;
      return "setup-" + Date.now().toString(36) + "-" + requestSequence;
    }

    function socketIsOpen() {
      return Boolean(socket && root.WebSocket && socket.readyState === root.WebSocket.OPEN);
    }

    function clearConnectionTimer() {
      if (connectionTimer === null) return;
      root.clearTimeout(connectionTimer);
      connectionTimer = null;
    }

    function settleConnectionFailure(candidate, message) {
      if (candidate && socket !== candidate) return;
      clearConnectionTimer();
      if (candidate) socket = null;
      awaitingPong = false;
      state = client.disconnect(state);
      transportNotice = message;
      render();
    }

    function armConnectionTimer(candidate, limit) {
      clearConnectionTimer();
      connectionTimer = root.setTimeout(function () {
        if (socket !== candidate) return;
        socket = null;
        try { candidate.close(); } catch (_) {}
        settleConnectionFailure(null, "The local Julia lab did not answer. Start the supplied Julia Time launcher, then click Reconnect to Julia.");
      }, limit || CONNECT_TIMEOUT_MS);
    }

    function render() {
      const view = client.viewModel(state);
      const story = view.story;
      const starting = state.phase === "checking" || awaitingPong;
      const readyForStory = client.canStartStory(state);
      const message = openedFromFile
        ? FROM_FILE
        : transportNotice || (awaitingPong ? "Connecting to the local Julia lab… This usually takes a few seconds." : (view.phase === "needs_attention" && plainProblem(story)) || view.message);

      text(status, message);
      panel.setAttribute("aria-busy", starting ? "true" : "false");
      panel.dataset.state = view.phase;
      recheck.disabled = openedFromFile || awaitingPong || !client.canRun(state);
      failed = !readyForStory && !starting;
      reconnect.hidden = openedFromFile || !failed;

      // Start stays a normal link while Julia is starting: a slow first launch must not look broken.
      // It is held back only after a real failure, and then it points at the one line under it.
      continueAction.setAttribute("aria-disabled", failed ? "true" : "false");
      // Julia's connection/readiness status is reported in #julia-line; this link's own
      // name always stays the computed next-move label so its accessible name never drifts
      // from its visible text (see docs/dev-log/playtest/2026-09-12-agent-fresh-eyes-session.md).
      const readyLabel = continueAction.dataset.readyLabel || "Start Lesson 1";
      text(continueAction, readyLabel);

      // One Julia status on the page: this line. The fold below holds the technical detail only.
      const allDone = continueAction.dataset.kind === "ending";
      const line = readyForStory ? "Julia is ready."
        : starting ? "Julia is starting… the first time takes a few seconds."
        : openedFromFile ? message
        : state.connection === "connected" && view.phase === "needs_attention" ? "Julia is running but not ready. " + message
        : allDone ? SAFE_WORK : NOT_RUNNING;
      const lineNode = document.getElementById("julia-line");
      text(lineNode, line);
      const lineState = readyForStory ? "ready" : starting ? "starting" : "failed";
      if (lineNode) lineNode.dataset.state = lineState;
      // A real problem is a boxed notice ABOVE the Start button, with Reconnect and a help link inside it; Start is greyed (CSS,
      // from aria-disabled). When Julia is fine or starting, the line goes back under the button, as before.
      const row = lineNode && lineNode.parentNode, helpLink = document.getElementById("julia-help");
      if (row && row.parentNode && row.parentNode.insertBefore && continueAction.parentNode === row.parentNode) {
        row.dataset.state = lineState;
        if (lineState === "failed") row.parentNode.insertBefore(row, continueAction);
        else row.parentNode.insertBefore(row, continueAction.nextSibling);
      }
      if (helpLink) helpLink.hidden = lineState !== "failed";
      // Round 5: Start is held back, so say so inside the notice; and make room so notice, Reconnect and Start fit one screen.
      const startOff = document.getElementById("julia-start-off");
      if (startOff) startOff.hidden = lineState !== "failed";
      const heroNode = document.getElementById("board-hero");
      if (heroNode && heroNode.dataset) { if (lineState === "failed") heroNode.dataset.julia = "problem"; else delete heroNode.dataset.julia; }

      text(version, story ? story.version : "Not checked yet");
      text(checkedAt, story ? story.checked_at : "Not checked yet");
      text(reason, story ? story.reason : "Not checked yet");
    }

    function requestStoryStatus() {
      if (!socketIsOpen()) {
        settleConnectionFailure(null, "Disconnected. This check is no longer current. Your saved browser work is still here. Reconnect to check Julia.");
        return;
      }

      const started = client.beginStoryCheck(state, nextRequestId());
      state = started.state;
      transportNotice = "";
      render();
      if (!started.message) return;

      try {
        socket.send(JSON.stringify(started.message));
        armConnectionTimer(socket, STATUS_TIMEOUT_MS);
      } catch (_) {
        settleConnectionFailure(null, "Disconnected. This check is no longer current. Your saved browser work is still here. Reconnect to check Julia.");
      }
    }

    // The socket goes to the same host and port as this page, so a player who types localhost and one who
    // types 127.0.0.1 both reach the running game (the old fixed 127.0.0.1 gave localhost a false alarm).
    function endpoint() {
      const loc = root.location || {};
      return (loc.protocol === "https:" ? "wss://" : "ws://") + (loc.host || "127.0.0.1:8000") + "/ws";
    }

    function connect() {
      if (openedFromFile) {
        state = client.disconnect(state);
        awaitingPong = false;
        transportNotice = "";
        render();
        return;
      }
      if (!root.WebSocket) {
        state = client.disconnect(state);
        awaitingPong = false;
        transportNotice = "This browser cannot connect to the local Julia lab. Open the supplied launcher in a supported browser.";
        render();
        return;
      }

      const previous = socket;
      socket = null;
      clearConnectionTimer();
      if (previous) {
        try { previous.close(); } catch (_) {}
      }

      state = client.disconnect(state);
      awaitingPong = true;
      transportNotice = "";
      render();

      let candidate;
      try {
        candidate = new root.WebSocket(endpoint());
      } catch (_) {
        settleConnectionFailure(null, "Could not open the local Julia lab. Start the supplied Julia Time launcher, then try reconnecting.");
        return;
      }
      socket = candidate;
      armConnectionTimer(candidate);

      candidate.addEventListener("open", function () {
        if (socket !== candidate) return;
        state = client.connect(state);
        awaitingPong = true;
        transportNotice = "";
        render();
        try {
          candidate.send(JSON.stringify({type:"ping"}));
        } catch (_) {
          candidate.close();
        }
      });

      candidate.addEventListener("message", function (event) {
        if (socket !== candidate) return;
        let reply;
        try { reply = JSON.parse(String(event.data)); } catch (_) { return; }
        if (reply && reply.type === "pong" && awaitingPong) {
          awaitingPong = false;
          clearConnectionTimer();
          requestStoryStatus();
          return;
        }
        if (!reply || reply.type === "setup_status") {
          clearConnectionTimer();
          const pendingId = state.pendingRequestId;
          const next = client.receiveStoryReply(state, reply);
          if (next === state && reply && reply.request_id === pendingId) {
            state = client.connect(state);
            transportNotice = "The Julia readiness reply could not be used. Press Reconnect.";
          } else {
            state = next;
            transportNotice = "";
          }
          render();
          return;
        }
        if (reply.type === "error") {
          clearConnectionTimer();
          state = client.connect(state);
          transportNotice = "Julia could not start this readiness check. Press Reconnect.";
          render();
        }
      });

      candidate.addEventListener("error", function () {
        if (socket !== candidate) return;
        settleConnectionFailure(candidate, "Julia is not running. Start the supplied Julia Time launcher, then press Reconnect.");
      });

      candidate.addEventListener("close", function () {
        if (socket !== candidate) return;
        settleConnectionFailure(candidate, "Disconnected. This check is no longer current. Your saved browser work is still here. Reconnect to check Julia.");
      });
    }

    recheck.addEventListener("click", requestStoryStatus);
    reconnect.addEventListener("click", connect);
    continueAction.addEventListener("click", function (event) {
      if (!failed) return;
      event.preventDefault();
      const line = document.getElementById("julia-line");
      if (line) { line.setAttribute("tabindex", "-1"); line.focus(); }
    });

    root.addEventListener("beforeunload", function () {
      if (socket) {
        const current = socket;
        socket = null;
        clearConnectionTimer();
        try { current.close(); } catch (_) {}
      }
    });

    render();
    connect();
  }

  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : null);

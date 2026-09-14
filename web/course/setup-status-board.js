/* Case Board controller for a fresh, story-only Julia readiness check. */
(function (root) {
  "use strict";

  function text(node, value) {
    if (node) node.textContent = value || "";
  }

  function init() {
    const client = root.JuliaTimeSetupStatusClient;
    if (!client || !root.document) return;
    const CONNECT_TIMEOUT_MS = 5000;

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
    let awaitingPong = false;
    let transportNotice = "";
    let requestSequence = 0;
    let connectionTimer = null;

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

    function armConnectionTimer(candidate) {
      clearConnectionTimer();
      connectionTimer = root.setTimeout(function () {
        if (socket !== candidate) return;
        socket = null;
        try { candidate.close(); } catch (_) {}
        settleConnectionFailure(null, "The local Julia lab did not answer. Start the supplied Julia Time launcher, then click Reconnect to Julia.");
      }, CONNECT_TIMEOUT_MS);
    }

    function render() {
      const view = client.viewModel(state);
      const story = view.story;
      const message = openedFromFile
        ? "This page was opened from a file. Start the supplied Julia Time launcher, then open http://127.0.0.1:8000/."
        : transportNotice || (awaitingPong ? "Connecting to the local Julia lab…" : view.message);

      text(status, message);
      panel.setAttribute("aria-busy", state.phase === "checking" ? "true" : "false");
      panel.dataset.state = view.phase;
      recheck.disabled = openedFromFile || awaitingPong || !client.canRun(state);
      reconnect.hidden = openedFromFile || awaitingPong || state.connection !== "disconnected";

      const readyForStory = client.canStartStory(state);
      continueAction.setAttribute("aria-disabled", readyForStory ? "false" : "true");
      // Julia's connection/readiness status is reported in #setup-status; this link's own
      // name always stays the computed next-move label so its accessible name never drifts
      // from its visible text (see docs/dev-log/playtest/2026-09-12-agent-fresh-eyes-session.md).
      const readyLabel = continueAction.dataset.readyLabel || "Start Chapter 1 →";
      text(continueAction, readyLabel);

      text(version, story ? story.version : "Not checked yet");
      text(checkedAt, story ? story.checked_at : "Not checked yet");
      text(reason, story ? story.reason : "Not checked yet");
    }

    function requestStoryStatus() {
      if (!socketIsOpen()) {
        settleConnectionFailure(null, "Disconnected — this check is no longer current. Your saved browser work is still here. Reconnect to check Julia.");
        return;
      }

      const started = client.beginStoryCheck(state, nextRequestId());
      state = started.state;
      transportNotice = "";
      render();
      if (!started.message) return;

      try {
        socket.send(JSON.stringify(started.message));
        armConnectionTimer(socket);
      } catch (_) {
        settleConnectionFailure(null, "Disconnected — this check is no longer current. Your saved browser work is still here. Reconnect to check Julia.");
      }
    }

    function endpoint() {
      const port = root.location && root.location.port ? root.location.port : "8000";
      return "ws://127.0.0.1:" + port + "/ws";
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
            transportNotice = "The Julia readiness reply could not be used. Check Julia again.";
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
          transportNotice = "Julia could not start this readiness check. Check Julia again.";
          render();
        }
      });

      candidate.addEventListener("error", function () {
        if (socket !== candidate) return;
        settleConnectionFailure(candidate, "The local Julia lab connection failed. Start the supplied Julia Time launcher, then click Reconnect to Julia.");
      });

      candidate.addEventListener("close", function () {
        if (socket !== candidate) return;
        settleConnectionFailure(candidate, "Disconnected — this check is no longer current. Your saved browser work is still here. Reconnect to check Julia.");
      });
    }

    recheck.addEventListener("click", requestStoryStatus);
    reconnect.addEventListener("click", connect);
    continueAction.addEventListener("click", function (event) {
      if (client.canStartStory(state)) return;
      event.preventDefault();
      status.setAttribute("tabindex", "-1");
      status.focus();
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

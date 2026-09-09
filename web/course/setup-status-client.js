/* Fresh, story-only setup readiness state. No persistence or rendering. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeSetupStatusClient = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
  const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  const ENVELOPE_FIELDS = Object.freeze([
    "type", "request_id", "contract_version", "server_version", "host", "story", "laboratory"
  ]);
  const STORY_FIELDS = Object.freeze([
    "contract_version", "component", "state", "reason", "version", "checked_at", "next_action"
  ]);

  function plainRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function exactFields(value, fields) {
    if (!plainRecord(value)) return false;
    const keys = Object.keys(value);
    return keys.length === fields.length && fields.every(key => Object.prototype.hasOwnProperty.call(value, key));
  }

  function nonemptyString(value, limit) {
    return typeof value === "string" && value.length <= limit && value.trim().length > 0;
  }

  function validRequestId(value) {
    return typeof value === "string" && REQUEST_ID.test(value);
  }

  function storyRequest(requestId) {
    return validRequestId(requestId)
      ? Object.freeze({type:"setup_status", request_id:requestId, scope:"story"})
      : null;
  }

  function createState() {
    return {
      connection:"disconnected",
      phase:"not_checked",
      pendingRequestId:null,
      story:null,
      serverVersion:null,
      laboratory:"not_checked"
    };
  }

  function resetState(state, connection) {
    const base = plainRecord(state) ? state : {};
    return Object.assign({}, base, {
      connection,
      phase:"not_checked",
      pendingRequestId:null,
      story:null,
      serverVersion:null,
      laboratory:"not_checked"
    });
  }

  function connect(state) {
    return resetState(state, "connected");
  }

  function disconnect(state) {
    return resetState(state, "disconnected");
  }

  function beginStoryCheck(state, requestId) {
    const current = plainRecord(state) ? state : createState();
    const message = storyRequest(requestId);
    if (current.connection !== "connected" || message === null) return {state:current, message:null};
    return {
      state:Object.assign({}, current, {
        phase:"checking",
        pendingRequestId:requestId,
        story:null,
        laboratory:"not_checked"
      }),
      message
    };
  }

  function copyStoryReport(value) {
    if (!exactFields(value, STORY_FIELDS)) return null;
    if (value.contract_version !== "setup-v1" || value.component !== "julia") return null;
    if (!["ready", "needs_attention"].includes(value.state)) return null;
    if (!nonemptyString(value.reason, 96) || !nonemptyString(value.version, 128)) return null;
    if (typeof value.checked_at !== "string" || !TIMESTAMP.test(value.checked_at)) return null;
    if (!nonemptyString(value.next_action, 600)) return null;
    return {
      contract_version:value.contract_version,
      component:value.component,
      state:value.state,
      reason:value.reason,
      version:value.version,
      checked_at:value.checked_at,
      next_action:value.next_action
    };
  }

  function strictStoryEnvelope(reply, requestId) {
    if (!validRequestId(requestId) || !exactFields(reply, ENVELOPE_FIELDS)) return null;
    if (reply.type !== "setup_status" || reply.request_id !== requestId) return null;
    if (reply.contract_version !== "setup-v1" || reply.host !== "127.0.0.1") return null;
    if (!nonemptyString(reply.server_version, 128)) return null;
    if (!exactFields(reply.laboratory, ["state"]) || reply.laboratory.state !== "not_checked") return null;
    const story = copyStoryReport(reply.story);
    return story ? {story, serverVersion:reply.server_version} : null;
  }

  function receiveStoryReply(state, reply) {
    const current = plainRecord(state) ? state : createState();
    if (current.connection !== "connected" || current.phase !== "checking" || !validRequestId(current.pendingRequestId)) return current;
    const envelope = strictStoryEnvelope(reply, current.pendingRequestId);
    if (!envelope) return current;
    return Object.assign({}, current, {
      phase:envelope.story.state,
      pendingRequestId:null,
      story:envelope.story,
      serverVersion:envelope.serverVersion,
      laboratory:"not_checked"
    });
  }

  function canRun(state) {
    return Boolean(state && state.connection === "connected" && state.phase !== "checking");
  }

  function canStartStory(state) {
    const current = plainRecord(state) ? state : createState();
    const story = copyStoryReport(current.story);
    return Boolean(
      current.connection === "connected" &&
      current.phase === "ready" &&
      current.laboratory === "not_checked" &&
      nonemptyString(current.serverVersion, 128) &&
      story &&
      story.state === "ready"
    );
  }

  function storyActionLabel(state) {
    const current = plainRecord(state) ? state : createState();
    if (canStartStory(current)) return "Start Chapter 1 →";
    if (current.connection === "connected" && current.phase === "checking") return "Checking Julia…";
    return "Check Julia below";
  }

  function viewModel(state) {
    const current = plainRecord(state) ? state : createState();
    if (current.phase === "checking") {
      return {disabled:true, phase:"checking", message:"Julia is checking its local setup…", story:null};
    }
    if (current.connection !== "connected") {
      return {disabled:true, phase:"not_checked", message:"Reconnect to the lab before checking Julia.", story:null};
    }
    const story = copyStoryReport(current.story);
    if ((current.phase === "ready" || current.phase === "needs_attention") && story && story.state === current.phase && current.laboratory === "not_checked") {
      return {disabled:false, phase:current.phase, message:story.next_action, story};
    }
    return {disabled:false, phase:"not_checked", message:"Check Julia before starting the mystery.", story:null};
  }

  return {
    createState,
    validRequestId,
    storyRequest,
    connect,
    disconnect,
    beginStoryCheck,
    strictStoryEnvelope,
    receiveStoryReply,
    canRun,
    canStartStory,
    storyActionLabel,
    viewModel
  };
});

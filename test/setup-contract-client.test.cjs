"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const modulePath = path.join(__dirname, "..", "web", "course", "setup-status-client.js");

function clientUnderTest() {
  assert.equal(fs.existsSync(modulePath), true, "the pure setup-status client module must exist");
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function readyReply(requestId, overrides) {
  const reply = {
    type:"setup_status",
    request_id:requestId,
    contract_version:"setup-v1",
    server_version:"0.1.0",
    host:"127.0.0.1",
    story:{
      contract_version:"setup-v1",
      component:"julia",
      state:"ready",
      reason:"JULIA_READY",
      version:"1.10.0",
      checked_at:"2026-09-08T10:00:00",
      next_action:"Julia is ready for the mystery."
    },
    laboratory:{state:"not_checked"}
  };
  return Object.assign(reply, overrides || {});
}

test("a connected story check emits only the exact setup-status request", () => {
  const client = clientUnderTest();
  const initial = client.createState();
  assert.equal(client.canRun(initial), false);
  assert.deepEqual(client.storyRequest(""), null);
  assert.deepEqual(client.storyRequest(" "), null);
  assert.deepEqual(client.storyRequest("setup-1"), {
    type:"setup_status", request_id:"setup-1", scope:"story"
  });
  assert.equal(client.validRequestId("setup-1"), true);
  assert.equal(client.validRequestId(" setup-1 "), false);

  const connected = client.connect(initial);
  const started = client.beginStoryCheck(connected, "setup-1");
  assert.deepEqual(started.message, {
    type:"setup_status", request_id:"setup-1", scope:"story"
  });
  assert.equal(started.state.connection, "connected");
  assert.equal(started.state.phase, "checking");
  assert.equal(started.state.pendingRequestId, "setup-1");
  assert.equal(client.canRun(started.state), false);
});

test("only the newest strict story envelope can make the readiness state green", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginStoryCheck(state, "setup-old").state;
  state = client.beginStoryCheck(state, "setup-new").state;

  const afterStale = client.receiveStoryReply(state, readyReply("setup-old"));
  assert.equal(afterStale, state);
  assert.equal(afterStale.phase, "checking");

  const afterWrongHost = client.receiveStoryReply(state, readyReply("setup-new", {host:"localhost"}));
  assert.equal(afterWrongHost, state);
  assert.equal(afterWrongHost.phase, "checking");

  const afterWrongContract = client.receiveStoryReply(state, readyReply("setup-new", {contract_version:"setup-v2"}));
  assert.equal(afterWrongContract, state);
  assert.equal(afterWrongContract.phase, "checking");

  const malformed = readyReply("setup-new");
  malformed.laboratory = {state:"not_checked", extra:true};
  const afterMalformed = client.receiveStoryReply(state, malformed);
  assert.equal(afterMalformed, state);
  assert.equal(afterMalformed.phase, "checking");

  const accepted = client.receiveStoryReply(state, readyReply("setup-new"));
  assert.notEqual(accepted, state);
  assert.equal(accepted.phase, "ready");
  assert.equal(accepted.pendingRequestId, null);
  assert.equal(accepted.story.reason, "JULIA_READY");
  assert.equal(client.canRun(accepted), true);
});

test("socket loss and reconnect clear old readiness and preserve no false green state", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginStoryCheck(state, "setup-1").state;
  state = client.receiveStoryReply(state, readyReply("setup-1"));
  assert.equal(state.phase, "ready");

  const disconnected = client.disconnect(state);
  assert.equal(disconnected.connection, "disconnected");
  assert.equal(disconnected.phase, "not_checked");
  assert.equal(disconnected.story, null);
  assert.equal(disconnected.pendingRequestId, null);
  assert.equal(client.canRun(disconnected), false);

  const reconnected = client.connect(disconnected);
  assert.equal(reconnected.connection, "connected");
  assert.equal(reconnected.phase, "not_checked");
  assert.equal(reconnected.story, null);
  assert.equal(reconnected.pendingRequestId, null);
  assert.equal(client.canRun(reconnected), true);
  assert.deepEqual(client.viewModel(reconnected), {
    disabled:false,
    phase:"not_checked",
    message:"Check Julia before starting the mystery.",
    story:null
  });
});

test("a valid needs-attention story report remains a story-only result", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  state = client.beginStoryCheck(state, "setup-1").state;
  const reply = readyReply("setup-1");
  reply.story = Object.assign({}, reply.story, {
    state:"needs_attention",
    reason:"JULIA_SANDBOX_FAILED",
    next_action:"Close the launcher, run setup again, then reopen Julia Time."
  });
  state = client.receiveStoryReply(state, reply);

  assert.equal(state.phase, "needs_attention");
  assert.equal(state.story.component, "julia");
  assert.equal(state.laboratory, "not_checked");
  assert.equal(client.viewModel(state).message, reply.story.next_action);
  assert.equal(client.canStartStory(state), false);
});

test("only a fresh strict Julia-ready result enables the Case Board story action", () => {
  const client = clientUnderTest();
  let state = client.connect(client.createState());
  assert.equal(client.canRun(state), true);
  assert.equal(client.canStartStory(state), false);

  state = client.beginStoryCheck(state, "setup-1").state;
  assert.equal(client.canStartStory(state), false);
  state = client.receiveStoryReply(state, readyReply("setup-1"));
  assert.equal(client.canStartStory(state), true);

  const disconnected = client.disconnect(state);
  assert.equal(client.canStartStory(disconnected), false);

  const forged = Object.assign(client.connect(client.createState()), {
    phase:"ready",
    story:{component:"julia", state:"ready", next_action:"Pretend green"}
  });
  assert.equal(client.canStartStory(forged), false);
});

test("the story action label tells a learner the next move without weakening the readiness gate", () => {
  const client = clientUnderTest();
  let state = client.createState();
  assert.equal(client.storyActionLabel(state), "Check Julia below");

  state = client.connect(state);
  assert.equal(client.storyActionLabel(state), "Check Julia below");

  state = client.beginStoryCheck(state, "setup-label").state;
  assert.equal(client.storyActionLabel(state), "Checking Julia…");

  state = client.receiveStoryReply(state, readyReply("setup-label"));
  assert.equal(client.storyActionLabel(state), "Start Chapter 1 →");

  state = client.disconnect(state);
  assert.equal(client.storyActionLabel(state), "Check Julia below");
  assert.equal(client.canStartStory(state), false);
});

test("a fabricated ready state cannot bypass strict reply validation in the view model", () => {
  const client = clientUnderTest();
  const forged = Object.assign(client.connect(client.createState()), {
    phase:"ready",
    story:{component:"julia", state:"ready", next_action:"Pretend green"}
  });

  assert.deepEqual(client.viewModel(forged), {
    disabled:false,
    phase:"not_checked",
    message:"Check Julia before starting the mystery.",
    story:null
  });
});

test("the setup-status state module has no browser persistence, DOM, or network dependency", () => {
  assert.equal(fs.existsSync(modulePath), true, "the pure setup-status client module must exist");
  const source = fs.readFileSync(modulePath, "utf8");
  for (const forbidden of ["localStorage", "document", "WebSocket", "fetch(", "XMLHttpRequest"]) {
    assert.equal(source.includes(forbidden), false, "must not use " + forbidden);
  }
});

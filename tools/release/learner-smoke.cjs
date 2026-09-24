#!/usr/bin/env node
// Learner-route smoke: play one real Chapter 1 move against a running Julia Time server, the way the
// browser does, and exit non-zero unless Julia accepts the reference answer and explains a wrong one.
// Usage: node tools/release/learner-smoke.cjs [port]   (Node 22+ for the global WebSocket)
"use strict";

const port = Number(process.argv[2] || 8000);
const url = `ws://127.0.0.1:${port}/ws`;
const RUN_BUDGET_MS = 300000; // the first run may wait for background warm-up on a cold machine

function runOnce(code, requestId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); reject(new Error(`no case_result within ${RUN_BUDGET_MS} ms`)); }, RUN_BUDGET_MS);
    ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`could not connect to ${url}`)); });
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "case_run", case_id: "missing-fleas-v1", chapter: "C1", code, request_id: requestId }));
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "status") { console.log(`status: ${message.status} ${message.message || ""}`); return; }
      if (message.type === "case_result" && message.request_id === requestId) {
        clearTimeout(timer); ws.close(); resolve(message);
      }
    });
  });
}

(async () => {
  const started = Date.now();
  const good = await runOnce("jars[jars.batch_id .== case_batch, :]", "smoke-good");
  console.log(`good run after ${Date.now() - started} ms: status=${good.status} pass=${good.pass} rows=${(good.rows || []).length}`);
  const bad = await runOnce("jars[jars$batch_id == \"B09\", ]", "smoke-bad");
  console.log(`wrong run: status=${bad.status} pass=${bad.pass} message=${String(bad.message || bad.feedback || "").split("\n")[0]}`);
  const ok = good.status === "ok" && good.pass === true && bad.pass !== true && String(bad.message || bad.feedback || "").length > 0;
  console.log(ok ? "LEARNER_SMOKE_OK" : "LEARNER_SMOKE_FAILED");
  process.exit(ok ? 0 : 1);
})().catch((error) => { console.error(`LEARNER_SMOKE_FAILED: ${error.message}`); process.exit(1); });

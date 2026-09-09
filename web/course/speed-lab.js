/* Optional bootstrap-comparison state and message contracts. Rendering and transport stay outside this module. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JuliaTimeSpeedLab = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const BENCHMARK_ID = "bootstrap-v1";
  const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

  function plainRecord(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
  function exactFields(value, fields) {
    if (!plainRecord(value)) return false;
    const keys = Object.keys(value);
    return keys.length === fields.length && fields.every(key => Object.prototype.hasOwnProperty.call(value, key));
  }
  function nonemptyString(value, limit) { return typeof value === "string" && value.length <= limit && value.trim().length > 0; }
  function finiteNonnegative(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
  function validRequestId(value) { return typeof value === "string" && REQUEST_ID.test(value); }
  function matchingEnvelope(reply, type, requestId) {
    return plainRecord(reply) && reply.type === type && reply.contract_version === 1 &&
      reply.benchmark_id === BENCHMARK_ID && reply.request_id === requestId;
  }

  function benchmarkInfoRequest(requestId) {
    return validRequestId(requestId) ? Object.freeze({
      type:"benchmark_info", contract_version:1, benchmark_id:BENCHMARK_ID, request_id:requestId
    }) : null;
  }
  function benchmarkRunRequest(requestId) {
    return validRequestId(requestId) ? Object.freeze({
      type:"benchmark_run", contract_version:1, benchmark_id:BENCHMARK_ID, request_id:requestId
    }) : null;
  }

  function createState() {
    return {connection:"disconnected", phase:"not_checked", pending:null, info:null, result:null, failure:null};
  }
  function resetState(state, connection) {
    const current = plainRecord(state) ? state : {};
    return Object.assign({}, current, {connection, phase:"not_checked", pending:null, info:null, result:null, failure:null});
  }
  function connect(state) { return resetState(state, "connected"); }
  function disconnect(state) { return resetState(state, "disconnected"); }
  function connectionFailed(state) {
    return Object.assign({}, resetState(state, "disconnected"), {
      failure:{
        kind:"connection",
        message:"The local Julia game is not running. In the game folder, run julia --project=. run.jl, leave that terminal open, then check parity again."
      }
    });
  }

  function beginInfo(state, requestId) {
    const current = plainRecord(state) ? state : createState();
    const message = benchmarkInfoRequest(requestId);
    if (current.connection !== "connected" || message === null) return {state:current, message:null};
    return {state:Object.assign({}, current, {phase:"loading", pending:{kind:"info", request_id:requestId}, info:null, result:null, failure:null}), message};
  }
  function copyInfo(reply, requestId) {
    if (!matchingEnvelope(reply, "benchmark_info", requestId)) return null;
    const fields = ["type", "contract_version", "benchmark_id", "request_id", "availability", "reason", "message", "components", "parity"];
    if (!exactFields(reply, fields) || !plainRecord(reply.components) || !nonemptyString(reply.message, 600) || !nonemptyString(reply.parity, 48)) return null;
    if (reply.availability === "ready" && reply.reason === null && reply.parity === "verified") {
      return {availability:"ready", message:reply.message, reason:null, parity:"verified"};
    }
    if (reply.availability === "unavailable" && nonemptyString(reply.reason, 96) && ["not_run", "failed"].includes(reply.parity)) {
      return {availability:"unavailable", reason:reply.reason, message:reply.message, parity:reply.parity};
    }
    return null;
  }
  function receiveInfoReply(state, reply) {
    const current = plainRecord(state) ? state : createState();
    if (current.connection !== "connected" || current.phase !== "loading" || !plainRecord(current.pending) || current.pending.kind !== "info" || !validRequestId(current.pending.request_id)) return current;
    const info = copyInfo(reply, current.pending.request_id);
    if (!info) return current;
    return Object.assign({}, current, {phase:info.availability === "ready" ? "ready" : "unavailable", pending:null, info, result:null, failure:info.availability === "ready" ? null : info});
  }
  function recoverPending(state, message, reason) {
    const current = plainRecord(state) ? state : createState();
    if (current.connection !== "connected" || !plainRecord(current.pending) || !validRequestId(current.pending.request_id)) return current;
    return Object.assign({}, current, {
      phase:"unavailable", pending:null, info:null, result:null,
      failure:{kind:"recovery", reason, message}
    });
  }
  function expirePending(state, requestId) {
    const current = plainRecord(state) ? state : createState();
    if (!validRequestId(requestId) || !plainRecord(current.pending) || current.pending.request_id !== requestId) return current;
    return recoverPending(current, "The local lab did not reply. Check again or return to the Case Board; the mystery does not need this optional comparison.", "REPLY_TIMEOUT");
  }

  function canRunBenchmark(state) {
    return Boolean(state && state.connection === "connected" && state.phase === "ready" && state.info && state.info.availability === "ready" && state.pending === null);
  }
  function beginBenchmarkRun(state, requestId) {
    const current = plainRecord(state) ? state : createState();
    const message = benchmarkRunRequest(requestId);
    if (!canRunBenchmark(current) || message === null) return {state:current, message:null};
    return {state:Object.assign({}, current, {phase:"running", pending:{kind:"run", request_id:requestId}, result:null, failure:null}), message};
  }
  function copyResult(reply, requestId) {
    if (!matchingEnvelope(reply, "benchmark_run", requestId)) return null;
    if (reply.status === "ok" && reply.parity === "verified" && exactFields(reply, ["type", "contract_version", "benchmark_id", "request_id", "status", "parity", "result"]) && validReceipt(reply.result)) return {kind:"result", receipt:reply.result};
    if (reply.status === "unavailable" && ["verified", "failed", "not_run"].includes(reply.parity) && exactFields(reply, ["type", "contract_version", "benchmark_id", "request_id", "status", "parity", "reason", "message"]) && nonemptyString(reply.reason, 96) && nonemptyString(reply.message, 1200)) return {kind:"unavailable", reason:reply.reason, message:reply.message};
    return null;
  }
  function exactLanguageKeys(value) {
    return plainRecord(value) && ["julia", "r-base", "python-numpy"].every(key => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).length === 3;
  }
  function validReceipt(receipt) {
    if (!exactFields(receipt, ["receipt_version", "title", "parity", "machine", "thread_settings", "language_versions", "workloads"]) || receipt.receipt_version !== 1 || !nonemptyString(receipt.title, 160)) return false;
    if (!exactFields(receipt.parity, ["status", "contract", "kernel", "input_identity", "replicate_count"]) || receipt.parity.status !== "verified" || !nonemptyString(receipt.parity.contract, 96) || !nonemptyString(receipt.parity.kernel, 160) || !nonemptyString(receipt.parity.input_identity, 160) || !Number.isInteger(receipt.parity.replicate_count) || receipt.parity.replicate_count < 1) return false;
    if (!exactFields(receipt.machine, ["os", "architecture", "cpu_model", "logical_cpus"]) || !nonemptyString(receipt.machine.os, 160) || !nonemptyString(receipt.machine.architecture, 96) || !nonemptyString(receipt.machine.cpu_model, 240) || !Number.isInteger(receipt.machine.logical_cpus) || receipt.machine.logical_cpus < 1) return false;
    if (!exactFields(receipt.thread_settings, ["kernel", "julia_num_threads", "openblas_num_threads", "omp_num_threads", "mkl_num_threads", "veclib_maximum_threads"]) || receipt.thread_settings.kernel !== "single-threaded" || !["julia_num_threads", "openblas_num_threads", "omp_num_threads", "mkl_num_threads", "veclib_maximum_threads"].every(key => receipt.thread_settings[key] === 1)) return false;
    if (!exactLanguageKeys(receipt.language_versions) || !Object.values(receipt.language_versions).every(value => nonemptyString(value, 240))) return false;
    if (!Array.isArray(receipt.workloads) || receipt.workloads.length !== 2) return false;
    return receipt.workloads.every((workload, index) => {
      const expectedIterations = index === 0 ? 1000 : 10000;
      if (!exactFields(workload, ["iterations", "warmup_repetitions", "timed_repetitions", "timings_seconds"]) || workload.iterations !== expectedIterations || workload.warmup_repetitions !== 1 || workload.timed_repetitions !== 5 || !exactLanguageKeys(workload.timings_seconds)) return false;
      return Object.values(workload.timings_seconds).every(summary => plainRecord(summary) && exactFields(summary, ["median", "min", "max"]) && finiteNonnegative(summary.min) && finiteNonnegative(summary.median) && finiteNonnegative(summary.max) && summary.min <= summary.median && summary.median <= summary.max);
    });
  }
  function receiveRunReply(state, reply) {
    const current = plainRecord(state) ? state : createState();
    if (current.connection !== "connected" || current.phase !== "running" || !plainRecord(current.pending) || current.pending.kind !== "run" || !validRequestId(current.pending.request_id)) return current;
    const result = copyResult(reply, current.pending.request_id);
    if (!result) return current;
    return result.kind === "unavailable" ? Object.assign({}, current, {phase:"unavailable", pending:null, result:null, failure:result}) : Object.assign({}, current, {phase:"complete", pending:null, result, failure:null});
  }
  function viewModel(state) {
    const current = plainRecord(state) ? state : createState();
    if (current.connection !== "connected" && current.failure && current.failure.kind === "connection") {
      return {phase:"not_checked", message:current.failure.message, result:null};
    }
    if (current.connection !== "connected") return {phase:"not_checked", message:"Reconnect to the local lab before checking this optional comparison.", result:null};
    if (current.phase === "loading") return {phase:"loading", message:"Checking whether the optional comparison can run…", result:null};
    if (current.phase === "unavailable" && current.failure) return {phase:"unavailable", message:"Optional comparison unavailable: " + current.failure.message, result:null};
    if (current.phase === "ready") return {phase:"ready", message:"Parity check is ready. You may request the local timing run.", result:null};
    if (current.phase === "running") return {phase:"running", message:"The local lab is running its fixed comparison. No result is shown until its current reply arrives.", result:null};
    if (current.phase === "complete" && current.result) return {phase:"complete", message:"Current local benchmark receipt received.", result:current.result.receipt};
    return {phase:"not_checked", message:"Check cross-language parity before requesting any timing.", result:null};
  }

  return {BENCHMARK_ID, validRequestId, benchmarkInfoRequest, benchmarkRunRequest, createState, connect, disconnect, connectionFailed, beginInfo, receiveInfoReply, expirePending, canRunBenchmark, beginBenchmarkRun, receiveRunReply, viewModel};
});

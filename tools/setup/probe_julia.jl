#!/usr/bin/env julia

# Fixed local Julia readiness probe. It is intentionally not browser/server
# startup: it proves that this project can time out a stuck sandbox expression
# and immediately recover for the next bounded expression.
include(joinpath(@__DIR__, "common.jl"))

setup_version_status(VERSION) === :supported || error(
    "JULIA_UNSUPPORTED: Julia Time needs Julia 1.10.x; found $(VERSION).",
)

using JuliaTime

# Keep diagnostics separate from the strict six-line stdout report. They help
# a facilitator identify the local build without allowing a seventh report
# field to accidentally make a malformed result look ready.
println(stderr, "Julia version: ", VERSION)
println(stderr, "JuliaTime version: ", Base.pkgversion(JuliaTime))

timeout_result, recovery_result = try
    # This is a deliberately bounded setup check, not learner code. It proves
    # the same recovery promise the course makes after a stuck run: killing one
    # worker must leave the following Julia move available.
    timeout = JuliaTime.run_code("while true end"; budget=0.5)
    recovery = JuliaTime.run_code("20 + 22")
    (timeout, recovery)
finally
    # Reap the owned worker before reporting ready. A green child report must
    # never leave an extra sandbox process behind.
    JuliaTime.shutdown!()
end

(timeout_result isa JuliaTime.SandboxResult &&
    timeout_result.status === :timeout) || error(
    "JULIA_SANDBOX_FAILED: expected the bounded timeout check to time out.",
)

(recovery_result isa JuliaTime.SandboxResult &&
    recovery_result.status === :ok &&
    recovery_result.value isa Real &&
    isfinite(recovery_result.value) &&
    recovery_result.value == 42) || error(
    "JULIA_SANDBOX_FAILED: expected numeric 42 after the timeout check.",
)

write_setup_report(stdout;
    contract_version="setup-v1",
    component="julia",
    state="ready",
    version=string(VERSION),
    probe="julia-sandbox-timeout-recovery-42-v1",
    value=42,
)

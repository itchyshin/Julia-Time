#!/usr/bin/env bash
# Manual local launcher for the extracted Julia Time folder. It never
# installs software or changes a learner's system configuration.
#
# Mirrors tools/setup/launch-macos.command: same version-checked Julia discovery
# (tools/setup/find-julia.sh), same thread caps, and the same hand-off to run.jl, which already
# opens the Case Board (via `xdg-open` on Linux, src/server.jl) and closes the
# server cleanly on Enter or Ctrl-C (see run_server in src/server.jl). Like the
# Mac and Windows launchers, it runs the one-time check_setup.jl for you, but
# only when the same readiness check run.jl itself uses (a plain `using JuliaTime`
# load) has not already succeeded, so repeat launches skip straight to the game.

set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
course_root="$(cd "$script_dir/../.." && pwd)"
julia_lts_url="https://julialang.org/downloads/manual-downloads/#long_term_support_release"

if [[ ! -f "$course_root/Project.toml" || ! -f "$course_root/run.jl" ]]; then
  echo "COURSE_FOLDER_INVALID — keep this launcher inside the extracted Julia Time folder."
  exit 1
fi

# Looks on PATH and in the usual Julia 1.10 places, and checks each one's version, so a newer
# Julia first on PATH (for example juliaup's default) cannot hide an installed 1.10.
. "$course_root/tools/setup/find-julia.sh"
juliatime_find_julia
if [[ -z "$JULIATIME_JULIA" ]]; then
  if [[ -n "$JULIATIME_OTHER_JULIA" ]]; then
    echo "JULIA_UNSUPPORTED - Julia Time needs Julia 1.10.x. The only Julia found here is:"
    echo "  $JULIATIME_OTHER_JULIA"
    echo "Install Julia 1.10 as well (it can sit beside your other Julia), then run this launcher again."
  else
    echo "JULIA_MISSING - install Julia 1.10 manually, then run this launcher again."
    echo "This launcher checks PATH, a juliaup-managed 1.10, and a plain 1.10 install under ~/.local or /opt."
  fi
  echo "Open: $julia_lts_url"
  exit 1
fi
julia_bin="$JULIATIME_JULIA"
"$julia_bin" --version

cd "$course_root"
export JULIA_NUM_THREADS=4
export OPENBLAS_NUM_THREADS=1

# Same readiness signal run.jl checks before it will start the server: a
# fresh extraction has not run Pkg.instantiate/precompile yet, so a plain
# `using JuliaTime` load fails. Run the one-time setup command from
# docs/install.md for you here, once, instead of only telling you to.
if ! "$julia_bin" --startup-file=no --history-file=no --project=. -e 'using JuliaTime' >/dev/null 2>&1; then
  echo "Julia Time has not finished its one-time setup yet. Running it once now…"
  "$julia_bin" --startup-file=no --history-file=no --project=. check_setup.jl
  setup_status=$?
  if [[ "$setup_status" -ne 0 ]]; then
    exit "$setup_status"
  fi
fi

exec "$julia_bin" --startup-file=no --history-file=no --project=. run.jl

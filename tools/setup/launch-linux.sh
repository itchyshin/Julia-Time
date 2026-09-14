#!/usr/bin/env bash
# Manual local launcher for the extracted Julia Time folder. It never
# installs software or changes a learner's system configuration.
#
# Mirrors tools/setup/launch-macos.command: same Julia discovery order (PATH
# first), same thread caps, and the same hand-off to run.jl, which already
# opens the Case Board (via `xdg-open` on Linux, src/server.jl) and closes the
# server cleanly on Enter or Ctrl-C (see run_server in src/server.jl). Unlike
# the Mac launcher, this script also runs the one-time check_setup.jl for you
# — Linux has no separate double-click setup helper (tools/setup/setup-windows.cmd
# is Windows-only) — but only when the same readiness check run.jl itself uses
# (a plain `using JuliaTime` load) has not already succeeded, so repeat launches
# skip straight to the game.

set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
course_root="$(cd "$script_dir/../.." && pwd)"
julia_lts_url="https://julialang.org/downloads/manual-downloads/#long-term-support-release"

if [[ ! -f "$course_root/Project.toml" || ! -f "$course_root/run.jl" ]]; then
  echo "COURSE_FOLDER_INVALID — keep this launcher inside the extracted Julia Time folder."
  exit 1
fi

julia_bin="$(command -v julia 2>/dev/null || true)"
if [[ -z "$julia_bin" && -x "$HOME/.juliaup/bin/julia" ]]; then
  julia_bin="$HOME/.juliaup/bin/julia"
fi
if [[ -z "$julia_bin" ]]; then
  for candidate in "$HOME"/.local/julia-1.10*/bin/julia /opt/julia-1.10*/bin/julia /opt/julia/bin/julia; do
    if [[ -x "$candidate" ]]; then
      julia_bin="$candidate"
      break
    fi
  done
fi
if [[ -z "$julia_bin" ]]; then
  echo "JULIA_MISSING — install Julia 1.10 manually, then run this launcher again."
  echo "This launcher checks PATH, the juliaup default install, and a plain 1.10 install under ~/.local or /opt."
  echo "Open: $julia_lts_url"
  exit 1
fi

version_line="$("$julia_bin" --version)"
echo "$version_line"
if [[ "$version_line" != julia\ version\ 1.10.* ]]; then
  echo "JULIA_UNSUPPORTED — Julia Time needs Julia 1.10.x. Install or select it manually, then try again."
  exit 1
fi

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

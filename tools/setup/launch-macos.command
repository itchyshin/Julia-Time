#!/bin/zsh
# Double-click launcher for the extracted Julia Time folder on a Mac (Play-Julia-Time-Mac.command
# at the top of the folder calls this). It never installs software or changes a learner's system
# configuration. The first time, it runs the one-time package setup (check_setup.jl) for you.

set -u

course_root="${0:A:h:h:h}"
julia_lts_url="https://julialang.org/downloads/manual-downloads/#long_term_support_release"
if [[ ! -f "$course_root/Project.toml" || ! -f "$course_root/run.jl" ]]; then
  print "COURSE_FOLDER_INVALID - keep this launcher inside the extracted Julia Time folder."
  exit 1
fi

# Looks on PATH and in the usual Julia 1.10 places, and checks each one's version, so a newer
# Julia first on PATH cannot hide an installed 1.10.
source "$course_root/tools/setup/find-julia.sh"
juliatime_find_julia
if [[ -z "$JULIATIME_JULIA" ]]; then
  if [[ -n "$JULIATIME_OTHER_JULIA" ]]; then
    print "JULIA_UNSUPPORTED - Julia Time needs Julia 1.10.x. The only Julia found here is:"
    print "  $JULIATIME_OTHER_JULIA"
    print "Install Julia 1.10 as well (it can sit beside your other Julia), then double-click this launcher again."
  else
    print "JULIA_MISSING - install Julia 1.10, then double-click this launcher again."
  fi
  print "Open: $julia_lts_url"
  exit 1
fi
julia_bin="$JULIATIME_JULIA"
"$julia_bin" --version

cd "$course_root"
export JULIA_NUM_THREADS=4
export OPENBLAS_NUM_THREADS=1

# The same readiness signal run.jl uses: a fresh folder cannot load JuliaTime until the
# one-time setup has installed its packages. Run that setup once, here, instead of asking
# the learner to type it into Terminal.
if ! "$julia_bin" --startup-file=no --history-file=no --project=. -e 'using JuliaTime' >/dev/null 2>&1; then
  print "Julia Time has not finished its one-time setup yet. Running it once now; this can take several minutes."
  "$julia_bin" --startup-file=no --history-file=no --project=. check_setup.jl
  setup_status=$?
  if [[ "$setup_status" -ne 0 ]]; then
    exit "$setup_status"
  fi
fi

exec "$julia_bin" --startup-file=no --history-file=no --project=. run.jl

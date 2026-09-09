#!/bin/zsh
# Manual local launcher for the extracted Julia Time folder. It never
# installs software or changes a learner's system configuration.

set -u

course_root="${0:A:h:h:h}"
julia_lts_url="https://julialang.org/downloads/manual-downloads/#long-term-support-release"
if [[ ! -f "$course_root/Project.toml" || ! -f "$course_root/run.jl" ]]; then
  print "COURSE_FOLDER_INVALID — keep this launcher inside the extracted Julia Time folder."
  exit 1
fi

julia_bin="$(command -v julia 2>/dev/null || true)"
if [[ -z "$julia_bin" && -x "/Applications/Julia-1.10.app/Contents/Resources/julia/bin/julia" ]]; then
  julia_bin="/Applications/Julia-1.10.app/Contents/Resources/julia/bin/julia"
fi
if [[ -z "$julia_bin" ]]; then
  print "JULIA_MISSING — install Julia 1.10 manually, then run this launcher again."
  print "Open: $julia_lts_url"
  exit 1
fi

version_line="$("$julia_bin" --version)"
print "$version_line"
if [[ "$version_line" != julia\ version\ 1.10.* ]]; then
  print "JULIA_UNSUPPORTED — Julia Time needs Julia 1.10.x. Install or select it manually, then try again."
  exit 1
fi

cd "$course_root"
export JULIA_NUM_THREADS=4
export OPENBLAS_NUM_THREADS=1
exec "$julia_bin" --startup-file=no --history-file=no --project=. run.jl

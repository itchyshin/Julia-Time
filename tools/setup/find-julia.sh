# Find a Julia 1.10.x executable for the Mac and Linux launchers. Source this file, then call
# juliatime_find_julia. It only looks and asks each candidate for its version; it never installs
# software or changes settings.
#
# Sets JULIATIME_JULIA to the first candidate that reports "julia version 1.10.", and
# JULIATIME_OTHER_JULIA to the first Julia found with another version (so the launcher can say
# which Julia it saw). Order: every julia on PATH, then the usual places a 1.10 install lives
# (official Mac app, a plain download under ~/.local or /opt, a juliaup-managed 1.10 already on disk,
# and juliaup's own launcher, which a double-clicked script may not find on PATH).
# A newer Julia first on PATH (for example juliaup's default) therefore cannot hide an installed 1.10.

juliatime_try_julia() {
  [ -n "$JULIATIME_JULIA" ] && return 0
  [ -f "$1" ] && [ -x "$1" ] || return 0
  _juliatime_version="$("$1" --version 2>/dev/null)"
  case "$_juliatime_version" in
    "julia version 1.10."*) JULIATIME_JULIA="$1" ;;
    *) [ -z "$JULIATIME_OTHER_JULIA" ] && JULIATIME_OTHER_JULIA="$1 (${_juliatime_version:-no version reported})" ;;
  esac
  return 0
}

juliatime_find_julia() {
  # zsh (the Mac launcher) must not abort on an unmatched folder pattern.
  [ -n "${ZSH_VERSION:-}" ] && setopt local_options no_nomatch
  JULIATIME_JULIA=""
  JULIATIME_OTHER_JULIA=""
  _juliatime_path_list="$(printf '%s' "${PATH:-}" | tr ':' '\n')"
  while IFS= read -r _juliatime_dir; do
    juliatime_try_julia "${_juliatime_dir:-.}/julia"
  done <<JULIATIME_PATH_LIST
$_juliatime_path_list
JULIATIME_PATH_LIST
  for _juliatime_candidate in \
    /Applications/Julia-1.10*.app/Contents/Resources/julia/bin/julia \
    "$HOME"/Applications/Julia-1.10*.app/Contents/Resources/julia/bin/julia \
    "$HOME"/.local/julia-1.10*/bin/julia \
    /opt/julia-1.10*/bin/julia \
    /opt/julia/bin/julia \
    "$HOME"/.julia/juliaup/julia-1.10*/bin/julia \
    "$HOME"/.julia/juliaup/julia-1.10*/Julia-1.10.app/Contents/Resources/julia/bin/julia \
    "$HOME"/.juliaup/bin/julia; do
    juliatime_try_julia "$_juliatime_candidate"
  done
  return 0
}

#!/usr/bin/env bash
# Reproducible export of the public Julia Time archive from the current git
# HEAD. `--dry-run` only prints what a real run would do; `--out <dir>` does
# the real `git archive`, strips the dev-only paths below, adds a provenance
# file, and zips the result. This script never touches the working tree.

set -euo pipefail

usage() {
  echo "Usage: $0 --dry-run | --out <dir>" >&2
  exit 1
}

# Dev-only paths stripped from the public export. `.gitignore` is kept even
# though `.github/` is stripped, so an extracted folder still ignores the
# usual local junk if someone re-initialises git in it.
EXCLUDE_PATHS=(
  ".codex/"
  "AGENTS.md"
  "CLAUDE.md"
  "docs/dev-log/"
  "docs/design/"
  "docs/superpowers/"
  "docs/build-plan.md"
  "docs/announcement-install-julia.md"
  "output/"
  "LOOP/"
  ".unlazy/"
  ".ignore"
  ".github/"
)

if ! command -v git >/dev/null 2>&1; then
  echo "GIT_MISSING — this export needs git." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
cd "$repo_root"

mode=""
out_dir=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      mode="dry-run"
      shift
      ;;
    --out)
      mode="real"
      out_dir="${2:-}"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done
[[ -n "$mode" ]] || usage

source_sha="$(git rev-parse HEAD)"
version="$(sed -n 's/^version = "\(.*\)"/\1/p' Project.toml | head -1)"
if [[ -z "$version" ]]; then
  echo "VERSION_MISSING — could not read a version from Project.toml." >&2
  exit 1
fi
folder_name="Julia-Time-${version}"
zip_name="${folder_name}.zip"

echo "source_sha=$source_sha"
echo "exclude: ${EXCLUDE_PATHS[*]}"
echo "planned ZIP name: $zip_name"

if [[ "$mode" == "dry-run" ]]; then
  echo "sha256: computed only by a real run (--out <dir>)"
  exit 0
fi

[[ -n "$out_dir" ]] || usage
mkdir -p "$out_dir"
out_dir="$(cd "$out_dir" && pwd)"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

extract_dir="$work_dir/$folder_name"
mkdir -p "$extract_dir"
git archive "$source_sha" | tar -x -C "$extract_dir"

for path in "${EXCLUDE_PATHS[@]}"; do
  rm -rf "${extract_dir:?}/${path%/}"
done

export_date="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
provenance_file="$extract_dir/RELEASE-PROVENANCE.md"
{
  echo "# Release provenance"
  echo
  echo "- source_sha: $source_sha"
  echo "- date: $export_date"
  echo "- exclude: ${EXCLUDE_PATHS[*]}"
  echo
  echo "## How to reproduce"
  echo
  echo '```text'
  echo "git checkout $source_sha"
  echo "tools/release/export.sh --out <dir>"
  echo '```'
} >"$provenance_file"

zip_path="$out_dir/$zip_name"
rm -f "$zip_path"
(cd "$work_dir" && zip -rq "$zip_path" "$folder_name")

if command -v shasum >/dev/null 2>&1; then
  sha256_value="$(shasum -a 256 "$zip_path" | awk '{print $1}')"
else
  sha256_value="$(sha256sum "$zip_path" | awk '{print $1}')"
fi
echo "sha256=$sha256_value"

cp "$provenance_file" "$out_dir/RELEASE-PROVENANCE.md"

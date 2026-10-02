# Release provenance

- source_sha: 79a88946a244594b17dbf39205a53a2213deeefe
- date: 2026-10-02T12:17:54Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/showcase/ docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout 79a88946a244594b17dbf39205a53a2213deeefe
tools/release/export.sh --out <dir>
```

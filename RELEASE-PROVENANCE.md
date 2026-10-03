# Release provenance

- source_sha: 307160f46512ac7ad03b6ce2bb720fd10e991c0f
- date: 2026-10-03T12:31:40Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/showcase/ docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout 307160f46512ac7ad03b6ce2bb720fd10e991c0f
tools/release/export.sh --out <dir>
```

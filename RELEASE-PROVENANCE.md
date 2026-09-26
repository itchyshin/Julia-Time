# Release provenance

- source_sha: 49a8994786a7b16ea5d3392822b81aba2c0133e4
- date: 2026-09-26T23:06:37Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout 49a8994786a7b16ea5d3392822b81aba2c0133e4
tools/release/export.sh --out <dir>
```

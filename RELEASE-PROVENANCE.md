# Release provenance

- source_sha: db9a9c32026efa603ec97a7c7ae6641f39eb6567
- date: 2026-09-24T23:24:01Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout db9a9c32026efa603ec97a7c7ae6641f39eb6567
tools/release/export.sh --out <dir>
```

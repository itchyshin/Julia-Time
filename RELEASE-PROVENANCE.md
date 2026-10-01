# Release provenance

- source_sha: a3ef5279284a6cc0a827ed72ed3b7c95d4ac0d1b
- date: 2026-10-01T17:11:34Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/showcase/ docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout a3ef5279284a6cc0a827ed72ed3b7c95d4ac0d1b
tools/release/export.sh --out <dir>
```

# Release provenance

- source_sha: b4b4f83d2bc138da455064c5ae60376471eab627
- date: 2026-09-25T05:17:08Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout b4b4f83d2bc138da455064c5ae60376471eab627
tools/release/export.sh --out <dir>
```

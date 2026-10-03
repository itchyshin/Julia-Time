# Release provenance

- source_sha: 5e67ec6d341802e5a5e997ae797a2c90d507d355
- date: 2026-10-03T18:08:22Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/showcase/ docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout 5e67ec6d341802e5a5e997ae797a2c90d507d355
tools/release/export.sh --out <dir>
```

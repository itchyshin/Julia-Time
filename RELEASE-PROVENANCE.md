# Release provenance

- source_sha: e0c6d0dab9557db136a14be7aed9c2c22c9e0eb8
- date: 2026-10-03T11:18:26Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/showcase/ docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout e0c6d0dab9557db136a14be7aed9c2c22c9e0eb8
tools/release/export.sh --out <dir>
```

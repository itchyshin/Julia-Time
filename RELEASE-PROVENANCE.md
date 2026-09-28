# Release provenance

- source_sha: aea6e78596bcd618e99c82c7e8f28aed31fc5712
- date: 2026-09-28T16:15:16Z
- exclude: .codex/ AGENTS.md CLAUDE.md docs/dev-log/ docs/design/ docs/superpowers/ docs/build-plan.md docs/announcement-install-julia.md output/ LOOP/ .unlazy/ .ignore .github/

## How to reproduce

```text
git checkout aea6e78596bcd618e99c82c7e8f28aed31fc5712
tools/release/export.sh --out <dir>
```

# Documentation Index

Index of this project's documentation. Planning and triage skills consult this
file to scope their work, so a doc added under `docs/` that isn't listed here
is invisible to them — index it when you add it.

## Project context

No dedicated project docs yet. Until the library implementation lands
(see [#457](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/457)),
the context lives at the repo root:

- [`../README.md`](../README.md) — what the package is, its shape, and how
  consumers import it
- [`../CLAUDE.md`](../CLAUDE.md) — project context for Claude Code: package
  shape, commands, CI deviation, the release process, and commit/PR/branching
  conventions
- [`../CONVENTIONS.md`](../CONVENTIONS.md) — the `gvt-dev` plugin's convention
  contract (canonical copy; resynced by `/gvt-dev:audit-conventions --fix`)
- [`../CHANGELOG.md`](../CHANGELOG.md) — released versions and what each one
  contained (Keep a Changelog format; `/gvt-dev:release-npm-package` moves the
  `[Unreleased]` section into a dated one at release time)

## Knowledge Base

- [`wiki-schema.md`](wiki-schema.md) — maintenance schema for the three-tier
  LLM-wiki (`raw/` captures → `wiki/` pages → this schema): page format,
  create-vs-update lifecycle, `raw/` immutability, staleness policy

## Decision Records

The architecture decisions governing this repo — ADR-0051 (no-build `.mjs`
library, no `bin`) and ADR-0057 (the audit-mechanism seam) — live in
[`GenvidTechnologies/claude-code-plugin-gvt-dev`](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev),
not here. This repo has no `docs/decisions/` directory yet; add one only for a
decision that is genuinely local to the package.

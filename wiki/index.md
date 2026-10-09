---
okf_version: "0.2"
---

<!-- `okf_version` is the ONLY frontmatter key permitted here (§8/§12) — this
     file scaffolds the bundle-root index (`wiki/index.md`, the OKF
     bundle root per ADR-0022). A `wiki/<subdir>/index.md` carries NO
     frontmatter at all. -->

# Wiki Index

This is the wiki's table of contents — every page under `wiki/`,
grouped under section headings, one line each. `/gvt-dev:maintain-wiki`
keeps this list current: a new page is added here when it's created, and
`lint` flags any page listed in **no** index — here, or in a
subdirectory's own `index.md`. Each entry's description is the linked
page's frontmatter `description`, so the index and the page can't drift.
See `wiki/schema.md` for the page format and maintenance rules.

This file is also the repo's **documentation index**. `.gvt-agent.json` maps
`paths['docs/TOC.md']` here, so the planning, triage and review skills that
consult the convention contract's `docs/TOC.md` read this file instead.
There is no separate `docs/` index to keep in step with it.

## Project context

The project context lives at the repo root, outside the bundle. These four
links escape `wiki/`, so an OKF consumer that receives the bundle alone
can't follow them (see the schema's wiki-links section):

* [`README.md`](../README.md) - What the package is, its shape, the API
  surface (the 12 exports the barrel re-exports, grouped by module), and how
  consumers import it.
* [`CLAUDE.md`](../CLAUDE.md) - Project context for Claude Code: package
  shape, commands, CI deviation, the release process, and
  commit/PR/branching conventions.
* [`CONVENTIONS.md`](../CONVENTIONS.md) - The `gvt-dev` plugin's convention
  contract (canonical copy; resynced by `/gvt-dev:audit-conventions --fix`).
* [`CHANGELOG.md`](../CHANGELOG.md) - Released versions and what each one
  contained (Keep a Changelog format; `/gvt-dev:release-npm-package` moves
  the `[Unreleased]` section into a dated one at release time).

## Schema

* [Wiki Maintenance Schema](schema.md) - The maintenance rules for this wiki — page
  format and types, create-vs-update lifecycle, raw/ immutability, staleness
  policy, verb contract and wiki-links.

## Process

* [Process](process/index.md) - How this repo runs its own working process: the
  issue-tracking rules its maintainers follow.

## Practices

* [Issue triage conventions](issue-triage-conventions.md) - How this repo triages
  its GitHub issue backlog — the flat category-label set, why the structured
  taxonomy was rejected, and where the contract and access mechanics live.

## Decisions

The architecture decisions governing this repo — ADR-0051 (no-build `.mjs`
library, no `bin`) and ADR-0057 (the audit-mechanism seam) — live in
[`GenvidTechnologies/claude-code-plugin-gvt-dev`](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev),
not here. A decision that is genuinely local to the package is recorded as a
`decision-context` page and listed below. There is no `docs/decisions/`
directory.

* [Signature-check mechanism](signature-check-mechanism.md) - Why the .d.ts/.mjs
  signature check is one dual-consumed pivot fixture rather than two files or a
  hand-rolled AST comparator, and what each rejected option could not do.

* [Upstream-identity check](upstream-identity-check.md) - Why the src/ byte-identity
  check against gvt-dev pins a specific commit and layers a committed RECORD over a
  live fetch, rather than comparing against gvt-dev's main or the published npm
  package, and how it retires itself.

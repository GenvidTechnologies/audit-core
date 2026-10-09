# Wiki Log

Record of every `ingest` run: what changed, why, and which `raw/` source
drove it, grouped under `## YYYY-MM-DD` date headings (ISO 8601) with the
**newest date group first**. Entries are prose bullets, e.g. `* **Update**:
…`, `* **Creation**: …`, `* **Deprecation**: …` — the leading bold word is a
convention, not a requirement.

**Add newest first, never edit or remove a prior entry.** "Newest first"
means a new entry (and, if today isn't already the top group, a new
`## YYYY-MM-DD` heading) is *prepended* above everything else — the
insertion point moves from the bottom to the top, but prepending never
touches a prior entry's text, so the append-only guarantee holds exactly as
before. If a past entry itself needs correcting, add a new entry that says
so; never edit or remove the old one in place. See `wiki/schema.md` for
the full maintenance schema.

## 2026-10-08

* **Migration**: Moved the last two files under `docs/` into the bundle,
  following the upstream gvt-dev chain
  (GenvidTechnologies/claude-code-plugin-gvt-dev#579, its #585 and #587).
  `docs/issue-triage.md` became `process/issue-triage.md`, a `convention`
  page listed from the new `process/index.md`, and `.gvt-agent.json` gained
  the `paths['docs/issue-triage.md']` override that `triage-issues` resolves
  it through. `docs/wiki-schema.md` became `schema.md`, a `convention` page
  listed first under `## Schema`, which `maintain-wiki` finds at its default
  location without an override. Both bodies are unchanged below the new
  frontmatter except for their preambles and the schema's type vocabulary,
  migrated-page note and out-of-bundle example. `issue-triage-conventions.md`
  is repointed at both new paths, and its one out-of-bundle link is now
  in-bundle. `docs/TOC.md` is folded into `index.md` (new `## Project
  context` section, plus its note on upstream ADRs under `## Decisions`)
  and removed; `.gvt-agent.json` maps `paths['docs/TOC.md']` here, so there
  is one index to maintain rather than two, and `docs/` no longer exists.
  The four Project-context links are the bundle's only out-of-bundle links,
  a trade-off the schema now records. `raw/README.md` still names `docs/wiki-schema.md` and is left
  as is, because `raw/` is never edited in place. Not an ingest; no `raw/`
  source drove it.

## 2026-09-25

* **Creation**: upstream-identity-check.md — a decision-context page recording
  why audit-core#8's `src/` byte-identity check pins gvt-dev at a specific
  commit (PR #551's merge, not live `main`, since gvt-dev's upstream-first
  flow means `main` legitimately runs ahead) rather than comparing against
  the published npm package (a different property: "unchanged since our own
  last release", not "matches the gvt-dev original") or gvt-dev's live tree
  directly, driven by
  `raw/2026-09-25-upstream-identity-probes.md`. Corrects the issue's own
  "What changed to make this cheap" premise: the `@genvidtech/audit-core`
  package gvt-dev 4.28.0 installs is this repo's own published copy, not the
  gvt-dev original. Records the committed-RECORD two-tier design (blob SHA
  over sha256, justified by a measured CRLF control; worktree+index over
  worktree-only, justified by a measured staged-index blind spot), the two
  rejected reference-source options (network-only; the contents API, which
  shares its 60/hour unauthenticated budget with the retirement probe), the
  retirement design keyed off gvt-dev#458's issue state with two outcomes,
  and the two rejected retirement signals (404-at-main used alone; a
  documentation-only trigger).

  Authored during a `/gvt-dev:plan-task` run (Phase 4), not a
  `maintain-wiki ingest`. As with the sibling pages, `generated.by` names
  the durable producer contract rather than the session; no `verified` key,
  since nobody has checked it.

## 2026-09-24

* **Creation**: signature-check-mechanism.md — a decision-context page
  recording why audit-core#6's signature check is one dual-consumed pivot
  fixture, driven by `raw/2026-09-24-signature-check-mechanism-probes.md`.
  Kept here rather than in `docs/decisions/` deliberately: this repo's
  governing ADRs live upstream in the gvt-dev plugin repo, and this
  decision is local to the package. Records the two rejected options and
  what each could not do, plus two measured traps — the annotated-local
  rule, and the fact that `@ts-ignore`/`@ts-nocheck` suppress silently
  while `@ts-expect-error` self-polices.

  Authored during a `/gvt-dev:plan-task` run (Phase 4), not a
  `maintain-wiki ingest`. As with the sibling page, `generated.by` names
  the durable producer contract rather than the session; no `verified`
  key, since nobody has checked it.

## 2026-09-23

* **Creation**: issue-triage-conventions.md — the wiki's first real page, driven
  by `raw/2026-09-23-gvt-dev-4.26.0-issue-triage-flat-template.md` (the plugin's
  flat-variant template, captured verbatim) and
  `raw/2026-09-23-audit-core-github-label-set.md` (the nine-label probe that
  selected the flat variant over the structured one). Records the flat
  category-label set, the absence of priorities, `question` standing in for
  `needs-info`, the newly created `triaged` label and its last-write ordering,
  and why `actionQuery` stays scoped to the whole open backlog.

  Provenance note: authored during a `/gvt-dev:triage-issues` run — its §0b
  contract-adoption step, which scaffolded `docs/issue-triage.md` and added the
  `bugTracker` block — rather than a `/gvt-dev:maintain-wiki ingest`. The page's
  `generated.by` still reads `process:maintain-wiki` because the schema defines
  that value as the durable producer contract, not a record of which session
  wrote the file; this entry is where the actual origin is recorded. The page
  carries no `verified` key, which is correct: nobody has verified it yet.

---
type: practice-note
title: Issue triage conventions
description: How this repo triages its GitHub issue backlog — the flat category-label set, why the structured taxonomy was rejected, and where the contract and access mechanics live.
tags: [triage, github, conventions, gvt-dev]
status: stable
stale_after: 2027-03-23
generated: { by: process:maintain-wiki, at: 2026-09-23T00:00:00Z }
usage_window: { from: 2026-09-23, to: 2026-09-23 }
sources:
  - id: flat-template
    resource: ../raw/2026-09-23-gvt-dev-4.26.0-issue-triage-flat-template.md
    title: gvt-dev v4.26.0 flat-variant issue-triage template, captured verbatim
    last_modified: 2026-09-23
  - id: flat-template-upstream
    resource: https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/blob/v4.26.0/skills/triage-issues/issue-triage.flat.template.md
    title: The same template in the gvt-dev plugin repo at tag v4.26.0
    last_modified: 2026-09-23
  - id: label-set
    resource: ../raw/2026-09-23-audit-core-github-label-set.md
    title: audit-core's GitHub label set as probed on 2026-09-23
    last_modified: 2026-09-23
  - id: label-set-upstream
    resource: https://github.com/GenvidTechnologies/audit-core/labels
    title: The live label list this capture was taken from
    last_modified: 2026-09-23
---

# Issue triage conventions

This repo's issue backlog is triaged by `/gvt-dev:triage-issues`. Two files
carry the configuration, and they split along a deliberate line: **conventions**
(what the labels mean, when to split, how duplicates are handled) live in
`docs/issue-triage.md`, while **access mechanics** (fetch queries, label names,
the CLI) live in the `bugTracker` block of `.gvt-agent.json`.

## The flat variant, and why

The plugin ships two template variants. This repo uses the **flat** one[^flat-template].

The discriminator is the repo's existing label vocabulary. A probe on
2026-09-23 returned exactly GitHub's nine defaults — `bug`, `documentation`,
`duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`,
`question`, `wontfix` — with no `type:`-, `priority/`- or `area:`-prefixed
label anywhere[^label-set]. The structured variant exists for repos that
already run such a taxonomy; adopting it here would have meant inventing one,
which the contract explicitly forbids ("never invent a taxonomy the repo
doesn't have").

Two consequences worth remembering, because both are easy to re-litigate later:

- **This repo has no priorities.** The flat contract says so outright. Work is
  ranked by recency and observable impact in discussion, not by a label — a
  triaged issue carries no priority field. If priority labels are ever adopted,
  the correct move is to switch to the structured template wholesale, not to
  bolt a `priority/*` scheme onto the flat one.
- **`question` doubles as the needs-info signal.** There is no `needs-info`
  label here and one was deliberately not created. `bugTracker.needsInfoLabel`
  therefore points at `question`. An issue missing its essentials gets
  `question` plus a comment naming exactly what is needed, and the label is
  cleared when the information arrives.

## The `triaged` label

`bugTracker.triagedLabel` is `triaged`, a label that did not exist when the
contract was adopted and was created on 2026-09-23 to satisfy the key. This
matters because of *when* the skill applies it: the stamp goes on **last**, only
after an issue's other approved changes have succeeded. That ordering is what
makes triage idempotent — an aborted run leaves the issue unstamped, so a
re-run picks it up again rather than skipping it as already done.

The same label is load-bearing for `/gvt-dev:plan-next-issue`, which detects
whether the backlog needs grooming by subtracting `triagedLabel` from
`actionQuery`.

## Keeping `actionQuery` whole-backlog

`bugTracker.actionQuery` covers the entire open backlog and is deliberately
**not** narrowed to `--label bug`. The triage-need detection subtracts only
`triagedLabel`, so a label-scoped query would silently hide untriaged
enhancements, docs and tech-debt issues — making the backlog look groomed when
it isn't. This is the one scope caution the convention contract calls out by
name for this block.

## Policies that differ from the defaults people assume

- **Duplicates: link, do not auto-close.** Pick the canonical (usually the
  oldest with the best detail), add `duplicate` to the others, and comment
  `Duplicate of #<canonical>`. Closing a duplicate needs explicit per-item
  approval every time.
- **Dependencies are comments, not fields.** `Blocked by #<id>` on the blocked
  issue, optionally `Blocks #<id>` on the other.
- **Headings are an interface.** The skill and the `issue-triage-analyst` agent
  locate guidance by heading in `docs/issue-triage.md`. Edit the prose under a
  heading; never rename or drop the heading itself.

## Related

- [Wiki maintenance schema](../docs/wiki-schema.md) — the page format this page
  follows. Note this link escapes the bundle root and so is unresolvable to an
  external OKF consumer receiving `wiki/` alone; that trade-off is documented
  in the schema's own wiki-links section.

[^flat-template]: gvt-dev v4.26.0 flat-variant issue-triage template.
[^label-set]: audit-core GitHub label set, probed 2026-09-23.

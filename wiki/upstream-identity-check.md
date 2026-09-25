---
type: decision-context
title: Upstream-identity check
description: Why the src/ byte-identity check against gvt-dev pins a specific commit and layers a committed RECORD over a live fetch, rather than comparing against gvt-dev's main or the published npm package, and how it retires itself.
tags: [testing, decision, audit-core, upstream]
status: stable
stale_after: 2027-03-25
generated: { by: process:maintain-wiki, at: 2026-09-25T00:00:00Z }
usage_window: { from: 2026-09-25, to: 2026-09-25 }
sources:
  - id: probes
    resource: ../raw/2026-09-25-upstream-identity-probes.md
    title: Measured probe results behind the upstream-identity-check design, at commit d1b45f1
    last_modified: 2026-09-25
  - id: issue-8
    resource: https://github.com/GenvidTechnologies/audit-core/issues/8
    title: "audit-core#8 — enforce byte-identity of the five frozen src/ modules against gvt-dev"
    last_modified: 2026-09-25
---

# Upstream-identity check

This page records **why** `test/upstream-identity.test.mjs` is shaped the way
it is. Like the sibling
[Signature-check mechanism](signature-check-mechanism.md) page, it's kept in
the wiki rather than in `docs/decisions/`: this repo's governing architecture
decisions live upstream in the `gvt-dev` plugin repo, and this one is local
to the package.

## The problem this decision answers

CLAUDE.md's "Package shape" section states a constraint in prose: the five
extracted `.mjs` modules in `src/` must stay byte-identical to their
`gvt-dev` originals for as long as both copies exist. Nothing checked it.
The only verification performed to date was ad-hoc `git hash-object`
comparisons pasted into issue bodies — point-in-time claims that decay
silently the moment either copy changes. This is the same gap class
[issue-6/issue-7](signature-check-mechanism.md) closed for declared
signatures, one level up: a property asserted in prose, mechanically
checkable, checked by nothing.

## The property chosen

The check compares `src/` against **gvt-dev pinned at a specific commit**
(the PR #551 merge, `fd748ec1…`), not gvt-dev's live `main`. `gvt-dev` runs
an upstream-first flow — new mechanism work lands in the plugin first, then
gets re-extracted here — so `main` legitimately runs ahead of what this
repo's `RECORD` currently pins; comparing against `main` would make the
check permanently, correctly red rather than silent until a deliberate
re-extraction bumps the pin.

It also does **not** compare against the published `@genvidtech/audit-core`
npm package. That would test a different property — "has `src/` changed
since this package's own last release" — not "does `src/` still match the
gvt-dev original." The issue's own "What changed to make this cheap"
section conflated the two: it measured the plugin's installed copy of
`@genvidtech/audit-core` (gvt-dev 4.28.0 declares it as a runtime
dependency) against this repo's `src/` and read the match as evidence
against the gvt-dev original. It isn't — the package gvt-dev 4.28.0 installs
is *this repo's own published copy*, not the gvt-dev original, and nothing
in the plugin imports it yet. The design corrects that premise rather than
inheriting it.

## The chosen design (Option A)

A committed `RECORD` of git blob SHA-1s, checked in two tiers:

- **Tier 1 (T-c, offline)** — the local `src/` worktree *and* index against
  `RECORD`. Comparing both, not just the worktree, closes a blind spot a
  scratch probe found directly: staging a byte-flip and then restoring the
  worktree copy from `HEAD` leaves the worktree hash matching `RECORD` while
  the index hash diverges — a worktree-only check would pass on a change the
  next commit would still carry[^probes]. The orchestrator's own control
  (R5) reproduced the same blind spot against the implemented file and
  confirmed the index comparison catches it[^probes].
- **Tier 2 (T-d, network)** — `RECORD` against gvt-dev at the pin, fetched
  unauthenticated from `raw.githubusercontent.com`. Without this tier,
  `RECORD` is self-attested: nothing stops `src/` and `RECORD` from being
  edited together to agree with each other while silently diverging from
  the real upstream.

**Blob SHA, not sha256 of raw bytes.** `git hash-object` applies the repo's
clean filter, so it hashes the exact bytes git itself considers committed
even on a checkout that materializes CRLF line endings on disk — and it's
the same value GitHub's contents API reports as a file's `.sha`. A measured
CRLF control confirms the direction of the risk: on a scratchpad
`core.autocrlf=true` clone, `frontmatter.mjs` genuinely carries 253 CR bytes
on disk, `git hash-object --no-filters` reports a different SHA
(`a9e34ba4…`) from the filtered one (`c10782b5…`, matching `RECORD`), and
the filtered SHA is what the check uses and what stays green[^probes]. A
`sha256` over raw on-disk bytes would have false-red this clean checkout; an
LF-normalizing hash in Node would have false-greened a file git itself
considers to carry a real CR.

**`raw.githubusercontent.com`, not the contents API.** The raw endpoint at a
pinned commit is unauthenticated, returns the file bytes directly, and one
run against all five files completed in 318 ms with every module resolving
to its `RECORD` value[^probes]. The contents API was rejected — see Option C
below.

## Options rejected

**Option B — network-only, no committed `RECORD`.** Every run would fetch
gvt-dev fresh and compare live. Rejected because it gives zero enforcement
offline or when the unauthenticated GitHub API is rate-limited: with no
committed baseline, an unresolved fetch has nothing to fall back to, so the
check either fails outright on a transient network problem or has to skip
unconditionally — worse than the two-tier design, where tier 1 keeps
enforcing offline and tier 2 skips (never fails) with a named reason when
the network is unavailable.

**Option C — GitHub's contents API instead of the raw endpoint.** Rejected
because it counts against the same 60-requests/hour unauthenticated budget
this check's own retirement probe uses (`GET
.../issues/458`)[^probes], and that budget is also shared with ordinary
development-loop `gh api` calls against the same repo. The raw endpoint
doesn't draw from that budget at all, so tier 2 and the retirement probe
don't compete with each other or with a contributor's own `gh` usage.

## Retirement design

A pin can never observe `gvt-dev#458` (import `@genvidtech/audit-core`
directly instead of keeping `lib/` copies) landing on its own — the pinned
commit is fixed by construction. So retirement is decided by reading
`gvt-dev#458`'s own issue state at module load, not by comparing against the
pin: closed with `state_reason: completed` retires the check (both tiers
skip); everything else — open, `closed`/`not_planned`, or an unreadable
issue-state probe — keeps it enforcing. The default is to stay strict; only
a legible "completed" closure turns it off.

A retired check still distinguishes two outcomes with a follow-up HEAD probe
of gvt-dev's `main` branch for `frontmatter.mjs`: outcome **a** (404 — the
`lib/` copies were deleted upstream) and outcome **b** (200, or the
follow-up probe itself unreadable — the copies were retained but no longer
used). Either way the skip reason names which outcome applies and instructs
deleting the test file and the CLAUDE.md sentence, rather than leaving the
check to skip forever.

Two other retirement signals were considered and rejected:

- **404-at-main, used as the retirement signal itself** (rather than as the
  outcome-a/b discriminator it's used for today). Rejected because a path
  move in gvt-dev's tree reads identically to genuine retirement — a false
  green — and this signal alone can't distinguish outcome b (files retained,
  merely unused) from retirement not having happened at all.
- **Documentation-only retirement** (treat `gvt-dev#458` as done once a
  human updates this repo's own docs to say so). Rejected because it
  violates "skip rather than fail": once issues #4/#5 land and start
  editing `src/` after #458 actually closes upstream, tier 1 (T-c) would go
  red against a now-stale `RECORD` before anyone got around to updating the
  docs — the check has to learn about retirement from the tracker, not from
  a doc edit that might lag it.

## Re-extracting

Copy the changed file(s) from gvt-dev's
`plugin/skills/audit-conventions/scripts/lib/` into `src/` verbatim, then
bump `PIN` to the new gvt-dev commit and update the corresponding `RECORD`
entries to that commit's blob SHAs — in the **same commit** as the copy, so
`RECORD` and `src/` never disagree about which upstream revision is checked
out.

## Known residuals

- A well-formed but **mistyped** `PIN` (a real-looking SHA that doesn't
  exist at gvt-dev) 404s and skips forever, indistinguishable from a
  genuinely retired or temporarily-unreachable upstream — except that the
  skip reason visibly says "pin wrong, history rewritten, or repo no longer
  public," which is the actionable signal, and tier 1 keeps enforcing
  offline regardless.
- Whether GitHub-hosted CI runner IP ranges share the 60/hour unauthenticated
  budget (rather than each getting their own allowance) is unvalidated.
  This affects only the retirement probe — tier 2's own raw-file fetch
  doesn't draw from that budget at all (see Option C above) — and the
  retirement probe already fails safe to "still enforcing" on any
  unreadable issue state, so a shared, exhausted budget degrades to the
  check simply staying strict rather than silently skipping.

## Related

- [Signature-check mechanism](signature-check-mechanism.md) — the sibling
  decision-context page for the same class of gap (a prose-asserted,
  mechanically-checkable property that nothing checked), one layer down at
  the declared-signature level rather than the whole-file level.

[^probes]: Measured probe results behind the upstream-identity-check design, commit `d1b45f1`.

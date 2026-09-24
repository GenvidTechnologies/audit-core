---
type: decision-context
title: Signature-check mechanism
description: Why the .d.ts/.mjs signature check is one dual-consumed pivot fixture rather than two files or a hand-rolled AST comparator, and what each rejected option could not do.
tags: [testing, typescript, decision, audit-core]
status: stable
stale_after: 2027-09-24
generated: { by: process:maintain-wiki, at: 2026-09-24T00:00:00Z }
usage_window: { from: 2026-09-24, to: 2026-09-24 }
sources:
  - id: probes
    resource: ../raw/2026-09-24-signature-check-mechanism-probes.md
    title: Measured probe results behind the mechanism choice, at commit 443e3d9
    last_modified: 2026-09-24
  - id: issue-6
    resource: https://github.com/GenvidTechnologies/audit-core/issues/6
    title: "audit-core#6 — Signature drift between index.d.ts and src/ is unchecked"
    last_modified: 2026-09-24
---

# Signature-check mechanism

This page records **why** the signature-drift check is shaped the way it is.
It is a decision record kept in the wiki rather than in `docs/decisions/`,
because this repo's governing architecture decisions live upstream in the
`gvt-dev` plugin repo and this one is local to the package.

## The problem the decision answers

`src/index.d.ts` is hand-maintained and nothing generates it from the `.mjs`
sources. `test/dts-parity.test.mjs` compares exported **names** only, so a
declaration could disagree with the runtime about parameter count, parameter
shape, or return shape and no check would notice.

The gap was known and accepted upstream. gvt-dev ADR-0059 A accepted it on the
strength of two detectors — the consumer's own typecheck, and this repo's
parity test. Neither does what that sentence assumes: the parity test sees
names only, and the consumer-side typecheck does not exist at all, since
`gvt-dev` has no `package.json` and runs no `tsc` in its validate command. So
this repo's own check is currently the **only** possible detector, which is
why it covers shapes rather than just arity.

## The decision

**One JSDoc-typed pivot fixture, consumed by both tools.** `tsc` checks
`test/signature.test.mjs` against `src/index.d.ts`; `node --test` executes the
same file against `src/index.mjs`.

The reason this shape is forced rather than merely convenient: **`tsc` never
loads the `.mjs`.** A `--listFiles` run resolving the package self-reference
loaded `src/index.d.ts` and the fixture, and nothing else[^probes]. So the
type half can only ever compare the fixture to the declarations, and the
runtime half can only ever compare the fixture to the implementation. Closure
is transitive, through the single hand-written file they share.

A mutation matrix confirmed both directions are load-bearing: five `.d.ts`
mutations were caught by `tsc` and missed entirely by the runtime, and three
`.mjs` mutations were caught at runtime and missed entirely by
`tsc`[^probes]. Neither half alone detects both.

## Options rejected, and what each could not do

**Two files — a `.ts` fixture plus a sibling `.mjs` runtime test.** Rejected
because the two files are the same claim written twice with nothing checking
they agree — which is precisely the drift class the check exists to close. The
no-build constraint makes it worse: the shared type literals cannot be
imported across the boundary without a build step, so they would be duplicated
rather than shared. The rejection is therefore specific to this repo's
no-build posture, not a general preference.

**A hand-rolled AST comparator** — parse `src/index.d.ts` with the TypeScript
compiler API and compare against the runtime barrel. Rejected as the primary
mechanism because it can only check parameter **count**: the runtime has no
types to compare against, so parameter shapes and return shapes are
unreachable. That discharges one clause of the requirement and drops the rest.
Its one genuine advantage — enumerating every export automatically, so a
forgotten export cannot slip past — was recovered instead by a one-line
`Record<keyof typeof import(...), true>` completeness guard.

## Two traps this mechanism carries

Both were found by measurement, and both are invisible on a clean tree.

**A declared type is only checked if the result is bound to an annotated
local.** Passing a call result straight into an `unknown`-typed assertion
parameter erases the type: a `boolean`→`string` mutation and a dropped
`Promise` mutation both passed green until the annotated-local form was
used[^probes]. Hence the fixture's governing rule — every call's result is
assigned to a local carrying an explicit `@type`, and the assertion is made
against that local.

**Suppression directives can neuter the whole check, and they are not equally
dangerous.** `@ts-expect-error` is self-policing: it reports `TS2578: Unused`
whenever it suppresses nothing, so it cannot be added to a clean tree without
turning it red. `@ts-ignore` and `@ts-nocheck` are never flagged in either
state[^probes] — those are the silent ones, and a deny-list that covers only
`@ts-expect-error` would miss both.

A related detail worth keeping: `@ts-expect-error` matches as a **prefix**, so
even a comment reading `@ts-expect-error-free` is a live directive. That
mis-fired during the probe work and briefly made a broken control look like a
working mechanism — caught only because a green red-control is a
contradiction[^probes]. The general lesson is the repo's own: a verifier that
can silently degrade is not a verifier, so a check of this kind needs a
positive control that fails when the check itself is disabled.

## What this decision deliberately does not change

`test/dts-parity.test.mjs` is **kept, not superseded.** It is an independent
regex check that runs without `tsc` and without `@types/node`; the
completeness guard overlaps its name-parity role but depends on both. Keeping
it preserves a detector that survives a toolchain problem.

The five `.mjs` modules in `src/` are untouched — they are byte-identical to
their `gvt-dev` originals and must stay that way. If the new check ever
surfaces genuine drift, the fix goes to `src/index.d.ts`, never to a frozen
module.

## Related

- [Issue triage conventions](issue-triage-conventions.md) — the other practice
  page in this wiki; unrelated in subject, related only as a sibling record.

[^probes]: Measured probe results behind the mechanism choice, commit `443e3d9`.

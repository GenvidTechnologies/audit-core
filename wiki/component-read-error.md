---
type: decision-context
title: Component read-error shape
description: Why loadComponent resolves an unreadable file to an UnreadableComponent with readError, rather than reusing frontmatter null, returning null, or wrapping the result, and what that obliges consumers to do.
tags: [api, typescript, decision, audit-core]
status: stable
stale_after: 2027-10-12
generated: { by: process:maintain-wiki, at: 2026-10-12T00:00:00Z }
usage_window: { from: 2026-10-12, to: 2026-10-12 }
sources:
  - id: issue-5
    resource: https://github.com/GenvidTechnologies/audit-core/issues/5
    title: "audit-core#5 — loadComponent must not reject on a missing or unreadable file"
    last_modified: 2026-10-12
  - id: mutation-evidence
    resource: https://github.com/GenvidTechnologies/audit-core/issues/5#issuecomment-6127018087
    title: Mutation evidence for the read-error behaviour, posted on audit-core#5
    last_modified: 2026-10-12
---

# Component read-error shape

This page records **why** `loadComponent` reports an I/O failure the way it
does. It is a decision record kept in the wiki rather than in
`docs/decisions/`, because this repo's governing architecture decisions live
upstream in the `gvt-dev` plugin repo and this one is local to the package.

## The problem the decision answers

`loadComponent` used to reject when the component file could not be read, and
`walkComponents` propagated that rejection, so one bad file failed the whole
walk. A single file held under an exclusive lock on Windows made the walk
reject with `EBUSY`; that was reproduced with a lock probe against `e974bfd`
and is the motivating case[^issue-5]. The aggregate audit needs to keep going
and say which component it could not read.

## The decision

**A union, option C′.** `Component` is `ReadableComponent | UnreadableComponent`.
An `UnreadableComponent` is `{ type, name, expects: null, frontmatter: null,
readError: { code, message } }`, where `code` is the Node error code or `null`.
The return type stays `Promise<Component>`. On a successful read `readError`
is **absent** (not `undefined`), so the readable record keeps exactly its four
keys. TypeScript callers narrow with `'readError' in c`. When `walkComponents`
finds a component file and then fails to read it, it passes that component
through rather than rejecting or skipping it. The skills branch still checks
`SKILL.md` with `fileExists` first. That check returns `false` on any `stat`
error, so a skill whose file can't even be stat'd is still skipped as absent.
Read failures such as `EBUSY` and `EACCES` don't block `stat`, so they reach
the pass-through.

## Options considered

**A. Reuse `frontmatter: null`.** Rejected. A file that cannot be read becomes
indistinguishable from one that was read fine and has no frontmatter, so the
`EBUSY` component's expectations vanish with no trace.

**B. Return `null` (`Promise<Component | null>`).** Rejected. It breaks the
fixture's `Promise<Component>` binding and passing a result straight to the
evaluators. A throwaway `tsc` probe during design reported `TS2322` and
`TS2345`. It was not captured under `raw/`, so treat it as reported, not
reproducible from this repo. The walk's
guard would then drop the component silently, and the cause would be lost.

**C′. The union (chosen).** The return type is unchanged and the success shape
keeps four keys. The cost is that TypeScript callers must narrow before reading
`readError`, since `keyof` a union holds only the keys both branches share.

## Not the ADR-0057 Q2 wrapper

gvt-dev ADR-0057 Q2 rejects an `{ ok, value } | { ok, error }` wrapper because
it adds a second *finding* record class alongside expectation and diagnostic
(ADR-0049 (3)). `Component` is an **input** record, not a finding, so the
union does not reopen that decision.

## Pass-through, not skip

Skipping an unreadable component hides that component's expectations from the
audit. The library is silent (it does no logging) and emits no finding for
this case, so the record itself is the only channel. Turning `readError` into
a diagnostic is consumer policy (ADR-0049 (3)). Follow-ups are owed in gvt-dev
and gvt-construct3 when each bumps its pin to 0.3.0.

Because an unreadable component also has `expects: null`, a consumer that
skips on `!component.expects` now skips it silently. The CHANGELOG carries
that warning.

## The `filePath` TypeError

`loadComponent` throws `TypeError` for a non-string `filePath`. This is a
second named caller-contract throw, alongside `walkComponents`' non-string-root
`TypeError`. ADR-0057 Q2 says "The single permitted throw is a caller-contract
violation" and names only the plugin root. This decision extends that to a
second instance of the same class. ADR-0057 Q2 also deferred `loadComponent`'s
unguarded read to gvt-dev#458; this page closes that item here. The ADR's own
wording is gvt-dev's to amend. Without the guard, the catch would absorb Node's
`ERR_INVALID_ARG_TYPE` into a fake unreadable record. Measured:
`fs.promises.readFile(999)` already rejects with an `ERR_INVALID_ARG_TYPE`
`TypeError`, so the guard preserves today's `TypeError` rather than adding a
new failure mode. It does now also reject the undeclared `URL` and `Buffer`
paths that `readFile` used to accept.

## Pre-commitment for audit-core#4

`readError` is reserved for **I/O failure**, and the `try` wraps only
`readFile`; `extractFrontmatter` sits outside it, so a file with no
frontmatter still returns the four-key `frontmatter: null` shape. Malformed
frontmatter (audit-core#4) would get a sibling union member, for example
`parseError`, with the same `expects: null, frontmatter: null` defaults,
rather than overloading `readError`.

## Evidence

The `EBUSY` lock probe is described above and in the issue[^issue-5]. The
mutation evidence, with the commit and test count it was taken against, is
posted on the issue[^mutation-evidence].

## Related

- [Signature-check mechanism](signature-check-mechanism.md) — the fixture whose
  `Promise<Component>` binding option B would have broken.

[^issue-5]: audit-core#5, including the `EBUSY` reproduction.
[^mutation-evidence]: Mutation evidence comment on audit-core#5.

---
type: decision-context
title: Expectation probe outcomes
description: Why evaluateFile classifies a path through an exported probePath that returns a discriminated union, keeps fileExists/dirExists boolean, and says "could not be checked" for stat failures rather than "not found", plus the trailing-separator platform split.
tags: [api, decision, audit-core, evaluate]
status: stable
stale_after: 2027-10-13
generated: { by: process:maintain-wiki, at: 2026-10-13T00:00:00Z }
usage_window: { from: 2026-10-13, to: 2026-10-13 }
sources:
  - id: issue-20
    resource: https://github.com/GenvidTechnologies/audit-core/issues/20
    title: "audit-core#20 — evaluateFile reports a non-ENOENT stat failure as \"not found\""
    last_modified: 2026-10-13
  - id: raw-capture
    resource: ../raw/2026-10-13-trailing-separator-stat.md
    title: Capture of the Windows trailing-separator stat measurement behind audit-core#20
    last_modified: 2026-10-13
---

# Expectation probe outcomes

This page records **why** `evaluateFile` reports a path the way it does. It is
a decision record kept in the wiki rather than in `docs/decisions/`, for the
same reason as [Component read-error shape](component-read-error.md): the
governing architecture decisions (ADR-0057, ADR-0049) live upstream in
`GenvidTechnologies/claude-code-plugin-gvt-dev`, and this one is local to the
package.

## The problem the decision answers

`evaluateFile` probed an expectation path with `fileExists`/`dirExists`, which
return `false` on **any** `stat` failure. An `EACCES` or `EPERM` therefore read
as `<probe> not found`, which is false: the path may well exist, and the
audit said otherwise[^issue-20]. A dangling link had the same effect, and a
file where a directory was expected was indistinguishable from absence.

## The decision

**Option A: move and export the classifier.** `probePath` moved from
`src/component-walk.mjs` into `src/probes.mjs` (7cfbfd0). The kind `'dir'` was
renamed `'directory'`, and the error is normalised to
`{ code: string | null, message }` by `toProbeError`, which the walk's
`unreadable()` now shares. `ABSENT_CODES` is `{ENOENT, ENOTDIR}`. `evaluateFile`
now consumes it (377aca7), and `probePath` plus the types `PathProbe` and
`PathProbeError` join the barrel, taking it from 12 names to 13. Tests are
aa3ba6e (probe outcomes and error normalisation) and 5621301 (`evaluateFile`
outcomes for unreadable and wrong-kind paths).

`fileExists` and `dirExists` **stay boolean**. They have 22 consumer call sites
across gvt-dev and gvt-construct3, used for non-audit jobs (state detection,
migration, practice detection) that want a yes/no, and the README documents
"false on any stat failure".

`evaluateFile`'s detail forms, with a ` (optional)` suffix on all of them when
the expectation is not required:

| Probe outcome | Detail |
| --- | --- |
| absent | `<probe> not found` (byte-identical to before) |
| `stat` error | `<probe> could not be checked (<code>)`, or the message if the code is null |
| dangling link (`stat` ENOENT, `lstat` ok) | `<probe> could not be checked (dangling link, <code>)` |
| wrong kind | `expected a <probe>, found a <kind>`, or `…found neither a file nor a directory` |

`ok`, `severity`, the 8-key finding shape and the exit code are unchanged for
every input. Only `detail` moves.

## Options considered

**A. Move and export the classifier (chosen).** Booleans untouched, one
classifier shared by the walk and the evaluator.

**B. Change the booleans.** Rejected. It breaks the 22 call sites that want a
yes/no. A probe that rejects also pushes a throw onto callers, where ADR-0057 Q2
says none belongs.

**C. Keep the classifier private.** Rejected. gvt-dev's `prefer` loop could then
tell an unreadable path from an absent one only by string-matching `detail`.

## Not the ADR-0057 Q2 wrapper

`probePath` returns a discriminated union, which can look like the
`{ ok, value } | { ok, error }` wrapper ADR-0057 Q2 rejected. That wrapper was
rejected because wrapping evaluator calls would add a second *finding* record
class (ADR-0049 (3)). A probe result is an **input to a decision**, not a
finding, so it does not reopen that decision. `Component` makes the same
argument; see [Component read-error shape](component-read-error.md).

## Smaller choices

- **`error` is `{ code, message }`, not an `Error`.** It is typed (a mocked
  `stat` can throw anything), serialisable, and the same shape as
  `ComponentReadError`.
- **A dangling link is unexaminable**, and carries `stat`'s own code. This is
  consistent with the decision for components in audit-core#19 and #21.
- **"Could not be checked", not "exists but is unreadable".** `EACCES` from
  `stat` usually means an ancestor is not searchable, so whether the path exists
  is unknown. The wording claims only what was learned.
- **The code, not `err.message`.** Node's message embeds the absolute path, which
  would make reports machine-specific. `evaluateConfig`'s
  `unreadable (${err.message})` precedent was deliberately not followed.
- **Severity and the ` (optional)` suffix are unchanged.** Only the detail text
  moves.
- **Wrong kind gets its own message.** A file where a directory is expected, or
  the reverse, is a different problem from absence and now says so.

## Trailing separator: a platform split

Measured on Windows 11, Node v24.11.1 with `fs.statSync`[^raw-capture]:
`'package.json/'` and `'package.json\'` both stat as a **file**, `'src/'` stats
as a directory, and `'nope/'` stats `ENOENT`. POSIX is expected to give
`ENOTDIR` for `file/`, which `ABSENT_CODES` treats as absent. That was **not
measured**; CI is `ubuntu-latest` only.

Consequence: gvt-dev's `audit-main.mjs` `located()` keeps the trailing slash of
a directory expectation such as `docs/decisions/` in the probed path. On
Windows a file at that path reports `expected a directory, found a file`; on
POSIX it is expected to report `directory not found`. Follow-ups are owed in
`GenvidTechnologies/claude-code-plugin-gvt-dev`: `resolveFile`'s `prefer` loop
should adopt `probePath` and strip the trailing slash before probing, and
CONVENTIONS.md's trailing-slash paragraph promises `directory not found`. No
issues are filed for these yet.

## Related

- [Component read-error shape](component-read-error.md) — the same
  absent-versus-unexaminable decision for components.
- [Windows filesystem semantics for the component walk](windows-fs-semantics.md)
  — the measured `fs` behaviour behind both decisions.

[^issue-20]: audit-core#20, https://github.com/GenvidTechnologies/audit-core/issues/20.
[^raw-capture]: `raw/2026-10-13-trailing-separator-stat.md` (Windows 11, Node v24.11.1; POSIX unmeasured).

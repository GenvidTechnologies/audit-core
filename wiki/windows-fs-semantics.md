---
type: reference
title: Windows filesystem semantics for the component walk
description: Measured Node fs behaviour on Windows 11 (Node 24.11.1, Developer Mode, unelevated) for symlinks, junctions, dangling links, link loops and ACL denies, and what it means for walkComponents and fileExists; POSIX behaviour is not measured here.
tags: [windows, fs, node, symlink, reference, audit-core]
status: stable
stale_after: 2027-04-13
generated: { by: process:maintain-wiki, at: 2026-10-13T00:00:00Z }
usage_window: { from: 2026-10-13, to: 2026-10-13 }
sources:
  - id: raw-capture
    resource: ../raw/2026-10-13-windows-fs-probes.md
    title: Capture of the Windows filesystem probes behind audit-core#19
    last_modified: 2026-10-13
  - id: issue-19
    resource: https://github.com/GenvidTechnologies/audit-core/issues/19
    title: "walkComponents silently skips components whose stat fails or that are symlinks"
    last_modified: 2026-10-13
  - id: issue-20
    resource: https://github.com/GenvidTechnologies/audit-core/issues/20
    title: "evaluateFile reports a non-ENOENT stat failure as \"not found\""
    last_modified: 2026-10-13
---

# Windows filesystem semantics for the component walk

A reference for what Node's `fs` actually returned for the entries a plugin
tree can contain, measured while fixing audit-core#19[^issue-19].

## Scope

Every fact below was measured on **one machine on one date**: Windows 11 Pro
10.0.26200, Node v24.11.1, Developer Mode on
(`AllowDevelopmentWithoutDevLicense=1`), process not elevated, 2026-10-13[^raw-capture].
Nothing was run on Linux or macOS[^raw-capture]. Read each row as "this is what
happened here", not as a platform guarantee.

## Directory entries and links

`readdir` with `withFileTypes` against a fixture holding each shape. `stat`
follows a link; `lstat` reports the link itself[^raw-capture].

| Entry | `isDirectory` | `isFile` | `isSymbolicLink` | `stat` | `lstat` |
| --- | --- | --- | --- | --- | --- |
| Real directory | true | false | false | dir | dir |
| Real file (`realagent.md`) | false | true | false | file | file |
| Directory symlink (`symdir`) | false | false | true | dir | symlink |
| Junction (`junc`) | false | false | true | dir | symlink |
| File symlink (`symagent.md`) | false | false | true | file | symlink |
| Dangling directory symlink | false | false | true | ENOENT | symlink |
| Dangling junction | false | false | true | ENOENT | symlink |
| Dangling file symlink | false | false | true | ENOENT | symlink |
| Directory symlink named `x.md` (`dirlink.md`) | false | false | true | dir | symlink |

So a `Dirent` answered `false` for both `isDirectory` and `isFile` on every link
shape measured, and a walk that filters on those drops all of them. A junction is reported
exactly like a directory symlink.

## `stat` failures

- **A dangling symlink or junction makes `stat` fail with `ENOENT` while `lstat`
  succeeds**[^raw-capture]. `ENOENT` alone therefore cannot tell a dangling
  link from an absent path; `lstat` is the discriminator.
- **A path through a regular file stats `ENOENT`, not `ENOTDIR`**[^raw-capture]
  (the probe's "path through a file" case). Code that treats only `ENOENT` as
  absence still handles it here.
- **A `SKILL.md` -> `B.md` -> `SKILL.md` link loop stats `ELOOP`**[^raw-capture].
  The loop's parent directory is itself a real directory.
- A `SKILL.md` that is a file symlink to a real file stats as a file; a
  dangling `SKILL.md` symlink stats `ENOENT`[^raw-capture].
- A dangling `skills/` tree (`plugin3`) stats `ENOENT`[^raw-capture].

## Permission denies (`icacls`)

| Deny applied | `stat` | `readFile` |
| --- | --- | --- |
| `(F)` on a `SKILL.md` file | ok | `EPERM` |
| `(RD,X,RA)` on a skill directory | ok | ok |

With the file deny, `fileExists` still returned `true` and `walkComponents`
reported `readError: "EPERM"`; with the directory deny it reported no error[^raw-capture].

Consequence: `EACCES`/`EPERM` on `stat` could **not be reproduced
unprivileged** here. Tests inject it instead with
`t.mock.method(promises, 'stat')`; a probe confirmed that mocking the
`promises` object reaches the library (`fileExists` returned `true` before the
mock and `false` with an `EACCES` mock)[^raw-capture].

## Creating links

Directory symlinks (`'dir'`), junctions, file symlinks and dangling variants
were all created successfully, unelevated, with Developer Mode on[^raw-capture].
Unverified: on Windows without Developer Mode, symlink creation is generally
understood to fail with `EPERM` for an unelevated process. That is general
knowledge, not measured here. Whether junction creation needs the same
privilege is likewise unverified.

## Unverified elsewhere

Not measured, and not assumed by the table above:

- whether a path through a regular file gives `ENOTDIR` on POSIX;
- whether the `'junction'` type argument to `symlink` is ignored off Windows;
- the `ELOOP` code for a link loop on POSIX;
- `lstat` on a dangling link on POSIX.

audit-core CI is Linux-only (`ubuntu-latest`, Node 22), so the CI run of the
audit-core#19 pull request is the first observation of these. Update this page
(or re-capture) once it reports.

## Consequences for this package

- `walkComponents` confirms an absence code (`ENOENT`/`ENOTDIR`) with `lstat`
  before treating a path as absent, because `stat` alone cannot distinguish a
  dangling link from a missing path. The decision and the full set of walk
  rules are in [Component read-error shape](component-read-error.md).
- `evaluateFile` has the matching flaw: it reports a non-`ENOENT` `stat`
  failure as "not found". That is deliberately out of scope for the walk fix
  and is tracked in audit-core#20[^issue-20]. The injection seam above is the
  way to test it, since the failure can't be provoked unprivileged on this
  machine.

## Related

- [Component read-error shape](component-read-error.md) — the decision record
  these measurements back; this page holds the evidence, that one holds the
  reasoning.

[^raw-capture]: `raw/2026-10-13-windows-fs-probes.md` (environment, `probe19.mjs`, `probe19b.mjs`, `probe19c.mjs` outputs).
[^issue-19]: audit-core#19, https://github.com/GenvidTechnologies/audit-core/issues/19.
[^issue-20]: audit-core#20, https://github.com/GenvidTechnologies/audit-core/issues/20.

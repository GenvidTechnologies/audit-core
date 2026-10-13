# Capture: trailing-separator `stat` on Windows, behind audit-core#20

Captured 2026-10-13 in a `GenvidTechnologies/audit-core` checkout on `main` at
`26c4123`, during planning, before the fix branch existed (the result depends
on the platform's `stat`, not on audit-core's code). This is the measurement behind the
trailing-separator platform split recorded in the wiki page
`expectation-probe-outcomes.md` (issue #20: `evaluateFile` reports a
non-`ENOENT` `stat` failure as "not found").

Environment: Windows 11 Pro 10.0.26200, Node v24.11.1, run from the repo root
`C:\repos\audit-core`, calling `fs.statSync` directly on each path. Only one
machine was used.

**POSIX was not measured.** audit-core CI is `ubuntu-latest` only, and no
Linux or macOS run was made. The expectation that POSIX returns `ENOTDIR` for
`stat('file/')` is a prediction, not an observation.

## What was run

`fs.statSync(p)` for each of four paths, recording whether it threw (and the
error code) or what kind of entry it reported. `package.json` is a regular
file in the repo root; `src` is a directory; `nope` does not exist.

## Results

| Path | Result |
| --- | --- |
| `package.json/` (file, trailing forward slash) | stats as a **file** |
| `package.json\` (file, trailing backslash) | stats as a **file** |
| `src/` (directory, trailing slash) | stats as a **directory** |
| `nope/` (absent, trailing slash) | throws `ENOENT` |

## Why it matters

gvt-dev's `audit-main.mjs` `located()` keeps the trailing slash of a
directory expectation such as `docs/decisions/` in the path it probes. On
Windows, a regular file at that path therefore stats as a file and reports
`expected a directory, found a file`. On POSIX the same path is expected to
stat `ENOTDIR`, which `probePath` treats as absent (`ABSENT_CODES` is
`ENOENT` and `ENOTDIR`), so it would report `directory not found`. That
prediction is unverified.

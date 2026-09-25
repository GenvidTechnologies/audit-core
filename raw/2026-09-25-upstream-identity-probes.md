# Capture: measured probe results behind the upstream-identity-check design

Captured 2026-09-25 against `GenvidTechnologies/audit-core` branch
`test/upstream-identity-check`. These are the measurements that decided the
design for issue #8; the wiki page `upstream-identity-check.md` cites this
file.

Attribution is split by phase, not by person: the **designer** ran a set of
scratch probes during the design pass, before any implementation code
existed, to settle the open design point in issue #8 (where the reference
copy comes from) and the CRLF/staged-index shape of the check. The
**orchestrator** then ran a second, independent set of controls against the
implemented file at commit `d1b45f1`, exercising the committed test rather
than a scratch script. Nothing here is inferred — every line is a recorded
command result.

## Designer probes (pre-implementation, scratch)

### Pin resolution

    gh pr view 551 -R GenvidTechnologies/claude-code-plugin-gvt-dev
    -> mergeCommit fd748ec13682569d67fd4fdcf5429eaacaa1b8c3
       merged 2026-09-22T15:37:22Z
       title "audit-conventions: extract the eight mechanism functions into
              lib/ ahead of @genvidtech/audit-core"

The orchestrator independently re-ran `gh pr view 551 ... --json mergeCommit`
against the same PR and got the same SHA.

### Upstream lib/ identical across four refs

    gh api repos/GenvidTechnologies/claude-code-plugin-gvt-dev/contents/plugin/skills/audit-conventions/scripts/lib?ref=<ref>

Run at `fd748ec`, `v4.27.0`, `v4.28.0`, and `main` — identical blob SHAs for
all five files at every ref, and equal to `git ls-tree HEAD src/` in this
repo:

    frontmatter.mjs      c10782b573abd1baaa7c2e28e48ff8774b60ea33
    config-resolve.mjs   4ac294cc1a157397aef3e478b15032f485bb3ec0
    probes.mjs           66883f76c953dea02c7326b71ac3cf4a35ae630e
    component-walk.mjs   1d5bf0dd0c50db6a3e4a1ef92fc34d0611aa3dce
    evaluate.mjs         37a796e87e96c6587d802f9d69db312c294383a5

### Pin freshness relative to the first tag

    gh api repos/.../compare/fd748ec...v4.27.0
    -> v4.27.0 (3ad94d6...) is ahead_by=1, behind_by=0 of fd748ec

So `v4.27.0` is one commit ahead of the pinned merge commit, not behind it —
pinning the merge commit rather than the tag was a deliberate choice (a tag
can move; a commit SHA cannot), not an accident of picking a stale ref.

### Unauthenticated raw fetch at the pin

Repo is public (`isPrivate: false`). Unauthenticated
`raw.githubusercontent.com` at the pin returned `200 text/plain;
charset=utf-8` for all five files, 318 ms total for all five in parallel.
Computed git blob SHAs (`blobSha()`, see the implementation) over the
fetched bytes equal `RECORD` for all five.

### Failure shapes probed directly

    DNS failure  -> TypeError: fetch failed, cause.code === 'ENOTFOUND'
    timeout      -> TimeoutError
    missing path at a valid pin -> HTTP 404, content-type text/plain

The 404 case matters because it is NOT distinguishable from a captive-portal
or misroute by content-type alone — both can carry `text/plain` or `text/html`
depending on host. `classifyFailure()` treats any non-200 as unresolved
regardless of the body's content-type, and only inspects content-type on a
200.

### Retirement-issue probe, unauthenticated

    GET https://api.github.com/repos/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/458
    -> 200, state=open, state_reason=null, x-ratelimit-limit: 60

Confirms the retirement probe is reachable unauthenticated and that the
60/hour unauthenticated budget is the operative limit for it.

### Staged-index blind spot, scratch clone

In a throwaway clone: stage a byte-flip in `probes.mjs`, then restore the
worktree copy from `HEAD` (`git checkout -- src/probes.mjs`) without
unstaging.

    worktree `git hash-object` -> 66883f76c953dea02c7326b71ac3cf4a35ae630e
      (matches RECORD -- would read green)
    index (`git ls-files -s`)  -> 0280c49...
      (diverges from RECORD -- reads red)

This is the measurement that justified comparing both the worktree and the
index rather than the worktree alone: a worktree-only check would have
missed a staged edit with a restored working copy, which the next commit
would still carry.

## Orchestrator controls (post-implementation, against commit d1b45f1)

Results below are transcribed from a session-local run log that was not
kept; this capture is the durable record. Every control below was reverted with
`git reset -q -- src/ test/ && git checkout -- src/ test/`, confirmed by an
empty `git status --porcelain -- src/ test/` afterward, and the file re-run
green.

Note: the orchestrator's byte-flip was XOR `0x01` on byte 0 of
`probes.mjs`, which is a **different** flip from the designer's scratch
probe above — the two produce different blob SHAs for the mutated file
(orchestrator's flipped `probes.mjs` blob is `f346a2db94cdf580412e58436057fd2fa1566341`;
the designer's scratch flip above produced `0280c49...`). These are two
independent mutations exercising the same code path, not the same edit
measured twice, and are recorded separately rather than reconciled.

### Baseline (clean tree)

    node --test test/upstream-identity.test.mjs
    -> T-c pass, T-d pass, tests 6 pass 6 fail 0 skipped 0

### R4 — single-byte: flip byte 0 of src/probes.mjs (worktree)

    -> T-c fails:
       "probes.mjs (worktree f346a2db94cdf580412e58436057fd2fa1566341
        != recorded 66883f76c953dea02c7326b71ac3cf4a35ae630e) --
        src/ is frozen — revert; or, if re-extracting from gvt-dev,
        bump PIN and RECORD in this commit"
       T-d still passes (upstream unaffected by a local mutation)
       tests 6 pass 5 fail 1 skipped 0
    reverted clean, after_exit 0

### R2 — two-module: flip byte 0 of src/probes.mjs and src/evaluate.mjs (worktree)

    -> T-c fails, naming BOTH modules in one message:
       "probes.mjs (worktree f346a2db94cdf580412e58436057fd2fa1566341
        != recorded ...), evaluate.mjs (worktree 7407f403dce73f76f7099a80c0a4af94a00376a4
        != recorded 37a796e87e96c6587d802f9d69db312c294383a5) -- ..."
       T-d still passes
    reverted clean, after_exit 0

### R5 — staged-index: stage flipped probes.mjs, restore worktree from HEAD

    -> T-c fails, naming the INDEX half specifically:
       "probes.mjs (index f346a2db94cdf580412e58436057fd2fa1566341
        != recorded 66883f76c953dea02c7326b71ac3cf4a35ae630e) -- ..."
       T-d still passes
    reverted clean, after_exit 0

Confirms in the implemented file the same blind spot the designer's scratch
probe found, and that comparing the index catches it.

### R6 — record-upstream: flip one hex char of RECORD['evaluate.mjs'] (37a796e8 -> 37a796e9)

    -> T-c AND T-d both fail:
       T-c: "evaluate.mjs (worktree 37a796e87e96c6587d802f9d69db312c294383a5
             != recorded 37a796e97e96c6587d802f9d69db312c294383a5), evaluate.mjs
             (index 37a796e87e96c6587d802f9d69db312c294383a5 != recorded
             37a796e97e96c6587d802f9d69db312c294383a5) -- ..."
       T-d: "evaluate.mjs (upstream@fd748ec 37a796e87e96c6587d802f9d69db312c294383a5
             != recorded 37a796e97e96c6587d802f9d69db312c294383a5)"
       tests 6 pass 4 fail 2 skipped 0
    reverted clean, after_exit 0

### R8 — unresolvable host: RAW_BASE -> https://raw.githubusercontent.invalid

    -> T-c passes (offline tier unaffected)
       T-d skips: "reference unresolvable: frontmatter.mjs: network: ENOTFOUND,
                    config-resolve.mjs: network: ENOTFOUND, probes.mjs: network:
                    ENOTFOUND, component-walk.mjs: network: ENOTFOUND,
                    evaluate.mjs: network: ENOTFOUND"
       tests 6 pass 5 fail 0 skipped 1
       exit 0 (skip, not fail)
    reverted clean, after_exit 0

### R9 — 404 at pin: PIN -> well-formed nonexistent SHA (fd748ec1 -> 0000...)

    -> T-c passes
       T-d skips: "reference unresolvable: frontmatter.mjs: HTTP 404: pin wrong,
                    history rewritten, or repo no longer public, ... (all five)"
       tests 6 pass 5 fail 0 skipped 1
       exit 0 (skip, not fail)
    reverted clean, after_exit 0

### CRLF control (scratchpad autocrlf=true clone)

In a scratchpad clone of the branch made with
`git -c core.autocrlf=true clone`, then `git config core.autocrlf true` and
`rm src/*.mjs && git checkout -- src` to force a CRLF-materialized checkout:

    tr -cd '\r' < src/frontmatter.mjs | wc -c
    -> 253                                    (CRLF genuinely present on disk)

    git hash-object --no-filters src/frontmatter.mjs
    -> a9e34ba44ccdc81bfcdd3da0da92900934bcabb3   (raw on-disk CRLF bytes)

    git hash-object src/frontmatter.mjs
    -> c10782b573abd1baaa7c2e28e48ff8774b60ea33   (filtered -- matches RECORD)

    node --test test/upstream-identity.test.mjs
    -> T-c pass, T-d pass, tests 6 pass 6 fail 0 skipped 0

This is the positive control behind `blobSha()`'s use of `git hash-object`
(filtered) rather than a `sha256` over raw on-disk bytes: on a checkout that
genuinely materializes CRLF, the filtered SHA still agrees with `RECORD`
while the raw-bytes SHA does not — a `sha256`-of-raw-bytes design would have
false-red this clean checkout.

### Full-suite regression

    npm test
    -> tests 48, pass 48, fail 0, skipped 0
       (baseline before this branch: 42; the six T-a..T-f tests account for
       the difference)

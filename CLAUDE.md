@CONVENTIONS.md

# @genvidtech/audit-core

Shared audit mechanism for the `gvt-dev` and `gvt-construct3` convention
audits. This is a **library, not a CLI** — it declares no `bin` entry and is
not meant to be invoked with `npx`. Consumers import it as an ES module.

The library implementation has not landed yet; the repository currently holds
the standup only. The work is tracked in
[GenvidTechnologies/claude-code-plugin-gvt-dev#457](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/457),
whose seam is pinned by ADR-0057 in that repo.

## Package shape

No-build, plain-`.mjs` ESM. Sources ship as written — there is no TypeScript
build step and no `dist/`. Types come from a **hand-maintained**
`src/index.d.ts` alongside the source, so a change to an export's signature
must be mirrored there by hand; nothing generates it.

This deliberately differs from the sibling leaf libraries
[`@genvidtech/c3source`](https://github.com/GenvidTechnologies/c3source) and
[`@genvidtech/mcp-utils`](https://github.com/GenvidTechnologies/mcp-utils),
which are TypeScript packages that build to `dist/`. Don't port their layout
here (see ADR-0051 in the `gvt-dev` plugin repo).

`yaml` is the only runtime dependency, and there is deliberately **no
`@genvidtech` dependency of any kind** — this package sits at the bottom of
the dependency graph.

Node >= 22.

## Commands

| Task | Command |
| --- | --- |
| Lint | `npm run lint` (eslint) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`, checks the hand-written `.d.ts`) |
| Test | `npm test` (`node --test`) |
| Build | `npm run build` — a **documented no-op**; it exists only because the shared CI gate runs all four scripts unconditionally |
| Validate | `npm run lint && npm run typecheck && npm test` |

## CI

CI uses the shared reusable gate via copied `templates/` workflows from
`GenvidTechnologies/public-github-actions`. Each workflow file carries exactly
one deviation from its upstream template: line 10's `uses:` is corrected from
the pre-rename `genvid-holdings/genvid-public-ci` to the canonical
`GenvidTechnologies/public-github-actions`. `gh api` follows that rename
redirect silently but GitHub Actions `uses:` does not, so copying a template
verbatim fails the run instantly. Both sibling leaf repos carry the same
correction. Fixed upstream in
[public-github-actions#2](https://github.com/GenvidTechnologies/public-github-actions/pull/2) —
once that merges, the deviation count drops to zero.

Keep that deviation when re-syncing a workflow from its template.

## Commit Format

Conventional-commit-style subject: `<type>: <imperative summary>`, lowercase
type, no trailing period, kept short enough to read in `git log --oneline`.

The body is optional but expected for anything non-obvious, wrapped at ~72
columns, and explains **why** — the constraint, the ADR or issue it answers,
and what was deliberately not done. The standup commit (`e69d3f0`) is the
reference example: it cites the ADRs behind each shape decision and names the
one upstream deviation.

Reference issues and decisions by their full `Org/repo#N` or `ADR-NNNN` form,
since the decisions governing this repo live in the `gvt-dev` plugin repo
rather than here.

## Pull Request Format

Title follows the commit subject convention above. The body states what
changed, why, and how it was verified — name the commands actually run
(`npm run lint`, `npm run typecheck`, `npm test`), not a generic claim that
checks pass.

## Branching

Default and only long-lived branch is `main`. Feature work goes on a
short-lived branch off `main` and is rebased (not merged) to stay linear.

@CONVENTIONS.md

# @genvidtech/audit-core

Shared audit mechanism for the `gvt-dev` and `gvt-construct3` convention
audits. This is a **library, not a CLI** — it declares no `bin` entry and is
not meant to be invoked with `npx`. Consumers import it as an ES module.

The library implementation has landed: `src/` holds the five extracted
modules (`frontmatter.mjs`, `config-resolve.mjs`, `probes.mjs`,
`component-walk.mjs`, `evaluate.mjs`) plus the re-export barrel
`src/index.mjs`, closing
[GenvidTechnologies/claude-code-plugin-gvt-dev#457](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/457),
whose seam is pinned by ADR-0057 in that repo. `README.md`'s API surface
section documents the 12-name barrel.

## Package shape

No-build, plain-`.mjs` ESM. Sources ship as written — there is no TypeScript
build step and no `dist/`. Types come from a **hand-maintained**
`src/index.d.ts` alongside the source, so a change to an export's signature
must be mirrored there by hand; nothing generates it.
`test/dts-parity.test.mjs` independently pins name parity — that the set of
names declared in `src/index.d.ts` matches the set the barrel actually
exports at runtime — via a regex check that runs without `tsc` or
`@types/node`, so it survives a toolchain problem that would take the
`tsc`-backed check below out with it. Declared *shapes* and signatures are
pinned by `test/signature.test.mjs`, a JSDoc-typed fixture checked by both
`tsc` (via `tsconfig.signature.json`, spawned from
`test/signature-guard.test.mjs`, against `src/index.d.ts`) and `node --test`
(against `src/index.mjs`) — closure is transitive through the one file they
share, since `tsc` never loads the `.mjs` and the runtime sees no declared
types. `test/signature-guard.test.mjs` also denies suppression directives
(`@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`) in the fixture, so the check
cannot be silently disarmed.

This deliberately differs from the sibling leaf libraries
[`@genvidtech/c3source`](https://github.com/GenvidTechnologies/c3source) and
[`@genvidtech/mcp-utils`](https://github.com/GenvidTechnologies/mcp-utils),
which are TypeScript packages that build to `dist/`. Don't port their layout
here (see ADR-0051 in the `gvt-dev` plugin repo).

**The five `.mjs` modules in `src/` are byte-identical to their `gvt-dev`
originals, and must stay that way while both copies exist** — that's what
bounds drift until the plugin itself imports from this package (#458). Don't
edit them for any reason, including a header comment or a reformat; a change
that's genuinely needed belongs in the `gvt-dev` plugin first, then gets
re-extracted here.

`yaml` is a declared dependency but currently **unused** — see "Package
shape" in `README.md` for why — and there is deliberately **no `@genvidtech`
dependency of any kind** — this package sits at the bottom of the dependency
graph.

Node >= 22.

## Commands

| Task | Command |
| --- | --- |
| Lint | `npm run lint` (eslint) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`, checks the hand-written `.d.ts`) |
| Test | `npm test` (`node --test`; includes the `tsc`-backed signature typecheck spawned from `test/signature-guard.test.mjs`) |
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

## Releasing

This package publishes to npmjs.com as `@genvidtech/audit-core` via
`.github/workflows/publish.yml` — the shared `public-github-actions` OIDC
recipe (trusted publishing, automatic provenance, no stored npm token). **The
`v*.*.*` tag push is the publish trigger**; pushing `main` alone publishes
nothing, and there is no manual `npm publish` step. Use
`/gvt-dev:release-npm-package`.

`0.0.0` on npm is the one-time bootstrap placeholder from the original
`publish-npm-package` setup, not a real release. The first real release is
`0.1.0`.

**Tags are lightweight** (`git tag vX.Y.Z`, no `-a`). The two sibling leaf
repos disagree — `c3source` annotates, `mcp-utils` does not — so there is no
family convention to inherit; this line is the record of the choice made at
`v0.1.0`.

**A version bump touches four spots, not three.** Beyond `package.json` and
the two in `package-lock.json`, `src/index.mjs` carries a hand-written
`VERSION` constant. `npm version --no-git-tag-version` does **not** update it,
so a bump that stops at the manifest leaves `VERSION` stale.
`test/smoke.test.mjs` asserts the two agree, so the mismatch fails `npm test`
rather than shipping — but fix it in the same commit as the bump, before the
validate step.

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

# Plan: typed signature fixture closes the `.d.ts` / `.mjs` drift gap

Implements [GenvidTechnologies/audit-core#6](https://github.com/GenvidTechnologies/audit-core/issues/6).

## Branch

`signature-fixture-typecheck`, off `main`, short-lived, rebased not merged
(`CLAUDE.md` Branching). Plain descriptive kebab-case, matching the sibling
branch `extract-audit-mechanism`; this repo has no issue-number-prefix
convention.

## Summary

Add one JSDoc-typed pivot fixture, `test/signature.test.mjs`, that **both**
`node --test` and a `tsc` spawn exercise. `tsc` checks it against
`src/index.d.ts`; `node --test` executes it against `src/index.mjs`. Neither
half alone discharges the issue's Outcome sentence — `tsc` never loads the
`.mjs` (confirmed by `--listFiles`), and the runtime cannot see declared
types. Closure is transitive through the single hand-written pivot.

Land it P/P/F so the mechanism is inert until one wiring commit flips it on,
then correct the three doc sites that currently overstate what is checked.

### Why one file rather than two

A separate `.ts` fixture plus a sibling `.mjs` runtime test was considered and
rejected: the two files are the same claim written twice with nothing checking
they agree — the exact drift class this issue exists to close. The no-build
constraint (ADR-0051) makes it worse, since the shared type literals cannot be
imported across the boundary without a build step, so they would be duplicated
rather than shared.

A third option — parsing `src/index.d.ts` with the TypeScript compiler API and
comparing against the runtime barrel — was rejected as the primary mechanism:
it can only check parameter *count*, because the runtime has no types to
compare against. Its one real advantage, automatic enumeration of every export,
is recovered by the completeness guard below at a cost of one line.

## Governing rule for the fixture

**Every call's result is assigned to a local carrying an explicit `@type`
annotation, and the runtime assertion is made against that local.** Passing a
call result straight into an `unknown`-typed assertion parameter erases the
type. This was measured: both a `boolean`→`string` mutation and a dropped
`Promise` mutation passed green until the annotated-local form was used. The
failure is invisible on a clean tree.

Three verified idioms:

```js
// Arity — tsc pins the literal to the .d.ts; node pins it to the .mjs.
/** @type {Parameters<typeof resolveKey>['length']} */ const A_resolveKey = 2;
assert.equal(resolveKey.length, A_resolveKey);

// Return key set — Record<keyof T, true> errors on BOTH a missing key
// (TS2741) and an excess key (TS2353).
/** @type {Record<keyof import('@genvidtech/audit-core').Component, true>} */
const COMPONENT_KEYS = { type: true, name: true, expects: true, frontmatter: true };
assert.deepEqual(Object.keys(c).sort(), Object.keys(COMPONENT_KEYS).sort());

// Return type — the annotated local is what makes it checkable.
/** @type {boolean} */ const ok = commandExists('node');
assert.equal(typeof ok, 'boolean');
```

Plus a completeness guard, so a newly-declared export fails until covered:

```js
/** @type {Record<keyof typeof import('@genvidtech/audit-core'), true>} */
const COVERED = { VERSION: true, extractFrontmatter: true, /* …all 12… */ };
assert.deepEqual(Object.keys(COVERED).sort(), Object.keys(barrel).sort());
```

This also covers the type-only exports (`KeyResolution`, `Component`,
`Expects*`, …) that `dts-parity`'s regex skips, via `@typedef` imports —
renaming `KeyResolution` produces `TS2694`.

## Measured implementation facts

Do not re-derive; flag if found wrong.

- `tsc@7.0.2` does **not** auto-discover `@types/node`. `"types": ["node"]`
  must be explicit, or the fixture fails `TS2591`.
- Use `files:`, not `include:`, in `tsconfig.signature.json`. A typo'd path in
  `files` exits 2 with `TS6053`; an `include` glob matching nothing is silent.
- Put `checkJs: true` in the config, **not** `// @ts-check` in the fixture —
  deleting an in-file directive silently disables the whole check.
- Leave the root `tsconfig.json` untouched (`include: ["src"]`,
  `checkJs: false`). Zero blast radius on `npm run typecheck`.
- `createRequire(...).resolve('typescript/bin/tsc')` throws
  `ERR_PACKAGE_PATH_NOT_EXPORTED` under `typescript@7.0.2`. Use the literal
  path `node_modules/typescript/bin/tsc`, spawned via `process.execPath`, with
  `assert.ok(existsSync(tscPath))` first so a wrong path fails legibly.
- The spawn assertion **must** pass `` `${r.stdout}${r.stderr}` `` as the
  assert message, or a failure reads `1 !== 0` and names no drifted
  declaration.
- `node --test` discovers *any* `.mjs` under `test/`, not only `*.test.mjs`,
  and counts a zero-test file as one passing entry — so a helper module placed
  there becomes a phantom test.
- Suppression directives differ sharply. `@ts-expect-error` is self-policing
  (`TS2578: Unused` when it suppresses nothing, so it cannot be added to a
  clean tree without turning it red) and matches as a **prefix**, so even
  `@ts-expect-error-free` in a comment is a live directive. `@ts-ignore` and
  `@ts-nocheck` are **never** flagged in either state — those are the silent
  killers. The deny-list covers all three.
- Arity, verified at runtime against the barrel: `extractFrontmatter` 1,
  `parseYaml` 1, `resolveKey` 2, `fileExists` 1, `dirExists` 1,
  `commandExists` 1, `walkComponents` 1, `loadComponent` 3, `evaluateFile` 3,
  `evaluateConfig` 3, `evaluateTool` 2. Barrel: 12 exports, 11 functions.
- **No signature changes to `src/index.d.ts` are needed** — the full fixture
  typechecks clean and passes at runtime today. There is no genuine drift to
  fix. Only the header comment changes, so no version bump: the public surface
  is unchanged and the four-spot `VERSION` rule does not fire.

## Constraints

The five `.mjs` modules in `src/` — `frontmatter.mjs`, `config-resolve.mjs`,
`probes.mjs`, `component-walk.mjs`, `evaluate.mjs` — are byte-identical to
their `gvt-dev` originals and **must not be edited**, not even a comment.
`src/index.d.ts`, `src/index.mjs` and `test/` are not in that frozen set. The
mutation controls in F1 temporarily edit frozen modules and revert within the
task; nothing is committed, so the rule is not breached — but `git status`
must confirm it before that commit.

`test/dts-parity.test.mjs` is **not superseded and is kept.** It is an
independent regex check that runs without `tsc` or `@types/node`; the
completeness guard overlaps its name-parity check but depends on both. Only
its header comment changes.

## Acceptance Criteria

Pledged in issue #6 before execution, per ADR-0017. Every baseline was
measured against the tree at `443e3d9`.

- [ ] **T1 — Wiring.** `npm test` → exit 0 with `ℹ fail 0`, and `ℹ tests`
      strictly greater than the baseline 31. Additionally
      `node --test test/signature.test.mjs test/signature-guard.test.mjs` →
      exit 0, each file reporting ≥1 executing test. Baseline: exit 0,
      `ℹ tests 31`, and neither file exists.
- [ ] **T2 — Mutation control, `.d.ts` parameter count.** Adding an extra
      parameter to `resolveKey` in `src/index.d.ts` makes `npm test` exit 1
      with `TS2554`; reverting restores exit 0. Baseline: the same mutation
      pre-change gives exit 0.
- [ ] **T3 — Mutation control, `.d.ts` return shape.** Changing
      `commandExists`'s declared return to `string` makes `npm test` exit 1
      with `TS2322`; reverting restores exit 0. Baseline: exit 0.
- [ ] **T4 — Mutation control, runtime side.** Adding a third parameter to
      `resolveKey` in `src/config-resolve.mjs` makes `npm test` exit 1 naming
      the arity assertion; reverting restores exit 0. Baseline: exit 0. Proves
      the check is not `tsc`-only and that `.d.ts` ↔ `.mjs` is genuinely
      pinned.
- [ ] **T5 — Guard is armed.** Inserting `// @ts-ignore` above an annotated
      line in `test/signature.test.mjs` makes `npm test` exit 1 from the guard;
      reverting restores exit 0. The guard carries its own in-file positive
      control — the same regex against a synthetic 3-directive string, asserted
      `=== 3`. Baseline: zero `@ts-ignore` in all five existing test files.
- [ ] **T6 — Docs.** `grep -c -F 'drift there is unchecked by anything'
      CLAUDE.md` → 0. Baseline 1.
- [ ] **T7 — Docs survival.** `grep -c -F 'test/dts-parity.test.mjs'
      CLAUDE.md` → ≥1. Baseline 1. Regression assertion, paired with T6 which
      does move.
- [ ] **T8 — Footprint.** `grep -r -o -F 'the one thing' CLAUDE.md
      src/index.d.ts test/dts-parity.test.mjs | wc -l` → 0. Baseline 3.
- [ ] **T9 — New artifacts exist and are wired.** `@types/node` present in
      devDependencies (baseline `undefined`); `tsconfig.signature.json` exists
      (baseline absent); `ls test/ | grep -c signature` → ≥2 (baseline 0).
- [ ] **T10 — No regression.** `npm run lint` → 0; `npm run typecheck` → 0.
      Baseline both 0. Regression assertion, paired with T1.
- [ ] **T11 — Docs, published surface.** `grep -c -F 'rely on manual review
      against the source modules' src/index.d.ts` → 0. Baseline 1. The same
      literal measures 0 in `CLAUDE.md` and `test/dts-parity.test.mjs`, so the
      row is scoped to the one file that ships to consumers via
      `package.json`'s `files` array.

### Amendment record

**T1 was amended before being pledged. Failure mode: defective — wrong when
written, not decayed.**

Original: *"`npm test` → exit 0 and rendered output line `ℹ tests` ≥ 34."*

Defect: `node --test` counts `test()` blocks, so the threshold measures test
*granularity*, not coverage. Correct, complete work organized into two
well-structured blocks lands at 33 and fails; padding the same assertions
across six blocks passes while proving nothing.

Evidence the protected requirement survives the amendment, established
independently of T1's own literal: T2 and T3 prove the `tsc` spawn actually
runs and can go red, which is what *"the check runs in `npm test` and passes"*
is for.

## Tasks

Strictly sequential. Every task after P1 either depends on a prior task's file
or shares one — F1 and F2 both touch `src/index.d.ts` (F1 transiently, F2
permanently). Do not batch any of these as a parallel pair.

### P1 — Add the typed signature fixture, unwired — `gvt-dev:ts-implementer`

Add `@types/node` as a devDependency, add `tsconfig.signature.json`, add
`test/signature.test.mjs` with the idioms above: one arity assertion per
export, at least one return-key-set check, at least one annotated-local return
check, plus the completeness guard.

Nothing invokes `tsc` yet. `node --test` auto-discovers the fixture and runs
its runtime assertions immediately; JS ignores the type annotations, so they
pass on the current tree with no wiring change.

**Files:** `package.json`, `package-lock.json`, `tsconfig.signature.json`,
`test/signature.test.mjs`

**Done when:**
- `node --test test/signature.test.mjs` → exit 0.
- `node node_modules/typescript/bin/tsc -p tsconfig.signature.json` → exit 0
  (confidence check only; nothing spawns this until F1).
- `node -p "require('./package.json').devDependencies['@types/node']"` → a
  version string.
- `tsconfig.signature.json` shows `files` (not `include`), `checkJs: true`,
  `types: ["node"]`.

**Commit:** `test: add typed signature fixture (unwired to any typecheck)`

### P2 — Add the suppression deny-list, without the spawn — `gvt-dev:ts-implementer`

Add `test/signature-guard.test.mjs` containing only the deny-list: scan
`test/signature.test.mjs`'s source for `@ts-expect-error`, `@ts-ignore` and
`@ts-nocheck`, failing if any is present. Match `@ts-expect-error` as a
**prefix** — do not anchor on a trailing word boundary, which would miss
`@ts-expect-error-free`. Include the in-file positive control: the same regex
against a synthetic 3-directive string, asserted `=== 3`.

No `tsc` spawn yet. This step is inert with respect to type-checking.

**Files:** `test/signature-guard.test.mjs`

**Done when:**
- `node --test test/signature-guard.test.mjs` → exit 0.
- All three directive literals appear in the deny-list.
- The positive control compares to `3`, not a looser bound.

**Commit:** `test: add signature-guard suppression check (spawn not yet wired)`

### F1 — Wire the `tsc` spawn — `gvt-dev:ts-implementer`

Add the spawn to `test/signature-guard.test.mjs` per the measured facts above.
This single change makes the mechanism load-bearing, and is where T2–T5 become
checkable. Run all four mutation controls as part of verifying this task.

**Do not commit any mutation.** `src/index.d.ts` and `src/config-resolve.mjs`
must show zero diff; run `git status` immediately before committing and
confirm only `test/signature-guard.test.mjs` is staged.

**Verify at implementation, not blocking:** locally `typescript@7.0.2`
resolved `@typescript/typescript-win32-x64`; CI is Ubuntu and pulls the Linux
package. The shim path is the same either way, but the first CI run is the
real cross-platform verification. Name this in the PR body.

**Files:** `test/signature-guard.test.mjs`

**Done when:**
- `npm test` → exit 0 on the tree as committed, no residual mutations.
- T2, T3, T4, T5 each produce the stated red and revert cleanly.
- `git status` shows no diff in `src/` or `test/signature.test.mjs` at commit
  time.

**Commit:** `test: wire tsc spawn into signature-guard, closing the typecheck loop`

### F2 — Correct the three-site doc footprint — `gvt-dev:tech-writer`

`CLAUDE.md` is the sole canonical owner of the prose. Remove the "the one
thing that can be checked mechanically … drift there is unchecked by anything"
claim and describe the new mechanism at a level suiting a project-context doc.
**Keep** the reference to `test/dts-parity.test.mjs` and what it independently
still checks — it is not superseded.

`src/index.d.ts` header: replace the restatement with a one-line pointer to
`CLAUDE.md`. `test/dts-parity.test.mjs` header: narrow to describing its own
name-parity behaviour; comment only, no logic change.

**Files:** `CLAUDE.md`, `src/index.d.ts` (header comment only),
`test/dts-parity.test.mjs` (header comment only)

**Done when:** T6, T7, T8, T11 all hold; `git diff` on both `.mjs`/`.d.ts`
files touches comment lines only.

**Commit:** `docs: describe the signature typecheck and retire the stale unchecked-shapes claim`

### Validation

`npm run lint && npm run typecheck && npm test` (`.gvt-agent.json`
`commands.validate`), then `gvt-dev:validator` and `gvt-dev:code-reviewer` on
the branch diff against `main`. Re-spot-check T2–T5 against the fully
assembled tree.

## Risks

| Risk | Mitigation |
|---|---|
| CI resolves a different `typescript` native package than local | F1 flags it; the shim path is platform-independent; first CI run is the verification |
| `node --test` counts a stray `.mjs` helper under `test/` as a phantom passing test | No shared helper is introduced; only the two named files are added |
| A mutation probe gets committed against a frozen `src/` module | F1 requires an explicit `git status` check immediately before commit |
| `src/index.d.ts` touched by both F1 (transient) and F2 (permanent) | Strictly sequential; F2 starts only once F1's tree is verified clean |
| Deny-list regex under- or over-matches | P2's in-file positive control asserts exactly 3 against a synthetic string |

## Session estimate

Single session. Four small mechanical tasks plus a gate; the design resolved
every implementation ambiguity, so no task needs exploratory work beyond the
flagged CI-platform check.

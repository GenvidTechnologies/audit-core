# Capture: measured probe results behind the signature-check mechanism choice

Captured 2026-09-24 from probe runs against `GenvidTechnologies/audit-core` at
commit `443e3d9`, working tree clean. These are the measurements that decided
the mechanism for issue #6; the wiki page
`signature-check-mechanism.md` cites this file.

Attribution is split deliberately: the orchestrating session ran the
resolution and arity probes; the `gvt-dev:designer` agent ran the mutation
matrix during the design phase. Both ran against this same commit. Nothing
here is inferred — every line is a recorded command result.

## Probes run by the orchestrating session

### Package self-reference, runtime

    node -e "import('@genvidtech/audit-core').then(m=>console.log(Object.keys(m).length))"
    -> 12

### Package self-reference, types

    tsc -p <throwaway probe project> --listFiles

Non-library files loaded:

    C:/repos/audit-core/src/index.d.ts
    C:/repos/audit-core/.probe-tmp/green.ts

`src/index.mjs` was NOT loaded. This is the fact the whole design rests on:
`tsc` sees the declarations only, never the implementation.

### Red/green control on a consumer-shaped fixture

    green fixture (all calls match the declarations)  -> exit 0
    red fixture   (extractFrontmatter() with 0 args)  -> exit 1,
      "error TS2554: Expected 1 arguments, but got 0"

Harness liveness was confirmed separately by planting an import-independent
type error, which failed correctly with TS2322.

**Incident worth recording.** The first red control passed (exit 0) and was
briefly mistaken for a working mechanism. Cause: the probe file carried a
comment beginning `// @ts-expect-error-free …`. TypeScript matches
`@ts-expect-error` as a *prefix*, so the comment became a live suppression
directive and silenced the exact error under test. Caught only because a green
red-control is a contradiction. A probe without a red half would have reported
success on a vacuous green.

### Runtime arity of every exported function

    node -e "<compare fn.length against the declared table>"
    -> all 11 arities match; barrel has 12 exports, 11 functions

    extractFrontmatter 1   parseYaml 1        resolveKey 2
    fileExists 1           dirExists 1        commandExists 1
    walkComponents 1       loadComponent 3    evaluateFile 3
    evaluateConfig 3       evaluateTool 2

## Mutation matrix run by the designer agent

Each row: mutate, run each half, record. "green" means the half did not
detect the mutation.

    MUTATION                                          TSC     RUNTIME
    .d.ts arity +1 on resolveKey                      red     green
    .d.ts boolean->string return on commandExists     red     green
    .d.ts drops Promise<> on walkComponents           red     green
    .d.ts adds/removes key on SatisfiedExpectation    red     green
    .d.ts renames type-only export KeyResolution      red     green
    .mjs resolveKey gains a 3rd param                 green   red
    .mjs drops `required` from a satisfied finding    green   red
    .mjs commandExists returns a string               green   red

Conclusion recorded at capture time: neither half alone detects both
directions. Both are required, and closure is transitive through the pivot
file they share.

## Suppression-directive characterisation

    DIRECTIVE              WITH A LIVE DRIFT      ON A CLEAN TREE
    @ts-expect-error       suppresses, exit 0     TS2578 unused -> exit 1
    @ts-ignore             suppresses, exit 0     silent, exit 0
    @ts-nocheck            suppresses, exit 0     silent, exit 0

So `@ts-expect-error` is self-policing and cannot be added to a clean tree
without turning it red. `@ts-ignore` and `@ts-nocheck` are never flagged in
either state — they are the silent killers, and neither was involved in the
incident above.

## Toolchain facts measured the same run

    tsc@7.0.2 does not auto-discover @types/node from node_modules/@types;
      "types": ["node"] must be explicit, else TS2591.
    createRequire(...).resolve('typescript/bin/tsc')
      -> throws ERR_PACKAGE_PATH_NOT_EXPORTED under typescript@7.0.2.
    node node_modules/typescript/bin/tsc -> works, reports Version 7.0.2.
    A typo'd path in tsconfig "files" -> exit 2, TS6053.
    An "include" glob matching nothing -> silent.
    node --test discovers any .mjs under test/, and counts a zero-test file
      as one passing entry.

## Pre-change baselines

    npm test          -> exit 0, "tests 31 / pass 31 / fail 0"
    npm run lint      -> exit 0
    npm run typecheck -> exit 0
    grep -c -F 'drift there is unchecked by anything' CLAUDE.md      -> 1
    grep -c -F 'test/dts-parity.test.mjs' CLAUDE.md                  -> 1
    grep -r -o -F 'the one thing' <three files> | wc -l              -> 3
    grep -c -F 'rely on manual review against the source modules'
      src/index.d.ts -> 1 ; CLAUDE.md -> 0 ; test/dts-parity.test.mjs -> 0
    @types/node in devDependencies                                   -> undefined
    tsconfig.signature.json                                          -> absent
    ls test/ | grep -c signature                                     -> 0
    grep -rc -F '@ts-ignore' test/                                   -> 0 in all 5 files

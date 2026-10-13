# Capture: corpus probe and mutation evidence for the no-frontmatter flag

Captured 2026-10-13 against `GenvidTechnologies/audit-core` branch
`fix/flag-missing-frontmatter`, behind issue #23 (flag a component with no
frontmatter block as `parseError` `NO_FRONTMATTER`). The wiki page
`frontmatter-parse-error.md` cites this file.

Corpus: `claude-code-plugin-gvt-dev` at `ef5560c` (v4.34.0) and
`claude-code-plugin-gvt-construct3` at `60d6b22`, fresh clones in the session
scratchpad. Both SHAs matched each repo's remote `main` (checked with
`gh api repos/GenvidTechnologies/<repo>/commits/main`). Node v24.11.1 on
Windows.

## Probe script (probe.mjs, verbatim)

It takes the scratchpad directory holding the two clones as `argv[2]`.

```js
import { walkComponents } from 'file:///C:/repos/audit-core/src/component-walk.mjs';
import { readFrontmatter } from 'file:///C:/repos/audit-core/src/frontmatter.mjs';
const SP = process.argv[2];
for (const root of [SP + '/gvtdev/plugin', SP + '/gvtc3/plugin']) {
  const cs = await walkComponents(root);
  const tally = { total: cs.length, readError: 0, parseError: 0, nullBranch: 0, readableNullFm: 0, readable: 0 };
  for (const c of cs) {
    if ('readError' in c) tally.readError++;
    else if ('parseError' in c) tally.parseError++;
    else if (c.frontmatter === null) { tally.nullBranch++; console.log('  null-branch:', c.type, c.name); }
    else tally.readable++;
  }
  console.log(root, JSON.stringify(tally));
}
const NL = String.fromCharCode(10), CR = String.fromCharCode(13), BOM = String.fromCharCode(0xFEFF);
const cases = {
  'no fence': 'body' + NL,
  'empty file': '',
  'adjacent fences ---/---': '---' + NL + '---' + NL + 'body',
  'blank line between fences': '---' + NL + NL + '---' + NL,
  'comment-only': '---' + NL + '# x' + NL + '---' + NL,
  'BOM prefix': BOM + '---' + NL + 'name: x' + NL + '---' + NL,
  'leading blank line': NL + '---' + NL + 'name: x' + NL + '---' + NL,
  'CRLF': '---' + CR + NL + 'name: x' + CR + NL + '---' + CR + NL,
  'unclosed fence': '---' + NL + 'name: x' + NL + 'body',
  'fence only at EOF no trailing NL': '---' + NL + 'name: x' + NL + '---',
};
for (const [k, v] of Object.entries(cases)) console.log(k.padEnd(36), JSON.stringify(readFrontmatter(v)));
```

## Output with the branch `src` (after the fix, commit `cc6d9c5`)

Scratchpad prefix shortened to `<SP>`.

```
<SP>/gvtdev/plugin {"total":32,"readError":0,"parseError":0,"nullBranch":0,"readableNullFm":0,"readable":32}
<SP>/gvtc3/plugin {"total":6,"readError":0,"parseError":0,"nullBranch":0,"readableNullFm":0,"readable":6}
no fence                             null
empty file                           null
adjacent fences ---/---              null
blank line between fences            {"value":{},"error":null}
comment-only                         {"value":{},"error":null}
BOM prefix                           null
leading blank line                   null
CRLF                                 {"value":{"name":"x"},"error":null}
unclosed fence                       null
fence only at EOF no trailing NL     {"value":{"name":"x"},"error":null}
```

The new flag fires on 0 of 38 real components. The pre-fix run (designer,
at `3646fa2`) also showed `nullBranch: 0` for both repos.

## A dead run, kept on record

The first run at the final gate omitted `argv[2]`. `walkComponents` treats a
missing `skills/` or `agents/` tree as empty, so both roots resolved under
`undefined/` and printed `{"total":0,...}`. That reads as "0 flagged" but
walked nothing. Check `total` before trusting the zero.

## Mutation evidence (scratchpad mutate.mjs)

Mutations were applied one at a time, and the full suite was run each time via
`spawnSync(process.execPath, ['--test', '--test-reporter=tap'])`. Each anchor
was asserted to match exactly once, and each restore was checked with
`git diff --quiet`. The tree was clean after the run. Taken at HEAD `c22c348`
with 121 tests:

```
M0 OK  tests 121 pass 121 fail 0
M1 OK  tests 121 pass 118 fail 3
    failed: loadComponent: a file with no frontmatter block is flagged parseError NO_FRONTMATTER
    failed: walkComponents: a no-frontmatter agent carries parseError NO_FRONTMATTER; a good skill has none
    failed: loadComponent: NO_FRONTMATTER agrees with extractFrontmatter === null across edge-case sources
M2 OK  tests 121 pass 120 fail 1
    failed: loadComponent: NO_FRONTMATTER agrees with extractFrontmatter === null across edge-case sources
M3 OK  tests 121 pass 112 fail 9
    failed: loadComponent: a file with valid frontmatter and no metadata.expects yields exactly four keys
    (8 collateral failures omitted)
M4 OK  tests 121 pass 118 fail 3
    failed: loadComponent: NO_FRONTMATTER agrees with extractFrontmatter === null across edge-case sources
    failed: extractFrontmatter: missing frontmatter returns null
    failed: commandExists, parseYaml, and extractFrontmatter return their declared types
status after: clean
```

- M0: a no-op control.
- M1: restores the bare four-key return.
- M2: changes the guard to `!content.startsWith('---')`.
- M3: also flags a readable component with no `metadata.expects`, as a
  negative control.
- M4: makes `readFrontmatter` return a `NO_FRONTMATTER` error instead of
  `null` on no match.

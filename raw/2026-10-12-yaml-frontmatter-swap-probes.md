# Capture: probe and mutation evidence behind the malformed-frontmatter design

Captured 2026-10-12 against `GenvidTechnologies/audit-core` branch
`feat/yaml-frontmatter-parser`. These are the measurements behind issue #4
(swap the hand-rolled frontmatter parser for `yaml`); the wiki page
`frontmatter-parse-error.md` cites this file.

Corpus: `gvt-dev` at `31f2627` and `claude-code-plugin-gvt-construct3` at
`eb682ae` (38 components in all). The post-swap probe and the mutation run were
taken at branch commit `578faa1`. The three probe scripts lived in the session
scratchpad and are summarised below rather than copied; their outputs are
quoted verbatim. The old parser they compare against is a copy of
`src/frontmatter.mjs` as of `1eff0a6`; `yaml` is 2.9.1.

## Probe scripts

* `diff-probe.mjs` (pre-swap): runs the hand-rolled `extractFrontmatter` and
  `yaml` `parseDocument` over every agent and skill file in both corpus repos,
  and classifies differences in `metadata.expects`, `metadata.pillar`,
  `description` and all other keys. Files where `yaml` reports errors go to
  `newErrors`.
* `malformed-probe.mjs`: feeds twelve small hand-written frontmatter blocks to
  both parsers and prints each result. For `yaml`, an error is printed with its
  first `code` and what `toJS()` still returns.
* `d1-probe.mjs` (post-swap): runs the branch's `walkComponents` over the same
  corpus and compares each component against the old parser through the public
  API; counts `parseError` and `readError` components.

## Corpus differential, pre-swap (diff-probe.mjs)

    {
      "total": 38,
      "identicalAll": 37,
      "expectsDiff": [
        "gvt-construct3/plugin/skills/create-c3-op/SKILL.md"
      ],
      "pillarDiff": [],
      "descDiff": [],
      "otherDiff": [],
      "newErrors": []
    }

## Edge cases (malformed-probe.mjs)

    colonSpace
      old: {"name":"x","description":"Use it: now","metadata":{"pillar":"spec"}}
      new: ERRORS(1): BLOCK_AS_IMPLICIT_KEY | toJS={"name":"x","description":{"Use it":"now","metadata":{"pillar":"spec"}}}
    apostrophe
      old: {"title":"It''s here"}
      new: {"title":"It's here"}
    singleNoApos
      old: {"title":"plain"}
      new: {"title":"plain"}
    emptySingle
      old: {"title":""}
      new: {"title":""}
    duplicateKey
      old: {"name":"b"}
      new: ERRORS(1): DUPLICATE_KEY | toJS={"name":"b"}
    tabIndent
      old: {"metadata":null,"pillar":"spec"}
      new: ERRORS(1): TAB_AS_INDENT | toJS={"metadata":null,"pillar":"spec"}
    scalarDoc
      old: {}
      new: "just a string"
    listDoc
      old: {}
      new: ["a","b"]
    emptyDoc
      old: {}
      new: null
    yaml11Bool
      old: {"flag":"yes","ver":1.1,"date":"2026-10-12"}
      new: {"flag":"yes","ver":1.1,"date":"2026-10-12"}
    unclosedQuote
      old: {"description":"\"oops"}
      new: ERRORS(1): MISSING_CHAR | toJS={"description":"oop"}
    anchor
      old: {"a":"&x 1","b":"*x"}
      new: {"a":1,"b":1}

## Corpus differential, post-swap (d1-probe.mjs, `578faa1`)

    {
      "components": 38,
      "expectsDiff": [
        "gvt-construct3/skill/create-c3-op"
      ],
      "pillarDiff": [],
      "descriptionDiff": [],
      "parseErrors": [],
      "readErrors": []
    }

The one `expectsDiff` is the `mcp[0].reason` value in `create-c3-op`, which the
old parser kept whole and `yaml` cuts at the ` #89` comment. Filed upstream as
GenvidTechnologies/claude-code-plugin-gvt-construct3#151.

## Mutation evidence

Posted on audit-core#4
(https://github.com/GenvidTechnologies/audit-core/issues/4#issuecomment-6129794502),
reproduced here. Branch at `578faa1`, clean tree, 86 tests, unmutated run
pass 86 / fail 0. A scratchpad harness applied each mutation alone, asserted
that its anchor matched exactly once, restored the file byte-for-byte in a
`finally`, and checked `git diff --quiet` after each restore. Every restore
was clean and the final `git status --porcelain` was empty.

| Row | Mutation | Result | Failing tests |
|---|---|---|---|
| M1 | ignore yaml errors (`if (doc.errors.length)` -> `if (false)`) | pass 82 / fail 4 | R1; R2a `loadComponent: yaml-rejected frontmatter...`; R2b `walkComponents: a malformed component is passed through...`; R3 signature 5c |
| M2 | drop the non-mapping normalization | pass 84 / fail 2 | N1 string API; N1 component API (`NOT_A_MAPPING`) |
| M3 | drop the `parseError` branch in `loadComponent` | pass 82 / fail 4 | R2a; R2b; N1 component API; R3 signature 5c |
| M4 | return `null` instead of `{}` on a yaml error | pass 85 / fail 1 | R1 |
| M5 (added during execution) | rethrow from the `catch` | pass 85 / fail 1 | `no-throw: an unresolved alias, which makes yaml throw in toJS, yields {}` |

All five matched the predictions written before the run. M5 covers something
the plan did not anticipate: `parseDocument('a: *x').toJS()` throws
("Unresolved alias"), so the no-throw rule needed a `try/catch` mapping a throw
to `parseError.code === "YAML_EXCEPTION"`. A test and the `index.d.ts` comment
were added in `578faa1`.

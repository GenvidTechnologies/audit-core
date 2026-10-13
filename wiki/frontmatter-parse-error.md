---
type: decision-context
title: Malformed-frontmatter parse error
description: Why a component whose frontmatter yaml rejects, or that has no frontmatter block, resolves to a MalformedComponent with parseError while the string API never throws, rather than returning {} alone or falling back to the hand-rolled parser, and what that obliges consumers to do.
tags: [api, typescript, decision, audit-core]
status: stable
stale_after: 2027-10-12
generated: { by: process:maintain-wiki, at: 2026-10-12T00:00:00Z }
usage_window: { from: 2026-10-12, to: 2026-10-12 }
sources:
  - id: issue-4
    resource: https://github.com/GenvidTechnologies/audit-core/issues/4
    title: "audit-core#4 — parse frontmatter with yaml"
    last_modified: 2026-10-12
  - id: evidence-comment
    resource: https://github.com/GenvidTechnologies/audit-core/issues/4#issuecomment-6129794502
    title: Mutation and differential evidence (M1-M5, D1), posted on audit-core#4
    last_modified: 2026-10-12
  - id: probes
    resource: ../raw/2026-10-12-yaml-frontmatter-swap-probes.md
    title: Capture of the swap probes and mutation evidence
    last_modified: 2026-10-12
  - id: c3-151
    resource: https://github.com/GenvidTechnologies/claude-code-plugin-gvt-construct3/issues/151
    title: "gvt-construct3#151 — create-c3-op reason is cut at a ' #89' comment"
    last_modified: 2026-10-12
  - id: issue-23
    resource: https://github.com/GenvidTechnologies/audit-core/issues/23
    title: "audit-core#23 — flag components with no frontmatter block"
    last_modified: 2026-10-13
  - id: probes-23
    resource: ../raw/2026-10-13-no-frontmatter-corpus-probe.md
    title: Capture of the no-frontmatter corpus probe and mutation evidence
    last_modified: 2026-10-13
---

# Malformed-frontmatter parse error

This page records **why** swapping the hand-rolled parser for `yaml` surfaces a
parse failure the way it does. It is a decision record kept in the wiki rather
than in `docs/decisions/`, for the reason given on
[Component read-error shape](component-read-error.md).

## The problem the decision answers

`yaml` rejects input the hand-rolled parser accepted without complaint: a
colon-space plain scalar, a duplicate key, tab indentation, an unclosed
quote[^probes]. The issue's premise, that a colon-space description "currently
loads with empty metadata", was false for the hand-rolled parser, which
accepted it. The swap *introduces* the failure[^issue-4].

Returning `{}` alone would give such a component `expects: null`, which is
indistinguishable from a component that declares no expectations. In the
aggregate audit that is a silent false green.

## The decision

**`{}` plus a `parseError` record, option C.** The string API
(`extractFrontmatter`, `parseYaml`) keeps its signatures and never throws
(gvt-dev ADR-0057 Q2). It returns `{}` on a yaml error, on a non-mapping root,
and when yaml itself throws. An internal `readFrontmatter` returns
`{ value, error }`. `loadComponent` uses it to resolve a malformed file to a
`MalformedComponent`: `{ type, name, expects: null, frontmatter: null,
parseError: { code, message } }`. `code` is yaml's own code, `NOT_A_MAPPING`,
or `YAML_EXCEPTION`. The last was found during execution:
`parseDocument('a: *x').toJS()` throws "Unresolved alias"[^evidence-comment].
It is a sibling of `readError`, the member
[Component read-error shape](component-read-error.md) anticipated rather than
overloading `readError`. The barrel stays at 12 names.

## Options considered

**A. `{}` only, documented.** Rejected: the silent false green above.

**B. Fall back to the hand-rolled parser on error.** Rejected: it keeps the
parser that #4 exists to delete.

**C. `{}` + `parseError` (chosen).** The string API stays total, and the
component record carries the cause.

Returning `null` from the string API was not taken, because `null` already
means "no frontmatter block".

## Accepted semantic changes

`''` now unescapes (closes #11). ` #` starts a comment. Anchors resolve. The
schema is YAML 1.2 core, so dates and `yes` stay strings[^probes]. Over the
38-component corpus there is one divergence: `create-c3-op`'s `reason` is cut
at ` #89`. That is spec-correct and handed upstream as
gvt-construct3#151[^c3-151].

## Ordering

ADR-0051 sequenced the swap before adoption. gvt-dev ADR-0060 (decision A) and
ADR-0071 already record that it moved here after gvt-dev#458; this page does
not re-decide that.

## Consumer obligation

As with `readError`, a consumer that skips components with `expects: null`
silently skips malformed ones too. It must handle `parseError`.

## No frontmatter block (audit-core#23)

A component file with no frontmatter block used to come back as the bare
four-key record (`expects: null, frontmatter: null`, no flag), which the
aggregate audit cannot tell from a component that declares nothing[^issue-23].
`loadComponent` now resolves it to a `MalformedComponent` with
`parseError: { code: 'NO_FRONTMATTER', message }`. The type is unchanged and
the barrel stays at 13 names. The newly flagged inputs are: no fence, an empty
file, adjacent fences (`---\n---`), a UTF-8 BOM before the fence, a leading
blank line, and an unclosed fence. `---\n\n---` and comment-only blocks stay
readable with `{}`, a valid block without `metadata.expects` keeps its four
keys, and `extractFrontmatter` still returns `null` for no block;
`src/frontmatter.mjs` is untouched. A test pins the invariant: `loadComponent`
yields `NO_FRONTMATTER` exactly when `extractFrontmatter` returns `null` over
the same bytes, because both go through the one `readFrontmatter`.

**Chosen: A, reuse `parseError` with code `NO_FRONTMATTER`.** Every consumer
that already handles `parseError` handles this case with no change.

**B. A fourth union member** (for example `UnframedComponent` with
`missingFrontmatter: true`, or a `frontmatterError` field). Rejected:
gvt-construct3's shipped `evaluateComponentLoad`
(`plugin/skills/audit-c3-conventions/scripts/lib/audit.mjs`) returns null for
it, and gvt-dev's planned branch in
GenvidTechnologies/claude-code-plugin-gvt-dev#648 misses it. The case would
stay silent in every consumer until each adopts the new field, which is the
defect being fixed.

**C. A discriminant on every member** (`status: 'ok' | 'unreadable' |
'malformed' | 'unframed'`). Rejected: a breaking restructure of a shape three
consumers already narrow with `in`, and it reopens the C′ decision on
[Component read-error shape](component-read-error.md).

"Parse error" for an absent block is defensible. The file fails the component
grammar (fence, YAML mapping, fence) at the fence step, as `NOT_A_MAPPING`
fails it at the root step; both already sit outside yaml's own codes.

**Accepted inconsistency.** `---\n---` is flagged while `---\n\n---` reads as
`{}`. Widening the frontmatter regex would change the string API
(`extractFrontmatter('---\n---\n')` going from `null` to `{}`), which the
decision above keeps: `null` already means "no frontmatter block".

**Corpus inventory.** Walking gvt-dev at `ef5560c` (32 components) and
gvt-construct3 at `60d6b22` (6 components) newly flags 0 of 38[^probes-23]. The
flag fires only on a future broken file. Check the walked total before reading
a zero: `walkComponents` treats a missing tree as empty, so a probe pointed at
the wrong root reports 0 of 0.

**Deferred.** Narrowing `ReadableComponent.frontmatter` to non-null. No
`loadComponent` path yields a readable `frontmatter: null` any more, but
`Component` is also the evaluators' input type, and hand-built literals in
`test/signature.test.mjs` would stop type-checking. That is a typing change
for consumers, outside #23.

## Evidence

Differential and edge-case probes, and the mutation rows M1-M5 with the commit
and test count they were taken against, are in the raw
capture[^probes] and on the issue[^evidence-comment].

## Related

- [Component read-error shape](component-read-error.md) — the sibling union
  member for I/O failure.

[^issue-4]: audit-core#4.
[^evidence-comment]: Mutation and differential evidence comment on audit-core#4.
[^probes]: [raw/2026-10-12-yaml-frontmatter-swap-probes.md](../raw/2026-10-12-yaml-frontmatter-swap-probes.md).
[^c3-151]: gvt-construct3#151.
[^issue-23]: audit-core#23, https://github.com/GenvidTechnologies/audit-core/issues/23.
[^probes-23]: [raw/2026-10-13-no-frontmatter-corpus-probe.md](../raw/2026-10-13-no-frontmatter-corpus-probe.md).

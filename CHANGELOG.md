# Changelog

All notable changes to `@genvidtech/audit-core` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the package is at `0.x`, a breaking change to the public API takes a
**minor** bump rather than a major one.

## [Unreleased]

### Fixed

- `walkComponents` follows symlinks: a symlinked skill directory (including a
  Windows junction) or a symlinked agent `.md` file is loaded like its target,
  where before it was skipped. A link to a non-component shape is still
  skipped like the real shape.
- `walkComponents` no longer skips a component whose `stat` fails for a reason
  other than absence (such as `EACCES`), nor a dangling link. Each now yields
  an `UnreadableComponent` with `readError` (a dangling link carries `stat`'s
  own code, `'ENOENT'` for a missing target). A `skills/` or `agents/` tree
  that can't be stat'd or listed yields an `UnreadableComponent` named
  `'skills/'` or `'agents/'`; a tree that is absent or not a directory is
  still silently empty
  ([GenvidTechnologies/audit-core#19](https://github.com/GenvidTechnologies/audit-core/issues/19)).
- **Consumer warning:** code that skips a component whose `expects` is null
  (for example `if (!component.expects) continue`) will silently drop these
  new unreadable records, since they also have `expects: null`. Handle
  `readError` explicitly.

## [0.3.0] - 2026-10-12

### Fixed

- `loadComponent` no longer rejects when a component file is missing or
  unreadable (ENOENT, EACCES, EISDIR, EBUSY and the like). It resolves to a
  component carrying `readError: { code, message }`, and `walkComponents`
  passes that component through instead of failing the whole walk
  ([GenvidTechnologies/audit-core#5](https://github.com/GenvidTechnologies/audit-core/issues/5)).
- `''` inside a single-quoted scalar now unescapes to `'` (it was kept
  verbatim by the hand-rolled parser). Subsumed by the move to `yaml`
  ([GenvidTechnologies/audit-core#11](https://github.com/GenvidTechnologies/audit-core/issues/11),
  [GenvidTechnologies/audit-core#4](https://github.com/GenvidTechnologies/audit-core/issues/4)).

### Changed

- `src/frontmatter.mjs` now parses with the `yaml` package (`parseDocument`,
  YAML 1.2, core schema); the hand-rolled subset parser is deleted.
  `extractFrontmatter` and `parseYaml` keep their signatures and still never
  throw: a YAML error, a root that is not a mapping, or an exception from
  `yaml` (such as an unresolved alias) yields `{}`, and `extractFrontmatter`
  still returns `null` when there is no `---` block
  ([GenvidTechnologies/audit-core#4](https://github.com/GenvidTechnologies/audit-core/issues/4)).
- Parsing semantics that change with the swap: a ` #` in a plain scalar now
  starts a YAML comment and truncates the value; anchors and aliases
  resolve; input the old parser accepted but YAML rejects is now a parse
  error (a colon-space plain scalar such as `description: Use it: now`,
  duplicate keys, tab indentation, an unclosed quote). Over the gvt-dev (32
  components) and gvt-construct3 (6) corpora the only difference is one
  `create-c3-op` `reason` cut at ` #89`, tracked as
  [GenvidTechnologies/claude-code-plugin-gvt-construct3#151](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-construct3/issues/151).
- `loadComponent` resolves a file whose frontmatter fails to parse (a yaml
  error, a non-mapping root, or a yaml exception) to a `MalformedComponent`
  `{ type, name, expects: null, frontmatter: null, parseError: { code,
  message } }`, where `code` is yaml's error code, `NOT_A_MAPPING` or
  `YAML_EXCEPTION`; `walkComponents` passes it through. The barrel still
  exports 12 runtime names
  ([GenvidTechnologies/audit-core#4](https://github.com/GenvidTechnologies/audit-core/issues/4)).
- `Component` is now
  `ReadableComponent | UnreadableComponent | MalformedComponent`, with the
  new exported types `ReadableComponent`, `UnreadableComponent`,
  `ComponentReadError`, `MalformedComponent` and `ComponentParseError`. The
  success record keeps its four keys; `readError` and `parseError` are
  absent from it. TypeScript callers narrow with `'readError' in c` and
  `'parseError' in c`
  ([GenvidTechnologies/audit-core#5](https://github.com/GenvidTechnologies/audit-core/issues/5),
  [GenvidTechnologies/audit-core#4](https://github.com/GenvidTechnologies/audit-core/issues/4)).
- **Consumer warning:** code that skips a component whose `expects` is null
  (for example `if (!component.expects) continue`) will now silently skip an
  unreadable or malformed one, since both also have `expects: null`. Handle
  `readError` and `parseError` explicitly.
- `loadComponent` throws `TypeError` for a non-string `filePath`. This also
  rejects the undeclared `URL` and `Buffer` paths that `readFile` used to
  accept. It is a caller-contract violation, not an I/O failure (gvt-dev
  ADR-0057 Q2).

### Added

- `test/frontmatter.test.mjs` and `test/config-resolve.test.mjs`, ported from
  `gvt-dev` so the behaviour of the `frontmatter` and `config-resolve` modules
  is pinned in this repo's own CI
  ([GenvidTechnologies/audit-core#13](https://github.com/GenvidTechnologies/audit-core/issues/13)).

### Removed

- `test/upstream-identity.test.mjs` and the rule that kept the five `src/`
  modules byte-identical to `gvt-dev`'s copies. They are retired because
  `gvt-dev` now consumes this package and has deleted its copies
  ([GenvidTechnologies/claude-code-plugin-gvt-dev#458](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/458)),
  so `npm test` no longer makes network calls
  ([GenvidTechnologies/audit-core#14](https://github.com/GenvidTechnologies/audit-core/issues/14)).

## [0.2.1] - 2026-09-25

### Added

- `test/upstream-identity.test.mjs`, enforcing that the five extracted
  modules in `src/` stay byte-identical to their `gvt-dev` originals: a
  worktree/index check against a committed `RECORD` of git blob SHAs, plus a
  `RECORD`-vs-upstream-at-a-pinned-commit check over
  raw.githubusercontent.com that skips (with a named reason) only when the
  upstream fetch is unreachable
  ([GenvidTechnologies/audit-core#8](https://github.com/GenvidTechnologies/audit-core/issues/8)).

## [0.2.0] - 2026-09-23

### Added

- The shared audit mechanism: five modules extracted from the `gvt-dev`
  plugin's `audit-conventions` skill — `src/frontmatter.mjs`,
  `src/config-resolve.mjs`, `src/probes.mjs`, `src/component-walk.mjs`,
  `src/evaluate.mjs` — the leaf half of
  [GenvidTechnologies/claude-code-plugin-gvt-dev#457](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/457),
  against the seam pinned by ADR-0057. The barrel (`src/index.mjs`) now
  re-exports 12 names in total (`VERSION` plus the 11 functions from the five
  modules).
- Matching hand-written declarations for all 12 exports in `src/index.d.ts`.
- Four new test files (`test/component-walk.test.mjs`,
  `test/dts-parity.test.mjs`, `test/evaluate.test.mjs`,
  `test/probes.test.mjs`), bringing the suite to 31 tests. Behaviour is
  inherited unchanged from the upstream `gvt-dev` extraction — the five
  modules are byte-identical to their `gvt-dev` originals and must stay that
  way while both copies exist.
- `src/frontmatter.mjs` still ships the hand-rolled YAML parser moved
  verbatim from the plugin; swapping its internals to the already-declared
  `yaml` dependency is deferred to the plugin's own follow-up work (ADR-0051
  sequences it as a later step). Consequently `yaml` is currently a declared
  but unused dependency.

## [0.1.0] - 2026-09-19

First real release. `0.0.0` on npm is the one-time bootstrap placeholder from
the original OIDC publishing setup, not a release.

### Added

- Package standup as a no-build, plain-`.mjs` ESM library: sources ship as
  written, with hand-maintained types in `src/index.d.ts` alongside them
  (ADR-0051 in the `gvt-dev` plugin repo).
- Placeholder entry point `src/index.mjs` exporting a `VERSION` marker. The
  shared audit mechanism itself is still pending
  [GenvidTechnologies/claude-code-plugin-gvt-dev#457](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/457),
  whose seam is pinned by ADR-0057.
- `test/smoke.test.mjs`, pinning that the declared export is reachable and
  that `VERSION` agrees with `package.json`, and guaranteeing `node --test`
  always finds at least one test file.
- CI and npm publishing via copied `templates/` workflows from
  `GenvidTechnologies/public-github-actions` — a `v*.*.*`-triggered
  `publish.yml` using OIDC trusted publishing, with no stored npm token.
- The `gvt-dev` convention contract (`CONVENTIONS.md`, `docs/TOC.md`,
  `.gvt-agent.json`) and the scaffolded LLM-wiki under `wiki/`.

[Unreleased]: https://github.com/GenvidTechnologies/audit-core/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/GenvidTechnologies/audit-core/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/GenvidTechnologies/audit-core/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/GenvidTechnologies/audit-core/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/GenvidTechnologies/audit-core/releases/tag/v0.1.0

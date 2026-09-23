# Changelog

All notable changes to `@genvidtech/audit-core` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the package is at `0.x`, a breaking change to the public API takes a
**minor** bump rather than a major one.

## [Unreleased]

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

[Unreleased]: https://github.com/GenvidTechnologies/audit-core/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/GenvidTechnologies/audit-core/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/GenvidTechnologies/audit-core/releases/tag/v0.1.0

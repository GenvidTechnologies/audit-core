# @genvidtech/audit-core

Shared audit mechanism for the gvt-dev and gvt-construct3 convention audits.

`@genvidtech/audit-core` is a **library**, not a CLI — it declares no `bin`
entry and is not meant to be invoked with `npx`. Consumers import it as an
ES module.

This is a standup placeholder release: the actual audit mechanism
implementation is tracked in
[GenvidTechnologies/claude-code-plugin-gvt-dev#457](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/457)
and has not landed yet. `src/index.mjs` currently exports nothing beyond a
version marker.

## Requirements

Node.js >= 22.

## Package shape

This is a no-build, plain-`.mjs` ESM package — it ships its sources as
written, with no TypeScript build step and no `dist/` output. This
deliberately differs from its sibling leaf libraries,
[`@genvidtech/c3source`](https://github.com/GenvidTechnologies/c3source) and
[`@genvidtech/mcp-utils`](https://github.com/GenvidTechnologies/mcp-utils),
which are TypeScript packages that build to `dist/`. Type information for
consumers is provided by a hand-maintained `src/index.d.ts` alongside the
source.

`@genvidtech/audit-core` is peer to `@genvidtech/c3source` and
`@genvidtech/mcp-utils` in the Genvid Technologies npm org.

## License

MIT-0. See [`LICENSE`](./LICENSE).

# @genvidtech/audit-core

Shared audit mechanism for the gvt-dev and gvt-construct3 convention audits.

`@genvidtech/audit-core` is a **library**, not a CLI — it declares no `bin`
entry and is not meant to be invoked with `npx`. Consumers import it as an
ES module.

The mechanism extracted from the `gvt-dev` plugin's `audit-conventions` skill
([GenvidTechnologies/claude-code-plugin-gvt-dev#457](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-dev/issues/457),
seam pinned by ADR-0057 in that repo). The library is deliberately silent: it
emits expectation records and nothing else — no logging, no file writes, no
`process.env` reads, no tally, no rendered Markdown.

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

`yaml` is declared as a dependency but currently **unused**:
`src/frontmatter.mjs` still ships the hand-rolled YAML parser moved verbatim
from the plugin, and swapping its internals to `yaml` is deferred to the
plugin's own follow-up work (ADR-0051 sequences it as a later step).

## API surface

The package barrel (`src/index.mjs`) re-exports 12 names.

### Version

- `VERSION: string` — the package version marker, kept in sync with
  `package.json` (`test/smoke.test.mjs` pins the two agreeing).

### Frontmatter

- `extractFrontmatter(source: string): Record<string, unknown> | null` —
  extracts and parses a skill/agent's `---`-delimited YAML frontmatter block
  from its Markdown source; `null` if no frontmatter block is present.
- `parseYaml(text: string): Record<string, unknown>` — parses the minimal
  YAML subset used by skill/agent frontmatter (scalars, one level of nesting,
  arrays of objects, block scalars). Not a general-purpose YAML parser.

### Config resolution

- `resolveKey(obj: unknown, dottedKey: string): KeyResolution` — resolves a
  dotted key path (`"commands.validate"`) against a parsed JSON object.
  Returns `{ found: true, value }` or `{ found: false, missingAt }`, where
  `missingAt` names the path segment where traversal broke.

### Probes

- `fileExists(path: string): Promise<boolean>` — true only for a regular
  file (a directory at that path returns `false`).
- `dirExists(path: string): Promise<boolean>` — true only for a directory.
- `commandExists(cmd: string): boolean` — synchronous; shells out to
  `where`/`which` depending on platform.

### Component walking

- `walkComponents(pluginRoot: string): Promise<Component[]>` — walks
  `pluginRoot/skills/*/SKILL.md` and `pluginRoot/agents/*.md`, loading each
  component's frontmatter. Skips entries that don't match the expected shape
  rather than throwing.
- `loadComponent(type: ComponentType, name: string, filePath: string): Promise<Component>` —
  reads and parses one component's frontmatter into a `Component` record
  (`{ type, name, expects, frontmatter }`).

### Evaluation

- `evaluateFile(component, entry, resolve): Promise<ExpectationFinding>` —
  evaluates one `metadata.expects.files[]` entry.
- `evaluateConfig(component, entry, resolve): Promise<ExpectationFinding>` —
  evaluates one `metadata.expects.config[]` entry against a JSON file.
- `evaluateTool(component, entry): ExpectationFinding` — evaluates one
  `metadata.expects.tools[]` entry (synchronous — no filesystem read).

None of the three evaluators throw for an expected condition (a missing
file/directory, an unreadable or malformed config, an unresolvable key, or a
command absent from `PATH`) — each returns a finding instead.

## The caller supplies path resolution

`evaluateFile` and `evaluateConfig` never read `process.cwd()` and never
derive a root from their own location. The audited repo's root reaches them
only through a `resolve(entry)` closure the caller supplies, which returns:

- for files: `{ path, probe, target }`, where `probe` is `'file' | 'directory'`
- for config: `{ path, source, target }`

```js
import { evaluateFile } from '@genvidtech/audit-core';
import { join } from 'node:path';

const resolve = (entry) => ({
  path: join(repoRoot, entry.path),
  probe: 'file',
  target: entry.path,
});

const finding = await evaluateFile(component, entry, resolve);
```

`path` is the absolute location to probe; `target`/`source` are the display
strings rendered verbatim into the finding's `detail`.

## Two finding shapes

An `ExpectationFinding` is one of two shapes, discriminated on `ok`:

- **Satisfied** (`ok: true`) — exactly 5 keys: `kind`, `component`, `target`,
  `ok`, `required`.
- **Unsatisfied** (`ok: false`) — the same 5 keys plus `severity`, `detail`,
  and `reason` (8 total).

On the satisfied path, `severity`/`detail`/`reason` are **absent**, not
`undefined` — `Object.keys()` on a satisfied finding returns only the 5 keys.

## License

MIT-0. See [`LICENSE`](./LICENSE).

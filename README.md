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

`yaml` is the frontmatter parser: `src/frontmatter.mjs` delegates to its
`parseDocument` (YAML 1.2, core schema)
([#4](https://github.com/GenvidTechnologies/audit-core/issues/4)). It is the
package's only runtime dependency.

## API surface

The package barrel (`src/index.mjs`) re-exports 13 names.

### Version

- `VERSION: string` — the package version marker, kept in sync with
  `package.json` (`test/smoke.test.mjs` pins the two agreeing).

### Frontmatter

- `extractFrontmatter(source: string): Record<string, unknown> | null` —
  extracts and parses a skill/agent's `---`-delimited YAML frontmatter block
  from its Markdown source; `null` if no frontmatter block is present. A
  block that is malformed or whose root is not a mapping yields `{}`.
- `parseYaml(text: string): Record<string, unknown>` — parses YAML text with
  the `yaml` package and returns a plain object. It never throws for a
  string input: a YAML error, a root that is not a mapping (a scalar,
  including `~`/`null`, or a sequence), or an
  exception from `yaml` (such as an unresolved alias) returns `{}`, as does
  an empty document. Because it is real YAML, `''` inside a single-quoted
  scalar unescapes to `'`, a ` #` in a plain scalar starts a comment, and
  anchors and aliases resolve.

### Config resolution

- `resolveKey(obj: unknown, dottedKey: string): KeyResolution` — resolves a
  dotted key path (`"commands.validate"`) against a parsed JSON object.
  Returns `{ found: true, value }` or `{ found: false, missingAt }`, where
  `missingAt` names the path segment where traversal broke.

### Probes

- `fileExists(path: string): Promise<boolean>` — true only for a regular
  file (a directory at that path returns `false`). It returns `false` on any
  `stat` failure, not only absence.
- `dirExists(path: string): Promise<boolean>` — true only for a directory;
  likewise `false` on any `stat` failure.
- `probePath(path: string): Promise<PathProbe>` — classifies what is at a
  path, for callers that need to tell absence from failure (which
  `fileExists`/`dirExists` cannot). It never rejects. `PathProbe` is one of:
  - `{ kind: 'file' }`, `{ kind: 'directory' }`, or `{ kind: 'other' }` (a
    path that exists but is neither, such as a socket or FIFO);
  - `{ kind: 'absent' }` — nothing at the path, not even a dangling link
    (`stat` reported `ENOENT`/`ENOTDIR` and `lstat` confirmed it);
  - `{ kind: 'error', error: PathProbeError }` — any other `stat` failure
    (such as `EACCES`), a dangling link (carrying `stat`'s own code, e.g.
    `'ENOENT'`), or an `lstat` failure that is not an absence.
    `PathProbeError` is `{ code: string | null, message: string }`, where
    `code` is the Node error code or `null`.
- `commandExists(cmd: string): boolean` — synchronous; shells out to
  `where`/`which` depending on platform.

### Component walking

- `walkComponents(pluginRoot: string): Promise<Component[]>` — walks
  `pluginRoot/skills/*/SKILL.md` and `pluginRoot/agents/*.md`, loading each
  component's frontmatter. Skips entries that don't match the expected shape
  rather than throwing. Symlinks are followed: a symlinked skill directory
  (including a Windows junction) or a symlinked agent `.md` file loads like
  its target, and a link to a non-component shape is skipped like the real
  shape would be. A component file that is found but then can't be
  read is neither skipped nor thrown: it is passed through as an
  `UnreadableComponent` carrying `readError`. That includes a non-absent
  `stat` failure on a component file and a dangling link (`readError.code`
  is `stat`'s own code, `'ENOENT'` for a missing target). A `skills/` or
  `agents/` tree that can't be stat'd or listed yields one
  `UnreadableComponent` named `'skills/'` or `'agents/'`; a tree that is
  absent or not a directory is still silently empty. Likewise a file whose
  frontmatter does not parse is passed through as a `MalformedComponent`
  carrying `parseError`. The only throw is the `TypeError` for a non-string
  `pluginRoot`.
- `loadComponent(type: ComponentType, name: string, filePath: string): Promise<Component>` —
  reads and parses one component's frontmatter into a `Component` record
  (`{ type, name, expects, frontmatter }`). It never rejects for an I/O
  failure: an unreadable file resolves to an `UnreadableComponent`
  (`expects: null`, `frontmatter: null`, `readError: { code, message }`, where
  `code` is the Node error code or `null`). A file whose frontmatter yaml
  rejects, whose root is not a mapping, or on which yaml throws resolves to a
  `MalformedComponent` (`expects: null`, `frontmatter: null`,
  `parseError: { code, message }`, where `code` is yaml's error code,
  `NOT_A_MAPPING` or `YAML_EXCEPTION`). Narrow with `'readError' in c` and
  `'parseError' in c`. `Component` is
  `ReadableComponent | UnreadableComponent | MalformedComponent`; the
  supporting types `ComponentReadError` and `ComponentParseError` are
  exported too. It throws `TypeError` for a non-string `filePath`.

### Evaluation

- `evaluateFile(component, entry, resolve): Promise<ExpectationFinding>` —
  evaluates one `metadata.expects.files[]` entry, probing the path with
  `probePath`. An unsatisfied finding's `detail` takes one of four forms
  (each gets an ` (optional)` suffix when the entry is not required):
  - absent: `<probe> not found`
  - unexaminable: `<probe> could not be checked (<code>)`, falling back to
    the error message when there is no code
  - dangling link: `<probe> could not be checked (dangling link, <code>)`
  - wrong kind: `expected a <probe>, found a <kind>`, or `expected a <probe>,
    found neither a file nor a directory`

  It says "could not be checked" rather than "exists" because an `EACCES`
  from `stat` usually comes from an unsearchable parent directory, so
  existence is unknown. `ok`, `severity`, the finding shape and the exit code
  do not depend on which form is used.
- `evaluateConfig(component, entry, resolve): Promise<ExpectationFinding>` —
  evaluates one `metadata.expects.config[]` entry against a JSON file.
- `evaluateTool(component, entry): ExpectationFinding` — evaluates one
  `metadata.expects.tools[]` entry (synchronous — no filesystem read).

None of the three evaluators throw for an expected condition (a missing
file/directory, any other `stat` outcome on a file expectation, an
unreadable or malformed config, an unresolvable key, or a command absent
from `PATH`) — each returns a finding instead. The loaders
follow the same rule for I/O and for parsing: a file that can't be read
becomes a `readError` on the returned component, and one whose frontmatter
doesn't parse becomes a `parseError`, not a rejection. Both leave
`expects: null`, so check for them before skipping on a null `expects`.

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

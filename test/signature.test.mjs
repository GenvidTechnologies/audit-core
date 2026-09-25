// Typed signature fixture: the single hand-written pivot that both `node
// --test` and a `tsc` spawn exercise. `tsc -p tsconfig.signature.json` checks
// this file's JSDoc annotations against src/index.d.ts (confirmed by
// --listFiles to load index.d.ts and this file, never index.mjs); `node
// --test` runs its runtime assertions against src/index.mjs. Neither half
// alone proves the two agree -- tsc never sees the .mjs and the runtime never
// sees the declared types -- so agreement is only established transitively,
// through this file.
//
// Every call result below is assigned to a local carrying an explicit
// `@type` annotation, and the runtime assertion is made against that local.
// Passing a call result straight into an `unknown`-typed assert parameter
// erases the type: a boolean-to-string mutation and a dropped-Promise
// mutation both stayed green until the annotated-local form was used.
//
// Nothing here spawns `tsc` yet -- that lands in F1. Until then this file is
// plain JS to `node --test`, which ignores the type annotations entirely.
//
// Imports by the published package name, not a relative src/ path, so the
// self-reference exercises the same `exports` map a real consumer resolves
// through -- confirmed at runtime to yield the 12-name barrel.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as audit from '@genvidtech/audit-core';

const {
  extractFrontmatter,
  parseYaml,
  resolveKey,
  commandExists,
  evaluateFile,
  evaluateConfig,
  evaluateTool,
} = audit;

/**
 * @typedef {import('@genvidtech/audit-core').KeyResolution} KeyResolution
 * @typedef {import('@genvidtech/audit-core').ComponentType} ComponentType
 * @typedef {import('@genvidtech/audit-core').Expects} Expects
 * @typedef {import('@genvidtech/audit-core').Component} Component
 * @typedef {import('@genvidtech/audit-core').ExpectsFileEntry} ExpectsFileEntry
 * @typedef {import('@genvidtech/audit-core').ExpectsConfigEntry} ExpectsConfigEntry
 * @typedef {import('@genvidtech/audit-core').ExpectsToolEntry} ExpectsToolEntry
 * @typedef {import('@genvidtech/audit-core').ExpectationKind} ExpectationKind
 * @typedef {import('@genvidtech/audit-core').Severity} Severity
 * @typedef {import('@genvidtech/audit-core').SatisfiedExpectation} SatisfiedExpectation
 * @typedef {import('@genvidtech/audit-core').UnsatisfiedExpectation} UnsatisfiedExpectation
 * @typedef {import('@genvidtech/audit-core').ExpectationFinding} ExpectationFinding
 * @typedef {import('@genvidtech/audit-core').FileResolution} FileResolution
 * @typedef {import('@genvidtech/audit-core').ConfigResolution} ConfigResolution
 * @typedef {import('@genvidtech/audit-core').FileResolver} FileResolver
 * @typedef {import('@genvidtech/audit-core').ConfigResolver} ConfigResolver
 */

// 1. Arity -- tsc pins each literal to the .d.ts parameter list; node pins
//    fn.length to the .mjs. One assertion per exported function (11 of the
//    barrel's 12 exports; VERSION is the twelfth, a string, not a function).
test('exported function arity matches the declared parameter count in src/index.d.ts', () => {
  /** @type {Parameters<typeof extractFrontmatter>['length']} */
  const A_extractFrontmatter = 1;
  assert.equal(extractFrontmatter.length, A_extractFrontmatter);

  /** @type {Parameters<typeof parseYaml>['length']} */
  const A_parseYaml = 1;
  assert.equal(parseYaml.length, A_parseYaml);

  /** @type {Parameters<typeof resolveKey>['length']} */
  const A_resolveKey = 2;
  assert.equal(resolveKey.length, A_resolveKey);

  /** @type {Parameters<typeof audit.fileExists>['length']} */
  const A_fileExists = 1;
  assert.equal(audit.fileExists.length, A_fileExists);

  /** @type {Parameters<typeof audit.dirExists>['length']} */
  const A_dirExists = 1;
  assert.equal(audit.dirExists.length, A_dirExists);

  /** @type {Parameters<typeof commandExists>['length']} */
  const A_commandExists = 1;
  assert.equal(commandExists.length, A_commandExists);

  /** @type {Parameters<typeof audit.walkComponents>['length']} */
  const A_walkComponents = 1;
  assert.equal(audit.walkComponents.length, A_walkComponents);

  /** @type {Parameters<typeof audit.loadComponent>['length']} */
  const A_loadComponent = 3;
  assert.equal(audit.loadComponent.length, A_loadComponent);

  /** @type {Parameters<typeof evaluateFile>['length']} */
  const A_evaluateFile = 3;
  assert.equal(evaluateFile.length, A_evaluateFile);

  /** @type {Parameters<typeof evaluateConfig>['length']} */
  const A_evaluateConfig = 3;
  assert.equal(evaluateConfig.length, A_evaluateConfig);

  /** @type {Parameters<typeof evaluateTool>['length']} */
  const A_evaluateTool = 2;
  assert.equal(evaluateTool.length, A_evaluateTool);
});

// 2. Completeness guard -- a newly-declared export fails here until this
//    fixture is updated to cover it, and `keyof typeof import(...)` is pinned
//    by tsc against the actual barrel type, not a hand-copied list.
test('barrel exports exactly the 12 names declared in src/index.d.ts (completeness guard)', () => {
  /** @type {Record<keyof typeof import('@genvidtech/audit-core'), true>} */
  const COVERED = {
    VERSION: true,
    extractFrontmatter: true,
    parseYaml: true,
    resolveKey: true,
    fileExists: true,
    dirExists: true,
    commandExists: true,
    walkComponents: true,
    loadComponent: true,
    evaluateFile: true,
    evaluateConfig: true,
    evaluateTool: true,
  };
  assert.deepEqual(Object.keys(audit).sort(), Object.keys(COVERED).sort());
});

// 3. Return type -- the declared KeyResolution discriminated union, both
//    branches, each assigned to an annotated local before assertion.
test('resolveKey returns the declared KeyResolution discriminated union', () => {
  /** @type {KeyResolution} */
  const found = resolveKey({ project: { name: 'genvid' } }, 'project.name');
  assert.equal(found.found, true);
  if (!found.found) throw new Error('expected found.found to be true');
  assert.equal(found.value, 'genvid');

  /** @type {KeyResolution} */
  const notFound = resolveKey({ project: {} }, 'project.name');
  assert.equal(notFound.found, false);
  if (notFound.found) throw new Error('expected notFound.found to be false');
  assert.equal(notFound.missingAt, 'project.name');
});

// 4. Annotated-local return-type checks for the remaining primitive/object
//    return shapes.
test('commandExists, parseYaml, and extractFrontmatter return their declared types', () => {
  /** @type {boolean} */
  const ok = commandExists('node');
  assert.equal(typeof ok, 'boolean');

  /** @type {boolean} */
  const missing = commandExists('definitely-not-a-real-command-xyz');
  assert.equal(missing, false);

  /** @type {Record<string, unknown>} */
  const parsed = parseYaml('name: my-skill\ndescription: x\n');
  assert.equal(parsed.name, 'my-skill');

  /** @type {Record<string, unknown> | null} */
  const front = extractFrontmatter('---\nname: my-skill\ndescription: x\n---\nbody\n');
  assert.notEqual(front, null);
  assert.equal(front && front.name, 'my-skill');

  /** @type {Record<string, unknown> | null} */
  const noFront = extractFrontmatter('no frontmatter here\n');
  assert.equal(noFront, null);
});

// 5. Return key set -- Record<keyof Component, true> errors on both a
//    missing key (TS2741) and an excess key (TS2353).
test('a Component literal satisfies the declared 4-key shape', () => {
  /** @type {ComponentType} */
  const type = 'skill';

  /** @type {Expects} */
  const expects = { files: [{ path: 'CLAUDE.md', reason: 'r' }] };

  /** @type {Component} */
  const component = {
    type,
    name: 'my-skill',
    expects,
    frontmatter: { name: 'my-skill' },
  };

  /** @type {Record<keyof Component, true>} */
  const COMPONENT_KEYS = {
    type: true, name: true, expects: true, frontmatter: true,
  };
  assert.deepEqual(Object.keys(component).sort(), Object.keys(COMPONENT_KEYS).sort());
});

// 6. Return key set on a real call result -- evaluateTool's satisfied branch
//    carries exactly the 5-key SatisfiedExpectation shape.
test('evaluateTool returns a SatisfiedExpectation with exactly its declared 5 keys', () => {
  /** @type {Component} */
  const component = {
    type: 'skill', name: 'some-skill', expects: null, frontmatter: null,
  };

  /** @type {ExpectsToolEntry} */
  const entry = { command: 'node', reason: 'Required tool' };

  /** @type {ExpectationFinding} */
  const finding = evaluateTool(component, entry);
  assert.equal(finding.ok, true);

  /** @type {Record<keyof SatisfiedExpectation, true>} */
  const SATISFIED_KEYS = {
    kind: true, component: true, target: true, ok: true, required: true,
  };
  assert.deepEqual(Object.keys(finding).sort(), Object.keys(SATISFIED_KEYS).sort());
});

// 7. The unsatisfied branch: 8-key UnsatisfiedExpectation shape, plus a real
//    discriminated-union narrow (the `if (finding.ok) throw` below is what
//    makes `.kind`/`.severity` accessible under strict mode) exercising the
//    resolver function types and their return shapes.
test('evaluateFile and evaluateConfig return the declared 8-key shape for the unsatisfied branch', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'signature-test-'));
  try {
    /** @type {Component} */
    const component = {
      type: 'skill', name: 'some-skill', expects: null, frontmatter: null,
    };

    /** @type {ExpectsFileEntry} */
    const fileEntry = { path: 'MISSING.md', reason: 'Required file' };

    /** @type {FileResolver} */
    const fileResolve = (e) => {
      /** @type {FileResolution} */
      const resolution = { path: join(dir, e.path), probe: 'file', target: e.path };
      return resolution;
    };

    // Bind the UNAWAITED call to a Promise-annotated local first. Awaiting a
    // non-Promise is legal TypeScript, so annotating only the awaited value
    // would not pin the declared Promise<> wrapper -- dropping it from
    // index.d.ts would typecheck clean. See the four async exports above.
    /** @type {Promise<ExpectationFinding>} */
    const fileFindingPromise = evaluateFile(component, fileEntry, fileResolve);
    /** @type {ExpectationFinding} */
    const fileFinding = await fileFindingPromise;
    if (fileFinding.ok) throw new Error('expected an unsatisfied finding');

    /** @type {ExpectationKind} */
    const fileKind = fileFinding.kind;
    assert.equal(fileKind, 'file');

    /** @type {Severity} */
    const severity = fileFinding.severity;
    assert.equal(typeof severity, 'string');

    /** @type {ExpectsConfigEntry} */
    const configEntry = { key: 'project.name', reason: 'Required config key' };

    /** @type {ConfigResolver} */
    const configResolve = (e) => {
      /** @type {ConfigResolution} */
      const resolution = { path: join(dir, 'MISSING.json'), source: 'MISSING.json', target: `${e.key} in MISSING.json` };
      return resolution;
    };

    /** @type {Promise<ExpectationFinding>} */
    const configFindingPromise = evaluateConfig(component, configEntry, configResolve);
    /** @type {ExpectationFinding} */
    const configFinding = await configFindingPromise;
    if (configFinding.ok) throw new Error('expected an unsatisfied finding');

    /** @type {Record<keyof UnsatisfiedExpectation, true>} */
    const UNSATISFIED_KEYS = {
      kind: true, component: true, target: true, ok: true, required: true,
      severity: true, detail: true, reason: true,
    };
    assert.deepEqual(Object.keys(fileFinding).sort(), Object.keys(UNSATISFIED_KEYS).sort());
    assert.deepEqual(Object.keys(configFinding).sort(), Object.keys(UNSATISFIED_KEYS).sort());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// 8. Return type, async form -- fileExists, dirExists, walkComponents, and
//    loadComponent all declare a Promise<...> return, and none of them had
//    any return-shape coverage before this block: they were checked only by
//    the arity assertion and the completeness guard's name list, neither of
//    which pins a return type. `/** @type {boolean} */ const x = await
//    fileExists(p)` was MEASURED to not catch a dropped `Promise<>` --
//    awaiting a non-Promise value is legal TypeScript, so the awaited type
//    still matches. Binding the unawaited call to a `Promise<T>`-annotated
//    local first, and only then awaiting into a second annotated local,
//    forces tsc to check the call's actual return type against `Promise<T>`
//    before any `await` can paper over the difference.
test('fileExists, dirExists, walkComponents, and loadComponent return their declared Promise-wrapped types', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'signature-async-'));
  try {
    const probeFile = join(dir, 'probe.txt');
    await writeFile(probeFile, 'probe');

    /** @type {Promise<boolean>} */
    const fileExistsPromise = audit.fileExists(probeFile);
    /** @type {boolean} */
    const fileExistsResult = await fileExistsPromise;
    assert.equal(fileExistsResult, true);

    /** @type {Promise<boolean>} */
    const dirExistsPromise = audit.dirExists(dir);
    /** @type {boolean} */
    const dirExistsResult = await dirExistsPromise;
    assert.equal(dirExistsResult, true);

    const skillsDir = join(dir, 'skills', 'sample-skill');
    await mkdir(skillsDir, { recursive: true });
    const skillFile = join(skillsDir, 'SKILL.md');
    await writeFile(skillFile, '---\nname: sample-skill\ndescription: x\n---\nbody\n');

    /** @type {Promise<Component[]>} */
    const walkPromise = audit.walkComponents(dir);
    /** @type {Component[]} */
    const components = await walkPromise;
    assert.equal(components.length, 1);
    assert.equal(components[0].name, 'sample-skill');

    /** @type {Promise<Component>} */
    const loadPromise = audit.loadComponent('skill', 'sample-skill', skillFile);
    /** @type {Component} */
    const loaded = await loadPromise;
    assert.equal(loaded.name, 'sample-skill');
    assert.equal(loaded.type, 'skill');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

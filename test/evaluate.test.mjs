import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { evaluateFile, evaluateConfig, evaluateTool } from '../src/evaluate.mjs';

const component = { name: 'some-skill' };

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'evaluate-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// 1. satisfied file
test('evaluateFile: satisfied', async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, 'CLAUDE.md');
    await writeFile(filePath, 'hi\n');
    const entry = { path: 'CLAUDE.md', reason: 'Required file' };
    const resolve = () => ({ path: filePath, probe: 'file', target: 'CLAUDE.md' });
    const f = await evaluateFile(component, entry, resolve);
    assert.equal(f.ok, true);
    assert.deepEqual(f, {
      kind: 'file', component: 'some-skill', target: 'CLAUDE.md', ok: true, required: true,
    });
  });
});

// 2. satisfied config
test('evaluateConfig: satisfied', async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, '.gvt-agent.json');
    await writeFile(filePath, JSON.stringify({ project: { name: 'genvid' } }));
    const entry = { key: 'project.name', reason: 'Required config key' };
    const resolve = () => ({ path: filePath, source: '.gvt-agent.json', target: 'project.name in .gvt-agent.json' });
    const f = await evaluateConfig(component, entry, resolve);
    assert.equal(f.ok, true);
    assert.deepEqual(f, {
      kind: 'config', component: 'some-skill', target: 'project.name in .gvt-agent.json', ok: true, required: true,
    });
  });
});

// 3. satisfied tool
test('evaluateTool: satisfied', () => {
  const entry = { command: 'node', reason: 'Required tool' };
  const f = evaluateTool(component, entry);
  assert.equal(f.ok, true);
  assert.deepEqual(f, {
    kind: 'tool', component: 'some-skill', target: 'node', ok: true, required: true,
  });
});

// 4. unsatisfied file
test('evaluateFile: unsatisfied', async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, 'MISSING.md');
    const entry = { path: 'MISSING.md', reason: 'Required file' };
    const resolve = () => ({ path: filePath, probe: 'file', target: 'MISSING.md' });
    const f = await evaluateFile(component, entry, resolve);
    assert.equal(f.ok, false);
    assert.equal(f.severity, 'error');
    assert.equal(f.detail, 'file not found');
  });
});

// 5. unsatisfied config
test('evaluateConfig: unsatisfied (key not found)', async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, '.gvt-agent.json');
    await writeFile(filePath, JSON.stringify({ project: {} }));
    const entry = { key: 'project.name', reason: 'Required config key' };
    const resolve = () => ({ path: filePath, source: '.gvt-agent.json', target: 'project.name in .gvt-agent.json' });
    const f = await evaluateConfig(component, entry, resolve);
    assert.equal(f.ok, false);
    assert.equal(f.severity, 'error');
    assert.equal(f.detail, 'key not found (path broke at "project.name")');
  });
});

// 6. unsatisfied tool
test('evaluateTool: unsatisfied', () => {
  const entry = { command: 'definitely-not-a-real-command-xyz', reason: 'Required tool' };
  const f = evaluateTool(component, entry);
  assert.equal(f.ok, false);
  assert.equal(f.severity, 'error');
  assert.equal(f.detail, 'command not found on PATH');
});

// 7. satisfied findings carry exactly the 5-key shape, across all three kinds
test('satisfied findings: exactly 5 keys, all three kinds', async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, 'CLAUDE.md');
    await writeFile(filePath, 'hi\n');
    const configPath = join(dir, '.gvt-agent.json');
    await writeFile(configPath, JSON.stringify({ project: { name: 'genvid' } }));

    const fileFinding = await evaluateFile(
      component,
      { path: 'CLAUDE.md', reason: 'r' },
      () => ({ path: filePath, probe: 'file', target: 'CLAUDE.md' }),
    );
    const configFinding = await evaluateConfig(
      component,
      { key: 'project.name', reason: 'r' },
      () => ({ path: configPath, source: '.gvt-agent.json', target: 'project.name in .gvt-agent.json' }),
    );
    const toolFinding = evaluateTool(component, { command: 'node', reason: 'r' });

    const expectedKeys = ['component', 'kind', 'ok', 'required', 'target'];
    assert.deepEqual(Object.keys(fileFinding).sort(), expectedKeys);
    assert.deepEqual(Object.keys(configFinding).sort(), expectedKeys);
    assert.deepEqual(Object.keys(toolFinding).sort(), expectedKeys);
  });
});

// 8. unsatisfied findings carry exactly the 8-key shape, across all three kinds
test('unsatisfied findings: exactly 8 keys, all three kinds', async () => {
  await withTempDir(async (dir) => {
    const missingFilePath = join(dir, 'MISSING.md');
    const missingConfigPath = join(dir, 'MISSING.json');

    const fileFinding = await evaluateFile(
      component,
      { path: 'MISSING.md', reason: 'r' },
      () => ({ path: missingFilePath, probe: 'file', target: 'MISSING.md' }),
    );
    const configFinding = await evaluateConfig(
      component,
      { key: 'project.name', reason: 'r' },
      () => ({ path: missingConfigPath, source: 'MISSING.json', target: 'project.name in MISSING.json' }),
    );
    const toolFinding = evaluateTool(component, { command: 'definitely-not-a-real-command-xyz', reason: 'r' });

    const expectedKeys = ['component', 'detail', 'kind', 'ok', 'reason', 'required', 'severity', 'target'];
    assert.deepEqual(Object.keys(fileFinding).sort(), expectedKeys);
    assert.deepEqual(Object.keys(configFinding).sort(), expectedKeys);
    assert.deepEqual(Object.keys(toolFinding).sort(), expectedKeys);
  });
});

// 9. required: false yields severity 'info' and a detail ending ' (optional)';
//    required yields 'error' and no suffix
test('required vs optional: severity and detail suffix', async () => {
  await withTempDir(async (dir) => {
    const missingPath = join(dir, 'MISSING.md');
    const resolve = () => ({ path: missingPath, probe: 'file', target: 'MISSING.md' });

    const requiredFinding = await evaluateFile(component, { path: 'MISSING.md', reason: 'r' }, resolve);
    assert.equal(requiredFinding.severity, 'error');
    assert.equal(requiredFinding.detail.endsWith(' (optional)'), false);

    const optionalFinding = await evaluateFile(component, { path: 'MISSING.md', required: false, reason: 'r' }, resolve);
    assert.equal(optionalFinding.severity, 'info');
    assert.equal(optionalFinding.detail.endsWith(' (optional)'), true);
  });
});

// 10. evaluateConfig: missing file vs. unreadable/malformed file are different branches
test('evaluateConfig: missing file vs. malformed file produce different detail branches', async () => {
  await withTempDir(async (dir) => {
    const missingPath = join(dir, 'MISSING.json');
    const missingFinding = await evaluateConfig(
      component,
      { key: 'project.name', reason: 'r' },
      () => ({ path: missingPath, source: 'MISSING.json', target: 'project.name in MISSING.json' }),
    );
    assert.equal(missingFinding.detail, 'MISSING.json not found');

    const malformedPath = join(dir, 'BAD.json');
    await writeFile(malformedPath, '{ not valid json');
    const malformedFinding = await evaluateConfig(
      component,
      { key: 'project.name', reason: 'r' },
      () => ({ path: malformedPath, source: 'BAD.json', target: 'project.name in BAD.json' }),
    );
    assert.match(malformedFinding.detail, /^BAD\.json unreadable \(/);
    assert.notEqual(missingFinding.detail, malformedFinding.detail);
  });
});

// 11. evaluateConfig: key does not resolve
test('evaluateConfig: unresolvable key reports where the path broke', async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, '.gvt-agent.json');
    await writeFile(configPath, JSON.stringify({ commands: {} }));
    const f = await evaluateConfig(
      component,
      { key: 'commands.validate', reason: 'r' },
      () => ({ path: configPath, source: '.gvt-agent.json', target: 'commands.validate in .gvt-agent.json' }),
    );
    assert.equal(f.detail, 'key not found (path broke at "commands.validate")');
  });
});

// 12. the probe-noun case: resolve's `probe` drives the rendered noun, from the
//     same code path (ADR-0057 verdict A / verdict C proved by execution)
test('evaluateFile: probe noun renders directory vs. file from the same code path', async () => {
  await withTempDir(async (dir) => {
    const missingDirPath = join(dir, 'missing-dir');
    const dirFinding = await evaluateFile(
      component,
      { path: 'missing-dir/', reason: 'r' },
      () => ({ path: missingDirPath, probe: 'directory', target: 'missing-dir/' }),
    );
    assert.equal(dirFinding.detail, 'directory not found');

    const missingFilePath = join(dir, 'missing-file.md');
    const fileFinding = await evaluateFile(
      component,
      { path: 'missing-file.md', reason: 'r' },
      () => ({ path: missingFilePath, probe: 'file', target: 'missing-file.md' }),
    );
    assert.equal(fileFinding.detail, 'file not found');
  });
});

// 13. Two independent resolve() shapes prove ADR-0057 verdicts A and C by
//     execution rather than assertion. The library does no path resolution
//     and no probe-choice policy of its own (verdict A); the resolver's
//     `probe` noun is rendered verbatim into `detail` from the one code path
//     (verdict C). gvt-dev's resolver marks a directory via a trailing slash
//     on the declared path and always hands back a bare `target`;
//     gvt-construct3 has no directory-marker convention, so its resolver
//     always reports `probe: 'file'` and disambiguates `target` with a
//     "(project root: <name>)" suffix instead. This is a mitigation for the
//     seam having exactly one live caller today (gvt-construct3 is blocked on
//     its own prerequisite) -- it is not a substitute for a second real
//     caller, and its presence should not be read as more than that.
test('evaluate: two differently-shaped resolvers prove ADR-0057 verdicts A and C', async () => {
  await withTempDir(async (dir) => {
    const gvtDevResolve = (entry) => {
      const isDir = entry.path.endsWith('/');
      const trimmed = isDir ? entry.path.slice(0, -1) : entry.path;
      return {
        path: join(dir, trimmed),
        probe: isDir ? 'directory' : 'file',
        target: entry.path,
      };
    };

    const c3Resolve = (entry) => {
      const trimmed = entry.path.endsWith('/') ? entry.path.slice(0, -1) : entry.path;
      return {
        path: join(dir, trimmed),
        probe: 'file',
        target: `${entry.path} (project root: bunny-game)`,
      };
    };

    // (a) same missing directory-shaped path through both resolvers: the
    // rendered detail differs ONLY by the probe noun ('directory' vs 'file').
    const entry = { path: 'missing-thing/', reason: 'r' };
    const gvtDevFinding = await evaluateFile(component, entry, gvtDevResolve);
    const c3Finding = await evaluateFile(component, entry, c3Resolve);

    assert.equal(gvtDevFinding.detail, 'directory not found');
    assert.equal(c3Finding.detail, 'file not found');
    assert.equal(
      gvtDevFinding.detail.replace('directory', 'file'),
      c3Finding.detail,
      'the two details must differ only by the probe noun',
    );

    // (b) the c3-shaped resolver, on an optional missing entry, reproduces
    // the shared "not found (optional)" wording byte-exactly -- the library
    // renders the same suffix regardless of which resolver supplied it.
    const optionalEntry = { path: 'optional-thing.md', required: false, reason: 'r' };
    const c3OptionalFinding = await evaluateFile(component, optionalEntry, c3Resolve);
    assert.equal(c3OptionalFinding.detail, 'file not found (optional)');
  });
});

// 14. None of the three evaluators throw for an expected condition -- a
//     missing file, a missing config file, a malformed config, an
//     unresolvable key, or a command absent from PATH. The library's one
//     permitted throw is walkComponents's TypeError on a non-string plugin
//     root (component-walk.test.mjs), which none of these paths touch.
test('evaluate: never throws for an expected condition -- returns a finding instead', async () => {
  await withTempDir(async (dir) => {
    const missingFilePath = join(dir, 'MISSING.md');
    await assert.doesNotReject(() => evaluateFile(
      component,
      { path: 'MISSING.md', reason: 'r' },
      () => ({ path: missingFilePath, probe: 'file', target: 'MISSING.md' }),
    ));
    const missingFileFinding = await evaluateFile(
      component,
      { path: 'MISSING.md', reason: 'r' },
      () => ({ path: missingFilePath, probe: 'file', target: 'MISSING.md' }),
    );
    assert.equal(missingFileFinding.ok, false);

    const missingConfigPath = join(dir, 'MISSING.json');
    await assert.doesNotReject(() => evaluateConfig(
      component,
      { key: 'project.name', reason: 'r' },
      () => ({ path: missingConfigPath, source: 'MISSING.json', target: 'project.name in MISSING.json' }),
    ));
    const missingConfigFinding = await evaluateConfig(
      component,
      { key: 'project.name', reason: 'r' },
      () => ({ path: missingConfigPath, source: 'MISSING.json', target: 'project.name in MISSING.json' }),
    );
    assert.equal(missingConfigFinding.ok, false);

    const malformedPath = join(dir, 'BAD.json');
    await writeFile(malformedPath, '{ not valid json');
    await assert.doesNotReject(() => evaluateConfig(
      component,
      { key: 'project.name', reason: 'r' },
      () => ({ path: malformedPath, source: 'BAD.json', target: 'project.name in BAD.json' }),
    ));
    const malformedFinding = await evaluateConfig(
      component,
      { key: 'project.name', reason: 'r' },
      () => ({ path: malformedPath, source: 'BAD.json', target: 'project.name in BAD.json' }),
    );
    assert.equal(malformedFinding.ok, false);

    const unresolvablePath = join(dir, 'OK.json');
    await writeFile(unresolvablePath, JSON.stringify({ commands: {} }));
    await assert.doesNotReject(() => evaluateConfig(
      component,
      { key: 'commands.validate', reason: 'r' },
      () => ({ path: unresolvablePath, source: 'OK.json', target: 'commands.validate in OK.json' }),
    ));
    const unresolvableFinding = await evaluateConfig(
      component,
      { key: 'commands.validate', reason: 'r' },
      () => ({ path: unresolvablePath, source: 'OK.json', target: 'commands.validate in OK.json' }),
    );
    assert.equal(unresolvableFinding.ok, false);

    assert.doesNotThrow(() => evaluateTool(component, { command: 'definitely-not-a-real-command-xyz', reason: 'r' }));
    const missingToolFinding = evaluateTool(component, { command: 'definitely-not-a-real-command-xyz', reason: 'r' });
    assert.equal(missingToolFinding.ok, false);
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises } from 'node:fs';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { walkComponents, loadComponent } from '../src/component-walk.mjs';

// Note: the gvt-dev original of this file carries an 8th case -- a
// descriptionLengthOf/descriptionLength differential against gvt-dev's own 32
// skill/agent components. That case imports lib/description-length.mjs and
// lib/fs-walk.mjs, neither of which is part of this extraction, and it
// exercises a 32-component corpus that is gvt-dev's own plugin/ tree, which
// does not exist here. It validates the gvt-dev refactor, not this library,
// and stays there.

async function withTempRepo(setup) {
  const dir = await mkdtemp(join(tmpdir(), 'component-walk-test-'));
  try {
    await setup(dir);
    return dir;
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    throw err;
  }
}

async function writeRepoFile(dir, rel, content) {
  const path = join(dir, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

test('walkComponents: a skills/<name>/SKILL.md fixture is discovered as {type: "skill"}', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/my-skill/SKILL.md', '---\nname: my-skill\ndescription: x\n---\nbody\n');
  });
  try {
    const components = await walkComponents(dir);
    assert.deepEqual(
      components.map((c) => ({ type: c.type, name: c.name })),
      [{ type: 'skill', name: 'my-skill' }]
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents: a skills/<name>/ directory without SKILL.md is skipped', async () => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'skills', 'no-manifest'), { recursive: true });
    await writeRepoFile(d, 'skills/no-manifest/notes.md', 'not a manifest\n');
  });
  try {
    const components = await walkComponents(dir);
    assert.deepEqual(components, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents: a non-.md file in agents/ is skipped', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'agents/notes.txt', 'not an agent\n');
  });
  try {
    const components = await walkComponents(dir);
    assert.deepEqual(components, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents: a missing skills/ directory is tolerated (returns only agents)', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'agents/my-agent.md', '---\nname: my-agent\ndescription: x\n---\nbody\n');
  });
  try {
    const components = await walkComponents(dir);
    assert.deepEqual(
      components.map((c) => ({ type: c.type, name: c.name })),
      [{ type: 'agent', name: 'my-agent' }]
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents: a missing agents/ directory is tolerated (returns only skills)', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/my-skill/SKILL.md', '---\nname: my-skill\ndescription: x\n---\nbody\n');
  });
  try {
    const components = await walkComponents(dir);
    assert.deepEqual(
      components.map((c) => ({ type: c.type, name: c.name })),
      [{ type: 'skill', name: 'my-skill' }]
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadComponent: a file with no frontmatter yields {expects: null, frontmatter: null}', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/plain/SKILL.md', 'no frontmatter here\n');
  });
  try {
    const component = await loadComponent('skill', 'plain', join(dir, 'skills', 'plain', 'SKILL.md'));
    assert.deepEqual(component, { type: 'skill', name: 'plain', expects: null, frontmatter: null });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const MASKED = '<masked>';

function maskMessage(r) {
  return { ...r, readError: { ...r.readError, message: MASKED } };
}

test('loadComponent: a missing file resolves to an UnreadableComponent with readError.code ENOENT', async () => {
  const dir = await withTempRepo(async () => {});
  try {
    const r = await loadComponent('skill', 'ghost', join(dir, 'never-created.md'));
    assert.deepEqual(maskMessage(r), {
      type: 'skill',
      name: 'ghost',
      expects: null,
      frontmatter: null,
      readError: { code: 'ENOENT', message: MASKED },
    });
    assert.equal(typeof r.readError.message, 'string');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadComponent: a directory path resolves to an UnreadableComponent with readError.code EISDIR', async () => {
  const dir = await withTempRepo(async () => {});
  try {
    const r = await loadComponent('skill', 'adir', dir);
    assert.deepEqual(maskMessage(r), {
      type: 'skill',
      name: 'adir',
      expects: null,
      frontmatter: null,
      readError: { code: 'EISDIR', message: MASKED },
    });
    assert.equal(typeof r.readError.message, 'string');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents: an unreadable component is passed through with readError instead of failing the walk', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/s1/SKILL.md', '---\nname: s1\ndescription: x\n---\nbody\n');
    await writeRepoFile(d, 'agents/a1.md', '---\nname: a1\ndescription: x\n---\nbody\n');
  });
  try {
    const a1Path = join(dir, 'agents', 'a1.md');
    const original = promises.readFile;
    // The mock reaches component-walk.mjs only because it calls
    // `fs.readFile` through the promises object. A switch to a named
    // `readFile` import would bypass it, and this test would then fail loudly.
    const readFileMock = t.mock.method(promises, 'readFile', async (path, ...rest) => {
      if (path === a1Path) {
        const err = new Error('resource busy or locked');
        err.code = 'EBUSY';
        throw err;
      }
      return original(path, ...rest);
    });
    const components = await walkComponents(dir);
    assert.deepEqual(
      components.map((c) => [c.type, c.name, c.readError?.code ?? null]),
      [['skill', 's1', null], ['agent', 'a1', 'EBUSY']]
    );
    assert.ok(readFileMock.mock.calls.some((call) => call.arguments[0] === a1Path));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadComponent: rejects with TypeError when filePath is not a string', async () => {
  await assert.rejects(() => loadComponent('agent', 'x', undefined), TypeError);
  await assert.rejects(() => loadComponent('agent', 'x', 123), TypeError);
});

test('walkComponents: rejects with TypeError when pluginRoot is missing or not a string', async () => {
  await assert.rejects(() => walkComponents(undefined), TypeError);
  await assert.rejects(() => walkComponents(123), TypeError);
});

// --- #4: malformed frontmatter -----------------------------------------------

const BAD_FM = '---\nname: x\ndescription: Use it: now\nmetadata:\n  pillar: spec\n---\nbody\n';

test('loadComponent: yaml-rejected frontmatter resolves to a MalformedComponent with parseError', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/bad/SKILL.md', BAD_FM);
  });
  try {
    const c = await loadComponent('skill', 'bad', join(dir, 'skills', 'bad', 'SKILL.md'));
    assert.deepEqual(Object.keys(c).sort(), ['expects', 'frontmatter', 'name', 'parseError', 'type']);
    assert.equal(c.expects, null);
    assert.equal(c.frontmatter, null);
    assert.equal(typeof c.parseError.code, 'string');
    assert.ok(c.parseError.code.length > 0);
    assert.equal(typeof c.parseError.message, 'string');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents: a malformed component is passed through with parseError; a good one has none', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/good/SKILL.md', '---\nname: good\ndescription: x\n---\nbody\n');
    await writeRepoFile(d, 'agents/bad.md', BAD_FM);
  });
  try {
    const components = await walkComponents(dir);
    assert.equal(components.length, 2);
    const good = components.find((c) => c.name === 'good');
    const bad = components.find((c) => c.name === 'bad');
    assert.ok(good && bad);
    assert.equal('parseError' in good, false);
    assert.ok('parseError' in bad);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadComponent: scalar and list roots are NOT_A_MAPPING; an empty document is a readable component', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/scalar/SKILL.md', '---\njust a string\n---\nbody\n');
    await writeRepoFile(d, 'skills/list/SKILL.md', '---\n- a\n- b\n---\nbody\n');
    await writeRepoFile(d, 'skills/empty/SKILL.md', '---\n\n---\nbody\n');
  });
  try {
    const scalar = await loadComponent('skill', 'scalar', join(dir, 'skills', 'scalar', 'SKILL.md'));
    assert.equal(scalar.parseError?.code, 'NOT_A_MAPPING');
    const list = await loadComponent('skill', 'list', join(dir, 'skills', 'list', 'SKILL.md'));
    assert.equal(list.parseError?.code, 'NOT_A_MAPPING');
    const empty = await loadComponent('skill', 'empty', join(dir, 'skills', 'empty', 'SKILL.md'));
    assert.equal('parseError' in empty, false);
    assert.equal('readError' in empty, false);
    assert.equal(empty.expects, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadComponent: an explicit null root is NOT_A_MAPPING, unlike an empty or comment-only document', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/tilde/SKILL.md', '---\n~\n---\nbody\n');
    await writeRepoFile(d, 'skills/null/SKILL.md', '---\nnull\n---\nbody\n');
    await writeRepoFile(d, 'skills/comment/SKILL.md', '---\n# only a comment\n---\nbody\n');
  });
  try {
    for (const name of ['tilde', 'null']) {
      const c = await loadComponent('skill', name, join(dir, 'skills', name, 'SKILL.md'));
      assert.equal(c.parseError?.code, 'NOT_A_MAPPING', name);
    }
    const comment = await loadComponent('skill', 'comment', join(dir, 'skills', 'comment', 'SKILL.md'));
    assert.equal('parseError' in comment, false);
    assert.deepEqual(comment.frontmatter, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadComponent: a yaml exception (unresolved alias) resolves with parseError YAML_EXCEPTION', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/alias/SKILL.md', '---\na: *x\n---\nbody\n');
  });
  try {
    const c = await loadComponent('skill', 'alias', join(dir, 'skills', 'alias', 'SKILL.md'));
    assert.equal(c.parseError?.code, 'YAML_EXCEPTION');
    assert.equal(c.frontmatter, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- #19: stat failures and symlinked components ------------------------------

const FM19 = (name) => `---\nname: ${name}\ndescription: x\n---\nbody\n`;

const summarize = (cs) => cs.map((c) => [c.type, c.name, c.readError?.code ?? null]);

function eacces() {
  const err = new Error('permission denied');
  err.code = 'EACCES';
  return err;
}

// Creates a symlink; skips the calling test (returns false) only when Windows
// refuses symlink creation for lack of privilege. Any other failure is a real
// error and is rethrown. Targets must be absolute (junctions require it); the
// 'junction' type is ignored off Windows.
async function symlinkOrSkip(t, target, path, type) {
  try {
    await promises.symlink(target, path, type);
    return true;
  } catch (err) {
    if (process.platform === 'win32' && err.code === 'EPERM') {
      t.skip('symlink creation needs privilege on this Windows machine');
      return false;
    }
    throw err;
  }
}

test('walkComponents (#19): stat EACCES on SKILL.md', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/s1/SKILL.md', FM19('s1'));
    await writeRepoFile(d, 'agents/a1.md', FM19('a1'));
  });
  try {
    const target = join(dir, 'skills', 's1', 'SKILL.md');
    const original = promises.stat;
    // Reaches component-walk.mjs only through `fs.stat` on the promises
    // object; a named `stat` import would bypass it and this test would fail.
    const mock = t.mock.method(promises, 'stat', async (path, ...rest) => {
      if (path === target) throw eacces();
      return original(path, ...rest);
    });
    assert.deepEqual(summarize(await walkComponents(dir)), [['skill', 's1', 'EACCES'], ['agent', 'a1', null]]);
    assert.ok(mock.mock.calls.some((call) => call.arguments[0] === target));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): stat EACCES on skills/', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/s1/SKILL.md', FM19('s1'));
    await writeRepoFile(d, 'agents/a1.md', FM19('a1'));
  });
  try {
    const target = join(dir, 'skills');
    const original = promises.stat;
    const mock = t.mock.method(promises, 'stat', async (path, ...rest) => {
      if (path === target) throw eacces();
      return original(path, ...rest);
    });
    assert.deepEqual(summarize(await walkComponents(dir)), [['skill', 'skills/', 'EACCES'], ['agent', 'a1', null]]);
    assert.ok(mock.mock.calls.some((call) => call.arguments[0] === target));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): readdir EACCES on agents/', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/s1/SKILL.md', FM19('s1'));
    await writeRepoFile(d, 'agents/a1.md', FM19('a1'));
  });
  try {
    const target = join(dir, 'agents');
    const original = promises.readdir;
    const mock = t.mock.method(promises, 'readdir', async (path, ...rest) => {
      if (path === target) throw eacces();
      return original(path, ...rest);
    });
    assert.deepEqual(summarize(await walkComponents(dir)), [['skill', 's1', null], ['agent', 'agents/', 'EACCES']]);
    assert.ok(mock.mock.calls.some((call) => call.arguments[0] === target));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): lstat failure after ENOENT', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'skills/s1/SKILL.md', FM19('s1'));
    await mkdir(join(d, 'skills', 's2'), { recursive: true });
    await writeRepoFile(d, 'agents/a1.md', FM19('a1'));
  });
  try {
    const target = join(dir, 'skills', 's2', 'SKILL.md');
    const original = promises.lstat;
    const mock = t.mock.method(promises, 'lstat', async (path, ...rest) => {
      if (path === target) throw eacces();
      return original(path, ...rest);
    });
    assert.deepEqual(summarize(await walkComponents(dir)), [
      ['skill', 's1', null],
      ['skill', 's2', 'EACCES'],
      ['agent', 'a1', null],
    ]);
    assert.ok(mock.mock.calls.some((call) => call.arguments[0] === target));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): symlinked skill dir, junction and agent are followed', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'ext/skillTarget/SKILL.md', FM19('linked'));
    await writeRepoFile(d, 'ext/agentTarget.md', FM19('agentlinked'));
    await writeRepoFile(d, 'plugin/skills/real/SKILL.md', FM19('real'));
    await mkdir(join(d, 'plugin', 'agents'), { recursive: true });
  });
  try {
    const plugin = join(dir, 'plugin');
    const skillTarget = join(dir, 'ext', 'skillTarget');
    if (!(await symlinkOrSkip(t, skillTarget, join(plugin, 'skills', 'symdir'), 'dir'))) return;
    if (!(await symlinkOrSkip(t, skillTarget, join(plugin, 'skills', 'junc'), 'junction'))) return;
    if (!(await symlinkOrSkip(t, join(dir, 'ext', 'agentTarget.md'), join(plugin, 'agents', 'symagent.md'), 'file'))) return;
    const components = await walkComponents(plugin);
    const byName = Object.fromEntries(components.map((c) => [c.name, c]));
    assert.deepEqual(Object.keys(byName).sort(), ['junc', 'real', 'symagent', 'symdir']);
    assert.equal(byName.real.frontmatter.name, 'real');
    assert.equal(byName.symdir.frontmatter.name, 'linked');
    assert.equal(byName.junc.frontmatter.name, 'linked');
    assert.equal(byName.symagent.frontmatter.name, 'agentlinked');
    assert.equal(byName.symagent.type, 'agent');
    for (const c of components) {
      assert.equal('readError' in c, false, c.name);
      assert.equal('parseError' in c, false, c.name);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): dangling skill entry', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'skills'), { recursive: true });
  });
  try {
    const skills = join(dir, 'skills');
    if (!(await symlinkOrSkip(t, join(dir, 'nope'), join(skills, 'dangdir'), 'dir'))) return;
    if (!(await symlinkOrSkip(t, join(dir, 'nope2'), join(skills, 'dangjunc'), 'junction'))) return;
    assert.deepEqual(summarize(await walkComponents(dir)).sort(), [
      ['skill', 'dangdir', 'ENOENT'],
      ['skill', 'dangjunc', 'ENOENT'],
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): dangling SKILL.md', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'skills', 'innerdang'), { recursive: true });
  });
  try {
    const link = join(dir, 'skills', 'innerdang', 'SKILL.md');
    if (!(await symlinkOrSkip(t, join(dir, 'gone.md'), link, 'file'))) return;
    assert.deepEqual(summarize(await walkComponents(dir)), [['skill', 'innerdang', 'ENOENT']]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): dangling agent', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'agents'), { recursive: true });
  });
  try {
    const link = join(dir, 'agents', 'dangagent.md');
    if (!(await symlinkOrSkip(t, join(dir, 'nope.md'), link, 'file'))) return;
    assert.deepEqual(summarize(await walkComponents(dir)), [['agent', 'dangagent', 'ENOENT']]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): SKILL.md symlink loop', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'skills', 'loop'), { recursive: true });
  });
  try {
    const loop = join(dir, 'skills', 'loop');
    if (!(await symlinkOrSkip(t, join(loop, 'B.md'), join(loop, 'SKILL.md'), 'file'))) return;
    if (!(await symlinkOrSkip(t, join(loop, 'SKILL.md'), join(loop, 'B.md'), 'file'))) return;
    assert.deepEqual(summarize(await walkComponents(dir)), [['skill', 'loop', 'ELOOP']]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): symlinked non-component shapes are skipped', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'ext', 'emptyTarget'), { recursive: true });
    await writeRepoFile(d, 'ext/file.txt', 'x');
    await mkdir(join(d, 'plugin', 'skills'), { recursive: true });
    await mkdir(join(d, 'plugin', 'agents'), { recursive: true });
  });
  try {
    const plugin = join(dir, 'plugin');
    const empty = join(dir, 'ext', 'emptyTarget');
    if (!(await symlinkOrSkip(t, empty, join(plugin, 'skills', 'symempty'), 'dir'))) return;
    if (!(await symlinkOrSkip(t, join(dir, 'ext', 'file.txt'), join(plugin, 'skills', 'filelink'), 'file'))) return;
    if (!(await symlinkOrSkip(t, empty, join(plugin, 'agents', 'x.md'), 'dir'))) return;
    assert.deepEqual(await walkComponents(plugin), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): SKILL.md symlink inside a real dir is loaded', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await writeRepoFile(d, 'ext/SKILL.md', FM19('innerlinked'));
    await mkdir(join(d, 'plugin', 'skills', 'innerlink'), { recursive: true });
  });
  try {
    const link = join(dir, 'plugin', 'skills', 'innerlink', 'SKILL.md');
    if (!(await symlinkOrSkip(t, join(dir, 'ext', 'SKILL.md'), link, 'file'))) return;
    const components = await walkComponents(join(dir, 'plugin'));
    assert.equal(components.length, 1);
    assert.equal(components[0].name, 'innerlink');
    assert.equal(components[0].frontmatter.name, 'innerlinked');
    assert.equal('readError' in components[0], false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('walkComponents (#19): dangling skills/ tree', async (t) => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'dangling'), { recursive: true });
    await writeRepoFile(d, 'filetree/skills', 'x');
  });
  try {
    if (!(await symlinkOrSkip(t, join(dir, 'none'), join(dir, 'dangling', 'skills'), 'dir'))) return;
    assert.deepEqual(summarize(await walkComponents(join(dir, 'dangling'))), [['skill', 'skills/', 'ENOENT']]);
    assert.deepEqual(await walkComponents(join(dir, 'filetree')), []);
    assert.deepEqual(await walkComponents(join(dir, 'missing-root')), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

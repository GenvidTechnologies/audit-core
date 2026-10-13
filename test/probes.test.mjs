import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises } from 'node:fs';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fileExists, dirExists, commandExists, probePath } from '../src/probes.mjs';

async function withTempRepo(setup) {
  const dir = await mkdtemp(join(tmpdir(), 'probes-test-'));
  try {
    await setup(dir);
    return dir;
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    throw err;
  }
}

test('fileExists: true for a real file', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeFile(join(d, 'a.txt'), 'a\n');
  });
  try {
    assert.equal(await fileExists(join(dir, 'a.txt')), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fileExists: false for a path that does not exist', async () => {
  const dir = await withTempRepo(async () => {});
  try {
    assert.equal(await fileExists(join(dir, 'nope.txt')), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fileExists: false for a directory (isFile()-strict)', async () => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'sub'));
  });
  try {
    assert.equal(await fileExists(join(dir, 'sub')), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dirExists: true for a real directory', async () => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'sub'));
  });
  try {
    assert.equal(await dirExists(join(dir, 'sub')), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dirExists: false for a path that does not exist', async () => {
  const dir = await withTempRepo(async () => {});
  try {
    assert.equal(await dirExists(join(dir, 'nope')), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dirExists: false for a file (isDirectory()-strict)', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeFile(join(d, 'a.txt'), 'a\n');
  });
  try {
    assert.equal(await dirExists(join(dir, 'a.txt')), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('commandExists: true for a command that must exist (node), false for an implausible name', () => {
  assert.equal(commandExists('node'), true);
  assert.equal(commandExists('definitely-not-a-real-command-xyz'), false);
});

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

test('probePath (#20): a real file is kind file', async () => {
  const dir = await withTempRepo(async (d) => {
    await writeFile(join(d, 'a.txt'), 'a\n');
  });
  try {
    assert.deepEqual(await probePath(join(dir, 'a.txt')), { kind: 'file' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('probePath (#20): a real directory is kind directory', async () => {
  const dir = await withTempRepo(async (d) => {
    await mkdir(join(d, 'sub'));
  });
  try {
    assert.deepEqual(await probePath(join(dir, 'sub')), { kind: 'directory' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('probePath (#20): a missing path is kind absent', async () => {
  const dir = await withTempRepo(async () => {});
  try {
    assert.deepEqual(await probePath(join(dir, 'nope')), { kind: 'absent' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('probePath (#20): neither file nor directory is kind other', async (t) => {
  t.mock.method(promises, 'stat', async () => ({
    isDirectory: () => false,
    isFile: () => false,
  }));
  assert.deepEqual(await probePath('whatever'), { kind: 'other' });
});

test('probePath (#20): EACCES from stat is normalised to an error outcome', async (t) => {
  t.mock.method(promises, 'stat', async () => {
    throw codedError('EACCES', 'permission denied');
  });
  assert.deepEqual(await probePath('whatever'), {
    kind: 'error',
    error: { code: 'EACCES', message: 'permission denied' },
  });
});

test('probePath (#20): ENOENT from stat but lstat succeeds (dangling link) is an error', async (t) => {
  t.mock.method(promises, 'stat', async () => {
    throw codedError('ENOENT', 'no such file');
  });
  t.mock.method(promises, 'lstat', async () => ({}));
  const result = await probePath('whatever');
  assert.equal(result.kind, 'error');
  assert.equal(result.error.code, 'ENOENT');
});

test('probePath (#20): a non-absence lstat error is reported, not stat\'s ENOENT', async (t) => {
  t.mock.method(promises, 'stat', async () => {
    throw codedError('ENOENT', 'no such file');
  });
  t.mock.method(promises, 'lstat', async () => {
    throw codedError('EACCES', 'permission denied');
  });
  const result = await probePath('whatever');
  assert.equal(result.kind, 'error');
  assert.equal(result.error.code, 'EACCES');
});

test('probePath (#20): a thrown non-Error yields a null code and the string message', async (t) => {
  t.mock.method(promises, 'stat', async () => {
    throw 'boom';
  });
  const result = await probePath('whatever');
  assert.equal(result.kind, 'error');
  assert.equal(result.error.code, null);
  assert.equal(result.error.message, 'boom');
});

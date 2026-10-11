// Ported from gvt-dev plugin/skills/audit-conventions/scripts/test/config-resolve.test.mjs
// at commit 098121e, for GenvidTechnologies/audit-core#13. It imports through
// the barrel, not ../src/config-resolve.mjs, on purpose: it pins the public surface.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveKey } from '../src/index.mjs';

test('resolveKey: shallow key found', () => {
  const r = resolveKey({ name: 'genvid' }, 'name');
  assert.deepEqual(r, { found: true, value: 'genvid' });
});

test('resolveKey: nested key found', () => {
  const r = resolveKey({ commands: { validate: 'npm test' } }, 'commands.validate');
  assert.deepEqual(r, { found: true, value: 'npm test' });
});

test('resolveKey: missing leaf reports missingAt at the leaf', () => {
  const r = resolveKey({ commands: { test: 'npm test' } }, 'commands.validate');
  assert.deepEqual(r, { found: false, missingAt: 'commands.validate' });
});

test('resolveKey: missing intermediate reports missingAt at the broken segment', () => {
  const r = resolveKey({ project: {} }, 'commands.validate');
  assert.deepEqual(r, { found: false, missingAt: 'commands' });
});

test('resolveKey: traverses through nested object with falsy non-objects', () => {
  const r = resolveKey({ a: { b: 0 } }, 'a.b');
  assert.deepEqual(r, { found: true, value: 0 });
});

test('resolveKey: bails when path encounters non-object', () => {
  const r = resolveKey({ a: 'string-value' }, 'a.b');
  assert.deepEqual(r, { found: false, missingAt: 'a' });
});

test('resolveKey: bails on null intermediate', () => {
  const r = resolveKey({ a: null }, 'a.b');
  assert.deepEqual(r, { found: false, missingAt: 'a' });
});

test('resolveKey: handles deep paths', () => {
  const r = resolveKey({ a: { b: { c: { d: 'deep' } } } }, 'a.b.c.d');
  assert.deepEqual(r, { found: true, value: 'deep' });
});

test('resolveKey: returns false value correctly', () => {
  const r = resolveKey({ features: { tdd: false } }, 'features.tdd');
  assert.deepEqual(r, { found: true, value: false });
});

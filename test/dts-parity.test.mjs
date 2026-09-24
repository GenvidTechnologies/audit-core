// Pins that src/index.d.ts declares exactly the names src/index.mjs exports
// at runtime. Independent regex check — runs without `tsc` or `@types/node`,
// so it survives a toolchain problem that would take the tsc-backed
// signature typecheck (test/signature.test.mjs, spawned from
// test/signature-guard.test.mjs) out with it. See CLAUDE.md's "Package
// shape" section for the full mechanism.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as barrel from '../src/index.mjs';

test('index.d.ts declares the same export names as index.mjs', () => {
  const runtimeNames = new Set(Object.keys(barrel));

  const dtsPath = new URL('../src/index.d.ts', import.meta.url);
  const dtsSource = readFileSync(dtsPath, 'utf8');
  const declaredNames = new Set();
  const declRe = /^export declare (?:const|function) (\w+)/gm;
  let match;
  while ((match = declRe.exec(dtsSource)) !== null) {
    declaredNames.add(match[1]);
  }

  const missingFromDts = [...runtimeNames].filter((n) => !declaredNames.has(n));
  const missingFromMjs = [...declaredNames].filter((n) => !runtimeNames.has(n));

  assert.deepEqual(
    missingFromDts,
    [],
    `exported by index.mjs but not declared in index.d.ts: ${missingFromDts.join(', ')}`,
  );
  assert.deepEqual(
    missingFromMjs,
    [],
    `declared in index.d.ts but not exported by index.mjs: ${missingFromMjs.join(', ')}`,
  );
});

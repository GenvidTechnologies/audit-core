// Pins that src/index.d.ts declares exactly the names src/index.mjs exports
// at runtime — the one thing about the hand-maintained .d.ts that CAN be
// checked mechanically (see the header comment on index.d.ts).

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

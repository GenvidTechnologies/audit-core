// Smoke test for the standup placeholder.
//
// This exists for two reasons, and the second is the load-bearing one:
//
//   1. It pins that the package's single declared export is actually reachable,
//      so a malformed entry point fails here rather than at a consumer's first
//      import.
//
//   2. It guarantees `node --test` always finds at least one test file. The
//      shared CI gate (node-gate.yml) pins Node 22 and runs `npm run test`
//      unconditionally; `node --test` behaviour on an EMPTY test set is not
//      identical across Node majors, and that could not be verified locally
//      against Node 22. One real test makes the question moot rather than
//      leaving CI resting on an unverified cross-version assumption.
//
// Deliberately uses only fs + JSON.parse rather than a JSON import attribute,
// since import-attribute syntax is itself version-sensitive — which is the
// exact class of risk this file exists to remove.
//
// The library implementation, and its real test suite, arrive with
// GenvidTechnologies/claude-code-plugin-gvt-dev#457.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { VERSION } from '../src/index.mjs';

test('the placeholder entry point exports VERSION', () => {
  assert.equal(typeof VERSION, 'string');
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test('VERSION matches the version declared in package.json', () => {
  const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(VERSION, pkg.version);
});

// Suppression-directive deny-list for test/signature.test.mjs. The typed
// signature fixture (test/signature.test.mjs) is a type-level check, and a
// type-level check can be silently neutered by a TypeScript suppression
// directive. This guard scans that file's source for any of the three
// directives and fails if one is present, so the fixture can't be quietly
// disarmed.
//
// `@ts-expect-error` is self-policing under tsc (TS2578 on a clean tree), but
// `@ts-ignore` and `@ts-nocheck` are never flagged in either state -- those
// are the silent killers this guard exists to catch. `@ts-expect-error` is
// matched as a PREFIX: `// @ts-expect-error-free` is a live directive, so the
// deny-list entries below are matched as plain substrings, never anchored
// with a trailing word boundary that would miss that case.
//
// The `tsc` spawn itself is wired in a later task (F1); this file only
// guards the fixture's suppression directives and is otherwise inert with
// respect to type-checking.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIGNATURE_FIXTURE = fileURLToPath(new URL('./signature.test.mjs', import.meta.url));

// Deny-list of suppression directives. Matched as plain substrings so that
// `@ts-expect-error` is caught as a PREFIX (see header) -- do not switch this
// to a regex with a trailing \b, $, or [\s:] boundary, which would miss the
// `@ts-expect-error-free` case.
const DENY_LIST = ['@ts-expect-error', '@ts-ignore', '@ts-nocheck'];

/**
 * Scan `source` for any deny-listed directive, returning one entry per hit
 * with the directive and the 1-based line number it starts on.
 * @param {string} source
 * @returns {{ directive: string, line: number }[]}
 */
function findSuppressionDirectives(source) {
  const hits = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    for (const directive of DENY_LIST) {
      if (lines[i].includes(directive)) {
        hits.push({ directive, line: i + 1 });
      }
    }
  }
  return hits;
}

test('test/signature.test.mjs contains no TypeScript suppression directives', () => {
  const source = readFileSync(SIGNATURE_FIXTURE, 'utf8');
  const hits = findSuppressionDirectives(source);
  assert.deepEqual(
    hits,
    [],
    `found suppression directive(s) in ${SIGNATURE_FIXTURE}: ${hits
      .map((h) => `${h.directive} at line ${h.line}`)
      .join(', ')}`,
  );
});

// Positive control. The scan above matches nothing on the current tree
// (baseline: zero `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error` occurrences
// across all five pre-existing test files), so a dead or over-anchored
// pattern would also report zero hits and read as a pass -- the exact
// false-green shape a verifier that can degrade to "matches nothing" must
// not have. This control proves the matcher is genuinely live by running it
// against a synthetic string carrying exactly one of each deny-listed
// directive -- including the `@ts-expect-error` PREFIX case -- and asserting
// the hit count is exactly 3, not a looser bound. The synthetic string lives
// only in this file, never in test/signature.test.mjs, so it cannot trip the
// scan above.
test('the suppression-directive scan positively detects all three directives, including the @ts-expect-error prefix case', () => {
  const synthetic = [
    '// synthetic control string -- not a real suppression, only a probe',
    '// @ts-expect-error-free this line only carries the directive as a prefix',
    '// @ts-ignore this line carries a genuine ts-ignore',
    '// @ts-nocheck this line carries a genuine ts-nocheck',
  ].join('\n');

  const hits = findSuppressionDirectives(synthetic);
  assert.equal(hits.length, 3);
  assert.deepEqual(hits.map((h) => h.directive).sort(), [...DENY_LIST].sort());
});

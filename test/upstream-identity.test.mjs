// Enforces CLAUDE.md's "Package shape" rule that the five extracted modules
// in src/ (frontmatter.mjs, config-resolve.mjs, probes.mjs,
// component-walk.mjs, evaluate.mjs) stay byte-identical to their gvt-dev
// originals for as long as both copies exist -- "Don't edit them for any
// reason, including a header comment or a reformat; a change that's
// genuinely needed belongs in the gvt-dev plugin first, then gets
// re-extracted here."
//
// The check is two tiers, deliberately asymmetric in how they fail:
//
//   Tier 1 (T-c) -- local src/ vs. the committed RECORD constant below.
//   Both the working tree (`git hash-object`) and the index
//   (`git ls-files -s`) are compared, since a staged edit with a restored
//   worktree would otherwise pass while the next commit carries it. This
//   tier touches no network and never skips for an external reason (only
//   retirement, below, turns it off): it catches the common drift -- an
//   accidental edit or reformat -- offline.
//
//   Tier 2 (T-d) -- RECORD vs. gvt-dev at PIN over raw.githubusercontent.com.
//   Without it RECORD is self-attested (anyone can edit src/ and RECORD
//   together); this tier checks RECORD against what gvt-dev actually has
//   committed at PIN. It DOES skip, but only with a classifyFailure()
//   reason naming why the upstream fetch was unresolvable (timeout, DNS
//   failure, 404, rate limit, captive-portal HTML instead of the expected
//   text/plain) -- never a bare, unexplained skip -- and a resolved
//   divergence always fails, even when other modules were unresolvable.
//
// Re-extracting: copy the changed file(s) from gvt-dev's
// plugin/skills/audit-conventions/scripts/lib/ into src/ verbatim, then
// bump PIN to the new gvt-dev commit and update the corresponding RECORD
// entries to that commit's blob SHAs -- in the SAME commit as the copy, so
// RECORD and src/ never disagree about which upstream revision is checked
// out.
//
// Retiring this file: GenvidTechnologies/claude-code-plugin-gvt-dev#458 is
// the tracked plan to have the gvt-dev plugin import this package directly
// instead of keeping its own lib/ copies -- once that lands, the copies
// this file pins no longer exist to drift, and the constraint is moot.
// decideRetirement() below encodes exactly when that's true: gvt-dev#458
// closed with state_reason "completed" is the only retiring case, and it
// has two possible outcomes depending on what happened to gvt-dev's lib/
// copies -- outcome a, they were deleted (a 404 probing gvt-dev's main
// branch for that path), or outcome b, they were retained but no longer
// used (a 200). Either way, once retired, BOTH tiers skip, reporting that
// the constraint is moot rather than running a now-meaningless comparison
// -- and at that point this file and the CLAUDE.md frozen-module sentence
// it enforces should simply be deleted, not kept around skipping forever.
// gvt-dev#458 closed as "not_planned", still open, or unreadable (the
// issue-state probe itself failed) all keep the check enforcing -- the
// default is to stay strict, and only a legible "completed" closure can
// turn that off.
//
// The pure primitives (blobSha, upstreamUrl, classifyFailure,
// decideRetirement) are tested hermetically by T-a, T-b, T-e and T-f; the
// two tiers compose them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// gvt-dev PR #551 merge commit -- the extraction audit-core's 0ca13da
// cites. First tag containing it: v4.27.0. Pinned to a commit SHA rather
// than a tag because a tag can move; a commit SHA cannot.
const PIN = 'fd748ec13682569d67fd4fdcf5429eaacaa1b8c3';

const UPSTREAM_REPO = 'GenvidTechnologies/claude-code-plugin-gvt-dev';
const UPSTREAM_DIR = 'plugin/skills/audit-conventions/scripts/lib';
const RAW_BASE = 'https://raw.githubusercontent.com';

// How long tier 2's upstream fetch is allowed to hang before classifyFailure()
// reports a timeout rather than skipping silently.
const FETCH_TIMEOUT_MS = 10_000;

// Git blob SHAs for each src/*.mjs file, as of PIN, recorded at the last
// re-extraction. A git blob SHA (not a sha256 of raw bytes) on purpose:
// `git hash-object` applies the repo's clean filter, so it hashes to the
// exact bytes git itself considers committed even on an autocrlf=true
// checkout that materializes CRLF line endings on disk -- and it's the same
// value GitHub's contents API reports as a file's `.sha`. A sha256 over raw
// on-disk bytes would false-red on a CRLF checkout of a genuinely
// unmodified file; LF-normalising the bytes in Node before hashing would
// false-green a file that git itself would consider to carry a real CR.
const RECORD = Object.freeze({
  'frontmatter.mjs': 'c10782b573abd1baaa7c2e28e48ff8774b60ea33',
  'config-resolve.mjs': '4ac294cc1a157397aef3e478b15032f485bb3ec0',
  'probes.mjs': '66883f76c953dea02c7326b71ac3cf4a35ae630e',
  'component-walk.mjs': '1d5bf0dd0c50db6a3e4a1ef92fc34d0611aa3dce',
  'evaluate.mjs': '37a796e87e96c6587d802f9d69db312c294383a5',
});

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Hash `bytes` the way `git hash-object` hashes a blob: sha1 over the
 * `"blob " + byteLength + NUL` header, followed by the bytes themselves.
 * NUL is built with String.fromCharCode(0) rather than a `\0`/`\x00`
 * escape so nothing about the header depends on how the surrounding string
 * literal is parsed.
 * @param {Buffer | Uint8Array} bytes
 * @returns {string} 40-hex blob SHA
 */
function blobSha(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const nul = String.fromCharCode(0);
  const header = `blob ${buf.length}${nul}`;
  const hash = createHash('sha1');
  hash.update(header, 'utf8');
  hash.update(buf);
  return hash.digest('hex');
}

/**
 * Build the raw.githubusercontent.com URL for one upstream file at a given
 * pin. Pure -- takes `pin`/`base` as overridable params so a test (or a
 * future control probing a wrong host/pin) never has to touch the module
 * constants.
 * @param {string} name one of RECORD's keys, e.g. 'frontmatter.mjs'
 * @param {string} [pin]
 * @param {string} [base]
 * @returns {string}
 */
function upstreamUrl(name, pin = PIN, base = RAW_BASE) {
  return `${base}/${UPSTREAM_REPO}/${pin}/${UPSTREAM_DIR}/${name}`;
}

/**
 * Read a content-type off either a real Headers instance or a plain
 * `{ 'content-type': ... }` object, so classifyFailure() is testable
 * without constructing a real fetch Response.
 * @param {Headers | Record<string, string> | undefined | null} headersLike
 * @returns {string | null}
 */
function getContentType(headersLike) {
  if (!headersLike) return null;
  if (typeof headersLike.get === 'function') return headersLike.get('content-type');
  return headersLike['content-type'] ?? headersLike['Content-Type'] ?? null;
}

/**
 * Classify why tier 2's upstream fetch could not be resolved into a
 * human-readable reason string, or return null when the input represents a
 * genuinely resolved, trustworthy 200 text/plain response.
 *
 * `input` is either:
 *   - an Error thrown by fetch (network failure, abort/timeout), or
 *   - a Response-like `{ status, headers }` (headers: Headers instance or
 *     a plain object/`get` function -- see getContentType()).
 *
 * @param {Error | { status: number, headers?: unknown }} input
 * @returns {string | null} unresolved reason, or null if resolved
 */
function classifyFailure(input) {
  if (input instanceof Error) {
    if (input.name === 'TimeoutError') {
      return `timed out after ${FETCH_TIMEOUT_MS} ms`;
    }
    if (input instanceof TypeError && input.cause && input.cause.code) {
      return `network: ${input.cause.code}`;
    }
    return `network: ${input.message}`;
  }

  const { status, headers } = input;

  if (status === 404) {
    return 'HTTP 404: pin wrong, history rewritten, or repo no longer public';
  }
  if (status === 403 || status === 429) {
    return `HTTP ${status}: rate-limited or forbidden`;
  }
  if (status !== 200) {
    return `HTTP ${status}`;
  }

  const contentType = getContentType(headers) ?? '';
  if (!contentType.startsWith('text/plain')) {
    // Captive-portal guard: a 200 carrying HTML (a Wi-Fi login page, a
    // GitHub outage page, a proxy's block page) is not the raw file this
    // check asked for, even though the status code alone looks fine.
    return `unexpected content-type ${contentType || '(none)'} for a raw-file fetch (captive portal or misroute?)`;
  }

  return null;
}

/**
 * Decide, from the current state of GenvidTechnologies/claude-code-plugin-gvt-dev#458
 * and a probe of whether gvt-dev's own lib/ copies still exist on its
 * default branch, whether this check's constraint is retired.
 *
 * `issue` is either `{ state, state_reason }` from the issue-state probe,
 * or an Error/null when that probe itself failed. `mainProbe` is an HTTP
 * status (404 = lib/ deleted upstream, 200 = lib/ still present) or an
 * Error/null when that probe itself failed.
 *
 * Only "closed" + state_reason "completed" retires the check -- "open" and
 * "not_planned" (and an unreadable issue state) all fail safe to
 * enforcing, since the default posture is to keep checking until gvt-dev#458
 * is legibly done.
 *
 * When closed+completed but mainProbe itself couldn't be read (network
 * error, or null), this returns retired with outcome 'b' rather than
 * inventing a third outcome or declining to decide: closed+completed is
 * already decisive that gvt-dev#458 shipped, and once it has, there's no
 * "identity" fact left for this check to verify regardless of what
 * mainProbe reports -- 404 is the one case that additionally lets a reader
 * know to also expect the src/ copies gone from gvt-dev's history, so it
 * gets its own outcome; everything else (200, or an unreadable probe)
 * collapses into 'b'.
 *
 * @param {{ issue: { state: string, state_reason: string | null } | Error | null, mainProbe: number | Error | null }} args
 * @returns {{ retired: false, reason: string } | { retired: true, outcome: 'a' | 'b', reason: string }}
 */
function decideRetirement({ issue, mainProbe }) {
  if (issue instanceof Error || issue == null) {
    return { retired: false, reason: 'gvt-dev#458 issue state unreadable: fail safe to enforcing' };
  }

  const { state, state_reason: stateReason } = issue;

  if (state !== 'closed') {
    return { retired: false, reason: 'gvt-dev#458 is open: constraint still enforced' };
  }

  if (stateReason !== 'completed') {
    return {
      retired: false,
      reason: `gvt-dev#458 closed as ${stateReason ?? 'unknown'}, not completed: constraint still enforced`,
    };
  }

  if (mainProbe === 404) {
    return {
      retired: true,
      outcome: 'a',
      reason: 'gvt-dev#458 closed as completed (outcome a: lib/ copies deleted): constraint moot — delete test/upstream-identity.test.mjs and the CLAUDE.md frozen-module sentence',
    };
  }

  // mainProbe === 200, or the mainProbe itself is Error/null (unreadable) --
  // see the doc comment above for why both collapse to outcome 'b'.
  return {
    retired: true,
    outcome: 'b',
    reason: 'gvt-dev#458 closed as completed (outcome b: lib/ copies retained, unused): constraint moot — delete test/upstream-identity.test.mjs and the CLAUDE.md frozen-module sentence',
  };
}

test('T-a: PIN, RECORD, and upstreamUrl() have the expected shape', () => {
  assert.match(PIN, /^[0-9a-f]{40}$/);

  const recordKeys = Object.keys(RECORD).sort();
  assert.deepEqual(recordKeys, [
    'component-walk.mjs',
    'config-resolve.mjs',
    'evaluate.mjs',
    'frontmatter.mjs',
    'probes.mjs',
  ]);
  for (const [name, sha] of Object.entries(RECORD)) {
    assert.match(sha, /^[0-9a-f]{40}$/, `RECORD['${name}'] is not 40 lowercase hex`);
  }
  assert.ok(Object.isFrozen(RECORD));

  assert.equal(
    upstreamUrl('frontmatter.mjs'),
    `${RAW_BASE}/${UPSTREAM_REPO}/${PIN}/${UPSTREAM_DIR}/frontmatter.mjs`,
  );
  // pin is overridable, proving upstreamUrl() doesn't hardcode PIN internally
  assert.equal(
    upstreamUrl('frontmatter.mjs', 'deadbeef'),
    `${RAW_BASE}/${UPSTREAM_REPO}/deadbeef/${UPSTREAM_DIR}/frontmatter.mjs`,
  );
});

test("T-b: blobSha() agrees with git's own hashing for a real tracked file", () => {
  // `git show :src/frontmatter.mjs` reads the INDEX's copy of the blob, not
  // the working-tree file -- comparing that against `git ls-files -s`'s
  // recorded blob SHA is what proves Node-side and git-side hashing agree
  // on real content, independent of anything RECORD claims.
  const catFile = spawnSync('git', ['show', ':src/frontmatter.mjs'], {
    cwd: REPO_ROOT,
    encoding: 'buffer',
  });
  assert.equal(catFile.status, 0, catFile.stderr?.toString('utf8'));

  const lsFiles = spawnSync('git', ['ls-files', '-s', '--', 'src/frontmatter.mjs'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(lsFiles.status, 0, lsFiles.stderr);
  // `git ls-files -s` output: "<mode> <sha> <stage>\t<path>"
  const indexSha = lsFiles.stdout.trim().split(/\s+/)[1];
  assert.match(indexSha, /^[0-9a-f]{40}$/);

  const computed = blobSha(catFile.stdout);
  assert.equal(computed, indexSha, "blobSha() disagrees with git's own index blob SHA");
  assert.equal(computed, RECORD['frontmatter.mjs'], 'RECORD is stale for frontmatter.mjs');
});

test('T-e: classifyFailure() names every unresolved case and returns null only for a genuine 200 text/plain', () => {
  const enotfound = new TypeError('fetch failed');
  enotfound.cause = { code: 'ENOTFOUND' };
  assert.match(classifyFailure(enotfound), /ENOTFOUND/);

  const timeout = new Error('The operation was aborted');
  timeout.name = 'TimeoutError';
  assert.match(classifyFailure(timeout), /timed out/);

  const genericNetwork = new Error('socket hang up');
  assert.match(classifyFailure(genericNetwork), /socket hang up/);

  assert.match(classifyFailure({ status: 404, headers: new Headers() }), /404/);
  assert.match(classifyFailure({ status: 429, headers: new Headers() }), /429/);
  assert.match(classifyFailure({ status: 403, headers: new Headers() }), /403/);
  assert.match(classifyFailure({ status: 500, headers: new Headers() }), /500/);

  const html = classifyFailure({
    status: 200,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
  });
  // negative control: a non-text/plain 200 never resolves to null, and the
  // reason names the offending content-type rather than being a bare flag
  assert.notEqual(html, null);
  assert.match(html, /text\/html/);

  assert.notEqual(
    classifyFailure({ status: 200, headers: new Headers({ 'content-type': 'application/json' }) }),
    null,
  );

  assert.equal(
    classifyFailure({
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain; charset=utf-8' }),
    }),
    null,
  );
});

test('T-f: decideRetirement() covers every issue-state / mainProbe combination', () => {
  // 1. open -> active regardless of mainProbe
  assert.equal(
    decideRetirement({ issue: { state: 'open', state_reason: null }, mainProbe: 404 }).retired,
    false,
  );

  // 2. closed+completed+mainProbe 404 -> retired, outcome a (lib/ copies deleted)
  const a = decideRetirement({ issue: { state: 'closed', state_reason: 'completed' }, mainProbe: 404 });
  assert.equal(a.retired, true);
  assert.equal(a.outcome, 'a');
  assert.match(a.reason, /gvt-dev#458/);
  assert.match(a.reason, /outcome a/);
  assert.match(a.reason, /delete test\/upstream-identity\.test\.mjs/);

  // 3. closed+completed+mainProbe 200 -> retired, outcome b (retained, unused)
  const b = decideRetirement({ issue: { state: 'closed', state_reason: 'completed' }, mainProbe: 200 });
  assert.equal(b.retired, true);
  assert.equal(b.outcome, 'b');
  assert.match(b.reason, /outcome b/);

  // 4. closed+not_planned -> active
  assert.equal(
    decideRetirement({ issue: { state: 'closed', state_reason: 'not_planned' }, mainProbe: 404 }).retired,
    false,
  );

  // 5. the issue-state probe itself failed -> active (fail safe to enforcing)
  assert.equal(
    decideRetirement({ issue: new Error('network'), mainProbe: 404 }).retired,
    false,
  );
  assert.equal(
    decideRetirement({ issue: null, mainProbe: 404 }).retired,
    false,
  );

  // 6. closed+completed but mainProbe itself unreadable -- documented
  // decision (see decideRetirement()'s doc comment): collapses to outcome
  // 'b', same as a 200, rather than a third outcome or a non-decision.
  const unreadableProbe = decideRetirement({
    issue: { state: 'closed', state_reason: 'completed' },
    mainProbe: new Error('network'),
  });
  assert.equal(unreadableProbe.retired, true);
  assert.equal(unreadableProbe.outcome, 'b');
});

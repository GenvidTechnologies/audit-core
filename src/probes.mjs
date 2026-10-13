// Filesystem/command existence probes used to evaluate metadata.expects
// entries. Extracted verbatim from audit.mjs for the audit-core package
// split (#457).

import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';

export async function fileExists(path) {
  try {
    const s = await fs.stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

export async function dirExists(path) {
  try {
    const s = await fs.stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// Codes meaning "nothing is at this path" (as opposed to a real I/O failure).
export const ABSENT_CODES = new Set(['ENOENT', 'ENOTDIR']);

// Normalise a thrown value to the {code, message} shape used for probe and
// read errors. Works for Errors with or without a code and for non-Errors.
export function toProbeError(err) {
  return {
    code: typeof err?.code === 'string' ? err.code : null,
    message: String(err?.message ?? err),
  };
}

// Classify a path: { kind: 'directory' | 'file' | 'other' | 'absent' } or
// { kind: 'error', error: {code, message} }. 'absent' means nothing -- not
// even a dangling link -- is there: Windows reports a dangling link as plain
// ENOENT from stat, so an ENOENT is confirmed with lstat before it is
// believed. Every fs call goes through the `fs` promises object (the
// t.mock.method seam), never a named import.
export async function probePath(path) {
  try {
    const s = await fs.stat(path);
    return { kind: s.isDirectory() ? 'directory' : s.isFile() ? 'file' : 'other' };
  } catch (err) {
    if (!ABSENT_CODES.has(err?.code)) return { kind: 'error', error: toProbeError(err) };
    try {
      await fs.lstat(path);
    } catch (lerr) {
      if (ABSENT_CODES.has(lerr?.code)) return { kind: 'absent' };
      return { kind: 'error', error: toProbeError(lerr) };
    }
    // lstat succeeded: a dangling link. Report stat's own error (#21).
    return { kind: 'error', error: toProbeError(err) };
  }
}

export function commandExists(cmd) {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [cmd], { stdio: 'pipe' });
  return result.status === 0;
}

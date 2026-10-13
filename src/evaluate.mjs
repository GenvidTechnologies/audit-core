// Evaluates metadata.expects entries (files, config keys, tools) into
// expectation findings. Extracted from audit.mjs for the audit-core package
// split (#457).
//
// This module is repo-root-blind: it does no path resolution of its own. A
// caller-supplied `resolve` closure does that work and hands back an
// already-resolved absolute path plus display strings (ADR-0057 verdict A).
// `evaluateFile`'s resolve also reports which probe to run (`file` vs.
// `directory`) -- that probe choice is policy, not mechanism, per the same
// verdict -- and the returned noun is rendered verbatim into `detail`
// (ADR-0057 verdict C). `evaluateFile` probes with `probePath` and reports
// three distinct failures: absent -> "<probe> not found"; unexaminable (a
// stat error, or a dangling link) -> "<probe> could not be checked (...)";
// wrong kind -> "expected a <probe>, found ...". None of the three evaluators
// throw for an expected condition -- a missing or unexaminable file/directory,
// an unreadable or malformed config, an unresolvable key, or a command absent
// from PATH all return a finding (ADR-0057 Q2).

import { promises as fs } from 'node:fs';

import { probePath, ABSENT_CODES, commandExists } from './probes.mjs';
import { resolveKey } from './config-resolve.mjs';

export async function evaluateFile(component, entry, resolve) {
  const required = entry.required !== false;
  const { path, probe, target } = resolve(entry);
  const want = probe === 'directory' ? 'directory' : 'file';
  const found = await probePath(path);

  if (found.kind === want) {
    return { kind: 'file', component: component.name, target, ok: true, required };
  }

  let detail;
  if (found.kind === 'absent') {
    detail = `${probe} not found`;
  } else if (found.kind === 'error') {
    const why = found.error.code ?? found.error.message;
    // probePath reports an absence code inside 'error' only for a dangling link.
    detail = ABSENT_CODES.has(found.error.code)
      ? `${probe} could not be checked (dangling link, ${why})`
      : `${probe} could not be checked (${why})`;
  } else {
    detail = found.kind === 'other'
      ? `expected a ${probe}, found neither a file nor a directory`
      : `expected a ${probe}, found a ${found.kind}`;
  }
  return {
    kind: 'file', component: component.name, target, ok: false, required,
    severity: required ? 'error' : 'info',
    detail: detail + (required ? '' : ' (optional)'),
    reason: entry.reason,
  };
}

export async function evaluateConfig(component, entry, resolve) {
  const required = entry.required !== false;
  const { path, source, target } = resolve(entry);

  let parsed;
  try {
    const raw = await fs.readFile(path, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      kind: 'config', component: component.name, target,
      ok: false, required, severity: required ? 'error' : 'info',
      detail: err.code === 'ENOENT' ? `${source} not found` : `${source} unreadable (${err.message})`,
      reason: entry.reason,
    };
  }

  const result = resolveKey(parsed, entry.key);
  if (result.found) {
    return { kind: 'config', component: component.name, target, ok: true, required };
  }
  return {
    kind: 'config', component: component.name, target,
    ok: false, required, severity: required ? 'error' : 'info',
    detail: `key not found (path broke at "${result.missingAt}")${required ? '' : ' (optional)'}`,
    reason: entry.reason,
  };
}

export function evaluateTool(component, entry) {
  const required = entry.required !== false;
  const exists = commandExists(entry.command);

  if (exists) {
    return { kind: 'tool', component: component.name, target: entry.command, ok: true, required };
  }
  return {
    kind: 'tool', component: component.name, target: entry.command, ok: false, required,
    severity: required ? 'error' : 'info',
    detail: `command not found on PATH${required ? '' : ' (optional)'}`,
    reason: entry.reason,
  };
}

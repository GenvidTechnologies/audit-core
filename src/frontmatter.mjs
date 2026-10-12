// YAML frontmatter parsing, delegated to the `yaml` package (YAML 1.2, core
// schema). The string API never throws (gvt-dev ADR-0057 Q2): malformed input
// yields `{}` from extractFrontmatter/parseYaml. readFrontmatter exposes the
// error alongside the value so loadComponent can report a malformed component
// instead of silently treating it as empty (GenvidTechnologies/audit-core#4).

import { parseDocument } from 'yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

// Single code path for parseYaml and readFrontmatter. Always returns
// { value, error }; value is a plain object, error is null or { code, message }.
function readYaml(text) {
  try {
    const doc = parseDocument(text);
    if (doc.errors.length) {
      const first = doc.errors[0];
      return {
        value: {},
        error: { code: first.code, message: String(first.message).split(/\r?\n/)[0] },
      };
    }
    const v = doc.toJS();
    if (v === null || v === undefined) return { value: {}, error: null };
    if (typeof v === 'object' && !Array.isArray(v)) return { value: v, error: null };
    return {
      value: {},
      error: {
        code: 'NOT_A_MAPPING',
        message: `frontmatter root is a ${Array.isArray(v) ? 'sequence' : typeof v}, not a mapping`,
      },
    };
  } catch (err) {
    return {
      value: {},
      error: { code: 'YAML_EXCEPTION', message: String(err?.message ?? err).split(/\r?\n/)[0] },
    };
  }
}

// Internal: not re-exported from index.mjs.
export function readFrontmatter(source) {
  const match = source.match(FRONTMATTER_RE);
  if (!match) return null;
  return readYaml(match[1]);
}

export function extractFrontmatter(source) {
  const result = readFrontmatter(source);
  return result === null ? null : result.value;
}

export function parseYaml(text) {
  return readYaml(text).value;
}

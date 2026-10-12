// Walks the plugin's installed skills/ and agents/ trees and loads each
// component's frontmatter. Extracted from audit.mjs for the audit-core
// package split (#457); see ADR-0057 verdict B (plugin-root parameter, not a
// "components directory") and verdict D (the loader returns parsed
// frontmatter rather than pre-deriving policy fields from it).

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { fileExists, dirExists } from './probes.mjs';
import { readFrontmatter } from './frontmatter.mjs';

export async function walkComponents(pluginRoot) {
  if (typeof pluginRoot !== 'string') {
    throw new TypeError('walkComponents: pluginRoot must be a string (plugin root directory)');
  }

  const components = [];

  const skillsDir = join(pluginRoot, 'skills');
  if (await dirExists(skillsDir)) {
    const skills = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of skills) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(skillsDir, entry.name, 'SKILL.md');
      if (!(await fileExists(skillFile))) continue;
      // Unreadable and malformed components are passed through deliberately.
      components.push(await loadComponent('skill', entry.name, skillFile));
    }
  }

  const agentsDir = join(pluginRoot, 'agents');
  if (await dirExists(agentsDir)) {
    const agents = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of agents) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const name = entry.name.replace(/\.md$/, '');
      components.push(await loadComponent('agent', name, join(agentsDir, entry.name)));
    }
  }

  return components;
}

export async function loadComponent(type, name, filePath) {
  // An I/O failure resolves to an unreadable component (readError set)
  // rather than rejecting. The filePath TypeError is the caller-contract
  // exception (gvt-dev ADR-0057 Q2). A parse failure likewise resolves to a
  // malformed component (parseError set, frontmatter null); parse handling
  // stays outside the try (GenvidTechnologies/audit-core#4).
  if (typeof filePath !== 'string') {
    throw new TypeError(
      `loadComponent: filePath must be a string (component file path), got ${typeof filePath}`,
    );
  }
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    return {
      type,
      name,
      expects: null,
      frontmatter: null,
      readError: {
        code: typeof err?.code === 'string' ? err.code : null,
        message: String(err?.message ?? err),
      },
    };
  }
  const parsed = readFrontmatter(content);
  if (!parsed) return { type, name, expects: null, frontmatter: null };
  if (parsed.error) {
    return { type, name, expects: null, frontmatter: null, parseError: parsed.error };
  }
  return {
    type,
    name,
    expects: parsed.value.metadata?.expects ?? null,
    frontmatter: parsed.value,
  };
}

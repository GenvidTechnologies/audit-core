// Walks the plugin's installed skills/ and agents/ trees and loads each
// component's frontmatter. Extracted from audit.mjs for the audit-core
// package split (#457); see ADR-0057 verdict B (plugin-root parameter, not a
// "components directory") and verdict D (the loader returns parsed
// frontmatter rather than pre-deriving policy fields from it).

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { readFrontmatter } from './frontmatter.mjs';
import { probePath, toProbeError } from './probes.mjs';

export async function walkComponents(pluginRoot) {
  if (typeof pluginRoot !== 'string') {
    throw new TypeError('walkComponents: pluginRoot must be a string (plugin root directory)');
  }

  const components = [];

  // Symlinked entries are followed (a Dirent for a link answers false to
  // isDirectory/isFile). Any stat failure other than "nothing is there"
  // surfaces as an unreadable record rather than a silent skip (#19).
  const skillsDir = join(pluginRoot, 'skills');
  for (const entry of await readTree('skill', skillsDir, 'skills/', components)) {
    const entryPath = join(skillsDir, entry.name);
    if (!entry.isDirectory()) {
      if (!entry.isSymbolicLink()) continue;
      const target = await probePath(entryPath);
      if (target.kind === 'error') {
        components.push(unreadable('skill', entry.name, target.error));
        continue;
      }
      if (target.kind !== 'directory') continue;
    }
    const skillFile = join(entryPath, 'SKILL.md');
    const probe = await probePath(skillFile);
    if (probe.kind === 'error') {
      components.push(unreadable('skill', entry.name, probe.error));
      continue;
    }
    if (probe.kind !== 'file') continue;
    // Unreadable and malformed components are passed through deliberately.
    components.push(await loadComponent('skill', entry.name, skillFile));
  }

  const agentsDir = join(pluginRoot, 'agents');
  for (const entry of await readTree('agent', agentsDir, 'agents/', components)) {
    if (!entry.name.endsWith('.md')) continue;
    const name = entry.name.replace(/\.md$/, '');
    const entryPath = join(agentsDir, entry.name);
    if (!entry.isFile()) {
      if (!entry.isSymbolicLink()) continue;
      const target = await probePath(entryPath);
      if (target.kind === 'error') {
        components.push(unreadable('agent', name, target.error));
        continue;
      }
      if (target.kind !== 'file') continue;
    }
    components.push(await loadComponent('agent', name, entryPath));
  }

  return components;
}

// List a skills/ or agents/ tree. A failure to stat or read the tree itself
// pushes an unreadable record named by `label` and yields no entries; an
// absent tree, or one that is not a directory, yields none silently.
async function readTree(type, dir, label, components) {
  const probe = await probePath(dir);
  if (probe.kind === 'error') {
    components.push(unreadable(type, label, probe.error));
    return [];
  }
  if (probe.kind !== 'directory') return [];
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    components.push(unreadable(type, label, err));
    return [];
  }
}

// Build the UnreadableComponent record for an I/O failure (readError set).
function unreadable(type, name, err) {
  return {
    type,
    name,
    expects: null,
    frontmatter: null,
    readError: toProbeError(err),
  };
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
    return unreadable(type, name, err);
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

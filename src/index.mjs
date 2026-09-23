// Public entry point for audit-core: the shared audit mechanism extracted from
// the gvt-dev plugin's audit-conventions skill (#457), against the seam pinned
// by ADR-0057 in that repo.
//
// This barrel re-exports only. It holds no logic of its own, so the modules
// beside it stay byte-identical to their gvt-dev originals while both copies
// exist, which is what bounds drift until the plugin imports from here (#458).
//
// The library is deliberately silent: it must not log, must not write files,
// and must not read process.env. It emits expectation records and nothing else
// -- no tally, no rendered Markdown -- and that silence is a contract property
// rather than an omission.

export const VERSION = '0.2.0';

export { extractFrontmatter, parseYaml } from './frontmatter.mjs';
export { resolveKey } from './config-resolve.mjs';
export { fileExists, dirExists, commandExists } from './probes.mjs';
export { walkComponents, loadComponent } from './component-walk.mjs';
export { evaluateFile, evaluateConfig, evaluateTool } from './evaluate.mjs';

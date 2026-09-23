// Hand-maintained declarations matching src/index.mjs exactly.
//
// This package ships no build step: nothing generates this file from the
// .mjs sources, and tsconfig.json's `include` is scoped to `src` alone, so
// `tsc --noEmit` checks this declaration in isolation and never diffs it
// against index.mjs. Keeping the two in sync is a manual obligation on every
// change to the barrel's export list or to a returned shape.
//
// test/dts-parity.test.mjs pins the one thing that CAN be checked
// mechanically: that the set of names declared here matches the set of names
// the barrel actually exports at runtime. It does not check the declared
// *shapes* — those still rely on manual review against the source modules.

export declare const VERSION: string;

export declare function extractFrontmatter(source: string): Record<string, unknown> | null;
export declare function parseYaml(text: string): Record<string, unknown>;

export type KeyResolution =
  | { found: true;  value: unknown }
  | { found: false; missingAt: string };
export declare function resolveKey(obj: unknown, dottedKey: string): KeyResolution;

export declare function fileExists(path: string): Promise<boolean>;
export declare function dirExists(path: string): Promise<boolean>;
export declare function commandExists(cmd: string): boolean;

export type ComponentType = 'skill' | 'agent';
export interface ExpectsFileEntry   { path: string;    required?: boolean; reason: string }
export interface ExpectsConfigEntry { key: string; in?: string; required?: boolean; reason: string }
export interface ExpectsToolEntry   { command: string; required?: boolean; reason: string }
export interface Expects { files?: ExpectsFileEntry[]; config?: ExpectsConfigEntry[]; tools?: ExpectsToolEntry[] }
export interface Component {
  type: ComponentType;
  name: string;
  expects: Expects | null;
  frontmatter: Record<string, unknown> | null;
}
export declare function walkComponents(pluginRoot: string): Promise<Component[]>;
export declare function loadComponent(type: ComponentType, name: string, filePath: string): Promise<Component>;

// A satisfied finding carries exactly these 5 keys; an unsatisfied one
// carries these 5 plus severity/detail/reason (8 total). The two are
// discriminated on `ok` rather than modeled as one interface with optional
// fields, because on the satisfied path severity/detail/reason are ABSENT,
// not undefined — an optional-field model would claim a satisfied finding
// merely *might* carry a severity, which is false.
export type ExpectationKind = 'file' | 'config' | 'tool';
export type Severity = 'error' | 'info';
export interface SatisfiedExpectation {
  kind: ExpectationKind; component: string; target: string; ok: true;  required: boolean;
}
export interface UnsatisfiedExpectation {
  kind: ExpectationKind; component: string; target: string; ok: false; required: boolean;
  severity: Severity; detail: string; reason?: string;
}
export type ExpectationFinding = SatisfiedExpectation | UnsatisfiedExpectation;

export interface FileResolution   { path: string; probe: 'file' | 'directory'; target: string }
export interface ConfigResolution { path: string; source: string;              target: string }
export type FileResolver   = (entry: ExpectsFileEntry)   => FileResolution;
export type ConfigResolver = (entry: ExpectsConfigEntry) => ConfigResolution;

export declare function evaluateFile(component: Component, entry: ExpectsFileEntry, resolve: FileResolver): Promise<ExpectationFinding>;
export declare function evaluateConfig(component: Component, entry: ExpectsConfigEntry, resolve: ConfigResolver): Promise<ExpectationFinding>;
export declare function evaluateTool(component: Component, entry: ExpectsToolEntry): ExpectationFinding;

// Ported from gvt-dev plugin/skills/audit-conventions/scripts/test/frontmatter.test.mjs
// at commit 098121e, for GenvidTechnologies/audit-core#13. It imports through
// the barrel, not ../src/frontmatter.mjs, on purpose: it pins the public surface.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFrontmatter, parseYaml } from '../src/index.mjs';

test('extractFrontmatter: missing frontmatter returns null', () => {
  assert.equal(extractFrontmatter('# Just a markdown file'), null);
});

test('extractFrontmatter: parses simple top-level keys', () => {
  const md = `---
name: validate-changes
description: A test description
model: haiku
---

# Body
`;
  const fm = extractFrontmatter(md);
  assert.equal(fm.name, 'validate-changes');
  assert.equal(fm.description, 'A test description');
  assert.equal(fm.model, 'haiku');
});

test('parseYaml: nested object', () => {
  const yaml = `metadata:
  type: feedback
  scope: global`;
  const out = parseYaml(yaml);
  assert.deepEqual(out, { metadata: { type: 'feedback', scope: 'global' } });
});

test('parseYaml: array of objects in metadata.expects.files', () => {
  const yaml = `metadata:
  expects:
    files:
      - path: CLAUDE.md
        reason: Project context lives here
      - path: docs/TOC.md
        required: false
        reason: Used if present`;
  const out = parseYaml(yaml);
  assert.deepEqual(out, {
    metadata: {
      expects: {
        files: [
          { path: 'CLAUDE.md', reason: 'Project context lives here' },
          { path: 'docs/TOC.md', required: false, reason: 'Used if present' },
        ],
      },
    },
  });
});

test('parseYaml: full skill frontmatter shape', () => {
  const yaml = `name: plan-task
description: A multi-paragraph description that mentions things like "config keys" and (parentheses).
metadata:
  expects:
    files:
      - path: CLAUDE.md
        reason: project context
    config:
      - key: commands.validate
        in: .gvt-agent.json
        required: false
        reason: optional config
    tools:
      - command: git
        reason: branch operations`;
  const out = parseYaml(yaml);
  assert.equal(out.name, 'plan-task');
  assert.ok(out.description.startsWith('A multi-paragraph'));
  assert.deepEqual(out.metadata.expects.files, [{ path: 'CLAUDE.md', reason: 'project context' }]);
  assert.deepEqual(out.metadata.expects.config, [
    { key: 'commands.validate', in: '.gvt-agent.json', required: false, reason: 'optional config' },
  ]);
  assert.deepEqual(out.metadata.expects.tools, [{ command: 'git', reason: 'branch operations' }]);
});

test('parseYaml: boolean values', () => {
  const yaml = `a: true
b: false`;
  const out = parseYaml(yaml);
  assert.equal(out.a, true);
  assert.equal(out.b, false);
});

test('parseYaml: quoted strings preserve content', () => {
  const yaml = `description: "value with: colon"
title: 'single quoted'`;
  const out = parseYaml(yaml);
  assert.equal(out.description, 'value with: colon');
  assert.equal(out.title, 'single quoted');
});

test('parseYaml: ignores comments and blank lines', () => {
  const yaml = `# top comment
name: foo

# middle comment
value: 42`;
  const out = parseYaml(yaml);
  assert.equal(out.name, 'foo');
  assert.equal(out.value, 42);
});

test('parseYaml: block body lines are consumed, never re-scanned as mapping keys', () => {
  // Regression test: body lines containing ": " used to be walked as
  // mapping keys once the block-scalar header was (mis)treated as a plain
  // scalar. This fixture is the shape that produced junk top-level keys.
  const yaml = `description: >-
  Trigger on requests like "do X: then Y".
  Second line: still body, not a key.
metadata:
  type: reference`;
  const out = parseYaml(yaml);
  assert.deepEqual(out, {
    description: 'Trigger on requests like "do X: then Y". Second line: still body, not a key.',
    metadata: { type: 'reference' },
  });
});

test('parseYaml: folded block scalar with clip chomping (>) keeps exactly one trailing newline', () => {
  const yaml = 'description: >\n  folded line one\n  folded line two\nname: after';
  const out = parseYaml(yaml);
  assert.deepEqual(out, { description: 'folded line one folded line two\n', name: 'after' });
});

test('parseYaml: folded block scalar with strip chomping (>-) drops the trailing newline', () => {
  const yaml = 'description: >-\n  folded line one\n  folded line two\nname: after';
  const out = parseYaml(yaml);
  assert.deepEqual(out, { description: 'folded line one folded line two', name: 'after' });
});

test('parseYaml: folded block scalar with keep chomping (>+) preserves trailing blank lines', () => {
  const yaml = 'description: >+\n  folded line one\n  folded line two\n\n\n';
  const out = parseYaml(yaml);
  assert.equal(out.description, 'folded line one folded line two\n\n\n');
});

test('parseYaml: folded block scalar with keep chomping (>+), dedent-terminated with one trailing blank line', () => {
  // Dedent-terminated (ended by a sibling key, not EOF): the terminator of
  // the last content line is real but leaves no "" array element, so it
  // must be added on top of the one genuine trailing blank line — 2
  // newlines total, not 1.
  const yaml = 'description: >+\n  folded line one\n  folded line two\n\nname: after';
  const out = parseYaml(yaml);
  assert.deepEqual(out, { description: 'folded line one folded line two\n\n', name: 'after' });
});

test('parseYaml: folded block scalar with keep chomping (>+), dedent-terminated with two trailing blank lines', () => {
  const yaml = 'description: >+\n  folded line one\n  folded line two\n\n\nname: after';
  const out = parseYaml(yaml);
  assert.deepEqual(out, { description: 'folded line one folded line two\n\n\n', name: 'after' });
});

test('parseYaml: folded block scalar folds an interior blank line to a single newline', () => {
  const yaml = 'description: >\n  paragraph one\n\n  paragraph two\n';
  const out = parseYaml(yaml);
  assert.equal(out.description, 'paragraph one\nparagraph two\n');
});

test('parseYaml: literal block scalar with clip chomping (|) keeps exactly one trailing newline', () => {
  const yaml = 'description: |\n  line one\n  line two\nname: after';
  const out = parseYaml(yaml);
  assert.deepEqual(out, { description: 'line one\nline two\n', name: 'after' });
});

test('parseYaml: literal block scalar with strip chomping (|-) drops the trailing newline', () => {
  const yaml = 'description: |-\n  line one\n  line two\nname: after';
  const out = parseYaml(yaml);
  assert.deepEqual(out, { description: 'line one\nline two', name: 'after' });
});

test('parseYaml: literal block scalar with keep chomping (|+) preserves trailing blank lines', () => {
  const yaml = 'description: |+\n  line one\n  line two\n\n\n';
  const out = parseYaml(yaml);
  assert.equal(out.description, 'line one\nline two\n\n\n');
});

test('parseYaml: literal block scalar with keep chomping (|+), dedent-terminated with one trailing blank line', () => {
  const yaml = 'description: |+\n  line one\n  line two\n\nname: after';
  const out = parseYaml(yaml);
  assert.deepEqual(out, { description: 'line one\nline two\n\n', name: 'after' });
});

test('parseYaml: literal block scalar with keep chomping (|+), dedent-terminated with two trailing blank lines', () => {
  const yaml = 'description: |+\n  line one\n  line two\n\n\nname: after';
  const out = parseYaml(yaml);
  assert.deepEqual(out, { description: 'line one\nline two\n\n\n', name: 'after' });
});

test('parseYaml: literal block scalar preserves an interior blank line as-is', () => {
  const yaml = 'description: |\n  line one\n\n  line two\n';
  const out = parseYaml(yaml);
  assert.equal(out.description, 'line one\n\nline two\n');
});

// --- #4: yaml-backed parsing -------------------------------------------------

test('R1: a colon-space inside a plain scalar is a YAML error and yields {} without throwing', () => {
  const md = '---\nname: x\ndescription: Use it: now\nmetadata:\n  pillar: spec\n---\n';
  assert.deepEqual(extractFrontmatter(md), {});
  assert.deepEqual(
    parseYaml('name: x\ndescription: Use it: now\nmetadata:\n  pillar: spec'),
    {}
  );
});

test('R4: single-quoted scalars unescape doubled quotes', () => {
  assert.deepEqual(extractFrontmatter("---\ntitle: 'It''s here'\n---\nbody\n"), { title: "It's here" });
  assert.deepEqual(extractFrontmatter("---\ntitle: 'plain'\n---\nbody\n"), { title: 'plain' });
  assert.deepEqual(extractFrontmatter("---\ntitle: ''\n---\nbody\n"), { title: '' });
});

test('N1 (string API): scalar root, list root, and empty document all yield {}', () => {
  assert.deepEqual(extractFrontmatter('---\njust a string\n---\n'), {});
  assert.deepEqual(extractFrontmatter('---\n- a\n- b\n---\n'), {});
  assert.deepEqual(extractFrontmatter('---\n\n---\n'), {});
});

test('comment pin: a plain scalar is cut at " #"', () => {
  // YAML's comment rule: " #" starts a comment. The one divergence the #4
  // differential found, in gvt-construct3's create-c3-op.
  assert.deepEqual(extractFrontmatter('---\nreason: see chef #89, below\n---\n'), { reason: 'see chef' });
});

test('no-throw: an unresolved alias, which makes yaml throw in toJS, yields {}', () => {
  assert.deepEqual(parseYaml('a: *x'), {});
  assert.deepEqual(extractFrontmatter('---\na: *x\n---\n'), {});
});

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      // Node globals are declared explicitly. Without this, `no-undef` fires on
      // every Node built-in global — URL, process, Buffer, console — which is a
      // latent trap for a package whose source is entirely Node-targeted ESM.
      // Caught during standup: the first file to use `new URL(...)` failed lint.
      globals: globals.node,
    },
    ...js.configs.recommended,
  },
];

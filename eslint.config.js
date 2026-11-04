import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', console: 'readonly' },
    },
  },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly' } } },
);

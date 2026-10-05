import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', '*.config.ts'],
    extends: [...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['worker/**/*.js', 'support-worker/**/*.js'],
    languageOptions: { globals: globals.serviceworker },
    rules: {
      'no-unused-vars': ['warn', { caughtErrors: 'none' }],
      'no-useless-escape': 'warn',
    },
  },
  {
    files: ['*.config.{js,ts}', '*/test/**/*.js', 'tests/**/*.js'],
    // los tests e2e tambien llevan codigo que corre en el navegador (page.evaluate)
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);

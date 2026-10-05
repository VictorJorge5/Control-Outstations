import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, __APP_BUILD__: 'readonly' },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { caughtErrors: 'none' }],
      'no-useless-escape': 'warn',
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
    files: ['*.config.js', '*/test/**/*.js', 'tests/**/*.js'],
    // los tests e2e tambien llevan codigo que corre en el navegador (page.evaluate)
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];

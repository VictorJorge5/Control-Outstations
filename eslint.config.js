import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/'] },
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
    files: ['worker/**/*.js'],
    languageOptions: { globals: globals.serviceworker },
    rules: {
      'no-unused-vars': ['warn', { caughtErrors: 'none' }],
      'no-useless-escape': 'warn',
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
];

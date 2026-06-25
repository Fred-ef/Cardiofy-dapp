/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'n', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:n/recommended',
    'plugin:security/recommended-legacy',
    'prettier',
  ],
  rules: {
    'n/no-missing-import': 'off',          // gestito da TypeScript
    'n/no-extraneous-import': 'off',       // gestito dal workspace
    'security/detect-object-injection': 'off', // troppo rumoroso, falsi positivi
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.cjs'],
};

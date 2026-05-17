const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
    baseDirectory: __dirname,
    resolvePluginsRelativeTo: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [
    ...compat.config({
        parser: '@typescript-eslint/parser',
        extends: [
            'eslint:recommended',
            'plugin:@typescript-eslint/recommended',
            'plugin:prettier/recommended'
        ],
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module'
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off'
        }
    }),
    {
        ignores: [
            'dist/**',
            'coverage/**',
            'node_modules/**',
            'eslint.config.js',
            // Generated Playwright harness bundles (same as .gitignore)
            'src/__tests__/playwright/harness/**/*.js',
            'src/__tests__/playwright/harness/**/*.js.map',
        ]
    },
    {
        files: ['scripts/**/*.js'],
        env: {
            node: true,
            es2022: true
        },
        globals: {
            process: 'readonly',
            console: 'readonly',
            require: 'readonly'
        },
        rules: {
            'no-console': 'off', // Build scripts can use console.log
            '@typescript-eslint/no-require-imports': 'off', // Node.js build scripts use require
            '@typescript-eslint/no-var-requires': 'off'
        }
    }
];

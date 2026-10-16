import js from '@eslint/js';

export default [
    {ignores: ['node_modules/**', 'dist/**']},
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {global: 'readonly', ARGV: 'readonly', print: 'readonly', printerr: 'readonly',
                console: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly'},
        },
        rules: {
            'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}],
            'no-constant-condition': ['error', {checkLoops: false}],
            'no-var': 'error',
            'prefer-const': 'error',
            'eqeqeq': ['error', 'always'],
            'no-unsafe-finally': 'error',
        },
    },
];

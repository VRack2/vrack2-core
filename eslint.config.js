/**
 * ESLint 9+ flat config (replaces .eslintrc.js).
 * Rule set: eslint:recommended + @typescript-eslint/recommended — same as before.
 */
const js = require('@eslint/js');
const tseslintPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

// Node.js globals used across src/tests/configs (no-undef support for plain JS files)
const nodeGlobals = {
    process: 'readonly',
    Buffer: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    console: 'readonly',
    require: 'readonly',
    module: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    queueMicrotask: 'readonly',
    structuredClone: 'readonly',
};

module.exports = [
    // Build output is not linted (node_modules/ is ignored by default)
    { ignores: ['lib/**'] },

    js.configs.recommended,

    { languageOptions: { globals: nodeGlobals } },

    {
        files: ['**/*.ts', '**/*.mts'],
        languageOptions: { parser: tsParser },
        plugins: { '@typescript-eslint': tseslintPlugin },
        rules: {
            ...tseslintPlugin.configs['flat/recommended'].rules,
            // Project choice: `any` is not an error here
            '@typescript-eslint/no-explicit-any': 'off',
            // TS files are type-checked by tsc — core no-undef doesn't understand imports/types
            'no-undef': 'off',
            // Use the TS-aware unused-vars rule; event-handler signatures often carry intentional unused args
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
        },
    },
];

import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const statements = ['const', 'let', 'var', 'expression'];
const blocks = ['block-like', 'function', 'class'];
const openers = ['return', 'throw', 'if', 'for', 'while', 'switch', 'try'];

export default defineConfig([
    ...nextVitals,
    ...nextTs,
    prettier,
    {
        plugins: { '@stylistic': stylistic },
        rules: {
            '@stylistic/padding-line-between-statements': [
                'error',
                { blankLine: 'always', prev: 'directive', next: '*' },
                { blankLine: 'any', prev: 'directive', next: 'directive' },
                { blankLine: 'always', prev: 'import', next: '*' },
                { blankLine: 'any', prev: 'import', next: 'import' },
                { blankLine: 'always', prev: '*', next: 'export' },
                { blankLine: 'always', prev: 'export', next: '*' },
                { blankLine: 'any', prev: 'export', next: 'export' },
                { blankLine: 'always', prev: '*', next: blocks },
                { blankLine: 'always', prev: blocks, next: '*' },
                { blankLine: 'always', prev: '*', next: openers },
                { blankLine: 'always', prev: statements, next: '*' },
                { blankLine: 'any', prev: statements, next: statements },
                {
                    blankLine: 'always',
                    prev: '*',
                    next: ['multiline-const', 'multiline-expression'],
                },
                {
                    blankLine: 'always',
                    prev: ['multiline-const', 'multiline-expression'],
                    next: '*',
                },
            ],
            '@stylistic/lines-between-class-members': [
                'error',
                'always',
                { exceptAfterSingleLine: true },
            ],
            curly: ['error', 'all'],
        },
    },
    globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';
import svelteConfig from '../../svelte.config.js';

const svelteRules = [
	svelte.configs.recommended,
	svelte.configs.prettier,
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.json', './tsconfig.eslint.json'],
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			'svelte/no-at-html-tags': 'warn',
			'svelte/no-dom-manipulating': 'warn',
			'svelte/no-dupe-else-if-blocks': 'error',
			'svelte/no-navigation-without-resolve': 'warn',
			'svelte/no-reactive-reassign': 'error',
			'svelte/no-store-async': 'error',
			'svelte/require-each-key': 'error'
		}
	}
];

export default svelteRules;

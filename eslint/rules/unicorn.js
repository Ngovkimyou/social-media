import unicorn from 'eslint-plugin-unicorn';

const unicornRules = [
	{
		files: [
			'src/**/*.js',
			'src/**/*.ts',
			'src/**/*.svelte',
			'src/**/*.svelte.js',
			'src/**/*.svelte.ts'
		],
		plugins: {
			unicorn
		},
		rules: {
			'unicorn/consistent-function-scoping': 'warn',
			'unicorn/no-null': 'error',
			'unicorn/no-useless-undefined': 'warn',
			'unicorn/prefer-array-find': 'warn',
			'unicorn/prefer-array-some': 'warn',
			'unicorn/prefer-optional-catch-binding': 'warn',
			'unicorn/prefer-string-starts-ends-with': 'warn'
		}
	}
];

export default unicornRules;

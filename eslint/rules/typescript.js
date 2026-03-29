import ts from 'typescript-eslint';

const typescriptRules = [
	...ts.configs.recommended,
	{
		files: ['src/**/*.{.js,.ts,.tsx,.svelte,.mts.cts}'],
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		files: ['src/**/*.{.js,.ts,.tsx,.svelte,.mts.cts}'],
		rules: {
			// TypeScript correctness and explicitness
			'@typescript-eslint/ban-ts-comment': [
				'warn',
				{ 'ts-expect-error': 'allow-with-description' }
			],
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{ prefer: 'type-imports', fixStyle: 'separate-type-imports' }
			],
			'@typescript-eslint/explicit-function-return-type': [
				'error',
				{
					allowExpressions: true,
					allowHigherOrderFunctions: true,
					allowTypedFunctionExpressions: true
				}
			],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-floating-promises': 'warn',
			'@typescript-eslint/no-inferrable-types': 'warn',
			'@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
			'@typescript-eslint/no-unnecessary-condition': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			],
			'@typescript-eslint/no-unused-expressions': 'warn',
			'@typescript-eslint/prefer-nullish-coalescing': 'warn',
			'@typescript-eslint/prefer-optional-chain': 'warn'
		}
	}
];

export default typescriptRules;

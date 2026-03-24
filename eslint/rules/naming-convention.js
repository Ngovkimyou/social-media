const namingConventionRules = [
	{
		files: ['src/**/*.ts', 'src/**/*.svelte', 'src/**/*.svelte.ts', 'src/**/*.svelte.js'],
		rules: {
			'@typescript-eslint/naming-convention': [
				'warn',

				{
					selector: 'default',
					format: ['snake_case'],
					leadingUnderscore: 'allow',
					trailingUnderscore: 'allow'
				},
				{
					selector: 'variable',
					format: ['snake_case', 'UPPER_CASE'],
					leadingUnderscore: 'allow',
					trailingUnderscore: 'allow'
				},
				{
					selector: 'function',
					format: ['snake_case']
				},
				{
					selector: 'parameter',
					format: ['snake_case'],
					leadingUnderscore: 'allow'
				},
				{
					selector: 'accessor',
					format: ['snake_case']
				},
				{
					selector: 'memberLike',
					modifiers: ['private'],
					format: ['snake_case'],
					leadingUnderscore: 'require'
				},
				{
					selector: 'variable',
					types: ['boolean'],
					format: ['snake_case'],
					prefix: ['is', 'has', 'should', 'can', 'will']
				},
				{
					selector: 'import',
					format: ['camelCase', 'PascalCase']
				},
				{
					selector: 'typeLike',
					format: ['PascalCase']
				},
				{
					selector: 'enumMember',
					format: ['UPPER_CASE', 'PascalCase']
				},
				{
					selector: 'objectLiteralProperty',
					format: null
				},
				{
					selector: 'typeProperty',
					format: null
				},
				{
					selector: 'objectLiteralMethod',
					format: null
				},
				{
					selector: 'classProperty',
					modifiers: ['readonly'],
					format: ['snake_case', 'UPPER_CASE']
				}
			]
		}
	},
	{
		files: ['src/routes/demo/**/*', 'src/stories/**/*'],
		rules: {
			'@typescript-eslint/naming-convention': 'off'
		}
	}
];

export default namingConventionRules;

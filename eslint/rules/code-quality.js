const codeQualityRules = [
	{
		rules: {
			complexity: ['error', 15],
			'max-depth': ['error', 2],
			curly: ['warn', 'all'],
			eqeqeq: ['warn', 'always'],
			'no-alert': 'warn',
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'no-debugger': 'warn',
			'no-duplicate-imports': 'warn',
			'no-else-return': ['warn', { allowElseIf: false }],
			'no-empty': ['warn', { allowEmptyCatch: true }],
			'no-lonely-if': 'warn',
			'no-undef': 'off',
			'no-unneeded-ternary': 'warn',
			'no-useless-catch': 'error',
			'no-useless-concat': 'warn',
			'no-useless-return': 'error',
			'object-shorthand': 'warn',
			'prefer-const': ['warn', { destructuring: 'all' }],
			'prefer-object-spread': 'warn',
			'prefer-template': 'warn'
		}
	}
];

export default codeQualityRules;

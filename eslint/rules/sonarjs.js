import sonarjs from 'eslint-plugin-sonarjs';

const sonarjsRules = [
	{
		files: [
			'src/**/*.js',
			'src/**/*.ts',
			'src/**/*.svelte',
			'src/**/*.svelte.js',
			'src/**/*.svelte.ts'
		],
		plugins: {
			sonarjs
		},
		rules: {
			'sonarjs/cognitive-complexity': ['warn', 20],
			'sonarjs/no-collapsible-if': 'warn',
			'sonarjs/no-commented-code': 'error',
			'sonarjs/no-duplicated-branches': 'warn',
			'sonarjs/no-identical-functions': 'warn',
			'sonarjs/no-nested-switch': 'warn',
			'sonarjs/no-redundant-boolean': 'warn',
			'sonarjs/prefer-immediate-return': 'warn'
		}
	}
];

export default sonarjsRules;

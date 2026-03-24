import storybook from 'eslint-plugin-storybook';

const storybookRules = [
	...storybook.configs['flat/recommended'],
	{
		files: ['src/**/*.stories.svelte', 'src/**/*.stories.ts', 'src/**/*.stories.js'],
		rules: {
			'storybook/no-title-property-in-meta': 'warn',
			'storybook/prefer-pascal-case': 'warn'
		}
	}
];

export default storybookRules;

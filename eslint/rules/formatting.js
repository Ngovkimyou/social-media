import prettier from 'eslint-config-prettier';

const formattingRules = [
	prettier,
	{
		rules: {
			'arrow-body-style': ['warn', 'as-needed'],
			'no-trailing-spaces': 'warn'
		}
	}
];

export default formattingRules;

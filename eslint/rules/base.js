import js from '@eslint/js';
import globals from 'globals';

const baseRules = [
	js.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	}
];

export default baseRules;

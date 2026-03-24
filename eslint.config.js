import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import { defineConfig } from 'eslint/config';
import baseRules from './eslint/rules/base.js';
import codeQualityRules from './eslint/rules/code-quality.js';
import formattingRules from './eslint/rules/formatting.js';
import ignores from './eslint/rules/ignores.js';
import namingConventionRules from './eslint/rules/naming-convention.js';
import sonarjsRules from './eslint/rules/sonarjs.js';
import storybookRules from './eslint/rules/storybook.js';
import svelteRules from './eslint/rules/svelte.js';
import typescriptRules from './eslint/rules/typescript.js';
import unicornRules from './eslint/rules/unicorn.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	ignores,
	...baseRules,
	...codeQualityRules,
	...typescriptRules,
	...namingConventionRules,
	...svelteRules,
	...unicornRules,
	...sonarjsRules,
	...storybookRules,
	...formattingRules
);

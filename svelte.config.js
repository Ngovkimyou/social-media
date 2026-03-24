import { mdsvex } from 'mdsvex';
import adapterAuto from '@sveltejs/adapter-auto';
import adapterVercel from '@sveltejs/adapter-vercel';

const adapter = process.env.VERCEL ? adapterVercel() : adapterAuto();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: { adapter },
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	},
	preprocess: [mdsvex()],
	extensions: ['.svelte', '.svx']
};

export default config;

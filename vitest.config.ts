import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	test: {
		expect: {
			requireAssertions: true
		},
		environment: 'happy-dom',
		fileParallelism: false,
		pool: 'threads',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['src/lib/server/**']
	}
});

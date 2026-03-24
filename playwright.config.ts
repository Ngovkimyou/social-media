import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'http://127.0.0.1:4173'
	},
	webServer: {
		command: 'cmd /c pnpm dev -- --host 127.0.0.1 --port 4173',
		port: 4173,
		reuseExistingServer: true
	},
	testMatch: '**/*.e2e.{ts,js}'
});

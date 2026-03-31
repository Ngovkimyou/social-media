import { createAuthClient, type BetterAuthClientPlugin } from 'better-auth/client';
import { sentinelClient } from '@better-auth/infra/client';

const sentinel_client_plugin = sentinelClient() as unknown as BetterAuthClientPlugin;

export const auth_client = createAuthClient({
	plugins: [sentinel_client_plugin]
});

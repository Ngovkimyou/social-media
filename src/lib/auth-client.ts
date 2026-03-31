import { createAuthClient } from 'better-auth/client';
import { sentinelClient } from '@better-auth/infra/client';

export const auth_client = createAuthClient({
	plugins: [sentinelClient()]
});

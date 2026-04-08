import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { dash } from '@better-auth/infra';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { get_db } from '$lib/server/db';
import {
	log_security_env_warnings,
	resolve_base_url,
	resolve_trusted_origins
} from '$lib/server/utilities/security-config';

// Keep inference for `betterAuth(...)` options shape to avoid broad `BetterAuthOptions` conflicts.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const create_auth = () =>
	betterAuth({
		baseURL: resolve_base_url(),
		secret: env['BETTER_AUTH_SECRET'],
		database: drizzleAdapter(get_db(), { provider: 'pg' }),
		emailAndPassword: { enabled: true },
		trustedOrigins: resolve_trusted_origins(),
		plugins: [dash(), sveltekitCookies(getRequestEvent)] // make sure this is the last plugin in the array
	});

let auth: ReturnType<typeof create_auth> | undefined;

export const get_auth = (): ReturnType<typeof create_auth> => {
	log_security_env_warnings();
	auth ??= create_auth();
	return auth;
};

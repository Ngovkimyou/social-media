import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { dash } from '@better-auth/infra';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { get_db } from '$lib/server/db';

const resolve_base_url = (): string => {
	const origin = env['ORIGIN'];

	if (origin) {
		return origin;
	}

	const vercel_url = env['VERCEL_URL'];

	if (vercel_url) {
		return `https://${vercel_url}`;
	}

	throw new Error('ORIGIN is not configured. Set ORIGIN or provide VERCEL_URL in deployment.');
};

const resolve_trusted_origins = (): string[] => {
	const configured = env['TRUSTED_AUTH_ORIGINS'] ?? '';
	const configured_origins = configured
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	return Array.from(new Set([resolve_base_url(), ...configured_origins]));
};

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
	auth ??= create_auth();
	return auth;
};

import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { dash } from '@better-auth/infra';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { get_db } from '$lib/server/db';

const create_auth = (): ReturnType<typeof betterAuth> =>
	betterAuth({
		baseURL: env['ORIGIN'],
		secret: env['BETTER_AUTH_SECRET'],
		database: drizzleAdapter(get_db(), { provider: 'pg' }),
		emailAndPassword: { enabled: true },
		plugins: [dash(), sveltekitCookies(getRequestEvent)] // make sure this is the last plugin in the array
	});

let auth: ReturnType<typeof create_auth> | undefined;

export const get_auth = (): ReturnType<typeof create_auth> => {
	auth ??= create_auth();
	return auth;
};

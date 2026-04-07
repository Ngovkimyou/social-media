import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { get_auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { randomBytes } from 'node:crypto';

const get_safe_error_message = (error: unknown): string =>
	error instanceof Error ? error.message : 'Unknown error';

const STATIC_SECURITY_HEADERS = {
	'cross-origin-opener-policy': 'same-origin',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'permissions-policy': 'camera=(), geolocation=(), microphone=()'
} as const;

const create_content_security_policy = (nonce: string): string =>
	[
		"default-src 'self'",
		"base-uri 'self'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"object-src 'none'",
		`script-src 'self' 'nonce-${nonce}'`,
		"script-src-attr 'none'",
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data: https://fonts.gstatic.com",
		"connect-src 'self' https: wss:",
		"media-src 'self' blob: https:",
		"worker-src 'self' blob:",
		'upgrade-insecure-requests'
	].join('; ');

const apply_security_headers = (response: Response, nonce: string): Response => {
	response.headers.set('content-security-policy', create_content_security_policy(nonce));

	for (const [header, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
		response.headers.set(header, value);
	}

	return response;
};

const get_csp_nonce = (event: Parameters<Handle>[0]['event']): string => {
	event.locals.csp_nonce ??= randomBytes(16).toString('base64');
	return event.locals.csp_nonce;
};

const add_script_nonces = (html: string, nonce: string): string =>
	html.replace(/<script(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);

const handle_paraglide: Handle = async ({ event, resolve }) =>
	paraglideMiddleware(event.request, async ({ request, locale }) => {
		const nonce = get_csp_nonce(event);
		event.request = request;

		return apply_security_headers(
			await resolve(event, {
				transformPageChunk: ({ html }) =>
					add_script_nonces(
						html
							.replace('%paraglide.lang%', locale)
							.replace('%paraglide.dir%', getTextDirection(locale)),
						nonce
					)
			}),
			nonce
		);
	});

const handle_better_auth: Handle = async ({ event, resolve }) => {
	let auth: ReturnType<typeof get_auth> | undefined;

	try {
		auth = get_auth();
	} catch (error) {
		console.error(`Auth initialization failed: ${get_safe_error_message(error)}`);
		return apply_security_headers(await resolve(event), get_csp_nonce(event));
	}

	try {
		const session = await auth.api.getSession({ headers: event.request.headers });

		if (session) {
			event.locals.session = session.session;
			event.locals.user = session.user;
		}
	} catch (error) {
		console.error(`Auth session resolution failed: ${get_safe_error_message(error)}`);
	}

	return apply_security_headers(
		await svelteKitHandler({ event, resolve, auth, building }),
		get_csp_nonce(event)
	);
};

export const handle: Handle = sequence(handle_paraglide, handle_better_auth);

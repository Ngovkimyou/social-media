import { sequence } from '@sveltejs/kit/hooks';
import { building, dev } from '$app/environment';
import { get_auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { randomBytes } from 'node:crypto';
import { handle_csrf_protection } from '$lib/server/utilities/csrf';

const get_safe_error_message = (error: unknown): string =>
	error instanceof Error ? error.message : 'Unknown error';

const STATIC_SECURITY_HEADERS = {
	'cross-origin-opener-policy': 'same-origin',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'permissions-policy': 'camera=(), geolocation=(), microphone=()'
} as const;

const BYTES_PER_MEGABYTE = 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 512 * 1024;
const DEFAULT_MULTIPART_LIMIT_BYTES = 10 * BYTES_PER_MEGABYTE + MULTIPART_OVERHEAD_BYTES;
const ACTION_MULTIPART_LIMITS = {
	'/create_post': DEFAULT_MULTIPART_LIMIT_BYTES,
	'/update_cover_image': DEFAULT_MULTIPART_LIMIT_BYTES,
	'/update_profile_image': 5 * BYTES_PER_MEGABYTE + MULTIPART_OVERHEAD_BYTES
} as const;

const create_content_security_policy = (nonce: string): string =>
	[
		"default-src 'self'",
		"base-uri 'self'",
		"frame-ancestors 'none'",
		"frame-src 'self' https://challenges.cloudflare.com",
		"form-action 'self'",
		"object-src 'none'",
		`script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com`,
		"script-src-attr 'none'",
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com",
		"font-src 'self' data: https://fonts.gstatic.com",
		dev
			? "connect-src 'self' https://challenges.cloudflare.com wss://localhost:* ws://localhost:*"
			: "connect-src 'self' https://challenges.cloudflare.com",
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
	html.replaceAll(/<script(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);

const get_multipart_limit_bytes = (event: Parameters<Handle>[0]['event']): number | undefined => {
	if (event.request.method !== 'POST') {
		return undefined;
	}

	const content_type = event.request.headers.get('content-type')?.toLowerCase() ?? '';
	if (!content_type.startsWith('multipart/form-data')) {
		return undefined;
	}

	if (!event.url.pathname.startsWith('/profile/')) {
		return undefined;
	}

	for (const [action_key, limit_bytes] of Object.entries(ACTION_MULTIPART_LIMITS)) {
		if (event.url.search.startsWith(`?${action_key}`)) {
			return limit_bytes;
		}
	}

	return DEFAULT_MULTIPART_LIMIT_BYTES;
};

const handle_upload_size_limits: Handle = async ({ event, resolve }) => {
	const max_bytes = get_multipart_limit_bytes(event);

	if (max_bytes === undefined) {
		return resolve(event);
	}

	const content_length_header = event.request.headers.get('content-length');
	const content_length = Number.parseInt(content_length_header ?? '', 10);

	if (!Number.isNaN(content_length) && content_length > max_bytes) {
		return new Response('Upload is too large.', {
			status: 413
		});
	}

	return resolve(event);
};

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

export const handle: Handle = sequence(
	handle_csrf_protection,
	handle_upload_size_limits,
	handle_paraglide,
	handle_better_auth
);

import { record_security_event } from '$lib/server/utilities/security-monitor';
import { resolve_trusted_origins } from '$lib/server/utilities/security-config';
import type { Handle } from '@sveltejs/kit';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const get_request_origin = (request: Request): string | undefined => {
	const origin_header = request.headers.get('origin')?.trim();

	if (origin_header) {
		return origin_header;
	}

	const referer_header = request.headers.get('referer')?.trim();

	if (!referer_header) {
		return undefined;
	}

	try {
		return new URL(referer_header).origin;
	} catch {
		return undefined;
	}
};

export const handle_csrf_protection: Handle = async ({ event, resolve }) => {
	if (!MUTATION_METHODS.has(event.request.method.toUpperCase())) {
		return resolve(event);
	}

	const request_origin = get_request_origin(event.request);
	if (!request_origin) {
		await record_security_event({
			category: 'csrf_blocked',
			details: 'missing-origin',
			event
		});
		return new Response('Origin verification failed.', { status: 403 });
	}

	const allowed_origins = new Set(resolve_trusted_origins());
	allowed_origins.add(event.url.origin);

	if (!allowed_origins.has(request_origin)) {
		await record_security_event({
			category: 'csrf_blocked',
			details: `origin=${request_origin}`,
			event
		});
		return new Response('Origin verification failed.', { status: 403 });
	}

	return resolve(event);
};

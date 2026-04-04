import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { get_auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

const get_safe_error_message = (error: unknown): string =>
	error instanceof Error ? error.message : 'Unknown error';

const handle_paraglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

const handle_better_auth: Handle = async ({ event, resolve }) => {
	let auth: ReturnType<typeof get_auth> | undefined;

	try {
		auth = get_auth();
	} catch (error) {
		console.error(`Auth initialization failed: ${get_safe_error_message(error)}`);
		return resolve(event);
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

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handle_paraglide, handle_better_auth);

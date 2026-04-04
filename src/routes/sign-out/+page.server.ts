import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_auth } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(302, '/login');
	}
	return { user: event.locals.user };
};

export const actions: Actions = {
	signOut: async (event) => {
		try {
			const auth = get_auth();
			await auth.api.signOut({
				headers: event.request.headers
			});
		} catch {
			console.error('signOut failed');
		}

		throw redirect(302, '/login');
	}
};

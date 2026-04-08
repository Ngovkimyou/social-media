import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_auth } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(302, '/login');
	}

	throw redirect(302, '/home');
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
			return fail(500, { message: 'Unable to sign out right now. Please try again again.' });
		}

		throw redirect(302, '/login');
	}
};

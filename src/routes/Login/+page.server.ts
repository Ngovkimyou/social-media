import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/home');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const auth = get_auth();
		const form_data = await event.request.formData();
		const email = form_data.get('email')?.toString().trim() ?? '';
		const password = form_data.get('password')?.toString() ?? '';

		if (!email || !password) {
			return fail(400, { form: { error: 'Email and password are required' } });
		}

		try {
			await auth.api.signInEmail({
				body: {
					email,
					password,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				console.error('signInEmail failed', error);
				return fail(400, { message: 'Signin failed' });
			}
			console.error('signInEmail unexpected error', error);
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, '/home');
	}
};

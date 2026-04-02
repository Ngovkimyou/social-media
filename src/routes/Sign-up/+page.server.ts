import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { email_validator, password_validator } from '$lib/utilities/validator';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/home');
	}
	return {};
};

export const actions: Actions = {
	signUpEmail: async (event) => {
		const auth = get_auth();
		const form_data = await event.request.formData();
		const email = form_data.get('email')?.toString().trim() ?? false;
		const password = form_data.get('password')?.toString() ?? '';
		const name = form_data.get('name')?.toString() ?? '';

		try {
			if (!email || !password || !name) {
				return fail(400, { message: 'All fields are required' });
			}

			const is_password_Valid = password_validator(password);
			if (!is_password_Valid.is_Valid) {
				return fail(400, {
					message:
						'Password must be at least 8 characters long and contain uppercase, lowercase, and a number'
				});
			}

			if (name.length < 3 || name.length > 15) {
				return fail(400, { message: 'Name must be (min 3 , max 15) characters long' });
			}

			const is_email_Valid = email_validator(email);

			if (!is_email_Valid) {
				return fail(400, { message: 'Invalid email format' });
			}

			await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, '/home');
	}
};

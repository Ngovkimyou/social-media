import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { email_validator, password_validator, name_validator } from '$lib/utilities/validator';

const validate_sign_up_input = (params: {
	email: string;
	password: string;
	name: string;
}): { is_valid: true } | { is_valid: false; message: string } => {
	const { email, password, name } = params;

	if (!email || !password || !name) {
		return { is_valid: false, message: 'All fields are required' };
	}

	const is_password_valid = password_validator(password);
	if (!is_password_valid.is_Valid) {
		return { is_valid: false, message: is_password_valid.message ?? 'Invalid password' };
	}

	const is_name_valid = name_validator(name);
	if (!is_name_valid.is_Valid) {
		return { is_valid: false, message: is_name_valid.message ?? 'Invalid name' };
	}

	const is_email_valid = email_validator(email);
	if (!is_email_valid.is_Valid) {
		return { is_valid: false, message: is_email_valid.message ?? 'Invalid email' };
	}

	return { is_valid: true };
};

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
		const email = form_data.get('email')?.toString().trim() ?? '';
		const password = form_data.get('password')?.toString() ?? '';
		const name = form_data.get('name')?.toString() ?? '';

		try {
			const validation = validate_sign_up_input({ email, password, name });
			if (!validation.is_valid) {
				return fail(400, { message: validation.message });
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
				console.error('signUpEmail failed', error);
				return fail(400, { message: 'Registration failed' });
			}
			console.error('signUpEmail unexpected error', error);
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, '/home');
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { email_validator, password_validator, name_validator } from '$lib/utilities/validator';
import {
	clear_auth_rate_limit,
	consume_auth_rate_limit
} from '$lib/server/utilities/auth-rate-limit';

const SIGN_UP_FAILURE_MESSAGE =
	'Unable to create account. Please check your details and try again.';

const validate_sign_up_input = (params: {
	email: string;
	password: string;
	name: string;
}): { is_valid: true } | { is_valid: false; message: string } => {
	const { email, password, name } = params;

	if (!email && !password && !name) {
		return { is_valid: false, message: 'Email, password, and name are required' };
	}

	if (!email) {
		return { is_valid: false, message: 'Email is required' };
	}

	if (!password) {
		return { is_valid: false, message: 'Password is required' };
	}

	if (!name) {
		return { is_valid: false, message: 'Name is required' };
	}

	const is_email_valid = email_validator(email);
	if (!is_email_valid.is_Valid) {
		return {
			is_valid: false,
			message: is_email_valid.message ?? 'Please enter a valid email address'
		};
	}

	const is_password_valid = password_validator(password);
	if (!is_password_valid.is_Valid) {
		return { is_valid: false, message: is_password_valid.message ?? 'Invalid password' };
	}

	const is_name_valid = name_validator(name);
	if (!is_name_valid.is_Valid) {
		return { is_valid: false, message: is_name_valid.message ?? 'Invalid name' };
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
		const rate_limit = await consume_auth_rate_limit(event, 'sign-up');
		if (!rate_limit.is_allowed) {
			return fail(429, {
				message: `Too many sign-up attempts. Please try again in ${rate_limit.retry_after_seconds} seconds.`
			});
		}

		const form_data = await event.request.formData();
		const email = form_data.get('email')?.toString().trim() ?? '';
		const password = form_data.get('password')?.toString() ?? '';
		const name = form_data.get('name')?.toString().trim() ?? '';

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
				console.warn('signUpEmail failed');
				return fail(400, { message: SIGN_UP_FAILURE_MESSAGE });
			}
			console.error('signUpEmail unexpected error');
			return fail(500, { message: 'Unable to create account right now. Please try again later.' });
		}

		await clear_auth_rate_limit(event, 'sign-up');
		return redirect(302, '/home');
	}
};

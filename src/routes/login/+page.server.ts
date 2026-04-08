import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_auth } from '$lib/server/auth';
import { format_retry_duration } from '$lib/utilities/duration';
import { APIError } from 'better-auth/api';
import { email_validator, password_validator } from '$lib/utilities/validator';
import {
	clear_auth_rate_limit,
	consume_auth_rate_limit,
	register_distributed_auth_failure
} from '$lib/server/utilities/auth-rate-limit';
import {
	clear_sign_in_turnstile,
	get_turnstile_login_site_key,
	is_sign_in_turnstile_required,
	require_sign_in_turnstile,
	verify_turnstile_token
} from '$lib/server/utilities/turnstile';

const SIGN_IN_FAILURE_MESSAGE = 'Invalid email or password.';
const SIGN_IN_CHALLENGE_THRESHOLD = 3;

type SignInActionFailure = ReturnType<typeof fail>;

const get_turnstile_payload = (
	event: Parameters<PageServerLoad>[0]
): { turnstile_required: true; turnstile_site_key: string | undefined } => ({
	turnstile_required: true as const,
	turnstile_site_key: get_turnstile_login_site_key(event)
});

const fail_turnstile_validation = (
	event: Parameters<PageServerLoad>[0],
	email: string,
	message: string
): SignInActionFailure =>
	fail(400, {
		email,
		message,
		...get_turnstile_payload(event)
	});

const fail_sign_in_rate_limit = (
	email: string,
	retry_after_seconds: number,
	status: 429 = 429
): SignInActionFailure =>
	fail(status, {
		email,
		message: `Too many login attempts. Please try again in ${format_retry_duration(retry_after_seconds)}.`
	});

const should_require_turnstile = (
	event: Parameters<PageServerLoad>[0],
	current_attempt_count: number
): boolean =>
	current_attempt_count >= SIGN_IN_CHALLENGE_THRESHOLD || is_sign_in_turnstile_required(event);

const validate_turnstile_gate = async (
	event: Parameters<PageServerLoad>[0],
	email: string,
	token: string,
	current_attempt_count: number
): Promise<SignInActionFailure | undefined> => {
	if (!should_require_turnstile(event, current_attempt_count)) {
		return;
	}

	require_sign_in_turnstile(event);
	const turnstile_validation = await verify_turnstile_token(event, token);
	return turnstile_validation.is_valid
		? undefined
		: fail_turnstile_validation(event, email, turnstile_validation.message);
};

const fail_api_sign_in = async (
	event: Parameters<PageServerLoad>[0],
	email: string,
	current_attempt_count: number
): Promise<SignInActionFailure> => {
	const suspicious_attack_result = await register_distributed_auth_failure(event, 'sign-in', email);
	if (suspicious_attack_result.is_locked) {
		require_sign_in_turnstile(event);
		return fail(429, {
			...fail_sign_in_rate_limit(email, suspicious_attack_result.retry_after_seconds).data,
			...get_turnstile_payload(event)
		});
	}

	const requires_turnstile = current_attempt_count >= SIGN_IN_CHALLENGE_THRESHOLD;
	if (requires_turnstile) {
		require_sign_in_turnstile(event);
	}

	return fail(400, {
		email,
		message: SIGN_IN_FAILURE_MESSAGE,
		...(requires_turnstile ? get_turnstile_payload(event) : {})
	});
};

const validate_sign_in_input = (params: {
	email: string;
	password: string;
}): { is_valid: true } | { is_valid: false; message: string } => {
	const { email, password } = params;

	if (!email && !password) {
		return { is_valid: false, message: 'Email and password are required' };
	}

	if (!email) {
		return { is_valid: false, message: 'Email is required' };
	}

	if (!password) {
		return { is_valid: false, message: 'Password is required' };
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

	return { is_valid: true };
};

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/home');
	}
	return {
		turnstile_required: is_sign_in_turnstile_required(event),
		turnstile_site_key: get_turnstile_login_site_key(event)
	};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const auth = get_auth();
		const form_data = await event.request.formData();
		const email = form_data.get('email')?.toString().trim() ?? '';
		const password = form_data.get('password')?.toString() ?? '';
		const turnstile_token = form_data.get('cf-turnstile-response')?.toString() ?? '';
		const rate_limit = await consume_auth_rate_limit(event, 'sign-in', email);
		if (!rate_limit.is_allowed) {
			return fail_sign_in_rate_limit(email, rate_limit.retry_after_seconds);
		}

		const turnstile_failure = await validate_turnstile_gate(
			event,
			email,
			turnstile_token,
			rate_limit.current_attempt_count
		);
		if (turnstile_failure) {
			return turnstile_failure;
		}

		const validation = validate_sign_in_input({ email, password });
		if (!validation.is_valid) {
			return fail(400, { message: validation.message });
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
				console.warn('signInEmail failed');
				return fail_api_sign_in(event, email, rate_limit.current_attempt_count);
			}
			console.error('signInEmail unexpected error');
			return fail(500, { message: 'Unable to sign in right now. Please try again later.' });
		}

		clear_sign_in_turnstile(event);
		await clear_auth_rate_limit(event, 'sign-in', email);
		return redirect(302, '/home');
	}
};

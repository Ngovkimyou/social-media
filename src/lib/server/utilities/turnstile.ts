import { env } from '$env/dynamic/private';
import { get_client_ip } from '$lib/server/utilities/client-ip';
import type { RequestEvent } from '@sveltejs/kit';

const SIGN_IN_TURNSTILE_COOKIE = 'sign-in-turnstile-required';
const SIGN_IN_TURNSTILE_TTL_SECONDS = 10 * 60;
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

type TurnstileVerificationResult = { is_valid: true } | { is_valid: false; message: string };

const normalize_env_string = (value: unknown): string => (typeof value === 'string' ? value : '');

const get_turnstile_site_key = (): string => normalize_env_string(env['TURNSTILE_SITE_KEY']).trim();

const get_turnstile_secret_key = (): string =>
	normalize_env_string(env['TURNSTILE_SECRET_KEY']).trim();

const is_truthy = (value: string | undefined): boolean => value?.trim().toLowerCase() === 'true';

const should_use_turnstile_test_keys = (event?: RequestEvent): boolean => {
	if (is_truthy(env['TURNSTILE_FORCE_REAL_KEYS'])) {
		return false;
	}

	const configured_origin = normalize_env_string(env['ORIGIN']).trim().toLowerCase();
	const configured_is_localhost =
		configured_origin.startsWith('http://localhost') ||
		configured_origin.startsWith('https://localhost') ||
		configured_origin.includes('127.0.0.1');
	const request_hostname = event?.url.hostname.toLowerCase() ?? '';
	const request_is_localhost =
		request_hostname === 'localhost' ||
		request_hostname === '127.0.0.1' ||
		request_hostname === '0.0.0.0';

	return configured_is_localhost || request_is_localhost;
};

export const is_turnstile_configured = (): boolean =>
	should_use_turnstile_test_keys() ||
	(get_turnstile_site_key().length > 0 && get_turnstile_secret_key().length > 0);

export const get_turnstile_login_site_key = (event?: RequestEvent): string | undefined => {
	const site_key = should_use_turnstile_test_keys(event)
		? TURNSTILE_TEST_SITE_KEY
		: get_turnstile_site_key();
	return site_key.length > 0 ? site_key : undefined;
};

export const require_sign_in_turnstile = (event: RequestEvent): void => {
	event.cookies.set(SIGN_IN_TURNSTILE_COOKIE, '1', {
		httpOnly: true,
		maxAge: SIGN_IN_TURNSTILE_TTL_SECONDS,
		path: '/login',
		sameSite: 'strict',
		secure: event.url.protocol === 'https:'
	});
};

export const is_sign_in_turnstile_required = (event: RequestEvent): boolean =>
	event.cookies.get(SIGN_IN_TURNSTILE_COOKIE) === '1';

export const clear_sign_in_turnstile = (event: RequestEvent): void => {
	event.cookies.delete(SIGN_IN_TURNSTILE_COOKIE, { path: '/login' });
};

export const verify_turnstile_token = async (
	event: RequestEvent,
	token: string
): Promise<TurnstileVerificationResult> => {
	if (!is_turnstile_configured()) {
		return {
			is_valid: false,
			message: 'Security verification is temporarily unavailable. Please try again later.'
		};
	}

	if (!token.trim()) {
		return {
			is_valid: false,
			message: 'Please complete the security verification before trying again.'
		};
	}

	const form_data = new FormData();
	form_data.append(
		'secret',
		should_use_turnstile_test_keys(event) ? TURNSTILE_TEST_SECRET_KEY : get_turnstile_secret_key()
	);
	form_data.append('response', token);
	form_data.append('remoteip', get_client_ip(event));

	try {
		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			body: form_data,
			method: 'POST'
		});

		if (!response.ok) {
			return {
				is_valid: false,
				message: 'Security verification could not be completed. Please try again.'
			};
		}

		const payload = (await response.json()) as { success?: boolean };

		return payload.success === true
			? { is_valid: true }
			: {
					is_valid: false,
					message: 'Security verification failed. Please try again.'
				};
	} catch {
		return {
			is_valid: false,
			message: 'Security verification could not be completed. Please try again.'
		};
	}
};

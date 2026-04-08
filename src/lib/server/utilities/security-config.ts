import { env } from '$env/dynamic/private';
import { record_security_event } from '$lib/server/utilities/security-monitor';

const normalize_env_string = (value: unknown): string =>
	typeof value === 'string' ? value.trim() : '';

export const resolve_base_url = (): string => {
	const origin = normalize_env_string(env['ORIGIN']);

	if (origin) {
		return origin;
	}

	const vercel_url = normalize_env_string(env['VERCEL_URL']);

	if (vercel_url) {
		return `https://${vercel_url}`;
	}

	throw new Error('ORIGIN is not configured. Set ORIGIN or provide VERCEL_URL in deployment.');
};

export const resolve_trusted_origins = (): string[] => {
	const configured_origins = normalize_env_string(env['TRUSTED_AUTH_ORIGINS'])
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	return Array.from(new Set([resolve_base_url(), ...configured_origins]));
};

const is_local_origin = (origin: string): boolean => {
	const lower_origin = origin.toLowerCase();

	return (
		lower_origin.startsWith('http://localhost') ||
		lower_origin.startsWith('https://localhost') ||
		lower_origin.includes('127.0.0.1')
	);
};

let has_logged_security_env_warnings = false;

export const log_security_env_warnings = (): void => {
	if (has_logged_security_env_warnings) {
		return;
	}

	has_logged_security_env_warnings = true;

	const warnings: string[] = [];
	const better_auth_secret = normalize_env_string(env['BETTER_AUTH_SECRET']);

	if (better_auth_secret.length < 32) {
		warnings.push('BETTER_AUTH_SECRET should be at least 32 characters.');
	}

	const base_url = resolve_base_url();
	if (!is_local_origin(base_url) && !base_url.startsWith('https://')) {
		warnings.push('ORIGIN should use https in non-local environments.');
	}

	for (const trusted_origin of resolve_trusted_origins()) {
		if (!is_local_origin(trusted_origin) && !trusted_origin.startsWith('https://')) {
			warnings.push(`Trusted origin "${trusted_origin}" should use https in production.`);
		}
	}

	for (const warning of warnings) {
		console.warn(`Security configuration warning: ${warning}`);
		void record_security_event({
			category: 'auth_env_warning',
			details: warning
		});
	}
};

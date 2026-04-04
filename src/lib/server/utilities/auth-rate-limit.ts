import type { RequestEvent } from '@sveltejs/kit';

type RateLimitEntry = {
	count: number;
	window_ends_at: number;
};

type AuthRateLimitScope = 'sign-in' | 'sign-up';

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const attempts_by_key = new Map<string, RateLimitEntry>();

const cleanup_expired_entries = (): void => {
	const now = Date.now();

	for (const [key, value] of attempts_by_key.entries()) {
		if (value.window_ends_at <= now) {
			attempts_by_key.delete(key);
		}
	}
};

const get_client_ip = (event: RequestEvent): string => {
	const forwarded_for = event.request.headers.get('x-forwarded-for');
	const first_forwarded_ip = forwarded_for?.split(',')[0]?.trim();

	if (first_forwarded_ip) {
		return first_forwarded_ip;
	}

	try {
		return event.getClientAddress();
	} catch {
		return 'unknown-ip';
	}
};

const get_scope_key = (event: RequestEvent, scope: AuthRateLimitScope): string =>
	`${scope}:${get_client_ip(event)}`;

export const consume_auth_rate_limit = (
	event: RequestEvent,
	scope: AuthRateLimitScope
): { is_allowed: true } | { is_allowed: false; retry_after_seconds: number } => {
	cleanup_expired_entries();

	const key = get_scope_key(event, scope);
	const now = Date.now();
	const current = attempts_by_key.get(key);

	if (!current || current.window_ends_at <= now) {
		attempts_by_key.set(key, {
			count: 1,
			window_ends_at: now + WINDOW_MS
		});
		return { is_allowed: true };
	}

	if (current.count >= MAX_ATTEMPTS_PER_WINDOW) {
		const retry_after_seconds = Math.max(1, Math.ceil((current.window_ends_at - now) / 1000));
		return { is_allowed: false, retry_after_seconds };
	}

	attempts_by_key.set(key, {
		count: current.count + 1,
		window_ends_at: current.window_ends_at
	});

	return { is_allowed: true };
};

export const clear_auth_rate_limit = (event: RequestEvent, scope: AuthRateLimitScope): void => {
	attempts_by_key.delete(get_scope_key(event, scope));
};

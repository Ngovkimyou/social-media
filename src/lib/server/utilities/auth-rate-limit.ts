import { get_db } from '$lib/server/db';
import { get_client_ip } from '$lib/server/utilities/client-ip';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

type AuthRateLimitScope = 'sign-in' | 'sign-up';

const WINDOW_SECONDS = 5 * 60;
const MAX_ATTEMPTS_PER_WINDOW = 5;

let init_promise: Promise<void> | undefined;

const initialize_auth_rate_limit_store = async (): Promise<void> => {
	if (init_promise !== undefined) {
		return init_promise;
	}

	init_promise = (async () => {
		const db = get_db();
		await db.execute(sql`
			create table if not exists auth_rate_limit_bucket (
				bucket_key text primary key,
				attempt_count integer not null,
				expires_at timestamptz not null
			)
		`);
	})();

	return init_promise;
};

const get_scope_key = (event: RequestEvent, scope: AuthRateLimitScope): string =>
	`${scope}:${get_client_ip(event)}`;

export const consume_auth_rate_limit = async (
	event: RequestEvent,
	scope: AuthRateLimitScope
): Promise<{ is_allowed: true } | { is_allowed: false; retry_after_seconds: number }> => {
	await initialize_auth_rate_limit_store();

	const db = get_db();
	const bucket_key = get_scope_key(event, scope);

	const upserted_rows = await db.execute<{
		attempt_count: number;
		retry_after_seconds: number;
	}>(sql`
		insert into auth_rate_limit_bucket (bucket_key, attempt_count, expires_at)
		values (${bucket_key}, 1, now() + (${WINDOW_SECONDS} * interval '1 second'))
		on conflict (bucket_key)
		do update set
			attempt_count = case
				when auth_rate_limit_bucket.expires_at <= now() then 1
				else auth_rate_limit_bucket.attempt_count + 1
			end,
			expires_at = case
				when auth_rate_limit_bucket.expires_at <= now()
					then now() + (${WINDOW_SECONDS} * interval '1 second')
				else auth_rate_limit_bucket.expires_at
			end
		returning
			attempt_count,
			greatest(
				1,
				cast(ceil(extract(epoch from (expires_at - now()))) as integer)
			) as retry_after_seconds
	`);

	const current_bucket = upserted_rows.rows[0];

	if (!current_bucket) {
		return { is_allowed: true };
	}

	if (current_bucket.attempt_count > MAX_ATTEMPTS_PER_WINDOW) {
		return {
			is_allowed: false,
			retry_after_seconds: current_bucket.retry_after_seconds
		};
	}

	return { is_allowed: true };
};

export const clear_auth_rate_limit = async (
	event: RequestEvent,
	scope: AuthRateLimitScope
): Promise<void> => {
	await initialize_auth_rate_limit_store();
	const db = get_db();
	await db.execute(
		sql`delete from auth_rate_limit_bucket where bucket_key = ${get_scope_key(event, scope)}`
	);
};

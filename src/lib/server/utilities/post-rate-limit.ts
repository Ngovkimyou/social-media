import { get_db } from '$lib/server/db';
import { get_client_ip } from '$lib/server/utilities/client-ip';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

const SHORT_WINDOW_SECONDS = 60;
const SHORT_WINDOW_MAX_ATTEMPTS = 3;
const LONG_WINDOW_SECONDS = 60 * 60;
const LONG_WINDOW_MAX_ATTEMPTS = 20;

let init_promise: Promise<void> | undefined;
let use_memory_store = false;

type MemoryRateLimitBucket = {
	attempt_count: number;
	expires_at_ms: number;
};

type RateLimitConsumeResult =
	| { is_allowed: true }
	| { is_allowed: false; retry_after_seconds: number };

const memory_rate_limit_buckets = new Map<string, MemoryRateLimitBucket>();

const get_retry_after_seconds = (expires_at_ms: number, now_ms: number): number =>
	Math.max(1, Math.ceil((expires_at_ms - now_ms) / 1000));

const get_epoch_ms = (value: Date | string): number => new Date(value).getTime();

const initialize_post_rate_limit_store = async (): Promise<void> => {
	if (init_promise !== undefined) {
		return init_promise;
	}

	init_promise = (async () => {
		const db = get_db();
		try {
			await db.execute(sql`
				create table if not exists post_rate_limit_bucket (
					bucket_key text primary key,
					attempt_count integer not null,
					expires_at timestamptz not null
				)
			`);
		} catch (error) {
			use_memory_store = true;
			console.warn(
				`Post rate limit store is using in-memory fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	})();

	return init_promise;
};

const get_scope_keys = (event: RequestEvent): string[] => {
	const keys = [`create-post:ip:${get_client_ip(event)}`];
	const user_id = event.locals.user?.id;

	if (user_id) {
		keys.push(`create-post:user:${user_id}`);
	}

	return keys;
};

const consume_memory_bucket = (
	bucket_key: string,
	window_seconds: number,
	max_attempts: number
): RateLimitConsumeResult => {
	const current_bucket = memory_rate_limit_buckets.get(bucket_key);
	const now = Date.now();

	if (!current_bucket || current_bucket.expires_at_ms <= now) {
		memory_rate_limit_buckets.set(bucket_key, {
			attempt_count: 1,
			expires_at_ms: now + window_seconds * 1000
		});
		return { is_allowed: true };
	}

	if (current_bucket.attempt_count >= max_attempts) {
		return {
			is_allowed: false,
			retry_after_seconds: get_retry_after_seconds(current_bucket.expires_at_ms, now)
		};
	}

	memory_rate_limit_buckets.set(bucket_key, {
		...current_bucket,
		attempt_count: current_bucket.attempt_count + 1
	});
	return { is_allowed: true };
};

const consume_db_bucket = async (
	bucket_key: string,
	window_seconds: number,
	max_attempts: number
): Promise<RateLimitConsumeResult> => {
	const db = get_db();
	const existing_rows = await db.execute<{
		attempt_count: number;
		expires_at: Date;
	}>(sql`
		select attempt_count, expires_at
		from post_rate_limit_bucket
		where bucket_key = ${bucket_key}
		limit 1
	`);
	const current_bucket = existing_rows.rows[0];
	const now = Date.now();

	if (!current_bucket || get_epoch_ms(current_bucket.expires_at) <= now) {
		await db.execute(sql`
			insert into post_rate_limit_bucket (bucket_key, attempt_count, expires_at)
			values (
				${bucket_key},
				1,
				now() + (${window_seconds} * interval '1 second')
			)
			on conflict (bucket_key)
			do update set
				attempt_count = 1,
				expires_at = now() + (${window_seconds} * interval '1 second')
		`);
		return { is_allowed: true };
	}

	if (current_bucket.attempt_count >= max_attempts) {
		return {
			is_allowed: false,
			retry_after_seconds: get_retry_after_seconds(get_epoch_ms(current_bucket.expires_at), now)
		};
	}

	await db.execute(sql`
		update post_rate_limit_bucket
		set attempt_count = attempt_count + 1
		where bucket_key = ${bucket_key}
	`);

	return { is_allowed: true };
};

const consume_bucket = async (
	bucket_key: string,
	window_seconds: number,
	max_attempts: number
): Promise<RateLimitConsumeResult> =>
	use_memory_store
		? consume_memory_bucket(bucket_key, window_seconds, max_attempts)
		: consume_db_bucket(bucket_key, window_seconds, max_attempts);

const consume_bucket_set = async (
	bucket_key: string,
	bucket_configs: Array<{ max_attempts: number; window_seconds: number }>
): Promise<RateLimitConsumeResult> => {
	for (const bucket_config of bucket_configs) {
		const scoped_bucket_key = `${bucket_key}:${bucket_config.window_seconds}`;
		const result = await consume_bucket(
			scoped_bucket_key,
			bucket_config.window_seconds,
			bucket_config.max_attempts
		);

		if (!result.is_allowed) {
			return result;
		}
	}

	return { is_allowed: true };
};

export const consume_create_post_rate_limit = async (
	event: RequestEvent
): Promise<RateLimitConsumeResult> => {
	await initialize_post_rate_limit_store();

	const bucket_keys = get_scope_keys(event);
	const bucket_configs = [
		{ max_attempts: SHORT_WINDOW_MAX_ATTEMPTS, window_seconds: SHORT_WINDOW_SECONDS },
		{ max_attempts: LONG_WINDOW_MAX_ATTEMPTS, window_seconds: LONG_WINDOW_SECONDS }
	];

	for (const bucket_key of bucket_keys) {
		const result = await consume_bucket_set(bucket_key, bucket_configs);
		if (!result.is_allowed) {
			return result;
		}
	}

	return { is_allowed: true };
};

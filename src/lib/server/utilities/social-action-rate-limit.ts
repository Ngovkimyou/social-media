import { get_db } from '$lib/server/db';
import { get_client_ip } from '$lib/server/utilities/client-ip';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

type RateLimitResult = { is_allowed: true } | { is_allowed: false; retry_after_seconds: number };

type ActionScope = 'follow-action' | 'home-feed';

const WINDOW_CONFIG: Record<
	ActionScope,
	Array<{ max_attempts: number; window_seconds: number }>
> = {
	'follow-action': [
		{ max_attempts: 30, window_seconds: 60 },
		{ max_attempts: 100, window_seconds: 60 * 60 }
	],
	'home-feed': [
		{ max_attempts: 120, window_seconds: 60 },
		{ max_attempts: 600, window_seconds: 15 * 60 }
	]
};

const FOLLOW_TARGET_COOLDOWN_SECONDS = 15;

let init_promise: Promise<void> | undefined;
let use_memory_store = false;

type MemoryRateLimitBucket = {
	attempt_count: number;
	expires_at_ms: number;
};

const memory_rate_limit_buckets = new Map<string, MemoryRateLimitBucket>();
const memory_cooldowns = new Map<string, number>();

const get_retry_after_seconds = (expires_at_ms: number, now_ms: number): number =>
	Math.max(1, Math.ceil((expires_at_ms - now_ms) / 1000));

const get_epoch_ms = (value: Date | string): number => new Date(value).getTime();

const initialize_social_action_rate_limit_store = async (): Promise<void> => {
	if (init_promise !== undefined) {
		return init_promise;
	}

	init_promise = (async () => {
		const db = get_db();
		try {
			await db.execute(sql`
				create table if not exists social_action_rate_limit_bucket (
					bucket_key text primary key,
					attempt_count integer not null,
					expires_at timestamptz not null
				)
			`);
			await db.execute(sql`
				create table if not exists social_action_cooldown (
					cooldown_key text primary key,
					expires_at timestamptz not null
				)
			`);
		} catch (error) {
			use_memory_store = true;
			console.warn(
				`Social action rate limit store is using in-memory fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	})();

	return init_promise;
};

const get_actor_keys = (event: RequestEvent, scope: ActionScope): string[] => {
	const keys = [`${scope}:ip:${get_client_ip(event)}`];
	const user_id = event.locals.user?.id;

	if (user_id) {
		keys.push(`${scope}:user:${user_id}`);
	}

	return keys;
};

const consume_memory_bucket = (
	bucket_key: string,
	window_seconds: number,
	max_attempts: number
): RateLimitResult => {
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
): Promise<RateLimitResult> => {
	const db = get_db();
	const existing_rows = await db.execute<{
		attempt_count: number;
		expires_at: Date;
	}>(sql`
		select attempt_count, expires_at
		from social_action_rate_limit_bucket
		where bucket_key = ${bucket_key}
		limit 1
	`);
	const current_bucket = existing_rows.rows[0];
	const now = Date.now();

	if (!current_bucket || get_epoch_ms(current_bucket.expires_at) <= now) {
		await db.execute(sql`
			insert into social_action_rate_limit_bucket (bucket_key, attempt_count, expires_at)
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
		update social_action_rate_limit_bucket
		set attempt_count = attempt_count + 1
		where bucket_key = ${bucket_key}
	`);

	return { is_allowed: true };
};

const consume_bucket = async (
	bucket_key: string,
	window_seconds: number,
	max_attempts: number
): Promise<RateLimitResult> =>
	use_memory_store
		? consume_memory_bucket(bucket_key, window_seconds, max_attempts)
		: consume_db_bucket(bucket_key, window_seconds, max_attempts);

const consume_scope_windows = async (
	actor_key: string,
	configs: Array<{ max_attempts: number; window_seconds: number }>
): Promise<RateLimitResult> => {
	for (const config of configs) {
		const scoped_bucket_key = `${actor_key}:${config.window_seconds}`;
		const result = await consume_bucket(
			scoped_bucket_key,
			config.window_seconds,
			config.max_attempts
		);

		if (!result.is_allowed) {
			return result;
		}
	}

	return { is_allowed: true };
};

const check_memory_cooldown = (cooldown_key: string): RateLimitResult => {
	const now = Date.now();
	const expires_at_ms = memory_cooldowns.get(cooldown_key);

	if (expires_at_ms && expires_at_ms > now) {
		return {
			is_allowed: false,
			retry_after_seconds: get_retry_after_seconds(expires_at_ms, now)
		};
	}

	memory_cooldowns.set(cooldown_key, now + FOLLOW_TARGET_COOLDOWN_SECONDS * 1000);
	return { is_allowed: true };
};

const check_db_cooldown = async (cooldown_key: string): Promise<RateLimitResult> => {
	const db = get_db();
	const existing_rows = await db.execute<{ expires_at: Date }>(sql`
		select expires_at
		from social_action_cooldown
		where cooldown_key = ${cooldown_key}
		limit 1
	`);
	const current_cooldown = existing_rows.rows[0];
	const now = Date.now();

	if (current_cooldown && get_epoch_ms(current_cooldown.expires_at) > now) {
		return {
			is_allowed: false,
			retry_after_seconds: get_retry_after_seconds(get_epoch_ms(current_cooldown.expires_at), now)
		};
	}

	await db.execute(sql`
		insert into social_action_cooldown (cooldown_key, expires_at)
		values (
			${cooldown_key},
			now() + (${FOLLOW_TARGET_COOLDOWN_SECONDS} * interval '1 second')
		)
		on conflict (cooldown_key)
		do update set
			expires_at = now() + (${FOLLOW_TARGET_COOLDOWN_SECONDS} * interval '1 second')
	`);

	return { is_allowed: true };
};

export const consume_social_action_rate_limit = async (
	event: RequestEvent,
	scope: ActionScope
): Promise<RateLimitResult> => {
	await initialize_social_action_rate_limit_store();

	const actor_keys = get_actor_keys(event, scope);

	for (const actor_key of actor_keys) {
		const result = await consume_scope_windows(actor_key, WINDOW_CONFIG[scope]);
		if (!result.is_allowed) {
			return result;
		}
	}

	return { is_allowed: true };
};

export const consume_follow_target_cooldown = async (
	event: RequestEvent,
	target_user_id: string
): Promise<RateLimitResult> => {
	await initialize_social_action_rate_limit_store();

	const actor_user_id = event.locals.user?.id ?? `ip:${get_client_ip(event)}`;
	const cooldown_key = `follow-target:${actor_user_id}:${target_user_id}`;

	return use_memory_store ? check_memory_cooldown(cooldown_key) : check_db_cooldown(cooldown_key);
};

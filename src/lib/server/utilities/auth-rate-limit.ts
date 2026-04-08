import { get_db } from '$lib/server/db';
import { get_client_ip } from '$lib/server/utilities/client-ip';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

type AuthRateLimitScope = 'sign-in' | 'sign-up';

const WINDOW_SECONDS = 5 * 60;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const DISTRIBUTED_ATTACK_WINDOW_SECONDS = 10 * 60;
const DISTRIBUTED_ATTACK_IP_THRESHOLD = 3;

let init_promise: Promise<void> | undefined;
let use_memory_store = false;

type MemoryRateLimitBucket = {
	attempt_count: number;
	expires_at_ms: number;
	lock_level: number;
};

type RateLimitConsumeResult =
	| { current_attempt_count: number; is_allowed: true }
	| { is_allowed: false; retry_after_seconds: number };

const memory_rate_limit_buckets = new Map<string, MemoryRateLimitBucket>();
const memory_attack_windows = new Map<string, Map<string, number>>();

const get_lock_duration_seconds = (lock_level: number): number => {
	if (lock_level <= 1) {
		return 5 * 60;
	}

	if (lock_level === 2) {
		return 15 * 60;
	}

	if (lock_level === 3) {
		return 60 * 60;
	}

	return 60 * 60 * 2 ** (lock_level - 3);
};

const get_epoch_ms = (value: Date | string): number => new Date(value).getTime();

const get_retry_after_seconds = (expires_at_ms: number, now_ms: number): number =>
	Math.max(1, Math.ceil((expires_at_ms - now_ms) / 1000));

const initialize_auth_rate_limit_store = async (): Promise<void> => {
	if (init_promise !== undefined) {
		return init_promise;
	}

	init_promise = (async () => {
		const db = get_db();
		try {
			await db.execute(sql`
				create table if not exists auth_rate_limit_bucket (
					bucket_key text primary key,
					attempt_count integer not null,
					expires_at timestamptz not null,
					lock_level integer not null default 0
				)
			`);
			await db.execute(sql`
				alter table auth_rate_limit_bucket
				add column if not exists lock_level integer not null default 0
			`);
			await db.execute(sql`
				create table if not exists auth_identifier_attack_window (
					attack_key text not null,
					ip_address text not null,
					expires_at timestamptz not null,
					primary key (attack_key, ip_address)
				)
			`);
		} catch (error) {
			use_memory_store = true;
			console.warn(
				`Auth rate limit store is using in-memory fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	})();

	return init_promise;
};

const normalize_identifier = (identifier: string): string =>
	identifier.normalize('NFKC').trim().toLowerCase();

const get_scope_keys = (
	event: RequestEvent,
	scope: AuthRateLimitScope,
	identifier?: string
): string[] => {
	const keys = [`${scope}:ip:${get_client_ip(event)}`];
	const normalized_identifier = identifier ? normalize_identifier(identifier) : '';

	if (normalized_identifier.length > 0) {
		keys.push(`${scope}:identifier:${normalized_identifier}`);
	}

	return keys;
};

const get_identifier_bucket_key = (
	scope: AuthRateLimitScope,
	identifier: string
): string | undefined => {
	const normalized_identifier = normalize_identifier(identifier);
	return normalized_identifier.length > 0
		? `${scope}:identifier:${normalized_identifier}`
		: undefined;
};

const get_attack_window_key = (
	scope: AuthRateLimitScope,
	identifier: string
): string | undefined => {
	const normalized_identifier = normalize_identifier(identifier);
	return normalized_identifier.length > 0
		? `${scope}:attack-window:${normalized_identifier}`
		: undefined;
};

const lock_bucket = async (
	bucket_key: string,
	minimum_lock_level: number
): Promise<{ retry_after_seconds: number }> => {
	if (use_memory_store) {
		const current_bucket = memory_rate_limit_buckets.get(bucket_key);
		const lock_level = current_bucket
			? Math.max(minimum_lock_level, current_bucket.lock_level + 1)
			: minimum_lock_level;
		const lock_duration_seconds = get_lock_duration_seconds(lock_level);
		memory_rate_limit_buckets.set(bucket_key, {
			attempt_count: MAX_ATTEMPTS_PER_WINDOW + 1,
			expires_at_ms: Date.now() + lock_duration_seconds * 1000,
			lock_level
		});
		return { retry_after_seconds: lock_duration_seconds };
	}

	const db = get_db();
	const existing_rows = await db.execute<{
		attempt_count: number;
		expires_at: Date;
		lock_level: number;
	}>(sql`
		select attempt_count, expires_at, lock_level
		from auth_rate_limit_bucket
		where bucket_key = ${bucket_key}
		limit 1
	`);
	const current_bucket = existing_rows.rows[0];
	const lock_level = current_bucket
		? Math.max(minimum_lock_level, current_bucket.lock_level + 1)
		: minimum_lock_level;
	const lock_duration_seconds = get_lock_duration_seconds(lock_level);

	await db.execute(sql`
		insert into auth_rate_limit_bucket (bucket_key, attempt_count, expires_at, lock_level)
		values (
			${bucket_key},
			${MAX_ATTEMPTS_PER_WINDOW + 1},
			now() + (${lock_duration_seconds} * interval '1 second'),
			${lock_level}
		)
		on conflict (bucket_key)
		do update set
			attempt_count = ${MAX_ATTEMPTS_PER_WINDOW + 1},
			expires_at = now() + (${lock_duration_seconds} * interval '1 second'),
			lock_level = ${lock_level}
	`);

	return { retry_after_seconds: lock_duration_seconds };
};

const get_next_locked_memory_result = (
	bucket_key: string,
	current_bucket: MemoryRateLimitBucket,
	now: number
): RateLimitConsumeResult => {
	const next_attempt_count = current_bucket.attempt_count + 1;
	const next_lock_level = current_bucket.lock_level + 1;
	const lock_duration_seconds = get_lock_duration_seconds(next_lock_level);

	memory_rate_limit_buckets.set(bucket_key, {
		attempt_count: next_attempt_count,
		expires_at_ms: now + lock_duration_seconds * 1000,
		lock_level: next_lock_level
	});

	return {
		is_allowed: false,
		retry_after_seconds: lock_duration_seconds
	};
};

const get_next_memory_bucket_result = (
	bucket_key: string,
	current_bucket: MemoryRateLimitBucket,
	now: number
): RateLimitConsumeResult => {
	if (current_bucket.attempt_count > MAX_ATTEMPTS_PER_WINDOW) {
		return {
			is_allowed: false,
			retry_after_seconds: get_retry_after_seconds(current_bucket.expires_at_ms, now)
		};
	}

	const next_attempt_count = current_bucket.attempt_count + 1;
	if (next_attempt_count > MAX_ATTEMPTS_PER_WINDOW) {
		return get_next_locked_memory_result(bucket_key, current_bucket, now);
	}

	memory_rate_limit_buckets.set(bucket_key, {
		...current_bucket,
		attempt_count: next_attempt_count
	});
	return { current_attempt_count: next_attempt_count, is_allowed: true };
};

const reset_memory_bucket = (
	bucket_key: string,
	current_bucket: MemoryRateLimitBucket | undefined,
	now: number
): RateLimitConsumeResult => {
	memory_rate_limit_buckets.set(bucket_key, {
		attempt_count: 1,
		expires_at_ms: now + WINDOW_SECONDS * 1000,
		lock_level: current_bucket?.lock_level ?? 0
	});
	return { current_attempt_count: 1, is_allowed: true };
};

const update_locked_db_bucket = async (
	bucket_key: string,
	next_attempt_count: number,
	next_lock_level: number
): Promise<RateLimitConsumeResult> => {
	const db = get_db();
	const lock_duration_seconds = get_lock_duration_seconds(next_lock_level);

	await db.execute(sql`
		update auth_rate_limit_bucket
		set
			attempt_count = ${next_attempt_count},
			expires_at = now() + (${lock_duration_seconds} * interval '1 second'),
			lock_level = ${next_lock_level}
		where bucket_key = ${bucket_key}
	`);

	return {
		is_allowed: false,
		retry_after_seconds: lock_duration_seconds
	};
};

const update_db_attempt_count = async (
	bucket_key: string,
	next_attempt_count: number
): Promise<RateLimitConsumeResult> => {
	const db = get_db();

	await db.execute(sql`
		update auth_rate_limit_bucket
		set attempt_count = ${next_attempt_count}
		where bucket_key = ${bucket_key}
	`);

	return { current_attempt_count: next_attempt_count, is_allowed: true };
};

const reset_db_bucket = async (
	bucket_key: string,
	current_bucket: { lock_level: number } | undefined
): Promise<RateLimitConsumeResult> => {
	const db = get_db();
	const preserved_lock_level = current_bucket?.lock_level ?? 0;

	await db.execute(sql`
		insert into auth_rate_limit_bucket (bucket_key, attempt_count, expires_at, lock_level)
		values (
			${bucket_key},
			1,
			now() + (${WINDOW_SECONDS} * interval '1 second'),
			${preserved_lock_level}
		)
		on conflict (bucket_key)
		do update set
			attempt_count = 1,
			expires_at = now() + (${WINDOW_SECONDS} * interval '1 second'),
			lock_level = ${preserved_lock_level}
	`);

	return { current_attempt_count: 1, is_allowed: true };
};

const record_memory_attack_window = (
	attack_window_key: string,
	ip_address: string,
	now: number
): number => {
	const attack_window = memory_attack_windows.get(attack_window_key) ?? new Map<string, number>();
	attack_window.set(ip_address, now + DISTRIBUTED_ATTACK_WINDOW_SECONDS * 1000);

	for (const [tracked_ip, expires_at_ms] of attack_window.entries()) {
		if (expires_at_ms <= now) {
			attack_window.delete(tracked_ip);
		}
	}

	memory_attack_windows.set(attack_window_key, attack_window);
	return attack_window.size;
};

const record_db_attack_window = async (
	attack_window_key: string,
	ip_address: string
): Promise<number> => {
	const db = get_db();

	await db.execute(sql`
		insert into auth_identifier_attack_window (attack_key, ip_address, expires_at)
		values (
			${attack_window_key},
			${ip_address},
			now() + (${DISTRIBUTED_ATTACK_WINDOW_SECONDS} * interval '1 second')
		)
		on conflict (attack_key, ip_address)
		do update set expires_at = now() + (${DISTRIBUTED_ATTACK_WINDOW_SECONDS} * interval '1 second')
	`);
	await db.execute(
		sql`delete from auth_identifier_attack_window where attack_key = ${attack_window_key} and expires_at <= now()`
	);
	const attack_rows = await db.execute<{ ip_count: number }>(sql`
		select count(*)::integer as ip_count
		from auth_identifier_attack_window
		where attack_key = ${attack_window_key}
			and expires_at > now()
	`);

	return attack_rows.rows[0]?.ip_count ?? 0;
};

const consume_bucket = async (bucket_key: string): Promise<RateLimitConsumeResult> => {
	if (use_memory_store) {
		const current_bucket = memory_rate_limit_buckets.get(bucket_key);
		const now = Date.now();
		return current_bucket && current_bucket.expires_at_ms > now
			? get_next_memory_bucket_result(bucket_key, current_bucket, now)
			: reset_memory_bucket(bucket_key, current_bucket, now);
	}

	const db = get_db();
	const existing_rows = await db.execute<{
		attempt_count: number;
		expires_at: Date;
		lock_level: number;
	}>(sql`
		select attempt_count, expires_at, lock_level
		from auth_rate_limit_bucket
		where bucket_key = ${bucket_key}
		limit 1
	`);
	const current_bucket = existing_rows.rows[0];
	const now = Date.now();

	if (!current_bucket || get_epoch_ms(current_bucket.expires_at) <= now) {
		return reset_db_bucket(bucket_key, current_bucket);
	}

	if (current_bucket.attempt_count > MAX_ATTEMPTS_PER_WINDOW) {
		return {
			is_allowed: false,
			retry_after_seconds: get_retry_after_seconds(get_epoch_ms(current_bucket.expires_at), now)
		};
	}

	const next_attempt_count = current_bucket.attempt_count + 1;
	return next_attempt_count > MAX_ATTEMPTS_PER_WINDOW
		? update_locked_db_bucket(bucket_key, next_attempt_count, current_bucket.lock_level + 1)
		: update_db_attempt_count(bucket_key, next_attempt_count);
};

export const consume_auth_rate_limit = async (
	event: RequestEvent,
	scope: AuthRateLimitScope,
	identifier?: string
): Promise<
	| { current_attempt_count: number; is_allowed: true }
	| { is_allowed: false; retry_after_seconds: number }
> => {
	await initialize_auth_rate_limit_store();

	const bucket_keys = get_scope_keys(event, scope, identifier);
	let current_attempt_count = 1;

	for (const bucket_key of bucket_keys) {
		const result = await consume_bucket(bucket_key);
		if (!result.is_allowed) {
			return result;
		}
		current_attempt_count = Math.max(current_attempt_count, result.current_attempt_count);
	}

	return { current_attempt_count, is_allowed: true };
};

export const clear_auth_rate_limit = async (
	event: RequestEvent,
	scope: AuthRateLimitScope,
	identifier?: string
): Promise<void> => {
	await initialize_auth_rate_limit_store();

	if (use_memory_store) {
		for (const bucket_key of get_scope_keys(event, scope, identifier)) {
			memory_rate_limit_buckets.delete(bucket_key);
		}
		const attack_window_key = identifier ? get_attack_window_key(scope, identifier) : undefined;
		if (attack_window_key) {
			memory_attack_windows.delete(attack_window_key);
		}
		return;
	}

	const db = get_db();
	for (const bucket_key of get_scope_keys(event, scope, identifier)) {
		await db.execute(sql`delete from auth_rate_limit_bucket where bucket_key = ${bucket_key}`);
	}
	const attack_window_key = identifier ? get_attack_window_key(scope, identifier) : undefined;
	if (attack_window_key) {
		await db.execute(
			sql`delete from auth_identifier_attack_window where attack_key = ${attack_window_key}`
		);
	}
};

export const register_distributed_auth_failure = async (
	event: RequestEvent,
	scope: AuthRateLimitScope,
	identifier: string
): Promise<{ is_locked: false } | { is_locked: true; retry_after_seconds: number }> => {
	await initialize_auth_rate_limit_store();

	const attack_window_key = get_attack_window_key(scope, identifier);
	const identifier_bucket_key = get_identifier_bucket_key(scope, identifier);
	if (!attack_window_key || !identifier_bucket_key) {
		return { is_locked: false };
	}

	const ip_address = get_client_ip(event);
	const ip_count = use_memory_store
		? record_memory_attack_window(attack_window_key, ip_address, Date.now())
		: await record_db_attack_window(attack_window_key, ip_address);

	if (ip_count < DISTRIBUTED_ATTACK_IP_THRESHOLD) {
		return { is_locked: false };
	}

	const lock_result = await lock_bucket(identifier_bucket_key, 3);
	return {
		is_locked: true,
		retry_after_seconds: lock_result.retry_after_seconds
	};
};

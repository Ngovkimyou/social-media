import { get_db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

type MemoryRateLimitBucket = {
	attempt_count: number;
	expires_at_ms: number;
};

export type WindowedRateLimitResult =
	| { is_allowed: true }
	| { is_allowed: false; retry_after_seconds: number };

const get_retry_after_seconds = (expires_at_ms: number, now_ms: number): number =>
	Math.max(1, Math.ceil((expires_at_ms - now_ms) / 1000));

const get_epoch_ms = (value: Date | string): number => new Date(value).getTime();

export const create_windowed_rate_limit_store = (params: {
	create_table_sql: ReturnType<typeof sql>;
	store_name: string;
	table_name: string;
}): {
	consume_bucket: (
		bucket_key: string,
		window_seconds: number,
		max_attempts: number
	) => Promise<WindowedRateLimitResult>;
	initialize: () => Promise<void>;
	is_using_memory_store: () => boolean;
} => {
	const { create_table_sql, store_name, table_name } = params;

	let init_promise: Promise<void> | undefined;
	let use_memory_store = false;
	const memory_rate_limit_buckets = new Map<string, MemoryRateLimitBucket>();

	const initialize = async (): Promise<void> => {
		if (init_promise !== undefined) {
			return init_promise;
		}

		init_promise = (async () => {
			const db = get_db();
			try {
				await db.execute(create_table_sql);
			} catch (error) {
				use_memory_store = true;
				console.warn(
					`${store_name} is using in-memory fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
			}
		})();

		return init_promise;
	};

	const consume_memory_bucket = (
		bucket_key: string,
		window_seconds: number,
		max_attempts: number
	): WindowedRateLimitResult => {
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
	): Promise<WindowedRateLimitResult> => {
		const db = get_db();
		const existing_rows = await db.execute<{
			attempt_count: number;
			expires_at: Date;
		}>(sql`
			select attempt_count, expires_at
			from ${sql.raw(table_name)}
			where bucket_key = ${bucket_key}
			limit 1
		`);
		const current_bucket = existing_rows.rows[0];
		const now = Date.now();

		if (!current_bucket || get_epoch_ms(current_bucket.expires_at) <= now) {
			await db.execute(sql`
				insert into ${sql.raw(table_name)} (bucket_key, attempt_count, expires_at)
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
			update ${sql.raw(table_name)}
			set attempt_count = attempt_count + 1
			where bucket_key = ${bucket_key}
		`);

		return { is_allowed: true };
	};

	const consume_bucket = async (
		bucket_key: string,
		window_seconds: number,
		max_attempts: number
	): Promise<WindowedRateLimitResult> =>
		use_memory_store
			? consume_memory_bucket(bucket_key, window_seconds, max_attempts)
			: consume_db_bucket(bucket_key, window_seconds, max_attempts);

	const is_using_memory_store = (): boolean => use_memory_store;

	return {
		consume_bucket,
		initialize,
		is_using_memory_store
	};
};

export const consume_window_buckets = async (params: {
	base_key: string;
	configs: Array<{ max_attempts: number; window_seconds: number }>;
	consume_bucket: (
		bucket_key: string,
		window_seconds: number,
		max_attempts: number
	) => Promise<WindowedRateLimitResult>;
}): Promise<WindowedRateLimitResult> => {
	const { base_key, configs, consume_bucket } = params;

	for (const config of configs) {
		const scoped_bucket_key = `${base_key}:${config.window_seconds}`;
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

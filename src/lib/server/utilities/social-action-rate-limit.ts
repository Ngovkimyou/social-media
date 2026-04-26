import { get_db } from '$lib/server/db';
import { get_client_ip } from '$lib/server/utilities/client-ip';
import {
	consume_window_buckets,
	create_windowed_rate_limit_store,
	type WindowedRateLimitResult
} from '$lib/server/utilities/windowed-rate-limit';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

type ActionScope = 'follow-action' | 'home-feed' | 'comment' | 'like-action' | 'share-action';

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
	],
	comment: [
		{ max_attempts: 10, window_seconds: 60 },
		{ max_attempts: 50, window_seconds: 60 * 60 }
	],
	'like-action': [
		{ max_attempts: 120, window_seconds: 60 },
		{ max_attempts: 500, window_seconds: 15 * 60 }
	],
	'share-action': [
		{ max_attempts: 120, window_seconds: 60 },
		{ max_attempts: 500, window_seconds: 15 * 60 }
	]
};

const FOLLOW_TARGET_COOLDOWN_SECONDS = 15;

const social_action_rate_limit_store = create_windowed_rate_limit_store({
	create_table_sql: sql`
		create table if not exists social_action_rate_limit_bucket (
			bucket_key text primary key,
			attempt_count integer not null,
			expires_at timestamptz not null
		)
	`,
	store_name: 'Social action rate limit store',
	table_name: 'social_action_rate_limit_bucket'
});

let cooldown_init_promise: Promise<void> | undefined;
const memory_follow_cooldowns = new Map<string, number>();
let use_memory_cooldown_store = false;

const get_retry_after_seconds = (expires_at_ms: number, now_ms: number): number =>
	Math.max(1, Math.ceil((expires_at_ms - now_ms) / 1000));

const get_epoch_ms = (value: Date | string): number => new Date(value).getTime();

const initialize_follow_cooldown_store = async (): Promise<void> => {
	if (cooldown_init_promise !== undefined) {
		return cooldown_init_promise;
	}

	cooldown_init_promise = (async () => {
		if (social_action_rate_limit_store.is_using_memory_store()) {
			return;
		}

		const db = get_db();
		try {
			await db.execute(sql`
				create table if not exists social_action_cooldown (
					cooldown_key text primary key,
					expires_at timestamptz not null
				)
			`);
		} catch (error) {
			use_memory_cooldown_store = true;
			console.warn(
				`Social action cooldown store is using in-memory fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	})();

	return cooldown_init_promise;
};

const get_actor_keys = (event: RequestEvent, scope: ActionScope): string[] => {
	const keys = [`${scope}:ip:${get_client_ip(event)}`];
	const user_id = event.locals.user?.id;

	if (user_id) {
		keys.push(`${scope}:user:${user_id}`);
	}

	return keys;
};

const check_memory_cooldown = (cooldown_key: string): WindowedRateLimitResult => {
	const now = Date.now();
	const expires_at_ms = memory_follow_cooldowns.get(cooldown_key);

	if (expires_at_ms && expires_at_ms > now) {
		return {
			is_allowed: false,
			retry_after_seconds: get_retry_after_seconds(expires_at_ms, now)
		};
	}

	memory_follow_cooldowns.set(cooldown_key, now + FOLLOW_TARGET_COOLDOWN_SECONDS * 1000);
	return { is_allowed: true };
};

const check_db_cooldown = async (cooldown_key: string): Promise<WindowedRateLimitResult> => {
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
): Promise<WindowedRateLimitResult> => {
	await social_action_rate_limit_store.initialize();

	for (const actor_key of get_actor_keys(event, scope)) {
		const result = await consume_window_buckets({
			base_key: actor_key,
			configs: WINDOW_CONFIG[scope],
			consume_bucket: social_action_rate_limit_store.consume_bucket
		});
		if (!result.is_allowed) {
			return result;
		}
	}

	return { is_allowed: true };
};

export const consume_follow_target_cooldown = async (
	event: RequestEvent,
	target_user_id: string
): Promise<WindowedRateLimitResult> => {
	await social_action_rate_limit_store.initialize();
	await initialize_follow_cooldown_store();

	const actor_user_id = event.locals.user?.id ?? `ip:${get_client_ip(event)}`;
	const cooldown_key = `follow-target:${actor_user_id}:${target_user_id}`;

	if (social_action_rate_limit_store.is_using_memory_store() || use_memory_cooldown_store) {
		return check_memory_cooldown(cooldown_key);
	}

	return check_db_cooldown(cooldown_key);
};

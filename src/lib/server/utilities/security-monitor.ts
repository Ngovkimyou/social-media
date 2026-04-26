import { get_db } from '$lib/server/db';
import { get_client_ip } from '$lib/server/utilities/client-ip';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

type SecurityEventCategory =
	| 'csrf_blocked'
	| 'rate_limit_sign_in'
	| 'rate_limit_sign_up'
	| 'rate_limit_search'
	| 'rate_limit_post'
	| 'rate_limit_follow'
	| 'rate_limit_home_feed'
	| 'comment_spam'
	| 'duplicate_caption'
	| 'duplicate_image'
	| 'auth_env_warning';

const ALERT_WINDOW_SECONDS = 10 * 60;
const ALERT_THRESHOLDS = new Map<SecurityEventCategory, number>([
	['csrf_blocked', 5],
	['rate_limit_sign_in', 10],
	['rate_limit_sign_up', 10],
	['rate_limit_search', 15],
	['rate_limit_post', 10],
	['rate_limit_follow', 10],
	['rate_limit_home_feed', 25],
	['comment_spam', 8],
	['duplicate_caption', 5],
	['duplicate_image', 5],
	['auth_env_warning', 1]
]);

let init_promise: Promise<void> | undefined;
let use_memory_store = false;

const memory_event_counts = new Map<string, { count: number; expires_at_ms: number }>();

const get_actor_key = (event?: RequestEvent): string =>
	event?.locals.user?.id ?? event?.url.hostname ?? 'server';

const get_alert_key = (category: SecurityEventCategory, actor_key: string): string =>
	`${category}:${actor_key}`;

const initialize_security_monitor_store = async (): Promise<void> => {
	if (init_promise !== undefined) {
		return init_promise;
	}

	init_promise = (async () => {
		const db = get_db();
		try {
			await db.execute(sql`
				create table if not exists security_event_log (
					id bigserial primary key,
					category text not null,
					actor_key text not null,
					user_id text,
					ip_address text,
					path text,
					details text,
					created_at timestamptz not null default now()
				)
			`);
			await db.execute(sql`
				create table if not exists security_alert_window (
					alert_key text primary key,
					event_count integer not null,
					expires_at timestamptz not null
				)
			`);
		} catch (error) {
			use_memory_store = true;
			console.warn(
				`Security monitor store is using in-memory fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	})();

	return init_promise;
};

const emit_console_alert = (
	category: SecurityEventCategory,
	actor_key: string,
	event_count: number,
	details?: string
): void => {
	console.warn(
		`Security alert: ${category} threshold reached for ${actor_key} (count=${event_count}${details ? `, details=${details}` : ''})`
	);
};

const record_memory_alert = (
	category: SecurityEventCategory,
	actor_key: string,
	details?: string
): void => {
	const now = Date.now();
	const alert_key = get_alert_key(category, actor_key);
	const current = memory_event_counts.get(alert_key);
	const next =
		current && current.expires_at_ms > now
			? { count: current.count + 1, expires_at_ms: current.expires_at_ms }
			: { count: 1, expires_at_ms: now + ALERT_WINDOW_SECONDS * 1000 };

	memory_event_counts.set(alert_key, next);

	const threshold = ALERT_THRESHOLDS.get(category) ?? Number.MAX_SAFE_INTEGER;
	if (next.count === threshold) {
		emit_console_alert(category, actor_key, next.count, details);
	}
};

const record_db_alert = async (
	category: SecurityEventCategory,
	actor_key: string,
	details?: string
): Promise<void> => {
	const db = get_db();
	const alert_key = get_alert_key(category, actor_key);
	const rows = await db.execute<{ event_count: number }>(sql`
		insert into security_alert_window (alert_key, event_count, expires_at)
		values (
			${alert_key},
			1,
			now() + (${ALERT_WINDOW_SECONDS} * interval '1 second')
		)
		on conflict (alert_key)
		do update set
			event_count = case
				when security_alert_window.expires_at <= now() then 1
				else security_alert_window.event_count + 1
			end,
			expires_at = case
				when security_alert_window.expires_at <= now()
					then now() + (${ALERT_WINDOW_SECONDS} * interval '1 second')
				else security_alert_window.expires_at
			end
		returning event_count
	`);

	const event_count = rows.rows[0]?.event_count ?? 1;
	const threshold = ALERT_THRESHOLDS.get(category) ?? Number.MAX_SAFE_INTEGER;
	if (event_count === threshold) {
		emit_console_alert(category, actor_key, event_count, details);
	}
};

export const record_security_event = async (params: {
	category: SecurityEventCategory;
	details?: string;
	event?: RequestEvent;
}): Promise<void> => {
	await initialize_security_monitor_store();

	const { category, details, event } = params;
	const actor_key = get_actor_key(event);

	if (use_memory_store) {
		record_memory_alert(category, actor_key, details);
		return;
	}

	const db = get_db();
	try {
		await db.execute(sql`
			insert into security_event_log (category, actor_key, user_id, ip_address, path, details)
			values (
				${category},
				${actor_key},
				${event?.locals.user?.id},
				${event ? get_client_ip(event) : undefined},
				${event?.url.pathname},
				${details}
			)
		`);
	} catch {
		console.warn(`Security event log insert failed for ${category}`);
	}

	await record_db_alert(category, actor_key, details);
};

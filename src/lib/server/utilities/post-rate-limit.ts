import { get_client_ip } from '$lib/server/utilities/client-ip';
import {
	consume_window_buckets,
	create_windowed_rate_limit_store,
	type WindowedRateLimitResult
} from '$lib/server/utilities/windowed-rate-limit';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

const POST_RATE_LIMIT_WINDOWS = [
	{ max_attempts: 3, window_seconds: 60 },
	{ max_attempts: 20, window_seconds: 60 * 60 }
] as const;

const post_rate_limit_store = create_windowed_rate_limit_store({
	create_table_sql: sql`
		create table if not exists post_rate_limit_bucket (
			bucket_key text primary key,
			attempt_count integer not null,
			expires_at timestamptz not null
		)
	`,
	store_name: 'Post rate limit store',
	table_name: 'post_rate_limit_bucket'
});

const get_scope_keys = (event: RequestEvent): string[] => {
	const keys = [`create-post:ip:${get_client_ip(event)}`];
	const user_id = event.locals.user?.id;

	if (user_id) {
		keys.push(`create-post:user:${user_id}`);
	}

	return keys;
};

export const consume_create_post_rate_limit = async (
	event: RequestEvent
): Promise<WindowedRateLimitResult> => {
	await post_rate_limit_store.initialize();

	for (const bucket_key of get_scope_keys(event)) {
		const result = await consume_window_buckets({
			base_key: bucket_key,
			configs: [...POST_RATE_LIMIT_WINDOWS],
			consume_bucket: post_rate_limit_store.consume_bucket
		});
		if (!result.is_allowed) {
			return result;
		}
	}

	return { is_allowed: true };
};

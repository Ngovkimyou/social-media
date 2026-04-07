import { get_db } from '$lib/server/db';
import { get_client_ip } from '$lib/server/utilities/client-ip';
import type { RequestEvent } from '@sveltejs/kit';
import { sql, type SQL } from 'drizzle-orm';

type SearchRateLimitScope = 'search-users' | 'search-recent-users';

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS_PER_WINDOW = 30;
const PENALTY_ATTEMPTS_PER_WINDOW = 5;
const PENALTY_WINDOW_SECONDS = 15 * 60;
const MAX_TRACKED_QUERIES = 20;
const MAX_UNIQUE_QUERIES_PER_WINDOW = 12;
const MAX_BROAD_QUERIES_PER_WINDOW = 8;
const MAX_RATE_LIMIT_HITS_PER_WINDOW = 3;

let init_promise: Promise<void> | undefined;

const initialize_search_rate_limit_store = async (): Promise<void> => {
	if (init_promise !== undefined) {
		return init_promise;
	}

	init_promise = (async () => {
		const db = get_db();
		await db.execute(sql`
			create table if not exists search_rate_limit_bucket (
				bucket_key text primary key,
				attempt_count integer not null,
				expires_at timestamptz not null,
				penalty_expires_at timestamptz,
				rate_limit_hits integer not null default 0,
				broad_query_count integer not null default 0,
				seen_queries text[] not null default '{}'
			)
		`);

		await db.execute(sql`
			alter table search_rate_limit_bucket
			add column if not exists penalty_expires_at timestamptz
		`);
		await db.execute(sql`
			alter table search_rate_limit_bucket
			add column if not exists rate_limit_hits integer not null default 0
		`);
		await db.execute(sql`
			alter table search_rate_limit_bucket
			add column if not exists broad_query_count integer not null default 0
		`);
		await db.execute(sql`
			alter table search_rate_limit_bucket
			add column if not exists seen_queries text[] not null default '{}'
		`);
	})();

	return init_promise;
};

const get_tracked_queries_sql = (query_signature: string): SQL => sql`
	case
		when array_position(search_rate_limit_bucket.seen_queries, ${query_signature}) is not null
			then search_rate_limit_bucket.seen_queries
		when coalesce(array_length(search_rate_limit_bucket.seen_queries, 1), 0) < ${MAX_TRACKED_QUERIES}
			then array_append(search_rate_limit_bucket.seen_queries, ${query_signature})
		else array_append(search_rate_limit_bucket.seen_queries[2:${MAX_TRACKED_QUERIES}], ${query_signature})
	end
`;

const get_scope_key = (event: RequestEvent, scope: SearchRateLimitScope): string => {
	const user_key = event.locals.user?.id ?? 'anonymous';
	return `${scope}:${user_key}:${get_client_ip(event)}`;
};

const apply_search_penalty = async (
	db: ReturnType<typeof get_db>,
	bucket_key: string
): Promise<number> => {
	const penalty_rows = await db.execute<{ retry_after_seconds: number }>(sql`
		update search_rate_limit_bucket
		set penalty_expires_at = greatest(
			coalesce(penalty_expires_at, now()),
			now() + (${PENALTY_WINDOW_SECONDS} * interval '1 second')
		)
		where bucket_key = ${bucket_key}
		returning
			greatest(
				1,
				cast(ceil(extract(epoch from (penalty_expires_at - now()))) as integer),
				${PENALTY_WINDOW_SECONDS}
			) as retry_after_seconds
	`);

	return penalty_rows.rows[0]?.retry_after_seconds ?? PENALTY_WINDOW_SECONDS;
};

export const consume_search_rate_limit = async (
	event: RequestEvent,
	scope: SearchRateLimitScope,
	options: {
		query_signature: string;
		is_broad_query?: boolean;
	}
): Promise<{ is_allowed: true } | { is_allowed: false; retry_after_seconds: number }> => {
	await initialize_search_rate_limit_store();

	const db = get_db();
	const bucket_key = get_scope_key(event, scope);
	const broad_query_increment = options.is_broad_query ? 1 : 0;

	const upserted_rows = await db.execute<{
		attempt_count: number;
		broad_query_count: number;
		is_penalized: boolean;
		rate_limit_hits: number;
		retry_after_seconds: number;
		unique_query_count: number;
	}>(sql`
		insert into search_rate_limit_bucket (
			bucket_key,
			attempt_count,
			expires_at,
			broad_query_count,
			seen_queries
		)
		values (
			${bucket_key},
			1,
			now() + (${WINDOW_SECONDS} * interval '1 second'),
			${broad_query_increment},
			array[${options.query_signature}]
		)
		on conflict (bucket_key)
		do update set
			attempt_count = case
				when search_rate_limit_bucket.expires_at <= now() then 1
				else search_rate_limit_bucket.attempt_count + 1
			end,
			expires_at = case
				when search_rate_limit_bucket.expires_at <= now()
					then now() + (${WINDOW_SECONDS} * interval '1 second')
				else search_rate_limit_bucket.expires_at
			end,
			rate_limit_hits = case
				when search_rate_limit_bucket.expires_at <= now() then 0
				else search_rate_limit_bucket.rate_limit_hits
			end,
			broad_query_count = case
				when search_rate_limit_bucket.expires_at <= now() then ${broad_query_increment}
				else search_rate_limit_bucket.broad_query_count + ${broad_query_increment}
			end,
			seen_queries = case
				when search_rate_limit_bucket.expires_at <= now() then array[${options.query_signature}]
				else ${get_tracked_queries_sql(options.query_signature)}
			end
		returning
			attempt_count,
			broad_query_count,
			coalesce(penalty_expires_at > now(), false) as is_penalized,
			rate_limit_hits,
			greatest(
				1,
				cast(ceil(extract(epoch from (expires_at - now()))) as integer)
			) as retry_after_seconds,
			coalesce(cardinality(seen_queries), 0) as unique_query_count
	`);

	const current_bucket = upserted_rows.rows[0];

	if (!current_bucket) {
		return { is_allowed: true };
	}

	const active_limit = current_bucket.is_penalized
		? PENALTY_ATTEMPTS_PER_WINDOW
		: MAX_ATTEMPTS_PER_WINDOW;

	if (current_bucket.attempt_count > active_limit) {
		const rate_limit_rows = await db.execute<{ rate_limit_hits: number }>(sql`
			update search_rate_limit_bucket
			set rate_limit_hits = rate_limit_hits + 1
			where bucket_key = ${bucket_key}
			returning rate_limit_hits
		`);

		const next_rate_limit_hits =
			rate_limit_rows.rows[0]?.rate_limit_hits ?? current_bucket.rate_limit_hits + 1;
		const should_apply_penalty =
			!current_bucket.is_penalized && next_rate_limit_hits >= MAX_RATE_LIMIT_HITS_PER_WINDOW;
		const penalty_retry_after_seconds = should_apply_penalty
			? await apply_search_penalty(db, bucket_key)
			: undefined;

		console.warn(
			`Search rate limit exceeded for ${bucket_key} (hits=${next_rate_limit_hits}, penalized=${current_bucket.is_penalized || should_apply_penalty})`
		);

		return {
			is_allowed: false,
			retry_after_seconds: penalty_retry_after_seconds ?? current_bucket.retry_after_seconds
		};
	}

	const should_apply_penalty =
		!current_bucket.is_penalized &&
		(current_bucket.unique_query_count >= MAX_UNIQUE_QUERIES_PER_WINDOW ||
			current_bucket.broad_query_count >= MAX_BROAD_QUERIES_PER_WINDOW);

	if (should_apply_penalty) {
		const penalty_retry_after_seconds = await apply_search_penalty(db, bucket_key);
		console.warn(
			`Search abuse penalty applied for ${bucket_key} (unique_queries=${current_bucket.unique_query_count}, broad_queries=${current_bucket.broad_query_count})`
		);

		return {
			is_allowed: false,
			retry_after_seconds: penalty_retry_after_seconds
		};
	}

	return { is_allowed: true };
};

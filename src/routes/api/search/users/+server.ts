import { get_db } from '$lib/server/db';
import { profiles, user } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const token_pattern = /[^\p{L}\p{N}_]+/gu;
const default_limit = 25;
const minimum_limit = 1;
const maximum_limit = 50;
const search_cache_ttl_ms = 10_000;
const search_cache_max_entries = 200;

type SearchUserPayload = {
	id: string;
	name: string;
	image: string | null;
	username: string;
};

const search_response_cache = new Map<
	string,
	{
		expires_at: number;
		users: SearchUserPayload[];
	}
>();

const clamp_limit = (raw_limit: string | null): number => {
	const parsed = Number.parseInt(raw_limit ?? `${default_limit}`, 10);

	if (Number.isNaN(parsed)) {
		return default_limit;
	}

	return Math.max(minimum_limit, Math.min(maximum_limit, parsed));
};

const build_prefix_tsquery = (value: string): string | undefined => {
	const tokens = value
		.toLowerCase()
		.split(/\s+/)
		.map((token) => token.replaceAll(token_pattern, ''))
		.filter(Boolean);

	if (tokens.length === 0) {
		return undefined;
	}

	return tokens.map((token) => `${token}:*`).join(' & ');
};

const get_cached_search_result = (cache_key: string): SearchUserPayload[] | undefined => {
	const cached = search_response_cache.get(cache_key);

	if (!cached) {
		return undefined;
	}

	if (cached.expires_at <= Date.now()) {
		search_response_cache.delete(cache_key);
		return undefined;
	}

	return cached.users;
};

const set_cached_search_result = (cache_key: string, users: SearchUserPayload[]): void => {
	search_response_cache.set(cache_key, {
		expires_at: Date.now() + search_cache_ttl_ms,
		users
	});

	if (search_response_cache.size <= search_cache_max_entries) {
		return;
	}

	const oldest_key = search_response_cache.keys().next().value;

	if (typeof oldest_key === 'string') {
		search_response_cache.delete(oldest_key);
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('query')?.trim() ?? '';
	const limit = clamp_limit(url.searchParams.get('limit'));

	if (query.length < 1) {
		return json({ users: [] });
	}

	const ts_query = build_prefix_tsquery(query);

	if (!ts_query) {
		return json({ users: [] });
	}

	const cache_key = `${query.toLowerCase()}|${limit}`;
	const cached_users = get_cached_search_result(cache_key);

	if (cached_users) {
		return json(
			{ users: cached_users },
			{
				headers: {
					'cache-control': 'private, max-age=10'
				}
			}
		);
	}

	const db = get_db();
	const search_vector = sql`to_tsvector('simple', concat_ws(' ', coalesce(${profiles.username}, ''), coalesce(${user.name}, '')))`;
	const rank_expr = sql<number>`ts_rank_cd(${search_vector}, to_tsquery('simple', ${ts_query}))`;

	const users = await db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			username: profiles.username,
			rank: rank_expr
		})
		.from(user)
		.innerJoin(profiles, eq(profiles.user_id, user.id))
		.where(sql`${search_vector} @@ to_tsquery('simple', ${ts_query})`)
		.orderBy(sql`${rank_expr} DESC`, user.name)
		.limit(limit);

	const normalized_users = users.map(({ rank: _unused_rank, ...listed_user }) => ({
		...listed_user
	}));
	set_cached_search_result(cache_key, normalized_users);

	return json(
		{
			users: normalized_users
		},
		{
			headers: {
				'cache-control': 'private, max-age=10'
			}
		}
	);
};

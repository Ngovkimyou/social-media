import { get_db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const token_pattern = /[^\p{L}\p{N}_]+/gu;
const default_limit = 25;
const minimum_limit = 1;
const maximum_limit = 50;

let index_init_promise: Promise<void> | undefined;

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

const ensure_search_index = async (): Promise<void> => {
	if (index_init_promise !== undefined) {
		return index_init_promise;
	}

	const db = get_db();

	index_init_promise = (async () => {
		await db.execute(
			sql`CREATE INDEX IF NOT EXISTS user_name_search_tsv_idx ON "user" USING GIN (to_tsvector('simple', coalesce(name, '')))`
		);
	})();

	try {
		await index_init_promise;
	} catch (error) {
		// If index creation is blocked by DB permissions, search still works without it.
		console.warn('Search index initialization failed; continuing without index.', error);
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

	await ensure_search_index();

	const db = get_db();
	const rank_expr = sql<number>`ts_rank_cd(to_tsvector('simple', coalesce(${user.name}, '')), to_tsquery('simple', ${ts_query}))`;

	const users = await db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			rank: rank_expr
		})
		.from(user)
		.where(
			sql`to_tsvector('simple', coalesce(${user.name}, '')) @@ to_tsquery('simple', ${ts_query})`
		)
		.orderBy(sql`${rank_expr} DESC`, user.name)
		.limit(limit);

	return json({
		users: users.map(({ rank: _unused_rank, ...listed_user }) => listed_user)
	});
};

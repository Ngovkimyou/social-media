import { get_db } from '$lib/server/db';
import { profiles, user } from '$lib/server/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensure_profile_for_user } from '$lib/server/utility/profile';

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
	const search_vector = sql`to_tsvector('simple', concat_ws(' ', coalesce(${user.name}, ''), coalesce(${profiles.username}, '')))`;
	const rank_expr = sql<number>`ts_rank_cd(${search_vector}, to_tsquery('simple', ${ts_query}))`;

	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			username: profiles.username,
			rank: rank_expr
		})
		.from(user)
		.leftJoin(profiles, eq(profiles.user_id, user.id))
		.where(sql`${search_vector} @@ to_tsquery('simple', ${ts_query})`)
		.orderBy(sql`${rank_expr} DESC`, user.name)
		.limit(limit);

	const users_missing_profile = users.filter((listed_user) => !listed_user.username);

	for (const listed_user of users_missing_profile) {
		try {
			await ensure_profile_for_user({
				user_id: listed_user.id,
				name: listed_user.name
			});
		} catch (error) {
			console.warn(
				`Search profile backfill failed for user ${listed_user.id}; continuing without backfill.`,
				error
			);
		}
	}

	const user_ids = users.map((listed_user) => listed_user.id);
	const username_rows =
		user_ids.length > 0
			? await db
					.select({
						user_id: profiles.user_id,
						username: profiles.username
					})
					.from(profiles)
					.where(inArray(profiles.user_id, user_ids))
			: [];
	const username_by_user_id = new Map(
		username_rows.map((profile_row) => [profile_row.user_id, profile_row.username])
	);

	return json({
		users: users
			.map(({ rank: _unused_rank, email: _unused_email, ...listed_user }) => ({
				...listed_user,
				username: username_by_user_id.get(listed_user.id) ?? listed_user.username ?? undefined
			}))
			.filter(
				(listed_user): listed_user is typeof listed_user & { username: string } =>
					typeof listed_user.username === 'string' && listed_user.username.length > 0
			)
	});
};

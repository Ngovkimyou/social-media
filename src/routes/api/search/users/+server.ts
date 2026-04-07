import { get_db } from '$lib/server/db';
import { profiles, user } from '$lib/server/db/schema';
import { consume_search_rate_limit } from '$lib/server/utilities/search-rate-limit';
import { eq, sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const token_pattern = /[^\p{L}\p{N}_]+/gu;
const default_limit = 25;
const minimum_limit = 1;
const maximum_limit = 50;
const minimum_query_characters = 2;
const broad_query_characters = 2;
const broad_query_limit_cap = 10;
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
let search_index_init_promise: Promise<void> | undefined;

const clamp_limit = (raw_limit: string | null): number => {
	const parsed = Number.parseInt(raw_limit ?? `${default_limit}`, 10);

	if (Number.isNaN(parsed)) {
		return default_limit;
	}

	return Math.max(minimum_limit, Math.min(maximum_limit, parsed));
};

const normalize_query = (value: string): string => value.normalize('NFKC').trim();

const get_searchable_character_count = (value: string): number =>
	Array.from(value.replaceAll(token_pattern, '')).length;

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

const ensure_search_index_ready = async (): Promise<void> => {
	if (search_index_init_promise !== undefined) {
		await search_index_init_promise;
		return;
	}

	search_index_init_promise = (async () => {
		const db = get_db();
		await db.execute(sql`
			create table if not exists profile_search_index (
				user_id text primary key references "user"(id) on delete cascade,
				username text not null,
				name text not null,
				search_vector tsvector not null
			)
		`);

		await db.execute(sql`
			alter table profile_search_index
			add column if not exists name text not null default ''
		`);

		await db.execute(sql`
			create index if not exists profile_search_index_search_vector_idx
			on profile_search_index
			using gin (search_vector)
		`);

		await db.execute(sql`
			insert into profile_search_index (user_id, username, name, search_vector)
			select
				p.user_id,
				p.username,
				u.name,
				to_tsvector('simple', concat_ws(' ', coalesce(p.username, ''), coalesce(u.name, '')))
			from profile p
			inner join "user" u on u.id = p.user_id
			on conflict (user_id)
			do update set
				username = excluded.username,
				name = excluded.name,
				search_vector = excluded.search_vector
		`);

		await db.execute(sql`
			create or replace function refresh_profile_search_index(target_user_id text)
			returns void
			language plpgsql
			as $$
			begin
				delete from profile_search_index where user_id = target_user_id;

				insert into profile_search_index (user_id, username, name, search_vector)
				select
					p.user_id,
					p.username,
					u.name,
					to_tsvector('simple', concat_ws(' ', coalesce(p.username, ''), coalesce(u.name, '')))
				from profile p
				inner join "user" u on u.id = p.user_id
				where p.user_id = target_user_id
				on conflict (user_id)
				do update set
					username = excluded.username,
					name = excluded.name,
					search_vector = excluded.search_vector;
			end;
			$$
		`);

		await db.execute(sql`
			create or replace function profile_search_index_profile_trigger()
			returns trigger
			language plpgsql
			as $$
			begin
				if tg_op = 'DELETE' then
					perform refresh_profile_search_index(old.user_id);
					return old;
				end if;

				perform refresh_profile_search_index(new.user_id);
				return new;
			end;
			$$
		`);

		await db.execute(sql`
			create or replace function profile_search_index_user_trigger()
			returns trigger
			language plpgsql
			as $$
			begin
				if tg_op = 'DELETE' then
					perform refresh_profile_search_index(old.id);
					return old;
				end if;

				perform refresh_profile_search_index(new.id);
				return new;
			end;
			$$
		`);

		await db.execute(sql`
			drop trigger if exists profile_search_index_profile_changes on profile
		`);
		await db.execute(sql`
			create trigger profile_search_index_profile_changes
			after insert or update or delete on profile
			for each row execute function profile_search_index_profile_trigger()
		`);

		await db.execute(sql`
			drop trigger if exists profile_search_index_user_changes on "user"
		`);
		await db.execute(sql`
			create trigger profile_search_index_user_changes
			after insert or update or delete on "user"
			for each row execute function profile_search_index_user_trigger()
		`);
	})();

	await search_index_init_promise;
};

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const query = url.searchParams.get('query')?.trim() ?? '';
	const limit = clamp_limit(url.searchParams.get('limit'));

	const normalized_query = normalize_query(query);

	if (normalized_query.length < 1) {
		return json({ users: [] });
	}

	if (get_searchable_character_count(normalized_query) < minimum_query_characters) {
		return json({ users: [] });
	}

	const searchable_character_count = get_searchable_character_count(normalized_query);
	const is_broad_query = searchable_character_count <= broad_query_characters;

	const rate_limit = await consume_search_rate_limit(event, 'search-users', {
		query_signature: normalized_query.toLowerCase(),
		is_broad_query
	});
	if (!rate_limit.is_allowed) {
		return json(
			{ error: 'Too many search requests. Please try again shortly.' },
			{
				status: 429,
				headers: {
					'retry-after': `${rate_limit.retry_after_seconds}`
				}
			}
		);
	}

	const ts_query = build_prefix_tsquery(normalized_query);

	if (!ts_query) {
		return json({ users: [] });
	}

	const effective_limit = is_broad_query ? Math.min(limit, broad_query_limit_cap) : limit;
	const cache_key = `${normalized_query.toLowerCase()}|${effective_limit}`;
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

	await ensure_search_index_ready();
	const db = get_db();
	const rank_expr = sql<number>`coalesce((
		select ts_rank_cd(psi.search_vector, to_tsquery('simple', ${ts_query}))
		from profile_search_index psi
		where psi.user_id = ${profiles.user_id}
	), 0)`;

	const users = await db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			username: profiles.username,
			rank: rank_expr
		})
		.from(profiles)
		.innerJoin(user, eq(user.id, profiles.user_id))
		.where(
			sql`exists (
				select 1
				from profile_search_index psi
				where
					psi.user_id = ${profiles.user_id}
					and psi.search_vector @@ to_tsquery('simple', ${ts_query})
			)`
		)
		.orderBy(sql`${rank_expr} DESC`, user.name)
		.limit(effective_limit);

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

import { json } from '@sveltejs/kit';
import { eq, inArray, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { get_db } from '$lib/server/db';
import { profiles, user } from '$lib/server/db/schema';
import { consume_search_rate_limit } from '$lib/server/utilities/search-rate-limit';

const max_recent_users = 15;

const normalize_username = (value: string): string => value.normalize('NFKC').trim().toLowerCase();

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const usernames = url.searchParams
		.getAll('username')
		.map(normalize_username)
		.filter(Boolean)
		.filter((username, index, values) => values.indexOf(username) === index)
		.slice(0, max_recent_users);

	if (usernames.length === 0) {
		return json({ users: [] });
	}

	const rate_limit = await consume_search_rate_limit(event, 'search-recent-users', {
		query_signature: usernames.join(','),
		is_broad_query: usernames.length >= 8
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

	const db = get_db();
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			username: profiles.username
		})
		.from(profiles)
		.innerJoin(user, eq(user.id, profiles.user_id))
		.where(inArray(profiles.username, usernames))
		.orderBy(
			sql`array_position(array[${sql.join(
				usernames.map((username) => sql`${username}`),
				sql`, `
			)}], ${profiles.username})`
		);

	return json({ users: rows });
};

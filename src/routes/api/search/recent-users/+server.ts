import { json } from '@sveltejs/kit';
import { eq, inArray, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { get_db } from '$lib/server/db';
import { profiles, user } from '$lib/server/db/schema';

const max_recent_users = 15;

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const usernames = url.searchParams
		.getAll('username')
		.map((username) => username.trim())
		.filter(Boolean)
		.slice(0, max_recent_users);

	if (usernames.length === 0) {
		return json({ users: [] });
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

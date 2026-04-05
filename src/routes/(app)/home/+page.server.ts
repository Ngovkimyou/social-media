import type { PageServerLoad } from './$types';
import { get_db } from '$lib/server/db';
import { posts, post_media, media, user, profiles } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));
	const db = get_db();

	const rows = await db
		.select({
			id: posts.id,
			content: posts.content,
			created_at: posts.created_at,
			author_name: user.name,
			author_username: profiles.username,
			author_avatar: user.image,
			media_url: media.url,
			media_type: media.type
		})
		.from(posts)
		.innerJoin(user, eq(posts.author_id, user.id))
		.innerJoin(profiles, eq(profiles.user_id, user.id))
		.leftJoin(post_media, eq(posts.id, post_media.post_id))
		.leftJoin(media, eq(post_media.media_id, media.id))
		.orderBy(desc(posts.created_at))
		.limit(PAGE_SIZE + 1)
		.offset(page * PAGE_SIZE);

	// Deduplicate: multiple rows per post when post has multiple media — keep first media only
	const seen = new Set<string>();
	const all = rows.filter((row) => {
		if (seen.has(row.id)) return false;
		seen.add(row.id);
		return true;
	});

	const feed_posts = all.slice(0, PAGE_SIZE).map((row) => ({
		id: row.id,
		content: row.content,
		created_at: row.created_at,
		author_name: row.author_name,
		author_username: row.author_username,
		author_avatar: row.author_avatar,
		media_url: row.media_url,
		media_type: row.media_type
	}));

	return { posts: feed_posts, page, has_more: all.length > PAGE_SIZE };
};

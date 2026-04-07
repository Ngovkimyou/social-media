import { get_db } from '$lib/server/db';
import { media, post_media, posts, profiles, user } from '$lib/server/db/schema';
import { ensure_profile_for_user } from '$lib/server/utilities/profile';
import type { PostFeedPost } from '$lib/types/post-feed';
import { and, asc, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';

export const HOME_FEED_PAGE_SIZE = 12;

type HomeFeedCursor = {
	created_at: string;
	id: string;
};

type HomeFeedPage = {
	posts: PostFeedPost[];
	has_more: boolean;
	next_cursor?: string;
};

function encode_home_feed_cursor(cursor: HomeFeedCursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decode_home_feed_cursor(cursor?: string): HomeFeedCursor | undefined {
	if (!cursor) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(
			Buffer.from(cursor, 'base64url').toString('utf8')
		) as Partial<HomeFeedCursor>;

		if (typeof parsed.created_at !== 'string' || typeof parsed.id !== 'string') {
			return undefined;
		}

		return {
			created_at: parsed.created_at,
			id: parsed.id
		};
	} catch {
		return undefined;
	}
}

export async function get_home_feed_page(
	limit = HOME_FEED_PAGE_SIZE,
	cursor?: string
): Promise<HomeFeedPage> {
	const db = get_db();
	const normalized_limit = Math.max(1, Math.min(limit, 30));
	const decoded_cursor = decode_home_feed_cursor(cursor);

	const page_rows = await db
		.select({
			id: posts.id,
			author_id: posts.author_id,
			content: posts.content,
			created_at: posts.created_at,
			author_name: user.name,
			author_username: profiles.username,
			author_avatar: user.image
		})
		.from(posts)
		.innerJoin(user, eq(posts.author_id, user.id))
		.leftJoin(profiles, eq(profiles.user_id, user.id))
		.where(
			and(
				isNull(posts.deleted_at),
				decoded_cursor
					? or(
							lt(posts.created_at, new Date(decoded_cursor.created_at)),
							and(
								eq(posts.created_at, new Date(decoded_cursor.created_at)),
								lt(posts.id, decoded_cursor.id)
							)
						)
					: undefined
			)
		)
		.orderBy(desc(posts.created_at), desc(posts.id))
		.limit(normalized_limit + 1);

	const missing_profile_rows = page_rows.filter((row) => !row.author_username);
	const ensured_usernames = new Map<string, string>();

	if (missing_profile_rows.length > 0) {
		const resolved_usernames = await Promise.all(
			missing_profile_rows.map(async (row) => ({
				user_id: row.author_id,
				username: await ensure_profile_for_user({
					user_id: row.author_id,
					name: row.author_name
				})
			}))
		);

		for (const row of resolved_usernames) {
			ensured_usernames.set(row.user_id, row.username);
		}
	}

	const visible_rows = page_rows.slice(0, normalized_limit);
	const post_ids = visible_rows.map((row) => row.id);

	const media_rows =
		post_ids.length === 0
			? []
			: await db
					.select({
						post_id: post_media.post_id,
						media_url: media.url,
						media_type: media.type,
						sort_order: post_media.sort_order
					})
					.from(post_media)
					.innerJoin(media, eq(post_media.media_id, media.id))
					.where(inArray(post_media.post_id, post_ids))
					.orderBy(asc(post_media.sort_order));

	const first_media_by_post = new Map<
		string,
		{
			media_url: string | null;
			media_type: 'image' | 'video' | null;
		}
	>();

	for (const row of media_rows) {
		if (first_media_by_post.has(row.post_id)) {
			continue;
		}

		first_media_by_post.set(row.post_id, {
			media_url: row.media_url,
			media_type: row.media_type
		});
	}

	const feed_posts: PostFeedPost[] = visible_rows.map((row) => {
		const post_media_row = first_media_by_post.get(row.id);

		return {
			id: row.id,
			content: row.content,
			created_at: row.created_at,
			author_name: row.author_name,
			author_username: row.author_username ?? ensured_usernames.get(row.author_id) ?? 'user',
			author_avatar: row.author_avatar,
			media_url: post_media_row?.media_url,
			media_type: post_media_row?.media_type
		};
	});

	const has_more = page_rows.length > normalized_limit;
	const last_post = visible_rows.at(-1);
	const next_cursor =
		has_more && last_post
			? encode_home_feed_cursor({
					created_at: last_post.created_at.toISOString(),
					id: last_post.id
				})
			: undefined;

	return next_cursor
		? {
				posts: feed_posts,
				has_more,
				next_cursor
			}
		: {
				posts: feed_posts,
				has_more
			};
}

import { HOME_FEED_PAGE_SIZE } from '$lib/constants/home-feed';
import { get_db } from '$lib/server/db';
import { likes, media, post_media, posts, profiles, user } from '$lib/server/db/schema';
import { ensure_profile_for_user } from '$lib/server/utilities/profile';
import type { PostFeedPost } from '$lib/types/post-feed';
import { build_responsive_image_source } from '$lib/utilities/responsive-image';
import { and, asc, count, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';

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
	cursor?: string,
	viewer_user_id?: string
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

	const like_count_rows =
		post_ids.length === 0
			? []
			: await db
					.select({
						post_id: likes.post_id,
						like_count: count()
					})
					.from(likes)
					.where(inArray(likes.post_id, post_ids))
					.groupBy(likes.post_id);

	const liked_rows =
		post_ids.length === 0 || !viewer_user_id
			? []
			: await db
					.select({ post_id: likes.post_id })
					.from(likes)
					.where(and(inArray(likes.post_id, post_ids), eq(likes.user_id, viewer_user_id)));

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

	const like_count_by_post = new Map<string, number>();

	for (const row of like_count_rows) {
		like_count_by_post.set(row.post_id, row.like_count);
	}

	const liked_post_ids = new Set(liked_rows.map((row) => row.post_id));

	const feed_posts: PostFeedPost[] = visible_rows.map((row) => {
		const post_media_row = first_media_by_post.get(row.id);
		const responsive_media =
			post_media_row?.media_type === 'image' && post_media_row.media_url
				? build_responsive_image_source(post_media_row.media_url, {
						widths: [480, 720, 960, 1200, 1600],
						fit: 'limit',
						quality: 'auto'
					})
				: undefined;

		return {
			id: row.id,
			content: row.content,
			created_at: row.created_at,
			like_count: like_count_by_post.get(row.id) ?? 0,
			has_liked: liked_post_ids.has(row.id),
			author_name: row.author_name,
			author_username: row.author_username ?? ensured_usernames.get(row.author_id) ?? 'user',
			author_avatar: row.author_avatar,
			media_display_srcset: responsive_media?.srcset,
			media_display_url: responsive_media?.src,
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

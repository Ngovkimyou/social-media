import { HOME_FEED_PAGE_SIZE } from '$lib/constants/home-feed';
import { get_db } from '$lib/server/db';
import { alias } from 'drizzle-orm/pg-core';
import {
	comments,
	hidden_posts,
	likes,
	media,
	post_media,
	post_shares,
	posts,
	profiles,
	user
} from '$lib/server/db/schema';
import { ensure_profile_for_user } from '$lib/server/utilities/profile';
import { initialize_hidden_posts_table } from '$lib/server/utilities/posts';
import type { PostFeedPost } from '$lib/types/post-feed';
import { build_responsive_image_source } from '$lib/utilities/responsive-image';
import { build_responsive_video_source } from '$lib/utilities/responsive-video';
import { and, asc, count, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';

type HomeFeedCursor = {
	created_at: string;
	id: string;
};

type HomeFeedPage = {
	posts: PostFeedPost[];
	has_more: boolean;
	next_cursor?: string;
};

type FeedInteractionData = {
	like_count_by_post: Map<string, number>;
	liked_post_ids: Set<string>;
	share_count_by_post: Map<string, number>;
	shared_post_ids: Set<string>;
};

type HomeFeedRow = {
	feed_item_id: string;
	id: string;
	author_id: string;
	content: string;
	created_at: Date;
	updated_at: Date;
	author_name: string;
	author_username: string | null;
	author_avatar: string | null;
	shared_at?: Date;
	shared_by_user_id?: string;
	shared_by_name?: string;
	shared_by_username?: string | null;
	shared_by_avatar?: string | null;
};

async function get_feed_interaction_data(params: {
	db: ReturnType<typeof get_db>;
	post_ids: string[];
	viewer_user_id?: string;
}): Promise<FeedInteractionData> {
	const { db, post_ids, viewer_user_id } = params;

	if (post_ids.length === 0) {
		return {
			like_count_by_post: new Map(),
			liked_post_ids: new Set(),
			share_count_by_post: new Map(),
			shared_post_ids: new Set()
		};
	}

	const [like_count_rows, liked_rows, share_count_rows, shared_rows] = await Promise.all([
		db
			.select({
				post_id: likes.post_id,
				like_count: count()
			})
			.from(likes)
			.where(inArray(likes.post_id, post_ids))
			.groupBy(likes.post_id),
		viewer_user_id
			? db
					.select({ post_id: likes.post_id })
					.from(likes)
					.where(and(inArray(likes.post_id, post_ids), eq(likes.user_id, viewer_user_id)))
			: Promise.resolve([]),
		db
			.select({
				post_id: post_shares.post_id,
				share_count: count()
			})
			.from(post_shares)
			.where(inArray(post_shares.post_id, post_ids))
			.groupBy(post_shares.post_id),
		viewer_user_id
			? db
					.select({ post_id: post_shares.post_id })
					.from(post_shares)
					.where(
						and(inArray(post_shares.post_id, post_ids), eq(post_shares.user_id, viewer_user_id))
					)
			: Promise.resolve([])
	]);

	const like_count_by_post = new Map<string, number>();
	for (const row of like_count_rows) {
		like_count_by_post.set(row.post_id, row.like_count);
	}

	const share_count_by_post = new Map<string, number>();
	for (const row of share_count_rows) {
		share_count_by_post.set(row.post_id, row.share_count);
	}

	return {
		like_count_by_post,
		liked_post_ids: new Set(liked_rows.map((row) => row.post_id)),
		share_count_by_post,
		shared_post_ids: new Set(shared_rows.map((row) => row.post_id))
	};
}

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

function get_feed_media_data(
	post_media_row:
		| {
				media_url: string | null;
				media_type: 'image' | 'video' | null;
		  }
		| undefined
): Pick<
	PostFeedPost,
	'media_display_srcset' | 'media_display_url' | 'media_poster_url' | 'media_url' | 'media_type'
> {
	const responsive_media =
		post_media_row?.media_type === 'image' && post_media_row.media_url
			? build_responsive_image_source(post_media_row.media_url, {
					widths: [480, 720, 960, 1200, 1600],
					fit: 'limit',
					quality: 'auto'
				})
			: undefined;
	const responsive_video =
		post_media_row?.media_type === 'video' && post_media_row.media_url
			? build_responsive_video_source(post_media_row.media_url)
			: undefined;

	return {
		media_display_srcset: responsive_media?.srcset,
		media_display_url: responsive_media?.src ?? responsive_video?.src,
		media_poster_url: responsive_video?.poster,
		media_url: post_media_row?.media_url,
		media_type: post_media_row?.media_type
	};
}

function get_shared_feed_data(
	row: HomeFeedRow,
	ensured_usernames: Map<string, string>
): Partial<
	Pick<
		PostFeedPost,
		'shared_at' | 'shared_by_user_id' | 'shared_by_name' | 'shared_by_username' | 'shared_by_avatar'
	>
> {
	if (!row.shared_by_user_id) {
		return {};
	}

	return {
		...(row.shared_at ? { shared_at: row.shared_at } : {}),
		shared_by_user_id: row.shared_by_user_id,
		...(row.shared_by_name ? { shared_by_name: row.shared_by_name } : {}),
		shared_by_username:
			row.shared_by_username ?? ensured_usernames.get(row.shared_by_user_id) ?? 'user',
		...(row.shared_by_avatar ? { shared_by_avatar: row.shared_by_avatar } : {})
	};
}

export async function get_home_feed_page(
	limit = HOME_FEED_PAGE_SIZE,
	cursor?: string,
	viewer_user_id?: string
): Promise<HomeFeedPage> {
	await initialize_hidden_posts_table();
	const db = get_db();
	const normalized_limit = Math.max(1, Math.min(limit, 30));
	const decoded_cursor = decode_home_feed_cursor(cursor);
	const share_user = alias(user, 'share_user');
	const share_profiles = alias(profiles, 'share_profiles');
	const share_tie_id = sql<string>`${post_shares.user_id} || ':' || ${post_shares.post_id}`;

	const [post_rows, share_rows] = await Promise.all([
		db
			.select({
				feed_item_id: sql<string>`'post:' || ${posts.id}`,
				id: posts.id,
				author_id: posts.author_id,
				content: posts.content,
				created_at: posts.created_at,
				updated_at: posts.updated_at,
				author_name: user.name,
				author_username: profiles.username,
				author_avatar: user.image
			})
			.from(posts)
			.innerJoin(user, eq(posts.author_id, user.id))
			.leftJoin(profiles, eq(profiles.user_id, user.id))
			.leftJoin(
				hidden_posts,
				and(
					eq(hidden_posts.post_id, posts.id),
					eq(hidden_posts.user_id, viewer_user_id ?? '__anonymous__')
				)
			)
			.where(
				and(
					isNull(posts.deleted_at),
					isNull(hidden_posts.post_id),
					decoded_cursor
						? or(
								lt(posts.created_at, new Date(decoded_cursor.created_at)),
								and(
									eq(posts.created_at, new Date(decoded_cursor.created_at)),
									lt(posts.id, decoded_cursor.id.replace(/^post:/, ''))
								)
							)
						: undefined
				)
			)
			.orderBy(desc(posts.created_at), desc(posts.id))
			.limit(normalized_limit + 1),
		db
			.select({
				feed_item_id: sql<string>`'share:' || ${post_shares.user_id} || ':' || ${post_shares.post_id}`,
				id: posts.id,
				author_id: posts.author_id,
				content: posts.content,
				created_at: posts.created_at,
				updated_at: posts.updated_at,
				author_name: user.name,
				author_username: profiles.username,
				author_avatar: user.image,
				shared_at: post_shares.created_at,
				shared_by_user_id: post_shares.user_id,
				shared_by_name: share_user.name,
				shared_by_username: share_profiles.username,
				shared_by_avatar: share_user.image
			})
			.from(post_shares)
			.innerJoin(posts, eq(post_shares.post_id, posts.id))
			.innerJoin(user, eq(posts.author_id, user.id))
			.innerJoin(share_user, eq(post_shares.user_id, share_user.id))
			.leftJoin(profiles, eq(profiles.user_id, user.id))
			.leftJoin(share_profiles, eq(share_profiles.user_id, share_user.id))
			.leftJoin(
				hidden_posts,
				and(
					eq(hidden_posts.post_id, posts.id),
					eq(hidden_posts.user_id, viewer_user_id ?? '__anonymous__')
				)
			)
			.where(
				and(
					isNull(posts.deleted_at),
					isNull(hidden_posts.post_id),
					decoded_cursor
						? or(
								lt(post_shares.created_at, new Date(decoded_cursor.created_at)),
								and(
									eq(post_shares.created_at, new Date(decoded_cursor.created_at)),
									lt(share_tie_id, decoded_cursor.id.replace(/^share:/, ''))
								)
							)
						: undefined
				)
			)
			.orderBy(desc(post_shares.created_at), desc(share_tie_id))
			.limit(normalized_limit + 1)
	]);

	const page_rows: HomeFeedRow[] = [
		...(post_rows as HomeFeedRow[]),
		...(share_rows as HomeFeedRow[])
	]
		.sort((left, right) => {
			const right_time = (right.shared_at ?? right.created_at).getTime();
			const left_time = (left.shared_at ?? left.created_at).getTime();

			if (right_time !== left_time) {
				return right_time - left_time;
			}

			return right.feed_item_id.localeCompare(left.feed_item_id);
		})
		.slice(0, normalized_limit + 1);

	const missing_profile_rows = page_rows.filter((row) => !row.author_username);
	const missing_share_profile_rows = page_rows.filter(
		(row) => row.shared_by_user_id && !row.shared_by_username
	);
	const ensured_usernames = new Map<string, string>();

	if (missing_profile_rows.length > 0 || missing_share_profile_rows.length > 0) {
		const resolved_usernames = await Promise.all(
			[
				...missing_profile_rows.map((row) => ({
					user_id: row.author_id,
					name: row.author_name
				})),
				...missing_share_profile_rows.map((row) => ({
					user_id: row.shared_by_user_id!,
					name: row.shared_by_name ?? 'User'
				}))
			].map(async (row) => ({
				user_id: row.user_id,
				username: await ensure_profile_for_user({
					user_id: row.user_id,
					name: row.name
				})
			}))
		);

		for (const row of resolved_usernames) {
			ensured_usernames.set(row.user_id, row.username);
		}
	}

	const visible_rows = page_rows.slice(0, normalized_limit);
	const post_ids = visible_rows.map((row) => row.id);

	const [media_rows, comment_count_rows] =
		post_ids.length === 0
			? [[], []]
			: await Promise.all([
					db
						.select({
							post_id: post_media.post_id,
							media_url: media.url,
							media_type: media.type,
							sort_order: post_media.sort_order
						})
						.from(post_media)
						.innerJoin(media, eq(post_media.media_id, media.id))
						.where(inArray(post_media.post_id, post_ids))
						.orderBy(asc(post_media.sort_order)),
					db
						.select({ post_id: comments.post_id, comment_count: count() })
						.from(comments)
						.where(and(inArray(comments.post_id, post_ids), isNull(comments.deleted_at)))
						.groupBy(comments.post_id)
				]);

	const interaction_data = await get_feed_interaction_data({
		db,
		post_ids,
		...(viewer_user_id ? { viewer_user_id } : {})
	});

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

	const comment_count_by_post = new Map<string, number>();
	for (const row of comment_count_rows) {
		comment_count_by_post.set(row.post_id, row.comment_count);
	}

	const feed_posts: PostFeedPost[] = visible_rows.map((row) => {
		const post_media_row = first_media_by_post.get(row.id);

		return {
			feed_item_id: row.feed_item_id,
			id: row.id,
			author_id: row.author_id,
			content: row.content,
			created_at: row.created_at,
			updated_at: row.updated_at,
			like_count: interaction_data.like_count_by_post.get(row.id) ?? 0,
			has_liked: interaction_data.liked_post_ids.has(row.id),
			share_count: interaction_data.share_count_by_post.get(row.id) ?? 0,
			has_shared: interaction_data.shared_post_ids.has(row.id),
			author_name: row.author_name,
			author_username: row.author_username ?? ensured_usernames.get(row.author_id) ?? 'user',
			author_avatar: row.author_avatar,
			...get_shared_feed_data(row, ensured_usernames),
			...get_feed_media_data(post_media_row),
			comment_count: comment_count_by_post.get(row.id) ?? 0
		};
	});

	const has_more = page_rows.length > normalized_limit;
	const last_post = visible_rows.at(-1);
	const next_cursor =
		has_more && last_post
			? encode_home_feed_cursor({
					created_at: (last_post.shared_at ?? last_post.created_at).toISOString(),
					id: last_post.feed_item_id
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

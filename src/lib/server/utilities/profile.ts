import { alias } from 'drizzle-orm/pg-core';
import { and, count, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { user as auth_user } from '$lib/server/db/auth.schema';
import { get_db } from '$lib/server/db';
import {
	comments,
	follows,
	hidden_posts,
	likes,
	media,
	post_media,
	post_shares,
	posts,
	profiles
} from '$lib/server/db/schema';
import {
	get_or_set_short_ttl_cache,
	invalidate_short_ttl_cache_key,
	invalidate_short_ttl_cache_prefix
} from '$lib/server/utilities/short-ttl-cache';
import { initialize_hidden_posts_table } from '$lib/server/utilities/posts';
import { is_reserved_profile_username, slugify_username } from '$lib/utilities/profile';
import type { PostFeedPost } from '$lib/types/post-feed';
import { build_responsive_video_source } from '$lib/utilities/responsive-video';

const PROFILE_USERNAME_CACHE_TTL_MS = 10_000;
const PROFILE_PAGE_CACHE_TTL_MS = 15_000;

const is_unique_violation_error = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'cause' in error &&
	typeof error.cause === 'object' &&
	error.cause !== null &&
	'code' in error.cause &&
	error.cause.code === '23505';

const rethrow_unless_unique_violation = (error: unknown): void => {
	if (!is_unique_violation_error(error)) {
		throw error;
	}
};

export const build_unique_username = async (
	base_input: string,
	exclude_user_id?: string
): Promise<string> => {
	const db = get_db();
	const base = slugify_username(base_input);

	let candidate = base;
	let suffix = 1;

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	while (true) {
		const where =
			exclude_user_id === undefined
				? eq(profiles.username, candidate)
				: and(eq(profiles.username, candidate), ne(profiles.user_id, exclude_user_id));

		const existing = await db
			.select({ user_id: profiles.user_id })
			.from(profiles)
			.where(where)
			.limit(1);

		if (existing.length === 0 && !is_reserved_profile_username(candidate)) {
			return candidate;
		}

		candidate = `${base}_${suffix++}`;
	}
};

export const ensure_profile_for_user = async (params: {
	user_id: string;
	name: string;
}): Promise<string> => {
	const db = get_db();

	// Retry a few times to handle concurrent profile creation and username collisions.
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const existing = await db
			.select({ user_id: profiles.user_id, username: profiles.username })
			.from(profiles)
			.where(eq(profiles.user_id, params.user_id))
			.limit(1);

		const existing_profile = existing[0];

		if (existing_profile?.username) {
			return existing_profile.username;
		}

		const username = await build_unique_username(params.name || params.user_id, params.user_id);

		try {
			await db
				.insert(profiles)
				.values({
					user_id: params.user_id,
					username
				})
				.onConflictDoNothing({ target: profiles.user_id });

			invalidate_profile_cache({
				profile_user_id: params.user_id,
				username
			});

			return username;
		} catch (error) {
			// 23505 = unique_violation (e.g. concurrent username insert). Retry with a new candidate.
			rethrow_unless_unique_violation(error);
			continue;
		}
	}

	throw new Error(`Failed to create profile after retries for user ${params.user_id}`);
};

export const get_profile_by_username = async (
	username: string
): Promise<
	| {
			user_id: string;
			name: string | null;
			email: string;
			image: string | null;
			cover_image: string | null;
			created_at: Date;
			username: string;
			bio: string | null;
			location: string | null;
			phone: string | null;
			email_visible: boolean;
	  }
	| undefined
> => {
	const db = get_db();

	const rows = await db
		.select({
			user_id: auth_user.id,
			name: auth_user.name,
			email: auth_user.email,
			image: auth_user.image,
			cover_image: profiles.cover_image,
			created_at: auth_user.createdAt,
			username: profiles.username,
			bio: profiles.bio,
			location: profiles.location,
			phone: profiles.phone,
			email_visible: profiles.email_visible
		})
		.from(profiles)
		.innerJoin(auth_user, eq(auth_user.id, profiles.user_id))
		.where(eq(profiles.username, username))
		.limit(1);

	return rows[0] ?? undefined;
};

export const get_profile_owner_by_username = async (
	username: string
): Promise<
	| {
			user_id: string;
			username: string;
	  }
	| undefined
> => {
	const db = get_db();
	const rows = await db
		.select({
			user_id: profiles.user_id,
			username: profiles.username
		})
		.from(profiles)
		.where(eq(profiles.username, username))
		.limit(1);

	return rows[0] ?? undefined;
};

export const get_profile_username_by_user_id = async (
	user_id: string
): Promise<string | undefined> => {
	const cache_key = `profile:username-by-user-id:${user_id}`;

	return get_or_set_short_ttl_cache(cache_key, PROFILE_USERNAME_CACHE_TTL_MS, async () => {
		const db = get_db();
		const rows = await db
			.select({ username: profiles.username })
			.from(profiles)
			.where(eq(profiles.user_id, user_id))
			.limit(1);

		const username = rows[0]?.username;

		if (username) {
			return username;
		}

		const auth_rows = await db
			.select({
				name: auth_user.name,
				email: auth_user.email
			})
			.from(auth_user)
			.where(eq(auth_user.id, user_id))
			.limit(1);

		const auth_row = auth_rows[0];

		if (!auth_row) {
			return;
		}

		return ensure_profile_for_user({
			user_id,
			name: auth_row.name || auth_row.email || user_id
		});
	});
};

type ProfilePageData = {
	profile: {
		user_id: string;
		account_email: string | null;
		name: string | null;
		email: string | null;
		image: string | null;
		cover_image: string | null;
		created_at: Date;
		username: string;
		bio: string | null;
		location: string | null;
		phone: string | null;
		email_visible: boolean;
	};
	stats: {
		post_count: number;
		followers_count: number;
		following_count: number;
	};
	relationship: {
		is_own_profile: boolean;
		is_following: boolean;
	};
	photo_posts: Array<{ id: string; image_url: string }>;
	photo_urls: string[];
	video_posts: Array<{ id: string; poster_url: string | undefined; video_url: string }>;
	shared_posts: PostFeedPost[];
};

const get_relationship = async (
	viewer_user_id: string | undefined,
	profile_user_id: string
): Promise<ProfilePageData['relationship']> => {
	const is_own_profile = viewer_user_id === profile_user_id;

	if (!viewer_user_id || is_own_profile) {
		return {
			is_own_profile,
			is_following: false
		};
	}

	const db = get_db();
	const follow_row = await db
		.select({ follower_id: follows.follower_id })
		.from(follows)
		.where(and(eq(follows.follower_id, viewer_user_id), eq(follows.following_id, profile_user_id)))
		.limit(1);

	return {
		is_own_profile,
		is_following: follow_row.length > 0
	};
};

const load_profile_page_data = async (
	username: string,
	viewer_user_id?: string
): Promise<ProfilePageData | undefined> => {
	const db = get_db();
	const profile = await get_profile_by_username(username);

	if (!profile) {
		return undefined;
	}

	const [counts, photo_rows, video_rows, relationship, shared_posts] = await Promise.all([
		Promise.all([
			db
				.select({ value: count() })
				.from(posts)
				.where(and(eq(posts.author_id, profile.user_id), isNull(posts.deleted_at))),
			db.select({ value: count() }).from(follows).where(eq(follows.following_id, profile.user_id)),
			db.select({ value: count() }).from(follows).where(eq(follows.follower_id, profile.user_id))
		]),
		db
			.select({ id: posts.id, url: media.url })
			.from(posts)
			.innerJoin(post_media, eq(post_media.post_id, posts.id))
			.innerJoin(media, eq(media.id, post_media.media_id))
			.where(
				and(eq(posts.author_id, profile.user_id), isNull(posts.deleted_at), eq(media.type, 'image'))
			)
			.orderBy(desc(posts.created_at), post_media.sort_order)
			.limit(30),
		db
			.select({ id: posts.id, url: media.url })
			.from(posts)
			.innerJoin(post_media, eq(post_media.post_id, posts.id))
			.innerJoin(media, eq(media.id, post_media.media_id))
			.where(
				and(eq(posts.author_id, profile.user_id), isNull(posts.deleted_at), eq(media.type, 'video'))
			)
			.orderBy(desc(posts.created_at), post_media.sort_order)
			.limit(30),
		get_relationship(viewer_user_id, profile.user_id),
		get_shared_posts_by_user_id(profile.user_id, viewer_user_id)
	]);

	const [post_count_row, followers_count_row, following_count_row] = counts;
	const photo_posts = photo_rows.map((row) => ({ id: row.id, image_url: row.url }));
	const photo_urls = photo_posts.map((row) => row.image_url);
	const video_posts = video_rows.map((row) => {
		const video_source = build_responsive_video_source(row.url);
		return { id: row.id, poster_url: video_source.poster, video_url: video_source.src };
	});
	const visible_email: string | null = profile.email_visible
		? profile.email
		: // eslint-disable-next-line unicorn/no-null
			null;

	return {
		profile: {
			...profile,
			account_email: relationship.is_own_profile
				? profile.email
				: // eslint-disable-next-line unicorn/no-null
					null,
			email: visible_email
		},
		stats: {
			post_count: post_count_row[0]?.value ?? 0,
			followers_count: followers_count_row[0]?.value ?? 0,
			following_count: following_count_row[0]?.value ?? 0
		},
		relationship,
		photo_posts,
		photo_urls,
		video_posts,
		shared_posts
	};
};

const get_shared_posts_by_user_id = async (
	shared_by_user_id: string,
	viewer_user_id?: string
): Promise<PostFeedPost[]> => {
	await initialize_hidden_posts_table();
	const db = get_db();
	const post_author_profiles = alias(profiles, 'post_author_profile');
	const rows = await db
		.select({
			id: posts.id,
			author_id: posts.author_id,
			content: posts.content,
			created_at: posts.created_at,
			updated_at: posts.updated_at,
			media_url: media.url,
			media_type: media.type,
			author_name: auth_user.name,
			author_username: post_author_profiles.username,
			author_avatar: auth_user.image,
			shared_at: post_shares.created_at
		})
		.from(post_shares)
		.innerJoin(posts, eq(post_shares.post_id, posts.id))
		.innerJoin(auth_user, eq(posts.author_id, auth_user.id))
		.leftJoin(post_author_profiles, eq(post_author_profiles.user_id, auth_user.id))
		.leftJoin(post_media, eq(posts.id, post_media.post_id))
		.leftJoin(media, eq(post_media.media_id, media.id))
		.leftJoin(
			hidden_posts,
			and(eq(hidden_posts.post_id, posts.id), eq(hidden_posts.user_id, shared_by_user_id))
		)
		.where(
			and(
				eq(post_shares.user_id, shared_by_user_id),
				isNull(posts.deleted_at),
				isNull(hidden_posts.post_id)
			)
		)
		.orderBy(desc(post_shares.created_at), desc(posts.created_at), post_media.sort_order)
		.limit(120);

	const seen = new Set<string>();
	const unique_posts = rows.filter((row) => {
		if (seen.has(row.id)) {
			return false;
		}

		seen.add(row.id);
		return true;
	});

	const post_ids = unique_posts.map((row) => row.id);

	const [like_count_rows, liked_rows, share_count_rows, shared_rows, comment_count_rows] =
		await Promise.all([
			post_ids.length === 0
				? Promise.resolve([])
				: db
						.select({
							post_id: likes.post_id,
							like_count: count()
						})
						.from(likes)
						.where(inArray(likes.post_id, post_ids))
						.groupBy(likes.post_id),
			post_ids.length === 0 || !viewer_user_id
				? Promise.resolve([])
				: db
						.select({ post_id: likes.post_id })
						.from(likes)
						.where(and(inArray(likes.post_id, post_ids), eq(likes.user_id, viewer_user_id))),
			post_ids.length === 0
				? Promise.resolve([])
				: db
						.select({
							post_id: post_shares.post_id,
							share_count: count()
						})
						.from(post_shares)
						.where(inArray(post_shares.post_id, post_ids))
						.groupBy(post_shares.post_id),
			post_ids.length === 0 || !viewer_user_id
				? Promise.resolve([])
				: db
						.select({ post_id: post_shares.post_id })
						.from(post_shares)
						.where(
							and(inArray(post_shares.post_id, post_ids), eq(post_shares.user_id, viewer_user_id))
						),
			post_ids.length === 0
				? Promise.resolve([])
				: db
						.select({ post_id: comments.post_id, comment_count: count() })
						.from(comments)
						.where(and(inArray(comments.post_id, post_ids), isNull(comments.deleted_at)))
						.groupBy(comments.post_id)
		]);

	const like_count_by_post = new Map<string, number>();
	for (const row of like_count_rows) {
		like_count_by_post.set(row.post_id, row.like_count);
	}

	const share_count_by_post = new Map<string, number>();
	for (const row of share_count_rows) {
		share_count_by_post.set(row.post_id, row.share_count);
	}

	const liked_post_ids = new Set(liked_rows.map((row) => row.post_id));
	const shared_post_ids = new Set(shared_rows.map((row) => row.post_id));
	const comment_count_by_post = new Map<string, number>();

	for (const row of comment_count_rows) {
		comment_count_by_post.set(row.post_id, row.comment_count);
	}

	return unique_posts.map((row) => {
		const responsive_video =
			row.media_type === 'video' && row.media_url
				? build_responsive_video_source(row.media_url)
				: undefined;

		return {
			id: row.id,
			author_id: row.author_id,
			content: row.content,
			created_at: row.created_at,
			updated_at: row.updated_at,
			like_count: like_count_by_post.get(row.id) ?? 0,
			has_liked: liked_post_ids.has(row.id),
			share_count: share_count_by_post.get(row.id) ?? 0,
			has_shared: shared_post_ids.has(row.id),
			author_name: row.author_name,
			author_username: row.author_username ?? 'user',
			author_avatar: row.author_avatar,
			media_display_srcset: undefined,
			media_display_url: responsive_video?.src,
			media_poster_url: responsive_video?.poster,
			media_url: row.media_url,
			media_type: row.media_type,
			comment_count: comment_count_by_post.get(row.id) ?? 0
		};
	});
};

export const get_profile_page_data = async (
	username: string,
	viewer_user_id?: string
): Promise<ProfilePageData | undefined> => {
	const viewer_key = viewer_user_id ?? 'anon';
	const cache_key = `profile:page:${username}:${viewer_key}`;

	return get_or_set_short_ttl_cache(cache_key, PROFILE_PAGE_CACHE_TTL_MS, async () =>
		load_profile_page_data(username, viewer_user_id)
	);
};

export const invalidate_profile_cache = (params: {
	profile_user_id?: string;
	username?: string;
}): void => {
	if (params.profile_user_id) {
		invalidate_short_ttl_cache_key(`profile:username-by-user-id:${params.profile_user_id}`);
	}

	if (params.username) {
		invalidate_short_ttl_cache_prefix(`profile:page:${params.username}:`);
	}
};

export const get_profile_posts_by_username = async (
	username: string,
	selected_post_id?: string,
	viewer_user_id?: string
): Promise<PostFeedPost[] | undefined> => {
	const profile = await get_profile_by_username(username);

	if (!profile) {
		return undefined;
	}

	const db = get_db();
	const rows = await db
		.select({
			id: posts.id,
			author_id: posts.author_id,
			content: posts.content,
			created_at: posts.created_at,
			updated_at: posts.updated_at,
			media_url: media.url,
			media_type: media.type
		})
		.from(posts)
		.leftJoin(post_media, eq(posts.id, post_media.post_id))
		.leftJoin(media, eq(post_media.media_id, media.id))
		.where(and(eq(posts.author_id, profile.user_id), isNull(posts.deleted_at)))
		.orderBy(desc(posts.created_at), post_media.sort_order)
		.limit(60);

	const seen = new Set<string>();
	const unique_posts = rows.filter((row) => {
		if (seen.has(row.id)) return false;
		seen.add(row.id);
		return true;
	});

	const post_ids = unique_posts.map((row) => row.id);

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

	const share_count_rows =
		post_ids.length === 0
			? []
			: await db
					.select({
						post_id: post_shares.post_id,
						share_count: count()
					})
					.from(post_shares)
					.where(inArray(post_shares.post_id, post_ids))
					.groupBy(post_shares.post_id);

	const shared_rows =
		post_ids.length === 0 || !viewer_user_id
			? []
			: await db
					.select({ post_id: post_shares.post_id })
					.from(post_shares)
					.where(
						and(inArray(post_shares.post_id, post_ids), eq(post_shares.user_id, viewer_user_id))
					);

	const like_count_by_post = new Map<string, number>();

	for (const row of like_count_rows) {
		like_count_by_post.set(row.post_id, row.like_count);
	}

	const liked_post_ids = new Set(liked_rows.map((row) => row.post_id));
	const share_count_by_post = new Map<string, number>();

	for (const row of share_count_rows) {
		share_count_by_post.set(row.post_id, row.share_count);
	}

	const shared_post_ids = new Set(shared_rows.map((row) => row.post_id));

	const comment_count_rows =
		post_ids.length === 0
			? []
			: await db
					.select({ post_id: comments.post_id, comment_count: count() })
					.from(comments)
					.where(and(inArray(comments.post_id, post_ids), isNull(comments.deleted_at)))
					.groupBy(comments.post_id);

	const comment_count_by_post = new Map<string, number>();
	for (const row of comment_count_rows) {
		comment_count_by_post.set(row.post_id, row.comment_count);
	}

	const mapped_posts: PostFeedPost[] = unique_posts.map((row) => {
		const responsive_video =
			row.media_type === 'video' && row.media_url
				? build_responsive_video_source(row.media_url)
				: undefined;

		return {
			id: row.id,
			author_id: row.author_id,
			content: row.content,
			created_at: row.created_at,
			updated_at: row.updated_at,
			like_count: like_count_by_post.get(row.id) ?? 0,
			has_liked: liked_post_ids.has(row.id),
			share_count: share_count_by_post.get(row.id) ?? 0,
			has_shared: shared_post_ids.has(row.id),
			author_name: profile.name ?? profile.username,
			author_username: profile.username,
			author_avatar: profile.image,
			media_display_srcset: undefined,
			media_display_url: responsive_video?.src,
			media_poster_url: responsive_video?.poster,
			media_url: row.media_url,
			media_type: row.media_type,
			comment_count: comment_count_by_post.get(row.id) ?? 0
		};
	});

	if (!selected_post_id) {
		return mapped_posts;
	}

	const selected_index = mapped_posts.findIndex((post) => post.id === selected_post_id);

	if (selected_index === -1) {
		return undefined;
	}

	const selected_post = mapped_posts[selected_index];

	if (!selected_post) {
		return undefined;
	}

	return [selected_post, ...mapped_posts.filter((post) => post.id !== selected_post_id)];
};

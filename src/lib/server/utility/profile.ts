import { and, count, desc, eq, isNull, ne } from 'drizzle-orm';
import { user as auth_user } from '$lib/server/db/auth.schema';
import { get_db } from '$lib/server/db';
import { follows, media, post_media, posts, profiles } from '$lib/server/db/schema';

const slugify_username = (value: string): string => {
	const out = value
		.toLowerCase()
		.replaceAll(/[^a-z0-9_]+/g, '_')
		.replaceAll(/^_+|_+$/g, '')
		.slice(0, 24);

	return out || 'user';
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

		if (existing.length === 0) {
			return candidate;
		}

		candidate = `${base}_${suffix++}`;
	}
};

export const ensure_profile_for_user = async (params: {
	user_id: string;
	name: string;
}): Promise<void> => {
	const db = get_db();

	const existing = await db
		.select({ user_id: profiles.user_id })
		.from(profiles)
		.where(eq(profiles.user_id, params.user_id))
		.limit(1);

	if (existing.length > 0) {
		return;
	}

	const username = await build_unique_username(params.name || params.user_id, params.user_id);

	await db.insert(profiles).values({
		user_id: params.user_id,
		username
	});
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
			phone: profiles.phone
		})
		.from(profiles)
		.innerJoin(auth_user, eq(auth_user.id, profiles.user_id))
		.where(eq(profiles.username, username))
		.limit(1);

	return rows[0] ?? undefined;
};

export const get_profile_username_by_user_id = async (
	user_id: string
): Promise<string | undefined> => {
	const db = get_db();

	const rows = await db
		.select({ username: profiles.username })
		.from(profiles)
		.where(eq(profiles.user_id, user_id))
		.limit(1);

	return rows[0]?.username;
};

type ProfilePageData = {
	profile: {
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
	photo_urls: string[];
};

const get_relationship = async (
	viewer_user_id: string | undefined,
	profile_user_id: string
): Promise<ProfilePageData['relationship']> => {
	// eslint-disable-next-line @typescript-eslint/naming-convention
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

export const get_profile_page_data = async (
	username: string,
	viewer_user_id?: string
): Promise<ProfilePageData | undefined> => {
	const db = get_db();
	const profile = await get_profile_by_username(username);

	if (!profile) {
		return undefined;
	}

	const [post_count_row, followers_count_row, following_count_row] = await Promise.all([
		db
			.select({ value: count() })
			.from(posts)
			.where(and(eq(posts.author_id, profile.user_id), isNull(posts.deleted_at))),
		db.select({ value: count() }).from(follows).where(eq(follows.following_id, profile.user_id)),
		db.select({ value: count() }).from(follows).where(eq(follows.follower_id, profile.user_id))
	]);

	const photo_rows = await db
		.select({ url: media.url })
		.from(posts)
		.innerJoin(post_media, eq(post_media.post_id, posts.id))
		.innerJoin(media, eq(media.id, post_media.media_id))
		.where(
			and(eq(posts.author_id, profile.user_id), isNull(posts.deleted_at), eq(media.type, 'image'))
		)
		.orderBy(desc(posts.created_at), post_media.sort_order)
		.limit(30);

	const photo_urls = photo_rows.map((row) => row.url);

	const relationship = await get_relationship(viewer_user_id, profile.user_id);

	return {
		profile,
		stats: {
			post_count: post_count_row[0]?.value ?? 0,
			followers_count: followers_count_row[0]?.value ?? 0,
			following_count: following_count_row[0]?.value ?? 0
		},
		relationship,
		photo_urls
	};
};

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_profile_page_data } from '$lib/server/utility/profile';
import { get_db } from '$lib/server/db';
import { follows, media, post_media, posts, profiles } from '$lib/server/db/schema';
import { user as auth_user } from '$lib/server/db/auth.schema';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { upload_image_from_file } from '$lib/server/cloudinary';

export const load = (async ({ params, locals }) => {
	const profile_data = await get_profile_page_data(params.username, locals.user?.id);

	if (!profile_data) {
		throw error(404, 'Profile not found');
	}

	return profile_data;
}) satisfies PageServerLoad;

export const actions = {
	update_cover_image: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_data = await get_profile_page_data(params.username, locals.user.id);

		if (!profile_data) {
			throw error(404, 'Profile not found');
		}

		if (!profile_data.relationship.is_own_profile) {
			return fail(403, { message: 'You can only update your own cover photo.' });
		}

		const form_data = await request.formData();
		const cover_file = form_data.get('cover');

		if (!(cover_file instanceof File) || cover_file.size === 0) {
			return fail(400, { message: 'Please choose a cover photo.' });
		}

		if (!cover_file.type.startsWith('image/')) {
			return fail(400, { message: 'Only image files are allowed for cover photos.' });
		}

		if (cover_file.size > 10 * 1024 * 1024) {
			return fail(400, { message: 'Cover photo must be 10MB or smaller.' });
		}

		let uploaded: { secureUrl: string; publicId: string };

		try {
			uploaded = await upload_image_from_file(cover_file, {
				folder: `covers/${locals.user.id}`,
				publicId: `${locals.user.id}_cover`
			});
		} catch {
			return fail(500, { message: 'Cover upload failed. Please try again.' });
		}

		const db = get_db();

		await db
			.update(profiles)
			.set({ cover_image: uploaded.secureUrl })
			.where(eq(profiles.user_id, locals.user.id));

		throw redirect(303, `/profile/${params.username}`);
	},

	update_profile_image: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_data = await get_profile_page_data(params.username, locals.user.id);

		if (!profile_data) {
			throw error(404, 'Profile not found');
		}

		if (!profile_data.relationship.is_own_profile) {
			return fail(403, { message: 'You can only update your own profile photo.' });
		}

		const form_data = await request.formData();
		const avatar_file = form_data.get('avatar');

		if (!(avatar_file instanceof File) || avatar_file.size === 0) {
			return fail(400, { message: 'Please choose a profile photo.' });
		}

		if (!avatar_file.type.startsWith('image/')) {
			return fail(400, { message: 'Only image files are allowed for profile photos.' });
		}

		if (avatar_file.size > 5 * 1024 * 1024) {
			return fail(400, { message: 'Profile photo must be 5MB or smaller.' });
		}

		let uploaded: { secureUrl: string; publicId: string };

		try {
			uploaded = await upload_image_from_file(avatar_file, {
				folder: `avatars/${locals.user.id}`,
				publicId: `${locals.user.id}_profile`
			});
		} catch {
			return fail(500, { message: 'Profile upload failed. Please try again.' });
		}

		const db = get_db();

		await db
			.update(auth_user)
			.set({ image: uploaded.secureUrl })
			.where(eq(auth_user.id, locals.user.id));

		throw redirect(303, `/profile/${params.username}`);
	},

	create_post: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_data = await get_profile_page_data(params.username, locals.user.id);

		if (!profile_data) {
			throw error(404, 'Profile not found');
		}

		if (!profile_data.relationship.is_own_profile) {
			return fail(403, { message: 'You can only create posts on your own profile.' });
		}

		const form_data = await request.formData();
		const image_file = form_data.get('image');
		const caption_raw = form_data.get('caption');

		if (!(image_file instanceof File) || image_file.size === 0) {
			return fail(400, { message: 'Please choose a photo to upload.' });
		}

		if (!image_file.type.startsWith('image/')) {
			return fail(400, { message: 'Only image files are allowed.' });
		}

		if (image_file.size > 10 * 1024 * 1024) {
			return fail(400, { message: 'Photo must be 10MB or smaller.' });
		}

		const caption = typeof caption_raw === 'string' ? caption_raw.trim() : '';

		if (caption.length > 1000) {
			return fail(400, { message: 'Caption must be 1000 characters or less.' });
		}

		let uploaded: { secureUrl: string; publicId: string };

		try {
			uploaded = await upload_image_from_file(image_file, {
				folder: `posts/${locals.user.id}`
			});
		} catch {
			return fail(500, { message: 'Upload failed. Please try again.' });
		}

		const db = get_db();
		const post_id = randomUUID();
		const media_id = randomUUID();
		// eslint-disable-next-line @typescript-eslint/naming-convention
		let post_created = false;
		// eslint-disable-next-line @typescript-eslint/naming-convention
		let media_created = false;

		try {
			await db.insert(posts).values({
				id: post_id,
				author_id: locals.user.id,
				content: caption || ''
			});
			post_created = true;

			await db.insert(media).values({
				id: media_id,
				owner_id: locals.user.id,
				url: uploaded.secureUrl,
				type: 'image'
			});
			media_created = true;

			await db.insert(post_media).values({
				post_id,
				media_id,
				sort_order: 0
			});
		} catch {
			if (media_created) {
				await db.delete(media).where(eq(media.id, media_id));
			}

			if (post_created) {
				await db.delete(posts).where(eq(posts.id, post_id));
			}

			return fail(500, { message: 'Failed to save post. Please try again.' });
		}

		throw redirect(303, `/profile/${params.username}`);
	},
	follow: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_data = await get_profile_page_data(params.username, locals.user.id);

		if (!profile_data) {
			throw error(404, 'Profile not found');
		}

		if (profile_data.relationship.is_own_profile) {
			return fail(400, { message: 'You cannot follow your own profile.' });
		}

		const db = get_db();
		await db
			.insert(follows)
			.values({
				follower_id: locals.user.id,
				following_id: profile_data.profile.user_id
			})
			.onConflictDoNothing();

		return { success: true };
	},
	unfollow: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_data = await get_profile_page_data(params.username, locals.user.id);

		if (!profile_data) {
			throw error(404, 'Profile not found');
		}

		const db = get_db();
		await db
			.delete(follows)
			.where(
				and(
					eq(follows.follower_id, locals.user.id),
					eq(follows.following_id, profile_data.profile.user_id)
				)
			);

		return { success: true };
	}
} satisfies Actions;

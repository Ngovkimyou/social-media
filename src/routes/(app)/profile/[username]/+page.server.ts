import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	get_profile_owner_by_username,
	get_profile_page_data,
	get_profile_username_by_user_id,
	invalidate_profile_cache
} from '$lib/server/utilities/profile';
import { get_db } from '$lib/server/db';
import { follows, media, post_media, posts, profiles } from '$lib/server/db/schema';
import { user as auth_user } from '$lib/server/db/auth.schema';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { delete_image_by_public_id, upload_image_from_file } from '$lib/server/cloudinary';
import { validate_uploaded_image } from '$lib/server/image-validation';

const rollback_failed_post_creation = async (params: {
	db: ReturnType<typeof get_db>;
	media_id: string;
	post_id: string;
	ismedia_created: boolean;
	ispost_created: boolean;
	uploaded_public_id: string;
}): Promise<void> => {
	const { db, media_id, post_id, ismedia_created, ispost_created, uploaded_public_id } = params;

	if (ismedia_created) {
		await db.delete(media).where(eq(media.id, media_id));
	}

	if (ispost_created) {
		await db.delete(posts).where(eq(posts.id, post_id));
	}

	try {
		await delete_image_by_public_id(uploaded_public_id);
	} catch {
		console.error('Failed to clean up Cloudinary image after post creation failure');
	}
};

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

		const profile_owner = await get_profile_owner_by_username(params.username);

		if (!profile_owner) {
			throw error(404, 'Profile not found');
		}

		if (profile_owner.user_id !== locals.user.id) {
			return fail(403, { message: 'You can only update your own cover photo.' });
		}

		const form_data = await request.formData();
		const cover_file = form_data.get('cover');

		if (!(cover_file instanceof File) || cover_file.size === 0) {
			return fail(400, { message: 'Please choose a cover photo.' });
		}

		const cover_validation = await validate_uploaded_image({
			file: cover_file,
			max_bytes: 10 * 1024 * 1024,
			size_message: 'Cover photo must be 10MB or smaller.',
			type_message: 'Only JPG, PNG, GIF, WebP, and AVIF images are allowed for cover photos.'
		});
		if (!cover_validation.is_valid) {
			return fail(400, { message: cover_validation.message });
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

		invalidate_profile_cache({
			profile_user_id: locals.user.id,
			username: params.username
		});

		throw redirect(303, `/profile/${params.username}`);
	},

	update_profile_image: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_owner = await get_profile_owner_by_username(params.username);

		if (!profile_owner) {
			throw error(404, 'Profile not found');
		}

		if (profile_owner.user_id !== locals.user.id) {
			return fail(403, { message: 'You can only update your own profile photo.' });
		}

		const form_data = await request.formData();
		const avatar_file = form_data.get('avatar');

		if (!(avatar_file instanceof File) || avatar_file.size === 0) {
			return fail(400, { message: 'Please choose a profile photo.' });
		}

		const avatar_validation = await validate_uploaded_image({
			file: avatar_file,
			max_bytes: 5 * 1024 * 1024,
			size_message: 'Profile photo must be 5MB or smaller.',
			type_message: 'Only JPG, PNG, GIF, WebP, and AVIF images are allowed for profile photos.'
		});
		if (!avatar_validation.is_valid) {
			return fail(400, { message: avatar_validation.message });
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

		invalidate_profile_cache({
			profile_user_id: locals.user.id,
			username: params.username
		});

		throw redirect(303, `/profile/${params.username}`);
	},

	create_post: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_owner = await get_profile_owner_by_username(params.username);

		if (!profile_owner) {
			throw error(404, 'Profile not found');
		}

		if (profile_owner.user_id !== locals.user.id) {
			return fail(403, { message: 'You can only create posts on your own profile.' });
		}

		const form_data = await request.formData();
		const image_file = form_data.get('image');
		const caption_raw = form_data.get('caption');

		if (!(image_file instanceof File) || image_file.size === 0) {
			return fail(400, { message: 'Please choose a photo to upload.' });
		}

		const post_image_validation = await validate_uploaded_image({
			file: image_file,
			max_bytes: 10 * 1024 * 1024,
			size_message: 'Photo must be 10MB or smaller.',
			type_message: 'Only JPG, PNG, GIF, WebP, and AVIF images are allowed.'
		});
		if (!post_image_validation.is_valid) {
			return fail(400, { message: post_image_validation.message });
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
		let ispost_created = false;
		let ismedia_created = false;

		try {
			await db.insert(posts).values({
				id: post_id,
				author_id: locals.user.id,
				content: caption || ''
			});
			ispost_created = true;

			await db.insert(media).values({
				id: media_id,
				owner_id: locals.user.id,
				url: uploaded.secureUrl,
				type: 'image'
			});
			ismedia_created = true;

			await db.insert(post_media).values({
				post_id,
				media_id,
				sort_order: 0
			});
		} catch {
			await rollback_failed_post_creation({
				db,
				media_id,
				post_id,
				ismedia_created,
				ispost_created,
				uploaded_public_id: uploaded.publicId
			});

			return fail(500, { message: 'Failed to save post. Please try again.' });
		}

		invalidate_profile_cache({
			profile_user_id: locals.user.id,
			username: params.username
		});

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

		invalidate_profile_cache({ username: params.username });

		const viewer_username = await get_profile_username_by_user_id(locals.user.id);

		if (viewer_username) {
			invalidate_profile_cache({
				profile_user_id: locals.user.id,
				username: viewer_username
			});
		}

		throw redirect(303, `/profile/${params.username}`);
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

		invalidate_profile_cache({ username: params.username });

		const viewer_username = await get_profile_username_by_user_id(locals.user.id);

		if (viewer_username) {
			invalidate_profile_cache({
				profile_user_id: locals.user.id,
				username: viewer_username
			});
		}

		throw redirect(303, `/profile/${params.username}`);
	}
} satisfies Actions;

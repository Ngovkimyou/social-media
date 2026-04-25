import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
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
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { delete_image_by_public_id, upload_image_from_file } from '$lib/server/cloudinary';
import { validate_uploaded_image } from '$lib/server/image-validation';
import { is_reserved_profile_username, slugify_username } from '$lib/utilities/profile';
import {
	format_profile_phone,
	is_profile_phone_country,
	localize_profile_validation_message,
	name_validator,
	profile_bio_validator,
	profile_location_validator,
	type ProfilePhoneCountry,
	profile_phone_validator
} from '$lib/utilities/validator';
import { consume_create_post_rate_limit } from '$lib/server/utilities/post-rate-limit';
import {
	consume_follow_target_cooldown,
	consume_social_action_rate_limit
} from '$lib/server/utilities/social-action-rate-limit';
import {
	record_post_image_fingerprint,
	reject_recent_duplicate_image
} from '$lib/server/utilities/post-abuse-detection';
import { record_security_event } from '$lib/server/utilities/security-monitor';

const DUPLICATE_CAPTION_WINDOW_MINUTES = 10;

const normalize_caption_for_abuse_check = (value: string): string =>
	value.normalize('NFKC').trim().replaceAll(/\s+/g, ' ').toLowerCase();

const has_recent_duplicate_caption = async (
	author_id: string,
	caption: string
): Promise<boolean> => {
	if (!caption) {
		return false;
	}

	const normalized_caption = normalize_caption_for_abuse_check(caption);
	const db = get_db();
	const recent_posts = await db
		.select({ content: posts.content })
		.from(posts)
		.where(
			and(
				eq(posts.author_id, author_id),
				isNull(posts.deleted_at),
				sql`${posts.created_at} >= now() - (${DUPLICATE_CAPTION_WINDOW_MINUTES} * interval '1 minute')`
			)
		)
		.orderBy(desc(posts.created_at))
		.limit(20);

	return recent_posts.some(
		(post) => normalize_caption_for_abuse_check(post.content) === normalized_caption
	);
};

const get_retry_message = (seconds: number, noun: string): string =>
	`Too many ${noun}. Please try again in ${seconds} seconds.`;

const get_missing_post_image_message = (caption: string): string =>
	caption
		? 'Add a photo before posting. Captions need an image.'
		: 'Please choose a photo to upload.';

const get_form_string = (form_data: FormData, key: string): string => {
	const value = form_data.get(key);
	return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
};

const normalize_optional_profile_text = (value: string, max_length: number): string | null => {
	const normalized = value.replaceAll(/\s+/g, ' ').trim();
	// eslint-disable-next-line unicorn/no-null
	return normalized ? normalized.slice(0, max_length) : null;
};

const is_valid_profile_email = (value: string): boolean =>
	!value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

type ProfileDetailsForm = {
	bio: string;
	email: string;
	email_visible: boolean;
	location: string;
	name: string;
	phone: string;
	phone_country: ProfilePhoneCountry;
	raw_username: string;
	username: string;
};

const get_profile_details_form = (form_data: FormData): ProfileDetailsForm => {
	const raw_username = get_form_string(form_data, 'username').replace(/^@+/, '');
	const raw_phone_country = get_form_string(form_data, 'phone_country').toUpperCase();
	const phone_country = is_profile_phone_country(raw_phone_country) ? raw_phone_country : 'US';
	const raw_phone = get_form_string(form_data, 'phone');

	return {
		bio: get_form_string(form_data, 'bio'),
		email: get_form_string(form_data, 'email').toLowerCase(),
		email_visible: form_data.get('email_visible') === 'on',
		location: get_form_string(form_data, 'location'),
		name: get_form_string(form_data, 'name'),
		phone: raw_phone ? format_profile_phone(raw_phone, phone_country) : '',
		phone_country,
		raw_username,
		username: slugify_username(raw_username)
	};
};

const get_validation_locale = (request: Request): string =>
	request.headers.get('accept-language')?.split(',')[0]?.trim() ?? '';

const get_profile_name_validation_message = (
	value: string,
	label: string,
	locale: string
): string | undefined => {
	const result = name_validator(value);
	if (result.is_Valid) {
		return;
	}

	return localize_profile_validation_message(
		(result.message ?? `Invalid ${label}`).replace('Name', label),
		locale
	);
};

const validate_profile_details_form = (
	form: ProfileDetailsForm,
	locale: string
): ReturnType<typeof fail> | undefined => {
	const nickname_message = get_profile_name_validation_message(form.name, 'Nickname', locale);
	if (nickname_message) {
		return fail(400, { message: nickname_message });
	}

	const username_message = get_profile_name_validation_message(
		form.raw_username,
		'Username',
		locale
	);
	if (username_message || is_reserved_profile_username(form.username)) {
		return fail(400, {
			message:
				username_message ??
				localize_profile_validation_message('Please choose a different @username.', locale)
		});
	}

	if (form.email && (!is_valid_profile_email(form.email) || form.email.length > 254)) {
		return fail(400, { message: 'Please enter a valid email address.' });
	}

	const bio_result = profile_bio_validator(form.bio);
	if (!bio_result.is_Valid) {
		return fail(400, {
			message: localize_profile_validation_message(
				bio_result.message ?? 'Bio must be 200 characters or less.',
				locale
			)
		});
	}

	const location_result = profile_location_validator(form.location);
	if (!location_result.is_Valid) {
		return fail(400, {
			message: localize_profile_validation_message(
				location_result.message ?? 'Please enter a valid address.',
				locale
			)
		});
	}

	const phone_result = profile_phone_validator(form.phone);
	if (!phone_result.is_Valid) {
		return fail(400, {
			message: localize_profile_validation_message(
				phone_result.message ?? 'Please enter a valid phone number.',
				locale
			)
		});
	}

	return undefined;
};

const validate_unique_profile_details = async (params: {
	db: ReturnType<typeof get_db>;
	user_id: string;
	username: string;
}): Promise<ReturnType<typeof fail> | undefined> => {
	const existing_username = await params.db
		.select({ user_id: profiles.user_id })
		.from(profiles)
		.where(and(eq(profiles.username, params.username), ne(profiles.user_id, params.user_id)))
		.limit(1);

	if (existing_username.length > 0) {
		return fail(400, { message: 'That @username is already taken.' });
	}

	return undefined;
};

const get_account_email = async (
	db: ReturnType<typeof get_db>,
	user_id: string
): Promise<string> => {
	const rows = await db
		.select({ email: auth_user.email })
		.from(auth_user)
		.where(eq(auth_user.id, user_id))
		.limit(1);
	return rows[0]?.email ?? '';
};

const fail_rate_limited_action = async (params: {
	category: 'rate_limit_follow' | 'rate_limit_post';
	details: string;
	event: RequestEvent;
	message: string;
}): Promise<ReturnType<typeof fail>> => {
	await record_security_event({
		category: params.category,
		details: params.details,
		event: params.event
	});

	return fail(429, { message: params.message });
};

const validate_follow_action = async (params: {
	event: RequestEvent;
	target_user_id: string;
}): Promise<ReturnType<typeof fail> | undefined> => {
	const { event, target_user_id } = params;
	const follow_rate_limit = await consume_social_action_rate_limit(event, 'follow-action');
	if (!follow_rate_limit.is_allowed) {
		return fail_rate_limited_action({
			category: 'rate_limit_follow',
			details: `retry_after=${follow_rate_limit.retry_after_seconds}`,
			event,
			message: get_retry_message(follow_rate_limit.retry_after_seconds, 'follow actions')
		});
	}

	const follow_target_cooldown = await consume_follow_target_cooldown(event, target_user_id);
	if (!follow_target_cooldown.is_allowed) {
		return fail_rate_limited_action({
			category: 'rate_limit_follow',
			details: `target_cooldown=${target_user_id}`,
			event,
			message: `Please wait ${follow_target_cooldown.retry_after_seconds} seconds before changing this follow again.`
		});
	}

	return undefined;
};

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
	update_profile_details: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_owner = await get_profile_owner_by_username(params.username);

		if (!profile_owner) {
			throw error(404, 'Profile not found');
		}

		if (profile_owner.user_id !== locals.user.id) {
			return fail(403, { message: 'You can only update your own profile.' });
		}

		const profile_form = get_profile_details_form(await request.formData());
		const profile_form_failure = validate_profile_details_form(
			profile_form,
			get_validation_locale(request)
		);
		if (profile_form_failure) {
			return profile_form_failure;
		}

		const normalized_location = normalize_optional_profile_text(profile_form.location, 80);
		const normalized_phone = normalize_optional_profile_text(profile_form.phone, 32);

		const db = get_db();
		const account_email = await get_account_email(db, locals.user.id);
		if (profile_form.email && profile_form.email !== account_email.toLowerCase()) {
			return fail(400, { message: 'Email cannot be edited from profile About.' });
		}

		const unique_details_failure = await validate_unique_profile_details({
			db,
			user_id: locals.user.id,
			username: profile_form.username
		});
		if (unique_details_failure) {
			return unique_details_failure;
		}

		try {
			await db
				.update(auth_user)
				.set({ name: profile_form.name.slice(0, 80) })
				.where(eq(auth_user.id, locals.user.id));

			await db
				.update(profiles)
				.set({
					// eslint-disable-next-line unicorn/no-null
					bio: profile_form.bio || null,
					location: normalized_location,
					phone: normalized_phone,
					email_visible: profile_form.email ? profile_form.email_visible : false,
					username: profile_form.username
				})
				.where(eq(profiles.user_id, locals.user.id));
		} catch {
			return fail(500, { message: 'Profile update failed. Please check your details.' });
		}

		invalidate_profile_cache({
			profile_user_id: locals.user.id,
			username: params.username
		});

		invalidate_profile_cache({
			profile_user_id: locals.user.id,
			username: profile_form.username
		});

		throw redirect(303, `/profile/${profile_form.username}`);
	},

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

	create_post: async (event) => {
		const { locals, params, request } = event;

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

		const post_rate_limit = await consume_create_post_rate_limit(event);
		if (!post_rate_limit.is_allowed) {
			return fail_rate_limited_action({
				category: 'rate_limit_post',
				details: `retry_after=${post_rate_limit.retry_after_seconds}`,
				event,
				message: `Too many posts created too quickly. Please try again in ${post_rate_limit.retry_after_seconds} seconds.`
			});
		}

		const form_data = await request.formData();
		const image_file = form_data.get('image');
		const caption_raw = form_data.get('caption');
		const caption = typeof caption_raw === 'string' ? caption_raw.trim() : '';

		if (!(image_file instanceof File) || image_file.size === 0) {
			return fail(400, { message: get_missing_post_image_message(caption) });
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

		if (caption.length > 1000) {
			return fail(400, { message: 'Caption must be 1000 characters or less.' });
		}

		if (await has_recent_duplicate_caption(locals.user.id, caption)) {
			await record_security_event({
				category: 'duplicate_caption',
				details: 'recent-caption-match',
				event
			});
			return fail(400, {
				message: 'You already used that caption recently. Please change it before posting again.'
			});
		}

		const image_duplicate_check = await reject_recent_duplicate_image({
			author_id: locals.user.id,
			event,
			file: image_file
		});
		if ('error_message' in image_duplicate_check) {
			return fail(400, { message: image_duplicate_check.error_message });
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
		await record_post_image_fingerprint(locals.user.id, image_duplicate_check.image_hash);

		throw redirect(303, `/profile/${params.username}`);
	},
	follow: async (event) => {
		const { locals, params } = event;

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

		const follow_action_failure = await validate_follow_action({
			event,
			target_user_id: profile_data.profile.user_id
		});
		if (follow_action_failure) {
			return follow_action_failure;
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
	unfollow: async (event) => {
		const { locals, params } = event;

		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_data = await get_profile_page_data(params.username, locals.user.id);

		if (!profile_data) {
			throw error(404, 'Profile not found');
		}

		const follow_action_failure = await validate_follow_action({
			event,
			target_user_id: profile_data.profile.user_id
		});
		if (follow_action_failure) {
			return follow_action_failure;
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

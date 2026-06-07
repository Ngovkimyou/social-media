import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { create_signed_image_upload } from '$lib/server/cloudinary';
import { get_profile_owner_by_username } from '$lib/server/utilities/profile';

const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

type ImageSignaturePayload = {
	file_size?: unknown;
	file_type?: unknown;
	profile_username?: unknown;
};

const as_number = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const as_string = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const validate_payload = (payload: ImageSignaturePayload): string | undefined => {
	const file_size = as_number(payload.file_size);
	const file_type = as_string(payload.file_type);

	if (!file_size || file_size <= 0 || file_size > MAX_POST_IMAGE_BYTES) {
		return 'Photo must be 10MB or smaller.';
	}

	if (!ALLOWED_IMAGE_MIME_TYPES.has(file_type)) {
		return 'Only JPG, PNG, WebP, and AVIF photos are allowed.';
	}

	return undefined;
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const payload = (await request.json()) as ImageSignaturePayload;
	const profile_username = as_string(payload.profile_username);
	const profile_owner = profile_username
		? await get_profile_owner_by_username(profile_username)
		: undefined;

	if (!profile_owner) {
		return json({ message: 'Profile not found.' }, { status: 404 });
	}

	if (profile_owner.user_id !== locals.user.id) {
		return json({ message: 'You can only create posts on your own profile.' }, { status: 403 });
	}

	const validation_message = validate_payload(payload);
	if (validation_message) {
		return json({ message: validation_message }, { status: 400 });
	}

	return json(
		create_signed_image_upload({
			folder: `posts/${locals.user.id}`
		})
	);
};

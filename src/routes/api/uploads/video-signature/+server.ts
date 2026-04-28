import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { create_signed_video_upload } from '$lib/server/cloudinary';
import { get_profile_owner_by_username } from '$lib/server/utilities/profile';

const MAX_POST_VIDEO_SOURCE_BYTES = 99 * 1024 * 1024;
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
type VideoSignaturePayload = {
	file_size?: unknown;
	file_type?: unknown;
	profile_username?: unknown;
	trim_end_seconds?: unknown;
	trim_start_seconds?: unknown;
	video_duration_seconds?: unknown;
};

const as_number = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const as_string = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const validate_payload = (payload: VideoSignaturePayload): string | undefined => {
	const file_size = as_number(payload.file_size);
	const file_type = as_string(payload.file_type);
	const trim_start_seconds = as_number(payload.trim_start_seconds);
	const trim_end_seconds = as_number(payload.trim_end_seconds);
	const video_duration_seconds = as_number(payload.video_duration_seconds);

	if (!file_size || file_size <= 0 || file_size > MAX_POST_VIDEO_SOURCE_BYTES) {
		return 'Video source must be 100MB or smaller. Trim or compress the video before uploading.';
	}

	if (!ALLOWED_VIDEO_MIME_TYPES.has(file_type)) {
		return 'Only MP4, MOV, and WebM videos are allowed.';
	}

	if (
		trim_start_seconds === undefined ||
		trim_start_seconds < 0 ||
		trim_end_seconds === undefined ||
		trim_end_seconds <= trim_start_seconds ||
		video_duration_seconds === undefined ||
		video_duration_seconds <= 0 ||
		trim_end_seconds > video_duration_seconds + 0.25
	) {
		return 'Choose a valid video trim range before posting.';
	}

	return undefined;
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const payload = (await request.json()) as VideoSignaturePayload;
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

	const signed_upload = create_signed_video_upload({
		folder: `posts/${locals.user.id}`
	});

	return json(signed_upload);
};

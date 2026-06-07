import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { create_signed_video_upload } from '$lib/server/cloudinary';
import {
	as_number,
	as_string,
	read_owned_upload_signature_payload,
	type UploadSignaturePayloadBase
} from '$lib/server/utilities/upload-signature-request';

const MAX_POST_VIDEO_SOURCE_BYTES = 99 * 1024 * 1024;
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
type VideoSignaturePayload = UploadSignaturePayloadBase & {
	file_size?: unknown;
	file_type?: unknown;
	trim_end_seconds?: unknown;
	trim_start_seconds?: unknown;
	video_duration_seconds?: unknown;
};

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

export const POST: RequestHandler = async (event) => {
	const upload_request = await read_owned_upload_signature_payload<VideoSignaturePayload>(event);

	if (upload_request instanceof Response) {
		return upload_request;
	}

	const { payload, user_id } = upload_request;
	const validation_message = validate_payload(payload);
	if (validation_message) {
		return json({ message: validation_message }, { status: 400 });
	}

	const signed_upload = create_signed_video_upload({
		folder: `posts/${user_id}`
	});

	return json(signed_upload);
};

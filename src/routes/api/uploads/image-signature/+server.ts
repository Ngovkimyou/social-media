import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { create_signed_image_upload } from '$lib/server/cloudinary';
import {
	as_number,
	as_string,
	read_owned_upload_signature_payload,
	type UploadSignaturePayloadBase
} from '$lib/server/utilities/upload-signature-request';

const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

type ImageSignaturePayload = UploadSignaturePayloadBase & {
	file_size?: unknown;
	file_type?: unknown;
};

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

export const POST: RequestHandler = async (event) => {
	const upload_request = await read_owned_upload_signature_payload<ImageSignaturePayload>(event);

	if (upload_request instanceof Response) {
		return upload_request;
	}

	const { payload, user_id } = upload_request;
	const validation_message = validate_payload(payload);
	if (validation_message) {
		return json({ message: validation_message }, { status: 400 });
	}

	return json(
		create_signed_image_upload({
			folder: `posts/${user_id}`
		})
	);
};

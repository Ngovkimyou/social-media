const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const GIF87A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] as const;
const GIF89A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] as const;
const WEBP_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_FORMAT_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const;
const AVIF_FTYP_SIGNATURE = [0x66, 0x74, 0x79, 0x70] as const;
const AVIF_BRANDS = new Set(['avif', 'avis', 'mif1', 'msf1']);

export const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'] as const;

type AllowedImageFormat = (typeof ALLOWED_IMAGE_FORMATS)[number];

type ValidationFailure = {
	is_valid: false;
	message: string;
};

type ValidationSuccess = {
	detected_format: AllowedImageFormat;
	is_valid: true;
};

export type ImageValidationResult = ValidationFailure | ValidationSuccess;

const has_signature = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
	signature.every((value, index) => bytes[offset + index] === value);

const detect_image_format = (bytes: Uint8Array): AllowedImageFormat | undefined => {
	if (bytes.length >= JPEG_SIGNATURE.length && has_signature(bytes, JPEG_SIGNATURE)) {
		return 'jpg';
	}

	if (bytes.length >= PNG_SIGNATURE.length && has_signature(bytes, PNG_SIGNATURE)) {
		return 'png';
	}

	if (
		(bytes.length >= GIF87A_SIGNATURE.length && has_signature(bytes, GIF87A_SIGNATURE)) ||
		(bytes.length >= GIF89A_SIGNATURE.length && has_signature(bytes, GIF89A_SIGNATURE))
	) {
		return 'gif';
	}

	if (
		bytes.length >= 12 &&
		has_signature(bytes, WEBP_RIFF_SIGNATURE) &&
		has_signature(bytes, WEBP_FORMAT_SIGNATURE, 8)
	) {
		return 'webp';
	}

	if (bytes.length >= 12 && has_signature(bytes, AVIF_FTYP_SIGNATURE, 4)) {
		const major_brand = new TextDecoder('ascii').decode(bytes.slice(8, 12));

		if (AVIF_BRANDS.has(major_brand)) {
			return 'avif';
		}
	}

	return undefined;
};

export const validate_uploaded_image = async (params: {
	file: File;
	max_bytes: number;
	size_message: string;
	type_message: string;
}): Promise<ImageValidationResult> => {
	const { file, max_bytes, size_message, type_message } = params;

	if (file.size > max_bytes) {
		return { is_valid: false, message: size_message };
	}

	if (!file.type.startsWith('image/')) {
		return { is_valid: false, message: type_message };
	}

	const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
	const detected_format = detect_image_format(bytes);

	if (!detected_format) {
		return { is_valid: false, message: type_message };
	}

	return {
		detected_format,
		is_valid: true
	};
};

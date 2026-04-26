const MP4_FTYP_SIGNATURE = [0x66, 0x74, 0x79, 0x70] as const;
const WEBM_EBML_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3] as const;
const QUICKTIME_FTYP_BRANDS = new Set(['qt  ']);
const MP4_BRANDS = new Set([
	'avc1',
	'dash',
	'f4v ',
	'hev1',
	'isom',
	'iso2',
	'iso3',
	'iso4',
	'iso5',
	'iso6',
	'mp41',
	'mp42',
	'mp4 ',
	'm4v ',
	'msnv'
]);

export const ALLOWED_VIDEO_FORMATS = ['mp4', 'mov', 'webm'] as const;
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

type AllowedVideoFormat = (typeof ALLOWED_VIDEO_FORMATS)[number];

type ValidationFailure = {
	is_valid: false;
	message: string;
};

type ValidationSuccess = {
	detected_format: AllowedVideoFormat;
	is_valid: true;
};

export type VideoValidationResult = ValidationFailure | ValidationSuccess;

const has_signature = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
	signature.every((value, index) => bytes[offset + index] === value);

const detect_video_format = (bytes: Uint8Array): AllowedVideoFormat | undefined => {
	if (bytes.length >= WEBM_EBML_SIGNATURE.length && has_signature(bytes, WEBM_EBML_SIGNATURE)) {
		return 'webm';
	}

	if (bytes.length >= 12 && has_signature(bytes, MP4_FTYP_SIGNATURE, 4)) {
		const major_brand = new TextDecoder('ascii').decode(bytes.slice(8, 12));

		if (QUICKTIME_FTYP_BRANDS.has(major_brand)) {
			return 'mov';
		}

		if (MP4_BRANDS.has(major_brand)) {
			return 'mp4';
		}
	}

	return undefined;
};

export const validate_uploaded_video = async (params: {
	file: File;
	max_bytes: number;
	size_message: string;
	type_message: string;
}): Promise<VideoValidationResult> => {
	const { file, max_bytes, size_message, type_message } = params;

	if (file.size > max_bytes) {
		return { is_valid: false, message: size_message };
	}

	if (!ALLOWED_VIDEO_MIME_TYPES.has(file.type)) {
		return { is_valid: false, message: type_message };
	}

	const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
	const detected_format = detect_video_format(bytes);

	if (!detected_format) {
		return { is_valid: false, message: type_message };
	}

	return {
		detected_format,
		is_valid: true
	};
};

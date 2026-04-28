import { env } from '$env/dynamic/private';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ALLOWED_IMAGE_FORMATS } from './image-validation';
import { ALLOWED_VIDEO_FORMATS } from './video-validation';

let iscloudinary_configured = false;

const ensure_cloudinary_configured = (): void => {
	if (iscloudinary_configured) {
		return;
	}

	const cloud_name = env['CLOUDINARY_CLOUD_NAME'];
	const api_key = env['CLOUDINARY_API_KEY'];
	const api_secret = env['CLOUDINARY_API_SECRET'];

	if (!cloud_name || !api_key || !api_secret) {
		throw new Error(
			'Missing Cloudinary env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
		);
	}

	cloudinary.config({
		cloud_name,
		api_key,
		api_secret
	});

	iscloudinary_configured = true;
};

export type UploadImageOptions = {
	allowedFormats?: string[];
	folder: string;
	publicId?: string;
};

export type UploadVideoOptions = {
	allowedFormats?: string[];
	endOffset?: number;
	folder: string;
	publicId?: string;
	startOffset?: number;
};

type UploadedImage = {
	secureUrl: string;
	publicId: string;
};

type UploadedVideo = {
	secureUrl: string;
	publicId: string;
};

export type UploadedVideoResource = {
	bytes: number;
	format: string;
	publicId: string;
	secureUrl: string;
};

export type SignedVideoUpload = {
	apiKey: string;
	cloudName: string;
	params: Record<string, number | string | string[]>;
	publicId: string;
	signature: string;
	uploadUrl: string;
};

const COMPRESSED_VIDEO_TRANSFORMATION_OPTIONS = ['q_auto:good', 'vc_h264', 'ac_aac'] as const;

function format_cloudinary_time_value(value: number): string {
	const bounded_value = Math.max(0, value);

	if (Number.isInteger(bounded_value)) {
		return String(bounded_value);
	}

	return bounded_value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function build_video_upload_transformation(options: {
	endOffset?: number;
	startOffset?: number;
}): string {
	const transformation: string[] = [...COMPRESSED_VIDEO_TRANSFORMATION_OPTIONS];

	if (typeof options.startOffset === 'number') {
		transformation.unshift(`so_${format_cloudinary_time_value(options.startOffset)}`);
	}

	if (typeof options.endOffset === 'number') {
		const end_offset = `eo_${format_cloudinary_time_value(options.endOffset)}`;
		const insert_index = typeof options.startOffset === 'number' ? 1 : 0;
		transformation.splice(insert_index, 0, end_offset);
	}

	return transformation.join(',');
}

function as_error(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	return new Error('Cloudinary upload failed');
}

async function pipe_file_to_cloudinary_stream(
	file: File,
	stream: NodeJS.WritableStream
): Promise<void> {
	const source_stream = Readable.fromWeb(file.stream() as never);

	await pipeline(source_stream, stream);
}

async function upload_file_from_stream(params: {
	file: File;
	options: Record<string, string | number | string[] | undefined>;
	resource_type: 'image' | 'video';
}): Promise<{ publicId: string; secureUrl: string }> {
	return new Promise<{ publicId: string; secureUrl: string }>((resolve, reject) => {
		let settled = false;
		const reject_once = (error: unknown): void => {
			if (settled) {
				return;
			}

			settled = true;
			reject(as_error(error));
		};

		const stream = cloudinary.uploader.upload_stream(
			{
				...params.options,
				resource_type: params.resource_type
			},
			(error, result) => {
				if (error || !result) {
					reject_once(error);
					return;
				}

				if (settled) {
					return;
				}

				settled = true;
				resolve({
					secureUrl: result.secure_url,
					publicId: result.public_id
				});
			}
		);

		void pipe_file_to_cloudinary_stream(params.file, stream).catch(reject_once);
	});
}

export async function upload_image_from_file(
	file: File,
	options: UploadImageOptions
): Promise<UploadedImage> {
	ensure_cloudinary_configured();

	return upload_file_from_stream({
		file,
		options: {
			allowed_formats: options.allowedFormats ?? [...ALLOWED_IMAGE_FORMATS],
			folder: options.folder,
			...(options.publicId ? { public_id: options.publicId } : {})
		},
		resource_type: 'image'
	});
}

export async function upload_video_from_file(
	file: File,
	options: UploadVideoOptions
): Promise<UploadedVideo> {
	ensure_cloudinary_configured();

	return upload_file_from_stream({
		file,
		options: {
			allowed_formats: options.allowedFormats ?? [...ALLOWED_VIDEO_FORMATS],
			folder: options.folder,
			...(options.publicId ? { public_id: options.publicId } : {})
		},
		resource_type: 'video'
	});
}

export function build_video_delivery_url(
	base_url: string,
	options: {
		endOffset?: number;
		startOffset?: number;
	}
): string {
	const [prefix, suffix] = base_url.split('/video/upload/');

	if (!prefix || !suffix) {
		return base_url;
	}

	return `${prefix}/video/upload/${build_video_upload_transformation(options)},f_mp4/${suffix}`;
}

export function create_signed_video_upload(params: { folder: string }): SignedVideoUpload {
	ensure_cloudinary_configured();

	const cloud_name = env['CLOUDINARY_CLOUD_NAME'];
	const api_key = env['CLOUDINARY_API_KEY'];
	const api_secret = env['CLOUDINARY_API_SECRET'];

	if (!cloud_name || !api_key || !api_secret) {
		throw new Error('Missing Cloudinary upload configuration');
	}

	const public_id = `${params.folder}/${randomUUID()}`;
	const timestamp = Math.floor(Date.now() / 1000);
	const upload_params = {
		allowed_formats: [...ALLOWED_VIDEO_FORMATS],
		public_id,
		timestamp
	};

	return {
		apiKey: api_key,
		cloudName: cloud_name,
		params: upload_params,
		publicId: public_id,
		signature: cloudinary.utils.api_sign_request(upload_params, api_secret),
		uploadUrl: `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`
	};
}

export async function get_uploaded_video_resource(
	public_id: string
): Promise<UploadedVideoResource> {
	ensure_cloudinary_configured();

	const resource = (await cloudinary.api.resource(public_id, {
		resource_type: 'video'
	})) as {
		bytes?: number;
		format?: string;
		public_id?: string;
		secure_url?: string;
	};

	if (
		typeof resource.bytes !== 'number' ||
		typeof resource.format !== 'string' ||
		typeof resource.public_id !== 'string' ||
		typeof resource.secure_url !== 'string'
	) {
		throw new TypeError('Cloudinary video resource is incomplete');
	}

	return {
		bytes: resource.bytes,
		format: resource.format,
		publicId: resource.public_id,
		secureUrl: resource.secure_url
	};
}

export function get_optimized_image_url(public_id: string): string {
	ensure_cloudinary_configured();
	return cloudinary.url(public_id, {
		fetch_format: 'auto',
		quality: 100
	});
}

export async function delete_image_by_public_id(public_id: string): Promise<void> {
	ensure_cloudinary_configured();
	await cloudinary.uploader.destroy(public_id, {
		resource_type: 'image'
	});
}

export async function delete_video_by_public_id(public_id: string): Promise<void> {
	ensure_cloudinary_configured();
	await cloudinary.uploader.destroy(public_id, {
		resource_type: 'video'
	});
}

export function get_cloudinary_public_id_from_url(
	url: string,
	resource_type: 'image' | 'video'
): string | undefined {
	const upload_marker = `/${resource_type}/upload/`;
	const [, raw_suffix] = url.split(upload_marker);

	if (!raw_suffix) {
		return undefined;
	}

	const suffix = raw_suffix.split(/[?#]/)[0] ?? '';
	let segments = suffix.split('/').filter(Boolean);
	const version_index = segments.findIndex((segment) => /^v\d+$/.test(segment));

	if (version_index >= 0) {
		segments = segments.slice(version_index + 1);
	} else {
		const post_folder_index = segments.indexOf('posts');
		if (post_folder_index >= 0) {
			segments = segments.slice(post_folder_index);
		} else if (segments[0]?.includes(',')) {
			segments = segments.slice(1);
		}
	}

	if (segments.length === 0) {
		return undefined;
	}

	const last_segment = segments.at(-1) ?? '';
	const extension_index = last_segment.lastIndexOf('.');
	const normalized_last_segment =
		extension_index > 0 ? last_segment.slice(0, extension_index) : last_segment;

	return [...segments.slice(0, -1), normalized_last_segment].join('/');
}

export async function delete_media_by_cloudinary_url(
	url: string,
	resource_type: 'image' | 'video'
): Promise<void> {
	const public_id = get_cloudinary_public_id_from_url(url, resource_type);

	if (!public_id) {
		return;
	}

	if (resource_type === 'video') {
		await delete_video_by_public_id(public_id);
		return;
	}

	await delete_image_by_public_id(public_id);
}

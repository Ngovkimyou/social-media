import { env } from '$env/dynamic/private';
import { v2 as cloudinary } from 'cloudinary';
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
			...(options.publicId ? { public_id: options.publicId } : {}),
			...('startOffset' in options ? { start_offset: options.startOffset } : {}),
			...('endOffset' in options ? { end_offset: options.endOffset } : {})
		},
		resource_type: 'video'
	});
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

import { env } from '$env/dynamic/private';
import { v2 as cloudinary } from 'cloudinary';

let is_cloudinary_configured = false;

const ensure_cloudinary_configured = (): void => {
	if (is_cloudinary_configured) {
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

	is_cloudinary_configured = true;
};

export type UploadImageOptions = {
	folder: string;
	publicId?: string;
};

type UploadedImage = {
	secureUrl: string;
	publicId: string;
};

function as_error(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	return new Error('Cloudinary upload failed');
}

export async function upload_image_from_file(
	file: File,
	options: UploadImageOptions
): Promise<UploadedImage> {
	ensure_cloudinary_configured();
	const bytes = Buffer.from(await file.arrayBuffer());

	return new Promise<UploadedImage>((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{
				folder: options.folder,
				...(options.publicId ? { public_id: options.publicId } : {}),
				resource_type: 'image'
			},
			(error, result) => {
				if (error || !result) {
					reject(as_error(error));
					return;
				}

				resolve({
					secureUrl: result.secure_url,
					publicId: result.public_id
				});
			}
		);

		stream.end(bytes);
	});
}

export function get_optimized_image_url(public_id: string): string {
	ensure_cloudinary_configured();
	return cloudinary.url(public_id, {
		fetch_format: 'auto',
		quality: 'auto'
	});
}

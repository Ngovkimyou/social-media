export type ResponsiveVideoSource = {
	poster: string | undefined;
	src: string;
};

const is_cloudinary_video_upload_url = (url: string): boolean =>
	url.includes('res.cloudinary.com') && url.includes('/video/upload/');

const build_cloudinary_video_variant_url = (
	base_url: string,
	transform_segment: string
): string | undefined => {
	const [prefix, suffix] = base_url.split('/video/upload/');

	if (!prefix || !suffix) {
		return undefined;
	}

	return `${prefix}/video/upload/${transform_segment}/${suffix}`;
};

export const build_responsive_video_source = (original_url: string): ResponsiveVideoSource => {
	if (!is_cloudinary_video_upload_url(original_url)) {
		return { poster: undefined, src: original_url };
	}

	const playback_url = build_cloudinary_video_variant_url(
		original_url,
		'f_mp4,vc_h264,ac_aac,q_auto'
	);
	const poster_url = build_cloudinary_video_variant_url(original_url, 'so_0,w_720,q_auto,f_jpg');

	return {
		poster: poster_url,
		src: playback_url ?? original_url
	};
};

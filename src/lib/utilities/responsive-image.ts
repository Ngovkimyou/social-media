export type ResponsiveImageSource = {
	src: string;
	srcset?: string;
};

type BuildResponsiveImageOptions = {
	widths: number[];
	height?: number | 'match-width';
	fit?: 'fill' | 'fit' | 'limit' | 'pad' | 'scale' | 'lfill';
	quality?: 'auto' | number;
	format?: 'auto' | 'avif' | 'webp' | 'jpg' | 'png';
};

const sort_unique_widths = (widths: number[]): number[] =>
	Array.from(new Set(widths.filter((width) => Number.isFinite(width) && width > 0))).sort(
		(left, right) => left - right
	);

const is_cloudinary_upload_url = (url: string): boolean =>
	url.includes('res.cloudinary.com') && url.includes('/image/upload/');

const build_transform_segment = (
	width: number,
	options: Omit<BuildResponsiveImageOptions, 'widths'>
): string => {
	const fit_mode = options.fit ?? 'fill';
	const quality_mode = options.quality ?? 'auto';
	const format_mode = options.format ?? 'auto';
	const normalized_height =
		options.height === 'match-width'
			? width
			: typeof options.height === 'number'
				? options.height
				: undefined;
	const height_segment = typeof normalized_height === 'number' ? `,h_${normalized_height}` : '';

	return `c_${fit_mode},w_${width}${height_segment},q_${quality_mode},f_${format_mode},dpr_auto`;
};

const build_cloudinary_variant_url = (
	base_url: string,
	transform_segment: string
): string | undefined => {
	const [prefix, suffix] = base_url.split('/image/upload/');

	if (!prefix || !suffix) {
		return undefined;
	}

	return `${prefix}/image/upload/${transform_segment}/${suffix}`;
};

export const build_responsive_image_source = (
	original_url: string,
	options: BuildResponsiveImageOptions
): ResponsiveImageSource => {
	if (!is_cloudinary_upload_url(original_url)) {
		return { src: original_url };
	}

	const normalized_widths = sort_unique_widths(options.widths);

	if (normalized_widths.length === 0) {
		return { src: original_url };
	}

	const last_width = normalized_widths.at(-1);

	if (last_width === undefined) {
		return { src: original_url };
	}

	const largest_transform = build_transform_segment(last_width, options);
	const largest_variant = build_cloudinary_variant_url(original_url, largest_transform);

	if (!largest_variant) {
		return { src: original_url };
	}

	const srcset = normalized_widths
		.map((width) => {
			const transform_segment = build_transform_segment(width, options);
			const variant_url = build_cloudinary_variant_url(original_url, transform_segment);
			return variant_url ? `${variant_url} ${width}w` : undefined;
		})
		.filter((candidate): candidate is string => typeof candidate === 'string')
		.join(', ');

	return srcset.length > 0 ? { src: largest_variant, srcset } : { src: largest_variant };
};

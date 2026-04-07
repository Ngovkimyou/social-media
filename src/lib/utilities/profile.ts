const trim_surrounding_underscores = (value: string): string => {
	let start_index = 0;
	let end_index = value.length;

	while (start_index < end_index && value[start_index] === '_') {
		start_index += 1;
	}

	while (end_index > start_index && value[end_index - 1] === '_') {
		end_index -= 1;
	}

	return value.slice(start_index, end_index);
};

export const slugify_username = (value: string): string => {
	const out = value
		.normalize('NFKC')
		.trim()
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{N}_]+/gu, '_')
		.slice(0, 64);

	const normalized = trim_surrounding_underscores(out).slice(0, 24);

	return normalized || 'user';
};

const format_unit = (value: number, unit: 'second' | 'minute' | 'hour'): string =>
	`${value} ${unit}${value === 1 ? '' : 's'}`;

export const format_retry_duration = (total_seconds: number): string => {
	if (total_seconds < 60) {
		return format_unit(total_seconds, 'second');
	}

	if (total_seconds % 3600 === 0) {
		return format_unit(total_seconds / 3600, 'hour');
	}

	if (total_seconds % 60 === 0) {
		return format_unit(total_seconds / 60, 'minute');
	}

	const minutes = Math.floor(total_seconds / 60);
	const seconds = total_seconds % 60;

	if (minutes === 0) {
		return format_unit(seconds, 'second');
	}

	return `${format_unit(minutes, 'minute')} ${format_unit(seconds, 'second')}`;
};

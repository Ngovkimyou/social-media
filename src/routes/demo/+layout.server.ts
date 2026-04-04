import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async () => {
	if (!dev) {
		throw error(404, 'Not found');
	}

	return {};
}) satisfies LayoutServerLoad;

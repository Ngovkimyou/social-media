import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	// Defense-in-depth: auth is already enforced by src/routes/(app)/+layout.server.ts.
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	return {
		user_id: locals.user.id
	};
}) satisfies PageServerLoad;

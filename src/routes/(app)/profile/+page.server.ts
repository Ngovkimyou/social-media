import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ensure_profile_for_user } from '$lib/server/utilities/profile';

export const load = (async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const fallback_name = locals.user.email ?? locals.user.id;

	const username = await ensure_profile_for_user({
		user_id: locals.user.id,
		name: locals.user.name ?? fallback_name
	});

	throw redirect(302, `/profile/${encodeURIComponent(username)}`);
}) satisfies PageServerLoad;

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	ensure_profile_for_user,
	get_profile_username_by_user_id
} from '$lib/server/utility/profile';

export const load = (async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/demo/better-auth/login');
	}

	const fallback_name = locals.user.email ?? locals.user.id;

	await ensure_profile_for_user({
		user_id: locals.user.id,
		name: locals.user.name ?? fallback_name
	});

	const username = await get_profile_username_by_user_id(locals.user.id);

	if (!username) {
		throw redirect(302, '/home');
	}

	throw redirect(302, `/profile/${username}`);
}) satisfies PageServerLoad;

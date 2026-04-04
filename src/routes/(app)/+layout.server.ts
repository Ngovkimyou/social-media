import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { get_profile_username_by_user_id } from '$lib/server/utilities/profile';

export const load = (async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const profile_username = await get_profile_username_by_user_id(locals.user.id);

	return {
		profile_username: profile_username ?? ''
	};
}) satisfies LayoutServerLoad;

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get_profile_page_data } from '$lib/server/utility/profile';
import { get_db } from '$lib/server/db';
import { follows } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export const load = (async ({ params, locals }) => {
	const profile_data = await get_profile_page_data(params.username, locals.user?.id);

	if (!profile_data) {
		throw error(404, 'Profile not found');
	}

	return profile_data;
}) satisfies PageServerLoad;

export const actions = {
	follow: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_data = await get_profile_page_data(params.username, locals.user.id);

		if (!profile_data) {
			throw error(404, 'Profile not found');
		}

		if (profile_data.relationship.is_own_profile) {
			return fail(400, { message: 'You cannot follow your own profile.' });
		}

		const db = get_db();
		await db
			.insert(follows)
			.values({
				follower_id: locals.user.id,
				following_id: profile_data.profile.user_id
			})
			.onConflictDoNothing();

		return { success: true };
	},
	unfollow: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/demo/better-auth/login');
		}

		const profile_data = await get_profile_page_data(params.username, locals.user.id);

		if (!profile_data) {
			throw error(404, 'Profile not found');
		}

		const db = get_db();
		await db
			.delete(follows)
			.where(
				and(
					eq(follows.follower_id, locals.user.id),
					eq(follows.following_id, profile_data.profile.user_id)
				)
			);

		return { success: true };
	}
} satisfies Actions;

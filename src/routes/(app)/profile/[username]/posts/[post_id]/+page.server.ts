import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	get_profile_page_data,
	get_profile_posts_by_username
} from '$lib/server/utilities/profile';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [profile_data, posts] = await Promise.all([
		get_profile_page_data(params.username, locals.user?.id),
		get_profile_posts_by_username(params.username, params.post_id, locals.user?.id)
	]);

	if (!profile_data || !posts) {
		throw error(404, 'Profile post not found');
	}

	return {
		profile: profile_data.profile,
		posts
	};
};

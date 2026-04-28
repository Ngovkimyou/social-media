import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { get_profile_page_data } from '$lib/server/utilities/profile';

export const load: PageServerLoad = async ({ params, locals }) => {
	const profile_data = await get_profile_page_data(params.username, locals.user?.id);

	if (!profile_data) {
		throw error(404, 'Profile not found');
	}

	const selected_index = profile_data.shared_posts.findIndex((post) => post.id === params.post_id);

	if (selected_index === -1) {
		throw error(404, 'Shared post not found');
	}

	const selected_post = profile_data.shared_posts[selected_index];

	if (!selected_post) {
		throw error(404, 'Shared post not found');
	}

	return {
		profile: profile_data.profile,
		posts: [
			selected_post,
			...profile_data.shared_posts.filter((post) => post.id !== params.post_id)
		]
	};
};

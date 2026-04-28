import { post_shares } from '$lib/server/db/schema';
import { toggle_post_action } from '$lib/server/utilities/post-action-toggle';
import {
	get_profile_username_by_user_id,
	invalidate_profile_cache
} from '$lib/server/utilities/profile';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const response = await toggle_post_action({
		action_key: 'shared',
		count_key: 'share_count',
		event,
		rate_limit_category: 'rate_limit_share',
		rate_limit_message: 'Too many share actions. Please try again shortly.',
		rate_limit_scope: 'share-action',
		table: post_shares
	});

	if (event.locals.user && response.ok) {
		const viewer_username = await get_profile_username_by_user_id(event.locals.user.id);
		if (viewer_username) {
			invalidate_profile_cache({
				profile_user_id: event.locals.user.id,
				username: viewer_username
			});
		}
	}

	return response;
};

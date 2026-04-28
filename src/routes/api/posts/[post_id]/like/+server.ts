import { likes } from '$lib/server/db/schema';
import { toggle_post_action } from '$lib/server/utilities/post-action-toggle';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) =>
	toggle_post_action({
		action_key: 'liked',
		count_key: 'like_count',
		event,
		rate_limit_category: 'rate_limit_like',
		rate_limit_message: 'Too many like actions. Please try again shortly.',
		rate_limit_scope: 'like-action',
		table: likes
	});

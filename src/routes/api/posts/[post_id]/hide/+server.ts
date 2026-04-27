import { hide_post_for_user } from '$lib/server/utilities/posts';
import {
	get_profile_username_by_user_id,
	invalidate_profile_cache
} from '$lib/server/utilities/profile';
import { record_security_event } from '$lib/server/utilities/security-monitor';
import { consume_social_action_rate_limit } from '$lib/server/utilities/social-action-rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const rate_limit = await consume_social_action_rate_limit(event, 'hide-post-action');
	if (!rate_limit.is_allowed) {
		await record_security_event({
			category: 'rate_limit_hide_post',
			details: `retry_after=${rate_limit.retry_after_seconds}`,
			event
		});

		return json(
			{ error: 'Too many hide actions. Please try again shortly.' },
			{
				status: 429,
				headers: {
					'retry-after': `${rate_limit.retry_after_seconds}`
				}
			}
		);
	}

	const result = await hide_post_for_user(params.post_id, locals.user.id);

	if (!result.success) {
		return json({ error: result.error }, { status: 404 });
	}

	const username = await get_profile_username_by_user_id(locals.user.id);
	if (username) {
		invalidate_profile_cache({
			profile_user_id: locals.user.id,
			username
		});
	}

	return new Response(undefined, { status: 204 });
};

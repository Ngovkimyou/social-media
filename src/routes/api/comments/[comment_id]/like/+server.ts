import { record_security_event } from '$lib/server/utilities/security-monitor';
import { set_comment_like } from '$lib/server/utilities/comments';
import { consume_social_action_rate_limit } from '$lib/server/utilities/social-action-rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const parsed_body =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : undefined;
	const liked = parsed_body?.['liked'];

	if (typeof liked !== 'boolean') {
		return json({ error: 'Expected liked to be true or false.' }, { status: 400 });
	}

	const rate_limit = await consume_social_action_rate_limit(event, 'like-action');
	if (!rate_limit.is_allowed) {
		await record_security_event({
			category: 'rate_limit_like',
			details: `retry_after=${rate_limit.retry_after_seconds}`,
			event
		});

		return json(
			{ error: 'Too many like actions. Please try again shortly.' },
			{
				status: 429,
				headers: {
					'retry-after': `${rate_limit.retry_after_seconds}`
				}
			}
		);
	}

	const result = await set_comment_like(params.comment_id, locals.user.id, liked);

	if (!result.success) {
		return json({ error: result.error }, { status: 404 });
	}

	return json({ liked: result.liked, like_count: result.like_count });
};

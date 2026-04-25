import { get_comments_by_post_id, create_comment } from '$lib/server/utilities/comments';
import { record_security_event } from '$lib/server/utilities/security-monitor';
import { consume_social_action_rate_limit } from '$lib/server/utilities/social-action-rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { url, locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const cursor = url.searchParams.get('cursor') ?? undefined;
	const raw_limit = url.searchParams.get('limit');
	const limit = raw_limit !== null ? Math.min(Math.max(parseInt(raw_limit, 10) || 20, 1), 50) : 20;

	const page = await get_comments_by_post_id(params.post_id, limit, cursor);

	return json(page);
};

export const POST: RequestHandler = async (event) => {
	const { locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const rate_limit = await consume_social_action_rate_limit(event, 'comment');
	if (!rate_limit.is_allowed) {
		await record_security_event({
			category: 'rate_limit_post',
			details: `retry_after=${rate_limit.retry_after_seconds}`,
			event
		});
		return json(
			{ error: 'Too many comments. Please slow down.' },
			{
				status: 429,
				headers: { 'retry-after': `${rate_limit.retry_after_seconds}` }
			}
		);
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const parsed_body =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : undefined;
	if (!parsed_body || typeof parsed_body['content'] !== 'string') {
		return json({ error: 'Missing content' }, { status: 400 });
	}

	const content = parsed_body['content'].trim();

	if (content.length === 0) {
		return json({ error: 'Comment cannot be empty' }, { status: 400 });
	}

	if (content.length > 2000) {
		return json({ error: 'Comment is too long (max 2000 characters)' }, { status: 400 });
	}

	const comment = await create_comment(params.post_id, locals.user.id, content);

	return json(comment, { status: 201 });
};

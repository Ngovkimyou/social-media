import { delete_comment, update_comment } from '$lib/server/utilities/comments';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_COMMENT_LENGTH = 500;

export const PATCH: RequestHandler = async (event) => {
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
	if (!parsed_body || typeof parsed_body['content'] !== 'string') {
		return json({ error: 'Missing content' }, { status: 400 });
	}

	const content = parsed_body['content'].trim();

	if (content.length === 0) {
		return json({ error: 'Comment cannot be empty' }, { status: 400 });
	}

	if (content.length > MAX_COMMENT_LENGTH) {
		return json({ error: 'Comment is too long (max 500 characters)' }, { status: 400 });
	}

	const result = await update_comment(params.comment_id, locals.user.id, content);

	if (!result.success) {
		const status = result.error === 'Forbidden' ? 403 : 404;
		return json({ error: result.error }, { status });
	}

	return json(result.comment);
};

export const DELETE: RequestHandler = async (event) => {
	const { locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = await delete_comment(params.comment_id, locals.user.id);

	if (!result.success) {
		const status = result.error === 'Forbidden' ? 403 : 404;
		return json({ error: result.error }, { status });
	}

	return new Response(undefined, { status: 204 });
};

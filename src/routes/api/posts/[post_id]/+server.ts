import { delete_post, update_post } from '$lib/server/utilities/posts';
import {
	get_profile_username_by_user_id,
	invalidate_profile_cache
} from '$lib/server/utilities/profile';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_POST_CONTENT_LENGTH = 1000;

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

	if (content.length > MAX_POST_CONTENT_LENGTH) {
		return json({ error: 'Post caption is too long (max 1000 characters)' }, { status: 400 });
	}

	const result = await update_post(params.post_id, locals.user.id, content);

	if (!result.success) {
		const status = result.error === 'Forbidden' ? 403 : 404;
		return json({ error: result.error }, { status });
	}

	const username = await get_profile_username_by_user_id(locals.user.id);
	if (username) {
		invalidate_profile_cache({
			profile_user_id: locals.user.id,
			username
		});
	}

	return json(result.post);
};

export const DELETE: RequestHandler = async (event) => {
	const { locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = await delete_post(params.post_id, locals.user.id);

	if (!result.success) {
		const status = result.error === 'Forbidden' ? 403 : 404;
		return json({ error: result.error }, { status });
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

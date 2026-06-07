import { hide_comment_for_user } from '$lib/server/utilities/comments';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = await hide_comment_for_user(params.comment_id, locals.user.id);

	if (!result.success) {
		const status = result.error === 'Cannot hide your own comment' ? 403 : 404;
		return json({ error: result.error }, { status });
	}

	return json({ hidden: true });
};

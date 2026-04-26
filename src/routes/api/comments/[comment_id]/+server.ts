import { delete_comment } from '$lib/server/utilities/comments';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

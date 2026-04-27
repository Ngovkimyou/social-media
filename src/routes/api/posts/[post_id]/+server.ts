import { delete_post } from '$lib/server/utilities/posts';
import {
	get_profile_username_by_user_id,
	invalidate_profile_cache
} from '$lib/server/utilities/profile';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

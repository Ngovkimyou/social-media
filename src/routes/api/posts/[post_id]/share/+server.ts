import { get_db } from '$lib/server/db';
import { post_shares, posts } from '$lib/server/db/schema';
import {
	get_profile_username_by_user_id,
	invalidate_profile_cache
} from '$lib/server/utilities/profile';
import { record_security_event } from '$lib/server/utilities/security-monitor';
import { consume_social_action_rate_limit } from '$lib/server/utilities/social-action-rate-limit';
import { and, count, eq, isNull } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const post_id = params.post_id.trim();
	if (!post_id) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	const rate_limit = await consume_social_action_rate_limit(event, 'share-action');
	if (!rate_limit.is_allowed) {
		await record_security_event({
			category: 'rate_limit_share',
			details: `retry_after=${rate_limit.retry_after_seconds}`,
			event
		});
		return json(
			{ error: 'Too many share actions. Please try again shortly.' },
			{
				status: 429,
				headers: {
					'retry-after': `${rate_limit.retry_after_seconds}`
				}
			}
		);
	}

	const db = get_db();
	const post_rows = await db
		.select({ id: posts.id })
		.from(posts)
		.where(and(eq(posts.id, post_id), isNull(posts.deleted_at)))
		.limit(1);

	if (!post_rows[0]) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	const existing_share_rows = await db
		.select({ post_id: post_shares.post_id })
		.from(post_shares)
		.where(and(eq(post_shares.post_id, post_id), eq(post_shares.user_id, locals.user.id)))
		.limit(1);

	if (existing_share_rows[0]) {
		await db
			.delete(post_shares)
			.where(and(eq(post_shares.post_id, post_id), eq(post_shares.user_id, locals.user.id)));
	} else {
		await db
			.insert(post_shares)
			.values({
				post_id,
				user_id: locals.user.id
			})
			.onConflictDoNothing();
	}

	const [share_count_rows, shared_rows] = await Promise.all([
		db.select({ value: count() }).from(post_shares).where(eq(post_shares.post_id, post_id)),
		db
			.select({ post_id: post_shares.post_id })
			.from(post_shares)
			.where(and(eq(post_shares.post_id, post_id), eq(post_shares.user_id, locals.user.id)))
			.limit(1)
	]);

	const viewer_username = await get_profile_username_by_user_id(locals.user.id);
	if (viewer_username) {
		invalidate_profile_cache({
			profile_user_id: locals.user.id,
			username: viewer_username
		});
	}

	return json({
		shared: Boolean(shared_rows[0]),
		share_count: share_count_rows[0]?.value ?? 0
	});
};

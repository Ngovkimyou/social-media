import { get_db } from '$lib/server/db';
import { likes, posts } from '$lib/server/db/schema';
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

	const db = get_db();
	const post_rows = await db
		.select({ id: posts.id })
		.from(posts)
		.where(and(eq(posts.id, post_id), isNull(posts.deleted_at)))
		.limit(1);

	if (!post_rows[0]) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	const existing_like_rows = await db
		.select({ post_id: likes.post_id })
		.from(likes)
		.where(and(eq(likes.post_id, post_id), eq(likes.user_id, locals.user.id)))
		.limit(1);

	if (existing_like_rows[0]) {
		await db
			.delete(likes)
			.where(and(eq(likes.post_id, post_id), eq(likes.user_id, locals.user.id)));
	} else {
		await db
			.insert(likes)
			.values({
				post_id,
				user_id: locals.user.id
			})
			.onConflictDoNothing();
	}

	const [like_count_rows, liked_rows] = await Promise.all([
		db.select({ value: count() }).from(likes).where(eq(likes.post_id, post_id)),
		db
			.select({ post_id: likes.post_id })
			.from(likes)
			.where(and(eq(likes.post_id, post_id), eq(likes.user_id, locals.user.id)))
			.limit(1)
	]);

	return json({
		liked: Boolean(liked_rows[0]),
		like_count: like_count_rows[0]?.value ?? 0
	});
};

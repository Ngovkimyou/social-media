import { get_db } from '$lib/server/db';
import { posts, type likes, type post_shares } from '$lib/server/db/schema';
import { record_security_event } from '$lib/server/utilities/security-monitor';
import { consume_social_action_rate_limit } from '$lib/server/utilities/social-action-rate-limit';
import { and, count, eq, isNull } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

type PostActionTable = typeof likes | typeof post_shares;

type TogglePostActionOptions = {
	action_key: string;
	count_key: string;
	event: RequestEvent;
	rate_limit_category: 'rate_limit_like' | 'rate_limit_share';
	rate_limit_message: string;
	rate_limit_scope: 'like-action' | 'share-action';
	table: PostActionTable;
};

const get_requested_action_state = async (
	event: RequestEvent,
	action_key: string
): Promise<boolean | undefined> => {
	try {
		const content_type = event.request.headers.get('content-type')?.toLowerCase() ?? '';

		if (!content_type.includes('application/json')) {
			return undefined;
		}

		const body = (await event.request.json()) as Record<string, unknown>;
		const requested_state = body[action_key];
		return typeof requested_state === 'boolean' ? requested_state : undefined;
	} catch {
		return undefined;
	}
};

export async function toggle_post_action({
	action_key,
	count_key,
	event,
	rate_limit_category,
	rate_limit_message,
	rate_limit_scope,
	table
}: TogglePostActionOptions): Promise<Response> {
	const { locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const post_id = params.post_id?.trim() ?? '';
	if (!post_id) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	const requested_action_state = await get_requested_action_state(event, action_key);
	if (requested_action_state === undefined) {
		return json({ error: `Expected ${action_key} to be true or false.` }, { status: 400 });
	}

	const rate_limit = await consume_social_action_rate_limit(event, rate_limit_scope);
	if (!rate_limit.is_allowed) {
		await record_security_event({
			category: rate_limit_category,
			details: `retry_after=${rate_limit.retry_after_seconds}`,
			event
		});

		return json(
			{ error: rate_limit_message },
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

	const action_where = and(eq(table.post_id, post_id), eq(table.user_id, locals.user.id));

	if (requested_action_state) {
		await db
			.insert(table)
			.values({
				post_id,
				user_id: locals.user.id
			})
			.onConflictDoNothing();
	} else {
		await db.delete(table).where(action_where);
	}

	const [count_rows, selected_rows] = await Promise.all([
		db.select({ value: count() }).from(table).where(eq(table.post_id, post_id)),
		db.select({ post_id: table.post_id }).from(table).where(action_where).limit(1)
	]);

	return json({
		[action_key]: Boolean(selected_rows[0]),
		[count_key]: count_rows[0]?.value ?? 0
	});
}

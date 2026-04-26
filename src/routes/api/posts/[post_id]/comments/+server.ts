import {
	commentable_post_exists,
	create_comment,
	get_comments_by_post_id,
	has_recent_duplicate_comment
} from '$lib/server/utilities/comments';
import { record_security_event } from '$lib/server/utilities/security-monitor';
import { consume_social_action_rate_limit } from '$lib/server/utilities/social-action-rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_COMMENT_JSON_BYTES = 16 * 1024;
const MAX_COMMENT_LINKS = 3;
const DUPLICATE_COMMENT_WINDOW_SECONDS = 10 * 60;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;

type LimitedJsonBodyResult = { body: unknown; status: 'ok' } | { status: 'too_large' };

const get_content_length = (request: Request): number | undefined => {
	const raw_content_length = request.headers.get('content-length');
	if (!raw_content_length) {
		return undefined;
	}

	const content_length = Number.parseInt(raw_content_length, 10);
	return Number.isFinite(content_length) && content_length >= 0 ? content_length : undefined;
};

const read_limited_json_body = async (request: Request): Promise<LimitedJsonBodyResult> => {
	const content_length = get_content_length(request);
	if (content_length !== undefined && content_length > MAX_COMMENT_JSON_BYTES) {
		return { status: 'too_large' };
	}

	if (request.body === null) {
		throw new SyntaxError('Missing request body');
	}

	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	const chunks: string[] = [];
	let received_bytes = 0;
	let is_done = false;

	while (!is_done) {
		const { done, value } = await reader.read();
		if (done) {
			is_done = true;
			continue;
		}

		received_bytes += value.byteLength;
		if (received_bytes > MAX_COMMENT_JSON_BYTES) {
			await reader.cancel();
			return { status: 'too_large' };
		}

		chunks.push(decoder.decode(value, { stream: true }));
	}

	chunks.push(decoder.decode());
	const raw_body = chunks.join('');
	return { body: JSON.parse(raw_body) as unknown, status: 'ok' };
};

const count_links = (content: string): number => content.match(URL_PATTERN)?.length ?? 0;

export const GET: RequestHandler = async (event) => {
	const { url, locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const cursor = url.searchParams.get('cursor') ?? undefined;
	const raw_limit = url.searchParams.get('limit');
	const limit =
		raw_limit === null ? 20 : Math.min(Math.max(Number.parseInt(raw_limit, 10) || 20, 1), 50);

	const page = await get_comments_by_post_id(params.post_id, limit, cursor);

	if (!page) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

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
		const body_result = await read_limited_json_body(event.request);
		if (body_result.status === 'too_large') {
			return json({ error: 'Request body is too large' }, { status: 413 });
		}

		body = body_result.body;
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

	if (count_links(content) > MAX_COMMENT_LINKS) {
		await record_security_event({
			category: 'comment_spam',
			details: 'too-many-links',
			event
		});
		return json({ error: 'Comment has too many links' }, { status: 400 });
	}

	if (!(await commentable_post_exists(params.post_id))) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	if (
		await has_recent_duplicate_comment(
			params.post_id,
			locals.user.id,
			content,
			DUPLICATE_COMMENT_WINDOW_SECONDS
		)
	) {
		await record_security_event({
			category: 'comment_spam',
			details: 'duplicate-comment',
			event
		});
		return json(
			{ error: 'Duplicate comment. Please wait before posting it again.' },
			{ status: 409 }
		);
	}

	const comment = await create_comment(params.post_id, locals.user.id, content);

	if (!comment) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	return json(comment, { status: 201 });
};

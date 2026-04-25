import { get_db } from '$lib/server/db';
import { comments, profiles, user } from '$lib/server/db/schema';
import type { CommentPage, PostComment } from '$lib/types/comment';
import { and, count, desc, eq, isNull, lt, or } from 'drizzle-orm';

const COMMENT_PAGE_SIZE = 20;

type CommentCursor = {
	created_at: string;
	id: string;
};

function encode_comment_cursor(cursor: CommentCursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decode_comment_cursor(cursor?: string): CommentCursor | undefined {
	if (!cursor) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(
			Buffer.from(cursor, 'base64url').toString('utf8')
		) as Partial<CommentCursor>;

		if (typeof parsed.created_at !== 'string' || typeof parsed.id !== 'string') {
			return undefined;
		}

		return { created_at: parsed.created_at, id: parsed.id };
	} catch {
		return undefined;
	}
}

export async function get_comments_by_post_id(
	post_id: string,
	limit = COMMENT_PAGE_SIZE,
	cursor?: string
): Promise<CommentPage> {
	const db = get_db();
	const normalized_limit = Math.max(1, Math.min(limit, 50));
	const decoded_cursor = decode_comment_cursor(cursor);

	const base_where = and(eq(comments.post_id, post_id), isNull(comments.deleted_at));

	const [rows, count_rows] = await Promise.all([
		db
			.select({
				id: comments.id,
				content: comments.content,
				created_at: comments.created_at,
				author_id: comments.author_id,
				author_name: user.name,
				author_username: profiles.username,
				author_avatar: user.image
			})
			.from(comments)
			.innerJoin(user, eq(comments.author_id, user.id))
			.leftJoin(profiles, eq(profiles.user_id, user.id))
			.where(
				and(
					base_where,
					decoded_cursor
						? or(
								lt(comments.created_at, new Date(decoded_cursor.created_at)),
								and(
									eq(comments.created_at, new Date(decoded_cursor.created_at)),
									lt(comments.id, decoded_cursor.id)
								)
							)
						: undefined
				)
			)
			.orderBy(desc(comments.created_at), desc(comments.id))
			.limit(normalized_limit + 1),
		db.select({ value: count() }).from(comments).where(base_where)
	]);

	const total_count = count_rows[0]?.value ?? 0;
	const visible_rows = rows.slice(0, normalized_limit);
	const has_more = rows.length > normalized_limit;
	const last_comment = visible_rows.at(-1);
	const next_cursor =
		has_more && last_comment
			? encode_comment_cursor({
					created_at: last_comment.created_at.toISOString(),
					id: last_comment.id
				})
			: undefined;

	const page_comments: PostComment[] = visible_rows.map((row) => ({
		id: row.id,
		content: row.content,
		created_at: row.created_at,
		author_id: row.author_id,
		author_name: row.author_name,
		author_username: row.author_username ?? 'user',
		author_avatar: row.author_avatar
	}));

	return next_cursor
		? { comments: page_comments, has_more, next_cursor, total_count }
		: { comments: page_comments, has_more, total_count };
}

export async function create_comment(
	post_id: string,
	author_id: string,
	content: string
): Promise<PostComment> {
	const db = get_db();
	const id = crypto.randomUUID();

	await db.insert(comments).values({ id, post_id, author_id, content });

	const author_rows = await db
		.select({ name: user.name, image: user.image, username: profiles.username })
		.from(user)
		.leftJoin(profiles, eq(profiles.user_id, user.id))
		.where(eq(user.id, author_id))
		.limit(1);

	const author = author_rows[0];

	return {
		id,
		content,
		created_at: new Date(),
		author_id,
		author_name: author?.name ?? 'User',
		author_username: author?.username ?? 'user',
		//eslint-disable-next-line
		author_avatar: author?.image ?? null
	};
}

export async function delete_comment(
	comment_id: string,
	user_id: string
): Promise<{ success: boolean; error?: string }> {
	const db = get_db();

	const existing = await db
		.select({ id: comments.id, author_id: comments.author_id })
		.from(comments)
		.where(and(eq(comments.id, comment_id), isNull(comments.deleted_at)))
		.limit(1);

	const existing_comment = existing[0];

	if (!existing_comment) {
		return { success: false, error: 'Comment not found' };
	}

	if (existing_comment.author_id !== user_id) {
		return { success: false, error: 'Forbidden' };
	}

	await db.update(comments).set({ deleted_at: new Date() }).where(eq(comments.id, comment_id));

	return { success: true };
}

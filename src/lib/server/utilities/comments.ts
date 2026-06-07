import { get_db } from '$lib/server/db';
import {
	comment_likes,
	comments,
	hidden_comments,
	posts,
	profiles,
	user
} from '$lib/server/db/schema';
import type { CommentPage, PostComment } from '$lib/types/comment';
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';

const COMMENT_PAGE_SIZE = 20;
let comment_index_init_promise: Promise<void> | undefined;
let hidden_comment_init_promise: Promise<void> | undefined;
let comment_like_init_promise: Promise<void> | undefined;

type CommentCursor = {
	created_at: string;
	id: string;
};

function nullable<T>(value: T | undefined): T | null {
	// eslint-disable-next-line unicorn/no-null
	return value ?? null;
}

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

async function initialize_comment_indexes(): Promise<void> {
	if (comment_index_init_promise !== undefined) {
		return comment_index_init_promise;
	}

	comment_index_init_promise = get_db()
		.execute(
			sql`
			create index if not exists comment_post_deleted_created_id_idx
			on "comment" (post_id, deleted_at, created_at desc, id desc)
		`
		)
		.then(() =>
			get_db().execute(sql`alter table "comment" add column if not exists parent_comment_id text`)
		)
		.then(() =>
			get_db().execute(sql`alter table "comment" add column if not exists reply_to_comment_id text`)
		)
		.then(() =>
			get_db().execute(
				sql`create index if not exists comment_parent_comment_id_idx on "comment" (parent_comment_id)`
			)
		)
		.then(() =>
			get_db().execute(
				sql`create index if not exists comment_reply_to_comment_id_idx on "comment" (reply_to_comment_id)`
			)
		)
		.then(() => {})
		.catch((error) => {
			console.warn(
				`Comment index initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		});

	return comment_index_init_promise;
}

async function initialize_hidden_comments_table(): Promise<void> {
	if (hidden_comment_init_promise !== undefined) {
		return hidden_comment_init_promise;
	}

	hidden_comment_init_promise = (async () => {
		const db = get_db();
		await db.execute(sql`
			create table if not exists hidden_comment (
				comment_id text not null references "comment"(id) on delete cascade,
				user_id text not null references "user"(id) on delete cascade,
				created_at timestamp not null default now(),
				primary key (comment_id, user_id)
			)
		`);
		await db.execute(sql`
			create index if not exists hidden_comment_comment_id_idx on hidden_comment (comment_id)
		`);
		await db.execute(sql`
			create index if not exists hidden_comment_user_id_idx on hidden_comment (user_id)
		`);
	})();

	return hidden_comment_init_promise;
}

async function initialize_comment_likes_table(): Promise<void> {
	if (comment_like_init_promise !== undefined) {
		return comment_like_init_promise;
	}

	comment_like_init_promise = (async () => {
		const db = get_db();
		await db.execute(sql`
			create table if not exists comment_like (
				comment_id text not null references "comment"(id) on delete cascade,
				user_id text not null references "user"(id) on delete cascade,
				created_at timestamp not null default now(),
				primary key (comment_id, user_id)
			)
		`);
		await db.execute(sql`
			create index if not exists comment_like_comment_id_idx on comment_like (comment_id)
		`);
		await db.execute(sql`
			create index if not exists comment_like_user_id_idx on comment_like (user_id)
		`);
	})();

	return comment_like_init_promise;
}

export async function commentable_post_exists(post_id: string): Promise<boolean> {
	await initialize_comment_indexes();
	const post_rows = await get_db()
		.select({ id: posts.id })
		.from(posts)
		.where(and(eq(posts.id, post_id), isNull(posts.deleted_at)))
		.limit(1);

	return post_rows.length > 0;
}

export async function get_comments_by_post_id(
	post_id: string,
	limit = COMMENT_PAGE_SIZE,
	cursor?: string,
	viewer_user_id?: string
): Promise<CommentPage | undefined> {
	await initialize_comment_indexes();
	await initialize_hidden_comments_table();
	await initialize_comment_likes_table();
	const db = get_db();
	const normalized_limit = Math.max(1, Math.min(limit, 50));
	const decoded_cursor = decode_comment_cursor(cursor);

	const base_where = and(eq(comments.post_id, post_id), isNull(comments.deleted_at));
	const top_level_where = and(base_where, isNull(comments.parent_comment_id));

	const [post_row, top_rows, count_rows] = await Promise.all([
		db
			.select({ id: posts.id })
			.from(posts)
			.where(and(eq(posts.id, post_id), isNull(posts.deleted_at)))
			.limit(1),
		db
			.select({
				id: comments.id,
				content: comments.content,
				created_at: comments.created_at,
				updated_at: comments.updated_at,
				author_id: comments.author_id,
				author_name: user.name,
				author_username: profiles.username,
				author_avatar: user.image,
				parent_comment_id: comments.parent_comment_id,
				reply_to_comment_id: comments.reply_to_comment_id
			})
			.from(comments)
			.innerJoin(user, eq(comments.author_id, user.id))
			.leftJoin(profiles, eq(profiles.user_id, user.id))
			.where(
				and(
					top_level_where,
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

	if (!post_row[0]) {
		return undefined;
	}

	const total_count = count_rows[0]?.value ?? 0;
	const visible_rows = top_rows.slice(0, normalized_limit);
	const has_more = top_rows.length > normalized_limit;
	const last_comment = visible_rows.at(-1);
	const next_cursor =
		has_more && last_comment
			? encode_comment_cursor({
					created_at: last_comment.created_at.toISOString(),
					id: last_comment.id
				})
			: undefined;

	const top_comment_ids = visible_rows.map((row) => row.id);
	const reply_rows =
		top_comment_ids.length === 0
			? []
			: await db
					.select({
						id: comments.id,
						content: comments.content,
						created_at: comments.created_at,
						updated_at: comments.updated_at,
						author_id: comments.author_id,
						author_name: user.name,
						author_username: profiles.username,
						author_avatar: user.image,
						parent_comment_id: comments.parent_comment_id,
						reply_to_comment_id: comments.reply_to_comment_id
					})
					.from(comments)
					.innerJoin(user, eq(comments.author_id, user.id))
					.leftJoin(profiles, eq(profiles.user_id, user.id))
					.where(and(base_where, inArray(comments.parent_comment_id, top_comment_ids)))
					.orderBy(asc(comments.created_at), asc(comments.id));

	const reply_to_ids = [
		...new Set(
			[...visible_rows, ...reply_rows]
				.map((row) => row.reply_to_comment_id)
				.filter((id): id is string => Boolean(id))
		)
	];
	const reply_to_author_rows =
		reply_to_ids.length === 0
			? []
			: await db
					.select({
						id: comments.id,
						author_id: comments.author_id,
						author_name: user.name,
						author_username: profiles.username
					})
					.from(comments)
					.innerJoin(user, eq(comments.author_id, user.id))
					.leftJoin(profiles, eq(profiles.user_id, user.id))
					.where(inArray(comments.id, reply_to_ids));
	const reply_to_author_by_id = new Map(
		reply_to_author_rows.map((row) => [
			row.id,
			{
				author_id: row.author_id,
				author_name: row.author_name,
				author_username: row.author_username ?? 'user'
			}
		])
	);
	const visible_comment_ids = [...visible_rows, ...reply_rows].map((row) => row.id);
	const [hidden_comment_rows, comment_like_count_rows, liked_comment_rows] = await Promise.all([
		visible_comment_ids.length === 0 || !viewer_user_id
			? Promise.resolve([])
			: db
					.select({ comment_id: hidden_comments.comment_id })
					.from(hidden_comments)
					.where(
						and(
							inArray(hidden_comments.comment_id, visible_comment_ids),
							eq(hidden_comments.user_id, viewer_user_id)
						)
					),
		visible_comment_ids.length === 0
			? Promise.resolve([])
			: db
					.select({
						comment_id: comment_likes.comment_id,
						like_count: count()
					})
					.from(comment_likes)
					.where(inArray(comment_likes.comment_id, visible_comment_ids))
					.groupBy(comment_likes.comment_id),
		visible_comment_ids.length === 0 || !viewer_user_id
			? Promise.resolve([])
			: db
					.select({ comment_id: comment_likes.comment_id })
					.from(comment_likes)
					.where(
						and(
							inArray(comment_likes.comment_id, visible_comment_ids),
							eq(comment_likes.user_id, viewer_user_id)
						)
					)
	]);
	const hidden_comment_ids = new Set(hidden_comment_rows.map((row) => row.comment_id));
	const liked_comment_ids = new Set(liked_comment_rows.map((row) => row.comment_id));
	const like_count_by_comment = new Map<string, number>();
	for (const row of comment_like_count_rows) {
		like_count_by_comment.set(row.comment_id, row.like_count);
	}

	const map_comment_row = (
		row: (typeof visible_rows)[number] | (typeof reply_rows)[number]
	): PostComment => {
		const reply_to_author = row.reply_to_comment_id
			? reply_to_author_by_id.get(row.reply_to_comment_id)
			: undefined;

		return {
			id: row.id,
			parent_comment_id: row.parent_comment_id,
			reply_to_comment_id: row.reply_to_comment_id,
			reply_to_author_id: nullable(reply_to_author?.author_id),
			reply_to_author_name: nullable(reply_to_author?.author_name),
			reply_to_author_username: nullable(reply_to_author?.author_username),
			content: row.content,
			created_at: row.created_at,
			updated_at: row.updated_at,
			author_id: row.author_id,
			author_name: row.author_name,
			author_username: row.author_username ?? 'user',
			author_avatar: row.author_avatar,
			is_hidden_for_viewer: hidden_comment_ids.has(row.id),
			like_count: like_count_by_comment.get(row.id) ?? 0,
			has_liked: liked_comment_ids.has(row.id)
		};
	};

	const replies_by_parent = new Map<string, PostComment[]>();
	for (const reply of reply_rows.map(map_comment_row)) {
		if (!reply.parent_comment_id) {
			continue;
		}

		replies_by_parent.set(reply.parent_comment_id, [
			...(replies_by_parent.get(reply.parent_comment_id) ?? []),
			reply
		]);
	}

	const page_comments: PostComment[] = visible_rows.flatMap((row) => [
		map_comment_row(row),
		...(replies_by_parent.get(row.id) ?? [])
	]);

	return next_cursor
		? { comments: page_comments, has_more, next_cursor, total_count }
		: { comments: page_comments, has_more, total_count };
}

export async function has_recent_duplicate_comment(
	post_id: string,
	author_id: string,
	content: string,
	window_seconds: number
): Promise<boolean> {
	await initialize_comment_indexes();
	const db = get_db();
	const duplicate_rows = await db
		.select({ id: comments.id })
		.from(comments)
		.where(
			and(
				eq(comments.post_id, post_id),
				eq(comments.author_id, author_id),
				eq(comments.content, content),
				isNull(comments.deleted_at),
				gt(comments.created_at, new Date(Date.now() - window_seconds * 1000))
			)
		)
		.limit(1);

	return duplicate_rows.length > 0;
}

export async function create_comment(
	post_id: string,
	author_id: string,
	content: string,
	reply_to_comment_id?: string
): Promise<PostComment | undefined> {
	await initialize_comment_indexes();
	const db = get_db();
	const id = crypto.randomUUID();

	const post_rows = await db
		.select({ id: posts.id })
		.from(posts)
		.where(and(eq(posts.id, post_id), isNull(posts.deleted_at)))
		.limit(1);

	if (!post_rows[0]) {
		return undefined;
	}

	let parent_comment_id: string | undefined;
	let normalized_reply_to_comment_id: string | undefined;
	let reply_to_author_id: string | undefined;
	let reply_to_author_name: string | undefined;
	let reply_to_author_username: string | undefined;

	if (reply_to_comment_id) {
		const reply_to_rows = await db
			.select({
				id: comments.id,
				post_id: comments.post_id,
				parent_comment_id: comments.parent_comment_id,
				author_id: comments.author_id,
				author_name: user.name,
				author_username: profiles.username
			})
			.from(comments)
			.innerJoin(user, eq(comments.author_id, user.id))
			.leftJoin(profiles, eq(profiles.user_id, user.id))
			.where(and(eq(comments.id, reply_to_comment_id), isNull(comments.deleted_at)))
			.limit(1);

		const reply_to_comment = reply_to_rows[0];

		if (reply_to_comment?.post_id !== post_id) {
			return undefined;
		}

		parent_comment_id = reply_to_comment.parent_comment_id ?? reply_to_comment.id;
		normalized_reply_to_comment_id = reply_to_comment.id;
		reply_to_author_id = reply_to_comment.author_id;
		reply_to_author_name = reply_to_comment.author_name;
		reply_to_author_username = reply_to_comment.author_username ?? 'user';
	}

	await db.insert(comments).values({
		id,
		post_id,
		author_id,
		content,
		parent_comment_id,
		reply_to_comment_id: normalized_reply_to_comment_id
	});

	const author_rows = await db
		.select({ name: user.name, image: user.image, username: profiles.username })
		.from(user)
		.leftJoin(profiles, eq(profiles.user_id, user.id))
		.where(eq(user.id, author_id))
		.limit(1);

	const author = author_rows[0];

	return {
		id,
		parent_comment_id: nullable(parent_comment_id),
		reply_to_comment_id: nullable(normalized_reply_to_comment_id),
		reply_to_author_id: nullable(reply_to_author_id),
		reply_to_author_name: nullable(reply_to_author_name),
		reply_to_author_username: nullable(reply_to_author_username),
		content,
		created_at: new Date(),
		updated_at: new Date(),
		author_id,
		author_name: author?.name ?? 'User',
		author_username: author?.username ?? 'user',
		// eslint-disable-next-line unicorn/no-null
		author_avatar: author?.image ?? null,
		like_count: 0,
		has_liked: false
	};
}

export async function update_comment(
	comment_id: string,
	user_id: string,
	content: string
): Promise<{ success: true; comment: PostComment } | { success: false; error?: string }> {
	await initialize_comment_indexes();
	const db = get_db();

	const existing = await db
		.select({
			id: comments.id,
			author_id: comments.author_id
		})
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

	const updated_at = new Date();
	const updated_rows = await db
		.update(comments)
		.set({ content, updated_at })
		.where(eq(comments.id, comment_id))
		.returning({
			id: comments.id,
			parent_comment_id: comments.parent_comment_id,
			reply_to_comment_id: comments.reply_to_comment_id,
			content: comments.content,
			created_at: comments.created_at,
			updated_at: comments.updated_at,
			author_id: comments.author_id
		});

	const updated_comment = updated_rows[0];

	if (!updated_comment) {
		return { success: false, error: 'Comment not found' };
	}

	const author_rows = await db
		.select({ name: user.name, image: user.image, username: profiles.username })
		.from(user)
		.leftJoin(profiles, eq(profiles.user_id, user.id))
		.where(eq(user.id, user_id))
		.limit(1);

	const author = author_rows[0];
	let reply_to_author_name: string | undefined;
	let reply_to_author_username: string | undefined;
	let reply_to_author_id: string | undefined;

	if (updated_comment.reply_to_comment_id) {
		const reply_to_author_rows = await db
			.select({ id: user.id, name: user.name, username: profiles.username })
			.from(comments)
			.innerJoin(user, eq(comments.author_id, user.id))
			.leftJoin(profiles, eq(profiles.user_id, user.id))
			.where(eq(comments.id, updated_comment.reply_to_comment_id))
			.limit(1);

		reply_to_author_id = reply_to_author_rows[0]?.id;
		reply_to_author_name = reply_to_author_rows[0]?.name;
		reply_to_author_username = reply_to_author_rows[0]?.username ?? undefined;
	}

	return {
		success: true,
		comment: {
			id: updated_comment.id,
			parent_comment_id: updated_comment.parent_comment_id,
			reply_to_comment_id: updated_comment.reply_to_comment_id,
			reply_to_author_id: nullable(reply_to_author_id),
			reply_to_author_name: nullable(reply_to_author_name),
			reply_to_author_username: nullable(reply_to_author_username),
			content: updated_comment.content,
			created_at: updated_comment.created_at,
			updated_at: updated_comment.updated_at,
			author_id: updated_comment.author_id,
			author_name: author?.name ?? 'User',
			author_username: author?.username ?? 'user',
			// eslint-disable-next-line unicorn/no-null
			author_avatar: author?.image ?? null,
			like_count: 0,
			has_liked: false
		}
	};
}

export async function delete_comment(
	comment_id: string,
	user_id: string
): Promise<{ success: true; deleted_count: number } | { success: false; error?: string }> {
	await initialize_comment_indexes();
	const db = get_db();

	const existing = await db
		.select({
			id: comments.id,
			author_id: comments.author_id,
			parent_comment_id: comments.parent_comment_id,
			post_author_id: posts.author_id
		})
		.from(comments)
		.innerJoin(posts, eq(comments.post_id, posts.id))
		.where(and(eq(comments.id, comment_id), isNull(comments.deleted_at)))
		.limit(1);

	const existing_comment = existing[0];

	if (!existing_comment) {
		return { success: false, error: 'Comment not found' };
	}

	if (existing_comment.author_id !== user_id && existing_comment.post_author_id !== user_id) {
		return { success: false, error: 'Forbidden' };
	}

	const deleted_at = new Date();
	const deleted_rows = await db
		.update(comments)
		.set({ deleted_at })
		.where(
			existing_comment.parent_comment_id
				? eq(comments.id, comment_id)
				: or(eq(comments.id, comment_id), eq(comments.parent_comment_id, comment_id))
		)
		.returning({ id: comments.id });

	return { success: true, deleted_count: deleted_rows.length };
}

export async function hide_comment_for_user(
	comment_id: string,
	user_id: string
): Promise<{ success: boolean; error?: string }> {
	await initialize_comment_indexes();
	await initialize_hidden_comments_table();
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

	if (existing_comment.author_id === user_id) {
		return { success: false, error: 'Cannot hide your own comment' };
	}

	await db
		.insert(hidden_comments)
		.values({
			comment_id,
			user_id
		})
		.onConflictDoNothing();

	return { success: true };
}

export async function set_comment_like(
	comment_id: string,
	user_id: string,
	liked: boolean
): Promise<
	{ success: true; liked: boolean; like_count: number } | { success: false; error?: string }
> {
	await initialize_comment_indexes();
	await initialize_comment_likes_table();
	const db = get_db();

	const comment_rows = await db
		.select({ id: comments.id })
		.from(comments)
		.where(and(eq(comments.id, comment_id), isNull(comments.deleted_at)))
		.limit(1);

	if (!comment_rows[0]) {
		return { success: false, error: 'Comment not found' };
	}

	const like_where = and(
		eq(comment_likes.comment_id, comment_id),
		eq(comment_likes.user_id, user_id)
	);

	if (liked) {
		await db
			.insert(comment_likes)
			.values({
				comment_id,
				user_id
			})
			.onConflictDoNothing();
	} else {
		await db.delete(comment_likes).where(like_where);
	}

	const [count_rows, selected_rows] = await Promise.all([
		db
			.select({ value: count() })
			.from(comment_likes)
			.where(eq(comment_likes.comment_id, comment_id)),
		db
			.select({ comment_id: comment_likes.comment_id })
			.from(comment_likes)
			.where(like_where)
			.limit(1)
	]);

	return {
		success: true,
		liked: Boolean(selected_rows[0]),
		like_count: count_rows[0]?.value ?? 0
	};
}

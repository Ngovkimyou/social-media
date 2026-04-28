import { get_db } from '$lib/server/db';
import { hidden_posts, posts } from '$lib/server/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

let hidden_posts_init_promise: Promise<void> | undefined;

export const initialize_hidden_posts_table = async (): Promise<void> => {
	if (hidden_posts_init_promise !== undefined) {
		return hidden_posts_init_promise;
	}

	hidden_posts_init_promise = (async () => {
		const db = get_db();
		await db.execute(sql`
			create table if not exists hidden_post (
				post_id text not null references post(id) on delete cascade,
				user_id text not null references "user"(id) on delete cascade,
				created_at timestamp not null default now(),
				primary key (post_id, user_id)
			)
		`);
		await db.execute(sql`
			create index if not exists hidden_post_post_id_idx on hidden_post (post_id)
		`);
		await db.execute(sql`
			create index if not exists hidden_post_user_id_idx on hidden_post (user_id)
		`);
	})();

	return hidden_posts_init_promise;
};

export async function delete_post(
	post_id: string,
	user_id: string
): Promise<{ success: boolean; error?: string }> {
	const db = get_db();
	const existing = await db
		.select({ id: posts.id, author_id: posts.author_id })
		.from(posts)
		.where(and(eq(posts.id, post_id), isNull(posts.deleted_at)))
		.limit(1);
	const existing_post = existing[0];

	if (!existing_post) {
		return { success: false, error: 'Post not found' };
	}

	if (existing_post.author_id !== user_id) {
		return { success: false, error: 'Forbidden' };
	}

	await db.update(posts).set({ deleted_at: new Date() }).where(eq(posts.id, post_id));

	return { success: true };
}

export async function hide_post_for_user(
	post_id: string,
	user_id: string
): Promise<{ success: boolean; error?: string }> {
	await initialize_hidden_posts_table();
	const db = get_db();
	const existing = await db
		.select({ id: posts.id })
		.from(posts)
		.where(and(eq(posts.id, post_id), isNull(posts.deleted_at)))
		.limit(1);

	if (!existing[0]) {
		return { success: false, error: 'Post not found' };
	}

	await db
		.insert(hidden_posts)
		.values({
			post_id,
			user_id
		})
		.onConflictDoNothing();

	return { success: true };
}

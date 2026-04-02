import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { user as auth_user } from './auth.schema';

export const post_visibility = pgEnum('post_visibility', ['public', 'followers', 'private']);
export const media_type = pgEnum('media_type', ['image', 'video']);
export const reaction_type = pgEnum('reaction_type', [
	'like',
	'love',
	'haha',
	'wow',
	'sad',
	'angry'
]);

export const posts = pgTable(
	'post',
	{
		id: text('id').primaryKey(),
		author_id: text('author_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		visibility: post_visibility('visibility').notNull().default('public'),
		created_at: timestamp('created_at').defaultNow().notNull(),
		updated_at: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		deleted_at: timestamp('deleted_at')
	},
	(table) => [
		index('post_author_id_idx').on(table.author_id),
		index('post_created_at_idx').on(table.created_at)
	]
);

export const media = pgTable(
	'media',
	{
		id: text('id').primaryKey(),
		owner_id: text('owner_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		url: text('url').notNull(),
		type: media_type('type').notNull(),
		width: integer('width'),
		height: integer('height'),
		created_at: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('media_owner_id_idx').on(table.owner_id),
		index('media_created_at_idx').on(table.created_at)
	]
);

export const post_media = pgTable(
	'post_media',
	{
		post_id: text('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		media_id: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		sort_order: integer('sort_order').notNull().default(0)
	},
	(table) => [
		primaryKey({ columns: [table.post_id, table.media_id] }),
		index('post_media_post_id_idx').on(table.post_id),
		index('post_media_media_id_idx').on(table.media_id)
	]
);

export const reactions = pgTable(
	'reaction',
	{
		id: text('id').primaryKey(),
		post_id: text('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		user_id: text('user_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		type: reaction_type('type').notNull().default('like'),
		created_at: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('reaction_post_user_type_unique').on(table.post_id, table.user_id, table.type),
		index('reaction_post_id_idx').on(table.post_id),
		index('reaction_user_id_idx').on(table.user_id)
	]
);

export const comments = pgTable(
	'comment',
	{
		id: text('id').primaryKey(),
		post_id: text('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		author_id: text('author_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		created_at: timestamp('created_at').defaultNow().notNull(),
		updated_at: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		deleted_at: timestamp('deleted_at')
	},
	(table) => [
		index('comment_post_id_idx').on(table.post_id),
		index('comment_author_id_idx').on(table.author_id)
	]
);

export const follows = pgTable(
	'follow',
	{
		follower_id: text('follower_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		following_id: text('following_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		created_at: timestamp('created_at').defaultNow().notNull(),
		is_muted: boolean('is_muted').notNull().default(false)
	},
	(table) => [
		primaryKey({ columns: [table.follower_id, table.following_id] }),
		index('follow_follower_id_idx').on(table.follower_id),
		index('follow_following_id_idx').on(table.following_id)
	]
);

export const shares = pgTable(
	'share',
	{
		id: text('id').primaryKey(),
		post_id: text('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		user_id: text('user_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		comment_text: text('comment_text'),
		created_at: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('share_post_id_idx').on(table.post_id),
		index('share_user_id_idx').on(table.user_id)
	]
);

export const profiles = pgTable(
	'profile',
	{
		user_id: text('user_id')
			.primaryKey()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		username: text('username').notNull(),
		bio: text('bio'),
		location: text('location'),
		phone: text('phone'),
		created_at: timestamp('created_at').defaultNow().notNull(),
		updated_at: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('profile_username_unique').on(table.username),
		index('profile_user_id_idx').on(table.user_id)
	]
);

// Better Auth tables are generated into auth.schema.ts and re-exported here.
export * from './auth.schema';

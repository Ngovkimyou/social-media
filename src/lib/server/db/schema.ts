import {
	bigserial,
	boolean,
	customType,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user as auth_user } from './auth.schema';

const tsvector = customType<{ data: string }>({
	dataType() {
		return 'tsvector';
	}
});

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

export const likes = pgTable(
	'like',
	{
		post_id: text('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		user_id: text('user_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		created_at: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.post_id, table.user_id] }),
		index('like_post_id_idx').on(table.post_id),
		index('like_user_id_idx').on(table.user_id)
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

export const post_shares = pgTable(
	'post_share',
	{
		post_id: text('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		user_id: text('user_id')
			.notNull()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		created_at: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.post_id, table.user_id] }),
		index('post_share_post_id_idx').on(table.post_id),
		index('post_share_user_id_idx').on(table.user_id)
	]
);

export const profiles = pgTable(
	'profile',
	{
		user_id: text('user_id')
			.primaryKey()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		username: text('username').notNull(),
		cover_image: text('cover_image'),
		bio: text('bio'),
		location: text('location'),
		phone: text('phone'),
		email_visible: boolean('email_visible').default(false).notNull(),
		created_at: timestamp('created_at').defaultNow().notNull(),
		updated_at: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [uniqueIndex('profile_username_unique').on(table.username)]
);

export const profile_search_index = pgTable(
	'profile_search_index',
	{
		user_id: text('user_id')
			.primaryKey()
			.references(() => auth_user.id, { onDelete: 'cascade' }),
		username: text('username').notNull(),
		name: text('name').notNull(),
		search_vector: tsvector('search_vector').notNull()
	},
	(table) => [index('profile_search_index_search_vector_idx').using('gin', table.search_vector)]
);

export const auth_rate_limit_bucket = pgTable('auth_rate_limit_bucket', {
	bucket_key: text('bucket_key').primaryKey(),
	attempt_count: integer('attempt_count').notNull(),
	expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
	lock_level: integer('lock_level').notNull().default(0)
});

export const auth_identifier_attack_window = pgTable(
	'auth_identifier_attack_window',
	{
		attack_key: text('attack_key').notNull(),
		ip_address: text('ip_address').notNull(),
		expires_at: timestamp('expires_at', { withTimezone: true }).notNull()
	},
	(table) => [primaryKey({ columns: [table.attack_key, table.ip_address] })]
);

export const search_rate_limit_bucket = pgTable('search_rate_limit_bucket', {
	bucket_key: text('bucket_key').primaryKey(),
	attempt_count: integer('attempt_count').notNull(),
	expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
	penalty_expires_at: timestamp('penalty_expires_at', { withTimezone: true }),
	rate_limit_hits: integer('rate_limit_hits').notNull().default(0),
	broad_query_count: integer('broad_query_count').notNull().default(0),
	seen_queries: text('seen_queries')
		.array()
		.notNull()
		.default(sql`'{}'::text[]`)
});

export const social_action_rate_limit_bucket = pgTable('social_action_rate_limit_bucket', {
	bucket_key: text('bucket_key').primaryKey(),
	attempt_count: integer('attempt_count').notNull(),
	expires_at: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const social_action_cooldown = pgTable('social_action_cooldown', {
	cooldown_key: text('cooldown_key').primaryKey(),
	expires_at: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const security_event_log = pgTable('security_event_log', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	category: text('category').notNull(),
	actor_key: text('actor_key').notNull(),
	user_id: text('user_id'),
	ip_address: text('ip_address'),
	path: text('path'),
	details: text('details'),
	created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const security_alert_window = pgTable('security_alert_window', {
	alert_key: text('alert_key').primaryKey(),
	event_count: integer('event_count').notNull(),
	expires_at: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const post_rate_limit_bucket = pgTable('post_rate_limit_bucket', {
	bucket_key: text('bucket_key').primaryKey(),
	attempt_count: integer('attempt_count').notNull(),
	expires_at: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const post_image_fingerprint = pgTable('post_image_fingerprint', {
	fingerprint_key: text('fingerprint_key').primaryKey(),
	expires_at: timestamp('expires_at', { withTimezone: true }).notNull()
});

// Better Auth tables are generated into auth.schema.ts and re-exported here.
export * from './auth.schema';

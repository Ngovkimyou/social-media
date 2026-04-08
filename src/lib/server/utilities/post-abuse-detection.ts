import { get_db } from '$lib/server/db';
import { record_security_event } from '$lib/server/utilities/security-monitor';
import type { RequestEvent } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';

const IMAGE_FINGERPRINT_WINDOW_MINUTES = 10;

let init_promise: Promise<void> | undefined;
let use_memory_store = false;

const memory_image_fingerprints = new Map<string, number>();

const initialize_post_abuse_store = async (): Promise<void> => {
	if (init_promise !== undefined) {
		return init_promise;
	}

	init_promise = (async () => {
		const db = get_db();
		try {
			await db.execute(sql`
				create table if not exists post_image_fingerprint (
					fingerprint_key text primary key,
					expires_at timestamptz not null
				)
			`);
		} catch (error) {
			use_memory_store = true;
			console.warn(
				`Post abuse detection store is using in-memory fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	})();

	return init_promise;
};

const create_fingerprint_key = (author_id: string, image_hash: string): string =>
	`${author_id}:${image_hash}`;

const create_image_hash = async (file: File): Promise<string> => {
	const buffer = Buffer.from(await file.arrayBuffer());
	return createHash('sha256').update(buffer).digest('hex');
};

export const reject_recent_duplicate_image = async (params: {
	author_id: string;
	event: RequestEvent;
	file: File;
}): Promise<{ image_hash: string } | { error_message: string }> => {
	await initialize_post_abuse_store();

	const { author_id, event, file } = params;
	const image_hash = await create_image_hash(file);
	const fingerprint_key = create_fingerprint_key(author_id, image_hash);
	const now = Date.now();

	if (use_memory_store) {
		const expires_at_ms = memory_image_fingerprints.get(fingerprint_key);
		if (expires_at_ms && expires_at_ms > now) {
			await record_security_event({
				category: 'duplicate_image',
				details: 'memory-window',
				event
			});
			return {
				error_message: 'You already uploaded this image recently. Please choose a different photo.'
			};
		}

		return { image_hash };
	}

	const db = get_db();
	const rows = await db.execute<{ expires_at: Date }>(sql`
		select expires_at
		from post_image_fingerprint
		where fingerprint_key = ${fingerprint_key}
		limit 1
	`);
	const current = rows.rows[0];

	if (current && new Date(current.expires_at).getTime() > now) {
		await record_security_event({
			category: 'duplicate_image',
			details: 'db-window',
			event
		});
		return {
			error_message: 'You already uploaded this image recently. Please choose a different photo.'
		};
	}

	return { image_hash };
};

export const record_post_image_fingerprint = async (
	author_id: string,
	image_hash: string
): Promise<void> => {
	await initialize_post_abuse_store();

	const fingerprint_key = create_fingerprint_key(author_id, image_hash);
	const expires_at_ms = Date.now() + IMAGE_FINGERPRINT_WINDOW_MINUTES * 60 * 1000;

	if (use_memory_store) {
		memory_image_fingerprints.set(fingerprint_key, expires_at_ms);
		return;
	}

	const db = get_db();
	await db.execute(sql`
		insert into post_image_fingerprint (fingerprint_key, expires_at)
		values (
			${fingerprint_key},
			now() + (${IMAGE_FINGERPRINT_WINDOW_MINUTES} * interval '1 minute')
		)
		on conflict (fingerprint_key)
		do update set
			expires_at = now() + (${IMAGE_FINGERPRINT_WINDOW_MINUTES} * interval '1 minute')
	`);
};

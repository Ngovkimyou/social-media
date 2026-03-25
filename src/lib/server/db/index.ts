import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const resolve_database_url = (): string => {
	const database_url = env['DATABASE_URL'];

	if (!database_url || database_url === 'postgres://user:password@127.0.0.1:5432/db-name') {
		throw new Error('DATABASE_URL is not configured. Set it to your Neon connection string.');
	}

	return database_url;
};

const client = neon(resolve_database_url());

export const db = drizzle(client, { schema });

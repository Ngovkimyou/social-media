import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const fallback_database_url = 'postgres://user:password@127.0.0.1:5432/db-name';

const resolve_database_url = (): string => {
	if (!env.DATABASE_URL || env.DATABASE_URL === 'postgres://user:password@host:port/db-name') {
		return fallback_database_url;
	}

	return env.DATABASE_URL;
};

const client = neon(resolve_database_url());

export const db = drizzle(client, { schema });

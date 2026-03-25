import { defineConfig } from 'drizzle-kit';

const migration_url = process.env.DATABASE_URL_FOR_MIGRATIONS ?? process.env.DATABASE_URL;

if (!migration_url) {
	throw new Error('DATABASE_URL or DATABASE_URL_FOR_MIGRATIONS is not set');
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: migration_url },
	verbose: true,
	strict: true
});

# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.12.8 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:vercel" better-auth="demo:password" drizzle="database:postgresql+postgresql:neon" mdsvex paraglide="languageTags:en, ja, km+demo:yes" storybook --install pnpm .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Neon Database Setup

1. Create a Neon project and database.
2. Copy two connection strings from Neon:
   - Pooled URL for app traffic (`...-pooler...`)
   - Direct URL for migrations (`...ep-...` without pooler)
3. Add them to your local `.env`:

```sh
DATABASE_URL="postgresql://...-pooler.../dbname?sslmode=require"
DATABASE_URL_FOR_MIGRATIONS="postgresql://.../dbname?sslmode=require"
```

4. Generate Better Auth tables (once):

```sh
pnpm run auth:schema
```

5. Push schema to Neon:

```sh
pnpm run db:push
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

import { get_home_feed_page, HOME_FEED_PAGE_SIZE } from '$lib/server/utilities/home-feed';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const cursor = url.searchParams.get('cursor') ?? undefined;
	const requested_limit = Number(url.searchParams.get('limit') ?? HOME_FEED_PAGE_SIZE);
	const page = await get_home_feed_page(requested_limit, cursor);

	return json(page);
};

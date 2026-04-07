import { HOME_FEED_GRID_PAGE_SIZE, HOME_FEED_PAGE_SIZE } from '$lib/constants/home-feed';
import { get_home_feed_page } from '$lib/server/utilities/home-feed';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const cursor = url.searchParams.get('cursor') ?? undefined;
	const requested_view = url.searchParams.get('view');
	const default_limit = requested_view === 'grid' ? HOME_FEED_GRID_PAGE_SIZE : HOME_FEED_PAGE_SIZE;
	const requested_limit = Number(url.searchParams.get('limit') ?? default_limit);
	const page = await get_home_feed_page(requested_limit, cursor);

	return json(page);
};

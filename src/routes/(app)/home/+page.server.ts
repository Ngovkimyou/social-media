import { HOME_FEED_GRID_PAGE_SIZE } from '$lib/constants/home-feed';
import { get_home_feed_page } from '$lib/server/utilities/home-feed';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) =>
	get_home_feed_page(
		url.searchParams.get('view') === 'grid' ? HOME_FEED_GRID_PAGE_SIZE : undefined
	);

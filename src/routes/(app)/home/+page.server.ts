import { get_home_feed_page } from '$lib/server/utilities/home-feed';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => get_home_feed_page();

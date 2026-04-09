import { HOME_FEED_GRID_PAGE_SIZE, HOME_FEED_PAGE_SIZE } from '$lib/constants/home-feed';
import { get_home_feed_page } from '$lib/server/utilities/home-feed';
import { record_security_event } from '$lib/server/utilities/security-monitor';
import { consume_social_action_rate_limit } from '$lib/server/utilities/social-action-rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const rate_limit = await consume_social_action_rate_limit(event, 'home-feed');
	if (!rate_limit.is_allowed) {
		await record_security_event({
			category: 'rate_limit_home_feed',
			details: `retry_after=${rate_limit.retry_after_seconds}`,
			event
		});
		return json(
			{ error: 'Too many feed requests. Please try again shortly.' },
			{
				status: 429,
				headers: {
					'retry-after': `${rate_limit.retry_after_seconds}`
				}
			}
		);
	}

	const cursor = url.searchParams.get('cursor') ?? undefined;
	const requested_view = url.searchParams.get('view');
	const default_limit = requested_view === 'grid' ? HOME_FEED_GRID_PAGE_SIZE : HOME_FEED_PAGE_SIZE;
	const requested_limit = Number(url.searchParams.get('limit') ?? default_limit);
	const page = await get_home_feed_page(requested_limit, cursor);

	return json(page);
};

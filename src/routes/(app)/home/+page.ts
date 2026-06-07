import { browser } from '$app/environment';
import { HOME_FEED_GRID_PAGE_SIZE, HOME_FEED_PAGE_SIZE } from '$lib/constants/home-feed';
import {
	get_home_feed_cache,
	set_home_feed_cache,
	type HomeFeedCachePage,
	type HomeFeedCacheView
} from '$lib/state/home-feed-cache';
import type { PostFeedPost } from '$lib/types/post-feed';
import type { PageLoad } from './$types';

type SerializedPostFeedPost = Omit<PostFeedPost, 'created_at' | 'updated_at' | 'shared_at'> & {
	created_at: string | Date;
	updated_at: string | Date;
	shared_at?: string | Date;
};

function get_home_feed_view(url: URL): HomeFeedCacheView {
	return url.searchParams.get('view') === 'grid' ? 'grid' : 'feed';
}

function normalize_post(post: SerializedPostFeedPost): PostFeedPost {
	const { created_at, updated_at, shared_at, ...rest } = post;

	return {
		...rest,
		created_at: new Date(created_at),
		updated_at: new Date(updated_at),
		...(shared_at ? { shared_at: new Date(shared_at) } : {})
	};
}

function normalize_page(page: {
	posts: SerializedPostFeedPost[];
	has_more: boolean;
	next_cursor?: string;
}): HomeFeedCachePage {
	return {
		posts: page.posts.map(normalize_post),
		has_more: page.has_more,
		...(page.next_cursor ? { next_cursor: page.next_cursor } : {})
	};
}

export const load: PageLoad = async ({ fetch, url }) => {
	const view = get_home_feed_view(url);
	const cached_page = browser ? get_home_feed_cache(view) : undefined;

	if (cached_page) {
		return cached_page;
	}

	const params = new URLSearchParams({
		view,
		limit: String(view === 'grid' ? HOME_FEED_GRID_PAGE_SIZE : HOME_FEED_PAGE_SIZE)
	});
	const response = await fetch(`/api/home-feed?${params.toString()}`);

	if (!response.ok) {
		return {
			posts: [],
			has_more: false
		};
	}

	const page = normalize_page(
		(await response.json()) as {
			posts: SerializedPostFeedPost[];
			has_more: boolean;
			next_cursor?: string;
		}
	);

	if (browser) {
		set_home_feed_cache(view, page);
	}

	return page;
};

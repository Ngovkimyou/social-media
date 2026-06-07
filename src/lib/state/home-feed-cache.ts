import type { PostFeedPost } from '$lib/types/post-feed';

export type HomeFeedCacheView = 'feed' | 'grid';

export type HomeFeedCachePage = {
	posts: PostFeedPost[];
	has_more: boolean;
	next_cursor?: string;
};

const home_feed_cache = new Map<HomeFeedCacheView, HomeFeedCachePage>();

export function get_home_feed_cache(view: HomeFeedCacheView): HomeFeedCachePage | undefined {
	return home_feed_cache.get(view);
}

export function set_home_feed_cache(view: HomeFeedCacheView, page: HomeFeedCachePage): void {
	home_feed_cache.set(view, page);
}

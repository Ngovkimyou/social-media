export type HomeFeedState = {
	return_href: string;
	scroll_top: number;
	anchor_post_id: string;
};

let last_home_feed_state: HomeFeedState | undefined;

export function get_last_home_feed_state(): HomeFeedState | undefined {
	return last_home_feed_state;
}

export function set_last_home_feed_state(next_state: HomeFeedState): void {
	last_home_feed_state = next_state;
}

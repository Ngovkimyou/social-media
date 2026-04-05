<script lang="ts">
	import { page } from '$app/state';
	import PostFeedView from '$lib/components/PostFeedView.svelte';
	import { set_last_home_feed_state, type HomeFeedState } from '$lib/state/home-feed-state';
	import type { PageData, Snapshot } from './$types';

	const { data }: { data: PageData } = $props();
	const load_more_path = $derived(`/home?page=${data.page + 1}` as `/home?${string}`);
	const last_home_state_storage_key = 'post-feed-last-home-state';

	function get_active_home_scroll_container() {
		const selector = window.matchMedia('(min-width: 768px)').matches
			? '.post-feed-scroll'
			: '.post-feed-page';

		const container = document.querySelector(selector);
		return container instanceof HTMLElement ? container : undefined;
	}

	function get_home_anchor_post_id(active_scroll_container: HTMLElement) {
		const container_top = active_scroll_container.getBoundingClientRect().top;
		const post_elements = Array.from(document.querySelectorAll<HTMLElement>('[data-post-id]'));
		let anchor_post_id = '';
		let nearest_distance = Number.POSITIVE_INFINITY;

		for (const post_element of post_elements) {
			const post_id = post_element.dataset['postId'];
			const { top, bottom } = post_element.getBoundingClientRect();

			if (!post_id || bottom <= container_top) {
				continue;
			}

			const distance = Math.abs(top - container_top);

			if (distance >= nearest_distance) {
				continue;
			}

			nearest_distance = distance;
			anchor_post_id = post_id;
		}

		return anchor_post_id;
	}

	function persist_home_snapshot(next_state: HomeFeedState) {
		set_last_home_feed_state(next_state);

		try {
			sessionStorage.setItem(last_home_state_storage_key, JSON.stringify(next_state));
		} catch {
			// Ignore storage failures.
		}
	}

	function apply_home_snapshot(next_state: HomeFeedState) {
		const active_scroll_container = get_active_home_scroll_container();

		if (!active_scroll_container) {
			return;
		}

		const anchor_post = next_state.anchor_post_id
			? document.querySelector<HTMLElement>(`[data-post-id="${next_state.anchor_post_id}"]`)
			: undefined;

		if (anchor_post instanceof HTMLElement) {
			anchor_post.scrollIntoView({ block: 'start', behavior: 'auto' });
		}

		active_scroll_container.scrollTop = next_state.scroll_top;
	}

	export const snapshot: Snapshot<HomeFeedState | undefined> = {
		capture: () => {
			const active_scroll_container = get_active_home_scroll_container();

			if (!active_scroll_container) {
				return;
			}

			const next_state: HomeFeedState = {
				return_href: `${page.url.pathname}${page.url.search}`,
				scroll_top: active_scroll_container.scrollTop,
				anchor_post_id: get_home_anchor_post_id(active_scroll_container)
			};

			persist_home_snapshot(next_state);
			return next_state;
		},
		restore: (value) => {
			if (!value) {
				return;
			}

			persist_home_snapshot(value);

			requestAnimationFrame(() => {
				apply_home_snapshot(value);
			});
			setTimeout(() => {
				apply_home_snapshot(value);
			}, 120);
			setTimeout(() => {
				apply_home_snapshot(value);
			}, 320);
		}
	};
</script>

<PostFeedView posts={data.posts} title="Feed" hasLoadMore={data.has_more} {load_more_path} />

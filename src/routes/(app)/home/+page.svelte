<script lang="ts">
	import { page } from '$app/state';
	import { HOME_FEED_GRID_PAGE_SIZE, HOME_FEED_PAGE_SIZE } from '$lib/constants/home-feed';
	import PostFeedView from '$lib/components/PostFeedView.svelte';
	import { set_last_home_feed_state, type HomeFeedState } from '$lib/state/home-feed-state';
	import type { PostFeedPost } from '$lib/types/post-feed';
	import { SvelteSet } from 'svelte/reactivity';
	import type { PageData, Snapshot } from './$types';

	const { data }: { data: PageData } = $props();
	const last_home_state_storage_key = 'post-feed-last-home-state';
	let posts = $state<PostFeedPost[]>([]);
	let has_more = $state<boolean | undefined>();
	let next_cursor = $state<string | undefined>();
	let is_loading_more = $state(false);
	let load_more_error = $state('');
	const effective_posts = $derived(posts.length > 0 ? posts : data.posts);
	const effective_has_more = $derived(has_more ?? data.has_more);
	const effective_next_cursor = $derived(next_cursor ?? data.next_cursor);

	function get_current_feed_posts(): PostFeedPost[] {
		return posts.length > 0 ? posts : data.posts;
	}

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

	function merge_posts(
		existing_posts: PostFeedPost[],
		incoming_posts: Array<Omit<PostFeedPost, 'created_at'> & { created_at: string | Date }>
	): PostFeedPost[] {
		const merged_posts = [...existing_posts];
		const seen_post_ids = new SvelteSet(existing_posts.map((post) => post.id));

		for (const post of incoming_posts) {
			if (seen_post_ids.has(post.id)) {
				continue;
			}

			merged_posts.push({
				...post,
				created_at: new Date(post.created_at)
			});
			seen_post_ids.add(post.id);
		}

		return merged_posts;
	}

	async function load_more_posts() {
		if (is_loading_more || !effective_has_more || !effective_next_cursor) {
			return;
		}

		is_loading_more = true;
		load_more_error = '';

		try {
			const is_grid_view = page.url.searchParams.get('view') === 'grid';
			const params = new URLSearchParams({
				cursor: effective_next_cursor,
				view: is_grid_view ? 'grid' : 'feed',
				limit: String(is_grid_view ? HOME_FEED_GRID_PAGE_SIZE : HOME_FEED_PAGE_SIZE)
			});
			const response = await fetch(`/api/home-feed?${params.toString()}`);

			if (!response.ok) {
				throw new Error(`Failed to load posts: ${response.status}`);
			}

			const payload = (await response.json()) as {
				posts: Array<Omit<PostFeedPost, 'created_at'> & { created_at: string }>;
				has_more: boolean;
				next_cursor?: string;
			};

			posts = merge_posts(get_current_feed_posts(), payload.posts);
			has_more = payload.has_more;
			next_cursor = payload.next_cursor;
		} catch {
			load_more_error = 'Unable to load more posts right now.';
		} finally {
			is_loading_more = false;
		}
	}

	$effect(() => {
		load_more_error = '';
		posts = [];
		has_more = undefined;
		next_cursor = undefined;
	});

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

<PostFeedView
	posts={effective_posts}
	title="Feed"
	has_more={effective_has_more}
	{is_loading_more}
	{load_more_error}
	on_load_more={load_more_posts}
	current_user_id={data.current_user_id}
/>

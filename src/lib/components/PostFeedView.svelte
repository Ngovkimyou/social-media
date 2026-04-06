<script lang="ts">
	import './post-feed-view.css';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onDestroy, onMount, tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { fade, scale } from 'svelte/transition';
	import {
		get_last_home_feed_state,
		set_last_home_feed_state,
		type HomeFeedState
	} from '$lib/state/home-feed-state';
	import type { PostFeedPost } from '$lib/types/post-feed';

	type BackPath = '/profile' | `/profile/${string}`;
	type PostPath = `/profile/${string}/posts/${string}`;
	const last_home_state_storage_key = 'post-feed-last-home-state';

	type Props = {
		posts: PostFeedPost[];
		title: string;
		subtitle?: string;
		back_path?: BackPath;
		get_post_path?: ((post: PostFeedPost) => PostPath) | undefined;
		has_more?: boolean;
		is_loading_more?: boolean;
		load_more_error?: string;
		on_load_more?: (() => Promise<void> | void) | undefined;
	};

	const {
		posts,
		title,
		subtitle,
		back_path,
		get_post_path,
		has_more = false,
		is_loading_more = false,
		load_more_error = '',
		on_load_more
	}: Props = $props();

	const requested_view = $derived(page.url.searchParams.get('view') === 'grid' ? 'grid' : 'feed');
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const isGridView = $derived(requested_view === 'grid');
	let expanded_captions = $state<Record<string, boolean>>({});
	let overflowing_captions = $state<Record<string, boolean>>({});
	let root_container = $state<HTMLDivElement | undefined>();
	let scroll_container = $state<HTMLDivElement | undefined>();
	let mounted_scroll_storage_key = $state('');
	let image_preview_backdrop = $state<HTMLDivElement | undefined>();
	let image_preview = $state<
		| {
				src: string;
				alt: string;
		  }
		| undefined
	>();
	let liked_posts = $state<Record<string, boolean>>({});
	let pending_preview_timers = $state<Record<string, ReturnType<typeof setTimeout> | undefined>>(
		{}
	);
	// eslint-disable-next-line @typescript-eslint/naming-convention
	let hasConsumedFocusPost = $state(false);
	const post_elements = new SvelteMap<string, HTMLElement>();
	const current_return_to = $derived(`${page.url.pathname}${page.url.search}${page.url.hash}`);
	const focus_post_id = $derived(page.url.searchParams.get('focusPost')?.trim() ?? '');
	const has_infinite_feed = $derived(Boolean(on_load_more));

	function caption_key(view: 'grid' | 'feed', post_id: string | number) {
		return `${view}-${String(post_id)}`;
	}

	function time_ago(date: Date): string {
		const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
		if (seconds < 60) return 'a few moments ago';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			const rounded = minutes < 5 ? 1 : Math.floor(minutes / 5) * 5;
			return `${rounded} minute${rounded === 1 ? '' : 's'} ago`;
		}
		const hours = Math.floor(seconds / 3600);
		if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
		const days = Math.floor(seconds / 86400);
		return `${days} day${days === 1 ? '' : 's'} ago`;
	}

	function toggle_caption(caption_id: string) {
		expanded_captions = {
			...expanded_captions,
			[caption_id]: !expanded_captions[caption_id]
		};
	}

	function set_caption_overflow(caption_id: string, is_overflowing: boolean) {
		if (overflowing_captions[caption_id] === is_overflowing) {
			return;
		}

		overflowing_captions = {
			...overflowing_captions,
			[caption_id]: is_overflowing
		};
	}

	function measure_caption(node: HTMLElement, caption_id: string): { destroy(): void } {
		const update = () => {
			set_caption_overflow(caption_id, node.scrollHeight > node.clientHeight + 1);
		};

		const resize_observer = new ResizeObserver(() => {
			update();
		});

		resize_observer.observe(node);
		requestAnimationFrame(update);

		return {
			destroy() {
				resize_observer.disconnect();
			}
		};
	}

	function register_post_element(node: HTMLElement, post_id: string): { destroy(): void } {
		node.dataset['postId'] = post_id;
		post_elements.set(post_id, node);

		return {
			destroy() {
				delete node.dataset['postId'];
				post_elements.delete(post_id);
			}
		};
	}

	function get_active_scroll_container() {
		if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
			return scroll_container;
		}

		return root_container;
	}

	function open_image_preview(src: string, alt: string) {
		image_preview = { src, alt };
	}

	function close_image_preview() {
		image_preview = undefined;
	}

	function clear_pending_preview(post_id: string | number) {
		const timer = pending_preview_timers[String(post_id)];

		if (!timer) {
			return;
		}

		clearTimeout(timer);
		pending_preview_timers = {
			...pending_preview_timers,
			[String(post_id)]: undefined
		};
	}

	function schedule_image_preview(post_id: string | number, src: string, alt: string) {
		clear_pending_preview(post_id);
		pending_preview_timers = {
			...pending_preview_timers,
			[String(post_id)]: setTimeout(() => {
				open_image_preview(src, alt);
				clear_pending_preview(post_id);
			}, 220)
		};
	}

	function toggle_like(post_id: string | number) {
		const key = String(post_id);
		liked_posts = {
			...liked_posts,
			[key]: !liked_posts[key]
		};
	}

	function get_scroll_anchor_post_id(active_scroll_container: HTMLElement) {
		const container_top = active_scroll_container.getBoundingClientRect().top;
		let nearest_post_id = '';
		let nearest_distance = Number.POSITIVE_INFINITY;

		for (const [post_id, post_element] of post_elements) {
			const { top, bottom } = post_element.getBoundingClientRect();

			if (bottom <= container_top) {
				continue;
			}

			const distance = Math.abs(top - container_top);

			if (distance < nearest_distance) {
				nearest_distance = distance;
				nearest_post_id = post_id;
			}
		}

		return nearest_post_id;
	}

	async function update_view_query(next_view: 'grid' | 'feed') {
		const next_url = new URL(page.url);

		if (next_view === 'grid') {
			next_url.searchParams.set('view', 'grid');
		} else {
			next_url.searchParams.delete('view');
		}

		const next_href = `${next_url.pathname}${next_url.search}${next_url.hash}`;

		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(next_href, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function persist_scroll_position() {
		const active_scroll_container = get_active_scroll_container();

		if (!active_scroll_container || !mounted_scroll_storage_key) {
			return;
		}

		try {
			const next_state: HomeFeedState = {
				return_href: `${page.url.pathname}${page.url.search}`,
				scroll_top: active_scroll_container.scrollTop,
				anchor_post_id: get_scroll_anchor_post_id(active_scroll_container)
			};
			const serialized_state = JSON.stringify(next_state);

			sessionStorage.setItem(mounted_scroll_storage_key, serialized_state);

			if (page.url.pathname === '/home') {
				set_last_home_feed_state(next_state);
				sessionStorage.setItem(last_home_state_storage_key, serialized_state);
			}
		} catch {
			// Ignore storage failures.
		}
	}

	function restore_scroll_position() {
		const active_scroll_container = get_active_scroll_container();

		if (!active_scroll_container || !mounted_scroll_storage_key) {
			return;
		}

		try {
			const saved_state =
				(page.url.pathname === '/home' ? get_last_home_feed_state() : undefined) ??
				(sessionStorage.getItem(mounted_scroll_storage_key)
					? (JSON.parse(sessionStorage.getItem(mounted_scroll_storage_key)!) as HomeFeedState)
					: undefined) ??
				(sessionStorage.getItem(last_home_state_storage_key)
					? (JSON.parse(sessionStorage.getItem(last_home_state_storage_key)!) as HomeFeedState)
					: undefined);

			if (!saved_state) {
				return;
			}

			const next_scroll_top = Number(saved_state.scroll_top ?? 0);

			const apply_scroll_restore = () => {
				const anchor_post = saved_state.anchor_post_id
					? post_elements.get(saved_state.anchor_post_id)
					: undefined;

				if (anchor_post) {
					anchor_post.scrollIntoView({ block: 'start', behavior: 'auto' });
				}

				active_scroll_container.scrollTop = next_scroll_top;
			};

			apply_scroll_restore();
			requestAnimationFrame(apply_scroll_restore);
			setTimeout(apply_scroll_restore, 120);
			setTimeout(apply_scroll_restore, 320);
		} catch {
			// Ignore storage failures.
		}
	}

	function restore_focus_post() {
		if (!focus_post_id || hasConsumedFocusPost) {
			return false;
		}

		const target_post = post_elements.get(focus_post_id);

		if (!target_post) {
			return false;
		}

		hasConsumedFocusPost = true;
		target_post.scrollIntoView({ block: 'start', behavior: 'auto' });
		const cleaned_url = new URL(page.url);
		cleaned_url.searchParams.delete('focusPost');
		const cleaned_href = `${cleaned_url.pathname}${cleaned_url.search}${cleaned_url.hash}`;
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(cleaned_href, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
		return true;
	}

	function request_more_posts() {
		if (!has_more || is_loading_more || !on_load_more) {
			return;
		}

		void on_load_more();
	}

	function get_load_more_threshold() {
		if (typeof window === 'undefined') {
			return 320;
		}

		const is_desktop = window.matchMedia('(min-width: 768px)').matches;
		const is_grid_view = page.url.searchParams.get('view') === 'grid';

		if (is_grid_view) {
			return is_desktop ? 900 : 700;
		}

		return is_desktop ? 600 : 450;
	}

	function maybe_load_more() {
		if (!has_infinite_feed || !has_more || is_loading_more || !on_load_more) {
			return;
		}

		const active_scroll_container = get_active_scroll_container();

		if (!active_scroll_container) {
			return;
		}

		const remaining_distance =
			active_scroll_container.scrollHeight -
			active_scroll_container.clientHeight -
			active_scroll_container.scrollTop;

		if (remaining_distance <= get_load_more_threshold()) {
			request_more_posts();
		}
	}

	function handle_feed_scroll() {
		persist_scroll_position();
		maybe_load_more();
	}

	onMount(() => {
		mounted_scroll_storage_key = `post-feed-scroll:${page.url.pathname}${page.url.search}`;

		void tick().then(() => {
			const active_scroll_container = get_active_scroll_container();

			if (!active_scroll_container) {
				return;
			}

			if (restore_focus_post()) {
				return;
			}

			restore_scroll_position();
			maybe_load_more();
		});
	});

	$effect(() => {
		if (!has_infinite_feed || is_loading_more) {
			return;
		}

		void tick().then(() => {
			maybe_load_more();
		});
	});

	afterNavigate(() => {
		void tick().then(() => {
			if (restore_focus_post()) {
				return;
			}

			restore_scroll_position();
			maybe_load_more();
		});
	});

	beforeNavigate(() => {
		persist_scroll_position();
	});

	$effect(() => {
		if (!image_preview) {
			return;
		}

		void tick().then(() => {
			image_preview_backdrop?.focus();
		});
	});

	onDestroy(() => {
		for (const timer of Object.values(pending_preview_timers)) {
			if (timer) {
				clearTimeout(timer);
			}
		}

		persist_scroll_position();
	});
</script>

<div
	bind:this={root_container}
	class="post-feed-page flex h-screen min-h-0 flex-col overflow-x-hidden overflow-y-auto bg-[#09051c] text-white md:overflow-hidden"
	onscroll={handle_feed_scroll}
>
	<div
		class="z-10 flex items-center justify-between bg-[#09051c] p-4 md:sticky md:top-0 md:p-6 lg:p-8"
	>
		<div class="flex min-w-0 items-center gap-3 md:gap-4">
			{#if back_path}
				<a
					href={resolve(back_path)}
					class="group shrink-0 text-white/70 transition-colors duration-200 hover:text-white"
					aria-label="Go back"
				>
					<img
						src="/images/profile/go-back-icon.avif"
						alt=""
						class="h-8 w-8 transform object-contain transition-all duration-300 ease-out group-hover:scale-110 md:h-10 md:w-10"
					/>
				</a>
			{/if}

			<div class="min-w-0">
				{#if subtitle}
					<p class="truncate text-xs font-semibold tracking-[0.24em] text-sky-200/85 uppercase">
						{subtitle}
					</p>
				{/if}
				<h2 class="truncate text-2xl font-bold text-white md:text-4xl">{title}</h2>
			</div>
		</div>

		<button
			class="group shrink-0 transition-colors duration-200 {isGridView
				? 'text-white'
				: 'text-white/70'} hover:text-white"
			onclick={() => {
				void update_view_query(isGridView ? 'feed' : 'grid');
			}}
			aria-label={isGridView ? 'Switch to feed view' : 'Switch to grid view'}
		>
			<img
				src="/images/home-screen/content-grid-view.avif"
				alt=""
				class="h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110 {isGridView
					? 'opacity-100'
					: 'opacity-70'} md:h-7 md:w-7"
			/>
		</button>
	</div>

	<div
		bind:this={scroll_container}
		class="post-feed-scroll min-h-0 flex-1 overflow-visible px-4 pb-6 md:overflow-y-auto md:overscroll-y-none md:px-8 md:pb-8"
		onscroll={handle_feed_scroll}
	>
		{#if isGridView}
			<div
				class="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-2.5 lg:grid-cols-3 lg:gap-4 xl:gap-6 2xl:gap-8"
			>
				{#each posts as post (post.id)}
					<div
						use:register_post_element={post.id}
						class="overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
					>
						<div class="flex items-center gap-3 px-5 pt-5 md:gap-3">
							<a
								href={resolve(
									`/profile/${encodeURIComponent(post.author_username)}?returnTo=${encodeURIComponent(current_return_to)}&returnPostId=${encodeURIComponent(post.id)}`
								)}
								class="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-opacity outline-none hover:opacity-85"
								aria-label={`Open ${post.author_name}'s profile`}
							>
								{#if post.author_avatar}
									<img
										src={post.author_avatar}
										alt={post.author_name}
										class="h-10 w-10 rounded-full object-cover md:h-12 md:w-12"
									/>
								{:else}
									<div
										class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white md:h-12 md:w-12 md:text-sm"
									>
										{post.author_name?.[0]?.toUpperCase() ?? '?'}
									</div>
								{/if}
								<div class="min-w-0 overflow-hidden md:flex md:flex-col">
									<span class="block truncate text-base font-semibold text-white"
										>{post.author_name}</span
									>
									<span class="block truncate text-sm text-white/50 md:text-sm"
										>{time_ago(post.created_at)}</span
									>
								</div>
							</a>
							<button class="ml-auto shrink-0 text-white/50 transition-colors hover:text-white">
								<img
									src="/images/home-screen/three-dots-icon.avif"
									alt="more options"
									class="h-3 w-auto md:h-2 xl:h-3"
								/>
							</button>
						</div>

						<div class="relative mx-3 mt-3 aspect-4/5 overflow-hidden rounded-2xl md:mx-4">
							{#if get_post_path}
								<a
									href={resolve(get_post_path(post))}
									class="absolute inset-0 z-10"
									aria-label={`Open ${post.author_name}'s post`}
								></a>
							{/if}
							{#if post.media_url && post.media_type === 'image'}
								<button
									type="button"
									class="absolute inset-0 z-15 cursor-zoom-in"
									onclick={() => {
										schedule_image_preview(
											post.id,
											post.media_url ?? '',
											`${post.author_name}'s post`
										);
									}}
									ondblclick={() => {
										clear_pending_preview(post.id);
										toggle_like(post.id);
									}}
									aria-label={`Preview ${post.author_name}'s post image`}
								>
									<img
										src={post.media_url}
										alt="post"
										class="h-full w-full object-cover"
										loading="lazy"
										decoding="async"
									/>
								</button>
							{/if}
							{#if post.content}
								{#if expanded_captions[caption_key('grid', post.id)]}
									<button
										type="button"
										class="absolute inset-0 z-20 flex cursor-pointer items-end bg-black/55 px-4 py-4 text-left backdrop-blur-[1px]"
										aria-label="Collapse caption"
										onclick={() => toggle_caption(caption_key('grid', post.id))}
									>
										<div class="caption-overlay-scroll max-h-full w-full overflow-y-auto pr-1">
											<p class="user-content-text text-sm leading-6 whitespace-pre-line text-white">
												{post.content}
											</p>
											{#if overflowing_captions[caption_key('grid', post.id)]}
												<span
													class="mt-3 inline-block text-xs font-semibold tracking-wide text-sky-300"
													>See less</span
												>
											{/if}
										</div>
									</button>
								{:else}
									<div
										class="absolute right-0 bottom-0 left-0 z-20 bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-10 pb-3 text-left"
									>
										<button
											type="button"
											class={`block w-full pr-28 text-left ${overflowing_captions[caption_key('grid', post.id)] ? 'cursor-pointer' : 'cursor-default'}`}
											aria-label={overflowing_captions[caption_key('grid', post.id)]
												? 'Expand caption'
												: undefined}
											onclick={() => {
												if (overflowing_captions[caption_key('grid', post.id)])
													toggle_caption(caption_key('grid', post.id));
											}}
										>
											<p
												use:measure_caption={caption_key('grid', post.id)}
												class="user-content-text caption-preview text-sm leading-5 whitespace-pre-line text-white"
											>
												{post.content}
											</p>
										</button>
										{#if overflowing_captions[caption_key('grid', post.id)]}
											<button
												type="button"
												class="absolute right-3 bottom-2.5 z-10 rounded-full bg-[#7DD4FF] px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-sky-200/25 hover:text-white"
												aria-label="Expand caption"
												onclick={() => toggle_caption(caption_key('grid', post.id))}
											>
												See more
											</button>
										{/if}
									</div>
								{/if}
							{/if}
						</div>

						<div
							class="2xl:pt:6 mx-6 flex items-center gap-6 pt-5 pb-5 md:gap-4 md:pt-4 md:pb-4 2xl:pb-6"
						>
							<button
								type="button"
								class="group relative h-6 w-6 transition-opacity hover:opacity-70"
								onclick={() => toggle_like(post.id)}
								aria-label={liked_posts[String(post.id)] ? 'Unlike post' : 'Like post'}
							>
								<img
									src="/images/home-screen/unliked-state.avif"
									alt=""
									class="absolute inset-0 h-6 w-auto origin-center object-contain transition-all duration-250 ease-out {liked_posts[
										String(post.id)
									]
										? 'scale-75 opacity-0'
										: 'scale-100 opacity-100'}"
								/>
								<img
									src="/images/home-screen/liked-state.avif"
									alt="like"
									class="absolute inset-0 h-6 w-auto origin-center object-contain transition-all duration-250 ease-out {liked_posts[
										String(post.id)
									]
										? 'scale-100 opacity-100'
										: 'scale-125 opacity-0'}"
								/>
							</button>
							<button class="transition-opacity hover:opacity-70"
								><img
									src="/images/home-screen/comment-icon.avif"
									alt="comment"
									class="h-6 w-auto"
								/></button
							>
							<button class="transition-opacity hover:opacity-70"
								><img
									src="/images/home-screen/share-post-icon.avif"
									alt="share"
									class="h-6 w-auto"
								/></button
							>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center gap-5 md:gap-8">
				{#each posts as post (post.id)}
					<div
						use:register_post_element={post.id}
						class="w-full max-w-xl overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
					>
						<div class="flex items-center gap-3 px-5 pt-5 md:gap-3">
							<a
								href={resolve(
									`/profile/${encodeURIComponent(post.author_username)}?returnTo=${encodeURIComponent(current_return_to)}&returnPostId=${encodeURIComponent(post.id)}`
								)}
								class="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-opacity outline-none hover:opacity-85"
								aria-label={`Open ${post.author_name}'s profile`}
							>
								{#if post.author_avatar}
									<img
										src={post.author_avatar}
										alt={post.author_name}
										class="h-10 w-10 rounded-full object-cover md:h-11 md:w-11"
									/>
								{:else}
									<div
										class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white md:h-11 md:w-11 md:text-sm"
									>
										{post.author_name?.[0]?.toUpperCase() ?? '?'}
									</div>
								{/if}
								<div class="min-w-0 overflow-hidden md:flex md:flex-col">
									<span class="block truncate text-base font-semibold text-white md:text-xl"
										>{post.author_name}</span
									>
									<span class="block truncate text-sm text-white/50 md:text-sm"
										>{time_ago(post.created_at)}</span
									>
								</div>
							</a>
							<button class="ml-auto shrink-0 text-white/50 transition-colors hover:text-white">
								<img
									src="/images/home-screen/three-dots-icon.avif"
									alt="more options"
									class="h-3 w-auto"
								/>
							</button>
						</div>

						<div
							class="relative mx-3 mt-3 aspect-4/5 overflow-hidden rounded-2xl bg-black/20 md:mx-4 md:max-h-[70vh]"
						>
							{#if post.media_url && post.media_type === 'image'}
								<button
									type="button"
									class="flex h-full w-full cursor-zoom-in items-center justify-center"
									onclick={() => {
										schedule_image_preview(
											post.id,
											post.media_url ?? '',
											`${post.author_name}'s post`
										);
									}}
									ondblclick={() => {
										clear_pending_preview(post.id);
										toggle_like(post.id);
									}}
									aria-label={`Preview ${post.author_name}'s post image`}
								>
									<img
										src={post.media_url}
										alt="post"
										class="h-full w-full object-contain"
										loading="lazy"
										decoding="async"
									/>
								</button>
							{/if}
							{#if post.content}
								{#if expanded_captions[caption_key('feed', post.id)]}
									<button
										type="button"
										class="absolute inset-0 z-20 flex cursor-pointer items-end rounded-2xl bg-black/55 px-4 py-4 text-left backdrop-blur-[1px]"
										aria-label="Collapse caption"
										onclick={() => toggle_caption(caption_key('feed', post.id))}
									>
										<div class="caption-overlay-scroll max-h-full w-full overflow-y-auto pr-1">
											<p class="user-content-text text-sm leading-6 whitespace-pre-line text-white">
												{post.content}
											</p>
											{#if overflowing_captions[caption_key('feed', post.id)]}
												<span
													class="mt-3 inline-block text-xs font-semibold tracking-wide text-sky-300"
													>See less</span
												>
											{/if}
										</div>
									</button>
								{:else}
									<div
										class="absolute right-0 bottom-0 left-0 z-20 bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-10 pb-3 text-left"
									>
										<button
											type="button"
											class={`block w-full pr-28 text-left ${overflowing_captions[caption_key('feed', post.id)] ? 'cursor-pointer' : 'cursor-default'}`}
											aria-label={overflowing_captions[caption_key('feed', post.id)]
												? 'Expand caption'
												: undefined}
											onclick={() => {
												if (overflowing_captions[caption_key('feed', post.id)])
													toggle_caption(caption_key('feed', post.id));
											}}
										>
											<p
												use:measure_caption={caption_key('feed', post.id)}
												class="user-content-text caption-preview text-sm leading-5 whitespace-pre-line text-white"
											>
												{post.content}
											</p>
										</button>
										{#if overflowing_captions[caption_key('feed', post.id)]}
											<button
												type="button"
												class="absolute right-3 bottom-2.5 z-10 rounded-full bg-[#7DD4FF] px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-sky-200/25 hover:text-white"
												aria-label="Expand caption"
												onclick={() => toggle_caption(caption_key('feed', post.id))}
											>
												See more
											</button>
										{/if}
									</div>
								{/if}
							{/if}
						</div>

						<div class="mx-2 flex items-center gap-5 px-4 py-5 md:gap-6 md:px-5 2xl:pt-6 2xl:pb-6">
							<button
								type="button"
								class="group relative h-6 w-6 transition-opacity hover:opacity-70"
								onclick={() => toggle_like(post.id)}
								aria-label={liked_posts[String(post.id)] ? 'Unlike post' : 'Like post'}
							>
								<img
									src="/images/home-screen/unliked-state.avif"
									alt=""
									class="absolute inset-0 h-6 w-auto origin-center object-contain transition-all duration-250 ease-out {liked_posts[
										String(post.id)
									]
										? 'scale-75 opacity-0'
										: 'scale-100 opacity-100'}"
								/>
								<img
									src="/images/home-screen/liked-state.avif"
									alt="like"
									class="absolute inset-0 h-6 w-auto origin-center object-contain transition-all duration-250 ease-out {liked_posts[
										String(post.id)
									]
										? 'scale-100 opacity-100'
										: 'scale-125 opacity-0'}"
								/>
							</button>
							<button class="transition-opacity hover:opacity-70"
								><img
									src="/images/home-screen/comment-icon.avif"
									alt="comment"
									class="h-6 w-auto"
								/></button
							>
							<button class="transition-opacity hover:opacity-70"
								><img
									src="/images/home-screen/share-post-icon.avif"
									alt="share"
									class="h-6 w-auto"
								/></button
							>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if has_infinite_feed && is_loading_more}
			<div class="mx-auto w-full max-w-xl px-1 pt-2 pb-1">
				<div
					class="feed-load-more-card flex items-center justify-center gap-3 rounded-[1.75rem] px-4 py-3 text-sm text-white/85 backdrop-blur-md"
				>
					<span class="feed-load-more-pulse h-2.5 w-2.5 rounded-full bg-sky-300"></span>
					<span class="font-medium">Loading more posts</span>
					<span class="feed-load-more-pulse h-2.5 w-2.5 rounded-full bg-fuchsia-300"></span>
				</div>
			</div>
		{:else if has_infinite_feed && load_more_error}
			<div class="mx-auto w-full max-w-xl px-1 pt-2 pb-1">
				<div
					class="flex items-center justify-between gap-3 rounded-[1.75rem] border border-rose-300/20 bg-[linear-gradient(135deg,rgba(120,15,35,0.35),rgba(255,255,255,0.06))] px-4 py-3 text-sm text-rose-100 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-md"
				>
					<span>{load_more_error}</span>
					<button
						type="button"
						class="rounded-full border border-white/12 bg-white/10 px-3 py-1 font-medium text-white transition-all duration-200 hover:bg-white/16"
						onclick={request_more_posts}
					>
						Retry
					</button>
				</div>
			</div>
		{:else if has_infinite_feed && !has_more && posts.length > 0}
			<div class="mx-auto w-full max-w-xl px-1 pt-2 pb-1">
				<div
					class="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-3 text-center text-xs tracking-[0.22em] text-white/55 uppercase backdrop-blur-md"
				>
					You&apos;re all caught up
				</div>
			</div>
		{/if}
	</div>
</div>

{#if image_preview}
	<div
		class="fixed inset-0 z-80 flex cursor-zoom-out items-center justify-center bg-black/90 px-4 py-6 backdrop-blur-md"
		role="dialog"
		aria-modal="true"
		aria-label="Post image preview"
		tabindex="0"
		bind:this={image_preview_backdrop}
		onclick={close_image_preview}
		transition:fade={{ duration: 180 }}
		onkeydown={(event) => {
			if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				close_image_preview();
			}
		}}
	>
		<img
			src={image_preview.src}
			alt={image_preview.alt}
			class="max-h-[92vh] max-w-[96vw] rounded-3xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
			decoding="async"
			transition:scale={{ duration: 220, start: 0.92, opacity: 0.55 }}
		/>
	</div>
{/if}

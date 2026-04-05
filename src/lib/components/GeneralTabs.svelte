<script lang="ts">
	import type { MouseEventHandler } from 'svelte/elements';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		get_last_home_feed_state,
		set_last_home_feed_state,
		type HomeFeedState
	} from '$lib/state/home-feed-state';
	const { profile_username = '' }: { profile_username: string } = $props();

	const active_path = $derived(page.url.pathname);
	const home_href = resolve('/home');
	const search_href = resolve('/search');
	const profile_href = resolve('/profile');
	const ison_home = $derived(active_path === home_href);
	const ison_search = $derived(active_path === search_href);
	const ison_profile = $derived(active_path.startsWith(profile_href));
	const glow_base =
		"before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-[radial-gradient(circle,rgba(210,150,255,0.95)_0%,rgba(146,95,255,0.55)_65%,rgba(146,95,255,0.2)_100%)] before:shadow-[0_0_24px_rgba(180,120,255,0.7)] before:transition-all before:duration-300 before:ease-out";
	const glow_off = 'before:opacity-0 before:scale-90';
	const glow_on = 'before:opacity-100 before:scale-100';
	const nav_link_base =
		'relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition-[background,box-shadow,backdrop-filter,transform] duration-300 ease-out hover:bg-white/6';
	const active_link =
		'!text-[#7DD4FF] bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px]';
	const last_home_state_storage_key = 'post-feed-last-home-state';

	function persist_current_home_scroll_position() {
		if (!ison_home) {
			return;
		}

		const storage_key = `post-feed-scroll:${page.url.pathname}${page.url.search}`;
		const active_scroll_container = window.matchMedia('(min-width: 768px)').matches
			? document.querySelector('.post-feed-scroll')
			: document.querySelector('.post-feed-page');

		if (!(active_scroll_container instanceof HTMLElement)) {
			return;
		}

		try {
			const anchor_post_id = get_current_home_anchor_post_id(active_scroll_container);

			const next_state: HomeFeedState = {
				return_href: `${page.url.pathname}${page.url.search}`,
				scroll_top: active_scroll_container.scrollTop,
				anchor_post_id
			};
			const serialized_state = JSON.stringify(next_state);

			set_last_home_feed_state(next_state);
			sessionStorage.setItem(storage_key, serialized_state);
			sessionStorage.setItem(last_home_state_storage_key, serialized_state);
		} catch {
			// Ignore storage failures.
		}
	}

	function get_current_home_anchor_post_id(active_scroll_container: HTMLElement) {
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

	function build_home_return_href() {
		try {
			const saved_state =
				get_last_home_feed_state() ??
				(sessionStorage.getItem(last_home_state_storage_key)
					? (JSON.parse(sessionStorage.getItem(last_home_state_storage_key)!) as HomeFeedState)
					: undefined);

			if (!saved_state) {
				return home_href;
			}

			const saved_return_href = saved_state.return_href?.startsWith('/home')
				? saved_state.return_href
				: home_href;

			if (!saved_state.anchor_post_id || saved_return_href.includes('focusPost=')) {
				return saved_return_href;
			}

			const separator = saved_return_href.includes('?') ? '&' : '?';
			return `${saved_return_href}${separator}focusPost=${encodeURIComponent(saved_state.anchor_post_id)}`;
		} catch {
			return home_href;
		}
	}

	const handle_home_navigation_click: MouseEventHandler<HTMLAnchorElement> = (event) => {
		if (!ison_home) {
			event.preventDefault();
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			void goto(build_home_return_href(), {
				noScroll: true,
				keepFocus: true
			});
			return;
		}

		event.preventDefault();

		try {
			sessionStorage.setItem('post-feed-scroll:/home', '0');
		} catch {
			// Ignore storage failures.
		}

		const home_page_container = document.querySelector('.post-feed-page');
		const feed_scroll_container = document.querySelector('.post-feed-scroll');

		if (home_page_container instanceof HTMLElement) {
			home_page_container.scrollTo({
				top: 0,
				behavior: 'smooth'
			});
		}

		if (feed_scroll_container instanceof HTMLElement) {
			feed_scroll_container.scrollTo({
				top: 0,
				behavior: 'smooth'
			});
		}

		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		});
	};

	const handle_navigation_away_from_home: MouseEventHandler<HTMLAnchorElement> = () => {
		persist_current_home_scroll_position();
	};
</script>

<!-- Top Tab (scrolls naturally) -->
<div class="flex h-18 w-full items-center justify-between bg-[#09051C] px-6 md:hidden">
	<a
		href={home_href}
		onclick={handle_home_navigation_click}
		class="cursor-pointer transition-opacity hover:opacity-80"
	>
		<img
			src="/images/sidebar-and-search/Space-and-Time-logo.avif"
			alt="Space and Time Logo"
			class="h-12"
		/>
	</a>
	<div class="flex items-center gap-6">
		<img
			src="/images/sidebar-and-search/dark-mode.avif"
			alt="dark/light mode switch icon"
			class="h-8 transition-opacity hover:opacity-80"
		/>
		<img
			src="/images/sidebar-and-search/more-setting.avif"
			alt="More Settings"
			class="h-8 transition-opacity hover:opacity-80"
		/>
	</div>
</div>

<!-- Bottom Tab (fixed) -->
<nav
	class="fixed right-0 bottom-0 left-0 z-50 flex h-18 w-full items-center justify-center bg-[#09051C] md:hidden"
	data-sveltekit-preload-code="viewport"
>
	<div class="flex w-full items-center justify-around">
		<button class="relative grid h-14 w-14 place-items-center" type="button" aria-label="Settings">
			<img src="/images/sidebar-and-search/setting.avif" alt="Settings" class="h-8 opacity-80" />
		</button>

		<a
			href={search_href}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`relative grid h-14 w-14 cursor-pointer place-items-center transition-opacity duration-200 ${glow_base} ${ison_search ? glow_on : `${glow_off} hover:opacity-80`}`}
		>
			<img src="/images/sidebar-and-search/search.avif" alt="Search" class="relative z-10 h-8" />
		</a>

		<a
			href={home_href}
			onclick={handle_home_navigation_click}
			data-sveltekit-preload-data="hover"
			class={`relative grid h-14 w-14 cursor-pointer place-items-center transition-opacity duration-200 ${glow_base} ${ison_home ? glow_on : `${glow_off} hover:opacity-80`}`}
		>
			<img
				src="/images/sidebar-and-search/home-page-icon.avif"
				alt="Home Screen"
				class="relative z-10 h-8"
			/>
		</a>

		<button
			class="relative grid h-14 w-14 place-items-center"
			type="button"
			aria-label="Send Messages"
		>
			<img
				src="/images/sidebar-and-search/open-messages.avif"
				alt="Send Messages icon"
				class="h-8 opacity-80"
			/>
		</button>

		<a
			href={resolve(
				profile_username.length > 0
					? `/profile/${encodeURIComponent(profile_username)}`
					: '/profile'
			)}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`relative grid h-14 w-14 cursor-pointer place-items-center transition-opacity duration-200 ${glow_base} ${ison_profile ? glow_on : `${glow_off} hover:opacity-80`}`}
			aria-label="Profile"
		>
			<img
				src="/images/sidebar-and-search/go-to-profile.avif"
				alt="Profile icon"
				class="h-8 opacity-80"
			/>
		</a>
	</div>
</nav>

<!-- Desktop Sidebar -->
<aside
	class="fixed top-0 left-0 hidden h-screen w-72 flex-col gap-15 bg-[#09051C] p-6 text-white md:flex"
	data-sveltekit-preload-code="viewport"
>
	<a
		href={home_href}
		onclick={handle_home_navigation_click}
		class="block w-fit self-center transition-opacity hover:opacity-80"
	>
		<img
			src="/images/sidebar-and-search/Space-and-Time-logo.avif"
			alt="Space and Time Logo"
			class="h-16"
		/>
	</a>

	<button
		type="button"
		class="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-lg font-semibold text-white/90 transition-colors hover:bg-white/6"
	>
		<img src="/images/sidebar-and-search/expand-tab.avif" alt="Close Tab icon" class="h-6 w-6" />
		<span>Close Tab</span>
	</button>

	<nav class="space-y-2">
		<a
			href={home_href}
			onclick={handle_home_navigation_click}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${ison_home ? active_link : ''}`}
		>
			<img
				src="/images/sidebar-and-search/home-page-icon.avif"
				alt="Home Page icon"
				class="h-6 w-6"
			/>
			<span class="text-lg font-semibold">Home</span>
		</a>

		<a
			href={search_href}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${ison_search ? active_link : ''}`}
		>
			<img src="/images/sidebar-and-search/search.avif" alt="Search icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Search</span>
		</a>

		<a
			href={resolve(
				profile_username.length > 0
					? `/profile/${encodeURIComponent(profile_username)}`
					: '/profile'
			)}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${ison_profile ? active_link : ''}`}
		>
			<img src="/images/sidebar-and-search/go-to-profile.avif" alt="Profile icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Profile</span>
		</a>

		<button type="button" class={nav_link_base}>
			<img
				src="/images/sidebar-and-search/open-messages.avif"
				alt="Messages icon"
				class="h-6 w-6"
			/>
			<span class="text-lg font-semibold">Message</span>
		</button>

		<button type="button" class={nav_link_base}>
			<img src="/images/sidebar-and-search/setting.avif" alt="Settings icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Setting</span>
		</button>

		<button type="button" class={nav_link_base}>
			<img
				src="/images/sidebar-and-search/change-theme-icon.avif"
				alt="Change Theme icon"
				class="h-6 w-6"
			/>
			<span class="text-lg font-semibold">Theme</span>
		</button>

		<button type="button" class={nav_link_base}>
			<img
				src="/images/sidebar-and-search/about-this-account-icon.avif"
				alt="About this Account icon"
				class="h-6 w-6"
			/>
			<span class="text-lg font-semibold">About</span>
		</button>
	</nav>

	<div class="mt-auto px-2 pb-2">
		<button
			type="button"
			class="rounded-xl p-2 transition-colors duration-200 hover:bg-white/6"
			aria-label="Toggle theme"
		>
			<img
				src="/images/sidebar-and-search/dark-mode.avif"
				alt="Toggle light/dark mode icon"
				class="h-7 w-7"
			/>
		</button>
	</div>
</aside>

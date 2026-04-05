<script lang="ts">
	import type { MouseEventHandler } from 'svelte/elements';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		desktop_sidebar_width,
		is_desktop_sidebar_collapsed,
		toggle_desktop_sidebar
	} from '$lib/state/desktop-sidebar-state';
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
		'relative flex items-center rounded-2xl text-left text-white transition-[background,box-shadow,backdrop-filter,transform,width,height,padding,gap] duration-300 ease-out hover:bg-white/6';
	const nav_link_size_class = $derived(
		$is_desktop_sidebar_collapsed ? 'mx-auto h-12 w-12' : 'w-full gap-3 px-4 py-3'
	);
	const active_link =
		'!text-[#7DD4FF] bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px]';
	const last_home_state_storage_key = 'post-feed-last-home-state';
	const desktop_label_class = $derived(
		$is_desktop_sidebar_collapsed
			? 'pointer-events-none max-w-0 -translate-x-2 overflow-hidden opacity-0 blur-[2px]'
			: 'max-w-40 translate-x-0 opacity-100 blur-0'
	);
	const desktop_aside_class = $derived(
		$is_desktop_sidebar_collapsed ? 'items-center px-3 py-6' : 'items-stretch p-6'
	);
	const desktop_link_alignment_class = $derived(
		$is_desktop_sidebar_collapsed
			? 'mx-auto h-12 w-12 justify-center gap-0 px-0'
			: 'justify-start px-4'
	);
	const desktop_link_content_class = $derived(
		$is_desktop_sidebar_collapsed ? 'mx-auto flex h-6 w-6 items-center justify-center' : ''
	);
	const desktop_toggle_content_class = $derived(
		$is_desktop_sidebar_collapsed ? 'mx-auto flex h-6 w-6 items-center justify-center' : ''
	);
	const desktop_sidebar_button_class = $derived(
		$is_desktop_sidebar_collapsed
			? 'mx-auto h-12 w-12 justify-center gap-0 rounded-2xl px-0'
			: 'w-full justify-start gap-3 rounded-2xl px-4 py-3'
	);
	const desktop_sidebar_toggle_icon_class = $derived(
		$is_desktop_sidebar_collapsed
			? 'block h-6 w-6 rotate-180 object-contain'
			: `block h-6 w-6 object-contain ${desktop_toggle_content_class}`
	);

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
	class={`fixed top-0 left-0 hidden h-screen flex-col gap-15 bg-[#09051C] text-white transition-[width,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex ${desktop_aside_class}`}
	style={`width: ${$desktop_sidebar_width};`}
	data-sveltekit-preload-code="viewport"
>
	<a
		href={home_href}
		onclick={handle_home_navigation_click}
		class={`block transition-opacity hover:opacity-80 ${$is_desktop_sidebar_collapsed ? 'mx-auto self-center' : 'mx-auto w-fit self-center'}`}
	>
		<img
			src="/images/sidebar-and-search/Space-and-Time-logo.avif"
			alt="Space and Time Logo"
			class={`object-contain transition-[height,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${$is_desktop_sidebar_collapsed ? 'h-14 scale-95 opacity-90' : 'h-16 scale-100 opacity-100'}`}
		/>
	</a>

	<button
		type="button"
		onclick={toggle_desktop_sidebar}
		class={`relative flex items-center text-left text-lg font-semibold text-white transition-[background,box-shadow,backdrop-filter,transform,width,height,padding,gap,border-radius] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/6 ${desktop_sidebar_button_class}`}
	>
		<img
			src="/images/sidebar-and-search/expand-tab.avif"
			alt="Close Tab icon"
			class={`transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_sidebar_toggle_icon_class}`}
		/>
		<span
			class={`whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
			>Close Tab</span
		>
	</button>

	<nav class={`space-y-2 ${$is_desktop_sidebar_collapsed ? 'w-full' : ''}`}>
		<a
			href={home_href}
			onclick={handle_home_navigation_click}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class} ${ison_home ? active_link : ''}`}
		>
			<img
				src="/images/sidebar-and-search/home-page-icon.avif"
				alt="Home Page icon"
				class={`block h-6 w-6 object-contain ${desktop_link_content_class}`}
			/>
			<span
				class={`text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
				>Home</span
			>
		</a>

		<a
			href={search_href}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class} ${ison_search ? active_link : ''}`}
		>
			<img
				src="/images/sidebar-and-search/search.avif"
				alt="Search icon"
				class={`block h-6 w-6 object-contain ${desktop_link_content_class}`}
			/>
			<span
				class={`text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
				>Search</span
			>
		</a>

		<a
			href={resolve(
				profile_username.length > 0
					? `/profile/${encodeURIComponent(profile_username)}`
					: '/profile'
			)}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class} ${ison_profile ? active_link : ''}`}
		>
			<img
				src="/images/sidebar-and-search/go-to-profile.avif"
				alt="Profile icon"
				class={`block h-6 w-6 object-contain ${desktop_link_content_class}`}
			/>
			<span
				class={`text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
				>Profile</span
			>
		</a>

		<button
			type="button"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class}`}
		>
			<img
				src="/images/sidebar-and-search/open-messages.avif"
				alt="Messages icon"
				class={`block h-6 w-6 object-contain ${desktop_link_content_class}`}
			/>
			<span
				class={`text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
				>Message</span
			>
		</button>

		<button
			type="button"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class}`}
		>
			<img
				src="/images/sidebar-and-search/setting.avif"
				alt="Settings icon"
				class={`block h-6 w-6 object-contain ${desktop_link_content_class}`}
			/>
			<span
				class={`text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
				>Setting</span
			>
		</button>

		<button
			type="button"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class}`}
		>
			<img
				src="/images/sidebar-and-search/change-theme-icon.avif"
				alt="Change Theme icon"
				class={`block h-6 w-6 object-contain ${desktop_link_content_class}`}
			/>
			<span
				class={`text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
				>Theme</span
			>
		</button>

		<button
			type="button"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class}`}
		>
			<img
				src="/images/sidebar-and-search/about-this-account-icon.avif"
				alt="About this Account icon"
				class={`block h-6 w-6 object-contain ${desktop_link_content_class}`}
			/>
			<span
				class={`text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
				>About</span
			>
		</button>
	</nav>

	<div
		class={`mt-auto pb-2 ${$is_desktop_sidebar_collapsed ? 'mx-auto px-0 text-center' : 'px-2'}`}
	>
		<button
			type="button"
			class={`rounded-xl p-2 transition-colors duration-200 hover:bg-white/6 ${$is_desktop_sidebar_collapsed ? 'mx-auto flex h-12 w-12 items-center justify-center' : ''}`}
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

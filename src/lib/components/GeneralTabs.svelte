<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { MouseEventHandler } from 'svelte/elements';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
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
	let is_signing_out = $state(false);
	const profile_path: Pathname = $derived(
		profile_username.length > 0
			? (`/profile/${encodeURIComponent(profile_username)}` as `/profile/${string}`)
			: '/profile'
	);

	const active_path = $derived(page.url.pathname);
	const home_href = resolve('/home');
	const search_href = resolve('/search');
	const about_href = resolve('/about');
	const sign_out_action = `${resolve('/sign-out')}?/signOut`;
	const ison_home = $derived(active_path === home_href);
	const ison_search = $derived(active_path === search_href);
	const ison_profile = $derived(active_path === profile_path);
	const ison_about = $derived(active_path === about_href);
	const glow_base =
		"before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-[radial-gradient(circle,rgba(210,150,255,0.95)_0%,rgba(146,95,255,0.55)_65%,rgba(146,95,255,0.2)_100%)] before:shadow-[0_0_24px_rgba(180,120,255,0.7)] before:transition-all before:duration-300 before:ease-out";
	const glow_off = 'before:opacity-0 before:scale-90';
	const glow_on = 'before:opacity-100 before:scale-80';
	const nav_link_base =
		'relative block overflow-hidden rounded-2xl text-left text-white transition-[background,box-shadow,backdrop-filter,transform,width,height,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/6';
	const nav_link_size_class = $derived(
		$is_desktop_sidebar_collapsed ? 'w-12 gap-0 px-3 py-3' : 'w-full gap-3 px-4 py-3'
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
		$is_desktop_sidebar_collapsed ? 'items-stretch px-3 py-6' : 'items-stretch p-6'
	);
	const desktop_link_alignment_class = $derived($is_desktop_sidebar_collapsed ? 'mx-auto' : '');
	const desktop_icon_slot_class = 'flex h-6 w-6 shrink-0 items-center justify-center';
	const desktop_item_content_class = $derived(
		$is_desktop_sidebar_collapsed
			? 'desktop-item-content desktop-item-content-collapsed'
			: 'desktop-item-content'
	);
	const desktop_sidebar_button_class = $derived(
		$is_desktop_sidebar_collapsed
			? 'mx-auto w-12 rounded-2xl px-3 py-3'
			: 'w-full rounded-2xl px-4 py-3'
	);
	const desktop_sidebar_toggle_icon_class = $derived(
		$is_desktop_sidebar_collapsed
			? 'block h-6 w-6 rotate-180 object-contain'
			: 'block h-6 w-6 object-contain'
	);
	let is_mobile_settings_open = $state(false);

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
		is_mobile_settings_open = false;
		persist_current_home_scroll_position();
	};
	let logout_dialog: HTMLDialogElement;
	const handle_logout = () => {
		logout_dialog.showModal();
	};
	const handle_sign_out_submit: SubmitFunction = () => {
		is_mobile_settings_open = false;
		is_signing_out = true;
		logout_dialog.close();
		return async ({ update }) => {
			try {
				await update();
			} finally {
				is_signing_out = false;
			}
		};
	};
</script>

<dialog bind:this={logout_dialog}>
	<h1>Would you like to logout?</h1>
	<form method="POST" action={sign_out_action} class="actions" use:enhance={handle_sign_out_submit}>
		<button type="submit">Confirm</button>
		<!-- Using type="button" prevents form submission -->
		<button type="button" class="cancel" onclick={() => logout_dialog.close()}> Cancel </button>
	</form>
</dialog>

<!-- Top Tab (scrolls naturally) -->
<div class="flex h-15 w-full items-center justify-between bg-[#09051C] px-6 md:hidden">
	<a
		href={home_href}
		onclick={handle_home_navigation_click}
		class="cursor-pointer transition-opacity hover:opacity-80"
	>
		<img
			src="/images/sidebar-and-search/Space-and-Time-logo.avif"
			alt="Space and Time Logo"
			class="h-12 max-[480px]:h-8"
		/>
	</a>
	<div class="flex items-center gap-6">
		<button
			onclick={handle_logout}
			disabled={is_signing_out}
			class="grid h-8 w-8 place-items-center transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
			aria-label="Sign out"
		>
			{#if is_signing_out}
				<span class="logout-spinner mobile-logout-spinner" aria-hidden="true"></span>
			{:else}
				<img
					src="/images/sidebar-and-search/logout-icon.avif"
					alt="Sign out"
					class="h-8 max-[480px]:h-6"
				/>
			{/if}
		</button>
		<!-- eslint-disable -->
		<!--
		<img
			src="/images/sidebar-and-search/dark-mode.avif"
			alt="dark/light mode switch icon"
			class="h-8 transition-opacity hover:opacity-80 max-[480px]:h-6"
		/>
		-->
		<!-- eslint-enable -->
		<div class="relative">
			<button
				type="button"
				class="grid h-8 w-8 place-items-center transition-opacity hover:opacity-80"
				aria-label="More settings"
				aria-expanded={is_mobile_settings_open}
				onclick={() => {
					is_mobile_settings_open = !is_mobile_settings_open;
				}}
			>
				<img
					src="/images/sidebar-and-search/more-setting.avif"
					alt="More Settings"
					class="h-8 max-[480px]:h-6"
				/>
			</button>

			{#if is_mobile_settings_open}
				<div
					class="absolute top-11 right-0 z-150 min-w-36 rounded-2xl border border-white/10 bg-[#120D2A]/95 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.42),inset_1px_-1px_24px_rgba(205,130,255,0.18)] backdrop-blur-md"
				>
					<a
						href={about_href}
						onclick={handle_navigation_away_from_home}
						data-sveltekit-preload-data="hover"
						class={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/8 ${ison_about ? 'bg-white/10 text-[#7DD4FF]' : ''}`}
					>
						<img
							src="/images/sidebar-and-search/about-this-account-icon.avif"
							alt="About icon"
							class="h-6 w-6 object-contain"
						/>
						<span>About</span>
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Bottom Tab (fixed) -->
<nav
	class="fixed right-0 bottom-0 left-0 isolate z-120 h-15 w-full border-t border-white/8 bg-[#09051C] shadow-[0_-18px_36px_rgba(9,5,28,0.96)] backdrop-blur-none supports-backdrop-filter:backdrop-blur-none md:hidden"
	data-sveltekit-preload-code="viewport"
>
	<div class="absolute inset-0 z-0 bg-[#09051C]" aria-hidden="true"></div>
	<div class="relative z-10 flex h-full w-full items-center justify-around bg-[#09051C]">
		<!-- eslint-disable -->
		<!--
		<button class="relative grid h-14 w-14 place-items-center" type="button" aria-label="Settings">
			<img
				src="/images/sidebar-and-search/setting.avif"
				alt="Settings"
				class="h-8 opacity-80 max-[480px]:h-6"
			/>
		</button>

		<button
			class="relative grid h-14 w-14 place-items-center"
			type="button"
			aria-label="Send Messages"
		>
			<img
				src="/images/sidebar-and-search/open-messages.avif"
				alt="Send Messages icon"
				class="h-8 opacity-80 max-[480px]:h-6"
			/>
		</button>
		-->
		<!-- eslint-enable -->

		<a
			href={search_href}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`relative grid h-14 w-14 cursor-pointer place-items-center transition-opacity duration-200 ${glow_base} ${ison_search ? glow_on : `${glow_off} hover:opacity-80`}`}
		>
			<img
				src="/images/sidebar-and-search/search.avif"
				alt="Search"
				class="relative z-10 h-8 max-[480px]:h-6"
			/>
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
				class="relative z-10 h-8 max-[480px]:h-6"
			/>
		</a>

		<!-- eslint-disable -->
		<!--
		<button
			class="relative grid h-14 w-14 place-items-center"
			type="button"
			aria-label="Send Messages"
		>
			<img
				src="/images/sidebar-and-search/open-messages.avif"
				alt="Send Messages icon"
				class="h-8 opacity-80 max-[480px]:h-6"
			/>
		</button>
		-->
		<!-- eslint-enable -->

		<a
			href={resolve(profile_path)}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`relative grid h-14 w-14 cursor-pointer place-items-center transition-opacity duration-200 ${glow_base} ${ison_profile ? glow_on : `${glow_off} hover:opacity-80`}`}
			aria-label="Profile"
		>
			<img
				src="/images/sidebar-and-search/go-to-profile.avif"
				alt="Profile icon"
				class="h-8 opacity-80 max-[480px]:h-6"
			/>
		</a>
	</div>
</nav>

<!-- Desktop Sidebar -->
<aside
	class={`fixed top-0 left-0 hidden h-screen flex-col gap-15 overflow-hidden bg-[#09051C] text-white transition-[width,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex ${desktop_aside_class}`}
	style={`width: ${$desktop_sidebar_width};`}
	data-sveltekit-preload-code="viewport"
>
	<div class="flex h-16 items-center justify-center">
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
	</div>

	<button
		type="button"
		onclick={toggle_desktop_sidebar}
		class={`relative block text-left text-lg font-semibold text-white transition-[background,box-shadow,backdrop-filter,transform,width,height,padding,border-radius] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/6 ${desktop_sidebar_button_class}`}
	>
		<span class={desktop_item_content_class}>
			<span class={desktop_icon_slot_class}>
				<img
					src="/images/sidebar-and-search/expand-tab.avif"
					alt="Close Tab icon"
					class={`transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_sidebar_toggle_icon_class}`}
				/>
			</span>
			<span
				class={`origin-left whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
				>Close Tab</span
			>
		</span>
	</button>

	<nav class={`space-y-2 ${$is_desktop_sidebar_collapsed ? 'w-full' : ''}`}>
		<a
			href={home_href}
			onclick={handle_home_navigation_click}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class} ${ison_home ? active_link : ''}`}
		>
			<span class={desktop_item_content_class}>
				<span class={desktop_icon_slot_class}>
					<img
						src="/images/sidebar-and-search/home-page-icon.avif"
						alt="Home Page icon"
						class="block h-6 w-6 object-contain"
					/>
				</span>
				<span
					class={`origin-left text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
					>Home</span
				>
			</span>
		</a>

		<a
			href={search_href}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class} ${ison_search ? active_link : ''}`}
		>
			<span class={desktop_item_content_class}>
				<span class={desktop_icon_slot_class}>
					<img
						src="/images/sidebar-and-search/search.avif"
						alt="Search icon"
						class="block h-6 w-6 object-contain"
					/>
				</span>
				<span
					class={`origin-left text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
					>Search</span
				>
			</span>
		</a>

		<a
			href={resolve(profile_path)}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class} ${ison_profile ? active_link : ''}`}
		>
			<span class={desktop_item_content_class}>
				<span class={desktop_icon_slot_class}>
					<img
						src="/images/sidebar-and-search/go-to-profile.avif"
						alt="Profile icon"
						class="block h-6 w-6 object-contain"
					/>
				</span>
				<span
					class={`origin-left text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
					>Profile</span
				>
			</span>
		</a>

		<!-- eslint-disable -->
		<!--
		<button
			type="button"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class}`}
		>
			<span class={desktop_item_content_class}>
				<span class={desktop_icon_slot_class}>
					<img
						src="/images/sidebar-and-search/open-messages.avif"
						alt="Messages icon"
						class="block h-6 w-6 object-contain"
					/>
				</span>
				<span
					class={`origin-left text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
					>Message</span
				>
			</span>
		</button>

		<button
			type="button"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class}`}
		>
			<span class={desktop_item_content_class}>
				<span class={desktop_icon_slot_class}>
					<img
						src="/images/sidebar-and-search/setting.avif"
						alt="Settings icon"
						class="block h-6 w-6 object-contain"
					/>
				</span>
				<span
					class={`origin-left text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
					>Setting</span
				>
			</span>
		</button>

		<button
			type="button"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class}`}
		>
			<span class={desktop_item_content_class}>
				<span class={desktop_icon_slot_class}>
					<img
						src="/images/sidebar-and-search/change-theme-icon.avif"
						alt="Change Theme icon"
						class="block h-6 w-6 object-contain"
					/>
				</span>
				<span
					class={`origin-left text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
					>Theme</span
				>
			</span>
		</button>
		-->
		<!-- eslint-enable -->

		<a
			href={about_href}
			onclick={handle_navigation_away_from_home}
			data-sveltekit-preload-data="hover"
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class} ${ison_about ? active_link : ''}`}
		>
			<span class={desktop_item_content_class}>
				<span class={desktop_icon_slot_class}>
					<img
						src="/images/sidebar-and-search/about-this-account-icon.avif"
						alt="About this Account icon"
						class="block h-6 w-6 object-contain"
					/>
				</span>
				<span
					class={`origin-left text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
					>About</span
				>
			</span>
		</a>

		<button
			onclick={handle_logout}
			disabled={is_signing_out}
			class={`${nav_link_base} ${nav_link_size_class} ${desktop_link_alignment_class} disabled:cursor-wait disabled:opacity-60`}
		>
			<span class={desktop_item_content_class}>
				<span class={desktop_icon_slot_class}>
					{#if is_signing_out}
						<span class="logout-spinner" aria-hidden="true"></span>
					{:else}
						<img
							src="/images/sidebar-and-search/logout-icon.avif"
							alt="Sign out icon"
							class="block h-6 w-6 object-contain"
						/>
					{/if}
				</span>
				<span
					class={`origin-left text-lg font-semibold whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] ${desktop_label_class}`}
					>{is_signing_out ? 'Logging out...' : 'Logout'}</span
				>
			</span></button
		>
	</nav>

	<!-- eslint-disable -->
	<!--
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
	-->
	<!-- eslint-enable -->
</aside>

{#if is_signing_out}
	<div class="logout-blocking-overlay" role="status" aria-live="polite">
		<span class="logout-overlay-spinner" aria-hidden="true"></span>
		<span>Logging out...</span>
	</div>
{/if}

<style>
	.desktop-item-content {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr);
		align-items: center;
		column-gap: 0.75rem;
		transition:
			grid-template-columns 500ms cubic-bezier(0.22, 1, 0.36, 1),
			column-gap 500ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.desktop-item-content-collapsed {
		grid-template-columns: 1.5rem 0fr;
		column-gap: 0;
	}

	dialog {
		padding: 2rem;
		border: none;
		border-radius: 12px;
		background: white;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		/* Centering Fix (for extra safety) */
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		/* Content Layout */
		min-width: 320px;
		text-align: center;
	}

	/* The Background Overlay (The "Dimmed" part) */
	dialog::backdrop {
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px); /* Modern blur effect */
	}

	/* Typography and Layout inside the dialog */
	dialog h1 {
		font-size: 1.25rem;
		margin-bottom: 1.5rem;
		color: #1a1a1a;
	}

	/* Container for buttons */
	dialog .actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}

	/* Basic Button Styling */
	dialog button {
		padding: 0.6rem 1.2rem;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
		transition: background 0.2s;
	}

	/* Style for the "Confirm" button */
	dialog button[type='submit'] {
		background: #ff4444;
		color: white;
		border: none;
	}

	dialog button[type='submit']:hover {
		background: #cc0000;
	}

	/* Style for the "Cancel" button */
	dialog button.cancel {
		background: #f0f0f0;
		color: #333;
		border: 1px solid #ccc;
	}
	.logout-spinner,
	.logout-overlay-spinner {
		display: inline-block;
		border-radius: 9999px;
		border: 2px solid rgba(255, 255, 255, 0.42);
		border-top-color: #7dd4ff;
		animation: logout-spin 800ms linear infinite;
	}

	.logout-spinner {
		width: 1.35rem;
		height: 1.35rem;
	}

	.mobile-logout-spinner {
		width: 1.55rem;
		height: 1.55rem;
	}

	.logout-overlay-spinner {
		width: 1.45rem;
		height: 1.45rem;
		border-top-color: white;
	}

	.logout-blocking-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(9, 5, 28, 0.56);
		backdrop-filter: blur(5px);
		-webkit-backdrop-filter: blur(5px);
		color: white;
		font-weight: 800;
		letter-spacing: 0;
		pointer-events: all;
	}

	@media (prefers-reduced-motion: reduce) {
		.logout-spinner,
		.logout-overlay-spinner {
			animation: none;
		}
	}

	@keyframes logout-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteMap, SvelteURLSearchParams } from 'svelte/reactivity';
	import type { PageData } from './$types';
	import { build_responsive_image_source } from '$lib/utilities/responsive-image';
	import ProgressiveImage from '$lib/components/ProgressiveImage.svelte';

	type SearchUser = {
		id: string;
		name: string;
		image: string | null;
		username: string;
	};
	type RecentUser = Pick<SearchUser, 'id' | 'name' | 'image' | 'username'>;
	const { data }: { data: PageData } = $props();

	let query = $state('');
	let users = $state<SearchUser[]>([]);
	let recent_users = $state<RecentUser[]>([]);
	let issearching = $state(false);
	let isexpanding = $state(false);
	let error_message = $state('');

	let debounce_timer: ReturnType<typeof setTimeout> | undefined;
	let fast_controller: AbortController | undefined;
	let full_controller: AbortController | undefined;
	let active_request_id = 0;
	const get_recent_storage_key = (): string => `recent-search-users:${data['user_id']}`;
	const max_recent_users = 15;
	const generic_username_pattern = /^user(?:_\d+)?$/i;
	const fallback_avatar = '/images/sidebar-and-search/go-to-profile.avif';
	const fast_search_limit = 8;
	const full_search_limit = 25;
	const full_search_min_query_length = 2;
	const max_search_cache_entries = 80;

	const search_cache = new SvelteMap<string, SearchUser[]>();

	const merge_users = (
		primary_users: SearchUser[],
		secondary_users: SearchUser[]
	): SearchUser[] => {
		const unique_users: SearchUser[] = [];

		for (const listed_user of primary_users) {
			unique_users.push(listed_user);
		}

		for (const listed_user of secondary_users) {
			if (!unique_users.some((existing_user) => existing_user.id === listed_user.id)) {
				unique_users.push(listed_user);
			}
		}

		return unique_users;
	};

	const cache_search_results = (search_query: string, result_users: SearchUser[]): void => {
		search_cache.set(search_query, result_users);

		if (search_cache.size <= max_search_cache_entries) {
			return;
		}

		const oldest_key = search_cache.keys().next().value;

		if (typeof oldest_key === 'string') {
			search_cache.delete(oldest_key);
		}
	};

	const get_cached_results = (search_query: string): SearchUser[] | undefined => {
		const exact_results = search_cache.get(search_query);

		if (exact_results) {
			return exact_results;
		}

		const candidates = Array.from(search_cache.entries())
			.filter(([cached_query]) => search_query.startsWith(cached_query))
			.sort((left, right) => right[0].length - left[0].length);

		return candidates[0]?.[1];
	};

	const fetch_users = async (
		search_query: string,
		limit: number,
		controller: AbortController
	): Promise<SearchUser[]> => {
		const response = await fetch(
			`/api/search/users?query=${encodeURIComponent(search_query)}&limit=${limit}`,
			{
				signal: controller.signal
			}
		);

		if (!response.ok) {
			throw new Error(`Request failed: ${response.status}`);
		}

		const payload = (await response.json()) as { users: SearchUser[] };
		return payload.users;
	};

	const run_fast_search = async (
		search_query: string,
		request_id: number,
		cached_users: SearchUser[] | undefined
	): Promise<SearchUser[] | undefined> => {
		try {
			const current_fast_controller = new AbortController();
			fast_controller = current_fast_controller;

			const fast_users = await fetch_users(
				search_query,
				fast_search_limit,
				current_fast_controller
			);

			if (request_id !== active_request_id) {
				return undefined;
			}

			users = fast_users;
			cache_search_results(search_query, fast_users);
			return fast_users;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return undefined;
			}

			if (!cached_users) {
				users = [];
			}
			error_message = 'Search failed. Please try again.';
			return undefined;
		} finally {
			if (request_id === active_request_id) {
				issearching = false;
			}
		}
	};

	const run_full_search = async (search_query: string, request_id: number): Promise<void> => {
		isexpanding = true;

		try {
			const current_full_controller = new AbortController();
			full_controller = current_full_controller;

			const full_users = await fetch_users(
				search_query,
				full_search_limit,
				current_full_controller
			);

			if (request_id !== active_request_id) {
				return;
			}

			const merged_users = merge_users(full_users, users);
			users = merged_users;
			cache_search_results(search_query, merged_users);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}
		} finally {
			if (request_id === active_request_id) {
				isexpanding = false;
			}
		}
	};

	const load_users = async (search_query: string): Promise<void> => {
		fast_controller?.abort();
		full_controller?.abort();

		const request_id = active_request_id + 1;
		active_request_id = request_id;

		const cached_users = get_cached_results(search_query);

		if (cached_users) {
			users = cached_users;
		}

		issearching = true;
		isexpanding = false;
		error_message = '';

		const fast_users = await run_fast_search(search_query, request_id, cached_users);

		if (!fast_users || request_id !== active_request_id) {
			return;
		}

		const canrun_full_search =
			search_query.length >= full_search_min_query_length && fast_users.length >= fast_search_limit;

		if (!canrun_full_search) {
			return;
		}

		void run_full_search(search_query, request_id);
	};

	const trimmed_query = $derived(query.trim());
	const current_return_to = $derived(`${page.url.pathname}${page.url.search}${page.url.hash}`);
	const has_recent_users = $derived(recent_users.length > 0);

	const persist_recent_users = (next_recent_users: RecentUser[]) => {
		try {
			localStorage.setItem(get_recent_storage_key(), JSON.stringify(next_recent_users));
		} catch {
			// Ignore localStorage failures in restricted browsing modes.
		}
	};

	const save_recent_user = (
		listed_user: RecentUser,
		options: { update_ui?: boolean } = {}
	): void => {
		const should_update_ui = options.update_ui ?? true;
		const filtered_users = recent_users.filter(
			(existing_user) => existing_user.username !== listed_user.username
		);
		const next_recent_users = [listed_user, ...filtered_users].slice(0, max_recent_users);

		if (should_update_ui) {
			recent_users = next_recent_users;
		}

		persist_recent_users(next_recent_users);
	};

	const get_recent_display_label = (recent_user: RecentUser): string => {
		if (
			generic_username_pattern.test(recent_user.username) &&
			typeof recent_user.name === 'string' &&
			recent_user.name.trim().length > 0
		) {
			return recent_user.name;
		}

		return recent_user.username;
	};

	const get_user_avatar_source = (image_url: string | null): { src: string; srcset?: string } =>
		build_responsive_image_source(image_url ?? fallback_avatar, {
			widths: [64, 96, 128],
			height: 128,
			fit: 'fill'
		});

	const remove_recent_user = (username: string): void => {
		const next_recent_users = recent_users.filter(
			(recent_user) => recent_user.username !== username
		);
		recent_users = next_recent_users;
		persist_recent_users(next_recent_users);
	};

	const clear_recent_users = (): void => {
		recent_users = [];
		persist_recent_users([]);
	};

	const refresh_recent_users = async (stored_recent_users: RecentUser[]): Promise<void> => {
		const usernames = stored_recent_users
			.map((recent_user) => recent_user.username.trim())
			.filter(Boolean)
			.slice(0, max_recent_users);

		if (usernames.length === 0) {
			return;
		}

		const params = new SvelteURLSearchParams();

		for (const username of usernames) {
			params.append('username', username);
		}

		try {
			const response = await fetch(`/api/search/recent-users?${params.toString()}`);

			if (!response.ok) {
				return;
			}

			const payload = (await response.json()) as { users: SearchUser[] };

			if (!Array.isArray(payload.users) || payload.users.length === 0) {
				return;
			}

			const refreshed_recent_users = payload.users
				.map((listed_user) => ({
					id: listed_user.id,
					name: listed_user.name,
					image: listed_user.image,
					username: listed_user.username
				}))
				.slice(0, max_recent_users);

			recent_users = refreshed_recent_users;
			persist_recent_users(refreshed_recent_users);
		} catch {
			// Keep the locally cached recent users if refresh fails.
		}
	};

	onMount(() => {
		try {
			const raw_recent_users = localStorage.getItem(get_recent_storage_key());

			if (!raw_recent_users) {
				return;
			}

			const parsed = JSON.parse(raw_recent_users);

			if (!Array.isArray(parsed)) {
				return;
			}

			const parsed_recent_users = parsed
				.filter(
					(recent_user): recent_user is RecentUser =>
						typeof recent_user === 'object' &&
						recent_user !== null &&
						'id' in recent_user &&
						'name' in recent_user &&
						'username' in recent_user &&
						typeof recent_user.id === 'string' &&
						typeof recent_user.name === 'string' &&
						typeof recent_user.username === 'string' &&
						('image' in recent_user
							? recent_user.image === null || typeof recent_user.image === 'string'
							: true)
				)
				.slice(0, max_recent_users);

			recent_users = parsed_recent_users;
			void refresh_recent_users(parsed_recent_users);
		} catch {
			recent_users = [];
		}
	});

	$effect(() => {
		if (debounce_timer) {
			clearTimeout(debounce_timer);
		}

		if (trimmed_query.length < 1) {
			fast_controller?.abort();
			full_controller?.abort();
			active_request_id = 0;
			users = [];
			issearching = false;
			isexpanding = false;
			error_message = '';
			return;
		}

		debounce_timer = setTimeout(() => {
			void load_users(trimmed_query);
		}, 120);

		return () => {
			if (debounce_timer) {
				clearTimeout(debounce_timer);
			}
		};
	});

	onDestroy(() => {
		if (debounce_timer) {
			clearTimeout(debounce_timer);
		}
		fast_controller?.abort();
		full_controller?.abort();
	});
</script>

<section
	class="search_panel h-screen overflow-x-hidden overflow-y-auto overscroll-none bg-[#0B0425] p-4 pb-10 text-white shadow-[0_0_50px_rgba(20,5,60,0.8)] md:p-8"
>
	<h1 class="text-2xl font-bold tracking-wide md:text-4xl">Search</h1>

	<label for="search-users" class="mt-4 block cursor-pointer md:mt-6">
		<span class="sr-only">Search users</span>
		<div
			class="relative flex items-center gap-3 rounded-2xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] px-4 py-3 shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px]"
		>
			<img
				src="/images/sidebar-and-search/search.avif"
				alt="Search icon"
				class="h-5 w-5 opacity-90"
				loading="eager"
				decoding="async"
			/>
			<input
				id="search-users"
				bind:value={query}
				type="search"
				placeholder="Search username"
				class="w-full cursor-pointer! border-none bg-transparent p-0 pr-8 text-lg text-white ring-0 outline-none placeholder:text-white/70 focus:cursor-pointer! focus:border-none focus:ring-0"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if query.length > 0}
				<button
					type="button"
					class="absolute top-1/2 right-3 grid h-8 w-8 -translate-y-1/2 place-items-center text-2xl text-red-500 transition-colors hover:text-red-400"
					onclick={() => {
						query = '';
					}}
					aria-label="Clear search"
				>
					x
				</button>
			{/if}
		</div>
	</label>

	<div class="mt-6 space-y-3">
		{#if trimmed_query.length < 1}
			<div class="flex items-center justify-between gap-3">
				<p class="text-lg text-[#7DD4FF]">Recent</p>
				{#if has_recent_users}
					<button
						type="button"
						class="text-sm font-semibold text-red-500 transition-colors hover:text-red-400"
						onclick={clear_recent_users}
						aria-label="Clear all recent users"
					>
						Clear All
					</button>
				{/if}
			</div>
			{#if has_recent_users}
				<ul class="space-y-3">
					{#each recent_users as recent_user (recent_user.username)}
						{@const recent_avatar = get_user_avatar_source(recent_user.image)}
						<li>
							<div
								class="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition-all duration-200 focus-within:border-[#7DD4FF] focus-within:bg-white/10 hover:border-[#CD82FF] hover:bg-white/8 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
							>
								<a
									href={resolve(
										`/profile/${encodeURIComponent(recent_user.username)}?returnTo=${encodeURIComponent(current_return_to)}`
									)}
									onclick={() => {
										save_recent_user(recent_user, { update_ui: false });
									}}
									class="flex min-w-0 flex-1 items-center gap-3 outline-none"
								>
									<ProgressiveImage
										src={recent_avatar.src}
										srcset={recent_avatar.srcset}
										sizes="44px"
										alt={`${recent_user.name} profile`}
										wrapper_class="h-11 w-11 rounded-full border border-white/20"
										img_class="h-11 w-11 rounded-full object-cover transition-transform duration-200 group-hover:scale-105"
										skeleton_class="rounded-full"
										loading="lazy"
										decoding="async"
									/>
									<span
										class="truncate text-lg font-semibold text-white transition-colors group-hover:text-[#7DD4FF]"
										>{get_recent_display_label(recent_user)}</span
									>
								</a>
								<button
									type="button"
									class="grid h-8 w-8 shrink-0 place-items-center text-2xl text-red-500 transition-colors hover:text-red-400"
									onclick={() => {
										remove_recent_user(recent_user.username);
									}}
									aria-label={`Remove ${recent_user.name} from recent`}
								>
									x
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			{#if issearching}
				<p class="mb-2 text-sm text-white/70">Searching users...</p>
			{/if}
			{#if isexpanding}
				<p class="mb-2 text-sm text-white/70">Loading more matches...</p>
			{/if}
			{#if error_message}
				<p class="mb-2 text-sm text-rose-300">{error_message}</p>
			{/if}
			{#if trimmed_query.length >= 1 && users.length === 0 && !issearching}
				<p class="text-sm text-white/70">No users found.</p>
			{/if}

			{#if users.length > 0}
				<ul class="space-y-3">
					{#each users as listed_user (listed_user.id)}
						{@const listed_avatar = get_user_avatar_source(listed_user.image)}
						<li>
							<a
								href={resolve(
									`/profile/${encodeURIComponent(listed_user.username)}?returnTo=${encodeURIComponent(current_return_to)}`
								)}
								onclick={() => {
									save_recent_user(listed_user, { update_ui: false });
								}}
								class="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition-all duration-200 hover:border-white/25 hover:bg-white/8 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] focus-visible:border-[#7DD4FF] focus-visible:bg-white/10 focus-visible:outline-none"
							>
								<ProgressiveImage
									src={listed_avatar.src}
									srcset={listed_avatar.srcset}
									sizes="44px"
									alt={`${listed_user.name} profile`}
									wrapper_class="h-11 w-11 rounded-full border border-white/20"
									img_class="h-11 w-11 rounded-full object-cover transition-transform duration-200 group-hover:scale-105"
									skeleton_class="rounded-full"
									loading="lazy"
									decoding="async"
								/>
								<div class="min-w-0">
									<p
										class="truncate text-lg font-semibold text-white transition-colors group-hover:text-[#BDE7FF]"
									>
										{listed_user.name}
									</p>
									<p class="truncate text-sm text-white/55">@{listed_user.username}</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>

	<div class="h-36 shrink-0 md:hidden" aria-hidden="true"></div>
</section>

<style>
	:global(html),
	:global(body) {
		overflow: hidden;
	}

	.search_panel {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.search_panel::-webkit-scrollbar {
		display: none;
	}

	#search-users::-webkit-search-cancel-button {
		-webkit-appearance: none;
		display: none;
	}
</style>

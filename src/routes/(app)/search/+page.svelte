<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	type SearchUser = {
		id: string;
		name: string;
		image: string | null;
	};

	let query = $state('');
	let users = $state<SearchUser[]>([]);
	let issearching = $state(false);
	let isexpanding = $state(false);
	let error_message = $state('');

	let debounce_timer: ReturnType<typeof setTimeout> | undefined;
	let fast_controller: AbortController | undefined;
	let full_controller: AbortController | undefined;
	let active_request_id = 0;

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
	): Promise<boolean> => {
		try {
			const current_fast_controller = new AbortController();
			fast_controller = current_fast_controller;

			const fast_users = await fetch_users(search_query, 8, current_fast_controller);

			if (request_id !== active_request_id) {
				return false;
			}

			users = fast_users;
			search_cache.set(search_query, fast_users);
			return true;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return false;
			}

			if (!cached_users) {
				users = [];
			}
			error_message = 'Search failed. Please try again.';
			return false;
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

			const full_users = await fetch_users(search_query, 25, current_full_controller);

			if (request_id !== active_request_id) {
				return;
			}

			const merged_users = merge_users(full_users, users);
			users = merged_users;
			search_cache.set(search_query, merged_users);
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

		const iskeeploading = await run_fast_search(search_query, request_id, cached_users);

		if (!iskeeploading || request_id !== active_request_id) {
			return;
		}

		void run_full_search(search_query, request_id);
	};

	const trimmed_query = $derived(query.trim());

	$effect(() => {
		if (debounce_timer) {
			clearTimeout(debounce_timer);
		}

		if (trimmed_query.length < 1) {
			fast_controller?.abort();
			full_controller?.abort();
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
	class="search_panel h-screen overflow-x-hidden overflow-y-auto overscroll-none bg-[#0B0425] p-4 text-white shadow-[0_0_50px_rgba(20,5,60,0.8)] md:p-8">
	<h1 class="text-3xl font-bold tracking-wide md:text-5xl">Search</h1>

	<label for="search-users" class="mt-4 block cursor-pointer md:mt-6">
		<span class="sr-only">Search users</span>
		<div
			class="relative flex items-center gap-3 rounded-2xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] px-4 py-3 shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px]"
		>
			<img src="/images/search.png" alt="Search icon" class="h-5 w-5 opacity-90" />
			<input
				id="search-users"
				bind:value={query}
				type="search"
				placeholder="Search username"
				class="w-full border-none bg-transparent p-0 pr-8 text-lg text-white cursor-pointer! outline-none ring-0 placeholder:text-white/70 focus:cursor-pointer! focus:border-none focus:ring-0"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if query.length > 0}
				<button
					type="button"
					class="absolute top-1/2 right-3 -translate-y-1/2 text-2xl w-8 h-8 grid place-items-center text-red-500 transition-colors hover:text-red-400"
					onclick={() => {
						query = '';
					}}
					aria-label="Clear search">
					x
				</button>
			{/if}
		</div>
	</label>

	<div class="mt-6 space-y-3">
		{#if trimmed_query.length < 1}
			<p class="text-sm text-white/70">Type to search users.</p>
		{:else if issearching}
			<p class="text-sm text-white/70">Searching users...</p>
		{:else if isexpanding}
			<p class="text-sm text-white/70">Loading more matches...</p>
		{:else if error_message}
			<p class="text-sm text-rose-300">{error_message}</p>
		{:else if trimmed_query.length >= 1 && users.length === 0}
			<p class="text-sm text-white/70">No users found.</p>
		{:else}
			<ul class="space-y-3">
				{#each users as listed_user (listed_user.id)}
					<li>
						<div class="flex items-center gap-3 rounded-xl px-1 py-1">
							<img
								src={listed_user.image || '/images/go-to-profile.png'}
								alt={`${listed_user.name} profile`}
								class="h-11 w-11 rounded-full border border-white/20 object-cover"
							/>
							<span class="text-lg font-semibold text-white">{listed_user.name}</span>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
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

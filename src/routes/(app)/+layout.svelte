<script lang="ts">
	import { resolve } from '$app/paths';
	import { preloadCode, preloadData } from '$app/navigation';
	import { navigating } from '$app/state';
	import { onMount } from 'svelte';
	import GeneralTabs from '$lib/components/GeneralTabs.svelte';
	const { children, data } = $props();

	const search_href = $derived(resolve('/search'));
	const profile_prefix = $derived(resolve('/profile'));
	const profile_href = $derived(
		resolve(
			data['profile_username']
				? `/profile/${encodeURIComponent(data['profile_username'])}`
				: '/profile'
		)
	);
	const navigating_path = $derived(navigating.to?.url.pathname ?? '');
	const isnavigating_to_search = $derived(
		Boolean(navigating.to) && navigating_path === search_href
	);
	const isnavigating_to_profile = $derived(
		Boolean(navigating.to) && navigating_path.startsWith(profile_prefix)
	);
	const hasnavigation_skeleton_visible = $derived(
		isnavigating_to_search || isnavigating_to_profile
	);
	const search_skeleton_rows = Array.from({ length: 7 }, (_, index) => index);
	const profile_skeleton_tiles = Array.from({ length: 12 }, (_, index) => index);

	onMount(() => {
		void preloadCode(search_href);
		void preloadCode(profile_href);
		void preloadData(search_href);
		void preloadData(profile_href);
	});
</script>

<GeneralTabs profile_username={data['profile_username']} />

<main class="md:min-h-screen md:pl-72">
	{@render children()}
</main>

{#if hasnavigation_skeleton_visible}
	<div
		class="nav_skeleton pointer-events-none fixed right-0 left-0 z-70 {isnavigating_to_profile
			? 'top-0 bottom-0'
			: 'top-18 bottom-18'} md:top-0 md:bottom-0 md:left-72"
	>
		{#if isnavigating_to_search}
			<section
				class="search_skeleton_screen search_panel h-screen overflow-x-hidden overflow-y-auto overscroll-none p-4 text-white shadow-[0_0_50px_rgba(20,5,60,0.8)] md:p-8"
			>
				<div class="mx-auto w-full max-w-none">
					<div class="skeleton h-10 w-35 rounded-lg md:h-12 md:w-50"></div>

					<div class="mt-4 md:mt-6">
						<div
							class="skeleton relative flex h-13 items-center gap-3 rounded-2xl px-4 py-3 md:h-14"
						>
							<div class="skeleton h-5 w-5 rounded-full"></div>
							<div class="skeleton h-6 w-1/3 rounded-md md:h-7"></div>
						</div>
					</div>

					<div class="mt-6">
						<div class="mb-3 flex items-center justify-between gap-3">
							<div class="skeleton h-7 w-20 rounded-md"></div>
							<div class="skeleton h-5 w-16 rounded-md"></div>
						</div>
						<div class="space-y-3">
							{#each search_skeleton_rows as row (row)}
								<div class="flex items-center gap-3 rounded-xl border border-white/8 px-3 py-2">
									<div class="skeleton h-11 w-11 shrink-0 rounded-full"></div>
									<div class="min-w-0 flex-1 space-y-2">
										<div class="skeleton h-5 w-44 rounded-md"></div>
										<div class="skeleton h-4 w-28 rounded-md opacity-80"></div>
									</div>
									<div
										class="skeleton h-7 w-7 rounded-full {row % 2 === 0 ? '' : 'opacity-70'}"
									></div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</section>
		{:else if isnavigating_to_profile}
			<div
				class="profile_skeleton_screen flex h-screen justify-center overflow-y-scroll overscroll-x-none overscroll-y-none text-white"
			>
				<div class="flex w-full max-w-6xl flex-col p-2 shadow-2xl">
					<div class="relative h-56 w-full md:h-74">
						<div
							class="skeleton skeleton_cover relative h-full w-full overflow-hidden rounded-3xl"
						></div>
						<div class="absolute inset-0 z-20 rounded-3xl border border-white/10">
							<div
								class="skeleton absolute top-3 right-3 h-8 w-24 rounded-full md:top-4 md:right-4 md:h-9 md:w-28"
							></div>
						</div>
						<div
							class="absolute -bottom-14 left-1/2 z-30 h-32 w-32 -translate-x-1/2 md:-bottom-20 md:h-48 md:w-48"
						>
							<div
								class="skeleton relative z-10 h-full w-full rounded-full border-5 border-[#0a0b1e] lg:border-7"
							></div>
							<div
								class="skeleton absolute top-10 -left-40 z-20 h-10 w-10 rounded-full max-[479px]:-left-25 md:-left-30 lg:-left-45 lg:h-15 lg:w-15 xl:-left-70"
							></div>
							<div
								class="skeleton absolute bottom-5 -left-20 h-10 w-10 rounded-full max-[479px]:-left-12 md:-left-15 lg:-left-25 lg:h-15 lg:w-15 xl:-left-40"
							></div>
							<div
								class="skeleton absolute -right-20 bottom-5 z-20 h-10 w-10 rounded-full max-[479px]:-right-12 md:-right-15 lg:-right-25 lg:h-15 lg:w-15 xl:-right-40"
							></div>
							<div
								class="skeleton absolute top-10 -right-40 z-20 h-10 w-10 rounded-full max-[479px]:-right-25 md:-right-30 lg:-right-45 lg:h-15 lg:w-15 xl:-right-70"
							></div>
						</div>
					</div>

					<div class="mt-16 text-center md:mt-30">
						<div class="skeleton mx-auto h-8 w-64 rounded-lg md:h-10"></div>
						<div class="skeleton mx-auto mt-2 h-5 w-44 rounded-md"></div>
					</div>

					<div
						class="mx-auto mt-6 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-6 md:gap-10"
					>
						<div class="text-center">
							<div class="skeleton mx-auto h-8 w-12 rounded-md"></div>
							<div class="skeleton mx-auto mt-1 h-3 w-14 rounded-sm"></div>
						</div>
						<div class="h-8 w-px bg-slate-700"></div>
						<div class="text-center">
							<div class="skeleton mx-auto h-8 w-12 rounded-md"></div>
							<div class="skeleton mx-auto mt-1 h-3 w-18 rounded-sm"></div>
						</div>
						<div class="h-8 w-px bg-slate-700"></div>
						<div class="text-center">
							<div class="skeleton mx-auto h-8 w-12 rounded-md"></div>
							<div class="skeleton mx-auto mt-1 h-3 w-18 rounded-sm"></div>
						</div>
					</div>

					<div class="relative mx-2 mt-6 rounded-3xl bg-[#121324] p-6">
						<div
							class="absolute inset-0 rounded-3xl bg-linear-to-r from-[#CD82FF] via-[#FF0DA6] to-[#C575E3] p-px"
						>
							<div class="h-full w-full rounded-3xl bg-[#121324]"></div>
						</div>
						<div class="skeleton relative z-10 mt-1 h-4 w-full max-w-3xl rounded-sm"></div>
						<div class="skeleton relative z-10 mt-2 h-4 w-2/3 rounded-sm"></div>
						<div class="relative z-10 mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
							<div class="skeleton h-4 w-35 rounded-sm"></div>
							<div class="skeleton h-4 w-40 rounded-sm"></div>
							<div class="skeleton h-4 w-30 rounded-sm"></div>
							<div class="skeleton h-4 w-28 rounded-sm"></div>
						</div>
					</div>

					<div
						class="mt-6 flex items-center gap-2 rounded-full border-[6px] border-[#535060] bg-[#474555] p-1.5 text-sm font-bold"
					>
						<div class="skeleton h-12 flex-1 rounded-full"></div>
						<div class="skeleton h-12 flex-1 rounded-full"></div>
						<div class="skeleton h-12 flex-1 rounded-full"></div>
					</div>

					<div class="mx-2 mt-2 grid grid-cols-3 gap-1 pb-8 md:gap-3">
						{#each profile_skeleton_tiles as tile (tile)}
							<div class="skeleton aspect-square rounded-xl md:rounded-2xl"></div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.nav_skeleton {
		background:
			radial-gradient(1000px 420px at 15% -10%, rgba(125, 212, 255, 0.2), transparent 65%),
			radial-gradient(900px 380px at 90% -15%, rgba(205, 130, 255, 0.2), transparent 62%),
			linear-gradient(180deg, #09051c 0%, #0b0425 45%, #09051c 100%);
	}

	.search_skeleton_screen {
		background:
			radial-gradient(700px 260px at 8% -5%, rgba(125, 212, 255, 0.12), transparent 70%),
			radial-gradient(650px 240px at 90% -10%, rgba(205, 130, 255, 0.14), transparent 70%);
	}

	.profile_skeleton_screen {
		background:
			radial-gradient(900px 350px at 50% -20%, rgba(205, 130, 255, 0.12), transparent 70%), #0a0b1e;
	}

	.skeleton {
		border: 1px solid rgba(255, 255, 255, 0.12);
		background:
			linear-gradient(
					102deg,
					rgba(125, 212, 255, 0.1) 12%,
					rgba(125, 212, 255, 0.2) 28%,
					rgba(205, 130, 255, 0.35) 46%,
					rgba(255, 13, 166, 0.18) 58%,
					rgba(125, 212, 255, 0.2) 74%,
					rgba(125, 212, 255, 0.1) 88%
				)
				0 0 / 250% 100% no-repeat,
			linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			inset 0 -1px 0 rgba(12, 8, 34, 0.45),
			0 0 0 1px rgba(125, 212, 255, 0.04),
			0 8px 24px rgba(5, 2, 22, 0.26);
		animation: skeleton_slide 1.5s ease infinite;
	}

	.skeleton_cover {
		background:
			radial-gradient(120% 160% at 20% 20%, rgba(255, 198, 246, 0.24), transparent 45%),
			radial-gradient(120% 160% at 85% 10%, rgba(125, 212, 255, 0.24), transparent 50%),
			linear-gradient(
					102deg,
					rgba(125, 212, 255, 0.12) 12%,
					rgba(125, 212, 255, 0.24) 28%,
					rgba(205, 130, 255, 0.4) 46%,
					rgba(255, 13, 166, 0.2) 58%,
					rgba(125, 212, 255, 0.24) 74%,
					rgba(125, 212, 255, 0.12) 88%
				)
				0 0 / 250% 100% no-repeat,
			linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.04));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			inset 0 -1px 0 rgba(12, 8, 34, 0.45),
			0 0 0 1px rgba(125, 212, 255, 0.06),
			0 12px 28px rgba(5, 2, 22, 0.3);
	}

	@keyframes skeleton_slide {
		from {
			background-position:
				220% 0,
				0 0;
		}
		to {
			background-position:
				-35% 0,
				0 0;
		}
	}
</style>

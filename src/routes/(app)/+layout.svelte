<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { preloadCode, preloadData } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { onMount } from 'svelte';
	import GeneralTabs from '$lib/components/GeneralTabs.svelte';
	import BackgroundVideoPostStatus from '$lib/components/BackgroundVideoPostStatus.svelte';
	import { desktop_sidebar_width } from '$lib/state/desktop-sidebar-state';
	const { children, data } = $props();

	const home_href = $derived(resolve('/home'));
	const search_href = $derived(resolve('/search'));
	const about_href = $derived(resolve('/about'));
	const about_background_video_src = `${base}/video/About-Background.webm`;
	const about_background_music_src = `${base}/music/about-screen-bg-music.mp3`;
	const profile_prefix = $derived(resolve('/profile'));
	const profile_href = $derived(
		resolve(
			data['profile_username']
				? `/profile/${encodeURIComponent(data['profile_username'])}`
				: '/profile'
		)
	);
	const navigating_path = $derived(navigating.to?.url.pathname ?? '');
	const isnavigating_to_home = $derived(Boolean(navigating.to) && navigating_path === home_href);
	const isnavigating_to_search = $derived(
		Boolean(navigating.to) && navigating_path === search_href
	);
	const isnavigating_to_profile_post = $derived(
		Boolean(navigating.to) && /^\/profile\/[^/]+\/posts\/[^/]+$/.test(navigating_path)
	);
	const isnavigating_to_profile = $derived(
		Boolean(navigating.to) &&
			navigating_path.startsWith(profile_prefix) &&
			!isnavigating_to_profile_post
	);
	const hasnavigation_skeleton_visible = $derived(
		isnavigating_to_home ||
			isnavigating_to_search ||
			isnavigating_to_profile ||
			isnavigating_to_profile_post
	);
	const home_skeleton_cards = Array.from({ length: 4 }, (_, index) => index);
	const search_skeleton_rows = Array.from({ length: 7 }, (_, index) => index);
	const profile_skeleton_tiles = Array.from({ length: 12 }, (_, index) => index);
	// eslint-disable-next-line @typescript-eslint/naming-convention
	let isNetworkOnline = $state(true);
	let about_background_music_element = $state<HTMLAudioElement>();

	function play_about_background_music() {
		if (!about_background_music_element) {
			return;
		}

		about_background_music_element.volume = 0.35;
		about_background_music_element.load();

		if (!about_background_music_element.paused) {
			return;
		}

		void about_background_music_element.play().catch(() => {});
	}

	function pause_about_background_music() {
		if (!about_background_music_element) {
			return;
		}

		about_background_music_element.pause();
		about_background_music_element.currentTime = 0;
	}

	onMount(() => {
		isNetworkOnline = navigator.onLine;

		const handle_online = () => {
			isNetworkOnline = true;
		};

		const handle_offline = () => {
			isNetworkOnline = false;
		};

		window.addEventListener('online', handle_online);
		window.addEventListener('offline', handle_offline);
		document.addEventListener('about-background-music:play', play_about_background_music);

		void preloadCode(home_href);
		void preloadData(home_href);
		void preloadCode(search_href);
		void preloadCode(about_href);
		void preloadCode(profile_href);
		void preloadData(profile_href);
		void preloadData(search_href);
		void preloadData(about_href);

		const about_background_video_preloader = document.createElement('video');
		about_background_video_preloader.src = about_background_video_src;
		about_background_video_preloader.preload = 'auto';
		about_background_video_preloader.muted = true;
		about_background_video_preloader.playsInline = true;
		about_background_video_preloader.setAttribute('playsinline', '');
		about_background_video_preloader.setAttribute('aria-hidden', 'true');
		about_background_video_preloader.tabIndex = -1;
		Object.assign(about_background_video_preloader.style, {
			position: 'fixed',
			width: '1px',
			height: '1px',
			opacity: '0',
			pointerEvents: 'none',
			inset: '0',
			zIndex: '-1'
		});
		document.body.append(about_background_video_preloader);
		about_background_video_preloader.load();

		return () => {
			window.removeEventListener('online', handle_online);
			window.removeEventListener('offline', handle_offline);
			document.removeEventListener('about-background-music:play', play_about_background_music);
			about_background_video_preloader.remove();
		};
	});

	$effect(() => {
		if (!(page.url.pathname === about_href || page.url.pathname.endsWith('/about'))) {
			pause_about_background_music();
			return;
		}

		play_about_background_music();

		return () => {
			pause_about_background_music();
		};
	});

	$effect(() => {
		if (typeof document === 'undefined') {
			return;
		}

		const should_lock_navigation_background = hasnavigation_skeleton_visible;
		const html_element = document.documentElement;
		const body_element = document.body;
		const previous_html_overflow = html_element.style.overflow;
		const previous_body_overflow = body_element.style.overflow;
		const previous_body_touch_action = body_element.style.touchAction;

		if (should_lock_navigation_background) {
			html_element.style.overflow = 'hidden';
			body_element.style.overflow = 'hidden';
			body_element.style.touchAction = 'none';
		}

		return () => {
			html_element.style.overflow = previous_html_overflow;
			body_element.style.overflow = previous_body_overflow;
			body_element.style.touchAction = previous_body_touch_action;
		};
	});
</script>

<svelte:head>
	<link rel="preload" as="video" type="video/webm" href={about_background_video_src} />
	<link rel="preload" as="audio" type="audio/mpeg" href={about_background_music_src} />
</svelte:head>

<div class="app_shell" style={`--desktop-sidebar-width: ${$desktop_sidebar_width};`}>
	<audio
		bind:this={about_background_music_element}
		src={about_background_music_src}
		preload="auto"
		loop
		aria-hidden="true"
		tabindex="-1"
		class="sr-only"
	></audio>

	<GeneralTabs profile_username={data['profile_username']} />

	<main class="app_main md:min-h-screen">
		{@render children()}
	</main>

	<BackgroundVideoPostStatus />

	{#if hasnavigation_skeleton_visible}
		<div
			class="nav_skeleton fixed right-0 left-0 z-70 {isnavigating_to_profile ||
			isnavigating_to_profile_post
				? 'top-0 bottom-0'
				: 'top-18 bottom-18'} md:top-0 md:bottom-0"
		>
			{#if isnavigating_to_home || isnavigating_to_profile_post}
				<section
					class="home_skeleton_screen flex h-screen min-h-0 flex-col overflow-hidden text-white"
				>
					<div class="flex items-center justify-between p-4 md:p-6 lg:p-8">
						<div class="skeleton h-8 w-24 rounded-lg md:h-12 md:w-40"></div>
						<div class="skeleton h-6 w-6 rounded-md md:h-8 md:w-8"></div>
					</div>

					<div class="flex-1 overflow-hidden px-4 pb-6 md:px-8 md:pb-8">
						<div class="mx-auto flex max-w-xl flex-col gap-5 md:gap-8">
							{#each home_skeleton_cards as card (card)}
								<div
									class="overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px]"
								>
									<div class="flex items-center gap-3 px-5 pt-5">
										<div class="skeleton h-10 w-10 rounded-full md:h-11 md:w-11"></div>
										<div class="min-w-0 flex-1 space-y-2">
											<div class="skeleton h-4 w-28 rounded-md md:h-5 md:w-36"></div>
											<div class="skeleton h-3 w-20 rounded-sm md:h-4 md:w-24"></div>
										</div>
										<div class="skeleton h-3 w-5 rounded-sm"></div>
									</div>

									<div class="mx-3 mt-3 overflow-hidden rounded-2xl bg-black/20 md:mx-4">
										<div class="skeleton skeleton_cover h-64 w-full rounded-2xl md:h-104"></div>
									</div>

									<div class="flex items-center gap-4 px-4 py-3 md:gap-5 md:px-5">
										<div class="skeleton h-6 w-6 rounded-full"></div>
										<div class="skeleton h-6 w-6 rounded-full"></div>
										<div class="skeleton h-6 w-6 rounded-full"></div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</section>
			{:else if isnavigating_to_search}
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
					class="profile_skeleton_screen flex h-[calc(100dvh-4.5rem)] justify-center overflow-y-auto overscroll-x-none overscroll-y-none text-white md:h-screen"
				>
					<div
						class="flex min-h-full w-full max-w-6xl flex-col px-2 pt-2 pb-40 shadow-2xl md:min-h-0 md:p-2"
					>
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
</div>

{#if !isNetworkOnline}
	<div
		class="offline_overlay fixed inset-0 z-80 flex items-center justify-center px-6 py-10 text-white"
	>
		<div
			class="offline_card relative w-full max-w-xl overflow-hidden rounded-[2.25rem] px-8 py-12 text-center shadow-[0_24px_80px_rgba(7,3,25,0.45)] backdrop-blur-xl md:px-12"
		>
			<div class="offline_glow offline_glow_one"></div>
			<div class="offline_glow offline_glow_two"></div>

			<div class="offline_stars" aria-hidden="true">
				<span class="offline_star offline_star_one"></span>
				<span class="offline_star offline_star_two"></span>
				<span class="offline_star offline_star_three"></span>
			</div>

			<h2 class="mt-4 text-4xl font-bold tracking-[0.08em] md:text-5xl">Lost connection</h2>
			<p class="mx-auto mt-4 max-w-md text-sm leading-7 text-white/72 md:text-base">
				Reconnect to continue exploring your feed.
			</p>
		</div>
	</div>
{/if}

<style>
	@media (min-width: 768px) {
		.app_shell {
			min-height: 100vh;
			background-color: #09051c;
		}

		.app_main {
			min-height: 100vh;
			background-color: #09051c;
			padding-left: var(--desktop-sidebar-width);
			transition: padding-left 500ms cubic-bezier(0.22, 1, 0.36, 1);
		}

		.nav_skeleton {
			left: var(--desktop-sidebar-width);
			transition: left 500ms cubic-bezier(0.22, 1, 0.36, 1);
		}
	}

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

	.home_skeleton_screen {
		background:
			radial-gradient(780px 320px at 12% -8%, rgba(125, 212, 255, 0.12), transparent 70%),
			radial-gradient(760px 320px at 90% -12%, rgba(205, 130, 255, 0.14), transparent 70%);
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

	.offline_overlay {
		background:
			radial-gradient(900px 340px at 18% -8%, rgba(125, 212, 255, 0.14), transparent 72%),
			radial-gradient(850px 340px at 86% -12%, rgba(205, 130, 255, 0.16), transparent 70%),
			linear-gradient(180deg, rgba(9, 5, 28, 0.9) 0%, rgba(8, 4, 24, 0.96) 100%);
	}

	.offline_card {
		background:
			linear-gradient(180deg, rgba(18, 12, 43, 0.92), rgba(10, 7, 31, 0.96)),
			linear-gradient(120deg, rgba(125, 212, 255, 0.08), rgba(205, 130, 255, 0.08));
		border: 2px solid white;
		box-shadow:
			2px -2px 0 0 purple,
			6px -6px 12px 0 rgba(222, 5, 222, 0.55),
			0 0 0 1px white,
			-2px 2px 0 0 rgb(0, 149, 255),
			-6px 6px 12px 0 rgba(91, 192, 255, 0.55);
	}

	.offline_glow {
		position: absolute;
		border-radius: 9999px;
		filter: blur(22px);
		opacity: 0.7;
	}

	.offline_glow_one {
		top: -1.5rem;
		left: -1rem;
		height: 7rem;
		width: 7rem;
		background: rgba(125, 212, 255, 0.24);
	}

	.offline_glow_two {
		right: -1rem;
		bottom: -1.5rem;
		height: 8rem;
		width: 8rem;
		background: rgba(205, 130, 255, 0.22);
	}

	.offline_stars {
		position: relative;
		margin: 0 auto 1.5rem;
		height: 2rem;
		width: 8rem;
	}

	.offline_star {
		position: absolute;
		top: 50%;
		height: 0.45rem;
		width: 0.45rem;
		border-radius: 9999px;
		--offline-star-x: 0;
		transform: translate(var(--offline-star-x), -50%);
		background: white;
		box-shadow:
			0 0 12px rgba(255, 255, 255, 0.45),
			0 0 24px currentColor;
	}

	.offline_star_one {
		left: 0.6rem;
		color: #7dd4ff;
		animation: offline_bounce 1.4s ease-in-out infinite;
	}

	.offline_star_two {
		left: 50%;
		height: 0.65rem;
		width: 0.65rem;
		color: #e9a0f8;
		--offline-star-x: -50%;
		animation: offline_bounce 1.4s ease-in-out 0.18s infinite;
	}

	.offline_star_three {
		right: 0.6rem;
		color: #cd82ff;
		animation: offline_bounce 1.4s ease-in-out 0.36s infinite;
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

	@keyframes offline_bounce {
		0%,
		100% {
			transform: translate(var(--offline-star-x), -50%) scale(1);
			opacity: 0.72;
		}

		30% {
			transform: translate(var(--offline-star-x), -90%) scale(1.08);
			opacity: 1;
		}

		55% {
			transform: translate(var(--offline-star-x), -38%) scale(0.96);
			opacity: 0.9;
		}
	}
</style>

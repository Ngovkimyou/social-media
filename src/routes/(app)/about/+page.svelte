<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	const about_background_video_src = `${base}/video/About-Background.webm`;
	const about_background_fallback_src = `${base}/assets/Pixel Art.gif`;

	let background_video_element = $state<HTMLVideoElement>();
	let is_background_video_supported = $state(true);
	let is_background_video_ready = $state(false);
	let has_requested_music = $state(false);

	function can_play_webm_video() {
		if (typeof document === 'undefined') {
			return true;
		}

		const probe = document.createElement('video');
		return (
			probe.canPlayType('video/webm; codecs="vp9"').length > 0 ||
			probe.canPlayType('video/webm; codecs="vp8"').length > 0 ||
			probe.canPlayType('video/webm').length > 0
		);
	}

	function request_background_music() {
		if (typeof document === 'undefined') {
			return;
		}

		has_requested_music = true;
		document.dispatchEvent(new CustomEvent('about-background-music:play'));
	}

	function play_background_video() {
		if (!background_video_element || !is_background_video_supported) {
			return;
		}

		background_video_element.muted = true;
		background_video_element.playsInline = true;
		background_video_element.load();

		void background_video_element.play().catch(() => {
			is_background_video_ready = false;
		});
	}

	onMount(() => {
		is_background_video_supported = can_play_webm_video();

		if (!is_background_video_supported) {
			return;
		}

		const retry_media = () => {
			play_background_video();
			request_background_music();
		};

		play_background_video();
		window.addEventListener('pointerdown', retry_media, { capture: true, passive: true });
		window.addEventListener('touchstart', retry_media, { capture: true, passive: true });
		document.addEventListener('visibilitychange', play_background_video);

		return () => {
			window.removeEventListener('pointerdown', retry_media, { capture: true });
			window.removeEventListener('touchstart', retry_media, { capture: true });
			document.removeEventListener('visibilitychange', play_background_video);
		};
	});

	const team_sections = [
		{
			role: 'Project Leader',
			name: 'Kimyoo NGOV',
			contributions: [
				'UI/UX Designer',
				'Sidebar, Home Screen, Search Screen',
				'Non-functionality requirements',
				'Documentation & Deployment Handler'
			]
		},
		{
			role: 'Sub-Leader',
			name: 'Phearith HENG',
			contributions: ['Home Screen developer', 'Security Handler']
		},
		{
			role: 'Team Members',
			members: [
				{
					name: 'Mouyheang SENG',
					contributions: ['Profile Screen', 'Home Screen developer']
				},
				{
					name: 'Elswin LIM',
					contributions: ['Login & Sign-Up Screen']
				}
			]
		},
		{
			role: 'Assistant',
			name: 'Ream Rachna PICH',
			contributions: ['Logo Designer']
		}
	];

	const shared_responsibilities = ['Backend & Database', 'Testing'];

	const technologies = [
		['Design', 'Figma'],
		['Frontend Framework', 'SvelteKit'],
		['Database', 'Drizzle ORM with Neon Database'],
		['Media Storage', 'Cloudinary']
	];
</script>

<svelte:head>
	<title>About | Space and Time</title>
</svelte:head>

{#snippet credits_content()}
	<div
		class="flex w-full max-w-3xl flex-col items-center gap-24 pt-[70vh] pb-72 md:gap-32 md:pb-96"
	>
		<header class="flex flex-col items-center">
			<p class="text-sm font-semibold tracking-[0.24em] text-sky-300 uppercase">About</p>
			<h1 class="mt-3 text-4xl font-bold md:text-5xl">Space and Time</h1>
			<p class="mt-4 max-w-2xl text-sm leading-7 text-white/72 md:text-base">
				A social media project built by a student team, shaped through design, engineering,
				documentation, and testing. Designed to connect users through modern UI/UX and culturally
				aware communication features.
			</p>
		</header>

		<section class="flex flex-col items-center">
			<p class="text-sm font-semibold tracking-[0.22em] text-sky-300 uppercase">Instructor</p>
			<h2 class="mt-3 text-2xl font-bold text-purple-200 md:text-3xl">Sinya Iwasaki</h2>
		</section>

		<section class="flex w-full flex-col items-center">
			<p class="text-sm font-semibold tracking-[0.22em] text-sky-300 uppercase">Credits</p>
			<h2 class="mt-3 text-3xl font-bold md:text-4xl">Project Team</h2>

			<div class="mt-14 flex w-full flex-col items-center gap-16 md:gap-20">
				{#each team_sections as member (member.role)}
					<article class="flex w-full max-w-xl flex-col items-center">
						<p
							class="text-sm font-bold text-sky-300 underline decoration-sky-300/70 underline-offset-4"
						>
							{member.role}
						</p>
						{#if 'members' in member}
							<div class="mt-3 flex flex-col items-center gap-6">
								{#each member.members as team_member (team_member.name)}
									<div class="flex flex-col items-center">
										<h3 class="text-xl font-bold text-purple-200">{team_member.name}</h3>
										<div
											class="mt-3 flex flex-col items-center gap-1 text-sm leading-6 text-white/72"
										>
											{#each team_member.contributions as contribution (contribution)}
												<p>{contribution}</p>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<h3 class="mt-3 text-xl font-bold text-purple-200">{member.name}</h3>
							<div class="mt-3 flex flex-col items-center gap-1 text-sm leading-6 text-white/72">
								{#each member.contributions as contribution (contribution)}
									<p>{contribution}</p>
								{/each}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		</section>

		<section class="flex flex-col items-center">
			<h2 class="text-3xl font-bold">Shared Responsibilities</h2>
			<div class="mt-4 flex flex-col items-center gap-1 text-sm leading-6 text-white/72">
				{#each shared_responsibilities as responsibility (responsibility)}
					<p>{responsibility}</p>
				{/each}
			</div>
		</section>

		<section class="flex flex-col items-center">
			<h2 class="text-3xl font-bold">Technologies & Tools</h2>
			<dl class="mt-4 grid gap-2 text-sm leading-6 text-white/72">
				{#each technologies as [label, value] (label)}
					<div>
						<dt class="inline font-bold text-white">{label}:</dt>
						<dd class="inline">{value}</dd>
					</div>
				{/each}
			</dl>
		</section>

		<section class="flex w-full flex-col items-center">
			<h2 class="text-3xl font-bold">References & Assets</h2>
			<p class="mt-4 text-sm font-semibold text-white/82">Login/Sign-Up Animation (GIF)</p>
			<a
				href="https://livewallpapers4free.com/her-vast-emerald-elven-eyes/"
				target="_blank"
				rel="noreferrer"
				class="mt-2 max-w-full text-sm leading-6 wrap-break-word text-sky-300 underline decoration-sky-300/40 underline-offset-4 transition-colors hover:text-sky-100"
			>
				https://livewallpapers4free.com/her-vast-emerald-elven-eyes/
			</a>
		</section>
	</div>
{/snippet}

<section
	class="about-credit-screen relative isolate flex h-[calc(100dvh-4rem)] items-start justify-center overflow-y-auto px-4 text-center text-white md:h-screen md:px-8"
	data-nonselectable-ui="true"
>
	<video
		bind:this={background_video_element}
		class="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover opacity-[0.08]"
		src={about_background_video_src}
		autoplay
		muted
		loop
		playsinline
		preload="auto"
		aria-hidden="true"
		oncanplay={() => {
			is_background_video_ready = true;
		}}
		onplaying={() => {
			is_background_video_ready = true;
		}}
		onerror={() => {
			is_background_video_supported = false;
		}}
	></video>

	{#if !is_background_video_supported || !is_background_video_ready}
		<img
			src={about_background_fallback_src}
			alt=""
			class="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover opacity-[0.08]"
			aria-hidden="true"
			loading="eager"
			decoding="async"
		/>
	{/if}

	<button
		type="button"
		class="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/35 text-white/85 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-white/12 hover:text-white"
		aria-label="Play background music"
		aria-pressed={has_requested_music}
		onclick={request_background_music}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true" class="h-5 w-5">
			<path
				d="M9 17.2V7.7l8-2v9.4"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
			/>
			<circle cx="6.7" cy="17.2" r="2.3" fill="none" stroke="currentColor" stroke-width="2" />
			<circle cx="14.7" cy="15.1" r="2.3" fill="none" stroke="currentColor" stroke-width="2" />
		</svg>
	</button>

	<div class="about-credit-track relative z-10 flex w-full flex-col items-center">
		{@render credits_content()}
		<div aria-hidden="true" class="flex w-full justify-center">
			{@render credits_content()}
		</div>
	</div>
</section>

<style>
	.about-credit-screen {
		scrollbar-gutter: stable;
		scrollbar-width: thin;
		scrollbar-color: rgba(205, 130, 255, 0.8) rgba(255, 255, 255, 0.04);
	}

	.about-credit-screen::-webkit-scrollbar {
		width: 0.9rem;
	}

	.about-credit-screen::-webkit-scrollbar-track {
		margin-block: 0.75rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.04);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}

	.about-credit-screen::-webkit-scrollbar-thumb {
		border: 0.28rem solid transparent;
		border-radius: 999px;
		background: linear-gradient(180deg, rgba(255, 167, 218, 0.95), rgba(125, 212, 255, 0.92))
			padding-box;
		box-shadow: 0 0 18px rgba(205, 130, 255, 0.32);
	}

	.about-credit-screen::-webkit-scrollbar-thumb:hover {
		background: linear-gradient(180deg, rgba(255, 193, 229, 1), rgba(151, 224, 255, 1)) padding-box;
	}

	.about-credit-track {
		animation: about-credit-roll 58s linear infinite;
		will-change: transform;
	}

	@keyframes about-credit-roll {
		from {
			transform: translateY(0);
		}

		to {
			transform: translateY(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.about-credit-screen {
			overflow-y: auto;
		}

		.about-credit-track {
			animation: none;
		}
	}
</style>

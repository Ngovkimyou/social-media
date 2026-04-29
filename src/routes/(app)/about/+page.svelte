<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	const about_background_video_src = `${base}/video/About-Background.webm`;
	const about_background_video_mp4_src = `${base}/video/About-Background.mp4`;

	let background_video_element = $state<HTMLVideoElement>();
	let is_background_video_supported = $state(true);
	let is_background_video_ready = $state(false);
	let is_music_playing = $state(false);

	function toggle_background_music() {
		if (typeof document === 'undefined') {
			return;
		}

		document.dispatchEvent(new CustomEvent('about-background-music:toggle'));
	}

	function handle_music_state(event: Event) {
		const custom_event = event as CustomEvent<{ is_playing?: boolean }>;
		is_music_playing = Boolean(custom_event.detail?.is_playing);
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
		play_background_video();
		document.addEventListener('visibilitychange', play_background_video);
		document.addEventListener('about-background-music:state', handle_music_state);
		document.dispatchEvent(new CustomEvent('about-background-music:request-state'));

		return () => {
			document.removeEventListener('visibilitychange', play_background_video);
			document.removeEventListener('about-background-music:state', handle_music_state);
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
	>
		<source src={about_background_video_mp4_src} type="video/mp4" />
		<source src={about_background_video_src} type="video/webm" />
	</video>

	{#if !is_background_video_supported || !is_background_video_ready}
		<div
			class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(125,212,255,0.10),transparent_34%),radial-gradient(circle_at_bottom,rgba(205,130,255,0.12),transparent_36%),#050816]"
			aria-hidden="true"
		></div>
	{/if}

	<button
		type="button"
		class={`fixed top-[max(5rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20 grid h-10 w-10 place-items-center rounded-full border text-white/90 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:text-white md:top-[max(1rem,env(safe-area-inset-top))] ${
			is_music_playing
				? 'border-sky-200/45 bg-sky-400/18 shadow-[0_0_22px_rgba(125,212,255,0.18),0_12px_34px_rgba(0,0,0,0.35)] hover:bg-sky-400/28'
				: 'border-rose-200/35 bg-rose-500/16 shadow-[0_0_22px_rgba(251,113,133,0.14),0_12px_34px_rgba(0,0,0,0.35)] hover:bg-rose-500/24'
		}`}
		aria-label={is_music_playing ? 'Turn off background music' : 'Turn on background music'}
		aria-pressed={is_music_playing}
		onclick={toggle_background_music}
	>
		{#if is_music_playing}
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
		{:else}
			<svg viewBox="0 0 24 24" aria-hidden="true" class="h-5 w-5">
				<path
					d="M8.7 16.9V7.8l7.6-1.9v8.8"
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
				/>
				<circle cx="6.5" cy="16.9" r="2.1" fill="none" stroke="currentColor" stroke-width="2" />
				<circle cx="13.9" cy="14.9" r="2.1" fill="none" stroke="currentColor" stroke-width="2" />
				<path
					d="M4.5 4.5 19.5 19.5"
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-width="2.4"
				/>
			</svg>
		{/if}
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

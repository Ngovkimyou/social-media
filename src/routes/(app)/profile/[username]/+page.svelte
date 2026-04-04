<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { PageProps } from './$types';
	import { build_responsive_image_source } from '$lib/utilities/responsive-image';
	import ProgressiveImage from '$lib/components/ProgressiveImage.svelte';

	const { data, form }: PageProps = $props();

	const cover_image =
		'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=75';
	const about_icons = {
		location: '/images/profile/Address.avif',
		email: '/images/profile/Gmail.avif',
		phone: '/images/profile/Phone.avif',
		add: '/images/profile/Add.avif'
	};

	const profile_icons = {
		share: '/images/profile/share-account.avif',
		edit: '/images/profile/edit-profile.avif',
		settings: '/images/profile/setting.avif',
		relationship: '/images/profile/add-friend.avif',
		relationship_followed: '/images/profile/followed-icon.avif',
		message: '/images/profile/send-message-icon.avif'
	};

	const profile_about = $derived(
		data['profile'] as (typeof data)['profile'] & {
			location?: string | null;
			phone?: string | null;
		}
	);

	let active_tab = $state<'posts' | 'videos' | 'shared'>('posts');
	// eslint-disable-next-line @typescript-eslint/naming-convention
	let upload_modal_open = $state(false);
	let upload_modal_backdrop = $state<HTMLDivElement | undefined>();

	const post_tiles = $derived.by(() =>
		data['photo_urls'].map((img: string, index: number) => ({
			id: index + 1,
			image: build_responsive_image_source(img, {
				widths: [360, 540, 720, 960, 1200],
				height: 'match-width',
				fit: 'lfill',
				quality: 100
			})
		}))
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const success_message = $derived(
		(form as { success?: boolean } | null | undefined)?.success === true
	);
	const profile_display_name = $derived(data['profile'].name ?? data['profile'].username);
	const profile_avatar = $derived(data['profile'].image);
	const profile_cover = $derived(data['profile'].cover_image ?? cover_image);
	const profile_cover_source = $derived(
		build_responsive_image_source(profile_cover, {
			widths: [960, 1280, 1600, 1920, 2560],
			fit: 'lfill',
			quality: 100
		})
	);
	const profile_avatar_source = $derived(
		profile_avatar
			? build_responsive_image_source(profile_avatar, {
					widths: [128, 192, 256, 384, 512, 640],
					height: 'match-width',
					fit: 'lfill',
					quality: 100
				})
			: undefined
	);
	let isrelationship_following = $state(false);
	let profile_followers_count = $state(0);
	let relationship_profile_sync_key = $state('');
	let relationship_sync_queue = Promise.resolve();
	const relationship_icon_source = $derived(
		isrelationship_following ? profile_icons.relationship_followed : profile_icons.relationship
	);
	const relationship_background_style = $derived(
		isrelationship_following
			? 'linear-gradient(90deg, #AAAAAA30 0%, #77777730 50%, #7AA5BB30 75%, #7DD4FF30 100%)'
			: '#3F2C56'
	);
	const relationship_shadow_style = $derived(
		isrelationship_following
			? '0 4px 12px rgba(125, 212, 255, 0.55), inset 1px -1px 30px 0px #CD82FF, inset 0.5px -0.5px 10px 0px #CD82FF'
			: ''
	);
	const relationship_followed_effect_style = $derived(
		isrelationship_following
			? `box-shadow:${relationship_shadow_style};backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);`
			: ''
	);

	function open_upload_modal() {
		submitting_post = false;
		upload_modal_open = true;
	}

	function close_upload_modal() {
		submitting_post = false;
		upload_modal_open = false;
	}

	let selected_image = $state<File>();
	let image_src = $state('');
	let caption = $state('');
	let share_feedback = $state('');
	// eslint-disable-next-line @typescript-eslint/naming-convention
	let submitting_post = $state(false);

	$effect(() => {
		const next_sync_key = data['profile'].user_id;

		if (relationship_profile_sync_key === next_sync_key) {
			return;
		}

		relationship_profile_sync_key = next_sync_key;
		isrelationship_following =
			!data['relationship'].is_own_profile && data['relationship'].is_following;
		profile_followers_count = data['stats'].followers_count;
	});

	$effect(() => {
		if (!upload_modal_open) {
			return;
		}

		void tick().then(() => {
			upload_modal_backdrop?.focus();
		});
	});

	function handle_file_change(event: Event) {
		const target = event.currentTarget as HTMLInputElement | null;
		const file = target?.files?.[0];

		if (image_src) {
			URL.revokeObjectURL(image_src);
		}

		if (file) {
			selected_image = file;
			image_src = URL.createObjectURL(file);
			return;
		}

		selected_image = undefined;
		image_src = '';
	}

	function remove_image() {
		if (image_src) {
			URL.revokeObjectURL(image_src);
		}

		selected_image = undefined;
		image_src = '';

		// Reset the file input so it can be reused
		const file_input = document.getElementById('file-upload') as HTMLInputElement | null;
		if (file_input) {
			file_input.value = '';
		}
	}

	function handle_post_submit() {
		submitting_post = true;
	}

	function submit_selected_image(event: Event) {
		const target = event.currentTarget as HTMLInputElement | null;

		if (target?.files?.[0]) {
			target.form?.requestSubmit();
		}
	}

	function handle_profile_image_change(event: Event) {
		submit_selected_image(event);
	}

	function handle_cover_image_change(event: Event) {
		submit_selected_image(event);
	}

	async function handle_relationship_button_click() {
		if (data['relationship'].is_own_profile) {
			return;
		}

		const hasfollowing_before_request = isrelationship_following;
		const previous_followers_count = profile_followers_count;
		const isnext_following = !isrelationship_following;
		isrelationship_following = isnext_following;
		profile_followers_count = Math.max(0, profile_followers_count + (isnext_following ? 1 : -1));

		const action = isnext_following ? '?/follow' : '?/unfollow';
		relationship_sync_queue = relationship_sync_queue
			.then(async () => {
				const action_form_data = new FormData();
				const response = await fetch(action, {
					method: 'POST',
					body: action_form_data,
					headers: {
						'x-sveltekit-action': 'true'
					},
					credentials: 'same-origin'
				});

				if (!response.ok || response.redirected) {
					isrelationship_following = hasfollowing_before_request;
					profile_followers_count = previous_followers_count;
					console.warn('Relationship sync request failed.');
				}
			})
			.catch(() => {
				isrelationship_following = hasfollowing_before_request;
				profile_followers_count = previous_followers_count;
				console.warn('Relationship sync request failed.');
			});
	}

	async function handle_share_profile_click() {
		const profile_url = window.location.href;

		try {
			if (navigator.share) {
				await navigator.share({
					title: `${profile_display_name} (@${data['profile'].username})`,
					text: `Check out ${profile_display_name}'s profile`,
					url: profile_url
				});
				share_feedback = 'Profile link shared.';
			} else {
				await navigator.clipboard.writeText(profile_url);
				share_feedback = 'Profile link copied.';
			}
		} catch {
			try {
				await navigator.clipboard.writeText(profile_url);
				share_feedback = 'Profile link copied.';
			} catch {
				share_feedback = 'Unable to share profile link.';
			}
		}

		setTimeout(() => {
			share_feedback = '';
		}, 2500);
	}

	onDestroy(() => {
		if (image_src) {
			URL.revokeObjectURL(image_src);
		}
	});
</script>

<svelte:head>
	<title>Profile | Space and Time</title>
	<link rel="preload" as="image" href={profile_cover_source.src} fetchpriority="high" />
	{#if profile_avatar}
		<link
			rel="preload"
			as="image"
			href={profile_avatar_source?.src ?? profile_avatar}
			fetchpriority="high"
		/>
	{/if}
</svelte:head>

<div
	class="flex h-screen justify-center overflow-y-scroll overscroll-x-none overscroll-y-none bg-[#0a0b1e] text-white"
>
	<div class="flex w-full max-w-6xl flex-col p-2 shadow-2xl">
		<div class="relative h-56 w-full md:h-74">
			<div class="relative h-full w-full overflow-hidden rounded-3xl">
				<ProgressiveImage
					src={profile_cover_source.src}
					srcset={profile_cover_source.srcset}
					sizes="(max-width: 768px) 100vw, 960px"
					alt="Cover"
					wrapper_class="h-full w-full"
					img_class="h-full w-full object-cover"
					skeleton_class="rounded-3xl"
					loading="eager"
					decoding="async"
					fetchpriority="high"
				/>

				{#if data['relationship'].is_own_profile}
					<form
						method="post"
						action="?/update_cover_image"
						enctype="multipart/form-data"
						class="absolute inset-0 z-20"
					>
						<label
							for="cover-image-upload"
							class="group relative block h-full w-full cursor-pointer"
						>
							<span
								class="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20"
							></span>
						</label>
						<input
							id="cover-image-upload"
							type="file"
							name="cover"
							accept="image/*"
							class="sr-only"
							onchange={handle_cover_image_change}
						/>
					</form>
				{/if}
			</div>

			<div
				class="absolute -bottom-14 left-1/2 z-30 h-32 w-32 -translate-x-1/2 md:-bottom-20 md:h-48 md:w-48"
			>
				{#if data['profile'].image}
					<div
						class="relative z-10 h-full w-full overflow-hidden rounded-full border-5 border-[#0a0b1e] bg-[#1b1c31] lg:border-7"
					>
						<ProgressiveImage
							src={profile_avatar_source?.src ?? data['profile'].image}
							srcset={profile_avatar_source?.srcset}
							sizes="(max-width: 768px) 128px, 192px"
							alt={data['profile'].name
								? `${data['profile'].name} avatar`
								: `${data['profile'].username} avatar`}
							wrapper_class="h-full w-full rounded-full"
							img_class="h-full w-full rounded-full object-cover"
							skeleton_class="rounded-full"
							loading="eager"
							decoding="async"
							fetchpriority="high"
						/>
					</div>
				{:else}
					<div
						class="relative z-10 flex h-full w-full items-center justify-center rounded-full border-5 border-[#0a0b1e] bg-[#1b1c31] text-5xl font-bold text-slate-300 lg:border-7"
					>
						{data['profile'].username.slice(0, 1).toUpperCase()}
					</div>
				{/if}

				{#if data['relationship'].is_own_profile}
					<form
						method="post"
						action="?/update_profile_image"
						enctype="multipart/form-data"
						class="absolute inset-0 z-30"
					>
						<label
							for="profile-image-upload"
							class="group relative block h-full w-full cursor-pointer rounded-full"
						>
							<span
								class="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover:bg-black/20"
							></span>
						</label>
						<input
							id="profile-image-upload"
							type="file"
							name="avatar"
							accept="image/*"
							class="sr-only"
							onchange={handle_profile_image_change}
						/>
					</form>
				{/if}

				<button
					class="absolute top-10 -left-40 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-left-25 md:-left-30 md:shadow-md lg:-left-45 lg:h-15 lg:w-15 xl:-left-70"
				>
					<img
						src={data['relationship'].is_own_profile ? profile_icons.edit : profile_icons.message}
						alt="Edit"
						class="h-5 w-5 object-contain lg:h-9 lg:w-9 {data['relationship'].is_own_profile
							? 'pl-1'
							: ''}"
					/>
				</button>

				<button
					type="button"
					onclick={() => {
						void handle_share_profile_click();
					}}
					class="absolute bottom-5 -left-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-left-12 sm:z-20 md:-left-15 md:z-20 md:shadow-md lg:-left-25 lg:h-15 lg:w-15 xl:-left-40"
				>
					<img
						src={profile_icons.share}
						alt="Share"
						class="h-5 w-5 object-contain pr-1 lg:h-8 lg:w-8"
					/>
				</button>

				<button
					type="button"
					onclick={handle_relationship_button_click}
					class="absolute -right-20 bottom-5 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-right-12 md:-right-15 md:shadow-md lg:-right-25 lg:h-15 lg:w-15 xl:-right-40"
					style={`background:${relationship_background_style};${relationship_followed_effect_style}`}
				>
					<img
						src={relationship_icon_source}
						alt={data['relationship'].is_own_profile
							? 'Add'
							: isrelationship_following
								? 'Unfollow'
								: 'Follow'}
						class="h-6 w-6 object-contain pl-1 lg:h-9 lg:w-9"
					/>
				</button>

				<button
					class="absolute top-10 -right-40 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-right-25 md:-right-30 md:shadow-md lg:-right-45 lg:h-15 lg:w-15 xl:-right-70"
				>
					<img
						src={profile_icons.settings}
						alt="Settings"
						class="h-6 w-6 object-contain lg:h-8 lg:w-8"
					/>
				</button>
			</div>
		</div>

		<div class="mt-16 text-center md:mt-30">
			<h1 class="text-2xl font-bold tracking-wide md:text-3xl">
				{data['profile'].name ?? data['profile'].username}
			</h1>
			<p class="md:text-md text-sm text-slate-400">@{data['profile'].username}</p>
			{#if share_feedback}
				<p class="mt-3 text-xs font-medium text-sky-300">{share_feedback}</p>
			{/if}
		</div>

		{#if form?.message}
			<p
				class="mx-6 mt-4 rounded-xl border px-4 py-3 text-sm {success_message
					? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
					: 'border-rose-400/40 bg-rose-500/15 text-rose-100'}"
			>
				{form.message}
			</p>
		{/if}

		<div class="mx-auto mt-6 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-6 md:gap-10">
			<div class="text-center">
				<div class="text-2xl font-bold text-sky-400">{data['stats'].post_count}</div>
				<div class="text-xs tracking-wider text-slate-500 uppercase">Posts</div>
			</div>

			<div class="h-8 w-px bg-slate-700"></div>

			<div class="text-center">
				<div class="text-2xl font-bold text-sky-400">{profile_followers_count}</div>
				<div class="text-xs tracking-wider text-slate-500 uppercase">Followers</div>
			</div>

			<div class="h-8 w-px bg-slate-700"></div>

			<div class="text-center">
				<div class="text-2xl font-bold text-sky-400">{data['stats'].following_count}</div>
				<div class="text-xs tracking-wider text-slate-500 uppercase">Following</div>
			</div>
		</div>

		<div class="relative mx-2 mt-6 rounded-3xl bg-[#121324] p-6">
			<div
				class="absolute inset-0 rounded-3xl bg-linear-to-r from-[#CD82FF] via-[#FF0DA6] to-[#C575E3] p-px"
			>
				<div class="h-full w-full rounded-3xl bg-[#121324]"></div>
			</div>

			<span
				class="absolute -top-3 left-6 z-10 rounded-2xl bg-[#0a0b1e] px-3 text-xs font-semibold tracking-wide text-purple-400"
			>
				ABOUT
			</span>

			<p class="relative z-10 mt-1 text-sm whitespace-pre-wrap text-slate-200">
				{data['profile'].bio || 'No bio added yet.'}
			</p>

			<div class="relative z-10 mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300">
				{#if profile_about.location}
					<div class="flex items-center gap-2">
						<img src={about_icons.location} alt="Location" class="h-4 w-4" />
						{profile_about.location}
					</div>
				{:else if data['relationship'].is_own_profile}
					<div class="flex cursor-pointer items-center gap-2 font-medium text-sky-400">
						<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add location
					</div>
				{/if}

				{#if profile_about.email}
					<div class="flex items-center gap-2 truncate">
						<img src={about_icons.email} alt="Email" class="h-4 w-4" />
						{profile_about.email}
					</div>
				{:else if data['relationship'].is_own_profile}
					<div class="flex cursor-pointer items-center gap-2 font-medium text-sky-400">
						<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add email
					</div>
				{/if}

				{#if profile_about.phone}
					<div class="flex items-center gap-2">
						<img src={about_icons.phone} alt="Phone" class="h-4 w-4" />
						{profile_about.phone}
					</div>
				{:else if data['relationship'].is_own_profile}
					<div class="flex cursor-pointer items-center gap-2 font-medium text-sky-400">
						<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add phone number
					</div>
				{/if}

				{#if data['relationship'].is_own_profile}
					<div class="flex cursor-pointer items-center gap-2 font-medium text-sky-400">
						<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add More
					</div>
				{/if}
			</div>
		</div>

		<div
			class=" mt-6 flex items-center gap-2 rounded-full border-[6px] border-[#535060] bg-[#474555] p-1.5 text-sm font-bold"
		>
			<button
				onclick={() => (active_tab = 'posts')}
				class="flex-1 cursor-pointer rounded-full border-2 py-3 text-center text-white opacity-85 transition-all hover:opacity-100 {active_tab ===
				'posts'
					? 'border-[#E9A0F8] bg-linear-to-r from-[#62218D] via-[#62218D] to-[#E1B4FF] shadow-[0_0_15px_rgba(255,0,229,25)]'
					: 'border-[#7DD4FF] bg-linear-to-r from-[#4B7F99] via-[#7DD4FF] to-[#B9E8FF]'}"
			>
				Posts
			</button>
			<button
				onclick={() => (active_tab = 'videos')}
				class="flex-1 cursor-pointer rounded-full border-2 py-3 text-center text-white opacity-85 transition-all hover:opacity-100 {active_tab ===
				'videos'
					? 'border-[#E9A0F8] bg-linear-to-r from-[#62218D] via-[#62218D] to-[#E1B4FF] shadow-[0_0_15px_rgba(255,0,229,25)]'
					: 'border-[#7DD4FF] bg-linear-to-r from-[#4B7F99] via-[#7DD4FF] to-[#B9E8FF]'}"
			>
				Videos
			</button>
			<button
				onclick={() => (active_tab = 'shared')}
				class="flex-1 cursor-pointer rounded-full border-2 py-3 text-center text-white opacity-85 transition-all hover:opacity-100 {active_tab ===
				'shared'
					? 'border-[#E9A0F8] bg-linear-to-r from-[#62218D] via-[#62218D] to-[#E1B4FF] shadow-[0_0_15px_rgba(255,0,229,25)]'
					: 'border-[#7DD4FF] bg-linear-to-r from-[#4B7F99] via-[#7DD4FF] to-[#B9E8FF]'}"
			>
				Shared
			</button>
		</div>

		{#if active_tab === 'posts'}
			<div
				class="mx-2 mt-2 grid grid-cols-3 gap-1 pb-8 md:gap-3"
				style="content-visibility:auto; contain-intrinsic-size: 720px;"
			>
				{#if data['relationship'].is_own_profile}
					<button
						type="button"
						onclick={open_upload_modal}
						class="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-purple-500/20 bg-linear-to-br from-[#7DD4FF] via-[#AAAAAA] to-[#CD82FF] transition-transform hover:scale-[0.98] md:rounded-2xl"
					>
						<span class="text-5xl font-light text-white/70">+</span>
					</button>
				{/if}

				{#each post_tiles as post (post.id)}
					<div
						class="aspect-square cursor-pointer overflow-hidden rounded-xl transition-transform hover:scale-[0.98] md:rounded-2xl"
					>
						<ProgressiveImage
							src={post.image.src}
							srcset={post.image.srcset}
							sizes="(max-width: 768px) 33vw, (max-width: 1280px) 30vw, 360px"
							alt="Post"
							wrapper_class="h-full w-full"
							img_class="h-full w-full object-cover"
							skeleton_class="rounded-xl md:rounded-2xl"
							loading="lazy"
							decoding="async"
						/>
					</div>
				{/each}
			</div>
		{/if}

		{#if active_tab === 'videos'}
			<div class="mx-6 mt-6 grid grid-cols-3 gap-1 pb-8 md:gap-3">
				{#if data['relationship'].is_own_profile}
					<button
						type="button"
						class="flex aspect-9/16 cursor-pointer items-center justify-center rounded-xl border border-purple-500/20 bg-linear-to-br from-[#7DD4FF] via-[#AAAAAA] to-[#CD82FF] transition-transform hover:scale-[0.98] md:rounded-2xl"
					>
						<span class="text-5xl font-light text-white/70">+</span>
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if upload_modal_open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="0"
		bind:this={upload_modal_backdrop}
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				close_upload_modal();
			}
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				close_upload_modal();
			}
		}}
	>
		<div
			class="w-full rounded-3xl bg-linear-to-r from-[#7DD4FF] to-[#CD82FF] p-px transition-all duration-500 ease-in-out {image_src
				? 'max-w-4xl'
				: 'max-w-lg'}"
		>
			<div
				class="flex max-h-[90vh] w-full overflow-hidden rounded-3xl bg-[#1a1224] shadow-[0_0_5px_rgba(255,0,229,10)]"
			>
				<form
					method="post"
					action="?/create_post"
					enctype="multipart/form-data"
					onsubmit={handle_post_submit}
					class="flex flex-1 flex-col"
				>
					<div class="flex items-center justify-between border-b border-white/40 px-4 py-3">
						<div class="w-5"></div>

						<h2 class="text-base font-semibold text-white">Create post</h2>

						<button
							type="button"
							onclick={close_upload_modal}
							class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#3a3b3c] text-white hover:bg-[#4e4f50]"
						>
							✕
						</button>
					</div>

					<div class="flex flex-1 flex-col overflow-hidden md:flex-row">
						{#if image_src}
							<div
								class="relative flex min-h-96 w-full items-center justify-center border-r border-white/40 bg-[#18191a] md:min-h-0 md:w-1/2"
							>
								<img
									src={image_src}
									alt="Preview"
									class="h-100 w-full object-cover"
									decoding="async"
								/>

								<button
									type="button"
									onclick={remove_image}
									class="absolute top-4 right-4 cursor-pointer rounded-full bg-black/60 px-3 py-1.5 text-white hover:bg-black/80"
								>
									✕
								</button>
							</div>
						{/if}

						<div class="flex w-full flex-1 flex-col p-4 {image_src ? 'md:w-1/2' : ''}">
							<div class="mb-4 flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-500 text-xs text-white"
								>
									{#if profile_avatar}
										<img
											src={profile_avatar_source?.src ?? profile_avatar}
											srcset={profile_avatar_source?.srcset}
											sizes="40px"
											alt={`${profile_display_name} avatar`}
											class="h-full w-full object-cover"
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<span>{data['profile'].username.slice(0, 1).toUpperCase()}</span>
									{/if}
								</div>
								<div>
									<p class="text-sm font-semibold text-white">{profile_display_name}</p>
									<p class="text-xs text-slate-400">@{data['profile'].username}</p>
								</div>
							</div>

							<textarea
								id="upload-caption"
								name="caption"
								bind:value={caption}
								rows={image_src ? 6 : 4}
								placeholder="Write a caption..."
								class="w-full flex-1 resize-none border-0 bg-transparent p-0 text-white placeholder:text-slate-500 focus:ring-0 focus:outline-none {image_src
									? 'text-sm'
									: 'text-lg'}"
							></textarea>

							<div class="my-2 flex items-center justify-between text-slate-400">
								<span class="text-xs">{caption.length}/1000</span>
								{#if caption.length > 1000}
									<span class="text-xs text-rose-400">Caption exceeds maximum length!</span>
								{/if}
							</div>

							<label
								for="file-upload"
								class="mt-auto flex cursor-pointer items-center justify-between rounded-lg border border-white/40 px-4 py-3 hover:bg-white/5"
							>
								<span class="text-sm font-semibold text-white">
									{image_src ? 'Photo selected' : 'Add a photo'}
								</span>

								<span class="rounded-full p-1 text-xl">🖼️</span>
							</label>
							<input
								id="file-upload"
								type="file"
								name="image"
								accept="image/*"
								class="sr-only"
								onchange={handle_file_change}
							/>

							<button
								type="submit"
								class="text-md mt-4 w-full cursor-pointer rounded-xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] py-3 font-semibold text-white shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-transform hover:scale-[0.98] {!selected_image ||
								caption.length > 1000 ||
								submitting_post
									? 'cursor-not-allowed opacity-50'
									: 'shadow-[0_0_10px_rgba(255,179,201,25)]'}"
								disabled={!selected_image || caption.length > 1000 || submitting_post}
							>
								{submitting_post ? 'Posting...' : 'Post'}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

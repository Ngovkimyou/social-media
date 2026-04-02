<script lang="ts">
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();

	const cover_image = 'https://images.unsplash.com/photo-1519681393784-d120267933ba';
	const about_icons = {
		location: '/img/profile/Address.png',
		email: '/img/profile/Gmail.png',
		phone: '/img/profile/Phone.png',
		add: '/img/profile/Add.png'
	};

	const profile_about = $derived(
		data['profile'] as (typeof data)['profile'] & {
			location?: string | null;
			phone?: string | null;
		}
	);

	let active_tab = $state<'posts' | 'videos' | 'shared'>('posts');

	const post_tiles = $derived.by(() =>
		data['photo_urls'].map((img: string, index: number) => ({ id: index + 1, img }))
	);
</script>

<svelte:head>
	<title>{data['profile'].name ?? data['profile'].username} (@{data['profile'].username})</title>
</svelte:head>

<div class="flex min-h-screen justify-center bg-[#070814] text-white">
	<div class="flex min-h-screen w-full max-w-6xl flex-col bg-[#0a0b1e] p-6 px-10 shadow-2xl">
		<div class="relative h-56 w-full md:h-74">
			<img src={cover_image} alt="Cover" class="h-full w-full rounded-3xl object-cover" />

			<div
				class="absolute -bottom-14 left-1/2 h-32 w-32 -translate-x-1/2 md:-bottom-20 md:h-48 md:w-48"
			>
				{#if data['profile'].image}
					<div
						class="relative z-10 h-full w-full overflow-hidden rounded-full border-5 border-[#0a0b1e] bg-[#1b1c31] lg:border-7"
					>
						<img
							src={data['profile'].image ||
								'/img/profile/profiles and wallpapers/night-light fury profile.jpg'}
							alt={data['profile'].name
								? `${data['profile'].name} avatar`
								: `${data['profile'].username} avatar`}
							class="h-full w-full object-cover"
						/>
					</div>
				{:else}
					<!-- <div
					 	class="relative z-10 flex h-full w-full items-center justify-center rounded-full border-5 border-[#0a0b1e] bg-[#1b1c31] text-5xl font-bold text-slate-300 lg:border-7"
					> -->
					<div
						class="relative z-10 h-full w-full overflow-hidden rounded-full border-5 border-[#0a0b1e] bg-[#1b1c31] lg:border-7"
					>
						<!-- {data.profile.username.slice(0, 1).toUpperCase()} -->
						<img
							src={data['profile'].image ||
								'/img/profile/profiles and wallpapers/night-light fury profile.jpg'}
							alt={data['profile'].name
								? `${data['profile'].name} avatar`
								: `${data['profile'].username} avatar`}
							class="h-full w-full object-cover"
						/>
					</div>
				{/if}

				<button
					class="absolute top-10 -left-40 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 md:shadow-md lg:-left-70 lg:h-15 lg:w-15"
				>
					<img
						src="/img/profile/edit-profile.png"
						alt="Edit"
						class="h-5 w-5 object-contain pl-1 lg:h-9 lg:w-9"
					/>
				</button>

				<button
					class="absolute bottom-5 -left-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 sm:z-20 md:z-20 md:shadow-md lg:-left-40 lg:h-15 lg:w-15"
				>
					<img
						src="/img/profile/share-account.png"
						alt="Share"
						class="h-5 w-5 object-contain pr-1 lg:h-8 lg:w-8"
					/>
				</button>

				<button
					class="absolute -right-20 bottom-5 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 md:shadow-md lg:-right-40 lg:h-15 lg:w-15"
				>
					<img
						src="/img/profile/add-friend.png"
						alt="Add"
						class="h-6 w-6 object-contain pl-1 lg:h-9 lg:w-9"
					/>
				</button>

				<button
					class="absolute top-10 -right-40 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 md:shadow-md lg:-right-70 lg:h-15 lg:w-15"
				>
					<img
						src="/img/profile/setting.png"
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
			{#if !data['relationship'].is_own_profile}
				<form
					class="mt-4"
					method="post"
					action={data['relationship'].is_following ? '?/unfollow' : '?/follow'}
				>
					<button
						type="submit"
						class="rounded-full border px-6 py-2 text-sm font-semibold text-white transition {data[
							'relationship'
						].is_following
							? 'border-[#E9A0F8] bg-[#62218D] hover:bg-[#7a2aac]'
							: 'border-[#7DD4FF] bg-[#4B7F99] hover:bg-[#5e97b4]'}"
					>
						{data['relationship'].is_following ? 'Following' : 'Follow'}
					</button>
				</form>
			{/if}
		</div>

		{#if form?.message}
			<p
				class="mx-6 mt-4 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100"
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
				<div class="text-2xl font-bold text-sky-400">{data['stats'].followers_count}</div>
				<div class="text-xs tracking-wider text-slate-500 uppercase">Followers</div>
			</div>

			<div class="h-8 w-px bg-slate-700"></div>

			<div class="text-center">
				<div class="text-2xl font-bold text-sky-400">{data['stats'].following_count}</div>
				<div class="text-xs tracking-wider text-slate-500 uppercase">Following</div>
			</div>
		</div>

		<div class="relative mx-6 mt-6 rounded-3xl bg-[#121324] p-6">
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
				{data['profile'].bio || 'This user has not added a bio yet.'}
			</p>

			<div class="relative z-10 mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300">
				{#if profile_about.location}
					<div class="flex items-center gap-2">
						<img src={about_icons.location} alt="Location" class="h-4 w-4" />
						{profile_about.location}
					</div>
				{:else}
					<div class="flex cursor-pointer items-center gap-2 font-medium text-sky-400">
						<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add location
					</div>
				{/if}

				{#if profile_about.email}
					<div class="flex items-center gap-2 truncate">
						<img src={about_icons.email} alt="Email" class="h-4 w-4" />
						{profile_about.email}
					</div>
				{:else}
					<div class="flex cursor-pointer items-center gap-2 font-medium text-sky-400">
						<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add email
					</div>
				{/if}

				{#if profile_about.phone}
					<div class="flex items-center gap-2">
						<img src={about_icons.phone} alt="Phone" class="h-4 w-4" />
						{profile_about.phone}
					</div>
				{:else}
					<div class="flex cursor-pointer items-center gap-2 font-medium text-sky-400">
						<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add phone number
					</div>
				{/if}

				<div class="flex cursor-pointer items-center gap-2 font-medium text-sky-400">
					<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add More
				</div>
			</div>
		</div>

		<div
			class="mx-6 mt-6 flex items-center gap-2 rounded-full border-[6px] border-[#535060] bg-[#474555] p-1.5 text-sm font-bold"
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

		<div class="mx-6 mt-6 grid grid-cols-3 gap-1 pb-8 md:gap-3">
			{#if post_tiles.length === 0}
				<button
					class="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-purple-500/20 bg-linear-to-br from-[#7DD4FF] via-[#AAAAAA] to-[#CD82FF] transition-transform hover:scale-[0.98] md:rounded-2xl"
				>
					<span class="text-5xl font-light text-white/70">+</span>
				</button>
			{:else}
				{#each post_tiles as post (post.id)}
					<div
						class="aspect-square cursor-pointer overflow-hidden rounded-xl transition-transform hover:scale-[0.98] md:rounded-2xl"
					>
						<img src={post.img} alt="Post" class="h-full w-full object-cover" loading="lazy" />
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

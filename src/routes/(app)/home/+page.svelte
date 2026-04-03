<script lang="ts">
	import './home.css';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// eslint-disable-next-line @typescript-eslint/naming-convention
	let grid_view = $state(false);

	function time_ago(date: Date): string {
		const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
		if (seconds < 60) return 'a few moments ago';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			const rounded = minutes < 5 ? 1 : Math.floor(minutes / 5) * 5;
			return `${rounded} minute${rounded === 1 ? '' : 's'} ago`;
		}
		const hours = Math.floor(seconds / 3600);
		if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
		const days = Math.floor(seconds / 86400);
		return `${days} day${days === 1 ? '' : 's'} ago`;
	}
</script>

<!-- Sticky Header Bar -->
<div class="sticky top-0 z-10 flex items-center justify-between bg-[#09051c] px-8 py-6">
	<h2 class="text-6xl font-bold text-white">Feed</h2>
	<button
		class="p-2 transition-colors {grid_view ? 'text-white' : 'text-white/70'} hover:text-white"
		onclick={() => (grid_view = !grid_view)}
	>
		<span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1"
			>grid_view</span
		>
	</button>
</div>

<div class="overscroll-hidden overflow-y-scroll overscroll-y-none px-8 pb-8">
	{#if grid_view}
		<!-- Grid View -->
		<div class="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
			{#each data.posts as post (post.id)}
				<div
					class="overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
				>
					<!-- Author row -->
					<div class="flex items-center gap-3 px-4 pt-4">
						{#if post.author_avatar}
							<img
								src={post.author_avatar}
								alt={post.author_name}
								class="h-12 w-12 rounded-full object-cover"
							/>
						{:else}
							<div
								class="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white"
							>
								{post.author_name?.[0]?.toUpperCase() ?? '?'}
							</div>
						{/if}
						<span class="text-xl font-semibold text-white">{post.author_name}</span>
						<span class="text-xs text-white/50">{time_ago(post.created_at)}</span>
						<button class="ml-auto text-white/50 transition-colors hover:text-white">
							<img src="/images/three-dots-icon.avif" alt="more options" class="h-3 w-auto" />
						</button>
					</div>
					<!-- Post image with caption overlay -->
					<div class="relative mx-4 mt-3 overflow-hidden rounded-2xl">
						{#if post.media_url && post.media_type === 'image'}
							<img src={post.media_url} alt="post" class="w-full object-cover" />
						{/if}
						{#if post.content}
							<div
								class="absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/80 to-transparent px-3 pt-16 pb-3"
							>
								<p class="truncate text-sm text-white">{post.content}</p>
							</div>
						{/if}
					</div>
					<!-- Space reserved for reaction buttons -->
					<div class="h-12"></div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Single Post Feed View -->
		<div class="flex flex-col items-center gap-10">
			{#each data.posts as post (post.id)}
				<div
					class="w-full max-w-xl overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
				>
					<!-- Author row -->
					<div class="flex items-center gap-3 px-4 pt-4">
						{#if post.author_avatar}
							<img
								src={post.author_avatar}
								alt={post.author_name}
								class="h-10 w-10 rounded-full object-cover"
							/>
						{:else}
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white"
							>
								{post.author_name?.[0]?.toUpperCase() ?? '?'}
							</div>
						{/if}
						<span class="text-xl font-semibold text-white">{post.author_name}</span>
						<span class="text-xs text-white/50">{time_ago(post.created_at)}</span>
						<button class="ml-auto text-white/50 transition-colors hover:text-white">
							<img src="/images/three-dots-icon.avif" alt="more options" class="h-3 w-auto" />
						</button>
					</div>
					<!-- Post image with caption overlay -->
					<div class="relative mx-4 mt-3 overflow-hidden rounded-2xl">
						{#if post.media_url && post.media_type === 'image'}
							<img src={post.media_url} alt="post" class="w-full object-cover" />
						{/if}
						{#if post.content}
							<p
								class="absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/70 to-transparent px-3 pt-6 pb-3 text-sm text-white"
							>
								{post.content}
							</p>
						{/if}
					</div>
					<!-- Space reserved for reaction buttons -->
					<div class="h-12"></div>
				</div>
			{/each}
		</div>
	{/if}

	{#if data.has_more}
		<div class="mt-4 flex justify-center pb-8">
			<a
				href={resolve(`/home?page=${data.page + 1}`)}
				class="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
			>
				Load more
			</a>
		</div>
	{/if}
</div>

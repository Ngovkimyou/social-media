<script lang="ts">
	import './home.css';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// eslint-disable-next-line @typescript-eslint/naming-convention
	let grid_view = $state(false);
	let expanded_captions = $state<Record<string, boolean>>({});
	let overflowing_captions = $state<Record<string, boolean>>({});

	function caption_key(view: 'grid' | 'feed', post_id: string | number) {
		return `${view}-${String(post_id)}`;
	}

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

	function toggle_caption(caption_id: string) {
		const key = caption_id;
		expanded_captions = {
			...expanded_captions,
			[key]: !expanded_captions[key]
		};
	}

	function set_caption_overflow(caption_id: string, is_overflowing: boolean) {
		const key = caption_id;
		if (overflowing_captions[key] === is_overflowing) {
			return;
		}

		overflowing_captions = {
			...overflowing_captions,
			[key]: is_overflowing
		};
	}

	function measure_caption(node: HTMLElement, caption_id: string): { destroy(): void } {
		const update = () => {
			set_caption_overflow(caption_id, node.scrollHeight > node.clientHeight + 1);
		};

		const resize_observer = new ResizeObserver(() => {
			update();
		});

		resize_observer.observe(node);
		requestAnimationFrame(update);

		return {
			destroy() {
				resize_observer.disconnect();
			}
		};
	}
</script>

<div class="flex h-screen min-h-0 flex-col overflow-hidden">
	<!-- Sticky Header Bar -->
	<div class="sticky top-0 z-10 flex items-center justify-between bg-[#09051c] p-4 md:p-6 lg:p-8">
		<h2 class="text-2xl font-bold text-white md:text-4xl">Feed</h2>
		<button
			class="group transition-colors duration-200 {grid_view
				? 'text-white'
				: 'text-white/70'} hover:text-white"
			onclick={() => (grid_view = !grid_view)}
			aria-label={grid_view ? 'Switch to feed view' : 'Switch to grid view'}
		>
			<img
				src="/images/home-screen/content-grid-view.avif"
				alt=""
				class="h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110 {grid_view
					? 'opacity-100'
					: 'opacity-70'} md:h-7 md:w-7"
			/>
		</button>
	</div>

	<div
		class="home-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-none px-4 pb-6 md:px-8 md:pb-8"
	>
		{#if grid_view}
			<!-- Grid View -->
			<div
				class="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-2.5 lg:grid-cols-3 lg:gap-4 xl:gap-6 2xl:gap-8"
			>
				{#each data.posts as post (post.id)}
					<div
						class="overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
					>
						<!-- Author row -->
						<div class="flex items-center gap-3 px-5 pt-5 md:gap-3">
							{#if post.author_avatar}
								<img
									src={post.author_avatar}
									alt={post.author_name}
									class="h-10 w-10 rounded-full object-cover md:h-12 md:w-12"
								/>
							{:else}
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white md:h-12 md:w-12 md:text-sm"
								>
									{post.author_name?.[0]?.toUpperCase() ?? '?'}
								</div>
							{/if}
							<div class="min-w-0 overflow-hidden md:flex md:flex-col">
								<span class="block truncate text-base font-semibold text-white">
									{post.author_name}
								</span>
								<span class="block truncate text-sm text-white/50 md:text-sm">
									{time_ago(post.created_at)}
								</span>
							</div>
							<button class="ml-auto text-white/50 transition-colors hover:text-white">
								<img
									src="/images/home-screen/three-dots-icon.avif"
									alt="more options"
									class="h-3 w-auto md:h-2 xl:h-3"
								/>
							</button>
						</div>
						<!-- Post image with caption overlay -->
						<div class="relative mx-3 mt-3 aspect-4/5 overflow-hidden rounded-2xl md:mx-4">
							{#if post.media_url && post.media_type === 'image'}
								<img src={post.media_url} alt="post" class="h-full w-full object-cover" />
							{/if}
							{#if post.content}
								{#if expanded_captions[caption_key('grid', post.id)]}
									<button
										type="button"
										class="absolute inset-0 z-20 flex cursor-pointer items-end bg-black/55 px-4 py-4 text-left backdrop-blur-[1px]"
										aria-label="Collapse caption"
										onclick={() => toggle_caption(caption_key('grid', post.id))}
									>
										<div class="caption-overlay-scroll max-h-full w-full overflow-y-auto pr-1">
											<p class="user-content-text text-sm leading-6 whitespace-pre-line text-white">
												{post.content}
											</p>
											{#if overflowing_captions[caption_key('grid', post.id)]}
												<span
													class="mt-3 inline-block text-xs font-semibold tracking-wide text-sky-300"
												>
													See less
												</span>
											{/if}
										</div>
									</button>
								{:else}
									<div
										class="absolute right-0 bottom-0 left-0 z-20 bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-10 pb-3 text-left"
									>
										<button
											type="button"
											class={`block w-full pr-28 text-left ${overflowing_captions[caption_key('grid', post.id)] ? 'cursor-pointer' : 'cursor-default'}`}
											aria-label={overflowing_captions[caption_key('grid', post.id)]
												? 'Expand caption'
												: undefined}
											onclick={() => {
												if (overflowing_captions[caption_key('grid', post.id)]) {
													toggle_caption(caption_key('grid', post.id));
												}
											}}
										>
											<p
												use:measure_caption={caption_key('grid', post.id)}
												class="user-content-text caption-preview text-sm leading-5 whitespace-pre-line text-white"
											>
												{post.content}
											</p>
										</button>
										{#if overflowing_captions[caption_key('grid', post.id)]}
											<button
												type="button"
												class="absolute right-3 bottom-2.5 z-10 rounded-full bg-[#7DD4FF] px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-sky-200/25 hover:text-white"
												aria-label="Expand caption"
												onclick={() => toggle_caption(caption_key('grid', post.id))}
											>
												See more
											</button>
										{/if}
									</div>
								{/if}
							{/if}
						</div>
						<!-- Space reserved for reaction buttons -->
						<!-- Reaction buttons -->
						<div class="mx-4 flex items-center gap-4 pt-6 pb-4 md:mx-5 md:gap-5 md:pt-8">
							<button class="transition-opacity hover:opacity-70">
								<img src="/images/home-screen/unliked-state.avif" alt="like" class="h-6 w-auto" />
							</button>
							<button class="transition-opacity hover:opacity-70">
								<img src="/images/home-screen/comment-icon.avif" alt="comment" class="h-6 w-auto" />
							</button>
							<button class="transition-opacity hover:opacity-70">
								<img
									src="/images/home-screen/share-post-icon.avif"
									alt="share"
									class="h-6 w-auto"
								/>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- Single Post Feed View -->
			<div class="flex flex-col items-center gap-5 md:gap-8">
				{#each data.posts as post (post.id)}
					<div
						class="w-full max-w-xl overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
					>
						<!-- Author row -->
						<div class="flex items-center gap-3 px-5 pt-5 md:gap-3">
							{#if post.author_avatar}
								<img
									src={post.author_avatar}
									alt={post.author_name}
									class="h-10 w-10 rounded-full object-cover md:h-11 md:w-11"
								/>
							{:else}
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white md:h-11 md:w-11 md:text-sm"
								>
									{post.author_name?.[0]?.toUpperCase() ?? '?'}
								</div>
							{/if}
							<div class="min-w-0 overflow-hidden md:flex md:flex-col">
								<span class="block truncate text-base font-semibold text-white md:text-xl">
									{post.author_name}
								</span>
								<span class="block truncate text-sm text-white/50 md:text-sm">
									{time_ago(post.created_at)}
								</span>
							</div>
							<button class="ml-auto text-white/50 transition-colors hover:text-white">
								<img
									src="/images/home-screen/three-dots-icon.avif"
									alt="more options"
									class="h-3 w-auto"
								/>
							</button>
						</div>
						<!-- Post image with caption overlay -->
						<div class="relative mx-3 mt-3 overflow-hidden rounded-2xl bg-black/20 md:mx-4">
							{#if post.media_url && post.media_type === 'image'}
								<img src={post.media_url} alt="post" class="max-h-[70vh] w-full object-contain" />
							{/if}
							{#if post.content}
								{#if expanded_captions[caption_key('feed', post.id)]}
									<button
										type="button"
										class="absolute inset-0 z-20 flex cursor-pointer items-end rounded-2xl bg-black/55 px-4 py-4 text-left backdrop-blur-[1px]"
										aria-label="Collapse caption"
										onclick={() => toggle_caption(caption_key('feed', post.id))}
									>
										<div class="caption-overlay-scroll max-h-full w-full overflow-y-auto pr-1">
											<p class="user-content-text text-sm leading-6 whitespace-pre-line text-white">
												{post.content}
											</p>
											{#if overflowing_captions[caption_key('feed', post.id)]}
												<span
													class="mt-3 inline-block text-xs font-semibold tracking-wide text-sky-300"
												>
													See less
												</span>
											{/if}
										</div>
									</button>
								{:else}
									<div
										class="absolute right-0 bottom-0 left-0 z-20 bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-10 pb-3 text-left"
									>
										<button
											type="button"
											class={`block w-full pr-28 text-left ${overflowing_captions[caption_key('feed', post.id)] ? 'cursor-pointer' : 'cursor-default'}`}
											aria-label={overflowing_captions[caption_key('feed', post.id)]
												? 'Expand caption'
												: undefined}
											onclick={() => {
												if (overflowing_captions[caption_key('feed', post.id)]) {
													toggle_caption(caption_key('feed', post.id));
												}
											}}
										>
											<p
												use:measure_caption={caption_key('feed', post.id)}
												class="user-content-text caption-preview text-sm leading-5 whitespace-pre-line text-white"
											>
												{post.content}
											</p>
										</button>
										{#if overflowing_captions[caption_key('feed', post.id)]}
											<button
												type="button"
												class="absolute right-3 bottom-2.5 z-10 rounded-full bg-[#7DD4FF] px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-sky-200/25 hover:text-white"
												aria-label="Expand caption"
												onclick={() => toggle_caption(caption_key('feed', post.id))}
											>
												See more
											</button>
										{/if}
									</div>
								{/if}
							{/if}
						</div>
						<!-- Space reserved for reaction buttons -->
						<!-- Reaction buttons -->
						<div class="flex items-center gap-4 px-4 py-3 md:gap-5 md:px-5">
							<button class="transition-opacity hover:opacity-70">
								<img src="/images/home-screen/unliked-state.avif" alt="like" class="h-6 w-auto" />
							</button>
							<button class="transition-opacity hover:opacity-70">
								<img src="/images/home-screen/comment-icon.avif" alt="comment" class="h-6 w-auto" />
							</button>
							<button class="transition-opacity hover:opacity-70">
								<img
									src="/images/home-screen/share-post-icon.avif"
									alt="share"
									class="h-6 w-auto"
								/>
							</button>
						</div>
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
</div>

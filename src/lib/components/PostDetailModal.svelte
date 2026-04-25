<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { onMount } from 'svelte';
	import ProgressiveImage from '$lib/components/ProgressiveImage.svelte';
	import type { PostFeedPost } from '$lib/types/post-feed';

	type Props = {
		post: PostFeedPost;
		liked: boolean;
		on_close: () => void;
		on_like: () => void;
	};

	const { post, liked, on_close, on_like }: Props = $props();

	let panel_el = $state<HTMLDivElement | undefined>();

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

	onMount(() => {
		panel_el?.focus();
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			on_close();
		}
	}}
/>

<div
	class="fixed inset-0 z-80 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md md:p-6"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) on_close();
	}}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			on_close();
		}
	}}
	transition:fade={{ duration: 180 }}
>
	<div
		bind:this={panel_el}
		role="dialog"
		aria-modal="true"
		aria-label="Post detail"
		tabindex="-1"
		class="relative flex h-full max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#0d0921] shadow-[inset_1px_-1px_40px_0px_#CD82FF44,0_20px_80px_rgba(0,0,0,0.7)] outline-none md:max-h-[88dvh] md:flex-row"
		transition:scale={{ duration: 220, start: 0.94, opacity: 0.55 }}
	>
		<!-- Close button -->
		<button
			type="button"
			onclick={on_close}
			class="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/60 transition-all hover:bg-black/70 hover:text-white"
			aria-label="Close"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>

		<!-- Left: Image -->
		<div
			class="relative flex h-[clamp(220px,45vh,500px)] min-h-0 shrink-0 items-center justify-center overflow-hidden md:h-full md:flex-1 md:rounded-l-2xl"
		>
			{#if post.media_url && post.media_type === 'image'}
				<ProgressiveImage
					src={post.media_display_url ?? post.media_url}
					srcset={post.media_display_srcset}
					alt={`${post.author_name}'s post`}
					wrapper_class="h-full w-full"
					img_class="h-full w-full object-contain"
					skeleton_class="rounded-none"
					loading="eager"
					decoding="async"
					fetchpriority="high"
				/>
			{:else}
				<div class="flex h-full w-full items-center justify-center text-white/20">
					<svg class="h-16 w-16" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-1 14H6l4-5 3 4 2-2.5 3 3.5z"
						/>
					</svg>
				</div>
			{/if}
		</div>

		<!-- Right: Details -->
		<div
			class="flex min-h-0 flex-1 flex-col border-t border-white/10 md:w-85 md:flex-none md:shrink-0 md:border-t-0 md:border-l lg:w-96"
		>
			<!-- Author header -->
			<div class="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
				{#if post.author_avatar}
					<ProgressiveImage
						src={post.author_avatar}
						alt={post.author_name}
						wrapper_class="h-9 w-9 shrink-0 rounded-full"
						img_class="h-full w-full rounded-full object-cover"
						skeleton_class="rounded-full"
						loading="eager"
						decoding="async"
					/>
				{:else}
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white"
					>
						{post.author_name?.[0]?.toUpperCase() ?? '?'}
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold text-white">{post.author_name}</p>
					<p class="truncate text-xs text-white/40">@{post.author_username}</p>
				</div>
			</div>

			<!-- Description + Comments (scrollable) -->
			<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
				{#if post.content}
					<div class="flex gap-3">
						{#if post.author_avatar}
							<ProgressiveImage
								src={post.author_avatar}
								alt={post.author_name}
								wrapper_class="h-8 w-8 shrink-0 rounded-full"
								img_class="h-full w-full rounded-full object-cover"
								skeleton_class="rounded-full"
								loading="eager"
								decoding="async"
							/>
						{:else}
							<div
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white"
							>
								{post.author_name?.[0]?.toUpperCase() ?? '?'}
							</div>
						{/if}
						<div class="min-w-0">
							<p class="text-sm leading-relaxed text-white">
								<span class="font-semibold">{post.author_name}</span>
								<span class="ml-2 whitespace-pre-line text-white/80">{post.content}</span>
							</p>
							<p class="mt-1.5 text-xs text-white/35">{time_ago(post.created_at)}</p>
						</div>
					</div>
				{/if}

				<!-- Comments placeholder -->
				<div class="mt-6 flex flex-col items-center justify-center gap-2 py-8 text-center">
					<svg
						class="h-10 w-10 text-white/15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
						/>
					</svg>
					<p class="text-sm text-white/30">No comments yet</p>
					<p class="text-xs text-white/20">Be the first to comment</p>
				</div>
			</div>

			<!-- Action bar + comment input -->
			<div class="shrink-0 border-t border-white/10 px-4 py-3">
				<div class="flex items-center gap-4">
					<button
						type="button"
						class="group relative h-6 w-6 transition-opacity hover:opacity-70"
						onclick={on_like}
						aria-label={liked ? 'Unlike post' : 'Like post'}
					>
						<img
							src="/images/home-screen/unliked-state.avif"
							alt=""
							class="absolute inset-0 h-6 w-auto origin-center object-contain transition-all duration-250 ease-out {liked
								? 'scale-75 opacity-0'
								: 'scale-100 opacity-100'}"
						/>
						<img
							src="/images/home-screen/liked-state.avif"
							alt="like"
							class="absolute inset-0 h-6 w-auto origin-center object-contain transition-all duration-250 ease-out {liked
								? 'scale-100 opacity-100'
								: 'scale-125 opacity-0'}"
						/>
					</button>
					<button type="button" class="transition-opacity hover:opacity-70">
						<img src="/images/home-screen/comment-icon.avif" alt="comment" class="h-6 w-auto" />
					</button>
					<button type="button" class="transition-opacity hover:opacity-70">
						<img src="/images/home-screen/share-post-icon.avif" alt="share" class="h-6 w-auto" />
					</button>
				</div>

				<div class="mt-3 flex items-center gap-2">
					<input
						type="text"
						placeholder="Add a comment…"
						disabled
						class="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition-colors outline-none placeholder:text-white/30 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
					/>
					<button
						type="button"
						disabled
						class="shrink-0 text-sm font-semibold text-sky-400 transition-colors hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Post
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
